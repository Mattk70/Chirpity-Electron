// Imports
const tf = require('@tensorflow/tfjs');
const load = require('audio-loader')
const resampler = require('audio-resampler');
const normalize = require('array-normalize')
const WaveSurfer = require('wavesurfer.js');
const SpectrogramPlugin = require('wavesurfer.js/dist/plugin/wavesurfer.spectrogram.min.js');

const CONFIG = {

    sampleRate: 48000

}

var AUDIO_DATA = [];
var WAVESURFER = null;
var CURRENT_ADUIO_BUFFER = null;

 /////////////////////////  DO AFTER LOAD ////////////////////////////
 window.onload = function () {

    

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
            var AUDIO_DATA = event.getAudioBuffer().getChannelData(0);

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


