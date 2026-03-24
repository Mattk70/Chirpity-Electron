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
        const calibrations = loadCalibrations();
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


function loadCalibrations() {
  const contents = calibrate;

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

const calibrate = `
Taxon,A,B
Alaudidae,-13.61189508,6.2395645
Ardeidae,-11.60799915,6.469435749
BUNT,-12.64434587,7.561694854
BZWA,-10.4652217,6.387494553
Bombycillidae,-11.40722241,8.752695157
CCBRS,-11.35822905,8.343813939
CUPS,-11.61254063,7.083250757
Calcariidae,-14.0209944,7.03930388
Cardinalidae,-11.14482252,5.900179111
Charadriidae,-14.57010122,6.655539769
Charadriiformes,-9.106400434,5.135464356
Cuculidae,-12.61988808,7.486667671
Cuculiformes,-12.54290113,7.542594544
DBUP,-9.29602938,6.182989109
DESP,-12.4419138,7.620436838
DEWA,-18.32748457,6.474623048
GCBI,-16.47346074,7.935086362
GROS,-13.66218907,6.877472181
HSSP,-12.10760574,5.980929176
Haematopodidae,-10.63077156,7.861189861
Icteridae,-23.67128795,7.051080245
Laridae,-10.86853412,7.533421691
MWAR,-14.06979663,6.895138425
Motacillidae,-10.61999236,7.908605253
Parulidae,-12.16248155,9.071930891
Passerellidae,-10.48433699,5.064271682
Passeriformes,-10.79544618,7.239506856
Pelecaniformes,-11.09919515,6.515917152
Recurvirostridae,-7.904490213,7.292886461
Regulidae,-11.0544333,8.193630931
SBUF,-8.912054963,6.115264488
SFHS,-11.76640283,7.151548746
SWLI,-13.31330304,7.465518601
Scolopacidae,-10.88654711,5.434367141
Sittidae,-12.04163474,7.885347838
TANA,-23.62251853,7.061389665
THSH,-8.862908304,5.974490272
Turdidae,-8.939725105,5.765358144
ZEEP,-10.05668307,6.792691184
ameavo,-15.74646784,7.378643705
amebit,-13.88946897,7.977824072
ameoys,-15.48092465,8.522728328
amepip,-11.17702057,7.707967476
amered,-10.38737634,8.151437519
amerob,-24.77334576,8.33201095
amgplo,-39.58040954,8.233013341
amtspa,-13.24583921,6.288409644
babwar,-98.2325104,6.466064255
baisan,-136.5574285,8.045487364
balori,-79.23378578,8.108812191
bawwar,-23.13713116,6.895067191
bcnher,-21.34651772,7.723747174
bicthr,0,10.73173365
bkbcuc,-19.29144618,8.517738927
bkbplo,-15.5113663,9.987965952
bkbwar,-1348.688769,8.833104466
bknsti,-9.815313847,8.389679722
bkpwar,-84.1182197,6.690999174
blkoys,-14.74510551,7.155604267
blkski,-17.74816973,9.10126443
blugrb1,-24.80913607,8.689123305
boboli,-17.98534322,6.72945751
brespa,-338.8558905,9.975570887
btbwar,-10.40740875,7.711568767
btnwar,-9.318112894,6.566633589
btywar,-0.00027404,10.2182294
buwwar,-214.1620688,8.028116688
camwar,-22.69386285,6.494251401
canwar,-13.2878597,7.032893384
caster1,-10.58647283,7.318612477
cedwax,-11.5180824,8.556511722
cerwar,0,10.73173365
chispa,-10.83968065,7.642171706
chswar,-12.08839996,8.599440801
clcspa,-10.61867798,8.165543361
comter,0,10.73173365
comyel,-23.58744605,6.947422807
conwar,-0.001938744,9.267093538
daejun,-12.01200915,6.20160415
dickci,-13.81040094,7.62780695
dunlin,-0.000343255,7.017138837
easmea,0,10.73173365
fiespa,-16.40364466,7.95190024
forter,0,10.73173365
foxspa,-37.21324778,8.205839759
gockin,-15.631175,8.050970838
gocspa,-10.90681302,7.898656598
gowwar,0,10.73173365
graspa,-13.92826705,7.443819945
grawar,-32.66203822,7.642515506
grbher3,-19.45793906,7.413866963
greegr,-28.03764112,8.699850323
greyel,-16.35076886,7.478697622
grnher,-17.36878871,6.991510617
gycthr,-21.44718268,8.052786251
harspa,0,10.73173365
henspa,-221.208795,9.681803742
herthr,-20.60303967,6.75482629
herwar,0,10.73173365
hoowar,-11.84393999,8.280904788
horlar,-17.3162824,6.147288991
indbun,-12.39407018,7.531845455
kenwar,0,10.73173365
killde,-19.98652522,6.85851777
kirwar,0,10.73173365
laplon,-25.7601932,6.489894213
larspa,0,10.73173365
lazbun,-74.25353359,7.545685552
leabit,-27.73260294,8.479362451
leasan,-23.57784701,6.943589656
lecspa,-11.05125499,9.090796699
lesyel,-27.43961876,7.306543853
linspa,-19.31182619,9.977952283
lobcur,-24.15478355,6.864575356
lobdow,-16.10350892,8.577641686
macwar,-24.82421419,7.817666982
magwar,-9.447197525,8.414691216
mouwar,-13.75771785,7.274775943
naswar,-13.18733206,7.055960723
norpar,-17.50811878,6.602622267
norwat,-24.6873514,7.979546026
nstspa,-0.00170381,8.901621563
orcori,0,10.73173365
orcwar,-0.007449335,7.951918074
ovenbi1,-10.20293334,5.840120295
paibun,0,10.73173365
palwar,-22.43758716,5.894861704
pinwar,-351.3979257,7.834672559
prawar,-228.7592923,8.134601861
prowar,-234.2083191,9.814862679
rebnut,-14.06913152,7.766831987
robgro,-14.9043621,6.904466132
sander,-76.08477444,10.18801228
savspa,-14.35671668,7.825233747
scatan,-23.20670428,6.798956351
seaspa,0,10.73173365
semplo,-13.22902559,8.908338762
shbdow,-17.32746479,7.154893139
smilon,-229.02971,8.206567705
snobun,-8.858824125,7.662237658
solsan,-12.88298977,9.166876591
sonspa,-21.83226678,6.567715331
sposan,-14.52469293,6.806163588
sprpip,-14.23896593,9.742950497
sumtan,0,10.73173365
swaspa,-11.06160468,8.668658126
swathr,-8.696510789,6.636390044
swawar,-0.001811261,9.81531853
tenwar,-66.52826042,6.957252182
towwar,-0.003548083,8.754532104
triher,-23.40861522,8.99124185
uplsan,-15.62831894,8.005106076
veery,-11.65299612,6.413887323
vesspa,-22.84935458,6.221359306
virwar,-80.54990152,8.904206692
wesmea,-0.00040494,9.266235787
whcspa,-15.52736967,7.092256415
whimbr,-65.37437999,7.978894326
whtspa,-14.11001802,7.528452591
willet1,-19.00105903,8.744840557
wilsni1,-26.72890704,10.81270819
wlswar,-12.73435263,7.270398875
woewar1,0,10.73173365
woothr,-22.89709384,6.295358532
ycnher,-63.2021545,8.385940994
yebcuc,-15.24889363,7.361624506
yelwar,-147.2044912,8.103748999
yerwar,-8.319406266,6.925477648
yetwar,0,10.73173365
`