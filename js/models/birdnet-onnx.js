import * as ort from "onnxruntime-web";
// Load the model and create InferenceSession
const modelPath = "BirdNET_GLOBAL_6K_V2.4_Model_TFJS/birdnet.onnx";
const session = await ort.InferenceSession.create(modelPath);
// Load and preprocess the input image to inputTensor

// Run inference
const outputs = await session.run({ input: inputTensor });
console.log(outputs);