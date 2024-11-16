const i18nHeadings = {
    en: {
        position: ['Position', "Sort results by detection time"],
        time: ['Time', "Sort results by detection time"],
        species: ['Species', "Sort results by detection confidence"],
        calls: 'Calls',
        label: 'Label',
        notes: 'Notes',
        max: 'Maximum',
        detections: 'Detections'
    },
    da: {
        position: ['Position', "Sorter resultater efter detektionstid"],
        time: ['Tid', "Sorter resultater efter detektionstid"],
        species: ['Arter', "Sorter resultater efter detektionssikkerhed"],
        calls: 'Kald',
        label: 'Etiket',
        notes: 'Noter',
        max: 'Maksimum',
        detections: 'Detektioner'
    },
    de: {
        position: ['Position', "Ergebnisse nach Erkennungszeit sortieren"],
        time: ['Zeit', "Ergebnisse nach Erkennungszeit sortieren"],
        species: ['Arten', "Ergebnisse nach Erkennungssicherheit sortieren"],
        calls: 'Rufe',
        label: 'Etikett',
        notes: 'Notizen',
        max: 'Maximum',
        detections: 'Erkennungen'
    },
    es: {
        position: ['Posición', "Ordenar resultados por tiempo de detección"],
        time: ['Tiempo', "Ordenar resultados por tiempo de detección"],
        species: ['Especies', "Ordenar resultados por confianza en la detección"],
        calls: 'Llamadas',
        label: 'Etiqueta',
        notes: 'Notas',
        max: 'Máximo',
        detections: 'Detecciones'
    },
    fr: {
        position: ['Position', "Trier les résultats par heure de détection"],
        time: ['Temps', "Trier les résultats par heure de détection"],
        species: ['Espèces', "Trier les résultats par confiance en la détection"],
        calls: 'Appels',
        label: 'Étiquette',
        notes: 'Notes',
        max: 'Maximum',
        detections: 'Détections'
    },
    nl: {
        position: ['Positie', "Sorteer resultaten op detectietijd"],
        time: ['Tijd', "Sorteer resultaten op detectietijd"],
        species: ['Soorten', "Sorteer resultaten op detectiezekerheid"],
        calls: 'Oproepen',
        label: 'Label',
        notes: 'Notities',
        max: 'Maximum',
        detections: 'Detecties'
    },
    pt: {
        position: ['Posição', "Ordenar resultados por tempo de detecção"],
        time: ['Tempo', "Ordenar resultados por tempo de detecção"],
        species: ['Espécies', "Ordenar resultados por confiança na detecção"],
        calls: 'Chamadas',
        label: 'Rótulo',
        notes: 'Notas',
        max: 'Máximo',
        detections: 'Detecções'
    },
    ru: {
        position: ['Позиция', "Сортировать результаты по времени обнаружения"],
        time: ['Время', "Сортировать результаты по времени обнаружения"],
        species: ['Виды', "Сортировать результаты по уровню доверия к обнаружению"],
        calls: 'Звонки',
        label: 'Метка',
        notes: 'Заметки',
        max: 'Максимум',
        detections: 'Обнаружения'
    },
    sv: {
        position: ['Position', "Sortera resultat efter upptäcktstid"],
        time: ['Tid', "Sortera resultat efter upptäcktstid"],
        species: ['Art', "Sortera resultat efter upptäcktsförtroende"],
        calls: 'Samtal',
        label: 'Etikett',
        notes: 'Anteckningar',
        max: 'Maximum',
        detections: 'Upptäckter'
    },
    zh: {
        position: ['位置', "按检测时间排序结果"],
        time: ['时间', "按检测时间排序结果"],
        species: ['物种', "按检测置信度排序结果"],
        calls: '调用',
        label: '标签',
        notes: '备注',
        max: '最大值',
        detections: '检测'
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
        'Añadir, editar o eliminar ubicación', 
        'Actualizar TODAS las archivos abiertos a esta ubicación'
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
        play: 'Play',
        pause: 'Pause',
        analyse: 'Analyse',
        create: 'Create', edit: 'Edit', record: 'Record',
        export: 'Export Audio Clip',
        compare: 'Compare with Reference Calls',
        delete: 'Delete Record',
        location: 'Amend File Recording Location',
        time: 'Amend File Start Time',
        plural: 's'
    },
    da: {
        play: 'Afspil',
        pause: 'Pause',
        analyse: 'Analysér',
        create: 'Opret', edit: 'Rediger', record: 'post',
        export: 'Eksportér lydklip',
        compare: 'Sammenlign med referenceopkald',
        delete: 'Slet post',
        location: 'Rediger filens optagelsesplacering',
        time: 'Rediger filens starttid',
        plural: 'er'
    },
    de: {
        play: 'Abspielen',
        pause: 'Pause',
        analyse: 'Analysieren',
        create: 'Erstellen', edit: 'Bearbeiten', record: 'den Eintrag',
        export: 'Audioausschnitt exportieren',
        compare: 'Mit Referenzaufnahmen vergleichen',
        delete: 'Eintrag löschen',
        location: 'Aufnahmeort der Datei ändern',
        time: 'Startzeit der Datei ändern',
        plural: 'e'
    },
    es: {
        play: 'Reproducir',
        pause: 'Pausa',
        analyse: 'Analizar',
        create: 'Crear', edit: 'Editar', record: 'el Registro',
        export: 'Exportar fragmento de audio',
        compare: 'Comparar con llamadas de referencia',
        delete: 'Eliminar registro',
        location: 'Modificar la ubicación de grabación del archivo',
        time: 'Modificar la hora de inicio del archivo',
        plural: 's'
    },
    fr: {
        play: 'Jouer',
        pause: 'Pause',
        analyse: 'Analyser',
        create: 'Créer', edit: 'Modifier', record: 'l’Enregistrement',
        export: 'Exporter un extrait audio',
        compare: 'Comparer avec des appels de référence',
        delete: 'Supprimer l’enregistrement',
        location: 'Modifier l’emplacement d’enregistrement du fichier',
        time: 'Modifier l’heure de début du fichier',
        plural: 's'
    },
    nl: {
        play: 'Afspelen',
        pause: 'Pauze',
        analyse: 'Analyseren',
        create: 'Aanmaken', edit: 'Bewerken', record: 'de Record',
        export: 'Audiofragment exporteren',
        compare: 'Vergelijk met referentieoproepen',
        delete: 'Record verwijderen',
        location: 'Opnamelocatie van bestand aanpassen',
        time: 'Starttijd van bestand aanpassen',
        plural: 'en'
    },
    pt: {
        play: 'Reproduzir',
        pause: 'Pausar',
        analyse: 'Analisar',
        create: 'Criar', edit: 'Editar', record: 'o Registro',
        export: 'Exportar trecho de áudio',
        compare: 'Comparar com chamadas de referência',
        delete: 'Excluir registro',
        location: 'Alterar local de gravação do arquivo',
        time: 'Alterar horário de início do arquivo',
        plural: 's'
    },
    ru: {
        play: 'Воспроизвести',
        pause: 'Пауза',
        analyse: 'Анализировать',
        create: 'Создать', edit: 'Редактировать', record: 'запись',
        export: 'Экспортировать аудиофрагмент',
        compare: 'Сравнить с эталонными записями',
        delete: 'Удалить запись',
        location: 'Изменить место записи файла',
        time: 'Изменить время начала файла',
        plural: ''
    },
    sv: {
        play: 'Spela upp',
        pause: 'Paus',
        analyse: 'Analysera',
        create: 'Skapa', edit: 'Redigera', record: 'posten',
        export: 'Exportera ljudklipp',
        compare: 'Jämför med referenssamtal',
        delete: 'Ta bort post',
        location: 'Ändra filens inspelningsplats',
        time: 'Ändra filens starttid',
        plural: 'er'
    },
    zh: {
        play: '播放',
        pause: '暂停',
        analyse: '分析',
         create: '创建', edit: '编辑', record: '记录',
        export: '导出音频片段',
        compare: '与参考调用进行比较',
        delete: '删除记录',
        location: '修改文件录制位置',
        time: '修改文件开始时间',
        plural: ''
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
            if (key === 'settings') continue;
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

        // Translate settings labels
        const form = document.getElementById('settings');
        const labels = form.querySelectorAll('label');
        labels.forEach(label => {
            const id = label.getAttribute('for');
            label.textContent = localisationData['settings'][id];
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

        console.warn(`Translation took: ${Date.now() - t0} ms`)
        return localisationData
    } catch (error) {
        console.error('Localisation Error:', error.message);
    }
}
export {i18nHeadings, i18nContext, i18nLocation, i18nForm, i18nHelp, localiseUI}