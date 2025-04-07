import WaveSurfer from "../../node_modules/wavesurfer.js/dist/wavesurfer.esm.js";
import RegionsPlugin from "../../node_modules/wavesurfer.js/dist/plugins/regions.esm.js";
import Spectrogram from "../../node_modules/wavesurfer.js/dist/plugins/spectrogram.esm.js";
import TimelinePlugin from "../../node_modules/wavesurfer.js/dist/plugins/timeline.esm.js";
import { hexToRgb, showElement, clamp } from "../utils/utils.js";
import { DOM } from "../utils/DOMcache.js";
import { Context, get } from "../utils/i18n.js";

const colormap = window.module.colormap;

export class ChirpityWS {
  constructor(container, getState, getConfig, handlers, actions) {
    this.container = container;
    this.getState = getState; // Function to get the current state
    this.getConfig = getConfig; // Function to get the current config
    this.handlers = handlers; // { postbufferUpdate }
    this.wavesurfer = null;
    this.spectrogram = null;
    this.REGIONS = null;
    this.timeline = null;
    this.audioContext = new AudioContext();
    this.sampleRate = 24_000;
    this.actions = actions;

    this.specTooltip = this.specTooltip.bind(this);
    this.centreSpec = this.centreSpec.bind(this);
    this.handleGesture = this.handleGesture.bind(this);
  }

  createColormap() {
    const config = this.getConfig();
    const cmap = config.colormap;
    const map =
      cmap === "custom"
        ? [
            { index: 0, rgb: hexToRgb(config.customColormap.quiet) },
            {
              index: config.customColormap.threshold,
              rgb: hexToRgb(config.customColormap.mid),
            },
            { index: 1, rgb: hexToRgb(config.customColormap.loud) },
          ]
        : cmap;

    return ["roseus", "gray", "igray"].includes(cmap)
      ? cmap
      : colormap({ colormap: map, nshades: 256, format: "float" });
  }

  maxHeight = () => {
    // Get the available viewport height
    const formOffset = DOM.exploreWrapper.offsetHeight;
    const navPadding = DOM.navPadding.clientHeight;
    const footerHeight = DOM.footer.clientHeight;
    const controlsHeight = DOM.controlsWrapper.clientHeight;
    return (
      window.innerHeight -
      navPadding -
      footerHeight -
      controlsHeight -
      formOffset
    );
  };

  wsTextColour() {
    const config = this.getConfig();
    return config.colormap === "custom"
      ? config.customColormap.loud
      : config.colormap === "gray"
      ? "#000"
      : "#fff";
  }

  /**
   * Initializes and configures audio region management using the RegionsPlugin.
   *
   * Destroys any existing RegionsPlugin instance and creates a new instance with regions that are draggable,
   * a maximum limit of 100 regions, and a default color defined by STATE.regionColour.
   *
   * Registers event listeners for region interactions:
   * - "region-clicked": Hides the context menu, updates the active region, and seeks playback to the region's start.
   *   If the Shift key is pressed, all regions with the default color are removed; if the Ctrl/Cmd key is pressed,
   *   the clicked region is removed.
   * - "region-created": Marks a new region as active if it has no label (content) or its start time matches the current active region.
   * - "region-update": Clears the region's label and sets the updated region as active.
   *
   * @returns {Object} The new RegionsPlugin instance.
   */
  initRegion() {
    let REGIONS = this.REGIONS;
    const STATE = this.getState();
    if (REGIONS) REGIONS.destroy();
    REGIONS = RegionsPlugin.create({
      drag: true,
      maxRegions: 100,
      color: STATE.regionColour,
    });

    REGIONS.on("region-clicked", (r, e) => {
      e.stopPropagation();
      const STATE = this.getState();
      // Hide context menu
      DOM.contextMenu.classList.add("d-none");
      if (r.start !== STATE.activeRegion?.start) {
        this.handlers.setActiveRegion(r, true);
      }
      this.wavesurfer.seekTo(e.clientX / window.innerWidth);
      // If shift key held, clear other regions
      if (e.shiftKey) {
        this.REGIONS.regions.forEach(
          (r) => r.color === STATE.regionColour && r.remove()
        );
        // Ctrl / Cmd: remove the current region
      } else if (e.ctrlKey || e.metaKey) r.remove();
    });

    // Enable analyse selection when region created
    REGIONS.on("region-created", (r) => {
      const STATE = this.getState();
      const { start, content } = r;
      const activeStart = STATE.activeRegion ? STATE.activeRegion.start : null;
      // If a new region is created without a label, it must be user generated
      if (!content || start === activeStart) {
        this.handlers.setActiveRegion(r, false);
      }
    });

    // Clear label on modifying region
    REGIONS.on("region-update", (r) => {
      r.setOptions({ content: " " });
      this.handlers.setActiveRegion(r, false);
    });

    return REGIONS;
  }

  initWavesurfer = (container, plugins) => {
    const config = this.getConfig();
    // this.spectrogram ??= this.initSpectrogram(container, 256, 256)
    return WaveSurfer.create({
        container,
        // make waveform transparent
        backgroundColor: "rgba(0,0,0,0)",
        waveColor: "rgba(0,0,0,0)",
        progressColor: "rgba(0,0,0,0)",
        // but keep the playhead
        cursorColor: this.wsTextColour(config),
        cursorWidth: 2,
        height: "auto",
        sampleRate: this.sampleRate,
        renderFunction: () => {}, // no need to render a waveform
        plugins
      });
  }
  initAll = ({ audio = undefined, height = 0 }) => {
    const config = this.getConfig();
    const STATE = this.getState();
    const windowLength = STATE.windowLength;

    this.wavesurfer && this.wavesurfer.destroy();
    this.REGIONS = this.initRegion();
    this.spectrogram = this.initSpectrogram('#spectrogram', height);
    this.timeline = this.createTimeline(windowLength);
    // Setup waveform and spec views
    const plugins = [this.spectrogram, this.timeline, this.REGIONS];
    const container = document.getElementById("waveform");
    this.wavesurfer = this.initWavesurfer(container, plugins);

    if (audio) {
      this.loadBuffer(audio);
    }
    DOM.colourmap.value = config.colormap;
    // Set click event that removes all REGIONS

    this.REGIONS.enableDragSelection({
      color: STATE.regionActiveColour,
    });
    const wavesurfer = this.wavesurfer;
    wavesurfer.on("dblclick", this.centreSpec);
    wavesurfer.on("click", () => this.REGIONS.clearRegions());
    wavesurfer.on("pause", () => {
      const position =
        wavesurfer.getCurrentTime() / wavesurfer.decodedData.duration;
      // Pause event fired right before 'finish' event, so
      // this is set to signal whether it was playing up to that point
      if (position < 0.998) wavesurfer.isPaused = true;
    });

    wavesurfer.on("play", () => (wavesurfer.isPaused = false));

    wavesurfer.on("finish", () => {
      const {windowLength, windowOffsetSecs, currentFile, currentFileDuration, openFiles} = STATE;
      const bufferEnd = windowOffsetSecs + windowLength;
      if (currentFileDuration > bufferEnd) {
        this.handlers.postBufferUpdate({
          begin: windowOffsetSecs + windowLength,
          play: !wavesurfer.isPaused,
        });
      } else if (!wavesurfer.isPaused) {
        const fileIndex = openFiles.indexOf(currentFile);
        if (fileIndex < openFiles.length - 1) {
          // Move to next file
          const fileToLoad = openFiles[fileIndex + 1];
          this.handlers.postBufferUpdate({
            file: fileToLoad,
            begin: 0,
            position: 0,
            play: !wavesurfer.isPaused,
          });
        }
      }
    });

    // Show controls
    showElement(["controlsWrapper"]);
    // Resize canvas of spec and labels
    this.adjustDims(true);
    // remove the tooltip
    DOM.tooltip?.remove();

    const tooltip = document.createElement("div");
    tooltip.id = "tooltip";
    document.body.appendChild(tooltip);
    // Add event listener for the gesture events
    const wave = DOM.waveElement;
    wave.removeEventListener("wheel", this.handleGesture);
    wave.addEventListener("wheel", this.handleGesture, { passive: true });

    wave.removeEventListener("mousemove", this.specTooltip);
    wave.removeEventListener("mouseout", this.hideTooltip);

    wave.addEventListener("mousemove", this.specTooltip, {
      passive: true,
    });
    wave.addEventListener("mouseout", this.hideTooltip);
  };

  /**
   * Initializes and returns a new spectrogram visualization instance.
   *
   * This function destroys any existing spectrogram instance and purges related plugins before creating a new one.
   * The FFT sample count defaults to the value from configuration (config.FFT) if not provided.
   * If FFT samples remain unset, they are determined heuristically based on a global window length:
   *  - 256 samples if the window length is less than 5,
   *  - 512 samples if the window length is 5 to 15 (inclusive),
   *  - 1024 samples if the window length is greater than 15.
   * Likewise, the spectrogram height defaults to half of the FFT sample count if not specified.
   * A custom colormap is generated and applied along with configured frequency ranges and label settings.
   *
   * @param {number} [height] - The height of the spectrogram in pixels. Defaults to fftSamples/2 if not provided.
   * @param {number} [fftSamples] - The number of FFT samples used for analysis. Defaults to config.FFT or is computed based on window length.
   * @returns {Object} The initialized spectrogram instance.
   */
  initSpectrogram(container, height, fftSamples) {
    const config = this.getConfig();
    const spectrogram = this.spectrogram;
    const STATE = this.getState();
    const windowLength = STATE.windowLength;
    fftSamples ??= config.FFT;
    config.debug && console.log("initializing spectrogram");
    spectrogram && spectrogram.destroy() && WSPluginPurge();
    if (!fftSamples) {
      if (windowLength < 5) {
        fftSamples = 256;
      } else if (windowLength <= 15) {
        fftSamples = 512;
      } else {
        fftSamples = 1024;
      }
    }
    if (!height) {
      height = fftSamples / 2;
    }
    // set colormap
    const colors = this.createColormap(config);
    return Spectrogram.create({
      container,
      windowFunc: config.customColormap.windowFn,
      frequencyMin: config.audio.minFrequency,
      frequencyMax: config.audio.maxFrequency,
      // noverlap: 128, Auto (the default) seems fine
      // gainDB: 50, Adjusts spec brightness without increasing volume
      labels: config.specLabels,
      labelsColor: this.wsTextColour(),
      labelsBackground: "rgba(0,0,0,0)",
      height: height,
      fftSamples: fftSamples,
      scale: "linear",
      colorMap: colors,
      alpha: config.alpha,
    });
  }

  ///////////////////////// Timeline Callbacks /////////////////////////

  /**
   * Use formatTimeCallback to style the notch labels as you wish, such
   * as with more detail as the number of pixels per second increases.
   *
   * Here we format as M:SS.frac, with M suppressed for times < 1 minute,
   * and frac having 0, 1, or 2 digits as the zoom increases.
   *
   * Note that if you override the default function, you'll almost
   * certainly want to override timeInterval, primaryLabelInterval and/or
   * secondaryLabelInterval so they all work together.
   *
   * @param: seconds
   * @param: pxPerSec
   */
  formatTimeCallback = (secs) => {
    const config = this.getConfig();
    const STATE = this.getState();
    secs = secs.toFixed(2);
    // Add 500 to deal with overflow errors
    let now = new Date(STATE.bufferStartTime.getTime() + secs * 1000);
    let milliseconds = now.getMilliseconds();
    if (milliseconds > 949) {
      // Deal with overflow errors
      now = new Date(now.getTime() + 50);
      milliseconds = 0;
    }
    // Extract the components
    let hours = now.getHours();
    let minutes = now.getMinutes();
    let seconds = now.getSeconds();

    let formattedTime;
    if (config.timeOfDay) {
      // Format the time as hh:mm:ss
      formattedTime = [
        hours.toString().padStart(2, "0"),
        minutes.toString().padStart(2, "0"),
        seconds.toString().padStart(2, "0"),
      ].join(":");
    } else {
      if (hours === 0 && minutes === 0) {
        // Format as ss
        formattedTime = seconds.toString();
      } else if (hours === 0) {
        // Format as mm:ss
        formattedTime = [
          minutes.toString(),
          seconds.toString().padStart(2, "0"),
        ].join(":");
      } else {
        // Format as hh:mm:ss
        formattedTime = [
          hours.toString(),
          minutes.toString().padStart(2, "0"),
          seconds.toString().padStart(2, "0"),
        ].join(":");
      }
    }
    if (STATE.windowLength <= 5) {
      formattedTime += "." + milliseconds.toString();
    } else {
      milliseconds = (milliseconds / 1000).toFixed(1);
      formattedTime += milliseconds.slice(1);
    }

    return formattedTime;
  };

  /**
   * Creates and registers a timeline plugin for WaveSurfer.js.
   *
   * This function computes the timeline display intervals based on the global variable `windowLength`.
   * It determines the primary label interval as the ceiling of (`windowLength` divided by 5) and calculates
   * the time interval as one-tenth of this primary interval. Using these values, it configures a timeline
   * plugin via the `TimelinePlugin.create` method with customized options, including:
   * - Label formatting through the global `formatTimeCallback`
   * - Secondary label opacity set to 0.35
   * - Styling options such as font size ("0.75rem") and color obtained from `wsTextColour()`
   *
   * If a global WaveSurfer instance exists (referenced by `wavesurfer`), the timeline is automatically
   * registered with it; otherwise, the standalone timeline plugin object is returned.
   *
   * @returns {Object} The timeline plugin instance, either as a registered plugin with WaveSurfer or as a standalone object.
   */
  createTimeline(windowLength) {
    const primaryLabelInterval = Math.ceil(windowLength / 5);
    const secondaryLabelInterval = 0;
    const timeinterval = primaryLabelInterval / 10;
    const colour = this.wsTextColour();
    this.timeline = TimelinePlugin.create({
      insertPosition: "beforebegin",
      formatTimeCallback: this.formatTimeCallback,
      timeInterval: timeinterval,
      primaryLabelInterval: primaryLabelInterval,
      secondaryLabelInterval: secondaryLabelInterval,
      secondaryLabelOpacity: 0.35,
      style: {
        fontSize: "0.75rem",
        color: colour,
      },
    });
    return this.wavesurfer
      ? this.wavesurfer.registerPlugin(this.timeline)
      : this.timeline;
  }
  /**
   * Increases the FFT sample count for the spectrogram if it is below 2048.
   *
   * This function checks if the current FFT sample count (spectrogram.fftSamples) is less than 2048.
   * If so, it doubles the sample count, updates the global FFT configuration (config.FFT), and refreshes
   * the audio buffer by invoking postBufferUpdate with the current window offset, normalized playback position,
   * and playback state from wavesurfer. The playback position is calculated by dividing wavesurfer.getCurrentTime()
   * by windowLength, then clamped between 0 and 1. Finally, the updated FFT sample count is logged to the console.
   *
   * Side Effects:
   * - Modifies spectrogram.fftSamples and config.FFT.
   * - Calls postBufferUpdate to refresh the audio buffer.
   * - Logs the new FFT sample count using console.log.
   *
   * External Dependencies:
   * - spectrogram: Object containing FFT settings.
   * - config: Global configuration object for FFT.
   * - wavesurfer: Instance controlling audio playback and current time.
   * - windowLength: Global variable used to normalize the playback position.
   * - windowOffsetSecs: Global variable indicating the current window offset in seconds.
   * - clamp: Utility function to restrict a value between a minimum and maximum.
   * - postBufferUpdate: Function to update the audio buffer after FFT changes.
   */
  increaseFFT() {
    const wavesurfer = this.wavesurfer;
    const spectrogram = this.spectrogram;
    const STATE = this.getState();
    if (spectrogram.fftSamples < 2048 && STATE.regionsCompleted) {
      spectrogram.fftSamples *= 2;
      const position = clamp(
        wavesurfer.getCurrentTime() / STATE.windowLength,
        0,
        1
      );
      this.handlers.postBufferUpdate({
        begin: STATE.windowOffsetSecs,
        position: position,
        play: wavesurfer.isPlaying(),
      });
      console.log(spectrogram.fftSamples);
      return spectrogram.fftSamples;
    }
  }

  /**
   * Halve the FFT sample count for the spectrogram when it exceeds the minimum threshold.
   *
   * This function checks if `spectrogram.fftSamples` is greater than 64. If so, the FFT sample
   * count is halved, and the normalized playback position is computed using the ratio of the current
   * playback time (from `wavesurfer.getCurrentTime()`) to the `windowLength`, clamped between 0 and 1.
   * It then calls `postBufferUpdate` with an object containing:
   *   - `begin`: the current window offset in seconds (`windowOffsetSecs`),
   *   - `position`: the normalized (and clamped) playback position,
   *   - `play`: a boolean indicating whether audio is currently playing (`wavesurfer.isPlaying()`).
   *
   * The updated FFT sample count is logged to the console, and the global configuration (`config.FFT`)
   * is updated accordingly.
   *
   * Assumes that the following globals and helper functions are available in the scope:
   *   - `spectrogram`
   *   - `wavesurfer`
   *   - `windowLength`
   *   - `windowOffsetSecs`
   *   - `config`
   *   - `clamp`
   *   - `postBufferUpdate`
   *
   * @returns {void}
   */
  reduceFFT() {
    const wavesurfer = this.wavesurfer;
    const spectrogram = this.spectrogram;
    const STATE = this.getState();
    if (spectrogram.fftSamples > 64 && STATE.regionsCompleted) {
      spectrogram.fftSamples /= 2;
      const position = clamp(
        wavesurfer.getCurrentTime() / STATE.windowLength,
        0,
        1
      );
      this.handlers.postBufferUpdate({
        begin: STATE.windowOffsetSecs,
        position: position,
        play: wavesurfer.isPlaying(),
      });
      console.log(spectrogram.fftSamples);
      return spectrogram.fftSamples;
    }
  }

  refreshTimeline = () => {
    const STATE = this.getState();
    this.timeline.destroy();
    this.timeline = this.createTimeline(STATE.windowLength);
  };

  /**
   * Adjusts the spectrogram zoom level and repositions the playhead relative to the audio timeline.
   *
   * Halves the display window during an "In" operation—without reducing the window below 1.5 seconds—
   * and doubles it during a "zoomOut" operation, capped at 100 seconds or the total duration of the file.
   * The window offset is recalculated to keep the playhead at the same absolute position within the audio,
   * and any active audio regions are updated to remain consistent with the new window.
   *
   * No operation is performed if no audio file is loaded or if the audio regions have not been fully initialized.
   *
   * @param {(string|Event)} direction - A zoom command either as a string ("In" or "Out") for direct calls,
   * or as an Event from which the command is extracted using the event target's closest button ID.
   * @returns {void}
   *
   * @example
   * // Programmatically zoom in:
   * zoom("In");
   *
   * @example
   * // Zoom out via a button click:
   * buttonElement.addEventListener("click", zoom);
   */
  zoom(direction) {
    const wavesurfer = this.wavesurfer;
    const STATE = this.getState();
    const { fileLoaded, regionsCompleted, currentFileDuration } = STATE;
    let { windowLength, windowOffsetSecs, activeRegion } = STATE;
    if (fileLoaded && regionsCompleted) {
      if (typeof direction !== "string") {
        // then it's an event
        direction = direction.target.closest("button").id.replace("zoom", "");
      }
      let playedSeconds = wavesurfer.getCurrentTime();
      let position = playedSeconds / windowLength;
      let timeNow = windowOffsetSecs + playedSeconds;
      const oldBufferBegin = windowOffsetSecs;
      if (direction === "In") {
        if (windowLength < 1.5) return;
        windowLength /= 2;
        windowOffsetSecs += windowLength * position;
      } else {
        if (windowLength > 100 || windowLength === currentFileDuration) return;
        windowOffsetSecs -= windowLength * position;
        windowLength = Math.min(currentFileDuration, windowLength * 2);

        if (windowOffsetSecs < 0) {
          windowOffsetSecs = 0;
        } else if (windowOffsetSecs + windowLength > currentFileDuration) {
          windowOffsetSecs = currentFileDuration - windowLength;
        }
      }
      // Keep playhead at same time in file
      position = (timeNow - windowOffsetSecs) / windowLength;
      // adjust region start time to new window start time
      if (activeRegion) {
        const duration = activeRegion.end - activeRegion.start;
        activeRegion.start =
          oldBufferBegin + activeRegion.start - windowOffsetSecs;
        activeRegion.end = activeRegion.start + duration;
      }
      this.handlers.onStateUpdate({
        windowLength,
        windowOffsetSecs,
        activeRegion,
      });
      this.handlers.postBufferUpdate({
        begin: windowOffsetSecs,
        position: position,
        play: wavesurfer.isPlaying(),
      });
    }
  }

  /**
   * Centers the spectrogram view around the current playback time.
   *
   * This function recalculates the starting offset of the audio window so that the
   * current time (from the WaveSurfer instance) appears at the center of the display.
   * It updates the global variable `windowOffsetSecs` by subtracting half of the
   * window's length from the computed midpoint. The offset is clamped between 0 and
   * the maximum valid offset determined by `currentFileDuration - STATE.windowLength`.
   *
   * If an active audio region exists (stored in `activeRegion`), the function adjusts
   * its start and end times by the same offset shift. Should the region extend beyond the
   * valid window boundaries after the shift, it is cleared (set to null).
   *
   * Finally, the function invokes `postBufferUpdate` to refresh the audio display with
   * the new configuration, positioning the center at 0.5.
   *
   * Side Effects:
   * - Modifies the global variables `windowOffsetSecs` and `activeRegion`.
   * - Relies on and interacts with global state including `wavesurfer`, `STATE.windowLength`,
   *   `currentFileDuration`, and `postBufferUpdate`.
   */

  centreSpec() {
    const STATE = this.getState();
    let { windowOffsetSecs, activeRegion, currentFileDuration, windowLength, regionsCompleted } = STATE;
    if (regionsCompleted) {
      const saveBufferBegin = windowOffsetSecs;
      const middle = windowOffsetSecs + this.wavesurfer.getCurrentTime();
      windowOffsetSecs = middle - windowLength / 2;
      windowOffsetSecs = Math.max(0, windowOffsetSecs);
      windowOffsetSecs = Math.min(
        windowOffsetSecs,
        currentFileDuration - windowLength
      );

      if (activeRegion) {
        const shift = saveBufferBegin - windowOffsetSecs;
        activeRegion.start += shift;
        activeRegion.end += shift;
        const { start, end } = activeRegion;
        if (start < 0 || end > windowLength) activeRegion = null;
      }
      this.handlers.onStateUpdate({
        windowOffsetSecs,
        activeRegion,
      });
      this.handlers.postBufferUpdate({
        begin: windowOffsetSecs,
        position: 0.5,
      });
    }
  }
  makeBlob(audio) {
    // Recreate TypedArray
    const int16Array = new Int16Array(audio.buffer);
    // Convert to Float32Array (Web Audio API uses Float32 samples)
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768; // Normalize from Int16 to Float32
    }
    // Create AudioBuffer using AudioContext
    const audioBuffer = this.audioContext.createBuffer(
      1,
      float32Array.length,
      this.sampleRate
    ); // Mono channel
    // Populate the AudioBuffer with float32Array data
    audioBuffer.copyToChannel(float32Array, 0);
    const blob = new Blob([audio], { type: "audio/wav" });
    const peaks = [audioBuffer.getChannelData(0)];
    const duration = audioBuffer.duration;
    return [blob, peaks, duration];
  }

  async loadBuffer(audio) {
    const STATE = this.getState();
    audio ??= STATE.currentBuffer;
    const [blob, peaks, duration] = this.makeBlob(audio);
    await this.wavesurfer.loadBlob(blob, peaks, duration);
  }

  /**
   * Updates the spectrogram visualization and timeline asynchronously.
   *
   * This function ensures that the spectrogram element is visible by removing 
   * the "d-none" class and updates the display based on the provided audio buffer and options. 
   * It resets the spectrogram dimensions if a reset is requested or if the 
   * wavesurfer instance is uninitialized; otherwise, it loads the new audio buffer. 
   * After updating the spectrogram, the timeline is refreshed, the playback position
   * is set using a normalized value, and playback is initiated if specified.
   *
   * @async
   * @param {Object} options - Configuration options for updating the spectrogram.
   * @param {AudioBuffer|*} options.buffer - The audio buffer to be visualized.
   * @param {boolean} [options.play=false] - If true, starts playback immediately after the update.
   * @param {number} [options.position=0] - Normalized playback position (between 0 and 1) to seek to.
   * @param {boolean} [options.resetSpec=false] - If true, resets the spectrogram dimensions before loading the buffer.
   * @returns {Promise<void>} A promise that resolves once the spectrogram and timeline update process is complete.
   */
  async updateSpec({ buffer, play = false, position = 0, resetSpec = false }) {
    DOM.spectrogramWrapper.classList.remove("d-none");
    if (resetSpec || !this.wavesurfer) await this.adjustDims(true);
    else {
      await this.loadBuffer(buffer);
    }
    this.refreshTimeline();
    this.wavesurfer.seekTo(position);
    if (play) await this.wavesurfer.play();
  }

  WSPluginPurge = () => {
    const wavesurfer = this.wavesurfer;
    // Destroy leaves the plugins in the plugin list.
    // So, this is needed to remove plugins where the `wavesurfer` key is null
    wavesurfer &&
      (wavesurfer.plugins = wavesurfer.plugins.filter(
        (plugin) => plugin.wavesurfer !== null
      ));
  };

  /**
   * Creates and registers a new audio region on the waveform, optionally navigating to its start time.
   *
   * This function validates the input parameters and adds a new region to the global REGIONS collection using the
   * specified start and end times. It applies the provided color or defaults to STATE.regionColour, and formats the label
   * using the formatLabel helper. If the goToRegion flag is true, the waveform's current time is set to the new region's start time.
   *
   * Note: If the start and end parameters are invalid (i.e., non-numeric or if start is not less than end), the function logs
   * an error and returns early without creating the region.
   *
   * @param {number} start - The start time of the region in seconds.
   * @param {number} end - The end time of the region in seconds (must be greater than start).
   * @param {string} label - The label for the region.
   * @param {boolean} goToRegion - If true, navigates the waveform to the region's start time.
   * @param {string} [colour] - Optional color for the region; defaults to STATE.regionColour if not provided.
   * @returns {void}
   */
  createRegion(start, end, label, goToRegion, colour) {
    const REGIONS = this.REGIONS;
    const STATE = this.getState();
    const wavesurfer = this.wavesurfer;
    // Validate input parameters
    if (typeof start !== "number" || typeof end !== "number" || start >= end) {
      console.error("Invalid region parameters:", { start, end });
      return;
    }
    // Check for an existing region with the same start/end
    const existingRegion = REGIONS.getRegions().find(region => 
      region.start === start && region.end === end
    );

    if (existingRegion) {
      // Append a new label to the existing region
      // const newLabel = this.formatLabel(' / ' + label, colour);
      existingRegion.content.textContent += ' / ' + label;
    } else {
      REGIONS.addRegion({
        start: start,
        end: end,
        color: colour || STATE.regionColour,
        content: this.formatLabel(label, colour),
      });
    }
    if (goToRegion) wavesurfer.setTime(start);
  }

  /**
   * Creates and returns a styled label element for a navigation option.
   *
   * This function generates an HTML <span> element with specific styling properties, including absolute positioning,
   * a text color, and a text shadow effect. If the global configuration's colormap is set to 'gray', the provided color
   * is overridden: a truthy color results in 'purple', whereas a falsy value defaults to '#666'. If no label text is provided,
   * the function returns undefined.
   *
   * @param {string} label - The text to display in the label. If falsy, the function returns undefined.
   * @param {string} [color] - The desired color for the label text (subject to configuration overrides).
   * @returns {(HTMLElement|undefined)} The styled <span> element containing the label text, or undefined if no label is provided.
   */
  formatLabel(label, color) {
    const config = this.getConfig();
    if (config.colormap === "gray") {
      color = color ? "purple" : "#666";
    }
    if (!label) return;
    const labelEl = document.createElement("span");
    Object.assign(labelEl.style, {
      position: "absolute",
      color: color || "beige",
      top: "1rem",
      left: "0.5rem",
      textShadow: "2px 2px 3px rgb(0, 0, 0, 0.5)",
    });
    labelEl.textContent = label;
    return labelEl;
  }

  /**
   * Adjusts the dimensions of the spectrogram and related UI elements based on the current window and DOM sizes.
   *
   * This asynchronous function recalculates the layout of key UI components such as the content wrapper,
   * spectrogram display, and result table, ensuring they adapt to changes in the window size. When the
   * `redraw` flag is true and an audio file is loaded, the function computes a new spectrogram height using
   * either the specified `newHeight` (if non-zero) or the current configuration limits. If a new height is provided,
   * it updates the configuration preferences accordingly.
   *
   * Depending on whether WaveSurfer is already initialized, the function will either:
   * - Initialize a new WaveSurfer instance with the current audio buffer and updated height.
   * - Update the existing WaveSurfer instance's options (including height and cursor color), re-register the spectrogram
   *   plugin with the new settings (using `fftSamples` if provided), and reload the audio buffer.
   *
   * Finally, it adjusts the height of the result table to fill the remaining vertical space.
   *
   * @param {boolean} redraw - Indicates whether the spectrogram should be re-rendered and WaveSurfer updated.
   * @param {number} [fftSamples] - Optional. The number of FFT samples to use for rendering; must be a power of two.
   * @param {number} [newHeight=0] - Optional. Overrides the dynamic height calculation for the spectrogram; a value of 0 triggers dynamic sizing.
   * @returns {Promise<void>} A promise that resolves once the UI adjustments and spectrogram rendering updates are complete.
   */

  async adjustDims(redraw, fftSamples, newHeight = 0) {
    const config = this.getConfig();
    const STATE = this.getState();
    const {footer, navPadding, contentWrapper, exploreWrapper, 
      spectrogramWrapper, resultTableElement} = DOM;
    const wavesurfer = this.wavesurfer;
    const footerHeight = footer.offsetHeight;
    const navHeight = navPadding.clientHeight;
    fftSamples ??= config.FFT;
    contentWrapper.style.top = navHeight.toString() + "px"; // for padding
    contentWrapper.style.height =
      (document.body.clientHeight - footerHeight - navHeight).toString() + "px";
    const contentHeight = contentWrapper.offsetHeight;
    // + 2 for padding
    const formOffset = exploreWrapper.offsetHeight;

    let specOffset = 0;
    if (!spectrogramWrapper.classList.contains("d-none")) {
      const specHeight =
        newHeight || Math.min(config.specMaxHeight, this.maxHeight());
      if (newHeight) {
        config.specMaxHeight = specHeight;
        this.handlers.updatePrefs("config.json", config);
      }
      if (STATE.currentFile && redraw) {
        // give the wrapper space for the transport controls and element padding/margins
        if (!wavesurfer) {
          this.initAll({
            audio: STATE.currentBuffer,
            height: specHeight,
          });
        } else {
          wavesurfer.setOptions({
            height: specHeight,
            cursorColor: this.wsTextColour(),
          });
          this.spectrogram = this.initSpectrogram('#spectrogram', specHeight, fftSamples);
          wavesurfer.registerPlugin(this.spectrogram);
          await this.loadBuffer();
        }
      }
      specOffset = spectrogramWrapper.offsetHeight;
    }
    resultTableElement.style.height =
      contentHeight - specOffset - formOffset + "px";
  }
  /**
   * Reinitializes the spectrogram plugin if it has not been initialized.
   *
   * Checks if a global wavesurfer instance exists and the spectrogram is not already set up.
   * If both conditions are met, it initializes the spectrogram using the configured maximum height
   * and registers it as a plugin with wavesurfer.
   */
  reInitSpec(height) {
    const wavesurfer = this.wavesurfer;
    if (wavesurfer && !this.spectrogram) {
        this.spectrogram = this.initSpectrogram('#spectrogram', height);
      wavesurfer.registerPlugin(this.spectrogram);
    }
  }

  hideTooltip() {
    DOM.tooltip.style.visibility = "hidden";
  }

  /**
   * Determines if a right-click event occurred within an audio region and optionally sets it as active.
   *
   * This function calculates the time position from the event's x-coordinate relative to the target element's width
   * using the global "STATE.windowLength". It then searches the global "REGIONS.regions" array for an audio region that spans
   * the computed time. If a matching region is found and the setActive flag is true, the region is set as active by calling
   * the global "setActiveRegion" function.
   *
   * @param {MouseEvent} e - The right-click event containing the clientX coordinate and target element dimensions.
   * @param {boolean} setActive - Flag indicating whether to mark the located region as active.
   * @returns {Object|undefined} The audio region that contains the computed time, or undefined if none is found.
   */
  checkForRegion(e, setActive) {
    const STATE = this.getState();
    const relativePosition = e.clientX / e.currentTarget.clientWidth;
    const time = relativePosition * STATE.windowLength;
    const region = this.REGIONS.regions.find(
      (r) => r.start < time && r.end > time
    );
    region && setActive && this.handlers.setActiveRegion(region, false);
    return region;
  }

  formatRegionTooltip(regionLength, start, end) {
    const length = end - start;
    if (length === 3) {
      return `${this.formatTimeCallback(start)} -  ${this.formatTimeCallback(
        end
      )}`;
    } else if (length < 1)
      return `${regionLength}: ${(length * 1000).toFixed(0)}ms`;
    else {
      return `${regionLength}: ${length.toFixed(3)}s`;
    }
  }

  specTooltip(event, showHz) {
    const config = this.getConfig();
    showHz = !config.specLabels;
    const i18 = get(Context);
    const waveElement = event.target;
    // Update the tooltip content
    const tooltip = DOM.tooltip;
    tooltip.style.display = "none";
    tooltip.replaceChildren();
    const inRegion = this.checkForRegion(event, false);
    if (showHz || inRegion) {
      const specDimensions = waveElement.getBoundingClientRect();
      const frequencyRange =
        Number(config.audio.maxFrequency) - Number(config.audio.minFrequency);
      const yPosition =
        Math.round(
          (specDimensions.bottom - event.clientY) *
            (frequencyRange / specDimensions.height)
        ) + Number(config.audio.minFrequency);

      tooltip.textContent = `${i18.frequency}: ${yPosition}Hz`;
      if (inRegion) {
        const { start, end } = inRegion;
        const textNode = document.createTextNode(
          this.formatRegionTooltip(i18.length, start, end)
        );
        const lineBreak = document.createElement("br");
        tooltip.appendChild(lineBreak); // Add the line break
        tooltip.appendChild(textNode); // Add the text node
      }
      // Apply styles to the tooltip
      Object.assign(tooltip.style, {
        top: `${event.clientY}px`,
        left: `${event.clientX + 15}px`,
        display: "block",
        visibility: "visible",
        opacity: 1,
      });
    }
  }

  /**
   * Handles a swipe gesture event to trigger page navigation actions.
   *
   * This function throttles gesture events by ignoring any that occur within 1.2 seconds of the previous event.
   * It determines the direction of the gesture by evaluating the horizontal (deltaX) or, if absent, vertical (deltaY) movement.
   * A positive movement results in a "PageDown" action, while a negative movement triggers a "PageUp" action.
   * If debugging is enabled, the gesture details are logged, and each action is tracked via a tracking event.
   *
   * @param {Object} e - The gesture event object.
   * @param {number} [e.deltaX] - The horizontal movement delta.
   * @param {number} [e.deltaY] - The vertical movement delta used if horizontal movement is zero.
   */
  handleGesture(e) {
    const STATE = this.getState();
    const config = this.getConfig();
    const currentTime = Date.now();
    if (currentTime - STATE.lastGestureTime < 1200) {
      return; // Ignore successive events within 1.2 second
    }
    STATE.lastGestureTime = currentTime;
    const moveDirection = e.deltaX || e.deltaY; // If deltaX is 0, use deltaY
    const key = moveDirection > 0 ? "PageDown" : "PageUp";
    config.debug && console.log(`scrolling x: ${e.deltaX} y: ${e.deltaY}`);
    // waitForFinalEvent(() => {
    this.actions[key](e);
    this.handlers.trackEvent(config.UUID, "Swipe", key, "");
    // }, 200, 'swipe');
  }
}
