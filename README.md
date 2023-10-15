# Chirpity-Electron

Electron app to identify the calls of nocturnal migrants from audio files. 

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
npm install --save-dev
```

After that, we can build a windows msi installer with:

```
npm run export
```

The resulting application will be saved in the "dist" folder.


