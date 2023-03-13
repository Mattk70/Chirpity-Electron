const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const model_config = JSON.parse(fs.readFileSync('model_config.json', 'utf8'));
const {height, width, labels, location} = model_config;
let DEBUG = true;
let BACKEND;

//GLOBALS
let myModel;
//const MIGRANTS = new Set(["Pluvialis dominica_American Golden Plover (call)", "Acanthis hornemanni_Arctic Redpoll (call)", "Sterna paradisaea_Arctic Tern (call)", "Recurvirostra avosetta_Avocet (call)", "Porzana pusilla_Baillon's Crake (call)", "Limosa lapponica_Bar-tailed Godwit (call)", "Tyto alba_Barn Owl (call)", "Branta leucopsis_Barnacle Goose (call)", "Cygnus columbianus_Bewick's Swan (call)", "Botaurus stellaris_Bittern (call)", "Chroicocephalus ridibundus_Black-headed Gull (call)", "Podiceps nigricollis_Black-necked Grebe (call)", "Limosa limosa_Black-tailed Godwit (call)", "Turdus merula_Blackbird (flight call)", "Sylvia atricapilla_Blackcap (call)", "Fringilla montifringilla_Brambling (call)", "Branta bernicla_Brent Goose (call)", "Branta canadensis_Canada Goose (call)", "Larus cachinnans_Caspian Gull (call)", "Phylloscopus collybita_Chiffchaff (call)", "Loxia curvirostra_Common Crossbill (call)", "Larus canus_Common Gull (call)", "Acanthis flammea_Common Redpoll (call)", "Actitis hypoleucos_Common Sandpiper (call)", "Melanitta nigra_Common Scoter (call)", "Sterna hirundo_Common Tern (call)", "Fulica atra_Coot (call)", "Crex crex_Corncrake (call)", "Cuculus canorus_Cuckoo (call)", "Calidris ferruginea_Curlew Sandpiper (call)", "Numenius arquata_Curlew (call)", "Charadrius morinellus_Dotterel (call)", "Calidris alpina_Dunlin (call)", "Prunella modularis_Dunnock (call)", "Alopochen aegyptiaca_Egyptian Goose (call)", "Somateria mollissima_Eider (call)", "Turdus pilaris_Fieldfare (call)", "Mareca strepera_Gadwall (call)", "Sylvia borin_Garden Warbler (call)", "Spatula querquedula_Garganey (call)", "Regulus regulus_Goldcrest (call)", "Pluvialis apricaria_Golden Plover (call)", "Bucephala clangula_Goldeneye (call)", "Mergus merganser_Goosander (call)", "Locustella naevia_Grasshopper Warbler (call)", "Larus marinus_Great Black-backed Gull (call)", "Podiceps cristatus_Great Crested Grebe (call)", "Tringa ochropus_Green Sandpiper (call)", "Tringa nebularia_Greenshank (call)", "Ardea cinerea_Grey Heron (call)", "Perdix perdix_Grey Partridge (call)", "Pluvialis squatarola_Grey Plover (call)", "Motacilla cinerea_Grey Wagtail (call)", "Anser anser_Greylag Goose (call)", "Delichon urbicum_House Martin (call)", "Coccothraustes coccothraustes_Hawfinch (call)", "Larus argentatus_Herring Gull (call)", "Lymnocryptes minimus_Jack Snipe (call)", "Alcedo atthis_Kingfisher (call)", "Calidris canutus_Knot (call)", "Calcarius lapponicus_Lapland Bunting (call)", "Larus fuscus_Lesser Black-backed Gull (call)", "Acanthis cabaret_Lesser Redpoll (call)", "Sylvia curruca_Lesser Whitethroat (call)", "Linaria cannabina_Linnet (call)", "Egretta garzetta_Little Egret (call)", "Tachybaptus ruficollis_Little Grebe (call)", "Hydrocoloeus minutus_Little Gull (call)", "Athene noctua_Little Owl (call)", "Charadrius dubius_Little Ringed Plover (call)", "Calidris minuta_Little Stint (call)", "Sternula albifrons_Little Tern (call)", "Asio otus_Long-eared Owl (call)", "Clangula hyemalis_Long-tailed Duck (call)", "Anas platyrhynchos_Mallard (call)", "Aix galericulata_Mandarin Duck (call)", "Anthus pratensis_Meadow Pipit (call)", "Ichthyaetus melanocephalus_Mediterranean Gull (call)", "Turdus viscivorus_Mistle Thrush (call)", "Gallinula chloropus_Moorhen (call)", "Nycticorax nycticorax_Night Heron (call)", "Luscinia megarhynchos_Nightingale (call)", "Caprimulgus europaeus_Nightjar (call)", "Anthus hodgsoni_Olive-backed Pipit (call)", "Emberiza hortulana_Ortolan Bunting (call)", "Haematopus ostralegus_Oystercatcher (call)", "Ficedula hypoleuca_Pied Flycatcher (call)", "Motacilla alba_Pied Wagtail (call)", "Anser brachyrhynchus_Pink-footed Goose (call)", "Anas acuta_Pintail (call)", "Aythya ferina_Pochard (call)", "Calidris maritima_Purple Sandpiper (call)", "Coturnix coturnix_Quail (call)", "Mergus serrator_Red-breasted Merganser (call)", "Netta rufina_Red-crested Pochard (call)", "Alectoris rufa_Red-legged Partridge (call)", "Tringa totanus_Redshank (call)", "Phoenicurus phoenicurus_Redstart (call)", "Turdus iliacus_Redwing (call)", "Emberiza schoeniclus_Reed Bunting (call)", "Acrocephalus scirpaceus_Reed Warbler (call)", "Turdus torquatus_Ring Ouzel (call)", "Charadrius hiaticula_Ringed Plover (call)", "Erithacus rubecula_Robin (flight call)", "Anthus petrosus_Rock Pipit (call)", "Sterna dougallii_Roseate Tern (call)", "Calidris pugnax_Ruff (call)", "Riparia riparia_Sand Martin (call)", "Calidris alba_Sanderling (call)", "Thalasseus sandvicensis_Sandwich Tern (call)", "Aythya marila_Scaup (call)", "Loxia scotica_Scottish Crossbill (call)", "Acrocephalus schoenobaenus_Sedge Warbler (call)", "Tadorna tadorna_Shelduck (call)", "Asio flammeus_Short-eared Owl (call)", "Spatula clypeata_Shoveler (call)", "Spinus spinus_Siskin (call)", "Alauda arvensis_Skylark (call)", "Gallinago gallinago_Snipe (call)", "Plectrophenax nivalis_Snow Bunting (call)", "Turdus philomelos_Song Thrush (call)", "Porzana porzana_Spotted Crake (call)", "Muscicapa striata_Spotted Flycatcher (call)", "Tringa erythropus_Spotted Redshank (call)", "Burhinus oedicnemus_Stone-curlew (call)", "Saxicola rubicola_Stonechat (call)", "Hirundo rustica_Swallow (call)", "Apus apus_Swift (call)", "Anser fabalis_Taiga Bean Goose (call)", "Strix aluco_Tawny Owl (call)", "Anas crecca_Teal (call)", "Anthus trivialis_Tree Pipit (call)", "Certhia familiaris_Treecreeper (call)", "Aythya fuligula_Tufted Duck (call)", "Anser serrirostris_Tundra Bean Goose (call)", "Arenaria interpres_Turnstone (call)", "Anthus spinoletta_Water Pipit (call)", "Rallus aquaticus_Water Rail (call)", "Numenius phaeopus_Whimbrel (call)", "Anser albifrons_White-fronted Goose (call)", "Sylvia communis_Whitethroat (call)", "Cygnus cygnus_Whooper Swan (call)", "Mareca penelope_Wigeon (call)", "Phylloscopus trochilus_Willow Warbler (call)", "Tringa glareola_Wood Sandpiper (call)", "Scolopax rusticola_Woodcock (call)", "Lullula arborea_Woodlark (call)", "Larus michahellis_Yellow-legged Gull (call)", "Motacilla flava_Yellow Wagtail (call)", "Emberiza citrinella_Yellowhammer (call)"]);
const MIGRANTS = new Set(["Pluvialis dominica_American Golden Plover", "Acanthis hornemanni_Arctic Redpoll", "Sterna paradisaea_Arctic Tern", "Recurvirostra avosetta_Avocet", "Porzana pusilla_Baillon's Crake", "Limosa lapponica_Bar-tailed Godwit", "Tyto alba_Barn Owl", "Branta leucopsis_Barnacle Goose", "Cygnus columbianus_Bewick's Swan", "Botaurus stellaris_Bittern (call)", "Chroicocephalus ridibundus_Black-headed Gull", "Podiceps nigricollis_Black-necked Grebe", "Limosa limosa_Black-tailed Godwit", "Turdus merula_Blackbird (flight call)", "Sylvia atricapilla_Blackcap (call)", "Fringilla montifringilla_Brambling", "Branta bernicla_Brent Goose", "Branta canadensis_Canada Goose", "Larus cachinnans_Caspian Gull", "Phylloscopus collybita_Chiffchaff (call)", "Loxia curvirostra_Common Crossbill", "Larus canus_Common Gull", "Acanthis flammea_Common Redpoll", "Actitis hypoleucos_Common Sandpiper (call)", "Melanitta nigra_Common Scoter", "Sterna hirundo_Common Tern", "Fulica atra_Coot", "Crex crex_Corncrake", "Cuculus canorus_Cuckoo (call)", "Calidris ferruginea_Curlew Sandpiper", "Numenius arquata_Curlew", "Charadrius morinellus_Dotterel", "Calidris alpina_Dunlin", "Prunella modularis_Dunnock (call)", "Alopochen aegyptiaca_Egyptian Goose", "Somateria mollissima_Eider", "Turdus pilaris_Fieldfare (call)", "Mareca strepera_Gadwall", "Sylvia borin_Garden Warbler (call)", "Spatula querquedula_Garganey", "Regulus regulus_Goldcrest (call)", "Pluvialis apricaria_Golden Plover", "Bucephala clangula_Goldeneye", "Mergus merganser_Goosander", "Locustella naevia_Grasshopper Warbler (call)", "Larus marinus_Great Black-backed Gull", "Podiceps cristatus_Great Crested Grebe", "Tringa ochropus_Green Sandpiper", "Tringa nebularia_Greenshank", "Ardea cinerea_Grey Heron", "Perdix perdix_Grey Partridge", "Pluvialis squatarola_Grey Plover (call)", "Motacilla cinerea_Grey Wagtail ", "Anser anser_Greylag Goose", "Delichon urbicum_House Martin", "Coccothraustes coccothraustes_Hawfinch", "Larus argentatus_Herring Gull", "Lymnocryptes minimus_Jack Snipe", "Alcedo atthis_Kingfisher", "Calidris canutus_Knot", "Calcarius lapponicus_Lapland Bunting (call)", "Larus fuscus_Lesser Black-backed Gull", "Acanthis cabaret_Lesser Redpoll ", "Sylvia curruca_Lesser Whitethroat (call)", "Linaria cannabina_Linnet (call)", "Egretta garzetta_Little Egret", "Tachybaptus ruficollis_Little Grebe", "Hydrocoloeus minutus_Little Gull", "Athene noctua_Little Owl", "Charadrius dubius_Little Ringed Plover", "Calidris minuta_Little Stint ", "Sternula albifrons_Little Tern", "Asio otus_Long-eared Owl", "Clangula hyemalis_Long-tailed Duck", "Anas platyrhynchos_Mallard", "Aix galericulata_Mandarin Duck", "Anthus pratensis_Meadow Pipit (call)", "Ichthyaetus melanocephalus_Mediterranean Gull", "Turdus viscivorus_Mistle Thrush (call)", "Gallinula chloropus_Moorhen", "Nycticorax nycticorax_Night Heron", "Luscinia megarhynchos_Nightingale (call)", "Caprimulgus europaeus_Nightjar (call)", "Anthus hodgsoni_Olive-backed Pipit (call)", "Emberiza hortulana_Ortolan Bunting (call)", "Haematopus ostralegus_Oystercatcher", "Ficedula hypoleuca_Pied Flycatcher (call)", "Motacilla alba_Pied Wagtail", "Anser brachyrhynchus_Pink-footed Goose", "Anas acuta_Pintail", "Aythya ferina_Pochard", "Calidris maritima_Purple Sandpiper", "Coturnix coturnix_Quail (call)", "Mergus serrator_Red-breasted Merganser", "Netta rufina_Red-crested Pochard", "Alectoris rufa_Red-legged Partridge", "Tringa totanus_Redshank", "Phoenicurus phoenicurus_Redstart (call)", "Turdus iliacus_Redwing (call)", "Emberiza schoeniclus_Reed Bunting (call)", "Acrocephalus scirpaceus_Reed Warbler (call)", "Turdus torquatus_Ring Ouzel (call)", "Charadrius hiaticula_Ringed Plover", "Erithacus rubecula_Robin (flight call)", "Anthus petrosus_Rock Pipit", "Sterna dougallii_Roseate Tern", "Calidris pugnax_Ruff", "Riparia riparia_Sand Martin", "Calidris alba_Sanderling", "Thalasseus sandvicensis_Sandwich Tern", "Aythya marila_Scaup", "Loxia scotica_Scottish Crossbill", "Acrocephalus schoenobaenus_Sedge Warbler", "Tadorna tadorna_Shelduck", "Asio flammeus_Short-eared Owl", "Spatula clypeata_Shoveler", "Spinus spinus_Siskin (call)", "Alauda arvensis_Skylark (call)", "Gallinago gallinago_Snipe", "Plectrophenax nivalis_Snow Bunting", "Turdus philomelos_Song Thrush (call)", "Porzana porzana_Spotted Crake", "Muscicapa striata_Spotted Flycatcher (call)", "Tringa erythropus_Spotted Redshank", "Burhinus oedicnemus_Stone-curlew (call)", "Saxicola rubicola_Stonechat", "Hirundo rustica_Swallow", "Apus apus_Swift", "Anser fabalis_Taiga Bean Goose", "Strix aluco_Tawny Owl", "Anas crecca_Teal", "Anthus trivialis_Tree Pipit (call)", "Certhia familiaris_Treecreeper (call)", "Aythya fuligula_Tufted Duck", "Anser serrirostris_Tundra Bean Goose", "Arenaria interpres_Turnstone", "Anthus spinoletta_Water Pipit (call)", "Rallus aquaticus_Water Rail ", "Numenius phaeopus_Whimbrel", "Anser albifrons_White-fronted Goose", "Sylvia communis_Whitethroat (call)", "Cygnus cygnus_Whooper Swan", "Mareca penelope_Wigeon", "Phylloscopus trochilus_Willow Warbler (call)", "Tringa glareola_Wood Sandpiper", "Scolopax rusticola_Woodcock (call)", "Lullula arborea_Woodlark (call)", "Larus michahellis_Yellow-legged Gull", "Motacilla flava_Yellow Wagtail", "Emberiza citrinella_Yellowhammer (call)"]);
const NOT_BIRDS = ['Ambient Noise_Ambient Noise', 'Animal_Animal', 'Cat_Cat', 'Dog_Dog', 'Human_Human', 'Red Fox_Red Fox', 'Vehicle_Vehicle']
const GRAYLIST = [];
const GOLDEN_LIST = ["Turdus iliacus_Redwing (call)", "Turdus philomelos_Song Thrush (call)"] // "Erithacus rubecula_Robin (song)", "Erithacus rubecula_Robin (call)"];
let BLOCKED_IDS = [];
let SUPPRESSED_IDS = [];
let ENHANCED_IDS = [];
const CONFIG = {
    sampleRate: 24000, specLength: 3, sigmoid: 1.0,
}


onmessage = async (e) => {
    const modelRequest = e.data.message;
    let file, response;
    try {
        switch (modelRequest) {
            case 'load':
                console.log('load request to worker')
                const appPath = '../' + location + '/';
                const list = e.data.list;
                const batch = e.data.batchSize;
                const backend = e.data.backend;
                postMessage({message: 'labels', labels: labels})
                console.log(`model received load instruction. Using list: ${list}, batch size ${batch}`)
                tf.setBackend(backend).then(async () => {
                    if (backend === 'webgl') {
                        tf.env().set('WEBGL_FORCE_F16_TEXTURES', true)
                        tf.env().set('WEBGL_PACK', true)
                        tf.env().set('WEBGL_EXP_CONV', true)
                        tf.env().set('TOPK_K_CPU_HANDOFF_THRESHOLD', 128)
                        tf.env().set('TOPK_LAST_DIM_CPU_HANDOFF_SIZE_THRESHOLD', 0);
                    }
                    tf.enableProdMode();
                    if (DEBUG) {
                        console.log(tf.env());
                        console.log(tf.env().getFlags());
                    }
                    myModel = new Model(appPath, list);
                    await myModel.loadModel();
                    myModel.warmUp(batch);
                    BACKEND = tf.getBackend();
                    postMessage({
                        message: 'model-ready',
                        sampleRate: myModel.config.sampleRate,
                        chunkLength: myModel.chunkLength,
                        backend: tf.getBackend(),
                        labels: labels
                    })
                    postMessage({message: 'update-list', blocked: BLOCKED_IDS, updateResults: false});
                })
                break;
            case 'predict':
                file = e.data.file;
                const finalChunk = e.data.finalChunk;
                if (finalChunk) console.log('Received final chunks')
                //const t0 = performance.now();
                let chunks = e.data.chunks;
                const fileStart = e.data.fileStart;
                const SNRThreshold = e.data.snr;
                const confidence = e.data.minConfidence;
                const result = await myModel.predictChunk(chunks, fileStart, file, finalChunk, SNRThreshold, confidence);
                response = {
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
                break;
            case 'get-spectrogram':
                const buffer = e.data.buffer;
                // Only consider full specs
                if (buffer.length < 72000) return
                file = e.data.file;
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
                response = {
                    message: 'spectrogram',
                    width: myModel.inputShape[2],
                    height: myModel.inputShape[1],
                    channels: myModel.inputShape[3],
                    image: image,
                    file: file,
                    filepath: filepath
                }
                postMessage(response)
                break;
            case'list':
                myModel.list = e.data.list;
                console.log(`Setting list to ${myModel.list}`);
                myModel.setList();
                postMessage({message: 'update-list', blocked: BLOCKED_IDS, updateResults: true});
                break;
        }
    }
        // If worker was respawned
    catch (e) {
        console.log(e)
    }
}


// https://www.tensorflow.org/js/guide/platform_environment#flags
//tf.enableDebugMode()


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
        this.inputShape[0] = this.batchSize;
        if (tf.getBackend() === 'webgl') {

            const result = tf.tidy(() => {
                const warmupResult = this.model.predict(tf.zeros(this.inputShape), {batchSize: this.batchSize});
                warmupResult.arraySync();
                return true;
            })
        }
        console.log('WarmUp end', tf.memory().numTensors)
        return true;
    }

    setList() {
        BLOCKED_IDS = [];
        // get the indices of any items in the blacklist, GRAYLIST
        if (this.list === 'birds') {
            // find the position of the blocked items in the label list
            NOT_BIRDS.forEach(notBird => BLOCKED_IDS.push(labels.indexOf(notBird)))
        } else if (this.list === 'migrants') {
            for (let i = 0; i < labels.length; i++) {
                if (!MIGRANTS.has(labels[i])) BLOCKED_IDS.push(i);
            }
        }
        GRAYLIST.forEach(species => SUPPRESSED_IDS.push(labels.indexOf(species)))
        GOLDEN_LIST.forEach(species => ENHANCED_IDS.push(labels.indexOf(species)))
    }

    normalize(spec) {
        let spec_max = tf.max(spec, [1, 2]);
        spec_max = tf.reshape(spec_max, [-1, 1, 1, 1])
        spec = spec.mul(255);
        spec = spec.div(spec_max);
        return spec;
    }

    getSNR(spectrograms) {
        return tf.tidy(() => {
            const max = tf.max(spectrograms, 2);
            const mean = tf.mean(spectrograms, 2);
            const peak = tf.sub(max, mean);
            let snr = tf.squeeze(tf.max(peak, 1));
            snr = tf.sub(255, snr)  // bigger number, less signal
            return snr
        })
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
        //specBatch = tf.slice3d(specBatch, [0, 1, 1], [-1, height, width]);
        specBatch = tf.abs(specBatch);
        // Add channel axis
        specBatch = tf.expandDims(specBatch, -1);
        specBatch = tf.image.resizeBilinear(specBatch, [img_height, img_width], false);

        return tf.tidy(() => {
            return this.normalize(specBatch);
        })
    }

    padBatch(tensor) {
        return tf.tidy(() => {
            console.log(`Adding ${this.batchSize - tensor.shape[0]} tensors to the batch`)
            const shape = [...tensor.shape];
            shape[0] = this.batchSize - shape[0];
            const padding = tf.zeros(shape);
            return tf.concat([tensor, padding], 0)
        })
    }

    checkAddContext(prediction, tensor, confidence, SNRthreshold) {
        // Create a set of images from the batch, offset by half the width of the original images
        const [batchSize, height, width, channel] = tensor.shape;
        const makeContextAware = (BACKEND === 'webgl' || SNRthreshold === 0) && batchSize > 1;
        if (makeContextAware) {
            return tf.tidy(() => {
                const firstHalf = tensor.slice([0, 0, 0, 0], [-1, -1, width / 2, -1]);
                const secondHalf = tensor.slice([0, 0, width / 2, 0], [-1, -1, width / 2, -1]);
                const paddedSecondHalf = tf.concat([tf.zeros([1, height, width / 2, channel]), secondHalf], 0);
                secondHalf.dispose();
                // prepend padding tensor
                const [droppedSecondHalf, _] = paddedSecondHalf.split([paddedSecondHalf.shape[0] - 1, 1]);  // pop last tensor
                paddedSecondHalf.dispose();
                const combined = tf.concat([droppedSecondHalf, firstHalf], 2);  // concatenate adjacent pairs along the width dimension
                firstHalf.dispose();
                droppedSecondHalf.dispose();
                const rshiftPrediction = this.model.predict(combined, {batchSize: this.batchSize});
                combined.dispose();
                // now we have predictions for both the original and rolled images
                const [padding, remainder] = tf.split(rshiftPrediction, [1, -1]);
                const lshiftPrediction = tf.concat([remainder, padding]);
                // Get the highest predictions from the overlapping images
                const surround = tf.maximum(rshiftPrediction, lshiftPrediction);
                lshiftPrediction.dispose();
                rshiftPrediction.dispose();
                // Mask out where these are below the threshold
                const indices = tf.greater(surround, confidence);
                return prediction.where(indices, 0);
            })
        } else {
            return prediction;  // Do nothing
        }
    }

    async predictBatch(goodTensors, file, fileStart, threshold, confidence) {
        console.log('predictBatch begin', tf.memory().numTensors)
        let batched_results = [];
        let result;
        let audacity;
        let fixedTensorBatch = tf.tidy(() => {
            return this.fixUpSpecBatch(tf.stack(Object.values(goodTensors)))
        })
        //console.log('rawTensorBatch (-)  Tensorbatch (+), expect same', tf.memory().numTensors)
        let intKeys = Object.keys(goodTensors).map((str) => {
            return parseInt(str)
        });
        let keysTensor, TensorBatch, maskedKeysTensor, maskedTensorBatch;
        if (BACKEND === 'webgl') {
            if (fixedTensorBatch.shape[0] < this.batchSize) {
                // WebGL works best when all batches are the same size
                TensorBatch = this.padBatch(fixedTensorBatch)
                fixedTensorBatch.dispose();
            } else {
                TensorBatch = fixedTensorBatch;
                //fixedTensorBatch.dispose()
            }
        } else if (threshold) {
            keysTensor = tf.stack(intKeys);
            let condition = tf.less(this.getSNR(fixedTensorBatch), (10 - threshold) * 10);
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

        let prediction;
        if (maskedTensorBatch) {
            prediction = this.model.predict(maskedTensorBatch, {batchSize: this.batchSize})
        } else {
            prediction = this.model.predict(TensorBatch, {batchSize: this.batchSize})
        }
        const updatedTensor = maskedTensorBatch || TensorBatch;
        let newPrediction = this.checkAddContext(prediction, updatedTensor, confidence, threshold);
        if (TensorBatch) TensorBatch.dispose();
        if (maskedTensorBatch) maskedTensorBatch.dispose();
        updatedTensor.dispose();
        const {indices, values} = newPrediction ? newPrediction.topk(3) : prediction.topk(3);
        if (newPrediction) newPrediction.dispose();
        prediction.dispose();

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
                if (SUPPRESSED_IDS.includes(item.index[i])) {
                    item.score[i] = item.score[i] ** 3;
                } else if (ENHANCED_IDS.includes(item.index[i])) {
                    item.score[i] = Math.pow(item.score[i], 0.5);
                }
            }

            // If using the whitelist, we want to promote allowed IDs above any blocked IDs, so they will be visible
            // if they meet the confidence threshold.
            let count = 0;
            while (BLOCKED_IDS.indexOf(item.index[0]) !== -1 && count !== item.index.length) {
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
            batched_results.push([result, audacity]);
        }


        return batched_results
    }

    async compute_spectrogram(chunk, h, w) {
        return tf.tidy(() => {
            chunk = tf.tensor1d(chunk)
            let spec = tf.signal.stft(chunk, this.frame_length, this.frame_step)
            const img_height = h || height;
            const img_width = w || width;
            // Swap axes to fit output shape
            spec = tf.transpose(spec, [1, 0]);
            spec = tf.reverse(spec, [0]);
            spec = tf.abs(spec);
            // Add channel axis
            spec = tf.expandDims(spec, -1);
            spec = tf.image.resizeBilinear(spec, [img_height, img_width]);
            // Fix specBatch shape
            return this.normalize_test(spec);
        })
    }

    async predictChunk(chunks, fileStart, file, finalchunk, threshold, confidence) {
        let results = [];
        let goodTensors = {}
        for (const [key, value] of Object.entries(chunks)) {
            let chunk = tf.tensor1d(value);
            // if the chunk is too short, pad with zeroes.
            // Min length is 0.5s, set in UI.js - a wavesurfer region option
            let paddedChunk;
            const shape = chunk.shape[0]
            if (shape < this.chunkLength) {
                paddedChunk = chunk.pad([[0, this.chunkLength - shape]]);
            }
            const spectrogram = paddedChunk ?
                this.makeSpectrogram(paddedChunk) : this.makeSpectrogram(chunk);
            chunk.dispose();
            if (paddedChunk) paddedChunk.dispose();
            goodTensors[key] = spectrogram;
            //Loop will continue
            if (Object.keys(goodTensors).length === this.batchSize) {
                // There's a new batch of predictions to make
                results = await this.predictBatch(goodTensors, file, fileStart, threshold, confidence)
                this.clearTensorArray(goodTensors)
                goodTensors = {}
            }
        }
        if (finalchunk) {
            // Top up results with any final tensor predictions
            if (Object.keys(goodTensors).length) {
                results = await this.predictBatch(goodTensors, file, fileStart, threshold, confidence)
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
