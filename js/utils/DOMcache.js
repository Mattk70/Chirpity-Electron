const DOM = {
  // Cache pattern: get fromSlider() { if (!this._fromSlider) { this._fromSlider = document.getElementById('fromSlider') } return this._fromSlider},
  // Live pattern: get fromSlider() { return document.getElementById('fromSlider')},
  get fromSlider() {
    if (!this._fromSlider) {
      this._fromSlider = document.getElementById("fromSlider");
    }
    return this._fromSlider;
  },
  get toSlider() {
    if (!this._toSlider) {
      this._toSlider = document.getElementById("toSlider");
    }
    return this._toSlider;
  },
  get fromInput() {
    if (!this._fromInput) {
      this._fromInput = document.getElementById("fromInput");
    }
    return this._fromInput;
  },
  get toInput() {
    if (!this._toInput) {
      this._toInput = document.getElementById("toInput");
    }
    return this._toInput;
  },
  get audioBitrate() {
    if (!this._audioBitrate) {
      this._audioBitrate = document.getElementById("bitrate");
    }
    return this._audioBitrate;
  },
  get audioBitrateContainer() {
    if (!this._audioBitrateContainer) {
      this._audioBitrateContainer =
        document.getElementById("bitrate-container");
    }
    return this._audioBitrateContainer;
  },
  get audioDownmix() {
    if (!this._audioDownmix) {
      this._audioDownmix = document.getElementById("downmix");
    }
    return this._audioDownmix;
  },
  get audioFade() {
    if (!this._audioFade) {
      this._audioFade = document.getElementById("fade");
    }
    return this._audioFade;
  },
  get audioFiltersIcon() {
    if (!this._audioFiltersIcon) {
      this._audioFiltersIcon = document.getElementById("audioFiltersIcon");
    }
    return this._audioFiltersIcon;
  },
  get audioFormat() {
    if (!this._audioFormat) {
      this._audioFormat = document.getElementById("format");
    }
    return this._audioFormat;
  },
  get audioPadding() {
    if (!this._audioPadding) {
      this._audioPadding = document.getElementById("padding");
    }
    return this._audioPadding;
  },
  get audioQuality() {
    if (!this._audioQuality) {
      this._audioQuality = document.getElementById("quality");
    }
    return this._audioQuality;
  },
  get audioQualityContainer() {
    if (!this._audioQualityContainer) {
      this._audioQualityContainer =
        document.getElementById("quality-container");
    }
    return this._audioQualityContainer;
  },
  get sendFilteredAudio() {
    if (!this._sendFilteredAudio) {
      this._sendFilteredAudio = document.getElementById(
        "send-filtered-audio-to-model"
      );
    }
    return this._sendFilteredAudio;
  },
  get audioNotification() {
    if (!this._audioNotification) {
      this._audioNotification = document.getElementById("audio-notification");
    }
    return this._audioNotification;
  },
  get batchSizeSlider() {
    if (!this._batchSizeSlider) {
      this._batchSizeSlider = document.getElementById("batch-size");
    }
    return this._batchSizeSlider;
  },
  get batchSizeValue() {
    if (!this._batchSizeValue) {
      this._batchSizeValue = document.getElementById("batch-size-value");
    }
    return this._batchSizeValue;
  },
  get chartsLink() {
    if (!this._chartsLink) {
      this._chartsLink = document.getElementById("charts");
    }
    return this._chartsLink;
  },
  get colourmap() {
    if (!this._colourmap) {
      this._colourmap = document.getElementById("colourmap");
    }
    return this._colourmap;
  },
  get contentWrapper() {
    if (!this._contentWrapper) {
      this._contentWrapper = document.getElementById("contentWrapper");
    }
    return this._contentWrapper;
  },
  get controlsWrapper() {
    if (!this._controlsWrapper) {
      this._controlsWrapper = document.getElementById("controlsWrapper");
    }
    return this._controlsWrapper;
  },
  get contextAware() {
    if (!this._contextAware) {
      this._contextAware = document.getElementById("context");
    }
    return this._contextAware;
  },
  get contextAwareIcon() {
    if (!this._contextAwareIcon) {
      this._contextAwareIcon = document.getElementById("context-mode");
    }
    return this._contextAwareIcon;
  },
  get debugMode() {
    if (!this._debugMode) {
      this._debugMode = document.getElementById("debug-mode");
    }
    return this._debugMode;
  },
  get defaultLat() {
    if (!this._defaultLat) {
      this._defaultLat = document.getElementById("latitude");
    }
    return this._defaultLat;
  },
  get defaultLon() {
    if (!this._defaultLon) {
      this._defaultLon = document.getElementById("longitude");
    }
    return this._defaultLon;
  },
  get exploreLink() {
    if (!this._exploreLink) {
      this._exploreLink = document.getElementById("explore");
    }
    return this._exploreLink;
  },
  get exploreWrapper() {
    if (!this._exploreWrapper) {
      this._exploreWrapper = document.getElementById("exploreWrapper");
    }
    return this._exploreWrapper;
  },
  get fileNumber() {
    if (!this._fileNumber) {
      this._fileNumber = document.getElementById("fileNumber");
    }
    return this._fileNumber;
  },
  get footer() {
    if (!this._footer) {
      this._footer = document.querySelector("footer");
    }
    return this._footer;
  },
  get HPSlider() {
    if (!this._HPSlider) {
      this._HPSlider = document.getElementById("highPassFrequency");
    }
    return this._HPSlider;
  },
  get LPSlider() {
    if (!this._LPSlider) {
      this._LPSlider = document.getElementById("lowPassFrequency");
    }
    return this._LPSlider;
  },
  get LowShelfSlider() {
    if (!this._LowShelfSlider) {
      this._LowShelfSlider = document.getElementById("lowShelfFrequency");
    }
    return this._LowShelfSlider;
  },
  get attenuation() {
    if (!this._attenuation) {
      this._attenuation = document.getElementById("attenuation");
    }
    return this._attenuation;
  },
  get gain() {
    if (!this._gain) {
      this._gain = document.getElementById("gain");
    }
    return this._gain;
  },
  get gainAdjustment() {
    if (!this._gainAdjustment) {
      this._gainAdjustment = document.getElementById("gain-adjustment");
    }
    return this._gainAdjustment;
  },
  get normalise() {
    if (!this._normalise) {
      this._normalise = document.getElementById("normalise");
    }
    return this._normalise;
  },
  get listToUse() {
    if (!this._listToUse) {
      this._listToUse = document.getElementById("list-to-use");
    }
    return this._listToUse;
  },
  get listIcon() {
    if (!this._listIcon) {
      this._listIcon = document.getElementById("list-icon");
    }
    return this._listIcon;
  },
  get loading() {
    if (!this._loading) {
      this._loading = document.getElementById("loading");
    }
    return this._loading;
  },
  get speciesThresholdEl() {
    if (!this._speciesThresholdEl) {
      this._speciesThresholdEl = document.getElementById(
        "species-threshold-el"
      );
    }
    return this._speciesThresholdEl;
  },
  get speciesWeek() {
    if (!this._speciesWeek) {
      this._speciesWeek = document.getElementById("species-week");
    }
    return this._speciesWeek;
  },
  get speciesThreshold() {
    if (!this._speciesThreshold) {
      this._speciesThreshold = document.getElementById(
        "species-frequency-threshold"
      );
    }
    return this._speciesThreshold;
  },
  get customListFile() {
    if (!this._customListFile) {
      this._customListFile = document.getElementById("custom-list-location");
    }
    return this._customListFile;
  },
  get customListSelector() {
    if (!this._customListSelector) {
      this._customListSelector = document.getElementById("list-file-selector");
    }
    return this._customListSelector;
  },
  get customListContainer() {
    if (!this._customListContainer) {
      this._customListContainer = document.getElementById(
        "choose-file-container"
      );
    }
    return this._customListContainer;
  },
  get loadingScreen() {
    if (!this._loadingScreen) {
      this._loadingScreen = document.getElementById("loading-screen");
    }
    return this._loadingScreen;
  },
  get locale() {
    if (!this._locale) {
      this._locale = document.getElementById("locale");
    }
    return this._locale;
  },
  get localSwitch() {
    if (!this._localSwitch) {
      this._localSwitch = document.getElementById("local");
    }
    return this._localSwitch;
  },
  get localSwitchContainer() {
    if (!this._localSwitchContainer) {
      this._localSwitchContainer = document.getElementById(
        "use-location-container"
      );
    }
    return this._localSwitchContainer;
  },
  get modelToUse() {
    if (!this._modelToUse) {
      this._modelToUse = document.getElementById("model-to-use");
    }
    return this._modelToUse;
  },
  get modelIcon() {
    if (!this._modelIcon) {
      this._modelIcon = document.getElementById("model-icon");
    }
    return this._modelIcon;
  },
  get navPadding() {
    if (!this._navPadding) {
      this._navPadding = document.getElementById("navPadding");
    }
    return this._navPadding;
  },
  get nocmig() {
    if (!this._nocmig) {
      this._nocmig = document.getElementById("nocmig");
    }
    return this._nocmig;
  },
  get nocmigButton() {
    if (!this._nocmigButton) {
      this._nocmigButton = document.getElementById("nocmigMode");
    }
    return this._nocmigButton;
  },
  get numberOfThreads() {
    if (!this._numberOfThreads) {
      this._numberOfThreads = document.getElementById("threads-value");
    }
    return this._numberOfThreads;
  },
  get place() {
    if (!this._place) {
      this._place = document.getElementById("place");
    }
    return this._place;
  },
  get progressDiv() {
    if (!this._progressDiv) {
      this._progressDiv = document.getElementById("progressDiv");
    }
    return this._progressDiv;
  },
  get progressBar() {
    if (!this._progressBar) {
      this._progressBar = document.getElementById("progress-bar");
    }
    return this._progressBar;
  },
  get resultTableElement() {
    if (!this._resultTableElement) {
      this._resultTableElement = document.getElementById(
        "resultTableContainer"
      );
    }
    return this._resultTableElement;
  },
  get settingsForm() {
    if (!this._settingsForm) {
      this._settingsForm = document.getElementById("settingsForm");
    }
    return this._settingsForm;
  },
  get spectrogramWrapper() {
    if (!this._spectrogramWrapper) {
      this._spectrogramWrapper = document.getElementById("spectrogramWrapper");
    }
    return this._spectrogramWrapper;
  },
  get spectrogram() {
    if (!this._spectrogram) {
      this._spectrogram = document.getElementById("spectrogram");
    }
    return this._spectrogram;
  },
  get specLabels() {
    if (!this._specLabels) {
      this._specLabels = document.getElementById("spec-labels");
    }
    return this._specLabels;
  },
  get specDetections() {
    if (!this._specDetections) {
      this._specDetections = document.getElementById("spec-detections");
    }
    return this._specDetections;
  },
  get suggestionsList() {
    if (!this._suggestionsList) {
      this._suggestionsList = document.getElementById('bird-suggestions');
    }
    return this._suggestionsList;
  },
  get summaryTable() {
    if (!this._summaryTable) {
      this._summaryTable = document.getElementById("summaryTable");
    }
    return this._summaryTable;
  },
  get threadSlider() {
    if (!this._threadSlider) {
      this._threadSlider = document.getElementById("thread-slider");
    }
    return this._threadSlider;
  },
  get timelineSetting() {
    if (!this._timelineSetting) {
      this._timelineSetting = document.getElementById("timelineSetting");
    }
    return this._timelineSetting;
  },
    get trainNav() {
    if (!this._trainNav) {
      this._trainNav = document.getElementById("navbarTraining");
    }
    return this._trainNav;
  },
  get tooltipInstance() {
    if (!this._tooltipInstance) {
      this._tooltipInstance = new bootstrap.Tooltip(
        document.getElementById("copy-uuid")
      );
    }
    return this._tooltipInstance;
  },
  get backendOptions() {
    if (!this._backendOptions) {
      this._backendOptions = document.getElementsByName("backend");
    }
    return this._backendOptions;
  },
  get buyMeCoffee() {
    return document.getElementById("bmc-wbtn");
  },
  get contextMenu() {
    return document.getElementById("context-menu");
  },
  get filename() {
    return document.getElementById("filename");
  },
  get resultHeader() {
    return document.getElementById("resultsHead");
  },
  get resultTable() {
    return document.getElementById("resultTableBody");
  },
  get tooltip() {
    return document.getElementById("tooltip");
  },
  get waveElement() {
    return document.getElementById("waveform");
  },
  get summary() {
    return document.getElementById("summary");
  },
  get specElement() {
    return document.getElementById("spectrogram");
  },
  get specCanvasElement() {
    return document.querySelector("#spectrogram canvas");
  },
  get waveCanvasElement() {
    return document.querySelector("#waveform canvas");
  },

  set summaryTable(element) {
    this._summaryTable = element;
  },
};

export { DOM };
