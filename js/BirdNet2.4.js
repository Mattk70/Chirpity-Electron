let tf, BACKEND;
try {
    tf = require('@tensorflow/tfjs-node');
    BACKEND = 'tensorflow';
} catch {
    tf = require('@tensorflow/tfjs');
    require('@tensorflow/tfjs-backend-webgpu');
    BACKEND = 'webgpu'
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
                const backend = BACKEND === 'webgpu' ? BACKEND : e.data.backend;
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
                    //tf.enableProdMode();
                    if (DEBUG) {
                        console.log(tf.env());
                        console.log(tf.env().getFlags());
                    }
                    myModel = new Model(appPath, list, version);
                    myModel.height = height;
                    myModel.width = width;
                    myModel.labels = labels;
                    myModel.lat = parseFloat(e.data.lat);
                    myModel.lon = parseFloat(e.data.lon);
                    myModel.week = parseInt(e.data.week);
                    myModel.speciesThreshold = parseFloat(e.data.threshold);
                    await myModel.loadModel();
                    myModel.warmUp(batch);
                    BACKEND = tf.getBackend();
                    postMessage({
                        message: "model-ready",
                        sampleRate: myModel.config.sampleRate,
                        chunkLength: myModel.chunkLength,
                        backend: tf.getBackend(),
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
    constructor(appPath, list, version) {
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

    warmUp(batchSize) {
        this.batchSize = parseInt(batchSize);
        this.inputShape[0] = this.batchSize;
        if (tf.getBackend() === 'webgl') {
            tf.tidy(() => {
                //const warmupResult = this.model.predict(tf.zeros(this.inputShape), { batchSize: this.batchSize });
                const warmupResult = this.model.predict(tf.zeros([1,144_000]), { batchSize: this.batchSize });
                warmupResult.arraySync();
                // see if we can get padding compiled at this point
                //this.padBatch(tf.zeros([1, this.inputShape[1], this.inputShape[2], this.inputShape[3]]), { batchSize: this.batchSize })
            })
        }
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

    addContext(prediction, tensor, confidence) {
        // Create a set of images from the batch, offset by half the width of the original images
        const [_, height, width, channel] = tensor.shape;
        return tf.tidy(() => {
            const firstHalf = tensor.slice([0, 0, 0, 0], [-1, -1, width / 2, -1]);
            const secondHalf = tensor.slice([0, 0, width / 2, 0], [-1, -1, width / 2, -1]);
            const paddedSecondHalf = tf.concat([tf.zeros([1, height, width / 2, channel]), secondHalf], 0);
            secondHalf.dispose();
            // prepend padding tensor
            const [droppedSecondHalf, _] = paddedSecondHalf.split([paddedSecondHalf.shape[0] - 1, 1]);  // pop last tensor
            paddedSecondHalf.dispose();
            const combined = tf.concat([droppedSecondHalf, firstHalf], 2);  // concatenate adjacent pairs along the width dimension
            firstHalf.dispose();
            droppedSecondHalf.dispose();
            const rshiftPrediction = this.model.predict(combined, { batchSize: this.batchSize });
            combined.dispose();
            // now we have predictions for both the original and rolled images
            const [padding, remainder] = tf.split(rshiftPrediction, [1, -1]);
            const lshiftPrediction = tf.concat([remainder, padding]);
            // Get the highest predictions from the overlapping images
            const surround = tf.maximum(rshiftPrediction, lshiftPrediction);
            lshiftPrediction.dispose();
            rshiftPrediction.dispose();
            // Mask out where these are below the threshold
            const indices = tf.greater(surround, confidence);
            return prediction.where(indices, 0);
        })
    }

    async predictBatch(audio, keys, threshold, confidence) {
        const TensorBatch = audio; //this.fixUpSpecBatch(audio); // + 1 tensor
        
        let paddedTensorBatch, maskedTensorBatch;
        if (BACKEND === 'webgl' && TensorBatch.shape[0] < this.batchSize) {
            // WebGL works best when all batches are the same size
            paddedTensorBatch = this.padBatch(TensorBatch)  // + 1 tensor
        } else if (threshold) {
            if (this.version !== 'v1') threshold *= 4;
            const keysTensor = tf.stack(keys); // + 1 tensor
            const snr = this.getSNR(TensorBatch)
            const condition = tf.greaterEqual(snr, threshold); // + 1 tensor
            DEBUG && console.log('SNR is:', snr.dataSync())
            snr.dispose();
            // Avoid mask cannot be scalar error at end of predictions
            let newCondition;
            if (condition.rankType === "0") {
                newCondition = tf.expandDims(condition) // + 1 tensor
                condition.dispose() // - 1 tensor
            }
            const c = newCondition || condition;
            let maskedKeysTensor;
            [maskedTensorBatch, maskedKeysTensor] = await Promise.all([
                tf.booleanMaskAsync(TensorBatch, c),
                tf.booleanMaskAsync(keysTensor, c)]) // + 2 tensor
            c.dispose(); // - 1 tensor
            keysTensor.dispose(); // - 1 tensor

            if (!maskedTensorBatch.size) {
                maskedTensorBatch.dispose(); // - 1 tensor
                maskedKeysTensor.dispose(); // - 1 tensor
                TensorBatch.dispose(); // - 1 tensor
                DEBUG && console.log("No surviving tensors in batch", maskedTensorBatch.shape[0])
                return []
            } else {
                keys = maskedKeysTensor.dataSync();
                maskedKeysTensor.dispose(); // - 1 tensor
                DEBUG && console.log("surviving tensors in batch", maskedTensorBatch.shape[0])
            }
        }

        const tb = paddedTensorBatch || maskedTensorBatch || TensorBatch;
        const prediction = this.model.predict(tb, { batchSize: this.batchSize })
        
        let newPrediction;
        if (this.selection) {
            newPrediction = tf.max(prediction, 0, true);
            prediction.dispose();
            keys = keys.splice(0, 1);
        }
        else if (this.useContext && this.batchSize > 1 && threshold === 0) {
            newPrediction = this.addContext(prediction, tb, confidence);
            prediction.dispose();
        }
        TensorBatch.dispose();
        if (paddedTensorBatch) paddedTensorBatch.dispose();
        if (maskedTensorBatch) maskedTensorBatch.dispose();

        const finalPrediction = newPrediction || prediction;
        
        const { indices, values } = tf.topk(finalPrediction, 5, true);
        const [topIndices, topValues] = await Promise.all([indices.array(), values.array()]).catch(err => console.log('Data transfer error:',err));
        indices.dispose();
        values.dispose();
        // end new
        // const array_of_predictions = finalPrediction.arraySync()
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

    async predictChunk(audioBuffer, start, fileStart, file, threshold, confidence) {
        DEBUG && console.log('predictCunk begin', tf.memory());
        audioBuffer = tf.tensor1d(audioBuffer);

        // check if we need to pad
        const remainder = audioBuffer.shape % this.chunkLength;
        let paddedBuffer;
        if (remainder !== 0) {
            // Pad to the nearest full sample
            paddedBuffer = audioBuffer.pad([[0, this.chunkLength - remainder]]);
            audioBuffer.dispose();
            DEBUG && console.log('Received final chunks')
        }
        const buffer = paddedBuffer || audioBuffer;
        const numSamples = buffer.shape / this.chunkLength;
        let bufferList = tf.split(buffer, numSamples);
        buffer.dispose();
        const specBatch = tf.stack(bufferList);
        const batchKeys = [...Array(numSamples).keys()].map(i => start + this.chunkLength * i);
        const result = await this.predictBatch(specBatch, batchKeys, threshold, confidence);
        this.clearTensorArray(bufferList);
        return [result, file, fileStart];
    }

    async clearTensorArray(tensorObj) {
        // Dispose of accumulated kept tensors in model tensor array
        tensorObj.forEach(tensor => tensor.dispose());
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
