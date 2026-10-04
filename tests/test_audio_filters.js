#!/usr/bin/env node
/**
 * Runs every audio filter option through an FFmpeg export using the app's real
 * setupFfmpegCommand (fluent-ffmpeg, .audioFilters() => -af), across several
 * input files, sample rates and output codecs, and logs the ones that fail.
 *
 * Requires fluent-ffmpeg: put this file in your project folder, or run with
 *   NODE_PATH=/path/to/project/node_modules node test-audio-filters.js
 *
 * Usage:
 *   node test-audio-filters.js                         # synthetic wav sources at 4 rates
 *   node test-audio-filters.js --input=/path/bad.wav   # YOUR file(s), comma-separated
 *   node test-audio-filters.js --input=a.mp3 --sources=all   # real files + all synthetic variants
 *   node test-audio-filters.js --input=bad.wav --clip=5453,5469   # exact clip (seconds) for the default cases
 *   node test-audio-filters.js --sources=all           # synthetic: mono, s24, s32, float, mp3, flac, aac, opus, bat-like
 *   node test-audio-filters.js --full                  # full cross-product of options (slow)
 *   node test-audio-filters.js --rates=48000,256000 --formats=mp3,flac
 *   node test-audio-filters.js --rate-mode=always      # see below
 *   node test-audio-filters.js --verbose               # print the ffmpeg command for every case
 *   node test-audio-filters.js --quiet                 # only failures + summary
 *   node test-audio-filters.js --keep                  # keep temp files
 *   (default)  uses the project's @ffmpeg-installer/ffmpeg, i.e. the app's own binary, if it can be loaded
 *   node test-audio-filters.js --system-ffmpeg         # use "ffmpeg" from PATH instead
 *   node test-audio-filters.js --ffmpeg=/path/to/ffmpeg   # or FFMPEG=/path/to/ffmpeg
 *
 * --rate-mode controls the sampleRate passed to setupFfmpegCommand:
 *   clamp  (default) undefined, unless the input rate exceeds the codec maximum
 *   app    always undefined (source extension differs from the target format)
 *   always the (clamped) rate is always passed, which appends aresample=<rate>
 *          after the filters (source extension == target format)
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

let ffmpeg;
try {
  ffmpeg = require("fluent-ffmpeg");
} catch {
  console.error(
    "Cannot load fluent-ffmpeg. Put this script in your project folder, or set NODE_PATH to your project's node_modules."
  );
  process.exit(2);
}

// Accepts both `--flag=value` and `--flag value` for flags that take a value.
const VALUE_FLAGS = new Set(["input", "clip", "rate-mode", "rates", "formats", "sources", "model", "timeout", "ffmpeg"]);
const args = {};
{
  const argv = process.argv.slice(2);
  for (let n = 0; n < argv.length; n++) {
    const a = argv[n];
    if (!a.startsWith("--")) continue;
    const [k, ...rest] = a.slice(2).split("=");
    if (rest.length) args[k] = rest.join("=");
    else if (VALUE_FLAGS.has(k) && argv[n + 1] !== undefined && !argv[n + 1].startsWith("--")) args[k] = argv[++n];
    else args[k] = true;
  }
}
for (const k of VALUE_FLAGS) {
  if (args[k] === true) {
    console.error(`--${k} needs a value, e.g. --${k}=<value>`);
    process.exit(2);
  }
}

// ---------------------------------------------------------------------------
// Which ffmpeg binary? Priority: --ffmpeg=<path> > FFMPEG env var > the app's own binary
// (@ffmpeg-installer/ffmpeg from your project) > "ffmpeg" on PATH.
// Pass --system-ffmpeg to skip the app's binary and use the one on PATH.
// The SAME binary is given to fluent-ffmpeg (setFfmpegPath) and used by this script's own helpers.
// ---------------------------------------------------------------------------
function resolveFfmpeg() {
  if (args.ffmpeg) return args.ffmpeg;
  if (process.env.FFMPEG) return process.env.FFMPEG;
  if (!args["system-ffmpeg"]) {
    try {
      let p = require("@ffmpeg-installer/ffmpeg").path;
      if (p.includes("app.asar") && !p.includes("app.asar.unpacked")) p = p.replace("app.asar", "app.asar.unpacked");
      return p;
    } catch (e) {
      console.log(`Note: @ffmpeg-installer/ffmpeg not found (${e.code || e.message}); using "ffmpeg" from PATH.`);
    }
  }
  return "ffmpeg";
}
const FFMPEG = resolveFfmpeg();
ffmpeg.setFfmpegPath(FFMPEG); // always tell fluent-ffmpeg, so exports use the binary we think they do

const RATES = (args.rates || "44100,48000,96000,256000").split(",").map(Number);
const RATE_MODE = args["rate-mode"] || "clamp";
const TIMEOUT_S = Number(args.timeout) || 120; // per-export timeout (seconds)
const CLIP_START = 1; // seconds (mimics padding: start = start - 1)
const CLIP_END = 5; // default clip is 4 s long
const SOURCE_DURATION = 6;

// Stub for the app's global state (non-bat model, so the sinc/afir branch is used)
const STATE = { model: args.model || "" };

// ---------------------------------------------------------------------------
// Output formats (mirrors formatMap in bufferToAudio)
// ---------------------------------------------------------------------------
const FORMATS = {
  mp3: { codec: "libmp3lame", ext: "mp3", fmt: "mp3", maxRate: 48000, bitrate: 128 },
  aac: { codec: "aac", ext: "m4a", fmt: "mp4", maxRate: 96000, bitrate: 128 },
  wav16: { codec: "pcm_s16le", ext: "wav", fmt: "wav", maxRate: Infinity },
  wav24: { codec: "pcm_s24le", ext: "wav", fmt: "wav", maxRate: Infinity },
  wav32: { codec: "pcm_s32le", ext: "wav", fmt: "wav", maxRate: Infinity },
  flac: { codec: "flac", ext: "flac", fmt: "flac", maxRate: Infinity, quality: 5 },
  opus: { codec: "libopus", ext: "opus", fmt: "opus", maxRate: 48000, bitrate: 96 },
};
const FORMAT_NAMES = (args.formats ? args.formats.split(",") : Object.keys(FORMATS)).filter(
  (f) => FORMATS[f]
);

// ---------------------------------------------------------------------------
// setupFfmpegCommand: copied from the app. Only changes:
//  - the batpack asetrate branch is omitted (needs ./models/training.js)
//  - DEBUG logging and the built-in "error" listener are removed (the test
//    attaches its own listeners)
// ---------------------------------------------------------------------------
const setupFfmpegCommand = async ({
  file,
  start = 0,
  end = undefined,
  sampleRate = undefined,
  channels = 1,
  format = "s16le",
  additionalFilters = [],
  metadata = {},
  audioCodec = null,
  audioBitrate = null,
  audioQuality = null,
  outputOptions = [],
}) => {
  const command = ffmpeg("file:" + file).format(format);
  if (channels) command.audioChannels(channels);
  const training = false;
  let duration = end - start;
  if (training && sampleRate !== 240_000) duration *= 10;

  additionalFilters.forEach((filter) => command.audioFilters(filter));

  if (Object.keys(metadata).length) {
    metadata = Object.entries(metadata).flatMap(([k, v]) => {
      if (typeof v === "string") v = v.replaceAll(" ", "_");
      return ["-metadata", `${k}=${v}`];
    });
    command.addOutputOptions(metadata);
  }

  sampleRate && command.audioFilters([`aresample=${sampleRate}`]);
  if (audioCodec) command.audioCodec(audioCodec);
  if (audioBitrate) command.audioBitrate(audioBitrate);
  if (audioQuality) command.audioQuality(audioQuality);
  if (outputOptions.length) command.addOutputOptions(...outputOptions);

  command.seekInput(start).duration(duration);
  return command;
};

// ---------------------------------------------------------------------------
// Filter builder: same logic as setAudioFilters, parametrised so we can vary it
// ---------------------------------------------------------------------------
/**
 * opts:
 *   hp, lp           high-pass / low-pass cutoff (Hz, 0 = off)
 *   sincRate         'matched' (r = input rate) | 'default' (omit r)
 *   shelfF, shelfAtt low shelf frequency / gain (0 = off)
 *   gain             dB (0 = off)
 *   loudnorm         'none' | 'raw' (as in app) | 'resampled' (adds aresample after)
 *                    | 'pinned' (adds aformat=channel_layouts=mono|stereo straight after it)
 *   fade             'none' | 'app' (as in app) | 'fixed' (st=0 and st=dur-1)
 *   pin              true to append aresample + aformat at the end of the chain
 *   meta             true to pass -metadata options
 *   clip             'default' | 'pastEnd' (clip runs beyond EOF) | 'short' (0.5 s)
 */
function buildFilters(opts, ctx) {
  const { codec, inRate, outRate, downmix, clipStart, clipEnd } = ctx;
  const useAdvanced = !["pcm_s32le", "pcm_s24le"].includes(codec);
  const batModel = STATE.model.includes("batpack");
  const filters = [];

  if (!batModel && (opts.hp || (opts.lp > 0 && opts.lp < 15000))) {
    const o = {};
    if (opts.sincRate === "matched") o.r = inRate;
    if (opts.hp) o.hp = opts.hp;
    if (opts.lp && opts.lp < 15000) o.lp = opts.lp;
    filters.push(
      { filter: "sinc", options: { ...o, att: 80 }, outputs: "ir" },
      { filter: "afir", inputs: ["a", "ir"] }
    );
  }
  if (opts.shelfF && opts.shelfAtt) {
    filters.push({ filter: "lowshelf", options: `gain=${opts.shelfAtt}:f=${opts.shelfF}` });
  }
  if (opts.gain > 0) {
    filters.push({ filter: "volume", options: `volume=${opts.gain}dB` });
  }
  if (opts.loudnorm !== "none" && useAdvanced) {
    filters.push({ filter: "loudnorm", options: "TP=-3.0" });
    if (opts.loudnorm === "resampled") {
      filters.push({ filter: "aresample", options: String(outRate) });
    }
    if (opts.loudnorm === "pinned") {
      filters.push({ filter: "aformat", options: "channel_layouts=mono|stereo" });
    }
  }
  if (opts.fade === "app") {
    filters.push(
      { filter: "afade", options: `t=in:ss=${clipStart}:d=1` },
      { filter: "afade", options: `t=out:st=${clipEnd - clipStart - 1}:d=1` }
    );
  } else if (opts.fade === "fixed") {
    filters.push(
      { filter: "afade", options: "t=in:st=0:d=1" },
      { filter: "afade", options: `t=out:st=${clipEnd - clipStart - 1}:d=1` }
    );
  }
  if (opts.pin && filters.length) {
    filters.push(
      { filter: "aresample", options: String(outRate) },
      {
        filter: "aformat",
        options: `sample_fmts=fltp|s16|s32|flt:channel_layouts=${downmix ? "mono" : "stereo"}`,
      }
    );
  }
  return filters;
}

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------
const BASE = {
  hp: 0, lp: 0, sincRate: "matched", shelfF: 0, shelfAtt: 0, gain: 0,
  loudnorm: "none", fade: "none", pin: false, downmix: false, meta: false, clip: "default",
  rate: null, // per-case override of --rate-mode
};
const ALL_APP = {
  hp: 2000, lp: 12000, sincRate: "default", shelfF: 1000, shelfAtt: -12, gain: 6,
  loudnorm: "raw", fade: "app", downmix: true,
};

function isolateCases() {
  return [
    ["baseline (no filters)", {}],
    ["highpass 2 kHz (sinc r=input)", { hp: 2000 }],
    ["lowpass 12 kHz (sinc r=input)", { lp: 12000 }],
    ["highpass+lowpass (sinc r=input)", { hp: 2000, lp: 12000 }],
    ["highpass 2 kHz (sinc default r=44100)", { hp: 2000, sincRate: "default" }],
    ["lowpass 12 kHz (sinc default r=44100)", { lp: 12000, sincRate: "default" }],
    ["highpass+lowpass (sinc default r=44100)", { hp: 2000, lp: 12000, sincRate: "default" }],
    ["low shelf", { shelfF: 1000, shelfAtt: -12 }],
    ["gain +6 dB", { gain: 6 }],
    ["loudnorm (raw, as in app)", { loudnorm: "raw" }],
    ["loudnorm + aresample back", { loudnorm: "resampled" }],
    ["loudnorm + layout pin (aformat)", { loudnorm: "pinned" }],
    ["FAILING CHAIN: gain+loudnorm+fade+trailing aresample (as in app)", { gain: 4, loudnorm: "raw", fade: "app", rate: "always" }, true],
    ["FAILING CHAIN with layout pin after loudnorm", { gain: 4, loudnorm: "pinned", fade: "app", rate: "always" }, true],
    ["fade (as in app: ss=start)", { fade: "app" }],
    ["fade (fixed: st=0)", { fade: "fixed" }],
    ["downmix to mono", { downmix: true }],
    ["pinned tail (aresample+aformat) + gain", { gain: 6, pin: true }],
    ["metadata only", { meta: true }],
    ["clip past end of file, no filters", { clip: "pastEnd" }],
    ["clip past end of file, loudnorm", { clip: "pastEnd", loudnorm: "raw" }],
    ["clip past end of file, highpass", { clip: "pastEnd", hp: 2000 }],
    ["very short clip (0.5 s), loudnorm", { clip: "short", loudnorm: "raw" }],
    ["very short clip (0.5 s), highpass+lowpass", { clip: "short", hp: 2000, lp: 12000 }],
    ["ALL ON (as in app)", { ...ALL_APP }],
    ["ALL ON (as in app) + metadata", { ...ALL_APP, meta: true }],
    ["ALL ON (as in app), clip past end, no fade", { ...ALL_APP, fade: "none", clip: "pastEnd" }],
    ["ALL ON (as in app), 0.5 s clip, no fade", { ...ALL_APP, fade: "none", clip: "short" }],
    [
      "ALL ON (all fixes)",
      { ...ALL_APP, sincRate: "matched", loudnorm: "resampled", fade: "fixed", pin: true },
    ],
  ].map(([name, o, show]) => ({ name, show: !!show, opts: { ...BASE, ...o } }));
}

function fullCases() {
  const cases = [];
  for (const hp of [0, 2000])
    for (const lp of [0, 12000])
      for (const shelf of [false, true])
        for (const gain of [0, 6])
          for (const loudnorm of ["none", "raw", "resampled"])
            for (const fade of ["none", "app", "fixed"])
              for (const downmix of [false, true]) {
                const opts = {
                  ...BASE, hp, lp, gain, loudnorm, fade, downmix,
                  shelfF: shelf ? 1000 : 0, shelfAtt: shelf ? -12 : 0,
                };
                const name =
                  `hp=${hp} lp=${lp} shelf=${shelf} gain=${gain} ln=${loudnorm} fade=${fade} mono=${downmix}`;
                cases.push({ name, opts });
              }
  return cases;
}

// ---------------------------------------------------------------------------
// Sources (synthetic variants and real files)
// ---------------------------------------------------------------------------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ffmpeg-filter-test-"));

const EXTRA_SPECS = [
  { name: "wav-s16-mono-48000", rate: 48000, layout: "mono", codec: "pcm_s16le", ext: "wav" },
  { name: "wav-s24-stereo-48000", rate: 48000, layout: "stereo", codec: "pcm_s24le", ext: "wav" },
  { name: "wav-s32-stereo-48000", rate: 48000, layout: "stereo", codec: "pcm_s32le", ext: "wav" },
  { name: "wav-float-stereo-48000", rate: 48000, layout: "stereo", codec: "pcm_f32le", ext: "wav" },
  { name: "mp3-stereo-44100", rate: 44100, layout: "stereo", codec: "libmp3lame", ext: "mp3" },
  { name: "flac-stereo-48000", rate: 48000, layout: "stereo", codec: "flac", ext: "flac" },
  { name: "aac-m4a-stereo-44100", rate: 44100, layout: "stereo", codec: "aac", ext: "m4a" },
  { name: "opus-stereo-48000", rate: 48000, layout: "stereo", codec: "libopus", ext: "opus" },
  { name: "bat-wav-s24-mono-256000", rate: 256000, layout: "mono", codec: "pcm_s24le", ext: "wav" },
  { name: "bat-flac-mono-256000", rate: 256000, layout: "mono", codec: "flac", ext: "flac" },
];

function makeSynthetic(spec) {
  const file = path.join(tmp, `${spec.name}.${spec.ext}`);
  const D = SOURCE_DURATION;
  const r = spawnSync(
    FFMPEG,
    [
      "-hide_banner", "-y",
      "-f", "lavfi", "-i", `sine=frequency=1000:sample_rate=${spec.rate}:duration=${D}`,
      "-f", "lavfi", "-i", `anoisesrc=color=pink:amplitude=0.2:sample_rate=${spec.rate}:duration=${D}`,
      "-filter_complex", `[0:a][1:a]amix=inputs=2:normalize=0,aformat=channel_layouts=${spec.layout}[o]`,
      "-map", "[o]", "-c:a", spec.codec, file,
    ],
    { encoding: "utf8" }
  );
  if (r.status !== 0) {
    console.log(`SKIP  source ${spec.name}: could not generate (${(r.stderr || "").trim().split(/\r?\n/).pop()})`);
    return null;
  }
  return { name: spec.name, file, rate: spec.rate, duration: D };
}

function probeReal(file) {
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) {
    console.log(`SKIP  input ${file}: file not found`);
    return null;
  }
  const r = spawnSync(FFMPEG, ["-hide_banner", "-i", abs], { encoding: "utf8" });
  const err = r.stderr || "";
  const rate = Number((err.match(/Audio:.*?(\d+) Hz/) || [])[1]);
  const d = err.match(/Duration: (\d+):(\d+):([\d.]+)/);
  const duration = d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : NaN;
  if (!rate || !duration) {
    console.log(`SKIP  input ${file}: could not read sample rate/duration from ffmpeg -i`);
    return null;
  }
  console.log(`INPUT ${path.basename(abs)}: ${rate} Hz, ${duration.toFixed(2)} s`);
  return { name: path.basename(abs), file: abs, rate, duration, real: true };
}

function clipFor(source, kind) {
  if (args.clip && kind === "default") {
    const [s, e] = String(args.clip).split(",").map(Number);
    return { start: s, end: e };
  }
  const start = source.duration > CLIP_END ? CLIP_START : 0;
  // Start 3 s before EOF and ask for 11 s: 3 s of audio, then the clip runs past the end
  if (kind === "pastEnd") return { start: Math.max(0, source.duration - 3), end: source.duration + 8 };
  if (kind === "short") return { start, end: start + 0.5 };
  return { start, end: Math.min(CLIP_END, source.duration) };
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
async function runCase(testCase, formatName, source) {
  const fmt = FORMATS[formatName];
  const inRate = source.rate;
  const clamped = Math.min(inRate, fmt.maxRate);
  let sampleRate;
  const rateMode = testCase.opts.rate || RATE_MODE;
  if (rateMode === "always") sampleRate = clamped;
  else if (rateMode === "clamp" && clamped < inRate) sampleRate = clamped;
  const outRate = sampleRate ?? inRate;

  const { start: clipStart, end: clipEnd } = clipFor(source, testCase.opts.clip);
  const downmix = testCase.opts.downmix;
  const filters = buildFilters(testCase.opts, {
    codec: fmt.codec, inRate, outRate, downmix, clipStart, clipEnd,
  });
  const out = path.join(tmp, `out-${Date.now()}-${Math.random().toString(16).slice(2)}.${fmt.ext}`);

  const command = await setupFfmpegCommand({
    file: source.file,
    start: clipStart,
    end: clipEnd,
    sampleRate,
    channels: downmix ? 1 : 0,
    format: fmt.fmt,
    additionalFilters: filters,
    metadata: testCase.opts.meta
      ? { title: "Test clip", comment: "some text here", species: "Pipistrellus pipistrellus" }
      : {},
    audioCodec: fmt.codec,
    audioBitrate: fmt.bitrate,
    audioQuality: fmt.quality,
  });

  return new Promise((resolve) => {
    let commandLine = "";
    let settled = false;
    const timer = setTimeout(() => {
      try { command.kill("SIGKILL"); } catch {}
      done(false, `Timed out after ${TIMEOUT_S} s`, "", true);
    }, TIMEOUT_S * 1000);

    function done(ok, message, stderr, timeout = false) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const size = fs.existsSync(out) ? fs.statSync(out).size : 0;
      if (!args.keep && fs.existsSync(out)) fs.rmSync(out, { force: true });
      const success = ok && size > 0;
      const tail = (stderr || "").trim().split(/\r?\n/).slice(-6).join("\n");
      resolve({
        ok: success,
        timeout,
        command: commandLine,
        reason: success ? "" : [message, tail].filter(Boolean).join("\n"),
        reinit: /reinitializ/i.test(`${message}\n${stderr}`),
      });
    }

    command.on("start", (cl) => { commandLine = cl; });
    command.on("error", (err, _stdout, stderr) => done(false, err.message, stderr));
    command.on("end", () => done(true, "", ""));
    command.save(out);
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async function main() {
  const probe = spawnSync(FFMPEG, ["-version"], { encoding: "utf8" });
  if (probe.status !== 0) {
    console.error(`Cannot run "${FFMPEG}". Install ffmpeg or set FFMPEG=/path/to/ffmpeg`);
    process.exit(2);
  }
  console.log(`Using ffmpeg binary: ${FFMPEG}`);
  console.log(probe.stdout.split("\n")[0]);
  console.log(`rate mode: ${RATE_MODE}`);

  // Ask fluent-ffmpeg which binary it will really spawn, and run that binary's -version.
  const fluentPath = await new Promise((resolve) => {
    try {
      ffmpeg()._getFfmpegPath((e, p) => resolve(e ? null : p)); // private API, but stable in fluent-ffmpeg 2.x
    } catch { resolve(null); }
  });
  if (fluentPath) {
    const fv = spawnSync(fluentPath, ["-version"], { encoding: "utf8" });
    const fluentVersion = (fv.stdout || "").split("\n")[0] || "(could not run it)";
    console.log(`fluent-ffmpeg will run: ${fluentPath}\n${fluentVersion}`);
    if (fluentVersion !== probe.stdout.split("\n")[0]) {
      console.log("WARNING: fluent-ffmpeg is NOT using the same ffmpeg as this script's helpers. Results may not reflect the binary you intended.");
    }
  } else {
    console.log("(could not determine which binary fluent-ffmpeg will run)");
  }

  // Build the source list
  const sources = [];
  if (args.input) {
    for (const f of String(args.input).split(",")) {
      const s = probeReal(f.trim());
      if (s) sources.push(s);
    }
  }
  if (!args.input || args.sources) {
    const specs = RATES.map((r) => ({
      name: `wav-s16-stereo-${r}`, rate: r, layout: "stereo", codec: "pcm_s16le", ext: "wav",
    }));
    if (args.sources === "all") specs.push(...EXTRA_SPECS);
    for (const spec of specs) {
      const s = makeSynthetic(spec);
      if (s) sources.push(s);
    }
  }
  if (!sources.length) {
    console.error("No usable sources.");
    process.exit(2);
  }

  const cases = args.full ? fullCases() : isolateCases();
  const encoders = spawnSync(FFMPEG, ["-hide_banner", "-encoders"], { encoding: "utf8" }).stdout || "";
  const total = cases.length * FORMAT_NAMES.length * sources.length;
  console.log(
    `Running up to ${total} exports (${cases.length} cases x ${FORMAT_NAMES.length} formats x ${sources.length} sources)\n`
  );

  const failures = [];
  const timeouts = [];
  let passed = 0, skipped = 0, i = 0;

  for (const source of sources) {
    for (const formatName of FORMAT_NAMES) {
      const fmt = FORMATS[formatName];
      if (!encoders.includes(` ${fmt.codec} `)) {
        console.log(`SKIP  ${formatName} <- ${source.name}: encoder ${fmt.codec} not available in this ffmpeg build`);
        skipped += cases.length;
        i += cases.length;
        continue;
      }
      for (const c of cases) {
        i++;
        const result = await runCase(c, formatName, source);
        const label = `[${i}/${total}] ${source.name} -> ${formatName} | ${c.name}`;
        if (result.ok) {
          passed++;
          if (!args.quiet) console.log(`PASS  ${label}`);
        } else if (result.timeout) {
          timeouts.push({ label, ...result });
          console.log(`TIMEOUT ${label}  (not counted as a failure; try --timeout=<seconds>)`);
        } else {
          failures.push({ label, formatName, source: source.name, name: c.name, ...result });
          console.log(`FAIL  ${label}${result.reinit ? "  <-- Error reinitializing filters" : ""}`);
        }
        if ((args.verbose || c.show) && result.command) console.log(`      ${result.command}`);
      }
    }
  }

  console.log("\n==================== SUMMARY ====================");
  console.log(`passed: ${passed}   failed: ${failures.length}   timeouts: ${timeouts.length}   skipped: ${skipped}`);

  if (failures.length) {
    const byCase = {};
    for (const f of failures) (byCase[f.name] ||= []).push(`${f.source}->${f.formatName}`);
    console.log("\nFailures grouped by filter case:");
    for (const [name, where] of Object.entries(byCase)) {
      console.log(`  - ${name}\n      ${where.length} failing combos: ${where.slice(0, 8).join(", ")}${where.length > 8 ? ", ..." : ""}`);
    }

    const bySource = {};
    for (const f of failures) bySource[f.source] = (bySource[f.source] || 0) + 1;
    console.log("\nFailure count by source:");
    for (const [s, n] of Object.entries(bySource)) console.log(`  - ${s}: ${n}`);

    const reportFile = path.join(process.cwd(), "audio-filter-failures.log");
    const report = failures
      .map((f) => `### ${f.label}\ncommand: ${f.command}\n${f.reason}\n`)
      .join("\n");
    fs.writeFileSync(reportFile, report);
    console.log(`\nFull commands and stderr tails written to: ${reportFile}`);
    console.log("\nFirst failure detail:\n" + failures[0].label + "\n" + failures[0].command + "\n" + failures[0].reason);
  }

  if (!args.keep) fs.rmSync(tmp, { recursive: true, force: true });
  else console.log(`\nTemp files kept in ${tmp}`);
  process.exit(failures.length ? 1 : 0);
})();