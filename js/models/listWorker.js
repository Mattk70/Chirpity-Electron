let tf, BACKEND;
try {
  tf = require("@tensorflow/tfjs-node");
  BACKEND = "tensorflow";
  postMessage({ message: "tfjs-node", available: true });
} catch (e) {
  console.info(e)
  tf = require("@tensorflow/tfjs");
  require("@tensorflow/tfjs-backend-webgpu");
  BACKEND = "webgpu";
  postMessage({ message: "tfjs-node", available: false });
}
const fs = require("node:fs");
const path = require("node:path");
let DEBUG = false;

//GLOBALS
let listModel;

const NOT_BIRDS = [
  "Acris crepitans_Northern Cricket Frog",
  "Acris gryllus_Southern Cricket Frog",
  "Allonemobius allardi_Allard's Ground Cricket",
  "Allonemobius tinnulus_Tinkling Ground Cricket",
  "Allonemobius walkeri_Walker's Ground Cricket",
  "Alouatta pigra_Mexican Black Howler Monkey",
  "Amblycorypha alexanderi_Clicker Round-winged Katydid",
  "Amblycorypha longinicta_Common Virtuoso Katydid",
  "Amblycorypha oblongifolia_Oblong-winged Katydid",
  "Amblycorypha rotundifolia_Rattler Round-winged Katydid",
  "Anaxipha exigua_Say's Trig",
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
  "Apis mellifera_Honey Bee",
  "Atlanticus testaceus_Protean Shieldback",
  "Canis latrans_Coyote",
  "Canis lupus_Gray Wolf",
  "Conocephalus brevipennis_Short-winged Meadow Katydid",
  "Conocephalus fasciatus_Slender Meadow Katydid",
  "Cyrtoxipha columbiana_Columbian Trig",
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
  "Eunemobius carolinus_Carolina Ground Cricket",
  "Eunemobius confusus_Confused Ground Cricket",
  "Gastrophryne carolinensis_Eastern Narrow-mouthed Toad",
  "Gastrophryne olivacea_Great Plains Narrow-mouthed Toad",
  "Gryllus assimilis_Gryllus assimilis",
  "Gryllus fultoni_Southern Wood Cricket",
  "Gryllus pennsylvanicus_Fall Field Cricket",
  "Gryllus rubens_Southeastern Field Cricket",
  "Hyliola regilla_Pacific Chorus Frog",
  "Incilius valliceps_Gulf Coast Toad",
  "Lithobates catesbeianus_American Bullfrog",
  "Lithobates clamitans_Green Frog",
  "Lithobates palustris_Pickerel Frog",
  "Lithobates sylvaticus_Wood Frog",
  "Microcentrum rhombifolium_Greater Angle-wing",
  "Miogryllus saussurei_Miogryllus saussurei",
  "Neoconocephalus bivocatus_False Robust Conehead",
  "Neoconocephalus ensiger_Sword-bearing Conehead",
  "Neoconocephalus retusus_Round-tipped Conehead",
  "Neoconocephalus robustus_Robust Conehead",
  "Neonemobius cubensis_Cuban Ground Cricket",
  "Odocoileus virginianus_White-tailed Deer",
  "Oecanthus celerinictus_Fast-calling Tree Cricket",
  "Oecanthus exclamationis_Davis's Tree Cricket",
  "Oecanthus fultoni_Snowy Tree Cricket",
  "Oecanthus nigricornis_Blackhorned Tree Cricket",
  "Oecanthus niveus_Narrow-winged Tree Cricket",
  "Oecanthus pini_Pine Tree Cricket",
  "Oecanthus quadripunctatus_Four-spotted Tree Cricket",
  "Orchelimum agile_Agile Meadow Katydid",
  "Orchelimum concinnum_Stripe-faced Meadow Katydid",
  "Orchelimum pulchellum_Handsome Meadow Katydid",
  "Orocharis saltator_Jumping Bush Cricket",
  "Phyllopalpus pulchellus_Handsome Trig",
  "Pseudacris brimleyi_Brimley's Chorus Frog",
  "Pseudacris clarkii_Spotted Chorus Frog",
  "Pseudacris crucifer_Spring Peeper",
  "Pseudacris feriarum_Upland Chorus Frog",
  "Pseudacris nigrita_Southern Chorus Frog",
  "Pseudacris ocularis_Little Grass Frog",
  "Pseudacris ornata_Ornate Chorus Frog",
  "Pseudacris streckeri_Strecker's Chorus Frog",
  "Pseudacris triseriata_Striped Chorus Frog",
  "Pterophylla camellifolia_Common True Katydid",
  "Scaphiopus couchii_Couch's Spadefoot",
  "Sciurus carolinensis_Eastern Gray Squirrel",
  "Scudderia curvicauda_Curve-tailed Bush Katydid",
  "Scudderia furcata_Fork-tailed Bush Katydid",
  "Scudderia texensis_Texas Bush Katydid",
  "Spea bombifrons_Plains Spadefoot",
  "Tamias striatus_Eastern Chipmunk",
  "Tamiasciurus hudsonicus_Red Squirrel",
  "Vulpes vulpes_Red Fox",

  "Human vocal_Human vocal",
  "Human non-vocal_Human non-vocal",
  "Human whistle_Human whistle",
  "Power tools_Power tools",
  "Ambient Noise_Ambient Noise",
  "Church Bells_Church Bells",
  "No call_No call",
  "Water Drops_Water Drops",
];

 const p = {
"Ardea ibis":"Bubulcus ibis",
"Tachymarptis melba":"Apus melba",
"Pogonotriccus lanyoni":"Phylloscartes lanyoni",
"Chiroxiphia bokermanni":"Antilophia bokermanni",
"Dessonornis archeri":"Cossypha archeri",
"Tyranniscus cinereiceps":"Phyllomyias cinereiceps",
"Ketupa sumatrana":"Bubo sumatranus",
"Plocealauda assamica":"Mirafra assamica",
"Tachyspiza virgata":"Accipiter virgatus",
"Botaurus flavicollis":"Ixobrychus flavicollis",
"Melloria quoyi":"Cracticus quoyi",
"Astur melanoleucus":"Accipiter melanoleucus",
"Microtarsus melanoleucos":"Brachypodius melanoleucos",
"Strix nigrolineata":"Ciccaba nigrolineata",
"Botaurus dubius":"Ixobrychus dubius",
"Rufirallus fasciatus":"Anurolimnas fasciatus",
"Strix huhula":"Ciccaba huhula",
"Tyranniscus nigrocapillus":"Phyllomyias nigrocapillus",
"Driophlox atrimaxillaris":"Habia atrimaxillaris",
"Chalcites osculans":"Chrysococcyx osculans",
"Chlorophoneus nigrifrons":"Telophorus nigrifrons",
"Thinornis melanops":"Elseyornis melanops",
"Microtarsus melanocephalos":"Brachypodius melanocephalos",
"Cyanocorax colliei":"Calocitta colliei",
"Pyrgilauda blanfordi":"Montifringilla blanfordi",
"Eumyias hoevelli":"Cyornis hoevelli",
"Heliodoxa rubricauda":"Clytolaema rubricauda",
"Tachyspiza fasciata":"Accipiter fasciatus",
"Cyanocorax morio":"Psilorhinus morio",
"Paradoxornis unicolor":"Cholornis unicolor",
"Radinopsyche sellowi":"Herpsilochmus sellowi",
"Corypha apiata":"Mirafra apiata",
"Dessonornis caffer":"Cossypha caffra",
"Chalcopsitta cardinalis":"Pseudeos cardinalis",
"Dendropicos fuscescens":"Chloropicus fuscescens",
"Dyaphorophyia castanea":"Platysteira castanea",
"Daptrius chimango":"Milvago chimango",
"Tachyspiza soloensis":"Accipiter soloensis",
"Turdus mupinensis":"Otocichla mupinensis",
"Botaurus cinnamomeus":"Ixobrychus cinnamomeus",
"Anarhynchus collaris":"Charadrius collaris",
"Tachyspiza cirrocephala":"Accipiter cirrocephalus",
"Astur cooperii":"Accipiter cooperii",
"Driophlox cristata":"Habia cristata",
"Lophospiza trivirgata":"Accipiter trivirgatus",
"Periporphyrus celaeno":"Rhodothraupis celaeno",
"Silvicultrix frontalis":"Ochthoeca frontalis",
"Coloeus dauuricus":"Corvus dauuricus",
"Laterallus spilopterus":"Porzana spiloptera",
"Anarhynchus bicinctus":"Charadrius bicinctus",
"Hesperoburhinus bistriatus":"Burhinus bistriatus",
"Pogonornis bidentatus":"Lybius bidentatus",
"Ketupa coromanda":"Bubo coromandus",
"Corypha fasciolata":"Mirafra fasciolata",
"Eudromias morinellus":"Charadrius morinellus",
"Astur gentilis":"Accipiter gentilis",
"Coloeus monedula":"Corvus monedula",
"Iole finschii":"Alophoixus finschii",
"Stizorhina finschi":"Neocossyphus finschi",
"Sigelus silens":"Melaenornis silens",
"Amirafra rufocinnamomea":"Mirafra rufocinnamomea",
"Prionodura newtoniana":"Amblyornis newtoniana",
"Silvicultrix pulchella":"Ochthoeca pulchella",
"Icthyophaga ichthyaetus":"Haliaeetus ichthyaetus",
"Paradoxornis aemodius":"Conostoma aemodium",
"Anarhynchus leschenaultii":"Charadrius leschenaultii",
"Cryptolybia olivacea":"Stactolaema olivacea",
"Campethera maculosa":"Campethera cailliautii",
"Ceblepyris caesius":"Coracina caesia",
"Tachyspiza novaehollandiae":"Accipiter novaehollandiae",
"Turdus litsitsirupa":"Psophocichla litsitsirupa",
"Rhinoplax vigil":"Buceros vigil",
"Chiroxiphia galeata":"Antilophia galeata",
"Plocealauda erythrocephala":"Mirafra erythrocephala",
"Tachyspiza gularis":"Accipiter gularis",
"Anarhynchus javanicus":"Charadrius javanicus",
"Silvicultrix jelskii":"Ochthoeca jelskii",
"Plocealauda affinis":"Mirafra affinis",
"Heterotetrax vigorsii":"Eupodotis vigorsii",
"Anarhynchus alexandrinus":"Charadrius alexandrinus",
"Spilopelia senegalensis":"Streptopelia senegalensis",
"Botaurus exilis":"Ixobrychus exilis",
"Aplopelia larvata":"Columba larvata",
"Icthyophaga humilis":"Haliaeetus humilis",
"Philohydor lictor":"Pitangus lictor",
"Botaurus minutus":"Ixobrychus minutus",
"Psitteuteles pusillus":"Parvipsitta pusilla",
"Thinornis dubius":"Charadrius dubius",
"Tachyspiza minulla":"Accipiter minullus",
"Thinornis placidus":"Charadrius placidus",
"Ceblepyris cinereus":"Coracina cinerea",
"Diphyllodes magnificus":"Cicinnurus magnificus",
"Anarhynchus peronii":"Charadrius peronii",
"Pogonotriccus ophthalmicus":"Phylloscartes ophthalmicus",
"Strix virgata":"Ciccaba virgata",
"Origma robusta":"Crateroscelis robusta",
"Anarhynchus montanus":"Charadrius montanus",
"Nesotriccus murinus":"Phaeomyias murina",
"Psephotellus varius":"Psephotus varius",
"Trichoglossus concinnus":"Glossopsitta concinna",
"Rufirallus schomburgkii":"Micropygia schomburgkii",
"Chlorophoneus olivaceus":"Telophorus olivaceus",
"Dendropicos griseocephalus":"Chloropicus griseocephalus",
"Gecinulus rafflesii":"Dinopium rafflesii",
"Dessonornis anomalus":"Cossypha anomala",
"Chrysocolaptes validus":"Reinwardtipicus validus",
"Anarhynchus veredus":"Charadrius veredus",
"Eopsaltria capito":"Tregellasia capito",
"Heteroscenes pallidus":"Cacomantis pallidus",
"Aethomyias papuensis":"Sericornis papuensis",
"Hesperoburhinus superciliaris":"Burhinus superciliaris",
"Cacatua leadbeateri":"Lophochroa leadbeateri",
"Microtarsus eutilotus":"Brachypodius eutilotus",
"Gallirex porphyreolophus":"Tauraco porphyreolophus",
"Psitteuteles porphyrocephalus":"Parvipsitta porphyrocephala",
"Rufirallus leucopyrrhus":"Laterallus leucopyrrhus",
"Buphagus erythroryncha":"Buphagus erythrorynchus",
"Lophotis ruficrista":"Eupodotis ruficrista",
"Driophlox fuscicauda":"Habia fuscicauda",
"Tauraco rossae":"Musophaga rossae",
"Acrochordopus burmeisteri":"Phyllomyias burmeisteri",
"Stizorhina fraseri":"Neocossyphus fraseri",
"Phyllaemulor bracteatus":"Nyctibius bracteatus",
"Strix albitarsis":"Ciccaba albitarsis",
"Zonibyx modestus":"Charadrius modestus",
"Rufirallus xenopterus":"Laterallus xenopterus",
"Corypha africana":"Mirafra africana",
"Neophilydor erythrocercum":"Philydor erythrocercum",
"Rufirallus viridis":"Anurolimnas viridis",
"Origma murina":"Crateroscelis murina",
"Botaurus eurhythmus":"Ixobrychus eurhythmus",
"Tachyspiza badia":"Accipiter badius",
"Sakesphoroides cristatus":"Sakesphorus cristatus",
"Mirafra javanica":"Mirafra cantillans",
"Haplospiza rustica":"Spodiornis rusticus",
"Neophilydor fuscipenne":"Philydor fuscipenne",
"Anarhynchus nivosus":"Charadrius nivosus",
"Driophlox gutturalis":"Habia gutturalis",
"Pogonotriccus eximius":"Phylloscartes eximius",
"Thripophaga gutturata":"Cranioleuca gutturata",
"Ketupa nipalensis":"Bubo nipalensis",
"Tachyspiza trinotata":"Accipiter trinotatus",
"Antiurus maculicaudus":"Hydropsalis maculicaudus",
"Spilopelia chinensis":"Streptopelia chinensis",
"Alcurus striatus":"Pycnonotus striatus",
"Botaurus involucris":"Ixobrychus involucris",
"Chlorophoneus sulfureopectus":"Telophorus sulfureopectus",
"Tyranniscus uropygialis":"Phyllomyias uropygialis",
"Pachyglossa agilis":"Dicaeum agile",
"Thinornis tricollaris":"Charadrius tricollaris",
"Microspizias superciliosus":"Accipiter superciliosus",
"Quechuavis decussata":"Systellura decussata",
"Anarhynchus falklandicus":"Charadrius falklandicus",
"Tachyspiza hiogaster":"Accipiter hiogaster",
"Pogonotriccus poecilotis":"Phylloscartes poecilotis",
"Ketupa lactea":"Bubo lacteus",
"Suthora webbiana":"Sinosuthora webbiana",
"Ramosomyia violiceps":"Leucolia violiceps",
"Crinifer leucogaster":"Corythaixoides leucogaster",
"Icthyophaga leucogaster":"Haliaeetus leucogaster",
"Ceblepyris pectoralis":"Coracina pectoralis",
"Menelikornis leucotis":"Tauraco leucotis",
"Caliechthrus leucolophus":"Cacomantis leucolophus",
"Onychostruthus taczanowskii":"Montifringilla taczanowskii",
"Leucoptilon concretum":"Cyornis concretus",
"Cyanocorax formosus":"Calocitta formosa",
"Dessonornis humeralis":"Cossypha humeralis",
"Melanodryas sigillata":"Peneothello sigillata",
"Diphyllodes respublica":"Cicinnurus respublica",
"Anarhynchus wilsonia":"Charadrius wilsonia",
"Botaurus sinensis":"Ixobrychus sinensis",
"Silvicultrix diadema":"Ochthoeca diadema",
"Corvinella corvina":"Lanius corvinus",
"Laterallus flaviventer":"Hapalocrex flaviventer",
"Acritillas indica":"Iole indica",
"Daptrius chimachima":"Milvago chimachima",
"Neosericornis citreogularis":"Sericornis citreogularis",
"Pachyglossa chrysorrhea":"Dicaeum chrysorrheum",
"Microtarsus urostictus":"Brachypodius urostictus",
"Anthus lutescens":"Anthus chii"
}
const birdnetlabelFile = path.resolve(__dirname, '../../labels/V2.4/BirdNET_GLOBAL_6K_V2.4_Labels_en.txt');


/**
 * Loads and returns bird labels from a file.
 *
 * This function reads the text content from the file specified by `filePath`.
 * The content is trimmed and split by newline characters into an array of label strings.
 * If the read operation fails, the error is logged and the function returns undefined.
 *
 * @returns {Promise<string[]|undefined>} A promise that resolves to an array of label strings on success, or undefined if an error occurs.
 */
function loadLabels(filePath) {
  try {
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return fileContents.trim().split(/\r?\n/);
  } catch (error) {
    console.error(`There was a problem reading the label file at ${filePath}:`, error);
  }
}

async function updateLabels(labelsPath) {
  return fetch("https://github.com/Mattk70/Chirpity-Website/releases/download/v2.0.0/newLabels.txt")
    .then((response) => {
      if (!response.ok) throw new Error("Network response was not ok");
      return response.text();
    })
    .then((filecontents) => {
      fs.writeFileSync(labelsPath, filecontents);
      return filecontents.trim().split(/\r?\n/);
    })
    .catch((error) => {
      console.error("There was a problem fetching the Perch label file:", error);
    });
}

const ACTIVITY_INDEX = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../nocturnal_activity_index.json"),
    "utf8"
  )
);

const BIRDNET_LABELS = loadLabels(birdnetlabelFile);
let PERCH_LABELS;


/* USAGE EXAMPLES:
listWorker.postMessage({message: 'load'})
listWorker.postMessage({message: 'get-list', model: 'chirpity', listType: 'location', useWeek: true, lat: 52.0, lon: -0.5, week: 40, threshold: 0.01 })
*/

onmessage = async (e) => {
  DEBUG && console.log("got a message", e.data);
  const { message } = e.data;

  try {
    switch (message) {
      case "get-list": {
        // labels here is every label in the database
        const { model, modelPath, listType, useWeek, customLabels, labels, localBirdsOnly } = e.data;
        let { lat, lon, week, threshold } = e.data;
        listModel.customLabels = customLabels;
        listModel.model = model;
        const perch = model === "perch v2";
        listModel.perch = perch;
        listModel.splitChar = perch ? /[~,]/ : /[_,]/;
        if (perch) {
          PERCH_LABELS ??= loadLabels(path.join(modelPath, 'labels.txt'));
          const parts = PERCH_LABELS && PERCH_LABELS[0]?.split("~");
          if (!parts || parts.length < 3) {
            // Missing / Old format, so try to update
            const updatedLabels = await updateLabels(path.join(modelPath, 'labels.txt'));
            listModel.labels = updatedLabels;
          } else {
            listModel.labels = PERCH_LABELS;
          }
        } else {
          listModel.labels = labels;
        }
        lat = parseFloat(lat);
        lon = parseFloat(lon);
        week = parseInt(week);
        threshold = parseFloat(threshold);
        DEBUG && console.log(`Setting list to ${listType}`);
        const [includedIDs, messages] = await listModel.setList({
          lat,
          lon,
          week,
          listType,
          useWeek,
          threshold,
          localBirdsOnly,
        });
        postMessage({
          message: "your-list-sir",
          result: includedIDs,
          messages: messages,
        });
        break;
      }
    }
  } catch (error) {
    // If worker was respawned
    console.log(error);
  }
};

class Model {
  constructor(appPath) {
    this.model_loaded = false;
    this.appPath = appPath;
    this.labels = undefined; // labels in the model we're filtering
    this.customLabels = undefined; // custom labels for custom list
    this.splitChar = '_';
  }

  async loadModel() {
    if (this.model_loaded === false) {
      // Model files must be in a different folder than the js, assets files
      if (DEBUG) console.log("loading model from", this.appPath);
      this.metadata_model = await tf.loadGraphModel(this.appPath);
      // const mdata_label_path = path.join(__dirname, '..','BirdNET_GLOBAL_6K_V2.4_Model_TFJS','static','model','labels.json')
      this.mdata_labels = BIRDNET_LABELS;
    }
  }

  getFirstElement = (label) => label.split(this.splitChar)[0];
  async setList({
    lat,
    lon,
    week,
    listType,
    useWeek,
    threshold,
    localBirdsOnly,
  }) {
    let includedIDs = [],
      messages = [];
    week = useWeek ? week : -1;
    if (listType === "everything") {
      includedIDs = this.labels.map((_, index) => index);
    } else if (listType === "location") {
      DEBUG && console.log("lat", lat, "lon", lon, "week", week);
      this.mdata_input = tf.tensor([lat, lon, week]).expandDims(0);
      const mdata_prediction = this.metadata_model.predict(this.mdata_input);
      const mdata_probs = await mdata_prediction.data();
      let count = 0;
      for (let i = 0; i < mdata_probs.length; i++) {
        const index = i; // mdata_probs.indexOf(mdata_probs_sorted[i]);
        if (mdata_probs[index] < threshold) {
          DEBUG &&
            console.log(
              "Excluding:",
              this.mdata_labels[index] + ": " + mdata_probs[index]
            );
        } else {
          count++;
          const latin = this.mdata_labels[index].split("_")[0];
          // Use the reduce() method to accumulate the indices of species containing the latin name
          const foundIndices = this.labels.reduce(
            (indices, element, index) => {
              let latinName;
              const parts = element.split("_");
              if (parts.length === 2) {
                latinName = parts[0];
              } else {
                latinName = element.split("~")[0];
              }
              if (latinName === latin) indices.push(index);
              return indices;
            },
            []
          );
          foundIndices.forEach((index) => {
            // If we want an override list...=>
            //if (! ['Dotterel', 'Stone-curlew', 'Spotted Crake'].some(this.labels[index])) BLOCKED_IDS.push(index)
            includedIDs.push(index + 1);
            DEBUG &&
              console.log(
                "Including: ",
                index,
                "name",
                this.labels[index],
                "probability",
                mdata_probs[i].toFixed(5)
              );
          });
        }
      }
      DEBUG &&
        console.log("Total species considered at this location: ", count);
      // return an object
      //includedIDs = {week: week, lat: lat, lon:lon, included: includedIDs}
    } else if (listType === "nocturnal") {
      // Get list of IDs of birds that call through the night or all the time. Exclude non-avian classes
      for (let i = 0; i < this.labels.length; i++) {
        const item = this.labels[i];
        if (
          ACTIVITY_INDEX[item] !== 1 &&
          ! NOT_BIRDS.includes(item) &&
          item.indexOf("(song)") === -1
        )
          includedIDs.push(i + 1);
      }
      if (localBirdsOnly) {
        const additionalIDs = includedIDs;
        // Now get list of local birds
        const local_ids = await this.setList({
          lat,
          lon,
          week,
          listType: "location",
          useWeek,
          threshold,
        });
        // Create a list of indices that appear in both lists
        includedIDs = additionalIDs.filter((id) => local_ids[0].includes(id));
      }
    } else if (listType === "custom") {
      if (this.customLabels) {
        // hack: why it gets called first without customLabels I don't know! But it will be called a second time with one.
        const labelsScientificNames = this.labels.map(this.getFirstElement);
        const customScienticNames = this.customLabels.map(label => label.split(this.splitChar)[0]);
        // Go through each custom label
        for (let i = 0; i < customScienticNames.length; i++) {
          const sname = customScienticNames[i];
          // Find all indices in this model's labels that match the current custom label
          const indexes = this.findAllIndexes(labelsScientificNames, sname);
          if (indexes.length) {
            let selectedIndexes = [];
            if (indexes.length > 1) { // Multiple matches
              const match = this.customLabels[i].match(/\(.*?\)|-$/);
              const callType = match ? match[0] : null;

              for (let idx of indexes) {
                if (callType) {
                  // Check if the word in brackets exists in this label
                  if (this.labels[idx].endsWith(callType)) {
                    selectedIndexes.push(idx + 1);
                  }
                } else {
                  selectedIndexes.push(idx + 1);
                }
              }
            } else {
              // Only one match, so add it
              const idx = indexes.map(num => num + 1)
              selectedIndexes.push(...idx);
            }
            if (selectedIndexes.length) {
              includedIDs.push(...selectedIndexes);
            }
          } else {
            sname.includes("Unknown Sp.") ||
              messages.push({ sname, model: this.model, line: (i + 1) });
          }
        }
      }
    } else {
      // looking for birds (chirpity) or (birds or migrants) in the case of birdnet
      // Function to extract the first element after splitting on '_'

      // Create a list of included labels' indices
      const t0 = Date.now();
      const notBirdsFirstParts = NOT_BIRDS.map(this.getFirstElement);

      includedIDs = this.labels
        .map((label, index) => {
          const firstPart = this.getFirstElement(label);
          if (this.perch) {
            listType === "Animalia" && (listType = "None");
            // Perch has different format, so we need to check differently
            const list = listType === "birds" ? "~Aves" : '~' + listType;
            // None type means exclude these labels
            if (listType === "None") return label.indexOf(list) === -1 ? index + 1 : null;
            return label.indexOf(list) !== -1 ? index + 1 : null;
          } else {
            // Check if the first part is in the notBirdsFirstParts array, or if it lacks spaces or contains underscores
            const found = notBirdsFirstParts.includes(firstPart) || firstPart.indexOf(" ") === -1 || firstPart.indexOf("_") !== -1;
            return found ? null : index + 1;
          }
        })
        .filter((index) => index !== null);
      DEBUG && console.log("filtering took", Date.now() - t0, "ms");
    }
    return [includedIDs.sort((a, b) => a - b), messages];
  }

    /**
   * Returns all indices at which a specified value occurs in an array.
   *
   * @param {Array} array - The array to search.
   * @param {*} value - The value to find within the array.
   * @returns {number[]} An array of indices where the value is found.
   */
  findAllIndexes(array, value) {
    const result = [];
    const alt = p[value];

    for (let i = 0; i < array.length; i++) {
      const v = array[i];
      if (v === value || v === alt) {
        result.push(i);
      }
    }
    return result;
  }
}


/**
 * Initializes TensorFlow.js with the specified backend and loads the bird identification model.
 *
 * This asynchronous function sets the TensorFlow.js backend to the value specified in BACKEND, enables production mode, 
 * and creates an instance of the Model class with the provided model path. Once the model is successfully loaded,
 * it signals readiness by sending a "list-model-ready" message via postMessage.
 *
 * @async
 */
async function _init_() {
  DEBUG && console.log("load loading metadata_model");
  // const appPath = "../" + location + "/";
  DEBUG && console.log(`List generating model received load instruction.`);
  tf.setBackend(BACKEND).then(async () => {
    tf.enableProdMode();
    if (DEBUG) {
      console.log(tf.env());
      console.log(tf.env().getFlags());
    }
    listModel = new Model(
      "../../BirdNET_GLOBAL_6K_V2.4_Model_TFJS/static/model/mdata/model.json"
    );

    await listModel.loadModel();
    postMessage({ message: "list-model-ready" });
  });
}

await _init_();
