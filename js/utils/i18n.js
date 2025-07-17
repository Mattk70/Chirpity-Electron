
let LOCALE;

const Toasts = { // UI.js
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
        badRange: "Invalid range. The start and end times are identical",
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
        membershipExpiry: "Your membership is due to expire in ${expiresIn} days, you can visit <a href='https://buymeacoffee.com/matthew_kirkland' target='_blank'>the membership page</a> to renew",

        badMetadata: "Unable to extract essential metadata from ${src}",
        noLoad: 'The ${model} model is not loaded. Restart Chirpity to continue. If you see this message repeatedly, it is likely your computer does not support AVX2 and Chirpity will not run on your system.',
        noDLL: 'There has been an error loading the model. This may be due to missing AVX support. Chirpity AI models require the AVX2 instructions set to run. If you have AVX2 enabled and still see this notice, please refer to <a href="https://github.com/Mattk70/Chirpity-Electron/issues/84" target="_blank">this issue</a> on Github.',
        noFile: "Cannot open: ${error}",
        ffmpeg: 'FFMPEG error extracting audio: ${error}',
        noNight: 'No detections. ${file} has no period within it where predictions would be given. <b>Tip:</b> To see detections in this file, disable nocmig mode and run the analysis again.',
        saveBlocked: "Cannot save file ${filePath}\nbecause it is open in another application",
        goodSave: '${filePath} has been written successfully.',
        noDetections: "No detections found in the selection",
        noDetectionsDetailed: 'No ${nocmig} ${species} detections found ${archive} using the ${list} list.',
        noDetectionsDetailed2: 'No detections found in ${file}. Searched for records using the ${list} list and having a minimum confidence of ${confidence}%',
        dbNotLoaded: "The database has not finished loading. The check for the presence of the file in the archive has been skipped",
        noSnameFound: "Cannot find '${sname}' (at line ${line} of the custom list) in the <strong>${model}</strong> model list. <strong>Tips:</strong> <ol><li>Is your list for the <strong>${model}</strong> model? If not, change the model in settings</li><li>Check for a typo in your species name</li></ol>",
        noSpecies: "No species found with the name ${cname}",
        noArchive: "Cannot access archive location: ${location}. <br> Operation aborted",
        noWriteArchive: "Cannot write to archive location: ${location}. <br> Operation aborted",
        multiDay: "Multi-day operations are not yet supported: ${file} will not be trimmed",
        allDaylight: "${file} will not be added to the archive as it is entirely during daylight.",
        conversionDone: "Finished conversion for ${file}",
        badConversion: "Error converting file ${file}: ${error}",

        noDirectory: "Unable to locate folder '${match}'",
        dbFileMissing: "Unable to locate the saved file with any supported file extension: ${file}",
        goodResultSave: "${number} results saved to the Archive",
        goodAudioExport: "${number} files saved to <br>${path}",
        NoOP: 'Records already saved, nothing to do',
        goodDBUpdate: 'Database update complete, ${total} records added to the archive in ${seconds} seconds',
        fileLocationUpdated: 'The file location was successfully updated in the Archive. Refresh the results to see the records.',
        durationMismatch: '<span class="text-danger">No changes made</span>. The selected file has a different duration to the original file.',
        duplicateFIle: '<span class="text-danger">No changes made</span>. The selected file already exists in the Archive.',
        fileUpdateError: '<span class="text-danger">An error occurred while updating the file: ${message}</span>',
        goodFilePurge: '${file} and its associated records were deleted successfully',
        failedFilePurge: '${file} was not found in in the Archive',
        fileToConvertNotFound: 'Cannot find ${file}, skipping conversion.',
        mkDirFailed: 'Failed to create directory: ${path}<br>Error: ${error}',
        conversionComplete: 'Conversion complete, ${successTotal} successful, ${failedTotal} failed.',
        libraryUpToDate: 'Library is up to date. Nothing to do',
        badModel: 'Model "${model}" was not found in the database.',
        noModel: 'The necessary model column was not found in the file',


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
        badRange: "Ugyldigt interval. Start- og sluttidspunktet er identiske",
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
        membershipExpiry: "Dit medlemskab udløber om ${expiresIn} dage, du kan besøge <a href='https://buymeacoffee.com/matthew_kirkland' target='_blank'>medlemskabsiden</a> for at forny",

        badMetadata: "Kan ikke udtrække væsentlige metadata fra ${src}",
        noLoad: 'Modellen ${model} er ikke indlæst. Genstart Chirpity for at fortsætte. Hvis du ser denne besked gentagne gange, er det sandsynligt, at din computer ikke understøtter AVX2, og Chirpity vil ikke køre på dit system.',
        noDLL: 'Der opstod en fejl ved indlæsning af modellen. Dette kan skyldes manglende AVX-understøttelse. Chirpity AI-modeller kræver AVX2-instruktionssættet for at køre. Hvis AVX2 er aktiveret, og du stadig ser denne meddelelse, skal du henvises til <a href="https://github.com/Mattk70/Chirpity-Electron/issues/84" target="_blank">denne sag</a> på Github.',
        noFile: "Kan ikke åbne: ${error}",
        ffmpeg: 'FFMPEG-fejl ved udtrækning af lyd: ${error}',
        noNight: 'Ingen detektioner. ${file} har ikke noget tidsrum, hvor forudsigelser ville blive givet. <b>Tip:</b> For at se detektioner i denne fil, skal du deaktivere nocmig-tilstand og køre analysen igen.',
        saveBlocked: "Kan ikke gemme filen ${filePath}\nfordi den er åben i en anden applikation",
        goodSave: '${filePath} er blevet gemt med succes.',
        noDetections: "Ingen detektioner fundet i udvalget",
        noDetectionsDetailed: 'Ingen ${nocmig} ${species} detektioner fundet ${archive} ved brug af ${list}-listen.',
        noDetectionsDetailed2: 'Ingen detektioner fundet i ${file}. Søgte efter poster ved hjælp af ${list}-listen og med en minimumskonfidens på ${confidence}%',
        dbNotLoaded: "Databasen er ikke færdig med at indlæse. Tjekket for filens tilstedeværelse i arkivet er blevet sprunget over",
        noSnameFound: "Kan ikke finde '${sname}' (på linje ${line} i den brugerdefinerede liste) i <strong>${model}</strong>-listen. <strong>Tips:</strong> <ol><li>Er din liste til <strong>${model}</strong>-modellen? Hvis ikke, skal du ændre modellen i indstillingerne</li><li>Kontroller for en stavefejl i dit artsnavn</li></ol>",
        noSpecies: "Ingen arter fundet med navnet ${cname}",
        noArchive: "Kan ikke få adgang til arkivplaceringen: ${location}. <br> Operationen blev afbrudt",
        noWriteArchive: "Kan ikke skrive til arkivplaceringen: ${location}. <br> Operationen blev afbrudt",
        multiDay: "Flere dages operationer understøttes endnu ikke: ${file} vil ikke blive beskåret",
        allDaylight: "${file} vil ikke blive tilføjet til arkivet, da det er helt under dagslys.",
        conversionDone: "Konvertering afsluttet for ${file}",
        badConversion: "Fejl ved konvertering af filen ${file}: ${error}",

        noDirectory: "Kan ikke finde mappen '${match}'",
        dbFileMissing: "Kan ikke finde den gemte fil med en understøttet filtype: ${file}",
        goodResultSave: "${number} resultater gemt i Arkivet",
        goodAudioExport: "${number} filer gemt i <br>${path}",
        NoOP: "Poster er allerede gemt, ingen handling nødvendig",
        goodDBUpdate: "Databaseopdatering fuldført, ${total} poster tilføjet til arkivet på ${seconds} sekunder",
        fileLocationUpdated: "Filplaceringen blev opdateret i Arkivet. Opdater resultaterne for at se posterne.",
        durationMismatch: '<span class="text-danger">Ingen ændringer foretaget</span>. Den valgte fil har en anden varighed end den oprindelige fil.',
        duplicateFIle: '<span class="text-danger">Ingen ændringer foretaget</span>. Den valgte fil findes allerede i Arkivet.',
        fileUpdateError: '<span class="text-danger">Der opstod en fejl under opdatering af filen: ${message}</span>',
        goodFilePurge: '${file} og de tilknyttede poster blev slettet med succes',
        failedFilePurge: "${file} blev ikke fundet i Arkivet",
        fileToConvertNotFound: "Kan ikke finde ${file}, springer over konvertering.",
        mkDirFailed: "Kunne ikke oprette mappen: ${path}<br>Fejl: ${error}",
        conversionComplete: "Konvertering fuldført, ${successTotal} lykkedes, ${failedTotal} fejlede.",
        libraryUpToDate: "Biblioteket er opdateret. Ingen handling nødvendig",
        badModel: 'Modellen "${model}" blev ikke fundet i databasen.',
        noModel: "Den nødvendige modelkolonne blev ikke fundet i filen"

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
        badRange: "Ungültiger Bereich. Start- und Endzeit sind identisch",
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
        membershipExpiry: "Ihre Mitgliedschaft läuft in ${expiresIn} Tagen ab, Sie können die <a href='https://buymeacoffee.com/matthew_kirkland' target='_blank'>Mitgliedsseite</a> besuchen, um sie zu verlängern",

        badMetadata: "Kann wesentliche Metadaten aus ${src} nicht extrahieren",
        noLoad: 'Das Modell ${model} wurde nicht geladen. Starten Sie Chirpity neu, um fortzufahren. Wenn diese Nachricht wiederholt angezeigt wird, unterstützt Ihr Computer möglicherweise kein AVX2, und Chirpity wird auf Ihrem System nicht ausgeführt.',
        noDLL: 'Beim Laden des Modells ist ein Fehler aufgetreten. Dies könnte an fehlender AVX-Unterstützung liegen. Chirpity AI-Modelle benötigen das AVX2-Instruktionsset zum Ausführen. Wenn AVX2 aktiviert ist und Sie diese Nachricht trotzdem sehen, beziehen Sie sich bitte auf <a href="https://github.com/Mattk70/Chirpity-Electron/issues/84" target="_blank">dieses Problem</a> auf Github.',
        noFile: "Kann nicht öffnen: ${error}",
        ffmpeg: 'FFMPEG-Fehler bei der Extraktion von Audio: ${error}',
        noNight: 'Keine Detektionen. ${file} hat keinen Zeitraum, in dem Vorhersagen gegeben würden. <b>Tip:</b> Um Detektionen in dieser Datei zu sehen, deaktivieren Sie den nocmig-Modus und führen Sie die Analyse erneut durch.',
        saveBlocked: "Kann die Datei ${filePath} nicht speichern, weil sie in einer anderen Anwendung geöffnet ist",
        goodSave: '${filePath} wurde erfolgreich gespeichert.',
        noDetections: "Keine Detektionen im Auswahlbereich gefunden",
        noDetectionsDetailed: 'Keine ${nocmig} ${species} Detektionen in ${archive} mit der ${list}-Liste gefunden.',
        noDetectionsDetailed2: 'Keine Detektionen in ${file} gefunden. Es wurde nach Einträgen mit der ${list}-Liste und einer Mindestkonfidenz von ${confidence}% gesucht.',
        dbNotLoaded: "Die Datenbank ist noch nicht vollständig geladen. Die Überprüfung auf das Vorhandensein der Datei im Archiv wurde übersprungen.",
        noSnameFound: "Kann '${sname}' (in Zeile ${line} der benutzerdefinierten Liste) nicht in der <strong>${model}</strong>-Liste finden. <strong>Tipps:</strong> <ol><li>Ist Ihre Liste für das <strong>${model}</strong>-Modell? Wenn nicht, ändern Sie das Modell in den Einstellungen</li><li>Überprüfen Sie auf Tippfehler im Artbegriff</li></ol>",
        noSpecies: "Keine Arten mit dem Namen ${cname} gefunden",
        noArchive: "Kann auf Archivstandort ${location} nicht zugreifen. <br> Vorgang abgebrochen",
        noWriteArchive: "Kann nicht in Archivstandort ${location} schreiben. <br> Vorgang abgebrochen",
        multiDay: "Mehrtägige Operationen werden noch nicht unterstützt: ${file} wird nicht beschnitten",
        allDaylight: "${file} wird nicht zum Archiv hinzugefügt, da es vollständig während des Tageslichts liegt.",
        conversionDone: "Konvertierung für ${file} abgeschlossen",
        badConversion: "Fehler bei der Konvertierung der Datei ${file}: ${error}",

        noDirectory: "Ordner '${match}' konnte nicht gefunden werden",
        dbFileMissing: "Die gespeicherte Datei mit einer unterstützten Dateiendung konnte nicht gefunden werden: ${file}",
        goodResultSave: "${number} Ergebnisse wurden im Archiv gespeichert",
        goodAudioExport: "${number} Dateien gespeichert unter <br>${path}",
        NoOP: "Datensätze bereits gespeichert, keine Aktion erforderlich",
        goodDBUpdate: "Datenbankaktualisierung abgeschlossen, ${total} Datensätze wurden in ${seconds} Sekunden zum Archiv hinzugefügt",
        fileLocationUpdated: "Der Speicherort der Datei wurde im Archiv erfolgreich aktualisiert. Aktualisieren Sie die Ergebnisse, um die Datensätze anzuzeigen.",
        durationMismatch: '<span class="text-danger">Keine Änderungen vorgenommen</span>. Die ausgewählte Datei hat eine andere Dauer als die ursprüngliche Datei.',
        duplicateFIle: '<span class="text-danger">Keine Änderungen vorgenommen</span>. Die ausgewählte Datei ist bereits im Archiv vorhanden.',
        fileUpdateError: '<span class="text-danger">Beim Aktualisieren der Datei ist ein Fehler aufgetreten: ${message}</span>',
        goodFilePurge: "${file} und die zugehörigen Datensätze wurden erfolgreich gelöscht",
        failedFilePurge: "${file} wurde im Archiv nicht gefunden",
        fileToConvertNotFound: "Kann ${file} nicht finden, Überspringe Konvertierung.",
        mkDirFailed: "Fehler beim Erstellen des Verzeichnisses: ${path}<br>Fehler: ${error}",
        conversionComplete: "Konvertierung abgeschlossen, ${successTotal} erfolgreich, ${failedTotal} fehlgeschlagen.",
        libraryUpToDate: "Die Bibliothek ist auf dem neuesten Stand. Keine Aktion erforderlich",
        badModel: 'Modell "${model}" wurde nicht in der Datenbank gefunden.',
        noModel: "Die erforderliche Modellspalte wurde in der Datei nicht gefunden"


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
        badRange: "Rango no válido. La hora de inicio y la de finalización son idénticas",
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
        membershipExpiry: "Su membresía vencerá en ${expiresIn} días, puede visitar <a href='https://buymeacoffee.com/matthew_kirkland' target='_blank'>la página de membresía</a> para renovarla",

        badMetadata: "No se pueden extraer los metadatos esenciales de ${src}",
        noLoad: 'El modelo ${model} no está cargado. Reinicie Chirpity para continuar. Si ve este mensaje repetidamente es probable que su ordenador no sea compatible con AVX2 y que Chirpity no pueda ejecutarse en su sistema.',
        noDLL: 'Ha ocurrido un error al cargar el modelo. Esto puede deberse a la falta de soporte para AVX. Los modelos de inteligencia artificial de Chirpity requieren el conjunto de instrucciones AVX2 para funcionar. Si tiene AVX2 habilitado y sigue viendo este mensaje, consulte <a href="https://github.com/Mattk70/Chirpity-Electron/issues/84" target="_blank">este problema</a> en Github.',
        noFile: "No se puede abrir: ${error}",
        ffmpeg: 'Error de FFMPEG al extraer audio: ${error}',
        noNight: 'No se encontraron detecciones. ${file} no tiene un periodo en el que se puedan hacer predicciones. <b>Consejo:</b> Para ver detecciones en este archivo desactive el modo nocmig y ejecute otra vez el análisis.',
        saveBlocked: "No se puede guardar el archivo ${filePath} porque está abierto en otra aplicación",
        goodSave: '${filePath} se ha guardado correctamente.',
        noDetections: "No se ha detectado nada en la selección",
        noDetectionsDetailed: 'No se han encontrado detecciones de ${nocmig} ${species} en ${archive} usando la lista ${list}.',
        noDetectionsDetailed2: 'No se han encontrado detecciones en ${file}. Se han buscado registros usando la lista ${list} con una confianza mínima de ${confidence}%',
        dbNotLoaded: "La base de datos no ha terminado de cargarse. Se ha omitido la comprobación de la presencia de la grabación en el archivo",
        noSnameFound: "No se puede encontrar '${sname}' (en la línea ${line} de la lista personalizada) en la lista <strong>${model}</strong>. <strong>Consejos:</strong> <ol><li>¿Está su lista para el modelo <strong>${model}</strong>? Si no es así, cambie el modelo en la configuración</li><li>Mire si hay algún error ortográfico en el nombre de la especie</li></ol>",
        noSpecies: "No se encontraron especies con el nombre ${cname}",
        noArchive: "No se puede acceder a la ubicación del archivo: ${location}. <br> Operación interrumpida",
        noWriteArchive: "No se puede escribir en la ubicación del archivo: ${location}. <br> Operación abortada",
        multiDay: "Las operaciones de varios días no son compatibles todavía: ${file} no se recortará",
        allDaylight: "${file} no se añadirá al archivo ya que se ha grabado en su totalidad de día.",
        conversionDone: "Conversión de ${file} terminada",
        badConversion: "Error al convertir el archivo ${file}: ${error}",

        noDirectory: "No se puede localizar la carpeta '${match}'",
        dbFileMissing: "No se encuentra el archivo guardado con una extensión compatible: ${file}",
        goodResultSave: "${number} resultados guardados en el Archivo",
        goodAudioExport: "${number} archivos guardados en <br>${path}",
        NoOP: "Registros ya guardados, no hay nada que hacer",
        goodDBUpdate: "Actualización de la base de datos completada, ${total} registros añadidos al archivo en ${seconds} segundos",
        fileLocationUpdated: "La ubicación del archivo se actualizó correctamente en el Archivo. Actualiza los resultados para ver los registros.",
        durationMismatch: '<span class="text-danger">No se realizaron cambios</span>. El archivo seleccionado tiene una duración diferente al archivo original.',
        duplicateFIle: '<span class="text-danger">No se realizaron cambios</span>. El archivo seleccionado ya existe en el Archivo.',
        fileUpdateError: '<span class="text-danger">Ocurrió un error al actualizar el archivo: ${message}</span>',
        goodFilePurge: "${file} y sus registros asociados fueron eliminados correctamente",
        failedFilePurge: "${file} no se encontró en el Archivo",
        fileToConvertNotFound: "No se puede encontrar ${file}, se omite la conversión.",
        mkDirFailed: "Error al crear el directorio: ${path}<br>Error: ${error}",
        conversionComplete: "Conversión completada, ${successTotal} exitosas, ${failedTotal} fallidas.",
        libraryUpToDate: "La biblioteca está actualizada. No hay nada que hacer",
        badModel: 'El modelo "${model}" no se encontró en la base de datos.',
        noModel: "La columna de modelo necesaria no se encontró en el archivo"


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
        badRange: "Plage invalide. L'heure de début et l'heure de fin sont identiques",
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
        membershipExpiry: "Votre abonnement expire dans ${expiresIn} jours, vous pouvez visiter <a href='https://buymeacoffee.com/matthew_kirkland' target='_blank'>la page d'abonnement</a> pour le renouveler",
        
        badMetadata: "Impossible d'extraire les métadonnées essentielles de ${src}",
        noLoad: 'Le modèle ${model} n\'est pas chargé. Redémarrez Chirpity pour continuer. Si vous voyez ce message à plusieurs reprises, il est probable que votre ordinateur ne prenne pas en charge AVX2 et Chirpity ne fonctionnera pas sur votre système.',
        noDLL: 'Une erreur est survenue lors du chargement du modèle. Cela peut être dû à un manque de prise en charge d\'AVX. Les modèles AI de Chirpity nécessitent le jeu d\'instructions AVX2 pour fonctionner. Si vous avez AVX2 activé et que vous voyez toujours cet avertissement, veuillez vous référer à <a href="https://github.com/Mattk70/Chirpity-Electron/issues/84" target="_blank">ce problème</a> sur Github.',
        noFile: "Impossible d'ouvrir : ${error}",
        ffmpeg: 'Erreur FFMPEG lors de l\'extraction de l\'audio : ${error}',
        noNight: 'Aucune détection. ${file} ne contient pas de période où des prédictions pourraient être effectuées. <b>Astuce :</b> Pour voir les détections dans ce fichier, désactivez le mode nocmig et relancez l\'analyse.',
        saveBlocked: "Impossible de sauvegarder le fichier ${filePath}\ncar il est ouvert dans une autre application",
        goodSave: '${filePath} a été enregistré avec succès.',
        noDetections: "Aucune détection trouvée dans la sélection",
        noDetectionsDetailed: 'Aucune détection de ${nocmig} ${species} trouvée ${archive} en utilisant la liste ${list}.',
        noDetectionsDetailed2: 'Aucune détection trouvée dans ${file}. Recherche de dossiers utilisant la liste ${list} avec une confiance minimale de ${confidence}%',
        dbNotLoaded: "La base de données n'a pas encore fini de se charger. La vérification de la présence du fichier dans l'archive a été ignorée",
        noSnameFound: "Impossible de trouver '${sname}' (à la ligne ${line} de la liste personnalisée) dans la liste <strong>${model}</strong>. <strong>Conseils :</strong> <ol><li>Votre liste est-elle pour le modèle <strong>${model}</strong> ? Si ce n'est pas le cas, changez le modèle dans les paramètres</li><li>Vérifiez s'il y a une faute de frappe dans le nom de votre espèce</li></ol>",
        noSpecies: "Aucune espèce trouvée avec le nom ${cname}",
        noArchive: "Impossible d'accéder à l'emplacement de l'archive : ${location}. <br> Opération abandonnée",
        noWriteArchive: "Impossible d'écrire dans l'emplacement de l'archive : ${location}. <br> Opération abandonnée",
        multiDay: "Les opérations multi-jours ne sont pas encore supportées : ${file} ne sera pas recadré",
        allDaylight: "${file} ne sera pas ajouté à l'archive car il est entièrement durant la journée.",
        conversionDone: "Conversion terminée pour ${file}",
        badConversion: "Erreur lors de la conversion du fichier ${file} : ${error}",

        noDirectory: "Impossible de localiser le dossier '${match}'",
        dbFileMissing: "Impossible de localiser le fichier enregistré avec une extension prise en charge : ${file}",
        goodResultSave: "${number} résultats enregistrés dans l'Archive",
        goodAudioExport: "${number} fichiers enregistrés dans <br>${path}",
        NoOP: "Enregistrements déjà sauvegardés, aucune action nécessaire",
        goodDBUpdate: "Mise à jour de la base de données terminée, ${total} enregistrements ajoutés à l'archive en ${seconds} secondes",
        fileLocationUpdated: "L'emplacement du fichier a été mis à jour avec succès dans l'Archive. Actualisez les résultats pour voir les enregistrements.",
        durationMismatch: '<span class="text-danger">Aucun changement effectué</span>. Le fichier sélectionné a une durée différente de celle du fichier original.',
        duplicateFIle: '<span class="text-danger">Aucun changement effectué</span>. Le fichier sélectionné existe déjà dans l\'Archive.',
        fileUpdateError: '<span class="text-danger">Une erreur est survenue lors de la mise à jour du fichier : ${message}</span>',
        goodFilePurge: '${file} et ses enregistrements associés ont été supprimés avec succès',
        failedFilePurge: "${file} n'a pas été trouvé dans l'Archive",
        fileToConvertNotFound: "Impossible de trouver ${file}, conversion ignorée.",
        mkDirFailed: "Échec de la création du répertoire : ${path}<br>Erreur : ${error}",
        conversionComplete: "Conversion terminée, ${successTotal} réussie(s), ${failedTotal} échouée(s).",
        libraryUpToDate: "La bibliothèque est à jour. Aucune action nécessaire",
        badModel: 'Le modèle "${model}" n’a pas été trouvé dans la base de données.',
        noModel: "La colonne de modèle requise n’a pas été trouvée dans le fichier"

    },
    ja: {
        info: '情報', warning: '警告', error: 'エラー',
        maxFiles: "Chirpityは最大25,000ファイルのオープンを制限しています。試行された${STATE.openFiles.length}のうち最初の25,000のみが開かれます",
        analysisUnderway:"分析が進行中です。新しい分析を実行する前に<b>Esc</b>を押してキャンセルしてください。",
        placeOutOfBounds: "緯度は-90から90の間、経度は-180から180の間でなければなりません。",
        placeNotFound: "この場所の検索に失敗しました。インターネット接続を確認するか、後でもう一度試してください。",
        mustFilterSpecies: "オーディオファイルをエクスポートするには、種別で結果をフィルタリングしてください",
        noNode: "このマシンで標準のバックエンドをロードできませんでした。代わりに実験的なバックエンド（webGPU）が使用されました。",
        badMessage: "ワーカーからの認識されないメッセージ:${args.event}",
        changeListBlocked:"分析が進行中のため、リスト設定を変更することはできません。ただし、分析が完了した後にリストを変更することは<b>可能</b>です",
        cancelled: "操作がキャンセルされました",
        badTime: "無効な時間形式です。次の形式のいずれかで時間を入力してください：\n1. 浮動小数点数（秒）\n2. コロンで区切られた2つの数字（分と秒）\n3. コロンで区切られた3つの数字（時、分、秒）",
        badRange: "無効な範囲です。開始時間と終了時間が同じです",
        complete: "分析が完了しました。",
        feedback: "ありがとうございます。あなたのフィードバックはChirpityの予測を改善するのに役立ちます",
        contextBlocked: "分析が進行中のため、コンテキストモード設定を変更することはできません。",
        noCallCache: "コールキャッシュが見つかりませんでした。",
        callCacheCleared: "コールキャッシュが正常にクリアされました。",
        badThreshold: "しきい値は0.001から1の間の数値でなければなりません",
        labelFileNeeded: "カスタム言語オプションを使用するには、リスト設定でラベルファイルを選択する必要があります。",
        listFileNeeded: "カスタムリストオプションを使用する前に、モデルのカスタムリストをアップロードする必要があります。",
        listNotFound: 'カスタムリストファイル: ${file}が見つかりませんでした。<b class="text-danger">検出は表示されません</b>。',
        leafletError: 'マップの表示中にエラーが発生しました: ${error}',
        noXC: "Xeno-canto APIが応答していません",
        noComparisons: "Xeno-cantoサイトには比較可能なデータがありません",
        noIUCNRecord: "IUCNレッドリストに<b>${sname}</b>の記録がありません。",
        membershipExpiry: "会員期限が${expiresIn}日後に迫っています。<a href='https://buymeacoffee.com/matthew_kirkland' target='_blank'>会員ページ</a>にアクセスして更新してください",

        badMetadata: "${src}から重要なメタデータを抽出できません",
        noLoad: '${model}モデルがロードされていません。Chirpityを再起動して続行してください。このメッセージが繰り返し表示される場合、お使いのコンピュータがAVX2をサポートしていない可能性があります。',
        noDLL: 'モデルのロード中にエラーが発生しました。これはAVXサポートが欠如しているためかもしれません。Chirpity AIモデルはAVX2命令セットを必要とします。AVX2が有効であるにもかかわらずこの通知が表示される場合は、<a href="https://github.com/Mattk70/Chirpity-Electron/issues/84" target="_blank">この問題</a>を参照してください。',
        noFile: "開くことができません: ${error}",
        ffmpeg: 'オーディオ抽出中のFFMPEGエラー: ${error}',
        noNight: '検出なし。${file}には予測が行われる期間が含まれていません。<b>ヒント:</b> このファイルで検出を表示するには、nocmigモードを無効にして再度分析を実行してください。',
        saveBlocked: "他のアプリケーションで開かれているため、ファイル${filePath}を保存できません",
        goodSave: '${filePath}が正常に書き込まれました。',
        noDetections: "選択範囲に検出が見つかりません",
        noDetectionsDetailed: '${nocmig} ${species}の検出が${archive}で見つかりませんでした。${list}リストを使用して検索しました。',
        noDetectionsDetailed2: '${file}に検出が見つかりませんでした。${list}リストを使用して、最小信頼度${confidence}%のレコードを検索しました。',
        dbNotLoaded: "データベースの読み込みが完了していません。アーカイブ内のファイルの存在確認はスキップされました",
        noSnameFound: "カスタムリストの${line}行目にある'${sname}'が<strong>${model}</strong>モデルリストに見つかりません。<strong>ヒント:</strong> <ol><li>リストは<strong>${model}</strong>モデル用ですか？そうでない場合は、設定でモデルを変更してください</li><li>種名にタイプミスがないか確認してください</li></ol>",
        noSpecies: "名前が ${cname} の種は見つかりませんでした",
        noArchive: "アーカイブ場所にアクセスできません: ${location}. <br> 操作が中止されました",
        noWriteArchive: "アーカイブ場所に書き込めません: ${location}. <br> 操作が中止されました",
        multiDay: "マルチデイ操作はまだサポートされていません: ${file}はトリミングされません",
        allDaylight: "${file}は全て日中のため、アーカイブに追加されません。",
        conversionDone: "${file}の変換が完了しました",
        badConversion: "${file}の変換中にエラーが発生しました: ${error}",
        noDirectory: "フォルダ'${match}'を見つけることができません",
        dbFileMissing: "サポートされているファイル拡張子のいずれかで保存されたファイルを見つけることができません: ${file}",
        goodResultSave: "${number}の結果がアーカイブに保存されました",
        goodAudioExport: "${number} 個のファイルを <br>${path} に保存しました",
        NoOP: 'レコードは既に保存されています。何もすることはありません',
        goodDBUpdate: 'データベースの更新が完了しました。${total}のレコードが${seconds}秒でアーカイブに追加されました',
        fileLocationUpdated: 'ファイルの場所がアーカイブで正常に更新されました。結果を更新してレコードを確認してください。',
        durationMismatch: '<span class="text-danger">変更なし</span>。選択されたファイルは元のファイルと異なる長さです。',
        duplicateFIle: '<span class="text-danger">変更なし</span>。選択されたファイルは既にアーカイブに存在します。',
        fileUpdateError: '<span class="text-danger">ファイルの更新中にエラーが発生しました: ${message}</span>',
        goodFilePurge: '${file}とその関連レコードが正常に削除されました',
        failedFilePurge: '${file}はアーカイブに見つかりませんでした',
        fileToConvertNotFound: '${file}が見つかりません、変換をスキップします。',
        mkDirFailed: 'ディレクトリの作成に失敗しました: ${path}<br>エラー: ${error}',
        conversionComplete: '変換が完了しました。成功: ${successTotal}、失敗: ${failedTotal}',
        libraryUpToDate: 'ライブラリは最新です。何もすることはありません',
        badModel: 'モデル "${model}" はデータベースに見つかりませんでした。',
        noModel: "必要なモデル列がファイルに見つかりませんでした"


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
        badRange: "Ongeldige bereik. De starttijd en eindtijd zijn identiek",
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
        membershipExpiry: "Je lidmaatschap verloopt over ${expiresIn} dagen, je kunt de <a href='https://buymeacoffee.com/matthew_kirkland' target='_blank'>lidmaatschaps pagina</a> bezoeken om het te verlengen",

        badMetadata: "Kan essentiële metadata niet extraheren uit ${src}",
        noLoad: 'Het ${model} model is niet geladen. Herstart Chirpity om door te gaan. Als je dit bericht herhaaldelijk ziet, ondersteunt je computer waarschijnlijk geen AVX2 en zal Chirpity niet op je systeem werken.',
        noDLL: 'Er is een fout opgetreden bij het laden van het model. Dit kan te maken hebben met ontbrekende AVX-ondersteuning. Chirpity AI-modellen vereisen de AVX2-instructieset om te draaien. Als je AVX2 hebt ingeschakeld en nog steeds deze melding ziet, raadpleeg dan <a href="https://github.com/Mattk70/Chirpity-Electron/issues/84" target="_blank">dit probleem</a> op Github.',
        noFile: "Kan niet openen: ${error}",
        ffmpeg: 'FFMPEG-fout bij het extraheren van audio: ${error}',
        noNight: 'Geen detecties. ${file} heeft geen periode waarin voorspellingen zouden worden gegeven. <b>Tip:</b> Om detecties in dit bestand te zien, schakel je de nocmig-modus uit en voer je de analyse opnieuw uit.',
        saveBlocked: "Kan bestand ${filePath} niet opslaan\nomdat het geopend is in een andere toepassing",
        goodSave: '${filePath} is succesvol opgeslagen.',
        noDetections: "Geen detecties gevonden in de selectie",
        noDetectionsDetailed: 'Geen ${nocmig} ${species} detecties gevonden ${archive} met de ${list} lijst.',
        noDetectionsDetailed2: 'Geen detecties gevonden in ${file}. Zocht naar records met de ${list} lijst en een minimale betrouwbaarheid van ${confidence}%',
        dbNotLoaded: "De database is nog niet volledig geladen. De controle op de aanwezigheid van het bestand in het archief is overgeslagen",
        noSnameFound: "Kan '${sname}' niet vinden (op regel ${line} van de aangepaste lijst) in de <strong>${model}</strong> lijst. <strong>Tips:</strong> <ol><li>Is je lijst voor het <strong>${model}</strong> model? Zo niet, wijzig het model in de instellingen</li><li>Controleer op typfouten in de naam van je soort</li></ol>",
        noSpecies: "Geen soorten gevonden met de naam ${cname}",
        noArchive: "Kan archieflocatie niet openen: ${location}. <br> Operatie afgebroken",
        noWriteArchive: "Kan niet schrijven naar archieflocatie: ${location}. <br> Operatie afgebroken",
        multiDay: "Meerdaagse operaties worden nog niet ondersteund: ${file} zal niet worden bijgesneden",
        allDaylight: "${file} wordt niet aan het archief toegevoegd omdat het volledig tijdens de dag is.",
        conversionDone: "Conversie afgerond voor ${file}",
        badConversion: "Fout bij het converteren van bestand ${file}: ${error}",

        noDirectory: "Kan map '${match}' niet vinden",
        dbFileMissing: "Kan het opgeslagen bestand met een ondersteunde extensie niet vinden: ${file}",
        goodResultSave: "${number} resultaten opgeslagen in het Archief",
        goodAudioExport: "${number} bestanden opgeslagen in <br>${path}",
        NoOP: "Records zijn al opgeslagen, niets te doen",
        goodDBUpdate: "Database-update voltooid, ${total} records toegevoegd aan het archief in ${seconds} seconden",
        fileLocationUpdated: "De bestandslocatie is succesvol bijgewerkt in het Archief. Vernieuw de resultaten om de records te zien.",
        durationMismatch: '<span class="text-danger">Geen wijzigingen aangebracht</span>. Het geselecteerde bestand heeft een andere duur dan het originele bestand.',
        duplicateFIle: '<span class="text-danger">Geen wijzigingen aangebracht</span>. Het geselecteerde bestand bestaat al in het Archief.',
        fileUpdateError: '<span class="text-danger">Er is een fout opgetreden bij het bijwerken van het bestand: ${message}</span>',
        goodFilePurge: "${file} en de bijbehorende records zijn succesvol verwijderd",
        failedFilePurge: "${file} werd niet gevonden in het Archief",
        fileToConvertNotFound: "Kan ${file} niet vinden, conversie overgeslagen.",
        mkDirFailed: "Kan map niet aanmaken: ${path}<br>Fout: ${error}",
        conversionComplete: "Conversie voltooid, ${successTotal} succesvol, ${failedTotal} mislukt.",
        libraryUpToDate: "De bibliotheek is up-to-date. Niets te doen",
        badModel: 'Model "${model}" is niet gevonden in de database.',
        noModel: "De vereiste modelkolom is niet gevonden in het bestand"


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
        badRange: "Intervalo inválido. O horário de início e o horário de término são idênticos",
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
        membershipExpiry: "Sua adesão vai expirar em ${expiresIn} dias, você pode visitar <a href='https://buymeacoffee.com/matthew_kirkland' target='_blank'>a página de adesão</a> para renová-la",

        badMetadata: "Não foi possível extrair os metadados essenciais de ${src}",
        noLoad: 'O modelo ${model} não está carregado. Reinicie o Chirpity para continuar. Se você ver esta mensagem repetidamente, é provável que seu computador não suporte AVX2 e o Chirpity não funcionará no seu sistema.',
        noDLL: 'Ocorreu um erro ao carregar o modelo. Isso pode ser devido à falta de suporte AVX. Os modelos de IA do Chirpity exigem o conjunto de instruções AVX2 para funcionar. Se você tiver o AVX2 ativado e ainda ver este aviso, consulte <a href="https://github.com/Mattk70/Chirpity-Electron/issues/84" target="_blank">este problema</a> no Github.',
        noFile: "Não é possível abrir: ${error}",
        ffmpeg: 'Erro FFMPEG ao extrair áudio: ${error}',
        noNight: 'Sem detecções. ${file} não possui um período dentro dele onde previsões seriam fornecidas. <b>Dica:</b> Para ver as detecções neste arquivo, desative o modo nocmig e execute a análise novamente.',
        saveBlocked: "Não foi possível salvar o arquivo ${filePath}\nporque está aberto em outro aplicativo",
        goodSave: '${filePath} foi salvo com sucesso.',
        noDetections: "Nenhuma detecção encontrada na seleção",
        noDetectionsDetailed: 'Nenhuma detecção ${nocmig} ${species} encontrada ${archive} usando a lista ${list}.',
        noDetectionsDetailed2: 'Nenhuma detecção encontrada em ${file}. Buscou por registros usando a lista ${list} com uma confiança mínima de ${confidence}%',
        dbNotLoaded: "O banco de dados não terminou de carregar. A verificação da presença do arquivo no arquivo foi ignorada",
        noSnameFound: "Não foi possível encontrar '${sname}' (na linha ${line} da lista personalizada) na lista <strong>${model}</strong>. <strong>Dicas:</strong> <ol><li>Sua lista é para o modelo <strong>${model}</strong>? Se não, altere o modelo nas configurações</li><li>Verifique se há erros de digitação no nome da espécie</li></ol>",
        noSpecies: "Nenhuma espécie encontrada com o nome ${cname}",
        noArchive: "Não foi possível acessar a localização do arquivo: ${location}. <br> Operação abortada",
        noWriteArchive: "Não foi possível gravar na localização do arquivo: ${location}. <br> Operação abortada",
        multiDay: "Operações multi-dia ainda não são suportadas: ${file} não será cortado",
        allDaylight: "${file} não será adicionado ao arquivo, pois é totalmente durante o dia.",
        conversionDone: "Conversão finalizada para ${file}",
        badConversion: "Erro ao converter o arquivo ${file}: ${error}",

        noDirectory: "Não foi possível localizar a pasta '${match}'",
        dbFileMissing: "Não foi possível localizar o arquivo salvo com uma extensão compatível: ${file}",
        goodResultSave: "${number} resultados salvos no Arquivo",
        goodAudioExport: "${number} arquivos salvos em <br>${path}",
        NoOP: "Registros já salvos, nada a fazer",
        goodDBUpdate: "Atualização do banco de dados concluída, ${total} registros adicionados ao arquivo em ${seconds} segundos",
        fileLocationUpdated: "A localização do arquivo foi atualizada com sucesso no Arquivo. Atualize os resultados para ver os registros.",
        durationMismatch: '<span class="text-danger">Nenhuma alteração feita</span>. O arquivo selecionado tem uma duração diferente do arquivo original.',
        duplicateFIle: '<span class="text-danger">Nenhuma alteração feita</span>. O arquivo selecionado já existe no Arquivo.',
        fileUpdateError: '<span class="text-danger">Ocorreu um erro ao atualizar o arquivo: ${message}</span>',
        goodFilePurge: "${file} e seus registros associados foram excluídos com sucesso",
        failedFilePurge: "${file} não foi encontrado no Arquivo",
        fileToConvertNotFound: "Não foi possível encontrar ${file}, conversão ignorada.",
        mkDirFailed: "Falha ao criar o diretório: ${path}<br>Erro: ${error}",
        conversionComplete: "Conversão concluída, ${successTotal} bem-sucedida(s), ${failedTotal} falhada(s).",
        libraryUpToDate: "A biblioteca está atualizada. Nada a fazer",
        badModel: 'O modelo "${model}" não foi encontrado na base de dados.',
        noModel: "A coluna de modelo necessária não foi encontrada no ficheiro"


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
        badRange: "Неверный диапазон. Время начала и время окончания идентичны",
        complete: "Анализ завершен.",
        feedback: "Спасибо, ваш отзыв помогает улучшить прогнозы Chirpity.",
        contextBlocked: "Во время выполнения анализа изменить настройки контекстного режима невозможно.",
        noCallCache: "Не найден кеш вокализаций.",
        callCacheCleared: "Кеш вокализаций успешно очищен.",
        badThreshold: "Пороговое значение должно быть числом в диапозоне от 0.001 до 1.0",
        labelFileNeeded: "Вы должны выбрать файл меток в настройках списка, чтобы использовать опцию пользовательского языка.",
        listFileNeeded: "Вам необходимо загрузить пользовательский список для модели, прежде чем использовать опцию пользовательского списка.",
        listNotFound: 'Файл пользовательского списка: ${file} не найден, <b class="text-danger">обнаружения не будут отображаться</b>.',
        leafletError: 'Произошла ошибка при отображении карты: ${error}',
        noXC: "API Xeno-canto не отвечает.",
        noComparisons: "На сайте Xeno-canto нет доступных сравнений.",
        noIUCNRecord: "Нет записи о <b>${sname}</b> в Красном списке IUCH.",
        membershipExpiry: "Ваша подписка истекает через ${expiresIn} дней, вы можете посетить <a href='https://buymeacoffee.com/matthew_kirkland' target='_blank'>страницу подписки</a>, чтобы продлить её",

        badMetadata: "Не удалось извлечь необходимые метаданные из ${src}",
        noLoad: 'Модель ${model} не загружена. Для продолжения работы перезапустите Chirpity. Если вы постоянно видите это сообщение, скорее всего, ваш компьютер не поддерживает AVX2 и Chirpity не будет работать в вашей системе.',
        noDLL: 'Произошла ошибка при загрузке модели. Это может быть связано с отсутствием поддержки AVX. Для запуска моделей AI Chirpity требуется набор инструкций AVX2. Если у вас включен AVX2 и вы по-прежнему видите это уведомление, пожалуйста, обратитесь к <a href="https://github.com/Mattk70/Chirpity-Electron/issues/84" target="_blank">этому вопросу</a> на Github.',
        noFile: "Не удается открыть: ${error}",
        ffmpeg: 'Ошибка FFMPEG при извлечении аудио: ${error}',
        noNight: 'Нет обнаружений. В ${file} нет периода, в течение которого можно было бы давать прогнозы. <b>Совет:</b> Чтобы увидеть обнаружения в этом файле, отключите режим nocmig и запустите анализ еще раз.',
        saveBlocked: "Не удается сохранить файл ${filePath}\n потому, что он открыт в другом приложении",
        goodSave: '${filePath} был успешно записан.',
        noDetections: "В выборке не найдено  никаких обнаружений",
        noDetectionsDetailed: 'Не найдено обнаружений ${nocmig} ${species} в ${archive} с использованием списка ${list}.',
        noDetectionsDetailed2: 'Не найдено обнаружеий в ${file}.  Поиск записей производился с использованием списка  ${list} с минимальной достоверностью ${confidence}%',
        dbNotLoaded: "Загрузка базы данных не завершена. Проверка наличия файла в архиве была пропущена",
        noSnameFound: "Не удалось найти '${sname}' (в строке ${line} пользовательского списка) в списке <strong>${model}</strong>. <strong>Советы:</strong> <ol><li>Подходит ли ваш список для модели <strong>${model}</strong>? Если нет, измените модель в настройках</li><li>Проверьте, нет ли опечатки в названии вашего вида</li></ol>",
        noSpecies: "Не найдено видов с именем ${cname}",
        noArchive: "Не удается получить доступ к архиву: ${location}. <br> Операция прервана",
        noWriteArchive: "Не удается записать в архив по адресу: ${location}. <br> Операция прервана",
        multiDay: "Многодневные операции еще не поддерживаются: ${file} не будет обрезан",
        allDaylight: "${file} не будет добавлен в архив, так как это происходит исключительно в дневное время.",
        conversionDone: "Завершено преобразование для ${file}",
        badConversion: "Ошибка преобразования файла файла ${file}: ${error}",

        noDirectory: "Не удалось найти папку '${match}'",
        dbFileMissing: "Не удалось найти сохранённый файл с поддерживаемым расширением: ${file}",
        goodResultSave: "${number} результатов сохранено в архиве",
        goodAudioExport: "Сохранено файлов: ${number} в <br>${path}",
        NoOP: "Записи уже сохранены, действий не требуется",
        goodDBUpdate: "Обновление базы данных завершено, ${total} записей добавлено в архив за ${seconds} секунд",
        fileLocationUpdated: "Расположение файла успешно обновлено в архиве. Обновите результаты, чтобы увидеть записи.",
        durationMismatch: '<span class="text-danger">Изменений не внесено</span>. Выбранный файл имеет другую продолжительность по сравнению с оригинальным файлом.',
        duplicateFIle: '<span class="text-danger">Изменений не внесено</span>. Выбранный файл уже существует в архиве.',
        fileUpdateError: '<span class="text-danger">Произошла ошибка при обновлении файла: ${message}</span>',
        goodFilePurge: "${file} и связанные с ним записи успешно удалены",
        failedFilePurge: "${file} не найден в архиве",
        fileToConvertNotFound: "Не удалось найти ${file}, пропуск конвертации.",
        mkDirFailed: "Не удалось создать директорию: ${path}<br>Ошибка: ${error}",
        conversionComplete: "Конвертация завершена: ${successTotal} успешно, ${failedTotal} с ошибками.",
        libraryUpToDate: "Библиотека актуальна. Действий не требуется",
        badModel: 'Модель "${model}" не найдена в базе данных.',
        noModel: "Необходимый столбец модели не найден в файле"


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
        badRange: "Ogiltigt intervall. Start- och sluttid är identiska",
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
        membershipExpiry: "Ditt medlemskap löper ut om ${expiresIn} dagar, du kan besöka <a href='https://buymeacoffee.com/matthew_kirkland' target='_blank'>medlemssidan</a> för att förnya",

        badMetadata: "Kunde inte extrahera nödvändig metadata från ${src}",
        noLoad: 'Modellen ${model} är inte laddad. Starta om Chirpity för att fortsätta. Om du ser detta meddelande upprepade gånger, är det troligt att din dator inte stöder AVX2 och Chirpity kommer inte att fungera på ditt system.',
        noDLL: 'Det har uppstått ett fel vid inläsning av modellen. Detta kan bero på att AVX-stöd saknas. Chirpity AI-modeller kräver AVX2-instruktionsuppsättningen för att fungera. Om du har AVX2 aktiverat och fortfarande ser detta meddelande, vänligen hänvisa till <a href="https://github.com/Mattk70/Chirpity-Electron/issues/84" target="_blank">detta problem</a> på Github.',
        noFile: "Kan inte öppna: ${error}",
        ffmpeg: 'FFMPEG-fel vid extrahering av ljud: ${error}',
        noNight: 'Inga detektioner. ${file} har ingen period inom den där förutsägelser skulle göras. <b>Tips:</b> För att se detektioner i denna fil, inaktivera nocmig-läget och kör analysen igen.',
        saveBlocked: "Kan inte spara filen ${filePath}\nför att den är öppen i ett annat program",
        goodSave: '${filePath} har skrivits framgångsrikt.',
        noDetections: "Inga detektioner hittades i urvalet",
        noDetectionsDetailed: 'Inga ${nocmig} ${species} detektioner hittades ${archive} med hjälp av ${list} listan.',
        noDetectionsDetailed2: 'Inga detektioner hittades i ${file}. Sökta efter poster med hjälp av ${list} listan och med en minimi-konfidens på ${confidence}%',
        dbNotLoaded: "Databasen har inte laddats klart. Kontroll av filens närvaro i arkivet har hoppats över",
        noSnameFound: "Kunde inte hitta '${sname}' (på rad ${line} i den anpassade listan) i <strong>${model}</strong> listan. <strong>Tips:</strong> <ol><li>Är din lista för modellen <strong>${model}</strong>? Om inte, ändra modellen i inställningarna</li><li>Kontrollera om det finns ett stavfel i artnamnet</li></ol>",
        noSpecies: "Inga arter hittades med namnet ${cname}",
        noArchive: "Kunde inte komma åt arkivplats: ${location}. <br> Åtgärden avbröts",
        noWriteArchive: "Kunde inte skriva till arkivplats: ${location}. <br> Åtgärden avbröts",
        multiDay: "Flerdagsoperationer stöds inte än: ${file} kommer inte att trimmas",
        allDaylight: "${file} kommer inte att läggas till i arkivet eftersom det är helt under dagtid.",
        conversionDone: "Konverteringen för ${file} är klar",
        badConversion: "Fel vid konvertering av filen ${file}: ${error}",

        noDirectory: "Kunde inte hitta mappen '${match}'",
        dbFileMissing: "Kunde inte hitta den sparade filen med ett stödformat: ${file}",
        goodResultSave: "${number} resultat sparade i arkivet",
        goodAudioExport: "${number} filer sparades i <br>${path}",
        NoOP: "Poster är redan sparade, inget att göra",
        goodDBUpdate: "Databasuppdatering klar, ${total} poster lades till i arkivet på ${seconds} sekunder",
        fileLocationUpdated: "Filens plats uppdaterades framgångsrikt i arkivet. Uppdatera resultaten för att se posterna.",
        durationMismatch: '<span class="text-danger">Inga ändringar gjorda</span>. Den valda filen har en annan längd än originalfilen.',
        duplicateFIle: '<span class="text-danger">Inga ändringar gjorda</span>. Den valda filen finns redan i arkivet.',
        fileUpdateError: '<span class="text-danger">Ett fel uppstod vid uppdatering av filen: ${message}</span>',
        goodFilePurge: "${file} och dess associerade poster raderades framgångsrikt",
        failedFilePurge: "${file} hittades inte i arkivet",
        fileToConvertNotFound: "Kan inte hitta ${file}, hoppar över konverteringen.",
        mkDirFailed: "Kunde inte skapa katalog: ${path}<br>Fel: ${error}",
        conversionComplete: "Konvertering klar, ${successTotal} lyckades, ${failedTotal} misslyckades.",
        libraryUpToDate: "Biblioteket är uppdaterat. Inget att göra",
        badModel: 'Modellen "${model}" hittades inte i databasen.',
        noModel: "Den nödvändiga modellkolumnen hittades inte i filen"


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
        badRange: "无效的范围。开始时间和结束时间相同",
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
        membershipExpiry: "您的会员资格将在${expiresIn}天后到期，您可以访问<a href='https://buymeacoffee.com/matthew_kirkland' target='_blank'>会员页面</a>进行续订",

        badMetadata: "无法从 ${src} 提取必要的元数据",
        noLoad: '模型 ${model} 未加载。请重新启动 Chirpity 以继续。如果您重复看到此消息，可能是您的计算机不支持 AVX2，Chirpity 将无法在您的系统上运行。',
        noDLL: '加载模型时发生错误。这可能是由于缺少 AVX 支持。Chirpity AI 模型需要 AVX2 指令集才能运行。如果您已启用 AVX2 但仍然看到此通知，请参考 <a href="https://github.com/Mattk70/Chirpity-Electron/issues/84" target="_blank">此问题</a> 以获取更多信息。',
        noFile: "无法打开：${error}",
        ffmpeg: 'FFMPEG 提取音频时出错: ${error}',
        noNight: '没有检测到。${file} 中没有任何预测应该给出的时间段。<b>提示：</b> 若要查看此文件中的检测结果，请禁用 nocmig 模式并重新运行分析。',
        saveBlocked: "无法保存文件 ${filePath}\n因为文件正在另一个应用程序中打开",
        goodSave: '${filePath} 已成功写入。',
        noDetections: "在选择中没有检测到任何结果",
        noDetectionsDetailed: '在 ${archive} 使用 ${list} 列表没有找到 ${nocmig} ${species} 检测结果。',
        noDetectionsDetailed2: '在 ${file} 中没有找到检测结果。搜索了 ${list} 列表中符合最低置信度 ${confidence}% 的记录。',
        dbNotLoaded: "数据库尚未加载完成。跳过了检查文件是否存在于档案中的步骤",
        noSnameFound: "无法在 <strong>${model}</strong> 列表中找到 '${sname}'（位于自定义列表的第 ${line} 行）。<strong>提示：</strong><ol><li>您的列表是针对 <strong>${model}</strong> 模型的吗？如果不是，请在设置中更改模型。</li><li>检查物种名称是否有拼写错误。</li></ol>",
        noSpecies: "未找到名称为 ${cname} 的物种",
        noArchive: "无法访问档案位置: ${location}. <br> 操作已中止",
        noWriteArchive: "无法写入档案位置: ${location}. <br> 操作已中止",
        multiDay: "暂不支持多日操作: ${file} 将不会被修剪",
        allDaylight: "${file} 不会被添加到档案中，因为它完全是在白天进行的。",
        conversionDone: "已完成 ${file} 的转换",
        badConversion: "转换文件 ${file} 时出错: ${error}",

        noDirectory: "无法找到文件夹 '${match}'",
        dbFileMissing: "无法找到带有支持的文件扩展名的保存文件：${file}",
        goodResultSave: "${number} 个结果已保存到档案",
        goodAudioExport: "${number} 个文件已保存到 <br>${path}",
        NoOP: "记录已保存，无需执行任何操作",
        goodDBUpdate: "数据库更新完成，${total} 条记录已在 ${seconds} 秒内添加到档案中",
        fileLocationUpdated: "文件位置已成功更新到档案中。刷新结果以查看记录。",
        durationMismatch: '<span class="text-danger">未作任何更改</span>。选定的文件与原始文件的时长不同。',
        duplicateFIle: '<span class="text-danger">未作任何更改</span>。选定的文件已存在于档案中。',
        fileUpdateError: '<span class="text-danger">更新文件时出错：${message}</span>',
        goodFilePurge: "${file} 及其相关记录已成功删除",
        failedFilePurge: "未在档案中找到 ${file}",
        fileToConvertNotFound: "无法找到 ${file}，跳过转换。",
        mkDirFailed: "无法创建目录：${path}<br>错误：${error}",
        conversionComplete: "转换完成，成功：${successTotal}，失败：${failedTotal}。",
        libraryUpToDate: "资料库已是最新，无需操作",
        badModel: '模型 "${model}" 未在数据库中找到。',
        noModel: "文件中未找到所需的模型列"

    }
    
};
const All = {
    "en": ["(Default)", "All"],
    "da": ["(Standard)", "Alle"],
    "de": ["(Standard)", "Alle"],
    "es": ["(Predeterminado)", "Todos"],
    "fr": ["(Par défaut)", "Tout"],
    "nl": ["(Standaard)", "Alles"],
    "pt": ["(Padrão)", "Todos"],
    "ru": ["(По умолчанию)", "Все"],
    "sv": ["(Standard)", "Alla"],
    "zh": ["(默认)", "所有"],
    "ja": ["(デフォルト)", "すべて"]
};

const Headings = {
    en: {
        position: ['Position', "Sort results by detection time"],
        time: ['Time', "Sort results by detection time"],
        species: ['Species', "Sort results by detection confidence"],
        calls: 'Calls',
        label: 'Label',
        notes: 'Notes',
        max: 'Maximum',
        detections: 'Detections',
        location: 'Location',
        search: "Species Search",
        searchPrompt: 'Use Species Search to load species',
        reviewed: 'Reviewed'
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
        location: "Placering",
        "search": "Artsøgning",
        "searchPrompt": "Brug artsøgning til at indlæse arter",
        "reviewed": "Gennemgået"
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
        location: "Standort",
        "search": "Artensuche",
        "searchPrompt": "Verwenden Sie die Artensuche, um Arten zu laden",
        "reviewed": "Überprüft"
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
        location: "Ubicación",
        "search": "Búsqueda de especies",
        "searchPrompt": "Usa la búsqueda de especies para cargar especies",
        "reviewed": "Revisado"
    },
    fr: {
        position: ['Position', "Trier les résultats par heure de détection"],
        time: ['Temps', "Trier les résultats par heure de détection"],
        species: ['Espèces', "Trier les résultats par confiance en la détection"],
        calls: 'Cris',
        label: 'Étiquette',
        notes: 'Notes',
        max: 'Maximum',
        detections: 'Détections',
        location: "Emplacement",
        "search": "Recherche d'espèces",
        "searchPrompt": "Utilisez la recherche d'espèces pour charger des espèces",
        "reviewed": "Révisé"
    },
    ja: {
        position: ['位置', "検出時間で結果を並べ替える"],
        time: ['時間', "検出時間で結果を並べ替える"],
        species: ['種', "検出信頼度で結果を並べ替える"],
        calls: 'コール',
        label: 'ラベル',
        notes: 'ノート',
        max: '最大',
        detections: '検出',
        location: '場所',
        "search": "種検索",
        "searchPrompt": "種検索を使用して種を読み込む",
        "reviewed": "確認済み"
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
        location: "Locatie",
        "search": "Soeken op soort",
        "searchPrompt": "Gebruik Soeken op soort om soorten te laden",
        "reviewed": "Beoordeeld"
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
        location: "Localização",
        "search": "Pesquisa de espécies",
        "searchPrompt": "Use a pesquisa de espécies para carregar espécies",
        "reviewed": "Revisado"
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
        location:  "Местоположение",
        "search": "Поиск видов",
        "searchPrompt": "Используйте поиск видов для загрузки видов",
        "reviewed": "Просмотрено"
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
        location: "Plats",
        "search": "Artersökning",
        "searchPrompt": "Använd artersökning för att ladda arter",
        "reviewed": "Granskad"
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
        location: "位置",
        "search": "物种搜索",
        "searchPrompt": "使用物种搜索加载物种",
        "reviewed": "已审核"
    }
};

const Help = {
    keyboard: {
      en: 'Keyboard Shortcuts',
      fr: 'Raccourcis clavier',
      de: 'Tastenkombinationen',
      es: 'Atajos de teclado',
      ja: 'キーボードショートカット',   // Japanese
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
      ja: '設定ヘルプ',               // Japanese
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
      ja: '使用ガイド',               // Japanese
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
      ja: 'eBird記録FAQ',             // Japanese
      pt: 'FAQ de Registros do eBird',
      ru: 'Часто задаваемые вопросы о записях eBird',
      nl: 'eBird Record FAQ',
      zh: 'eBird记录常见问题',
      sv: 'eBird Poster FAQ',        // Swedish
      da: 'eBird Record FAQ'        // Danish
    },    
    training: {
      en: 'Training settings',
      fr: 'Paramètres d\'entraînement',
      de: 'Trainingsparameter',
      es: 'Configuración de entrenamiento',
      ja: 'トレーニング設定',             // Japanese
      pt: 'Configurações de Treinamento',
      ru: 'Настройки обучения',
      nl: 'Trainingsinstellingen',
      zh: '训练设置',
      sv: 'Träningsinställningar',        // Swedish
      da: 'Træningsindstillinger'        // Danish
    },
    community: {
      en: 'Join the Chirpity Users Community',
      fr: 'Rejoindre la communauté des utilisateurs de Chirpity',
      de: 'Treten Sie der Chirpity-Benutzergemeinschaft bei',
      es: 'Únete a la comunidad de usuarios de Chirpity',
      ja: 'Chirpityユーザーコミュニティに参加する', // Japanese
      pt: 'Junte-se à comunidade de usuários do Chirpity',
      ru: 'Присоединиться к сообществу пользователей Chirpity',
      nl: 'Word lid van de Chirpity-gebruikersgemeenschap',
      zh: '加入Chirpity用户社区',
      sv: 'Gå med i Chirpity-användargemenskapen', // Swedish
      da: 'Bliv medlem af Chirpity-brugerfællesskabet' // Danish
    }
  }
  

const Location = {
    en: [
        'Set Location', 
        'Delete Location', 
        'Pick A Saved Location', 
        'Add, Edit or Delete Location', 
        'Update ALL open files to this location',
        "Lat:", "Lon:"
    ],
    da: [
        'Angiv placering', 
        'Slet placering', 
        'Vælg en gemt placering', 
        'Tilføj, rediger eller slet placering', 
        'Opdater ALLE åbne filer til denne placering',
        "Bredde:", "Længde:"
    ],
    de: [
        'Standort festlegen', 
        'Standort löschen', 
        'Gespeicherten Standort auswählen', 
        'Standort hinzufügen, bearbeiten oder löschen', 
        'Alle geöffneten Dateien auf diesen Standort aktualisieren',
        "Breitengrad:", "Längengrad:"
    ],
    es: [
        'Establecer ubicación', 
        'Eliminar ubicación', 
        'Seleccionar una ubicación guardada', 
        'Añadir, editar o eliminar una ubicación', 
        'Actualizar TODOS los archivos abiertos a esta ubicación',
        "Latitud:", "Longitud:"
    ],
    fr: [
        'Définir l’emplacement', 
        'Supprimer l’emplacement', 
        'Choisir un emplacement enregistré', 
        'Ajouter, modifier ou supprimer un emplacement', 
        'Mettre à jour TOUS les fichiers ouverts à cet emplacement',
        "Lat:", "Long:"
    ],
    ja: [
        '位置を設定', 
        '位置を削除', 
        '保存された位置を選択', 
        '位置を追加、編集、または削除', 
        'すべての開いているファイルをこの位置に更新',
        "緯度:", "経度:"
    ],
    nl: [
        'Locatie instellen', 
        'Locatie verwijderen', 
        'Kies een opgeslagen locatie', 
        'Locatie toevoegen, bewerken of verwijderen', 
        'Werk ALLE geopende bestanden bij naar deze locatie',
        "Breedte:", "Lengte:"
    ],
    pt: [
        'Definir localização', 
        'Excluir localização', 
        'Escolher uma localização salva', 
        'Adicionar, editar ou excluir localização', 
        'Atualizar TODOS os arquivos abertos para esta localização',
        "Lat:", "Lon:"
    ],
    ru: [
        'Установить местоположение', 
        'Удалить местоположение', 
        'Выбрать сохранённое местоположение', 
        'Добавить, изменить или удалить местоположение', 
        'Обновить ВСЕ открытые файлы до этого местоположения',
        "Широта:", "Долгота:"
    ],
    sv: [
        'Ange plats', 
        'Radera plats', 
        'Välj en sparad plats', 
        'Lägg till, redigera eller radera plats', 
        'Uppdatera ALLA öppna filer till denna plats',
        "Latitud:", "Longitud:"
    ],
    zh: [
        '设置位置', 
        '删除位置', 
        '选择一个保存的位置', 
        '添加、编辑或删除位置', 
        '更新所有打开的文件到此位置',
        "纬度:", "经度:"
    ]
};

const Context = {
    en: {
        lastNight: 'Last Night', thisWeek: 'This Week', lastWeek: 'LastWeek', thisMonth: 'This Month', lastMonth: 'Last Month', thisYear: 'This Year', lastYear: 'Last Year',
        midnight: "Midnight", noon: 'Noon', one: 'day', other: 'days',
        apply: 'Apply', cancel: 'Cancel', filter: 'Apply a date Filter',
        'nocturnal flight call': 'Nocturnal Flight Call', 'flight call': 'Flight Call', call: 'Call', song: 'Song',
        ecolocation: 'Echolocation', 'feeding buzz': 'Feeding Buzz', 'distress call': 'Distress Call', 'social call': 'Social Call',
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
        plural: 's',
        gotoTimeOfDay: 'Go to Time', gotoPosition: 'Go to Timecode',
        selectAll: 'Select all',
        clearAll: 'Clear all'
    },
    da: {
        lastNight: 'I går nat', thisWeek: 'Denne uge', lastWeek: 'Sidste uge', thisMonth: 'Denne måned', lastMonth: 'Sidste måned', thisYear: 'Dette år', lastYear: 'Sidste år',
        midnight: "Midnat", noon: "Middag", one: "dag", other: "dage",
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
        length: "Regionslængde",
        gotoTimeOfDay: 'Gå til tid', gotoPosition: 'Gå til tidskode',
        selectAll: 'Vælg alle', clearAll: 'Ryd alle'
    },
    de: {
        lastNight: 'Letzte Nacht', thisWeek: 'Diese Woche', lastWeek: 'Letzte Woche', thisMonth: 'Dieser Monat', lastMonth: 'Letzter Monat', thisYear: 'Dieses Jahr', lastYear: 'Letztes Jahr',
         midnight: "Mitternacht", noon: "Mittag", one: "Tag", other: "Tage",
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
        length: "Regionlänge",
        gotoTimeOfDay: 'Gehe zur Zeit', gotoPosition: 'Gehe zur Zeitcode',
        selectAll: 'Alle auswählen',
        clearAll: 'Alles löschen'
    },
    es: {
        lastNight: 'Anoche', thisWeek: 'Esta semana', lastWeek: 'La semana pasada', thisMonth: 'Este mes', lastMonth: 'El mes pasado', thisYear: 'Este año', lastYear: 'El año pasado',
        apply: 'Aplicar', cancel: 'Cancelar', filter: 'Aplicar un filtro de fecha',
        midnight: "Medianoche", noon: "Mediodía", one: "día", other: "días",
        'nocturnal flight call': 'Reclamos de vuelo nocturno', 'flight call': 'Reclamos de vuelo', call: 'Reclamos', song: 'Canto',
        play: 'Reproducir',
        pause: 'Pausa',
        analyse: 'Analizar',
        create: 'Crear', edit: 'Editar', record: 'el registro',
        export: 'Exportar audio(s)',
        compare: 'Comparar con reclamos de referencia',
        delete: 'Eliminar este registro',
        location: 'Modificar la ubicación de grabación del archivo',
        time: 'Modificar la hora de inicio del archivo',
        plural: 's',
        frequency: "Frecuencia",
        length: "Longitud de la región",
        gotoTimeOfDay: 'Ir a la hora', gotoPosition: 'Ir al código de tiempo',
        selectAll: 'Seleccionar todo',
        clearAll: 'Borrar todo'
    },
    fr: {
        lastNight: 'La nuit dernière', thisWeek: 'Cette semaine', lastWeek: 'La semaine dernière', thisMonth: 'Ce mois-ci', lastMonth: 'Le mois dernier', thisYear: 'Cette année', lastYear: 'L’année dernière',
        apply: 'Appliquer', cancel: 'Annuler', filter: 'Appliquer un filtre de date',
        midnight: "Minuit", noon: "Midi", one: "jour", other: "jours",
        'nocturnal flight call': 'Cri de vol nocturne', 'flight call': 'Cri de vol', call: 'Cri', song: 'Chant',
        play: 'Lecture',
        pause: 'Pause',
        analyse: 'Analyser',
        create: 'Créer', edit: 'Modifier', record: 'l’Enregistrement',
        export: 'Exporter un extrait audio',
        compare: 'Comparer avec des cris de référence',
        delete: 'Supprimer l’enregistrement',
        location: 'Modifier l’emplacement d’enregistrement du fichier',
        time: 'Modifier l’heure de début du fichier',
        plural: 's',
        frequency: "Fréquence",
        length: "Longueur de la région",
        gotoTimeOfDay: 'Aller à l’heure', gotoPosition: 'Aller au code temporel',
        selectAll: 'Tout sélectionner',
        clearAll: 'Tout effacer'
    },
    ja: {
        lastNight: '昨夜', thisWeek: '今週', lastWeek: '先週', thisMonth: '今月', lastMonth: '先月', thisYear: '今年', lastYear: '昨年',
        apply: '適用', cancel: 'キャンセル', filter: '日付フィルターを適用',
        midnight: "真夜中", noon: "正午", one: "日", other: "日間",
        'nocturnal flight call': '夜間飛行コール', 'flight call': '飛行コール', call: 'コール', song: '歌',
        play: '再生',
        pause: '一時停止',
        analyse: '分析',
        create: '作成', edit: '編集', record: '記録',
        export: 'オーディオクリップをエクスポート',
        compare: '参照コールと比較',
        delete: '記録を削除',
        location: 'ファイルの録音場所を修正',
        time: 'ファイルの開始時間を修正',
        plural: '',
        frequency: "周波数",
        length: "領域の長さ",
        gotoTimeOfDay: '時刻に移動', gotoPosition: 'タイムコードに移動',
        selectAll: 'すべて選択',
        clearAll: 'すべてクリア'
    },
    nl: {
        lastNight: 'Gisteravond', thisWeek: 'Deze week', lastWeek: 'Vorige week', thisMonth: 'Deze maand', lastMonth: 'Vorige maand', thisYear: 'Dit jaar', lastYear: 'Vorig jaar',
        apply: 'Toepassen', cancel: 'Annuleren', filter: 'Een datumfilter toepassen',
        midnight: "Middernacht", noon: "Middag", one: "dag", other: "dagen",
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
        length: "Regiolengte",
        gotoTimeOfDay: 'Ga naar tijd', gotoPosition: 'Ga naar tijdcode',
        selectAll: 'Alles selecteren',
        clearAll: 'Alles wissen'
    },
    pt: {
        lastNight: 'Ontem à noite', thisWeek: 'Esta semana', lastWeek: 'Semana passada', thisMonth: 'Este mês', lastMonth: 'Mês passado', thisYear: 'Este ano', lastYear: 'Ano passado',
        apply: 'Aplicar', cancel: 'Cancelar', filter: 'Aplicar um filtro de data',
        midnight: "Meia-noite", noon: "Meio-dia", one: "dia", other: "dias",
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
        length: "Comprimento da região",
        gotoTimeOfDay: 'Ir para a hora', gotoPosition: 'Ir para o código de tempo',
        selectAll: 'Selecionar tudo',
        clearAll: 'Limpar tudo'
    },
    ru: {
        lastNight: 'Прошлой ночью', thisWeek: 'На этой неделе', lastWeek: 'На прошлой неделе', thisMonth: 'В этом месяце', lastMonth: 'В прошлом месяце', thisYear: 'В этом году', lastYear: 'В прошлом году',
        apply: 'Применить', cancel: 'Отмена', filter: 'Применить фильтр по дате',
        midnight: "Полночь", noon: "Полдень", one: "день", other: "дня",
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
        length: "Длина региона",
        gotoTimeOfDay: 'Перейти ко времени', gotoPosition: 'Перейти к таймкоду',
        selectAll: 'Выбрать все',
        clearAll: 'Очистить все'
    },
    sv: {
        lastNight: 'I går kväll', thisWeek: 'Denna vecka', lastWeek: 'Förra veckan', thisMonth: 'Denna månad', lastMonth: 'Förra månaden', thisYear: 'Det här året', lastYear: 'Förra året',
        apply: 'Tillämpa', cancel: 'Avbryt', filter: 'Tillämpa ett datumfilter',
        midnight: "Midnatt", noon: "Middag", one: "dag", other: "dagar",
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
        length: "Regionlängd",
        gotoTimeOfDay: 'Gå till tid', gotoPosition: 'Gå till tidkod',
        selectAll: 'Välj alla',
        clearAll: 'Rensa allt'
    },
    zh: {
        lastNight: '昨晚', thisWeek: '本周', lastWeek: '上周', thisMonth: '本月', lastMonth: '上月', thisYear: '今年', lastYear: '去年',
        apply: '应用', cancel: '取消', filter: '应用日期过滤器',
        midnight: "午夜", noon: "中午", one: "天", other: "天",
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
        length: "区域长度",
        gotoTimeOfDay: '跳转到时间', gotoPosition: '跳转到时间码',
        selectAll: '全选',
        clearAll: '清除全部'
    }
};

const Form = {
    en: {submit: 'Submit', cancel: 'Cancel', select: "Select New Date and Time:"},
    da: {submit: 'Indsend', cancel: 'Annuller', select: "Vælg ny dato og tid:"},
    de: {submit: 'Absenden', cancel: 'Abbrechen', select: "Neues Datum und Uhrzeit auswählen:"},
    es: {submit: 'Enviar', cancel: 'Cancelar', select: "Seleccionar nueva fecha y hora:"},
    fr: {submit: 'Soumettre', cancel: 'Annuler', select: "Sélectionnez une nouvelle date et heure :"},
    ja: {submit: '送信', cancel: 'キャンセル', select: "新しい日付と時間を選択:"},
    nl: {submit: 'Verzenden', cancel: 'Annuleren', select: "Selecteer een nieuwe datum en tijd:"},
    pt: {submit: 'Enviar', cancel: 'Cancelar', select: "Selecione uma nova data e hora:"},
    ru: {submit: 'Отправить', cancel: 'Отмена', select: "Выберите новую дату и время:"},
    sv: {submit: 'Skicka', cancel: 'Avbryt', select: "Välj nytt datum och tid:"},
    zh: {submit: '提交', cancel: '取消', select: "选择新的日期和时间："}
};

const LIST_MAP = {
    en: { 
        location: 'Searching for birds in your region',
        nocturnal: 'Searching for nocturnal calls',
        birds: 'Searching for all birds',
        everything: 'Searching for everything',
        custom: 'Using a custom list'
    },
    da: {
        location: 'Søger efter fugle i din region',
        nocturnal: 'Søger efter natlige kald',
        birds: 'Søger efter alle fugle',
        everything: 'Søger efter alt',
        custom: 'Bruger en brugerdefineret liste'
    },
    de: {
        location: 'Suche nach Vögeln in Ihrer Region',
        nocturnal: 'Suche nach nächtlichen Rufen',
        birds: 'Suche nach allen Vögeln',
        everything: 'Suche nach allem',
        custom: 'Verwenden einer benutzerdefinierten Liste'
    },
    es: {
        location: 'Buscando aves de tu zona',
        nocturnal: 'Buscando reclamos nocturno',
        birds: 'Buscando cualquier ave identificable',
        everything: 'Buscando cualquier sonido identificable',
        custom: 'Usando una lista personalizada'
    },
    fr: {
        location: 'Recherche des oiseaux dans votre région',
        nocturnal: 'Recherche des cris nocturnes',
        birds: 'Recherche de tous les oiseaux',
        everything: 'Recherche de tout',
        custom: 'Utilisation d\'une liste personnalisée'
    },
    ja: {
        location: 'あなたの地域の鳥を探しています',
        nocturnal: '夜間のコールを探しています',
        birds: 'すべての鳥を探しています',
        everything: 'すべてを探しています',
        custom: 'カスタムリストを使用しています'
    },
    // it: {
    //     location: 'Cercando uccelli nella tua regione',
    //     nocturnal: 'Cercando uccelli notturni',
    //     birds: 'Cercando tutti gli uccelli',
    //     everything: 'Cercando tutto',
    //     custom: 'Uso di una lista personalizzata'
    // },
    nl: {
        location: 'Zoeken naar vogels in uw regio',
        nocturnal: 'Zoeken naar nachtelijke roepen',
        birds: 'Zoeken naar alle vogels',
        everything: 'Zoeken naar alles',
        custom: 'Gebruik van een aangepaste lijst'
    },
    // pl: {
    //     location: 'Szukam ptaków w twoim regionie',
    //     nocturnal: 'Szukam ptaków nocnych',
    //     birds: 'Szukam wszystkich ptaków',
    //     everything: 'Szukam wszystkiego',
    //     custom: 'Używanie niestandardowej listy'
    // },
    pt: {
        location: 'Procurando pássaros na sua região',
        nocturnal: 'Procurando por chamadas noturnos',
        birds: 'Procurando todos os pássaros',
        everything: 'Procurando tudo',
        custom: 'Usando uma lista personalizada'
    },
    ru: {
        location: 'Поиск птиц в вашем регионе',
        nocturnal: 'Поиск ночных звуков',
        birds: 'Поиск всех птиц',
        everything: 'Поиск всего',
        custom: 'Использование пользовательского списка'
    },
    sv: {
        location: 'Söker efter fåglar i din region',
        nocturnal: 'Söker efter nattaktiva läten',
        birds: 'Söker efter alla fåglar',
        everything: 'Söker efter allt',
        custom: 'Använder en anpassad lista'
    },
    zh: {
        location: '正在寻找您所在地区的鸟类',
        nocturnal: '正在寻找夜间叫声',
        birds: '正在寻找所有鸟类',
        everything: '正在寻找一切',
        custom: '使用自定义列表'
    }
};



const Titles = {
    da: {
        filename: "Højreklik for at opdatere filens starttid eller placering",
        controlsWrapper: "Træk for at ændre størrelsen på spektrogramvinduet.",
        playToggle: "Afspil / Pause (Mellemrumstasten)",
        zoomIn: "Zoom ind på spektrogrammet (Genvejstast: +)",
        zoomOut: "Zoom ud på spektrogrammet (Genvejstast: -)",
        nocmigOn: "Nocmig-tilstand aktiveret",
        nocmigOff: "Nocmig-tilstand deaktiveret",
        audioFiltersOn: "Lydfiltre anvendt",
        audioFiltersOff: "Ingen lydfiltre",
        contextModeOn: "Kontekstafhængig tilstand aktiveret",
        contextModeOff: "Kontekstafhængig tilstand deaktiveret",
        "frequency-range": "Juster spektrogrammets frekvensområde",
        "threshold-value": "Grænseværdi for forudsigelsestillid",
        "clear-custom-list": "Ryd brugerdefineret liste",
        "clear-database-location": "Ryd brugerdefineret databaseplacering",
        primaryLogoLink: "Besøg Chirpity-websitet"
      },
    de: {
        filename: "Rechtsklick, um die Startzeit oder den Speicherort der Datei zu aktualisieren",
        controlsWrapper: "Ziehen, um das Spektrogrammfenster zu ändern.",
        playToggle: "Abspielen / Pause (Leertaste)",
        zoomIn: "Ins Spektrogramm zoomen (Tastenkürzel: +)",
        zoomOut: "Aus dem Spektrogramm herauszoomen (Tastenkürzel: -)",
        nocmigOn: "Nocmig-Modus aktiviert",
        nocmigOff: "Nocmig-Modus deaktiviert",
        audioFiltersOn: "Audiofilter angewendet",
        audioFiltersOff: "Keine Audiofilter",
        contextModeOn: "Kontextbewusster Modus aktiviert",
        contextModeOff: "Kontextbewusster Modus deaktiviert",
        "frequency-range": "Frequenzbereich des Spektrogramms anpassen",
        "threshold-value": "Schwellenwert für Vorhersagevertrauen",
        "clear-custom-list": "Benutzerdefinierte Liste löschen",
        "clear-database-location": "Benutzerdefinierten Datenbankstandort löschen",
        primaryLogoLink: "Besuchen Sie die Chirpity-Website"
      },
    en: {
        filename:"Context-click to update file start time or location",
        controlsWrapper: "Drag to resize the Spectrogram window.",
        playToggle: "Play / Pause (SpaceBar)",
        zoomIn: "Zoom into the spectrogram (Keyboard Shortcut: + key)",
        nocmigOn: "Nocmig mode on",
        nocmigOff: "Nocmig mode off",
        zoomOut: "Zoom out of the spectrogram (Keyboard Shortcut: - key)",
        audioFiltersOn: "Audio filters applied",
        audioFiltersOff: "No Audio filters",
        contextModeOn: "Context Mode enabled",
        contextModeOff: "Context Mode disabled",
        "context-mode": "Context Aware mode enabled",
        "frequency-range": "Adjust spectrogram frequency range",
        "threshold-value": "Prediction confidence threshold",
        "clear-custom-list": "Clear custom list",
        "clear-database-location": "Clear custom database location",
        primaryLogoLink: "Visit the Chirpity website"
    },
    es: {
        filename: "Haz clic derecho para actualizar la hora de inicio o la ubicación del archivo",
      controlsWrapper: "Arrastra para cambiar el tamaño de la ventana del sonograma.",
      playToggle: "Reproducir / Pausa (Barra espaciadora)",
      zoomIn: "Acercar el sonograma (Atajo de teclado: tecla +)",
      zoomOut: "Alejar el sonograma (Atajo de teclado: tecla -)",
      nocmigOn: "Modo Nocmig activado",
      nocmigOff: "Modo Nocmig desactivado",
      audioFiltersOn: "Filtros de audio aplicados",
      audioFiltersOff: "Sin filtros de audio",
      contextModeOn: "Modo contexto activado",
      contextModeOff: "Modo contexto desactivado",
      "frequency-range": "Ajustar el rango de frecuencias del sonograma",
      "threshold-value": "Umbral de confianza de la predicción",
      "clear-custom-list": "Borrar lista personalizada",
      "clear-database-location": "Borrar ubicación personalizada de la base de datos",
      primaryLogoLink: "Visita la web de Chirpity"
    },
    fr: {
        filename: "Clic droit pour mettre à jour l'heure de début ou l'emplacement du fichier",
      controlsWrapper: "Faites glisser pour redimensionner la fenêtre du spectrogramme.",
      playToggle: "Lecture / Pause (Barre d'espace)",
      zoomIn: "Zoomer sur le spectrogramme (Raccourci clavier : touche +)",
      zoomOut: "Dézoomer sur le spectrogramme (Raccourci clavier : touche -)",
      nocmigOn: "Mode Nocmig activé",
      nocmigOff: "Mode Nocmig désactivé",
      audioFiltersOn: "Filtres audio appliqués",
      audioFiltersOff: "Pas de filtres audio",
      contextModeOn: "Mode contextuel activé",
      contextModeOff: "Mode contextuel désactivé",
      "frequency-range": "Ajuster la plage de fréquences du spectrogramme",
      "threshold-value": "Seuil de confiance pour les prédictions",
      "clear-custom-list": "Effacer la liste personnalisée",
      "clear-database-location": "Effacer l'emplacement personnalisé de la base de données",
      primaryLogoLink: "Visitez le site Web de Chirpity"
    },
    ja: {
        filename: "右クリックしてファイルの開始時間または場所を更新",
        controlsWrapper: "ドラッグしてスペクトログラムウィンドウのサイズを変更します。",
        playToggle: "再生 / 一時停止 (スペースキー)",
        zoomIn: "スペクトログラムをズームイン (ショートカットキー: + キー)",
        zoomOut: "スペクトログラムをズームアウト (ショートカットキー: - キー)",
        nocmigOn: "Nocmigモードオン",
        nocmigOff: "Nocmigモードオフ",
        audioFiltersOn: "オーディオフィルターが適用されました",
        audioFiltersOff: "オーディオフィルターなし",
        contextModeOn: "コンテキストモードが有効",
        contextModeOff: "コンテキストモードが無効",
        "frequency-range": "スペクトログラムの周波数範囲を調整",
        "threshold-value": "予測信頼度のしきい値",
        "clear-custom-list": "カスタムリストをクリア",
        "clear-database-location": "カスタムデータベースの場所をクリア",
        primaryLogoLink: "Chirpityのウェブサイトを訪問"
    },
    nl: {
        filename: "Klik met de rechtermuisknop om de starttijd of locatie van het bestand bij te werken",
        controlsWrapper: "Sleep om het spectrogramvenster te vergroten of verkleinen.",
        playToggle: "Afspelen / Pauzeren (Spatiebalk)",
        zoomIn: "Inzoomen op het spectrogram (Sneltoets: + toets)",
        zoomOut: "Uitzoomen op het spectrogram (Sneltoets: - toets)",
        nocmigOn: "Nocmig-modus ingeschakeld",
        nocmigOff: "Nocmig-modus uitgeschakeld",
        audioFiltersOn: "Audiostanden toegepast",
        audioFiltersOff: "Geen audiostanden",
        contextModeOn: "Contextbewuste modus ingeschakeld",
        contextModeOff: "Contextbewuste modus uitgeschakeld",
        "frequency-range": "Frequentiebereik van het spectrogram aanpassen",
        "threshold-value": "Drempelwaarde voor voorspelling",
        "clear-custom-list": "Aangepaste lijst wissen",
        "clear-database-location": "Aangepaste database locatie wissen",
        primaryLogoLink: "Bezoek de Chirpity-website"
      },
    pt: {
        filename: "Clique com o botão direito para atualizar o horário de início ou o local do arquivo",
        controlsWrapper: "Arraste para redimensionar a janela do espectrograma.",
        playToggle: "Reproduzir / Pausar (Tecla Espaço)",
        zoomIn: "Aproximar no espectrograma (Atalho: tecla +)",
        zoomOut: "Afastar no espectrograma (Atalho: tecla -)",
        nocmigOn: "Modo Nocmig ativado",
        nocmigOff: "Modo Nocmig desativado",
        audioFiltersOn: "Filtros de áudio aplicados",
        audioFiltersOff: "Sem filtros de áudio",
        contextModeOn: "Modo contextual ativado",
        contextModeOff: "Modo contextual desativado",
        "frequency-range": "Ajustar o intervalo de frequência do espectrograma",
        "threshold-value": "Limite de confiança da previsão",
        "clear-custom-list": "Limpar lista personalizada",
        "clear-database-location": "Limpar localização personalizada do banco de dados",
        primaryLogoLink: "Visite o site da Chirpity"
      },
    ru: {
        filename: "Щелкните правой кнопкой мыши, чтобы обновить время начала или местоположение файла",
        controlsWrapper: "Перетащите, чтобы изменить размер окна спектрограммы.",
        playToggle: "Воспроизведение / Пауза (Пробел)",
        zoomIn: "Увеличить спектрограмму (Горячая клавиша: +)",
        zoomOut: "Уменьшить спектрограмму (Горячая клавиша: -)",
        nocmigOn: "Режим Nocmig включён",
        nocmigOff: "Режим Nocmig выключен",
        audioFiltersOn: "Применены аудиофильтры",
        audioFiltersOff: "Аудиофильтры отсутствуют",
        contextModeOn: "Контекстный режим включён",
        contextModeOff: "Контекстный режим выключен",
        "frequency-range": "Настройте диапазон частот спектрограммы",
        "threshold-value": "Порог уверенности в прогнозе",
        "clear-custom-list": "Очистить пользовательский список",
        "clear-database-location": "Очистить пользовательское расположение базы данных",
        primaryLogoLink: "Посетите сайт Chirpity"
    },
    sv: {
        filename: "Högerklicka för att uppdatera filens starttid eller plats",
        controlsWrapper: "Dra för att ändra storlek på spektrogramfönstret.",
        playToggle: "Spela / Pausa (Mellanslag)",
        zoomIn: "Zooma in på spektrogrammet (Kortkommando: +)",
        zoomOut: "Zooma ut på spektrogrammet (Kortkommando: -)",
        nocmigOn: "Nocmig-läge på",
        nocmigOff: "Nocmig-läge av",
        audioFiltersOn: "Ljudfilter aktiverade",
        audioFiltersOff: "Inga ljudfilter",
        contextModeOn: "Kontextmedvetet läge aktiverat",
        contextModeOff: "Kontextmedvetet läge avaktiverat",
        "frequency-range": "Justera spektrogrammets frekvensomfång",
        "threshold-value": "Tröskel för förutsägelseförtroende",
        "clear-custom-list": "Rensa anpassad lista",
        "clear-database-location": "Rensa anpassad databasplats",
        primaryLogoLink: "Besök Chirpity-webbplatsen"
    },
    zh: {
        filename: "右键单击以更新文件的开始时间或位置",
      controlsWrapper: "拖动以调整光谱窗口的大小。",
      playToggle: "播放 / 暂停（空格键）",
      zoomIn: "放大光谱图（快捷键：+ 键）",
      zoomOut: "缩小光谱图（快捷键：- 键）",
      nocmigOn: "Nocmig 模式已开启",
      nocmigOff: "Nocmig 模式已关闭",
      audioFiltersOn: "已应用音频过滤器",
      audioFiltersOff: "无音频过滤器",
      contextModeOn: "上下文感知模式已启用",
      contextModeOff: "上下文感知模式已禁用",
      "frequency-range": "调整光谱图的频率范围",
      "threshold-value": "预测置信度阈值",
      "clear-custom-list": "清除自定义列表",
      "clear-database-location": "清除自定义数据库位置",
      primaryLogoLink: "访问 Chirpity 网站"
    },
    it: { // random! But will leave in. Italian
        filename: "Fai clic destro per aggiornare l'ora di inizio o la posizione del file",
        controlsWrapper: "Trascina per ridimensionare la finestra dello spettrogramma.",
        playToggle: "Riproduci / Pausa (Barra spaziatrice)",
        zoomIn: "Ingrandisci lo spettrogramma (Scorciatoia: tasto +)",
        zoomOut: "Riduci lo spettrogramma (Scorciatoia: tasto -)",
        nocmigOn: "Modalità Nocmig attivata",
        nocmigOff: "Modalità Nocmig disattivata",
        audioFiltersOn: "Filtri audio applicati",
        audioFiltersOff: "Nessun filtro audio",
        contextModeOn: "Modalità contestuale abilitata",
        contextModeOff: "Modalità contestuale disabilitata",
        "frequency-range": "Regola l'intervallo di frequenza dello spettrogramma",
        "threshold-value": "Soglia di confidenza della previsione",
        "clear-custom-list": "Cancella lista personalizzata",
        primaryLogoLink: "Visita il sito web di Chirpity"
    },
    pl: { // Also random! Polish
        filename: "Kliknij prawym przyciskiem myszy, aby zaktualizować czas rozpoczęcia lub lokalizację pliku",
      controlsWrapper: "Przeciągnij, aby zmienić rozmiar okna spektrogramu.",
      playToggle: "Odtwórz / Pauza (Spacja)",
      zoomIn: "Powiększ spektrogram (Skrót klawiaturowy: klawisz +)",
      zoomOut: "Pomniejsz spektrogram (Skrót klawiaturowy: klawisz -)",
      nocmigOn: "Tryb Nocmig włączony",
      nocmigOff: "Tryb Nocmig wyłączony",
      audioFiltersOn: "Zastosowano filtry audio",
      audioFiltersOff: "Brak filtrów audio",
      contextModeOn: "Włączono tryb kontekstowy",
      contextModeOff: "Wyłączono tryb kontekstowy",
      "frequency-range": "Dostosuj zakres częstotliwości spektrogramu",
      "threshold-value": "Próg pewności predykcji",
      "clear-custom-list": "Wyczyść niestandardową listę",
      primaryLogoLink: "Odwiedź stronę internetową Chirpity"
    }
  };
  
  const Lists = {
    en: { 
        location: 'Local Birds', 
        nocturnal: 'Nocturnal Calls', 
        birds: 'All Birds', 
        everything: 'Everything', 
        custom: 'Custom',
        timecode: 'Timecode',
        timeOfDay: 'Time of Day',
        ogg: 'Lossy (recommended)',
        flac: 'Lossless',
        Global: "Global",
        Europe: "Europe",
        Mediterranean: "Mediterranean",
        customListPH: 'No custom list set',
        libraryLocationPH: 'No location set'
    },
    da: {
        location: 'Lokale fugle',
        nocturnal: 'Natlige kald',
        birds: 'Alle fugle',
        everything: 'Alt',
        custom: 'Brugerdefineret',
        timecode: "Tidskode",
        timeOfDay: "Tidspunkt på dagen",
        ogg: "Tabsgivende (anbefalet)",
        flac: "Tabsfri",
        Global: "Global",
        Europe: "Europa",
        Mediterranean: "Middelhavet",
        customListPH: "Ingen liste angivet", 
        libraryLocationPH: "Ingen placering angivet" 
    },
    de: {
        location: 'Einheimische Vögel',
        nocturnal: 'Nächtliche Rufen',
        birds: 'Alle Vögel',
        everything: 'Alles',
        custom: 'Benutzerdefiniert',
        timecode: "Zeitcode",
        timeOfDay: "Tageszeit",
        ogg: "Verlustbehaftet (empfohlen)",
        flac: "Verlustfrei",
        Global: "Allgemein",
        Europe: "Europa",
        Mediterranean: "Mittelmeer",
        customListPH: "Keine Liste festgelegt", 
        libraryLocationPH: "Kein Standort festgelegt" 
    },
    es: {
        location: 'Aves de la zona',
        nocturnal: 'Reclamos nocturnos',
        birds: 'Todas las aves',
        everything: 'Cualquier sonido',
        custom: 'Personalizado',
        timecode: "Código de tiempo",
        timeOfDay: "Hora del día",
        ogg: "Con pérdida (recomendado)",
        flac: "Sin pérdida",
        Global: "Global",
        Europe: "Europa",
        Mediterranean: "Mediterráneo",
        customListPH: "Sin lista", 
        libraryLocationPH: "Sin ubicación" 
    },
    fr: {
        location: 'Oiseaux locaux',
        nocturnal: 'Cris nocturnes',
        birds: 'Tous les oiseaux',
        everything: 'Tout',
        custom: 'Personnalisé',
        timecode: "Code temporel",
        timeOfDay: "Heure de la journée",
        ogg: "Avec perte (recommandé)",
        flac: "Sans perte",
        Global: "Mondial",
        Europe: "Europe",
        Mediterranean: "Méditerranée",
        customListPH: "Aucune liste définie", 
        libraryLocationPH: "Aucun emplacement défini" 
    },
    ja: {
        location: '地域の鳥',
        nocturnal: '夜間のコール',
        birds: 'すべての鳥',
        everything: 'すべて',
        custom: 'カスタム',
        timecode: 'タイムコード',
        timeOfDay: '時刻',
        ogg: '非可逆圧縮（推奨）',
        flac: '可逆圧縮',
        Global: "グローバル",
        Europe: "ヨーロッパ",
        Mediterranean: "地中海",
        customListPH: 'カスタムリストが設定されていません',
        libraryLocationPH: '場所が設定されていません'
    },
    // it: {
    //     location: 'Uccelli locali',
    //     nocturnal: 'Uccelli notturni',
    //     birds: 'Tutti gli uccelli',
    //     everything: 'Tutto',
    //     custom: 'Personalizzato'
    // },
    nl: {
        location: 'Lokale vogels',
        nocturnal: 'Nachtelijke roepen',
        birds: 'Alle vogels',
        everything: 'Alles',
        custom: 'Aangepast',
        timecode: "Tijdcode",
        timeOfDay: "Tijd van de dag",
        ogg: "Verlies (aanbevolen)",
        flac: "Verliesvrij",
        Global: "Wereldwijd",
        Europe: "Europa",
        Mediterranean: "Middellandse Zeegebied",
        customListPH: "Geen lijst ingesteld", 
        libraryLocationPH: "Geen locatie ingesteld" 
    },
    // pl: {
    //     location: 'Lokalne ptaki',
    //     nocturnal: 'Ptaki nocne',
    //     birds: 'Wszystkie ptaki',
    //     everything: 'Wszystko',
    //     custom: 'Niestandardowe'
    // },
    pt: {
        location: 'Pássaros locais',
        nocturnal: 'Chamadas noturnos',
        birds: 'Todos os pássaros',
        everything: 'Tudo',
        custom: 'Personalizado',
        timecode: "Código de tempo",
        timeOfDay: "Hora do dia",
        ogg: "Com perdas (recomendado)",
        flac: "Sem perdas",
        Global: "Global",
        Europe: "Europa",
        Mediterranean: "Mediterrâneo",
        customListPH: "Nenhuma lista definida", 
        libraryLocationPH: "Nenhuma localização definida" 
    },
    ru: {
        location: 'Местные птицы',
        nocturnal: 'Ночные звуков',
        birds: 'Все птицы',
        everything: 'Все',
        custom: 'Пользовательский',
        timecode: "Таймкод",
        timeOfDay: "Время суток",
        ogg: "С потерями (рекомендуется)",
        flac: "Без потерь",
        Global: "Глобальный",
        Europe: "Европа",
        Mediterranean: "Средиземноморье",
        customListPH: "Без списка", 
        libraryLocationPH: "Без места" 
    },
    sv: {
        location: 'Lokala fåglar',
        nocturnal: 'Nattliga läten',
        birds: 'Alla fåglar',
        everything: 'Allt',
        custom: 'Anpassad',
        timecode: "Tidskod",
        timeOfDay: "Tid på dagen",
        ogg: "Förlust (rekommenderas)",
        flac: "Förlustfri",
        Global: "Global",
        Europe: "Europa",
        Mediterranean: "Medelhavet",
        customListPH: "Ingen lista angiven", 
        libraryLocationPH: "Ingen plats angiven" 
    },
    zh: {
        location: '本地鸟类',
        nocturnal: '夜间叫声',
        birds: '所有鸟类',
        everything: '所有',
        custom: '自定义',
        timecode: "时间码",
        timeOfDay: "一天中的时间",
        ogg: "有损（推荐）",
        flac: "无损",
        Global: "全球的",
        Europe: "欧洲",
        Mediterranean: "地中海",
        customListPH: "未设置列表", 
        libraryLocationPH: "未设置位置" 
    }
};

const Locate = {
    en: { locate: 'Locate File', remove: 'Remove from archive' },
    da: { locate: 'Find fil', remove: 'Fjern fra arkiv' },
    de: { locate: 'Datei suchen', remove: 'Aus dem Archiv entfernen' },
    es: { locate: 'Localizar archivo', remove: 'Eliminar del archivo' },
    fr: { locate: 'Localiser le fichier', remove: 'Retirer de l’archive' },
    ja: { locate: 'ファイルを探す', remove: 'アーカイブから削除' },
    nl: { locate: 'Bestand zoeken', remove: 'Verwijderen uit archief' },
    pt: { locate: 'Localizar arquivo', remove: 'Remover do arquivo' },
    ru: { locate: 'Найти файл', remove: 'Удалить из архива' },
    sv: { locate: 'Hitta fil', remove: 'Ta bort från arkiv' },
    zh: { locate: '定位文件', remove: '从存档中删除' }
};

const Tour = {
    en: `
        <!-- Carousel items -->
        <div class="carousel-item active">
            <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
            <div class="text-center pb-4">
                <h5>Welcome to Chirpity Nocmig</h5>
                <p>This tour will highlight a few of the key features of the application. Click the right arrow for the next item</p>
            </div>
        </div>
        <div class="carousel-item" data-element-selector="#navbarSettings">
            <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
            <div class="text-start pb-4 ms-3">
                <h5 class="text-center">Getting Started</h5>
                <ol class="ps-5 ms-5">
                    <li>First off, set your location in the settings menu.</li>
                    <li>Next, consider which model best suits your needs:</li>
                    <ul>
                        <li><b>Nocmig</b> is tuned for nocturnal migration,<br> but only has birds on the British list</li>
                        <li><b>BirdNET</b> is trained on global bird species</li>
                    </ul>
                </ol>
            </div>
        </div>
        <div class="carousel-item" data-element-selector="#filter-panel">
            <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
            <div class="text-center pb-4">
                <h5>Quick access settings panel</h5>
                <p>The icons here allow you to quickly toggle some frequently used settings.</p>
                These include:
                <div class="w-75 ms-5">
                    <ol class="text-start ps-5"> 
                        <li>Nocmig mode</li>
                        <li>Audio filters</li>
                        <li>Context-aware mode (Nocmig model only)</li>
                        <li>Frequency range adjustment for the spectrogram</li>
                        <li>Which detection list to use</li>
                        <li>And the confidence threshold</li>
                    </ol>
                </div>
                <p>Explanations for each of these settings can be found under "Settings" in the Help menu.</p>
            </div>
        </div>
        <div class="carousel-item" data-element-selector="#fileContainer">
            <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
            <div class="text-center pb-4">
                <h5>Context Menus</h5>
                <p>Most of the tools can be accessed within context menus. These pop up when you
                    right-click the mouse.
                    There are context menus for detections, selected regions on the spectrogram and
                    the filename.
                </p>
            </div>
        </div>
        <div class="carousel-item" data-element-selector="#navbarRecords">
            <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
            <div class="text-center pb-4">
                <h5>Saved Records</h5>
                <p>You can save records for future reference from the Records menu. Here you will
                    also find the Chart and Explore
                    sections of the Application. These allow you to revisit the detections you have
                    saved and view charts of species'
                    occurrence over time </p>
                </div>
            </div>
            <!-- Add more carousel items as needed -->
        </div>
        <!-- Carousel navigation controls -->
        <a class="carousel-control-prev" href="#carouselExample" role="button" data-bs-slide="prev">
            <span class="carousel-control-prev-icon" aria-hidden="true"></span>
            <span class="visually-hidden">Previous</span>
        </a>
        <a class="carousel-control-next" href="#carouselExample" role="button" data-bs-slide="next">
            <span class="carousel-control-next-icon" aria-hidden="true"></span>
            <span class="visually-hidden">Next</span>
        </a>
    `,
    fr: `
        <!-- Carousel items -->
        <div class="carousel-item active">
            <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
            <div class="text-center pb-4">
                <h5>Bienvenue sur Chirpity Nocmig</h5>
                <p>Cette visite met en évidence quelques-unes des fonctionnalités clés de l'application. Cliquez sur la flèche droite pour l'élément suivant</p>
            </div>
        </div>
        <div class="carousel-item" data-element-selector="#navbarSettings">
            <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
            <div class="text-start pb-4 ms-3">
                <h5 class="text-center">Commencer</h5>
                <ol class="ps-5 ms-5">
                    <li>Tout d'abord, définissez votre emplacement dans le menu des paramètres.</li>
                    <li>Ensuite, choisissez le modèle qui correspond le mieux à vos besoins :</li>
                    <ul>
                        <li><b>Nocmig</b> est adapté pour la migration nocturne,<br> mais ne contient que des oiseaux de la liste britannique</li>
                        <li><b>BirdNET</b> est formé sur des espèces d'oiseaux mondiales</li>
                    </ul>
                </ol>
            </div>
        </div>
        <div class="carousel-item" data-element-selector="#filter-panel">
            <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
            <div class="text-center pb-4">
                <h5>Panneau de paramètres d'accès rapide</h5>
                <p>Les icônes ici vous permettent de basculer rapidement certains paramètres fréquemment utilisés.</p>
                Ceux-ci incluent :
                <div class="w-75 ms-5">
                    <ol class="text-start ps-5"> 
                        <li>Mode Nocmig</li>
                        <li>Filtres audio</li>
                        <li>Mode contextuel (uniquement pour le modèle Nocmig)</li>
                        <li>Ajustement de la plage de fréquences pour le spectrogramme</li>
                        <li>Liste de détection à utiliser</li>
                        <li>Et le seuil de confiance</li>
                    </ol>
                </div>
                <p>Les explications pour chacun de ces paramètres peuvent être trouvées sous "Paramètres" dans le menu Aide.</p>
            </div>
        </div>
        <div class="carousel-item" data-element-selector="#fileContainer">
            <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
            <div class="text-center pb-4">
                <h5>Menus contextuels</h5>
                <p>La plupart des outils sont accessibles via des menus contextuels. Ceux-ci apparaissent lorsque vous faites un clic droit de la souris.
                    Il existe des menus contextuels pour les détections, les régions sélectionnées sur le spectrogramme et le nom du fichier.
                </p>
            </div>
        </div>
        <div class="carousel-item" data-element-selector="#navbarRecords">
            <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
            <div class="text-center pb-4">
                <h5>Enregistrements enregistrés</h5>
                <p>Vous pouvez enregistrer des enregistrements pour une référence future depuis le menu des Enregistrements. Vous y trouverez également les sections 
                    Graphique et Explorer de l'application. Elles vous permettent de revisiter les détections que vous avez enregistrées et de consulter des graphiques de l'occurrence des espèces au fil du temps
                </p>
            </div>
        </div>
        <!-- Add more carousel items as needed -->
    </div>
    <!-- Carousel navigation controls -->
    <a class="carousel-control-prev" href="#carouselExample" role="button" data-bs-slide="prev">
        <span class="carousel-control-prev-icon" aria-hidden="true"></span>
        <span class="visually-hidden">Précédent</span>
    </a>
    <a class="carousel-control-next" href="#carouselExample" role="button" data-bs-slide="next">
        <span class="carousel-control-next-icon" aria-hidden="true"></span>
        <span class="visually-hidden">Suivant</span>
    </a>
    `,
    da: `
    <!-- Carousel items -->
    <div class="carousel-item active">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>Velkommen til Chirpity Nocmig</h5>
            <p>Denne tur fremhæver nogle af de vigtigste funktioner i applikationen. Klik på højre pil for næste element</p>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#navbarSettings">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-start pb-4 ms-3">
            <h5 class="text-center">Kom godt i gang</h5>
            <ol class="ps-5 ms-5">
                <li>Start med at indstille din placering i indstillingsmenuen.</li>
                <li>Vælg derefter den model, der bedst passer til dine behov:</li>
                <ul>
                    <li><b>Nocmig</b> er indstillet til natlig migration,<br> men har kun fugle fra den britiske liste</li>
                    <li><b>BirdNET</b> er trænet på globale fuglearter</li>
                </ul>
            </ol>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#filter-panel">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>Hurtig adgang til indstillingspanelet</h5>
            <p>Ikonerne her giver dig mulighed for hurtigt at skifte nogle ofte brugte indstillinger.</p>
            Disse inkluderer:
            <div class="w-75 ms-5">
                <ol class="text-start ps-5"> 
                    <li>Nocmig-tilstand</li>
                    <li>Lydfiltre</li>
                    <li>Kontekstafhængig tilstand (kun Nocmig-model)</li>
                    <li>Justering af frekvensområdet for spektrogrammet</li>
                    <li>Hvilken detektionsliste der skal bruges</li>
                    <li>Og tillidsgrænsen</li>
                </ol>
            </div>
            <p>Forklaringer på hver af disse indstillinger kan findes under "Indstillinger" i hjælpemenuen.</p>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#fileContainer">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>Kontekstmenuer</h5>
            <p>De fleste af værktøjerne kan tilgås via kontekstmenuer. De vises, når du højreklikker med musen.
                Der er kontekstmenuer for detektioner, valgte områder på spektrogrammet og filnavnet.
            </p>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#navbarRecords">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>Gemte optegnelser</h5>
            <p>Du kan gemme optegnelser til fremtidig reference fra menuen "Optegnelser". Her finder du også sektionerne Diagram og Udforsk
                af applikationen. Disse giver dig mulighed for at gennemse de detektioner, du har gemt, og se diagrammer over arternes forekomst over tid.
            </p>
        </div>
    </div>
    <!-- Add more carousel items as needed -->
</div>
<!-- Carousel navigation controls -->
<a class="carousel-control-prev" href="#carouselExample" role="button" data-bs-slide="prev">
    <span class="carousel-control-prev-icon" aria-hidden="true"></span>
    <span class="visually-hidden">Forrige</span>
</a>
<a class="carousel-control-next" href="#carouselExample" role="button" data-bs-slide="next">
    <span class="carousel-control-next-icon" aria-hidden="true"></span>
    <span class="visually-hidden">Næste</span>
</a>
`,
de: `
    <!-- Carousel items -->
    <div class="carousel-item active">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>Willkommen bei Chirpity Nocmig</h5>
            <p>Diese Tour hebt einige der wichtigsten Funktionen der Anwendung hervor. Klicken Sie auf den rechten Pfeil für das nächste Element</p>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#navbarSettings">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-start pb-4 ms-3">
            <h5 class="text-center">Erste Schritte</h5>
            <ol class="ps-5 ms-5">
                <li>Stellen Sie zunächst Ihren Standort im Einstellungsmenü ein.</li>
                <li>Wählen Sie dann das Modell, das am besten zu Ihren Bedürfnissen passt:</li>
                <ul>
                    <li><b>Nocmig</b> ist auf nächtliche Migration abgestimmt,<br> aber es enthält nur Vögel der britischen Liste</li>
                    <li><b>BirdNET</b> ist auf globale Vogelarten trainiert</li>
                </ul>
            </ol>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#filter-panel">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>Schnellzugriffs-Einstellungsbereich</h5>
            <p>Die hier angezeigten Symbole ermöglichen es Ihnen, einige häufig verwendete Einstellungen schnell umzuschalten.</p>
            Diese umfassen:
            <div class="w-75 ms-5">
                <ol class="text-start ps-5"> 
                    <li>Nocmig-Modus</li>
                    <li>Audiofilter</li>
                    <li>Kontextabhängiger Modus (nur Nocmig-Modell)</li>
                    <li>Frequenzbereichsanpassung für das Spektrogramm</li>
                    <li>Welche Detektionsliste verwendet werden soll</li>
                    <li>Und der Konfidenzschwellenwert</li>
                </ol>
            </div>
            <p>Erklärungen zu jeder dieser Einstellungen finden Sie unter "Einstellungen" im Hilfemenü.</p>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#fileContainer">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>Kontextmenüs</h5>
            <p>Die meisten Werkzeuge können über Kontextmenüs aufgerufen werden. Diese erscheinen, wenn Sie mit der rechten Maustaste klicken.
                Es gibt Kontextmenüs für Detektionen, ausgewählte Bereiche im Spektrogramm und den Dateinamen.
            </p>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#navbarRecords">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>Gespeicherte Aufzeichnungen</h5>
            <p>Sie können Aufzeichnungen zur späteren Referenz im Menü "Aufzeichnungen" speichern. Hier finden Sie auch die Abschnitte Diagramm und Erforschen
                der Anwendung. Diese ermöglichen es Ihnen, die gespeicherten Detektionen zu durchsuchen und Diagramme über das Vorkommen von Arten im Laufe der Zeit anzusehen.
            </p>
        </div>
    </div>
    <!-- Weitere Carousel-Items nach Bedarf hinzufügen -->
</div>
<!-- Carousel Navigationssteuerungen -->
<a class="carousel-control-prev" href="#carouselExample" role="button" data-bs-slide="prev">
    <span class="carousel-control-prev-icon" aria-hidden="true"></span>
    <span class="visually-hidden">Zurück</span>
</a>
<a class="carousel-control-next" href="#carouselExample" role="button" data-bs-slide="next">
    <span class="carousel-control-next-icon" aria-hidden="true"></span>
    <span class="visually-hidden">Weiter</span>
</a>

`,
es: `
<!-- Carousel items -->
    <div class="carousel-item active">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>Bienvenido a Chirpity Nocmig</h5>
            <p>Este recorrido destacará algunas de las funciones clave de la aplicación. Haga clic en la flecha derecha para el siguiente elemento.</p>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#navbarSettings">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-start pb-4 ms-3">
            <h5 class="text-center">Inicio</h5>
            <ol class="ps-5 ms-5">
                <li>Primero, establezca su ubicación en el menú de configuración.</li>
                <li>Luego, elija el modelo que mejor se adapte a sus necesidades:</li>
                <ul>
                    <li><b>Nocmig</b> está ajustado para la migración nocturna,<br> pero solo tiene aves de la lista británica.</li>
                    <li><b>BirdNET</b> está entrenado con especies de aves de todo el mundo.</li>
                </ul>
            </ol>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#filter-panel">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>Panel de configuración de acceso rápido</h5>
            <p>Estos iconos le permiten modificar rápidamente algunas configuraciones usadas frecuentemente.</p>
            Entre ellas:
            <div class="w-75 ms-5">
                <ol class="text-start ps-5"> 
                    <li>Modo Nocmig</li>
                    <li>Filtros de audio</li>
                    <li>Modo contexto (solo modelo Nocmig)</li>
                    <li>Ajuste del rango de frecuencias para el sonograma</li>
                    <li>Qué lista de detección usar</li>
                    <li>Y el umbral de confianza</li>
                </ol>
            </div>
            <p>Las explicaciones para cada una de estas configuraciones se encuentran en "Configuración" en el menú de ayuda.</p>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#fileContainer">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>Menús contextuales</h5>
            <p>A la mayor parte de las herramientas se puede acceder mediante menús contextuales, los cuales aparecen cuando se hace clic derecho con el ratón.
                Hay menús contextuales para detecciones, áreas seleccionadas en el sonograma y el nombre del archivo.
            </p>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#navbarRecords">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>Registros guardados</h5>
            <p>Puede guardar registros para referencias futuras en el menú de Registros. Aquí también encontrará las opciones de Gráfica y Explorar
                de la aplicación, las cuales le permiten revisar las detecciones guardadas y ver gráficas de la aparición de especies a lo largo del tiempo.
            </p>
        </div>
    </div>
    <!-- Agregar más elementos del carrusel según sea necesario -->
</div>
<!-- Controles de navegación del carrusel -->
<a class="carousel-control-prev" href="#carouselExample" role="button" data-bs-slide="prev">
    <span class="carousel-control-prev-icon" aria-hidden="true"></span>
    <span class="visually-hidden">Anterior</span>
</a>
<a class="carousel-control-next" href="#carouselExample" role="button" data-bs-slide="next">
    <span class="carousel-control-next-icon" aria-hidden="true"></span>
    <span class="visually-hidden">Siguiente</span>
</a>

`,
ja: `
    <!-- Carousel items -->
    <div class="carousel-item active">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>Chirpity Nocmigへようこそ</h5>
            <p>このツアーでは、アプリケーションの主要な機能のいくつかを紹介します。次の項目に進むには右矢印をクリックしてください</p>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#navbarSettings">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-start pb-4 ms-3">
            <h5 class="text-center">はじめに</h5>
            <ol class="ps-5 ms-5">
                <li>まず、設定メニューで場所を設定します。</li>
                <li>次に、ニーズに最適なモデルを検討します：</li>
                <ul>
                    <li><b>Nocmig</b> は夜間移動に最適化されていますが、<br> 英国リストの鳥のみが含まれています</li>
                    <li><b>BirdNET</b> は世界中の鳥の種に対応しています</li>
                </ul>
            </ol>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#filter-panel">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>クイックアクセス設定パネル</h5>
            <p>ここにあるアイコンを使用して、頻繁に使用する設定をすばやく切り替えることができます。</p>
            これらには以下が含まれます：
            <div class="w-75 ms-5">
                <ol class="text-start ps-5"> 
                    <li>Nocmigモード</li>
                    <li>オーディオフィルター</li>
                    <li>コンテキスト認識モード（Nocmigモデルのみ）</li>
                    <li>スペクトログラムの周波数範囲の調整</li>
                    <li>使用する検出リスト</li>
                    <li>信頼度のしきい値</li>
                </ol>
            </div>
            <p>これらの設定の説明は、ヘルプメニューの「設定」で確認できます。</p>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#fileContainer">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>コンテキストメニュー</h5>
            <p>ほとんどのツールはコンテキストメニューからアクセスできます。これらはマウスの右クリックで表示されます。
                検出、スペクトログラム上の選択領域、ファイル名のコンテキストメニューがあります。
            </p>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#navbarRecords">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>保存された記録</h5>
            <p>記録メニューから将来の参照用に記録を保存できます。ここには、アプリケーションのチャートと探索セクションもあります。
                これらは、保存した検出を再訪し、種の出現のチャートを時間とともに表示することができます。
            </p>
        </div>
    </div>
    <!-- 必要に応じてさらにカルーセル項目を追加 -->
</div>
<!-- カルーセルナビゲーションコントロール -->
<a class="carousel-control-prev" href="#carouselExample" role="button" data-bs-slide="prev">
    <span class="carousel-control-prev-icon" aria-hidden="true"></span>
    <span class="visually-hidden">前へ</span>
</a>
<a class="carousel-control-next" href="#carouselExample" role="button" data-bs-slide="next">
    <span class="carousel-control-next-icon" aria-hidden="true"></span>
    <span class="visually-hidden">次へ</span>
</a>
`,
nl: `
    <!-- Carousel items -->
    <div class="carousel-item active">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>Welkom bij Chirpity Nocmig</h5>
            <p>Deze tour benadrukt enkele van de belangrijkste functies van de applicatie. Klik op de rechterpijl voor het volgende item</p>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#navbarSettings">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-start pb-4 ms-3">
            <h5 class="text-center">Aan de slag</h5>
            <ol class="ps-5 ms-5">
                <li>Stel eerst je locatie in via het instellingenmenu.</li>
                <li>Kies vervolgens het model dat het beste bij jouw behoeften past:</li>
                <ul>
                    <li><b>Nocmig</b> is geoptimaliseerd voor nachtelijke migratie,<br> maar bevat alleen vogels van de Britse lijst</li>
                    <li><b>BirdNET</b> is getraind op wereldwijde vogelsoorten</li>
                </ul>
            </ol>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#filter-panel">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>Sneltoetseninstellingen</h5>
            <p>De pictogrammen die hier worden weergegeven, stellen je in staat om snel enkele veelgebruikte instellingen in te schakelen.</p>
            Deze omvatten:
            <div class="w-75 ms-5">
                <ol class="text-start ps-5"> 
                    <li>Nocmig-modus</li>
                    <li>Audiofilters</li>
                    <li>Contextuele modus (alleen Nocmig-model)</li>
                    <li>Frequentiebereikaanpassing voor het spectrogram</li>
                    <li>Welke detectielijst moet worden gebruikt</li>
                    <li>En de vertrouwensdrempel</li>
                </ol>
            </div>
            <p>Uitleg over elke instelling vind je onder "Instellingen" in het hulpprogramma-menu.</p>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#fileContainer">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>Contextmenu's</h5>
            <p>De meeste tools zijn toegankelijk via contextmenu's. Deze verschijnen wanneer je met de rechtermuisknop klikt.
                Er zijn contextmenu's voor detecties, geselecteerde gebieden in het spectrogram en de bestandsnaam.
            </p>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#navbarRecords">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>Opgeslagen opnames</h5>
            <p>Je kunt opnames opslaan voor later gebruik via het "Opnamen"-menu. Hier vind je ook de secties Grafieken en Verkennen
                van de applicatie. Hiermee kun je de opgeslagen detecties doorzoeken en grafieken van de soortenfrequentie in de tijd bekijken.
            </p>
        </div>
    </div>
    <!-- Voeg meer carousel-items toe indien nodig -->
</div>
<!-- Carousel Navigatiebesturing -->
<a class="carousel-control-prev" href="#carouselExample" role="button" data-bs-slide="prev">
    <span class="carousel-control-prev-icon" aria-hidden="true"></span>
    <span class="visually-hidden">Vorige</span>
</a>
<a class="carousel-control-next" href="#carouselExample" role="button" data-bs-slide="next">
    <span class="carousel-control-next-icon" aria-hidden="true"></span>
    <span class="visually-hidden">Volgende</span>
</a>
`,
pt:`
    <!-- Carousel items -->
    <div class="carousel-item active">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>Bem-vindo ao Chirpity Nocmig</h5>
            <p>Este tour destaca algumas das principais funcionalidades do aplicativo. Clique na seta para a direita para o próximo item</p>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#navbarSettings">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-start pb-4 ms-3">
            <h5 class="text-center">Primeiros Passos</h5>
            <ol class="ps-5 ms-5">
                <li>Primeiro, defina sua localização no menu de configurações.</li>
                <li>Em seguida, escolha o modelo que melhor atende às suas necessidades:</li>
                <ul>
                    <li><b>Nocmig</b> é otimizado para migração noturna,<br> mas contém apenas aves da lista britânica</li>
                    <li><b>BirdNET</b> é treinado para espécies de aves globais</li>
                </ul>
            </ol>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#filter-panel">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>Área de Configurações de Acesso Rápido</h5>
            <p>Os ícones exibidos aqui permitem alternar rapidamente algumas configurações comuns.</p>
            Estas incluem:
            <div class="w-75 ms-5">
                <ol class="text-start ps-5"> 
                    <li>Modo Nocmig</li>
                    <li>Filtros de Áudio</li>
                    <li>Modo Contextual (somente modelo Nocmig)</li>
                    <li>Ajuste de Faixa de Frequência para o Espectrograma</li>
                    <li>Lista de Detecção a ser utilizada</li>
                    <li>E o Limite de Confiança</li>
                </ol>
            </div>
            <p>Explicações sobre cada uma dessas configurações podem ser encontradas em "Configurações" no menu de Ajuda.</p>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#fileContainer">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>Menus de Contexto</h5>
            <p>A maioria das ferramentas pode ser acessada por meio de menus de contexto. Eles aparecem quando você clica com o botão direito do mouse.
                Existem menus de contexto para detecções, áreas selecionadas no espectrograma e o nome do arquivo.
            </p>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#navbarRecords">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>Gravações Salvas</h5>
            <p>Você pode salvar gravações para referência futura no menu "Gravações". Aqui, você também encontrará as seções de Gráficos e Explorar
                do aplicativo. Elas permitem que você pesquise as detecções salvas e visualize gráficos sobre a ocorrência das espécies ao longo do tempo.
            </p>
        </div>
    </div>
    <!-- Adicione mais itens ao Carousel conforme necessário -->
</div>
<!-- Controles de Navegação do Carousel -->
<a class="carousel-control-prev" href="#carouselExample" role="button" data-bs-slide="prev">
    <span class="carousel-control-prev-icon" aria-hidden="true"></span>
    <span class="visually-hidden">Voltar</span>
</a>
<a class="carousel-control-next" href="#carouselExample" role="button" data-bs-slide="next">
    <span class="carousel-control-next-icon" aria-hidden="true"></span>
    <span class="visually-hidden">Próximo</span>
</a>
`,
ru: `
    <!-- Carousel items -->
    <div class="carousel-item active">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>Добро пожаловать в Chirpity Nocmig</h5>
            <p>Этот тур выделяет некоторые из главных функций приложения. Нажмите на стрелку вправо, чтобы перейти к следующему элементу</p>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#navbarSettings">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-start pb-4 ms-3">
            <h5 class="text-center">Начало работы</h5>
            <ol class="ps-5 ms-5">
                <li>Сначала установите ваше местоположение в меню настроек.</li>
                <li>Затем выберите модель, которая лучше всего подходит для ваших нужд:</li>
                <ul>
                    <li><b>Nocmig</b> настроена на ночную миграцию,<br> но включает только птиц из британского списка</li>
                    <li><b>BirdNET</b> обучена на глобальных видах птиц</li>
                </ul>
            </ol>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#filter-panel">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>Область быстрого доступа к настройкам</h5>
            <p>Здесь показаны иконки, которые позволяют быстро переключать некоторые часто используемые настройки.</p>
            К ним относятся:
            <div class="w-75 ms-5">
                <ol class="text-start ps-5"> 
                    <li>Режим Nocmig</li>
                    <li>Аудиофильтры</li>
                    <li>Контекстный режим (только модель Nocmig)</li>
                    <li>Настройка частотного диапазона для спектрограммы</li>
                    <li>Выбор списка для детекций</li>
                    <li>И порог доверия</li>
                </ol>
            </div>
            <p>Объяснения для каждой из этих настроек можно найти в разделе "Настройки" в меню справки.</p>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#fileContainer">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>Контекстные меню</h5>
            <p>Большинство инструментов могут быть вызваны через контекстные меню. Они появляются, когда вы щелкаете правой кнопкой мыши.
                Есть контекстные меню для детекций, выбранных областей на спектрограмме и имени файла.
            </p>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#navbarRecords">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>Сохранённые записи</h5>
            <p>Вы можете сохранить записи для дальнейшего использования в меню "Записи". Также здесь вы найдёте разделы Диаграмма и Исследовать
                приложения. Эти разделы позволяют вам искать сохранённые детекции и просматривать графики появления видов со временем.
            </p>
        </div>
    </div>
    <!-- Добавить дополнительные элементы по мере необходимости -->
</div>
<!-- Управление навигацией в карусели -->
<a class="carousel-control-prev" href="#carouselExample" role="button" data-bs-slide="prev">
    <span class="carousel-control-prev-icon" aria-hidden="true"></span>
    <span class="visually-hidden">Назад</span>
</a>
<a class="carousel-control-next" href="#carouselExample" role="button" data-bs-slide="next">
    <span class="carousel-control-next-icon" aria-hidden="true"></span>
    <span class="visually-hidden">Вперёд</span>
</a>
`,
sv:`
    <!-- Carousel items -->
    <div class="carousel-item active">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>Välkommen till Chirpity Nocmig</h5>
            <p>Denna rundtur lyfter fram några av de viktigaste funktionerna i applikationen. Klicka på högerpil för att gå till nästa objekt</p>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#navbarSettings">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-start pb-4 ms-3">
            <h5 class="text-center">Komma igång</h5>
            <ol class="ps-5 ms-5">
                <li>Ställ först in din plats i inställningsmenyn.</li>
                <li>Välj sedan den modell som passar dina behov bäst:</li>
                <ul>
                    <li><b>Nocmig</b> är anpassad för nattlig migration,<br> men innehåller endast fåglar från Storbritanniens lista</li>
                    <li><b>BirdNET</b> är tränad på globala fågelarter</li>
                </ul>
            </ol>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#filter-panel">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>Snabbåtkomstinställningsområde</h5>
            <p>De ikoner som visas här låter dig snabbt växla mellan några vanliga inställningar.</p>
            Dessa inkluderar:
            <div class="w-75 ms-5">
                <ol class="text-start ps-5"> 
                    <li>Nocmig-läge</li>
                    <li>Ljudfilter</li>
                    <li>Kontextläge (endast Nocmig-modellen)</li>
                    <li>Frekvensområdejustering för spektrogrammet</li>
                    <li>Vilken detektionslista som ska användas</li>
                    <li>Och konfidentsnivåtröskeln</li>
                </ol>
            </div>
            <p>Förklaringar för varje av dessa inställningar finns under "Inställningar" i hjälpmenyn.</p>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#fileContainer">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>Kontextmenyer</h5>
            <p>De flesta verktyg kan nås via kontextmenyer. Dessa visas när du högerklickar.
                Det finns kontextmenyer för detektioner, valda områden i spektrogrammet och filnamn.
            </p>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#navbarRecords">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>Gemensamt sparade inspelningar</h5>
            <p>Du kan spara inspelningar för senare referens i menyn "Inspelningar". Här hittar du också diagram och utforskningssektioner
                av applikationen. Dessa låter dig söka bland sparade detektioner och titta på diagram över förekomsten av arter över tid.
            </p>
        </div>
    </div>
    <!-- Lägg till fler carousel-items efter behov -->
</div>
<!-- Carousel Navigeringskontroller -->
<a class="carousel-control-prev" href="#carouselExample" role="button" data-bs-slide="prev">
    <span class="carousel-control-prev-icon" aria-hidden="true"></span>
    <span class="visually-hidden">Tillbaka</span>
</a>
<a class="carousel-control-next" href="#carouselExample" role="button" data-bs-slide="next">
    <span class="carousel-control-next-icon" aria-hidden="true"></span>
    <span class="visually-hidden">Nästa</span>
</a>
`,
zh: `
    <!-- Carousel items -->
    <div class="carousel-item active">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>欢迎来到 Chirpity Nocmig</h5>
            <p>本次导览突出了应用程序的一些重要功能。点击右箭头以查看下一个项目</p>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#navbarSettings">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-start pb-4 ms-3">
            <h5 class="text-center">开始使用</h5>
            <ol class="ps-5 ms-5">
                <li>首先在设置菜单中设置您的位置。</li>
                <li>然后选择最适合您需求的模型：</li>
                <ul>
                    <li><b>Nocmig</b> 是专为夜间迁徙设计的，<br> 但仅包含英国名单上的鸟类</li>
                    <li><b>BirdNET</b> 是针对全球鸟类物种进行训练的</li>
                </ul>
            </ol>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#filter-panel">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>快速访问设置区域</h5>
            <p>此处显示的图标可以让您快速切换一些常用的设置。</p>
            这些包括：
            <div class="w-75 ms-5">
                <ol class="text-start ps-5"> 
                    <li>Nocmig 模式</li>
                    <li>音频滤波器</li>
                    <li>上下文模式（仅限 Nocmig 模型）</li>
                    <li>频率范围调整（适用于频谱图）</li>
                    <li>使用的检测列表</li>
                    <li>以及置信度阈值</li>
                </ol>
            </div>
            <p>每个设置的详细说明请参见帮助菜单中的“设置”。</p>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#fileContainer">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>上下文菜单</h5>
            <p>大多数工具可以通过右键菜单访问。右键点击时，会出现上下文菜单。
                这些菜单适用于检测结果、频谱图中的选定区域以及文件名。
            </p>
        </div>
    </div>
    <div class="carousel-item" data-element-selector="#navbarRecords">
        <img src="img/logo/chirpity_logo2.png" class="w-100 rounded pb-4" alt="Chirpity Nocmig">
        <div class="text-center pb-4">
            <h5>已保存的记录</h5>
            <p>您可以将记录保存在“记录”菜单中以供日后参考。这里还包括图表和应用程序的浏览部分。
                它们允许您浏览已保存的检测结果，并查看随时间变化的物种出现图表。
            </p>
        </div>
    </div>
    <!-- 根据需要添加更多 Carousel 项 -->
</div>
<!-- Carousel 导航控制 -->
<a class="carousel-control-prev" href="#carouselExample" role="button" data-bs-slide="prev">
    <span class="carousel-control-prev-icon" aria-hidden="true"></span>
    <span class="visually-hidden">上一页</span>
</a>
<a class="carousel-control-next" href="#carouselExample" role="button" data-bs-slide="next">
    <span class="carousel-control-next-icon" aria-hidden="true"></span>
    <span class="visually-hidden">下一页</span>
</a>
`
}
const Training = {
    en: {
        "training-modal-label": "Model Training",
        "dataset-location-select": "Training Audio Location:",
        "dataset-placeholder" : "Location with the training audio",
        "dataset-cache-location-select": "Dataset Cache Location:",
        "cache-placeholder" : "Location of the dataset cache",
        useCache: "Use cached dataset if it exists",
        "model-location-select": "Model Save Location:",
        "model-placeholder" : "Location to save the model",
        replace: "Replace labels",
        append: "Append labels",
        "training-parameters-title": "Training Parameters",
        epochs: "Epochs",
        lr: "Learning Rate",
        "label-smoothing": "Label Smoothing",
        focal: "Use focal loss",
        weights: "Use class weights",
        decay: "Use learning rate decay",
        "validation-split": "Validation Split",
        "augmentations-title": "Augmentations",
        mixup: "Mixup",
        roll: "Roll",
        "use-noise": "Mix in background noise",
        "classifier-title": "Classifier",
        "hidden-units": "Hidden Units",
        dropout: "Dropout",
        train: "Start Training",
        "training-dismiss": "Cancel",
    },
da: {
    "training-modal-label": "Modellæring",
    "dataset-location-select": "Placering af træningslyd:",
    "dataset-placeholder": "Placering med træningslyden",
    "dataset-cache-location-select": "Placering af datasæt-cache:",
    "cache-placeholder": "Placering af datasæt-cache",
    useCache: "Brug cachet datasæt, hvis det findes",
    "model-location-select": "Placering til at gemme modellen:",
    "model-placeholder": "Placering til at gemme modellen",
    replace: "Erstat etiketter",
    append: "Tilføj etiketter",
    "training-parameters-title": "Træningsparametre",
    epochs: "Epoker",
    lr: "Læringsrate",
    "label-smoothing": "Etiketudglatning",
    focal: "Brug fokal tab",
    weights: "Brug klassevægte",
    decay: "Brug læringsrate-reduktion",
    "validation-split": "Valideringsopdeling",
    "augmentations-title": "Augmenteringer",
    mixup: "Mixup",
    roll: "Rul",
    "use-noise": "Bland med baggrundsstøj",
    "classifier-title": "Klassifikator",
    "hidden-units": "Skjulte enheder",
    dropout: "Dropout",
    train: "Start træning",
    "training-dismiss": "Annuller",
},
de: {
    "training-modal-label": "Modelltraining",
    "dataset-location-select": "Trainingsdaten-Ort:",
    "dataset-placeholder": "Ort mit den Trainingsdaten",
    "dataset-cache-location-select": "Cache-Ort des Datensatzes:",
    "cache-placeholder": "Ort des Datensatz-Caches",
    useCache: "Gecachten Datensatz verwenden, falls vorhanden",
    "model-location-select": "Speicherort für Modell:",
    "model-placeholder": "Ort zum Speichern des Modells",
    replace: "Labels ersetzen",
    append: "Labels anhängen",
    "training-parameters-title": "Trainingsparameter",
    epochs: "Epochen",
    lr: "Lernrate",
    "label-smoothing": "Label-Smoothing",
    focal: "Fokalverlust verwenden",
    weights: "Klassen-Gewichte verwenden",
    decay: "Lernraten-Dekrement verwenden",
    "validation-split": "Validierungsanteil",
    "augmentations-title": "Augmentierungen",
    mixup: "Mixup",
    roll: "Rollen",
    "use-noise": "Hintergrundgeräusche einmischen",
    "classifier-title": "Klassifikator",
    "hidden-units": "Verborgene Einheiten",
    dropout: "Dropout",
    train: "Training starten",
    "training-dismiss": "Abbrechen",
},
es: {
    "training-modal-label": "Entrenamiento del Modelo",
    "dataset-location-select": "Ubicación del audio de entrenamiento:",
    "dataset-placeholder": "Ubicación del audio de entrenamiento",
    "dataset-cache-location-select": "Ubicación de la caché del conjunto de datos:",
    "cache-placeholder": "Ubicación de la caché del conjunto de datos",
    useCache: "Usar conjunto en caché si existe",
    "model-location-select": "Ubicación para guardar el modelo:",
    "model-placeholder": "Ubicación para guardar el modelo",
    replace: "Reemplazar etiquetas",
    append: "Añadir etiquetas",
    "training-parameters-title": "Parámetros de Entrenamiento",
    epochs: "Épocas",
    lr: "Tasa de aprendizaje",
    "label-smoothing": "Suavizado de etiquetas",
    focal: "Usar pérdida focal",
    weights: "Usar pesos de clase",
    decay: "Usar decaimiento de tasa de aprendizaje",
    "validation-split": "División de validación",
    "augmentations-title": "Aumentos",
    mixup: "Mixup",
    roll: "Desplazamiento",
    "use-noise": "Mezclar ruido de fondo",
    "classifier-title": "Clasificador",
    "hidden-units": "Unidades ocultas",
    dropout: "Dropout",
    train: "Iniciar entrenamiento",
    "training-dismiss": "Cancelar",
},
fr: {
    "training-modal-label": "Entraînement du Modèle",
    "dataset-location-select": "Emplacement de l’audio d’entraînement :",
    "dataset-placeholder": "Emplacement de l’audio d’entraînement",
    "dataset-cache-location-select": "Emplacement du cache du jeu de données :",
    "cache-placeholder": "Emplacement du cache du jeu de données",
    useCache: "Utiliser le jeu de données en cache s’il existe",
    "model-location-select": "Emplacement d’enregistrement du modèle :",
    "model-placeholder": "Emplacement pour enregistrer le modèle",
    replace: "Remplacer les étiquettes",
    append: "Ajouter des étiquettes",
    "training-parameters-title": "Paramètres d’Entraînement",
    epochs: "Époques",
    lr: "Taux d’apprentissage",
    "label-smoothing": "Lissage des étiquettes",
    focal: "Utiliser la perte focale",
    weights: "Utiliser les poids de classe",
    decay: "Utiliser la décroissance du taux d’apprentissage",
    "validation-split": "Fraction de validation",
    "augmentations-title": "Augmentations",
    mixup: "Mixup",
    roll: "Décalage",
    "use-noise": "Mélanger avec du bruit de fond",
    "classifier-title": "Classificateur",
    "hidden-units": "Unités cachées",
    dropout: "Abandon",
    train: "Démarrer l'entraînement",
    "training-dismiss": "Annuler",
},
ja: {
    "training-modal-label": "モデル学習",
    "dataset-location-select": "学習用音声の場所：",
    "dataset-placeholder": "学習用音声のある場所",
    "dataset-cache-location-select": "データセットキャッシュの場所：",
    "cache-placeholder": "データセットキャッシュの場所",
    useCache: "キャッシュされたデータセットがあれば使用",
    "model-location-select": "モデルの保存場所：",
    "model-placeholder": "モデルの保存先",
    replace: "ラベルを置き換える",
    append: "ラベルを追加する",
    "training-parameters-title": "学習パラメータ",
    epochs: "エポック数",
    lr: "学習率",
    "label-smoothing": "ラベルスムージング",
    focal: "フォーカルロスを使用",
    weights: "クラスの重みを使用",
    decay: "学習率減衰を使用",
    "validation-split": "検証分割率",
    "augmentations-title": "データ拡張",
    mixup: "Mixup",
    roll: "ロール",
    "use-noise": "背景ノイズを混合",
    "classifier-title": "分類器",
    "hidden-units": "隠れユニット",
    dropout: "ドロップアウト",
    train: "学習を開始",
    "training-dismiss": "キャンセル",
},
nl: {
    "training-modal-label": "Modeltraining",
    "dataset-location-select": "Locatie van trainingsaudio:",
    "dataset-placeholder": "Locatie met de trainingsaudio",
    "dataset-cache-location-select": "Locatie van datasetcache:",
    "cache-placeholder": "Locatie van de datasetcache",
    useCache: "Gebruik cache indien beschikbaar",
    "model-location-select": "Locatie om model op te slaan:",
    "model-placeholder": "Locatie om model op te slaan",
    replace: "Labels vervangen",
    append: "Labels toevoegen",
    "training-parameters-title": "Trainingsparameters",
    epochs: "Epochs",
    lr: "Leersnelheid",
    "label-smoothing": "Label-smoothing",
    focal: "Gebruik focal loss",
    weights: "Gebruik klassegewichten",
    decay: "Gebruik leersnelheidsverlaging",
    "validation-split": "Validatieverdeling",
    "augmentations-title": "Augmentaties",
    mixup: "Mixup",
    roll: "Rol",
    "use-noise": "Achtergrondgeluid mengen",
    "classifier-title": "Classifier",
    "hidden-units": "Verborgen eenheden",
    dropout: "Drop-out",
    train: "Training starten",
    "training-dismiss": "Annuleren",
},
pt: {
    "training-modal-label": "Treinamento de Modelo",
    "dataset-location-select": "Local do áudio de treinamento:",
    "dataset-placeholder": "Local com o áudio de treinamento",
    "dataset-cache-location-select": "Local do cache do conjunto de dados:",
    "cache-placeholder": "Local do cache do conjunto de dados",
    useCache: "Usar conjunto em cache se existir",
    "model-location-select": "Local para salvar o modelo:",
    "model-placeholder": "Local para salvar o modelo",
    replace: "Substituir rótulos",
    append: "Adicionar rótulos",
    "training-parameters-title": "Parâmetros de Treinamento",
    epochs: "Épocas",
    lr: "Taxa de aprendizado",
    "label-smoothing": "Suavização de rótulo",
    focal: "Usar perda focal",
    weights: "Usar pesos de classe",
    decay: "Usar decaimento da taxa de aprendizado",
    "validation-split": "Divisão de validação",
    "augmentations-title": "Aumentações",
    mixup: "Mixup",
    roll: "Rolagem",
    "use-noise": "Misturar ruído de fundo",
    "classifier-title": "Classificador",
    "hidden-units": "Unidades ocultas",
    dropout: "Dropout",
    train: "Iniciar treinamento",
    "training-dismiss": "Cancelar",
},
ru: {
    "training-modal-label": "Обучение модели",
    "dataset-location-select": "Местоположение обучающего аудио:",
    "dataset-placeholder": "Папка с обучающим аудио",
    "dataset-cache-location-select": "Местоположение кэша набора данных:",
    "cache-placeholder": "Папка кэша набора данных",
    useCache: "Использовать кэш, если доступен",
    "model-location-select": "Место сохранения модели:",
    "model-placeholder": "Путь для сохранения модели",
    replace: "Заменить метки",
    append: "Добавить метки",
    "training-parameters-title": "Параметры обучения",
    epochs: "Эпохи",
    lr: "Скорость обучения",
    "label-smoothing": "Сглаживание меток",
    focal: "Использовать фокальную потерю",
    weights: "Использовать веса классов",
    decay: "Использовать спад скорости обучения",
    "validation-split": "Доля валидации",
    "augmentations-title": "Аугментации",
    mixup: "Mixup",
    roll: "Сдвиг",
    "use-noise": "Смешивать с фоновым шумом",
    "classifier-title": "Классификатор",
    "hidden-units": "Скрытые единицы",
    dropout: "Dropout",
    train: "Начать обучение",
    "training-dismiss": "Отмена",
},
sv: {
    "training-modal-label": "Modellträning",
    "dataset-location-select": "Plats för träningsljud:",
    "dataset-placeholder": "Plats med träningsljudet",
    "dataset-cache-location-select": "Cacheplats för dataset:",
    "cache-placeholder": "Plats för datasetets cache",
    useCache: "Använd cache om den finns",
    "model-location-select": "Plats att spara modellen:",
    "model-placeholder": "Plats att spara modellen",
    replace: "Ersätt etiketter",
    append: "Lägg till etiketter",
    "training-parameters-title": "Träningsparametrar",
    epochs: "Epoker",
    lr: "Inlärningshastighet",
    "label-smoothing": "Etikettutjämning",
    focal: "Använd fokal förlust",
    weights: "Använd klassvikter",
    decay: "Använd inlärningshastighetsminskning",
    "validation-split": "Valideringsandel",
    "augmentations-title": "Augmenteringar",
    mixup: "Mixup",
    roll: "Rullning",
    "use-noise": "Blanda in bakgrundsljud",
    "classifier-title": "Klassificerare",
    "hidden-units": "Dolda enheter",
    dropout: "Dropout",
    train: "Starta träning",
    "training-dismiss": "Avbryt",
},
zh: {
    "training-modal-label": "模型训练",
    "dataset-location-select": "训练音频位置：",
    "dataset-placeholder": "包含训练音频的位置",
    "dataset-cache-location-select": "数据集缓存位置：",
    "cache-placeholder": "数据集缓存的位置",
    useCache: "如有缓存数据集则使用",
    "model-location-select": "模型保存位置：",
    "model-placeholder": "保存模型的位置",
    replace: "替换标签",
    append: "追加标签",
    "training-parameters-title": "训练参数",
    epochs: "轮数 (Epochs)",
    lr: "学习率",
    "label-smoothing": "标签平滑",
    focal: "使用焦点损失",
    weights: "使用类别权重",
    decay: "使用学习率衰减",
    "validation-split": "验证集划分",
    "augmentations-title": "增强方式",
    mixup: "Mixup",
    roll: "滚动",
    "use-noise": "混入背景噪声",
    "classifier-title": "分类器",
    "hidden-units": "隐藏单元",
    dropout: "Dropout",
    train: "开始训练",
    "training-dismiss": "取消",
    },
};

const ManageModels = {
    en: {
        "import-model-label": "Import Model",
        "model-name-text": "Model Name:",
        "model-name-placeholder": "Choose a unique name for the model",
        "import-location-select": "Model Location:",
        "model-location-placeholder": "Location of the custom model files",
        import: "Import Model",
        "expunge-modal-label": "Remove Custom Model",
        "expunge-model": "Model",
        "expunge-warning": "N.B. This will remove the model and its associated species and records from the database.",
        expunge: "Remove Model"
    },
    da: {
        "import-model-label": "Importer model",
        "model-name-text": "Modelnavn:",
        "model-name-placeholder": "Vælg et unikt navn til modellen",
        "import-location-select": "Modelplacering:",
        "model-location-placeholder": "Placering af brugerdefinerede modelfiler",
        import: "Importer model",
        "expunge-modal-label": "Fjern brugerdefineret model",
        "expunge-model": "Model",
        "expunge-warning": "Bemærk: Dette vil fjerne modellen og dens tilknyttede arter og optagelser fra databasen.",
        expunge: "Fjern model"
    },
    de: {
        "import-model-label": "Modell importieren",
        "model-name-text": "Modellname:",
        "model-name-placeholder": "Wählen Sie einen eindeutigen Namen für das Modell",
        "import-location-select": "Modellort:",
        "model-location-placeholder": "Ort der benutzerdefinierten Modellsdateien",
        import: "Modell importieren",
        "expunge-modal-label": "Benutzerdefiniertes Modell entfernen",
        "expunge-model": "Modell",
        "expunge-warning": "Hinweis: Dadurch wird das Modell und seine zugehörigen Arten und Aufzeichnungen aus der Datenbank entfernt.",
        expunge: "Modell entfernen"
    },
    es: {
        "import-model-label": "Importar Modelo",
        "model-name-text": "Nombre del Modelo:",
        "model-name-placeholder": "Elija un nombre único para el modelo",
        "import-location-select": "Ubicación del Modelo:",
        "model-location-placeholder": "Ubicación de los archivos del modelo personalizado",
        import: "Importar Modelo",
        "expunge-modal-label": "Eliminar Modelo Personalizado",
        "expunge-model": "Modelo",
        "expunge-warning": "N.B. Esto eliminará el modelo y sus especies y registros asociados de la base de datos.",
        expunge: "Eliminar Modelo"
    },
    fr: {
        "import-model-label": "Importer le Modèle",
        "model-name-text": "Nom du Modèle :",
        "model-name-placeholder": "Choisissez un nom unique pour le modèle",
        "import-location-select": "Emplacement du Modèle :",
        "model-location-placeholder": "Emplacement des fichiers du modèle personnalisé",
        import: "Importer le Modèle",
        "expunge-modal-label": "Supprimer le Modèle Personnalisé",
        "expunge-model": "Modèle",
        "expunge-warning": "N.B. Cela supprimera le modèle ainsi que ses espèces et enregistrements associés de la base de données.",
        expunge: "Supprimer le Modèle"
    },
    ja: {
        "import-model-label": "モデルのインポート",
        "model-name-text": "モデル名：",
        "model-name-placeholder": "モデルの一意な名前を選択してください",
        "import-location-select": "モデルの場所：",
        "model-location-placeholder": "カスタムモデルファイルの場所",
        import: "モデルをインポート",
        "expunge-modal-label": "カスタムモデルの削除",
        "expunge-model": "モデル",
        "expunge-warning": "注意：これにより、モデルとその関連する種および記録がデータベースから削除されます。",
        expunge: "モデルを削除"
    },
    nl: {
        "import-model-label": "Model Importeren",
        "model-name-text": "Modelnaam:",
        "model-name-placeholder": "Kies een unieke naam voor het model",
        "import-location-select": "Model Locatie:",
        "model-location-placeholder": "Locatie van de aangepaste modelfiles",
        import: "Model Importeren",
        "expunge-modal-label": "Verwijder Aangepast Model",
        "expunge-model": "Model",
        "expunge-warning": "N.B. Dit verwijdert het model en de bijbehorende soorten en records uit de database.",
        expunge: "Model Verwijderen"
    },
    pt: {
        "import-model-label": "Importar Modelo",
        "model-name-text": "Nome do Modelo:",
        "model-name-placeholder": "Escolha um nome único para o modelo",
        "import-location-select": "Localização do Modelo:",
        "model-location-placeholder": "Localização dos arquivos do modelo personalizado",
        import: "Importar Modelo",
        "expunge-modal-label": "Remover Modelo Personalizado",
        "expunge-model": "Modelo",
        "expunge-warning": "N.B. Isso removerá o modelo e suas espécies e registros associados do banco de dados.",
        expunge: "Remover Modelo"
    },
    ru: {
        "import-model-label": "Импортировать Модель",
        "model-name-text": "Название Модели:",
        "model-name-placeholder": "Выберите уникальное имя для модели",
        "import-location-select": "Местоположение Модели:",
        "model-location-placeholder": "Папка с пользовательскими файлами модели",
        import: "Импортировать Модель",
        "expunge-modal-label": "Удалить Пользовательскую Модель",
        "expunge-model": "Модель",
        "expunge-warning": "Примечание. Это удалит модель и связанные с ней виды и записи из базы данных.",
        expunge: "Удалить Модель"
    },
    sv: {
        "import-model-label": "Importera Modell",
        "model-name-text": "Modellnamn:",
        "model-name-placeholder": "Välj ett unikt namn för modellen",
        "import-location-select": "Modellens Plats:",
        "model-location-placeholder": "Plats för anpassade modelfiler",
        import: "Importera Modell",
        "expunge-modal-label": "Ta bort Anpassad Modell",
        "expunge-model": "Modell",
        "expunge-warning": "Obs. Detta kommer att ta bort modellen och dess associerade arter och poster från databasen.",
        expunge: "Ta bort Modell"
    },
    zh: {
        "import-model-label": "导入模型",
        "model-name-text": "模型名称：",
        "model-name-placeholder": "选择一个唯一的模型名称",
        "import-location-select": "模型位置：",
        "model-location-placeholder": "自定义模型文件的路径",
        import: "导入模型",
        "expunge-modal-label": "删除自定义模型",
        "expunge-model": "模型",
        "expunge-warning": "注意：这将从数据库中删除模型及其相关的物种和记录。",
        expunge: "删除模型"
    }
}

const SpeciesList = {
    da: {
        title: 'Aktuel artsliste', 
        includedButton: 'Inkluderet', 
        excludedButton: 'Ekskluderet', 
        cname: 'Almindeligt navn', 
        sname: 'Videnskabeligt navn',
        localBirds: ' begrænset til <b>lokale fugle</b>',
        week: '. Den aktuelle fil blev gemt i uge <b>${week}</b>',
        weekSpecific: 'uge-specifik',
        threshold: '${weekSpecific} artsfiltergrænse på <b>${speciesThreshold}</b>',
        location: ' fokuseret på <b>${place}</b>, med en ${species_filter_text}${current_file_text}',
        depending: ', afhængigt af datoen for den fil, du analyserer',
        upTo: ' op til ',
        included: '<br/><p>Antallet af opdagede arter afhænger af modellen, den anvendte liste og i tilfælde af lokalitetsfilteret af artsfiltergrænsen og muligvis den uge, optagelsen blev lavet.<p>\
        Du bruger modellen <b>${model}</b> og listen <b>${listInUse}</b>${localBirdsOnly}${location_filter_text}. Med disse indstillinger vil Chirpity vise detektioner for ${upTo} \
        <b>${count}</b> klasser${depending}:</p>\
        <table class="table table-striped"><thead class="sticky-top text-bg-dark"><tr><th>Almindeligt navn</th><th>Videnskabeligt navn</th></tr></thead><tbody>${includedList}</tbody></table>',
        excluded: '<br/><p>Omvendt vil applikationen ikke vise detektioner blandt følgende ${excludedCount} klasser:</p><table class="table table-striped"><thead class="sticky-top text-bg-dark"><tr><th>${cname}</th><th>${sname}</th></tr></thead><tbody>${excludedList}</tbody></table>'
    },
    de: {
        title: 'Aktuelle Artenliste', 
        includedButton: 'Eingeschlossen', 
        excludedButton: 'Ausgeschlossen', 
        cname: 'Trivialname', 
        sname: 'Wissenschaftlicher Name',
        localBirds: ' beschränkt auf <b>lokale Vögel</b>',
        week: '. Die aktuelle Datei wurde in Woche <b>${week}</b> gespeichert',
        weekSpecific: 'wochen-spezifisch',
        threshold: '${weekSpecific} Artenfiltergrenze von <b>${speciesThreshold}</b>',
        location: ' fokussiert auf <b>${place}</b>, mit einem ${species_filter_text}${current_file_text}',
        depending: ', abhängig vom Datum der Datei, die Sie analysieren',
        upTo: ' bis zu ',
        included: '<br/><p>Die Anzahl der erkannten Arten hängt vom Modell, der verwendeten Liste und im Falle des Standortfilters von der Artenfiltergrenze und möglicherweise der Woche ab, in der die Aufnahme gemacht wurde.<p>\
        Sie verwenden das Modell <b>${model}</b> und die Liste <b>${listInUse}</b>${localBirdsOnly}${location_filter_text}. Mit diesen Einstellungen zeigt Chirpity Erkennungen für bis zu \
        <b>${count}</b> Klassen${depending}:</p>\
        <table class="table table-striped"><thead class="sticky-top text-bg-dark"><tr><th>Trivialname</th><th>Wissenschaftlicher Name</th></tr></thead><tbody>${includedList}</tbody></table>',
        excluded: '<br/><p>Umgekehrt zeigt die Anwendung keine Erkennungen unter den folgenden ${excludedCount} Klassen an:</p><table class="table table-striped"><thead class="sticky-top text-bg-dark"><tr><th>${cname}</th><th>${sname}</th></tr></thead><tbody>${excludedList}</tbody></table>'
    },
    en: {
        title: 'Current Species List', 
        includedButton: 'Included', 
        excludedButton: 'Excluded', 
        cname: 'Common Name', 
        sname: 'Scientific Name',
        localBirds: ' limited to <b>local birds</b>',
        week: '. The current file was saved in week <b>${week}</b>',
        weekSpecific: 'week-specific',
        threshold: '${weekSpecific} species filter threshold of <b>${speciesThreshold}</b>',
        location: ' focused on <b>${place}</b>, with a ${species_filter_text}${current_file_text}',
        depending: ', depending on the date of the file you analyse',
        upTo: ' up to ',
        included: '<br/><p>The number of species detected depends on the model, the list being used and in the case of the location filter, the species filter threshold and possibly the week in which the recording was made.<p>\
        You are using the <b>${model}</b> model and the <b>${listInUse}</b> list${localBirdsOnly}${location_filter_text}. With these settings, Chirpity will display detections for ${upTo} \
        <b>${count}</b> classes${depending}:</p>\
        <table class="table table-striped"><thead class="sticky-top text-bg-dark"><tr><th>Common Name</th><th>Scientific Name</th></tr></thead><tbody>${includedList}</tbody></table>',
        excluded: '<br/><p>Conversely, the application will not display detections among the following ${excludedCount} classes:</p><table class="table table-striped"><thead class="sticky-top text-bg-dark"><tr><th>${cname}</th><th>${sname}</th></tr></thead><tbody>${excludedList}</tbody></table>'
    },
    es: {
        title: 'Lista actual de especies', 
        includedButton: 'Incluido', 
        excludedButton: 'Excluido', 
        cname: 'Nombre común', 
        sname: 'Nombre científico',
        localBirds: ' limitado a <b>aves locales</b>',
        week: '. El archivo actual se guardó en la semana <b>${week}</b>',
        weekSpecific: 'específico por semana',
        threshold: 'umbral de filtro de especies ${weekSpecific} de <b>${speciesThreshold}</b>',
        location: ' centrado en <b>${place}</b>, con un ${species_filter_text}${current_file_text}',
        depending: ', dependiendo de la fecha del archivo que analices',
        upTo: ' hasta ',
        included: '<br/><p>El número de especies detectadas depende del modelo, la lista utilizada y, en el caso del filtro de ubicación, del umbral del filtro de especies y posiblemente de la semana en que se realizó la grabación.<p>\
        Estás utilizando el modelo <b>${model}</b> y la lista <b>${listInUse}</b>${localBirdsOnly}${location_filter_text}. Con estas configuraciones, Chirpity mostrará detecciones para hasta \
        <b>${count}</b> clases${depending}:</p>\
        <table class="table table-striped"><thead class="sticky-top text-bg-dark"><tr><th>Nombre común</th><th>Nombre científico</th></tr></thead><tbody>${includedList}</tbody></table>',
        excluded: '<br/><p>Por el contrario, la aplicación no mostrará detecciones entre las siguientes ${excludedCount} clases:</p><table class="table table-striped"><thead class="sticky-top text-bg-dark"><tr><th>${cname}</th><th>${sname}</th></tr></thead><tbody>${excludedList}</tbody></table>'
    },
    fr: {
        title: 'Liste actuelle des espèces', 
        includedButton: 'Inclus', 
        excludedButton: 'Exclus', 
        cname: 'Nom commun', 
        sname: 'Nom scientifique',
        localBirds: ' limité aux <b>oiseaux locaux</b>',
        week: '. Le fichier actuel a été enregistré lors de la semaine <b>${week}</b>',
        weekSpecific: 'filtre d’espèces spécifique à la semaine',
        threshold: 'seuil du filtre d’espèces spécifique à la semaine de <b>${speciesThreshold}</b>',
        location: ' centré sur <b>${place}</b>, avec un ${species_filter_text}${current_file_text}',
        depending: ', selon la date du fichier que vous analysez',
        upTo: ' jusqu’à ',
        included: '<br/><p>Le nombre d’espèces détectées dépend du modèle, de la liste utilisée et, dans le cas du filtre de localisation, du seuil du filtre d’espèces et éventuellement de la semaine dans laquelle l’enregistrement a été réalisé.<p>\
        Vous utilisez le modèle <b>${model}</b> et la liste <b>${listInUse}</b>${localBirdsOnly}${location_filter_text}. Avec ces paramètres, Chirpity affichera les détections pour ${upTo} \
        <b>${count}</b> classes${depending} :</p>\
        <table class="table table-striped"><thead class="sticky-top text-bg-dark"><tr><th>Nom commun</th><th>Nom scientifique</th></tr></thead><tbody>${includedList}</tbody></table>',
        excluded: '<br/><p>En revanche, l’application n’affichera pas de détections parmi les ${excludedCount} classes suivantes :</p><table class="table table-striped"><thead class="sticky-top text-bg-dark"><tr><th>${cname}</th><th>${sname}</th></tr></thead><tbody>${excludedList}</tbody></table>'
    },
    ja: {
        title: '現在の種リスト', 
        includedButton: '含まれる', 
        excludedButton: '除外される', 
        cname: '一般名', 
        sname: '学名',
        localBirds: ' <b>地元の鳥</b>に限定',
        week: '。現在のファイルは第 <b>${week}</b> 週に保存されました',
        weekSpecific: '週ごとの',
        threshold: '週ごとの種フィルターのしきい値 <b>${speciesThreshold}</b>',
        location: ' <b>${place}</b> に焦点を当て、${species_filter_text}${current_file_text}',
        depending: '、分析するファイルの日付に依存します',
        upTo: ' 最大 ',
        included: '<br/><p>検出された種の数は、モデル、使用されているリスト、および場所フィルターの場合、種フィルターのしきい値と録音が行われた週に依存します。<p>\
        あなたは <b>${model}</b> モデルと <b>${listInUse}</b> リストを使用しています${localBirdsOnly}${location_filter_text}。これらの設定では、Chirpity は最大 ${upTo} \
        <b>${count}</b> クラスの検出を表示します${depending}：</p>\
        <table class="table table-striped"><thead class="sticky-top text-bg-dark"><tr><th>一般名</th><th>学名</th></tr></thead><tbody>${includedList}</tbody></table>',
        excluded: '<br/><p>逆に、アプリケーションは次の ${excludedCount} クラスの検出を表示しません：</p><table class="table table-striped"><thead class="sticky-top text-bg-dark"><tr><th>${cname}</th><th>${sname}</th></tr></thead><tbody>${excludedList}</tbody></table>'
    },
    nl: {
        title: 'Huidige soortenlijst', 
        includedButton: 'Inbegrepen', 
        excludedButton: 'Uitgesloten', 
        cname: 'Gewone naam', 
        sname: 'Wetenschappelijke naam',
        localBirds: ' beperkt tot <b>lokale vogels</b>',
        week: '. Het huidige bestand is opgeslagen in week <b>${week}</b>',
        weekSpecific: 'week-specifiek',
        threshold: 'drempelwaarde voor soortenfilter specifiek voor de week van <b>${speciesThreshold}</b>',
        location: ' gericht op <b>${place}</b>, met een ${species_filter_text}${current_file_text}',
        depending: ', afhankelijk van de datum van het bestand dat u analyseert',
        upTo: ' tot ',
        included: '<br/><p>Het aantal gedetecteerde soorten hangt af van het model, de gebruikte lijst en in het geval van de locatiefilter van de drempelwaarde voor soortenfilters en mogelijk de week waarin de opname is gemaakt.<p>\
        U gebruikt het <b>${model}</b>-model en de <b>${listInUse}</b>-lijst${localBirdsOnly}${location_filter_text}. Met deze instellingen toont Chirpity detecties voor ${upTo} \
        <b>${count}</b> klassen${depending}:</p>\
        <table class="table table-striped"><thead class="sticky-top text-bg-dark"><tr><th>Gewone naam</th><th>Wetenschappelijke naam</th></tr></thead><tbody>${includedList}</tbody></table>',
        excluded: '<br/><p>Daarentegen zal de applicatie geen detecties weergeven van de volgende ${excludedCount} klassen:</p><table class="table table-striped"><thead class="sticky-top text-bg-dark"><tr><th>${cname}</th><th>${sname}</th></tr></thead><tbody>${excludedList}</tbody></table>'
    },
    pt: {
        title: 'Lista Atual de Espécies', 
        includedButton: 'Incluído', 
        excludedButton: 'Excluído', 
        cname: 'Nome Comum', 
        sname: 'Nome Científico',
        localBirds: ' limitado a <b>aves locais</b>',
        week: '. O arquivo atual foi salvo na semana <b>${week}</b>',
        weekSpecific: 'filtro de espécies específico da semana',
        threshold: 'limite do filtro de espécies específico da semana de <b>${speciesThreshold}</b>',
        location: ' focado em <b>${place}</b>, com um ${species_filter_text}${current_file_text}',
        depending: ', dependendo da data do arquivo que você analisa',
        upTo: ' até ',
        included: '<br/><p>O número de espécies detectadas depende do modelo, da lista utilizada e, no caso do filtro de localização, do limite do filtro de espécies e possivelmente da semana em que a gravação foi feita.<p>\
        Você está usando o modelo <b>${model}</b> e a lista <b>${listInUse}</b>${localBirdsOnly}${location_filter_text}. Com essas configurações, o Chirpity exibirá detecções para ${upTo} \
        <b>${count}</b> classes${depending}:</p>\
        <table class="table table-striped"><thead class="sticky-top text-bg-dark"><tr><th>Nome Comum</th><th>Nome Científico</th></tr></thead><tbody>${includedList}</tbody></table>',
        excluded: '<br/><p>Por outro lado, o aplicativo não exibirá detecções entre as seguintes ${excludedCount} classes:</p><table class="table table-striped"><thead class="sticky-top text-bg-dark"><tr><th>${cname}</th><th>${sname}</th></tr></thead><tbody>${excludedList}</tbody></table>'
    },
    ru: {
        title: 'Текущий список видов', 
        includedButton: 'Включено', 
        excludedButton: 'Исключено', 
        cname: 'Обычное название', 
        sname: 'Научное название',
        localBirds: ' ограничено <b>местными птицами</b>',
        week: '. Текущий файл был сохранён на неделе <b>${week}</b>',
        weekSpecific: 'недельный фильтр видов',
        threshold: 'порог фильтра видов на неделе <b>${speciesThreshold}</b>',
        location: ' ориентирован на <b>${place}</b>, с ${species_filter_text}${current_file_text}',
        depending: ', в зависимости от даты файла, который вы анализируете',
        upTo: ' до ',
        included: '<br/><p>Количество обнаруженных видов зависит от модели, используемого списка и, в случае фильтра по местоположению, порога фильтра видов и, возможно, недели, в которой была сделана запись.<p>\
        Вы используете модель <b>${model}</b> и список <b>${listInUse}</b>${localBirdsOnly}${location_filter_text}. С этими настройками Chirpity покажет обнаружения для ${upTo} \
        <b>${count}</b> классов${depending}:</p>\
        <table class="table table-striped"><thead class="sticky-top text-bg-dark"><tr><th>Обычное название</th><th>Научное название</th></tr></thead><tbody>${includedList}</tbody></table>',
        excluded: '<br/><p>В то же время, приложение не будет показывать обнаружения среди следующих ${excludedCount} классов:</p><table class="table table-striped"><thead class="sticky-top text-bg-dark"><tr><th>${cname}</th><th>${sname}</th></tr></thead><tbody>${excludedList}</tbody></table>'
    },
    sv: {
        title: 'Aktuell artslista', 
        includedButton: 'Inkluderad', 
        excludedButton: 'Exkluderad', 
        cname: 'Vanligt namn', 
        sname: 'Vetenskapligt namn',
        localBirds: ' begränsad till <b>lokala fåglar</b>',
        week: '. Den aktuella filen sparades under vecka <b>${week}</b>',
        weekSpecific: 'vecko-specifik',
        threshold: 'vecko-specifik artfiltergräns på <b>${speciesThreshold}</b>',
        location: ' fokuserad på <b>${place}</b>, med en ${species_filter_text}${current_file_text}',
        depending: ', beroende på datumet för filen du analyserar',
        upTo: ' upp till ',
        included: '<br/><p>Antalet detekterade arter beror på modellen, den använda listan och, i fallet med platsfiltret, artfiltergränsen och eventuellt veckan då inspelningen gjordes.<p>\
        Du använder modellen <b>${model}</b> och listan <b>${listInUse}</b>${localBirdsOnly}${location_filter_text}. Med dessa inställningar kommer Chirpity att visa detektioner för ${upTo} \
        <b>${count}</b> klasser${depending}:</p>\
        <table class="table table-striped"><thead class="sticky-top text-bg-dark"><tr><th>Vanligt namn</th><th>Vetenskapligt namn</th></tr></thead><tbody>${includedList}</tbody></table>',
        excluded: '<br/><p>Å andra sidan kommer applikationen inte att visa detektioner bland följande ${excludedCount} klasser:</p><table class="table table-striped"><thead class="sticky-top text-bg-dark"><tr><th>${cname}</th><th>${sname}</th></tr></thead><tbody>${excludedList}</tbody></table>'
    },
    zh: {
        title: '当前物种列表', 
        includedButton: '包含', 
        excludedButton: '排除', 
        cname: '常见名称', 
        sname: '学名',
        localBirds: ' 限制为<b>本地鸟类</b>',
        week: '。当前文件保存于第 <b>${week}</b> 周',
        weekSpecific: '特定周的',
        threshold: '<b>${speciesThreshold}</b> 的特定周物种过滤阈值',
        location: ' 专注于 <b>${place}</b>，包含 ${species_filter_text}${current_file_text}',
        depending: '，具体取决于您分析的文件日期',
        upTo: ' 高达 ',
        included: '<br/><p>检测到的物种数量取决于模型、使用的列表，在位置过滤的情况下，还取决于物种过滤阈值以及录音的周数。<p>\
        您正在使用 <b>${model}</b> 模型和 <b>${listInUse}</b> 列表${localBirdsOnly}${location_filter_text}。根据这些设置，Chirpity 将显示最多 ${upTo} \
        <b>${count}</b> 类别的检测结果${depending}：</p>\
        <table class="table table-striped"><thead class="sticky-top text-bg-dark"><tr><th>常见名称</th><th>学名</th></tr></thead><tbody>${includedList}</tbody></table>',
        excluded: '<br/><p>另一方面，应用程序不会显示以下 ${excludedCount} 类别的检测结果：</p><table class="table table-striped"><thead class="sticky-top text-bg-dark"><tr><th>${cname}</th><th>${sname}</th></tr></thead><tbody>${excludedList}</tbody></table>'
    }
};

const IUCNLabel = {
    da: {
        'NA': 'Ingen data',
        'DD': 'Utilstrækkelige data',
        'LC': 'Ikke truet',
        'VU': 'Sårbar',
        'NT': 'Næsten truet',
        'EN': 'Truet',
        'CR': 'Kritisk truet',
        'EW': 'Uddød i naturen',
        'EX': 'Uddød'
    },
    de: {
        'NA': 'Keine Daten',
        'DD': 'Daten unzureichend',
        'LC': 'Ungefährdet',
        'VU': 'Gefährdet',
        'NT': 'Potentiell gefährdet',
        'EN': 'Stark gefährdet',
        'CR': 'Vom Aussterben bedroht',
        'EW': 'In der Natur ausgestorben',
        'EX': 'Ausgestorben'
    },
    en: {
        'NA': 'No Data',
        'DD': 'Data Deficient',
        'LC': 'Least Concern',
        'VU': 'Vulnerable',
        'NT': 'Near Threatened',
        'EN': 'Endangered',
        'CR': 'Critically Endangered',
        'EW': 'Extinct in the Wild',
        'EX': 'Extinct'
    },
    es: {
        'NA': 'Sin datos',
        'DD': 'Datos insuficientes',
        'LC': 'Preocupación menor',
        'VU': 'Vulnerable',
        'NT': 'Casi amenazado',
        'EN': 'En peligro',
        'CR': 'En peligro crítico',
        'EW': 'Extinto en estado silvestre',
        'EX': 'Extinto'
    },
    fr: {
        'NA': 'Pas de données',
        'DD': 'Données insuffisantes',
        'LC': 'Préoccupation mineure',
        'VU': 'Vulnérable',
        'NT': 'Quasi menacé',
        'EN': 'En danger',
        'CR': 'En danger critique',
        'EW': 'Éteint à l’état sauvage',
        'EX': 'Éteint'
    },
    ja: {
        'NA': 'データなし',
        'DD': 'データ不足',
        'LC': '低懸念',
        'VU': '危急',
        'NT': '近危急',
        'EN': '絶滅危惧',
        'CR': '深刻な絶滅危惧',
        'EW': '野生絶滅',
        'EX': '絶滅'
    },
    nl: {
        'NA': 'Geen gegevens',
        'DD': 'Gebrekkige gegevens',
        'LC': 'Minst zorgwekkend',
        'VU': 'Kwetsbaar',
        'NT': 'Bijna bedreigd',
        'EN': 'Bedreigd',
        'CR': 'Kritiek bedreigd',
        'EW': 'Uitgestorven in het wild',
        'EX': 'Uitgestorven'
    },
    pt: {
        'NA': 'Sem dados',
        'DD': 'Dados insuficientes',
        'LC': 'Pouco preocupante',
        'VU': 'Vulnerável',
        'NT': 'Quase ameaçado',
        'EN': 'Em perigo',
        'CR': 'Criticamente em perigo',
        'EW': 'Extinto na natureza',
        'EX': 'Extinto'
    },
    ru: {
        'NA': 'Нет данных',
        'DD': 'Недостаточно данных',
        'LC': 'Вызывающие наименьшие опасения',
        'VU': 'Уязвимый',
        'NT': 'Близкий к угрожающему состоянию',
        'EN': 'Находится под угрозой',
        'CR': 'Находится на грани исчезновения',
        'EW': 'Вымерший в дикой природе',
        'EX': 'Вымерший'
    },
    sv: {
        'NA': 'Inga data',
        'DD': 'Otillräckliga data',
        'LC': 'Livskraftig',
        'VU': 'Sårbar',
        'NT': 'Nära hotad',
        'EN': 'Hotad',
        'CR': 'Kritiskt hotad',
        'EW': 'Utrotad i det vilda',
        'EX': 'Utrotad'
    },
    zh: {
        'NA': '没有数据',
        'DD': '数据不足',
        'LC': '无危',
        'VU': '易危',
        'NT': '近危',
        'EN': '濒危',
        'CR': '极危',
        'EW': '野外灭绝',
        'EX': '灭绝'
    },
    // it: {
    //     'NA': 'Nessun dato',
    //     'DD': 'Dati insufficienti',
    //     'LC': 'Minima preoccupazione',
    //     'VU': 'Vulnerabile',
    //     'NT': 'Quasi minacciato',
    //     'EN': 'In pericolo',
    //     'CR': 'In pericolo critico',
    //     'EW': 'Estinto in natura',
    //     'EX': 'Estinto'
    // },
}; 

const Select = {
    en: {
      selectLabel: "Select a label",
      addLabel: "Create new label",
      enterNewLabel: "Enter a new label",
      removeLabel: "Remove label",
    },
    da: {
      selectLabel: "Vælg en etiket",
      addLabel: "Opret ny etiket",
      enterNewLabel: "Indtast en ny etiket",
      removeLabel: "Fjern etiket"
    },
    de: {
      selectLabel: "Wähle ein Etikett",
      addLabel: "Erstelle ein neues Etikett",
      enterNewLabel: "Gib ein neues Etikett ein",
      removeLabel: "Etikett entfernen"
    },
    es: {
      selectLabel: "Selecciona una etiqueta",
      addLabel: "Crea una nueva etiqueta",
      enterNewLabel: "Introduce una nueva etiqueta",
      removeLabel: "Eliminar etiqueta"
    },
    fr: {
      selectLabel: "Sélectionne une étiquette",
      addLabel: "Crée une nouvelle étiquette",
      enterNewLabel: "Entre une nouvelle étiquette",
      removeLabel: "Supprimer l'étiquette"
    },
    ja: {
      selectLabel: "ラベルを選択",
      addLabel: "新しいラベルを作成",
      enterNewLabel: "新しいラベルを入力",
      removeLabel: "ラベルを削除"
    },
    nl: {
      selectLabel: "Selecteer een label",
      addLabel: "Maak een nieuw label",
      enterNewLabel: "Voer een nieuw label in",
      removeLabel: "Label verwijderen"
    },
    pt: {
      selectLabel: "Seleciona uma etiqueta",
      addLabel: "Cria nova etiqueta",
      enterNewLabel: "Introduz uma nova etiqueta",
      removeLabel: "Remover etiqueta"
    },
    ru: {
      selectLabel: "Выбери метку",
      addLabel: "Создай новую метку",
      enterNewLabel: "Введи новую метку",
      removeLabel: "Удалить метку"
    },
    sv: {
      selectLabel: "Välj en etikett",
      addLabel: "Skapa ny etikett",
      enterNewLabel: "Ange en ny etikett",
      removeLabel: "Ta bort etikett"
    },
    zh: {
      selectLabel: "选择一个标签",
      addLabel: "创建新标签",
      enterNewLabel: "输入新标签",
      removeLabel: "删除标签"
    }
  };
  

  const UpdateMessage = {
    en: "There's a new version of Chirpity available! ${link}Check the website</a> for more information",
    da: "Der er en ny version af Chirpity tilgængelig! ${link}Besøg hjemmesiden</a> for mere information",
    de: "Eine neue Version von Chirpity ist verfügbar! ${link}Besuchen Sie die Website</a> für weitere Informationen",
    es: "¡Hay una nueva versión de Chirpity disponible! ${link}Visita el sitio web</a> para más información",
    fr: "Une nouvelle version de Chirpity est disponible ! ${link}Consultez le site web</a> pour plus d'informations",
    nl: "Er is een nieuwe versie van Chirpity beschikbaar! ${link}Bezoek de website</a> voor meer informatie",
    pt: "Há uma nova versão do Chirpity disponível! ${link}Visite o site</a> para mais informações",
    ru: "Доступна новая версия Chirpity! ${link}Посетите сайт</a> для получения дополнительной информации",
    sv: "En ny version av Chirpity är tillgänglig! ${link}Besök webbplatsen</a> för mer information",
    zh: "Chirpity有新版本可用！${link}访问网站</a>了解更多信息",
  };
  

const setLocale = (locale) => LOCALE = locale;
const get = (context) => context[LOCALE] || context["en"];

/**
 * Loads and applies localized UI text for the specified locale.
 *
 * Fetches a localization JSON file for the given locale and updates relevant DOM elements—including labels, buttons, tooltips, popovers, form controls, and carousel content—with the corresponding localized strings. If the locale file is unavailable, falls back to English. If neither is found, the UI remains unchanged.
 *
 * @param {string} locale - The locale code (e.g., "en", "de_CA"). Any suffix after an underscore is ignored.
 * @returns {Promise<Object|undefined>} Resolves to the localization data object if successful, or undefined if no localization file is found.
 */
async function localiseUI(locale) {
    locale = locale.replace(/_.*$/, '');
    setLocale(locale);
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
            console.info(`Failed to fetch JSON file: index.${locale}.json`);
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
            } 
        }
        // Update buttons without ID
        const buttons = document.querySelectorAll('button:not([id])')
        buttons.forEach(button => button.textContent &&= localisationData['help-modal-close']);
        // Update Title text
        const titles = document.querySelectorAll('[title]');
        const i18nT = Titles[locale]
        titles.forEach(title =>{
            const i18nTitle = i18nT[title.id];
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
        // Padlock items
        const padlocks = document.querySelectorAll('#unsaved-icon, .padlock')
        padlocks.forEach(lock => {
            if (lock.id === 'unsaved-icon'){
                lock.setAttribute('data-bs-title', localisationData['unsaved-link'][0]);
                lock.setAttribute('data-bs-content', localisationData['unsaved-link'][1]);
            } else {
                lock.setAttribute('data-bs-title', localisationData['padlock'][0]);
                lock.setAttribute('data-bs-content', localisationData['padlock'][1]);
            }
            const popover = new bootstrap.Popover(lock);
            popover.update();
        })

        const form = document.getElementById('settings');
        const labels = form.querySelectorAll('label, button');
        settings = localisationData['settings']
        labels.forEach(label => {
            const id = label.getAttribute('for') || label.id;
            if (settings[id]){
                label.textContent = settings[id];
                // Some nested labels must be skipped
                if (['tensorflow', 'webgpu', 'colourmap', 'window-function', 'timelineSetting', 'iucn-scope', 'library-format',
                     'loud-color', 'mid-color', 'quiet-color', "mid-color-threshold-slider", "quiet-color-threshold-slider",'bitrate', 
                     'format', 'quality', 'species-week', 'show-species', 'advanced', 'basic'].includes(id)) return
                // Set popOver title. It's in the div, or div parent div
                let elements = label.parentNode.querySelectorAll('a');
                if (elements.length === 0 && label.parentNode.parentNode) {
                elements = label.parentNode.parentNode.querySelectorAll('a');
                }
                if (elements.length === 0 && label.parentNode.parentNode?.parentNode) {
                elements = label.parentNode.parentNode.parentNode.querySelectorAll('a');
                }
                const heading = label.textContent.replace(':', '');
                // Support multipe headings (locked items)
                elements.forEach(el => {
                    if (el.id){
                        el.setAttribute('data-bs-title', heading);
                        const popover = new bootstrap.Popover(el);
                        popover.update();
                    }
                })
            }
        })
        const play = document.querySelector('#playToggle :nth-child(2)');
        const pause = document.querySelector('#playToggle :nth-child(4)');
        play.textContent = Context[locale].play;
        pause.textContent = Context[locale].pause;
        const headings = form.querySelectorAll('h4,h5,h6,legend');
        for (let i=0;i<headings.length;i++){
            const heading = headings[i];
            const span = heading.querySelector('span') ;
            heading.textContent = localisationData['headings'][i]
            if (span) heading.appendChild(span)
        }
        // Update the list options:
        const options = Lists[locale];
        form.querySelectorAll('option').forEach(option => {
            const key = option.value; // Get the value of the option, which matches the key in Lists
            option.textContent = options[key] ?? option.textContent;
        });
        // placeholholders
        document.getElementById("custom-list-location").setAttribute('placeholder', options['customListPH'])
        document.getElementById("library-location").setAttribute('placeholder', options['libraryLocationPH'])
        // //Explore location header
        document.querySelector("label[for='explore-locations']").textContent = Headings[locale].location;
        document.getElementById('exploreRange').innerHTML = `<span class="material-symbols-outlined align-bottom">date_range</span><span>${localisationData['explore-datefilter']}</span> <span class="material-symbols-outlined float-end">expand_more</span>`;
        // Species search labels
        document.querySelectorAll('.species-search-label').forEach(label => label.textContent = Headings[locale].search);
        // Tour Carousel items:
        const tour = document.querySelector('.carousel-inner');
        tour.innerHTML = Tour[locale];
        return localisationData
    } catch (error) {
        console.error('Localisation Error:', error.message);
    }
}

export {All, SpeciesList,Headings, Context, Location, Form, Help, Toasts, Titles, Training, ManageModels,
     LIST_MAP, Lists, IUCNLabel, Locate,Select, UpdateMessage, localiseUI, get}