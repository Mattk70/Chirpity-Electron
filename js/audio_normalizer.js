// audio-normalizer.js
class AudioNormlizer extends AudioWorkletProcessor {
    process(inputs, outputs, parameters) {
      const output = outputs[0];
      output.forEach((channel) => {
        const channelMax = Math.max(...channel);
        for (let i = 0; i < channel.length; i++) {
          channel[i] = channel[i] / channelMax;
        }
      });
      return true;
    }
  }


// class AudioNormlizer extends AudioWorkletProcessor {
//     constructor() {
//         super();
//         this.maxLevel = 0.5;
//         this.minLevel = 0.05;
//         this.level = 0;
//     }

//     static get parameterDescriptors() {
//         return [
//             { name: 'cutoff', defaultValue: 100 },
//             { name: 'maxLevel', defaultValue: 0.5 },
//             { name: 'minLevel', defaultValue: 0.05 },
//         ];
//     }

//     process(inputs, outputs, parameters) {
//         const input = inputs[0];
//         const output = outputs[0];

//         // Apply a highpass filter to the input signal
//         const frequency = parameters.cutoff[0];
//         const highpass = this.context.createBiquadFilter();
//         highpass.type = 'highpass';
//         highpass.frequency.value = frequency;

//         const gain = this.context.createGain();

//         // Analyze the audio levels in real-time
//         const max = Math.max(...input);
//         const level = max.toFixed(2); // Round the level to two decimal places
//         this.level = level >= this.maxLevel ? 1 : (level <= this.minLevel ? 0 : (level - this.minLevel) / (this.maxLevel - this.minLevel));

//         // Connect the nodes
//         const source = this.context.createBufferSource();
//         source.buffer = input;
//         source.connect(highpass).connect(gain);
//         gain.gain.value = this.level;

//         // Copy the output
//         for (let i = 0; i < output.length; i++) {
//             output[i].set(input[i]);
//         }

//         return true;
//     }
// }

registerProcessor("audio-normalizer", AudioNormlizer);
