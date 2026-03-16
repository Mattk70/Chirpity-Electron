let tf, BACKEND, Model, LOCALE, DEBUG = false;
try {
  tf = require("@tensorflow/tfjs-node");
} catch {
  tf = require("@tensorflow/tfjs");
  BACKEND = "webgpu";
}
const fs = require("node:fs");
const path = require("node:path");
import { BaseModel } from "./BaseModel.js";
import abortController from '../utils/abortController.js';

const families = ["Turdidae", "Parulidae", "Passerellidae", "Cardinalidae", "Ardeidae", "Charadriidae", "Regulidae", "Scolopacidae", "Icteridae", "Cuculidae", "Motacillidae",  "Calcariidae",  "Sittidae", "Laridae", "Corvidae", "Recurvirostridae", "Alaudidae", "Bombycillidae","Haematopodidae"];
const species = ["amered", "amtspa", "bawwar", "btbwar", "camwar", "chispa", "chswar", "comyel", "daejun", "gycthr", "herthr", "norpar", "ovenbi1", "robgro", "savspa", "swathr", "veery", "whtspa", "woothr", "whcspa", "canwar", "graspa", "indbun", "wlswar", "boboli", "norwat", "palwar", "mouwar", "yerwar", "clcspa", "hoowar", "lecspa", "fiespa", "scatan", "yebcuc", "bkbcuc", "bcnher", "vesspa", "leabit", "uplsan", "amebit", "grnher", "macwar", "dickci", "amepip", "amerob", "greyel", "leasan", "semplo", "shbdow", "sposan", "solsan", "laplon", "rebnut", "babwar", "bkpwar", "btnwar", "magwar", "naswar", "tenwar", "balori", "bicthr", "bkbplo", "bkbwar", "bknsti", "blkski", "blugrb1", "brespa", "btywar", "buwwar", "caster1", "cerwar", "comter", "conwar", "easmea", "forter", "foxspa", "gockin", "gocspa", "gowwar", "grbher3", "greegr", "henspa", "harspa", "herwar", "horlar", "kenwar", "killde", "kirwar", "lazbun", "larspa", "lesyel", "linspa", "lobcur", "lobdow", "nstspa", "orcori", "orcwar", "paibun", "pinwar", "prawar", "prowar", "sander", "seaspa", "smilon", "snobun", "sonspa", "sprpip", "sumtan", "swawar", "towwar", "wesmea", "whimbr", "willet1", "wilsni1", "woewar1", "ycnher", "yelwar", "yetwar", "swaspa", "virwar", "triher", "grawar", "cedwax", "amgplo", "ameavo", "ameoys", "baisan", "blkoys", "dunlin"];
const orders = ["Passeriformes", "Charadriiformes", "Pelecaniformes", "Cuculiformes"];
const groups = ["CUPS", "SWLI", "SFHS", "HSSP", "SBUF", "DESP", "DEWA", "BUNT", "GROS", "THSH", "GCBI", "ZEEP", "DBUP", "BZWA", "CCBRS", "MWAR", "TANA"];

const allEntries = [...families, ...species, ...orders, ...groups];
onmessage = async (e) => {
  const data = e.data;
  const modelRequest = data.message;
  const worker = data.worker;
  let response;
  try {
    switch (modelRequest) {
      case "change-batch-size": {
        Model.warmUp(data.batchSize);
        Model.batchSize = data.batchSize;
        break;
      }
      case "load": {
        const version = data.model;
        DEBUG && console.log("load request to worker");
        let appPath = data.modelPath;
        const calibrations = loadCalibrations(path.join(appPath,"probability_calibrations.csv"));
        const batch = data.batchSize;
        const backend = BACKEND || data.backend;
        BACKEND = backend;
        LOCALE  = e.data.locale; // for error messages
        DEBUG && console.log(`Using backend: ${backend}`);
        backend === "webgpu" && require("@tensorflow/tfjs-backend-webgpu");
        let labels;
        const labelFile =  path.join(appPath, 'labels.txt');
        const fileContents = fs.readFileSync(labelFile, 'utf-8');
        labels = fileContents.trim().split(/\r?\n/);
        DEBUG &&
          console.log(
            `Model received load instruction. Using batch size ${batch}`
          );

        tf.setBackend(backend).then(async () => {
          tf.enableProdMode();
          if (DEBUG) {
            console.log(tf.env());
            console.log(tf.env().getFlags());
          }
          Model = new NightHawkModel(appPath, version);
          Model.UUID = data.UUID
          Model.labels = labels;
          Model.batchSize = batch;
          Model.calibrators = calibrations;

          try {
            await Model.loadModel("graph");

            await Model.warmUp();
            BACKEND = tf.getBackend();
            postMessage({
              message: "model-ready",
              sampleRate: Model.config.sampleRate,
              chunkLength: Model.chunkLength,
              backend: BACKEND,
              labels,
              worker,
            });
          } catch (error) {
            console.error("Error loading model:", error);
            postMessage({
              message: "model-error",
              error,
            });
          }
        });
        break;
      }

      case "predict": {
        if (Model?.model_loaded) {
          const {
            chunks,
            start,
            fileStart,
            file,
            worker,
            context,
            resetResults,
            id
          } = data;
          Model.useContext = context;
          Model.selection = !resetResults;
          const result = await Model.predictChunk(chunks, start);
          const response = {
            message: "prediction",
            id,
            file,
            result,
            fileStart,
            worker,
            selection: Model.selection,
          };
          postMessage(response);
          Model.result = [];
        }
        break;
      }
      case "terminate": {
        abortController.abort();
        tf.backend().dispose();
        self.close(); // Terminate the worker
      }
    }
  } catch (error) {
    // If worker was respawned
    console.error(error);
  }
};

class NightHawkModel extends BaseModel {
  constructor(appPath, version) {
    super(appPath, version);
    this.config = { sampleRate: 22_050, specLength: 1, sigmoid: 1 };
    this.chunkLength = this.config.sampleRate * this.config.specLength;
  }

  async warmUp() {

    DEBUG && console.log("WarmUp begin", tf.memory().numTensors);
    const input = tf.zeros(this.inputShape);

    // Parallel compilation for faster warmup
    // https://github.com/tensorflow/tfjs/pull/7755/files#diff-a70aa640d286e39c922aa79fc636e610cae6e3a50dd75b3960d0acbe543c3a49R316
    if (tf.getBackend() === "webgpu") {
      const compileRes = this.model.predict(input);
      await tf.backend().checkCompileCompletionAsync();
      tf.dispose(compileRes);
    } else {
      // Tensorflow backend
      // const compileRes = this.model.predict(input);
      // tf.dispose(compileRes);
    }
    input.dispose();
    DEBUG && console.log("WarmUp end", tf.memory().numTensors);
    return true;
  }

  applyCalibration(output) {

    for (const [i, entry] of output.entries()) {
      const column = allEntries[i];
      if (this.calibrators[column]) {
        output[i] = this.calibrators[column].predict(entry);
      } else {
        DEBUG && console.log(`Calibrator for ${column} not found; not calibrating this taxon`);
      }
    }
    return output;
  }

  async predictBatch(audio, keys) {
    const raw = await tf.tidy(() => {
      // Map predict over each item in the batch [batch, input] -> per-item [input]
      const audioSlices = tf.unstack(audio, 0); 
      return  audioSlices.map((singleAudio) => {
        return tf.sigmoid(tf.concat(this.model.predict(singleAudio), -1));
      });
    });
    audio.dispose();
    const batchedResults = await Promise.all(raw.map(r => r.data()));
    const calibratedResults = batchedResults.map(result => this.applyCalibration(result));
    raw.forEach(t => t.dispose());
    
    const probsBatch = calibratedResults.map(r => ({family: r.slice(0, 19), species: r.slice(19, 149), order: r.slice(149, 153), group: r.slice(153, 170)}));

    
    
    if (this.selection) {
      keys = keys.slice(0, 1);
    }

    keys = keys.map(
      key => Math.round((key / this.config.sampleRate) * 10000) / 10000
    );

    const adjustedBatchSize = keys.length;
    const topN = this.topN;

    const reshapedIndices = [];
    const reshapedValues = [];
    for (let i = 0; i < adjustedBatchSize; i++) {
      const arr = probsBatch[i].species;

      const topValues = [];
      const topIndices = [];

      for (let j = 0; j < arr.length; j++) {
        const v = arr[j];
        if (Number.isNaN(v)) continue;

        let pos = topValues.findIndex(x => v > x);
        if (pos === -1 && topValues.length < 5) pos = topValues.length;

        if (pos !== -1) {
          topValues.splice(pos, 0, v);
          topIndices.splice(pos, 0, j);
          if (topValues.length > 5) {
            topValues.pop();
            topIndices.pop();
          }
        }
      }

      reshapedValues.push(topValues);
      reshapedIndices.push(topIndices);
    }

    return [keys, reshapedIndices, reshapedValues];
  }
}


function loadCalibrations(csvFilePath) {
  const contents = fs.readFileSync(csvFilePath, "utf8");

  const lines = contents.trim().split("\n").slice(1);
  const triples = lines.map(line => line.split(","));

  const result = {};

  for (const [taxon, a, b] of triples) {
    result[taxon] = new SigmoidProbabilityCalibration(
      parseFloat(a),
      parseFloat(b)
    );
  }

  return result;
}

class SigmoidProbabilityCalibration {
  /**
   * Sigmoid probability calibration.
   *
   * Equivalent to the scikit-learn sigmoid calibration:
   * https://scikit-learn.org/stable/modules/calibration.html#sigmoid
   */
  constructor(a, b) {
    this._a = a;
    this._b = b;
  }

  predict(x) {
    return 1 / (1 + Math.exp(this._a * x + this._b));
  }
}

