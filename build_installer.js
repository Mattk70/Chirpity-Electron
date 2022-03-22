// ./build_installer.js

// 1. Import Modules
const { MSICreator } = require('electron-wix-msi');
const path = require('path');

// 2. Define input and output directory.
// Important: the directories must be absolute, not relative e.g
// appDirectory: "C:\\Users\sdkca\Desktop\OurCodeWorld-win32-x64",
const APP_DIR = path.resolve(__dirname, './packages/chirpity-win32-x64');
// outputDirectory: "C:\\Users\sdkca\Desktop\windows_installer",
const OUT_DIR = path.resolve(__dirname, './packages');

// 3. Instantiate the MSICreator
const msiCreator = new MSICreator({
    appDirectory: APP_DIR,
    outputDirectory: OUT_DIR,

    // Configure metadata
    description: 'Nocmig application for sound file analysis.',
    exe: 'Chirpity',
    arch: 'x64',
    upgradeCode: 'abb4ec5e-3d82-42ce-89a6-1dc7de7e04d3',
    name: 'Chirpity Nocmig',
    shortcutFolderName: 'Chirpity',
    appIconPath: "C:\\Users\\simpo\\PycharmProjects\\Chirpity-Electron\\img\\icon\\icon.ico",
    manufacturer: 'KDC Ltd.',
    version: '0.2.5',

    // Configure installer User Interface
    ui: {
        chooseDirectory: true
    },
});

// 4. Create a .wxs template file
msiCreator.create().then(function(){

    // Step 5: Compile the template to a .msi file
    msiCreator.compile();
});