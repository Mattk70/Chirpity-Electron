const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
let DEBUG = true;
let BACKEND;

//GLOBALS
let myModel;
//const MIGRANTS = new Set(["Pluvialis dominica_American Golden Plover (call)", "Acanthis hornemanni_Arctic Redpoll (call)", "Sterna paradisaea_Arctic Tern (call)", "Recurvirostra avosetta_Avocet (call)", "Porzana pusilla_Baillon's Crake (call)", "Limosa lapponica_Bar-tailed Godwit (call)", "Tyto alba_Barn Owl (call)", "Branta leucopsis_Barnacle Goose (call)", "Cygnus columbianus_Bewick's Swan (call)", "Botaurus stellaris_Bittern (call)", "Chroicocephalus ridibundus_Black-headed Gull (call)", "Podiceps nigricollis_Black-necked Grebe (call)", "Limosa limosa_Black-tailed Godwit (call)", "Turdus merula_Blackbird (flight call)", "Sylvia atricapilla_Blackcap (call)", "Fringilla montifringilla_Brambling (call)", "Branta bernicla_Brent Goose (call)", "Branta canadensis_Canada Goose (call)", "Larus cachinnans_Caspian Gull (call)", "Phylloscopus collybita_Chiffchaff (call)", "Loxia curvirostra_Common Crossbill (call)", "Larus canus_Common Gull (call)", "Acanthis flammea_Common Redpoll (call)", "Actitis hypoleucos_Common Sandpiper (call)", "Melanitta nigra_Common Scoter (call)", "Sterna hirundo_Common Tern (call)", "Fulica atra_Coot (call)", "Crex crex_Corncrake (call)", "Cuculus canorus_Cuckoo (call)", "Calidris ferruginea_Curlew Sandpiper (call)", "Numenius arquata_Curlew (call)", "Charadrius morinellus_Dotterel (call)", "Calidris alpina_Dunlin (call)", "Prunella modularis_Dunnock (call)", "Alopochen aegyptiaca_Egyptian Goose (call)", "Somateria mollissima_Eider (call)", "Turdus pilaris_Fieldfare (call)", "Mareca strepera_Gadwall (call)", "Sylvia borin_Garden Warbler (call)", "Spatula querquedula_Garganey (call)", "Regulus regulus_Goldcrest (call)", "Pluvialis apricaria_Golden Plover (call)", "Bucephala clangula_Goldeneye (call)", "Mergus merganser_Goosander (call)", "Locustella naevia_Grasshopper Warbler (call)", "Larus marinus_Great Black-backed Gull (call)", "Podiceps cristatus_Great Crested Grebe (call)", "Tringa ochropus_Green Sandpiper (call)", "Tringa nebularia_Greenshank (call)", "Ardea cinerea_Grey Heron (call)", "Perdix perdix_Grey Partridge (call)", "Pluvialis squatarola_Grey Plover (call)", "Motacilla cinerea_Grey Wagtail (call)", "Anser anser_Greylag Goose (call)", "Delichon urbicum_House Martin (call)", "Coccothraustes coccothraustes_Hawfinch (call)", "Larus argentatus_Herring Gull (call)", "Lymnocryptes minimus_Jack Snipe (call)", "Alcedo atthis_Kingfisher (call)", "Calidris canutus_Knot (call)", "Calcarius lapponicus_Lapland Bunting (call)", "Larus fuscus_Lesser Black-backed Gull (call)", "Acanthis cabaret_Lesser Redpoll (call)", "Sylvia curruca_Lesser Whitethroat (call)", "Linaria cannabina_Linnet (call)", "Egretta garzetta_Little Egret (call)", "Tachybaptus ruficollis_Little Grebe (call)", "Hydrocoloeus minutus_Little Gull (call)", "Athene noctua_Little Owl (call)", "Charadrius dubius_Little Ringed Plover (call)", "Calidris minuta_Little Stint (call)", "Sternula albifrons_Little Tern (call)", "Asio otus_Long-eared Owl (call)", "Clangula hyemalis_Long-tailed Duck (call)", "Anas platyrhynchos_Mallard (call)", "Aix galericulata_Mandarin Duck (call)", "Anthus pratensis_Meadow Pipit (call)", "Ichthyaetus melanocephalus_Mediterranean Gull (call)", "Turdus viscivorus_Mistle Thrush (call)", "Gallinula chloropus_Moorhen (call)", "Nycticorax nycticorax_Night Heron (call)", "Luscinia megarhynchos_Nightingale (call)", "Caprimulgus europaeus_Nightjar (call)", "Anthus hodgsoni_Olive-backed Pipit (call)", "Emberiza hortulana_Ortolan Bunting (call)", "Haematopus ostralegus_Oystercatcher (call)", "Ficedula hypoleuca_Pied Flycatcher (call)", "Motacilla alba_Pied Wagtail (call)", "Anser brachyrhynchus_Pink-footed Goose (call)", "Anas acuta_Pintail (call)", "Aythya ferina_Pochard (call)", "Calidris maritima_Purple Sandpiper (call)", "Coturnix coturnix_Quail (call)", "Mergus serrator_Red-breasted Merganser (call)", "Netta rufina_Red-crested Pochard (call)", "Alectoris rufa_Red-legged Partridge (call)", "Tringa totanus_Redshank (call)", "Phoenicurus phoenicurus_Redstart (call)", "Turdus iliacus_Redwing (call)", "Emberiza schoeniclus_Reed Bunting (call)", "Acrocephalus scirpaceus_Reed Warbler (call)", "Turdus torquatus_Ring Ouzel (call)", "Charadrius hiaticula_Ringed Plover (call)", "Erithacus rubecula_Robin (flight call)", "Anthus petrosus_Rock Pipit (call)", "Sterna dougallii_Roseate Tern (call)", "Calidris pugnax_Ruff (call)", "Riparia riparia_Sand Martin (call)", "Calidris alba_Sanderling (call)", "Thalasseus sandvicensis_Sandwich Tern (call)", "Aythya marila_Scaup (call)", "Loxia scotica_Scottish Crossbill (call)", "Acrocephalus schoenobaenus_Sedge Warbler (call)", "Tadorna tadorna_Shelduck (call)", "Asio flammeus_Short-eared Owl (call)", "Spatula clypeata_Shoveler (call)", "Spinus spinus_Siskin (call)", "Alauda arvensis_Skylark (call)", "Gallinago gallinago_Snipe (call)", "Plectrophenax nivalis_Snow Bunting (call)", "Turdus philomelos_Song Thrush (call)", "Porzana porzana_Spotted Crake (call)", "Muscicapa striata_Spotted Flycatcher (call)", "Tringa erythropus_Spotted Redshank (call)", "Burhinus oedicnemus_Stone-curlew (call)", "Saxicola rubicola_Stonechat (call)", "Hirundo rustica_Swallow (call)", "Apus apus_Swift (call)", "Anser fabalis_Taiga Bean Goose (call)", "Strix aluco_Tawny Owl (call)", "Anas crecca_Teal (call)", "Anthus trivialis_Tree Pipit (call)", "Certhia familiaris_Treecreeper (call)", "Aythya fuligula_Tufted Duck (call)", "Anser serrirostris_Tundra Bean Goose (call)", "Arenaria interpres_Turnstone (call)", "Anthus spinoletta_Water Pipit (call)", "Rallus aquaticus_Water Rail (call)", "Numenius phaeopus_Whimbrel (call)", "Anser albifrons_White-fronted Goose (call)", "Sylvia communis_Whitethroat (call)", "Cygnus cygnus_Whooper Swan (call)", "Mareca penelope_Wigeon (call)", "Phylloscopus trochilus_Willow Warbler (call)", "Tringa glareola_Wood Sandpiper (call)", "Scolopax rusticola_Woodcock (call)", "Lullula arborea_Woodlark (call)", "Larus michahellis_Yellow-legged Gull (call)", "Motacilla flava_Yellow Wagtail (call)", "Emberiza citrinella_Yellowhammer (call)"]);
const MIGRANTS = new Set(["Pluvialis dominica_American Golden Plover", "Acanthis hornemanni_Arctic Redpoll", "Sterna paradisaea_Arctic Tern", "Recurvirostra avosetta_Avocet", "Porzana pusilla_Baillon's Crake", "Limosa lapponica_Bar-tailed Godwit", "Tyto alba_Barn Owl", "Branta leucopsis_Barnacle Goose", "Cygnus columbianus_Bewick's Swan", "Botaurus stellaris_Bittern (call)", "Chroicocephalus ridibundus_Black-headed Gull", "Podiceps nigricollis_Black-necked Grebe", "Limosa limosa_Black-tailed Godwit", "Turdus merula_Blackbird (flight call)", "Sylvia atricapilla_Blackcap (call)", "Fringilla montifringilla_Brambling", "Branta bernicla_Brent Goose", "Branta canadensis_Canada Goose", "Larus cachinnans_Caspian Gull", "Phylloscopus collybita_Chiffchaff (call)", "Loxia curvirostra_Common Crossbill", "Larus canus_Common Gull", "Acanthis flammea_Common Redpoll", "Actitis hypoleucos_Common Sandpiper (call)", "Melanitta nigra_Common Scoter", "Sterna hirundo_Common Tern", "Fulica atra_Coot", "Crex crex_Corncrake", "Cuculus canorus_Cuckoo (call)", "Calidris ferruginea_Curlew Sandpiper", "Numenius arquata_Curlew", "Charadrius morinellus_Dotterel", "Calidris alpina_Dunlin", "Prunella modularis_Dunnock (call)", "Alopochen aegyptiaca_Egyptian Goose", "Somateria mollissima_Eider", "Turdus pilaris_Fieldfare (call)", "Mareca strepera_Gadwall", "Sylvia borin_Garden Warbler (call)", "Spatula querquedula_Garganey", "Regulus regulus_Goldcrest (call)", "Pluvialis apricaria_Golden Plover", "Bucephala clangula_Goldeneye", "Mergus merganser_Goosander", "Locustella naevia_Grasshopper Warbler (call)", "Larus marinus_Great Black-backed Gull", "Podiceps cristatus_Great Crested Grebe", "Tringa ochropus_Green Sandpiper", "Tringa nebularia_Greenshank", "Ardea cinerea_Grey Heron", "Perdix perdix_Grey Partridge", "Pluvialis squatarola_Grey Plover (call)", "Motacilla cinerea_Grey Wagtail ", "Anser anser_Greylag Goose", "Delichon urbicum_House Martin", "Coccothraustes coccothraustes_Hawfinch", "Larus argentatus_Herring Gull", "Lymnocryptes minimus_Jack Snipe", "Alcedo atthis_Kingfisher", "Calidris canutus_Knot", "Calcarius lapponicus_Lapland Bunting (call)", "Larus fuscus_Lesser Black-backed Gull", "Acanthis cabaret_Lesser Redpoll ", "Sylvia curruca_Lesser Whitethroat (call)", "Linaria cannabina_Linnet (call)", "Egretta garzetta_Little Egret", "Tachybaptus ruficollis_Little Grebe", "Hydrocoloeus minutus_Little Gull", "Athene noctua_Little Owl", "Charadrius dubius_Little Ringed Plover", "Calidris minuta_Little Stint ", "Sternula albifrons_Little Tern", "Asio otus_Long-eared Owl", "Clangula hyemalis_Long-tailed Duck", "Anas platyrhynchos_Mallard", "Aix galericulata_Mandarin Duck", "Anthus pratensis_Meadow Pipit (call)", "Ichthyaetus melanocephalus_Mediterranean Gull", "Turdus viscivorus_Mistle Thrush (call)", "Gallinula chloropus_Moorhen", "Nycticorax nycticorax_Night Heron", "Luscinia megarhynchos_Nightingale (call)", "Caprimulgus europaeus_Nightjar (call)", "Anthus hodgsoni_Olive-backed Pipit (call)", "Emberiza hortulana_Ortolan Bunting (call)", "Haematopus ostralegus_Oystercatcher", "Ficedula hypoleuca_Pied Flycatcher (call)", "Motacilla alba_Pied Wagtail", "Anser brachyrhynchus_Pink-footed Goose", "Anas acuta_Pintail", "Aythya ferina_Pochard", "Calidris maritima_Purple Sandpiper", "Coturnix coturnix_Quail (call)", "Mergus serrator_Red-breasted Merganser", "Netta rufina_Red-crested Pochard", "Alectoris rufa_Red-legged Partridge", "Tringa totanus_Redshank", "Phoenicurus phoenicurus_Redstart (call)", "Turdus iliacus_Redwing (call)", "Emberiza schoeniclus_Reed Bunting (call)", "Acrocephalus scirpaceus_Reed Warbler (call)", "Turdus torquatus_Ring Ouzel (call)", "Charadrius hiaticula_Ringed Plover", "Erithacus rubecula_Robin (flight call)", "Anthus petrosus_Rock Pipit", "Sterna dougallii_Roseate Tern", "Calidris pugnax_Ruff", "Riparia riparia_Sand Martin", "Calidris alba_Sanderling", "Thalasseus sandvicensis_Sandwich Tern", "Aythya marila_Scaup", "Loxia scotica_Scottish Crossbill", "Acrocephalus schoenobaenus_Sedge Warbler", "Tadorna tadorna_Shelduck", "Asio flammeus_Short-eared Owl", "Spatula clypeata_Shoveler", "Spinus spinus_Siskin (call)", "Alauda arvensis_Skylark (call)", "Gallinago gallinago_Snipe", "Plectrophenax nivalis_Snow Bunting", "Turdus philomelos_Song Thrush (call)", "Porzana porzana_Spotted Crake", "Muscicapa striata_Spotted Flycatcher (call)", "Tringa erythropus_Spotted Redshank", "Burhinus oedicnemus_Stone-curlew (call)", "Saxicola rubicola_Stonechat", "Hirundo rustica_Swallow", "Apus apus_Swift", "Anser fabalis_Taiga Bean Goose", "Strix aluco_Tawny Owl", "Anas crecca_Teal", "Anthus trivialis_Tree Pipit (call)", "Certhia familiaris_Treecreeper (call)", "Aythya fuligula_Tufted Duck", "Anser serrirostris_Tundra Bean Goose", "Arenaria interpres_Turnstone", "Anthus spinoletta_Water Pipit (call)", "Rallus aquaticus_Water Rail ", "Numenius phaeopus_Whimbrel", "Anser albifrons_White-fronted Goose", "Sylvia communis_Whitethroat (call)", "Cygnus cygnus_Whooper Swan", "Mareca penelope_Wigeon", "Phylloscopus trochilus_Willow Warbler (call)", "Tringa glareola_Wood Sandpiper", "Scolopax rusticola_Woodcock (call)", "Lullula arborea_Woodlark (call)", "Larus michahellis_Yellow-legged Gull", "Motacilla flava_Yellow Wagtail", "Emberiza citrinella_Yellowhammer (call)"]);
const NOT_BIRDS = ['Ambient Noise_Ambient Noise', 'Animal_Animal', 'Cat_Cat', 'Dog_Dog', 'Human_Human', 'Red Fox_Red Fox', 'Vehicle_Vehicle']
const GRAYLIST = [];
const GOLDEN_LIST = [] // ["Turdus iliacus_Redwing (call)", "Turdus philomelos_Song Thrush (call)"] // "Erithacus rubecula_Robin (song)", "Erithacus rubecula_Robin (call)"];
let BLOCKED_IDS = [];
let SUPPRESSED_IDS = [];
let ENHANCED_IDS = [];
const CONFIG = {
    sampleRate: 24000, specLength: 3, sigmoid: 1.0,
}


onmessage = async (e) => {
    const modelRequest = e.data.message;
    let response;
    try {
        switch (modelRequest) {
            case 'load':
                if (DEBUG) console.log('load request to worker')
                const {height, width, labels, location} = JSON.parse(fs.readFileSync('model_config.json', 'utf8'));
                const appPath = '../' + location + '/';
                const list = e.data.list;
                const batch = e.data.batchSize;
                const backend = e.data.backend;
                postMessage({message: 'labels', labels: labels})
                if (DEBUG) console.log(`model received load instruction. Using list: ${list}, batch size ${batch}`)
                tf.setBackend(backend).then(async () => {
                    if (backend === 'webgl') {
                        tf.env().set('WEBGL_FORCE_F16_TEXTURES', true)
                        tf.env().set('WEBGL_PACK', true)
                        tf.env().set('WEBGL_EXP_CONV', true)
                        //tf.env().set('TOPK_K_CPU_HANDOFF_THRESHOLD', 0)
                        tf.env().set('TOPK_LAST_DIM_CPU_HANDOFF_SIZE_THRESHOLD', 0);
                    }
                    tf.enableProdMode();
                    if (DEBUG) {
                        console.log(tf.env());
                        console.log(tf.env().getFlags());
                    }
                    myModel = new Model(appPath, list);
                    myModel.height = height;
                    myModel.width = width;
                    myModel.labels = labels;
                    await myModel.loadModel();
                    postMessage({message: 'update-list', blocked: BLOCKED_IDS, updateResults: false});
                    myModel.warmUp(batch);
                    BACKEND = tf.getBackend();
                    postMessage({
                        message: 'model-ready',
                        sampleRate: myModel.config.sampleRate,
                        chunkLength: myModel.chunkLength,
                        backend: tf.getBackend(),
                        labels: labels
                    })

                })
                break;
            case 'predict':
                //const t0 = performance.now();
                const {chunks, start, fileStart, file, snr, minConfidence, worker, context} = e.data;
                myModel.useContext = context;
                const result = await myModel.predictChunk(chunks, start, fileStart, file, snr, minConfidence / 100);
                response = {
                    message: 'prediction',
                    file: file,
                    result: result,
                    fileStart: fileStart,
                    worker: worker
                }
                postMessage(response);
                // reset the results
                myModel.result = [];
                break;
            case 'get-spectrogram':
                const buffer = e.data.buffer;
                // Only consider full specs
                if (buffer.length < myModel.chunkLength) return
                const specFile = e.data.file;
                const filepath = e.data.filepath;
                const spec_height = e.data.height;
                const spec_width = e.data.width
                let image;
                const bufferTensor = myModel.normalise_audio(buffer);
                const imageTensor = tf.tidy(() => {
                    return myModel.makeSpectrogram(bufferTensor);
                })
                image = tf.tidy(() => {
                    let spec = myModel.fixUpSpecBatch(tf.expandDims(imageTensor, 0), spec_height, spec_width);
                    // rescale to 0-255
                    //const spec_max = tf.max(spec)
                    return spec.dataSync() //tf.mul(spec, tf.scalar(255)).dataSync();
                })
                bufferTensor.dispose()
                imageTensor.dispose()
                response = {
                    message: 'spectrogram',
                    width: myModel.inputShape[2],
                    height: myModel.inputShape[1],
                    channels: myModel.inputShape[3],
                    image: image,
                    file: specFile,
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
        this.labels = null;
        this.height = null;
        this.width = null;
        this.config = CONFIG;
        this.chunkLength = this.config.sampleRate * this.config.specLength;
        this.model_loaded = false;
        this.frame_length = 512;
        this.frame_step = 186;
        this.appPath = appPath;
        this.list = list;
        this.useContext = null;
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
            tf.tidy(() => {
                const warmupResult = this.model.predict(tf.zeros(this.inputShape), {batchSize: this.batchSize});
                warmupResult.arraySync();
                // see if we can get padding compiled at this point
                this.padBatch(tf.zeros([1, this.inputShape[1], this.inputShape[2], this.inputShape[3]]), {batchSize: this.batchSize})
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
            NOT_BIRDS.forEach(notBird => BLOCKED_IDS.push(this.labels.indexOf(notBird)))
        } else if (this.list === 'migrants') {
            for (let i = 0; i < this.labels.length; i++) {
                if (!MIGRANTS.has(this.labels[i])) BLOCKED_IDS.push(i);
            }
        }
        GRAYLIST.forEach(species => SUPPRESSED_IDS.push(this.labels.indexOf(species)))
        GOLDEN_LIST.forEach(species => ENHANCED_IDS.push(this.labels.indexOf(species)))
    }

    normalize(spec) {
        // console.log('Pre-norm### Min is: ', spec.min().dataSync(), 'Max is: ', spec.max().dataSync())
        const spec_max = tf.max(spec, [1, 2]).reshape([-1, 1, 1, 1])
        // const spec_min = tf.min(spec, [1, 2]).reshape([-1, 1, 1, 1])
        spec = spec.mul(255);
        spec = spec.div(spec_max);
        // spec = tf.sub(spec, spec_min).div(tf.sub(spec_max, spec_min));
        // console.log('{Post norm#### Min is: ', spec.min().dataSync(), 'Max is: ', spec.max().dataSync())
        return spec
    }

    //     normalize_test(spec) {
    //     let spec_max = tf.max(spec, [0, 1]);
    //     spec_max = tf.reshape(spec_max, [-1, 1, 1])
    //     spec = spec.mul(255);
    //     spec = spec.div(spec_max);
    //     return spec;
    // }

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


    fixUpSpecBatch(specBatch, h, w) {
        const img_height = h || this.height;
        const img_width = w || this.width;
        return tf.tidy(() => {
            // Swap axes to fit output shape
            specBatch = tf.transpose(specBatch, [0, 2, 1]);
            specBatch = tf.reverse(specBatch, [1]);

            // specBatch = tf.abs(specBatch);
            // Add channel axis
            specBatch = tf.expandDims(specBatch, -1);
            // let max_spec = Array.from(tf.max(specBatch).dataSync());
            // let min_spec = Array.from(tf.min(specBatch).dataSync());
            const log_spec_adjusted =tf.log(specBatch.add(1e-7)).mul(20)
            // const preslice = specBatch.arraySync()
            //specBatch = tf.slice4d(specBatch, [0, 0, 0, 0], [-1, img_height, img_width, -1]);
            specBatch = tf.image.resizeBilinear(log_spec_adjusted, [img_height, img_width]);
            // max_spec = Array.from(tf.max(specBatch).dataSync());
            //  min_spec = Array.from(tf.min(specBatch).dataSync());
            // const postslice = specBatch.arraySync()
            return specBatch //  this.normalize(specBatch);
        })
    }

    padBatch(tensor) {
        return tf.tidy(() => {
            if (DEBUG) console.log(`Adding ${this.batchSize - tensor.shape[0]} tensors to the batch`)
            const shape = [...tensor.shape];
            shape[0] = this.batchSize - shape[0];
            const padding = tf.zeros(shape);
            return tf.concat([tensor, padding], 0)
        })
    }

    addContext(prediction, tensor, confidence) {
        // Create a set of images from the batch, offset by half the width of the original images
        const [batchSize, height, width, channel] = tensor.shape;
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
            const indices = tf.greater(surround, confidence / 2);
            return prediction.where(indices, 0);
        })
    }

    async predictBatch(specs, keys, file, fileStart, threshold, confidence) {
        let fixedTensorBatch = this.fixUpSpecBatch(specs);
        specs.dispose();
        let keysTensor, TensorBatch, maskedKeysTensor, maskedTensorBatch;
        if (BACKEND === 'webgl') {
            if (fixedTensorBatch.shape[0] < this.batchSize) {
                // WebGL works best when all batches are the same size
                TensorBatch = this.padBatch(fixedTensorBatch)
                fixedTensorBatch.dispose();
            } else {
                TensorBatch = fixedTensorBatch;
            }
        } else if (threshold) {
            keysTensor = tf.stack(keys);
            let condition = tf.less(this.getSNR(fixedTensorBatch), (10 - threshold) * 10);
            // Avoid mask cannot be scalar error at end of predictions
            let newCondition;
            if (condition.rankType === "0") {
                newCondition = tf.expandDims(condition)
                condition.dispose()
            }
            const c = newCondition || condition;
            // maskedTensorBatch = tf.booleanMaskAsync(fixedTensorBatch, c);
            // maskedKeysTensor = tf.booleanMaskAsync(keysTensor, c)
            [maskedTensorBatch, maskedKeysTensor] = await Promise.all([
                tf.booleanMaskAsync(fixedTensorBatch, c),
                tf.booleanMaskAsync(keysTensor, c)])
            c.dispose();

            fixedTensorBatch.dispose();
            keysTensor.dispose();


            if (!maskedTensorBatch.size) {
                maskedTensorBatch.dispose();
                maskedKeysTensor.dispose();
                return []
            } else {
                if (DEBUG) console.log("surviving tensors in batch", maskedTensorBatch.shape[0])
            }
        } else {
            TensorBatch = fixedTensorBatch;
        }

        const tb = maskedTensorBatch || TensorBatch;
        let prediction;
        prediction = this.model.predict(tb, {batchSize: this.batchSize})
        let newPrediction;
        if (this.useContext && this.batchSize > 1 && threshold === 0) {
            newPrediction = this.addContext(prediction, tb, confidence);
        }
        tb.dispose();
        const finalPrediction = newPrediction || prediction;
        //const sigmoid_prediction = tf.sigmoid(finalPrediction)
        const array_of_predictions = finalPrediction.arraySync()
        // sigmoid_prediction.dispose()
        prediction.dispose();
        if (newPrediction) newPrediction.dispose()

        if (maskedKeysTensor) {
            keys = maskedKeysTensor.dataSync()
            maskedKeysTensor.dispose();
        }
        return keys.reduce((acc, key, index) => {
            // convert key (samples) to milliseconds
            const position = key / CONFIG.sampleRate;
            acc[position] = array_of_predictions[index];
            return acc;
        }, {});
    }

    compute_spectrogram(chunk) {
        return tf.tidy(() => {
            let spec = tf.signal.stft(chunk, this.frame_length, this.frame_step).cast('float32')
            chunk.dispose();
            return spec
        })
    }


    makeSpectrogram(audioBuffer) {
        return tf.tidy(() => {
            let spec = tf.abs(tf.signal.stft(audioBuffer, this.frame_length, this.frame_step))

            // const power = tf.square(spec);
            // const log_spec = tf.mul(tf.scalar(10.0), tf.div(tf.log(power), tf.log(tf.scalar(10.0))));
            // const maxLogSpec = tf.max(log_spec);
            // const log_spec_adjusted = tf.maximum(log_spec, tf.sub(maxLogSpec, tf.scalar(80)));
            audioBuffer.dispose();
            return spec;
        })
    }

    const
    normalise_audio = (signal) => {
        return tf.tidy(() => {
            signal = tf.tensor1d(signal)
            const sig_max = tf.max(signal)
            //const sig_min = tf.min(signal)
            //const sig_max_ds = sig_max.dataSync()
            //const sig_min_ds = sig_min.dataSync()
            //Normalize the waveform to [-1,1]
            return signal.div(sig_max).mul(tf.scalar(128));
            //return signal.sub(sig_min).div(sig_max.sub(sig_min)).mul(tf.scalar(255)).sub(tf.scalar(128)) // .mul(tf.scalar(128));
        })
    }

    async predictChunk(audioBuffer, start, fileStart, file, threshold, confidence) {
        if (DEBUG) console.log('predictCunk begin', tf.memory().numTensors)
        audioBuffer = this.normalise_audio(audioBuffer);

        // check if we need to pad
        const remainder = audioBuffer.shape % this.chunkLength;
        let paddedBuffer;
        if (remainder !== 0) {  // If the buffer isn't divisible by batch size, we must be at the end of the file
            paddedBuffer = audioBuffer.pad([[0, this.chunkLength - remainder]]);
            audioBuffer.dispose();
            if (DEBUG) console.log('Received final chunks')
        }
        const buffer = paddedBuffer || audioBuffer;
        const numSamples = buffer.shape / this.chunkLength;
        let bufferList = tf.split(buffer, numSamples);
        buffer.dispose();
        bufferList = bufferList.map(x => {
            return this.makeSpectrogram(x)
        });
        const specBatch = tf.stack(bufferList);
        const batchKeys = [...Array(numSamples).keys()].map(i => start + this.chunkLength * i);
        // recreate the object...
        // let specBatch = {}
        //
        // for (let i = 0; i < batchKeys.length; i++) {
        //     specBatch[batchKeys[i]] = bufferList[i];
        // }
        const result = await this.predictBatch(specBatch, batchKeys, file, fileStart, threshold, confidence)
        this.clearTensorArray(bufferList);
        return result
    }

    async clearTensorArray(tensorObj) {
        // Dispose of accumulated kept tensors in model tensor array
        tensorObj.forEach(tensor => tensor.dispose());
    }
}
