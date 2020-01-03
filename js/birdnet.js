// Imports
const tf = require('@tensorflow/tfjs');
const load = require('audio-loader')
const resampler = require('audio-resampler');
const normalize = require('array-normalize')
const colormap = require('colormap')

const MODEL_JSON = 'model/model.json'
const CONFIG = {

    sampleRate: 48000,
    specLength: 3,
    sigmoid: 1.0

}

let MODEL = null;
var AUDIO_DATA = [];
var WAVESURFER = null;
var CURRENT_ADUIO_BUFFER = null;
var WS_ZOOM = 0;

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

        // Normalize values between 0 and 1
        spec = tf.div(tf.sub(spec, tf.min(spec)), tf.max(spec));

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
        
        return tf.sigmoid(tf.mul(input[0], CONFIG.sigmoid))
        
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
}


function loadAudioFile(filePath) {

    // Hide load hint and show spinnner
    hideAll();
    showElement('loadFileHint');
    showElement('loadFileHintSpinner');
    showElement('loadFileHintLog');

    // load one file
    log('loadFileHintLog', 'Loading file...');
    load(filePath).then(function (buffer) {

        // Resample
        log('loadFileHintLog', 'Analyzing...');
        resampler(buffer, CONFIG.sampleRate, async function(event) {

            // Get raw audio data
            AUDIO_DATA = event.getAudioBuffer().getChannelData(0);

            // Normalize audio data
            AUDIO_DATA = normalize(AUDIO_DATA)

            // Predict
            //predict(AUDIO_DATA, MODEL);

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
    showElement('specContainer', false, true);
    showElement('specTimeline', false, true);

    // Setup waveform and spec views
    var options = {
        container: '#specContainer',
        backgroundColor: '#363a40',
        waveColor: '#fff',
        cursorColor: '#fff',
        progressColor: '#4b79fa',
        cursorWidth: 2,
        normalize: true,
        fillParent: true,
        responsive: true,
        height: 512,
        fftSamples: 1024,
        minPxPerSec: 50,
        colorMap: colormap({
                colormap: 'viridis',
                nshades: 256,
                format: 'rgb',
                alpha: 1
        }),
        hideScrollbar: false,
        visualization: 'spectrogram',
        plugins: []
    };

    // Create wavesurfer object
    WAVESURFER = WaveSurfer.create(options);
    WAVESURFER.enableDragSelection({});

    // Load audio file
    WAVESURFER.loadDecodedBuffer(CURRENT_ADUIO_BUFFER);
    
    // Set initial zoom level
    WS_ZOOM = $('#specContainer').width() / WAVESURFER.getDuration();

    // Resize canvas of spec and labels
    $('#specContainer wave, canvas').each(function() {
        $( this ).height(400);
    });

    // Show controls
    showElement('controlsWrapper');

}

function zoomSpecIn() {

    WS_ZOOM += 50;
    WAVESURFER.zoom(WS_ZOOM);
}

function zoomSpecOut() {

    WS_ZOOM -= 50;
    WAVESURFER.zoom(WS_ZOOM);

}


