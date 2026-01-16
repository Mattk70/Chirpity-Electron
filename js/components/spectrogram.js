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
    
    const {quiet, mid, loud, quietThreshold, midThreshold} = config.customColormap;
    const cmap = config.colormap;
    const map =
      cmap === "custom"
        ? [
            { index: 0, rgb: hexToRgb(quiet) },
            { index: quietThreshold, rgb: hexToRgb(quiet) },
            { index: midThreshold, rgb: hexToRgb(mid) },
            { index: 1, rgb: hexToRgb(loud) },
          ]
        : cmap;

    return ["roseus", "gray", "igray"].includes(cmap)
      ? this.getColors(cmap)
      : colormap({ colormap: map, nshades: 256, format: "float" });
  }

  getColors(map){
    let colorMap = [];
    switch (map) {
      case 'gray':
        for (let i = 0; i < 256; i++) {
          const val = (255 - i) / 256
          colorMap.push([val, val, val, 1])
        }
        break
      case 'igray':
        for (let i = 0; i < 256; i++) {
          const val = i / 256
          colorMap.push([val, val, val, 1])
        }
        break
      case 'roseus':
        colorMap = [[0.004528, 0.004341, 0.004307, 1],[0.005625, 0.006156, 0.006010, 1],[0.006628, 0.008293, 0.008161, 1],[0.007551, 0.010738, 0.010790, 1],[0.008382, 0.013482, 0.013941, 1],[0.009111, 0.016520, 0.017662, 1],[0.009727, 0.019846, 0.022009, 1],[0.010223, 0.023452, 0.027035, 1],[0.010593, 0.027331, 0.032799, 1],[0.010833, 0.031475, 0.039361, 1],[0.010941, 0.035875, 0.046415, 1],[0.010918, 0.040520, 0.053597, 1],[0.010768, 0.045158, 0.060914, 1],[0.010492, 0.049708, 0.068367, 1],[0.010098, 0.054171, 0.075954, 1],[0.009594, 0.058549, 0.083672, 1],[0.008989, 0.062840, 0.091521, 1],[0.008297, 0.067046, 0.099499, 1],[0.007530, 0.071165, 0.107603, 1],[0.006704, 0.075196, 0.115830, 1],[0.005838, 0.079140, 0.124178, 1],[0.004949, 0.082994, 0.132643, 1],[0.004062, 0.086758, 0.141223, 1],[0.003198, 0.090430, 0.149913, 1],[0.002382, 0.094010, 0.158711, 1],[0.001643, 0.097494, 0.167612, 1],[0.001009, 0.100883, 0.176612, 1],[0.000514, 0.104174, 0.185704, 1],[0.000187, 0.107366, 0.194886, 1],[0.000066, 0.110457, 0.204151, 1],[0.000186, 0.113445, 0.213496, 1],[0.000587, 0.116329, 0.222914, 1],[0.001309, 0.119106, 0.232397, 1],[0.002394, 0.121776, 0.241942, 1],[0.003886, 0.124336, 0.251542, 1],[0.005831, 0.126784, 0.261189, 1],[0.008276, 0.129120, 0.270876, 1],[0.011268, 0.131342, 0.280598, 1],[0.014859, 0.133447, 0.290345, 1],[0.019100, 0.135435, 0.300111, 1],[0.024043, 0.137305, 0.309888, 1],[0.029742, 0.139054, 0.319669, 1],[0.036252, 0.140683, 0.329441, 1],[0.043507, 0.142189, 0.339203, 1],[0.050922, 0.143571, 0.348942, 1],[0.058432, 0.144831, 0.358649, 1],[0.066041, 0.145965, 0.368319, 1],[0.073744, 0.146974, 0.377938, 1],[0.081541, 0.147858, 0.387501, 1],[0.089431, 0.148616, 0.396998, 1],[0.097411, 0.149248, 0.406419, 1],[0.105479, 0.149754, 0.415755, 1],[0.113634, 0.150134, 0.424998, 1],[0.121873, 0.150389, 0.434139, 1],[0.130192, 0.150521, 0.443167, 1],[0.138591, 0.150528, 0.452075, 1],[0.147065, 0.150413, 0.460852, 1],[0.155614, 0.150175, 0.469493, 1],[0.164232, 0.149818, 0.477985, 1],[0.172917, 0.149343, 0.486322, 1],[0.181666, 0.148751, 0.494494, 1],[0.190476, 0.148046, 0.502493, 1],[0.199344, 0.147229, 0.510313, 1],[0.208267, 0.146302, 0.517944, 1],[0.217242, 0.145267, 0.525380, 1],[0.226264, 0.144131, 0.532613, 1],[0.235331, 0.142894, 0.539635, 1],[0.244440, 0.141559, 0.546442, 1],[0.253587, 0.140131, 0.553026, 1],[0.262769, 0.138615, 0.559381, 1],[0.271981, 0.137016, 0.565500, 1],[0.281222, 0.135335, 0.571381, 1],[0.290487, 0.133581, 0.577017, 1],[0.299774, 0.131757, 0.582404, 1],[0.309080, 0.129867, 0.587538, 1],[0.318399, 0.127920, 0.592415, 1],[0.327730, 0.125921, 0.597032, 1],[0.337069, 0.123877, 0.601385, 1],[0.346413, 0.121793, 0.605474, 1],[0.355758, 0.119678, 0.609295, 1],[0.365102, 0.117540, 0.612846, 1],[0.374443, 0.115386, 0.616127, 1],[0.383774, 0.113226, 0.619138, 1],[0.393096, 0.111066, 0.621876, 1],[0.402404, 0.108918, 0.624343, 1],[0.411694, 0.106794, 0.626540, 1],[0.420967, 0.104698, 0.628466, 1],[0.430217, 0.102645, 0.630123, 1],[0.439442, 0.100647, 0.631513, 1],[0.448637, 0.098717, 0.632638, 1],[0.457805, 0.096861, 0.633499, 1],[0.466940, 0.095095, 0.634100, 1],[0.476040, 0.093433, 0.634443, 1],[0.485102, 0.091885, 0.634532, 1],[0.494125, 0.090466, 0.634370, 1],[0.503104, 0.089190, 0.633962, 1],[0.512041, 0.088067, 0.633311, 1],[0.520931, 0.087108, 0.632420, 1],[0.529773, 0.086329, 0.631297, 1],[0.538564, 0.085738, 0.629944, 1],[0.547302, 0.085346, 0.628367, 1],[0.555986, 0.085162, 0.626572, 1],[0.564615, 0.085190, 0.624563, 1],[0.573187, 0.085439, 0.622345, 1],[0.581698, 0.085913, 0.619926, 1],[0.590149, 0.086615, 0.617311, 1],[0.598538, 0.087543, 0.614503, 1],[0.606862, 0.088700, 0.611511, 1],[0.615120, 0.090084, 0.608343, 1],[0.623312, 0.091690, 0.605001, 1],[0.631438, 0.093511, 0.601489, 1],[0.639492, 0.095546, 0.597821, 1],[0.647476, 0.097787, 0.593999, 1],[0.655389, 0.100226, 0.590028, 1],[0.663230, 0.102856, 0.585914, 1],[0.670995, 0.105669, 0.581667, 1],[0.678686, 0.108658, 0.577291, 1],[0.686302, 0.111813, 0.572790, 1],[0.693840, 0.115129, 0.568175, 1],[0.701300, 0.118597, 0.563449, 1],[0.708682, 0.122209, 0.558616, 1],[0.715984, 0.125959, 0.553687, 1],[0.723206, 0.129840, 0.548666, 1],[0.730346, 0.133846, 0.543558, 1],[0.737406, 0.137970, 0.538366, 1],[0.744382, 0.142209, 0.533101, 1],[0.751274, 0.146556, 0.527767, 1],[0.758082, 0.151008, 0.522369, 1],[0.764805, 0.155559, 0.516912, 1],[0.771443, 0.160206, 0.511402, 1],[0.777995, 0.164946, 0.505845, 1],[0.784459, 0.169774, 0.500246, 1],[0.790836, 0.174689, 0.494607, 1],[0.797125, 0.179688, 0.488935, 1],[0.803325, 0.184767, 0.483238, 1],[0.809435, 0.189925, 0.477518, 1],[0.815455, 0.195160, 0.471781, 1],[0.821384, 0.200471, 0.466028, 1],[0.827222, 0.205854, 0.460267, 1],[0.832968, 0.211308, 0.454505, 1],[0.838621, 0.216834, 0.448738, 1],[0.844181, 0.222428, 0.442979, 1],[0.849647, 0.228090, 0.437230, 1],[0.855019, 0.233819, 0.431491, 1],[0.860295, 0.239613, 0.425771, 1],[0.865475, 0.245471, 0.420074, 1],[0.870558, 0.251393, 0.414403, 1],[0.875545, 0.257380, 0.408759, 1],[0.880433, 0.263427, 0.403152, 1],[0.885223, 0.269535, 0.397585, 1],[0.889913, 0.275705, 0.392058, 1],[0.894503, 0.281934, 0.386578, 1],[0.898993, 0.288222, 0.381152, 1],[0.903381, 0.294569, 0.375781, 1],[0.907667, 0.300974, 0.370469, 1],[0.911849, 0.307435, 0.365223, 1],[0.915928, 0.313953, 0.360048, 1],[0.919902, 0.320527, 0.354948, 1],[0.923771, 0.327155, 0.349928, 1],[0.927533, 0.333838, 0.344994, 1],[0.931188, 0.340576, 0.340149, 1],[0.934736, 0.347366, 0.335403, 1],[0.938175, 0.354207, 0.330762, 1],[0.941504, 0.361101, 0.326229, 1],[0.944723, 0.368045, 0.321814, 1],[0.947831, 0.375039, 0.317523, 1],[0.950826, 0.382083, 0.313364, 1],[0.953709, 0.389175, 0.309345, 1],[0.956478, 0.396314, 0.305477, 1],[0.959133, 0.403499, 0.301766, 1],[0.961671, 0.410731, 0.298221, 1],[0.964093, 0.418008, 0.294853, 1],[0.966399, 0.425327, 0.291676, 1],[0.968586, 0.432690, 0.288696, 1],[0.970654, 0.440095, 0.285926, 1],[0.972603, 0.447540, 0.283380, 1],[0.974431, 0.455025, 0.281067, 1],[0.976139, 0.462547, 0.279003, 1],[0.977725, 0.470107, 0.277198, 1],[0.979188, 0.477703, 0.275666, 1],[0.980529, 0.485332, 0.274422, 1],[0.981747, 0.492995, 0.273476, 1],[0.982840, 0.500690, 0.272842, 1],[0.983808, 0.508415, 0.272532, 1],[0.984653, 0.516168, 0.272560, 1],[0.985373, 0.523948, 0.272937, 1],[0.985966, 0.531754, 0.273673, 1],[0.986436, 0.539582, 0.274779, 1],[0.986780, 0.547434, 0.276264, 1],[0.986998, 0.555305, 0.278135, 1],[0.987091, 0.563195, 0.280401, 1],[0.987061, 0.571100, 0.283066, 1],[0.986907, 0.579019, 0.286137, 1],[0.986629, 0.586950, 0.289615, 1],[0.986229, 0.594891, 0.293503, 1],[0.985709, 0.602839, 0.297802, 1],[0.985069, 0.610792, 0.302512, 1],[0.984310, 0.618748, 0.307632, 1],[0.983435, 0.626704, 0.313159, 1],[0.982445, 0.634657, 0.319089, 1],[0.981341, 0.642606, 0.325420, 1],[0.980130, 0.650546, 0.332144, 1],[0.978812, 0.658475, 0.339257, 1],[0.977392, 0.666391, 0.346753, 1],[0.975870, 0.674290, 0.354625, 1],[0.974252, 0.682170, 0.362865, 1],[0.972545, 0.690026, 0.371466, 1],[0.970750, 0.697856, 0.380419, 1],[0.968873, 0.705658, 0.389718, 1],[0.966921, 0.713426, 0.399353, 1],[0.964901, 0.721157, 0.409313, 1],[0.962815, 0.728851, 0.419594, 1],[0.960677, 0.736500, 0.430181, 1],[0.958490, 0.744103, 0.441070, 1],[0.956263, 0.751656, 0.452248, 1],[0.954009, 0.759153, 0.463702, 1],[0.951732, 0.766595, 0.475429, 1],[0.949445, 0.773974, 0.487414, 1],[0.947158, 0.781289, 0.499647, 1],[0.944885, 0.788535, 0.512116, 1],[0.942634, 0.795709, 0.524811, 1],[0.940423, 0.802807, 0.537717, 1],[0.938261, 0.809825, 0.550825, 1],[0.936163, 0.816760, 0.564121, 1],[0.934146, 0.823608, 0.577591, 1],[0.932224, 0.830366, 0.591220, 1],[0.930412, 0.837031, 0.604997, 1],[0.928727, 0.843599, 0.618904, 1],[0.927187, 0.850066, 0.632926, 1],[0.925809, 0.856432, 0.647047, 1],[0.924610, 0.862691, 0.661249, 1],[0.923607, 0.868843, 0.675517, 1],[0.922820, 0.874884, 0.689832, 1],[0.922265, 0.880812, 0.704174, 1],[0.921962, 0.886626, 0.718523, 1],[0.921930, 0.892323, 0.732859, 1],[0.922183, 0.897903, 0.747163, 1],[0.922741, 0.903364, 0.761410, 1],[0.923620, 0.908706, 0.775580, 1],[0.924837, 0.913928, 0.789648, 1],[0.926405, 0.919031, 0.803590, 1],[0.928340, 0.924015, 0.817381, 1],[0.930655, 0.928881, 0.830995, 1],[0.933360, 0.933631, 0.844405, 1],[0.936466, 0.938267, 0.857583, 1],[0.939982, 0.942791, 0.870499, 1],[0.943914, 0.947207, 0.883122, 1],[0.948267, 0.951519, 0.895421, 1],[0.953044, 0.955732, 0.907359, 1],[0.958246, 0.959852, 0.918901, 1],[0.963869, 0.963887, 0.930004, 1],[0.969909, 0.967845, 0.940623, 1],[0.976355, 0.971737, 0.950704, 1],[0.983195, 0.975580, 0.960181, 1],[0.990402, 0.979395, 0.968966, 1],[0.997930, 0.983217, 0.976920, 1]]
        break
      default:
        throw Error("No such colormap '" + map + "'")
    }
    return colorMap
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
    this.sampleRate = config.selectedModel.includes("bats") 
      ? 256000
      : 24000;
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
   initAll = async ({ audio = undefined, height = 0 }) => {
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
      await this.loadBuffer(audio);
    }
    DOM.colourmap.value = config.colormap;
    // Set click event that removes all REGIONS

    this.REGIONS.enableDragSelection({
      color: STATE.regionActiveColour,
    });
    const wavesurfer = this.wavesurfer;
    wavesurfer.on('load', () => wavesurfer.isReady = false)
    wavesurfer.on('ready', () => wavesurfer.isReady = true)
    wavesurfer.on("dblclick", this.centreSpec);
    wavesurfer.on("click", () => this.REGIONS.clearRegions());
    wavesurfer.on("pause", () => {
      const position =
        wavesurfer.getCurrentTime() / wavesurfer.decodedData.duration;
      // Pause event fired right before 'finish' event, so
      // this is set to signal whether it was playing up to that point
      if (position < 0.998) wavesurfer.isPaused = true;
    });
    
    wavesurfer.on("play", () => {
      if (config.selectedModel.includes('bats')) {
        wavesurfer.setPlaybackRate(0.1, false);
      }
      wavesurfer.isPaused = false;
    });

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
    await this.adjustDims(true);
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
    spectrogram && spectrogram.destroy() && this.WSPluginPurge();
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
    const colorMap = this.createColormap();
    const {windowFn:windowFunc, alpha} = config.customColormap;
    const scaleFactor = config.selectedModel.includes('bats') ? 10 : 1;
    const {frequencyMin, frequencyMax} = config.audio;
    const scaledFrequencyMin = frequencyMin * scaleFactor;
    const scaledFrequencyMax = frequencyMax * scaleFactor;
    return Spectrogram.create({
      container,
      windowFunc,
      frequencyMin: scaledFrequencyMin,
      frequencyMax: scaledFrequencyMax,
      // noverlap: 128, Auto (the default) seems fine
      // gainDB: 50, Adjusts spec brightness without increasing volume
      labels: config.specLabels,
      labelsColor: this.wsTextColour(),
      labelsBackground: "rgba(0,0,0,0)",
      height,
      fftSamples,
      scale: "linear",
      colorMap,
      alpha,
    });
  }

  reload() {
    const wavesurfer = this.wavesurfer;
    const STATE = this.getState();
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
  }
  setRange({frequencyMin, frequencyMax}){
    const spec = this.spectrogram
    frequencyMin !== undefined && (spec.frequencyMin = frequencyMin);
    frequencyMax  !== undefined && (spec.frequencyMax = frequencyMax);
    this.reload()
  }
  setColorMap(){
    const config = this.getConfig();
    const textColor = this.wsTextColour(config);
    const wavesurfer = this.wavesurfer;
    const spectrogram = this.spectrogram;
    // If the text color is not the same as the cursor color, don't change the colormap
    // this is because a full reload of the spec will be needed (calling flushSpec)
    if ( wavesurfer.options.cursorColor !== textColor ) return false
    // set colormap
    const colors = this.createColormap();
    spectrogram.colorMap = colors;
    spectrogram.alpha = config.customColormap.alpha;
    this.reload();
    return true
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
   * the audio buffer by invoking reload()  Finally, the updated FFT sample count is logged to the console.
   *
   * Side Effects:
   * - Modifies spectrogram.fftSamples and config.FFT.
   * - Logs the new FFT sample count using console.log.
   
   */
  increaseFFT() {
    const spectrogram = this.spectrogram;
    if (spectrogram.fftSamples < 2048) {
      spectrogram.fftSamples *= 2;
      this.reload();
      console.log(spectrogram.fftSamples);
      return spectrogram.fftSamples;
    }
  }

  /**
   * Halve the FFT sample count for the spectrogram when it exceeds the minimum threshold.
   *
   * This function checks if `spectrogram.fftSamples` is greater than 64. If so, the FFT sample
   * count is halved, and reload is called
   * The FFT sample count is logged to the console, and the global configuration (`config.FFT`)
   * is updated accordingly.

   * @returns {void}
   */
  reduceFFT() {
    const spectrogram = this.spectrogram;
    if (spectrogram.fftSamples > 64) {
      spectrogram.fftSamples /= 2;
      this.reload();
      console.log(spectrogram.fftSamples);
      return spectrogram.fftSamples;
    }
  }

  refreshTimeline = () => {
    const STATE = this.getState();
    const primaryLabelInterval = STATE.windowLength / 5;
    this.timeline.options.primaryLabelInterval = primaryLabelInterval;
    this.timeline.options.timeInterval = primaryLabelInterval / 10;
    this.timeline.options.style.color = this.wsTextColour();
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
    const {selectedModel} = this.getConfig();
    const { fileLoaded, currentFileDuration } = STATE;
    let { windowLength, windowOffsetSecs, activeRegion } = STATE;
    if (fileLoaded) {
      if (typeof direction !== "string") {
        // then it's an event
        direction = direction.target.closest("button").id.replace("zoom", "");
      }
      let playedSeconds = wavesurfer.getCurrentTime();
      let position = playedSeconds / windowLength;
      let timeNow = windowOffsetSecs + playedSeconds;
      const oldBufferBegin = windowOffsetSecs;
      if (direction === "In") {
        const minZoom = selectedModel.includes('bats') ? 0.05 : 0.5;
        if (windowLength < minZoom) return;
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
      this.refreshTimeline();
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
    let { windowOffsetSecs, activeRegion, currentFileDuration, windowLength} = STATE;
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
   * @returns {Promise<void>} A promise that resolves once the spectrogram and timeline update process is complete.
   */
  async updateSpec({ buffer, play = false, position = 0 }) {
    
    DOM.spectrogramWrapper.classList.remove("d-none");
    if (!this.wavesurfer) await this.adjustDims(true);
    else {
      await this.loadBuffer(buffer);
    }
    
    this.wavesurfer.seekTo(position);
    if (play) this.wavesurfer.play();
  }

  WSPluginPurge = () => {
    const wavesurfer = this.wavesurfer;
    // Destroy leaves the plugins in the plugin list.
    // So, this is needed to remove plugins where the `wavesurfer` key is not null
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
      console.error("Invalid region parameters", `start: ${start}, end: ${end}`);
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
          await this.initAll({
            audio: STATE.currentBuffer,
            height: specHeight,
          });
        } else {
          wavesurfer.setOptions({
            height: specHeight,
            cursorColor: this.wsTextColour(),
          });
          this.spectrogram.height = specHeight;
          await this.loadBuffer();
        }
      }
      specOffset = spectrogramWrapper.offsetHeight;
    }

    const footerHeight = footer.offsetHeight;
    const navHeight = navPadding.clientHeight;
    fftSamples ??= config.FFT;
    contentWrapper.style.top = navHeight.toString() + "px"; // for padding
    contentWrapper.style.height =
      (document.body.clientHeight - footerHeight - navHeight).toString() + "px";
    const contentHeight = contentWrapper.offsetHeight;
    // + 2 for padding
    const formOffset = exploreWrapper.offsetHeight;
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
      wavesurfer.options.cursorColor = this.wsTextColour();
      this.spectrogram = this.initSpectrogram('#spectrogram', height);
      wavesurfer.registerPlugin(this.spectrogram);
      this.refreshTimeline();
      this.reload();
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
    let length = end - start;
    if (length === 3) {
      return `${this.formatTimeCallback(start)} -  ${this.formatTimeCallback(
        end
      )}`;
    }
    if (length < 1){
      return `${regionLength}: ${(length * 1000).toFixed(0)}ms`;
    }
    return `${regionLength}: ${length.toFixed(3)}s`;
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
        Number(config.audio.frequencyMax) - Number(config.audio.frequencyMin);
      
      const yPosition =
        Math.round(
          (specDimensions.bottom - event.clientY) *
            (frequencyRange / specDimensions.height)
        ) + Number(config.audio.frequencyMin);
      const pitchShifted = config.selectedModel.includes('bats');
      const yPos = pitchShifted ? yPosition*10 : yPosition
      tooltip.textContent = `${i18.frequency}: ${yPos}Hz`;
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
    const now = Date.now();
    if (now - STATE.lastGestureTime < 500) {
      return; // Ignore successive events within 0.5 second
    }
    STATE.lastGestureTime = now;
    const moveDirection = e.deltaX || e.deltaY; // If deltaX is 0, use deltaY
    const key = moveDirection > 0 ? "PageDown" : "PageUp";
    config.debug && console.log(`scrolling x: ${e.deltaX} y: ${e.deltaY}`);
    this.actions[key](e);
    this.handlers.trackEvent(config.UUID, "Swipe", key, "");
  }
}


