# Chirpity ![GitHub release (latest by date)](https://img.shields.io/github/v/release/Mattk70/Chirpity-Electron) ![GitHub Downloads (all assets, latest release)](https://img.shields.io/github/downloads/Mattk70/Chirpity-Electron/latest/total?style=plastic&label=Downloads)




Desktop application to identify bird vocalisations in lengthy audio files. Uses either <a href="https://github.com/kahst/BirdNET-Analyzer">BirdNET</a> or a native AI model tuned for the calls of nocturnal migrants.

Author: Matthew Kirkland

![image](https://github.com/Mattk70/Chirpity-Electron/assets/61826357/96b0af44-3893-4288-8291-cf0f6db89a38)

## Application setup
Visit https://chirpity.mattkirkland.co.uk for platform specific installation instructions - Chirpity is available for both Windows and Mac platforms

## Development setup

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

Next, launch the app with:

```
npm start
```

## Development setup



Initialize the source directory with:

```
npm init
```

Now, install project dependencoies with:

```
npm install --save-dev
```

After that,  build a windows msi installer with:

```
npm run export
```

The resulting application will be saved in the "dist" folder.


