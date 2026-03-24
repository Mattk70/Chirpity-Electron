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
const allCategories = [...species, ...groups, ...families, ...orders]; // heaven knows why i did the calibration based on the order of allEntries, but this is for formating the results
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
            confidence,
            resetResults,
            id,
            batchIndex
          } = data;
          Model.confidence = confidence / 1000;
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
            batchIndex
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
    const raw = tf.tidy(() => {
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
    
    const probsBatch = calibratedResults.map(r => ({
      family: r.slice(0, 19),
      species: r.slice(19, 149),
      order: r.slice(149, 153),
      group: r.slice(153, 170)
    }));

    // 1. For each window, find which taxa exceeded the threshold at each level
    const detections = probsBatch.map(window => {
      const detected = {
        order:   orders.filter((name, i)   => window.order[i]   > this.confidence),
        family:  families.filter((name, i)  => window.family[i]  > this.confidence),
        group:   groups.filter((name, i)   => window.group[i]   > this.confidence),
        species: species.filter((name, i) => window.species[i] > this.confidence),
      };

      const windowDetections = [];
      // 2. Pick the most specific level that is taxonomically consistent
      // Try species first, then group, then family, then order

      for (const sp of detected.species) {
        const spFamily = speciesFamilyMap.get(sp);
        const spGroup  = speciesGroupMap.get(sp);   // may be null
        const spOrder  = familyOrderMap.get(spFamily);

        const familyOk = detected.family.includes(spFamily);
        const orderOk  = detected.order.includes(spOrder);
        const groupOk  = spGroup == null || detected.group.includes(spGroup);

        if (familyOk && orderOk && groupOk) {
          const prob = window.species[species.indexOf(sp)];
          windowDetections.push( { predicted_category: sp, prob, level: 'species' } );
        }
      }
      if (windowDetections.length) return windowDetections;

      for (const grp of detected.group) {
        const grpFamily = groupFamilyMap.get(grp);
        const grpOrder  = familyOrderMap.get(grpFamily);

        if (detected.family.includes(grpFamily) && detected.order.includes(grpOrder)) {
          const prob = window.group[groups.indexOf(grp)];
          windowDetections.push( { predicted_category: grp, prob, level: 'group' });
        }
      }
      if (windowDetections.length) return windowDetections;

      for (const fam of detected.family) {
        const famOrder = familyOrderMap.get(fam);

        if (detected.order.includes(famOrder)) {
          const prob = window.family[families.indexOf(fam)];
          windowDetections.push( { predicted_category: fam, prob, level: 'family' } );
        }
      }
      if (windowDetections.length) return windowDetections;

      for (const ord of detected.order) {
        const prob = window.order[orders.indexOf(ord)];
        windowDetections.push( { predicted_category: ord, prob, level: 'order' });
      }

      return windowDetections.length ? windowDetections : null; // nothing detected in this window
    });

    if (this.selection) {
      keys = keys.slice(0, 1);
    }

    keys = keys.map(
      key => Math.round((key / this.config.sampleRate) * 10000) / 10000
    );

    const adjustedBatchSize = keys.length;

    const reshapedIndices = [];
    const reshapedValues = [];

    for (const [i, windowDets] of detections.entries()) {
      const theseIndices = [];
      const theseValues = [];
      if (i >= adjustedBatchSize) break;
      if (windowDets){
        for (const det of windowDets) {
          theseIndices.push(allCategories.indexOf(det.predicted_category));
          theseValues.push(det.prob);
        }
      }
      reshapedIndices.push(theseIndices);
      reshapedValues.push(theseValues);
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

function createMap(csv){
  const lines = csv.trim().split('\n');
  let map = new Map();
  for (let i = 0; i < lines.length; i++) {
    const [group, species] = lines[i].split(',');
    map.set(species, group);
  }
  return map;
}

const speciesGroups = `
CUPS,chispa
CUPS,amtspa
SWLI,swaspa
SWLI,linspa
SFHS,foxspa
SFHS,sonspa
SFHS,harspa
SFHS,gocspa
SFHS,whtspa
HSSP,graspa
HSSP,vesspa
HSSP,whcspa
HSSP,seaspa
SBUF,yerwar
SBUF,palwar
SBUF,btbwar
SBUF,prowar
SBUF,swawar
SBUF,ovenbi1
SBUF,buwwar
SBUF,gowwar
DESP,fiespa
DESP,nstspa
DESP,sstspa
DESP,lecspa
DESP,henspa
DESP,bacspa
DESP,savspa
DEWA,yetwar
DEWA,norpar
DEWA,pinwar
BUNT,indbun
BUNT,blugrb1
BUNT,paibun
BUNT,lazbun
BUNT,varbun
TANA,scatan
TANA,sumtan
TANA,westan
GROS,robgro
GROS,bkhgro
THSH,veery
THSH,swathr
THSH,woothr
THSH,herthr
GCBI,gycthr
GCBI,bicthr
ZEEP,norwat
ZEEP,louwat
ZEEP,kenwar
ZEEP,magwar
ZEEP,babwar
ZEEP,bkbwar
ZEEP,bkpwar
ZEEP,conwar
ZEEP,yelwar
ZEEP,cerwar
ZEEP,woewar1
ZEEP,camwar
ZEEP,refwar
DBUP,tenwar
DBUP,naswar
DBUP,orcwar
DBUP,btnwar
DBUP,gchwar
DBUP,herwar
DBUP,towwar
DBUP,lucwar
DBUP,virwar
DBUP,colwar
DBUP,grawar
DBUP,btywar
BZWA,chswar
BZWA,kirwar
BZWA,hoowar
BZWA,comyel
BLUEB,easblu
BLUEB,wesblu
BLUEB,moublu
CCBRS,clcspa
CCBRS,brespa
MWAR,macwar
MWAR,mouwar
WITH,dusthr2
WITH,dusthr1
WITH,retthr1
WITH,datthr1`;

const speciesFamilies = `
Parulidae,amered
Passerellidae,amtspa
Parulidae,bawwar
Parulidae,btbwar
Parulidae,camwar
Passerellidae,chispa
Parulidae,chswar
Parulidae,comyel
Passerellidae,daejun
Turdidae,gycthr
Turdidae,herthr
Parulidae,norpar
Parulidae,ovenbi1
Cardinalidae,robgro
Passerellidae,savspa
Turdidae,swathr
Turdidae,veery
Passerellidae,whtspa
Turdidae,woothr
Passerellidae,whcspa
Parulidae,canwar
Passerellidae,graspa
Cardinalidae,indbun
Parulidae,wlswar
Icteridae,boboli
Parulidae,norwat
Parulidae,palwar
Parulidae,mouwar
Parulidae,yerwar
Passerellidae,clcspa
Parulidae,hoowar
Passerellidae,lecspa
Passerellidae,fiespa
Cardinalidae,scatan
Cuculidae,yebcuc
Cuculidae,bkbcuc
Ardeidae,bcnher
Passerellidae,vesspa
Ardeidae,leabit
Scolopacidae,uplsan
Ardeidae,amebit
Ardeidae,grnher
Parulidae,macwar
Cardinalidae,dickci
Motacillidae,amepip
Turdidae,amerob
Scolopacidae,greyel
Scolopacidae,leasan
Charadriidae,semplo
Scolopacidae,shbdow
Scolopacidae,sposan
Scolopacidae,solsan
Calcariidae,laplon
Sittidae,rebnut
Parulidae,babwar
Parulidae,bkpwar
Parulidae,btnwar
Parulidae,magwar
Parulidae,naswar
Parulidae,tenwar
Icteridae,balori
Turdidae,bicthr
Charadriidae,bkbplo
Parulidae,bkbwar
Recurvirostridae,bknsti
Laridae,blkski
Cardinalidae,blugrb1
Passerellidae,brespa
Parulidae,btywar
Parulidae,buwwar
Laridae,caster1
Parulidae,cerwar
Laridae,comter
Parulidae,conwar
Icteridae,easmea
Laridae,forter
Passerellidae,foxspa
Regulidae,gockin
Passerellidae,gocspa
Parulidae,gowwar
Ardeidae,grbher3
Ardeidae,greegr
Passerellidae,henspa
Passerellidae,harspa
Parulidae,herwar
Alaudidae,horlar
Parulidae,kenwar
Charadriidae,killde
Parulidae,kirwar
Cardinalidae,lazbun
Passerellidae,larspa
Scolopacidae,lesyel
Passerellidae,linspa
Scolopacidae,lobcur
Scolopacidae,lobdow
Passerellidae,nstspa
Icteridae,orcori
Parulidae,orcwar
Cardinalidae,paibun
Parulidae,pinwar
Parulidae,prawar
Parulidae,prowar
Scolopacidae,sander
Passerellidae,seaspa
Calcariidae,smilon
Calcariidae,snobun
Passerellidae,sonspa
Motacillidae,sprpip
Cardinalidae,sumtan
Parulidae,swawar
Parulidae,towwar
Icteridae,wesmea
Scolopacidae,whimbr
Scolopacidae,willet1
Scolopacidae,wilsni1
Parulidae,woewar1
Ardeidae,ycnher
Parulidae,yelwar
Parulidae,yetwar
Passerellidae,swaspa
Parulidae,virwar
Ardeidae,triher
Parulidae,grawar
Bombycillidae,cedwax
Charadriidae,amgplo
Recurvirostridae,ameavo
Haematopodidae,ameoys
Scolopacidae,baisan
Haematopodidae,blkoys
Scolopacidae,dunlin`;

const familyOrders = `
Passeriformes,Turdidae
Passeriformes,Parulidae
Passeriformes,Passerellidae
Passeriformes,Cardinalidae
Pelecaniformes,Ardeidae
Charadriiformes,Charadriidae
Passeriformes,Regulidae
Charadriiformes,Scolopacidae
Passeriformes,Icteridae
Cuculiformes,Cuculidae
Passeriformes,Motacillidae
Passeriformes,Calcariidae
Passeriformes,Sittidae
Charadriiformes,Laridae
Passeriformes,Corvidae
Charadriiformes,Recurvirostridae
Passeriformes,Alaudidae
Passeriformes,Bombycillidae
Charadriiformes,Haematopodidae
`;

const groupFamilies = `
Passerellidae,CUPS
Passerellidae,SWLI
Passerellidae,SFHS
Passerellidae,HSSP
Passerellidae,SBUF
Passerellidae,DESP
Passerellidae,DEWA
Passerellidae,BUNT
Passerellidae,TANA
Passerellidae,GROS
Passerellidae,GCBI
Parulidae,ZEEP
Parulidae,DBUP
Parulidae,BZWA
Parulidae,BLUEB
Parulidae,CCBRS
Parulidae,MWAR
Parulidae,WITH
Turdidae,THSH
`;

const groupFamilyMap =  createMap(groupFamilies)
const speciesGroupMap = createMap(speciesGroups)
const speciesFamilyMap = createMap(speciesFamilies)
const familyOrderMap = createMap(familyOrders)