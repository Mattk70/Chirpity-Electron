# Chirpity [![GitHub release (latest by date)](https://img.shields.io/github/v/release/Mattk70/Chirpity-Electron)](https://github.com/Mattk70/Chirpity-Electron/releases/latest) [![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/MattK70/Chirpity-Electron/check-installation.yml)](https://github.com/MattK70/Chirpity-Electron/actions/workflows/check-installation.yml) ![GitHub Downloads (all assets, latest release)](https://img.shields.io/github/downloads/Mattk70/Chirpity-Electron/latest/total?style=plastic&label=Latest%20Release%20Downloads) 






Desktop application to identify bird vocalisations in lengthy audio files. Uses either <a href="https://github.com/kahst/BirdNET-Analyzer">BirdNET</a> or a native AI model tuned for the calls of nocturnal migrants.

Author: Matthew Kirkland

![image](https://github.com/Mattk70/Chirpity-Electron/assets/61826357/96b0af44-3893-4288-8291-cf0f6db89a38)

## Key Features
- Uses two Machine Learning models to identify audio files based on the user's needs: BirdNET and the Nocmig model
- Supports audio input files such as WAV, MP3, MP4/M4A, AAC, Opus, Ogg, and FLAC
- Audio analysis can run in the background while exploring the application
- Tailor species detection based on the season, time of day, or a custom list of species 
- Program can reduce background noise to make avian sounds more audible
- ...and <a href="https://chirpity.mattkirkland.co.uk/">more</a>

## Application setup
Visit https://chirpity.mattkirkland.co.uk for platform specific installation instructions - Chirpity binaries are available for Windows, Mac and Linux platforms. 

## Running the application from source
> [!WARNING]
> [![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/MattK70/Chirpity-Electron/check-installation.yml)](https://github.com/MattK70/Chirpity-Electron/actions/workflows/check-installation.yml)
> 
> _This is not reommended, application testing is done at the build stage and the master branch may be broken - use the [releases](https://github.com/Mattk70/Chirpity-Electron/releases) provided for Windows, MacOS and Linux._

First, clone the project and install all dependencies:

```
git clone https://github.com/Mattk70/Chirpity-Electron
cd Chirpity-Electron
```

Chirpity depends on  <i><a href="https://nodejs.org/en/download">Node.js</a></i>, follow the link for the download and installation instructions.
Once installed, run:
```
npm install
```
> [!NOTE]
> N.B. Certain libraries are modified during the build process. Refer to  [check-installation.yml](https://github.com/Mattk70/Chirpity-Electron/blob/9c4aa2e50a6630985a1fe0d95477c61869c25f42/.github/workflows/check-installation.yml#L66)) for details. Next, launch the app with:

```
npm start
```

## Development setup



Initialize the source directory with:

```
npm init
```

Now, install project dependencies with:

```
npm install --save-dev
```

After that,  build a windows msi installer with:

```
npm run export
```

The resulting application will be saved in the "dist" folder.


