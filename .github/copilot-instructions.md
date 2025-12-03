<!-- Copilot/AI agent instructions tailored to the Chirpity-Electron repository -->
# GitHub Copilot / AI Agent Instructions for Chirpity-Electron

**Purpose:** Short, actionable guidance so an AI assistant can be productive in this repo immediately.

**Big Picture:**
- **App type:** Electron desktop application (entry: `main.js`) that loads a renderer web UI and uses background workers for audio analysis.
- **ML models:** TensorFlow.js models and ONNX runtime are used. Model files live in top-level folders (e.g. `2023511_Augs~00100.../model.json`, `BirdNET_GLOBAL_6K_V2.4_Model_TFJS/`). Model behavior/config is controlled by root JSON files like `birdnet_model_config.json`, `nocmig_model_config.json`, and `chirpity_model_config.json`.
- **Core threads/processes:** `main.js` launches the app, `preload.js` provides a secure bridge for renderer ↔ native APIs, and UI code lives under `js/` (components and utilities). Background audio processing uses `worker.html` / `worker.js` and helper modules in `js/`.

**Key files & where to make changes:**
- `main.js` — Electron main process; modify for native integrations, menu or app lifecycle.
- `preload.js` — Exposes safe IPC methods. Keep changes minimal and follow existing IPC patterns.
- `index.html`, `worker.html`, and files under `js/` — UI and client-side logic. Examples: `js/components/spectrogram.js` (spectrogram rendering), `js/worker.js` (analysis orchestration).
- `custom_tfjs/` — contains runtime shims for custom TFJS ops (`custom_tfjs.js`, `custom_tfjs_core.js`). Note: packaging excludes `custom_tfjs` (see `package.json` `files` patterns); these are intentionally kept out of the packaged artifact.
- Model config JSONs at repo root — canonical place to change model parameters, input shapes, and labels.

**Build / dev workflows (concrete commands):**
- Install deps: `npm install`
- Run app locally: `npm start` (runs `electron .`)
- Build installers: `npm run export` (electron-builder), or `npm run build` / `npm run AppImage` / `npm run buildMac` as needed.
- Prebuild/packaging hooks: `prebuild.js` runs before packaging (multiple npm lifecycle scripts call it). Do not bypass it when preparing builds.
- Native deps: `postinstall` runs `electron-builder install-app-deps` — necessary for native modules like `onnxruntime-node`.
- Tests: `npm test` runs Playwright tests (`playwright.config.ts`, `test/` folder). Use `npx playwright test` for direct Playwright calls.

**Project-specific conventions & patterns:**
- UI code is split into small modules under `js/components/` and `docs/` contains generated documentation HTML (from `jsdoc`). Follow existing DOM patterns and event wiring.
- i18n: translations exist as JSON/CSV files in the repo root and `Help/` localizations. Prefer adding keys to existing translation files and updating `Help/` HTML if UI text changes.
- Model files are large and kept alongside the repo for convenience. When editing code that loads models, prefer referencing `*model_config.json` and avoid hardcoding model paths.
- Packaging excludes a number of development artifacts (see `package.json` `build.files`); if you add files required at runtime, update the `build.files` globs accordingly.

**Integration & external dependencies to watch for:**
- TensorFlow.js (`@tensorflow/tfjs`, `@tensorflow/tfjs-node`, `@tensorflow/tfjs-backend-webgpu`) — switching versions or changing backends requires verifying model compatibility and build hooks in `prebuild.js`.
- `onnxruntime-node` — native binaries are platform-specific; packaging and `postinstall` steps handle selection.
- `ffmpeg`/`fluent-ffmpeg` — used for audio conversion; tests and some CLI helpers rely on system availability.
- Electron & electron-builder — packaging behavior (asar, file inclusion/exclusion, extraResources) lives in `package.json` `build` section.

**Examples & quick patterns to follow:**
- To add a new UI control, change `js/components/<component>.js`, update `index.html` or the appropriate template, and add i18n key in `portuguese.json`/other translation jsons.
- To change model input preprocessing, edit the code that loads model configs (search for `*_model_config.json` usage) and update `js/worker.js` or the spectrogram helper which computes spectrograms.
- To add a Playwright test, put tests in `test/` and use existing fixtures from `playwright.config.ts`. Run `npm test` to validate.

**What to avoid / common pitfalls:**
- Do not assume model files are packaged — verify `build.files` globs first. `custom_tfjs` is excluded intentionally.
- Avoid adding direct native binary checks without using `install-app-deps` or `prebuild.js` because build hooks expect specific artifacts.
- Keep the `preload.js` surface minimal and maintain IPC security (do not expose Node APIs to the renderer).

If anything here is unclear or you want the file to be more prescriptive (examples of common refactors, or automated test snippets), tell me which sections to expand or provide a short task and I will iterate.
