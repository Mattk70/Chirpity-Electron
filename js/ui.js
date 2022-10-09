let firstDawn, dawn, dusk, seenTheDarkness = false, shownDaylightBanner = false;
const labels = ["Tachymarptis melba_Alpine Swift", "Pluvialis dominica_American Golden Plover", "Mareca americana_American Wigeon", "Acrocephalus paludicola_Aquatic Warbler", "Acanthis hornemanni_Arctic Redpoll", "Stercorarius parasiticus_Arctic Skua", "Sterna paradisaea_Arctic Tern", "Phylloscopus borealis_Arctic Warbler", "Recurvirostra avosetta_Avocet", "Porzana pusilla_Baillon's Crake", "Limosa lapponica_Bar-tailed Godwit", "Tyto alba_Barn Owl", "Branta leucopsis_Barnacle Goose", "Sylvia nisoria_Barred Warbler", "Panurus biarmicus_Bearded Tit", "Merops apiaster_Bee-eater", "Cygnus columbianus_Bewick's Swan", "Botaurus stellaris_Bittern", "Oenanthe hispanica_Black-eared Wheatear", "Chroicocephalus ridibundus_Black-headed Gull", "Podiceps nigricollis_Black-necked Grebe", "Limosa limosa_Black-tailed Godwit", "Himantopus himantopus_Black-winged Stilt", "Lyrurus tetrix_Black Grouse", "Cepphus grylle_Black Guillemot", "Milvus migrans_Black Kite", "Phoenicurus ochruros_Black Redstart", "Chlidonias niger_Black Tern", "Turdus merula_Blackbird", "Sylvia atricapilla_Blackcap", "Spatula discors_Blue-winged Teal", "Cyanistes caeruleus_Blue Tit", "Luscinia svecica_Bluethroat", "Acrocephalus dumetorum_Blyth's Reed Warbler", "Fringilla montifringilla_Brambling", "Branta bernicla_Brent Goose", "Pyrrhula pyrrhula_Bullfinch", "Buteo buteo_Buzzard", "Branta canadensis_Canada Goose", "Tetrao urogallus_Capercaillie", "Corvus corone_Carrion/Hooded Crow", "Larus cachinnans_Caspian Gull", "Bubulcus ibis_Cattle Egret", "Cettia cetti_Cetti's Warbler", "Fringilla coelebs_Chaffinch", "Phylloscopus collybita_Chiffchaff", "Pyrrhocorax pyrrhocorax_Chough", "Emberiza cirlus_Cirl Bunting", "Motacilla citreola_Citrine Wagtail", "Periparus ater_Coal Tit", "Streptopelia decaocto_Collared Dove", "Glareola pratincola_Collared Pratincole", "Loxia curvirostra_Common Crossbill", "Larus canus_Common Gull", "Acanthis flammea_Common Redpoll", "Carpodacus erythrinus_Common Rosefinch", "Actitis hypoleucos_Common Sandpiper", "Melanitta nigra_Common Scoter", "Sterna hirundo_Common Tern", "Fulica atra_Coot", "Phalacrocorax carbo_Cormorant", "Emberiza calandra_Corn Bunting", "Crex crex_Corncrake", "Calonectris borealis_Cory's Shearwater", "Grus grus_Crane", "Lophophanes cristatus_Crested Tit", "Cuculus canorus_Cuckoo", "Calidris ferruginea_Curlew Sandpiper", "Numenius arquata_Curlew", "Sylvia undata_Dartford Warbler", "Cinclus cinclus_Dipper", "Charadrius morinellus_Dotterel", "Calidris alpina_Dunlin", "Prunella modularis_Dunnock", "Phylloscopus fuscatus_Dusky Warbler", "Alopochen aegyptiaca_Egyptian Goose", "Somateria mollissima_Eider", "Bubo bubo_Eurasian Eagle-Owl", "Turdus pilaris_Fieldfare", "Regulus ignicapilla_Firecrest", "Fulmarus glacialis_Fulmar", "Mareca strepera_Gadwall", "Morus bassanus_Gannet", "Sylvia borin_Garden Warbler", "Spatula querquedula_Garganey", "Larus hyperboreus_Glaucous Gull", "Plegadis falcinellus_Glossy Ibis", "Regulus regulus_Goldcrest", "Aquila chrysaetos_Golden Eagle", "Oriolus oriolus_Golden Oriole", "Pluvialis apricaria_Golden Plover", "Bucephala clangula_Goldeneye", "Carduelis carduelis_Goldfinch", "Mergus merganser_Goosander", "Accipiter gentilis_Goshawk", "Locustella naevia_Grasshopper Warbler", "Larus marinus_Great Black-backed Gull", "Podiceps cristatus_Great Crested Grebe", "Lanius excubitor_Great Grey Shrike", "Gavia immer_Great Northern Diver", "Stercorarius skua_Great Skua", "Dendrocopos major_Great Spotted Woodpecker", "Parus major_Great Tit", "Ardea alba_Great White Egret", "Anas carolinensis_Green-winged Teal", "Tringa ochropus_Green Sandpiper", "Picus viridis_Green Woodpecker", "Chloris chloris_Greenfinch", "Phylloscopus trochiloides_Greenish Warbler", "Tringa nebularia_Greenshank", "Ardea cinerea_Grey Heron", "Perdix perdix_Grey Partridge", "Phalaropus fulicarius_Grey Phalarope", "Pluvialis squatarola_Grey Plover", "Motacilla cinerea_Grey Wagtail", "Anser anser_Greylag Goose", "Uria aalge_Guillemot", "Gelochelidon nilotica_Gull-billed Tern", "Coccothraustes coccothraustes_Hawfinch", "Larus argentatus_Herring Gull", "Falco subbuteo_Hobby", "Pernis apivorus_Honey-buzzard", "Upupa epops_Hoopoe", "Delichon urbicum_House Martin", "Passer domesticus_House Sparrow", "Homo Sapiens", "Phylloscopus ibericus_Iberian Chiffchaff", "Hippolais icterina_Icterine Warbler", "Lymnocryptes minimus_Jack Snipe", "Coloeus monedula_Jackdaw", "Garrulus glandarius_Jay", "Charadrius alexandrinus_Kentish Plover", "Falco tinnunculus_Kestrel", "Alcedo atthis_Kingfisher", "Rissa tridactyla_Kittiwake", "Calidris canutus_Knot", "Calcarius lapponicus_Lapland Bunting", "Vanellus vanellus_Lapwing", "Larus fuscus_Lesser Black-backed Gull", "Acanthis cabaret_Lesser Redpoll", "Dryobates minor_Lesser Spotted Woodpecker", "Sylvia curruca_Lesser Whitethroat", "Linaria cannabina_Linnet", "Ixobrychus minutus_Little Bittern", "Emberiza pusilla_Little Bunting", "Egretta garzetta_Little Egret", "Tachybaptus ruficollis_Little Grebe", "Hydrocoloeus minutus_Little Gull", "Athene noctua_Little Owl", "Charadrius dubius_Little Ringed Plover", "Calidris minuta_Little Stint", "Sternula albifrons_Little Tern", "Asio otus_Long-eared Owl", "Clangula hyemalis_Long-tailed Duck", "Stercorarius longicaudus_Long-tailed Skua", "Aegithalos caudatus_Long-tailed Tit", "Pica pica_Magpie", "Anas platyrhynchos_Mallard", "Aix galericulata_Mandarin Duck", "Puffinus puffinus_Manx Shearwater", "Circus aeruginosus_Marsh Harrier", "Poecile palustris_Marsh Tit", "Anthus pratensis_Meadow Pipit", "Ichthyaetus melanocephalus_Mediterranean Gull", "Hippolais polyglotta_Melodious Warbler", "Falco columbarius_Merlin", "Turdus viscivorus_Mistle Thrush", "Circus pygargus_Montagu's Harrier", "Gallinula chloropus_Moorhen", "Cygnus olor_Mute Swan", "Nycticorax nycticorax_Night Heron", "Luscinia megarhynchos_Nightingale", "Caprimulgus europaeus_Nightjar", "No Call_No Call", "Sitta europaea_Nuthatch", "Anthus hodgsoni_Olive-backed Pipit", "Emberiza hortulana_Ortolan Bunting", "Pandion haliaetus_Osprey", "Haematopus ostralegus_Oystercatcher", "Syrrhaptes paradoxus_Pallas's Sandgrouse", "Phylloscopus proregulus_Pallas's Warbler", "Loxia pytyopsittacus_Parrot Crossbill", "Calidris melanotos_Pectoral Sandpiper", "Remiz pendulinus_Penduline Tit", "Falco peregrinus_Peregrine", "Phasianus colchicus_Pheasant", "Ficedula hypoleuca_Pied Flycatcher", "Motacilla alba_Pied Wagtail", "Anser brachyrhynchus_Pink-footed Goose", "Anas acuta_Pintail", "Aythya ferina_Pochard", "Lagopus muta_Ptarmigan", "Ardea purpurea_Purple Heron", "Calidris maritima_Purple Sandpiper", "Coturnix coturnix_Quail", "Phylloscopus schwarzi_Radde's Warbler", "Corvus corax_Raven", "Alca torda_Razorbill", "Lanius collurio_Red-backed Shrike", "Ficedula parva_Red-breasted Flycatcher", "Mergus serrator_Red-breasted Merganser", "Netta rufina_Red-crested Pochard", "Tarsiger cyanurus_Red-flanked Bluetail", "Alectoris rufa_Red-legged Partridge", "Podiceps grisegena_Red-necked Grebe", "Caprimulgus ruficollis_Red-necked Nightjar", "Phalaropus lobatus_Red-necked Phalarope", "Cecropis daurica_Red-rumped Swallow", "Gavia stellata_Red-throated Diver", "Lagopus lagopus_Red Grouse", "Milvus milvus_Red Kite", "Tringa totanus_Redshank", "Phoenicurus phoenicurus_Redstart", "Turdus iliacus_Redwing", "Emberiza schoeniclus_Reed Bunting", "Acrocephalus scirpaceus_Reed Warbler", "Anthus richardi_Richard's Pipit", "Larus delawarensis_Ring-billed Gull", "Psittacula krameri_Ring-necked Parakeet", "Turdus torquatus_Ring Ouzel", "Charadrius hiaticula_Ringed Plover", "Erithacus rubecula_Robin", "Columba livia_Rock Dove", "Anthus petrosus_Rock Pipit", "Corvus frugilegus_Rook", "Pastor roseus_Rose-coloured Starling", "Sterna dougallii_Roseate Tern", "Buteo lagopus_Rough-legged Buzzard", "Oxyura jamaicensis_Ruddy Duck", "Tadorna ferruginea_Ruddy Shelduck", "Calidris pugnax_Ruff", "Xema sabini_Sabine's Gull", "Riparia riparia_Sand Martin", "Calidris alba_Sanderling", "Thalasseus sandvicensis_Sandwich Tern", "Locustella luscinioides_Savi's Warbler", "Aythya marila_Scaup", "Loxia scotica_Scottish Crossbill", "Acrocephalus schoenobaenus_Sedge Warbler", "Calidris pusilla_Semipalmated Sandpiper", "Serinus serinus_Serin", "Tadorna tadorna_Shelduck", "Eremophila alpestris_Shore Lark", "Asio flammeus_Short-eared Owl", "Calandrella brachydactyla_Short-toed Lark", "Spatula clypeata_Shoveler", "Spinus spinus_Siskin", "Alauda arvensis_Skylark", "Podiceps auritus_Slavonian Grebe", "Gallinago gallinago_Snipe", "Plectrophenax nivalis_Snow Bunting", "Anser caerulescens_Snow Goose", "Turdus philomelos_Song Thrush", "Accipiter nisus_Sparrowhawk", "Platalea leucorodia_Spoonbill", "Porzana porzana_Spotted Crake", "Muscicapa striata_Spotted Flycatcher", "Tringa erythropus_Spotted Redshank", "Actitis macularius_Spotted Sandpiper", "Sturnus vulgaris_Starling", "Columba oenas_Stock Dove", "Burhinus oedicnemus_Stone-curlew", "Saxicola rubicola_Stonechat", "Hydrobates pelagicus_Storm Petrel", "Sylvia cantillans_Subalpine Warbler", "Hirundo rustica_Swallow", "Apus apus_Swift", "Anser fabalis_Taiga Bean Goose", "Strix aluco_Tawny Owl", "Anas crecca_Teal", "Calidris temminckii_Temminck's Stint", "Anthus trivialis_Tree Pipit", "Passer montanus_Tree Sparrow", "Certhia familiaris_Treecreeper", "Aythya fuligula_Tufted Duck", "Anser serrirostris_Tundra Bean Goose", "Arenaria interpres_Turnstone", "Streptopelia turtur_Turtle Dove", "Linaria flavirostris_Twite", "Loxia leucoptera_Two-barred Crossbill", "Anthus spinoletta_Water Pipit", "Rallus aquaticus_Water Rail", "Bombycilla garrulus_Waxwing", "Oenanthe oenanthe_Wheatear", "Numenius phaeopus_Whimbrel", "Saxicola rubetra_Whinchat", "Anser albifrons_White-fronted Goose", "Calidris fuscicollis_White-rumped Sandpiper", "Haliaeetus albicilla_White-tailed Eagle", "Chlidonias leucopterus_White-winged Black Tern", "Ciconia ciconia_White Stork", "Sylvia communis_Whitethroat", "Cygnus cygnus_Whooper Swan", "Mareca penelope_Wigeon", "Poecile montanus_Willow Tit", "Phylloscopus trochilus_Willow Warbler", "Tringa glareola_Wood Sandpiper", "Phylloscopus sibilatrix_Wood Warbler", "Scolopax rusticola_Woodcock", "Lullula arborea_Woodlark", "Columba palumbus_Woodpigeon", "Troglodytes troglodytes_Wren", "Jynx torquilla_Wryneck", "Phylloscopus inornatus_Yellow-browed Warbler", "Larus michahellis_Yellow-legged Gull", "Motacilla flava_Yellow Wagtail", "Emberiza citrinella_Yellowhammer", "animals_animals", "vehicles_vehicles"];

// Get the modules loaded in preload.js
const fs = window.module.fs;
const colormap = window.module.colormap;
const p = window.module.p;
const SunCalc = window.module.SunCalc;
const uuidv4 = window.module.uuidv4;


/// Set up communication channel between UI and worker window

let worker;

const establishMessageChannel =
    new Promise((resolve) => {
        window.onmessage = (event) => {
            // event.source === window means the message is coming from the preload
            // script, as opposed to from an <iframe> or other source.
            if (event.source === window) {
                if (event.data === 'provide-worker-channel') {
                    [worker] = event.ports;
                    worker.postMessage({action: 'create message port'});
                    // Once we have the port, we can communicate directly with the worker
                    // process.
                    worker.onmessage = e => {
                        resolve(e.data);
                    }
                } else if (event.data.args) {
                    onLoadResults(event.data.args)
                }
            }
        }
    }).then((value) => {
        console.log(value);
    }, reason => {
        console.log(reason);
    });


async function getPaths() {
    const pathPromise = window.electron.getPath();
    const tempPromise = window.electron.getTemp();
    const appPath = await pathPromise;
    const tempPath = await tempPromise;
    console.log('path is ', appPath, 'temp is ', tempPath);
    return [appPath, tempPath];
}


let version;
let diagnostics = {};

window.electron.getVersion()
    .then((appVersion) => {
        version = appVersion;
        console.log('App version: ', appVersion);
        diagnostics['Chirpity Version'] = version;
    })
    .catch(e => {
        console.log('Error getting app version:', e)
    });

let modelReady = false, fileLoaded = false, currentFile;
let PREDICTING = false;
let region, AUDACITY_LABELS = [], wavesurfer;
let summary = {};
let fileList = [], fileStart, bufferStartTime, fileEnd;

let zero = new Date(Date.UTC(0, 0, 0, 0, 0, 0));
// set up some DOM element caches
let bodyElement = $('body');
let spectrogramWrapper = $('#spectrogramWrapper'), specElement, waveElement, specCanvasElement, specWaveElement;
let waveCanvasElement, waveWaveElement,
    resultTableElement = $('#resultTableContainer');
resultTableElement.animate({scrollTop: '300px'}, 400, 'swing');
let contentWrapperElement = $('#contentWrapper');

let completeDiv = $('#complete');
const resultTable = $('#resultTableBody')
const nocmigButton = document.getElementById('nocmigMode');
const summaryTable = $('#summaryTable');
let progressDiv = $('#progressDiv');
let progressBar = $('.progress .progress-bar');
const fileNumber = document.getElementById('fileNumber');
const timeOfDay = document.getElementById('timeOfDay');
const timecode = document.getElementById('timecode');
const timeline = document.getElementById('loadTimeline');
const inferno = document.getElementById('inferno');
const greys = document.getElementById('greys');
const loadSpectrogram = document.getElementById('loadSpectrogram');

let batchInProgress = false;
let activeRow;
let predictions = {}, speciesListItems,
    clickedIndex, speciesName, speciesFilter,
    subRows, scrolled, currentFileDuration;

let currentBuffer, bufferBegin = 0, windowLength = 20;  // seconds
let workerHasLoadedFile = false;

// Set content container height
contentWrapperElement.height(bodyElement.height() - 80);


// Set default Options
let config;
const sampleRate = 24000;
const audioCtx = new AudioContext({latencyHint: 'interactive', sampleRate: sampleRate});


//////// Collect Diagnostics Information ////////
// Diagnostics keys:
// GPUx - name of GPU(s)
// backend: tensorflow backend in use
// warmup: time to warm up model (seconds)
// "Analysis Duration": time on detections (seconds)
// "Audio Duration": length of audio (seconds)
// "Chirpity Version": app version
// "Tensorflow Backend"
// Analysis Rate: x real time performance

// Timers
let t0_warmup, t1_warmup, t0_analysis, t1_analysis;

const si = window.module.si;

// promises style - new since version 3
si.graphics()
    .then(data => {
        let count = 0;
        //console.log(data)
        data.controllers.forEach(gpu => {
            const key = `GPU[${count}]`;
            const vram = key + ' Memory';
            diagnostics[key] = gpu.name || gpu.vendor || gpu.model;
            diagnostics[vram] = gpu.vram ? gpu.vram + ' MB' : 'Dynamic';
            count += 1;
        })
    })
    .catch(error => console.error(error));

si.cpu()
    .then(data => {
        //console.log(data)
        const key = 'CPU';
        diagnostics[key] = `${data.manufacturer} ${data.brand}`;
        diagnostics['Cores'] = `${data.cores}`;
    })
    .catch(error => console.error(error));

si.mem()
    .then(data => {
        //console.log(data)
        const key = 'System Memory';
        diagnostics[key] = `${(data.total / (1024 * 1024 * 1000)).toFixed(0)} GB`;
    })
    .catch(error => console.error(error));
console.table(diagnostics);


function resetResults() {
    summary = {};
    summaryTable.empty();
    resultTable.empty();
    predictions = {};
    seenTheDarkness = false;
    shownDaylightBanner = false;
    progressDiv.hide();
    progressBar.width(0 + '%');
    progressBar.attr('aria-valuenow', 0);
    progressBar.html(0 + '%');
}

async function loadAudioFile(args) {
    let filePath = args.filePath, originalFileEnd = args.originalFileEnd;
    workerHasLoadedFile = false;
    try {
        fileEnd = fs.statSync(filePath).mtime;
        worker.postMessage({
            action: 'file-load-request',
            file: filePath,
            position: 0,
            list: config.list,
            warmup: config.warmup
        });
    } catch (e) {
        const supported_files = ['.mp3', '.wav', '.mpga', '.ogg', '.opus', '.flac', '.m4a', '.aac', '.mpeg', '.mp4'];
        const dir = p.parse(filePath).dir;
        const name = p.parse(filePath).name;
        let file;
        supported_files.some(ext => {
            try {
                file = p.join(dir, name + ext);
                fileEnd = fs.statSync(file).mtime;
            } catch (e) {
                // Try the next extension
            }
            return fileEnd;
        });
        if (fileEnd) {
            if (file) {
                filePath = file;
            }
            if (originalFileEnd) {
                fileEnd = originalFileEnd;
            }
            worker.postMessage({
                action: 'file-load-request',
                file: filePath,
                preserveResults: args.preserveResults,
                position: 0,
                warmup: config.warmup,
                list: config.list
            });
        } else {
            alert("Unable to load source file with any supported file extension: " + filePath)
        }
    }
}

$(document).on("click", ".openFiles", async function (e) {
    if (!PREDICTING) {
        await loadAudioFile({filePath: e.target.id, preserveResults: true})
    }
    e.stopImmediatePropagation()
});

function updateSpec(buffer, play) {
    updateElementCache();
    wavesurfer.loadDecodedBuffer(buffer);
    waveCanvasElement.width('100%');
    specCanvasElement.width('100%');
    $('.spec-labels').width('55px');
    adjustSpecDims(true);
    if (play) {
        wavesurfer.play()
    }
}

function createTimeline() {
    wavesurfer.addPlugin(WaveSurfer.timeline.create({
        container: '#timeline',
        formatTimeCallback: formatTimeCallback,
        timeInterval: timeInterval,
        primaryLabelInterval: primaryLabelInterval,
        secondaryLabelInterval: secondaryLabelInterval,
        primaryColor: 'white',
        secondaryColor: 'white',
        primaryFontColor: 'white',
        secondaryFontColor: 'white',
        fontSize: 14
    })).initPlugin('timeline');
}

function initWavesurfer(args) {
    if (args.reset) {
        // Show spec and timecode containers
        hideAll();
        showElement(['spectrogramWrapper'], false);
    }
    if (wavesurfer) {
        wavesurfer.pause();
    }
    // Setup waveform and spec views
    wavesurfer = WaveSurfer.create({
        container: '#waveform',
        audioContext: audioCtx,
        backend: args.backend, // 'MediaElementWebAudio',
        // make waveform transparent
        backgroundColor: 'rgba(0,0,0,0)',
        waveColor: 'rgba(109,41,164,' + args.alpha + ')',
        progressColor: 'rgba(109,41,164,' + args.alpha + ')',
        // but keep the playhead
        cursorColor: '#fff',
        cursorWidth: 2,
        skipLength: 0.1,
        partialRender: true,
        scrollParent: false,
        fillParent: true,
        responsive: true,
        height: args.height,
        plugins: [
            WaveSurfer.regions.create({
                formatTimeCallback: formatRegionTooltip,
                dragSelection: true,
                slop: 5,
                color: "rgba(255, 255, 255, 0.2)"
            })
        ]
    });
    if (config.spectrogram) {

        initSpectrogram()
    }
    if (config.timeline) {
        createTimeline()
    }
    wavesurfer.loadDecodedBuffer(args.audio);
    updateElementCache();

    config.colormap === 'greys' ? greys.clicked = true : inferno.clicked = true;
    // Set click event that removes all regions
    waveElement.mousedown(function () {
        wavesurfer.clearRegions();
        region = false;
        disableMenuItem(['analyzeSelection', 'exportMP3']);
        if (workerHasLoadedFile) enableMenuItem(['analyze']);
    });
    // Enable analyse selection when region created
    wavesurfer.on('region-created', function (e) {
        region = e;
        enableMenuItem(['exportMP3']);
        if (modelReady) {
            enableMenuItem(['analyzeSelection']);
        }
    });

    wavesurfer.on('finish', function () {
        if (currentFileDuration > bufferBegin + windowLength) {
            bufferBegin += windowLength;
            worker.postMessage({
                action: 'update-buffer',
                file: currentFile,
                position: 0,
                start: bufferBegin,
                end: bufferBegin + windowLength,
                play: true
            });
            wavesurfer.play()
        }
    });
    // Show controls
    showElement(['controlsWrapper']);
    updateElementCache();
    // Resize canvas of spec and labels
    adjustSpecDims(false);
}

function updateElementCache() {
    // Update element caches
    dummyElement = $('#dummy');
    waveElement = $('#waveform');

    specElement = $('spectrogram');
    specCanvasElement = $('#spectrogram canvas');
    waveCanvasElement = $('#waveform canvas');
    waveWaveElement = $('#waveform wave');
    specWaveElement = $('#spectrogram wave')
}

function zoomSpec(direction) {
    let offsetSeconds = wavesurfer.getCurrentTime();
    let position = offsetSeconds / windowLength;
    let timeNow = bufferBegin + offsetSeconds;
    if (direction === 'in') {
        if (windowLength < 1.5) return;
        windowLength /= 2;
        bufferBegin += windowLength * position;
    } else {
        if (windowLength > 100 || windowLength === currentFileDuration) return;
        bufferBegin -= windowLength * position;
        windowLength = Math.min(currentFileDuration, windowLength * 2);

        if (bufferBegin < 0) {
            bufferBegin = 0;
        } else if (bufferBegin + windowLength > currentFileDuration) {
            bufferBegin = currentFileDuration - windowLength

        }
    }
    // Keep playhead at same time in file
    position = (timeNow - bufferBegin) / windowLength;
    worker.postMessage({
        action: 'update-buffer',
        file: currentFile,
        position: position,
        start: bufferBegin,
        end: bufferBegin + windowLength
    })
}

async function showOpenDialog() {
    const dialogConfig = {
        filters: [{
            name: 'Audio Files',
            extensions: ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'mpga', 'mpeg', 'mp4']
        }],
        properties: ['openFile', 'multiSelections']
    };
    const files = await window.electron.openDialog('showOpenDialog', dialogConfig);
    if (!files.canceled) await onOpenFiles({filePaths: files.filePaths});
}

// function updateFileName(files, openfile) {
//
//     let filenameElement = document.getElementById('filename');
//     filenameElement.innerHTML = '';
//
//     let appendstr = '<div id="fileContainer" class="d-inline-block position-absolute bg-dark text-nowrap pe-3">';
//     if (files.length > 1) {
//         appendstr += '<span class="material-icons-two-tone pointer">library_music</span>';
//     } else {
//         appendstr += '<span class="material-icons-two-tone align-bottom">audio_file</span>';
//     }
//     files.forEach(item => {
//         if (item === openfile) {
//             appendstr += `<span class="revealFiles visible pointer" id="${item}">`;
//
//         } else {
//             appendstr += `<span class="openFiles pointer" id="${item}">`;
//         }
//         appendstr += item.replace(/^.*[\\\/]/, "") + '</span>';
//
//     })
//     filenameElement.innerHTML += appendstr + '</div>';
// }
function updateFileName(files, openfile) {
    let filenameElement = document.getElementById('filename');
    filenameElement.innerHTML = '';
    let label = openfile.replace(/^.*[\\\/]/, "");
    let appendStr;
    if (files.length > 1) {
        appendStr = `<div id="fileContainer" class="dropup">
        <button class="btn btn-secondary dropdown-toggle" type="button" id="dropdownMenuButton1"
                data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
        <span id="setFileStart" title="Amend recording start time"
                  class="material-icons-two-tone align-bottom pointer">edit_calendar</span> ${label}
        </button><div class="dropdown-menu dropdown-menu-dark top-level" aria-labelledby="dropdownMenuButton1">`;
        files.forEach(item => {
            if (item !== openfile) {
                const label = item.replace(/^.*[\\\/]/, "");
                appendStr += `<a id="${item}" class="dropdown-item openFiles" href="#">
                <span class="material-icons-two-tone align-bottom">audio_file</span>${label}</a>`;
            }
        })
        appendStr += `</div></div>`;
    } else {
        appendStr = `<div id="fileContainer">
        <button class="btn btn-secondary" type="button">
        <span id="setFileStart" title="Amend recording start time"
                  class="material-icons-two-tone align-bottom pointer">edit_calendar</span> ${label}
        </button></div>`;
    }

    filenameElement.innerHTML = appendStr;
    $(function () {
        $('#setFileStart').daterangepicker({
            singleDatePicker: true,
            showDropdowns: true,
            // file start is undefined at this point
            startDate: moment(fileStart),
            minYear: 2015,
            maxDate: moment(),
            maxYear: parseInt(moment().format('YYYY')),
            timePicker: true,
            timePicker24Hour: true,
            locale: {
                applyLabel: 'Set Recording Start Time'
            }
        }, function (start, end, label) {
            fileStart = start.toDate().getTime();
            worker.postMessage({action: 'update-file-start', file: currentFile, start: fileStart});
        });
    });
}

async function onOpenFiles(args) {
    hideAll();
    showElement(['spectrogramWrapper'], false)
    resetResults();
    completeDiv.hide();
    // Store the file list and Load First audio file
    fileList = args.filePaths;

    // Sort file by time created (the oldest first):
    if (fileList.length > 1) {
        if (modelReady) analyzeAllLink.classList.remove('disabled');
        fileList = fileList.map(fileName => ({
            name: fileName,
            time: fs.statSync(fileName).mtime.getTime(),
        }))
            .sort((a, b) => a.time - b.time)
            .map(file => file.name);
    } else {
        analyzeAllLink.classList.add('disabled');
    }
    updateFileName(fileList, fileList[0]);
    await loadAudioFile({filePath: fileList[0]});
    currentFile = fileList[0];

    disableMenuItem(['analyzeSelection', 'analyze', 'analyzeAll'])
    // Reset the buffer playhead and zoom:
    bufferBegin = 0;
    windowLength = 20;
    if (!config.spectrogram) {
        // Show controls
        showElement(['controlsWrapper']);
        $('.specFeature').hide()
    }
}

async function onLoadResults(args) {
    console.log("result file received: " + args.file)
    //await loadChirp(args.file);
}

/**
 *
 *
 * @returns {Promise<void>}
 */
async function showSaveDialog() {
    await window.electron.saveFile({currentFile: currentFile, labels: AUDACITY_LABELS});
}

// Worker listeners
function analyseReset() {
    fileNumber.innerText = '';
    PREDICTING = true;
    delete diagnostics['Audio Duration'];
    AUDACITY_LABELS = [];
    completeDiv.hide();
    progressDiv.show();
    // Diagnostics
    t0_analysis = Date.now();
}

function isEmptyObject(obj) {
    for (const i in obj) return false;
    return true
}

function refreshResultsView() {
    hideAll();
    if (fileLoaded) {
        showElement(['spectrogramWrapper'], false);
        if (!isEmptyObject(predictions)) showElement(['resultTableContainer'], false);
    } else {
        showElement(['loadFileHint', 'loadFileHintText'], true);
    }
    adjustSpecDims(true);
}

// const navbarAnalysis = document.getElementById('navbarAnalysis');
// navbarAnalysis.addEventListener('click', async () => {
//     refreshResultsView();
// });

const analyzeLink = document.getElementById('analyze');
//speciesExclude = document.querySelectorAll('speciesExclude');
analyzeLink.addEventListener('click', async () => {
    refreshResultsView()
    postAnalyzeMessage({confidence: config.minConfidence, resetResults: true, files: [currentFile], selection: false});
});

const analyzeAllLink = document.getElementById('analyzeAll');
analyzeAllLink.addEventListener('click', async () => {
    refreshResultsView();
    postAnalyzeMessage({confidence: config.minConfidence, resetResults: true, files: fileList, selection: false});
});

const analyzeSelectionLink = document.getElementById('analyzeSelection');
analyzeSelectionLink.addEventListener('click', async () => {
    refreshResultsView();
    delete diagnostics['Audio Duration'];
    analyseReset();
    progressDiv.show();
    const start = region.start + bufferBegin;
    let end = region.end + bufferBegin;
    if (end - start < 0.5) {
        region.end = region.start + 0.5;
        end = start + 0.5
    }
    postAnalyzeMessage({
        confidence: 0.1,
        resetResults: false,
        files: [currentFile],
        start: start,
        end: end,
        selection: true
    });
    summary = {};
});

function postAnalyzeMessage(args) {
    analyseReset();
    if (args.resetResults) {
        resetResults();
    } else {
        progressDiv.show();
        delete diagnostics['Audio Duration'];
    }
    args.files.forEach(file => {
        worker.postMessage({
            action: 'analyze',
            confidence: args.confidence,
            resetResults: args.resetResults,
            start: args.start,
            end: args.end,
            nocmig: config.nocmig,
            lat: config.latitude,
            lon: config.longitude,
            filePath: file,
            selection: args.selection
        });
    })
    if (args.files.length > 1) {
        batchInProgress = true;
        fileNumber.innerText = `(File 1 of ${fileList.length})`;
    }
}


// Menu bar functions

function exitApplication() {
    window.close()
}

function enableMenuItem(id_list) {
    id_list.forEach(id => {
        $('#' + id).removeClass('disabled');
    })
}

function disableMenuItem(id_list) {
    id_list.forEach(id => {
        $('#' + id).addClass('disabled');
    })
}

function showElement(id_list, makeFlex = true, empty = false) {
    id_list.forEach(id => {
        const thisElement = $('#' + id);
        //thisElement.show();
        thisElement.removeClass('d-none');
        if (makeFlex) thisElement.addClass('d-flex');
        if (empty) {
            thisElement.height(0);
            thisElement.empty()
        }
    })
}

function hideElement(id_list) {
    id_list.forEach(id => {
        const thisElement = $('#' + id);
        thisElement.removeClass('d-flex');
        thisElement.addClass('d-none');
    })
}

function hideAll() {
    // File hint div,  Waveform, timeline and spec, controls and result table
    hideElement(['loadFileHint', 'loadFileHintText', 'loadFileHintSpinner', 'exploreWrapper',
        'spectrogramWrapper', 'resultTableContainer', 'recordsContainer']);
}

const save2dbLink = document.getElementById('save2db');
save2dbLink.addEventListener('click', async () => {
    worker.postMessage({action: 'save2db'})
});

const chartsLink = document.getElementById('charts');
chartsLink.addEventListener('click', async () => {
    worker.postMessage({action: 'get-detected-species'});
    hideAll();
    showElement(['recordsContainer']);
    worker.postMessage({action: 'chart', species: undefined, range: {}});
});

const exploreLink = document.getElementById('explore');
exploreLink.addEventListener('click', async () => {
    worker.postMessage({action: 'get-detected-species'});
    hideAll();
    showElement(['exploreWrapper', 'spectrogramWrapper'], false);
    adjustSpecDims(true);
});

const datasetLink = document.getElementById('dataset');
datasetLink.addEventListener('click', async () => {
    const dataset_results = Object.values(predictions);
    worker.postMessage({action: 'create-dataset', results: dataset_results});
    //worker.postMessage({action: 'create-dataset', fileList: fileList});
});

const thresholdLink = document.getElementById('threshold');
thresholdLink.addEventListener('blur', (e) => {
    const threshold = e.target.value
    if (100 >= threshold && threshold >= 0) {
        config.minConfidence = parseFloat(e.target.value) / 100;
        updatePrefs();
    } else {
        e.target.value = config.minConfidence * 100;
    }
});


function createRegion(start, end, label) {
    wavesurfer.pause();
    wavesurfer.clearRegions();
    wavesurfer.addRegion({
        start: start,
        end: end,
        color: "rgba(255, 255, 255, 0.2)",
        attributes: {
            label: label
        }
    });
    const progress = start / wavesurfer.getDuration();
    wavesurfer.seekAndCenter(progress);
}

const tbody = document.getElementById('resultTableBody')
tbody.addEventListener('click', function (e) {
    if (activeRow) activeRow.classList.remove('table-active')
    const row = e.target.closest('tr');
    row.classList.add('table-active');
    activeRow = row;
    loadResultRegion(row.attributes[0].value.split('|'));
    // if (!onScreen(row)) {
    //     scrollResults(row);
    // }
})
//
// tbody.addEventListener('dblclick', function (e) {
//     const row = e.target.closest('tr');
//     row.querySelector('.edit').click();
// })

function loadResultRegion(paramlist) {
    // Accepts global start and end timecodes from model detections
    // Need to find and centre a view of the detection in the spectrogram
    // 3 second detections
    let [file, start, end, label] = paramlist;
    // Let the UI know what file's being loaded
    currentFile = file;
    start = parseFloat(start);
    end = parseFloat(end);
    bufferBegin = Math.max(0, start - (windowLength / 2) + 1.5)
    if (!wavesurfer) {
        spectrogramWrapper.removeClass('d-none');
        adjustSpecDims(true)
    }
    worker.postMessage({
        action: 'update-buffer',
        file: file,
        position: wavesurfer.getCurrentTime() / windowLength,
        start: bufferBegin,
        end: bufferBegin + windowLength,
        region: {start: Math.max(start - bufferBegin, 0), end: end - bufferBegin, label: label}
    });
}

/**
 * Sets the height of elements on the results pages.
 * @param redraw
 */
function adjustSpecDims(redraw, fftSamples) {
    contentWrapperElement.height(bodyElement.height() - 80);
    const contentHeight = contentWrapperElement.height();
    const exploreWrapperElement = document.getElementById('exploreWrapper');
    const formOffset = exploreWrapperElement.offsetHeight;
    const specWrapperElement = document.getElementById('spectrogramWrapper');
    let specOffset;
    if (!spectrogramWrapper.hasClass('d-none')) {
        // Expand up to 512px unless fullscreen
        const timelineHeight = config.timeline ? 0 : 20;
        const specHeight = config.fullscreen ? contentHeight + timelineHeight - 70 : Math.min(contentHeight * 0.4, 512);

        if (currentFile) {
            // give the wrapper space for the transport controls and element padding/margins
            spectrogramWrapper.height(specHeight + 21 + 46.84);
            if (!wavesurfer) {
                initWavesurfer({
                    audio: currentBuffer,
                    backend: 'WebAudio',
                    alpha: 0,
                    height: specHeight,
                    reset: false
                });
            }
            wavesurfer.setHeight(specHeight);
            initSpectrogram(specHeight, fftSamples);
            specCanvasElement.width('100%');
            specElement.css('z-index', 0);
            $('.spec-labels').width('55px')
        }
        if (wavesurfer && redraw) wavesurfer.drawBuffer();
        specOffset = specWrapperElement.offsetHeight;
    } else {
        specOffset = 0
    }
    resultTableElement.height(contentHeight - specOffset - formOffset);
}


///////////////////////// Timeline Callbacks /////////////////////////

/**
 * Use formatTimeCallback to style the notch labels as you wish, such
 * as with more detail as the number of pixels per second increases.
 *
 * Here we format as M:SS.frac, with M suppressed for times < 1 minute,
 * and frac having 0, 1, or 2 digits as the zoom increases.
 *
 * Note that if you override the default function, you'll almost
 * certainly want to override timeInterval, primaryLabelInterval and/or
 * secondaryLabelInterval so they all work together.
 *
 * @param: seconds
 * @param: pxPerSec
 */


function formatRegionTooltip(start, end) {
    const length = end - start;
    if (length === 3) {
        return `${formatTimeCallback(start)} -  ${formatTimeCallback(end)}`;
    } else if (length < 1) return `Region length: ${(length * 1000).toFixed(0)} ms`
    else {
        return `Region length: ${length.toFixed(3)} seconds`
    }
}

function formatTimeCallback(secs) {
    secs = secs.toFixed(2);
    const now = new Date(bufferStartTime.getTime() + (secs * 1000))
    const milliSeconds = now.getMilliseconds();
    let seconds = now.getSeconds();
    const minutes = now.getMinutes();
    const hours = now.getHours();

    // fill up seconds with zeroes
    let secondsStr;
    if (windowLength >= 5) {
        secondsStr = seconds.toString();
    } else {
        let fraction = Math.round(milliSeconds / 100);
        if (fraction === 10) {
            seconds += 1;
            fraction = 0;
        }
        secondsStr = seconds.toString() + '.' + fraction.toString();
    }
    if (hours > 0 || minutes > 0 || config.timeOfDay) {
        if (seconds < 10) {
            secondsStr = '0' + secondsStr;
        }
    } else if (!config.timeOfDay) {
        return secondsStr;
    }
    let minutesStr = minutes.toString();
    if (config.timeOfDay || hours > 0) {
        if (minutes < 10) {
            minutesStr = '0' + minutesStr;
        }
    } else if (!config.timeOfDay) {
        return `${minutes}:${secondsStr}`
    }
    if (hours < 10 && config.timeOfDay) {
        let hoursStr = '0' + hours.toString();
        return `${hoursStr}:${minutesStr}:${secondsStr}`
    }
    return `${hours}:${minutesStr}:${secondsStr}`
}

/**
 * Use timeInterval to set the period between notches, in seconds,
 * adding notches as the number of pixels per second increases.
 *
 * Note that if you override the default function, you'll almost
 * certainly want to override formatTimeCallback, primaryLabelInterval
 * and/or secondaryLabelInterval so they all work together.
 *
 * @param: pxPerSec
 */
function timeInterval(pxPerSec) {
    let retval;
    const mulFactor = window.devicePixelRatio || 1;
    const threshold = pxPerSec / mulFactor;
    if (threshold >= 2500) {
        retval = 0.01;
    } else if (threshold >= 1000) {
        retval = 0.025;
    } else if (threshold >= 250) {
        retval = 0.1;
    } else if (threshold >= 100) {
        retval = 0.25;
    } else if (threshold >= 25) {
        retval = 5;
    } else if (threshold >= 5) {
        retval = 10;
    } else if (threshold >= 2) {
        retval = 15;
    } else {
        retval = Math.ceil(0.5 / threshold) * 60;
    }
    return retval;
}

/**
 * Return the cadence of notches that get labels in the primary color.
 * EG, return 2 if every 2nd notch should be labeled,
 * return 10 if every 10th notch should be labeled, etc.
 *
 * Note that if you override the default function, you'll almost
 * certainly want to override formatTimeCallback, primaryLabelInterval
 * and/or secondaryLabelInterval so they all work together.
 *
 * @param pxPerSec
 */
function primaryLabelInterval(pxPerSec) {
    let retval;
    const mulFactor = window.devicePixelRatio || 1;
    const threshold = pxPerSec / mulFactor;
    if (threshold >= 2500) {
        retval = 10;
    } else if (threshold >= 1000) {
        retval = 4;
    } else if (threshold >= 250) {
        retval = 10;
    } else if (threshold >= 100) {
        retval = 4;
    } else if (threshold >= 20) {
        retval = 1;
    } else if (threshold >= 5) {
        retval = 5;
    } else if (threshold >= 2) {
        retval = 15;
    } else {
        retval = Math.ceil(0.5 / threshold) * 60;
    }
    return retval;
}

/**
 * Return the cadence of notches to get labels in the secondary color.
 * EG, return 2 if every 2nd notch should be labeled,
 * return 10 if every 10th notch should be labeled, etc.
 *
 * Secondary labels are drawn after primary labels, so if
 * you want to have labels every 10 seconds and another color labels
 * every 60 seconds, the 60 second labels should be the secondaries.
 *
 * Note that if you override the default function, you'll almost
 * certainly want to override formatTimeCallback, primaryLabelInterval
 * and/or secondaryLabelInterval so they all work together.
 *
 * @param pxPerSec
 */
function secondaryLabelInterval(pxPerSec) {
    // draw one every 1s as an example
    return Math.floor(1 / timeInterval(threshold));
}

////////// Store preferences //////////

function updatePrefs() {
    try {
        fs.writeFileSync(p.join(appPath, 'config.json'), JSON.stringify(config))
    } catch (e) {
        console.log(e)
    }
}


/////////////////////////  Window Handlers ////////////////////////////
let appPath, tempPath;
window.onload = async () => {
    // Set config defaults

    config = {
        spectrogram: true,
        colormap: 'inferno',
        timeline: true,
        minConfidence: 0.45,
        timeOfDay: false,
        list: 'migrants',
        latitude: 51.9,
        longitude: -0.4,
        nocmig: false,
        warmup: true,
        batchSize: 1
    }
    config.UUID = uuidv4();
    // Load preferences and override defaults
    [appPath, tempPath] = await getPaths();
    worker.postMessage({
        action: 'load-db',
        path: appPath,
        temp: tempPath,
        lat: config.latitude,
        lon: config.longitude
    })

    fs.readFile(p.join(appPath, 'config.json'), 'utf8', (err, data) => {
        if (err) {
            console.log('JSON parse error ' + err);
            // If file read error, use defaults, set new UUID
            config.UUID = uuidv4();
            updatePrefs();
            return
        }
        config = JSON.parse(data)

        // Check for keys - in case updates have added new ones
        if (!('UUID' in config)) {
            config.UUID = uuidv4();
        }
        if (!('batchSize' in config)) {
            config.batchSize = 1;
        }
        if (!('latitude' in config)) {
            config.latitude = 51.9
        }
        if (!('longitude' in config)) {
            config.longitude = -0.4
        }
        if (!('nocmig' in config)) {
            config.nocmig = false;
        }
        if (!('list' in config)) {
            config.list = 'migrants';
        }
        if (!('warmup' in config)) {
            config.warmup = false;
        }
        // Never open fullscreen to begin with and don't remember setting
        config.fullscreen = false;
        updatePrefs()

        // Set UI option state
        const batchSizeElement = document.getElementById(config.batchSize);
        batchSizeElement.checked = true;
        //warmup.checked = config.warmup;
        // Show time of day in results?
        const timestamp = document.querySelectorAll('.timestamp');
        if (!config.timeOfDay) {
            timestamp.forEach(el => {
                el.classList.add('d-none')
            })
        }
        // Add a checkmark to the list in use
        window[config.list].checked = true;

        if (!config.spectrogram) {
            loadSpectrogram.checked = false;
            timeOfDay.disabled = true;
            timecode.disabled = true;
            inferno.disabled = true;
            greys.disabled = true;
        } else {
            loadSpectrogram.checked = true;
        }
        //Timeline settings
        if (!config.timeline) {
            timeline.checked = false;
            timeOfDay.disabled = true;
            timecode.disabled = true;
        } else {
            timeline.checked = true;
        }
        config.timeOfDay ? timeOfDay.checked = true : timecode.checked = true;
        // Spectrogram colour
        config.colormap === 'inferno' ? inferno.checked = true : greys.checked = true;
        // Nocmig mode state
        console.log('nocmig mode is ' + config.nocmig)
        nocmigButton.innerText = config.nocmig ? 'bedtime' : 'bedtime_off';

        thresholdLink.value = config.minConfidence * 100;

        showElement([config.colormap + 'span'], true)
        worker.postMessage({
            action: 'load-model',
            list: config.list,
            batchSize: config.batchSize,
            warmup: config.warmup
        });
    })
    // establish the message channel
    establishMessageChannel.then((success) => {
        t0_warmup = Date.now();
        worker.addEventListener('message', function (e) {
            const args = e.data;
            const event = args.event;
            switch (event) {
                case 'model-ready':
                    onModelReady(args);
                    break;
                case 'seen-species-list':
                    generateBirdList('seenSpecies', args.list);
                    break;
                case 'prediction-done':
                    onPredictionDone(args);
                    break;
                case 'progress':
                    onProgress(args);
                    break;
                case 'prediction-ongoing':
                    renderResult(args);
                    break;
                case 'update-audio-duration':
                    diagnostics['Audio Duration'] ?
                        diagnostics['Audio Duration'] += args.value :
                        diagnostics['Audio Duration'] = args.value;
                    break;
                case 'spawning':
                    displayWarmUpMessage();
                    break;
                case 'promptToSave':
                    if (confirm("Save results to your archive?")) {
                        worker.postMessage({action: 'save2db'})
                    }
                    break;
                case 'worker-loaded-audio':
                    onWorkerLoadedAudio(args);
                    break;
                case 'chart-data':
                    onChartData(args);
                    break;
                case 'reset-results':
                    resetResults();
                    break;
                case 'generate-alert':
                    alert(args.message)
                    break;
            }
        })
    })
    // Set footer year
    $('#year').text(new Date().getFullYear());
    // Put the bird list in its parking lot
    generateBirdList('allSpecies');
    //Cache list elements
    speciesListItems = $('#bird-list li span');
};


function generateBirdList(store, rows) {
    let listHTML;
    if (store === 'allSpecies') {
        listHTML = `
            <div class="bird-list all"><div class="rounded-border"><ul>
            <li><a href="#">Animal</a></li>
            <li><a href="#">Ambient Noise</a></li>
            <li><a href="#">Human</a></li>
            <li><a href="#">Vehicle</a></li>`;
        const excluded = new Set(['human', 'vehicles', 'animals', 'No call']);
        for (const item in labels) {
            const [sname, cname] = labels[item].split('_');
            if (!excluded.has(cname)) {
                listHTML += `<li><a href="#">${cname} - ${sname}</a></li>`;
            }
        }
    } else {
        listHTML = '<div class="bird-list seen"><div class="rounded-border"><ul class="request-bird">';
        for (const item in rows) {
            listHTML += `<li><a href="#">${rows[item].cname} - ${rows[item].sname}</a></li>`;
        }
    }
    const parking = document.getElementById(store);
    listHTML += '</ul></div></div>';
    parking.innerHTML = listHTML;
}

// Search list handlers
const fullListStore = document.getElementById('allSpecies');
const seenListStore = document.getElementById('seenSpecies');

$(document).on('focus', '.input', function () {
    document.removeEventListener('keydown', handleKeyDown, true);
    const container = this.parentNode.querySelector('.bird-list-wrapper');
    if (container.classList.contains('editing')) {
        const theList = document.querySelector('#allSpecies .bird-list')
        container.appendChild(theList);
    } else {
        const theList = document.querySelector('#seenSpecies .bird-list')
        container.appendChild(theList);
    }
    if (this.id === "speciesSearch") hideElement(['dataRecords']);

})

$(document).on('blur', '.input', function () {
    document.addEventListener('keydown', handleKeyDown, true);
    // Use timeout to allow a click event on the list to fire
    setTimeout(hideBirdList, 250, this.parentNode);
})

function hideBirdList(el) {
    const list = el.querySelector('.bird-list');
    const container = el.closest('.species-selector').querySelector('.bird-list-wrapper');
    // Move the bird list back to its parking spot before updating the cname cell
    if (container.classList.contains('editing')) {
        if (list) fullListStore.appendChild(list);
        const cnameCell = el.closest('.cname');
        if (cnameCell) cnameCell.innerHTML = restoreSpecies;
    } else {
        if (list) seenListStore.appendChild(list);
    }
}

let restoreSpecies, currentID;

$(document).on('click', '.edit', editID);
$(document).on('dblclick', '.cname', editID);

function editID(e) {
    e.stopImmediatePropagation();
    getSpeciesIndex(e);
    const currentRow = e.target.closest('tr');
    let cname = currentRow.querySelector('.cname');
    // save the original cell contents in case edit is aborted or doesn't change species
    restoreSpecies = cname.innerHTML;
    // save the original species to use in batch edit search
    const speciesTextContainer = cname.querySelector('span.pointer') || cname;
    currentID = speciesTextContainer.innerHTML;
    cname.innerHTML = `<div id='edit' class="species-selector"><input type="text" class="input rounded-pill" id="editInput" 
                    placeholder="${cname.innerText}"><div class="editing bird-list-wrapper"></div></div>`;
    document.getElementById('editInput').focus();
}

// Bird list filtering
$(document).on('keyup', '.input', filterList);

function filterList(e) {
    const input = e.target;
    const filter = input.value.toUpperCase();
    const ul = input.parentNode.querySelector("ul");
    const li = ul.getElementsByTagName('li');
    const theList = document.querySelector('.bird-list')
    theList.classList.remove('d-none');
    // Loop through all list items, and hide those who don't match the search query
    for (let i = 0; i < li.length; i++) {
        const a = li[i].getElementsByTagName("a")[0];
        const txtValue = a.textContent || a.innerText;
        if (txtValue.toUpperCase().indexOf(filter) > -1) {
            li[i].style.display = "";
        } else {
            li[i].style.display = "none";
        }
    }
}

let t0;
let chartSpecies, exploreSpecies;

function formatInputText(species) {
    species = formatSpeciesName(species);
    let [cname, latin] = species.split('~');
    cname = cname.replace(/_/g, ' ',);
    latin = latin.replace(/_/g, ' ');
    const speciesLabel = `${cname} (${latin})`;
    return [speciesLabel, cname];
}

$(document).on('click', '.bird-list', function (e) {
    const [speciesLabel,] = formatInputText(e.target.innerText)
    const input = this.closest('.species-selector').querySelector('input');
    input.value = speciesLabel;
    const container = this.closest('.species-selector').querySelector('.bird-list-wrapper');
    if (container.classList.contains('editing')) {
        let species = e.target.innerText;
        let [cname, sname] = species.split(' - ');
        // Handle animal, vehicle, etc.
        if (!sname) sname = cname;
        const cnameCell = this.closest('.cname');
        // Move the bird list back to its parking spot before updating the cname cell
        const theList = document.querySelector('.bird-list.all');
        fullListStore.appendChild(theList);
        // Make sure we update the restore species
        restoreSpecies = cnameCell.innerHTML;
        // Are we batch editing here?
        const context = cnameCell.closest('table').id;
        context === 'results' ? editResult(cname, sname, cnameCell) : batchEditResult(cname, sname, cnameCell);
    }
})

function editResult(cname, sname, cell) {
    cell.innerHTML = `${cname} <i>${sname}</i>`;
    // Update the name attribute (it must be the first attribute in the tag.)
    const [file, start, end, currentRow] = unpackNameAttr(cell, cname);
    updateRecordID(file, start, end, cname, sname);
    updateSummary();
    // reflect the change on the spectrogram by simulating a click
    currentRow.click();
}

function batchEditResult(cname, sname, cell) {
    cell.innerHTML = `<span class="spinner-border spinner-border-sm text-success d-none" role="status"></span>
    <span id="${cname} ${sname}" class="pointer">${cname} <i>${sname}</i></span>`;
    speciesName.forEach(el => {
        // Update matching row name attrs so labels update on the region
        if (el.innerHTML === currentID) {
            clickedIndex = el.closest('tr').querySelector('th').innerText;
            const [file, start, end, ,] = unpackNameAttr(el, cname);
            updateRecordID(file, start, end, cname, sname);
            el.innerHTML = `${cname} <i>${sname}</i>`;
        }
    })
    updateSummary();
}

function unpackNameAttr(el, cname) {
    const currentRow = el.closest("tr");
    const nameAttr = currentRow.attributes[0].value;
    let [file, start, end, commonName] = nameAttr.split('|');
    if (cname) commonName = cname;
    currentRow.attributes[0].value = [file, start, end, commonName].join('|');
    return [file, start, end, currentRow];
}


function updateRecordID(file, start, end, cname, sname) {
    worker.postMessage({action: 'update-record', file: file, start: start, what: 'ID', value: cname});
    predictions[clickedIndex].cname = cname;
    predictions[clickedIndex].sname = sname;
    predictions[clickedIndex].filename =
        `${cname.replace(/\s+/g, '_')}~${sname.replace(/\s+/g, '_')}~${Date.parse(predictions[clickedIndex].date)}.mp3`;
    sendFile('incorrect', predictions[clickedIndex]);
}

$(document).on('click', '.request-bird', function (e) {
    const [, cname] = formatInputText(e.target.innerText)
    const context = this.closest('.bird-list-wrapper').classList[0];
    let pickerEl = context + 'Range';
    t0 = Date.now();
    context === 'chart' ? chartSpecies = cname : exploreSpecies = cname;
    const picker = $('#' + pickerEl).data('daterangepicker');
    const start = picker.startDate._d.getTime();
    const end = picker.endDate._d.getTime();
    const dateRange = end !== start ? {start: start, end: end} : {};
    worker.postMessage({action: context, species: cname, range: dateRange})
})


// Chart functions
function getDateOfISOWeek(w) {
    const options = {month: 'long', day: 'numeric'};
    const y = new Date().getFullYear();
    const simple = new Date(y, 0, 1 + (w - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4)
        ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else
        ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    return ISOweekStart.toLocaleDateString('en-GB', options);
}


function onChartData(args) {
    const genTime = Date.now() - t0;
    const genTimeElement = document.getElementById('genTime')
    genTimeElement.innerText = (genTime / 1000).toFixed(1) + ' seconds';
    if (args.species) showElement(['dataRecords'], false);
    const elements = document.getElementsByClassName('highcharts-data-table');
    while (elements.length > 0) {
        elements[0].parentNode.removeChild(elements[0]);
    }
    const records = args.records;
    for (const [key, value] of Object.entries(records)) {
        const element = document.getElementById(key);
        if (value && value.constructor === Array) {
            if (isNaN(value[0])) element.innerText = 'N/A';
            else {
                element.innerText = value[0].toString() + ' on ' +
                    new Date(value[1]).toLocaleDateString(undefined, {dateStyle: "short"})
            }
        } else {
            element.innerText = value ? new Date(value).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric"
            }) : 'No Records';
        }
    }
    const results = args.results;
    const rate = args.rate;
    const total = args.total;
    const dataPoints = args.dataPoints;
    const aggregation = args.aggregation;
    const pointStart = args.pointStart;
    const chartOptions = setChartOptions(args.species, total, rate, results, dataPoints, aggregation, pointStart);
    Highcharts.chart('chart-week', chartOptions);
}

function setChartOptions(species, total, rate, results, dataPoints, aggregation, pointStart) {
    let chartOptions = {};
    chartOptions.yAxis = [];
    const pointInterval = {Week: 7 * 24 * 36e5, Day: 24 * 36e5, Hour: 36e5};
    chartOptions.colors = ["#003", "#2B9179", "#AB41E8", "#E88E2A", "#E86235"];
    chartOptions.chart = {
        zoomType: 'x',
        backgroundColor: {linearGradient: [0, 0, 0, 500], stops: [[0, "#dbe2ed"], [1, "#dddddd"]]}
    }
    chartOptions.credits = {text: 'Chart generated by Chirpity Nocmig', href: ''}
    chartOptions.title = species ? {text: `${species} Detections`} : {text: 'Hours Recorded'};
    chartOptions.lang = {
        noData: "No Detections to Display"
    }
    chartOptions.noData = {
        style: {
            fontWeight: 'bold',
            fontSize: '25px',
            color: '#303030'
        }
    }
    chartOptions.time = {useUTC: false}; // Use localtime for axes
    Highcharts.dateFormats.W = function (timestamp) {
        let date = new Date(timestamp), day = date.getUTCDay() === 0 ? 7 : date.getUTCDay(), dayNumber;
        date.setDate(date.getUTCDate() + 4 - day);
        dayNumber = Math.floor((date.getTime() - new Date(date.getUTCFullYear(), 0, 1, -6)) / 86400000);
        return 1 + Math.floor(dayNumber / 7);
    };
    const format = {Week: '{value:Week %W}', Day: '{value:%a %e %b}', Hour: '{value:%l%P}'}
    chartOptions.xAxis = {
        type: 'datetime',
        tickInterval: pointInterval[aggregation], // one week
        labels: {
            format: format[aggregation],
        }
    };

    chartOptions.series = [];
    if (aggregation === 'Week') {
        chartOptions.series.push({
            name: 'Hours of recordings',
            marker: {enabled: false},
            yAxis: 0,
            type: 'areaspline',
            data: total,
            pointInterval: pointInterval[aggregation],
            pointStart: pointStart,
            lineWidth: 0,
            fillColor: {
                linearGradient: [0, 0, 0, 300],
                stops: [
                    [0, chartOptions.colors[0]],
                    [1, Highcharts.color(chartOptions.colors[0]).setOpacity(0.2).get('rgba')]
                ]
            }
        });
        chartOptions.yAxis.push({
            title: {
                text: 'Hours recorded'
            },
            accessibility: {
                description: 'Total recording time in hours'
            },
            opposite: true
        });
    }
    if (rate && Math.max(...rate) > 0) {
        if (aggregation === 'Week') {
            chartOptions.yAxis.push({
                title: {text: 'Hourly Detection Rate'},
                accessibility: {description: 'Hourly rate of records'},
                opposite: true
            })
            chartOptions.series.push({
                name: 'Average hourly call rate',
                marker: {enabled: false},
                yAxis: 1,
                type: 'areaspline',
                data: rate,
                lineWidth: 0,
                pointInterval: pointInterval[aggregation],
                pointStart: pointStart,
                fillColor: {
                    linearGradient: [0, 0, 0, 300],
                    stops: [
                        [0, chartOptions.colors[1]],
                        [1, Highcharts.color(chartOptions.colors[1]).setOpacity(0.2).get('rgba')]
                    ]
                }
            });
        }
    }
    let hasResults = false;
    for (const key in results) {
        hasResults = true;
        chartOptions.series.push({
            name: `Total for ${aggregation} in ` + key,
            pointInterval: pointInterval[aggregation],
            pointStart: pointStart,
            type: 'column',
            yAxis: chartOptions.yAxis.length,
            data: results[key]
        });
    }
    if (hasResults) {
        chartOptions.yAxis.push(
            {
                title: {text: 'Detections'},
                accessibility: {description: 'Count of records'}
            }
        );
    }

    chartOptions.tooltip = {
        crosshairs: true, shared: true, formatter: function () {
            const x = new Date(this.x)
            if (aggregation === "Week") {
                const oneJan = new Date(x.getFullYear(), 0, 1);
                const numberOfDays = Math.floor((x - oneJan) / (24 * 60 * 60 * 1000));
                const weekOfYear = Math.ceil((x.getDay() + 1 + numberOfDays) / 7);
                return this.points.reduce(function (s, point) {
                    return s + '<br/><span style="font-weight: bold;color: ' + point.series.color + '">&#9679; </span>' + point.series.name + ': ' +
                        point.y;
                }, `<b>${aggregation} ${weekOfYear} (${getDateOfISOWeek(weekOfYear)} - ${getDateOfISOWeek(weekOfYear + 1)})</b>`);
            } else if (aggregation === 'Day') {
                const period = moment(x).format('MMMM Do, YYYY');
                return this.points.reduce(function (s, point) {
                    return s + '<br/><span style="font-weight: bold;color: ' + point.series.color + '">&#9679; </span>' + point.series.name + ': ' +
                        point.y;
                }, `<b>${period}</b>`);
            } else {
                const period = moment(x).format('MMM D, ha');
                return this.points.reduce(function (s, point) {
                    return s + '<br/><span style="font-weight: bold;color: ' + point.series.color + '">&#9679; </span> Count: ' +
                        point.y;
                }, `<b>${period}</b>`);
            }
        }
    };
    chartOptions.exporting = {};
    chartOptions.exporting.csv = {
        columnHeaderFormatter: function (item, key) {
            if (!item || item instanceof Highcharts.Axis) {
                return ''
            } else {
                return item.name;
            }
        }
    };
    return chartOptions;
}


const waitForFinalEvent = (function () {
    var timers = {};
    return function (callback, ms, uniqueId) {
        if (!uniqueId) {
            uniqueId = "Don't call this twice without a uniqueId";
        }
        if (timers[uniqueId]) {
            clearTimeout(timers[uniqueId]);
        }
        timers[uniqueId] = setTimeout(callback, ms);
    };
})();

$(window).resize(function () {
    waitForFinalEvent(function () {

        WindowResize();
    }, 250, 'id1');
});

function WindowResize() {
    updateElementCache();
    adjustSpecDims(true);
}

$(document).on('click', '.play', function () {
    region.play()
})

function handleKeyDown(e) {
    let action = e.code;
    if (action in GLOBAL_ACTIONS) {
        e.preventDefault();
        if (document === e.target || document.body === e.target || e.target.attributes["data-action"]) {

        }
        GLOBAL_ACTIONS[action](e);
    }

    [].forEach.call(document.querySelectorAll('[data-action]'), function (el) {
        el.addEventListener('click', function (e) {
            let action = e.currentTarget.dataset.action;
            if (action in GLOBAL_ACTIONS) {
                e.preventDefault();
                GLOBAL_ACTIONS[action](e);
            }
        });
    });
}

function enableKeyDownEvent() {
    document.addEventListener('keydown', handleKeyDown, true);
}

//
// document.addEventListener('DOMContentLoaded', function () {
//     enableKeyDownEvent();
//     addEvents('comment');
//     addEvents('label');
// });

///////////// Nav bar Option handlers //////////////

$(document).on('click', '#loadSpectrogram', function (e) {
    config.spectrogram = e.target.checked;
    updatePrefs();
    if (config.spectrogram) {
        $('.specFeature').show()
        inferno.disabled = false;
        greys.disabled = false;

        if (wavesurfer && wavesurfer.isReady) {
            showElement(['spectrogramWrapper'], false);
        } else {
            timeOfDay.disabled = true;
            timecode.disabled = true;
            if (currentFile) loadAudioFile({filePath: currentFile});
        }
    } else {
        // Set menu state
        inferno.disabled = true;
        greys.disabled = true;
        $('.specFeature').hide()
        hideElement(['spectrogramWrapper']);
    }
})

function initSpectrogram(height, fftSamples) {
    showElement(['spectrogramWrapper'], false);
    if (!fftSamples) {
        if (windowLength < 2) {
            fftSamples = 128;
        } else if (windowLength < 5) {
            fftSamples = 256;
        } else {
            fftSamples = 512;
        }
    }
    if (!height) {
        height = fftSamples / 2
    }
    if (wavesurfer.spectrogram) wavesurfer.destroyPlugin('spectrogram');
    wavesurfer.addPlugin(WaveSurfer.spectrogram.create({
        //deferInit: false,
        wavesurfer: wavesurfer,
        container: "#spectrogram",
        scrollParent: false,
        fillParent: true,
        windowFunc: 'hamming',
        minPxPerSec: 1,
        //frequencyMin: 250,
        frequencyMax: 11750,
        normalize: true,
        hideScrollbar: true,
        labels: true,
        height: height,
        fftSamples: fftSamples,
        colorMap: colormap({
            colormap: config.colormap, nshades: 256, format: 'float'
        }),
    })).initPlugin('spectrogram');
    updateElementCache();
}

$(document).on('click', '.speccolor', function (e) {
    config.colormap = e.target.id;
    updatePrefs();
    if (wavesurfer) {
        initSpectrogram();
        // refresh caches
        updateElementCache()
        adjustSpecDims(true)
    }
})

const listToUse = document.getElementsByName('list');
for (let i = 0; i < listToUse.length; i++) {
    listToUse[i].addEventListener('click', function (e) {
        config.list = e.target.value;
        updatePrefs();
        worker.postMessage({action: 'update-model', list: config.list})
    })
}

// const warmup = document.getElementById('setWarmup');
// warmup.addEventListener('click', () => {
//     config.warmup = warmup.checked;
//     updatePrefs();
// })

$(document).on('click', '#loadTimeline', function (e) {
    const timeOfDay = document.getElementById('timeOfDay');
    const timecode = document.getElementById('timecode');
    if (!e.target.checked) {
        if (wavesurfer) wavesurfer.destroyPlugin('timeline');
        config.timeline = false;
        timeOfDay.disabled = true;
        timecode.disabled = true;
        updateElementCache();
        adjustSpecDims(true);
        updatePrefs();
    } else {
        config.timeline = true;
        timeOfDay.disabled = false;
        timecode.disabled = false;
        if (wavesurfer) {
            createTimeline();
            // refresh caches
            updateElementCache();
            adjustSpecDims(true);
        }
        updatePrefs();
    }
})

$(document).on('click', '#timeOfDay', function () {
    // set file creation time
    config.timeOfDay = true;
    const timefields = document.querySelectorAll('.timestamp')
    timefields.forEach(time => {
        time.classList.remove('d-none');
    })
    if (fileLoaded) {
        worker.postMessage({
            action: 'update-buffer',
            file: currentFile,
            position: wavesurfer.getCurrentTime() / windowLength,
            start: bufferBegin,
            end: bufferBegin + windowLength
        });
    }
    updatePrefs();
})
$(document).on('click', '#timecode', function () {
    config.timeOfDay = false;
    const timefields = document.querySelectorAll('.timestamp')
    timefields.forEach(time => {
        time.classList.add('d-none');
    })
    if (fileLoaded) {
        worker.postMessage({
            action: 'update-buffer',
            file: currentFile,
            position: wavesurfer.getCurrentTime() / windowLength,
            start: bufferBegin,
            end: bufferBegin + windowLength
        });
    }
    updatePrefs();
})

/////////// Keyboard Shortcuts  ////////////

const GLOBAL_ACTIONS = { // eslint-disable-line
    Space: function () {
        wavesurfer.playPause();
    },
    KeyO: function (e) {
        if (e.ctrlKey) showOpenDialog();
    },
    KeyS: function (e) {
        if (AUDACITY_LABELS.length) {
            if (e.ctrlKey) worker.postMessage({action: 'save2db'});
        }
    },
    KeyA: function (e) {
        if (AUDACITY_LABELS.length) {
            if (e.ctrlKey) showSaveDialog();
        }
    },
    Escape: function () {
        console.log('Operation aborted');
        PREDICTING = false;
        worker.postMessage({action: 'abort', warmup: config.warmup, list: config.list});
        alert('Operation cancelled');
    },
    Home: function () {
        if (currentBuffer) {
            bufferBegin = 0;
            worker.postMessage({
                action: 'update-buffer',
                position: 0,
                file: currentFile,
                start: 0,
                end: windowLength
            });
            wavesurfer.seekAndCenter(0);
            wavesurfer.pause()
        }
    },
    End: function () {
        if (currentBuffer) {
            bufferBegin = currentFileDuration - windowLength;
            worker.postMessage({
                action: 'update-buffer',
                file: currentFile,
                position: 1,
                start: bufferBegin,
                end: currentFileDuration
            });
            wavesurfer.seekAndCenter(1);
            wavesurfer.pause()
        }
    },
    PageUp: function () {
        if (wavesurfer) {
            const position = wavesurfer.getCurrentTime() / windowLength;
            bufferBegin = Math.max(0, bufferBegin - windowLength);
            worker.postMessage({
                action: 'update-buffer',
                file: currentFile,
                position: position,
                start: bufferBegin,
                end: bufferBegin + windowLength
            });
            wavesurfer.pause()
        }
    },
    PageDown: function () {
        if (wavesurfer) {
            const position = wavesurfer.getCurrentTime() / windowLength;
            bufferBegin = Math.min(bufferBegin + windowLength, currentFileDuration - windowLength);
            worker.postMessage({
                action: 'update-buffer',
                file: currentFile,
                position: position,
                start: bufferBegin,
                end: bufferBegin + windowLength
            });
            wavesurfer.pause()
        }
    },
    ArrowLeft: function () {
        const skip = windowLength / 100;
        if (wavesurfer) {
            wavesurfer.skipBackward(skip);
            const position = wavesurfer.getCurrentTime() / windowLength;
            if (wavesurfer.getCurrentTime() < skip && bufferBegin > 0) {
                bufferBegin -= skip;
                worker.postMessage({
                    action: 'update-buffer',
                    file: currentFile,
                    position: position,
                    start: bufferBegin,
                    end: bufferBegin + windowLength
                });
                wavesurfer.pause()
            }
        }
    },
    ArrowRight: function () {
        const skip = windowLength / 100;
        if (wavesurfer) {
            wavesurfer.skipForward(skip);
            const position = wavesurfer.getCurrentTime() / windowLength;
            if (wavesurfer.getCurrentTime() > windowLength - skip) {
                bufferBegin = Math.min(currentFileDuration - windowLength, bufferBegin += skip)
                worker.postMessage({
                    action: 'update-buffer',
                    file: currentFile,
                    position: position,
                    start: bufferBegin,
                    end: bufferBegin + windowLength
                });
                wavesurfer.pause()
            }
        }
    },
    KeyP: function () {
        (typeof region !== 'undefined') ? region.play() : console.log('Region undefined')
    },
    Equal: function (e) {
        if (wavesurfer) {
            let fftSamples = wavesurfer.spectrogram.fftSamples;
            if (e.shiftKey) {
                if (fftSamples >= 64) {
                    fftSamples /= 2;
                    adjustSpecDims(true, fftSamples);
                    console.log(fftSamples);
                }
            } else {
                zoomSpec('in')
            }
        }
    },
    NumpadAdd: function (e) {
        if (wavesurfer) {
            let fftSamples = wavesurfer.spectrogram.fftSamples;
            if (e.shiftKey) {
                if (fftSamples >= 64) {
                    fftSamples /= 2;
                    adjustSpecDims(true, fftSamples);
                    console.log(fftSamples);
                }
            } else {
                zoomSpec('in')
            }
        }
    },
    Minus: function (e) {
        if (wavesurfer) {
            let fftSamples = wavesurfer.spectrogram.fftSamples;
            if (e.shiftKey) {
                if (fftSamples <= 2048) {
                    fftSamples *= 2;
                    adjustSpecDims(true, fftSamples);
                    console.log(fftSamples);
                }
            } else {
                zoomSpec('in')
            }
        }
    },
    NumpadSubtract: function (e) {
        if (wavesurfer) {
            let fftSamples = wavesurfer.spectrogram.fftSamples;
            if (e.shiftKey) {
                if (fftSamples <= 2048) {
                    fftSamples *= 2;
                    adjustSpecDims(true, fftSamples);
                    console.log(fftSamples);
                }
            } else {
                zoomSpec('in')
            }
        }
    },
    Tab: function (e) {
        if (activeRow) {
            if (e.shiftKey) {
                if (activeRow.previousSibling) {
                    activeRow.classList.remove('table-active')
                    while (activeRow.previousSibling && activeRow.previousSibling.classList.contains('d-none')) {
                        activeRow = activeRow.previousSibling;
                    }
                    activeRow = activeRow.previousSibling;
                }
            } else {
                if (activeRow.nextSibling) {
                    activeRow.classList.remove('table-active')
                    while (activeRow.nextSibling && activeRow.nextSibling.classList.contains('d-none')) {
                        activeRow = activeRow.nextSibling;
                    }
                    activeRow = activeRow.nextSibling;
                }
            }
            if (activeRow) {
                activeRow.click();
            }
        }
    }
};


// Electron Message handling
const warmupText = document.getElementById('warmup');

function displayWarmUpMessage() {
    disableMenuItem(['analyze', 'analyzeAll', 'analyseSelection']);
    warmupText.classList.remove('d-none');
}

function onModelReady(args) {
    modelReady = true;
    warmupText.classList.add('d-none');
    if (workerHasLoadedFile) {
        enableMenuItem(['analyze'])
        if (fileList.length > 1) analyzeAllLink.classList.remove('disabled');
    }
    if (region) enableMenuItem(['analyzeSelection'])
    t1_warmup = Date.now();
    diagnostics['Warm Up'] = ((t1_warmup - t0_warmup) / 1000).toFixed(2) + ' seconds';
    diagnostics['Tensorflow Backend'] = args.backend;
}


// worker.onmessage('update-error', async (event, args) => {
//     console.error('update error' + args.error)
// })
//
// worker.onmessage('update-not-available', async (event, args) => {
//     console.log('update not available ' + args.message)
// })
//
// worker.onmessage('update-available', async (event, args) => {
//     console.log('update available ' + args.message)
// })
//
// worker.onmessage('update-downloaded', async (event, args) => {
//     console.log('update downloaded' + args.releaseNotes)
// })

async function onWorkerLoadedAudio(args) {
    if (args.preserveResults) completeDiv.hide();
    console.log('UI received worker-loaded-audio: ' + args.file)
    currentBuffer = new AudioBuffer({length: args.length, numberOfChannels: 1, sampleRate: 24000});
    currentBuffer.copyToChannel(args.contents, 0);
    // Show the current file name in the UI
    updateFileName(fileList, args.file);
    workerHasLoadedFile = true;
    currentFile = args.file;
    bufferBegin = args.bufferBegin;
    currentFileDuration = args.sourceDuration;
    fileStart = args.fileStart;
    fileEnd = new Date(fileStart + (currentFileDuration * 1000));

    if (config.timeOfDay) {
        bufferStartTime = new Date(fileStart + (bufferBegin * 1000))
    } else {
        bufferStartTime = new Date(zero.getTime() + (bufferBegin * 1000))
    }

    if (windowLength > currentFileDuration) windowLength = currentFileDuration;
    let astro = SunCalc.getTimes(fileStart, config.latitude, config.longitude);
    dusk = astro.dusk.getTime();
    firstDawn = astro.dawn.getTime();
    // calculate dawn for following day
    let astro2 = SunCalc.getTimes(fileStart + 8.64e+7, config.latitude, config.longitude);
    dawn = astro2.dawn.getTime();

    // if (config.nocmig && fileEnd.getTime() < dusk && fileStart > firstDawn) {
    //     alert(`All timestamps in this file are during daylight hours. \n\nNocmig mode will be disabled.`)
    //     $('#nocmigButton').click();
    // }
    if (modelReady) {
        enableMenuItem(['analyze']);
        if (fileList.length > 1) analyzeAllLink.classList.remove('disabled');
    }
    fileLoaded = true;

    if (!wavesurfer && config.spectrogram) {
        initWavesurfer({
            audio: currentBuffer,
            backend: 'WebAudio',
            alpha: 0,
        });
    } else {
        if (wavesurfer) wavesurfer.clearRegions();
        updateSpec(currentBuffer, args.play)
        wavesurfer.seekTo(args.position);
        if (args.region) {
            createRegion(args.region.start, args.region.end, args.region.label)
        }
    }
}

function onProgress(args) {
    progressDiv.show();
    if (args.text) fileNumber.innerText = args.text;
    let progress = (args.progress * 100).toFixed(1);
    progressBar.width(progress + '%');
    progressBar.attr('aria-valuenow', progress);
    progressBar.html(progress + '%');
    if (parseFloat(progress) === 100.0) progressDiv.hide();
}

function updateSummary() {
    summary = {};
    speciesName = document.querySelectorAll('#results .cname');
    speciesName.forEach(row => {
        const key = row.innerHTML;
        if (key in summary) {

            summary[key] += 1
        } else {
            summary[key] = 1
        }
    })

    console.table(summary);
    // Sort summary by count
    let sortable = [];
    for (const bird in summary) {
        sortable.push([bird, summary[bird]]);
    }
    sortable.sort(function (a, b) {
        return a[1] - b[1];
    });
    //count down from most seen:
    sortable = sortable.reverse();
    // Recreate object
    let summarySorted = {};
    sortable.forEach(function (item) {
        summarySorted[item[0]] = item[1]
    })

    let summaryHTML = `<table id="resultSummary" class="table table-striped table-dark table-hover p-1"><thead class="thead-dark">
            <tr>
                <th scope="col">Species</th>
                <th scope="col" class="text-end">Count</th>
                <th class="text-end w-25">Label</th>
            </tr>
            </thead><tbody>`;

    for (const [key, value] of Object.entries(summarySorted)) {
        summaryHTML += `<tr>
                        <td class="cname speciesFilter"><span class="spinner-border spinner-border-sm text-success d-none" role="status"></span>
                         <span class="pointer">${key}</span>
                        </td>                       
                        <td class="text-end">${value}</td>
                        <td class="label">${tags['Remove Label']}</td>`;

    }
    summaryHTML += '</tbody></table>';
    summaryTable.html(summaryHTML);
}

async function onPredictionDone(args) {
    AUDACITY_LABELS.push(args.labels);
    // Defer further processing until batch complete
    if (args.batchInProgress) {
        progressDiv.show();
        // The file we've completed is one less than the file we're going to be processing
        // and the index is zero-based, so + 2 to get the file we're going to process
        const count = fileList.indexOf(args.file) + 2;
        fileNumber.innerText = `(File ${count} of ${fileList.length})`;
        return;
    } else {
        PREDICTING = false;
    }
    scrolled = false;

    progressDiv.hide();
    progressBar.width(0 + '%');
    progressBar.attr('aria-valuenow', 0);
    progressBar.html(0 + '%');
    completeDiv.show();

    if (AUDACITY_LABELS.length) {
        enableMenuItem(['saveLabels', 'save2db']);
        $('.download').removeClass('disabled');
    } else {
        disableMenuItem(['saveLabels', 'save2db']);
    }
    analyzeLink.disabled = false;
    updateSummary();
    subRows = document.querySelectorAll('.subrow')

    speciesFilter = document.querySelectorAll('.speciesFilter');
    let filterMode = null;

    $(document).on('click', '#confidenceFilter', function (e) {
        if (!filterMode) {
            filterMode = 'guess';
            $('.score.text-secondary').parent().parent('.top-row').hide();
            e.target.classList.add('text-danger')
        } else if (filterMode === 'guess') {
            filterMode = 'low'
            $('.score.text-danger').parent().parent('.top-row').hide();
            e.target.classList.remove('text-danger');
            e.target.classList.add('text-warning')
        } else if (filterMode === 'low') {
            filterMode = 'medium'
            $('.score.text-warning').parent().parent('.top-row').hide();
            e.target.classList.remove('text-warning');
            e.target.classList.add('text-success')
        } else {
            filterMode = null;
            $('.score').parent().parent('.top-row').show();
            e.target.classList.remove('text-success');
            e.target.classList.add('text-secondary')
        }
        e.stopImmediatePropagation();
    });
    $(document).on('click', '.speciesFilter', function (e) {
        // Check if italic section was clicked
        speciesFilter = document.querySelectorAll('.speciesFilter');
        const target = this.querySelector('span.pointer')
        const spinner = this.querySelector('span.spinner-border');
        if (spinner === null) return;
        const targetClass = target.classList;
        if (targetClass.contains('text-success')) {
            // Clicked on filtered species icon
            targetClass.remove('text-success')
            speciesName.forEach(function (el) {
                const classes = el.parentNode.classList;
                if (!classes.contains('hidden')) classes.remove('d-none')
            })
        } else {
            // Clicked on unfiltered species name

            // Remove any exclusion from the species to filter
            speciesFilter.forEach(function (el) {
                const removeFrom = el.querySelector('span.pointer')
                removeFrom.classList.remove('text-success');
            })
            // Hide open subrows
            subRows.forEach(function (el) {
                el.classList.add('d-none');
            })
            targetClass.add('text-success', 'd-none');
            spinner.classList.remove('d-none');
            // Allow spinner to show
            setTimeout(matchSpecies, 1, this, target, spinner, 'filter');
        }
        //scrollResults(tableRows[0]);
        document.getElementById('results').scrollTop = 0;
        e.stopImmediatePropagation();
    });

    // Diagnostics:
    t1_analysis = Date.now();
    diagnostics['Analysis Duration'] = ((t1_analysis - t0_analysis) / 1000).toFixed(2) + ' seconds';
    diagnostics['Analysis Rate'] = (diagnostics['Audio Duration'] / ((t1_analysis - t0_analysis) / 1000)).toFixed(0) + 'x faster than real time performance.';

    //show summary table
    if (summaryButton.innerText.indexOf('Show') !== -1) summaryButton.click();
}

function scrollResults(row) {
    row.classList.add('table-active');
    activeRow = row;
    const container = row.closest('.overflow-auto')
    container.scrollTop = row.offsetTop - container.offsetTop - document.getElementById('resultsHead').offsetHeight;
}

function matchSpecies(row, target, spinner, mode) {
    const spinnerClasses = spinner.classList;
    //const hideIcon = e.target.closest('tr').getElementsByClassName('speciesHide')[0];
    const targetClass = target.classList;
    let resultSpecies, currentRow;
    const tableContext = row.closest('table').id;
    if (tableContext === 'results') {
        currentRow = spinner.closest('tr');
        currentRow.classList.add('strikethrough');
        resultSpecies = currentRow.querySelectorAll('td.cname');
    } else {
        resultSpecies = speciesName;
    }
    // What are we looking for?
    const lookup = target.innerText;
    resultSpecies.forEach(function (el) {
        const classes = el.parentNode.classList;
        // Extract species name from cell
        const searchFor = el.innerText;
        if (searchFor === lookup || tableContext === 'results') {
            if (mode === 'filter' || mode === 'unhide') {
                classes.remove('d-none', 'hidden');
            } else classes.add('d-none', 'hidden'); // mode == hide
        } else if (mode === 'filter') classes.add('d-none');
    })
    spinnerClasses.add('d-none');
    targetClass.remove('d-none');
}

async function renderResult(args) {
    const result = args.result, selection = args.selection, file = args.file;
    let index = args.index;
    result.timestamp = new Date(result.timestamp);
    result.position = new Date(result.position);
    // Datetime wrangling for Nocmig mode
    if (result !== "No detections found.") {
        let astro = SunCalc.getTimes(result.timestamp, config.latitude, config.longitude);
        if (astro.dawn.setMilliseconds(0) < result.timestamp && astro.dusk.setMilliseconds(0) > result.timestamp) {
            result.dayNight = 'daytime';
        } else {
            result.dayNight = 'nighttime';
            seenTheDarkness = true;
        }
    }
    let tr = '';
    if (index === 1) {
        showElement(['resultTableContainer'], false);
        if (!selection) {
            //const tableRows = document.querySelectorAll('#results > tbody > tr');
            // Remove old results
            resultTable.empty();
            summaryTable.empty();
            //if (!onScreen(tableRows[0])) scrollResults(tableRows[0]);
        } else {
            resultTable.append('<tr><td class="bg-dark text-white text-center" colspan="20"><b>Selection Analysis</b></td></tr>')
        }
    }
    if (result === "No detections found.") {
        tr += "<tr><td>" + result + "</td></tr>";
    } else {
        if (config.nocmig && !region) {
            /*
            * We want to skip results recorded before dark
            * process results during the night
            * abort entirely when dawn breaks
            */
            if (!seenTheDarkness && result.dayNight === 'daytime') {
                // Not dark yet
                return
            }
        }
        // Show the twilight bar even if nocmig mode off - cue to change of table row colour
        if (seenTheDarkness && result.dayNight === 'daytime' && shownDaylightBanner === false) {
            // Show the twilight start bar
            resultTable.append(`<tr class="bg-dark text-white"><td colspan="20" class="text-center">
                                        Start of civil twilight
                                        <span class="material-icons-two-tone text-warning align-bottom">wb_twilight</span>
                                    </td></tr>`);
            shownDaylightBanner = true;
        }

        const key = `${result.cname} <i>${result.sname}</i>`;
        if (key in summary) {
            if (result)
                summary[key] += 1
        } else {
            summary[key] = 1
        }

        const start = result.start, end = result.end;
        const comment = result.comment ?
            `<span title="${result.comment}" class='material-icons-two-tone pointer edit-comment'>comment</span>` :
            "<span title='Add a comment' class='material-icons-two-tone pointer d-none add-comment'>add_comment</span>";
        let confidence = '';
        if (result.score < 0.65) {
            confidence = '&#63;';
        }
        result.date = result.timestamp;
        const timestamp = result.timestamp.toString().split(' ');
        const UI_timestamp = `${timestamp[2]} ${timestamp[1]} ${timestamp[3].substring(2)}<br/>${timestamp[4]}`;
        result.filename = result.cname.replace(/'/g, "\\'") + ' ' + result.timestamp + '.mp3';
        let spliceStart;
        result.position < 3600000 ? spliceStart = 14 : spliceStart = 11;
        const UI_position = new Date(result.position).toISOString().substring(spliceStart, 19);
        // Now we have formatted the fields, and skipped detections as required by nocmig mode, add result to predictions file
        if (selection) {
            const tableRows = document.querySelectorAll('#results > tbody > tr');
            index = tableRows.length + 1;
        }
        predictions[index] = result;
        let showTimeOfDay;
        config.timeOfDay ? showTimeOfDay = '' : showTimeOfDay = 'd-none';

        const label = result.label ? tags[result.label] : tags['Remove Label'];

        tr += `<tr name="${file}|${start}|${end}|${result.cname}${confidence}" class=' text-center border-top border-secondary top-row ${result.dayNight}'>
            <th scope='row'>${index}</th>
            <td class='text-start text-nowrap timestamp ${showTimeOfDay}'>${UI_timestamp}</td>
            <td class="text-end">${UI_position}</td>
            <td name="${result.cname}" class='text-start cname'>${result.cname} <i>${result.sname}</i></td>
            <td class="label">${label}</td>
            <td>${iconizeScore(result.score)}</td>
            <td><span id='id${index}' title="Click for additional detections" class='material-icons-two-tone rotate pointer d-none'>sync</span></td>
            <td class='specFeature'><span class='material-icons-two-tone play pointer'>play_circle_filled</span></td>
            <td><a href='https://xeno-canto.org/explore?query=${result.sname}%20type:"nocturnal flight call"' target="xc">
            <img src='img/logo/XC.png' alt='Search ${result.cname} on Xeno Canto' title='${result.cname} NFCs on Xeno Canto'></a></td>
            <td class='specFeature download'><span class='material-icons-two-tone pointer'>file_download</span></td>
            <td class="comment text-end">${comment}</td>
        </tr>`;
        if (result.score2 > 0.2) {
            tr += `<tr name="${file}|${start}|${end}|${result.cname}${confidence}" id='subrow${index}' class='subrow d-none'>
                <th scope='row'>${index}</th>
                <td class='timestamp ${showTimeOfDay}'> </td>
                <td> </td><td class='cname2'>${result.cname2}
                    <i>${result.sname2}</i></td>
                <td></td>                    
                <td class='text-center'>${iconizeScore(result.score2)}</td>
                <td> </td><td class='specFeature'> </td>
                <td><a href='https://xeno-canto.org/explore?query=${result.sname2}%20type:nocturnal' target=\"_blank\">
                    <img src='img/logo/XC.png' alt='Search ${result.cname2} on Xeno Canto' title='${result.cname2} NFCs on Xeno Canto'></a> </td>
                <td> </td>
                <td> </td>
               </tr>`;
            if (result.score3 > 0.2) {
                tr += `<tr name="${file}|${start}|${end}|${result.cname}${confidence}" id='subsubrow${index}' class='subrow d-none'>
                    <th scope='row'>${index}</th>
                    <td class='timestamp ${showTimeOfDay}'> </td>
                    <td> </td>
                    <td class='cname3'>${result.cname3}
                        <i>${result.sname3}</i></td>
                    <td></td>
                    <td class='text-center'>${iconizeScore(result.score3)}</td>
                    <td> </td><td class='specFeature'> </td>
                    <td><a href='https://xeno-canto.org/explore?query=${result.sname3}%20type:nocturnal' target=\"_blank\">
                        <img src='img/logo/XC.png' alt='Search ${result.cname3} on Xeno Canto' title='${result.cname3} NFCs on Xeno Canto'></a> </td>
                    <td> </td>
                    <td> </td>
                   </tr>`;
            }
        }
    }
    resultTable.append(tr)
    if (selection) {
        const tableRows = document.querySelectorAll('#results > tbody > tr');
        scrollResults(tableRows[tableRows.length - 1])

    }
    // Show the alternate detections toggle:
    if (result.score2 > 0.2) {
        const id = `id${index}`;
        document.getElementById(id).classList.remove('d-none')
    }
    if (!config.spectrogram) $('.specFeature').hide();
}

// Comment handling

$(document).on('click', '.material-icons', function () {
    $(this).toggleClass("down");
})

$(document).on('click', '.add-comment, .edit-comment', function (e) {
    const note = e.target.title === "Add a comment" ? '' : e.target.title;
    $(document).off('mouseleave', '.comment');
    $(document).off('mouseenter', '.comment');
    document.removeEventListener('keydown', handleKeyDown, true);
    this.parentNode.innerHTML = `<textarea class="h-100 rounded-3 comment-textarea" placeholder="Enter notes...">${note}</textarea>`;
    $('.comment-textarea').on('keydown', commentHandler);
})

function commentHandler(e) {
    if (e.code === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        const note = e.target.value;
        if (note) {
            e.target.parentNode.innerHTML = `<span title="${note}" class="material-icons-two-tone pointer edit-comment">comment</span>`;
        } else {
            e.target.parentNode.innerHTML = `<span title="Add a comment" class="material-icons-two-tone pointer add-comment">add_comment</span>`;
        }
        const [file, start, ,] = unpackNameAttr(activeRow);
        worker.postMessage({action: 'update-record', file: file, start: start, what: 'comment', value: note});
        addEvents('comment');
        document.addEventListener('keydown', handleKeyDown, true);
    }
}


$(document).on('click', '.add-label, .edit-label', labelHandler);

function labelHandler(e) {
    $(document).off('mouseleave', '.label');
    $(document).off('mouseenter', '.label');
    const cell = e.target.closest('td');
    activeRow = cell.closest('tr');
    cell.innerHTML = `<span class="badge bg-dark rounded-pill pointer">Nocmig</span> 
                                <span class="badge bg-success rounded-pill pointer">Local</span>
                                <span class="badge bg-secondary rounded-pill pointer">Remove Label</span>`;
    cell.addEventListener('click', updateLabel)
}

const tags = {
    Local: '<span class="badge bg-success rounded-pill edit-label pointer">Local</span>',
    Nocmig: '<span class="badge bg-dark rounded-pill edit-label pointer">Nocmig</span>',
    // If remove label is clicked, we want to replace with *add* label
    'Remove Label': '<span class="badge rounded-pill bg-secondary add-label pointer d-none">Add Label</span>'
}

function updateLabel(e) {
    if (this.childElementCount < 2) return
    e.stopImmediatePropagation();
    let label = e.target.innerText;
    // update the clicked badge
    const parent = e.target.parentNode;
    parent.innerHTML = tags[label];

    // Update the label record(s) in the db
    const context = parent.closest('table').id;
    let file, start;
    if (context === 'results') {
        [file, start, ,] = unpackNameAttr(activeRow);
        worker.postMessage({
            action: 'update-record', file: file, start: start, what: 'label',
            value: label === 'Remove Label' ? '' : label
        });
    } else {
        // this is the summary table and a batch update is wanted
        const searchSpecies = parent.parentNode.querySelector('.cname').innerText;
        speciesName.forEach(el => {
            const row = el.closest('tr');
            const rowSpecies = row.querySelector('.cname').innerText;
            if (rowSpecies === searchSpecies) {
                // Update the species label in the results table
                row.querySelector('.label').innerHTML = tags[label];
                [file, start, ,] = unpackNameAttr(row);
                const labelValue = label === 'Remove Label' ? '' : label;
                worker.postMessage({
                    action: 'update-record',
                    file: file,
                    start: start,
                    what: 'label',
                    value: labelValue
                });
            }
        })
    }
    addEvents('label');
}

function addEvents(element) {
    $(document).on('mouseenter', '.' + element, function () {

        $(this).children(`span.add-${element}`).removeClass("d-none");
    })

    $(document).on('mouseleave', '.' + element, function (e) {
        const text = e.target.innerText;
        const hasElement = text === 'comment' || text === 'Nocmig' || text === 'Local';
        if (hasElement) return;

        this.innerHTML = element === 'comment' ?
            `<span title="Add a ${element}" class="material-icons-two-tone pointer add-${element} d-none">add_${element}</span>` :
            tags['Remove Label'];

    })
}


// Results event handlers

function getSpeciesIndex(e) {
    const clickedNode = e.target.closest('tr');
    clickedIndex = clickedNode.querySelector('th') ? clickedNode.querySelector('th').innerText : null;
}

const summaryButton = document.getElementById('showSummary');
summaryButton.addEventListener('click', () => {
    summaryTable.animate({width: 'toggle'});
    summaryButton.innerText.indexOf('Show') !== -1 ?
        summaryButton.innerText = 'Hide Summary' :
        summaryButton.innerText = 'Show Summary';
});

$(document).on('click', '.download', function (e) {
    mode = 'save';
    getSpeciesIndex(e);
    sendFile(mode, predictions[clickedIndex])
    e.stopImmediatePropagation();
});


$(document).on('click', '.rotate', function (e) {
    const row1 = e.target.parentNode.parentNode.nextSibling;
    const row2 = row1.nextSibling;
    row1.classList.toggle('d-none')
    if (row2 && !row2.classList.contains('top-row')) row2.classList.toggle('d-none')
    e.stopImmediatePropagation();
})


function formatSpeciesName(filename) {
    filename = filename.replace(' - ', '~').replace(/\s+/g, '_',);
    if (!filename.includes('~')) filename = filename + '~' + filename; // dummy latin
    return filename;
}


function sendFile(mode, result) {
    let start, end, filename;
    if (result) {
        start = result.start;
        end = result.end;
        filename = result.filename
    }
    if (!start && start !== 0) {
        if (!region.start) {
            start = 0;
            end = currentBuffer.duration;
        } else {
            start = region.start + bufferBegin;
            end = region.end + bufferBegin;
        }
        filename = 'export.mp3'
    }

    let metadata;
    if (result) {
        metadata = {
            UUID: config.UUID,
            start: start,
            end: end,
            filename: result.filename,
            cname: result.cname,
            sname: result.sname,
            score: result.score,
            cname2: result.cname2,
            sname2: result.sname2,
            score2: result.score2,
            cname3: result.cname3,
            sname3: result.sname3,
            score3: result.score3,
            date: result.date,
            lat: config.latitude,
            lon: config.longitude,
            version: version
        };
    }
    if (mode === 'save') {
        worker.postMessage({
            action: 'save',
            start: start, file: currentFile, end: end, filename: filename, metadata: metadata
        })
    } else {
        if (!config.seenThanks) {
            alert('Thank you, your feedback helps improve Chirpity predictions');
            config.seenThanks = true;
            updatePrefs()
        }
        worker.postMessage({
            action: 'post',
            start: start, file: currentFile, end: end, defaultName: filename, metadata: metadata, mode: mode
        })
    }
}

// create a dict mapping score to icon
const iconDict = {
    guess: '<span class="material-icons-two-tone text-secondary score border border-secondary rounded" title="--%">signal_cellular_alt_1_bar</span>',
    low: '<span class="material-icons-two-tone score text-danger border border-secondary rounded" title="--%">signal_cellular_alt_1_bar</span>',
    medium: '<span class="material-icons-two-tone score text-warning border border-secondary rounded" title="--%">signal_cellular_alt_2_bar</span>',
    high: '<span class="material-icons-two-tone score text-success border border-secondary rounded" title="--%">signal_cellular_alt</span>',
}

function iconizeScore(score) {
    const tooltip = (parseFloat(score) * 100).toFixed(0).toString()
    if (parseFloat(score) < 0.5) return iconDict['guess'].replace('--', tooltip)
    else if (parseFloat(score) < 0.65) return iconDict['low'].replace('--', tooltip)
    else if (parseFloat(score) < 0.85) return iconDict['medium'].replace('--', tooltip)
    else return iconDict['high'].replace('--', tooltip)
}

// File menu handling
const open = document.getElementById('open');
open.addEventListener('click', function () {
    showOpenDialog();
});

$('#saveLabels').on('click', function () {
    showSaveDialog();
});

$('#exportMP3').on('click', function () {
    sendFile('save');
});

$('#exit').on('click', function () {
    exitApplication();
});

// Help menu handling

$('#keyboard').on('click', function () {
    $('#helpModalLabel').text('Keyboard shortcuts');
    $('#helpModalBody').load('Help/keyboard.html', function () {
        const help = new bootstrap.Modal(document.getElementById('helpModal'));
        help.show()
    });
});

$('#settings').on('click', function () {
    $('#helpModalLabel').text('Settings Help');
    $('#helpModalBody').load('Help/settings.html', function () {
        const help = new bootstrap.Modal(document.getElementById('helpModal'));
        help.show()
    });
});

$('#usage').on('click', function () {
    $('#helpModalLabel').text('Usage Guide');
    $('#helpModalBody').load('Help/usage.html', function () {
        const help = new bootstrap.Modal(document.getElementById('helpModal'));
        help.show()
    });
});
nocmigButton.addEventListener('click', function () {
    if (config.nocmig) {
        config.nocmig = false;
        nocmigButton.innerText = 'bedtime_off';
    } else {
        config.nocmig = true;
        nocmigButton.innerText = 'bedtime';
    }
    updatePrefs();
})

const fullscreen = document.getElementById('fullscreen');

fullscreen.addEventListener('click', function (e) {
    if (config.fullscreen) {
        config.fullscreen = false;
        fullscreen.innerText = 'fullscreen';
    } else {
        config.fullscreen = true;
        fullscreen.innerText = 'fullscreen_exit';
    }
    adjustSpecDims(true);
})


const diagnosticMenu = document.getElementById('diagnostics')
diagnosticMenu.addEventListener('click', function () {
    let diagnosticTable = "<table class='table-hover table-striped p-2 w-100'>";
    for (let [key, value] of Object.entries(diagnostics)) {
        if (key === 'Audio Duration') {
            if (value < 3600) {
                value = new Date(value * 1000).toISOString().substring(14, 19)
            } else {
                value = new Date(value * 1000).toISOString().substring(11, 19)
            }
        }
        diagnosticTable += `<tr><th scope="row">${key}</th><td>${value}</td></tr>`;
    }
    diagnosticTable += "</table>";
    $('#diagnosticsModalBody').html(diagnosticTable);
    const testModal = new bootstrap.Modal(document.getElementById('diagnosticsModal'));
    testModal.show();
});

// Transport controls handling

$('#playToggle').on('mousedown', function () {
    wavesurfer.playPause();
});

$('#zoomIn').on('click', function () {
    zoomSpec('in');
});

$('#zoomOut').on('click', function () {
    zoomSpec('out');
});

// Listeners to set batch size
const batchRadios = document.getElementsByName('batch');

for (let i = 0; i < batchRadios.length; i++) {
    batchRadios[i].addEventListener('click', (e) => {
        config.batchSize = e.target.value;
        worker.postMessage({
            action: 'load-model',
            list: config.list,
            batchSize: config.batchSize,
            warmup: config.warmup
        });
        updatePrefs();
    })
}

// Drag file to app window to open
document.addEventListener('dragover', (event) => {
    event.preventDefault();
    event.stopPropagation();
})

document.addEventListener('drop', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    let filelist = []
    for (const f of event.dataTransfer.files) {
        // Using the path attribute to get absolute file path
        //console.log(f)
        filelist.push(f.path);
    }
    if (filelist.length) await onOpenFiles({filePaths: filelist})
});
// Prevent drag for UI elements
bodyElement.on('dragstart', e => {
    e.preventDefault()
})


////////// Date Picker ///////////////


$(function () {
    const start = moment();
    const end = start;
    $('#chartRange, #exploreRange').each(function () {
        $(this).daterangepicker({
            autoUpdateInput: false,
            locale: {
                cancelLabel: 'Clear'
            },
            timePicker: true,
            timePicker24Hour: true,
            timePickerIncrement: 60,
            startDate: start,
            endDate: end,
            opens: "center",
            ranges: {
                'Last Night': [moment().startOf('day').add(12, 'hours').subtract(1, 'days'), moment().startOf('day').add(12, 'hours')],
                'Previous Night': [moment().startOf('day').add(12, 'hours').subtract(2, 'days'), moment().subtract(1, 'days').startOf('day').add(12, 'hours')],
                'Last 7 Nights': [moment().startOf('day').add(12, 'hours').subtract(6, 'days'), moment().startOf('day').add(12, 'hours')],
                'Last 30 Nights': [moment().startOf('day').add(12, 'hours').subtract(29, 'days'), moment()],
                'This Month': [moment().startOf('month'), moment().endOf('month')],
                'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')],
                'This Year': [moment().startOf('year'), moment().endOf('year')],
                'Last Year': [moment().subtract(1, 'year').startOf('year'), moment().subtract(1, 'year').endOf('year')]
            }
        });
        $(this).on('apply.daterangepicker', function (ev, picker) {
            $(this).children('span').html(picker.startDate.format('MMMM D, YYYY') + ' - ' + picker.endDate.format('MMMM D, YYYY'));
            $(this).val(picker.startDate.format('MM/DD/YYYY') + ' - ' + picker.endDate.format('MM/DD/YYYY'));
            const dateRange = {start: picker.startDate._d.getTime(), end: picker.endDate._d.getTime()};
            if (worker) {
                if (this.id === 'chartRange' && chartSpecies) {
                    t0 = Date.now();
                    worker.postMessage({action: 'chart', species: chartSpecies, range: dateRange});
                } else if (this.id === 'exploreRange' && exploreSpecies) {
                    worker.postMessage({action: 'explore', species: exploreSpecies, range: dateRange});
                }
            }
        });

        $(this).on('cancel.daterangepicker', function () {
            $(this).children('span').html('Apply a date filter');
            if (worker) {
                if (this.id === 'chartRange') {
                    if (chartSpecies) {
                        t0 = Date.now();
                        worker.postMessage({action: 'chart', species: chartSpecies, range: {}});
                    }
                }
            }

        });
    })
});

// Check if element is on the screen
function onScreen(el) {
    const resultTable = document.getElementById('results');
    const ViewTop = resultTable.scrollTop;
    const ViewBottom = resultTableElement.height();
    const elemTop = el.offsetTop;
    const elemBottom = elemTop + el.offsetHeight;

    return ((elemBottom <= ViewBottom) && (elemTop >= ViewTop));
}

document.addEventListener("DOMContentLoaded", function () {
    enableKeyDownEvent();
    addEvents('comment');
    addEvents('label');
// make it as accordion for smaller screens
    if (window.innerWidth < 768) {

        // close all inner dropdowns when parent is closed
        document.querySelectorAll('.navbar .dropdown').forEach(function (everydropdown) {
            everydropdown.addEventListener('hidden.bs.dropdown', function () {
                // after dropdown is hidden, then find all submenus
                this.querySelectorAll('.submenu').forEach(function (everysubmenu) {
                    // hide every submenu as well
                    everysubmenu.style.display = 'none';
                });
            })
        });

        document.querySelectorAll('.dropdown-menu a').forEach(function (element) {
            element.addEventListener('click', function (e) {
                let nextEl = this.nextElementSibling;
                if (nextEl && nextEl.classList.contains('submenu')) {
                    // prevent opening link if link needs to open dropdown
                    e.preventDefault();
                    if (nextEl.style.display == 'block') {
                        nextEl.style.display = 'none';
                    } else {
                        nextEl.style.display = 'block';
                    }

                }
            });
        })
    }
// end if innerWidth
});