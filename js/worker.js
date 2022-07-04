const {ipcRenderer} = require('electron');
let appPath = '../24000_v9/';
const fs = require('fs');
const wavefileReader = require('wavefile-reader');
const lamejs = require("lamejstmp");
const ID3Writer = require('browser-id3-writer');
const p = require('path');
let BATCH_SIZE = 12;
console.log(appPath);
const labels = ["Tachymarptis melba_Alpine Swift", "Ambient Noise_Ambient Noise", "Pluvialis dominica_American Golden Plover", "Mareca americana_American Wigeon", "Animal_Animal", "Acrocephalus paludicola_Aquatic Warbler", "Acanthis hornemanni_Arctic Redpoll", "Stercorarius parasiticus_Arctic Skua", "Sterna paradisaea_Arctic Tern", "Phylloscopus borealis_Arctic Warbler", "Recurvirostra avosetta_Avocet", "Porzana pusilla_Baillon's Crake", "Limosa lapponica_Bar-tailed Godwit", "Tyto alba_Barn Owl", "Branta leucopsis_Barnacle Goose", "Sylvia nisoria_Barred Warbler", "Panurus biarmicus_Bearded Tit", "Merops apiaster_Bee-eater", "Cygnus columbianus_Bewick's Swan", "Botaurus stellaris_Bittern", "Oenanthe hispanica_Black-eared Wheatear", "Chroicocephalus ridibundus_Black-headed Gull", "Podiceps nigricollis_Black-necked Grebe", "Limosa limosa_Black-tailed Godwit", "Himantopus himantopus_Black-winged Stilt", "Lyrurus tetrix_Black Grouse", "Cepphus grylle_Black Guillemot", "Milvus migrans_Black Kite", "Phoenicurus ochruros_Black Redstart", "Chlidonias niger_Black Tern", "Turdus merula_Blackbird", "Sylvia atricapilla_Blackcap", "Spatula discors_Blue-winged Teal", "Cyanistes caeruleus_Blue Tit", "Luscinia svecica_Bluethroat", "Acrocephalus dumetorum_Blyth's Reed Warbler", "Fringilla montifringilla_Brambling", "Branta bernicla_Brent Goose", "Pyrrhula pyrrhula_Bullfinch", "Buteo buteo_Buzzard", "Branta canadensis_Canada Goose", "Tetrao urogallus_Capercaillie", "Corvus corone_Carrion/Hooded Crow", "Larus cachinnans_Caspian Gull", "Bubulcus ibis_Cattle Egret", "Cettia cetti_Cetti's Warbler", "Fringilla coelebs_Chaffinch", "Phylloscopus collybita_Chiffchaff", "Pyrrhocorax pyrrhocorax_Chough", "Emberiza cirlus_Cirl Bunting", "Motacilla citreola_Citrine Wagtail", "Periparus ater_Coal Tit", "Streptopelia decaocto_Collared Dove", "Glareola pratincola_Collared Pratincole", "Loxia curvirostra_Common Crossbill", "Larus canus_Common Gull", "Acanthis flammea_Common Redpoll", "Carpodacus erythrinus_Common Rosefinch", "Actitis hypoleucos_Common Sandpiper", "Melanitta nigra_Common Scoter", "Sterna hirundo_Common Tern", "Fulica atra_Coot", "Phalacrocorax carbo_Cormorant", "Emberiza calandra_Corn Bunting", "Crex crex_Corncrake", "Calonectris borealis_Cory's Shearwater", "Grus grus_Crane", "Lophophanes cristatus_Crested Tit", "Cuculus canorus_Cuckoo", "Calidris ferruginea_Curlew Sandpiper", "Numenius arquata_Curlew", "Sylvia undata_Dartford Warbler", "Cinclus cinclus_Dipper", "Charadrius morinellus_Dotterel", "Calidris alpina_Dunlin", "Prunella modularis_Dunnock", "Phylloscopus fuscatus_Dusky Warbler", "Alopochen aegyptiaca_Egyptian Goose", "Somateria mollissima_Eider", "Bubo bubo_Eurasian Eagle-Owl", "Turdus pilaris_Fieldfare", "Regulus ignicapilla_Firecrest", "Fulmarus glacialis_Fulmar", "Mareca strepera_Gadwall", "Morus bassanus_Gannet", "Sylvia borin_Garden Warbler", "Spatula querquedula_Garganey", "Larus hyperboreus_Glaucous Gull", "Plegadis falcinellus_Glossy Ibis", "Regulus regulus_Goldcrest", "Aquila chrysaetos_Golden Eagle", "Oriolus oriolus_Golden Oriole", "Pluvialis apricaria_Golden Plover", "Bucephala clangula_Goldeneye", "Carduelis carduelis_Goldfinch", "Mergus merganser_Goosander", "Accipiter gentilis_Goshawk", "Locustella naevia_Grasshopper Warbler", "Larus marinus_Great Black-backed Gull", "Podiceps cristatus_Great Crested Grebe", "Lanius excubitor_Great Grey Shrike", "Gavia immer_Great Northern Diver", "Stercorarius skua_Great Skua", "Dendrocopos major_Great Spotted Woodpecker", "Parus major_Great Tit", "Ardea alba_Great White Egret", "Anas carolinensis_Green-winged Teal", "Tringa ochropus_Green Sandpiper", "Picus viridis_Green Woodpecker", "Chloris chloris_Greenfinch", "Phylloscopus trochiloides_Greenish Warbler", "Tringa nebularia_Greenshank", "Ardea cinerea_Grey Heron", "Perdix perdix_Grey Partridge", "Phalaropus fulicarius_Grey Phalarope", "Pluvialis squatarola_Grey Plover", "Motacilla cinerea_Grey Wagtail", "Anser anser_Greylag Goose", "Uria aalge_Guillemot", "Gelochelidon nilotica_Gull-billed Tern", "Coccothraustes coccothraustes_Hawfinch", "Larus argentatus_Herring Gull", "Falco subbuteo_Hobby", "Pernis apivorus_Honey-buzzard", "Upupa epops_Hoopoe", "Delichon urbicum_House Martin", "Passer domesticus_House Sparrow", "Human_Human", "Phylloscopus ibericus_Iberian Chiffchaff", "Hippolais icterina_Icterine Warbler", "Lymnocryptes minimus_Jack Snipe", "Coloeus monedula_Jackdaw", "Garrulus glandarius_Jay", "Charadrius alexandrinus_Kentish Plover", "Falco tinnunculus_Kestrel", "Alcedo atthis_Kingfisher", "Rissa tridactyla_Kittiwake", "Calidris canutus_Knot", "Calcarius lapponicus_Lapland Bunting", "Vanellus vanellus_Lapwing", "Larus fuscus_Lesser Black-backed Gull", "Acanthis cabaret_Lesser Redpoll", "Dryobates minor_Lesser Spotted Woodpecker", "Sylvia curruca_Lesser Whitethroat", "Linaria cannabina_Linnet", "Ixobrychus minutus_Little Bittern", "Emberiza pusilla_Little Bunting", "Egretta garzetta_Little Egret", "Tachybaptus ruficollis_Little Grebe", "Hydrocoloeus minutus_Little Gull", "Athene noctua_Little Owl", "Charadrius dubius_Little Ringed Plover", "Calidris minuta_Little Stint", "Sternula albifrons_Little Tern", "Asio otus_Long-eared Owl", "Clangula hyemalis_Long-tailed Duck", "Stercorarius longicaudus_Long-tailed Skua", "Aegithalos caudatus_Long-tailed Tit", "Pica pica_Magpie", "Anas platyrhynchos_Mallard", "Aix galericulata_Mandarin Duck", "Puffinus puffinus_Manx Shearwater", "Circus aeruginosus_Marsh Harrier", "Poecile palustris_Marsh Tit", "Anthus pratensis_Meadow Pipit", "Ichthyaetus melanocephalus_Mediterranean Gull", "Hippolais polyglotta_Melodious Warbler", "Falco columbarius_Merlin", "Turdus viscivorus_Mistle Thrush", "Circus pygargus_Montagu's Harrier", "Gallinula chloropus_Moorhen", "Cygnus olor_Mute Swan", "Nycticorax nycticorax_Night Heron", "Luscinia megarhynchos_Nightingale", "Caprimulgus europaeus_Nightjar", "Sitta europaea_Nuthatch", "Anthus hodgsoni_Olive-backed Pipit", "Emberiza hortulana_Ortolan Bunting", "Pandion haliaetus_Osprey", "Haematopus ostralegus_Oystercatcher", "Syrrhaptes paradoxus_Pallas's Sandgrouse", "Phylloscopus proregulus_Pallas's Warbler", "Loxia pytyopsittacus_Parrot Crossbill", "Calidris melanotos_Pectoral Sandpiper", "Remiz pendulinus_Penduline Tit", "Falco peregrinus_Peregrine", "Phasianus colchicus_Pheasant", "Ficedula hypoleuca_Pied Flycatcher", "Motacilla alba_Pied Wagtail", "Anser brachyrhynchus_Pink-footed Goose", "Anas acuta_Pintail", "Aythya ferina_Pochard", "Lagopus muta_Ptarmigan", "Ardea purpurea_Purple Heron", "Calidris maritima_Purple Sandpiper", "Coturnix coturnix_Quail", "Phylloscopus schwarzi_Radde's Warbler", "Corvus corax_Raven", "Alca torda_Razorbill", "Lanius collurio_Red-backed Shrike", "Ficedula parva_Red-breasted Flycatcher", "Mergus serrator_Red-breasted Merganser", "Netta rufina_Red-crested Pochard", "Tarsiger cyanurus_Red-flanked Bluetail", "Alectoris rufa_Red-legged Partridge", "Podiceps grisegena_Red-necked Grebe", "Caprimulgus ruficollis_Red-necked Nightjar", "Phalaropus lobatus_Red-necked Phalarope", "Cecropis daurica_Red-rumped Swallow", "Gavia stellata_Red-throated Diver", "Lagopus lagopus_Red Grouse", "Milvus milvus_Red Kite", "Tringa totanus_Redshank", "Phoenicurus phoenicurus_Redstart", "Turdus iliacus_Redwing", "Emberiza schoeniclus_Reed Bunting", "Acrocephalus scirpaceus_Reed Warbler", "Anthus richardi_Richard's Pipit", "Larus delawarensis_Ring-billed Gull", "Psittacula krameri_Ring-necked Parakeet", "Turdus torquatus_Ring Ouzel", "Charadrius hiaticula_Ringed Plover", "Erithacus rubecula_Robin", "Columba livia_Rock Dove", "Anthus petrosus_Rock Pipit", "Corvus frugilegus_Rook", "Pastor roseus_Rose-coloured Starling", "Sterna dougallii_Roseate Tern", "Buteo lagopus_Rough-legged Buzzard", "Oxyura jamaicensis_Ruddy Duck", "Tadorna ferruginea_Ruddy Shelduck", "Calidris pugnax_Ruff", "Xema sabini_Sabine's Gull", "Riparia riparia_Sand Martin", "Calidris alba_Sanderling", "Thalasseus sandvicensis_Sandwich Tern", "Locustella luscinioides_Savi's Warbler", "Aythya marila_Scaup", "Loxia scotica_Scottish Crossbill", "Acrocephalus schoenobaenus_Sedge Warbler", "Calidris pusilla_Semipalmated Sandpiper", "Serinus serinus_Serin", "Tadorna tadorna_Shelduck", "Eremophila alpestris_Shore Lark", "Asio flammeus_Short-eared Owl", "Calandrella brachydactyla_Short-toed Lark", "Spatula clypeata_Shoveler", "Spinus spinus_Siskin", "Alauda arvensis_Skylark", "Podiceps auritus_Slavonian Grebe", "Gallinago gallinago_Snipe", "Plectrophenax nivalis_Snow Bunting", "Anser caerulescens_Snow Goose", "Turdus philomelos_Song Thrush", "Accipiter nisus_Sparrowhawk", "Platalea leucorodia_Spoonbill", "Porzana porzana_Spotted Crake", "Muscicapa striata_Spotted Flycatcher", "Tringa erythropus_Spotted Redshank", "Actitis macularius_Spotted Sandpiper", "Sturnus vulgaris_Starling", "Columba oenas_Stock Dove", "Burhinus oedicnemus_Stone-curlew", "Saxicola rubicola_Stonechat", "Hydrobates pelagicus_Storm Petrel", "Sylvia cantillans_Subalpine Warbler", "Hirundo rustica_Swallow", "Apus apus_Swift", "Anser fabalis_Taiga Bean Goose", "Strix aluco_Tawny Owl", "Anas crecca_Teal", "Calidris temminckii_Temminck's Stint", "Anthus trivialis_Tree Pipit", "Passer montanus_Tree Sparrow", "Certhia familiaris_Treecreeper", "Aythya fuligula_Tufted Duck", "Anser serrirostris_Tundra Bean Goose", "Arenaria interpres_Turnstone", "Streptopelia turtur_Turtle Dove", "Linaria flavirostris_Twite", "Loxia leucoptera_Two-barred Crossbill", "Vehicle_Vehicle", "Anthus spinoletta_Water Pipit", "Rallus aquaticus_Water Rail", "Bombycilla garrulus_Waxwing", "Oenanthe oenanthe_Wheatear", "Numenius phaeopus_Whimbrel", "Saxicola rubetra_Whinchat", "Anser albifrons_White-fronted Goose", "Calidris fuscicollis_White-rumped Sandpiper", "Haliaeetus albicilla_White-tailed Eagle", "Chlidonias leucopterus_White-winged Black Tern", "Ciconia ciconia_White Stork", "Sylvia communis_Whitethroat", "Cygnus cygnus_Whooper Swan", "Mareca penelope_Wigeon", "Poecile montanus_Willow Tit", "Phylloscopus trochilus_Willow Warbler", "Tringa glareola_Wood Sandpiper", "Phylloscopus sibilatrix_Wood Warbler", "Scolopax rusticola_Woodcock", "Lullula arborea_Woodlark", "Columba palumbus_Woodpigeon", "Troglodytes troglodytes_Wren", "Jynx torquilla_Wryneck", "Phylloscopus inornatus_Yellow-browed Warbler", "Larus michahellis_Yellow-legged Gull", "Motacilla flava_Yellow Wagtail", "Emberiza citrinella_Yellowhammer"];
const sqlite3 = require('sqlite3').verbose();
const SunCalc = require('suncalc2');
const ffmpeg = require('fluent-ffmpeg');
const {utimes} = require('utimes');
const file_cache = 'file_cache';

let db, nocmig, latitude, longitude;

let proxiedFileCache = {};

function createDB(file) {
    console.log("creating database file");
    fs.openSync(file, "w");
    db = new sqlite3.Database(file);
    db.serialize(() => {
        db.run(`CREATE TABLE species
                (
                    id    INTEGER PRIMARY KEY,
                    sname TEXT,
                    cname TEXT
                )`, function (createResult) {
            if (createResult) throw createResult;
        });
        db.run(`CREATE TABLE files
                (
                    name     TEXT,
                    duration REAL,
                    filestart INTEGER,
                    UNIQUE (name)
                )`, function (createResult) {
            if (createResult) throw createResult;
        });
        db.run(`CREATE TABLE duration
                (
                    day      INTEGER,
                    duration INTEGER,
                    fileID   INTEGER,
                    UNIQUE (day, fileID)
                )`, function (createResult) {
            if (createResult) throw createResult;
        });
        const stmt = db.prepare("INSERT INTO species VALUES (?, ?, ?)");
        for (let i = 0; i < labels.length; i++) {
            const [sname, cname] = labels[i].split('_')
            stmt.run(i, sname, cname);
        }
        stmt.finalize();
        db.run(`CREATE TABLE records
                (
                    dateTime INTEGER PRIMARY KEY,
                    birdID1  INTEGER,
                    birdID2  INTEGER,
                    birdID3  INTEGER,
                    conf1    REAL,
                    conf2    REAL,
                    conf3    REAL,
                    fileID   INTEGER,
                    position INTEGER,
                    comment  TEXT
                )`, function (createResult) {
            if (createResult) throw createResult;
        });
    });
    console.log("database initialized");
    return db;
}

function loadDB(path) {
    const file = p.join(path, 'archive.sqlite');
    if (!fs.existsSync(file)) {
        db = createDB(file)

    } else {
        db = new sqlite3.Database(file);
    }
    db.on("error", function (error) {
        console.log("Getting an error : ", error);
    });
}

let metadata = {};
let chunkStart, chunkLength, minConfidence, index = 0, AUDACITY = [], RESULTS = [], predictionStart;
let sampleRate = 24000;  // Value obtained from model.js CONFIG, however, need default here to permit file loading before model.js response
let predictWorker, predicting = false, predictionDone = false, aborted = false;
let useWhitelist = true;
// We might get multiple clients, for instance if there are multiple windows,
// or if the main window reloads.
const isDevMode = true;

// Set up the audio context:
const audioCtx = new AudioContext({latencyHint: 'interactive', sampleRate: sampleRate});

let UI;
let FILE_QUEUE = [];

const clearCache = () => {
    return new Promise((resolve) => {
        // clear & recreate file cache folder
        proxiedFileCache = {}
        fs.rmSync(file_cache, {recursive: true, force: true});
        fs.mkdir(file_cache, (err, path) => {
            resolve(path);
        })
    })
}

const isDuplicate = (file) => {
    return new Promise((resolve) => {
        const stmt = db.prepare("SELECT * FROM files WHERE name = (?)");
        stmt.get(file, (err, row) => {
            if (row) {
                resolve(true)
            } else resolve(false)
        })
    })
}

ipcRenderer.on('new-client', (event) => {
    [UI] = event.ports;
    UI.onmessage = async (e) => {
        const args = e.data;
        const action = args.action;
        console.log('message received ', action)
        switch (action) {
            case 'update-record-comment':
                await onUpdateComment(args)
                break;
            case 'get-detected-species':
                getSpecies()
                break;
            case 'clear-cache':
                console.log('cache')
                await clearCache();
                break;
            case 'load-model':
                UI.postMessage({event: 'spawning'});
                await clearCache();
                BATCH_SIZE = args.batchSize;
                if (predictWorker) predictWorker.terminate();
                spawnWorker(args.useWhitelist, BATCH_SIZE);
                break;
            case 'load-db':
                latitude = args.lat;
                longitude = args.lon;
                loadDB(args.path)
                break;
            case 'file-load-request':
                index = 0;
                if (predicting) onAbort(args);
                console.log('Worker received audio ' + args.filePath);
                await loadAudioFile(args);

                break;
            case 'update-buffer':
                const buffer = await fetchAudioBuffer(args);
                const length = buffer.length;
                const myArray = buffer.getChannelData(0);
                const file = args.file;
                UI.postMessage({
                    event: 'worker-loaded-audio',
                    fileStart: metadata[file].fileStart,
                    sourceDuration: metadata[file].duration,
                    bufferBegin: args.start,
                    file: file,
                    position: args.position,
                    length: length,
                    contents: myArray,
                    region: args.region
                })

                break;
            case 'explore':
                // reset results table
                UI.postMessage({event: 'reset-results'});
                const results = await getCachedResults({species: args.species, range: args.range});
                index = 0;
                results.forEach(result => {
                    //format dates
                    result.timestamp = new Date(result.timestamp);
                    result.position = new Date(result.position);
                    index++;
                    UI.postMessage({
                        event: 'prediction-ongoing',
                        file: result.file,
                        result: result,
                        index: index,
                        selection: false,
                    });
                    //AUDACITY.push(audacity);
                    RESULTS.push(result);
                })
                console.log(`Pulling results for ${args.species} from database`);
                // When in batch mode the 'prediction-done' event simply increments
                // the counter for the file being processed
                UI.postMessage({
                    event: 'prediction-done',
                    batchInProgress: false,
                });
                break;
            case 'analyze':
                console.log(`Worker received message: ${args.confidence}, start: ${args.start}, end: ${args.end}`);
                if (args.resetResults) {
                    index = 0;
                    AUDACITY = [];
                    RESULTS = [];
                }
                latitude = args.lat;
                longitude = args.lon;
                nocmig = args.nocmig;
                const isCached = await isDuplicate(args.filePath);
                if (isCached && !args.selection) {
                    // Pull the results from the database
                    const results = await getCachedResults({file: args.filePath, range: {}});
                    UI.postMessage({event: 'update-audio-duration', value: metadata[args.filePath].duration});
                    results.forEach(result => {
                        //format dates
                        result.timestamp = new Date(result.timestamp);
                        result.position = new Date(result.position);
                        index++;
                        UI.postMessage({
                            event: 'prediction-ongoing',
                            file: result.file,
                            result: result,
                            index: index,
                            selection: false,
                        });
                        //AUDACITY.push(audacity);
                        RESULTS.push(result);
                    })
                    console.log(`Pulling results for ${args.filePath} from database`);
                    // When in batch mode the 'prediction-done' event simply increments
                    // the counter for the file being processed
                    UI.postMessage({
                        event: 'prediction-done',
                        batchInProgress: false,
                    });
                    //if (FILE_QUEUE.length) await processNextFile();
                } else {
                    FILE_QUEUE.push(args.filePath);
                    console.log(`Adding ${args.filePath} to the queue.`)
                    if (predicting) {


                    } else {
                        predicting = true;
                        minConfidence = args.confidence;
                        await processNextFile(args);
                        // //let selection = false;
                        // let start, end;
                        // if (args.start) {
                        //     start = args.start;
                        //     end = args.end
                        // } else {
                        //     [start, end] = await setStartEnd(args.filePath)
                        // }
                        // await doPrediction({start: start, end: end, file: args.filePath, selection: args.selection});
                        // }
                    }
                }
                break;
            case 'save':
                console.log("file save requested")
                await saveMP3(args.file, args.start, args.end, args.filename, args.metadata);
                break;
            case 'post':
                await postMP3(args)
                break;
            case 'save2db':
                onSave2DB();
                break;
            case 'abort':
                onAbort(args);
                break;
            case 'chart':
                onChartRequest(args);
                break;
            default:
                UI.postMessage('Worker communication lines open')
        }
    }
})

function onAbort(args) {
    aborted = true;
    FILE_QUEUE = [];
    index = 0;
    console.log("abort received")
    if (predicting) {
        //restart the worker
        UI.postMessage({event: 'spawning'});
        predictWorker.terminate()
        spawnWorker(useWhitelist, BATCH_SIZE)
        predicting = false;
        predictionDone = true;
    }
    if (args.sendLabels) {
        UI.postMessage({event: 'prediction-done', labels: AUDACITY, batchInProgress: false});
    }
}

const getDuration = (src) => {
    // Use proxy
    src = proxiedFileCache[src];
    return new Promise(function (resolve) {
        const audio = new Audio();
        audio.addEventListener("loadedmetadata", function () {
            resolve(audio.duration);
        });
        audio.src = src;
    });
}

const convertFileFormat = (file, destination, size, error, progressing, finish) => {
    return new Promise(function (resolve) {
        ffmpeg(file)
            .on('error', (err) => {
                console.log('An error occurred: ' + err.message);
                if (error) {
                    error(err.message);
                }
            })
            .on('progress', (progress) => {
                // UI.postMessage({
                //     event: 'progress',
                //     text: "Decompressing file.",
                //     progress: progress.targetSize / size
                // });
                console.log('Processing: ' + progress.targetSize + ' KB converted');
                UI.postMessage({
                    event: 'progress',
                    text: 'Decompressing file',
                    progress: progress.targetSize / 1073559.65
                })
                if (progressing) {
                    progressing(progress.targetSize);
                }
            })
            .on('end', () => {
                // UI.postMessage({
                //     event: 'progress',
                //     text: "Decompressing file.",
                //     progress: 1
                // });
                UI.postMessage({event: 'progress', text: 'File decompressed', progress: 1.0})
                if (finish) {
                    resolve(destination)
                }
            })
            .save(destination);
    });
}

async function formatCheck(file) {
    if (proxiedFileCache[file]) return;
    if (!file.endsWith('.wav')) {
        const destination = p.join(file_cache, p.basename(file) + ".wav");
        proxiedFileCache[file] = destination;
        const statsObj = fs.statSync(file);
        const mtime = statsObj.mtime;
        file = await convertFileFormat(file, destination, statsObj.size, function (errorMessage) {
        }, null, function () {
            file = destination;
            console.log("success");
        });
        await utimes(file, mtime.getTime());
    } else {
        proxiedFileCache[file] = file;
    }
}

async function loadAudioFile(args) {
    // reset file cache
    await clearCache();

    let file = args.filePath;
    await formatCheck(file);
    if (!metadata[file]) {
        metadata[file] = await getMetadata(file)
    }
    const buffer = await fetchAudioBuffer({file: file, start: 0, end: 20, position: 0})
    const length = buffer.length;
    const myArray = buffer.getChannelData(0);
    UI.postMessage({
        event: 'worker-loaded-audio',
        fileStart: metadata[file].fileStart,
        sourceDuration: metadata[file].duration,
        bufferBegin: 0,
        file: file,
        position: 0,
        length: length,
        contents: myArray,
    })

}

function addDays(date, days) {
    let result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

const getMetadata = async (file) => {
    let fileStart;
    const proxyFile = proxiedFileCache[file]
    metadata[file] = {};

    return new Promise(async (resolve) => {
        metadata[file].duration = await getDuration(file);
        const readStream = fs.createReadStream(proxyFile);
        metadata[file].stat = fs.statSync(file);
        const fileEnd = new Date(metadata[file].stat.mtime);
        fileStart = new Date(metadata[file].stat.mtime - (metadata[file].duration * 1000))
        // split  the duration of this file across any dates it spans
        metadata[file].dateDuration = {}
        const key = new Date(fileStart);
        key.setHours(0, 0, 0, 0);
        const keyCopy = addDays(key, 0).getTime();
        if (fileStart.getDate() === fileEnd.getDate()) {
            metadata[file].dateDuration[keyCopy] = metadata[file].duration;
        } else {
            const key2 = addDays(key, 1);

            const key2Copy = addDays(key2, 0).getTime();
            metadata[file].dateDuration[keyCopy] = (key2Copy - fileStart) / 1000;
            metadata[file].dateDuration[key2Copy] = metadata[file].duration - metadata[file].dateDuration[keyCopy];
        }

        fileStart = new Date(metadata[file].stat.mtime - (metadata[file].duration * 1000)).getTime();
        let astro = SunCalc.getTimes(fileStart, latitude, longitude);
        metadata[file].dusk = astro.dusk.getTime();
        // If file starts after dark, dawn is next day
        if (fileStart > astro.dusk.getTime()) {
            astro = SunCalc.getTimes(fileStart + 8.47e+7, latitude, longitude);
            metadata[file].dawn = astro.dawn.getTime();
        } else {
            metadata[file].dawn = astro.dawn.getTime();
        }

        readStream.on('data', async chunk => {
            let wav = new wavefileReader.WaveFileReader();
            wav.fromBuffer(chunk);
            // Extract Header
            let headerEnd;
            wav.signature.subChunks.forEach(el => {
                if (el['chunkId'] === 'data') {
                    headerEnd = el.chunkData.start;
                }
            })
            // Update relevant file properties
            metadata[file].head = headerEnd;
            metadata[file].header = chunk.slice(0, headerEnd)
            metadata[file].bytesPerSec = wav.fmt.byteRate;
            metadata[file].numChannels = wav.fmt.numChannels;
            metadata[file].sampleRate = wav.fmt.sampleRate;
            metadata[file].bitsPerSample = wav.fmt.bitsPerSample
            metadata[file].fileStart = fileStart;
            readStream.close()
            resolve(metadata[file]);
        })
    })
}

function convertTimeToBytes(time, key) {
    const bytesPerSample = metadata[key].bitsPerSample / 8;
    // get the nearest sample start - they can be 2,3 or 4 bytes representations. Then add the header offest
    return (Math.round((time * metadata[key].bytesPerSec) / bytesPerSample) * bytesPerSample) + metadata[key].head;
}

async function setupCtx(chunk, file) {
    chunk = Buffer.concat([metadata[file].header, chunk]);
    const audioBufferChunk = await audioCtx.decodeAudioData(chunk.buffer);
    const source = audioCtx.createBufferSource();
    source.buffer = audioBufferChunk;
    const duration = source.buffer.duration;
    const buffer = source.buffer;
    const offlineCtx = new OfflineAudioContext(1, sampleRate * duration, sampleRate);
    const offlineSource = offlineCtx.createBufferSource();
    offlineSource.buffer = buffer;
    offlineSource.connect(offlineCtx.destination);
    offlineSource.start();
    return offlineCtx;
}

async function getPredictBuffers(args) {
    let start = args.start, end = args.end, selection = args.selection
    const file = args.file
    // Ensure max and min are within range
    start = Math.max(0, start);
    // Handle no end supplied
    const proxyFile = proxiedFileCache[file]
    end > 0 ? end = Math.min(metadata[file].duration, end) : end = metadata[file].duration;
    const byteStart = convertTimeToBytes(start, file);
    const byteEnd = convertTimeToBytes(end, file);
    // Match highWaterMark to batch size... so we efficiently read bytes to feed to model - 3 for 3 second chunks
    const highWaterMark = metadata[file].bytesPerSec * BATCH_SIZE * 3;
    const readStream = fs.createReadStream(proxyFile, {
        start: byteStart,
        end: byteEnd,
        highWaterMark: highWaterMark
    });
    chunkStart = start * sampleRate;
    //const fileDuration = end - start;
    await readStream.on('data', async chunk => {
        // Ensure data is processed in order
        readStream.pause();
        const offlineCtx = await setupCtx(chunk, file);
        offlineCtx.startRendering().then(resampled => {
            const myArray = resampled.getChannelData(0);
            const samples = (end - start) * sampleRate;
            const increment = samples < chunkLength ? samples : chunkLength;
            feedChunksToModel(myArray, increment, chunkStart, file, end, selection);
            chunkStart += 3 * BATCH_SIZE * sampleRate;
            // Now the async stuff is done ==>
            readStream.resume();
        })
    })
    readStream.on('end', function () {
        readStream.close()
    })
}

const fetchAudioBuffer = async (args) => {
    let start = args.start, end = args.end, file = args.file;
    let proxyFile;
    if (!proxiedFileCache[file]) {
        await formatCheck(file);
        await getMetadata(file);
    }
    proxyFile = proxiedFileCache[file];
    return new Promise((resolve) => {
        // Ensure max and min are within range
        start = Math.max(0, start);
        // Handle no end supplied
        end = Math.min(metadata[file].duration, end);
        const byteStart = convertTimeToBytes(start, file);
        const byteEnd = convertTimeToBytes(end, file);
        //if (isNaN(byteEnd)) byteEnd = Infinity;
        // Match highWaterMark to batch size... so we efficiently read bytes to feed to model - 3 for 3 second chunks
        const highWaterMark = byteEnd - byteStart + 1;
        const readStream = fs.createReadStream(proxyFile, {
            start: byteStart,
            end: byteEnd,
            highWaterMark: highWaterMark
        });
        readStream.on('data', async chunk => {
            // Ensure data is processed in order
            readStream.pause();
            const offlineCtx = await setupCtx(chunk, file);

            offlineCtx.startRendering().then(resampled => {
                // `resampled` contains an AudioBuffer resampled at 24000Hz.
                // use resampled.getChannelData(x) to get an Float32Array for channel x.
                //readStream.close();
                readStream.resume();
                resolve(resampled);
            })
        })

        readStream.on('end', function () {
            readStream.close()
        })
    });
}

async function sendMessageToWorker(chunkStart, chunks, file, duration, selection) {
    const objData = {
        message: 'predict',
        chunkStart: chunkStart,
        numberOfChunks: chunks.length,
        fileStart: metadata[file].fileStart,
        file: file,
        duration: duration,
        selection: selection
    }
    let chunkBuffers = [];
    for (let i = 0; i < chunks.length; i++) {
        objData['chunk' + i] = chunks[i];
        chunkBuffers.push(objData['chunk' + i].buffer)
    }
    predictWorker.postMessage(objData, chunkBuffers);
}

async function doPrediction(args) {
    const start = args.start, end = args.end, file = args.file, selection = args.selection;
    aborted = false;
    predictionDone = false;
    predictionStart = new Date();
    if (!args.preserveResults && !selection) {
        index = 0;
        AUDACITY = [];
        RESULTS = [];
    }
    predicting = true;
    await getPredictBuffers({file: file, start: start, end: end, selection: selection});
    UI.postMessage({event: 'update-audio-duration', value: metadata[file].duration});
}

async function feedChunksToModel(channelData, increment, chunkStart, file, duration, selection) {
    let chunks = [];
    for (let i = 0; i < channelData.length; i += increment) {
        let chunk = channelData.slice(i, i + increment);
        // Batch predictions
        chunks.push(chunk);
        if (chunks.length === BATCH_SIZE) {
            await sendMessageToWorker(chunkStart, chunks, file, duration, selection);
            chunks = [];
        }
    }
    //clear up remainder less than BATCH_SIZE
    if (chunks.length > 0) await sendMessageToWorker(chunkStart, chunks, file, duration, selection);
}


function downloadMp3(buffer, filePath, metadata) {
    const MP3Blob = analyzeAudioBuffer(buffer, metadata);
    const anchor = document.createElement('a');
    document.body.appendChild(anchor);
    anchor.style = 'display: none';
    const url = window.URL.createObjectURL(MP3Blob);
    anchor.href = url;
    anchor.download = filePath;
    anchor.click();
    window.URL.revokeObjectURL(url);
}

function uploadMp3(buffer, defaultName, metadata, mode) {
    const MP3Blob = analyzeAudioBuffer(buffer, metadata);
// Populate a form with the file (blob) and filename
    var formData = new FormData();
    //const timestamp = Date.now()
    formData.append("thefile", MP3Blob, defaultName);
    // Was the prediction a correct one?
    formData.append("Chirpity_assessment", mode);
// post form data
    const xhr = new XMLHttpRequest();
    xhr.responseType = 'text';
// log response
    xhr.onload = () => {
        console.log(xhr.response);
    };
// create and send the reqeust
    xhr.open('POST', 'https://birds.mattkirkland.co.uk/upload');
    xhr.send(formData);
}

function analyzeAudioBuffer(aBuffer, metadata) {
    let numOfChan = aBuffer.numberOfChannels,
        btwLength = aBuffer.length * numOfChan * 2 + 44,
        btwArrBuff = new ArrayBuffer(btwLength),
        btwView = new DataView(btwArrBuff),
        btwChnls = [],
        btwIndex,
        btwSample,
        btwOffset = 0,
        btwPos = 0;
    setUint32(0x46464952); // "RIFF"
    setUint32(btwLength - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(aBuffer.sampleRate);
    setUint32(aBuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit
    setUint32(0x61746164); // "data" - chunk
    setUint32(btwLength - btwPos - 4); // chunk length

    for (btwIndex = 0; btwIndex < aBuffer.numberOfChannels; btwIndex++)
        btwChnls.push(aBuffer.getChannelData(btwIndex));

    while (btwPos < btwLength) {
        for (btwIndex = 0; btwIndex < numOfChan; btwIndex++) {
            // interleave btwChnls
            btwSample = Math.max(-1, Math.min(1, btwChnls[btwIndex][btwOffset])); // clamp
            btwSample = (0.5 + btwSample < 0 ? btwSample * 32768 : btwSample * 32767) | 0; // scale to 16-bit signed int
            btwView.setInt16(btwPos, btwSample, true); // write 16-bit sample
            btwPos += 2;
        }
        btwOffset++; // next source sample
    }

    let wavHdr = lamejs.WavHeader.readHeader(new DataView(btwArrBuff));

    //Stereo
    let data = new Int16Array(btwArrBuff, wavHdr.dataOffset, wavHdr.dataLen / 2);
    let leftData = [];
    let rightData = [];
    for (let i = 0; i < data.length; i += 2) {
        leftData.push(data[i]);
        rightData.push(data[i + 1]);
    }
    var left = new Int16Array(leftData);
    var right = new Int16Array(rightData);


    //STEREO
    if (wavHdr.channels === 2)
        return bufferToMp3(metadata, wavHdr.channels, wavHdr.sampleRate, left, right);
    //MONO
    else if (wavHdr.channels === 1)
        return bufferToMp3(metadata, wavHdr.channels, wavHdr.sampleRate, data);


    function setUint16(data) {
        btwView.setUint16(btwPos, data, true);
        btwPos += 2;
    }

    function setUint32(data) {
        btwView.setUint32(btwPos, data, true);
        btwPos += 4;
    }
}

function bufferToMp3(metadata, channels, sampleRate, left, right = null) {
    var buffer = [];
    var mp3enc = new lamejs.Mp3Encoder(channels, sampleRate, 192);
    var remaining = left.length;
    var samplesPerFrame = 1152;
    if (metadata) {
        //const ID3content = JSON.stringify(metadata)
        // Add metadata
        const writer = new ID3Writer(Buffer.alloc(0));
        writer.setFrame('TPE1', [metadata['cname']])  // Artist Name
            .setFrame('TIT3', metadata['sname'])
            .setFrame('TPE2', [metadata['cname2'], metadata['cname3']])  // Contributing Artists
            .setFrame('TCON', ['Nocmig']) // Genre
            .setFrame('TPUB', 'Chirpity Nocmig ' + metadata['version']) // Publisher
            .setFrame('TYER', new Date().getFullYear()) // Year
            .setFrame('TXXX', {
                description: 'ID Confidence',
                value: parseFloat(parseFloat(metadata['score']) * 100).toFixed(0) + '%'
            })
            .setFrame('TXXX', {
                description: 'Time of detection',
                value: metadata['date']
            })
            .setFrame('TXXX', {
                description: 'Latitude',
                value: metadata['lat']
            })
            .setFrame('TXXX', {
                description: 'Longitude',
                value: metadata['lon']
            })
            .setFrame('TXXX', {
                description: '2nd',
                value: metadata['cname2'] + ' (' + parseFloat(parseFloat(metadata['score2']) * 100).toFixed(0) + '%)'
            })
            .setFrame('TXXX', {
                description: '3rd',
                value: metadata['cname3'] + ' (' + parseFloat(parseFloat(metadata['score']) * 100).toFixed(0) + '%)'
            })
            .setFrame('TXXX', {
                description: 'UUID',
                value: metadata['UUID'],
            });
        writer.addTag();
        buffer.push(writer.arrayBuffer)
    }
    for (let i = 0; remaining >= samplesPerFrame; i += samplesPerFrame) {
        let mp3buf
        if (!right) {
            var mono = left.subarray(i, i + samplesPerFrame);
            mp3buf = mp3enc.encodeBuffer(mono);
        } else {
            var leftChunk = left.subarray(i, i + samplesPerFrame);
            var rightChunk = right.subarray(i, i + samplesPerFrame);
            mp3buf = mp3enc.encodeBuffer(leftChunk, rightChunk);
        }
        if (mp3buf.length > 0) {
            buffer.push(mp3buf);//new Int8Array(mp3buf));
        }
        remaining -= samplesPerFrame;
    }
    var d = mp3enc.flush();
    if (d.length > 0) {
        buffer.push(new Int8Array(d));
    }
    return new Blob(buffer, {type: 'audio/mpeg'});

}

async function saveMP3(file, start, end, filename, metadata) {
    const buffer = await fetchAudioBuffer({file: file, start: start, end: end})
    downloadMp3(buffer, filename, metadata)
}


async function postMP3(args) {
    const file = args.file, defaultName = args.defaultName, start = args.start, end = args.end,
        metadata = args.metadata, mode = args.mode;
    const buffer = await fetchAudioBuffer({file: file, start: start, end: end});
    uploadMp3(buffer, defaultName, metadata, mode)
}


/// Workers  From the MDN example
function spawnWorker(useWhitelist, batchSize) {
    console.log('spawning worker')
    predictWorker = new Worker('./js/model.js');
    predictWorker.postMessage(['load', appPath, useWhitelist, batchSize])
    predictWorker.onmessage = (e) => {
        parsePredictions(e)
    }
}

async function parsePredictions(e) {
    const response = e.data;
    const file = response.file;
    if (response['message'] === 'model-ready') {
        chunkLength = response['chunkLength'];
        sampleRate = response['sampleRate'];
        const backend = response['backend'];
        console.log(backend);
        UI.postMessage({event: 'model-ready', message: 'ready', backend: backend})
    } else if (response['message'] === 'prediction' && !aborted) {
        // add filename to result for db purposes
        response['result'].forEach(prediction => {
            const position = parseFloat(prediction[0]);
            const result = prediction[1];
            result.file = file;
            const audacity = prediction[2];
            UI.postMessage({event: 'progress', progress: (position / metadata[file].duration)});
            //console.log('Prediction received from worker', result);
            if (result.score > minConfidence) {
                index++;
                UI.postMessage({
                    event: 'prediction-ongoing',
                    file: file,
                    result: result,
                    index: index,
                    selection: response['selection'],
                });
                AUDACITY.push(audacity);
                RESULTS.push(result);
            }
            // 3.5 seconds subtracted because position is the beginning of a 3-second chunk and
            // the min fragment length is 0.5 seconds
            if (position.toFixed(0) >= (response.endpoint.toFixed(0) - 3.5)) {
                console.log(`Prediction done ${FILE_QUEUE.length} files to go`);
                console.log('Analysis took ' + (new Date() - predictionStart) / 1000 + ' seconds.');
                if (RESULTS.length === 0) {
                    const result = "No detections found.";
                    UI.postMessage({
                        event: 'prediction-ongoing',
                        file: file,
                        result: result,
                        index: 1,
                        selection: response['selection']
                    });
                }
                UI.postMessage({event: 'progress', progress: 1});
                if (!predictionDone) {
                    UI.postMessage({
                        event: 'prediction-done',
                        labels: AUDACITY,
                        batchInProgress: FILE_QUEUE.length,
                    });
                }
                predictionDone = true;
            }
        })
    }
    if (predictionDone) {
        await processNextFile();
    }
}

async function processNextFile(args) {
    if (FILE_QUEUE.length) {
        let file = FILE_QUEUE.shift()
        await formatCheck(file);
        let [start, end] = args.start ? [args.start, args.end] : await setStartEnd(file);
        if (start === 0 && end === 0) {
            // Nothing to do for this file
            await processNextFile();
        } else {
            await doPrediction({start: start, end: end, file: file, selection: false, preserveResults: true});
        }
    } else {
        predicting = false;
    }
}

async function setStartEnd(file) {
    const metadata = await getMetadata(file);
    let start, end;
    if (nocmig) {
        const fileEnd = metadata.fileStart + (metadata.duration * 1000);
        // If it's dark at the file start, start at 0 ...otherwise start at dusk
        if (metadata.fileStart < metadata.dawn || metadata.fileStart > metadata.dusk) {
            start = 0;
        } else {
            // not dark at start, is it still light at the end?
            if (fileEnd <= metadata.dusk) {
                // If we loaded multiple files
                if (FILE_QUEUE.length || Object.keys(proxiedFileCache).length > 1) {
                    // skip to next file

                    return [0, 0];
                } else {
                    // In case it's all in the daytime and just a single file - temporarily disable nocmig mode
                    return [0, metadata.duration];
                }
            } else {
                // So, it *is* dark by the end of the file
                start = (metadata.dusk - metadata.fileStart) / 1000;
            }
        }
        // Now set the end
        metadata.fileStart < metadata.dawn && fileEnd >= metadata.dawn ?
            end = (metadata.dawn - metadata.fileStart) / 1000 :
            end = metadata.duration;
    } else {
        start = 0;
        end = metadata.duration;
    }
    return [start, end];
}

let t1, t0;

const getCachedResults = (args) => {
    let where;
    const dateRange = args.range;
    if (args.file) where = `files.name =  '${args.file}'`;
    if (args.species) where = `s1.cname =  '${args.species.replace("'", "''")}'`;
    const when = dateRange.start ? `AND datetime BETWEEN ${dateRange.start} AND ${dateRange.end}` : '';
    return new Promise(function (resolve, reject) {
        db.all(`SELECT dateTime AS timestamp, position AS position, 
            s1.cname as cname, s2.cname as cname2, s3.cname as cname3, 
            birdid1 as id_1, birdid2 as id_2, birdid3 as id_3, 
            position / 1000 as
                start, (position / 1000) + 3 as
                end
                ,  
                conf1 as score, conf2 as score2, conf3 as score3, 
                s1.sname as sname, s2.sname as sname2, s3.sname as sname3,
                files.duration, 
                files.name as file,
                    comment
                FROM records 
                LEFT JOIN species s1 on s1.id = birdid1 
                LEFT JOIN species s2 on s2.id = birdid2 
                LEFT JOIN species s3 on s3.id = birdid3 
                INNER JOIN files on files.rowid = records.fileid 
                WHERE
                ${where}
                ${when}`,
            (err, rows) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(rows)
                }
            })
    })
}


const updateFileTables = (file) => {
    return new Promise(function (resolve) {
        const newFileStmt = db.prepare("INSERT INTO files VALUES (?,?,?)");
        const selectStmt = db.prepare('SELECT rowid FROM files WHERE name = (?)');
        const durationStmt = db.prepare("INSERT OR REPLACE INTO duration VALUES (?,?,?)");
        newFileStmt.run(file, metadata[file].duration, metadata[file].fileStart, (err, row) => {
            for (const [date, duration] of Object.entries(metadata[file].dateDuration)) {
                selectStmt.get(file, (err, row) => {
                    const fileid = row.rowid;
                    console.log('file table updated')
                    resolve(fileid);
                    durationStmt.run(date, Math.round(duration).toFixed(0), fileid);
                })
            }
        })
    })
}

const onSave2DB = async () => {
    t0 = performance.now();
    const stmt = db.prepare("INSERT OR REPLACE INTO records VALUES (?,?,?,?,?,?,?,?,?)");
    let filemap = {}
    for (let i = 0; i < RESULTS.length; i++) {
        const dateTime = new Date(RESULTS[i].timestamp).getTime();
        const birdID1 = RESULTS[i].id_1;
        const birdID2 = RESULTS[i].id_2;
        const birdID3 = RESULTS[i].id_3;
        const conf1 = RESULTS[i].score;
        const conf2 = RESULTS[i].score2;
        const conf3 = RESULTS[i].score3;
        const position = new Date(RESULTS[i].position).getTime();
        const file = RESULTS[i].file;
        if (!filemap[file]) filemap[file] = await updateFileTables(file);
        stmt.run(dateTime, birdID1, birdID2, birdID3, conf1, conf2, conf3, filemap[file], position, (err, row) => {
            UI.postMessage({event: 'progress', text: "Updating Database.", progress: i / RESULTS.length});
            if (i === (RESULTS.length - 1)) {
                console.log(`Update complete, ${i + 1} records added in ${((performance.now() - t0) / 1000).toFixed(1)} seconds`)
                UI.postMessage({event: 'progress', progress: 1});
            }
        });

    }
    // newFileStmt.finalize();
    // stmt.finalize();
    // fileStmt.finalize();
}

const getSeasonRecords = (species, season) => {
    const seasonMonth = {'spring': "< '07'", 'autumn': " > '06'"}
    return new Promise(function (resolve, reject) {
        const stmt = db.prepare(`
            SELECT MAX(SUBSTR(DATE(records.dateTime/1000, 'unixepoch', 'localtime'), 6)) AS maxDate,
                   MIN(SUBSTR(DATE(records.dateTime/1000, 'unixepoch', 'localtime'), 6)) AS minDate
            FROM records
                     INNER JOIN species ON species.id = records.birdID1
            WHERE species.cname = (?)
              AND STRFTIME('%m', DATETIME(records.dateTime / 1000, 'unixepoch', 'localtime')) ${seasonMonth[season]}`);
        stmt.get(species, (err, row) => {
            if (err) {
                reject(err)
            } else {
                resolve(row)
            }
        })
    })
}

const getMostCalls = (species) => {
    return new Promise(function (resolve, reject) {
        db.get(`
            SELECT count(*) as count, 
            DATE(dateTime/1000, 'unixepoch', 'localtime') as date
            FROM records INNER JOIN species
            on species.id = records.birdID1
            WHERE species.cname = '${species}'
            GROUP BY STRFTIME('%Y', DATETIME(dateTime/1000, 'unixepoch', 'localtime')),
                STRFTIME('%W', DATETIME(dateTime/1000, 'unixepoch', 'localtime')),
                STRFTIME('%d', DATETIME(dateTime/1000, 'unixepoch', 'localtime'))
            ORDER BY count DESC LIMIT 1`, (err, row) => {
            if (err) {
                reject(err)
            } else {
                resolve(row)
            }
        })
    })
}

const getChartTotals = (args) => {
    const species = args.species;
    const dateRange = args.range;
    // Work out sensible aggregations from hours difference in daterange
    const hours_diff = dateRange.start ?
        Math.round((dateRange.end - dateRange.start) / (1000 * 60 * 60)) : 745;
    console.log(hours_diff, "difference in hours")
    const dateFilter = dateRange.start ? ` AND dateTime BETWEEN ${dateRange.start} AND ${dateRange.end} ` : '';
    // default to group by Week
    let dataPoints = Math.max(52, Math.round(hours_diff / 24 / 7));
    let groupBy = "Year, Week";
    let orderBy = 'Year'
    let aggregation = 'Week';
    let startDay = 0;
    if (hours_diff <= 744) {
        //31 days or less: group by Day
        groupBy += ", Day";
        orderBy = 'Year, Week';
        dataPoints = Math.round(hours_diff / 24);
        aggregation = 'Day';
        const date = dateRange.start ? new Date(dateRange.start) : Date.UTC(2020, 0, 0, 0, 0, 0);
        startDay = Math.floor((date - new Date(date.getFullYear(), 0, 0, 0, 0, 0)) / 1000 / 60 / 60 / 24);
    }
    if (hours_diff <= 72) {
        // 3 days or less, group by Hour of Day
        groupBy += ", Hour";
        orderBy = 'Day, Hour';
        dataPoints = hours_diff;
        aggregation = 'Hour';
    }

    return new Promise(function (resolve, reject) {
        db.all(`SELECT STRFTIME('%Y', DATETIME(dateTime / 1000, 'unixepoch', 'localtime')) AS Year, 
            STRFTIME('%W', DATETIME(dateTime/1000, 'unixepoch', 'localtime')) AS Week,
            STRFTIME('%j', DATETIME(dateTime/1000, 'unixepoch', 'localtime')) AS Day, 
            STRFTIME('%H', DATETIME(dateTime/1000, 'unixepoch', 'localtime')) AS Hour,    
            COUNT(*) as count
                FROM records
                    INNER JOIN species
                on species.id = birdid1
                WHERE species.cname = '${species}' ${dateFilter}
                GROUP BY ${groupBy}
                ORDER BY ${orderBy};`, (err, rows) => {
            if (err) {
                reject(err)
            } else {

                resolve([rows, dataPoints, aggregation, startDay])
            }
        })
    })
}


const getRate = (species) => {

    return new Promise(function (resolve, reject) {
        const calls = new Array(52).fill(0);
        const total = new Array(52).fill(0);


        db.all(`select STRFTIME('%W', DATE(dateTime / 1000, 'unixepoch', 'localtime')) as week, count(*) as calls
                from records
                         INNER JOIN species ON species.id = records.birdid1
                WHERE species.cname = '${species}'
                group by week;`, (err, rows) => {
            for (let i = 0; i < rows.length; i++) {
                calls[parseInt(rows[i].week) - 1] = rows[i].calls;
            }
            db.all("select STRFTIME('%W', DATE(duration.day / 1000, 'unixepoch', 'localtime')) as week, cast(sum(duration) as real)/3600  as total from duration group by week;", (err, rows) => {
                for (let i = 0; i < rows.length; i++) {
                    // Round the total to 2 dp
                    total[parseInt(rows[i].week) - 1] = Math.round(rows[i].total * 100) / 100;
                }
                let rate = [];
                for (let i = 0; i < calls.length; i++) {
                    total[i] > 0 ? rate[i] = Math.round((calls[i] / total[i]) * 100) / 100 : rate[i] = 0;
                }
                if (err) {
                    reject(err)
                } else {
                    resolve([total, rate])
                }
            })
        })
    })
}

const getSpecies = () => {
    db.all('SELECT DISTINCT cname, sname FROM records INNER JOIN species ON birdid1 = id ORDER BY cname',
        (err, rows) => {
            if (err) console.log(err);
            else {
                UI.postMessage({event: 'seen-species-list', list: rows})
            }
        })
}

const onUpdateComment = (args) => {
    let file = args.file, start = args.start, comment = args.comment;
    if (!comment) comment = 'null';
    const dateTime = metadata[file].fileStart + (start * 1000);
    return new Promise(function (resolve, reject) {
        db.get(`UPDATE records SET comment = '${comment}' WHERE datetime = '${dateTime}'`, (err, row) => {
            if (err) {
                reject(err)
            } else {
                resolve(row)
            }
        })
    })
}

async function onChartRequest(args) {
    console.log(`Getting chart for ${args.species} starting ${args.range[0]}`);
    // Escape apostrophes
    if (args.species) args.species = args.species.replace("'", "''");
    const dateRange = args.range;
    const dataRecords = {}, results = {};
    t0 = Date.now();
    await getSeasonRecords(args.species, 'spring')
        .then((result) => {
            dataRecords.earliestSpring = result['minDate'];
            dataRecords.latestSpring = result['maxDate'];
        }).catch((message) => {
            console.log(message)
        })

    await getSeasonRecords(args.species, 'autumn')
        .then((result) => {
            dataRecords.earliestAutumn = result['minDate'];
            dataRecords.latestAutumn = result['maxDate'];
        }).catch((message) => {
            console.log(message)
        })

    console.log(`Season chart generation took ${(Date.now() - t0) / 1000} seconds`)
    t0 = Date.now();
    await getMostCalls(args.species)
        .then((row) => {
            row ? dataRecords.mostDetections = [row.count, row.date] :
                dataRecords.mostDetections = ['N/A', 'Not detected'];
        }).catch((message) => {
            console.log(message)
        })

    console.log(`Most calls  chart generation took ${(Date.now() - t0) / 1000} seconds`)
    t0 = Date.now();
    const [dataPoints, aggregation] = await getChartTotals(args)
        .then(([rows, dataPoints, aggregation, startDay]) => {
            for (let i = 0; i < rows.length; i++) {
                const year = rows[i].Year;
                const week = rows[i].Week;
                const day = rows[i].Day;
                const hour = rows[i].Hour;
                const count = rows[i].count;
                // stack years
                if (!(year in results)) {
                    results[year] = new Array(dataPoints).fill(0);
                }
                if (aggregation === 'Week') {
                    results[year][parseInt(week) - 1] = count;
                } else if (aggregation === 'Day') {
                    results[year][parseInt(day) - startDay] = count;
                } else {
                    const d = new Date(dateRange.start);
                    const hoursOffset = d.getHours();
                    const index = ((parseInt(day) - startDay) * 24) + (parseInt(hour) - hoursOffset);
                    results[year][index] = count;
                }
            }
            return [dataPoints, aggregation]
        }).catch((message) => {
            console.log(message)
        })

    console.log(`Chart series generation took ${(Date.now() - t0) / 1000} seconds`)
    t0 = Date.now();
    // If we have a years worth of data add total recording duration and rate
    let total, rate;
    if (dataPoints === 52) [total, rate] = await getRate(args.species)
    console.log(`Chart rate generation took ${(Date.now() - t0) / 1000} seconds`)
    const pointStart = dateRange.start ? dateRange.start : Date.UTC(2020, 0, 0, 0, 0, 0);
    UI.postMessage({
        event: 'chart-data',
        // Restore species name
        species:  args.species ? args.species.replace("''", "'"):undefined,
        results: results,
        rate: rate,
        total: total,
        records: dataRecords,
        dataPoints: dataPoints,
        pointStart: pointStart,
        aggregation: aggregation
    })
}
