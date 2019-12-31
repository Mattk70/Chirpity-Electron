// Imports
const tf = require('@tensorflow/tfjs');
const load = require('audio-loader')
const resampler = require('audio-resampler');
const normalize = require('array-normalize')
const WaveSurfer = require('wavesurfer.js');
const SpectrogramPlugin = require('wavesurfer.js/dist/plugin/wavesurfer.spectrogram.min.js');

const MODEL_JSON = 'model/model.json'
const CONFIG = {

    sampleRate: 48000,
    specLength: 3

}

let MODEL = null;
var AUDIO_DATA = [];
var WAVESURFER = null;
var CURRENT_ADUIO_BUFFER = null;

/////////////////////////  Build SimpleSpecLayer  /////////////////////////
class SimpleSpecLayer extends tf.layers.Layer {
    constructor(config) {
      super(config);    

        // For now, let's work with hard coded values to avoid strange errors when reading the config
        this.spec_shape = [257, 384];
        this.frame_length = 512;
        this.frame_step = 374;
    }

    build(inputShape) {
        this.mag_scale = this.addWeight('magnitude_scaling', [], 'float32', tf.initializers.constant({value: 1.0}));
      }

    computeOutputShape(inputShape) { return [inputShape[0], this.spec_shape[0], this.spec_shape[1], 1]; }
   
    call(input, kwargs) { 

        // Perform STFT    
        var spec = tf.signal.stft(input[0].squeeze(),
                              this.frame_length,
                              this.frame_step) 
        
        // Cast from complex to float
        spec = tf.cast(spec, 'float32');

        // Convert to power spectrogram
        spec = tf.pow(spec, 2.0)

        // Convert magnitudes using nonlinearity
        spec = tf.pow(spec, tf.div(1.0, tf.add(1.0, tf.exp(this.mag_scale.read()))))

        // Swap axes to fit output shape
        spec = tf.transpose(spec)

        // Add channel axis        
        spec = tf.expandDims(spec, -1)

        // Add batch axis        
        spec = tf.expandDims(spec, 0)

        return spec
    
    }
   
    static get className() { return 'SimpleSpecLayer'; }
}

tf.serialization.registerClass(SimpleSpecLayer);

/////////////////////////  Build GlobalExpPool2D Layer  /////////////////////////
function logmeanexp(x, axis, keepdims, sharpness) {
    xmax = tf.max(x, axis, true);
    xmax2 = tf.max(x, axis, keepdims);
    x = tf.mul(sharpness, tf.sub(x, xmax));
    y = tf.log(tf.mean(tf.exp(x), axis, keepdims));
    y = tf.add(tf.div(y, sharpness), xmax2);
    return y
}

class GlobalLogExpPooling2D extends tf.layers.Layer {
    constructor(config) {
      super(config);
    }

    build(inputShape) {
        this.sharpness = this.addWeight('sharpness', [1], 'float32', tf.initializers.constant({value: 2.0}));
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
        this.kernel = this.addWeight('scale_factor', [1], 'float32', tf.initializers.constant({value: 1.0}));
    }

    computeOutputShape(inputShape) { return inputShape; }

    call(input, kwargs) { 
        
        return tf.sigmoid(tf.mul(input[0], this.kernel.read()))
        
    }   
   
    static get className() { return 'SigmoidLayer'; }
}

tf.serialization.registerClass(SigmoidLayer);

async function loadModel() {

    // Load model
    if (MODEL == null) {
        console.log('Loading model...');
        MODEL = await tf.loadLayersModel(MODEL_JSON);
        CONFIG.labels = MODEL.getLayer('SIGMOID').config.labels;
        console.log('...done loading model!');
    }

}

async function predict(audioData, model) {

    console.log('Start analysis...');
    const audioTensor = tf.tensor1d(audioData)

    // Slice and expand
    var cunkLength = CONFIG.sampleRate * CONFIG.specLength;
    for (var i = 0; i < audioTensor.shape[0] - cunkLength; i += CONFIG.sampleRate) {

        if (i + cunkLength > audioTensor.shape[0]) i = audioTensor.shape[0] - cunkLength;
        const chunkTensor = audioTensor.slice(i, cunkLength).expandDims(0);

        // Make prediction
        const prediction = model.predict(chunkTensor);

        // Get label
        const index = prediction.argMax(1).dataSync()[0];
        const score = prediction.dataSync()[index];

        console.log(index, CONFIG.labels[index], score);

    }

    console.log('...finsihed analysis!');
}
 /////////////////////////  DO AFTER LOAD ////////////////////////////
 window.onload = function () {

    loadModel();

};

function loadAudioFile(filePath) {

    // Hide load hint and show spinnner
    hideAll();
    showElement('loadFileHint');
    showElement('loadFileHintSpinner');


    // load one file
    load(filePath).then(function (buffer) {

        // Resample
        resampler(buffer, CONFIG.sampleRate, async function(event) {

            // Get raw audio data
            AUDIO_DATA = event.getAudioBuffer().getChannelData(0);

            // Normalize audio data
            AUDIO_DATA = normalize(AUDIO_DATA)

            //console.log(AUDIO_DATA); 

            //Hide center div when done
            hideElement('loadFileHint');
            
            // Draw and show spectrogram
            drawSpectrogram(buffer);    

        });

    });
    
}

function drawSpectrogram(audioBuffer) {

    // Set global buffer
    CURRENT_ADUIO_BUFFER = audioBuffer;

    // Show waveform container
    showElement('waveformContainer');

    // Setup waveform and spec views
    var options = {
        container: '#waveformContainer',
        plugins: [
            SpectrogramPlugin.create({
                container: '#specContainer',
                fftSamples: 1024,
                pixelRatio: 1,
                labels: false,
                name: 'specCanvas'
            })
        ]
    };

    // Create wavesurfer object
    WAVESURFER = WaveSurfer.create(options);

    // Load audio file
    WAVESURFER.loadDecodedBuffer(CURRENT_ADUIO_BUFFER);

    // Hide waveform view for now
    hideElement('waveformContainer');
    showElement('specContainer');

    // Resize canvas of spec and labels
    $('canvas').each(function() {
        $( this ).height($('#specContainer').height());
    });

    // Show controls
    showElement('controlsWrapper');

}


