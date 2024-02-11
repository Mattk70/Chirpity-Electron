const tf = require('@tensorflow/tfjs-node');
const fs = require('node:fs');
const path = require('node:path');
let DEBUG = false;
let BACKEND;

//GLOBALS
let listModel;
let NOT_BIRDS;
const NOCTURNAL = new Set(["Pluvialis dominica_American Golden Plover", "Acanthis hornemanni_Arctic Redpoll", "Sterna paradisaea_Arctic Tern", "Recurvirostra avosetta_Avocet", "Porzana pusilla_Baillon's Crake", "Limosa lapponica_Bar-tailed Godwit", "Tyto alba_Barn Owl", "Branta leucopsis_Barnacle Goose", "Cygnus columbianus_Bewick's Swan", "Botaurus stellaris_Bittern (call)", "Chroicocephalus ridibundus_Black-headed Gull", "Podiceps nigricollis_Black-necked Grebe", "Limosa limosa_Black-tailed Godwit", "Turdus merula_Blackbird (flight call)", "Sylvia atricapilla_Blackcap (call)", "Fringilla montifringilla_Brambling", "Branta bernicla_Brent Goose", "Branta canadensis_Canada Goose", "Larus cachinnans_Caspian Gull", "Phylloscopus collybita_Chiffchaff (call)", "Loxia curvirostra_Common Crossbill", "Larus canus_Common Gull", "Acanthis flammea_Common Redpoll", "Actitis hypoleucos_Common Sandpiper", "Melanitta nigra_Common Scoter", "Sterna hirundo_Common Tern", "Fulica atra_Coot", "Emberize calandre_Corn Bunting (call)", "Crex crex_Corncrake", "Cuculus canorus_Cuckoo (call)", "Calidris ferruginea_Curlew Sandpiper", "Numenius arquata_Curlew", "Charadrius morinellus_Dotterel", "Calidris alpina_Dunlin", "Prunella modularis_Dunnock (call)", "Alopochen aegyptiaca_Egyptian Goose", "Turdus pilaris_Fieldfare (call)", "Mareca strepera_Gadwall", "Sylvia borin_Garden Warbler (call)", "Spatula querquedula_Garganey", "Regulus regulus_Goldcrest (call)", "Regulus ignicapilla_Firecrest (call)", "Pluvialis apricaria_Golden Plover", "Bucephala clangula_Goldeneye", "Mergus merganser_Goosander", "Locustella naevia_Grasshopper Warbler (call)", "Larus marinus_Great Black-backed Gull", "Podiceps cristatus_Great Crested Grebe", "Tringa ochropus_Green Sandpiper", "Tringa nebularia_Greenshank", "Ardea cinerea_Grey Heron", "Perdix perdix_Grey Partridge", "Phalaropus fulicarius_Grey", "Pluvialis squatarola_Grey Plover", "Motacilla cinerea_Grey Wagtail ", "Anser anser_Greylag Goose", "Delichon urbicum_House Martin", "Coccothraustes coccothraustes_Hawfinch (call)", "Larus argentatus_Herring Gull", "Lymnocryptes minimus_Jack Snipe", "Alcedo atthis_Kingfisher", "Calidris canutus_Knot", "Calcarius lapponicus_Lapland Bunting (call)", "Larus fuscus_Lesser Black-backed Gull", "Acanthis cabaret_Lesser Redpoll ", "Curraca curruca_Lesser Whitethroat (call)", "Linaria cannabina_Linnet", "Ixobrychus minutus_Little Bittern (call)", "Egretta garzetta_Little Egret", "Tachybaptus ruficollis_Little Grebe", "Hydrocoloeus minutus_Little Gull", "Athene noctua_Little Owl", "Charadrius dubius_Little Ringed Plover", "Calidris minuta_Little Stint ", "Sternula albifrons_Little Tern", "Asio otus_Long-eared Owl", "Clangula hyemalis_Long-tailed Duck", "Anas platyrhynchos_Mallard", "Aix galericulata_Mandarin Duck", "Anthus pratensis_Meadow Pipit (call)", "Ichthyaetus melanocephalus_Mediterranean Gull", "Turdus viscivorus_Mistle Thrush (call)", "Gallinula chloropus_Moorhen", "Nycticorax nycticorax_Night Heron", "Luscinia megarhynchos_Nightingale (call)", "Luscinia megarhynchos_Nightingale (song)", "Caprimulgus europaeus_Nightjar (call)", "Anthus hodgsoni_Olive-backed Pipit (call)", "Emberiza hortulana_Ortolan Bunting (call)", "Emberiza pusilla_Little Bunting (call)", "Haematopus ostralegus_Oystercatcher", "Ficedula hypoleuca_Pied Flycatcher (call)", "Motacilla alba_Pied Wagtail", "Anser brachyrhynchus_Pink-footed Goose", "Anas acuta_Pintail", "Aythya ferina_Pochard", "Calidris maritima_Purple Sandpiper", "Coturnix coturnix_Quail (call)", "Coturnix coturnix_Quail (song)", "Mergus serrator_Red-breasted Merganser", "Netta rufina_Red-crested Pochard", "Alectoris rufa_Red-legged Partridge", "Tringa totanus_Redshank", "Phoenicurus phoenicurus_Redstart (call)", "Turdus iliacus_Redwing (call)", "Emberiza schoeniclus_Reed Bunting (call)", "Acrocephalus scirpaceus_Reed Warbler (call)", "Anthus richardi_Richard's Pipit (call)", "Turdus torquatus_Ring Ouzel (call)", "Charadrius hiaticula_Ringed Plover", "Erithacus rubecula_Robin (flight call)", "Anthus petrosus_Rock Pipit", "Sterna dougallii_Roseate Tern", "Calidris pugnax_Ruff", "Riparia riparia_Sand Martin", "Calidris alba_Sanderling", "Thalasseus sandvicensis_Sandwich Tern", "Aythya marila_Scaup", "Loxia scotica_Scottish Crossbill", "Acrocephalus schoenobaenus_Sedge Warbler", "Tadorna tadorna_Shelduck", "Asio flammeus_Short-eared Owl", "Spatula clypeata_Shoveler", "Spinus spinus_Siskin", "Alauda arvensis_Skylark (call)", "Gallinago gallinago_Snipe", "Plectrophenax nivalis_Snow Bunting", "Turdus philomelos_Song Thrush (call)", "Porzana porzana_Spotted Crake", "Muscicapa striata_Spotted Flycatcher", "Tringa erythropus_Spotted Redshank (call)", "Burhinus oedicnemus_Stone-curlew", "Saxicola rubicola_Stonechat", "Hirundo rustica_Swallow", "Apus apus_Swift", "Anser fabalis_Taiga Bean Goose", "Strix aluco_Tawny Owl", "Anas crecca_Teal", "Anthus trivialis_Tree Pipit (call)", "Aythya fuligula_Tufted Duck", "Anser serrirostris_Tundra Bean Goose", "Arenaria interpres_Turnstone", "Anthus spinoletta_Water Pipit", "Rallus aquaticus_Water Rail", "Numenius phaeopus_Whimbrel", "Anser albifrons_White-fronted Goose", "Sylvia communis_Whitethroat (call)", "Cygnus cygnus_Whooper Swan", "Mareca penelope_Wigeon", "Phylloscopus trochilus_Willow Warbler (call)", "Tringa glareola_Wood Sandpiper", "Scolopax rusticola_Woodcock", "Lullula arborea_Woodlark (call)", "Larus michahellis_Yellow-legged Gull", "Motacilla flava_Yellow Wagtail", "Emberiza citrinella_Yellowhammer (call)"]);
const CHIRPITY_NOT_BIRDS = ['Ambient Noise_Ambient Noise', 'Animal_Animal', 'Cat_Cat', 'Church Bells_Church Bells', 'Cough_Cough', 'Dog_Dog', 'Human_Human', 'Laugh_Laugh', 'No call_No call', 'Rain_Rain', 'Red Fox_Red Fox', 'Sneeze_Sneeze', 'Snoring_Snoring', 'Thunder_Thunder', 'Vehicle_Vehicle', 'Water Drops_Water Drops', 'Waves_Waves', 'Wind_Wind'];
const BIRDNET_NOT_BIRDS = [
    'Dog_Dog', 
    'Environmental_Environmental', 
    'Engine_Engine', 
    'Fireworks_Fireworks', 
    'Gun_Gun', 
    'Human non-vocal_Human non-vocal', 
    'Human vocal_Human vocal', 
    'Human whistle_Human whistle', 
    'Miogryllus saussurei_Miogryllus saussurei', 
    'Noise_Noise', 
    'Power tools_Power tools', 
    'Siren_Siren',
    "Canis latrans_Coyote",
    "Canis lupus_Gray Wolf",
    "Gastrophryne carolinensis_Eastern Narrow-mouthed Toad",
    "Gastrophryne olivacea_Great Plains Narrow-mouthed Toad",
    "Incilius valliceps_Gulf Coast Toad",
    "Anaxyrus americanus_American Toad",
    "Anaxyrus canorus_Yosemite Toad",
    "Anaxyrus cognatus_Great Plains Toad",
    "Anaxyrus fowleri_Fowler's Toad",
    "Anaxyrus houstonensis_Houston Toad",
    "Anaxyrus microscaphus_Arizona Toad",
    "Anaxyrus quercicus_Oak Toad",
    "Anaxyrus speciosus_Texas Toad",
    "Anaxyrus terrestris_Southern Toad",
    "Anaxyrus woodhousii_Woodhouse's Toad",
    "Dryophytes andersonii_Pine Barrens Treefrog",
    "Dryophytes arenicolor_Canyon Treefrog",
    "Dryophytes avivoca_Bird-voiced Treefrog",
    "Dryophytes chrysoscelis_Cope's Gray Treefrog",
    "Dryophytes cinereus_Green Treefrog",
    "Dryophytes femoralis_Pine Woods Treefrog",
    "Dryophytes gratiosus_Barking Treefrog",
    "Dryophytes squirellus_Squirrel Treefrog",
    "Dryophytes versicolor_Gray Treefrog",
    "Eleutherodactylus planirostris_Greenhouse Frog",
    "Hyliola regilla_Pacific Chorus Frog",
    "Lithobates catesbeianus_American Bullfrog",
    "Lithobates clamitans_Green Frog",
    "Lithobates palustris_Pickerel Frog",
    "Lithobates sylvaticus_Wood Frog",
    "Pseudacris brimleyi_Brimley's Chorus Frog",
    "Pseudacris clarkii_Spotted Chorus Frog",
    "Pseudacris crucifer_Spring Peeper",
    "Pseudacris feriarum_Upland Chorus Frog",
    "Pseudacris nigrita_Southern Chorus Frog",
    "Pseudacris ocularis_Little Grass Frog",
    "Pseudacris ornata_Ornate Chorus Frog",
    "Pseudacris streckeri_Strecker's Chorus Frog",
    "Pseudacris triseriata_Striped Chorus Frog",
    "Acris crepitans_Northern Cricket Frog",
    "Acris gryllus_Southern Cricket Frog",
    "Eunemobius carolinus_Carolina Ground Cricket",
    "Eunemobius confusus_Confused Ground Cricket",
    "Gryllus assimilis_Gryllus assimilis",
    "Gryllus fultoni_Southern Wood Cricket",
    "Gryllus pennsylvanicus_Fall Field Cricket",
    "Gryllus rubens_Southeastern Field Cricket",
    "Neonemobius cubensis_Cuban Ground Cricket",
    "Oecanthus celerinictus_Fast-calling Tree Cricket",
    "Oecanthus exclamationis_Davis's Tree Cricket",
    "Oecanthus fultoni_Snowy Tree Cricket",
    "Oecanthus nigricornis_Blackhorned Tree Cricket",
    "Oecanthus niveus_Narrow-winged Tree Cricket",
    "Oecanthus pini_Pine Tree Cricket",
    "Oecanthus quadripunctatus_Four-spotted Tree Cricket",
    "Orocharis saltator_Jumping Bush Cricket",
    "Alouatta pigra_Mexican Black Howler Monkey",
    "Tamias striatus_Eastern Chipmunk",
    "Tamiasciurus hudsonicus_Red Squirrel"];

const MYSTERIES = ['Unknown Sp._Unknown Sp.'];


const birdnetlabelFile = `../labels/V2.4/BirdNET_GLOBAL_6K_V2.4_Labels_en.txt`; 
const BIRDNET_LABELS = await fetch(birdnetlabelFile).then(response => {
    if (! response.ok) throw new Error('Network response was not ok');
    return response.text();
    }).then(filecontents => {
        return filecontents.trim().split(/\r?\n/);
    }).catch(error =>{
        console.error('There was a problem fetching the label file:', error);
    })
const ACTIVITY_INDEX = JSON.parse(fs.readFileSync(path.join(__dirname, '../nocturnal_activity_index.json'), "utf8"));
let config = JSON.parse(fs.readFileSync(path.join(__dirname, '../chirpity_model_config.json'), "utf8"));
const CHIRPITY_LABELS = config.labels;
config = undefined;


/* USAGE EXAMPLES:
listWorker.postMessage({message: 'load'})
listWorker.postMessage({message: 'get-list', model: 'chirpity', listType: 'location', useWeek: true, lat: 52.0, lon: -0.5, week: 40, threshold: 0.01 })
*/

onmessage = async (e) => {
    DEBUG && console.log('got a message', e.data)
    const {message} = e.data;
    let response;
    try {
        switch (message) {

            case "get-list": {
                const {model, listType, useWeek}  = e.data;
                listModel.model = model;
                NOT_BIRDS = model === 'birdnet' ? BIRDNET_NOT_BIRDS : CHIRPITY_NOT_BIRDS;
                listModel.labels = model === 'birdnet' ? BIRDNET_LABELS : CHIRPITY_LABELS;
                let lat = parseFloat(e.data.lat);
                let lon = parseFloat(e.data.lon);
                let week = parseInt(e.data.week);
                let threshold = parseFloat(e.data.threshold);
                let localBirdsOnly = e.data.localBirdsOnly;
                DEBUG && console.log(`Setting list to ${listType}`);
                const includedIDs = await listModel.setList({lat, lon, week, listType, useWeek, threshold, localBirdsOnly});
                postMessage({
                    message: "your-list-sir",
                    result: includedIDs,
                });
                break;
                }
        }
    }
    // If worker was respawned
    catch (error) {
        console.log(error)
    }
};

class Model {
    constructor(appPath) {
        this.model_loaded = false;
        this.appPath = appPath;
        this.labels = undefined;  // labels in the model we're filtering
    }

    async loadModel() {
        if (this.model_loaded === false) {
            // Model files must be in a different folder than the js, assets files
            if (DEBUG) console.log('loading model from', this.appPath);
            this.metadata_model = await tf.loadGraphModel(this.appPath);
            // const mdata_label_path = path.join(__dirname, '..','BirdNET_GLOBAL_6K_V2.4_Model_TFJS','static','model','labels.json')
            this.mdata_labels = BIRDNET_LABELS; //JSON.parse(fs.readFileSync(mdata_label_path, "utf8")); // Labels used in the metadata model
            }
    }

    async setList({lat, lon, week, listType, useWeek, threshold, localBirdsOnly}) {
        let includedIDs = [];
        week = useWeek ? week : -1;
        if (listType === "everything") {
            includedIDs = this.labels.map((_, index) => index);
        }

        else if (listType === 'location'){
            DEBUG && console.log('lat', lat, 'lon', lon, 'week', week)
            this.mdata_input = tf.tensor([lat, lon, week]).expandDims(0);
            const mdata_prediction = this.metadata_model.predict(this.mdata_input);
            const mdata_probs = await mdata_prediction.data();
            let count = 0;
            if (this.model === 'birdnet'){
                for (let i = 0; i < mdata_probs.length; i++) {
                    if (mdata_probs[i] > threshold) {
                        count++;
                        includedIDs.push(i);
                        DEBUG && console.log("including:", this.labels[i] + ': ' + mdata_probs[i]);

                    } else {
                        DEBUG && console.log("Excluding:", this.labels[i] + ': ' + mdata_probs[i]);
                    }
                }
            } else {
                for (let i = 0; i < mdata_probs.length; i++) {
                    const index = i; // mdata_probs.indexOf(mdata_probs_sorted[i]);
                    if (mdata_probs[index] < threshold) {
                        DEBUG && console.log('Excluding:', this.mdata_labels[index] + ': ' + mdata_probs[index]);
                    } else {
                        count++
                        const latin = this.mdata_labels[index].split('_')[0];
                        // Use the reduce() method to accumulate the indices of species containing the latin name
                        const foundIndices = this.labels.reduce((indices, element, index) => {
                            element.includes(latin) && indices.push(index);
                            return indices;
                        }, []);
                        foundIndices.forEach(index => {
                            // If we want an override list...=>
                            //if (! ['Dotterel', 'Stone-curlew', 'Spotted Crake'].some(this.labels[index])) BLOCKED_IDS.push(index)
                            includedIDs.push(index)
                            DEBUG && console.log('Including: ', index, 'name', this.labels[index], 'probability', mdata_probs[i].toFixed(5) )
                        })
                    }
                }
            }
            DEBUG && console.log('Total species considered at this location: ', count)
            // return an object
            includedIDs = {week: week, lat: lat, lon:lon, included: includedIDs}            
        } else if (listType === 'nocturnal') {
            if (this.model === 'chirpity') {
                for (let i = 0; i < this.labels.length; i++) {
                    const item = this.labels[i];
                    if (NOCTURNAL.has(item)) includedIDs.push(i);
                }
            } else {
                // BirdNET nocturnal bird filter
                const additionalIDs = [];
                // Get list of IDs of birds that call through the might or all the time. Exclude non-avian classes
                for (let i = 0; i < this.labels.length; i++) {
                    const item = this.labels[i];
                    if (ACTIVITY_INDEX[item]  !== 1 && BIRDNET_NOT_BIRDS.indexOf(item) < 0) includedIDs.push(i);     
                }
                if (localBirdsOnly){ // placeholder for condition
                    // Now get list of local birds
                    const local_ids = await this.setList({lat,lon,week, listType:'location', useWeek, threshold})
                    // Create a list of indices that appear in both lists
                    includedIDs = includedIDs.filter(id => local_ids.included.includes(id));
                }
            } 
        } else {

            // looking for birds (chirpity) or (birds or migrants) in the case of birdnet
            // Function to extract the first element after splitting on '_'
            const getFirstElement = label => label.split('_')[0];

            // Create a list of included labels' indices
            const t0 = Date.now()
            const notBirdsFirstParts = NOT_BIRDS.map(getFirstElement);
        
            includedIDs = this.labels.map((label, index) => {
                const firstPart = getFirstElement(label);
                return notBirdsFirstParts.includes(firstPart) ? null : index;
            }).filter(index => index !== null);
            DEBUG && console.log('filtering took', Date.now() - t0, 'ms')
        }
        return includedIDs;
    }
}

async function _init_(){
    DEBUG && console.log("load loading metadata_model");
    // const appPath = "../" + location + "/";
    DEBUG && console.log(`List generating model received load instruction.`);
    tf.setBackend('tensorflow').then(async () => {
        tf.enableProdMode();
        if (DEBUG) {
            console.log(tf.env());
            console.log(tf.env().getFlags());
        }
        listModel = new Model('../BirdNET_GLOBAL_6K_V2.4_Model_TFJS/static/model/mdata/model.json');

        await listModel.loadModel();
        postMessage({ message: "list-model-ready"});
    });
}

await _init_();