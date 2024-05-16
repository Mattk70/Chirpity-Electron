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
                if (myModel.model_loaded) {
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
            case "get-spectrogram": {
                const buffer = e.data.buffer;
                const specFile = e.data.file;
                const filepath = e.data.filepath;
                const spec_height = e.data.height;
                const spec_width = e.data.width;
                let image;
                if (buffer.length !== 72000) {
                    console.log((`Skipping ${e.data.file} as buffer size is ${buffer.length}`))
                    return;
                }
                const signal = tf.tensor1d(buffer, "float32");
                const bufferTensor = myModel.normalise_audio(signal);
                signal.dispose();
                const imageTensor = tf.tidy(() => {
                    return myModel.makeSpectrogram(bufferTensor);
                });
                image = tf.tidy(() => {
                    let spec = myModel.fixUpSpecBatch(tf.expandDims(imageTensor, 0), spec_height, spec_width);
                    const spec_max = tf.max(spec);
                    return spec.mul(255).div(spec_max).dataSync();
                });
                bufferTensor.dispose();
                imageTensor.dispose();
                response = {
                    message: "spectrogram",
                    width: 384,
                    height: 256,
                    channels: 1,
                    image: image,
                    file: specFile,
                    filepath: filepath,
                    worker: worker
                };
                postMessage(response);
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

    normalize(spec) {
        return tf.tidy(() => {
            // console.log('Pre-norm### Min is: ', spec.min().dataSync(), 'Max is: ', spec.max().dataSync())
            const spec_max = tf.max(spec, [1, 2]).reshape([-1, 1, 1, 1])
            // const spec_min = tf.min(spec, [1, 2]).reshape([-1, 1, 1, 1])
            spec = spec.mul(255);
            spec = spec.div(spec_max);
            // spec = tf.sub(spec, spec_min).div(tf.sub(spec_max, spec_min));
            // console.log('{Post norm#### Min is: ', spec.min().dataSync(), 'Max is: ', spec.max().dataSync())
            return spec
        })
    }

    getSNR(spectrograms) {
        return tf.tidy(() => {
            const { mean, variance } = tf.moments(spectrograms, 2);
            const peak = tf.div(variance, mean)
            let snr = tf.squeeze(tf.max(peak, 1));
            //snr = tf.sub(255, snr)  // bigger number, less signal
            // const MEAN = mean.arraySync()
            // const VARIANCE = variance.arraySync()
            // const PEAK = peak.arraySync()
            return snr
        })
    }


    fixUpSpecBatch(specBatch, h, w) {
        const img_height = h || this.height;
        const img_width = w || this.width;
        return tf.tidy(() => {
            /*
            Try out taking log of spec when SNR is below threshold?
            */
            //specBatch = tf.log1p(specBatch).mul(20);
            // Swap axes to fit output shape
            specBatch = tf.transpose(specBatch, [0, 2, 1]);
            specBatch = tf.reverse(specBatch, [1]);
            // Add channel axis
            specBatch = tf.expandDims(specBatch, -1);
            //specBatch = tf.slice4d(specBatch, [0, 1, 0, 0], [-1, img_height, img_width, -1]);
            specBatch = tf.image.resizeBilinear(specBatch, [img_height, img_width], true);
            return this.version === 'v1' ? specBatch : this.normalize(specBatch)
        })
    }

    padBatch(tensor) {
        return tf.tidy(() => {
            DEBUG && console.log(`Adding ${this.batchSize - tensor.shape[0]} tensors to the batch`)
            const shape = [...tensor.shape];
            shape[0] = this.batchSize - shape[0];
            const padding = tf.zeros(shape);
            return tf.concat([tensor, padding], 0)
        })
    }

    async predictBatch(audio, keys, threshold, confidence) {
        const TensorBatch = audio; //this.fixUpSpecBatch(audio); // + 1 tensor
        
        let paddedTensorBatch, maskedTensorBatch;
        if (BACKEND === 'webgl' && TensorBatch.shape[0] < this.batchSize) {
            // WebGL works best when all batches are the same size
            paddedTensorBatch = this.padBatch(TensorBatch)  // + 1 tensor
        } 
        const tb = paddedTensorBatch || TensorBatch;
        const prediction = this.model.predict(tb, { batchSize: this.batchSize })
        
        let newPrediction;
        if (this.selection) {
            newPrediction = tf.max(prediction, 0, true);
            prediction.dispose();
            keys = keys.splice(0, 1);
        }
        TensorBatch.dispose();
        if (paddedTensorBatch) paddedTensorBatch.dispose();
        if (maskedTensorBatch) maskedTensorBatch.dispose();

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

    makeSpectrogram(signal) {
        return tf.tidy(() => {
            let spec = tf.abs(tf.signal.stft(signal, this.frame_length, this.frame_step));
            signal.dispose();
            return spec;
        })
    }

    normalise_audio = (signal) => {
        return tf.tidy(() => {
            //signal = tf.tensor1d(signal, 'float32');
            const sigMax = tf.max(signal);
            const sigMin = tf.min(signal);
            const range = sigMax.sub(sigMin);
            //return signal.sub(sigMin).div(range).mul(tf.scalar(8192.0, 'float32')).sub(tf.scalar(4095, 'float32'))
            return signal.sub(sigMin).div(range).mul(tf.scalar(2)).sub(tf.scalar(1))
        })
    };

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
