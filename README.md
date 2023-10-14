<b>This repo is currently under development.</b>

# Chirpity-Electron

Electron app for sound file analysis with Chirpity. 

Author: Matthew Kirkland


## Application setup

First, clone the project and install all dependencies:

```
git clone https://github.com/Mattk70/Chirpity-Electron
cd Chirpity-Electron
npm install
```

Next, launch the app with:

```
npm start
```

## Development setup

Setting up the project requires <i>Node.js</i>, which we need to install first.

After that, we can initialize the source directory with:

```
npm init
```

Follow the prompt to setup ```package.json```.

Now, we need to install <i>electron</I> with:

```
npm install --save-dev electron
```

Chirpity requires Tensorflow.js which we install with:

```
npm install @tensorflow/tfjs
```

Install Bootstrap and its dependencies:

```
npm install bootstrap
npm install jquery
npm install popper
```

This app also needs an additional package that we have to install.

```
npm install colormap
```

In order to package the app for stand-alone applications, we need electron-packager:

```
npm install electron-packager --save-dev
```

We can now add the export script in the <i>package.json</i>:

```
"scripts": {
    "start": "electron .",
    "export": "electron-packager . --out packages --overwrite"
  }
```

After that, we can export the app with:

```
npm run export
```

The resulting application will be saved in the "packages" folder.


