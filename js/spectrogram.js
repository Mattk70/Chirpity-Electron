const tf = require('@tensorflow/tfjs-node');
const DEBUG = false;
class PreprocessSpectrogramLayer extends tf.layers.Layer {
    constructor(config) {
        super(config);
        this.imgHeight = config.imgHeight;
        this.imgWidth = config.imgWidth;
        this.version = config.version;
    }

    call(inputs) {
        return tf.tidy(() => {
            const spec_max = tf.max(inputs, [1, 2], true);
            if (this.version === 'v4') {
                const spec_min = tf.min(inputs, [1, 2], true);
                const normalized = tf.div(tf.sub(inputs, spec_min), tf.sub(spec_max, spec_min));
                return normalized;
            } else {
                const scaled = tf.mul(inputs, 255).div(spec_max);
                return scaled;
            }
        });
    }


    build(inputShape) {
        this.inputSpec = [{ shape: [undefined, inputShape[1], inputShape[2], inputShape[3]] }];
        return this;
    }

    static get className() {
        return 'PreprocessSpectrogramLayer';
      }
}
let preprocessLayer

onmessage = async (e) => {
    const message = e.data.message;

    if (message === 'load'){
        const backend = e.data.backend;
        tf.setBackend(backend).then(async () => {
            if (backend === 'webgl') {
                tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
                tf.env().set('WEBGL_PACK', true);
                tf.env().set('WEBGL_EXP_CONV', true);
                tf.env().set('TOPK_K_CPU_HANDOFF_THRESHOLD', 128)
                tf.env().set('TOPK_LAST_DIM_CPU_HANDOFF_SIZE_THRESHOLD', 0);
            }
            tf.enableProdMode();
            if (DEBUG) {
                console.log(tf.env());
                console.log(tf.env().getFlags());
            }
            const config = e.data.config;
            preprocessLayer = new PreprocessSpectrogramLayer(config);
            console.log('Layer loaded')
        })

    } else {
        let {audio, start,fileStart, file, snr, worker, threshold, confidence} = e.data.payload;
        if (DEBUG) console.log('predictCunk begin', tf.memory().numTensors);
        audio = tf.tensor1d(audio);

        // check if we need to pad
        const remainder = audio.shape % 72_000;
        let paddedBuffer;
        if (remainder !== 0) {
            // Pad to the nearest full sample
            paddedBuffer = audio.pad([[0, 72_000 - remainder]]);
            audio.dispose();
            if (DEBUG) console.log('Received final chunks')
        }
        const buffer = paddedBuffer || audio;
        const numSamples = buffer.shape / 72_000;
        let bufferList = tf.split(buffer, numSamples);
        buffer.dispose();
        // Turn the audio into a spec tensor
        // bufferList = tf.tidy(() => {
        //     return bufferList.map(x => {
        //         return this.version === 'v4' ? this.makeSpectrogram(x) : this.makeSpectrogram(this.normalise_audio(x));
        //     })
        // });

        const specBatch = makeSpectrogramBatch(bufferList);
        //const specBatch = tf.stack(bufferList);
        const batchKeys = [...Array(numSamples).keys()].map(i => start + 72_000 * i);
        postMessage({
            message: 'specs',
            specBatch: specBatch.arraySync(),
            batchKeys: batchKeys,
            threshold: threshold,
            confidence: confidence,
            file: file,
            fileStart: fileStart,
            worker: worker
        })
        specBatch.dispose()    
    }
}

function makeSpectrogramBatch(signalBatch) {
    return tf.tidy(() => {
        const specBatch = signalBatch.map(signal => {
            // const sigMax = tf.max(signal);
            // const sigMin = tf.min(signal);
            // const range = sigMax.sub(sigMin);
            // const normalizedSignal = signal.sub(sigMin).div(range).mul(2).sub(1);
            return tf.abs(tf.signal.stft(signal, 512, 186));
        });
        return tf.stack(specBatch);
    });
}