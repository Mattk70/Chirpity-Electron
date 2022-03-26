//import {Model} from './model';


let myModel = new Model('256x384_model/');
(async () => {
    await myModel.loadModel();
})();


onmessage = async function (e) {
    console.log('Worker: Message received from main script');
    const modelRequest = e.data[0];
    const chunk = e.data[1];
    const index = e.data[2];

    const result = await myModel.predictChunk(chunk, index)
    console.log('Worker: Posting message back to main script');
    postMessage(result);
}
