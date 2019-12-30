// Imports
const tf = require('@tensorflow/tfjs');
const load = require('audio-loader')
const resampler = require('audio-resampler');
const normalize = require('array-normalize')

const CONFIG = {

    sampleRate: 48000

}

var AUDIO_DATA = [];

 /////////////////////////  DO AFTER LOAD ////////////////////////////
 window.onload = function () {

    

};

function loadAudioFile(filePath) {

    // load one file
    load(filePath).then(function (buffer) {

        // Resample
        resampler(buffer, CONFIG.sampleRate, async function(event) {

            // Get raw audio data
            var AUDIO_DATA = event.getAudioBuffer().getChannelData(0);

            // Normalize audio data
            AUDIO_DATA = normalize(AUDIO_DATA)

            console.log(AUDIO_DATA);

        });

    });
}

