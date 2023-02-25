const tf = require('@tensorflow/tfjs-node-gpu');
const fs = require('fs');
const {parse} = require("uuid");
const model_config = JSON.parse(fs.readFileSync('model_config.json', 'utf8'));
const {height, width, labels, location} = model_config;
// let location = '2023211_EfficientNetV2B0_wd=1e-05_categorical_crossentropy_small_image_test_224x224_Adam_448';
// let labels = ["Tachymarptis melba_Alpine Swift", "Ambient Noise_Ambient Noise", "Pluvialis dominica_American Golden Plover", "Mareca americana_American Wigeon", "Animal_Animal", "Acrocephalus paludicola_Aquatic Warbler", "Acanthis hornemanni_Arctic Redpoll", "Stercorarius parasiticus_Arctic Skua", "Sterna paradisaea_Arctic Tern", "Phylloscopus borealis_Arctic Warbler", "Recurvirostra avosetta_Avocet", "Porzana pusilla_Baillon's Crake", "Limosa lapponica_Bar-tailed Godwit", "Tyto alba_Barn Owl", "Branta leucopsis_Barnacle Goose", "Sylvia nisoria_Barred Warbler", "Panurus biarmicus_Bearded Tit", "Merops apiaster_Bee-eater", "Cygnus columbianus_Bewick's Swan", "Botaurus stellaris_Bittern", "Oenanthe hispanica_Black-eared Wheatear", "Chroicocephalus ridibundus_Black-headed Gull", "Podiceps nigricollis_Black-necked Grebe", "Limosa limosa_Black-tailed Godwit", "Himantopus himantopus_Black-winged Stilt", "Lyrurus tetrix_Black Grouse", "Cepphus grylle_Black Guillemot", "Milvus migrans_Black Kite", "Phoenicurus ochruros_Black Redstart", "Chlidonias niger_Black Tern", "Turdus merula_Blackbird", "Sylvia atricapilla_Blackcap", "Spatula discors_Blue-winged Teal", "Cyanistes caeruleus_Blue Tit", "Luscinia svecica_Bluethroat", "Acrocephalus dumetorum_Blyth's Reed Warbler", "Fringilla montifringilla_Brambling", "Branta bernicla_Brent Goose", "Pyrrhula pyrrhula_Bullfinch", "Buteo buteo_Buzzard", "Branta canadensis_Canada Goose", "Tetrao urogallus_Capercaillie", "Larus cachinnans_Caspian Gull", "Bubulcus ibis_Cattle Egret", "Cettia cetti_Cetti's Warbler", "Fringilla coelebs_Chaffinch", "Phylloscopus collybita_Chiffchaff", "Pyrrhocorax pyrrhocorax_Chough", "Emberiza cirlus_Cirl Bunting", "Motacilla citreola_Citrine Wagtail", "Periparus ater_Coal Tit", "Streptopelia decaocto_Collared Dove", "Glareola pratincola_Collared Pratincole", "Loxia curvirostra_Common Crossbill", "Larus canus_Common Gull", "Acanthis flammea_Common Redpoll", "Carpodacus erythrinus_Common Rosefinch", "Actitis hypoleucos_Common Sandpiper", "Melanitta nigra_Common Scoter", "Sterna hirundo_Common Tern", "Fulica atra_Coot", "Phalacrocorax carbo_Cormorant", "Emberiza calandra_Corn Bunting", "Crex crex_Corncrake", "Calonectris borealis_Cory's Shearwater", "Grus grus_Crane", "Lophophanes cristatus_Crested Tit", "Cuculus canorus_Cuckoo", "Calidris ferruginea_Curlew Sandpiper", "Numenius arquata_Curlew", "Sylvia undata_Dartford Warbler", "Cinclus cinclus_Dipper", "Charadrius morinellus_Dotterel", "Calidris alpina_Dunlin", "Prunella modularis_Dunnock", "Phylloscopus fuscatus_Dusky Warbler", "Alopochen aegyptiaca_Egyptian Goose", "Somateria mollissima_Eider", "Bubo bubo_Eurasian Eagle-Owl", "Turdus pilaris_Fieldfare", "Regulus ignicapilla_Firecrest", "Fulmarus glacialis_Fulmar", "Mareca strepera_Gadwall", "Morus bassanus_Gannet", "Sylvia borin_Garden Warbler", "Spatula querquedula_Garganey", "Larus hyperboreus_Glaucous Gull", "Plegadis falcinellus_Glossy Ibis", "Regulus regulus_Goldcrest", "Aquila chrysaetos_Golden Eagle", "Oriolus oriolus_Golden Oriole", "Pluvialis apricaria_Golden Plover", "Bucephala clangula_Goldeneye", "Carduelis carduelis_Goldfinch", "Mergus merganser_Goosander", "Accipiter gentilis_Goshawk", "Locustella naevia_Grasshopper Warbler", "Larus marinus_Great Black-backed Gull", "Podiceps cristatus_Great Crested Grebe", "Lanius excubitor_Great Grey Shrike", "Gavia immer_Great Northern Diver", "Stercorarius skua_Great Skua", "Dendrocopos major_Great Spotted Woodpecker", "Parus major_Great Tit", "Ardea alba_Great White Egret", "Anas carolinensis_Green-winged Teal", "Tringa ochropus_Green Sandpiper", "Picus viridis_Green Woodpecker", "Chloris chloris_Greenfinch", "Phylloscopus trochiloides_Greenish Warbler", "Tringa nebularia_Greenshank", "Ardea cinerea_Grey Heron", "Perdix perdix_Grey Partridge", "Phalaropus fulicarius_Grey Phalarope", "Pluvialis squatarola_Grey Plover", "Motacilla cinerea_Grey Wagtail", "Anser anser_Greylag Goose", "Uria aalge_Guillemot", "Gelochelidon nilotica_Gull-billed Tern", "Coccothraustes coccothraustes_Hawfinch", "Larus argentatus_Herring Gull", "Falco subbuteo_Hobby", "Corvus corone_Hooded or Carrion Crow", "Pernis apivorus_Honey-buzzard", "Upupa epops_Hoopoe", "Delichon urbicum_House Martin", "Passer domesticus_House Sparrow", "Human_Human", "Phylloscopus ibericus_Iberian Chiffchaff", "Hippolais icterina_Icterine Warbler", "Lymnocryptes minimus_Jack Snipe", "Coloeus monedula_Jackdaw", "Garrulus glandarius_Jay", "Charadrius alexandrinus_Kentish Plover", "Falco tinnunculus_Kestrel", "Alcedo atthis_Kingfisher", "Rissa tridactyla_Kittiwake", "Calidris canutus_Knot", "Calcarius lapponicus_Lapland Bunting", "Vanellus vanellus_Lapwing", "Larus fuscus_Lesser Black-backed Gull", "Acanthis cabaret_Lesser Redpoll", "Dryobates minor_Lesser Spotted Woodpecker", "Sylvia curruca_Lesser Whitethroat", "Linaria cannabina_Linnet", "Ixobrychus minutus_Little Bittern", "Emberiza pusilla_Little Bunting", "Egretta garzetta_Little Egret", "Tachybaptus ruficollis_Little Grebe", "Hydrocoloeus minutus_Little Gull", "Athene noctua_Little Owl", "Charadrius dubius_Little Ringed Plover", "Calidris minuta_Little Stint", "Sternula albifrons_Little Tern", "Asio otus_Long-eared Owl", "Clangula hyemalis_Long-tailed Duck", "Stercorarius longicaudus_Long-tailed Skua", "Aegithalos caudatus_Long-tailed Tit", "Pica pica_Magpie", "Anas platyrhynchos_Mallard", "Aix galericulata_Mandarin Duck", "Puffinus puffinus_Manx Shearwater", "Circus aeruginosus_Marsh Harrier", "Poecile palustris_Marsh Tit", "Anthus pratensis_Meadow Pipit", "Ichthyaetus melanocephalus_Mediterranean Gull", "Hippolais polyglotta_Melodious Warbler", "Falco columbarius_Merlin", "Turdus viscivorus_Mistle Thrush", "Circus pygargus_Montagu's Harrier", "Gallinula chloropus_Moorhen", "Cygnus olor_Mute Swan", "Nycticorax nycticorax_Night Heron", "Luscinia megarhynchos_Nightingale", "Caprimulgus europaeus_Nightjar", "Sitta europaea_Nuthatch", "Anthus hodgsoni_Olive-backed Pipit", "Emberiza hortulana_Ortolan Bunting", "Pandion haliaetus_Osprey", "Haematopus ostralegus_Oystercatcher", "Syrrhaptes paradoxus_Pallas's Sandgrouse", "Phylloscopus proregulus_Pallas's Warbler", "Loxia pytyopsittacus_Parrot Crossbill", "Calidris melanotos_Pectoral Sandpiper", "Remiz pendulinus_Penduline Tit", "Falco peregrinus_Peregrine", "Phasianus colchicus_Pheasant", "Ficedula hypoleuca_Pied Flycatcher", "Motacilla alba_Pied Wagtail", "Anser brachyrhynchus_Pink-footed Goose", "Anas acuta_Pintail", "Aythya ferina_Pochard", "Lagopus muta_Ptarmigan", "Ardea purpurea_Purple Heron", "Calidris maritima_Purple Sandpiper", "Coturnix coturnix_Quail", "Phylloscopus schwarzi_Radde's Warbler", "Corvus corax_Raven", "Alca torda_Razorbill", "Lanius collurio_Red-backed Shrike", "Ficedula parva_Red-breasted Flycatcher", "Mergus serrator_Red-breasted Merganser", "Netta rufina_Red-crested Pochard", "Tarsiger cyanurus_Red-flanked Bluetail", "Alectoris rufa_Red-legged Partridge", "Podiceps grisegena_Red-necked Grebe", "Caprimulgus ruficollis_Red-necked Nightjar", "Phalaropus lobatus_Red-necked Phalarope", "Cecropis daurica_Red-rumped Swallow", "Gavia stellata_Red-throated Diver", "Lagopus lagopus_Red Grouse", "Milvus milvus_Red Kite", "Tringa totanus_Redshank", "Phoenicurus phoenicurus_Redstart", "Turdus iliacus_Redwing", "Emberiza schoeniclus_Reed Bunting", "Acrocephalus scirpaceus_Reed Warbler", "Anthus richardi_Richard's Pipit", "Larus delawarensis_Ring-billed Gull", "Psittacula krameri_Ring-necked Parakeet", "Turdus torquatus_Ring Ouzel", "Charadrius hiaticula_Ringed Plover", "Erithacus rubecula_Robin", "Columba livia_Rock Dove", "Anthus petrosus_Rock Pipit", "Corvus frugilegus_Rook", "Pastor roseus_Rose-coloured Starling", "Sterna dougallii_Roseate Tern", "Buteo lagopus_Rough-legged Buzzard", "Oxyura jamaicensis_Ruddy Duck", "Tadorna ferruginea_Ruddy Shelduck", "Calidris pugnax_Ruff", "Xema sabini_Sabine's Gull", "Riparia riparia_Sand Martin", "Calidris alba_Sanderling", "Thalasseus sandvicensis_Sandwich Tern", "Locustella luscinioides_Savi's Warbler", "Aythya marila_Scaup", "Loxia scotica_Scottish Crossbill", "Acrocephalus schoenobaenus_Sedge Warbler", "Calidris pusilla_Semipalmated Sandpiper", "Serinus serinus_Serin", "Tadorna tadorna_Shelduck", "Eremophila alpestris_Shore Lark", "Asio flammeus_Short-eared Owl", "Calandrella brachydactyla_Short-toed Lark", "Spatula clypeata_Shoveler", "Spinus spinus_Siskin", "Alauda arvensis_Skylark", "Podiceps auritus_Slavonian Grebe", "Gallinago gallinago_Snipe", "Plectrophenax nivalis_Snow Bunting", "Anser caerulescens_Snow Goose", "Turdus philomelos_Song Thrush", "Accipiter nisus_Sparrowhawk", "Platalea leucorodia_Spoonbill", "Porzana porzana_Spotted Crake", "Muscicapa striata_Spotted Flycatcher", "Tringa erythropus_Spotted Redshank", "Actitis macularius_Spotted Sandpiper", "Sturnus vulgaris_Starling", "Columba oenas_Stock Dove", "Burhinus oedicnemus_Stone-curlew", "Saxicola rubicola_Stonechat", "Hydrobates pelagicus_Storm Petrel", "Sylvia cantillans_Subalpine Warbler", "Hirundo rustica_Swallow", "Apus apus_Swift", "Anser fabalis_Taiga Bean Goose", "Strix aluco_Tawny Owl", "Anas crecca_Teal", "Calidris temminckii_Temminck's Stint", "Anthus trivialis_Tree Pipit", "Passer montanus_Tree Sparrow", "Certhia familiaris_Treecreeper", "Aythya fuligula_Tufted Duck", "Anser serrirostris_Tundra Bean Goose", "Arenaria interpres_Turnstone", "Streptopelia turtur_Turtle Dove", "Linaria flavirostris_Twite", "Loxia leucoptera_Two-barred Crossbill", "Vehicle_Vehicle", "Anthus spinoletta_Water Pipit", "Rallus aquaticus_Water Rail", "Bombycilla garrulus_Waxwing", "Oenanthe oenanthe_Wheatear", "Numenius phaeopus_Whimbrel", "Saxicola rubetra_Whinchat", "Anser albifrons_White-fronted Goose", "Calidris fuscicollis_White-rumped Sandpiper", "Haliaeetus albicilla_White-tailed Eagle", "Chlidonias leucopterus_White-winged Black Tern", "Ciconia ciconia_White Stork", "Sylvia communis_Whitethroat", "Cygnus cygnus_Whooper Swan", "Mareca penelope_Wigeon", "Poecile montanus_Willow Tit", "Phylloscopus trochilus_Willow Warbler", "Tringa glareola_Wood Sandpiper", "Phylloscopus sibilatrix_Wood Warbler", "Scolopax rusticola_Woodcock", "Lullula arborea_Woodlark", "Columba palumbus_Woodpigeon", "Troglodytes troglodytes_Wren", "Jynx torquilla_Wryneck", "Phylloscopus inornatus_Yellow-browed Warbler", "Larus michahellis_Yellow-legged Gull", "Motacilla flava_Yellow Wagtail", "Emberiza citrinella_Yellowhammer"];
// let height = 256
// let width = 384
let DEBUG = true;
tf.ENV.set('WEBGL_FORCE_F16_TEXTURES', true)
tf.enableProdMode();
if (DEBUG) {
    console.log(tf.env().features);
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
let ready = false;
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
        this.frame_length = 256;
        this.frame_step = 186;
        this.result = [];
        this.appPath = appPath;
        this.list = list;
        this.pendingBatch = null;
        this.pendingKeys = null;
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
        console.log('WarmUp begin', tf.memory().numTensors)
        this.batchSize = parseInt(batchSize);
        this.inputShape[0] = this.batchSize;
        const result = tf.tidy(() => {
            const warmupResult = this.model.predict(tf.zeros(this.inputShape));
            const {indices, values} = warmupResult.topk(3);
            warmupResult.dispose()
            indices.arraySync();
            const silence = values.arraySync();
            this.silence = silence[0].toString()
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

    _normalize(spec) {
        const spec_max = tf.max(spec, [1, 2]);
        spec = spec.mul(255);
        spec = spec.div(tf.reshape(spec_max, [-1, 1, 1]));
        return spec;
    }

    getSNR(spectrograms, threshold) {
        const max = tf.max(spectrograms, 2);
        const mean = tf.mean(spectrograms, 2);
        const ratio = tf.divNoNan(max, mean);
        const snr = tf.squeeze(tf.max(ratio, 1));
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
        // Fix specBatch shape
        specBatch = tf.tidy(() => {
            return this._normalize(specBatch);
        })
        // Add channel axis
        specBatch = tf.expandDims(specBatch, -1);
        return tf.image.resizeBilinear(specBatch, [img_height, img_width]);
    }

    buildBatch(batch, keys) {
        if (batch.shape[0] < this.batchSize) {
            if (this.pendingBatch && this.pendingBatch.shape[0] > 0) {
                this.pendingBatch = tf.concat4d([this.pendingBatch, batch], 0);
                this.pendingKeys = tf.concat4d([this.pendingKeys, keys], 0)
            } else {
                this.pendingBatch = batch;
                this.pendingKeys = keys;
            }
            return [this.pendingBatch, this.pendingKeys];
        } else {
            const readyBatch = batch.slice([0, 0, 0, 0], [this.batchSize, batch.shape[1], batch.shape[2], batch.shape[3]]);
            this.pendingBatch = batch.slice([this.batchSize, 0, 0, 0]);
            const readyKeys = keys.slice([0], [this.batchSize]);
            this.pendingKeys = keys.slice([this.batchSize]);
            return [readyBatch, readyKeys]
        }
    }

    async predictBatch(goodTensors, file, fileStart, threshold) {
        console.log('predictBatch begin', tf.memory().numTensors)
        let batched_results = [];
        let result;
        let audacity;
        let rawTensorBatch = tf.stack(Object.values(goodTensors))
        console.log('created rawTensorbatch +1' , tf.memory().numTensors)
        let TensorBatch = tf.tidy(() => {
            return this.fixUpSpecBatch(rawTensorBatch)
        })
        rawTensorBatch.dispose();
        console.log('rawTensorBatch (-)  Tensorbatch (+), expect same', tf.memory().numTensors)
        let intKeys = Object.keys(goodTensors).map((str) => {
            return parseInt(str)
        });
        let keysTensor, maskedKeysTensor, maskedTensorBatch;
        if (threshold) {
            keysTensor = tf.stack(intKeys);
            console.log('KeysTensor expect +1', tf.memory().numTensors)

            const SNR = tf.tidy(() => {
                return this.getSNR(TensorBatch)
            })
            let condition = tf.greater(SNR, threshold);
            // Avoid mask cannot be scalar error at end of predictions
            if (condition.rankType === "0") {
                condition = tf.expandDims(condition)
            }
            maskedTensorBatch = await tf.booleanMaskAsync(TensorBatch, condition);
            TensorBatch.dispose();
            maskedKeysTensor = await tf.booleanMaskAsync(keysTensor, condition)
            keysTensor.dispose();
            SNR.dispose();
            condition.dispose();
            console.log('after - SNR, condition disposed - expect + 2', tf.memory().numTensors)
            if (!maskedTensorBatch.size) {
                maskedTensorBatch.dispose();
                maskedKeysTensor.dispose();
                console.log('killed 2 masked tensors, expect -2', tf.memory().numTensors)
                return false
            } else {
                console.log("surviving tensors in batch", maskedTensorBatch.shape[0])
            }
        }
        let t0 = performance.now();
        // Build up a batch
        // [TensorBatch, keysTensor] = this.buildBatch(TensorBatch, keysTensor);
        // if (TensorBatch.shape[0] < this.batchSize) return false;
        console.log('Into loop expect, same', tf.memory().numTensors)
        let [keys, top3, top3scores] = tf.tidy(() => {
            let prediction;
            if (maskedTensorBatch) {
                prediction = this.model.predict(maskedTensorBatch, {batchSize: this.batchSize})
                maskedTensorBatch.dispose()
            } else {
                prediction = this.model.predict(TensorBatch, {batchSize: this.batchSize})
                TensorBatch.dispose()
            }
            TensorBatch.dispose();
            console.log(`model predict took ${performance.now() - t0} milliseconds`);
            const {indices, values} = prediction.topk(3);
            console.log('Inside tidy expect +3', tf.memory().numTensors)
            let keys = intKeys;
            if (maskedKeysTensor) {
                keys = maskedKeysTensor.arraySync()
                maskedKeysTensor.dispose();
                console.log('killed  masked key tensor, expect -1', tf.memory().numTensors)
            }

            const top3 = indices.arraySync();
            const top3scores = values.arraySync();
            return [keys, top3, top3scores];
        })
        console.log('Outside tidy expect -3', tf.memory().numTensors)
        const batch = {};
        for (let i = 0; i < keys.length; i++) {
            batch[keys[i]] = ({index: top3[i], score: top3scores[i], end: parseInt(keys[i]) + this.chunkLength});
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
        this.result = this.result.concat(batched_results);
        this.clearTensorArray(goodTensors);
        return true
    }

    async predictChunk(chunks, fileStart, file, finalchunk, threshold) {
        let readyToSend = false;
        let goodTensors = {}
        for (const [key, value] of Object.entries(chunks)) {
            let chunk = tf.tensor1d(value);
            // if the chunk is too short, pad with zeroes.
            // Min length is 0.5s, set in UI.js - a wavesurfer region option
            if (chunk.shape[0] < this.chunkLength) {
                let padding = tf.zeros([this.chunkLength - chunk.shape[0]]);
                chunk = chunk.concat(padding);
                padding.dispose()
            }
            const spectrogram = this.makeSpectrogram(chunk);
            chunk.dispose();
            goodTensors[key] = spectrogram;
            //Loop will continue
            if (Object.keys(goodTensors).length === this.batchSize) {
                // There's a new batch of predictions to make
                readyToSend = await this.predictBatch(goodTensors, file, fileStart, threshold)
                this.clearTensorArray(goodTensors)
                goodTensors = {}
            }
        }
        if (finalchunk) {
            // Top up results with any final tensor predictions
            if (Object.keys(goodTensors).length) {
                await this.predictBatch(goodTensors, file, fileStart, threshold)
                this.clearTensorArray(goodTensors)
            }
            return true
        } else {
            return readyToSend
        }
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
        myModel.frame_length = 256
        const readyToSend = await myModel.predictChunk(chunks, fileStart, file, finalChunk, SNRThreshold);
        if (readyToSend) {
            const response = {
                message: 'prediction',
                file: file,
                result: myModel.result,
                finished: finalChunk,
                fileStart: fileStart,
                predictionsReceived: e.data.predictionsRequested
            }
            postMessage(response);
            // reset the results
            myModel.result = [];
            //let t1 = performance.now();
            //console.log(`receive to post took: ${t1 - t0} milliseconds`)
        }
    } else if (modelRequest === 'get-spectrogram') {
        myModel.frame_length = 256;
        const buffer = e.data.buffer;
        // Only consider full specs
        if (buffer.length < 72000) return
        const file = e.data.file;
        const filepath = e.data.filepath;
        const height = e.data.height;
        const width = e.data.width
        let image;
        tf.tidy(() => {
            const bufferTensor = tf.tensor1d(buffer);
            image = myModel.makeSpectrogram(bufferTensor);
            image = myModel.fixUpSpecBatch(tf.expandDims(image, 0), height, width).dataSync();
        })

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
