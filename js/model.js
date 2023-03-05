const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const {parse} = require("uuid");
const model_config = JSON.parse(fs.readFileSync('model_config.json', 'utf8'));
const {height, width, labels, location} = model_config;

let DEBUG = true;
let BACKEND;
tf.env().set('WEBGL_FORCE_F16_TEXTURES', true)
tf.env().set('WEBGL_PACK', true)
tf.env().set('WEBGL_EXP_CONV', false)
// tf.env().set('TOPK_K_CPU_HANDOFF_THRESHOLD', 128)
// tf.env().set('TOPK_LAST_DIM_CPU_HANDOFF_SIZE_THRESHOLD', 0);


tf.enableProdMode();
if (DEBUG) {
    console.log(tf.env());
    console.log(tf.env().getFlags());

}

// https://www.tensorflow.org/js/guide/platform_environment#flags
//tf.enableDebugMode()

const migrantlist = ["Pluvialis dominica_American Golden Plover (call)", "Acanthis hornemanni_Arctic Redpoll (call)", "Sterna paradisaea_Arctic Tern (call)", "Recurvirostra avosetta_Avocet (call)", "Porzana pusilla_Baillon's Crake (call)", "Limosa lapponica_Bar-tailed Godwit (call)", "Tyto alba_Barn Owl (call)", "Branta leucopsis_Barnacle Goose (call)", "Cygnus columbianus_Bewick's Swan (call)", "Botaurus stellaris_Bittern (call)", "Chroicocephalus ridibundus_Black-headed Gull (call)", "Podiceps nigricollis_Black-necked Grebe (call)", "Limosa limosa_Black-tailed Godwit (call)", "Turdus merula_Blackbird (flight call)", "Sylvia atricapilla_Blackcap (call)", "Fringilla montifringilla_Brambling (call)", "Branta bernicla_Brent Goose (call)", "Branta canadensis_Canada Goose (call)", "Larus cachinnans_Caspian Gull (call)", "Phylloscopus collybita_Chiffchaff (call)", "Loxia curvirostra_Common Crossbill (call)", "Larus canus_Common Gull (call)", "Acanthis flammea_Common Redpoll (call)", "Actitis hypoleucos_Common Sandpiper (call)", "Melanitta nigra_Common Scoter (call)", "Sterna hirundo_Common Tern (call)", "Fulica atra_Coot (call)", "Crex crex_Corncrake (call)", "Cuculus canorus_Cuckoo (call)", "Calidris ferruginea_Curlew Sandpiper (call)", "Numenius arquata_Curlew (call)", "Charadrius morinellus_Dotterel (call)", "Calidris alpina_Dunlin (call)", "Prunella modularis_Dunnock (call)", "Alopochen aegyptiaca_Egyptian Goose (call)", "Somateria mollissima_Eider (call)", "Turdus pilaris_Fieldfare (call)", "Mareca strepera_Gadwall (call)", "Sylvia borin_Garden Warbler (call)", "Spatula querquedula_Garganey (call)", "Regulus regulus_Goldcrest (call)", "Pluvialis apricaria_Golden Plover (call)", "Bucephala clangula_Goldeneye (call)", "Mergus merganser_Goosander (call)", "Locustella naevia_Grasshopper Warbler (call)", "Larus marinus_Great Black-backed Gull (call)", "Podiceps cristatus_Great Crested Grebe (call)", "Tringa ochropus_Green Sandpiper (call)", "Tringa nebularia_Greenshank (call)", "Ardea cinerea_Grey Heron (call)", "Perdix perdix_Grey Partridge (call)", "Pluvialis squatarola_Grey Plover (call)", "Motacilla cinerea_Grey Wagtail (call)", "Anser anser_Greylag Goose (call)", "Delichon urbicum_House Martin (call)", "Coccothraustes coccothraustes_Hawfinch (call)", "Larus argentatus_Herring Gull (call)", "Lymnocryptes minimus_Jack Snipe (call)", "Alcedo atthis_Kingfisher (call)", "Calidris canutus_Knot (call)", "Calcarius lapponicus_Lapland Bunting (call)", "Larus fuscus_Lesser Black-backed Gull (call)", "Acanthis cabaret_Lesser Redpoll (call)", "Sylvia curruca_Lesser Whitethroat (call)", "Linaria cannabina_Linnet (call)", "Egretta garzetta_Little Egret (call)", "Tachybaptus ruficollis_Little Grebe (call)", "Hydrocoloeus minutus_Little Gull (call)", "Athene noctua_Little Owl (call)", "Charadrius dubius_Little Ringed Plover (call)", "Calidris minuta_Little Stint (call)", "Sternula albifrons_Little Tern (call)", "Asio otus_Long-eared Owl (call)", "Clangula hyemalis_Long-tailed Duck (call)", "Anas platyrhynchos_Mallard (call)", "Aix galericulata_Mandarin Duck (call)", "Anthus pratensis_Meadow Pipit (call)", "Ichthyaetus melanocephalus_Mediterranean Gull (call)", "Turdus viscivorus_Mistle Thrush (call)", "Gallinula chloropus_Moorhen (call)", "Nycticorax nycticorax_Night Heron (call)", "Luscinia megarhynchos_Nightingale (call)", "Caprimulgus europaeus_Nightjar (call)", "Anthus hodgsoni_Olive-backed Pipit (call)", "Emberiza hortulana_Ortolan Bunting (call)", "Haematopus ostralegus_Oystercatcher (call)", "Ficedula hypoleuca_Pied Flycatcher (call)", "Motacilla alba_Pied Wagtail (call)", "Anser brachyrhynchus_Pink-footed Goose (call)", "Anas acuta_Pintail (call)", "Aythya ferina_Pochard (call)", "Calidris maritima_Purple Sandpiper (call)", "Coturnix coturnix_Quail (call)", "Mergus serrator_Red-breasted Merganser (call)", "Netta rufina_Red-crested Pochard (call)", "Alectoris rufa_Red-legged Partridge (call)", "Tringa totanus_Redshank (call)", "Phoenicurus phoenicurus_Redstart (call)", "Turdus iliacus_Redwing (call)", "Emberiza schoeniclus_Reed Bunting (call)", "Acrocephalus scirpaceus_Reed Warbler (call)", "Turdus torquatus_Ring Ouzel (call)", "Charadrius hiaticula_Ringed Plover (call)", "Erithacus rubecula_Robin (flight call)", "Anthus petrosus_Rock Pipit (call)", "Sterna dougallii_Roseate Tern (call)", "Calidris pugnax_Ruff (call)", "Riparia riparia_Sand Martin (call)", "Calidris alba_Sanderling (call)", "Thalasseus sandvicensis_Sandwich Tern (call)", "Aythya marila_Scaup (call)", "Loxia scotica_Scottish Crossbill (call)", "Acrocephalus schoenobaenus_Sedge Warbler (call)", "Tadorna tadorna_Shelduck (call)", "Asio flammeus_Short-eared Owl (call)", "Spatula clypeata_Shoveler (call)", "Spinus spinus_Siskin (call)", "Alauda arvensis_Skylark (call)", "Gallinago gallinago_Snipe (call)", "Plectrophenax nivalis_Snow Bunting (call)", "Turdus philomelos_Song Thrush (call)", "Porzana porzana_Spotted Crake (call)", "Muscicapa striata_Spotted Flycatcher (call)", "Tringa erythropus_Spotted Redshank (call)", "Burhinus oedicnemus_Stone-curlew (call)", "Saxicola rubicola_Stonechat (call)", "Hirundo rustica_Swallow (call)", "Apus apus_Swift (call)", "Anser fabalis_Taiga Bean Goose (call)", "Strix aluco_Tawny Owl (call)", "Anas crecca_Teal (call)", "Anthus trivialis_Tree Pipit (call)", "Certhia familiaris_Treecreeper (call)", "Aythya fuligula_Tufted Duck (call)", "Anser serrirostris_Tundra Bean Goose (call)", "Arenaria interpres_Turnstone (call)", "Anthus spinoletta_Water Pipit (call)", "Rallus aquaticus_Water Rail (call)", "Numenius phaeopus_Whimbrel (call)", "Anser albifrons_White-fronted Goose (call)", "Sylvia communis_Whitethroat (call)", "Cygnus cygnus_Whooper Swan (call)", "Mareca penelope_Wigeon (call)", "Phylloscopus trochilus_Willow Warbler (call)", "Tringa glareola_Wood Sandpiper (call)", "Scolopax rusticola_Woodcock (call)", "Lullula arborea_Woodlark (call)", "Larus michahellis_Yellow-legged Gull (call)", "Motacilla flava_Yellow Wagtail (call)", "Emberiza citrinella_Yellowhammer (call)"];
// Non birds
const others = ['Ambient Noise_Ambient Noise', 'Animal_Animal', 'Human_Human', 'Vehicle_Vehicle']

const greylist = [];
const goldenlist = []; //["Turdus iliacus_Redwing", "Turdus philomelos_Song Thrush"];
let blocked_IDs = [];
let suppressed_IDs = [];
let enhanced_IDs = [];

const CONFIG = {
    sampleRate: 24000, specLength: 3, sigmoid: 1.0,
}

class Model {
    constructor(appPath, list) {
        this.model = null;
        this.labels = labels;
        this.config = CONFIG;
        this.chunkLength = this.config.sampleRate * this.config.specLength;
        this.model_loaded = false;
        this.appPath = null;
        this.frame_length = 512;
        this.frame_step = 186;
        this.appPath = appPath;
        this.list = list;
    }

    async loadModel() {
        console.log('loading model')
        if (this.model_loaded === false) {
            // Model files must be in a different folder than the js, assets files
            console.log('loading model from ', this.appPath + 'model.json')
            this.model = await tf.loadGraphModel(this.appPath + 'model.json',
                {weightPathPrefix: this.appPath});
            this.model_loaded = true;
            this.setList();
            this.inputShape = [...this.model.inputs[0].shape];
        }
    }

    warmUp(batchSize) {
        this.batchSize = parseInt(batchSize);
        this.inputShape[0] = 1;
        const result = tf.tidy(() => {
            const warmupResult = this.model.predict(tf.zeros(this.inputShape));
            warmupResult.arraySync();
            warmupResult.dispose()
            return true;
        })
        console.log('WarmUp end', tf.memory().numTensors)
        return result;
    }

    setList() {
        blocked_IDs = [];
        // get the indices of any items in the blacklist, greylist
        if (this.list === 'birds') {
            // find the position of the blocked items in the label list
            others.forEach(notBird => blocked_IDs.push(labels.indexOf(notBird)))
        } else if (this.list === 'migrants') {
            labels.forEach(species => {
                if (migrantlist.indexOf(species) === -1) blocked_IDs.push(labels.indexOf(species))
            })
        }
        greylist.forEach(species => suppressed_IDs.push(labels.indexOf(species)))
        goldenlist.forEach(species => enhanced_IDs.push(labels.indexOf(species)))
    }

    normalize(spec) {
        let spec_max = tf.max(spec, [1, 2]);
        spec_max = tf.reshape(spec_max, [-1, 1, 1, 1])
        spec = spec.mul(255);
        spec = spec.div(spec_max);
        return spec;
    }

    getSNR(spectrograms) {
        const max = tf.max(spectrograms, 2);
        const mean = tf.mean(spectrograms, 2);
        const peak = tf.sub(max, mean);
        let snr = tf.squeeze(tf.max(peak, 1));
        snr = tf.sub(255, snr)  // bigger number, less signal
        return snr
    }

    makeSpectrogram(audioBuffer) {
        return tf.tidy(() => {
            return tf.signal.stft(audioBuffer, this.frame_length, this.frame_step).cast('float32');
        })
    }

    fixUpSpecBatch(specBatch, h, w) {
        const img_height = h || height;
        const img_width = w || width;
        // Swap axes to fit output shape
        specBatch = tf.transpose(specBatch, [0, 2, 1]);
        specBatch = tf.reverse(specBatch, [1]);
        specBatch = tf.abs(specBatch);
        // Add channel axis
        specBatch = tf.expandDims(specBatch, -1);
        specBatch = tf.image.resizeBilinear(specBatch, [img_height, img_width]);
        // Fix specBatch shape
        return tf.tidy(() => {
            return this.normalize(specBatch);
        })
    }

    // buildBatch(batch, keys) {
    //     if (batch.shape[0] < this.batchSize) {
    //         if (this.pendingBatch && this.pendingBatch.shape[0] > 0) {
    //             this.pendingBatch = tf.concat4d([this.pendingBatch, batch], 0);
    //             this.pendingKeys = tf.concat4d([this.pendingKeys, keys], 0)
    //         } else {
    //             this.pendingBatch = batch;
    //             this.pendingKeys = keys;
    //         }
    //         return [this.pendingBatch, this.pendingKeys];
    //     } else {
    //         const readyBatch = batch.slice([0, 0, 0, 0], [this.batchSize, batch.shape[1], batch.shape[2], batch.shape[3]]);
    //         this.pendingBatch = batch.slice([this.batchSize, 0, 0, 0]);
    //         const readyKeys = keys.slice([0], [this.batchSize]);
    //         this.pendingKeys = keys.slice([this.batchSize]);
    //         return [readyBatch, readyKeys]
    //     }
    // }

    async predictBatch(goodTensors, file, fileStart, threshold) {
        console.log('predictBatch begin', tf.memory().numTensors)
        let batched_results = [];
        let result;
        let audacity;
        let rawTensorBatch = tf.stack(Object.values(goodTensors))
        let fixedTensorBatch = tf.tidy(() => {
            return this.fixUpSpecBatch(rawTensorBatch)
        })
        rawTensorBatch.dispose();
        //console.log('rawTensorBatch (-)  Tensorbatch (+), expect same', tf.memory().numTensors)
        let intKeys = Object.keys(goodTensors).map((str) => {
            return parseInt(str)
        });
        let keysTensor, TensorBatch, maskedKeysTensor, maskedTensorBatch;
        if (BACKEND === 'webgl') {
            if (fixedTensorBatch[0] < this.batchSize) {
                // WebGL works best when all batches are the same size
                console.log(`Adding ${this.batchSize - fixedTensorBatch.shape[0]} tensors to the batch`)
                const shape = [...fixedTensorBatch.shape];
                shape[0] = this.batchSize - shape[0];
                const padding = tf.zeros(shape);
                TensorBatch = tf.concat([fixedTensorBatch, padding], 0)
                padding.dispose();
                fixedTensorBatch.dispose()
            } else {
                TensorBatch = fixedTensorBatch;
                //fixedTensorBatch.dispose()
            }
        } else if (threshold) {
            keysTensor = tf.stack(intKeys);
            console.log('KeysTensor expect +1', tf.memory().numTensors)

            const SNR = tf.tidy(() => {
                return this.getSNR(fixedTensorBatch)
            })
            let condition = tf.less(SNR, (10 - threshold) * 10);
            // Avoid mask cannot be scalar error at end of predictions
            let newCondition;
            if (condition.rankType === "0") {
                newCondition = tf.expandDims(condition)
                condition.dispose()
            }
            if (newCondition) {
                maskedTensorBatch = await tf.booleanMaskAsync(fixedTensorBatch, newCondition);
                maskedKeysTensor = await tf.booleanMaskAsync(keysTensor, newCondition)
                newCondition.dispose();
            } else {
                maskedTensorBatch = await tf.booleanMaskAsync(fixedTensorBatch, condition);
                maskedKeysTensor = await tf.booleanMaskAsync(keysTensor, condition);
                condition.dispose();
            }
            fixedTensorBatch.dispose();
            keysTensor.dispose();
            SNR.dispose();

            if (!maskedTensorBatch.size) {
                maskedTensorBatch.dispose();
                maskedKeysTensor.dispose();
                return []
            } else {
                console.log("surviving tensors in batch", maskedTensorBatch.shape[0])
            }
        } else {
            TensorBatch = fixedTensorBatch;
        }
        let t0 = performance.now();
        // Build up a batch
        // [TensorBatch, keysTensor] = this.buildBatch(TensorBatch, keysTensor);
        // if (TensorBatch.shape[0] < this.batchSize) return false;
        //console.log('Prior predictions expect same', tf.memory().numTensors)
        let prediction;
        if (maskedTensorBatch) {
            prediction = this.model.predict(maskedTensorBatch, {batchSize: this.batchSize})
            maskedTensorBatch.dispose()
        } else {
            prediction = this.model.predict(TensorBatch, {batchSize: this.batchSize})
            TensorBatch.dispose()
        }
        const {indices, values} = prediction.topk(3);
        prediction.dispose()
        let keys = intKeys;
        if (maskedKeysTensor) {
            keys = maskedKeysTensor.dataSync()
            maskedKeysTensor.dispose();
        }

        const top3 = indices.arraySync();
        const top3scores = values.arraySync();
        indices.dispose();
        values.dispose()
        //return [keys, top3, top3scores];

        //console.log('Post  predictions', tf.memory().numTensors)
        const batch = {};
        for (let i = 0; i < keys.length; i++) {
            batch[keys[i]] = ({index: top3[i], score: top3scores[i], end: keys[i] + this.chunkLength});
        }
        // Try this method of adjusting results
        for (let [key, item] of Object.entries(batch)) {
            // turn the key back to a number and convert from samples to seconds:
            key = parseInt(key) / this.config.sampleRate;
            const end = item.end / this.config.sampleRate;
            for (let i = 0; i < item.index.length; i++) {
                if (suppressed_IDs.includes(item.index[i])) {
                    item.score[i] = item.score[i] ** 3;
                } else if (enhanced_IDs.includes(item.index[i])) {
                    //item.score[i] = Math.pow(item.score[i], 0.35);
                    item.score[i] = Math.pow(item.score[i], 0.5);
                }
            }

            // If using the whitelist, we want to promote allowed IDs above any blocked IDs, so they will be visible
            // if they meet the confidence threshold.
            let count = 0;
            while (blocked_IDs.indexOf(item.index[0]) !== -1 && count !== item.index.length) {
                // If and while the first result is blocked, move it to the end
                count++;
                item.index.push(item.index.shift());
                // And do the same for the score
                item.score.push(item.score.shift());
            }
            let suppressed = count === item.index.length;

            result = ({
                file: file,
                start: key,
                end: end,
                timestamp: key * 1000 + fileStart,
                position: key,
                id_1: item.index[0],
                id_2: item.index[1],
                id_3: item.index[2],
                sname: this.labels[item.index[0]].split('_')[0],
                cname: this.labels[item.index[0]].split('_')[1],
                score: Math.round(item.score[0] * 1000) / 1000,
                sname2: this.labels[item.index[1]].split('_')[0],
                cname2: this.labels[item.index[1]].split('_')[1],
                score2: Math.round(item.score[1] * 1000) / 1000,
                sname3: this.labels[item.index[2]].split('_')[0],
                cname3: this.labels[item.index[2]].split('_')[1],
                score3: Math.round(item.score[2] * 1000) / 1000,
                suppressed: suppressed
            });
            audacity = ({
                timestamp: key + '\t' + end,
                cname: this.labels[item.index[0]].split('_')[1],
                score: Math.round(item.score[0] * 1000) / 1000,
            })
            if (DEBUG) {//prepare summary
                let hour = Math.floor(key / 3600), minute = Math.floor(key % 3600 / 60),
                    second = Math.floor(key % 3600 % 60)
                console.log(file, `${hour}:${minute}:${second}`, item.index[0], this.labels[item.index[0]], Math.round(item.score[0] * 1000) / 1000, item.index[1], this.labels[item.index[1]], Math.round(item.score[1] * 1000) / 1000, item.index[2], this.labels[item.index[2]], Math.round(item.score[2] * 1000) / 1000);
            }
            batched_results.push([key, result, audacity]);
        }


        return batched_results
    }

    compute_spectrogram(chunk, h, w) {
        return tf.tidy(() => {
            let spec = tf.signal.stft(chunk, this.frame_length, this.frame_step)
            const img_height = h || height;
            const img_width = w || width;
            // Swap axes to fit output shape
            spec = tf.transpose(spec, [2, 1]);
            spec = tf.reverse(spec, [0]);
            spec = tf.abs(spec);
            // Add channel axis
            spec = tf.expandDims(spec, -1);
            spec = tf.image.resizeBilinear(spec, [img_height, img_width]);
            // Fix specBatch shape
            return this.normalize(spec);
        })
    }

    async predictChunk(chunks, fileStart, file, finalchunk, threshold) {
        let results = [];
        let goodTensors = {}
        for (const [key, value] of Object.entries(chunks)) {
            let chunk = tf.tensor1d(value);
            // if the chunk is too short, pad with zeroes.
            // Min length is 0.5s, set in UI.js - a wavesurfer region option
            let paddedChunk;
            if (chunk.shape[0] < this.chunkLength) {
                let padding = tf.zeros([this.chunkLength - chunk.shape[0]]);
                    paddedChunk = chunk.concat(padding);
                    padding.dispose();
            }
            const spectrogram = paddedChunk ?
                this.makeSpectrogram(paddedChunk) : this.makeSpectrogram(chunk);
            chunk.dispose();
            if (paddedChunk) paddedChunk.dispose();
            goodTensors[key] = spectrogram;
            //Loop will continue
            if (Object.keys(goodTensors).length === this.batchSize) {
                // There's a new batch of predictions to make
                results = await this.predictBatch(goodTensors, file, fileStart, threshold)
                this.clearTensorArray(goodTensors)
                goodTensors = {}
            }
        }
        if (finalchunk) {
            // Top up results with any final tensor predictions
            if (Object.keys(goodTensors).length) {
                results = await this.predictBatch(goodTensors, file, fileStart, threshold)
                this.clearTensorArray(goodTensors)
                //readyToSend = true
            }
        }
        return results
    }

    clearTensorArray(goodTensors) {
        // Dispose of accumulated kept tensors in model tensor array
        for (const tensor of Object.values(goodTensors)) {
            tensor.dispose()
        }
    }
}

//module.exports = Model;
let myModel;
onmessage = async (e) => {
    try {
        await runPredictions(e);
    }
        // If worker was respawned
    catch (e) {
        console.log(e)
    }
}

async function runPredictions(e) {
    const modelRequest = e.data.message || e.data[0];
    if (modelRequest === 'load') {
        console.log('load request to worker')
        const appPath = '../' + location + '/';
        const list = e.data[1];
        const batch = e.data[2];
        const warmup = e.data[3]
        postMessage({message: 'labels', labels: labels})
        console.log(`model received load instruction. Using list: ${list}, batch size ${batch}, warmup: ${warmup}`)
        myModel = new Model(appPath, list);
        await myModel.loadModel();
        myModel.warmUp(batch);
        BACKEND = tf.getBackend()
        postMessage({
            message: 'model-ready',
            sampleRate: myModel.config.sampleRate,
            chunkLength: myModel.chunkLength,
            backend: tf.getBackend(),
            labels: labels
        })
        postMessage({message: 'update-list', blocked: blocked_IDs, updateResults: false});
    } else if (modelRequest === 'predict') {
        const file = e.data.file;
        const finalChunk = e.data.finalChunk;
        if (finalChunk) console.log('Received final chunks')
        //const t0 = performance.now();
        let chunks = e.data.chunks;
        const fileStart = e.data.fileStart;
        const SNRThreshold = e.data.snr;
        myModel.frame_length = 512
        const result = await myModel.predictChunk(chunks, fileStart, file, finalChunk, SNRThreshold);
        const response = {
            message: 'prediction',
            file: file,
            result: result,
            fileStart: fileStart,
        }
        postMessage(response);
        // reset the results
        myModel.result = [];
        //let t1 = performance.now();
        //console.log(`receive to post took: ${t1 - t0} milliseconds`)

    } else if (modelRequest === 'get-spectrogram') {
        myModel.frame_length = 512;
        const buffer = e.data.buffer;
        // Only consider full specs
        if (buffer.length < 72000) return
        const file = e.data.file;
        const filepath = e.data.filepath;
        const height = e.data.height;
        const width = e.data.width
        let image;
        const bufferTensor = tf.tensor1d(buffer);
        const imageTensor = tf.tidy(() => {
            return myModel.makeSpectrogram(bufferTensor);
        })
        image = tf.tidy(() => {
            return myModel.fixUpSpecBatch(tf.expandDims(imageTensor, 0), height, width).dataSync();
        })
        bufferTensor.dispose()
        imageTensor.dispose()
        let response = {
            message: 'spectrogram',
            width: myModel.inputShape[2],
            height: myModel.inputShape[1],
            channels: myModel.inputShape[3],
            image: image,
            file: file,
            filepath: filepath
        }
        postMessage(response)
    } else if (modelRequest === 'list') {
        myModel.list = e.data.list;
        console.log(`Setting list to ${myModel.list}`);
        myModel.setList();
        postMessage({message: 'update-list', blocked: blocked_IDs, updateResults: true});
    }
}