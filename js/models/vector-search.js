import {installConsoleTracking } from "../utils/tracking.js";

let tf, i18n, DEBUG = false;
const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')
try {
  tf = require("@tensorflow/tfjs-node");
} catch {
  tf = require("@tensorflow/tfjs");
}
import abortController from '../utils/abortController.js';

/**
 * Create a database of embeddings
 *
 * 
 *
 * @param {Object} options - Training configuration options.
 * @param {Object} options.Model - Wrapper that exposes the loaded base model, utilities (e.g., getSpectrogram, loadModel), and model metadata.
 * @param {string} [options.locale] - Locale key for user-facing messages; falls back to English.
 * @param {number} options.lr - Initial learning rate.
 * @param {number} [options.batchSize=32] - Training batch size.
 * @param {number} [options.dropout] - Dropout rate applied around the optional hidden layer.
 * @param {number} options.epochs - Maximum number of training epochs.
 * @param {number} [options.hidden] - Number of units in the optional hidden dense layer of the classifier head.
 * @param {string} options.dataset - Root path containing class-labelled subfolders of audio files.
 * @param {string} [options.cache] - Folder path used for reading/writing gzipped binary dataset caches; defaults to the dataset folder.
 * @param {string} options.modelLocation - Directory where the trained model, labels.txt, and auxiliary files will be saved.
 * @param {string} [options.modelType] - If 'append', merges base-model outputs with classifier outputs when saving; otherwise saves classifier outputs.
 * @param {boolean} [options.useCache] - When true, reuse existing cached binary datasets if present.
 * @param {number} [options.validation] - Fraction (0–1) of data reserved for validation; omit or falsy to disable validation.
 * @param {boolean} [options.mixup] - When true, apply mixup augmentation to training samples.
 * @param {boolean} [options.decay] - When true, apply cosine learning-rate decay across epochs.
 * @param {boolean} [options.useWeights] - When true, apply per-class weighting to the loss based on class frequencies.
 * @param {boolean} [options.useFocal] - When true, use focal loss instead of softmax cross-entropy.
 * @param {boolean} [options.useNoise] - When true, blend background-noise samples into training batches (requires background-labelled files).
 * @param {number} [options.labelSmoothing] - Amount of label smoothing to apply (0 disables smoothing).
 * @returns {Object} A message object summarizing training results, notifications, final metrics, and the training history.
 */
async function saveEmbeddings({
    Model,
    locale,
    dataset,
    batchSize = 8,
    project,
    dbSaveLocation,
}) {
  // Check locations:
  if (!fs.existsSync(dbSaveLocation)){
    throw new Error(i18n.badSaveLocation)
  }
}

const messages = {
  en:{
    oneClass: "At least two class folders containing audio examples are needed. Only one was found.",
    badSaveLocation: "The selected model save location does not exist.",
    noAudio: `No labels folders containing audio files in:`,
    notEnoughFiles: ['Validation set is missing examples of:', "Training set is missing examples of:", 'To have both training and validation data, at least two examples are needed per class.'],
    prepTrain: "Preparing Training Data",
    prepVal: "Preparing Validation Data",
    badFile: "Error loading file",
    badLabel: "Invalid labelIndex for",
    completed: "Training completed! Model saved in",
    halted: ["Training halted at", "due to no further improvement"]
  },
  da:{
    oneClass: "Der kræves mindst to klassemapper med lydeksempler. Kun én blev fundet.",
    badSaveLocation: "Den valgte gemmeplacering for modellen findes ikke.",
    noAudio: `Ingen label-mapper med lydfiler i:`,
    notEnoughFiles: ['Valideringssættet mangler eksempler på:', "Træningssættet mangler eksempler på:", 'For at have både trænings- og valideringsdata kræves mindst to eksempler pr. klasse.'],
    prepTrain: "Forbereder træningsdata",
    prepVal: "Forbereder valideringsdata",
    badFile: "Fejl ved indlæsning af fil",
    badLabel: "Ugyldigt labelIndex for",
    completed: "Træning fuldført! Model gemt i",
    halted: ["Træning stoppet ved", "på grund af ingen yderligere forbedring"]
  },
  de:{
    oneClass: "Es werden mindestens zwei Klassenordner mit Audiobeispielen benötigt. Es wurde nur einer gefunden.",
    badSaveLocation: "Der ausgewählte Speicherort für das Modell existiert nicht.",
    noAudio: `Keine Label-Ordner mit Audiodateien in:`,
    notEnoughFiles: ['Im Validierungssatz fehlen Beispiele für:', "Im Trainingssatz fehlen Beispiele für:", 'Für Trainings- und Validierungsdaten werden mindestens zwei Beispiele pro Klasse benötigt.'],
    prepTrain: "Trainingsdaten werden vorbereitet",
    prepVal: "Validierungsdaten werden vorbereitet",
    badFile: "Fehler beim Laden der Datei",
    badLabel: "Ungültiger labelIndex für",
    completed: "Training abgeschlossen! Modell gespeichert in",
    halted: ["Training gestoppt bei", "aufgrund keiner weiteren Verbesserung"]
  },
  es:{
    oneClass: "Se necesitan al menos dos carpetas de clases con ejemplos de audio. Solo se encontró una.",
    badSaveLocation: "La ubicación seleccionada para guardar el modelo no existe.",
    noAudio: `No hay carpetas de etiquetas con archivos de audio en:`,
    notEnoughFiles: ['Al conjunto de validación le faltan ejemplos de:', "Al conjunto de entrenamiento le faltan ejemplos de:", 'Para tener datos de entrenamiento y validación se necesitan al menos dos ejemplos por clase.'],
    prepTrain: "Preparando datos de entrenamiento",
    prepVal: "Preparando datos de validación",
    badFile: "Error al cargar el archivo",
    badLabel: "labelIndex no válido para",
    completed: "¡Entrenamiento completado! Modelo guardado en",
    halted: ["Entrenamiento detenido en", "debido a que no hubo más mejoras"]
  },
  fr:{
    oneClass: "Au moins deux dossiers de classes contenant des exemples audio sont nécessaires. Un seul a été trouvé.",
    badSaveLocation: "L’emplacement sélectionné pour enregistrer le modèle n’existe pas.",
    noAudio: `Aucun dossier d’étiquettes contenant des fichiers audio dans :`,
    notEnoughFiles: ['Le jeu de validation manque d’exemples pour :', "Le jeu d’entraînement manque d’exemples pour :", 'Pour disposer de données d’entraînement et de validation, au moins deux exemples par classe sont nécessaires.'],
    prepTrain: "Préparation des données d’entraînement",
    prepVal: "Préparation des données de validation",
    badFile: "Erreur lors du chargement du fichier",
    badLabel: "labelIndex invalide pour",
    completed: "Entraînement terminé ! Modèle enregistré dans",
    halted: ["Entraînement arrêté à", "en raison de l’absence d’amélioration supplémentaire"]
  },
  ja:{
    oneClass: "音声例を含むクラスフォルダーが少なくとも2つ必要です。1つしか見つかりませんでした。",
    badSaveLocation: "選択されたモデル保存先が存在しません。",
    noAudio: `音声ファイルを含むラベルフォルダーがありません:`,
    notEnoughFiles: ['検証セットに次の例が不足しています:', "トレーニングセットに次の例が不足しています:", 'トレーニングと検証の両方のデータには、クラスごとに少なくとも2つの例が必要です。'],
    prepTrain: "トレーニングデータを準備中",
    prepVal: "検証データを準備中",
    badFile: "ファイルの読み込みエラー",
    badLabel: "無効なlabelIndex:",
    completed: "トレーニング完了！モデルの保存先:",
    halted: ["トレーニングは次の時点で停止しました", "これ以上の改善がなかったため"]
  },
  nl:{
    oneClass: "Er zijn minimaal twee klassemappen met audiovoorbeelden nodig. Er is er slechts één gevonden.",
    badSaveLocation: "De geselecteerde opslaglocatie voor het model bestaat niet.",
    noAudio: `Geen labelmappen met audiobestanden in:`,
    notEnoughFiles: ['Validatieset mist voorbeelden van:', "Trainingsset mist voorbeelden van:", 'Voor zowel trainings- als validatiegegevens zijn minimaal twee voorbeelden per klasse nodig.'],
    prepTrain: "Trainingsgegevens voorbereiden",
    prepVal: "Validatiegegevens voorbereiden",
    badFile: "Fout bij het laden van bestand",
    badLabel: "Ongeldige labelIndex voor",
    completed: "Training voltooid! Model opgeslagen in",
    halted: ["Training gestopt bij", "vanwege geen verdere verbetering"]
  },
  pt:{
    oneClass: "São necessárias pelo menos duas pastas de classes com exemplos de áudio. Apenas uma foi encontrada.",
    badSaveLocation: "O local selecionado para guardar o modelo não existe.",
    noAudio: `Não há pastas de rótulos com ficheiros de áudio em:`,
    notEnoughFiles: ['O conjunto de validação não tem exemplos de:', "O conjunto de treino não tem exemplos de:", 'Para ter dados de treino e validação, são necessários pelo menos dois exemplos por classe.'],
    prepTrain: "A preparar dados de treino",
    prepVal: "A preparar dados de validação",
    badFile: "Erro ao carregar ficheiro",
    badLabel: "labelIndex inválido para",
    completed: "Treino concluído! Modelo guardado em",
    halted: ["Treino interrompido em", "devido à ausência de melhorias adicionais"]
  },
  ru:{
    oneClass: "Требуется как минимум две папки классов с аудиопримерами. Найдена только одна.",
    badSaveLocation: "Выбранное место сохранения модели не существует.",
    noAudio: `Нет папок с метками, содержащих аудиофайлы в:`,
    notEnoughFiles: ['В наборе проверки отсутствуют примеры для:', "В обучающем наборе отсутствуют примеры для:", 'Для наличия обучающих и проверочных данных требуется не менее двух примеров на класс.'],
    prepTrain: "Подготовка обучающих данных",
    prepVal: "Подготовка данных проверки",
    badFile: "Ошибка загрузки файла",
    badLabel: "Недопустимый labelIndex для",
    completed: "Обучение завершено! Модель сохранена в",
    halted: ["Обучение остановлено на", "из-за отсутствия дальнейших улучшений"]
  },
  sv:{
    oneClass: "Minst två klassmappar med ljudexempel krävs. Endast en hittades.",
    badSaveLocation: "Den valda platsen för att spara modellen finns inte.",
    noAudio: `Inga etikettmappar med ljudfiler i:`,
    notEnoughFiles: ['Valideringsuppsättningen saknar exempel på:', "Träningsuppsättningen saknar exempel på:", 'För att ha både tränings- och valideringsdata krävs minst två exempel per klass.'],
    prepTrain: "Förbereder träningsdata",
    prepVal: "Förbereder valideringsdata",
    badFile: "Fel vid inläsning av fil",
    badLabel: "Ogiltig labelIndex för",
    completed: "Träning slutförd! Modell sparad i",
    halted: ["Träning stoppad vid", "på grund av ingen ytterligare förbättring"]
  },
  zh:{
    oneClass: "至少需要两个包含音频示例的类别文件夹。只找到一个。",
    badSaveLocation: "所选的模型保存位置不存在。",
    noAudio: `在以下位置未找到包含音频文件的标签文件夹：`,
    notEnoughFiles: ['验证集缺少以下类别的示例：', "训练集缺少以下类别的示例：", '要同时拥有训练和验证数据，每个类别至少需要两个示例。'],
    prepTrain: "正在准备训练数据",
    prepVal: "正在准备验证数据",
    badFile: "加载文件时出错",
    badLabel: "无效的labelIndex：",
    completed: "训练完成！模型已保存至",
    halted: ["训练在以下位置停止：", "由于没有进一步改进"]
  }
}
export {saveEmbeddings}