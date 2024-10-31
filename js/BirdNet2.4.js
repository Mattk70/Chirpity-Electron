let tf, BACKEND;
try {
    tf = require('@tensorflow/tfjs-node');
} catch {
    tf = require('@tensorflow/tfjs');
    BACKEND = 'webgpu';
}
const fs = require('node:fs');
const path = require('node:path');
let DEBUG = false;


//GLOBALS
let myModel;

const CONFIG = {
    sampleRate: 48_000, specLength: 3, sigmoid: 1,
};


onmessage = async (e) => {
    const modelRequest = e.data.message;
    const worker = e.data.worker;
    let response;
    try {
        switch (modelRequest) {
            case 'change-batch-size': {
                myModel.warmUp(e.data.batchSize);
                break;
            }
            case "load": {
                const version = e.data.model;
                DEBUG && console.log("load request to worker");
                const { height, width, location } = JSON.parse(fs.readFileSync(path.join(__dirname, `../${version}_model_config.json`), "utf8"));
                const appPath = "../" + location + "/";
                const list = e.data.list;
                const batch = e.data.batchSize;
                const backend = BACKEND || e.data.backend;
                backend === 'webgpu' &&  require('@tensorflow/tfjs-backend-webgpu');
                let labels;
                const labelFile = `../labels/V2.4/BirdNET_GLOBAL_6K_V2.4_Labels_en.txt`; 
                await fetch(labelFile).then(response => {
                    if (! response.ok) throw new Error('Network response was not ok');
                    return response.text();
                }).then(filecontents => {
                    labels = filecontents.trim().split(/\r?\n/);
                }).catch(error =>{
                    console.error('There was a problem fetching the label file:', error);
                })
                DEBUG && console.log(`model received load instruction. Using list: ${list}, batch size ${batch}`);
                
                tf.setBackend(backend).then(async () => {
                    tf.enableProdMode();
                    if (DEBUG) {
                        console.log(tf.env());
                        console.log(tf.env().getFlags());
                    }
                    myModel = new Model(appPath, version);
                    myModel.height = height;
                    myModel.width = width;
                    myModel.labels = labels;
                    await myModel.loadModel();
                    await myModel.warmUp(batch);
                    BACKEND = tf.getBackend();
                    postMessage({
                        message: "model-ready",
                        sampleRate: myModel.config.sampleRate,
                        chunkLength: myModel.chunkLength,
                        backend: BACKEND,
                        labels: labels,
                        worker: worker
                    });
                });
                break;
            }
            case "predict": {
                if (myModel?.model_loaded) {
                    const { chunks, start, fileStart, file, snr, confidence, worker, context, resetResults } = e.data;
                    myModel.useContext = context;
                    myModel.selection =  !resetResults;
                    const [result,filename,startPosition] = await myModel.predictChunk(chunks, start, fileStart, file, snr, confidence / 1000);
                    response = {
                        message: "prediction",
                        file: filename,
                        result: result,
                        fileStart: startPosition,
                        worker: worker,
                        selection: myModel.selection
                    };
                    postMessage(response);
                    myModel.result = [];
                }
                break;
            }
            
        }
    }
    // If worker was respawned
    catch (error) {
        console.log(error)
    }
};

class Model {
    constructor(appPath, version) {
        this.model = undefined;
        this.labels = undefined;
        this.height = undefined;
        this.width = undefined;
        this.config = CONFIG;
        this.chunkLength = this.config.sampleRate * this.config.specLength;
        this.model_loaded = false;
        this.appPath = appPath;
        this.useContext = undefined;
        this.version = version;
        this.selection = false;
    }

    async loadModel() {
        DEBUG && console.log('loading model')
        if (this.model_loaded === false) {
            // Model files must be in a different folder than the js, assets files
            DEBUG && console.log('loading model from', this.appPath + 'model.json')
            this.model = await tf.loadLayersModel(this.appPath + 'model.json',
                { weightPathPrefix: this.appPath });
            this.model_loaded = true;
            this.inputShape = [...this.model.inputs[0].shape];
        }
    }

    async warmUp(batchSize) {
        this.batchSize = parseInt(batchSize);
        this.inputShape[0] = this.batchSize;
        DEBUG && console.log('WarmUp begin', tf.memory().numTensors);
        const input = tf.zeros(this.inputShape);
        
        // Parallel compilation for faster warmup
        // https://github.com/tensorflow/tfjs/pull/7755/files#diff-a70aa640d286e39c922aa79fc636e610cae6e3a50dd75b3960d0acbe543c3a49R316
        if (tf.getBackend() === 'webgl') {
            tf.env().set('ENGINE_COMPILE_ONLY', true);
            const compileRes = this.model.predict(input, { batchSize: this.batchSize });
            tf.env().set('ENGINE_COMPILE_ONLY', false);
            await tf.backend().checkCompileCompletionAsync();
            tf.backend().getUniformLocations();
            tf.dispose(compileRes);
            input.dispose();
        } else if (tf.getBackend() === 'webgpu') {
            tf.env().set('WEBGPU_ENGINE_COMPILE_ONLY', true);
            const compileRes = this.model.predict(input, { batchSize: this.batchSize });
            tf.env().set('WEBGPU_ENGINE_COMPILE_ONLY', false);
            await tf.backend().checkCompileCompletionAsync();
            tf.dispose(compileRes);
        }
        input.dispose()
        DEBUG && console.log('WarmUp end', tf.memory().numTensors)
        return true;
    }

    async predictBatch(audio, keys) {
        const tb = audio; //this.fixUpSpecBatch(audio); // + 1 tensor

        const prediction = this.model.predict(tb, { batchSize: this.batchSize })
        
        let newPrediction;
        if (this.selection) {
            newPrediction = tf.max(prediction, 0, true);
            prediction.dispose();
            keys = keys.splice(0, 1);
        }
        tb.dispose();

        const finalPrediction = newPrediction || prediction;
        
        const { indices, values } = tf.topk(finalPrediction, 5, true);
        
        // The GPU backend is *so* slow with BirdNET, let's not queue up predictions
        const [topIndices, topValues] = 
            await Promise.all([indices.array(), values.array()]).catch(err => console.log('Data transfer error:',err));
        indices.dispose();
        values.dispose();

        finalPrediction.dispose();
        if (newPrediction) newPrediction.dispose();
        keys = keys.map(key => (key / CONFIG.sampleRate).toFixed(3));
        return [keys, topIndices, topValues];
    }


    padAudio = (audio) => {
        const remainder = audio.length % this.chunkLength;
        if (remainder){ 
            // Create a new array with the desired length
            const paddedAudio = new Float32Array(audio.length + (this.chunkLength -remainder));
            // Copy the existing values into the new array
            paddedAudio.set(audio);
            return paddedAudio;
        } else return audio
    };

    async predictChunk(audioBuffer, start, fileStart, file, threshold, confidence) {
        DEBUG && console.log('predictCunk begin', tf.memory());
        audioBuffer = this.padAudio(audioBuffer);
        audioBuffer = tf.tensor1d(audioBuffer);
        const numSamples = audioBuffer.shape / this.chunkLength;
        const audioBatch = audioBuffer.reshape([numSamples, this.chunkLength]);
        audioBuffer.dispose();
        const batchKeys = [...Array(numSamples).keys()].map(i => start + this.chunkLength * i);
        const result = await this.predictBatch(audioBatch, batchKeys, threshold, confidence);
        DEBUG && console.log('predictCunk end', tf.memory());
        return [result, file, fileStart];
    }
}


/// Birdnet definitions

// Define custom layer for computing mel spectrograms
class MelSpecLayerSimple extends tf.layers.Layer {
    constructor(config) {
        super(config);

        // Initialize parameters
        this.sampleRate = config.sampleRate;
        this.specShape = config.specShape;
        this.frameStep = config.frameStep;
        this.frameLength = config.frameLength;
        this.fmin = config.fmin;
        this.fmax = config.fmax;
        this.melFilterbank = tf.tensor2d(config.melFilterbank);
    }

    build(inputShape) {
        // Initialize trainable weights, for example:
        this.magScale = this.addWeight(
            'magnitude_scaling',
            [],
            'float32',
            tf.initializers.constant({ value: 1.23 })
        );

        super.build(inputShape);
    }

    // Compute the output shape of the layer
    computeOutputShape(inputShape) {
        return [inputShape[0], this.specShape[0], this.specShape[1], 1];
    }

    // Define the layer's forward pass
    call(inputs) {
        return tf.tidy(() => {
            // inputs is a tensor representing the input data
            inputs = inputs[0];
            const inputList = tf.split(inputs, inputs.shape[0])
            const specBatch = inputList.map(input =>{
                input = input.squeeze();
                // Normalize values between -1 and 1
                input = tf.sub(input, tf.min(input, -1, true));
                input = tf.div(input, tf.max(input, -1, true).add(0.000001));
                input = tf.sub(input, 0.5);
                input = tf.mul(input, 2.0);

                // Perform STFT
                let spec = tf.signal.stft(
                    input,
                    this.frameLength,
                    this.frameStep,
                    this.frameLength,
                    tf.signal.hannWindow,
                );

                // Cast from complex to float
                spec = tf.cast(spec, 'float32');

                // Apply mel filter bank
                spec = tf.matMul(spec, this.melFilterbank);

                // Convert to power spectrogram
                spec = spec.pow(2.0);

                // Apply nonlinearity
                spec = spec.pow(tf.div(1.0, tf.add(1.0, tf.exp(this.magScale.read()))));

                // Flip the spectrogram
                spec = tf.reverse(spec, -1);

                // Swap axes to fit input shape
                spec = tf.transpose(spec)

                // Adding the channel dimension
                spec = spec.expandDims(-1);

                return spec;
            })
            return tf.stack(specBatch)
        });
    }

    // Optionally, include the `className` method to provide a machine-readable name for the layer
    static get className() {
        return 'MelSpecLayerSimple';
    }
}

// Register the custom layer with TensorFlow.js
tf.serialization.registerClass(MelSpecLayerSimple);


/////////////////////////  Build GlobalExpPool2D Layer  /////////////////////////
function logmeanexp(x, axis, keepdims, sharpness) {
    const xmax = tf.max(x, axis, true);
    const xmax2 = tf.max(x, axis, keepdims);
    x = tf.mul(sharpness, tf.sub(x, xmax));
    let y = tf.log(tf.mean(tf.exp(x), axis, keepdims));
    y = tf.add(tf.div(y, sharpness), xmax2);
    return y
}

class GlobalLogExpPooling2D extends tf.layers.Layer {
    constructor(config) {
      super(config);
    }

    build(inputShape) {
        this.sharpness = this.addWeight('sharpness', [1], 'float32', tf.initializers.constant({value: 2}));
    }

    computeOutputShape(inputShape) { return [inputShape[0], inputShape[3]]; }
   
    call(input, kwargs) {
        
        return logmeanexp(input[0], [1, 2], false, this.sharpness.read());//.read().dataSync()[0]); 
    
    }
   
    static get className() { return 'GlobalLogExpPooling2D'; }
}

tf.serialization.registerClass(GlobalLogExpPooling2D);

/////////////////////////  Build Sigmoid Layer  /////////////////////////
class SigmoidLayer extends tf.layers.Layer {
    constructor(config) {
      super(config);
      this.config = config;
    }

    build(inputShape) {
        this.kernel = this.addWeight('scale_factor', [1], 'float32', tf.initializers.constant({value: 1}));
    }

    computeOutputShape(inputShape) { return inputShape; }

    call(input, kwargs) { 
        
        return tf.sigmoid(tf.mul(input[0], CONFIG.sigmoid))
        
    }   
   
    static get className() { return 'SigmoidLayer'; }
}

tf.serialization.registerClass(SigmoidLayer);
