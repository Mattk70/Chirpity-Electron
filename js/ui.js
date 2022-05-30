let dawn, dusk, seenTheDarkness = false, shownDaylightBanner = false;
const labels = ["Tachymarptis melba_Alpine Swift", "Pluvialis dominica_American Golden Plover", "Mareca americana_American Wigeon", "Acrocephalus paludicola_Aquatic Warbler", "Acanthis hornemanni_Arctic Redpoll", "Stercorarius parasiticus_Arctic Skua", "Sterna paradisaea_Arctic Tern", "Phylloscopus borealis_Arctic Warbler", "Recurvirostra avosetta_Avocet", "Porzana pusilla_Baillon's Crake", "Limosa lapponica_Bar-tailed Godwit", "Tyto alba_Barn Owl", "Branta leucopsis_Barnacle Goose", "Sylvia nisoria_Barred Warbler", "Panurus biarmicus_Bearded Tit", "Merops apiaster_Bee-eater", "Cygnus columbianus_Bewick's Swan", "Botaurus stellaris_Bittern", "Oenanthe hispanica_Black-eared Wheatear", "Chroicocephalus ridibundus_Black-headed Gull", "Podiceps nigricollis_Black-necked Grebe", "Limosa limosa_Black-tailed Godwit", "Himantopus himantopus_Black-winged Stilt", "Lyrurus tetrix_Black Grouse", "Cepphus grylle_Black Guillemot", "Milvus migrans_Black Kite", "Phoenicurus ochruros_Black Redstart", "Chlidonias niger_Black Tern", "Turdus merula_Blackbird", "Sylvia atricapilla_Blackcap", "Spatula discors_Blue-winged Teal", "Cyanistes caeruleus_Blue Tit", "Luscinia svecica_Bluethroat", "Acrocephalus dumetorum_Blyth's Reed Warbler", "Fringilla montifringilla_Brambling", "Branta bernicla_Brent Goose", "Pyrrhula pyrrhula_Bullfinch", "Buteo buteo_Buzzard", "Branta canadensis_Canada Goose", "Tetrao urogallus_Capercaillie", "Corvus corone_Carrion Crow", "Larus cachinnans_Caspian Gull", "Bubulcus ibis_Cattle Egret", "Cettia cetti_Cetti's Warbler", "Fringilla coelebs_Chaffinch", "Phylloscopus collybita_Chiffchaff", "Pyrrhocorax pyrrhocorax_Chough", "Emberiza cirlus_Cirl Bunting", "Motacilla citreola_Citrine Wagtail", "Periparus ater_Coal Tit", "Streptopelia decaocto_Collared Dove", "Glareola pratincola_Collared Pratincole", "Loxia curvirostra_Common Crossbill", "Larus canus_Common Gull", "Acanthis flammea_Common Redpoll", "Carpodacus erythrinus_Common Rosefinch", "Actitis hypoleucos_Common Sandpiper", "Melanitta nigra_Common Scoter", "Sterna hirundo_Common Tern", "Fulica atra_Coot", "Phalacrocorax carbo_Cormorant", "Emberiza calandra_Corn Bunting", "Crex crex_Corncrake", "Calonectris borealis_Cory's Shearwater", "Grus grus_Crane", "Lophophanes cristatus_Crested Tit", "Cuculus canorus_Cuckoo", "Calidris ferruginea_Curlew Sandpiper", "Numenius arquata_Curlew", "Sylvia undata_Dartford Warbler", "Cinclus cinclus_Dipper", "Charadrius morinellus_Dotterel", "Calidris alpina_Dunlin", "Prunella modularis_Dunnock", "Phylloscopus fuscatus_Dusky Warbler", "Alopochen aegyptiaca_Egyptian Goose", "Somateria mollissima_Eider", "Bubo bubo_Eurasian Eagle-Owl", "Turdus pilaris_Fieldfare", "Regulus ignicapilla_Firecrest", "Fulmarus glacialis_Fulmar", "Mareca strepera_Gadwall", "Morus bassanus_Gannet", "Sylvia borin_Garden Warbler", "Spatula querquedula_Garganey", "Larus hyperboreus_Glaucous Gull", "Plegadis falcinellus_Glossy Ibis", "Regulus regulus_Goldcrest", "Aquila chrysaetos_Golden Eagle", "Oriolus oriolus_Golden Oriole", "Pluvialis apricaria_Golden Plover", "Bucephala clangula_Goldeneye", "Carduelis carduelis_Goldfinch", "Mergus merganser_Goosander", "Accipiter gentilis_Goshawk", "Locustella naevia_Grasshopper Warbler", "Larus marinus_Great Black-backed Gull", "Podiceps cristatus_Great Crested Grebe", "Lanius excubitor_Great Grey Shrike", "Gavia immer_Great Northern Diver", "Stercorarius skua_Great Skua", "Dendrocopos major_Great Spotted Woodpecker", "Parus major_Great Tit", "Ardea alba_Great White Egret", "Anas carolinensis_Green-winged Teal", "Tringa ochropus_Green Sandpiper", "Picus viridis_Green Woodpecker", "Chloris chloris_Greenfinch", "Phylloscopus trochiloides_Greenish Warbler", "Tringa nebularia_Greenshank", "Ardea cinerea_Grey Heron", "Perdix perdix_Grey Partridge", "Phalaropus fulicarius_Grey Phalarope", "Pluvialis squatarola_Grey Plover", "Motacilla cinerea_Grey Wagtail", "Anser anser_Greylag Goose", "Uria aalge_Guillemot", "Gelochelidon nilotica_Gull-billed Tern", "Coccothraustes coccothraustes_Hawfinch", "Larus argentatus_Herring Gull", "Falco subbuteo_Hobby", "Pernis apivorus_Honey-buzzard", "Upupa epops_Hoopoe", "Delichon urbicum_House Martin", "Passer domesticus_House Sparrow", "Human_Human", "Phylloscopus ibericus_Iberian Chiffchaff", "Hippolais icterina_Icterine Warbler", "Lymnocryptes minimus_Jack Snipe", "Coloeus monedula_Jackdaw", "Garrulus glandarius_Jay", "Charadrius alexandrinus_Kentish Plover", "Falco tinnunculus_Kestrel", "Alcedo atthis_Kingfisher", "Rissa tridactyla_Kittiwake", "Calidris canutus_Knot", "Calcarius lapponicus_Lapland Bunting", "Vanellus vanellus_Lapwing", "Larus fuscus_Lesser Black-backed Gull", "Acanthis cabaret_Lesser Redpoll", "Dryobates minor_Lesser Spotted Woodpecker", "Sylvia curruca_Lesser Whitethroat", "Linaria cannabina_Linnet", "Ixobrychus minutus_Little Bittern", "Emberiza pusilla_Little Bunting", "Egretta garzetta_Little Egret", "Tachybaptus ruficollis_Little Grebe", "Hydrocoloeus minutus_Little Gull", "Athene noctua_Little Owl", "Charadrius dubius_Little Ringed Plover", "Calidris minuta_Little Stint", "Sternula albifrons_Little Tern", "Asio otus_Long-eared Owl", "Clangula hyemalis_Long-tailed Duck", "Stercorarius longicaudus_Long-tailed Skua", "Aegithalos caudatus_Long-tailed Tit", "Pica pica_Magpie", "Anas platyrhynchos_Mallard", "Aix galericulata_Mandarin Duck", "Puffinus puffinus_Manx Shearwater", "Circus aeruginosus_Marsh Harrier", "Poecile palustris_Marsh Tit", "Anthus pratensis_Meadow Pipit", "Ichthyaetus melanocephalus_Mediterranean Gull", "Hippolais polyglotta_Melodious Warbler", "Falco columbarius_Merlin", "Turdus viscivorus_Mistle Thrush", "Circus pygargus_Montagu's Harrier", "Gallinula chloropus_Moorhen", "Cygnus olor_Mute Swan", "Nycticorax nycticorax_Night Heron", "Luscinia megarhynchos_Nightingale", "Caprimulgus europaeus_Nightjar", "No Call_No Call", "Sitta europaea_Nuthatch", "Anthus hodgsoni_Olive-backed Pipit", "Emberiza hortulana_Ortolan Bunting", "Pandion haliaetus_Osprey", "Haematopus ostralegus_Oystercatcher", "Syrrhaptes paradoxus_Pallas's Sandgrouse", "Phylloscopus proregulus_Pallas's Warbler", "Loxia pytyopsittacus_Parrot Crossbill", "Calidris melanotos_Pectoral Sandpiper", "Remiz pendulinus_Penduline Tit", "Falco peregrinus_Peregrine", "Phasianus colchicus_Pheasant", "Ficedula hypoleuca_Pied Flycatcher", "Motacilla alba_Pied Wagtail", "Anser brachyrhynchus_Pink-footed Goose", "Anas acuta_Pintail", "Aythya ferina_Pochard", "Lagopus muta_Ptarmigan", "Ardea purpurea_Purple Heron", "Calidris maritima_Purple Sandpiper", "Coturnix coturnix_Quail", "Phylloscopus schwarzi_Radde's Warbler", "Corvus corax_Raven", "Alca torda_Razorbill", "Lanius collurio_Red-backed Shrike", "Ficedula parva_Red-breasted Flycatcher", "Mergus serrator_Red-breasted Merganser", "Netta rufina_Red-crested Pochard", "Tarsiger cyanurus_Red-flanked Bluetail", "Alectoris rufa_Red-legged Partridge", "Podiceps grisegena_Red-necked Grebe", "Caprimulgus ruficollis_Red-necked Nightjar", "Phalaropus lobatus_Red-necked Phalarope", "Cecropis daurica_Red-rumped Swallow", "Gavia stellata_Red-throated Diver", "Lagopus lagopus_Red Grouse", "Milvus milvus_Red Kite", "Tringa totanus_Redshank", "Phoenicurus phoenicurus_Redstart", "Turdus iliacus_Redwing", "Emberiza schoeniclus_Reed Bunting", "Acrocephalus scirpaceus_Reed Warbler", "Anthus richardi_Richard's Pipit", "Larus delawarensis_Ring-billed Gull", "Psittacula krameri_Ring-necked Parakeet", "Turdus torquatus_Ring Ouzel", "Charadrius hiaticula_Ringed Plover", "Erithacus rubecula_Robin", "Columba livia_Rock Dove", "Anthus petrosus_Rock Pipit", "Corvus frugilegus_Rook", "Pastor roseus_Rose-coloured Starling", "Sterna dougallii_Roseate Tern", "Buteo lagopus_Rough-legged Buzzard", "Oxyura jamaicensis_Ruddy Duck", "Tadorna ferruginea_Ruddy Shelduck", "Calidris pugnax_Ruff", "Xema sabini_Sabine's Gull", "Riparia riparia_Sand Martin", "Calidris alba_Sanderling", "Thalasseus sandvicensis_Sandwich Tern", "Locustella luscinioides_Savi's Warbler", "Aythya marila_Scaup", "Loxia scotica_Scottish Crossbill", "Acrocephalus schoenobaenus_Sedge Warbler", "Calidris pusilla_Semipalmated Sandpiper", "Serinus serinus_Serin", "Tadorna tadorna_Shelduck", "Eremophila alpestris_Shore Lark", "Asio flammeus_Short-eared Owl", "Calandrella brachydactyla_Short-toed Lark", "Spatula clypeata_Shoveler", "Spinus spinus_Siskin", "Alauda arvensis_Skylark", "Podiceps auritus_Slavonian Grebe", "Gallinago gallinago_Snipe", "Plectrophenax nivalis_Snow Bunting", "Anser caerulescens_Snow Goose", "Turdus philomelos_Song Thrush", "Accipiter nisus_Sparrowhawk", "Platalea leucorodia_Spoonbill", "Porzana porzana_Spotted Crake", "Muscicapa striata_Spotted Flycatcher", "Tringa erythropus_Spotted Redshank", "Actitis macularius_Spotted Sandpiper", "Sturnus vulgaris_Starling", "Columba oenas_Stock Dove", "Burhinus oedicnemus_Stone-curlew", "Saxicola rubicola_Stonechat", "Hydrobates pelagicus_Storm Petrel", "Sylvia cantillans_Subalpine Warbler", "Hirundo rustica_Swallow", "Apus apus_Swift", "Anser fabalis_Taiga Bean Goose", "Strix aluco_Tawny Owl", "Anas crecca_Teal", "Calidris temminckii_Temminck's Stint", "Anthus trivialis_Tree Pipit", "Passer montanus_Tree Sparrow", "Certhia familiaris_Treecreeper", "Aythya fuligula_Tufted Duck", "Anser serrirostris_Tundra Bean Goose", "Arenaria interpres_Turnstone", "Streptopelia turtur_Turtle Dove", "Linaria flavirostris_Twite", "Loxia leucoptera_Two-barred Crossbill", "Anthus spinoletta_Water Pipit", "Rallus aquaticus_Water Rail", "Bombycilla garrulus_Waxwing", "Oenanthe oenanthe_Wheatear", "Numenius phaeopus_Whimbrel", "Saxicola rubetra_Whinchat", "Anser albifrons_White-fronted Goose", "Calidris fuscicollis_White-rumped Sandpiper", "Haliaeetus albicilla_White-tailed Eagle", "Chlidonias leucopterus_White-winged Black Tern", "Ciconia ciconia_White Stork", "Sylvia communis_Whitethroat", "Cygnus cygnus_Whooper Swan", "Mareca penelope_Wigeon", "Poecile montanus_Willow Tit", "Phylloscopus trochilus_Willow Warbler", "Tringa glareola_Wood Sandpiper", "Phylloscopus sibilatrix_Wood Warbler", "Scolopax rusticola_Woodcock", "Lullula arborea_Woodlark", "Columba palumbus_Woodpigeon", "Troglodytes troglodytes_Wren", "Jynx torquilla_Wryneck", "Phylloscopus inornatus_Yellow-browed Warbler", "Larus michahellis_Yellow-legged Gull", "Motacilla flava_Yellow Wagtail", "Emberiza citrinella_Yellowhammer", "animals_animals", "vehicles_vehicles"];

let currentPrediction;

// Get the modules loaded in preload.js


const fs = window.module.fs;
const colormap = window.module.colormap;
const p = window.module.p;
const SunCalc = window.module.SunCalc;
const uuidv4 = window.module.uuidv4;
const gzip = window.module.gzip;
const ungzip = window.module.ungzip;

/// Set up communication channel between UI and worker window

let worker;

const establishMessageChannel =
    new Promise((resolve, reject) => {
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
    })


async function getPath() {
    const pathPromise = window.electron.getPath();
    const appPath = await pathPromise;
    return appPath;
}


let version;
let diagnostics = {}

window.electron.getVersion()
    .then((appVersion) => {
        version = appVersion;
        console.log('App version: ', appVersion)
        diagnostics['Chirpity Version'] = version;
    })
    .catch(e => {
        console.log('Error getting app version:', e)
    });

let modelReady = false, fileLoaded = false, currentFile, resultHistory = {};
let PREDICTING = false;
let region, AUDACITY_LABELS = [], wavesurfer;
let summary = {};
summary['suppressed'] = [];
let fileList = [], fileStart, bufferStartTime, fileEnd;

let zero = new Date(Date.UTC(0, 0, 0, 0, 0, 0));
// set up some DOM element caches
let bodyElement = $('body');
let dummyElement, specElement, waveElement, specCanvasElement, specWaveElement;
let waveCanvasElement, waveWaveElement, resultTableElement = $('#resultTableContainer');
let contentWrapperElement = $('#contentWrapper');
let controlsWrapperElement = $('#controlsWrapper');
let completeDiv = $('#complete');
const resultTable = $('#resultTableBody')
const summaryTable = $('#summaryModalBody');
const feedbackTable = $('#feedbackModalBody');
const speciesSearchForm = $('#speciesSearch');
let progressDiv = $('#progressDiv');
let progressBar = $('.progress .progress-bar');
const fileNumber = document.getElementById('fileNumber');
let batchFileCount = 1, batchInProgress = false;
let activeRow;
let predictions = {}, correctedSpecies, speciesListItems, searchListItems, clickedNode,
    clickedIndex, speciesName, speciesFilter, speciesHide, speciesExclude, subRows, scrolled, currentFileDuration;

let currentBuffer, bufferBegin = 0, windowLength = 20;  // seconds
let workerHasLoadedFile = false;
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
let t0_warmup, t1_warmup, t0_analysis, t1_analysis

const si = window.module.si;

// promises style - new since version 3
si.graphics()
    .then(data => {
        let count = 0
        //console.log(data)
        data.controllers.forEach(gpu => {
            const key = `GPU[${count}]`;
            const vram = key + ' Memory';
            diagnostics[key] = gpu.name || gpu.vendor || gpu.model;
            diagnostics[vram] = `${gpu.vram} MB`;
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
    summary['suppressed'] = []
    predictions = {};
    seenTheDarkness = false;
    shownDaylightBanner = false;
    progressDiv.hide();
    progressBar.width(0 + '%');
    progressBar.attr('aria-valuenow', 0);
    progressBar.html(0 + '%');
}

async function loadAudioFile(args) {
    let filePath = args.filePath, originalFileEnd = args.originalFileEnd,
        workerHasLoadedFile = false;

    // Hide load hint and show spinnner
    // if (wavesurfer) {
    //     wavesurfer.destroy();
    //     wavesurfer = undefined;
    // }
    // set file creation time
    try {
        fileEnd = fs.statSync(filePath).mtime;
        worker.postMessage({action: 'file-load-request', filePath: filePath, position: 0});
    } catch (e) {
        const supported_files = ['.mp3', '.wav', '.mpga', '.ogg', '.flac', '.aac', '.mpeg', '.mp4'];
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
        })
        if (!fileEnd) {
            alert("Unable to load source file with any supported file extension: " + filePath)
        } else {
            if (file) filePath = file;
            if (originalFileEnd) fileEnd = originalFileEnd;
            worker.postMessage({
                action: 'file-load-request',
                filePath: filePath,
                preserveResults: preserveResults,
                position: 0
            });
        }
    }
}

$(document).on("click", ".openFiles", async function (e) {
    e.target.classList.add('revealFiles');
    e.target.classList.remove('openFiles');
    const openFiles = $('.openFiles');
    openFiles.removeClass('visible');
    if (openFiles.length > 1) this.firstChild.innerHTML = "library_music"
    if (!PREDICTING) {
        await loadAudioFile({filePath: e.target.id, preserveResults: true})
    }
    e.stopImmediatePropagation()
});

$(document).on("click", ".revealFiles", function (e) {
    this.classList.remove('revealFiles')
    this.classList.add('openFiles')

    this.firstChild.innerHTML = "audio_file"
    const openFiles = $('.openFiles');
    openFiles.addClass('visible');
    e.stopImmediatePropagation()
});


function updateSpec(buffer, play) {
    updateElementCache();
    wavesurfer.loadDecodedBuffer(buffer);
    waveCanvasElement.width('100%');
    specCanvasElement.width('100%');
    $('.spec-labels').width('55px');
    if (play) wavesurfer.play()
}

function initWavesurfer(args) {
    // Show spec and timecode containers
    hideAll();
    showElement(['dummy', 'timeline', 'waveform', 'spectrogram'], false);

    if (wavesurfer !== undefined) wavesurfer.pause();
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
        height: 512,
        plugins: [
            WaveSurfer.regions.create({
                regionsMinLength: 0.5,
                dragSelection: true,
                slop: 5,
                color: "rgba(255, 255, 255, 0.2)"
            })
        ]
    })
    if (config.spectrogram) {
        initSpectrogram()
    }
    if (config.timeline) {
        wavesurfer.addPlugin(WaveSurfer.timeline.create({
            container: '#timeline',
            formatTimeCallback: formatTimeCallback,
            timeInterval: timeInterval,
            primaryLabelInterval: primaryLabelInterval,
            secondaryLabelInterval: secondaryLabelInterval,
            primaryColor: 'black',
            secondaryColor: 'grey',
            primaryFontColor: 'black',
            secondaryFontColor: 'grey'

        })).initPlugin('timeline');
    }
    wavesurfer.loadDecodedBuffer(args.audio);
    updateElementCache()
    $('.speccolor').removeClass('disabled');
    showElement([config.colormap + ' .tick'], false);
    // Set click event that removes all regions
    waveElement.mousedown(function () {
        wavesurfer.clearRegions();
        region = false;
        disableMenuItem(['analyzeSelection', 'exportMP3']);
        if (workerHasLoadedFile) enableMenuItem(['analyze']);
    });
    // Enable analyse selection when region created
    wavesurfer.on('region-created', function (e) {
        region = e
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
    })
    // Show controls
    showElement(['controlsWrapper']);
    updateElementCache()
    // Resize canvas of spec and labels
    adjustSpecDims(false);
}

function updateElementCache() {
    // Update element caches
    dummyElement = $('#dummy');
    waveElement = $('#waveform')

    specElement = $('spectrogram')
    specCanvasElement = $('#spectrogram canvas')
    waveCanvasElement = $('#waveform canvas')
    waveWaveElement = $('#waveform wave')
    specWaveElement = $('#spectrogram wave')
}

function zoomSpec(direction) {
    let offsetSeconds = wavesurfer.getCurrentTime()
    let position = offsetSeconds / windowLength;
    let timeNow = bufferBegin + offsetSeconds;
    if (direction === 'in') {
        if (windowLength < 1.5) return;
        windowLength /= 2;
        bufferBegin += windowLength * position;
    } else {
        if (windowLength > 100 || windowLength === currentFileDuration) return
        bufferBegin -= windowLength * position;
        windowLength = Math.min(currentFileDuration, windowLength * 2);

        if (bufferBegin < 0) bufferBegin = 0;
        else if (bufferBegin + windowLength > currentFileDuration) bufferBegin = currentFileDuration - windowLength
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

async function onOpenFiles(args) {
    hideAll();
    showElement(['controlsWrapper', 'timeline', 'waveform', 'spectrogram', 'dummy'])
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
    let count = 0;
    let filenameElement = document.getElementById('filename');
    filenameElement.innerHTML = '';

    let appendstr = '<div id="fileContainer" class="d-inline-block position-absolute bg-dark text-nowrap pe-3">';
    fileList.forEach(item => {
        if (count === 0) {
            if (fileList.length > 1) {
                appendstr += `<span class="revealFiles visible pointer" id="${item}">`;
                appendstr += '<span class="material-icons-two-tone pointer">library_music</span>';
            } else {
                appendstr += '<span class="material-icons-two-tone align-bottom">audio_file</span>';
            }
        } else {
            appendstr += `<span class="openFiles pointer" id="${item}"><span class="material-icons-two-tone align-bottom">audio_file</span>`;
        }
        appendstr += item.replace(/^.*[\\\/]/, "") + '<br></span>';
        count += 1;
    })
    filenameElement.innerHTML += appendstr + '</div>';
    await loadAudioFile({filePath: fileList[0]});
    currentFile = fileList[0];

    disableMenuItem(['analyzeSelection', 'analyze','analyzeAll'])
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
    await loadChirp(args.file);
}

/**
 *
 *
 * @returns {Promise<void>}
 */
async function showSaveDialog() {
    await window.electron.saveFile({'currentFile': currentFile, 'labels': AUDACITY_LABELS});
}

// Worker listeners
function analyseReset() {
    fileNumber.innerText = '';
    PREDICTING = true;
    delete diagnostics['Audio Duration'];
    AUDACITY_LABELS = [];
    // hide exclude x in the table
    speciesExclude.forEach(el => {
        el.classList.add('d-none');
    })
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
        showElement(['controlsWrapper', 'timeline', 'waveform', 'spectrogram', 'dummy'], false);
        if (!isEmptyObject(predictions)) showElement(['resultTableContainer'], false);
    } else {
        showElement(['loadFileHint', 'loadFileHintText'], true);
    }
}

const navbarAnalysis = document.getElementById('navbarAnalysis');
navbarAnalysis.addEventListener('click', async () => {
    refreshResultsView();
});

const analyzeLink = document.getElementById('analyze');
speciesExclude = document.querySelectorAll('speciesExclude');
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
    summary['suppressed'] = []
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
        batchFileCount = 1;
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
    hideElement(['loadFileHint', 'loadFileHintText', 'loadFileHintSpinner',
        'timeline', 'waveform', 'spectrogram', 'dummy', 'controlsWrapper', 'resultTableContainer', 'recordsContainer']);
}

const save2dbLink = document.getElementById('save2db');
save2dbLink.addEventListener('click', async () => {
    worker.postMessage({action: 'save2db'})
});

const recordsLink = document.getElementById('charts');
recordsLink.addEventListener('click', async () => {
    hideAll();
    showElement(['recordsContainer']);
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
    activeRow.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
    })
    loadResultRegion(row.attributes[0].value.split('|'));
})

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

    worker.postMessage({
        action: 'update-buffer',
        file: file,
        position: wavesurfer.getCurrentTime() / windowLength,
        start: bufferBegin,
        end: bufferBegin + windowLength,
        region: {start: start - bufferBegin, end: end - bufferBegin, label: label}
    });
}

function adjustSpecDims(redraw) {
    $.each([dummyElement, waveWaveElement, specElement, specCanvasElement, waveCanvasElement], function () {
        // Expand up to 512px
        $(this).height(Math.min(bodyElement.height() * 0.4, 512))
    })
    if (wavesurfer) {
        initSpectrogram(Math.min(bodyElement.height() * 0.4, 512));
        specElement.css('z-index', 0);
        resultTableElement.height(contentWrapperElement.height()
            - dummyElement.height()
            - controlsWrapperElement.height()
            - $('#timeline').height()
            - 55);
        // if (redraw && wavesurfer != null) {
        //     wavesurfer.drawBuffer();
        // }
        specCanvasElement.width('100%');
        $('.spec-labels').width('55px')
    } else {
        resultTableElement.height(contentWrapperElement.height()
            - controlsWrapperElement.height()

            - 98);
    }
}

// Fix table head
function tableFixHead(e) {
    const el = e.target,
        sT = el.scrollTop;
    el.querySelectorAll("thead th").forEach(th =>
        th.style.transform = `translateY(${sT}px)`
    );
}

document.querySelectorAll(".tableFixHead").forEach(el =>
    el.addEventListener("scroll", tableFixHead)
);


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
    if (pxPerSec >= 25 * 100) {
        retval = 0.01;
    } else if (pxPerSec >= 25 * 40) {
        retval = 0.025;
    } else if (pxPerSec >= 25 * 10) {
        retval = 0.1;
    } else if (pxPerSec >= 25 * 4) {
        retval = 0.25;
    } else if (pxPerSec >= 25) {
        retval = 5;
    } else if (pxPerSec * 5 >= 25) {
        retval = 10;
    } else if (pxPerSec * 15 >= 25) {
        retval = 15;
    } else {
        retval = Math.ceil(0.5 / pxPerSec) * 60;
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
    var retval;
    if (pxPerSec >= 25 * 100) {
        retval = 10;
    } else if (pxPerSec >= 25 * 40) {
        retval = 4;
    } else if (pxPerSec >= 25 * 10) {
        retval = 10;
    } else if (pxPerSec >= 25 * 4) {
        retval = 4;
    } else if (pxPerSec >= 25) {
        retval = 1;
    } else if (pxPerSec * 5 >= 25) {
        retval = 5;
    } else if (pxPerSec * 15 >= 25) {
        retval = 15;
    } else {
        retval = Math.ceil(0.5 / pxPerSec) * 60;
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
    return Math.floor(1 / timeInterval(pxPerSec));
}

////////// Store preferences //////////

function updatePrefs() {
    try {
        fs.writeFileSync(p.join(appPath, 'config.json'), JSON.stringify(config))
    } catch (e) {
        console.log(e)
    }
}

//////////// Save Detections  ////////////
function saveChirp() {
    predictions['source'] = currentFile;
    predictions['fileEnd'] = fileEnd;  // Preserve creation date
    let content = JSON.stringify(predictions);
    const folder = p.parse(currentFile).dir;
    const source = p.parse(currentFile).name;
    gzip(content).then(buffer => {
        const chirpFile = p.join(folder, source + '.chirp');
        fs.writeFile(chirpFile, buffer, function (err) {
            if (err) throw err;
        })
    }).catch(e => {
        console.log(e);
    })
}

let savedPredictions;

async function loadChirp(file) {
    if (file.endsWith('chirp')) {
        const data = fs.readFileSync(file);
        await ungzip(data).then(buffer => {
            buffer = new TextDecoder().decode(buffer);
            savedPredictions = JSON.parse(buffer);
            currentFile = savedPredictions['source'];
            fileEnd = Date.parse(savedPredictions['fileEnd']);
        })
        fileList = [currentFile];
        await loadAudioFile({filePath: currentFile, originalFileEnd: fileEnd});
        for (const [key, value] of Object.entries(savedPredictions)) {
            if (key === 'source' || key === 'fileEnd') continue;
            await renderResult({result: value, index: key, selection: false});
        }
        await onPredictionDone({labels: {}});
    } else {
        currentFile = file;
        fileList = [currentFile];
        await loadAudioFile({filePath: currentFile, originalFileEnd: fileEnd});
    }
}

async function saveDetections() {
    saveChirp();
    const folder = p.parse(currentFile).dir;
    const source = p.parse(currentFile).name;
    const headings = 'Source File,Position,Time of Day,Common Name,Scientific Name,Confidence';
    let detections_file = p.join(folder, 'Chirpity - detections.csv');
    let detections_list = '';
    // Check if file exists
    let fileExists = true;
    fs.access(detections_file, fs.F_OK, (err) => {
        if (err) {
            // It doesn't, so write headings
            detections_list = headings + '\n';
            console.log(err)
            fileExists = false;
        }
        if (fileExists && !confirm('Append results to existing file?')) {
            // loop through until a new file is found
            let count = 0;
            detections_list = headings + '\n';
            while (fileExists) {
                if (fs.existsSync(detections_file)) {
                    count += 1;
                    detections_file = p.join(folder, `Chirpity - detections (${count}).csv`);
                } else {
                    fileExists = false
                }
            }
        }
        // Convert predictions to csv string buffer
        for (const [key, value] of Object.entries(predictions)) {
            if (key === 'source' || key === 'fileEnd') continue;
            if ((config.nocmig && value.dayNight === 'daytime') || value.excluded) {
                continue
            }
            detections_list += `${source},${value.position},${value.timestamp},${value.cname},${value.sname},${value.score.toFixed(2)}\n`;
        }
        fs.appendFile(detections_file, detections_list, function (err) {
            if (err) throw err;
            alert('Saved file as: ' + detections_file);
        })
    })
}

/////////////////////////  Window Handlers ////////////////////////////
let appPath;
window.onload = async () => {
    // Set config defaults

    config = {
        'spectrogram': true,
        'colormap': 'inferno',
        'timeline': true,
        'minConfidence': 0.45,
        'timeOfDay': false,
        'useWhitelist': true,
        'latitude': 51.9,
        'longitude': -0.4,
        'nocmig': false,
        'batchSize': 1
    }
    config.UUID = uuidv4();
    // Load preferences and override defaults
    appPath = await getPath();
    worker.postMessage({action: 'load-db', path: appPath, lat: config.latitude, lon: config.longitude})
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
        if (!('useWhitelist' in config)) {
            config.useWhitelist = true;
        }
        updatePrefs()

        // Set UI option state
        $('#' + config.batchSize).click();

        if (!config.useWhitelist) {
            $('#useWhitelist .tick').hide()
        }
        if (!config.spectrogram) {
            $('#loadSpectrogram .tick').hide()
        }
        if (!config.timeline) {
            $('#loadTimeline .tick').hide()
        }
        if (config.timeOfDay) {
            $('#timeOfDay').click()
        } else {
            $('#timecode').click()
        }
        if (config.nocmig) {
            nocmigButton.classList.add('active')
        }
        showElement([config.colormap + 'span'], true)

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
                    ;
                    break;
                case 'worker-loaded-audio':
                    onWorkerLoadedAudio(args);
                    break;
                case 'chart-data':
                    onChartData(args);
                    break;
                case 'generate-alert':
                    alert(args.message)
                    break;
            }
        })
    })
    // Set footer year
    $('#year').text(new Date().getFullYear());
    // Populate feedback modal
    feedbackTable.append(generateBirdList('my'));
    speciesSearchForm.append(generateBirdList('search'));
    //Cache list elements
    speciesListItems = $('#myUL li span');
    searchListItems = $('#searchUL');
};

function generateBirdList(prefix) {
    let listHTML = '';
    if (prefix === 'my') {
        listHTML += "<p>What sound do you think this is?</p>"
    }
    listHTML +=
        `<input type="text" id="${prefix}Input" onkeyup="myFunction('${prefix}')" placeholder="Search for a species...">
        <ul id="${prefix}UL">`;
    if (prefix === 'my') {
        listHTML += `
            <li><a href="#">Animal<span class="material-icons-two-tone submitted text-success d-none">done</span></a></li>
            <li><a href="#">Ambient Noise<span class="material-icons-two-tone submitted text-success d-none">done</span></a></li>
            <li><a href="#">Human<span class="material-icons-two-tone submitted text-success d-none">done</span></a></li>
            <li><a href="#">Vehicle<span class="material-icons-two-tone submitted text-success d-none">done</span></a></li>`;
    }

    const excluded = new Set(['human', 'vehicles', 'animals', 'No call']);
    for (const item in labels) {
        const [sname, cname] = labels[item].split('_');
        if (!excluded.has(cname)) {
            listHTML += `<li><a href="#">${cname} - ${sname}<span class="material-icons-two-tone submitted text-success d-none">done</span></a></li>`;
        }
    }
    listHTML += '</ul>';
    return listHTML;
}

// Feedback list handler
$(document).on('click', '#myUL li', function (e) {
    correctedSpecies = formatFilename(e.target.innerText);
    const regex = /done$/;
    correctedSpecies = correctedSpecies.replace(regex, '');
    speciesListItems.addClass('d-none');
    e.target.closest('a').childNodes[1].classList.remove('d-none');
})
// Search list handler
$(document).on('focus', '#searchInput', function () {
    searchListItems.removeClass('d-none');
    document.removeEventListener('keydown', handleKeyDown, true);
})

$(document).on('blur', '#searchInput', function () {
    document.addEventListener('keydown', handleKeyDown, true);
})
let t0;
$(document).on('click', '#searchUL li', function (e) {
    let graphSpecies = formatFilename(e.target.innerText);

    const regex = /done$/;
    graphSpecies = graphSpecies.replace(regex, '').split('~')[0].replace(/_/g, ' ');
    document.getElementById('searchInput').value = graphSpecies;
    t0 = Date.now();
    worker.postMessage({action: 'chart-request', species: graphSpecies})
    searchListItems.addClass('d-none');
    //e.target.closest('a').childNodes[1].classList.remove('d-none');
})


function onChartData(args) {
    const genTime = Date.now() - t0;
    const genTimeElement = document.getElementById('genTime')
    genTimeElement.innerText = (genTime / 1000).toFixed(1) + ' seconds';
    showElement(['dataRecords'], false);
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
    let chartOptions = {};
    chartOptions.colors = ["#3385c6", "#4279a3", "#476c8a", "#49657b", "#7f8e9e"];
    chartOptions.chart = {
        zoomType: 'x',
        backgroundColor: {linearGradient: [0, 0, 0, 500], stops: [[0, "#dbe2ed"], [1, "#EEEEEE"]]}
    }
    chartOptions.credits = {text: 'Chart generated by Chirpity Nocmig', href: ''}
    //chartOptions.chart = {type: 'column'};
    chartOptions.title = {text: `${args.species} Records`};
    chartOptions.xAxis = {
        title: {text: 'Week Number'},
        accessibility: {description: 'Weeks of the year'},
    }
    // Week number should start from 1 not 0....
    chartOptions.xAxis.categories = Array.from({length: 52}, (_, i) => i + 1)
    chartOptions.yAxis = [
        {
            title: {text: 'Totals'},
            accessibility: {description: 'Count of records'}
        }, {
            title: {text: 'Hourly Detection Rate'},
            accessibility: {description: 'Hourly rate of records'},
            opposite: true
        }];
    chartOptions.tooltip = {
        crosshairs: true, shared: true, formatter: function () {
            return this.points.reduce(function (s, point) {
                return s + '<br/><span style="font-weight: bold;color: ' + point.series.color + '">&#9679; </span>' + point.series.name + ': ' +
                    point.y + ' calls';
            }, '<b>Week ' + this.x + '</b>');
        }
    };
    chartOptions.series = [];
    chartOptions.series.push({
        name: 'Average hourly (all years)',
        marker: 'diamond',
        yAxis: 1,
        type: 'areaspline',
        data: rate,
        lineWidth: 0,
        fillColor: {
            linearGradient: [0, 0, 0, 300],
            stops: [
                [0, Highcharts.getOptions().colors[0]],
                [1, Highcharts.color(Highcharts.getOptions().colors[0]).setOpacity(0.2).get('rgba')]
            ]
        }
    });
    for (const key in results
        ) {
        chartOptions.series.push({
            name: 'Total for week in ' + key,
            marker: 'diamond',
            type: 'column',
            data: results[key]
        });
    }
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
    Highcharts.chart('container', chartOptions);
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
    }, 500, 'id1');
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

document.addEventListener('DOMContentLoaded', function () {

    enableKeyDownEvent();

});

///////////// Nav bar Option handlers //////////////

$(document).on('click', '#loadSpectrogram', function () {
    if (config.spectrogram) {
        config.spectrogram = false;
        $('#loadSpectrogram .tick').hide()
        $('.specFeature').hide()
        hideElement(['dummy', 'timeline', 'waveform', 'spectrogram']);
        $('.speccolor .timeline').addClass('disabled');
        //adjustSpecDims(true);
        updatePrefs();
    } else {
        config.spectrogram = true;
        $('#loadSpectrogram .tick').show()
        $('.specFeature').show()
        if (wavesurfer && wavesurfer.isReady) {
            $('.speccolor .timeline').removeClass('disabled');
            showElement(['dummy', 'timeline', 'waveform', 'spectrogram'], false);
        } else {
            loadAudioFile({filePath: currentFile});
        }
        updatePrefs();
    }
})

function initSpectrogram(height) {
    let fftSamples;
    if (windowLength < 2) {
        fftSamples = 256;
    } else {
        fftSamples = 512;
    }
    if (!height) {
        height = fftSamples / 2
    }
    if (wavesurfer.spectrogram) wavesurfer.destroyPlugin('spectrogram');
    wavesurfer.addPlugin(WaveSurfer.spectrogram.create({
        wavesurfer: wavesurfer,
        container: "#spectrogram",
        scrollParent: false,
        fillParent: true,
        windowFunc: 'hamming',
        minPxPerSec: 1,
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
    initSpectrogram();
    // set tick
    $('.speccolor .tick').addClass('d-none');
    $(this).children('span').removeClass('d-none');
    // refresh caches
    updateElementCache()
    adjustSpecDims(true)
    updatePrefs();
})

$(document).on('click', '#useWhitelist', function () {
    if (config.useWhitelist) {
        config.useWhitelist = false;
        $('#useWhitelist .tick').hide()
    } else {
        config.useWhitelist = true;
        $('#useWhitelist .tick').show()
    }
    worker.postMessage({action: 'load-model', useWhitelist: config.useWhitelist, batchSize: config.batchSize});
    updatePrefs();
})

$(document).on('click', '.timeline', function () {
    if (wavesurfer.timeline && wavesurfer.timeline.wrapper !== null) {
        wavesurfer.destroyPlugin('timeline');
        $('#loadTimeline .tick').hide()
        config.timeline = false;
        updatePrefs();
    } else {
        config.timeline = true;
        wavesurfer.addPlugin(WaveSurfer.timeline.create({
            wavesurfer: wavesurfer,
            container: "#timeline",
            formatTimeCallback: formatTimeCallback,
            timeInterval: timeInterval,
            primaryLabelInterval: primaryLabelInterval,
            secondaryLabelInterval: secondaryLabelInterval,
            primaryColor: 'black',
            secondaryColor: 'grey',
            primaryFontColor: 'black',
            secondaryFontColor: 'grey'
        })).initPlugin('timeline');
        $('#loadTimeline .tick').show()
        // refresh caches
        updateElementCache()
        adjustSpecDims(true)
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
    $('#timecode .tick').hide();
    $('#timeOfDay .tick').show();
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
    config.nocmig = false;
    nocmigButton.classList.remove('active');
    const timefields = document.querySelectorAll('.timestamp')
    timefields.forEach(time => {
        time.classList.add('d-none');
    })
    $('#timeOfDay .tick').hide();
    $('#timecode .tick').show();
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
        if (AUDACITY_LABELS.length > 0) {
            if (e.ctrlKey) saveDetections();
        }
    },
    KeyA: function (e) {
        if (AUDACITY_LABELS.length > 0) {
            if (e.ctrlKey) showSaveDialog();
        }
    },
    Escape: function () {
        console.log('Operation aborted');

        worker.postMessage({action: 'abort'});
        alert('Operation cancelled');

    }
    ,
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
    }
    ,
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
    }
    ,
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
    }
    ,
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
    }
    ,
    ArrowLeft: function () {
        if (wavesurfer) {
            wavesurfer.skipBackward(0.1);
            const position = wavesurfer.getCurrentTime() / windowLength;
            if (wavesurfer.getCurrentTime() < 0.1 && bufferBegin > 0) {
                bufferBegin -= 0.5;
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
    }
    ,
    ArrowRight: function () {
        if (wavesurfer) {
            wavesurfer.skipForward(0.1);
            const position = wavesurfer.getCurrentTime() / windowLength;
            if (wavesurfer.getCurrentTime() > windowLength - 0.1) {
                bufferBegin = Math.min(currentFileDuration - windowLength, bufferBegin += 0.5)
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
    }
    ,
    KeyP: function () {
        (typeof region !== 'undefined') ? region.play() : console.log('Region undefined')
    }
    ,
    Equal: function () {
        if (wavesurfer) {
            zoomSpec('in')
        }
    }
    ,
    NumpadAdd: function () {
        if (wavesurfer) {
            zoomSpec('in')
        }
    }
    ,
    Minus: function () {
        if (wavesurfer) {
            zoomSpec('out')
        }
    }
    ,
    NumpadSubtract: function () {
        if (wavesurfer) {
            zoomSpec('out')
        }
    }
    ,
    Tab: function (e) {
        if (activeRow) {
            if (e.shiftKey) {
                if (activeRow.previousSibling !== null) {
                    activeRow.classList.remove('table-active')
                    while (activeRow.previousSibling.classList.contains('d-none')) {
                        activeRow = activeRow.previousSibling;
                    }
                    activeRow = activeRow.previousSibling;
                }
            } else {
                if (activeRow.nextSibling !== null) {
                    activeRow.classList.remove('table-active')
                    while (activeRow.nextSibling.classList.contains('d-none')) {
                        activeRow = activeRow.nextSibling;
                    }
                    activeRow = activeRow.nextSibling;
                }
            }
            if (activeRow !== null) activeRow.click();
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

function onWorkerLoadedAudio(args) {
    if (args.preserveResults) completeDiv.hide();
    console.log('UI received worker-loaded-audio: ' + args.file)
    currentBuffer = new AudioBuffer({length: args.length, numberOfChannels: 1, sampleRate: 24000});
    currentBuffer.copyToChannel(args.contents, 0);

    workerHasLoadedFile = true;
    currentFile = args.file;
    bufferBegin = args.bufferBegin;
    currentFileDuration = args.sourceDuration;
    fileStart = args.fileStart;
    if (config.timeOfDay) {
        bufferStartTime = new Date(fileStart + (bufferBegin * 1000))
    } else {
        bufferStartTime = new Date(zero.getTime() + (bufferBegin * 1000))
    }

    if (windowLength > currentFileDuration) windowLength = currentFileDuration;
    let astro = SunCalc.getTimes(fileStart, config.latitude, config.longitude);
    dusk = astro.dusk.getTime();
    // calculate dawn for following day
    let astro2 = SunCalc.getTimes(fileStart + 8.64e+7, config.latitude, config.longitude);
    dawn = astro2.dawn.getTime();
    if (config.nocmig && fileEnd < dusk && fileStart > dawn) {
        alert(`All timestamps in this file are during daylight hours. \n\nNocmig mode will be disabled.`)
        $('#timecode').click();
    }
    if (modelReady) {
        enableMenuItem(['analyze']);
        if (fileList.length > 1) analyzeAllLink.classList.remove('disabled');
    }
    fileLoaded = true;

    if (!wavesurfer) {
        initWavesurfer({
            'audio': currentBuffer,
            'backend': 'WebAudio',
            'alpha': 0,
        });
    } else {
        wavesurfer.clearRegions();
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

async function onPredictionDone(args) {
    AUDACITY_LABELS.push(args.labels);
    // Defer further processing until batch complete
    if (args.batchInProgress) {
        progressDiv.show();
        batchFileCount++;
        fileNumber.innerText = `(File ${batchFileCount} of ${fileList.length})`;
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

    if (AUDACITY_LABELS.length > 0) {
        enableMenuItem(['saveLabels', 'saveDetections']);
        $('.download').removeClass('disabled');
    } else {
        disableMenuItem(['saveLabels', 'saveDetections']);
    }
    analyzeLink.disabled = false;
    console.table(summary);
    // Sort summary by count
    let sortable = [];
    for (const bird in summary) {
        if (bird !== 'suppressed') sortable.push([bird, summary[bird]]);
    }
    sortable.sort(function (a, b) {
        return a[1] - b[1];
    });
    //count down from most seen:
    sortable = sortable.reverse();
    // Recreate object
    var summarySorted = {}
    sortable.forEach(function (item) {
        summarySorted[item[0]] = item[1]
    })

    let summaryHTML = `<table class="table table-striped table-dark table-hover p-1"><thead class="thead-dark">
            <tr>
                <th scope="col"  class="text-center">Filter</th>
                <th scope="col" class="text-center">Hide</th>
                <th scope="col">Species</th>
                <th scope="col" class="text-right">Count</th>
                <th scope="col" class="text-right">Exclude</th>
            </tr>
            </thead><tbody>`;
    let suppression_warning = '';
    for (const [key, value] of Object.entries(summarySorted)) {
        (summary['suppressed'].indexOf(key) !== -1) ? suppression_warning = `
            <span class="material-icons-two-tone"  style="font-size: 20px" 
            title="Species suppression may have affected the count.\nRefer to the results table for details.">
            priority_high</span>` : suppression_warning = '';
        summaryHTML += `<tr>
                        <td class="text-center"><span class="spinner-border spinner-border-sm text-success d-none" role="status"></span>
                         <span id="${key}" class="material-icons-two-tone align-bottom speciesFilter pointer">filter_alt</span>
                        </td>
                        <td class="text-center"><span class="spinner-border spinner-border-sm text-danger d-none" role="status"></span>
                         <span id="${key}" class="material-icons-two-tone align-bottom speciesHide pointer">filter_alt_off</span>
                        </td>                        
                        <td>${key}${suppression_warning}</td><td class="text-right"> ${value}</td>
                        <td class="text-center"><span class="spinner-border spinner-border-sm text-danger d-none" role="status"></span>
                         <span id="${key}" class="material-icons-two-tone align-bottom speciesExclude pointer">clear</span></td></tr>`;
    }
    summaryHTML += '</tbody></table>';
    summaryTable.append(summaryHTML);
    speciesName = document.querySelectorAll('.cname');
    subRows = document.querySelectorAll('.subrow')
    const materialIcons = document.querySelectorAll('.rotate')
    speciesFilter = document.querySelectorAll('.speciesFilter');
    speciesHide = document.querySelectorAll('.speciesHide');
    speciesExclude = document.querySelectorAll('.speciesExclude');
    speciesExclude.forEach(el => {
        el.classList.remove('d-none');
    })
    const tableRows = document.querySelectorAll('#results tr');

    $(document).on('click', '.speciesHide', function (e) {
        const spinner = e.target.parentNode.firstChild.classList;
        spinner.remove('d-none');
        const targetClass = e.target.classList;
        targetClass.add('d-none');
        e.target.parentNode.previousElementSibling.children[1].classList.remove('text-success');
        if (targetClass.contains('text-danger')) {
            targetClass.remove('text-danger')
            setTimeout(matchSpecies, 1, e, 'unhide');
        } else {
            targetClass.add('text-danger');
            speciesName.forEach(function (el) {
                const classes = el.parentNode.classList;
                if (!classes.contains('hidden')) classes.remove('d-none')
            })
            setTimeout(matchSpecies, 1, e, 'hide');
        }
        tableRows[0].scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
        })
        e.stopImmediatePropagation();
    });

    $(document).on('click', '.speciesExclude', function (e) {
        const spinner = e.target.parentNode.firstChild.classList;
        spinner.remove('d-none');
        const targetClass = e.target.classList;
        targetClass.add('d-none');
        if (targetClass.contains('text-danger')) {
            targetClass.remove('text-danger')
            setTimeout(matchSpecies, 1, e, 'unexclude');
        } else {
            targetClass.add('text-danger');
            setTimeout(matchSpecies, 1, e, 'exclude');
        }
        e.stopImmediatePropagation();
    });
    let filterMode = null;
    speciesName = document.querySelectorAll('.cname');
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
        const spinner = e.target.parentNode.firstChild.classList;
        // Remove any exclusion from the species to filter
        e.target.parentNode.nextElementSibling.children[1].classList.remove('text-danger');
        const targetClass = e.target.classList;
        if (targetClass.contains('text-success')) {
            // Clicked on filtered species icon
            targetClass.remove('text-success')
            speciesName.forEach(function (el) {
                const classes = el.parentNode.classList;
                if (!classes.contains('hidden')) classes.remove('d-none')
            })
        } else {
            // Clicked on unfiltered species icon
            speciesFilter.forEach(function (el) {
                el.classList.remove('text-success');
            })
            // Hide open subrows
            subRows.forEach(function (el) {
                el.classList.add('d-none');
            })
            // Flip open icon back up
            materialIcons.forEach(function (el) {
                el.classList.remove('down');
            })
            targetClass.add('text-success');
            targetClass.add('d-none');
            spinner.remove('d-none');
            // Allow spinner to show
            const setDelay = setTimeout(matchSpecies, 1, e, 'filter');
        }
        tableRows[0].scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
        })
        e.stopImmediatePropagation();
    });

    // Diagnostics:
    t1_analysis = Date.now();
    diagnostics['Analysis Duration'] = ((t1_analysis - t0_analysis) / 1000).toFixed(2) + ' seconds';
    diagnostics['Analysis Rate'] = (diagnostics['Audio Duration'] / ((t1_analysis - t0_analysis) / 1000)).toFixed(0) + 'x faster than real time performance.';
}

function matchSpecies(e, mode) {
    const spinner = e.target.parentNode.firstChild.classList;
    const hideIcon = e.target.closest('tr').getElementsByClassName('speciesHide')[0];
    const targetClass = e.target.classList;
    let resultSpecies, currentRow;
    const tableContext = e.target.closest('table').id;
    if (tableContext === 'results') {
        currentRow = e.target.closest('tr');
        currentRow.classList.add('strikethrough');
        resultSpecies = currentRow.querySelectorAll('td.cname');
    } else {
        resultSpecies = speciesName;
    }
    resultSpecies.forEach(function (el) {
        const classes = el.parentNode.classList;
        const excludeIcon = el.parentNode.getElementsByClassName('speciesExclude')[0];
        const index = el.parentNode.firstElementChild.innerText;
        // Extract species common name from cell
        const searchFor = el.innerText.split('\n')[0];
        if (searchFor === e.target.id || tableContext === 'results') {
            if (mode === 'filter' || mode === 'unhide') {
                classes.remove('d-none', 'hidden');
                excludeIcon.classList.remove('text-danger');
            } else if (mode === 'exclude') {
                if (tableContext !== 'results') {
                    hideIcon.classList.add('text-danger');
                    classes.add('d-none');
                }
                classes.add('strikethrough');
                // add state to predictions
                excludeIcon.classList.add('text-danger');
                predictions[index].excluded = true;
            } else if (mode === 'unexclude') {
                classes.remove('strikethrough');
                excludeIcon.classList.remove('text-danger');
                predictions[index].excluded = false;
            } else classes.add('d-none', 'hidden'); // mode == hide
        } else if (mode === 'filter') classes.add('d-none');
    })
    spinner.add('d-none');
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
    let tableRows;
    let tr = '';
    if (index === 1) {
        if (!controlsWrapperElement.hasClass('d-none')) showElement(['resultTableContainer']);
        if (!selection) {
            tableRows = document.querySelectorAll('#results tr');
            // Remove old results
            resultTable.empty();
            summaryTable.empty();
            tableRows[0].scrollIntoView({behavior: 'smooth', block: 'nearest'})
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
        if (result.cname in summary) {
            if (result)
                summary[result.cname] += 1
        } else {
            summary[result.cname] = 1
        }
        if (result.suppressed === 'text-danger') summary['suppressed'].push(result.cname);
        const start = result.start, end = result.end;
        let icon_text;
        let feedback_icons;
        let confidence = '';
        if (result.score < 0.65) {
            confidence = '&#63;';
        }
        feedback_icons = `<span class='material-icons-two-tone text-success feedback pointer'>thumb_up_alt</span>
                              <span class='material-icons-two-tone text-danger feedback pointer'>thumb_down_alt</span>`;
        result.suppressed ? icon_text = `sync_problem` : icon_text = 'sync';
        result.date = result.timestamp;
        const UI_timestamp = result.timestamp.toString().split(' ')[4];
        result.filename = result.cname.replace(/'/g, "\\'") + ' ' + result.timestamp + '.mp3';
        let spliceStart;
        result.position < 3600000 ? spliceStart = 14 : spliceStart = 11;
        const UI_position = new Date(result.position).toISOString().substring(spliceStart, 19);
        // Now we have formatted the fields, and skipped detections as required by nocmig mode, add result to predictions file
        if (selection) {
            tableRows = document.querySelectorAll('#results tr.top-row');
            index = tableRows.length + 1;
        }
        predictions[index] = result;
        let showTimeOfDay;
        config.timeOfDay ? showTimeOfDay = '' : showTimeOfDay = 'd-none';
        let excluded;
        result.excluded ? excluded = 'strikethrough' : excluded = '';
        tr += `<tr name="${file}|${start}|${end}|${result.cname}${confidence}" class='border-top border-secondary top-row ${excluded} ${result.dayNight}'>
            <th scope='row'>${index}</th><td class='flex-fill timestamp ${showTimeOfDay}'>${UI_timestamp}</td>
            <td>${UI_position}</td><td name="${result.cname}" class='flex-fill cname'>${result.cname}<br/>
                <i>${result.sname}</i></td><td class='flex-fill text-center'>${iconizeScore(result.score)}</td>
            <td class='text-center'><span id='${index}' title="Click for additional detections" class='material-icons rotate pointer d-none'>${icon_text}</span></td>
            <td class='specFeature text-center'><span class='material-icons-two-tone play pointer'>play_circle_filled</span></td>
            <td class='text-center'><a href='https://xeno-canto.org/explore?query=${result.sname}%20type:nocturnal' target="xc">
            <img src='img/logo/XC.png' alt='Search ${result.cname} on Xeno Canto' title='${result.cname} NFCs on Xeno Canto'></a></td>
            <td class='specFeature text-center download'><span class='material-icons-outlined pointer'>file_download</span></td>
            <td class="text-center speciesExclude d-none"><span class="spinner-border spinner-border-sm text-danger d-none" role="status"></span>
                 <span class="material-icons-two-tone align-bottom pointer">clear</span></td>
            <td id="${index}" class='specFeature text-center'>${feedback_icons}</td>
        </tr>`;
        if (result.score2 > 0.2) {
            tr += `<tr name="${file},${start},${end},${result.cname}${confidence}" id='subrow${index}' class='subrow d-none'>
                <th scope='row'>${index}</th><td> </td><td> </td><td class='cname2'>${result.cname2}<br/>
                    <i>${result.sname2}</i></td><td class='text-center'>${iconizeScore(result.score2)}</td>
                <td> </td><td class='specFeature'> </td>
                <td><a href='https://xeno-canto.org/explore?query=${result.sname2}%20type:nocturnal' target=\"_blank\">
                    <img src='img/logo/XC.png' alt='Search ${result.cname2} on Xeno Canto' title='${result.cname2} NFCs on Xeno Canto'></a> </td>
                <td class='specFeature'> </td>
                <td class='specFeature speciesExclude d-none'> </td>
                <td class='specFeature'> </td>
               </tr>`;
            if (result.score3 > 0.2) {
                tr += `<tr name="${file},${start},${end},${result.cname}${confidence}" id='subsubrow${index}' class='subrow d-none'>
                    <th scope='row'>${index}</th><td> </td><td> </td><td class='cname3'>${result.cname3}<br/>
                        <i>${result.sname3}</i></td><td class='text-center'>${iconizeScore(result.score3)}</td>
                    <td> </td><td class='specFeature'> </td>
                    <td><a href='https://xeno-canto.org/explore?query=${result.sname3}%20type:nocturnal' target=\"_blank\">
                        <img src='img/logo/XC.png' alt='Search ${result.cname3} on Xeno Canto' title='${result.cname3} NFCs on Xeno Canto'></a> </td>
                    <td class='specFeature'> </td>
                    <td class='specFeature speciesExclude d-none'> </td>
                    <td class='specFeature'> </td>
                   </tr>`;
            }
        }
    }
    resultTable.append(tr)
    if (selection) {
        tableRows = document.querySelectorAll('#results tr.top-row');
        tableRows[tableRows.length - 1].scrollIntoView({behavior: 'smooth', block: 'nearest'})
    }
    // Show the alternate detections toggle:
    if (result.score2 > 0.2) {
        document.getElementById(index).classList.remove('d-none')
    }
    if (!config.spectrogram) $('.specFeature').hide();
}

$(document).on('click', '.material-icons', function () {
    $(this).toggleClass("down");
})

// Results event handlers

function getSpeciesIndex(e) {
    clickedNode = e.target.parentNode
    clickedIndex = clickedNode.parentNode.querySelector('th').innerText
}

$(document).on('click', '.download', function (e) {
    mode = 'save';
    getSpeciesIndex(e);
    sendFile(mode, predictions[clickedIndex])
    e.stopImmediatePropagation();
});
$(document).on('click', '.feedback', function (e) {

    let index = e.target.parentNode.id;
    e.target.parentNode.onclick = null;
    let mode;
    (e.target.classList.contains('text-success')) ? mode = 'correct' : mode = 'incorrect';
    getSpeciesIndex(e);
    if (mode === 'incorrect') {
        findSpecies();
    } else if (confirm('Submit feedback?')) {
        predictions[clickedIndex].filename = predictions[clickedIndex].cname.replace(/\s+/g, '_') +
            '~' + predictions[clickedIndex].sname.replace(' ', '_') + '_' + Date.now().toString() + '.mp3';
        sendFile('correct', predictions[clickedIndex]);
        clickedNode.innerHTML = 'Submitted <span class="material-icons-two-tone submitted text-success">done</span>'
    }
    e.stopImmediatePropagation();

});
$(document).on('click', '.rotate', function (e) {
    const row1 = e.target.parentNode.parentNode.nextSibling;
    const row2 = row1.nextSibling;
    row1.classList.toggle('d-none')
    if (row2 && !row2.classList.contains('top-row')) row2.classList.toggle('d-none')
    e.stopImmediatePropagation();
})


function findSpecies() {
    document.removeEventListener('keydown', handleKeyDown, true);
    speciesListItems.addClass('d-none');
    const feedback = new bootstrap.Modal(document.getElementById('feedbackModal'));
    feedback.show()
}

function formatFilename(filename) {
    filename = filename.replace(' - ', '~').replace(/\s+/g, '_',);
    if (!filename.includes('~')) filename = filename + '~' + filename; // dummy latin
    return filename;
}

$('#feedbackModal').on('hidden.bs.modal', function (e) {
    enableKeyDownEvent();
    if (correctedSpecies) {
        predictions[clickedIndex].filename = correctedSpecies + '_' + Date.now().toString() + '.mp3';
        sendFile('incorrect', predictions[clickedIndex]);
        correctedSpecies = undefined;
        clickedNode.innerHTML = 'Submitted <span class="material-icons-two-tone submitted text-success">done</span>';
    }
})


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
            'UUID': config.UUID,
            'start': start,
            'end': end,
            'filename': result.filename,
            'cname': result.cname,
            'sname': result.sname,
            'score': result.score,
            'cname2': result.cname2,
            'sname2': result.sname2,
            'score2': result.score2,
            'cname3': result.cname3,
            'sname3': result.sname3,
            'score3': result.score3,
            'date': result.date,
            'lat': config.latitude,
            'lon': config.longitude,
            'version': version
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
    'guess': '<span class="material-icons text-secondary score border border-secondary rounded" title="--%">signal_cellular_alt_1_bar</span>',
    'low': '<span class="material-icons score text-danger border border-secondary rounded" title="--%">signal_cellular_alt_1_bar</span>',
    'medium': '<span class="material-icons score text-warning border border-secondary rounded" title="--%">signal_cellular_alt_2_bar</span>',
    'high': '<span class="material-icons score text-success border border-secondary rounded" title="--%">signal_cellular_alt</span>',
    //'low': '<span class="material-icons text-danger border border-secondary rounded" title="Low">signal_cellular_alt_1_bar</span>',
    //'medium': '<span class="material-icons text-warning border border-secondary rounded" title="Medium">signal_cellular_alt_2_bar</span>',
    //'high': '<span class="material-icons text-success border border-secondary rounded" title="High">signal_cellular_alt</span>',
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
    const file = showOpenDialog();
});

$('#saveDetections').on('click', function () {
    saveDetections();
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
const nocmigButton = document.getElementById('nocmigMode');
nocmigButton.addEventListener('click', function (e) {
    if (config.nocmig) {
        config.nocmig = false;
        $('#timecode').click();
        nocmigButton.classList.remove('active');
    } else {
        config.nocmig = true;
        $('#timeOfDay').click();
        nocmigButton.classList.add('active');
    }
    updatePrefs();
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

// Set batch size
$('.batch').on('click', function (e) {
    const batchSize = e.target.id || config.batchSize;
    worker.postMessage({action: 'load-model', useWhitelist: config.useWhitelist, batchSize: batchSize});
    $('.batch span').addClass('d-none');
    e.target.lastChild.classList.remove('d-none');
    config.batchSize = e.target.id || config.batchSize;
    updatePrefs();
});

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
        console.log(f)
        filelist.push(f.path);
    }
    await onOpenFiles({filePaths: filelist})
});
