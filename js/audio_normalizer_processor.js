// This needs some refinement!

class AudioNormalizerProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
      return [{ name: 'peakLoudness', defaultValue: -3 }];
    }
  
    process(inputs, outputs, parameters) {
      const input = inputs[0];
      const output = outputs[0];
  
      const peakLoudness = parameters.peakLoudness[0];
  
      for (let channel = 0; channel < input.length; ++channel) {
        const inputData = input[channel];
        const outputData = output[channel];
  
        // Increase buffer size
        const bufferSize = 1024; // Adjust as needed
  
        for (let sample = 0; sample < inputData.length; sample += bufferSize) {
          let maxAbsValue = 0;
          const endSample = Math.min(sample + bufferSize, inputData.length);
          
          for (let s = sample; s < endSample; ++s) {
            const absValue = Math.abs(inputData[s]);
            if (absValue > maxAbsValue) {
              maxAbsValue = absValue;
            }
          }
  
          const desiredPeak = Math.pow(10, peakLoudness / 20); // Convert dB to linear scale
          const scaleFactor = desiredPeak / (maxAbsValue + 1e-5); // Handle division by zero
  
          for (let s = sample; s < endSample; ++s) {
            outputData[s] = inputData[s] * scaleFactor;
          }
        }
      }
  
      return true;
    }
  }
  
  registerProcessor('audio-normalizer-processor', AudioNormalizerProcessor);
  