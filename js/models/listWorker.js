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
  "Siren_Siren",
  "Engine_Engine",
  "Ambient Noise_Ambient Noise",
  "Church Bells_Church Bells",
  "No call_No call",
  "Water Drops_Water Drops",
];

const birdnetlabelFile = `../../labels/V2.4/BirdNET_GLOBAL_6K_V2.4_Labels_en.txt`;

/**
 * Asynchronously loads and returns bird labels from a file.
 *
 * This function fetches the text content from the file specified by the global variable
 * `birdnetlabelFile`. The content is trimmed and split by newline characters into an array of label strings.
 * If the fetch operation fails or returns a non-ok response, the error is logged and the function returns undefined.
 *
 * @returns {Promise<string[]|undefined>} A promise that resolves to an array of label strings on success, or undefined if an error occurs.
 */
async function loadLabels(){
  return  fetch(birdnetlabelFile)
    .then((response) => {
      if (!response.ok) throw new Error("Network response was not ok");
      return response.text();
    })
    .then((filecontents) => {
      return filecontents.trim().split(/\r?\n/);
    })
    .catch((error) => {
      console.error("There was a problem fetching the label file:", error);
    });
}
const ACTIVITY_INDEX = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../nocturnal_activity_index.json"),
    "utf8"
  )
);

const BIRDNET_LABELS = await loadLabels();


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
        const { model, listType, useWeek, customLabels, labels } = e.data;
        listModel.customLabels = customLabels;
        listModel.model = model;
        listModel.splitChar = model === "perch v2" ? "~" : "_";
        listModel.labels = labels; // || model === "birdnet" ? BIRDNET_LABELS : listModel.modelLabels[model];
        let lat = parseFloat(e.data.lat);
        let lon = parseFloat(e.data.lon);
        let week = parseInt(e.data.week);
        let threshold = parseFloat(e.data.threshold);
        let localBirdsOnly = e.data.localBirdsOnly;
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
    this.modelLabels = {};
  }

  async loadModel() {
    if (this.model_loaded === false) {
      // Model files must be in a different folder than the js, assets files
      if (DEBUG) console.log("loading model from", this.appPath);
      this.metadata_model = await tf.loadGraphModel(this.appPath);
      // const mdata_label_path = path.join(__dirname, '..','BirdNET_GLOBAL_6K_V2.4_Model_TFJS','static','model','labels.json')
      this.mdata_labels = BIRDNET_LABELS; //JSON.parse(fs.readFileSync(mdata_label_path, "utf8")); // Labels used in the metadata model
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
        const customScienticNames = this.customLabels.map(this.getFirstElement);
        let line = 0;
        // Go through each custom label
        for (let i = 0; i < customScienticNames.length; i++) {
          const sname = customScienticNames[i];
          line++;
          // Find all indices in this model's labels that match the current custom label
          const indexes = findAllIndexes(labelsScientificNames, sname);
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
            sname === "Unknown Sp." ||
              messages.push({ sname: sname, model: this.model, line: line });
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
          // Check if the first part is in the notBirdsFirstParts array, or if it lacks spaces or contains underscores
          const found = notBirdsFirstParts.includes(firstPart) || firstPart.indexOf(" ") === -1 || firstPart.indexOf("_") !== -1;
          return found ? null : index + 1;
        })
        .filter((index) => index !== null);
      DEBUG && console.log("filtering took", Date.now() - t0, "ms");
    }
    return [includedIDs.sort((a, b) => a - b), messages];
  }
}
/**
 * Returns all indices at which a specified value occurs in an array.
 *
 * @param {Array} array - The array to search.
 * @param {*} value - The value to find within the array.
 * @returns {number[]} An array of indices where the value is found.
 */
function findAllIndexes(array, value) {
  return array.reduce((acc, currentValue, currentIndex) => {
    if (currentValue === value) {
      acc.push(currentIndex);
    }
    return acc;
  }, []);
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
