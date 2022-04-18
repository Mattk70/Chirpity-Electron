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
                    worker.postMessage('fire it up');
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


async function getPath(){
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

let modelReady = false, fileLoaded = false, currentFile, fileList, resultHistory = {};
let region, AUDACITY_LABELS, wavesurfer;
let summary = {};
summary['suppressed'] = [];
let fileStart, bufferStartTime, ctime;
let startPosition; //
let zero = new Date(Date.UTC(0, 0, 0, 0, 0, 0));
// set up some DOM element caches
let bodyElement = $('body');
let dummyElement, specElement, waveElement, specCanvasElement, specWaveElement;
let waveCanvasElement, waveWaveElement, resultTableElement = $('#resultTableContainer');
let contentWrapperElement = $('#contentWrapper');
let controlsWrapperElement = $('#controlsWrapper');
let completeDiv = $('.complete');
const resultTable = $('#resultTableBody')
const summaryTable = $('#summaryModalBody');
const feedbackTable = $('#feedbackModalBody');
let activeRow;
let predictions = {}, correctedSpecies, speciesListItems, clickedNode,
    clickedIndex, speciesName, speciesFilter, speciesHide, speciesExclude, subRows, scrolled, currentFileDuration;

let currentBuffer, bufferBegin = 0, windowLength = 20;  // seconds
let workerHasLoadedFile = false;
// Set default Options
let config;
const sampleRate = 24000;
let controller = new AbortController();
let signal = controller.signal;
let restore = false;

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
            const vram = key + ' memory';
            diagnostics[key] = gpu.model;
            diagnostics[vram] = `${gpu.vram}MB`;
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
        diagnostics[key] = `${data.total / Math.pow(1024, 3).toFixed(0)}GB`;
    })
    .catch(error => console.error(error));
console.table(diagnostics);

const audioCtx = new AudioContext({latencyHint: 'interactive', sampleRate: sampleRate});

const fetchAudioFile = (filePath) =>
    fetch(filePath, {signal})
        .then((res => res.arrayBuffer()))
        .then((arrayBuffer) => audioCtx.decodeAudioData(arrayBuffer))
        .then((buffer) => {
            if (!controller.signal.aborted) {
                let source = audioCtx.createBufferSource();
                source.buffer = buffer;
                currentFileDuration = source.buffer.duration;
                // Diagnostics
                diagnostics['Audio Duration'] = currentFileDuration.toFixed(2) + ' seconds';
                if (currentFileDuration < 20) windowLength = currentFileDuration;

                fileStart = new Date(ctime - (currentFileDuration * 1000));
                let astro = SunCalc.getTimes(fileStart, config.latitude, config.longitude);
                dusk = astro.dusk;
                dawn = astro.dawn;
                if (config.nocmig && ctime < dusk && fileStart > dawn) {
                    alert(`All timestamps in this file are during daylight hours. \n\nNocmig mode will be disabled.`)
                    $('#timecode').click();
                }
                const offlineCtx = new OfflineAudioContext(1, sampleRate * currentFileDuration, sampleRate);
                const offlineSource = offlineCtx.createBufferSource();
                offlineSource.buffer = buffer;
                offlineSource.connect(offlineCtx.destination);
                offlineSource.start();
                offlineCtx.startRendering()
                    .then(function (resampled) {
                        console.log('Rendering completed successfully');
                        // `resampled` contains an AudioBuffer resampled at 24000Hz.
                        // use resampled.getChannelData(x) to get an Float32Array for channel x.
                        currentBuffer = resampled;
                        loadBufferSegment(resampled, bufferBegin)
                    }).then(() => {
                    if (restore) showTheResults();
                })
            } else {
                throw new DOMException('Rendering cancelled at user request', "AbortError")
            }
        })
        .catch(function (e) {
            console.log("Error with decoding audio data " + e.message);
            if (e.name === "AbortError") {
                // We know it's been canceled!
                console.warn('Fetch aborted: sending message to worker')
                hideAll();
                disableMenuItem(['analyze', 'analyzeSelection'])
                showElement(['loadFileHint']);
                showElement(['loadFileHintText'], false);
            }
        })

function resetResults() {
    summary = {};
    summaryTable.empty();
    resultTable.empty();
    summary['suppressed'] = []
    predictions = {};
    seenTheDarkness = false;
    shownDaylightBanner = false;
}

async function loadAudioFile(filePath, OriginalCtime) {
    workerHasLoadedFile = false;
    resetResults();
    // Hide load hint and show spinnner
    if (wavesurfer) {
        wavesurfer.destroy();
        wavesurfer = undefined;
    }
    // set file creation time
    try {
        ctime = fs.statSync(filePath).mtime;
        worker.postMessage({action: 'file-load-request', message: filePath});
    } catch (e) {
        const supported_files = ['.mp3', '.wav', '.mpga', '.ogg', '.flac', '.aac', '.mpeg', '.mp4'];
        const dir = p.parse(filePath).dir;
        const name = p.parse(filePath).name;
        let file;
        supported_files.some(ext => {
            try {
                file = p.join(dir, name + ext);
                ctime = fs.statSync(file).mtime;
            } catch (e) {
                // Try the next extension
            }
            return ctime;
        })
        if (!ctime) {
            alert("Unable to load source file with any supported file extension: " + filePath)
            return;
        } else {
            if (file) filePath = file;
            if (OriginalCtime) ctime = OriginalCtime;
            worker.postMessage({action: 'file-load-request', message: filePath});
        }
    }

    hideAll();
    disableMenuItem(['analyzeSelection', 'analyze'])
    showElement(['loadFileHint', 'loadFileHintSpinner', 'loadFileHintLog']);


    // Reset the buffer playhead and zoom:
    bufferBegin = 0;
    windowLength = 20;
    if (config.spectrogram) {
        controller = new AbortController();
        signal = controller.signal;
        await fetchAudioFile(filePath);
    } else {
        // remove the file hint stuff
        hideAll();
        // Show controls
        showElement(['controlsWrapper']);
        $('.specFeature').hide()
    }
    if (!controller.signal.aborted) {
        fileLoaded = true;
        completeDiv.hide();
        //const filename = filePath.replace(/^.*[\\\/]/, '')
        let filenameElement = document.getElementById('filename');
        filenameElement.innerHTML = '';

        //
        let count = 0
        let appendstr = '<div id="fileContainer" class="bg-dark text-nowrap pr-3">';
        fileList.forEach(item => {
            if (count === 0) {
                if (fileList.length > 1) {
                    appendstr += '<span class="revealFiles visible pointer" id="filename_' + count + '">'
                    appendstr += '<span class="material-icons-two-tone pointer">library_music</span>'
                } else {
                    appendstr += '<span class="material-icons-two-tone align-bottom">audio_file</span>'
                }
            } else {
                appendstr += '<span class="openFiles pointer" id="filename_' + count + '"><span class="material-icons-two-tone align-bottom">audio_file</span>'
            }
            appendstr += item.replace(/^.*[\\\/]/, "") + '<br></span>';
            count += 1;
        })
        filenameElement.innerHTML += appendstr + '</div>';
    }
}

$(document).on("click", ".openFiles", function (e) {
    const openFiles = $('.openFiles')
    openFiles.removeClass('visible')
    this.classList.add('visible')
    if (openFiles.length > 1) this.firstChild.innerHTML = "library_music"
    this.classList.remove('openFiles')
    this.classList.add('revealFiles')
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


function loadBufferSegment(buffer, begin, saveRegion) {
    if (begin < 0) begin = 0;
    if (begin + windowLength > buffer.duration) {
        begin = Math.max(0, buffer.duration - windowLength);
    }
    bufferBegin = begin;
    if (config.timeOfDay) {
        bufferStartTime = new Date(fileStart.getTime() + (bufferBegin * 1000))
    } else {
        bufferStartTime = new Date(zero.getTime() + (bufferBegin * 1000))
    }
    AudioBufferSlice(buffer, begin, begin + windowLength, function (error, slicedAudioBuffer) {
        if (error) {
            console.log(error);
        } else {
            if (!wavesurfer) {
                initSpec({
                    'audio': slicedAudioBuffer,
                    'backend': 'WebAudio',
                    'alpha': 0,
                });
            } else {
                if (!saveRegion) {
                    wavesurfer.clearRegions();
                }
                updateSpec(slicedAudioBuffer)
            }
        }
    })
}

function updateSpec(buffer) {
    wavesurfer.loadDecodedBuffer(buffer);
    specCanvasElement.width('100%');
    $('.spec-labels').width('55px');
}

function initSpec(args) {
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
        scrollParent: true,
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
        if (modelReady) enableMenuItem(['analyzeSelection']);
    });

    wavesurfer.on('finish', function () {
        if (currentBuffer.duration > bufferBegin + windowLength) {
            bufferBegin += windowLength;
            loadBufferSegment(currentBuffer, bufferBegin);
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

function zoomSpecIn() {
    if (windowLength < 1.5) return;
    updateElementCache()
    windowLength /= 2;
    bufferBegin = bufferBegin + wavesurfer.getCurrentTime() - (windowLength / 2)
    initSpectrogram();
    loadBufferSegment(currentBuffer, bufferBegin, false);
    wavesurfer.seekAndCenter(0.5)
    adjustSpecDims(true)

}

function zoomSpecOut() {
    if (windowLength > 100) return;
    updateElementCache()
    windowLength *= 2;
    if (windowLength > currentFileDuration) {
        windowLength = currentFileDuration
    }
    // Centre on playhead
    bufferBegin = bufferBegin + wavesurfer.getCurrentTime() - (windowLength / 2)
    initSpectrogram();
    loadBufferSegment(currentBuffer, bufferBegin, false);
    wavesurfer.seekAndCenter(0.5)
    adjustSpecDims(true)
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
    if (!files.canceled) await onOpenFiles(files);
}

async function onOpenFiles(args) {
    // Store the file list and Load First audio file
    fileList = args.filePaths;
    await loadAudioFile(fileList[0]);
    currentFile = fileList[0];
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
    // Show file dialog to save Audacity label file
    //ipcRenderer.send('saveFile', {'currentFile': currentFile, 'labels': AUDACITY_LABELS});
    //ipcRenderer.on('safeFile', (event, arg) => {
    //console.log(arg.message)
    //})
}

// Worker listeners
function analyseReset() {
    // hide exclude x in the table
    speciesExclude.forEach(el => {
        el.classList.add('d-none');
    })
    completeDiv.hide();
    progressDiv.show();
    // Diagnostics
    t0_analysis = Date.now();
}


const analyzeLink = document.getElementById('analyze');
speciesExclude = document.querySelectorAll('speciesExclude');
analyzeLink.addEventListener('click', async () => {
    analyseReset();
    resetResults();
    worker.postMessage({action: 'analyze', confidence: config.minConfidence, fileStart: fileStart});
});

const analyzeSelectionLink = document.getElementById('analyzeSelection');

analyzeSelectionLink.addEventListener('click', async () => {
    analyseReset();
    const start = region.start + bufferBegin;
    let end = region.end + bufferBegin;
    if (end - start < 0.5) {
        region.end = region.start + 0.5;
        end = start + 0.5
    }
    // Add current buffer's beginning offset to region start / end tags
    worker.postMessage({action: 'analyze', confidence: 0.1, start: start, end: end, fileStart: fileStart});
    summary = {};
    summary['suppressed'] = []
});


// Menu bar functions

function exitApplication() {
    remote.app.quit()
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
    hideElement(['loadFileHint', 'loadFileHintText', 'loadFileHintSpinner', 'loadFileHintLog',
        'timeline', 'waveform', 'spectrogram', 'dummy', 'controlsWrapper', 'resultTableContainer']);
}

let progressDiv = $('.progressDiv');

let progressBar = $('.progress .progress-bar');


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
    loadResultRegion(row.attributes[0].value.split(','));
})

function loadResultRegion(paramlist) {
    // Accepts global start and end timecodes from model detections
    // Need to find and centre a view of the detection in the spectrogram
    // 3 second detections
    let [start, end, label] = paramlist;
    start = parseFloat(start);
    end = parseFloat(end);
    bufferBegin = start - (windowLength / 2) + 1.5
    loadBufferSegment(currentBuffer, bufferBegin)
    createRegion(start - bufferBegin, end - bufferBegin, label)
}

function adjustSpecDims(redraw) {
    $.each([dummyElement, waveWaveElement, specElement, specCanvasElement, waveCanvasElement], function () {
        // Expand up to 512px
        $(this).height(Math.min(bodyElement.height() * 0.4, 512))
    })
    if (wavesurfer) {

        specElement.css('z-index', 0);
        resultTableElement.height(contentWrapperElement.height()
            - dummyElement.height()
            - controlsWrapperElement.height()
            - $('#timeline').height()
            - 55);
        if (redraw && wavesurfer != null) {
            wavesurfer.drawBuffer();
        }
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
    predictions['ctime'] = ctime;  // Preserve creation date
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
        restore = true;
        const data = fs.readFileSync(file);
        await ungzip(data).then(buffer => {
            buffer = new TextDecoder().decode(buffer);
            savedPredictions = JSON.parse(buffer);
            currentFile = savedPredictions['source'];
            ctime = Date.parse(savedPredictions['ctime']);
        })
        fileList = [currentFile];
        await loadAudioFile(currentFile, ctime);
        for (const [key, value] of Object.entries(savedPredictions)) {
            if (key === 'source' || key === 'ctime') continue;
            await renderResult(value, key, false);
        }
        await onPredictionDone({labels: {}});
    } else {
        currentFile = file;
        fileList = [currentFile];
        await loadAudioFile(currentFile, ctime);
    }
}

function showTheResults() {
    const resultTableContainer = document.getElementById('resultTableContainer');
    resultTableContainer.classList.remove('d-none');
    restore = false;
}

function saveDetections() {
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
            if (key === 'source' || key === 'ctime') continue;
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
window.onload = async (e) => {
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
        'nocmig': false
    }
    config.UUID = uuidv4();
    // Load preferences and override defaults
    appPath = await getPath();
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
        worker.postMessage({action: 'load-model', useWhitelist: true})
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
                    onPredictionOngoing(args);
                    break;
                case 'worker-loaded-audio':
                    onWorkerLoadedAudio(args);
                    break;
            }
        })
    })
    // Set footer year
    $('#year').text(new Date().getFullYear());
    // Populate feedback modal
    let feedbackHTML = `
        <script>
        function myFunction() {
          // Declare variables
          var input, filter, ul, li, a, i, txtValue;
          input = document.getElementById('myInput');
          filter = input.value.toUpperCase();
          ul = document.getElementById("myUL");
          li = ul.getElementsByTagName('li');
        
          // Loop through all list items, and hide those who don't match the search query
          for (i = 0; i < li.length; i++) {
            a = li[i].getElementsByTagName("a")[0];
            txtValue = a.textContent || a.innerText;
            if (txtValue.toUpperCase().indexOf(filter) > -1) {
              li[i].style.display = "";
            } else {
              li[i].style.display = "none";
            }
          }
        }
        </script>
        
        <p>What sound do you think this is?</p>
        <input type="text" id="myInput" onkeyup="myFunction()" placeholder="Search for a species...">
        <ul id="myUL">
            <li><a href="#">Animal<span class="material-icons-two-tone submitted text-success d-none">done</span></a></li>
            <li><a href="#">Ambient Noise<span class="material-icons-two-tone submitted text-success d-none">done</span></a></li>
            <li><a href="#">Human<span class="material-icons-two-tone submitted text-success d-none">done</span></a></li>
            <li><a href="#">Vehicle<span class="material-icons-two-tone submitted text-success d-none">done</span></a></li>`;
    const excluded = new Set(['human', 'vehicles', 'animals', 'No call']);
    for (const item in labels) {
        const [sname, cname] = labels[item].split('_');
        if (!excluded.has(cname)) {
            feedbackHTML += `<li><a href="#">${cname} - ${sname}<span class="material-icons-two-tone submitted text-success d-none">done</span></a></li>`;
        }
    }
    feedbackHTML += '</ul>';
    feedbackTable.append(feedbackHTML);
    //Cache list elements
    speciesListItems = $('#myUL li span');
};

// Feedback list handler
$(document).on('click', '#myUL li', function (e) {
    correctedSpecies = formatFilename(e.target.innerText);
    const regex = /done$/;
    correctedSpecies = correctedSpecies.replace(regex, '');
    speciesListItems.addClass('d-none');
    e.target.closest('a').childNodes[1].classList.remove('d-none');
})


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
            loadAudioFile(currentFile);
        }
        updatePrefs();
    }
})

function initSpectrogram() {
    let fftSamples;
    if (windowLength < 2) {
        fftSamples = 256;
    } else {
        fftSamples = 512;
    }
    if (wavesurfer.spectrogram) wavesurfer.destroyPlugin('spectrogram');
    wavesurfer.addPlugin(WaveSurfer.spectrogram.create({
        wavesurfer: wavesurfer,
        container: "#spectrogram",
        scrollParent: true,
        windowFunc: 'hamming',
        minPxPerSec: 10,
        normalize: true,
        hideScrollbar: true,
        labels: true,
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

    worker.postMessage({action: 'load-model', useWhitelist: config.useWhitelist});
    const warmupText = document.getElementById('warmup');
    warmupText.classList.remove('d-none');
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
    startPosition = fileStart;
    if (fileLoaded) loadBufferSegment(currentBuffer, bufferBegin);
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
    //start at zero. UTC for DST handling
    startPosition = zero;
    if (fileLoaded) loadBufferSegment(currentBuffer, bufferBegin);
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
        controller.abort();
        worker.postMessage({action: 'abort', abort: true});
        alert('Operation cancelled');

    }
    ,
    Home: function () {
        if (currentBuffer) {
            loadBufferSegment(currentBuffer, 0)
            wavesurfer.seekAndCenter(0);
            wavesurfer.pause()
        }
    }
    ,
    End: function () {
        if (currentBuffer) {
            loadBufferSegment(currentBuffer, currentBuffer.duration - windowLength)
            wavesurfer.seekAndCenter(1);
            wavesurfer.pause()
        }
    }
    ,
    PageUp: function () {
        if (wavesurfer) {
            const position = wavesurfer.getCurrentTime() / windowLength;
            bufferBegin -= windowLength
            // Set new date for timeline
            const playhead = bufferBegin + wavesurfer.getCurrentTime()
            loadBufferSegment(currentBuffer, bufferBegin)
            playhead <= 0 ? wavesurfer.seekAndCenter(0) : wavesurfer.seekAndCenter(position);
            wavesurfer.pause()
        }
    }
    ,
    PageDown: function () {
        if (wavesurfer) {
            const position = wavesurfer.getCurrentTime() / windowLength;
            bufferBegin += windowLength
            // Set new date for timeline
            const playhead = bufferBegin + wavesurfer.getCurrentTime()
            loadBufferSegment(currentBuffer, bufferBegin)
            playhead >= currentBuffer.duration ? wavesurfer.seekAndCenter(1) : wavesurfer.seekAndCenter(position);
            wavesurfer.pause()
        }
    }
    ,
    ArrowLeft: function () {
        if (wavesurfer) {
            wavesurfer.skipBackward(0.1);
            const position = wavesurfer.getCurrentTime();
            if (position < 0.1 && bufferBegin > 0) {
                loadBufferSegment(currentBuffer, bufferBegin -= 0.1)
                wavesurfer.seekAndCenter(0);
                wavesurfer.pause()
            }
        }
    }
    ,
    ArrowRight: function () {
        if (wavesurfer) {
            wavesurfer.skipForward(0.1);
            const position = wavesurfer.getCurrentTime();
            if (position > windowLength - 0.1) {
                loadBufferSegment(currentBuffer, bufferBegin += 0.1)
                wavesurfer.seekAndCenter(1);
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
            zoomSpecIn()
        }
    }
    ,
    NumpadAdd: function () {
        if (wavesurfer) {
            zoomSpecIn()
        }
    }
    ,
    Minus: function () {
        if (wavesurfer) {
            zoomSpecOut()
        }
    }
    ,
    NumpadSubtract: function () {
        if (wavesurfer) {
            zoomSpecOut()
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
function onModelReady(args) {
    modelReady = true;
    const warmupText = document.getElementById('warmup');
    warmupText.classList.add('d-none');
    if (workerHasLoadedFile) {
        enableMenuItem(['analyze'])
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
    console.log('UI received worker-loaded-audio: ' + args.message)
    workerHasLoadedFile = true;
    if (modelReady) enableMenuItem(['analyze']);
    if (!config.spectrogram) {
        hideAll();
        showElement(['controlsWrapper']);
        hideElement(['transport-controls']);
        const filename = args.message.replace(/^.*[\\\/]/, '')
        $('#filename').html('<span class="material-icons">description</span> ' + filename);
    }
}

function onProgress(args) {
    let progress = (args.progress * 100).toFixed(1);
    progressBar.width(progress + '%');
    progressBar.attr('aria-valuenow', progress);
    progressBar.html(progress + '%');
}

async function onPredictionDone(args) {
    if (!seenTheDarkness && config.nocmig && !region) {
        alert(`Nocmig mode is enabled, but all timestamps in this file were during daylight hours. Any detections will have been suppressed.\n\nDisable Nocmig mode and re-run the analysis to see them.`)
    }
    scrolled = false;
    AUDACITY_LABELS = args.labels;
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
    // Save the results for this file to the history
    resultHistory[currentFile] = resultTable[0].innerHTML
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
    diagnostics['Analysis Rate'] = (currentFileDuration / ((t1_analysis - t0_analysis) / 1000)).toFixed(0) + 'x faster than real time performance.';
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
        if (el.innerText === e.target.id || tableContext === 'results') {
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

async function renderResult(result, index, selection) {
    result.timestamp = new Date(result.timestamp);
    result.position = new Date(result.position);
    // Datetime wrangling for Nocmig mode
    if (result !== "No detections found.") {
        let astro = SunCalc.getTimes(result.timestamp, config.latitude, config.longitude);
        if (astro.dawn < result.timestamp && astro.dusk > result.timestamp) {
            result.dayNight = 'daytime';
        } else {
            result.dayNight = 'nighttime';
            seenTheDarkness = true;
        }
    }
    let tableRows;
    let tr = '';
    if (!selection) {
        if (index === 1) {
            tableRows = document.querySelectorAll('#results tr');
            // Remove old results
            resultTable.empty();
            summaryTable.empty();
            tableRows[0].scrollIntoView({behavior: 'smooth', block: 'nearest'})
        }
    } else {
        if (index === 1) {
            resultTable.append('<tr><td class="bg-dark text-white text-center" colspan="20"><b>Selection Analysis</b></td></tr>')
        }
    }
    showElement(['resultTableContainer']);
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
            } else if (seenTheDarkness && result.dayNight === 'daytime') {
                // Show the twilight start bar
                resultTable.append(`<tr class="bg-dark text-white"><td colspan="20" class="text-center">
                                        Start of civil twilight
                                        <span class="material-icons-two-tone text-warning align-bottom">wb_twilight</span>
                                    </td></tr>`);
                // Abort
                console.log("Aborting as reached daytime");
                worker.postMessage({action: 'abort', sendLabels: true});
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
        tr += `<tr name="${start},${end},${result.cname}${confidence}" class='border-top border-secondary top-row ${excluded} ${result.dayNight}'>
            <th scope='row'>${index}</th><td class='timestamp ${showTimeOfDay}'>${UI_timestamp}</td>
            <td >${UI_position}</td><td class='cname'>${result.cname}</td>
            <td><i>${result.sname}</i></td><td class='text-center'>${iconizeScore(result.score)}</td>
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
            tr += `<tr name="${start},${end},${result.cname}${confidence}" id='subrow${index}' class='subrow d-none'>
                <th scope='row'>${index}</th><td> </td><td> </td><td class='cname2'>${result.cname2}</td>
                <td><i>${result.sname2}</i></td><td class='text-center'>${iconizeScore(result.score2)}</td>
                <td> </td><td class='specFeature'> </td>
                <td><a href='https://xeno-canto.org/explore?query=${result.sname2}%20type:nocturnal' target=\"_blank\">
                    <img src='img/logo/XC.png' alt='Search ${result.cname2} on Xeno Canto' title='${result.cname2} NFCs on Xeno Canto'></a> </td>
                <td class='specFeature'> </td>
                <td class='specFeature speciesExclude d-none'> </td>
                <td class='specFeature'> </td>
               </tr>`;
            if (result.score3 > 0.2) {
                tr += `<tr name="${start},${end},${result.cname}${confidence}" id='subsubrow${index}' class='subrow d-none'>
                    <th scope='row'>${index}</th><td> </td><td> </td><td class='cname3'>${result.cname3}</td>
                    <td><i>${result.sname3}</i></td><td class='text-center'>${iconizeScore(result.score3)}</td>
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

async function onPredictionOngoing(args) {
    await renderResult(args.result, args.index, args.selection)
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
            start: start, end: end, filepath: filename, metadata: metadata
        })
    } else {
        if (!config.seenThanks) {
            alert('Thank you, your feedback helps improve Chirpity predictions');
            config.seenThanks = true;
            updatePrefs()
        }
        worker.postMessage({
            action: 'post',
            start: start, end: end, filepath: filename, metadata: metadata, mode: mode
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

$('#options').on('click', function () {
    $('#helpModalLabel').text('Options Help');
    $('#helpModalBody').load('Help/options.html', function () {
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
    for (const [key, value] of Object.entries(diagnostics)) {
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
    zoomSpecIn();
});

$('#zoomOut').on('click', function () {
    zoomSpecOut();
});

