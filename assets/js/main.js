document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded - Inizializzazione transcription manager');
    
    // Gestione migliorata delle trascrizioni
    const toggleButtons = document.querySelectorAll('.toggle-transcript');
    console.log(`Trovati ${toggleButtons.length} pulsanti di trascrizione`);
    
    // Mappa ID -> chiave del JSON
    const transcriptMap = {
        'transcript-0': 'introduction',
        'transcript-1': 'stops.0', 
        'transcript-2': 'stops.1',
        'transcript-3': 'stops.2',
        'transcript-4': 'stops.3',
        'transcript-5': 'stops.4',
        'transcript-6': 'stops.5',
        'transcript-7': 'stops.6',
        'transcript-8': 'stops.7',
        'transcript-9': 'stops.8',
        'transcript-10': 'stops.9'
    };
    
    // Variabili per tenere traccia dei dati e dello stato di caricamento
    let tourData = null;
    let currentLang = localStorage.getItem('preferredLanguage') || 'it'; // Lingua predefinita o da localStorage
    let dataLoaded = false;
    const loadedIds = {};
    
    // Nuova funzionalità: Inizia il tour con l'introduzione
    document.querySelectorAll('.tour-button').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Pulsante "Inizia il tour" cliccato, avvio riproduzione introduzione');
            
            // Trova il pulsante principale del player dell'introduzione
            const introPlayButton = document.querySelector('[data-amplitude-main-play-pause="true"]');
            if (introPlayButton) {
                // Simula un click sul pulsante dell'introduzione per avviare la riproduzione
                introPlayButton.click();
                
                // Scorrimento opzionale fino all'intro player
                const introPlayer = document.getElementById('intro-player');
                if (introPlayer) {
                    const headerHeight = document.getElementById('site-header').offsetHeight;
                    const targetPosition = introPlayer.getBoundingClientRect().top + window.pageYOffset;
                    
                    window.scrollTo({
                        top: targetPosition - headerHeight - 20,
                        behavior: 'smooth'
                    });
                }
            } else {
                console.error('Pulsante play dell\'introduzione non trovato');
            }
        });
    });
    
    // Precarica il file JSON con tutte le informazioni dell'audioguida
    fetch('assets/data/audioguide.json')
        .then(response => {
            console.log(`Risposta ricevuta con stato: ${response.status} per il file dell'audioguida`);
            if (!response.ok) {
                throw new Error(`Errore nel caricamento (${response.status}: ${response.statusText})`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Dati dell\'audioguida caricati correttamente', data);
            tourData = data;
            dataLoaded = true;
            
            // Inizializza il language manager con i dati del tour
            if (window.LanguageManager) {
                window.LanguageManager.initialize(data);
                // Imposta la lingua corrente quella gestita dal Language Manager
                currentLang = window.LanguageManager.getCurrentLanguage();
            }
            
            // Quando i dati sono caricati, inizializziamo anche l'interfaccia
            initializeInterface();
            
            // Notifica ad amplitude-config.js che i dati sono pronti
            const audioguideDataEvent = new CustomEvent('audioguideDataLoaded', {
                detail: { tourData: data }
            });
            document.dispatchEvent(audioguideDataEvent);
        })
        .catch(error => {
            console.error('Errore nel caricamento dei dati dell\'audioguida:', error);
        });
    
    // Ascolto eventi di cambio lingua
    document.addEventListener('languageChanged', function(event) {
        if (event.detail && event.detail.language) {
            currentLang = event.detail.language;
            console.log(`Lingua cambiata a: ${currentLang} - Aggiorno l'interfaccia`);
            
            // Ricarica l'interfaccia con la nuova lingua
            if (dataLoaded) {
                initializeInterface();
                
                // Resetta le trascrizioni caricate
                Object.keys(loadedIds).forEach(id => {
                    loadedIds[id] = false;
                });
                
                // Emetti evento per informare AmplitudeJS che deve aggiornare i file audio
                document.dispatchEvent(new CustomEvent('audioLanguageChanged', {
                    detail: { language: currentLang, tourData: tourData }
                }));
            }
        }
    });
    
    // Funzione per popolare l'interfaccia con i dati dal JSON
    function initializeInterface() {
        if (!tourData || !tourData.tour || !tourData.tour.content || !tourData.tour.content[currentLang]) {
            console.error('Dati non validi o struttura JSON non corretta');
            return;
        }
        
        // Accediamo ai dati della lingua corretta
        const langData = tourData.tour.content[currentLang];
        const introData = langData.introduction;
        
        // Aggiorna titolo e descrizione dell'introduzione
        document.querySelectorAll('.amplitude-track-title[data-amplitude-main-song-info="true"]').forEach(el => {
            el.textContent = langData.title || 'Introduzione';
        });
        
        document.querySelectorAll('.amplitude-track-author[data-amplitude-main-song-info="true"]').forEach(el => {
            el.textContent = currentLang === 'it' ? 'Audio guida di Regalbuto' : 'Audio Guide of Regalbuto';
        });
        
        // Aggiorna il titolo principale della pagina in base alla lingua
        document.getElementById('hero-title').innerHTML = langData.title || 'Audio Guida di <span class="text-primary">Regalbuto</span>';
        
        // Aggiorna la descrizione principale se presente
        const heroDescription = document.querySelector('.text-lg.text-gray-600.mb-6');
        if (heroDescription && langData.description) {
            heroDescription.textContent = langData.description;
        }
        
        // Generiamo dinamicamente la timeline
        generateTimelineStops(langData.stops, tourData.tour.staticData?.stops);
        
        // Aggiorniamo il contenitore principale con gli episodi
        generateEpisodeCards(langData.stops, tourData.tour.staticData?.stops);
        
        // Aggiorna il contenuto della trascrizione dell'introduzione
        const introTranscriptEl = document.getElementById('transcript-0');
        if (introTranscriptEl && introData && introData.transcription) {
            const contentDiv = introTranscriptEl.querySelector('.text-gray-700');
            if (contentDiv && introData.transcription.paragraphs) {
                contentDiv.innerHTML = introData.transcription.paragraphs
                    .map(p => `<p>${p}</p>`)
                    .join('');
            }
        }
        
        // Ascolto per il pulsante di cambio lingua
        setupLanguageButtons();
    }
    
    function setupLanguageButtons() {
        const languageDropdown = document.getElementById('language-dropdown');
        
        if (languageDropdown) {
            // Assicurati che il dropdown si chiuda quando si seleziona una lingua
            languageDropdown.addEventListener('click', function(e) {
                if (e.target.classList.contains('language-option')) {
                    languageDropdown.classList.add('hidden');
                    document.getElementById('language-arrow').style.transform = '';
                    document.getElementById('language-button').setAttribute('aria-expanded', 'false');
                    
                    // Rimuovi l'event listener per chiudere il dropdown quando si clicca altrove
                    document.removeEventListener('click', closeLanguageDropdown);
                }
            });
        }
    }
    
    // Funzione per chiudere il dropdown quando si clicca fuori (definita globalmente)
    function closeLanguageDropdown(e) {
        const languageDropdown = document.getElementById('language-dropdown');
        const languageButton = document.getElementById('language-button');
        
        if (languageDropdown && languageButton) {
            if (!languageDropdown.contains(e.target) && e.target !== languageButton) {
                languageDropdown.classList.add('hidden');
                languageButton.setAttribute('aria-expanded', 'false');
                document.getElementById('language-arrow').style.transform = '';
                document.removeEventListener('click', closeLanguageDropdown);
            }
        }
    }
    
    // Funzione per generare la timeline dinamicamente
    function generateTimelineStops(stops, staticStops) {
        const timelineContainer = document.querySelector('.timeline-stops');
        if (!timelineContainer || !stops || !Array.isArray(stops)) {
            console.error('Container timeline o dati delle tappe non trovati');
            return;
        }
        
        // Svuota il contenitore attuale
        timelineContainer.innerHTML = '';
        
        // Rimuovi SVG esistente e creane uno nuovo
        const trackElement = document.querySelector('.timeline-track');
        let svgElement = document.querySelector('.timeline-path-svg');
        if (svgElement) svgElement.remove();
        
        // Creazione dell'elemento SVG che conterrà il percorso
        svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgElement.classList.add('timeline-path-svg');
        trackElement.appendChild(svgElement);
        
        // Creazione dell'elemento path che rappresenta la linea del percorso
        let pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathElement.classList.add('timeline-path');
        svgElement.appendChild(pathElement);
        
        // Crea elementi per ogni tappa in ordine numerico
        stops.forEach((stop, index) => {
            if (!stop || !stop.id) return;
            
            // Cerca i dati statici per questa tappa
            const staticStop = staticStops?.find(s => s.id === stop.id) || {};
            
            // Determina l'icona da usare
            const icon = staticStop.icon || 'fa-map-marker-alt';
            const order = staticStop.order || (index + 1);
            
            // Converte ID con underscore in ID con trattino per il DOM
            const elementId = stop.id.replace(/_/g, '-');
            
            // Crea il pulsante della timeline
            const buttonEl = document.createElement('button');
            buttonEl.className = 'timeline-stop';
            buttonEl.setAttribute('aria-label', `Vai alla tappa ${order}: ${stop.title}`);
            buttonEl.dataset.targetId = elementId;
            buttonEl.dataset.stopOrder = order;
            
            buttonEl.innerHTML = `
                <div class="timeline-stop-icon" aria-hidden="true">
                    <i class="fas ${icon}" aria-hidden="true"></i>
                    <div class="timeline-stop-number">${order}</div>
                </div>
                <span class="timeline-stop-label">${stop.title}</span>
            `;
            
            // Aggiungi evento click per scrollare all'episodio
            buttonEl.addEventListener('click', function() {
                const targetElement = document.getElementById(elementId);
                if (targetElement) {
                    const headerHeight = document.getElementById('site-header').offsetHeight;
                    const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset;
                    
                    window.scrollTo({
                        top: targetPosition - headerHeight - 20,
                        behavior: 'smooth'
                    });
                    
                    // Evidenziazione dell'elemento attivo
                    document.querySelectorAll('.timeline-stop').forEach(el => {
                        el.classList.remove('active');
                    });
                    
                    this.classList.add('active');
                    
                    // Imposta le tappe precedenti come completate
                    const currentOrder = parseInt(this.dataset.stopOrder);
                    document.querySelectorAll('.timeline-stop').forEach(el => {
                        const stopOrder = parseInt(el.dataset.stopOrder);
                        if (stopOrder < currentOrder) {
                            el.classList.add('completed');
                        } else {
                            el.classList.remove('completed');
                        }
                    });
                }
            });
            
            // Aggiungi al container
            timelineContainer.appendChild(buttonEl);
        });
        
        // Crea il percorso visivo - aspetta che il layout sia completo
        // Un piccolo ritardo per assicurarsi che tutte le tappe siano correttamente renderizzate
        setTimeout(() => {
            drawSimplePath();
        }, 100);
        
        // Aggiungi handler per resize - ridisegna il percorso quando la finestra cambia dimensioni
        window.addEventListener('resize', function() {
            clearTimeout(window.resizeTimelineTimer);
            window.resizeTimelineTimer = setTimeout(drawSimplePath, 250);
        });
    }
    
    /**
     * Funzione per disegnare il percorso che collega le tappe in ordine numerico
     * Crea un percorso SVG che collega tutte le tappe nella stessa riga, senza connessioni tra righe diverse
     * Ora questa funzione controlla la dimensione dello schermo e non disegna il percorso su mobile
     */
    function drawSimplePath() {
        // Non disegna il percorso su schermi mobili (< 768px)
        if (window.innerWidth < 768) {
            // Nascondi SVG esistente
            const svgElement = document.querySelector('.timeline-path-svg');
            if (svgElement) {
                svgElement.style.display = 'none';
                svgElement.style.opacity = '0';
            }
            return;
        }
        
        // Seleziona tutte le tappe presenti nel DOM
        const stops = document.querySelectorAll('.timeline-stop');
        if (stops.length < 2) return; // Non disegnare il percorso se ci sono meno di 2 tappe
        
        // Ottieni elementi SVG necessari per il disegno
        const svgElement = document.querySelector('.timeline-path-svg');
        const pathElement = document.querySelector('.timeline-path');
        if (!svgElement || !pathElement) return;
        
        // Mostra SVG su desktop
        svgElement.style.display = '';
        
        // Ottieni il container track per riferimento coordinate
        const trackElement = document.querySelector('.timeline-track');
        const trackRect = trackElement.getBoundingClientRect();
        
        // Imposta dimensioni SVG per coprire esattamente l'area del contenitore
        svgElement.setAttribute('width', trackElement.offsetWidth);
        svgElement.setAttribute('height', trackElement.offsetHeight);
        
        // Raccogli posizioni complete delle tappe (icone e label)
        const positions = [];
        stops.forEach(stop => {
            // Usa l'icona della tappa come punto di riferimento per il percorso
            const iconElement = stop.querySelector('.timeline-stop-icon');
            const labelElement = stop.querySelector('.timeline-stop-label');
            
            const iconRect = iconElement.getBoundingClientRect();
            const labelRect = labelElement.getBoundingClientRect();
            
            // Calcola le coordinate relative al contenitore della timeline
            positions.push({
                x: iconRect.left + iconRect.width / 2 - trackRect.left, // Centro orizzontale dell'icona
                y: iconRect.top + iconRect.height / 2 - trackRect.top,  // Centro verticale dell'icona
                stopOrder: parseInt(stop.dataset.stopOrder || '0'), // Numero della tappa
                // Memorizza anche la posizione Y per identificare le righe
                rowY: Math.round(iconRect.top / 10) * 10, // Arrotondiamo per raggruppare tappe nella stessa riga
                // Aggiungiamo le informazioni del rettangolo completo
                iconRect: {
                    left: iconRect.left - trackRect.left,
                    right: iconRect.right - trackRect.left,
                    top: iconRect.top - trackRect.top,
                    bottom: iconRect.bottom - trackRect.top,
                    width: iconRect.width,
                    height: iconRect.height
                },
                labelRect: {
                    left: labelRect.left - trackRect.left,
                    right: labelRect.right - trackRect.left,
                    top: labelRect.top - trackRect.top,
                    bottom: labelRect.bottom - trackRect.top,
                    width: labelRect.width,
                    height: labelRect.height
                }
            });
        });
        
        // Ordina le posizioni per numero di tappa per garantire il percorso corretto
        positions.sort((a, b) => a.stopOrder - b.stopOrder);
        
        // Identifica le diverse righe
        const rows = {};
        positions.forEach(pos => {
            if (!rows[pos.rowY]) {
                rows[pos.rowY] = [];
            }
            rows[pos.rowY].push(pos);
        });
        
        // Inizializza il percorso vuoto
        let pathData = '';
        
        // Crea percorsi separati per ciascuna riga (senza connessioni tra righe)
        Object.values(rows).forEach(rowPositions => {
            if (rowPositions.length < 2) return; // Salta righe con una sola tappa
            
            // Ordina le posizioni della riga per numero di tappa
            rowPositions.sort((a, b) => a.stopOrder - b.stopOrder);
            
            // Inizia un nuovo percorso per questa riga
            pathData += `M ${rowPositions[0].x} ${rowPositions[0].y}`;
            
            // Connetti le tappe nella stessa riga con curve di Bezier
            for (let i = 1; i < rowPositions.length; i++) {
                const prev = rowPositions[i-1];
                const curr = rowPositions[i];
                
                // Calcola la differenza di posizione tra le tappe
                const dx = curr.x - prev.x;
                const dy = curr.y - prev.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Per tappe sulla stessa riga, usa una curva morbida e flessuosa
                const heightFactor = Math.min(0.5, 30 / distance);
                
                // Punti di controllo che creano un arco più naturale
                let midY = (prev.y + curr.y) / 2;
                
                // Aggiungi un po' di variazione all'altezza della curva
                const arcHeight = distance * heightFactor * (i % 2 === 0 ? 1 : -1);
                midY += arcHeight;
                
                const cp1X = prev.x + dx/3;
                const cp1Y = midY; 
                const cp2X = curr.x - dx/3;
                const cp2Y = midY;
                
                // Curva morbida che passa sotto o sopra la linea diretta
                pathData += ` C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${curr.x} ${curr.y}`;
            }
        });
        
        // Assegna il percorso all'elemento SVG path
        pathElement.setAttribute('d', pathData);
        
        // Rendi visibile l'SVG con una transizione graduale
        svgElement.style.opacity = '1';
    }
    
    // Funzione per generare le card degli episodi dinamicamente con il nuovo design Tailwind
    function generateEpisodeCards(stops, staticStops) {
        const mainContainer = document.querySelector('main.space-y-12');
        if (!mainContainer || !stops || !Array.isArray(stops)) {
            console.error('Container principale o dati delle tappe non trovati');
            return;
        }
        
        // Svuota il contenitore attuale
        mainContainer.innerHTML = '';
        
        // Array di colori per alternare tra i vari stili
        const colorSchemes = [
            {
                gradientFrom: 'from-primary/80', 
                gradientVia: 'via-primary/40',
                badge: 'bg-primary/60',
                buttonBg: 'from-primary to-primary-light',
                buttonBorder: 'border-primary/20',
                buttonText: 'text-primary',
                buttonHover: 'hover:bg-primary/20',
                borderColor: 'border-primary',
                hoverText: 'hover:text-primary',
                hoverBorder: 'hover:border-primary/20',
                hoverBg: 'hover:bg-primary/5',
                mapsBg: 'bg-primary/10'
            },
            {
                gradientFrom: 'from-primary/80', 
                gradientVia: 'via-secondary/30',
                badge: 'bg-primary/60',
                buttonBg: 'from-primary to-primary-light',
                buttonBorder: 'border-primary/20',
                buttonText: 'text-primary',
                buttonHover: 'hover:bg-primary/20',
                borderColor: 'border-primary',
                hoverText: 'hover:text-primary',
                hoverBorder: 'hover:border-primary/20',
                hoverBg: 'hover:bg-primary/5',
                mapsBg: 'bg-primary/10'
            },
            {
                gradientFrom: 'from-secondary/80', 
                gradientVia: 'via-primary/40',
                badge: 'bg-secondary/60',
                buttonBg: 'from-secondary to-primary',
                buttonBorder: 'border-secondary/20',
                buttonText: 'text-secondary',
                buttonHover: 'hover:bg-secondary/20',
                borderColor: 'border-secondary',
                hoverText: 'hover:text-secondary',
                hoverBorder: 'hover:border-secondary/20',
                hoverBg: 'hover:bg-secondary/5',
                mapsBg: 'bg-secondary/10'
            },
            {
                gradientFrom: 'from-accent/80', 
                gradientVia: 'via-accent/30',
                badge: 'bg-accent/60',
                buttonBg: 'from-accent to-secondary',
                buttonBorder: 'border-accent/20',
                buttonText: 'text-accent',
                buttonHover: 'hover:bg-accent/20',
                borderColor: 'border-accent',
                hoverText: 'hover:text-accent',
                hoverBorder: 'hover:border-accent/20',
                hoverBg: 'hover:bg-accent/5',
                mapsBg: 'bg-accent/10'
            },
            {
                gradientFrom: 'from-secondary/80', 
                gradientVia: 'via-accent/30',
                badge: 'bg-secondary/60',
                buttonBg: 'from-secondary to-accent',
                buttonBorder: 'border-secondary/20',
                buttonText: 'text-secondary',
                buttonHover: 'hover:bg-secondary/20',
                borderColor: 'border-secondary',
                hoverText: 'hover:text-secondary',
                hoverBorder: 'hover:border-secondary/20',
                hoverBg: 'hover:bg-secondary/5',
                mapsBg: 'bg-secondary/10'
            }
        ];
        
        // Ottieni traduzioni per UI
        const showTranscription = window.LanguageManager ? 
            window.LanguageManager.getUITranslation('showTranscription') : 'Mostra trascrizione';
        const locationNumber = window.LanguageManager ? 
            window.LanguageManager.getUITranslation('locationNumber') : 'Tappa';
        const locationOnMaps = window.LanguageManager ? 
            window.LanguageManager.getUITranslation('locationOnMaps') : 'Posizione su Maps';
        
        // Crea card per ogni tappa
        stops.forEach((stop, index) => {
            if (!stop || !stop.id) return;
            
            // Cerca i dati statici per questa tappa
            const staticStop = staticStops?.find(s => s.id === stop.id) || {};
            
            // Determina l'immagine e il percorso del file audio
            const imagePath = staticStop.imagePath || stop.imagePath || 'assets/img/illustration-2.png';
            const audioPath = stop.audioPath || '#';
            
            // Ottieni il link a Google Maps dai dati statici
            const googleMapsUrl = staticStop?.googleMapsUrl || '';
            
            // Scegli un schema di colori basato sull'indice (ciclico)
            const colorScheme = colorSchemes[index % colorSchemes.length];
            
            // Converti ID con underscore in ID con trattino per il DOM
            const elementId = stop.id.replace(/_/g, '-');
            
            // Ordine della tappa (da dati statici oppure indice + 1)
            const order = staticStop.order || (index + 1);
            
            // Recupera durazione audio
            const duration = stop?.duration || '';
            
            // Crea l'elemento article con il nuovo design Tailwind
            const articleEl = document.createElement('article');
            articleEl.className = 'bg-white rounded-3xl overflow-hidden shadow-lg transition-all duration-300 hover:shadow-xl border border-gray-100 transform hover:-translate-y-1';
            articleEl.id = elementId;
            articleEl.setAttribute('aria-labelledby', `title-${elementId}`);
            
            // Crea la struttura HTML per la card con il nuovo design Tailwind
            articleEl.innerHTML = `
                <div class="flex flex-col md:flex-row">
                    <div class="relative md:w-2/5 h-60 md:h-auto overflow-hidden">
                        <img src="${imagePath}" alt="${stop.title}" class="w-full h-full object-cover object-top transition-transform duration-500 hover:scale-105">
                        <div class="absolute inset-0 bg-gradient-to-t ${colorScheme.gradientFrom} ${colorScheme.gradientVia} to-transparent opacity-80"></div>
                        
                        <!-- Badge di posizione sulla mappa - ottimizzato per tutte le dimensioni dello schermo -->
                        ${googleMapsUrl ? 
                            `<div class="absolute top-3 right-3 z-20">
                                <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" 
                                    class="maps-badge group flex items-center gap-2 px-3 py-2 rounded-lg bg-white/90 backdrop-blur-sm shadow-md hover:shadow-lg ${colorScheme.buttonText} border ${colorScheme.buttonBorder} hover:bg-white transition-all duration-300">
                                    <i class="fas fa-map-marker-alt pulse-animation"></i>
                                    <span class="font-medium text-sm">${locationOnMaps}</span>
                                    <i class="fas fa-external-link-alt text-xs opacity-70 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"></i>
                                </a>
                            </div>` 
                            : ''}
                        
                        <div class="absolute bottom-0 left-0 right-0 p-6 text-white">
                            <div class="flex items-center justify-between mb-2">
                                <span class="inline-block px-3 py-1 ${colorScheme.badge} backdrop-blur-sm rounded-full text-xs font-medium">${locationNumber} ${order}</span>
                                ${duration ? 
                                    `<span class="inline-flex items-center px-3 py-1 bg-white/30 backdrop-blur-sm rounded-full text-xs font-medium">
                                        <i class="fas fa-clock mr-1.5"></i>${duration}
                                     </span>` 
                                    : ''}
                            </div>
                            <h2 id="title-${elementId}" class="text-2xl md:text-3xl font-bold tracking-tight leading-tight">
                                ${stop.title}
                            </h2>
                            <div class="h-1 w-16 bg-gradient-to-r from-white to-white/20 mt-3"></div>
                        </div>
                    </div>
                    
                    <div class="flex-1 p-6 md:p-8">
                        <p class="text-gray-600 mb-6">${stop.description || 'Nessuna descrizione disponibile'}</p>
                        
                        <div class="bg-gradient-to-br from-primary-light/5 to-accent/5 rounded-2xl p-5 border border-gray-100 shadow-sm">
                            <!-- Player semplificato con controlli allineati e barra di avanzamento -->
                            <div class="flex items-center justify-center gap-6 md:gap-8 mb-4">
                                <!-- Pulsante indietro 30 secondi -->
                                <div class="flex flex-col items-center">
                                    <button class="backward-15 w-12 h-12 rounded-full bg-white ${colorScheme.buttonText} border ${colorScheme.buttonBorder} flex items-center justify-center ${colorScheme.buttonHover} active:scale-95 transition-all mb-1 shadow-sm" data-amplitude-playlist="episodi" data-amplitude-song-index="${index}">
                                        <i class="fas fa-undo-alt"></i>
                                    </button>
                                    <span class="text-xs font-medium text-gray-500">-30s</span>
                                </div>
                                
                                <!-- Pulsante play/pause centrale -->
                                <button class="amplitude-play-pause w-16 h-16 rounded-full bg-gradient-to-br ${colorScheme.buttonBg} text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all" data-amplitude-playlist="episodi" data-amplitude-song-index="${index}" aria-label="Riproduci o metti in pausa">
                                    <i class="fa fa-play amplitude-play text-lg" aria-hidden="true"></i>
                                    <i class="fa fa-pause amplitude-pause text-lg" aria-hidden="true"></i>
                                </button>
                                
                                <!-- Pulsante avanti 30 secondi -->
                                <div class="flex flex-col items-center">
                                    <button class="forward-15 w-12 h-12 rounded-full bg-white ${colorScheme.buttonText} border ${colorScheme.buttonBorder} flex items-center justify-center ${colorScheme.buttonHover} active:scale-95 transition-all mb-1 shadow-sm" data-amplitude-playlist="episodi" data-amplitude-song-index="${index}">
                                        <i class="fas fa-redo-alt"></i>
                                    </button>
                                    <span class="text-xs font-medium text-gray-500">+30s</span>
                                </div>
                            </div>
                            
                            <!-- Barra di avanzamento AmplitudeJS -->
                            <div class="amplitude-progress-container mt-2 flex items-center gap-2" data-amplitude-playlist="episodi" data-amplitude-song-index="${index}">
                                <span class="amplitude-current-time text-xs font-medium text-gray-500" data-amplitude-playlist="episodi" data-amplitude-song-index="${index}"></span>
                                <progress class="amplitude-song-played-progress w-full h-1.5 rounded-full overflow-hidden appearance-none bg-gray-200 [&::-webkit-progress-bar]:bg-gray-200 [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary"
                                          data-amplitude-playlist="episodi" data-amplitude-song-index="${index}"></progress>
                                <span class="amplitude-duration-time text-xs font-medium text-gray-500" data-amplitude-playlist="episodi" data-amplitude-song-index="${index}"></span>
                            </div>
                        </div>
                        
                        <!-- Pulsante trascrizione -->
                        <button class="toggle-transcript mt-5 w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-gray-600 ${colorScheme.hoverText} ${colorScheme.hoverBorder} ${colorScheme.hoverBg} transition-all flex justify-center items-center space-x-2" data-target="transcript-${index + 1}" aria-expanded="false" aria-controls="transcript-${index + 1}">
                            <span>${showTranscription}</span>
                            <i class="fas fa-chevron-down transcript-toggle-icon transition-transform ml-2" aria-hidden="true"></i>
                        </button>
                        
                        <div id="transcript-${index + 1}" class="hidden mt-4 bg-gray-50 rounded-xl border border-gray-100 overflow-hidden" aria-hidden="true" role="region" aria-label="Trascrizione audio ${stop.title}">
                            <div class="p-5 space-y-4 text-gray-700">
                                <!-- Il contenuto verrà caricato dinamicamente dal file JSON -->
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            mainContainer.appendChild(articleEl);
        });
        
        // Riconfigura i gestori di eventi per le trascrizioni
        setupTranscriptToggles();
        
        // Riconfigura i gestori di eventi per i controlli +/- 30 secondi
        setupTimeControls();
        
        // Aggiungi stile CSS per l'animazione pulsante e rendere il badge mobile più visibile
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse-map-pin {
                0% { transform: scale(1); }
                50% { transform: scale(1.2); }
                100% { transform: scale(1); }
            }
            
            .pulse-animation {
                animation: pulse-map-pin 2s infinite;
                transform-origin: center;
            }
            
            .maps-badge {
                transition: all 0.3s ease;
            }
            
            .maps-badge:hover {
                transform: translateY(-2px);
            }
            
            /* Stile responsive per badge su mobile - ingrandito e più visibile */
            @media (max-width: 768px) {
                .maps-badge {
                    padding: 0.5rem 0.75rem;
                    background-color: rgba(255, 255, 255, 0.95);
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }
                
                .maps-badge i.fa-map-marker-alt {
                    font-size: 1.25rem;
                }
                
                .maps-badge span {
                    display: none;
                }
                
                .maps-badge i.fa-external-link-alt {
                    display: none;
                }
            }
        `;
        document.head.appendChild(style);
        
        // Aggiungiamo tooltip ai pulsanti "Apri in maps"
        document.querySelectorAll('.maps-badge').forEach(button => {
            button.setAttribute('title', locationOnMaps);
            
            // Aggiungiamo effetto hover con animazione
            button.addEventListener('mouseenter', function() {
                const icon = this.querySelector('.fa-external-link-alt');
                if (icon) {
                    icon.classList.add('animate-pulse');
                }
            });
            
            button.addEventListener('mouseleave', function() {
                const icon = this.querySelector('.fa-external-link-alt');
                if (icon) {
                    icon.classList.remove('animate-pulse');
                }
            });
        });
    }
        
    // Pre-inizializza tutti i contenitori di trascrizioni per evitare problemi di layout
    function setupTranscriptToggles() {
        const toggleButtons = document.querySelectorAll('.toggle-transcript');
        
        document.querySelectorAll('.transcript-container').forEach(container => {
            container.classList.remove('expanded');
            container.setAttribute('aria-hidden', 'true');
            
            container.style.display = 'none';
            container.style.opacity = '0';
        });
        
        toggleButtons.forEach(button => {
            const targetId = button.getAttribute('data-target');
            const transcriptContainer = document.getElementById(targetId);
            
            console.log(`Inizializzazione pulsante per ${targetId}: ${transcriptContainer ? 'container trovato' : 'container NON trovato'}`);
            
            if (transcriptContainer && transcriptContainer.classList.contains('expanded')) {
                updateButtonState(button, true);
                transcriptContainer.style.display = 'block';
                transcriptContainer.style.opacity = '1';
            }
            
            button.addEventListener('click', function() {
                const targetId = this.getAttribute('data-target');
                const transcriptContainer = document.getElementById(targetId);
                
                console.log(`Click sul pulsante trascrizione per ${targetId}`);
                
                if (!transcriptContainer) {
                    console.error('Target transcript container not found:', targetId);
                    return;
                }
                
                const willExpand = !transcriptContainer.classList.contains('expanded');
                console.log(`Stato trascrizione: ${willExpand ? 'espandere' : 'contrarre'}`);
                
                transcriptContainer.classList.toggle('expanded');
                
                if (willExpand) {
                    transcriptContainer.style.display = 'block';
                    setTimeout(() => {
                        transcriptContainer.style.opacity = '1';
                        transcriptContainer.style.maxHeight = '500px';
                        transcriptContainer.style.padding = '1.25rem';
                    }, 10); 
                    
                    console.log(`Espansione di ${targetId} - display: ${transcriptContainer.style.display}`);
                } else {
                    transcriptContainer.style.opacity = '0';
                    transcriptContainer.style.maxHeight = '0';
                    transcriptContainer.style.padding = '0';
                    
                    setTimeout(() => {
                        transcriptContainer.style.display = 'none';
                    }, 500);
                    
                    console.log(`Contrazione di ${targetId}`);
                }
                
                updateButtonState(this, willExpand);
                transcriptContainer.setAttribute('aria-hidden', !willExpand);
                
                if (willExpand && !loadedIds[targetId]) {
                    const jsonPath = transcriptMap[targetId];
                    
                    console.log(`Tentativo di recuperare contenuto per il percorso: ${jsonPath}`);
                    
                    if (!jsonPath) {
                        console.error(`Nessuna trascrizione mappata per l'ID: ${targetId}`);
                        return;
                    }
                    
                    const contentDiv = transcriptContainer.querySelector('.space-y-4');
                    if (!contentDiv) {
                        console.error(`Contenitore del contenuto (.space-y-4) non trovato in: ${targetId}`);
                        return;
                    }
                    
                    contentDiv.innerHTML = '<p class="text-center"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Caricamento trascrizione...</p>';
                    
                    function renderTranscription() {
                        if (!dataLoaded || !tourData || !tourData.tour) {
                            contentDiv.innerHTML = '<p class="text-red-600">I dati dell\'audioguida non sono disponibili.</p>';
                            return;
                        }
                        
                        // Accesso ai dati specifici per lingua
                        const langData = tourData.tour.content[currentLang];
                        if (!langData) {
                            contentDiv.innerHTML = '<p class="text-red-600">Dati per questa lingua non disponibili.</p>';
                            return;
                        }
                        
                        let transcription;
                        if (jsonPath === 'introduction') {
                            // Accesso all'introduzione dalla lingua corrente
                            transcription = langData.introduction && langData.introduction.transcription;
                        } else if (jsonPath.startsWith('stops.')) {
                            // Accesso alle tappe dalla lingua corrente
                            const index = parseInt(jsonPath.split('.')[1]);
                            if (langData.stops && Array.isArray(langData.stops) && index >= 0 && index < langData.stops.length) {
                                transcription = langData.stops[index].transcription;
                            }
                        }
                        
                        if (!transcription || !transcription.paragraphs || transcription.paragraphs.length === 0) {
                            contentDiv.innerHTML = '<p class="text-red-600">Trascrizione non trovata o formato errato.</p>';
                            return;
                        }
                        
                        // Visualizza solo i paragrafi della trascrizione senza altri elementi
                        const paragraphs = transcription.paragraphs
                            .map(p => `<p>${p}</p>`)
                            .join('');
                        
                        contentDiv.innerHTML = paragraphs;
                        
                        loadedIds[targetId] = true;
                        
                        announceToScreenReader('Trascrizione caricata');
                    }
                    
                    if (dataLoaded) {
                        renderTranscription();
                    } else {
                        const checkInterval = setInterval(() => {
                            if (dataLoaded) {
                                clearInterval(checkInterval);
                                renderTranscription();
                            }
                        }, 100);
                        
                        setTimeout(() => {
                            clearInterval(checkInterval);
                            if (!dataLoaded) {
                                contentDiv.innerHTML = '<p class="text-red-600">Timeout nel caricamento dei dati.</p>';
                            }
                        }, 5000);
                    }
                }
            });
        });
    }
    
    function updateButtonState(button, isExpanded) {
        const toggleIcon = button.querySelector('.transcript-toggle-icon');
        const buttonText = button.querySelector('span');
        
        console.log(`Aggiornamento stato pulsante: ${isExpanded ? 'espanso' : 'contratto'}`);
        
        button.setAttribute('aria-expanded', isExpanded);
        
        if (toggleIcon) {
            toggleIcon.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0)';
        }
        
        if (buttonText) {
            // Ottieni le traduzioni per i pulsanti di trascrizione
            const showText = window.LanguageManager ? 
                window.LanguageManager.getUITranslation('showTranscription') : 'Mostra trascrizione';
            const hideText = window.LanguageManager ? 
                window.LanguageManager.getUITranslation('hideTranscription') : 'Nascondi trascrizione';
                
            buttonText.textContent = isExpanded ? hideText : showText;
        }
    }
    
    function announceToScreenReader(message) {
        const announcer = document.getElementById('sr-announcer') || (() => {
            const el = document.createElement('div');
            el.id = 'sr-announcer';
            el.setAttribute('aria-live', 'polite');
            el.classList.add('sr-only');
            document.body.appendChild(el);
            return el;
        })();
        
        announcer.textContent = message;
    }
});

// Implementazione dei controlli avanti/indietro di 30 secondi
function setupTimeControls() {
    const forwardButtons = document.querySelectorAll('.forward-15');
    const backwardButtons = document.querySelectorAll('.backward-15');

    console.log(`Configurazione controlli tempo: Trovati ${forwardButtons.length} pulsanti +30s e ${backwardButtons.length} pulsanti -30s`);

    // Rimuovi eventuali listener precedenti per evitare duplicazioni
    forwardButtons.forEach(button => {
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
    });
    backwardButtons.forEach(button => {
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
    });

    // Riapplica listener ai nuovi pulsanti clonati
    document.querySelectorAll('.forward-15').forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation(); // Impedisce che il click si propaghi al bottone play/pause

            console.log(`Avanti +30s cliccato`);

            try {
                const audioElement = Amplitude.getAudio();
                if (audioElement && !audioElement.paused) { // Agisce solo se l'audio è in riproduzione
                    const currentTime = audioElement.currentTime;
                    const duration = audioElement.duration;

                    console.log(`Posizione attuale: ${currentTime}s, durata: ${duration}s`);

                    if (!isNaN(currentTime) && !isNaN(duration) && duration > 0) {
                        const newPosition = Math.min(currentTime + 30, duration);
                        console.log(`Nuova posizione: ${newPosition}s`);
                        audioElement.currentTime = newPosition;

                        // Feedback visivo
                        button.classList.add('clicked');
                        setTimeout(() => button.classList.remove('clicked'), 300);
                    } else {
                        console.warn('Impossibile determinare la durata o posizione corrente per +30s');
                    }
                } else {
                     console.log('+30s ignorato: audio non in riproduzione.');
                }
            } catch (error) {
                console.error('Errore nell\'avanzamento di 30 secondi:', error);
            }
        });
    });

    document.querySelectorAll('.backward-15').forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation(); // Impedisce che il click si propaghi al bottone play/pause

            console.log(`Indietro -30s cliccato`);

            try {
                const audioElement = Amplitude.getAudio();
                 if (audioElement && !audioElement.paused) { // Agisce solo se l'audio è in riproduzione
                    const currentTime = audioElement.currentTime;

                    console.log(`Posizione attuale: ${currentTime}s`);

                    if (!isNaN(currentTime)) {
                        const newPosition = Math.max(currentTime - 30, 0);
                        console.log(`Nuova posizione: ${newPosition}s`);
                        audioElement.currentTime = newPosition;

                        // Feedback visivo
                        button.classList.add('clicked');
                        setTimeout(() => button.classList.remove('clicked'), 300);
                    } else {
                        console.warn('Impossibile determinare la posizione corrente per -30s');
                    }
                } else {
                     console.log('-30s ignorato: audio non in riproduzione.');
                }
            } catch (error) {
                console.error('Errore nel riavvolgimento di 30 secondi:', error);
            }
        });
    });
}