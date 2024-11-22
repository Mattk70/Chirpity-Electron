const i18nToasts = { // UI.js
    en: {
        info: 'Information', warning: 'Warning', error: 'Error',
        maxFiles: "Chirpity limits the maximum number of open files to 25,000. Only the first 25,000 of the ${STATE.openFiles.length} attempted will be opened",
        analysisUnderway:"An analysis is underway. Press <b>Esc</b> to cancel it before running a new analysis.",
        placeOutOfBounds: "Latitude must be between -90 and 90 and longitude between -180 and 180.",
        placeNotFound: "Failed to look up this location. Please check your internet connection or try again later.",
        mustFilterSpecies: "Filter results by species to export audio files",
        noNode: "The standard backend could not be loaded on this machine. An experimental backend (webGPU) has been used instead.",
        badMessage: "Unrecognised message from worker:${args.event}",
        changeListBlocked:"It is not possible to change the list settings while an analysis is underway. However, the list <b>can</b> be changed after the analysis completes",
        cancelled: "Operation cancelled",
        badTime: "Invalid time format. Please enter time in one of the following formats: \n1. Float (for seconds) \n2. Two numbers separated by a colon (for minutes and seconds) \n3. Three numbers separated by colons (for hours, minutes, and seconds)",
        complete: "Analysis complete.",
        feedback: "Thank you, your feedback helps improve Chirpity predictions",
        contextBlocked: "It is not possible to change the context-mode settings while an analysis is underway.",
        noCallCache: "No call cache was found.",
        callCacheCleared: "The call cache was successfully cleared.",
        badThreshold: "The threshold must be a number between 0.001 and 1",
        labelFileNeeded: "You must select a label file in the list settings to use the custom language option.",
        listFileNeeded: "You need to upload a custom list for the model before using the custom list option.",
        listNotFound: 'The custom list file: ${file} could not be found, <b class="text-danger">no detections will be shown</b>.',
        leafletError: 'There was an error showing the map: ${error}',
        noXC: "The Xeno-canto API is not responding",
        noComparisons: "The Xeno-canto site has no comparisons available",
        noIUCNRecord: "There is no record of <b>${sname}</b> on the IUCN Red List.",

        badMetadata: "Unable to extract essential metadata from ${src}",
        noLoad: 'The ${model} model is not loaded. Restart Chirpity to continue. If you see this message repeatedly, it is likely your computer does not support AVX2 and Chirpity will not run on your system.',
        noDLL: 'There has been an error loading the model. This may be due to missing AVX support. Chirpity AI models require the AVX2 instructions set to run. If you have AVX2 enabled and still see this notice, please refer to <a href="https://github.com/Mattk70/Chirpity-Electron/issues/84" target="_blank">this issue</a> on Github.',
        noFile: "Cannot locate: ${file}",
        ffmpeg: 'FFMPEG error extracting audio: ${error',
        noNight: 'No detections. ${file} has no period within it where predictions would be given. <b>Tip:</b> To see detections in this file, disable nocmig mode and run the analysis again.',
        saveBlocked: "Cannot save file ${filePath}\nbecause it is open in another application",
        goodSave: '${filePath} has been written successfully.',
        noDetections: "No detections found in the selection",
        noDetectionsDetailed: 'No ${nocmig} ${species} detections found ${archive} using the ${list} list.',
        noDetectionsDetailed2: 'No detections found in ${file}. Searched for records using the ${list} list and having a minimum confidence of ${confidence}%',
        dbNotLoaded: "The database has not finished loading. The check for the presence of the file in the archive has been skipped",
        noSnameFound: "Cannot find '${sname}' (at line ${line} of the custom list) in the <strong>${model}</strong> model list. <strong>Tips:</strong> <ol><li>Is your list for the <strong>${model}</strong> model? If not, change the model in settings</li><li>Check for a typo in your species name</li></ol>",
        noArchive: "Cannot access archive location: ${location}. <br> Operation aborted",
        noWriteArchive: "Cannot write to archive location: ${location}. <br> Operation aborted",
        multiDay: "Multi-day operations are not yet supported: ${file} will not be trimmed",
        allDaylight: "${file} will not be added to the archive as it is entirely during daylight.",
        conversionDone: "Finished conversion for ${file}",
        badConversion: "Error converting file ${file}: ${error}",

        noDirectory: "Unable to locate folder '${match}'",
        dbFileMissing: "Unable to locate the saved file with any supported file extension: ${file}",
        goodResultSave: "${number} results saved to the Archive",
        NoOP: 'Records already saved, nothing to do',
        goodDBUpdate: 'Database update complete, ${total} records added to the archive in ${seconds} seconds',
        fileLocationUpdated: 'The file location was successfully updated in the Archive. Refresh the results to see the records.',
        durationMismatch: '<span class="text-danger">No changes made</span>. The selected file has a different duration to the original file.',
        duplicateFIle: '<span class="text-danger">No changes made</span>. The selected file already exists in the Archive.',
        fileUpdateError: '<span class="text-danger">An error occurred while updating the file: ${message}</span>',
        goodFilePurge: '${file} and its associated records were deleted successfully',
        failedFilePrge: '${file} was not found in in the Archive',
        fileToConvertNotFound: 'Cannot find ${file}, skipping conversion.',
        mkDirFailed: 'Failed to create directory: ${path}<br>Error: ${error}',
        conversionComplete: 'Conversion complete, ${successTotal} successful, ${failedTotal} failed.',
        libraryUpToDate: 'Library is up to date. Nothing to do'
    },
    da: {
        info: 'Besked', warning: 'Advarsel', error: 'Fejl',
        maxFiles: "Chirpity begrænser antallet af åbne filer til 25.000. Kun de første 25.000 af de ${STATE.openFiles.length} forsøgte vil blive åbnet",
        analysisUnderway: "En analyse er i gang. Tryk på <b>Esc</b> for at annullere den, før du starter en ny analyse.",
        placeOutOfBounds: "Breddegraden skal være mellem -90 og 90 og længdegraden mellem -180 og 180.",
        placeNotFound: "Kunne ikke finde denne placering. Kontroller din internetforbindelse eller prøv igen senere.",
        mustFilterSpecies: "Filtrer resultater efter arter for at eksportere lydfiler",
        noNode: "Den standard backend kunne ikke indlæses på denne maskine. En eksperimentel backend (webGPU) er blevet brugt i stedet.",
        badMessage: "Ugenkendt besked fra worker:${args.event}",
        changeListBlocked: "Det er ikke muligt at ændre listeindstillingerne, mens en analyse er i gang. Listen <b>kan</b> dog ændres, når analysen er færdig.",
        cancelled: "Handling annulleret",
        badTime: "Ugyldigt tidsformat. Indtast tid i et af følgende formater: \n1. Flydende tal (for sekunder) \n2. To tal adskilt af et kolon (for minutter og sekunder) \n3. Tre tal adskilt af kolon (for timer, minutter og sekunder)",
        complete: "Analyse fuldført.",
        feedback: "Tak, din feedback hjælper med at forbedre Chirpitys forudsigelser",
        contextBlocked: "Det er ikke muligt at ændre indstillinger for konteksttilstand, mens en analyse er i gang.",
        noCallCache: "Ingen kald-cache blev fundet.",
        callCacheCleared: "Kald-cachen blev ryddet med succes.",
        badThreshold: "Tærsklen skal være et tal mellem 0.001 og 1",
        labelFileNeeded: "Du skal vælge en etiketfil i listeindstillingerne for at bruge den tilpassede sprogindstilling.",
        listFileNeeded: "Du skal uploade en tilpasset liste til modellen, før du bruger den tilpassede listeindstilling.",
        listNotFound: 'Den brugerdefinerede listefil: ${file} blev ikke fundet, <b class="text-danger">ingen registreringer vil blive vist</b>.',
        leafletError: 'Der opstod en fejl under visning af kortet: ${error}',
        noXC: "Xeno-canto API svarer ikke",
        noComparisons: "Xeno-canto-webstedet har ingen sammenligninger tilgængelige",
        noIUCNRecord: "Der er ingen registrering af <b>${sname}</b> på IUCN's rødliste.",

        badMetadata: "Kan ikke udtrække væsentlige metadata fra ${src}",
        noLoad: 'Modellen ${model} er ikke indlæst. Genstart Chirpity for at fortsætte. Hvis du ser denne besked gentagne gange, er det sandsynligt, at din computer ikke understøtter AVX2, og Chirpity vil ikke køre på dit system.',
        noDLL: 'Der opstod en fejl ved indlæsning af modellen. Dette kan skyldes manglende AVX-understøttelse. Chirpity AI-modeller kræver AVX2-instruktionssættet for at køre. Hvis AVX2 er aktiveret, og du stadig ser denne meddelelse, skal du henvises til <a href="https://github.com/Mattk70/Chirpity-Electron/issues/84" target="_blank">denne sag</a> på Github.',
        noFile: "Kan ikke finde: ${file}",
        ffmpeg: 'FFMPEG-fejl ved udtrækning af lyd: ${error}',
        noNight: 'Ingen detektioner. ${file} har ikke noget tidsrum, hvor forudsigelser ville blive givet. <b>Tip:</b> For at se detektioner i denne fil, skal du deaktivere nocmig-tilstand og køre analysen igen.',
        saveBlocked: "Kan ikke gemme filen ${filePath}\nfordi den er åben i en anden applikation",
        goodSave: '${filePath} er blevet gemt med succes.',
        noDetections: "Ingen detektioner fundet i udvalget",
        noDetectionsDetailed: 'Ingen ${nocmig} ${species} detektioner fundet ${archive} ved brug af ${list}-listen.',
        noDetectionsDetailed2: 'Ingen detektioner fundet i ${file}. Søgte efter poster ved hjælp af ${list}-listen og med en minimumskonfidens på ${confidence}%',
        dbNotLoaded: "Databasen er ikke færdig med at indlæse. Tjekket for filens tilstedeværelse i arkivet er blevet sprunget over",
        noSnameFound: "Kan ikke finde '${sname}' (på linje ${line} i den brugerdefinerede liste) i <strong>${model}</strong>-listen. <strong>Tips:</strong> <ol><li>Er din liste til <strong>${model}</strong>-modellen? Hvis ikke, skal du ændre modellen i indstillingerne</li><li>Kontroller for en stavefejl i dit artsnavn</li></ol>",
        noArchive: "Kan ikke få adgang til arkivplaceringen: ${location}. <br> Operationen blev afbrudt",
        noWriteArchive: "Kan ikke skrive til arkivplaceringen: ${location}. <br> Operationen blev afbrudt",
        multiDay: "Flere dages operationer understøttes endnu ikke: ${file} vil ikke blive beskåret",
        allDaylight: "${file} vil ikke blive tilføjet til arkivet, da det er helt under dagslys.",
        conversionDone: "Konvertering afsluttet for ${file}",
        badConversion: "Fejl ved konvertering af filen ${file}: ${error}",

        noDirectory: "Kan ikke finde mappen '${match}'",
        dbFileMissing: "Kan ikke finde den gemte fil med en understøttet filtype: ${file}",
        goodResultSave: "${number} resultater gemt i Arkivet",
        NoOP: "Poster er allerede gemt, ingen handling nødvendig",
        goodDBUpdate: "Databaseopdatering fuldført, ${total} poster tilføjet til arkivet på ${seconds} sekunder",
        fileLocationUpdated: "Filplaceringen blev opdateret i Arkivet. Opdater resultaterne for at se posterne.",
        durationMismatch: '<span class="text-danger">Ingen ændringer foretaget</span>. Den valgte fil har en anden varighed end den oprindelige fil.',
        duplicateFIle: '<span class="text-danger">Ingen ændringer foretaget</span>. Den valgte fil findes allerede i Arkivet.',
        fileUpdateError: '<span class="text-danger">Der opstod en fejl under opdatering af filen: ${message}</span>',
        goodFilePurge: '${file} og de tilknyttede poster blev slettet med succes',
        failedFilePrge: "${file} blev ikke fundet i Arkivet",
        fileToConvertNotFound: "Kan ikke finde ${file}, springer over konvertering.",
        mkDirFailed: "Kunne ikke oprette mappen: ${path}<br>Fejl: ${error}",
        conversionComplete: "Konvertering fuldført, ${successTotal} lykkedes, ${failedTotal} fejlede.",
        libraryUpToDate: "Biblioteket er opdateret. Ingen handling nødvendig"
    },
    de: {
        info: 'Hinweis', warning: 'Warnung', error: 'Fehler',
        maxFiles: "Chirpity begrenzt die maximale Anzahl geöffneter Dateien auf 25.000. Nur die ersten 25.000 von ${STATE.openFiles.length} werden geöffnet.",
        analysisUnderway: "Eine Analyse ist im Gange. Drücken Sie <b>Esc</b>, um sie abzubrechen, bevor Sie eine neue Analyse starten.",
        placeOutOfBounds: "Die Breite muss zwischen -90 und 90 und die Länge zwischen -180 und 180 liegen.",
        placeNotFound: "Der Ort konnte nicht gefunden werden. Bitte überprüfen Sie Ihre Internetverbindung oder versuchen Sie es später erneut.",
        mustFilterSpecies: "Filtern Sie die Ergebnisse nach Arten, um Audiodateien zu exportieren.",
        noNode: "Das Standard-Backend konnte auf diesem Computer nicht geladen werden. Stattdessen wurde ein experimentelles Backend (webGPU) verwendet.",
        badMessage: "Unbekannte Nachricht vom Worker: ${args.event}",
        changeListBlocked: "Es ist nicht möglich, die Listeneinstellungen während einer laufenden Analyse zu ändern. Die Liste <b>kann</b> jedoch nach Abschluss der Analyse geändert werden.",
        cancelled: "Vorgang abgebrochen",
        badTime: "Ungültiges Zeitformat. Bitte geben Sie die Zeit in einem der folgenden Formate ein: \n1. Dezimalzahl (für Sekunden) \n2. Zwei Zahlen getrennt durch einen Doppelpunkt (für Minuten und Sekunden) \n3. Drei Zahlen getrennt durch Doppelpunkte (für Stunden, Minuten und Sekunden)",
        complete: "Analyse abgeschlossen.",
        feedback: "Vielen Dank, Ihr Feedback hilft dabei, die Vorhersagen von Chirpity zu verbessern.",
        contextBlocked: "Es ist nicht möglich, die Kontextmodus-Einstellungen während einer laufenden Analyse zu ändern.",
        noCallCache: "Kein Anruf-Cache gefunden.",
        callCacheCleared: "Der Anruf-Cache wurde erfolgreich geleert.",
        badThreshold: "Der Schwellenwert muss eine Zahl zwischen 0.001 und 1 sein.",
        labelFileNeeded: "Sie müssen eine Beschriftungsdatei in den Listeneinstellungen auswählen, um die benutzerdefinierte Sprachoption zu verwenden.",
        listFileNeeded: "Sie müssen eine benutzerdefinierte Liste für das Modell hochladen, bevor Sie die benutzerdefinierte Listenoption verwenden können.",
        listNotFound: 'Die benutzerdefinierte Listen-Datei: ${file} konnte nicht gefunden werden, <b class="text-danger">es werden keine Erkennungen angezeigt</b>.',
        leafletError: 'Beim Anzeigen der Karte ist ein Fehler aufgetreten: ${error}',
        noXC: "Die Xeno-canto-API antwortet nicht.",
        noComparisons: "Auf der Xeno-canto-Website sind keine Vergleiche verfügbar.",
        noIUCNRecord: "Es gibt keinen Eintrag für <b>${sname}</b> auf der Roten Liste der IUCN.",

        badMetadata: "Kann wesentliche Metadaten aus ${src} nicht extrahieren",
        noLoad: 'Das Modell ${model} wurde nicht geladen. Starten Sie Chirpity neu, um fortzufahren. Wenn diese Nachricht wiederholt angezeigt wird, unterstützt Ihr Computer möglicherweise kein AVX2, und Chirpity wird auf Ihrem System nicht ausgeführt.',
        noDLL: 'Beim Laden des Modells ist ein Fehler aufgetreten. Dies könnte an fehlender AVX-Unterstützung liegen. Chirpity AI-Modelle benötigen das AVX2-Instruktionsset zum Ausführen. Wenn AVX2 aktiviert ist und Sie diese Nachricht trotzdem sehen, beziehen Sie sich bitte auf <a href="https://github.com/Mattk70/Chirpity-Electron/issues/84" target="_blank">dieses Problem</a> auf Github.',
        noFile: "Kann nicht finden: ${file}",
        ffmpeg: 'FFMPEG-Fehler bei der Extraktion von Audio: ${error}',
        noNight: 'Keine Detektionen. ${file} hat keinen Zeitraum, in dem Vorhersagen gegeben würden. <b>Tip:</b> Um Detektionen in dieser Datei zu sehen, deaktivieren Sie den nocmig-Modus und führen Sie die Analyse erneut durch.',
        saveBlocked: "Kann die Datei ${filePath} nicht speichern, weil sie in einer anderen Anwendung geöffnet ist",
        goodSave: '${filePath} wurde erfolgreich gespeichert.',
        noDetections: "Keine Detektionen im Auswahlbereich gefunden",
        noDetectionsDetailed: 'Keine ${nocmig} ${species} Detektionen in ${archive} mit der ${list}-Liste gefunden.',
        noDetectionsDetailed2: 'Keine Detektionen in ${file} gefunden. Es wurde nach Einträgen mit der ${list}-Liste und einer Mindestkonfidenz von ${confidence}% gesucht.',
        dbNotLoaded: "Die Datenbank ist noch nicht vollständig geladen. Die Überprüfung auf das Vorhandensein der Datei im Archiv wurde übersprungen.",
        noSnameFound: "Kann '${sname}' (in Zeile ${line} der benutzerdefinierten Liste) nicht in der <strong>${model}</strong>-Liste finden. <strong>Tipps:</strong> <ol><li>Ist Ihre Liste für das <strong>${model}</strong>-Modell? Wenn nicht, ändern Sie das Modell in den Einstellungen</li><li>Überprüfen Sie auf Tippfehler im Artbegriff</li></ol>",
        noArchive: "Kann auf Archivstandort ${location} nicht zugreifen. <br> Vorgang abgebrochen",
        noWriteArchive: "Kann nicht in Archivstandort ${location} schreiben. <br> Vorgang abgebrochen",
        multiDay: "Mehrtägige Operationen werden noch nicht unterstützt: ${file} wird nicht beschnitten",
        allDaylight: "${file} wird nicht zum Archiv hinzugefügt, da es vollständig während des Tageslichts liegt.",
        conversionDone: "Konvertierung für ${file} abgeschlossen",
        badConversion: "Fehler bei der Konvertierung der Datei ${file}: ${error}",

        noDirectory: "Ordner '${match}' konnte nicht gefunden werden",
        dbFileMissing: "Die gespeicherte Datei mit einer unterstützten Dateiendung konnte nicht gefunden werden: ${file}",
        goodResultSave: "${number} Ergebnisse wurden im Archiv gespeichert",
        NoOP: "Datensätze bereits gespeichert, keine Aktion erforderlich",
        goodDBUpdate: "Datenbankaktualisierung abgeschlossen, ${total} Datensätze wurden in ${seconds} Sekunden zum Archiv hinzugefügt",
        fileLocationUpdated: "Der Speicherort der Datei wurde im Archiv erfolgreich aktualisiert. Aktualisieren Sie die Ergebnisse, um die Datensätze anzuzeigen.",
        durationMismatch: '<span class="text-danger">Keine Änderungen vorgenommen</span>. Die ausgewählte Datei hat eine andere Dauer als die ursprüngliche Datei.',
        duplicateFIle: '<span class="text-danger">Keine Änderungen vorgenommen</span>. Die ausgewählte Datei ist bereits im Archiv vorhanden.',
        fileUpdateError: '<span class="text-danger">Beim Aktualisieren der Datei ist ein Fehler aufgetreten: ${message}</span>',
        goodFilePurge: "${file} und die zugehörigen Datensätze wurden erfolgreich gelöscht",
        failedFilePrge: "${file} wurde im Archiv nicht gefunden",
        fileToConvertNotFound: "Kann ${file} nicht finden, Überspringe Konvertierung.",
        mkDirFailed: "Fehler beim Erstellen des Verzeichnisses: ${path}<br>Fehler: ${error}",
        conversionComplete: "Konvertierung abgeschlossen, ${successTotal} erfolgreich, ${failedTotal} fehlgeschlagen.",
        libraryUpToDate: "Die Bibliothek ist auf dem neuesten Stand. Keine Aktion erforderlich"
    },
    es: {
        info: 'Aviso', warning: 'Advertencia', error: 'Error',
        maxFiles: "Chirpity limita el número máximo de archivos abiertos a 25.000. Solo se abrirán los primeros 25.000 de los ${STATE.openFiles.length} intentados.",
        analysisUnderway: "Se está efectuando un análisis. Presione <b>Esc</b> para cancelarlo antes de iniciar un nuevo análisis.",
        placeOutOfBounds: "La latitud debe estar comprendida entre -90 y 90 y la longitud entre -180 y 180.",
        placeNotFound: "No se ha podido localizar ese lugar. Verifique su conexión a internet o inténtelo de nuevo más tarde.",
        mustFilterSpecies: "Filtre los resultados por especie para exportar archivos de audio.",
        noNode: "No se ha podido cargar el motor estándar en esta máquina. En su lugar, se ha utilizado un motor experimental (webGPU).",
        badMessage: "Mensaje no reconocido del worker: ${args.event}",
        changeListBlocked: "No es posible cambiar la configuración de la lista mientras se está realizando un análisis. No obstante, la configuración <b>sí</b> se puede cambiar después de que termine el análisis.",
        cancelled: "Operación cancelada",
        badTime: "No se admite ese formato de hora. Indíquelo de alguno de los siguientes modos: \n1. Decimal (para segundos) \n2. Dos números separados por dos puntos (para minutos y segundos) \n3. Tres números separados por dos puntos (para horas, minutos y segundos)",
        complete: "Análisis completo.",
        feedback: "Gracias, su retroalimentación ayuda a mejorar las predicciones de Chirpity.",
        contextBlocked: "No es posible cambiar la configuración del modo contexto mientras se está efectuando un análisis.",
        noCallCache: "No se ha encontrado caché de reclamos.",
        callCacheCleared: "La caché de reclamos se ha limpiado correctamente.",
        badThreshold: "El umbral debe ser un número entre 0.001 y 1.",
        labelFileNeeded: "Debe seleccionar un archivo de etiquetas en la configuración de la lista para usar la opción de idioma personalizado.",
        listFileNeeded: "Debe cargar una lista personalizada para el modelo antes de usar la opción de lista personalizada.",
        listNotFound: 'El archivo de lista personalizada: ${file} no se pudo encontrar, <b class="text-danger">no se mostrarán detecciones</b>.',
        leafletError: 'Hubo un error al mostrar el mapa: ${error}',
        noXC: "La API de Xeno-canto no responde ahora mismo.",
        noComparisons: "Parece que l sitio de Xeno-canto no tiene comparaciones disponibles.",
        noIUCNRecord: "No hay registro de <b>${sname}</b> en la Lista Roja de la UICN.",

        badMetadata: "No se pueden extraer los metadatos esenciales de ${src}",
        noLoad: 'El modelo ${model} no está cargado. Reinicie Chirpity para continuar. Si ve este mensaje repetidamente es probable que su ordenador no sea compatible con AVX2 y que Chirpity no pueda ejecutarse en su sistema.',
        noDLL: 'Ha ocurrido un error al cargar el modelo. Esto puede deberse a la falta de soporte para AVX. Los modelos de inteligencia artificial de Chirpity requieren el conjunto de instrucciones AVX2 para funcionar. Si tiene AVX2 habilitado y sigue viendo este mensaje, consulte <a href="https://github.com/Mattk70/Chirpity-Electron/issues/84" target="_blank">este problema</a> en Github.',
        noFile: "No se puede localizar: ${file}",
        ffmpeg: 'Error de FFMPEG al extraer audio: ${error}',
        noNight: 'No se encontraron detecciones. ${file} no tiene un periodo en el que se puedan hacer predicciones. <b>Consejo:</b> Para ver detecciones en este archivo desactive el modo nocmig y ejecute otra vez el análisis.',
        saveBlocked: "No se puede guardar el archivo ${filePath} porque está abierto en otra aplicación",
        goodSave: '${filePath} se ha guardado correctamente.',
        noDetections: "No se ha detectado nada en la selección",
        noDetectionsDetailed: 'No se han encontrado detecciones de ${nocmig} ${species} en ${archive} usando la lista ${list}.',
        noDetectionsDetailed2: 'No se han encontrado detecciones en ${file}. Se han buscado registros usando la lista ${list} con una confianza mínima de ${confidence}%',
        dbNotLoaded: "La base de datos no ha terminado de cargarse. Se ha omitido la comprobación de la presencia de la grabación en el archivo",
        noSnameFound: "No se puede encontrar '${sname}' (en la línea ${line} de la lista personalizada) en la lista <strong>${model}</strong>. <strong>Consejos:</strong> <ol><li>¿Está su lista para el modelo <strong>${model}</strong>? Si no es así, cambie el modelo en la configuración</li><li>Mire si hay algún error ortográfico en el nombre de la especie</li></ol>",
        noArchive: "No se puede acceder a la ubicación del archivo: ${location}. <br> Operación interrumpida",
        noWriteArchive: "No se puede escribir en la ubicación del archivo: ${location}. <br> Operación abortada",
        multiDay: "Las operaciones de varios días no son compatibles todavía: ${file} no se recortará",
        allDaylight: "${file} no se añadirá al archivo ya que se ha grabado en su totalidad de día.",
        conversionDone: "Conversión de ${file} terminada",
        badConversion: "Error al convertir el archivo ${file}: ${error}",

        noDirectory: "No se puede localizar la carpeta '${match}'",
        dbFileMissing: "No se encuentra el archivo guardado con una extensión compatible: ${file}",
        goodResultSave: "${number} resultados guardados en el Archivo",
        NoOP: "Registros ya guardados, no hay nada que hacer",
        goodDBUpdate: "Actualización de la base de datos completada, ${total} registros añadidos al archivo en ${seconds} segundos",
        fileLocationUpdated: "La ubicación del archivo se actualizó correctamente en el Archivo. Actualiza los resultados para ver los registros.",
        durationMismatch: '<span class="text-danger">No se realizaron cambios</span>. El archivo seleccionado tiene una duración diferente al archivo original.',
        duplicateFIle: '<span class="text-danger">No se realizaron cambios</span>. El archivo seleccionado ya existe en el Archivo.',
        fileUpdateError: '<span class="text-danger">Ocurrió un error al actualizar el archivo: ${message}</span>',
        goodFilePurge: "${file} y sus registros asociados fueron eliminados correctamente",
        failedFilePrge: "${file} no se encontró en el Archivo",
        fileToConvertNotFound: "No se puede encontrar ${file}, se omite la conversión.",
        mkDirFailed: "Error al crear el directorio: ${path}<br>Error: ${error}",
        conversionComplete: "Conversión completada, ${successTotal} exitosas, ${failedTotal} fallidas.",
        libraryUpToDate: "La biblioteca está actualizada. No hay nada que hacer"
    },
    fr: {
        info: 'Avis', warning: 'Avertissement', error: 'Erreur' ,
        maxFiles: "Chirpity limite le nombre maximum de fichiers ouverts à 25 000. Seuls les 25 000 premiers des ${STATE.openFiles.length} tentés seront ouverts.",
        analysisUnderway: "Une analyse est en cours. Appuyez sur <b>Échap</b> pour l'annuler avant de lancer une nouvelle analyse.",
        placeOutOfBounds: "La latitude doit être comprise entre -90 et 90 et la longitude entre -180 et 180.",
        placeNotFound: "Échec de la recherche de cet emplacement. Veuillez vérifier votre connexion Internet ou réessayer plus tard.",
        mustFilterSpecies: "Filtrez les résultats par espèce pour exporter des fichiers audio.",
        noNode: "Le backend standard n'a pas pu être chargé sur cette machine. Un backend expérimental (webGPU) a été utilisé à la place.",
        badMessage: "Message non reconnu du worker: ${args.event}",
        changeListBlocked: "Il n'est pas possible de changer les paramètres de la liste pendant qu'une analyse est en cours. Cependant, la liste <b>peut</b> être modifiée après la fin de l'analyse.",
        cancelled: "Opération annulée",
        badTime: "Format de temps invalide. Veuillez entrer l'heure dans l'un des formats suivants : \n1. Flottant (pour les secondes) \n2. Deux chiffres séparés par un deux-points (pour les minutes et les secondes) \n3. Trois chiffres séparés par des deux-points (pour les heures, les minutes et les secondes)",
        complete: "Analyse terminée.",
        feedback: "Merci, vos commentaires aident à améliorer les prédictions de Chirpity.",
        contextBlocked: "Il n'est pas possible de changer les paramètres du mode de contexte pendant qu'une analyse est en cours.",
        noCallCache: "Aucun cache d'cris trouvé.",
        callCacheCleared: "Le cache d'cris a été vidé avec succès.",
        badThreshold: "Le seuil doit être un nombre compris entre 0.001 et 1.",
        labelFileNeeded: "Vous devez sélectionner un fichier d'étiquettes dans les paramètres de la liste pour utiliser l'option de langue personnalisée.",
        listFileNeeded: "Vous devez télécharger une liste personnalisée pour le modèle avant d'utiliser l'option de liste personnalisée.",
        listNotFound: 'Le fichier de liste personnalisé : ${file} est introuvable, <b class="text-danger">aucune détection ne sera affichée</b>.',
        leafletError: 'Une erreur est survenue lors de l\'affichage de la carte : ${error}',
        noXC: "L'API Xeno-canto ne répond pas.",
        noComparisons: "Le site Xeno-canto ne propose aucune comparaison disponible.",
        noIUCNRecord: "Il n'y a aucun enregistrement de <b>${sname}</b> sur la Liste Rouge de l'UICN.",

        badMetadata: "Impossible d'extraire les métadonnées essentielles de ${src}",
        noLoad: 'Le modèle ${model} n\'est pas chargé. Redémarrez Chirpity pour continuer. Si vous voyez ce message à plusieurs reprises, il est probable que votre ordinateur ne prenne pas en charge AVX2 et Chirpity ne fonctionnera pas sur votre système.',
        noDLL: 'Une erreur est survenue lors du chargement du modèle. Cela peut être dû à un manque de prise en charge d\'AVX. Les modèles AI de Chirpity nécessitent le jeu d\'instructions AVX2 pour fonctionner. Si vous avez AVX2 activé et que vous voyez toujours cet avertissement, veuillez vous référer à <a href="https://github.com/Mattk70/Chirpity-Electron/issues/84" target="_blank">ce problème</a> sur Github.',
        noFile: "Impossible de localiser : ${file}",
        ffmpeg: 'Erreur FFMPEG lors de l\'extraction de l\'audio : ${error}',
        noNight: 'Aucune détection. ${file} ne contient pas de période où des prédictions pourraient être effectuées. <b>Astuce :</b> Pour voir les détections dans ce fichier, désactivez le mode nocmig et relancez l\'analyse.',
        saveBlocked: "Impossible de sauvegarder le fichier ${filePath}\ncar il est ouvert dans une autre application",
        goodSave: '${filePath} a été enregistré avec succès.',
        noDetections: "Aucune détection trouvée dans la sélection",
        noDetectionsDetailed: 'Aucune détection de ${nocmig} ${species} trouvée ${archive} en utilisant la liste ${list}.',
        noDetectionsDetailed2: 'Aucune détection trouvée dans ${file}. Recherche de dossiers utilisant la liste ${list} avec une confiance minimale de ${confidence}%',
        dbNotLoaded: "La base de données n'a pas encore fini de se charger. La vérification de la présence du fichier dans l'archive a été ignorée",
        noSnameFound: "Impossible de trouver '${sname}' (à la ligne ${line} de la liste personnalisée) dans la liste <strong>${model}</strong>. <strong>Conseils :</strong> <ol><li>Votre liste est-elle pour le modèle <strong>${model}</strong> ? Si ce n'est pas le cas, changez le modèle dans les paramètres</li><li>Vérifiez s'il y a une faute de frappe dans le nom de votre espèce</li></ol>",
        noArchive: "Impossible d'accéder à l'emplacement de l'archive : ${location}. <br> Opération abandonnée",
        noWriteArchive: "Impossible d'écrire dans l'emplacement de l'archive : ${location}. <br> Opération abandonnée",
        multiDay: "Les opérations multi-jours ne sont pas encore supportées : ${file} ne sera pas recadré",
        allDaylight: "${file} ne sera pas ajouté à l'archive car il est entièrement durant la journée.",
        conversionDone: "Conversion terminée pour ${file}",
        badConversion: "Erreur lors de la conversion du fichier ${file} : ${error}",

        noDirectory: "Impossible de localiser le dossier '${match}'",
        dbFileMissing: "Impossible de localiser le fichier enregistré avec une extension prise en charge : ${file}",
        goodResultSave: "${number} résultats enregistrés dans l'Archive",
        NoOP: "Enregistrements déjà sauvegardés, aucune action nécessaire",
        goodDBUpdate: "Mise à jour de la base de données terminée, ${total} enregistrements ajoutés à l'archive en ${seconds} secondes",
        fileLocationUpdated: "L'emplacement du fichier a été mis à jour avec succès dans l'Archive. Actualisez les résultats pour voir les enregistrements.",
        durationMismatch: '<span class="text-danger">Aucun changement effectué</span>. Le fichier sélectionné a une durée différente de celle du fichier original.',
        duplicateFIle: '<span class="text-danger">Aucun changement effectué</span>. Le fichier sélectionné existe déjà dans l\'Archive.',
        fileUpdateError: '<span class="text-danger">Une erreur est survenue lors de la mise à jour du fichier : ${message}</span>',
        goodFilePurge: '${file} et ses enregistrements associés ont été supprimés avec succès',
        failedFilePrge: "${file} n'a pas été trouvé dans l'Archive",
        fileToConvertNotFound: "Impossible de trouver ${file}, conversion ignorée.",
        mkDirFailed: "Échec de la création du répertoire : ${path}<br>Erreur : ${error}",
        conversionComplete: "Conversion terminée, ${successTotal} réussie(s), ${failedTotal} échouée(s).",
        libraryUpToDate: "La bibliothèque est à jour. Aucune action nécessaire"
    },
    nl: {
        info: 'Kennisgeving', warning: 'Waarschuwing', error: 'Fout',
        maxFiles: "Chirpity beperkt het maximale aantal geopende bestanden tot 25.000. Alleen de eerste 25.000 van de ${STATE.openFiles.length} pogingen worden geopend.",
        analysisUnderway: "Een analyse is bezig. Druk op <b>Esc</b> om deze te annuleren voordat je een nieuwe analyse uitvoert.",
        placeOutOfBounds: "De breedtegraad moet tussen -90 en 90 liggen en de lengtegraad tussen -180 en 180.",
        placeNotFound: "Het is niet gelukt om deze locatie op te zoeken. Controleer je internetverbinding of probeer het later opnieuw.",
        mustFilterSpecies: "Filter de resultaten op soort om audiobestanden te exporteren.",
        noNode: "De standaard backend kon niet op deze machine worden geladen. In plaats daarvan is een experimentele backend (webGPU) gebruikt.",
        badMessage: "Onherkenbaar bericht van de worker: ${args.event}",
        changeListBlocked: "Het is niet mogelijk om de lijstinstellingen te wijzigen terwijl een analyse bezig is. De lijst <b>kan</b> echter worden gewijzigd nadat de analyse is voltooid.",
        cancelled: "Operatie geannuleerd",
        badTime: "Ongeldig tijdformaat. Voer de tijd in een van de volgende formaten in: \n1. Float (voor seconden) \n2. Twee getallen gescheiden door een dubbele punt (voor minuten en seconden) \n3. Drie getallen gescheiden door dubbele punten (voor uren, minuten en seconden)",
        complete: "Analyse voltooid.",
        feedback: "Dank je, je feedback helpt Chirpity-voorspellingen te verbeteren.",
        contextBlocked: "Het is niet mogelijk om de instellingen van de context-modus te wijzigen terwijl een analyse bezig is.",
        noCallCache: "Er is geen oproepcache gevonden.",
        callCacheCleared: "De oproepcache is met succes gewist.",
        badThreshold: "De drempel moet een getal tussen 0.001 en 1 zijn.",
        labelFileNeeded: "Je moet een etiketbestand selecteren in de lijstinstellingen om de aangepaste taaloptie te gebruiken.",
        listFileNeeded: "Je moet een aangepaste lijst voor het model uploaden voordat je de aangepaste lijstoptie kunt gebruiken.",
        listNotFound: 'Het aangepaste lijstbestand: ${file} kon niet worden gevonden, <b class="text-danger">er worden geen detecties weergegeven</b>.',
        leafletError: 'Er is een fout opgetreden bij het weergeven van de kaart: ${error}',
        noXC: "De Xeno-canto API reageert niet.",
        noComparisons: "De Xeno-canto-site heeft geen vergelijkingen beschikbaar.",
        noIUCNRecord: "Er is geen record van <b>${sname}</b> op de IUCN Rode Lijst.",

        badMetadata: "Kan essentiële metadata niet extraheren uit ${src}",
        noLoad: 'Het ${model} model is niet geladen. Herstart Chirpity om door te gaan. Als je dit bericht herhaaldelijk ziet, ondersteunt je computer waarschijnlijk geen AVX2 en zal Chirpity niet op je systeem werken.',
        noDLL: 'Er is een fout opgetreden bij het laden van het model. Dit kan te maken hebben met ontbrekende AVX-ondersteuning. Chirpity AI-modellen vereisen de AVX2-instructieset om te draaien. Als je AVX2 hebt ingeschakeld en nog steeds deze melding ziet, raadpleeg dan <a href="https://github.com/Mattk70/Chirpity-Electron/issues/84" target="_blank">dit probleem</a> op Github.',
        noFile: "Kan niet lokaliseren: ${file}",
        ffmpeg: 'FFMPEG-fout bij het extraheren van audio: ${error}',
        noNight: 'Geen detecties. ${file} heeft geen periode waarin voorspellingen zouden worden gegeven. <b>Tip:</b> Om detecties in dit bestand te zien, schakel je de nocmig-modus uit en voer je de analyse opnieuw uit.',
        saveBlocked: "Kan bestand ${filePath} niet opslaan\nomdat het geopend is in een andere toepassing",
        goodSave: '${filePath} is succesvol opgeslagen.',
        noDetections: "Geen detecties gevonden in de selectie",
        noDetectionsDetailed: 'Geen ${nocmig} ${species} detecties gevonden ${archive} met de ${list} lijst.',
        noDetectionsDetailed2: 'Geen detecties gevonden in ${file}. Zocht naar records met de ${list} lijst en een minimale betrouwbaarheid van ${confidence}%',
        dbNotLoaded: "De database is nog niet volledig geladen. De controle op de aanwezigheid van het bestand in het archief is overgeslagen",
        noSnameFound: "Kan '${sname}' niet vinden (op regel ${line} van de aangepaste lijst) in de <strong>${model}</strong> lijst. <strong>Tips:</strong> <ol><li>Is je lijst voor het <strong>${model}</strong> model? Zo niet, wijzig het model in de instellingen</li><li>Controleer op typfouten in de naam van je soort</li></ol>",
        noArchive: "Kan archieflocatie niet openen: ${location}. <br> Operatie afgebroken",
        noWriteArchive: "Kan niet schrijven naar archieflocatie: ${location}. <br> Operatie afgebroken",
        multiDay: "Meerdaagse operaties worden nog niet ondersteund: ${file} zal niet worden bijgesneden",
        allDaylight: "${file} wordt niet aan het archief toegevoegd omdat het volledig tijdens de dag is.",
        conversionDone: "Conversie afgerond voor ${file}",
        badConversion: "Fout bij het converteren van bestand ${file}: ${error}",

        noDirectory: "Kan map '${match}' niet vinden",
        dbFileMissing: "Kan het opgeslagen bestand met een ondersteunde extensie niet vinden: ${file}",
        goodResultSave: "${number} resultaten opgeslagen in het Archief",
        NoOP: "Records zijn al opgeslagen, niets te doen",
        goodDBUpdate: "Database-update voltooid, ${total} records toegevoegd aan het archief in ${seconds} seconden",
        fileLocationUpdated: "De bestandslocatie is succesvol bijgewerkt in het Archief. Vernieuw de resultaten om de records te zien.",
        durationMismatch: '<span class="text-danger">Geen wijzigingen aangebracht</span>. Het geselecteerde bestand heeft een andere duur dan het originele bestand.',
        duplicateFIle: '<span class="text-danger">Geen wijzigingen aangebracht</span>. Het geselecteerde bestand bestaat al in het Archief.',
        fileUpdateError: '<span class="text-danger">Er is een fout opgetreden bij het bijwerken van het bestand: ${message}</span>',
        goodFilePurge: "${file} en de bijbehorende records zijn succesvol verwijderd",
        failedFilePrge: "${file} werd niet gevonden in het Archief",
        fileToConvertNotFound: "Kan ${file} niet vinden, conversie overgeslagen.",
        mkDirFailed: "Kan map niet aanmaken: ${path}<br>Fout: ${error}",
        conversionComplete: "Conversie voltooid, ${successTotal} succesvol, ${failedTotal} mislukt.",
        libraryUpToDate: "De bibliotheek is up-to-date. Niets te doen"
    },
    pt: {
        info: 'Informação', warning: 'Aviso', error: 'Erro',
        maxFiles: "O Chirpity limita o número máximo de arquivos abertos a 25.000. Apenas os primeiros 25.000 dos ${STATE.openFiles.length} tentados serão abertos.",
        analysisUnderway: "Uma análise está em andamento. Pressione <b>Esc</b> para cancelá-la antes de iniciar uma nova análise.",
        placeOutOfBounds: "A latitude deve estar entre -90 e 90 e a longitude entre -180 e 180.",
        placeNotFound: "Falha ao procurar esta localização. Verifique sua conexão com a internet ou tente novamente mais tarde.",
        mustFilterSpecies: "Filtre os resultados por espécie para exportar arquivos de áudio.",
        noNode: "A backend padrão não pôde ser carregada nesta máquina. Em vez disso, foi usada uma backend experimental (webGPU).",
        badMessage: "Mensagem não reconhecida do worker: ${args.event}",
        changeListBlocked: "Não é possível alterar as configurações da lista enquanto uma análise está em andamento. No entanto, a lista <b>pode</b> ser alterada após a conclusão da análise.",
        cancelled: "Operação cancelada",
        badTime: "Formato de hora inválido. Por favor, insira a hora em um dos seguintes formatos: \n1. Float (para segundos) \n2. Dois números separados por dois pontos (para minutos e segundos) \n3. Três números separados por dois pontos (para horas, minutos e segundos)",
        complete: "Análise concluída.",
        feedback: "Obrigado, seu feedback ajuda a melhorar as previsões do Chirpity.",
        contextBlocked: "Não é possível alterar as configurações do modo de contexto enquanto uma análise está em andamento.",
        noCallCache: "Nenhum cache de chamadas foi encontrado.",
        callCacheCleared: "O cache de chamadas foi limpo com sucesso.",
        badThreshold: "O limiar deve ser um número entre 0.001 e 1.",
        labelFileNeeded: "Você deve selecionar um arquivo de rótulos nas configurações da lista para usar a opção de idioma personalizado.",
        listFileNeeded: "Você precisa carregar uma lista personalizada para o modelo antes de usar a opção de lista personalizada.",
        listNotFound: 'O arquivo de lista personalizada: ${file} não foi encontrado, <b class="text-danger">nenhuma detecção será exibida</b>.',
        leafletError: 'Ocorreu um erro ao exibir o mapa: ${error}',
        noXC: "A API Xeno-canto não está respondendo.",
        noComparisons: "O site Xeno-canto não tem comparações disponíveis.",
        noIUCNRecord: "Não há registro de <b>${sname}</b> na Lista Vermelha da IUCN.",

        badMetadata: "Não foi possível extrair os metadados essenciais de ${src}",
        noLoad: 'O modelo ${model} não está carregado. Reinicie o Chirpity para continuar. Se você ver esta mensagem repetidamente, é provável que seu computador não suporte AVX2 e o Chirpity não funcionará no seu sistema.',
        noDLL: 'Ocorreu um erro ao carregar o modelo. Isso pode ser devido à falta de suporte AVX. Os modelos de IA do Chirpity exigem o conjunto de instruções AVX2 para funcionar. Se você tiver o AVX2 ativado e ainda ver este aviso, consulte <a href="https://github.com/Mattk70/Chirpity-Electron/issues/84" target="_blank">este problema</a> no Github.',
        noFile: "Não foi possível localizar: ${file}",
        ffmpeg: 'Erro FFMPEG ao extrair áudio: ${error}',
        noNight: 'Sem detecções. ${file} não possui um período dentro dele onde previsões seriam fornecidas. <b>Dica:</b> Para ver as detecções neste arquivo, desative o modo nocmig e execute a análise novamente.',
        saveBlocked: "Não foi possível salvar o arquivo ${filePath}\nporque está aberto em outro aplicativo",
        goodSave: '${filePath} foi salvo com sucesso.',
        noDetections: "Nenhuma detecção encontrada na seleção",
        noDetectionsDetailed: 'Nenhuma detecção ${nocmig} ${species} encontrada ${archive} usando a lista ${list}.',
        noDetectionsDetailed2: 'Nenhuma detecção encontrada em ${file}. Buscou por registros usando a lista ${list} com uma confiança mínima de ${confidence}%',
        dbNotLoaded: "O banco de dados não terminou de carregar. A verificação da presença do arquivo no arquivo foi ignorada",
        noSnameFound: "Não foi possível encontrar '${sname}' (na linha ${line} da lista personalizada) na lista <strong>${model}</strong>. <strong>Dicas:</strong> <ol><li>Sua lista é para o modelo <strong>${model}</strong>? Se não, altere o modelo nas configurações</li><li>Verifique se há erros de digitação no nome da espécie</li></ol>",
        noArchive: "Não foi possível acessar a localização do arquivo: ${location}. <br> Operação abortada",
        noWriteArchive: "Não foi possível gravar na localização do arquivo: ${location}. <br> Operação abortada",
        multiDay: "Operações multi-dia ainda não são suportadas: ${file} não será cortado",
        allDaylight: "${file} não será adicionado ao arquivo, pois é totalmente durante o dia.",
        conversionDone: "Conversão finalizada para ${file}",
        badConversion: "Erro ao converter o arquivo ${file}: ${error}",

        noDirectory: "Não foi possível localizar a pasta '${match}'",
        dbFileMissing: "Não foi possível localizar o arquivo salvo com uma extensão compatível: ${file}",
        goodResultSave: "${number} resultados salvos no Arquivo",
        NoOP: "Registros já salvos, nada a fazer",
        goodDBUpdate: "Atualização do banco de dados concluída, ${total} registros adicionados ao arquivo em ${seconds} segundos",
        fileLocationUpdated: "A localização do arquivo foi atualizada com sucesso no Arquivo. Atualize os resultados para ver os registros.",
        durationMismatch: '<span class="text-danger">Nenhuma alteração feita</span>. O arquivo selecionado tem uma duração diferente do arquivo original.',
        duplicateFIle: '<span class="text-danger">Nenhuma alteração feita</span>. O arquivo selecionado já existe no Arquivo.',
        fileUpdateError: '<span class="text-danger">Ocorreu um erro ao atualizar o arquivo: ${message}</span>',
        goodFilePurge: "${file} e seus registros associados foram excluídos com sucesso",
        failedFilePrge: "${file} não foi encontrado no Arquivo",
        fileToConvertNotFound: "Não foi possível encontrar ${file}, conversão ignorada.",
        mkDirFailed: "Falha ao criar o diretório: ${path}<br>Erro: ${error}",
        conversionComplete: "Conversão concluída, ${successTotal} bem-sucedida(s), ${failedTotal} falhada(s).",
        libraryUpToDate: "A biblioteca está atualizada. Nada a fazer"
    },
    ru: {
        info: 'Уведомление', warning: 'Предупреждение', error: 'Ошибка',
        maxFiles: "Chirpity ограничивает максимальное количество открытых файлов до 25000. Будут открыты только первые 25000 из ${STATE.openFiles.length} которые были запрошены при попытке открыть.",
        analysisUnderway: "Выполняется анализ. Нажмите <b>Esc</b>, чтобы отменить выполнение, прежде чем запустить новый анализ.",
        placeOutOfBounds: "Широта должна быть от -90 до 90, а долгота от -180 до 180.",
        placeNotFound: "Не удалось найти указанное местоположение. Пожалуйста, проверьте ваше интернет-соединение или попробуйте позже.",
        mustFilterSpecies: "Отфильтруйте результаты по видам для экспорта аудиофайлов.",
        noNode: "Стандартный бэкенд не удалось загрузить на этом устройстве. Вместо него был использован экспериментальный модуль (webGPU).",
        badMessage: "Неизвестное сообщение от worker: ${args.event}",
        changeListBlocked: "Невозможно изменить настройки списка во время анализа. Однако список <b>можно</b> изменить после его завершения.",
        cancelled: "Операция отменена",
        badTime: "Неверный формат времени. Пожалуйста, введите время в одном из следующих форматов: \n1. Время с плавающей точкой (в секундах) \n2. Два числа, разделенные двоеточием (для минут и секунд) \n3. Три числа, разделенные двоеточием (для часов, минут и секунд)",
        complete: "Анализ завершен.",
        feedback: "Спасибо, ваш отзыв помогает улучшить прогнозы Chirpity.",
        contextBlocked: "Во время выполнения анализа изменить настройки контекстного режима невозможно.",
        noCallCache: "Не найден кеш вызовов.",
        callCacheCleared: "Кеш вызовов успешно очищен.",
        badThreshold: "Пороговое значение должно быть числом в диапозоне от 0.001 до 1.0",
        labelFileNeeded: "Вы должны выбрать файл меток в настройках списка, чтобы использовать опцию пользовательского языка.",
        listFileNeeded: "Вам необходимо загрузить пользовательский список для модели, прежде чем использовать опцию пользовательского списка.",
        listNotFound: 'Файл пользовательского списка: ${file} не найден, <b class="text-danger">обнаружения не будут отображаться</b>.',
        leafletError: 'Произошла ошибка при отображении карты: ${error}',
        noXC: "API Xeno-canto не отвечает.",
        noComparisons: "На сайте Xeno-canto нет доступных сравнений.",
        noIUCNRecord: "Нет записи о <b>${sname}</b> в Красном списке МСОП.",

        badMetadata: "Не удалось извлечь необходимые метаданные из ${src}",
        noLoad: 'Модель ${model} не загружена. Для продолжения работы перезапустите Chirpily. Если вы постоянно видите это сообщение, скорее всего, ваш компьютер не поддерживает AVX2 и Chirpily не будет работать в вашей системе.',
        noDLL: 'Произошла ошибка при загрузке модели. Это может быть связано с отсутствием поддержки AVX. Для запуска моделей AI Chirpily требуется набор инструкций AVX2. Если у вас включен AVX2 и вы по-прежнему видите это уведомление, пожалуйста, обратитесь к <a href="https://github.com/Mattk70/Chirpity-Electron/issues/84" target="_blank">этому вопросу</a> на Github.',
        noFile: "Не удается найти: ${file}",
        ffmpeg: 'Ошибка FFMPEG при извлечении аудио: ${error}',
        noNight: 'Нет обнаружений. В ${file} нет периода, в течение которого можно было бы давать прогнозы. <b>Совет:</b> Чтобы увидеть обнаружения в этом файле, отключите режим nocmig и запустите анализ еще раз.',
        saveBlocked: "Не удается сохранить файл ${filePath}\n потому, что он открыт в другом приложении",
        goodSave: '${filePath} был успешно записан.',
        noDetections: "В выборке не найдено  никаких обнаружений",
        noDetectionsDetailed: 'Не найдено обнаружений ${nocmig} ${species} в ${archive} с использованием списка ${list}.',
        noDetectionsDetailed2: 'Не найдено обнаружеий в ${file}.  Поиск записей производился с использованием списка  ${list} с минимальной достоверностью ${confidence}%',
        dbNotLoaded: "Загрузка базы данных не завершена. Проверка наличия файла в архиве была пропущена",
        noSnameFound: "Не удалось найти '${sname}' (в строке ${line} пользовательского списка) в списке <strong>${model}</strong>. <strong>Советы:</strong> <ol><li>Подходит ли ваш список для модели <strong>${model}</strong>? Если нет, измените модель в настройках</li><li>Проверьте, нет ли опечатки в названии вашего вида</li></ol>",
        noArchive: "Не удается получить доступ к архиву: ${location}. <br> Операция прервана",
        noWriteArchive: "Не удается записать в архив по адресу: ${location}. <br> Операция прервана",
        multiDay: "Многодневные операции еще не поддерживаются: ${file} не будет обрезан",
        allDaylight: "${file} не будет добавлен в архив, так как это происходит исключительно в дневное время.",
        conversionDone: "Завершено преобразование для ${file}",
        badConversion: "Ошибка преобразования файла файла ${file}: ${error}",

        noDirectory: "Не удалось найти папку '${match}'",
        dbFileMissing: "Не удалось найти сохранённый файл с поддерживаемым расширением: ${file}",
        goodResultSave: "${number} результатов сохранено в архиве",
        NoOP: "Записи уже сохранены, действий не требуется",
        goodDBUpdate: "Обновление базы данных завершено, ${total} записей добавлено в архив за ${seconds} секунд",
        fileLocationUpdated: "Расположение файла успешно обновлено в архиве. Обновите результаты, чтобы увидеть записи.",
        durationMismatch: '<span class="text-danger">Изменений не внесено</span>. Выбранный файл имеет другую продолжительность по сравнению с оригинальным файлом.',
        duplicateFIle: '<span class="text-danger">Изменений не внесено</span>. Выбранный файл уже существует в архиве.',
        fileUpdateError: '<span class="text-danger">Произошла ошибка при обновлении файла: ${message}</span>',
        goodFilePurge: "${file} и связанные с ним записи успешно удалены",
        failedFilePrge: "${file} не найден в архиве",
        fileToConvertNotFound: "Не удалось найти ${file}, пропуск конвертации.",
        mkDirFailed: "Не удалось создать директорию: ${path}<br>Ошибка: ${error}",
        conversionComplete: "Конвертация завершена: ${successTotal} успешно, ${failedTotal} с ошибками.",
        libraryUpToDate: "Библиотека актуальна. Действий не требуется"
    },
    sv: {
        info: 'Meddelande', warning: 'Varning', error: 'Fel',
        maxFiles: "Chirpity begränsar det maximala antalet öppna filer till 25 000. Endast de första 25 000 av de ${STATE.openFiles.length} försöken kommer att öppnas.",
        analysisUnderway: "En analys pågår. Tryck på <b>Esc</b> för att avbryta den innan du kör en ny analys.",
        placeOutOfBounds: "Breddgrad måste vara mellan -90 och 90 och längdgrad mellan -180 och 180.",
        placeNotFound: "Det gick inte att hitta den här platsen. Kontrollera din internetanslutning eller försök igen senare.",
        mustFilterSpecies: "Filtrera resultaten efter art för att exportera ljudfiler.",
        noNode: "Den standardmässiga backend-tjänsten kunde inte laddas på den här maskinen. En experimentell backend (webGPU) har istället använts.",
        badMessage: "Oigenkännligt meddelande från arbetaren: ${args.event}",
        changeListBlocked: "Det går inte att ändra listinställningarna medan en analys pågår. Listan <b>kan</b> dock ändras efter att analysen är klar.",
        cancelled: "Operationen avbröts",
        badTime: "Ogiltigt tidsformat. Vänligen ange tid i ett av följande format: \n1. Flyttal (i sekunder) \n2. Två siffror separerade med kolon (för minuter och sekunder) \n3. Tre siffror separerade med kolon (för timmar, minuter och sekunder)",
        complete: "Analys klar.",
        feedback: "Tack, din feedback hjälper oss att förbättra Chirpity-prediktionerna.",
        contextBlocked: "Det går inte att ändra inställningarna för kontextläge medan en analys pågår.",
        noCallCache: "Inget samtalscache hittades.",
        callCacheCleared: "Samtalscachen har rensats.",
        badThreshold: "Tröskelvärdet måste vara ett tal mellan 0,001 och 1.",
        labelFileNeeded: "Du måste välja en etikettfil i listinställningarna för att använda alternativet för anpassat språk.",
        listFileNeeded: "Du behöver ladda upp en anpassad lista för modellen innan du använder alternativet för anpassad lista.",
        listNotFound: 'Den anpassade listfilen: ${file} kunde inte hittas, <b class="text-danger">inga detektioner kommer att visas</b>.',
        leafletError: 'Ett fel uppstod vid visning av kartan: ${error}',
        noXC: "Xeno-canto API svarar inte.",
        noComparisons: "Xeno-canto-sajten har inga jämförelser tillgängliga.",
        noIUCNRecord: "Det finns ingen post om <b>${sname}</b> i IUCN Röda listan.",

        badMetadata: "Kunde inte extrahera nödvändig metadata från ${src}",
        noLoad: 'Modellen ${model} är inte laddad. Starta om Chirpity för att fortsätta. Om du ser detta meddelande upprepade gånger, är det troligt att din dator inte stöder AVX2 och Chirpity kommer inte att fungera på ditt system.',
        noDLL: 'Det har uppstått ett fel vid inläsning av modellen. Detta kan bero på att AVX-stöd saknas. Chirpity AI-modeller kräver AVX2-instruktionsuppsättningen för att fungera. Om du har AVX2 aktiverat och fortfarande ser detta meddelande, vänligen hänvisa till <a href="https://github.com/Mattk70/Chirpity-Electron/issues/84" target="_blank">detta problem</a> på Github.',
        noFile: "Kunde inte hitta: ${file}",
        ffmpeg: 'FFMPEG-fel vid extrahering av ljud: ${error}',
        noNight: 'Inga detektioner. ${file} har ingen period inom den där förutsägelser skulle göras. <b>Tips:</b> För att se detektioner i denna fil, inaktivera nocmig-läget och kör analysen igen.',
        saveBlocked: "Kan inte spara filen ${filePath}\nför att den är öppen i ett annat program",
        goodSave: '${filePath} har skrivits framgångsrikt.',
        noDetections: "Inga detektioner hittades i urvalet",
        noDetectionsDetailed: 'Inga ${nocmig} ${species} detektioner hittades ${archive} med hjälp av ${list} listan.',
        noDetectionsDetailed2: 'Inga detektioner hittades i ${file}. Sökta efter poster med hjälp av ${list} listan och med en minimi-konfidens på ${confidence}%',
        dbNotLoaded: "Databasen har inte laddats klart. Kontroll av filens närvaro i arkivet har hoppats över",
        noSnameFound: "Kunde inte hitta '${sname}' (på rad ${line} i den anpassade listan) i <strong>${model}</strong> listan. <strong>Tips:</strong> <ol><li>Är din lista för modellen <strong>${model}</strong>? Om inte, ändra modellen i inställningarna</li><li>Kontrollera om det finns ett stavfel i artnamnet</li></ol>",
        noArchive: "Kunde inte komma åt arkivplats: ${location}. <br> Åtgärden avbröts",
        noWriteArchive: "Kunde inte skriva till arkivplats: ${location}. <br> Åtgärden avbröts",
        multiDay: "Flerdagsoperationer stöds inte än: ${file} kommer inte att trimmas",
        allDaylight: "${file} kommer inte att läggas till i arkivet eftersom det är helt under dagtid.",
        conversionDone: "Konverteringen för ${file} är klar",
        badConversion: "Fel vid konvertering av filen ${file}: ${error}",

        noDirectory: "Kunde inte hitta mappen '${match}'",
        dbFileMissing: "Kunde inte hitta den sparade filen med ett stödformat: ${file}",
        goodResultSave: "${number} resultat sparade i arkivet",
        NoOP: "Poster är redan sparade, inget att göra",
        goodDBUpdate: "Databasuppdatering klar, ${total} poster lades till i arkivet på ${seconds} sekunder",
        fileLocationUpdated: "Filens plats uppdaterades framgångsrikt i arkivet. Uppdatera resultaten för att se posterna.",
        durationMismatch: '<span class="text-danger">Inga ändringar gjorda</span>. Den valda filen har en annan längd än originalfilen.',
        duplicateFIle: '<span class="text-danger">Inga ändringar gjorda</span>. Den valda filen finns redan i arkivet.',
        fileUpdateError: '<span class="text-danger">Ett fel uppstod vid uppdatering av filen: ${message}</span>',
        goodFilePurge: "${file} och dess associerade poster raderades framgångsrikt",
        failedFilePrge: "${file} hittades inte i arkivet",
        fileToConvertNotFound: "Kan inte hitta ${file}, hoppar över konverteringen.",
        mkDirFailed: "Kunde inte skapa katalog: ${path}<br>Fel: ${error}",
        conversionComplete: "Konvertering klar, ${successTotal} lyckades, ${failedTotal} misslyckades.",
        libraryUpToDate: "Biblioteket är uppdaterat. Inget att göra"
    },
    zh: {
        info: '通知', warning: '警告', error: '错误',
        maxFiles: "Chirpity 限制最大打开文件数为 25,000。只有前 25,000 个尝试的 ${STATE.openFiles.length} 个文件会被打开。",
        analysisUnderway: "分析正在进行中。按 <b>Esc</b> 键可在运行新分析之前取消当前分析。",
        placeOutOfBounds: "纬度必须介于 -90 到 90 之间，经度必须介于 -180 到 180 之间。",
        placeNotFound: "无法查找此位置。请检查您的互联网连接或稍后再试。",
        mustFilterSpecies: "按物种过滤结果以导出音频文件。",
        noNode: "无法加载标准后端。已使用实验性后端（webGPU）替代。",
        badMessage: "来自工作线程的无法识别消息: ${args.event}",
        changeListBlocked: "在分析进行时无法更改列表设置。但可以在分析完成后更改列表。",
        cancelled: "操作已取消",
        badTime: "无效的时间格式。请输入以下格式之一：\n1. 浮动值（以秒为单位）\n2. 两个数字用冒号分隔（表示分钟和秒）\n3. 三个数字用冒号分隔（表示小时、分钟和秒）",
        complete: "分析完成。",
        feedback: "感谢您的反馈，您的意见有助于改进 Chirpity 的预测。",
        contextBlocked: "分析进行时无法更改上下文模式设置。",
        noCallCache: "未找到呼叫缓存。",
        callCacheCleared: "呼叫缓存已成功清除。",
        badThreshold: "阈值必须是 0.001 到 1 之间的数字。",
        labelFileNeeded: "必须在列表设置中选择标签文件才能使用自定义语言选项。",
        listFileNeeded: "在使用自定义列表选项之前，您需要上传一个自定义列表供模型使用。",
        listNotFound: '自定义列表文件：${file} 无法找到，<b class="text-danger">不会显示任何检测结果</b>。',
        leafletError: '显示地图时出错：${error}',
        noXC: "Xeno-canto API 没有响应。",
        noComparisons: "Xeno-canto 网站没有可用的比较。",
        noIUCNRecord: "在 IUCN 红色名录中没有关于 <b>${sname}</b> 的记录。",

        badMetadata: "无法从 ${src} 提取必要的元数据",
        noLoad: '模型 ${model} 未加载。请重新启动 Chirpity 以继续。如果您重复看到此消息，可能是您的计算机不支持 AVX2，Chirpity 将无法在您的系统上运行。',
        noDLL: '加载模型时发生错误。这可能是由于缺少 AVX 支持。Chirpity AI 模型需要 AVX2 指令集才能运行。如果您已启用 AVX2 但仍然看到此通知，请参考 <a href="https://github.com/Mattk70/Chirpity-Electron/issues/84" target="_blank">此问题</a> 以获取更多信息。',
        noFile: "无法找到: ${file}",
        ffmpeg: 'FFMPEG 提取音频时出错: ${error}',
        noNight: '没有检测到。${file} 中没有任何预测应该给出的时间段。<b>提示：</b> 若要查看此文件中的检测结果，请禁用 nocmig 模式并重新运行分析。',
        saveBlocked: "无法保存文件 ${filePath}\n因为文件正在另一个应用程序中打开",
        goodSave: '${filePath} 已成功写入。',
        noDetections: "在选择中没有检测到任何结果",
        noDetectionsDetailed: '在 ${archive} 使用 ${list} 列表没有找到 ${nocmig} ${species} 检测结果。',
        noDetectionsDetailed2: '在 ${file} 中没有找到检测结果。搜索了 ${list} 列表中符合最低置信度 ${confidence}% 的记录。',
        dbNotLoaded: "数据库尚未加载完成。跳过了检查文件是否存在于档案中的步骤",
        noSnameFound: "无法在 <strong>${model}</strong> 列表中找到 '${sname}'（位于自定义列表的第 ${line} 行）。<strong>提示：</strong><ol><li>您的列表是针对 <strong>${model}</strong> 模型的吗？如果不是，请在设置中更改模型。</li><li>检查物种名称是否有拼写错误。</li></ol>",
        noArchive: "无法访问档案位置: ${location}. <br> 操作已中止",
        noWriteArchive: "无法写入档案位置: ${location}. <br> 操作已中止",
        multiDay: "暂不支持多日操作: ${file} 将不会被修剪",
        allDaylight: "${file} 不会被添加到档案中，因为它完全是在白天进行的。",
        conversionDone: "已完成 ${file} 的转换",
        badConversion: "转换文件 ${file} 时出错: ${error}",

        noDirectory: "无法找到文件夹 '${match}'",
        dbFileMissing: "无法找到带有支持的文件扩展名的保存文件：${file}",
        goodResultSave: "${number} 个结果已保存到档案",
        NoOP: "记录已保存，无需执行任何操作",
        goodDBUpdate: "数据库更新完成，${total} 条记录已在 ${seconds} 秒内添加到档案中",
        fileLocationUpdated: "文件位置已成功更新到档案中。刷新结果以查看记录。",
        durationMismatch: '<span class="text-danger">未作任何更改</span>。选定的文件与原始文件的时长不同。',
        duplicateFIle: '<span class="text-danger">未作任何更改</span>。选定的文件已存在于档案中。',
        fileUpdateError: '<span class="text-danger">更新文件时出错：${message}</span>',
        goodFilePurge: "${file} 及其相关记录已成功删除",
        failedFilePrge: "未在档案中找到 ${file}",
        fileToConvertNotFound: "无法找到 ${file}，跳过转换。",
        mkDirFailed: "无法创建目录：${path}<br>错误：${error}",
        conversionComplete: "转换完成，成功：${successTotal}，失败：${failedTotal}。",
        libraryUpToDate: "资料库已是最新，无需操作"
    }
    
};

const i18nHeadings = {
    en: {
        position: ['Position', "Sort results by detection time"],
        time: ['Time', "Sort results by detection time"],
        species: ['Species', "Sort results by detection confidence"],
        calls: 'Calls',
        label: 'Label',
        notes: 'Notes',
        max: 'Maximum',
        detections: 'Detections',
        location: 'Location'
    },
    da: {
        position: ['Position', "Sorter resultater efter detektionstid"],
        time: ['Tid', "Sorter resultater efter detektionstid"],
        species: ['Arter', "Sorter resultater efter detektionssikkerhed"],
        calls: 'Kald',
        label: 'Etiket',
        notes: 'Noter',
        max: 'Maksimum',
        detections: 'Detektioner',
        location: "Placering"
    },
    de: {
        position: ['Position', "Ergebnisse nach Erkennungszeit sortieren"],
        time: ['Zeit', "Ergebnisse nach Erkennungszeit sortieren"],
        species: ['Arten', "Ergebnisse nach Erkennungssicherheit sortieren"],
        calls: 'Rufe',
        label: 'Etikett',
        notes: 'Notizen',
        max: 'Maximum',
        detections: 'Erkennungen',
        location: "Standort"
    },
    es: {
        position: ['Posición', "Ordenar resultados por la hora de detección"],
        time: ['Hora', "Ordenar resultados por la hora de detección"],
        species: ['Especies', "Ordenar resultados por el grado de confianza en la detección"],
        calls: 'Reclamos',
        label: 'Etiqueta',
        notes: 'Notas',
        max: 'Máximo',
        detections: 'Detecciones',
        location: "Ubicación"
    },
    fr: {
        position: ['Position', "Trier les résultats par heure de détection"],
        time: ['Temps', "Trier les résultats par heure de détection"],
        species: ['Espèces', "Trier les résultats par confiance en la détection"],
        calls: 'Appels',
        label: 'Étiquette',
        notes: 'Notes',
        max: 'Maximum',
        detections: 'Détections',
        location: "Emplacement"
    },
    nl: {
        position: ['Positie', "Sorteer resultaten op detectietijd"],
        time: ['Tijd', "Sorteer resultaten op detectietijd"],
        species: ['Soorten', "Sorteer resultaten op detectiezekerheid"],
        calls: 'Oproepen',
        label: 'Label',
        notes: 'Notities',
        max: 'Maximum',
        detections: 'Detecties',
        location: "Locatie"
    },
    pt: {
        position: ['Posição', "Ordenar resultados por tempo de detecção"],
        time: ['Tempo', "Ordenar resultados por tempo de detecção"],
        species: ['Espécies', "Ordenar resultados por confiança na detecção"],
        calls: 'Chamadas',
        label: 'Rótulo',
        notes: 'Notas',
        max: 'Máximo',
        detections: 'Detecções',
        location: "Localização"
    },
    ru: {
        position: ['Позиция', "Сортировать результаты по времени обнаружения"],
        time: ['Время', "Сортировать результаты по времени обнаружения"],
        species: ['Виды', "Сортировать результаты по уровню доверия к обнаружению"],
        calls: 'Звонки',
        label: 'Метка',
        notes: 'Заметки',
        max: 'Максимум',
        detections: 'Обнаружения',
        location:  "Местоположение"
    },
    sv: {
        position: ['Position', "Sortera resultat efter upptäcktstid"],
        time: ['Tid', "Sortera resultat efter upptäcktstid"],
        species: ['Art', "Sortera resultat efter upptäcktsförtroende"],
        calls: 'Samtal',
        label: 'Etikett',
        notes: 'Anteckningar',
        max: 'Maximum',
        detections: 'Upptäckter',
        location: "Plats"
    },
    zh: {
        position: ['位置', "按检测时间排序结果"],
        time: ['时间', "按检测时间排序结果"],
        species: ['物种', "按检测置信度排序结果"],
        calls: '调用',
        label: '标签',
        notes: '备注',
        max: '最大值',
        detections: '检测',
        location: "位置"
    }
};

const i18nHelp = {
    keyboard: {
      en: 'Keyboard Shortcuts',
      fr: 'Raccourcis clavier',
      de: 'Tastenkombinationen',
      es: 'Atajos de teclado',
      pt: 'Atalhos de teclado',
      ru: 'Горячие клавиши',
      nl: 'Sneltoetsen',
      zh: '键盘快捷键',
      sv: 'Tangentbordsgenvägar',   // Swedish
      da: 'Tastaturgenveje'         // Danish
    },
    settings: {
      en: 'Settings Help',
      fr: 'Aide des paramètres',
      de: 'Einstellungen Hilfe',
      es: 'Ayuda de configuración',
      pt: 'Ajuda de configurações',
      ru: 'Помощь по настройкам',
      nl: 'Instellingen help',
      zh: '设置帮助',
      sv: 'Inställningshjälp',       // Swedish
      da: 'Indstillinger Hjælp'     // Danish
    },
    usage: {
      en: 'Usage Guide',
      fr: 'Guide d\'utilisation',
      de: 'Benutzerhandbuch',
      es: 'Guía de uso',
      pt: 'Guia de uso',
      ru: 'Руководство пользователя',
      nl: 'Gebruikershandleiding',
      zh: '使用指南',
      sv: 'Användarguide',           // Swedish
      da: 'Brugervejledning'        // Danish
    },
    eBird: {
      en: 'eBird Record FAQ',
      fr: 'FAQ des enregistrements eBird',
      de: 'eBird Datensatz FAQ',
      es: 'Preguntas frecuentes sobre los registros de eBird',
      pt: 'FAQ de Registros do eBird',
      ru: 'Часто задаваемые вопросы о записях eBird',
      nl: 'eBird Record FAQ',
      zh: 'eBird记录常见问题',
      sv: 'eBird Poster FAQ',        // Swedish
      da: 'eBird Record FAQ'        // Danish
    },
    community: {
      en: 'Join the Chirpity Users Community',
      fr: 'Rejoindre la communauté des utilisateurs de Chirpity',
      de: 'Treten Sie der Chirpity-Benutzergemeinschaft bei',
      es: 'Únete a la comunidad de usuarios de Chirpity',
      pt: 'Junte-se à comunidade de usuários do Chirpity',
      ru: 'Присоединиться к сообществу пользователей Chirpity',
      nl: 'Word lid van de Chirpity-gebruikersgemeenschap',
      zh: '加入Chirpity用户社区',
      sv: 'Gå med i Chirpity-användargemenskapen', // Swedish
      da: 'Bliv medlem af Chirpity-brugerfællesskabet' // Danish
    }
  }
  

const i18nLocation = {
    en: [
        'Set Location', 
        'Delete Location', 
        'Pick A Saved Location', 
        'Add, Edit or Delete Location', 
        'Update ALL open files to this location'
    ],
    da: [
        'Angiv placering', 
        'Slet placering', 
        'Vælg en gemt placering', 
        'Tilføj, rediger eller slet placering', 
        'Opdater ALLE åbne filer til denne placering'
    ],
    de: [
        'Standort festlegen', 
        'Standort löschen', 
        'Gespeicherten Standort auswählen', 
        'Standort hinzufügen, bearbeiten oder löschen', 
        'Alle geöffneten Dateien auf diesen Standort aktualisieren'
    ],
    es: [
        'Establecer ubicación', 
        'Eliminar ubicación', 
        'Seleccionar una ubicación guardada', 
        'Añadir, editar o eliminar una ubicación', 
        'Actualizar TODOS los archivos abiertos a esta ubicación'
    ],
    fr: [
        'Définir l’emplacement', 
        'Supprimer l’emplacement', 
        'Choisir un emplacement enregistré', 
        'Ajouter, modifier ou supprimer un emplacement', 
        'Mettre à jour TOUS les fichiers ouverts à cet emplacement'
    ],
    nl: [
        'Locatie instellen', 
        'Locatie verwijderen', 
        'Kies een opgeslagen locatie', 
        'Locatie toevoegen, bewerken of verwijderen', 
        'Werk ALLE geopende bestanden bij naar deze locatie'
    ],
    pt: [
        'Definir localização', 
        'Excluir localização', 
        'Escolher uma localização salva', 
        'Adicionar, editar ou excluir localização', 
        'Atualizar TODOS os arquivos abertos para esta localização'
    ],
    ru: [
        'Установить местоположение', 
        'Удалить местоположение', 
        'Выбрать сохранённое местоположение', 
        'Добавить, изменить или удалить местоположение', 
        'Обновить ВСЕ открытые файлы до этого местоположения'
    ],
    sv: [
        'Ange plats', 
        'Radera plats', 
        'Välj en sparad plats', 
        'Lägg till, redigera eller radera plats', 
        'Uppdatera ALLA öppna filer till denna plats'
    ],
    zh: [
        '设置位置', 
        '删除位置', 
        '选择一个保存的位置', 
        '添加、编辑或删除位置', 
        '更新所有打开的文件到此位置'
    ]
};

const i18nContext = {
    en: {
        lastNight: 'Last Night', thisWeek: 'This Week', lastWeek: 'LastWeek', thisMonth: 'This Month', lastMonth: 'Last Month', thisYear: 'This Year', lastYear: 'Last Year',
        apply: 'Apply', cancel: 'Cancel', filter: 'Apply a date Filter',
        'nocturnal flight call': 'Nocturnal Flight Call', 'flight call': 'Flight Call', call: 'Call', song: 'Song',
        play: 'Play',
        pause: 'Pause',
        analyse: 'Analyse',
        create: 'Create', edit: 'Edit', record: 'Record',
        export: 'Export Audio Clip',
        compare: 'Compare with Reference Calls',
        delete: 'Delete Record',
        location: 'Amend File Recording Location',
        time: 'Amend File Start Time',
        frequency: 'Frequency',
        length: "Region Length",
        plural: 's'
    },
    da: {
        lastNight: 'I går nat', thisWeek: 'Denne uge', lastWeek: 'Sidste uge', thisMonth: 'Denne måned', lastMonth: 'Sidste måned', thisYear: 'Dette år', lastYear: 'Sidste år',
        apply: 'Anvend', cancel: 'Annuller', filter: 'Anvend en datofiltrering',
        'nocturnal flight call': 'Natterflyvningskald', 'flight call': 'Flyvekald', call: 'Kald', song: 'Sang',
        play: 'Afspil',
        pause: 'Pause',
        analyse: 'Analysér',
        create: 'Opret', edit: 'Rediger', record: 'post',
        export: 'Eksportér lydklip',
        compare: 'Sammenlign med referenceopkald',
        delete: 'Slet post',
        location: 'Rediger filens optagelsesplacering',
        time: 'Rediger filens starttid',
        plural: 'er',
        frequency: "Frekvens",
        length: "Regionslængde"
    },
    de: {
        lastNight: 'Letzte Nacht', thisWeek: 'Diese Woche', lastWeek: 'Letzte Woche', thisMonth: 'Dieser Monat', lastMonth: 'Letzter Monat', thisYear: 'Dieses Jahr', lastYear: 'Letztes Jahr',
        apply: 'Anwenden', cancel: 'Abbrechen', filter: 'Datumsfilter anwenden',
        'nocturnal flight call': 'Nächtlicher Flugruf', 'flight call': 'Flugruf', call: 'Ruf', song: 'Gesang',
        play: 'Abspielen',
        pause: 'Pause',
        analyse: 'Analysieren',
        create: 'Erstellen', edit: 'Bearbeiten', record: 'den Eintrag',
        export: 'Audioausschnitt exportieren',
        compare: 'Mit Referenzaufnahmen vergleichen',
        delete: 'Eintrag löschen',
        location: 'Aufnahmeort der Datei ändern',
        time: 'Startzeit der Datei ändern',
        plural: 'e',
        frequency: "Frequenz",
        length: "Regionlänge"
    },
    es: {
        lastNight: 'Anoche', thisWeek: 'Esta semana', lastWeek: 'La semana pasada', thisMonth: 'Este mes', lastMonth: 'El mes pasado', thisYear: 'Este año', lastYear: 'El año pasado',
        apply: 'Aplicar', cancel: 'Cancelar', filter: 'Aplicar un filtro de fecha',
        'nocturnal flight call': 'Reclamos de vuelo nocturno', 'flight call': 'Reclamos de vuelo', call: 'Reclamos', song: 'Canto',
        play: 'Reproducir',
        pause: 'Pausa',
        analyse: 'Analizar',
        create: 'Crear', edit: 'Editar', record: 'el registro',
        export: 'Exportar este fragmento del audio',
        compare: 'Comparar con reclamos de referencia',
        delete: 'Eliminar este registro',
        location: 'Modificar la ubicación de grabación del archivo',
        time: 'Modificar la hora de inicio del archivo',
        plural: 's',
        frequency: "Frecuencia",
        length: "Longitud de la región"
    },
    fr: {
        lastNight: 'La nuit dernière', thisWeek: 'Cette semaine', lastWeek: 'La semaine dernière', thisMonth: 'Ce mois-ci', lastMonth: 'Le mois dernier', thisYear: 'Cette année', lastYear: 'L’année dernière',
        apply: 'Appliquer', cancel: 'Annuler', filter: 'Appliquer un filtre de date',
        'nocturnal flight call': 'Cri de vol nocturne', 'flight call': 'Cri de vol', call: 'Cri', song: 'Chant',
        play: 'Lecture',
        pause: 'Pause',
        analyse: 'Analyser',
        create: 'Créer', edit: 'Modifier', record: 'l’Enregistrement',
        export: 'Exporter un extrait audio',
        compare: 'Comparer avec des appels de référence',
        delete: 'Supprimer l’enregistrement',
        location: 'Modifier l’emplacement d’enregistrement du fichier',
        time: 'Modifier l’heure de début du fichier',
        plural: 's',
        frequency: "Fréquence",
        length: "Longueur de la région"
    },
    nl: {
        lastNight: 'Gisteravond', thisWeek: 'Deze week', lastWeek: 'Vorige week', thisMonth: 'Deze maand', lastMonth: 'Vorige maand', thisYear: 'Dit jaar', lastYear: 'Vorig jaar',
        apply: 'Toepassen', cancel: 'Annuleren', filter: 'Een datumfilter toepassen',
        'nocturnal flight call': 'Nachtelijke vluchtroep', 'flight call': 'Vluchtroep', call: 'Roep', song: 'Zang',
        play: 'Afspelen',
        pause: 'Pauze',
        analyse: 'Analyseren',
        create: 'Aanmaken', edit: 'Bewerken', record: 'de Record',
        export: 'Audiofragment exporteren',
        compare: 'Vergelijk met referentieoproepen',
        delete: 'Record verwijderen',
        location: 'Opnamelocatie van bestand aanpassen',
        time: 'Starttijd van bestand aanpassen',
        plural: 'en',
        frequency: "Frequentie",
        length: "Regiolengte"
    },
    pt: {
        lastNight: 'Ontem à noite', thisWeek: 'Esta semana', lastWeek: 'Semana passada', thisMonth: 'Este mês', lastMonth: 'Mês passado', thisYear: 'Este ano', lastYear: 'Ano passado',
        apply: 'Aplicar', cancel: 'Cancelar', filter: 'Aplicar um filtro de data',
        'nocturnal flight call': 'Chamado de voo noturno', 'flight call': 'Chamado de voo', call: 'Chamado', song: 'Canto',
        play: 'Reproduzir',
        pause: 'Pausar',
        analyse: 'Analisar',
        create: 'Criar', edit: 'Editar', record: 'o Registro',
        export: 'Exportar trecho de áudio',
        compare: 'Comparar com chamadas de referência',
        delete: 'Excluir registro',
        location: 'Alterar local de gravação do arquivo',
        time: 'Alterar horário de início do arquivo',
        plural: 's',
        frequency: "Frequência",
        length: "Comprimento da região"
    },
    ru: {
        lastNight: 'Прошлой ночью', thisWeek: 'На этой неделе', lastWeek: 'На прошлой неделе', thisMonth: 'В этом месяце', lastMonth: 'В прошлом месяце', thisYear: 'В этом году', lastYear: 'В прошлом году',
        apply: 'Применить', cancel: 'Отмена', filter: 'Применить фильтр по дате',
        'nocturnal flight call': 'Ночной полётный крик', 'flight call': 'Полётный крик', call: 'Крик', song: 'Песня',        
        play: 'Воспроизвести',
        pause: 'Пауза',
        analyse: 'Анализировать',
        create: 'Создать', edit: 'Редактировать', record: 'запись',
        export: 'Экспортировать аудиофрагмент',
        compare: 'Сравнить с эталонными записями',
        delete: 'Удалить запись',
        location: 'Изменить место записи файла',
        time: 'Изменить время начала файла',
        plural: '',
        frequency: "Частота",
        length: "Длина региона"
    },
    sv: {
        lastNight: 'I går kväll', thisWeek: 'Denna vecka', lastWeek: 'Förra veckan', thisMonth: 'Denna månad', lastMonth: 'Förra månaden', thisYear: 'Det här året', lastYear: 'Förra året',
        apply: 'Tillämpa', cancel: 'Avbryt', filter: 'Tillämpa ett datumfilter',
        'nocturnal flight call': 'Nattlig flyktrop', 'flight call': 'Flyktrop', call: 'Rop', song: 'Sång',
        play: 'Spela upp',
        pause: 'Paus',
        analyse: 'Analysera',
        create: 'Skapa', edit: 'Redigera', record: 'posten',
        export: 'Exportera ljudklipp',
        compare: 'Jämför med referenssamtal',
        delete: 'Ta bort post',
        location: 'Ändra filens inspelningsplats',
        time: 'Ändra filens starttid',
        plural: 'er',
        frequency: "Frekvens",
        length: "Regionlängd"
    },
    zh: {
        lastNight: '昨晚', thisWeek: '本周', lastWeek: '上周', thisMonth: '本月', lastMonth: '上月', thisYear: '今年', lastYear: '去年',
        apply: '应用', cancel: '取消', filter: '应用日期过滤器',
        'nocturnal flight call': '夜间飞行叫声', 'flight call': '飞行叫声', call: '叫声', song: '歌声',
        play: '播放',
        pause: '暂停',
        analyse: '分析',
         create: '创建', edit: '编辑', record: '记录',
        export: '导出音频片段',
        compare: '与参考调用进行比较',
        delete: '删除记录',
        location: '修改文件录制位置',
        time: '修改文件开始时间',
        plural: '',
        frequency: "频率",
        length: "区域长度"
    }
};

const i18nForm = {
    en: {submit: 'Submit', cancel: 'Cancel', select: "Select New Date and Time:"},
    da: {submit: 'Indsend', cancel: 'Annuller', select: "Vælg ny dato og tid:"},
    de: {submit: 'Absenden', cancel: 'Abbrechen', select: "Neues Datum und Uhrzeit auswählen:"},
    es: {submit: 'Enviar', cancel: 'Cancelar', select: "Seleccionar nueva fecha y hora:"},
    fr: {submit: 'Soumettre', cancel: 'Annuler', select: "Sélectionnez une nouvelle date et heure :"},
    nl: {submit: 'Verzenden', cancel: 'Annuleren', select: "Selecteer een nieuwe datum en tijd:"},
    pt: {submit: 'Enviar', cancel: 'Cancelar', select: "Selecione uma nova data e hora:"},
    ru: {submit: 'Отправить', cancel: 'Отмена', select: "Выберите новую дату и время:"},
    sv: {submit: 'Skicka', cancel: 'Avbryt', select: "Välj nytt datum och tid:"},
    zh: {submit: '提交', cancel: '取消', select: "选择新的日期和时间："}
};

const i18nLIST_MAP = {
    en: { 
        location: 'Searching for birds in your region',
        nocturnal: 'Searching for nocturnal birds',
        birds: 'Searching for all birds',
        everything: 'Searching for everything',
        custom: 'Using a custom list'
    },
    da: {
        location: 'Søger efter fugle i din region',
        nocturnal: 'Søger efter nataktive fugle',
        birds: 'Søger efter alle fugle',
        everything: 'Søger efter alt',
        custom: 'Bruger en brugerdefineret liste'
    },
    de: {
        location: 'Suche nach Vögeln in Ihrer Region',
        nocturnal: 'Suche nach nachtaktiven Vögeln',
        birds: 'Suche nach allen Vögeln',
        everything: 'Suche nach allem',
        custom: 'Verwenden einer benutzerdefinierten Liste'
    },
    es: {
        location: 'Buscando aves de tu zona',
        nocturnal: 'Buscando paso nocturno',
        birds: 'Buscando cualquier ave identificable',
        everything: 'Buscando cualquier sonido identificable',
        custom: 'Usando una lista personalizada'
    },
    fr: {
        location: 'Recherche des oiseaux dans votre région',
        nocturnal: 'Recherche des oiseaux nocturnes',
        birds: 'Recherche de tous les oiseaux',
        everything: 'Recherche de tout',
        custom: 'Utilisation d\'une liste personnalisée'
    },
    it: {
        location: 'Cercando uccelli nella tua regione',
        nocturnal: 'Cercando uccelli notturni',
        birds: 'Cercando tutti gli uccelli',
        everything: 'Cercando tutto',
        custom: 'Uso di una lista personalizzata'
    },
    nl: {
        location: 'Zoeken naar vogels in uw regio',
        nocturnal: 'Zoeken naar nachtelijke vogels',
        birds: 'Zoeken naar alle vogels',
        everything: 'Zoeken naar alles',
        custom: 'Gebruik van een aangepaste lijst'
    },
    pl: {
        location: 'Szukam ptaków w twoim regionie',
        nocturnal: 'Szukam ptaków nocnych',
        birds: 'Szukam wszystkich ptaków',
        everything: 'Szukam wszystkiego',
        custom: 'Używanie niestandardowej listy'
    },
    pt: {
        location: 'Procurando pássaros na sua região',
        nocturnal: 'Procurando pássaros noturnos',
        birds: 'Procurando todos os pássaros',
        everything: 'Procurando tudo',
        custom: 'Usando uma lista personalizada'
    },
    ru: {
        location: 'Поиск птиц в вашем регионе',
        nocturnal: 'Поиск ночных птиц',
        birds: 'Поиск всех птиц',
        everything: 'Поиск всего',
        custom: 'Использование пользовательского списка'
    },
    sv: {
        location: 'Söker efter fåglar i din region',
        nocturnal: 'Söker efter nattaktiva fåglar',
        birds: 'Söker efter alla fåglar',
        everything: 'Söker efter allt',
        custom: 'Använder en anpassad lista'
    },
    zh: {
        location: '正在寻找您所在地区的鸟类',
        nocturnal: '正在寻找夜间活动的鸟类',
        birds: '正在寻找所有鸟类',
        everything: '正在寻找一切',
        custom: '使用自定义列表'
    }
};



const i18nTitles = {
    da: {
        "filename": "Højreklik for at opdatere filens starttid eller placering",
        "controlsWrapper": "Træk for at ændre størrelsen på spektrogramvinduet.",
        "playToggle": "Afspil / Pause (Mellemrumstasten)",
        "zoomIn": "Zoom ind på spektrogrammet (Genvejstast: +)",
        "zoomOut": "Zoom ud på spektrogrammet (Genvejstast: -)",    "nocmigOn": "Nocmig-tilstand aktiveret",
        "nocmigOff": "Nocmig-tilstand deaktiveret",
        "audioFiltersOn": "Lydfiltre anvendt",
        "audioFiltersOff": "Ingen lydfiltre",
        "contextModeOn": "Kontekstafhængig tilstand aktiveret",
        "contextModeOff": "Kontekstafhængig tilstand deaktiveret",
        "frequency-range": "Juster spektrogrammets frekvensområde",
        "threshold-value": "Grænseværdi for forudsigelsestillid",
        "clear-custom-list": "Ryd brugerdefineret liste"
      },
    de: {
        "filename": "Rechtsklick, um die Startzeit oder den Speicherort der Datei zu aktualisieren",
        "controlsWrapper": "Ziehen, um das Spektrogrammfenster zu ändern.",
        "playToggle": "Abspielen / Pause (Leertaste)",
        "zoomIn": "Ins Spektrogramm zoomen (Tastenkürzel: +)",
        "zoomOut": "Aus dem Spektrogramm herauszoomen (Tastenkürzel: -)",
        "nocmigOn": "Nocmig-Modus aktiviert",
        "nocmigOff": "Nocmig-Modus deaktiviert",
        "audioFiltersOn": "Audiofilter angewendet",
        "audioFiltersOff": "Keine Audiofilter",
        "contextModeOn": "Kontextbewusster Modus aktiviert",
        "contextModeOff": "Kontextbewusster Modus deaktiviert",
        "frequency-range": "Frequenzbereich des Spektrogramms anpassen",
        "threshold-value": "Schwellenwert für Vorhersagevertrauen",
        "clear-custom-list": "Benutzerdefinierte Liste löschen"
      },
    en: {
        "filename":"Context-click to update file start time or location",
      "controlsWrapper": "Drag to resize the Spectrogram window.",
      "playToggle": "Play / Pause (SpaceBar)",
      "zoomIn": "Zoom into the spectrogram (Keyboard Shortcut: + key)",
      "zoomOut": "Zoom out of the spectrogram (Keyboard Shortcut: - key)",
      "nocmigMode": "Nocmig mode on",
      "audioFiltersOn": "Audio filters applied",
      "audioFiltersOff": "No Audio filters",
      "contextModeOn": "Context Mode enabled",
      "contextModeOff": "Context Mode disabled",
      "context-mode": "Context Aware mode enabled",
      "frequency-range": "Adjust spectrogram frequency range",
      "threshold-value": "Prediction confidence threshold",
      "clear-custom-list": "Clear custom list"
    },
    es: {
        "filename": "Haz clic derecho para actualizar la hora de inicio o la ubicación del archivo",
      "controlsWrapper": "Arrastra para cambiar el tamaño de la ventana del sonograma.",
      "playToggle": "Reproducir / Pausa (Barra espaciadora)",
      "zoomIn": "Acercar el sonograma (Atajo de teclado: tecla +)",
      "zoomOut": "Alejar el sonograma (Atajo de teclado: tecla -)",
      "nocmigOn": "Modo Nocmig activado",
      "nocmigOff": "Modo Nocmig desactivado",
      "audioFiltersOn": "Filtros de audio aplicados",
      "audioFiltersOff": "Sin filtros de audio",
      "contextModeOn": "Modo contexto activado",
      "contextModeOff": "Modo contexto desactivado",
      "frequency-range": "Ajustar el rango de frecuencias del sonograma",
      "threshold-value": "Umbral de confianza de la predicción",
      "clear-custom-list": "Borrar lista personalizada"
    },
    fr: {
        "filename": "Clic droit pour mettre à jour l'heure de début ou l'emplacement du fichier",
      "controlsWrapper": "Faites glisser pour redimensionner la fenêtre du spectrogramme.",
      "playToggle": "Lecture / Pause (Barre d'espace)",
      "zoomIn": "Zoomer sur le spectrogramme (Raccourci clavier : touche +)",
      "zoomOut": "Dézoomer sur le spectrogramme (Raccourci clavier : touche -)",
      "nocmigOn": "Mode Nocmig activé",
      "nocmigOff": "Mode Nocmig désactivé",
      "audioFiltersOn": "Filtres audio appliqués",
      "audioFiltersOff": "Pas de filtres audio",
      "contextModeOn": "Mode contextuel activé",
      "contextModeOff": "Mode contextuel désactivé",
      "frequency-range": "Ajuster la plage de fréquences du spectrogramme",
      "threshold-value": "Seuil de confiance pour les prédictions",
      "clear-custom-list": "Effacer la liste personnalisée"
    },
    nl: {
        "filename": "Klik met de rechtermuisknop om de starttijd of locatie van het bestand bij te werken",
        "controlsWrapper": "Sleep om het spectrogramvenster te vergroten of verkleinen.",
        "playToggle": "Afspelen / Pauzeren (Spatiebalk)",
        "zoomIn": "Inzoomen op het spectrogram (Sneltoets: + toets)",
        "zoomOut": "Uitzoomen op het spectrogram (Sneltoets: - toets)",
        "nocmigOn": "Nocmig-modus ingeschakeld",
        "nocmigOff": "Nocmig-modus uitgeschakeld",
        "audioFiltersOn": "Audiostanden toegepast",
        "audioFiltersOff": "Geen audiostanden",
        "contextModeOn": "Contextbewuste modus ingeschakeld",
        "contextModeOff": "Contextbewuste modus uitgeschakeld",
        "frequency-range": "Frequentiebereik van het spectrogram aanpassen",
        "threshold-value": "Drempelwaarde voor voorspelling",
        "clear-custom-list": "Aangepaste lijst wissen"
      },
    pt: {
        "filename": "Clique com o botão direito para atualizar o horário de início ou o local do arquivo",
        "controlsWrapper": "Arraste para redimensionar a janela do espectrograma.",
        "playToggle": "Reproduzir / Pausar (Tecla Espaço)",
        "zoomIn": "Aproximar no espectrograma (Atalho: tecla +)",
        "zoomOut": "Afastar no espectrograma (Atalho: tecla -)",
        "nocmigOn": "Modo Nocmig ativado",
        "nocmigOff": "Modo Nocmig desativado",
        "audioFiltersOn": "Filtros de áudio aplicados",
        "audioFiltersOff": "Sem filtros de áudio",
        "contextModeOn": "Modo contextual ativado",
        "contextModeOff": "Modo contextual desativado",
        "frequency-range": "Ajustar o intervalo de frequência do espectrograma",
        "threshold-value": "Limite de confiança da previsão",
        "clear-custom-list": "Limpar lista personalizada"
      },
    ru: {
        "filename": "Щелкните правой кнопкой мыши, чтобы обновить время начала или местоположение файла",
        "controlsWrapper": "Перетащите, чтобы изменить размер окна спектрограммы.",
        "playToggle": "Воспроизведение / Пауза (Пробел)",
        "zoomIn": "Увеличить спектрограмму (Горячая клавиша: +)",
        "zoomOut": "Уменьшить спектрограмму (Горячая клавиша: -)",
        "nocmigOn": "Режим Nocmig включён",
        "nocmigOff": "Режим Nocmig выключен",
        "audioFiltersOn": "Применены аудиофильтры",
        "audioFiltersOff": "Аудиофильтры отсутствуют",
        "contextModeOn": "Контекстный режим включён",
        "contextModeOff": "Контекстный режим выключен",
        "frequency-range": "Настройте диапазон частот спектрограммы",
        "threshold-value": "Порог уверенности в прогнозе",
        "clear-custom-list": "Очистить пользовательский список"
    },
    sv: {
        "filename": "Högerklicka för att uppdatera filens starttid eller plats",
        "controlsWrapper": "Dra för att ändra storlek på spektrogramfönstret.",
        "playToggle": "Spela / Pausa (Mellanslag)",
        "zoomIn": "Zooma in på spektrogrammet (Kortkommando: +)",
        "zoomOut": "Zooma ut på spektrogrammet (Kortkommando: -)",
        "nocmigOn": "Nocmig-läge på",
        "nocmigOff": "Nocmig-läge av",
        "audioFiltersOn": "Ljudfilter aktiverade",
        "audioFiltersOff": "Inga ljudfilter",
        "contextModeOn": "Kontextmedvetet läge aktiverat",
        "contextModeOff": "Kontextmedvetet läge avaktiverat",
        "frequency-range": "Justera spektrogrammets frekvensomfång",
        "threshold-value": "Tröskel för förutsägelseförtroende",
        "clear-custom-list": "Rensa anpassad lista"
    },
    zh: {
        "filename": "右键单击以更新文件的开始时间或位置",
      "controlsWrapper": "拖动以调整光谱窗口的大小。",
      "playToggle": "播放 / 暂停（空格键）",
      "zoomIn": "放大光谱图（快捷键：+ 键）",
      "zoomOut": "缩小光谱图（快捷键：- 键）",
      "nocmigOn": "Nocmig 模式已开启",
      "nocmigOff": "Nocmig 模式已关闭",
      "audioFiltersOn": "已应用音频过滤器",
      "audioFiltersOff": "无音频过滤器",
      "contextModeOn": "上下文感知模式已启用",
      "contextModeOff": "上下文感知模式已禁用",
      "frequency-range": "调整光谱图的频率范围",
      "threshold-value": "预测置信度阈值",
      "clear-custom-list": "清除自定义列表"
    },
    it: { // random! But will leave in. Italian
        "filename": "Fai clic destro per aggiornare l'ora di inizio o la posizione del file",
        "controlsWrapper": "Trascina per ridimensionare la finestra dello spettrogramma.",
        "playToggle": "Riproduci / Pausa (Barra spaziatrice)",
        "zoomIn": "Ingrandisci lo spettrogramma (Scorciatoia: tasto +)",
        "zoomOut": "Riduci lo spettrogramma (Scorciatoia: tasto -)",
        "nocmigOn": "Modalità Nocmig attivata",
        "nocmigOff": "Modalità Nocmig disattivata",
        "audioFiltersOn": "Filtri audio applicati",
        "audioFiltersOff": "Nessun filtro audio",
        "contextModeOn": "Modalità contestuale abilitata",
        "contextModeOff": "Modalità contestuale disabilitata",
        "frequency-range": "Regola l'intervallo di frequenza dello spettrogramma",
        "threshold-value": "Soglia di confidenza della previsione",
        "clear-custom-list": "Cancella lista personalizzata"
    },
    pl: { // Also random! Polish
        "filename": "Kliknij prawym przyciskiem myszy, aby zaktualizować czas rozpoczęcia lub lokalizację pliku",
      "controlsWrapper": "Przeciągnij, aby zmienić rozmiar okna spektrogramu.",
      "playToggle": "Odtwórz / Pauza (Spacja)",
      "zoomIn": "Powiększ spektrogram (Skrót klawiaturowy: klawisz +)",
      "zoomOut": "Pomniejsz spektrogram (Skrót klawiaturowy: klawisz -)",
      "nocmigOn": "Tryb Nocmig włączony",
      "nocmigOff": "Tryb Nocmig wyłączony",
      "audioFiltersOn": "Zastosowano filtry audio",
      "audioFiltersOff": "Brak filtrów audio",
      "contextModeOn": "Włączono tryb kontekstowy",
      "contextModeOff": "Wyłączono tryb kontekstowy",
      "frequency-range": "Dostosuj zakres częstotliwości spektrogramu",
      "threshold-value": "Próg pewności predykcji",
      "clear-custom-list": "Wyczyść niestandardową listę"
    }
  };
  
  const i18nLists = {
    en: { 
        location: 'Local Birds', 
        nocturnal: 'Nocturnal Birds', 
        birds: 'All Birds', 
        everything: 'Everything', 
        custom: 'Custom' 
    },
    da: {
        location: 'Lokale fugle',
        nocturnal: 'Nataktive fugle',
        birds: 'Alle fugle',
        everything: 'Alt',
        custom: 'Brugerdefineret'
    },
    de: {
        location: 'Einheimische Vögel',
        nocturnal: 'Nachtaktive Vögel',
        birds: 'Alle Vögel',
        everything: 'Alles',
        custom: 'Benutzerdefiniert'
    },
    es: {
        location: 'Aves de la zona',
        nocturnal: 'Paso nocturno',
        birds: 'Todas las aves',
        everything: 'Cualquier sonido',
        custom: 'Personalizado'
    },
    fr: {
        location: 'Oiseaux locaux',
        nocturnal: 'Oiseaux nocturnes',
        birds: 'Tous les oiseaux',
        everything: 'Tout',
        custom: 'Personnalisé'
    },
    it: {
        location: 'Uccelli locali',
        nocturnal: 'Uccelli notturni',
        birds: 'Tutti gli uccelli',
        everything: 'Tutto',
        custom: 'Personalizzato'
    },
    nl: {
        location: 'Lokale vogels',
        nocturnal: 'Nachtelijke vogels',
        birds: 'Alle vogels',
        everything: 'Alles',
        custom: 'Aangepast'
    },
    pl: {
        location: 'Lokalne ptaki',
        nocturnal: 'Ptaki nocne',
        birds: 'Wszystkie ptaki',
        everything: 'Wszystko',
        custom: 'Niestandardowe'
    },
    pt: {
        location: 'Pássaros locais',
        nocturnal: 'Pássaros noturnos',
        birds: 'Todos os pássaros',
        everything: 'Tudo',
        custom: 'Personalizado'
    },
    ru: {
        location: 'Местные птицы',
        nocturnal: 'Ночные птицы',
        birds: 'Все птицы',
        everything: 'Все',
        custom: 'Пользовательский'
    },
    sv: {
        location: 'Lokala fåglar',
        nocturnal: 'Nattaktiva fåglar',
        birds: 'Alla fåglar',
        everything: 'Allt',
        custom: 'Anpassad'
    },
    zh: {
        location: '本地鸟类',
        nocturnal: '夜间鸟类',
        birds: '所有鸟类',
        everything: '所有',
        custom: '自定义'
    }
};


async function localiseUI(locale) {
    let t0 = Date.now();
    locale = locale.replace('_uk', '');
    try {
         // Try fetching the localisation JSON file
        let localisationData = {};
        try {
            const jsonResponse = await fetch(`./I18n/index.${locale}.json`)
            if (jsonResponse.ok) {
                localisationData = await jsonResponse.json();
            } else {
                console.warn(`JSON file not found: index.${locale}.json`);
                return; // Return unmodified HTML if JSON not found
            }
        } catch (error) {
            console.warn(`Failed to fetch JSON file: index.${locale}.json`, error);
            // go for english
            locale = 'en';
            const jsonResponse = await fetch(`./I18n/index.en.json`)
            if (jsonResponse.ok) {
                localisationData = await jsonResponse.json();
            } else {
                console.warn(`JSON file not found: index.en.json`);
                return; // Return unmodified HTML if JSON not found
            }
        }
        // Update elements with IDs
        for (const key in localisationData) {
            // Skip settings
            if (key === 'settings' || key === 'record-entry') continue;
            if (localisationData.hasOwnProperty(key)) {

                const element = document.getElementById(key);
                if (element) {
                    if (key.indexOf('circle-help') !==-1){
                        // Help button popup text
                        element.setAttribute('data-bs-content', localisationData[key]);
                        // refresh the tooltip to reflect the change
                        const popover = new bootstrap.Popover(element);
                        popover.update();

                    } else {
                        // Replace the inner text of the <a> tag but leave <span> unaffected
                        const spans = element.querySelectorAll('span');
                        element.textContent = ' ' + localisationData[key][0];
                        spans.length && element.insertBefore(spans[0], element.firstChild);
                        spans.length > 1 && element.appendChild(spans[1])
                    };
                        // element.innerHTML = localisationData[key];
                    
                }
            }
        }
        // Update buttons without ID
        const buttons = document.querySelectorAll('button:not([id])')
        buttons.forEach(button => button.textContent &&= localisationData['help-modal-close']);
        // Update Title text
        const titles = document.querySelectorAll('[title]');
        titles.forEach(title =>{
            const i18nTitle = i18nTitles[locale][title.id];
            title.title = i18nTitle ?? title.title;
        })
        // Record entry form:
        const recordEntry = document.getElementById('record-entry-modal').querySelectorAll('h5, label, button')
        let settings =  localisationData['record-entry'];
        recordEntry.forEach(label => {
            const id = label.getAttribute('for') || label.id;
            if (settings[id]){
                label.textContent = settings[id]
            }
        })
        // Translate settings labels
        const form = document.getElementById('settings');
        const labels = form.querySelectorAll('label, button');
        settings = localisationData['settings']
        labels.forEach(label => {
            const id = label.getAttribute('for') || label.id;
            if (settings[id]){
                label.textContent = settings[id];
                // Some nested labels must be skipped
                if (['tensorflow', 'webgpu', 'webgl', 'colourmap', 'window-function', 'timelineSetting', 'iucn-scope', 'archive-format',
                     'loud-color', 'mid-color', 'quiet-color', "color-threshold-slider", 'bitrate', 'format', 'quality'].includes(id)) return
                // Set popOver title. It's in the div, or div parent div
                const el = label.parentNode.querySelector('a') || label.parentNode.parentNode.querySelector('a') || label.parentNode.parentNode.parentNode.querySelector('a');
                const heading = label.textContent.replace(':', '');
                el.setAttribute('data-bs-title', heading);
                const popover = new bootstrap.Popover(el);
                popover.update();
            }
        })
        const play = document.querySelector('#playToggle :nth-child(2)');
        const pause = document.querySelector('#playToggle :nth-child(4)');
        play.textContent = i18nContext[locale].play;
        pause.textContent = i18nContext[locale].pause;
        const headings = form.querySelectorAll('h4,h5,h6,legend');
        for (let i=0;i<headings.length;i++){
            const heading = headings[i];
            const span = heading.querySelector('span') ;
            heading.textContent = localisationData['headings'][i]
            if (span) heading.appendChild(span)
        }
        // Update the list options:
        const listOptions = document.getElementById('list-to-use')
        listOptions.querySelectorAll('option').forEach(option => {
            const key = option.value; // Get the value of the option, which matches the key in i18nLists
            option.textContent = i18nLists[locale][key] ?? option.textContent;
        });
        // //Explore location header
        document.querySelector("label[for='explore-locations']").textContent = i18nHeadings[locale].location;
        document.getElementById('exploreRange').innerHTML = `<span class="material-symbols-outlined align-bottom">date_range</span><span>${localisationData['explore-datefilter']}</span> <span class="material-symbols-outlined float-end">expand_more</span>`;
        console.warn('Translation', `${Date.now() - t0} ms`)
        return localisationData
    } catch (error) {
        console.error('Localisation Error:', error.message);
    }
}
export {i18nHeadings, i18nContext, i18nLocation, i18nForm, i18nHelp, i18nToasts, i18nTitles, i18nLIST_MAP, localiseUI}