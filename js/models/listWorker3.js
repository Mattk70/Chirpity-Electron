try {
  // tfjs-node check
  require("@tensorflow/tfjs-node");
  postMessage({ message: "tfjs-node", available: true });
} catch (e) {
  postMessage({ message: "tfjs-node", available: false });
}

async function supportsWebGPUFloat16() {
  if (!navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return !!adapter?.features.has("shader-f16");
  } catch {
    return false;
  }
}

import { NEW_TO_OLD_TAXONOMY } from "../utils/new_to_old_taxonomy.js";
const ort = require ("onnxruntime-node");
let session = null;
const fs = require("node:fs");
const path = require("node:path");

let DEBUG = false;

/**
 * Load BirdNET3's CSV labels in the model's scientific/common/class label format.
 *
 * @returns {string[]} Labels formatted as `scientific_common_class`.
 */
function getBN3Labels() {
  const labelFile = path.join(__dirname, "..", "..", "BirdNET3",
         "BirdNET3_geomodel_labels.csv");
  const fileContents = fs.readFileSync(labelFile, "utf8");
  return fileContents
    .trim()
    .split(/\r?\n/)
    .slice(1) // skip header
    .map(line => {
      const [sci_name, com_name, class_name] = line.split(",");
      return `${sci_name}_${com_name}_${class_name}`;
    });
}
const BIRDNET3_LABELS = getBN3Labels();
DEBUG && console.log(BIRDNET3_LABELS.length, "labels loaded from BirdNET3 label file");

//GLOBALS
let listModel;

const NOT_BIRDS = [
  "Acris crepitans", // Northern Cricket Frog
  "Acris gryllus", // Southern Cricket Frog
  "Allonemobius allardi", // Allard's Ground Cricket
  "Allonemobius tinnulus", // Tinkling Ground Cricket
  "Allonemobius walkeri", // Walker's Ground Cricket
  "Alouatta pigra", // Mexican Black Howler Monkey
  "Amblycorypha alexanderi", // Clicker Round-winged Katydid
  "Amblycorypha longinicta", // Common Virtuoso Katydid
  "Amblycorypha oblongifolia", // Oblong-winged Katydid
  "Amblycorypha rotundifolia", // Rattler Round-winged Katydid
  "Anaxipha exigua", // Say's Trig
  "Anaxyrus americanus", // American Toad
  "Anaxyrus canorus", // Yosemite Toad
  "Anaxyrus cognatus", // Great Plains Toad
  "Anaxyrus fowleri", // Fowler's Toad
  "Anaxyrus houstonensis", // Houston Toad
  "Anaxyrus microscaphus", // Arizona Toad
  "Anaxyrus quercicus", // Oak Toad
  "Anaxyrus speciosus", // Texas Toad
  "Anaxyrus terrestris", // Southern Toad
  "Anaxyrus woodhousii", // Woodhouse's Toad
  "Apis mellifera", // Honey Bee
  "Atlanticus testaceus", // Protean Shieldback
  "Canis latrans", // Coyote
  "Canis lupus", // Gray Wolf
  "Conocephalus brevipennis", // Short-winged Meadow Katydid
  "Conocephalus fasciatus", // Slender Meadow Katydid
  "Cyrtoxipha columbiana", // Columbian Trig
  "Dryophytes andersonii", // Pine Barrens Treefrog
  "Dryophytes arenicolor", // Canyon Treefrog
  "Dryophytes avivoca", // Bird-voiced Treefrog
  "Dryophytes chrysoscelis", // Cope's Gray Treefrog
  "Dryophytes cinereus", // Green Treefrog
  "Dryophytes femoralis", // Pine Woods Treefrog
  "Dryophytes gratiosus", // Barking Treefrog
  "Dryophytes squirellus", // Squirrel Treefrog
  "Dryophytes versicolor", // Gray Treefrog
  "Eleutherodactylus planirostris", // Greenhouse Frog
  "Eunemobius carolinus", // Carolina Ground Cricket
  "Eunemobius confusus", // Confused Ground Cricket
  "Gastrophryne carolinensis", // Eastern Narrow-mouthed Toad
  "Gastrophryne olivacea", // Great Plains Narrow-mouthed Toad
  "Gryllus assimilis", // Gryllus assimilis
  "Gryllus fultoni", // Southern Wood Cricket
  "Gryllus pennsylvanicus", // Fall Field Cricket
  "Gryllus rubens", // Southeastern Field Cricket
  "Hyliola regilla", // Pacific Chorus Frog
  "Incilius valliceps", // Gulf Coast Toad
  "Lithobates catesbeianus", // American Bullfrog
  "Lithobates clamitans", // Green Frog
  "Lithobates palustris", // Pickerel Frog
  "Lithobates sylvaticus", // Wood Frog
  "Microcentrum rhombifolium", // Greater Angle-wing
  "Miogryllus saussurei", // Miogryllus saussurei
  "Neoconocephalus bivocatus", // False Robust Conehead
  "Neoconocephalus ensiger", // Sword-bearing Conehead
  "Neoconocephalus retusus", // Round-tipped Conehead
  "Neoconocephalus robustus", // Robust Conehead
  "Neonemobius cubensis", // Cuban Ground Cricket
  "Odocoileus virginianus", // White-tailed Deer
  "Oecanthus celerinictus", // Fast-calling Tree Cricket
  "Oecanthus exclamationis", // Davis's Tree Cricket
  "Oecanthus fultoni", // Snowy Tree Cricket
  "Oecanthus nigricornis", // Blackhorned Tree Cricket
  "Oecanthus niveus", // Narrow-winged Tree Cricket
  "Oecanthus pini", // Pine Tree Cricket
  "Oecanthus quadripunctatus", // Four-spotted Tree Cricket
  "Orchelimum agile", // Agile Meadow Katydid
  "Orchelimum concinnum", // Stripe-faced Meadow Katydid
  "Orchelimum pulchellum", // Handsome Meadow Katydid
  "Orocharis saltator", // Jumping Bush Cricket
  "Phyllopalpus pulchellus", // Handsome Trig
  "Pseudacris brimleyi", // Brimley's Chorus Frog
  "Pseudacris clarkii", // Spotted Chorus Frog
  "Pseudacris crucifer", // Spring Peeper
  "Pseudacris feriarum", // Upland Chorus Frog
  "Pseudacris nigrita", // Southern Chorus Frog
  "Pseudacris ocularis", // Little Grass Frog
  "Pseudacris ornata", // Ornate Chorus Frog
  "Pseudacris streckeri", // Strecker's Chorus Frog
  "Pseudacris triseriata", // Striped Chorus Frog
  "Pterophylla camellifolia", // Common True Katydid
  "Scaphiopus couchii", // Couch's Spadefoot
  "Sciurus carolinensis", // Eastern Gray Squirrel
  "Scudderia curvicauda", // Curve-tailed Bush Katydid
  "Scudderia furcata", // Fork-tailed Bush Katydid
  "Scudderia texensis", // Texas Bush Katydid
  "Spea bombifrons", // Plains Spadefoot
  "Tamias striatus", // Eastern Chipmunk
  "Tamiasciurus hudsonicus", // Red Squirrel
  "Vulpes vulpes", // Red Fox
  "Human vocal", // Human vocal
  "Human non-vocal", // Human non-vocal
  "Human whistle", // Human whistle
  "Power tools", // Power tools
  "Ambient Noise", // Ambient Noise
  "Church Bells", // Church Bells
  "No call", // No call
  "Water Drops", // Water Drops
];

const geomodelLabelFile = path.resolve(__dirname, '../../BirdNET3/BirdNET+_Geomodel_V3.0.3_Global_12K_Labels.txt');



const OLD_TO_NEW_TAXONOMY = Object.fromEntries(
  Object.entries(NEW_TO_OLD_TAXONOMY).map(([newName, oldName]) => [oldName, newName])
);

/**
 * Load tilde-delimited labels while preserving an optional class component.
 *
 * Read failures are logged and produce `undefined`.
 *
 * @param {string} filePath - Label file to read.
 * @returns {string[]|undefined} Normalized label lines, or `undefined` when reading fails.
 */
function loadLabels(filePath) {
  try {
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return fileContents.trim().split(/\r?\n/).map(line => {
      const [scientificName, commonName, classLabel] = line.split('~');
      return `${scientificName}~${commonName}${classLabel ? `~${classLabel}` : ''}`;      
    });
  } catch (error) {
    console.error(`There was a problem reading the label file at ${filePath}:`, error);
  }
}

/**
 * Download the current Perch labels, replace the local label file, and return its lines.
 *
 * Network and write failures are logged and resolve to `undefined`.
 *
 * @param {string} labelsPath - Destination label-file path.
 * @returns {Promise<string[]|undefined>} Downloaded label lines, if the update succeeds.
 */
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

const GEOMODEL_LABELS = loadLabels(geomodelLabelFile);
let PERCH_LABELS;


/* USAGE EXAMPLES:
listWorker.postMessage({message: 'load'})
listWorker.postMessage({message: 'get-list', model: 'chirpity', listType: 'location', useWeek: true, lat: 52.0, lon: -0.5, week: 40, threshold: 0.01 })
*/

/**
 * Generate an inclusion list requested by the parent worker and post the result.
 *
 * @param {MessageEvent} e - `get-list` request with model, list, location, and filtering options.
 * @returns {Promise<void>} Resolves after the list response is posted or an error is logged.
 */
onmessage = async (e) => {
  DEBUG && console.log("got a message", e.data);
  const { message } = e.data;

  try {
    switch (message) {
      case "get-list": {
        // labels here is every label in the database
        const { model, modelPath, listType, useWeek, customLabels, labels, localBirdsOnly, classes } = e.data;
        let { lat, lon, week, threshold } = e.data;
        listModel.customLabels = customLabels;
        listModel.model = model;
        listModel.classes = classes?.length ? classes : ['Aves'];
        const perch = model === "perch v2";
        const birdnet3 = model === "birdnet3";
        listModel.perch = perch;
        listModel.birdnet3 = birdnet3;
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
        } else if (birdnet3) {
          listModel.labels = BIRDNET3_LABELS;
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

/**
 * Generate model label indices for location, activity, taxonomic-class, or custom-list filters.
 */
class Model {
  /**
   * @param {string} appPath - Path to the BirdNET3 geographic model.
   */
  constructor(appPath) {
    this.model_loaded = false;
    this.appPath = appPath;
    this.labels = undefined; // labels in the model we're filtering
    this.customLabels = undefined; // custom labels for custom list
    this.splitChar = '_';
  }

  /**
   * Load the geographic ONNX model used for location-based filtering.
   *
   * @param {string} mpath - Reserved path argument; `appPath` from construction is used.
   * @param {string} backend - `webgpu` to prefer WebGPU, or another value to use CPU only.
   * @param {number} batchSize - Fixed batch dimension supplied to ONNX Runtime.
    * @returns {Promise<boolean>} Whether the inference session and geographic labels are ready.
   */
  async loadModel() {
    const supportsF16 = await supportsWebGPUFloat16();
    supportsF16 || postMessage({ message: "no-onnx-gpu" });
    const providers =  supportsF16 ? ['webgpu', 'cpu'] : ['cpu'];
    const   preferredOutputLocation = {
      'probabilities': 'cpu'
    }
    const threadOptions = { intraOpNumThreads:4, interOpNumThreads: 2 };
    const executionProviderConfig = { webgpu: { validationMode: 'basic' } };
    const sessionOptions = { 
      executionProviders: providers,
      enableGraphCapture: true, 
      ...threadOptions,
      executionProviderConfig,
      executionMode: 'parallel',
      enableCpuMemArena: true,
      preferredOutputLocation,
    };
    session = null;
    try {
      session = await ort.InferenceSession.create(this.appPath, sessionOptions);
    } catch (e) {
      console.warn('List model failure: ', e.message);
      postMessage({message:'model-load-failure'})
      return false;
    }
    this.mdata_labels = GEOMODEL_LABELS || [];
    return true;
  }

  getFirstElement = (label) => label.split(this.splitChar)[0];
  /**
   * Build the active model-label index list for the requested filtering mode.
   *
   * Location lists use the geographic model and threshold; nocturnal lists may
   * be intersected with that location result. Custom lists also report labels
   * that could not be matched.
   *
   * @param {Object} options - List selection options.
   * @param {number} options.lat - Latitude for a location-derived list.
   * @param {number} options.lon - Longitude for a location-derived list.
   * @param {number} options.week - Geographic-model week, ignored when `useWeek` is false.
   * @param {string} options.listType - List mode to generate.
   * @param {boolean} options.useWeek - Whether to use the supplied week.
   * @param {number} options.threshold - Minimum geographic-model probability.
   * @param {boolean} options.localBirdsOnly - Whether to restrict a nocturnal list to local species.
   * @returns {Promise<Array>} A tuple of sorted label indices and unmatched custom-label messages.
   */
  async setList({
    lat,
    lon,
    week,
    listType,
    useWeek,
    threshold,
    localBirdsOnly,
  }) {
    if (!session) {
      throw new Error("List model session is not available");
    }
    const t0 = Date.now();
    let includedIDs = [],
      messages = [];
    week = useWeek ? week : -1;
    if (listType === "everything") {
      includedIDs = this.labels.map((_, index) => index);
    } else if (listType === "location") {
      DEBUG && console.log("lat", lat, "lon", lon, "week", week);
      
      let mdata_probs = new Float32Array(this.mdata_labels.length);
      if (week < 1) {
        // Yearly (week 0): max predictions across all 48 weeks
        const batchSize = 48;
        const data = new Float32Array(batchSize * 3);
        for (let i = 0; i < batchSize; i++) {
          data[i * 3]     = lat;      // column 0
          data[i * 3 + 1] = lon;      // column 1
          data[i * 3 + 2] = i + 1;    // column 2 (weeks 1-48)
        }
        const input = new ort.Tensor('float32', data, [batchSize, 3]);
        const output = await session.run({ input });
        const probs = output.probabilities.data;
        const nSpecies = probs.length / batchSize;

        // Compute maximum across all 48 weeks.
        for (let s = 0; s < nSpecies; s++) {
          let maxProb = 0;
          for (let w = 0; w < batchSize; w++) {
            const prob = probs[w * nSpecies + s];
            if (w === 0 || prob > maxProb) {
              maxProb = prob;
            }
          }
          mdata_probs[s] = maxProb;
        }
        DEBUG && console.log("Max probabilities across all weeks computed.", mdata_probs);
      } else {
          this.mdata_input = new ort.Tensor('float32', [lat, lon, week], [1, 3]);
          const mdata_prediction = await session.run({ 'input': this.mdata_input });
          mdata_probs = mdata_prediction.probabilities.data;
      }
      let count = 0; const model = this.model;
      for (let i = 0; i < mdata_probs.length; i++) {
        const index = i; // mdata_probs.indexOf(mdata_probs_sorted[i]);
        if (mdata_probs[index] < threshold) {
          DEBUG &&
            console.log(
              "Excluding:",
              this.mdata_labels[index] + ": " + mdata_probs[index]
            );
        } else {
          const latin = this.mdata_labels[index].split("~")[0];
          // Translate new-taxonomy name -> old-taxonomy name, if it was renamed.
          // If it's not in the map, the name is unchanged between the two lists.
          const oldLatin = !['birdnet3', 'perch v2'].includes(model) ? NEW_TO_OLD_TAXONOMY[latin] || latin : latin;
          // Use the reduce() method to accumulate the indices of species containing the latin name
          const foundIndices = this.labels.reduce(
            (indices, element, index) => {
              const latinName = this.getFirstElement(element)
              if (latinName === oldLatin) indices.push(index);
              return indices;
            },
            []
          );
          const classes = listModel.classes;
          foundIndices.forEach((index) => {
            // Exclude unselected classes for birdnet3 & perch
            if (["birdnet3", "perch v2"].includes(model) && !classes.some(cls => this.labels[index].includes(cls))) return;
            includedIDs.push(index + 1);
            count++;
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
        let item = this.labels[i];
        const itemList = item.split(/[_,]/);
        let [latin, common, cls] = itemList;
        if (this.birdnet3){
          if (!this.classes.includes(cls)) continue;
          latin = NEW_TO_OLD_TAXONOMY[latin] || latin;
          item = `${latin},${common}`;
        }
        if (
          ACTIVITY_INDEX[item] !== 1 &&
          ! NOT_BIRDS.includes(latin) &&
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

      // Create a list of included labels' indices
      const t0 = Date.now();

      includedIDs = this.labels
        .map((label, index) => {
          const firstPart = this.getFirstElement(label);
          if (this.perch_TEST) {
            // Perch has different format, so we need to check differently
            const list = listType === "birds" ? "~Aves" : '~' + listType;
            // None type means exclude these labels
            if (listType === "None") return label.indexOf(list) === -1 ? index + 1 : null;
            return label.indexOf(list) !== -1 ? index + 1 : null;
          } else if (this.perch ||this.birdnet3) { // TODO: not working
            // Exclude unselected classes for birdnet3
            if (!this.classes.some(cls => this.labels[index].includes(cls))) return;
            return index + 1;
          } else {
            // Check if the first part is in the notBirdsFirstParts array, or if it lacks spaces or contains underscores
            const found = NOT_BIRDS.includes(firstPart) || firstPart.indexOf(" ") === -1 || firstPart.indexOf("_") !== -1;
            return found ? null : index + 1;
          }
        })
        .filter((index) => index !== null);
      DEBUG && console.log("filtering took", Date.now() - t0, "ms");
    }
    DEBUG && console.log(`List creation took ${Date.now() - t0} ms`)
    return [includedIDs.sort((a, b) => a - b), messages];
  }

    /**
   * Return indices matching a value or its old-to-new taxonomy equivalent.
   *
   * @param {Array} array - The array to search.
   * @param {*} value - The value to find within the array.
   * @returns {number[]} An array of indices where the value is found.
   */
  findAllIndexes(array, value) {
    const result = [];
    const alt = OLD_TO_NEW_TAXONOMY[value];

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
 * Load the geographic ONNX model and notify the parent worker that list generation is ready.
 *
 * @returns {Promise<void>} Resolves after the readiness message is posted.
 */
async function _init_() {
  DEBUG && console.log(`List generating model received load instruction.`);
  listModel = new Model( path.resolve(
      __dirname, "../../BirdNET3/BirdNET+_Geomodel_V3.0.3_Global_12K_FP16.onnx"
    ).replace('app.asar', 'app.asar.unpacked'));

  const loaded = await listModel.loadModel();
  if (!loaded) return;
  postMessage({ message: "list-model-ready" });
};


await _init_();
