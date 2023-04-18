const tf = require('@tensorflow/tfjs-node');
tf.setBackend('tensorflow').then(() => main());

function main() {
    onmessage = async (e) => {
        try {
            const {chunks, length, step, height, width, file, fileStart, threshold, finalChunk} = e.data;
            let [keys, specs] = getSpecBatch(chunks, length, step, height, width);
            postMessage([keys, specs, file, fileStart, threshold, finalChunk]);
        }
            // If worker was respawned
        catch (e) {
            console.log(e)
        }
    }

    const getSpecBatch = (audioBuffers, frame_length, frame_step, height, width) => {
        let specList = [], keyList = [];
        return tf.tidy(() => {
            let specBatch;
            for (let [key, audio] of Object.entries(audioBuffers)) {
                audio = tf.tensor1d(audio);
                if (audio.shape[0] < 72000) {
                    let padding = tf.zeros([72000 - audio.shape[0]]);
                    audio = audio.concat(padding);
                }
                audio = tf.signal.stft(audio, frame_length, frame_step).cast('float32');
                specList.push(audio);
                keyList.push(parseInt(key))
            }
            specBatch = tf.stack(specList);
            // Swap axes to fit output shape
            specBatch = tf.transpose(specBatch, [0, 2, 1]);
            specBatch = tf.reverse(specBatch, [1]);
            specBatch = tf.abs(specBatch);
            // Add channel axis
            specBatch = tf.expandDims(specBatch, -1);
            specBatch = tf.image.resizeBilinear(specBatch, [height, width]);
            // Fix specBatch shape
            return [keyList, normalize(specBatch).arraySync()]
        })
    };

    const normalize = (spec) => {
        let spec_max = tf.max(spec, [1, 2]);
        spec_max = tf.reshape(spec_max, [-1, 1, 1, 1])
        spec = spec.mul(255);
        spec = spec.div(spec_max);
        return spec;
    }

}