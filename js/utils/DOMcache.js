

const DOM = {
  // Cache pattern: get fromSlider() { return this._fromSlider ??= document.getElementById('fromSlider') },
  // Live pattern: get fromSlider() { return document.getElementById('fromSlider')},
  get fromSlider() { return this._fromSlider ??= document.getElementById("fromSlider")},
  get toSlider() { return this._toSlider ??= document.getElementById("toSlider")},
  get fromInput() { return this._fromInput ??= document.getElementById("fromInput") },
  get toInput() { return this._toInput ??= document.getElementById("toInput") },
  get audioBitrate() { return this._audioBitrate ??= document.getElementById("bitrate") },
  get audioBitrateContainer() { return this._audioBitrateContainer ??=
        document.getElementById("bitrate-container");
  },
  get audioDownmix() { return this._audioDownmix ??= document.getElementById("downmix") },
  get audioFade() { return this._audioFade ??= document.getElementById("fade") },
  get audioFiltersIcon() { return this._audioFiltersIcon ??= document.getElementById("audioFiltersIcon") },
  get audioFormat() { return this._audioFormat ??= document.getElementById("format") },
  get audioPadding() { return this._audioPadding ??= document.getElementById("padding") },
  get audioQuality() { return this._audioQuality ??= document.getElementById("quality") },
  get audioQualityContainer() { return this._audioQualityContainer ??=
        document.getElementById("quality-container")
  },
  get sendFilteredAudio() { return this._sendFilteredAudio ??= 
    document.getElementById("send-filtered-audio-to-model")
  },
  get audioNotification() { return this._audioNotification ??= document.getElementById("audio-notification") },
  get batchSizeSlider() { return this._batchSizeSlider ??= document.getElementById("batch-size") },
  get batchSizeValue() { return this._batchSizeValue ??= document.getElementById("batch-size-value") },
  get chartsLink() { return this._chartsLink ??= document.getElementById("charts") },
  get colourmap() { return this._colourmap ??= document.getElementById("colourmap") },
  get contentWrapper() { return this._contentWrapper ??= document.getElementById("contentWrapper") },
  get controlsWrapper() { return this._controlsWrapper ??= document.getElementById("controlsWrapper") },
  get contextAware() { return this._contextAware ??= document.getElementById("context") },
  get contextAwareIcon() { return this._contextAwareIcon ??= document.getElementById("context-mode") },
  get debugMode() { return this._debugMode ??= document.getElementById("debug-mode") },
  get defaultLat() { return this._defaultLat ??= document.getElementById("latitude") },
  get defaultLon() { return this._defaultLon ??= document.getElementById("longitude") },
  get exploreLink() { return this._exploreLink ??= document.getElementById("explore") },
  get exploreWrapper() { return this._exploreWrapper ??= document.getElementById("exploreWrapper") },
  get fileNumber() { return this._fileNumber ??= document.getElementById("fileNumber") },
  get footer() {return this._footer ??= document.querySelector("footer")},
  get HPSlider() { return this._HPSlider ??= document.getElementById("highPassFrequency") },
  get LPSlider() { return this._LPSlider ??= document.getElementById("lowPassFrequency") },
  get LowShelfSlider() { return this._LowShelfSlider ??= document.getElementById("lowShelfFrequency") },
  get attenuation() { return this._attenuation ??= document.getElementById("attenuation") },
  get gain() { return this._gain ??= document.getElementById("gain") },
  get gainAdjustment() { return this._gainAdjustment ??= document.getElementById("gain-adjustment") },
  get normalise() { return this._normalise ??= document.getElementById("normalise") },
  get listToUse() { return this._listToUse ??= document.getElementById("list-to-use") },
  get listIcon() { return this._listIcon ??= document.getElementById("list-icon") },
  get loading() { return this._loading ??= document.getElementById("loading") },
  get speciesThresholdEl() { return  this._speciesThresholdEl ??= 
    document.getElementById("species-threshold-el")},
  get speciesWeek() { return this._speciesWeek ??= document.getElementById("species-week") },
  get speciesThreshold() { return this._speciesThreshold ??= 
    document.getElementById("species-frequency-threshold")},
  get customListFile() { return this._customListFile ??= document.getElementById("custom-list-location") },
  get customListSelector() { return this._customListSelector ??= 
    document.getElementById("list-file-selector") },
  get customListContainer() { return this._customListContainer ??= 
    document.getElementById("choose-file-container")},
  get loadingScreen() { return this._loadingScreen ??= document.getElementById("loading-screen") },
  get locale() { return this._locale ??= document.getElementById("locale") },
  get localSwitch() { return this._localSwitch ??= document.getElementById("local") },
  get localSwitchContainer() {return this._localSwitchContainer ??= 
    document.getElementById("use-location-container")},
  get modelToUse() { return this._modelToUse ??= document.getElementById("model-to-use") },
  get modelIcon() { return this._modelIcon ??= document.getElementById("model-icon") },
  get navPadding() { return this._navPadding ??= document.getElementById("navPadding") },
  get nocmig() { return this._nocmig ??= document.getElementById("nocmig") },
  get nocmigButton() { return this._nocmigButton ??= document.getElementById("nocmigMode") },
  get numberOfThreads() { return this._numberOfThreads ??= document.getElementById("threads-value") },
  get place() { return this._place ??= document.getElementById("place") },
  get progressDiv() { return this._progressDiv ??= document.getElementById("progressDiv") },
  get progressBar() { return this._progressBar ??= document.getElementById("progress-bar") },
  get resultTableElement() { return this._resultTableElement ??= 
    document.getElementById("resultTableContainer")},
  get settingsForm() { return this._settingsForm ??= document.getElementById("settingsForm") },
  get spectrogramWrapper() { return this._spectrogramWrapper ??= document.getElementById("spectrogramWrapper") },
  get spectrogram() { return this._spectrogram ??= document.getElementById("spectrogram") },
  get specLabels() { return this._specLabels ??= document.getElementById("spec-labels") },
  get specDetections() { return this._specDetections ??= document.getElementById("spec-detections") },
  get suggestionsList() { return this._suggestionsList = document.getElementById('bird-suggestions') },
  get summaryTable() { return this._summaryTable ??= document.getElementById("summaryTable") },
  get threadSlider() { return this._threadSlider ??= document.getElementById("thread-slider") },
  get timelineSetting() { return this._timelineSetting ??= document.getElementById("timelineSetting") },
  get trainNav() { return this._trainNav ??= document.getElementById("open-training") },
  get tooltipInstance() { return this._tooltipInstance ??= 
    new bootstrap.Tooltip(document.getElementById("copy-uuid")) },
  get backendOptions() { return this._backendOptions ??= document.getElementsByName("backend") },
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
