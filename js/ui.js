const {ipcRenderer} = require('electron');
//const {remote, dialog} = require('electron/remote');
const remote = require('electron').remote;
const fs = require('fs');
const WaveSurfer = require("wavesurfer.js");
const SpectrogramPlugin = require('wavesurfer.js/dist/plugin/wavesurfer.spectrogram.min.js');
const SpecTimeline = require('wavesurfer.js/dist/plugin/wavesurfer.timeline.min.js');
const Regions = require('wavesurfer.js/dist/plugin/wavesurfer.regions.min.js');
const colormap = require("colormap");
const $ = require('jquery');
const AudioBufferSlice = require('./js/AudioBufferSlice.js');
const p = require('path');
const {v4: uuidv4} = require("uuid");
const labels = ["Tachymarptis melba_Alpine Swift", "Pluvialis dominica_American Golden Plover", "Mareca americana_American Wigeon", "Acrocephalus paludicola_Aquatic Warbler", "Acanthis hornemanni_Arctic Redpoll", "Stercorarius parasiticus_Arctic Skua", "Sterna paradisaea_Arctic Tern", "Phylloscopus borealis_Arctic Warbler", "Recurvirostra avosetta_Avocet", "Porzana pusilla_Baillon's Crake", "Limosa lapponica_Bar-tailed Godwit", "Tyto alba_Barn Owl", "Branta leucopsis_Barnacle Goose", "Sylvia nisoria_Barred Warbler", "Panurus biarmicus_Bearded Tit", "Merops apiaster_Bee-eater", "Cygnus columbianus_Bewick's Swan", "Botaurus stellaris_Bittern", "Oenanthe hispanica_Black-eared Wheatear", "Chroicocephalus ridibundus_Black-headed Gull", "Podiceps nigricollis_Black-necked Grebe", "Limosa limosa_Black-tailed Godwit", "Himantopus himantopus_Black-winged Stilt", "Lyrurus tetrix_Black Grouse", "Cepphus grylle_Black Guillemot", "Milvus migrans_Black Kite", "Phoenicurus ochruros_Black Redstart", "Chlidonias niger_Black Tern", "Turdus merula_Blackbird", "Sylvia atricapilla_Blackcap", "Spatula discors_Blue-winged Teal", "Cyanistes caeruleus_Blue Tit", "Luscinia svecica_Bluethroat", "Acrocephalus dumetorum_Blyth's Reed Warbler", "Fringilla montifringilla_Brambling", "Branta bernicla_Brent Goose", "Pyrrhula pyrrhula_Bullfinch", "Buteo buteo_Buzzard", "Branta canadensis_Canada Goose", "Tetrao urogallus_Capercaillie", "Corvus corone_Carrion Crow", "Larus cachinnans_Caspian Gull", "Bubulcus ibis_Cattle Egret", "Cettia cetti_Cetti's Warbler", "Fringilla coelebs_Chaffinch", "Phylloscopus collybita_Chiffchaff", "Pyrrhocorax pyrrhocorax_Chough", "Emberiza cirlus_Cirl Bunting", "Motacilla citreola_Citrine Wagtail", "Periparus ater_Coal Tit", "Streptopelia decaocto_Collared Dove", "Glareola pratincola_Collared Pratincole", "Loxia curvirostra_Common Crossbill", "Larus canus_Common Gull", "Acanthis flammea_Common Redpoll", "Carpodacus erythrinus_Common Rosefinch", "Actitis hypoleucos_Common Sandpiper", "Melanitta nigra_Common Scoter", "Sterna hirundo_Common Tern", "Fulica atra_Coot", "Phalacrocorax carbo_Cormorant", "Emberiza calandra_Corn Bunting", "Crex crex_Corncrake", "Calonectris borealis_Cory's Shearwater", "Grus grus_Crane", "Lophophanes cristatus_Crested Tit", "Cuculus canorus_Cuckoo", "Calidris ferruginea_Curlew Sandpiper", "Numenius arquata_Curlew", "Sylvia undata_Dartford Warbler", "Cinclus cinclus_Dipper", "Charadrius morinellus_Dotterel", "Calidris alpina_Dunlin", "Prunella modularis_Dunnock", "Phylloscopus fuscatus_Dusky Warbler", "Alopochen aegyptiaca_Egyptian Goose", "Somateria mollissima_Eider", "Bubo bubo_Eurasian Eagle-Owl", "Turdus pilaris_Fieldfare", "Regulus ignicapilla_Firecrest", "Fulmarus glacialis_Fulmar", "Mareca strepera_Gadwall", "Morus bassanus_Gannet", "Sylvia borin_Garden Warbler", "Spatula querquedula_Garganey", "Larus hyperboreus_Glaucous Gull", "Plegadis falcinellus_Glossy Ibis", "Regulus regulus_Goldcrest", "Aquila chrysaetos_Golden Eagle", "Oriolus oriolus_Golden Oriole", "Pluvialis apricaria_Golden Plover", "Bucephala clangula_Goldeneye", "Carduelis carduelis_Goldfinch", "Mergus merganser_Goosander", "Accipiter gentilis_Goshawk", "Locustella naevia_Grasshopper Warbler", "Larus marinus_Great Black-backed Gull", "Podiceps cristatus_Great Crested Grebe", "Lanius excubitor_Great Grey Shrike", "Gavia immer_Great Northern Diver", "Stercorarius skua_Great Skua", "Dendrocopos major_Great Spotted Woodpecker", "Parus major_Great Tit", "Ardea alba_Great White Egret", "Anas carolinensis_Green-winged Teal", "Tringa ochropus_Green Sandpiper", "Picus viridis_Green Woodpecker", "Chloris chloris_Greenfinch", "Phylloscopus trochiloides_Greenish Warbler", "Tringa nebularia_Greenshank", "Ardea cinerea_Grey Heron", "Perdix perdix_Grey Partridge", "Phalaropus fulicarius_Grey Phalarope", "Pluvialis squatarola_Grey Plover", "Motacilla cinerea_Grey Wagtail", "Anser anser_Greylag Goose", "Uria aalge_Guillemot", "Gelochelidon nilotica_Gull-billed Tern", "Coccothraustes coccothraustes_Hawfinch", "Larus argentatus_Herring Gull", "Falco subbuteo_Hobby", "Pernis apivorus_Honey-buzzard", "Corvus cornix_Hooded Crow", "Upupa epops_Hoopoe", "Delichon urbicum_House Martin", "Passer domesticus_House Sparrow", "Human_Human", "Phylloscopus ibericus_Iberian Chiffchaff", "Hippolais icterina_Icterine Warbler", "Lymnocryptes minimus_Jack Snipe", "Coloeus monedula_Jackdaw", "Garrulus glandarius_Jay", "Charadrius alexandrinus_Kentish Plover", "Falco tinnunculus_Kestrel", "Alcedo atthis_Kingfisher", "Rissa tridactyla_Kittiwake", "Calidris canutus_Knot", "Calcarius lapponicus_Lapland Bunting", "Vanellus vanellus_Lapwing", "Larus fuscus_Lesser Black-backed Gull", "Acanthis cabaret_Lesser Redpoll", "Dryobates minor_Lesser Spotted Woodpecker", "Sylvia curruca_Lesser Whitethroat", "Linaria cannabina_Linnet", "Ixobrychus minutus_Little Bittern", "Emberiza pusilla_Little Bunting", "Egretta garzetta_Little Egret", "Tachybaptus ruficollis_Little Grebe", "Hydrocoloeus minutus_Little Gull", "Athene noctua_Little Owl", "Charadrius dubius_Little Ringed Plover", "Calidris minuta_Little Stint", "Sternula albifrons_Little Tern", "Asio otus_Long-eared Owl", "Clangula hyemalis_Long-tailed Duck", "Stercorarius longicaudus_Long-tailed Skua", "Aegithalos caudatus_Long-tailed Tit", "Pica pica_Magpie", "Anas platyrhynchos_Mallard", "Aix galericulata_Mandarin Duck", "Puffinus puffinus_Manx Shearwater", "Circus aeruginosus_Marsh Harrier", "Poecile palustris_Marsh Tit", "Anthus pratensis_Meadow Pipit", "Ichthyaetus melanocephalus_Mediterranean Gull", "Hippolais polyglotta_Melodious Warbler", "Falco columbarius_Merlin", "Turdus viscivorus_Mistle Thrush", "Circus pygargus_Montagu's Harrier", "Gallinula chloropus_Moorhen", "Cygnus olor_Mute Swan", "Nycticorax nycticorax_Night Heron", "Luscinia megarhynchos_Nightingale", "Caprimulgus europaeus_Nightjar", "No Call_No Call", "Sitta europaea_Nuthatch", "Anthus hodgsoni_Olive-backed Pipit", "Emberiza hortulana_Ortolan Bunting", "Pandion haliaetus_Osprey", "Haematopus ostralegus_Oystercatcher", "Syrrhaptes paradoxus_Pallas's Sandgrouse", "Phylloscopus proregulus_Pallas's Warbler", "Loxia pytyopsittacus_Parrot Crossbill", "Calidris melanotos_Pectoral Sandpiper", "Remiz pendulinus_Penduline Tit", "Falco peregrinus_Peregrine", "Phasianus colchicus_Pheasant", "Ficedula hypoleuca_Pied Flycatcher", "Motacilla alba_Pied Wagtail", "Anser brachyrhynchus_Pink-footed Goose", "Anas acuta_Pintail", "Aythya ferina_Pochard", "Lagopus muta_Ptarmigan", "Ardea purpurea_Purple Heron", "Calidris maritima_Purple Sandpiper", "Coturnix coturnix_Quail", "Phylloscopus schwarzi_Radde's Warbler", "Corvus corax_Raven", "Alca torda_Razorbill", "Lanius collurio_Red-backed Shrike", "Ficedula parva_Red-breasted Flycatcher", "Mergus serrator_Red-breasted Merganser", "Netta rufina_Red-crested Pochard", "Tarsiger cyanurus_Red-flanked Bluetail", "Alectoris rufa_Red-legged Partridge", "Podiceps grisegena_Red-necked Grebe", "Caprimulgus ruficollis_Red-necked Nightjar", "Phalaropus lobatus_Red-necked Phalarope", "Cecropis daurica_Red-rumped Swallow", "Gavia stellata_Red-throated Diver", "Lagopus lagopus_Red Grouse", "Milvus milvus_Red Kite", "Tringa totanus_Redshank", "Phoenicurus phoenicurus_Redstart", "Turdus iliacus_Redwing", "Emberiza schoeniclus_Reed Bunting", "Acrocephalus scirpaceus_Reed Warbler", "Anthus richardi_Richard's Pipit", "Larus delawarensis_Ring-billed Gull", "Psittacula krameri_Ring-necked Parakeet", "Turdus torquatus_Ring Ouzel", "Charadrius hiaticula_Ringed Plover", "Erithacus rubecula_Robin", "Columba livia_Rock Dove", "Anthus petrosus_Rock Pipit", "Corvus frugilegus_Rook", "Pastor roseus_Rose-coloured Starling", "Sterna dougallii_Roseate Tern", "Buteo lagopus_Rough-legged Buzzard", "Oxyura jamaicensis_Ruddy Duck", "Tadorna ferruginea_Ruddy Shelduck", "Calidris pugnax_Ruff", "Xema sabini_Sabine's Gull", "Riparia riparia_Sand Martin", "Calidris alba_Sanderling", "Thalasseus sandvicensis_Sandwich Tern", "Locustella luscinioides_Savi's Warbler", "Aythya marila_Scaup", "Loxia scotica_Scottish Crossbill", "Acrocephalus schoenobaenus_Sedge Warbler", "Calidris pusilla_Semipalmated Sandpiper", "Serinus serinus_Serin", "Tadorna tadorna_Shelduck", "Eremophila alpestris_Shore Lark", "Asio flammeus_Short-eared Owl", "Calandrella brachydactyla_Short-toed Lark", "Spatula clypeata_Shoveler", "Spinus spinus_Siskin", "Alauda arvensis_Skylark", "Podiceps auritus_Slavonian Grebe", "Gallinago gallinago_Snipe", "Plectrophenax nivalis_Snow Bunting", "Anser caerulescens_Snow Goose", "Turdus philomelos_Song Thrush", "Accipiter nisus_Sparrowhawk", "Platalea leucorodia_Spoonbill", "Porzana porzana_Spotted Crake", "Muscicapa striata_Spotted Flycatcher", "Tringa erythropus_Spotted Redshank", "Actitis macularius_Spotted Sandpiper", "Sturnus vulgaris_Starling", "Columba oenas_Stock Dove", "Burhinus oedicnemus_Stone-curlew", "Saxicola rubicola_Stonechat", "Hydrobates pelagicus_Storm Petrel", "Sylvia cantillans_Subalpine Warbler", "Hirundo rustica_Swallow", "Apus apus_Swift", "Anser fabalis_Taiga Bean Goose", "Strix aluco_Tawny Owl", "Anas crecca_Teal", "Calidris temminckii_Temminck's Stint", "Anthus trivialis_Tree Pipit", "Passer montanus_Tree Sparrow", "Certhia familiaris_Treecreeper", "Aythya fuligula_Tufted Duck", "Anser serrirostris_Tundra Bean Goose", "Arenaria interpres_Turnstone", "Streptopelia turtur_Turtle Dove", "Linaria flavirostris_Twite", "Loxia leucoptera_Two-barred Crossbill", "Anthus spinoletta_Water Pipit", "Rallus aquaticus_Water Rail", "Bombycilla garrulus_Waxwing", "Oenanthe oenanthe_Wheatear", "Numenius phaeopus_Whimbrel", "Saxicola rubetra_Whinchat", "Anser albifrons_White-fronted Goose", "Calidris fuscicollis_White-rumped Sandpiper", "Haliaeetus albicilla_White-tailed Eagle", "Chlidonias leucopterus_White-winged Black Tern", "Ciconia ciconia_White Stork", "Sylvia communis_Whitethroat", "Cygnus cygnus_Whooper Swan", "Mareca penelope_Wigeon", "Poecile montanus_Willow Tit", "Phylloscopus trochilus_Willow Warbler", "Tringa glareola_Wood Sandpiper", "Phylloscopus sibilatrix_Wood Warbler", "Scolopax rusticola_Woodcock", "Lullula arborea_Woodlark", "Columba palumbus_Woodpigeon", "Troglodytes troglodytes_Wren", "Jynx torquilla_Wryneck", "Phylloscopus inornatus_Yellow-browed Warbler", "Larus michahellis_Yellow-legged Gull", "Motacilla flava_Yellow Wagtail", "Emberiza citrinella_Yellowhammer", "animals_animals", "vehicles_vehicles"];
//let appPath;
/// Get  path to USerData
// ipcRenderer.send('path', {})
// ipcRenderer.on('path', (event, arg) => {
//     appPath = arg.appPath
// })
let currentPrediction;
let appPath = remote.app.getPath('userData');

let modelReady = false, fileLoaded = false, currentFile, fileList, resultHistory = {};
let region, AUDACITY_LABELS, wavesurfer, summary = {};
let fileStart, startTime, ctime;

// set up some DOM element caches
let bodyElement = $('body');
let dummyElement, specElement, waveElement, specCanvasElement, specWaveElement;
let waveCanvasElement, waveWaveElement, resultTableElement = $('#resultTableContainer');
let contentWrapperElement = $('#contentWrapper');
let controlsWrapperElement = $('#controlsWrapper');
let completeDiv = $('.complete');
const resultTable = $('#resultTableBody')
const modalTable = $('#modalBody');
const feedbackTable = $('#feedbackModalBody');
let predictions = {}, correctedSpecies, action, currentNode;

let currentBuffer, bufferBegin = 0, windowLength = 20;  // seconds
let workerLoaded = false;
// Set default Options
let config;
const sampleRate = 48000;
let controller = new AbortController();
let signal = controller.signal;

const audioCtx = new AudioContext({latencyHint: 'interactive', sampleRate: sampleRate});
const fetchAudioFile = (filePath) =>
    fetch(filePath, {signal})
        .then((res => res.arrayBuffer()))
        .then((arrayBuffer) => audioCtx.decodeAudioData(arrayBuffer))
        .then((buffer) => {
            if (!controller.signal.aborted) {
                let source = audioCtx.createBufferSource();
                source.buffer = buffer;
                const duration = source.buffer.duration;

                // set fileStart time
                if (config.timeOfDay) {
                    fileStart = new Date(ctime - (duration * 1000))
                } else {
                    fileStart = new Date();
                    fileStart.setHours(0, 0, 0, 0)
                }

                const offlineCtx = new OfflineAudioContext(1, sampleRate * duration, sampleRate);
                const offlineSource = offlineCtx.createBufferSource();
                offlineSource.buffer = buffer;
                offlineSource.connect(offlineCtx.destination);
                offlineSource.start();
                offlineCtx.startRendering().then(function (resampled) {
                    console.log('Rendering completed successfully');
                    // `resampled` contains an AudioBuffer resampled at 48000Hz.
                    // use resampled.getChannelData(x) to get an Float32Array for channel x.
                    currentBuffer = resampled;
                    loadBufferSegment(resampled, bufferBegin)
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
                disableMenuItem('analyze')
                disableMenuItem('analyzeSelection');
                showElement('loadFileHint');
                showElement('loadFileHintText', false);
            }
        })

//.then(cb)


async function loadAudioFile(filePath) {
    ipcRenderer.send('file-load-request', {message: filePath});
    workerLoaded = false;
    summary = {};
    // Hide load hint and show spinnner
    if (wavesurfer) {
        wavesurfer.destroy();
        wavesurfer = undefined;
    }
    // set file creation time
    ctime = fs.statSync(filePath).ctime


    hideAll();
    disableMenuItem('analyze')
    disableMenuItem('analyzeSelection');
    showElement('loadFileHint');
    showElement('loadFileHintSpinner');
    showElement('loadFileHintLog');

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
        showElement('controlsWrapper');
        $('.specFeature').hide()
    }
    if (!controller.signal.aborted) {
        fileLoaded = true;
        completeDiv.hide();
        const filename = filePath.replace(/^.*[\\\/]/, '')
        let filenameElement = document.getElementById('filename');
        filenameElement.innerHTML = '';

        //
        let count = 0
        let appendstr = '<div id="fileContainer" class="bg-dark pr-3">';
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
    startTime = new Date(fileStart.getTime() + (bufferBegin * 1000))
    AudioBufferSlice(buffer, begin, begin + windowLength, function (error, slicedAudioBuffer) {
        if (error) {
            console.log(error);
        } else {
            if (!wavesurfer) {
                initSpec({
                    'audio': slicedAudioBuffer,
                    'backend': 'WebAudio',
                    'alpha': 0,
                    'context': null,
                    'spectrogram': true
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
    // Show spec and timecode containers
    //wavesurfer.timeline.params.offset = -bufferBegin;
    wavesurfer.loadDecodedBuffer(buffer);
    specCanvasElement.width('100%');
}

function initSpec(args) {
    // Show spec and timecode containers
    hideAll();
    showElement('dummy', false);
    showElement('timeline', false);
    showElement('waveform', false, false);
    showElement('spectrogram', false, false);
    if (wavesurfer !== undefined) wavesurfer.pause();
    // Setup waveform and spec views
    wavesurfer = WaveSurfer.create({
        container: '#waveform',
        backend: args.backend, // 'MediaElementWebAudio',
        // make waveform transparent
        backgroundColor: 'rgba(0,0,0,0)',
        waveColor: 'rgba(109,41,164,' + args.alpha + ')',
        progressColor: 'rgba(109,41,164,' + args.alpha + ')',
        // but keep the playhead
        cursorColor: '#fff',
        cursorWidth: 2,
        skipLength: 0.1,
        normalize: true,
        partialRender: true,
        scrollParent: true,
        responsive: true,
        height: 1024,
        fftSamples: 1024,
        windowFunc: 'hamming',
        minPxPerSec: 10,
        hideScrollbar: true,
        plugins: [
            SpectrogramPlugin.create({
                wavesurfer: wavesurfer,
                container: "#spectrogram",
                scrollParent: true,
                labels: false,
                colorMap: colormap({
                    colormap: config.colormap, nshades: 256, format: 'float'
                }),
            }),
            Regions.create({
                dragSelection: {
                    slop: 5,

                },
                color: "rgba(255, 255, 255, 0.2)"
            })]
    })
    if (config.timeline) {
        wavesurfer.addPlugin(SpecTimeline.create({
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
    showElement(config.colormap + ' .tick', false);
    // Set click event that removes all regions
    waveElement.mousedown(function () {
        wavesurfer.clearRegions();
        region = false;
        disableMenuItem('analyzeSelection');
        disableMenuItem('exportMP3');
        if (workerLoaded) enableMenuItem('analyze');
    });
    // Enable analyse selection when region created
    wavesurfer.on('region-created', function (e) {
        // console.log(wavesurfer.regions.list)
        region = e
        enableMenuItem('analyzeSelection');
        enableMenuItem('exportMP3');
    });

    wavesurfer.on('finish', function () {
        if (currentBuffer.duration > bufferBegin + windowLength) {
            bufferBegin += windowLength;
            loadBufferSegment(currentBuffer, bufferBegin);
            wavesurfer.play()
        }
    })
    // Show controls
    showElement('controlsWrapper');
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
    if (windowLength < 2) return;
    windowLength /= 2;
    bufferBegin = bufferBegin + wavesurfer.getCurrentTime() - (windowLength / 2)
    if (windowLength < 2) {
        wavesurfer.params.fftSamples = 512
        wavesurfer.spectrogram.render()
    }
    loadBufferSegment(currentBuffer, bufferBegin, false);
    wavesurfer.seekAndCenter(0.5)
    adjustSpecDims(true)

}

function zoomSpecOut() {
    if (windowLength > 100) return;
    windowLength *= 2;
    // Centre on playhead
    bufferBegin = bufferBegin + wavesurfer.getCurrentTime() - (windowLength / 2)
    if (wavesurfer.params.fftSamples !== 1024) {
        wavesurfer.params.fftSamples = 1024
        wavesurfer.spectrogram.render()
    }
    loadBufferSegment(currentBuffer, bufferBegin, false);
    wavesurfer.seekAndCenter(0.5)
    adjustSpecDims(true)
}

async function showOpenDialog() {
    ipcRenderer.send('openFiles');
}

ipcRenderer.on('openFiles', async (event, arg) => {
    // Store the file list and Load First audio file
    fileList = arg.filePaths
    await loadAudioFile(fileList[0]);
    currentFile = fileList[0];
})


async function showSaveDialog() {
    // Show file dialog to save Audacity label file
    ipcRenderer.send('saveFile', {'currentFile': currentFile, 'labels': AUDACITY_LABELS});
    ipcRenderer.on('safeFile', (event, arg) => {
        console.log(arg.message)
    })
}

// Worker listeners

const analyzeLink = document.getElementById('analyze');

analyzeLink.addEventListener('click', async () => {
    completeDiv.hide();
    disableMenuItem('analyze')
    //disableMenuItem('analyzeSelection');
    ipcRenderer.send('analyze', {confidence: config.minConfidence});
    summary = {};
    analyzeLink.disabled = true;
});

const analyzeSelectionLink = document.getElementById('analyzeSelection');

analyzeSelectionLink.addEventListener('click', async () => {
    completeDiv.hide();
    disableMenuItem('analyze')
    //disableMenuItem('analyzeSelection');
    let start;
    let end;
    if (region.start) {
        start = region.start + bufferBegin;
        end = region.end + bufferBegin;
    }
    // Add current buffer's beginning offset to region start / end tags
    ipcRenderer.send('analyze', {confidence: 0.1, start: start, end: end});
    summary = {};
    analyzeLink.disabled = true;
});


// Menu bar functions

function exitApplication() {
    remote.app.quit()
}

function enableMenuItem(id) {
    $('#' + id).removeClass('disabled');
}

function disableMenuItem(id) {
    $('#' + id).addClass('disabled');
}

function toggleAlternates(row) {
    $(row).toggle('slow');
    return false
}

function showElement(id, makeFlex = true, empty = false) {
    const thisElement = $('#' + id);
    thisElement.removeClass('d-none');
    if (makeFlex) thisElement.addClass('d-flex');
    if (empty) {
        thisElement.height(0);
        thisElement.empty()
    }
}

function hideElement(id) {
    const thisElement = $('#' + id);
    thisElement.removeClass('d-flex');
    thisElement.addClass('d-none');

}

function hideAll() {

    // File hint div
    hideElement('loadFileHint');
    hideElement('loadFileHintText');
    hideElement('loadFileHintSpinner');
    hideElement('loadFileHintLog')

    // Waveform, timeline and spec
    hideElement('timeline');
    hideElement('waveform');
    hideElement('spectrogram');
    hideElement('dummy');

    // Controls
    hideElement('controlsWrapper');

    // Result table
    hideElement('resultTableContainer');

}

let progressDiv = $('.progressDiv');

let progressBar = $('.progress .progress-bar');


function createRegion(start, end) {
    wavesurfer.pause();
    wavesurfer.clearRegions();
    wavesurfer.addRegion({start: start, end: end, color: "rgba(255, 255, 255, 0.2)"});
    const progress = start / wavesurfer.getDuration();
    wavesurfer.seekAndCenter(progress);
}

function loadResultRegion(start, end) {
    // Accepts global start and end timecodes from model detections
    // Need to find and centre a view of the detection in the spectrogram
    // 3 second detections
    bufferBegin = start - (windowLength / 2) + 1.5
    loadBufferSegment(currentBuffer, bufferBegin)
    createRegion(start - bufferBegin, end - bufferBegin)
}

function adjustSpecDims(redraw) {
    $.each([dummyElement, waveWaveElement, specElement, specCanvasElement, waveCanvasElement], function () {
        // Expand up to 512px
        $(this).height(Math.min(bodyElement.height() * 0.4, 512))
    })
    if (loadSpectrogram) {
        specElement.css('z-index', 0)
        resultTableElement.height(contentWrapperElement.height()
            - dummyElement.height()
            - controlsWrapperElement.height()
            - $('#timeline').height()
            - 65);
        if (redraw && wavesurfer != null) {
            wavesurfer.drawBuffer();
        }
        specCanvasElement.width('100%');
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
    secs = Number(secs);
    const now = new Date(startTime.getTime() + (secs * 1000))
    const milliSeconds = now.getMilliseconds();
    const seconds = now.getSeconds();
    const minutes = now.getMinutes();
    const hours = now.getHours();

    // fill up seconds with zeroes
    let secondsStr;
    if (windowLength >= 5) {
        secondsStr = seconds.toString();
    } else {
        secondsStr = seconds.toString() + '.' + Math.round(milliSeconds / 100).toString();
    }
    if (minutes > 0 || config.timeOfDay) {
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

/////////////////////////  Window Handlers ////////////////////////////

window.onload = function () {
    // Load preferences and options
    fs.readFile(p.join(appPath, 'config.json'), 'utf8', (err, data) => {
        if (err) {
            console.log('JSON parse error ' + err);
            // If file read error, use defaults
            config = {
                'spectrogram': true,
                'colormap': 'inferno',
                'timeline': true,
                'minConfidence': 0.5,
                'timeOfDay': false
            }
            const {v4: uuidv4} = require('uuid');
            config.UUID = uuidv4()
            updatePrefs()
            return
        }
        config = JSON.parse(data)
        //console.log('Successfully loaded UUID: ' + config.UUID)
        if (!config.UUID) {
            const {v4: uuidv4} = require('uuid');
            config.UUID = uuidv4();
            updatePrefs()
        }
        // Set menu option state
        if (!config.spectrogram) {
            $('#loadSpectrogram .tick').hide()
        }
        if (!config.timeline) {
            $('#loadTimeline .tick').hide()
        }
        if (config.timeOfDay) {
            $('#timecode .tick').hide()
            $('#timeOfDay .tick').show()
        } else {
            $('#timecode .tick').show()
            $('#timeOfDay .tick').hide()
        }
        showElement(config.colormap + 'span', true)
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
        <input type="text" id="myInput" onkeyup="myFunction()" placeholder="Search for sound..">
        <ul id="myUL">
            <li><a href="#">Animal<span class="material-icons-two-tone submitted text-success d-none">done</span></a></li>
            <li><a href="#">Environmental noise<span class="material-icons-two-tone submitted text-success d-none">done</span></a></li>
            <li><a href="#">Human<span class="material-icons-two-tone submitted text-success d-none">done</span></a></li>
            <li><a href="#">Vehicle<span class="material-icons-two-tone submitted text-success d-none">done</span></a></li>`;
    const excluded = new Set(['human', 'vehicles', 'animals', 'No call']);
    for (const item in labels) {
        const cname = labels[item].split('_')[1]
        if (!excluded.has(cname)) {
            feedbackHTML += `<li><a href="#">${cname}<span class="material-icons-two-tone submitted text-success d-none">done</span></a></li>`;
        }
    }
    feedbackHTML += '</ul>';
    feedbackTable.append(feedbackHTML);
};

// Feedback list handler
$(document).on('click', '#myUL li', function (e) {
    correctedSpecies = e.target.innerText;
    $('#myUL li span').addClass('d-none');
    e.target.childNodes[1].classList.remove('d-none');
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
        //e.preventDefault();
        if (document === e.target || document.body === e.target || e.target.attributes["data-action"]) {

        }
        GLOBAL_ACTIONS[action](e);
    }

    [].forEach.call(document.querySelectorAll('[data-action]'), function (el) {
        el.addEventListener('click', function (e) {
            let action = e.currentTarget.dataset.action;
            if (action in GLOBAL_ACTIONS) {
                //e.preventDefault();
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
        hideElement('dummy');
        hideElement('timeline');
        hideElement('waveform');
        hideElement('spectrogram');
        $('.speccolor .timeline').addClass('disabled');
        //adjustSpecDims(true);
        updatePrefs();
    } else {
        config.spectrogram = true;
        $('#loadSpectrogram .tick').show()
        $('.specFeature').show()
        if (wavesurfer && wavesurfer.isReady) {
            $('.speccolor .timeline').removeClass('disabled');
            showElement('dummy', false);
            showElement('timeline', false);
            showElement('waveform', false, false);
            showElement('spectrogram', false, false);
        } else {
            loadAudioFile(currentFile);
        }
        updatePrefs();
    }
})

$(document).on('click', '.speccolor', function (e) {
    wavesurfer.destroyPlugin('spectrogram');
    config.colormap = e.target.id;
    wavesurfer.addPlugin(SpectrogramPlugin.create({
        wavesurfer: wavesurfer,
        container: "#spectrogram",
        scrollParent: true,
        labels: false,
        colorMap: colormap({
            colormap: config.colormap, nshades: 256, format: 'float'
        })
    })).initPlugin('spectrogram');
    // set tick
    $('.speccolor .tick').addClass('d-none');
    $(this).children('span').removeClass('d-none');
    // refresh caches
    updateElementCache()
    adjustSpecDims(true)
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
        wavesurfer.addPlugin(SpecTimeline.create({
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
    config.timeOfDay = true
    $('#timecode .tick').hide()
    $('#timeOfDay .tick').show()
    fileStart = ctime
    loadBufferSegment(currentBuffer, bufferBegin);
    updatePrefs();
})
$(document).on('click', '#timecode', function () {
    config.timeOfDay = false
    $('#timeOfDay .tick').hide()
    $('#timecode .tick').show()
    //start at zero
    fileStart = new Date();
    fileStart.setHours(0, 0, 0, 0);
    loadBufferSegment(currentBuffer, bufferBegin);
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
    KeyS: function () {
        if (AUDACITY_LABELS.length > 0) {
            if (e.ctrlKey) showSaveDialog();
        }
    },
    Escape: function () {
        console.log('Operation aborted');
        controller.abort();
        ipcRenderer.send('abort', {'abort': true});
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
};


// Electron Message handling


ipcRenderer.on('model-ready', async () => {
    modelReady = true;
})

ipcRenderer.on('worker-loaded', async (event, arg) => {
    console.log('UI received worker-loaded: ' + arg.message)
    workerLoaded = true;
    enableMenuItem('analyze')
    if (!loadSpectrogram) {
        hideAll();
        showElement('controlsWrapper');
        hideElement('transport-controls');
        const filename = arg.message.replace(/^.*[\\\/]/, '')
        $('#filename').html('<span class="material-icons">description</span> ' + filename);
    }
})

ipcRenderer.on('progress', async (event, arg) => {
    progressDiv.show();
    let progress = (arg.progress * 100).toFixed(1);
    progressBar.width(progress + '%');
    progressBar.attr('aria-valuenow', progress);
    progressBar.html(progress + '%');
});

ipcRenderer.on('prediction-done', async (event, arg) => {
    AUDACITY_LABELS = arg.labels;
    progressDiv.hide();
    progressBar.width(0 + '%');
    progressBar.attr('aria-valuenow', 0);
    progressBar.html(0 + '%');
    completeDiv.show();
    if (AUDACITY_LABELS.length > 0) {
        enableMenuItem('saveLabels');
        $('.download').removeClass('disabled');
    } else {
        disableMenuItem('saveLabels');
    }
    // Save the results for this file to the history
    resultHistory[currentFile] = resultTable[0].innerHTML
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
    var summarySorted = {}
    sortable.forEach(function (item) {
        summarySorted[item[0]] = item[1]
    })

    let summaryHTML = `<table class="table table-striped table-dark table-hover p-1"><thead class="thead-dark">
            <tr>
                <th scope="col">Species</th>
                <th scope="col" class="text-right">Count</th>
            </tr>
            </thead><tbody>`;
    for (const [key, value] of Object.entries(summarySorted)) {
        summaryHTML += `<tr><td>${key}</td><td class="text-right"> ${value}</td></tr>`;
    }
    summaryHTML += '</tbody></table>';
    modalTable.append(summaryHTML);
});

ipcRenderer.on('prediction-ongoing', async (event, arg) => {
    completeDiv.hide();
    const result = arg.result;
    const index = arg.index;
    const selection = arg.selection;
    let tr = '';
    predictions[index] = result;
    currentPrediction = predictions[index];
    if (!selection) {
        if (index === 1) {
            // Remove old results
            resultTable.empty();
            modalTable.empty();
        }
    } else {
        if (index === 1) {
            resultTable.prepend('<tr><td class="bg-dark text-white text-center" colspan="10"><b>Selection Analysis<span class="material-icons-two-tone align-bottom">arrow_upward</span></b></td></tr>')
        }
    }

    showElement('resultTableContainer');
    if (result === "No detections found.") {
        tr += "<tr><td>" + result + "</td></tr>";
    } else {
        if (result.cname in summary) {
            summary[result.cname] += 1
        } else {
            summary[result.cname] = 1
        }

        const regex = /:/g;
        const start = result.start, end = result.end;
        result.filename = result.cname.replace(/'/g, "\\'") + ' ' + result.timestamp.replace(regex, '.') + '.mp3';
        tr += `<tr onmousedown='loadResultRegion( ${start} , ${end} );' class='border-top border-secondary top-row'><th scope='row'>${index}</th>`;
        tr += "<td><span class='material-icons rotate text-right pointer' onclick='toggleAlternates(&quot;.subrow" + index + "&quot;)'>expand_more</span></td>";
        tr += "<td>" + result.timestamp + "</td>";
        tr += "<td>" + result.cname + "</td>";
        tr += "<td><i>" + result.sname + "</i></td>";
        tr += "<td class='text-center'>" + iconizeScore(result.score) + "</td>";
        tr += "<td class='specFeature text-center'><span class='material-icons-two-tone play pointer'>play_circle_filled</span></td>";
        tr += `<td class='specFeature text-center'><a href='https://xeno-canto.org/explore?query=${result.sname}%20type:nocturnal' target="_blank"><img src='img/logo/XC.png' alt='Search on Xeno Canto'></a></td>`
        tr += `<td class='specFeature text-center download'><span class='material-icons-outlined pointer'>
            file_download</span></td>`;
        tr += `<td id="${index}" class='text-center feedback'> <span class='material-icons-two-tone text-success pointer'>
             thumb_up_alt</span> <span class='material-icons-two-tone text-danger pointer'>thumb_down_alt</span></td>`;
        tr += "</tr>";

        tr += "<tr class='subrow" + index + "'  onclick='loadResultRegion(" + start + " , " + end + ")'><th scope='row'> </th>";
        tr += "<td> </td>";
        tr += "<td> </td>";
        tr += "<td>" + result.cname2 + "</td>";
        tr += "<td><i>" + result.sname2 + "</i></td>";
        tr += "<td class='text-center'>" + iconizeScore(result.score2) + "</td>";
        tr += "<td> </td>";
        tr += "<td> </td>";
        tr += "</tr>";

        tr += "<tr class='subrow" + index + "'  onclick='loadResultRegion(" + start + " , " + end + " )' ><th scope='row'> </th>";
        tr += "<td> </td>";
        tr += "<td> </td>";
        tr += "<td>" + result.cname3 + "</td>";
        tr += "<td><i>" + result.sname3 + "</i></td>";
        tr += "<td class='text-center'>" + iconizeScore(result.score3) + "</td>";
        tr += "<td> </td>";
        tr += "<td> </td>";
        tr += "</tr>";
    }
    selection ? resultTable.prepend(tr) : resultTable.append(tr)

    if (!config.spectrogram) $('.specFeature').hide();
    $(".material-icons").click(function () {
        $(this).toggleClass("down");
    })

    const toprow = $('.top-row')
    $(document).on('click', '.download', function (e) {
        action = 'save';
        sendFile(action, predictions[index])
        e.stopImmediatePropagation();
    });
    $(document).on('click', '.feedback', function (e) {

        let index = e.target.parentNode.id;
        e.target.parentNode.onclick = null;
        let action;
        (e.target.classList.contains('text-success')) ? action = 'correct' : action = 'incorrect';
        currentNode = e.target.parentNode
        if (action === 'incorrect') {
            findSpecies();
        } else if (confirm('Submit feedback?')) {
            currentNode.innerHTML = 'Submitted <span class="material-icons-two-tone submitted text-success">done</span>'

        }
        e.stopImmediatePropagation();

    });

    toprow.click(function () {
        toprow.each(function () {
            $(this).removeClass('table-active')
        })
        $(this).addClass("table-active");
    })
});

function findSpecies() {
    document.removeEventListener('keydown', handleKeyDown, true);
    $('#feedbackModal').modal();
}


$('#feedbackModal').on('hidden.bs.modal', function (e) {
    enableKeyDownEvent();
    if (correctedSpecies) {
        currentPrediction.filename = correctedSpecies + '_' + Date.now().toString();
        sendFile('incorrect', currentPrediction);
        correctedSpecies = undefined;
        currentNode.innerHTML = 'Submitted <span class="material-icons-two-tone submitted text-success">done</span>';
    }
})

function sendFile(action, result) {
    let start = result.start, end = result.end, filename = result.filename;
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
    if (result.cname) {
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
            'score3': result.score3
        };
    }
    if (action === 'save') {
        ipcRenderer.send('save', {
            'start': start, 'end': end, 'filepath': filename, 'metadata': metadata
        })
    } else {
        if (!config.seenThanks) {
            alert('Thank you, your feedback helps improve Chirpity predictions');
            config.seenThanks = true;
            updatePrefs()
        }
        ipcRenderer.send('post', {
            'start': start, 'end': end, 'filepath': filename, 'metadata': metadata, 'action': action
        })
    }
}

// create a dict mapping score to icon
const iconDict = {
    // 'low': '<span class="material-icons text-danger border border-secondary rounded" title="--%">signal_cellular_alt_1_bar</span>',
    // 'medium': '<span class="material-icons text-warning border border-secondary rounded" title="--%">signal_cellular_alt_2_bar</span>',
    // 'high': '<span class="material-icons text-success border border-secondary rounded" title="--%">signal_cellular_alt</span>',
    'low': '<span class="material-icons text-danger border border-secondary rounded" title="Low">signal_cellular_alt_1_bar</span>',
    'medium': '<span class="material-icons text-warning border border-secondary rounded" title="Medium">signal_cellular_alt_2_bar</span>',
    'high': '<span class="material-icons text-success border border-secondary rounded" title="High">signal_cellular_alt</span>',
}

function iconizeScore(score) {
    const tooltip = (parseFloat(score) * 100).toFixed(0).toString()
    if (parseFloat(score) < 0.65) return iconDict['low'].replace('--', tooltip)
    else if (parseFloat(score) < 0.85) return iconDict['medium'].replace('--', tooltip)
    else return iconDict['high'].replace('--', tooltip)
}