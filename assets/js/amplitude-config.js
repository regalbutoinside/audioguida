/**
 * Utility di configurazione di AmplitudeJS per l'audio guida di Regalbuto
 * Versione ottimizzata con caricamento progressivo e gestione efficiente della memoria
 */
const AudioPlayerManager = (function() {
    // Oggetto per tenere traccia dello stato di riproduzione
    const audioState = {
        currentPlayer: null,
        isPlaying: false,
        pausedPlayer: null,
        needsRestart: false,
        currentSong: null,
        currentPlaylist: null,
        loadedAudios: new Set(), // Tiene traccia degli audio già caricati
        preloadedAudios: new Set(), // Tiene traccia degli audio precaricati
        audioBuffers: {}, // Cache dei buffer audio
        isBuffering: false
    };
    
    // Lingua corrente
    let currentLang = localStorage.getItem('preferredLanguage') || 'it';
    
    // Espone un metodo di inizializzazione che verrà chiamato da main.js dopo il caricamento dei dati
    function initialize(tourData) {
        if (!tourData || !tourData.tour) {
            console.error('Dati del tour non validi per l\'inizializzazione di Amplitude');
            return;
        }
        
        console.log('Inizializzazione di Amplitude con i dati dal JSON', tourData);
        
        // Usa la lingua corrente dalla memorizzazione locale o dal language manager 
        if (window.LanguageManager) {
            currentLang = window.LanguageManager.getCurrentLanguage();
        }
        
        // Ottieni i dati specifici della lingua
        const langData = tourData.tour.content[currentLang];
        if (!langData) {
            console.error(`Dati per la lingua "${currentLang}" non trovati`);
            return;
        }
        
        // Recupera i dati dell'introduzione dalla lingua corrente
        const introData = langData.introduction;
        if (!introData || !introData.audioPath) {
            console.error('Dati dell\'introduzione non validi o percorso audio mancante');
            return;
        }
        
        console.log('Percorso audio intro:', introData.audioPath);
        
        // Verifica e prepara correttamente i dati degli episodi della playlist
        let episodiSongs = [];
        if (Array.isArray(langData.stops)) {
            console.log(`Trovate ${langData.stops.length} tappe per il tour`);
            
            episodiSongs = langData.stops.map((stop, index) => {
                if (!stop.audioPath) {
                    console.warn(`Tappa ${index + 1} (${stop.title}) non ha un percorso audio valido`);
                }
                
                console.log(`Tappa ${index + 1}: ${stop.title} - Audio: ${stop.audioPath}`);
                
                return {
                    "name": stop.title || `Tappa ${index + 1}`,
                    "artist": "Audio guida di Regalbuto",
                    "url": stop.audioPath,
                    "visual_id": `episode-${index}`,
                    "index": index
                };
            }).filter(song => song.url); // Filtra episodi senza URL audio
        } else {
            console.error('Dati delle tappe non trovati o non validi nel JSON');
        }
        
        // Configurazione di Amplitude basata sui dati JSON
        const config = {
            "songs": [
                {
                    "name": langData.title || "Introduzione",
                    "artist": "Audio guida di Regalbuto",
                    "url": introData.audioPath // Usa direttamente il percorso specificato nel JSON: "assets/audio/it/0_intro.mp3"
                }
            ],
            "playlists": {
                "episodi": {
                    "songs": episodiSongs
                }
            },
            "volume": 75,
            "preload": "none", // OTTIMIZZAZIONE: Imposta il precaricamento su none per controllarlo manualmente
            "callbacks": {
                'initialized': function() {
                    console.log("AmplitudeJS ha completato l'inizializzazione");
                    
                    // Annuncio che Amplitude è pronto per altri componenti
                    document.dispatchEvent(new CustomEvent('amplitude-ready'));
                    
                    // Inizializza i player dopo che Amplitude è pronto
                    initializePlayers();
                    
                    // OTTIMIZZAZIONE: Precarichiamo solo l'introduzione all'inizio
                    preloadAudio(introData.audioPath);
                    
                    console.log("Precarichiamo l'audio dell'introduzione:", introData.audioPath);
                },
                'play': function() {
                    console.log('Amplitude: Evento PLAY');
                    document.body.classList.add('audio-playing');
                    
                    // Rimuovi classe di buffering se presente da TUTTI gli elementi
                    document.querySelectorAll('.buffering').forEach(el => {
                        el.classList.remove('buffering');
                    });
                    
                    // Rimuovi anche lo stato di buffering dal pulsante correntemente attivo
                    if (audioState.currentPlayer) {
                        const activeButton = document.querySelector(`[data-player-id="${audioState.currentPlayer}"]`);
                        if (activeButton) {
                            removeBufferingState(activeButton);
                        }
                    }
                },
                'pause': function() {
                    console.log('Amplitude: Evento PAUSE');
                    document.body.classList.remove('audio-playing');
                }
            }
        };
        
        // OTTIMIZZAZIONE: Utilizziamo una promessa per verificare l'esistenza del file audio e farlo in background
        checkAudioExists(introData.audioPath)
            .then(exists => {
                if (exists) {
                    console.log(`File audio dell'intro verificato e disponibile: ${introData.audioPath}`);
                } else {
                    console.warn(`File audio dell'intro non trovato: ${introData.audioPath}. Utilizzare comunque.`);
                }
                
                // Inizializza Amplitude con la configurazione generata
                if (typeof Amplitude !== 'undefined') {
                    try {
                        Amplitude.init(config);
                        console.log("AmplitudeJS inizializzato con successo");
                    } catch (e) {
                        console.error("Errore nell'inizializzazione di AmplitudeJS:", e);
                    }
                } else {
                    console.error('Libreria AmplitudeJS non trovata');
                }
            })
            .catch(error => {
                console.warn(`Errore nella verifica del file audio: ${error}. Tento comunque l'inizializzazione.`);
                
                // Inizializza comunque
                if (typeof Amplitude !== 'undefined') {
                    try {
                        Amplitude.init(config);
                        console.log("AmplitudeJS inizializzato con successo");
                    } catch (e) {
                        console.error("Errore nell'inizializzazione di AmplitudeJS:", e);
                    }
                } else {
                    console.error('Libreria AmplitudeJS non trovata');
                }
            });
            
        // Ascolta per i cambi di lingua
        document.addEventListener('audioLanguageChanged', function(event) {
            if (event.detail && event.detail.language && event.detail.tourData) {
                updateAudioLanguage(event.detail.language, event.detail.tourData);
            }
        });
    }
    
    /**
     * OTTIMIZZAZIONE: Verifica l'esistenza del file audio in modo asincrono
     */
    function checkAudioExists(url) {
        if (!url) return Promise.resolve(false);
        
        // Non usare il metodo HEAD per verificare l'audio - può essere lento e non necessario
        // Verifichiamo però se l'URL è valido
        if (!url.startsWith('http') && !url.startsWith('assets/')) {
            console.warn(`URL audio potenzialmente non valido: ${url}`);
        }
        
        // Considera sempre valido per velocizzare il caricamento, verificherà implicitamente quando tenterà di caricare
        return Promise.resolve(true);
    }
    
    /**
     * OTTIMIZZAZIONE: Sistema di precaricamento audio
     */
    function preloadAudio(url) {
        if (!url || audioState.preloadedAudios.has(url)) return;
        
        const audio = new Audio();
        audio.preload = 'metadata'; // Carica solo i metadati inizialmente
        audio.src = url;
        
        // Una volta che i metadati sono caricati, possiamo iniziare a precaricare il contenuto
        audio.addEventListener('loadedmetadata', function() {
            audio.preload = 'auto'; // Avvia il precaricamento effettivo
            audioState.preloadedAudios.add(url);
            console.log(`Audio precaricato: ${url}`);
        });
        
        // Gestisci eventuali errori
        audio.addEventListener('error', function() {
            console.error(`Errore nel precaricamento dell'audio: ${url}`);
        });
    }
    
    /**
     * OTTIMIZZAZIONE: Precarica l'audio delle tappe vicine a quella corrente
     */
    function preloadNearbyAudios(currentIndex, playlist) {
        if (!Amplitude.getConfig() || !Amplitude.getConfig().playlists || !Amplitude.getConfig().playlists[playlist]) return;
        
        const songs = Amplitude.getConfig().playlists[playlist].songs;
        if (!Array.isArray(songs)) return;
        
        // Precarica la traccia successiva e quella precedente
        const preloadIndexes = [currentIndex + 1, currentIndex - 1];
        
        preloadIndexes.forEach(index => {
            if (index >= 0 && index < songs.length) {
                const audioUrl = songs[index].url;
                if (audioUrl && !audioState.preloadedAudios.has(audioUrl)) {
                    console.log(`Precaricamento proattivo dell'audio vicino: ${audioUrl}`);
                    preloadAudio(audioUrl);
                }
            }
        });
    }
    
    /**
     * Aggiorna i file audio quando cambia la lingua
     */
    function updateAudioLanguage(lang, tourData) {
        console.log(`Aggiornamento lingua audio a: ${lang}`);
        currentLang = lang;
        
        if (!tourData || !tourData.tour || !tourData.tour.content || !tourData.tour.content[lang]) {
            console.error(`Dati per la lingua ${lang} non disponibili`);
            return;
        }
        
        // Recupera i dati della nuova lingua
        const langData = tourData.tour.content[lang];
        const introData = langData.introduction;
        
        if (!introData || !introData.audioPath) {
            console.error('Dati dell\'introduzione non validi o percorso audio mancante');
            return;
        }
        
        // Forza la pausa di qualsiasi riproduzione in corso
        try {
            Amplitude.pause();
        } catch(e) {
            console.warn("Errore durante la pausa dell'audio:", e);
        }
        
        // Reset dello stato del player
        audioState.isPlaying = false;
        audioState.pausedPlayer = null;
        audioState.loadedAudios.clear(); // Resetta completamente gli audio caricati per forzare un nuovo caricamento
        
        // Memorizza i percorsi originali senza aggiungere parametri nocache
        const originalPaths = {
            intro: introData.audioPath,
            stops: []
        };
        
        if (Array.isArray(langData.stops)) {
            langData.stops.forEach(stop => {
                if (stop && stop.audioPath) {
                    originalPaths.stops.push(stop.audioPath);
                } else {
                    originalPaths.stops.push(null);
                }
            });
        }
        
        console.log("Percorsi audio originali memorizzati:", originalPaths);
        
        // Prepara i nuovi dati per l'aggiornamento
        let episodiSongs = [];
        if (Array.isArray(langData.stops)) {
            episodiSongs = langData.stops.map((stop, index) => {
                const audioPath = stop.audioPath;
                
                console.log(`Preparando tappa ${index + 1}: ${stop.title} - Audio: ${audioPath}`);
                
                return {
                    "name": stop.title || `Tappa ${index + 1}`,
                    "artist": "Audio guida di Regalbuto",
                    "url": audioPath,
                    "visual_id": `episode-${index}`,
                    "index": index
                };
            }).filter(song => song.url);
        }
        
        // Configurazione aggiornata
        const introAudioPath = introData.audioPath;
        console.log(`Preparando intro con audio: ${introAudioPath}`);
        
        const config = {
            "songs": [
                {
                    "name": langData.title || "Introduzione",
                    "artist": "Audio guida di Regalbuto",
                    "url": introAudioPath
                }
            ],
            "playlists": {
                "episodi": {
                    "songs": episodiSongs
                }
            },
            "volume": 75,
            "preload": "none" // Imposta il precaricamento su none per controllarlo manualmente
        };

        // MODIFICA: Forziamo sempre il reset completo per garantire che l'intro funzioni correttamente
        console.log("Eseguendo reset completo di Amplitude per garantire la compatibilità dell'introduzione...");
        performFullReset(config, lang, introAudioPath);
        
        // Funzione di reset completo
        function performFullReset(config, lang, introAudioPath) {
            try {
                // Distruggi l'istanza di Amplitude se possibile
                if (typeof Amplitude.destroy === 'function') {
                    try {
                        Amplitude.destroy();
                        console.log("Istanza Amplitude distrutta");
                    } catch(e) {
                        console.warn("Errore nella distruzione dell'istanza Amplitude:", e);
                    }
                }
                
                // Piccolo ritardo per assicurarsi che tutto sia pulito prima di reinizializzare
                setTimeout(() => {
                    try {
                        Amplitude.init(config);
                        console.log("Amplitude reinizializzato con successo con i nuovi audio");
                        
                        // Reinizializza tutti i player dopo il reset completo
                        initializePlayers();
                        
                        // Precarica l'introduzione
                        preloadAudio(introAudioPath);
                        
                        document.dispatchEvent(new CustomEvent('audioFilesUpdated', {
                            detail: { language: lang }
                        }));
                        
                        console.log("Reset completo e reinizializzazione completati");
                    } catch(e) {
                        console.error("Errore nella reinizializzazione di Amplitude:", e);
                    }
                }, 300);
            } catch(e) {
                console.error("Errore critico nel reset completo:", e);
            }
        }
    }
    
    /**
     * Funzione handler separata per gestire il click sui pulsanti player
     * Estratta per evitare duplicazioni e rendere più facile il debug
     */
    function handlePlayerClick(e) {
        e.stopPropagation(); // Impedisci la propagazione dell'evento
        
        const button = this;
        const playerId = button.getAttribute('data-player-id');
        const playlist = button.getAttribute('data-amplitude-playlist');
        // Use nullish coalescing for index in case the attribute is missing (main player)
        const index = parseInt(button.getAttribute('data-amplitude-song-index') ?? '-1');
        
        console.log(`Click su player: ${playerId}, stato corrente: isPlaying=${audioState.isPlaying}, currentPlayer=${audioState.currentPlayer}, pausedPlayer=${audioState.pausedPlayer}, playlist=${playlist}, index=${index}`);
        
        try {
            // Prima di tutto, mostra un feedback visivo che stiamo elaborando
            showBufferingState(button);
            
            // --- CASO 1: Player corrente in riproduzione viene cliccato (PAUSA) ---
            if (audioState.currentPlayer === playerId && audioState.isPlaying) {
                Amplitude.pause();
                audioState.isPlaying = false;
                audioState.pausedPlayer = playerId; // Memorizza quale player è stato messo in pausa
                updatePlayerVisualState(button, false);
                console.log(`Player messo in pausa: ${playerId}`);
                removeBufferingState(button);
            }
            // --- CASO 2: Player messo in pausa viene cliccato (RIPRENDI) ---
            // Verifica se è lo stesso player E se l'indice/playlist corrisponde a quello in pausa
            else if (playerId === audioState.pausedPlayer &&
                     ((playlist === null && audioState.currentPlaylist === null) || // Intro player
                      (playlist === audioState.currentPlaylist && index === audioState.currentSong))) // Playlist player
            {
                Amplitude.play();
                audioState.isPlaying = true;
                audioState.currentPlayer = playerId;
                audioState.pausedPlayer = null; // Non è più in pausa
                updatePlayerVisualState(button, true);
                console.log(`Player ripreso da pausa: ${playerId}`);
                removeBufferingState(button);
            }
            // --- CASO 3: Nuovo player viene cliccato (AVVIO) ---
            else {
                // Se un altro player è attivo (in play o in pausa), fermalo e resetta la sua UI
                if (audioState.isPlaying || audioState.pausedPlayer) {
                    Amplitude.pause();
                    if (audioState.currentPlayer) {
                        const prevPlayerButton = document.querySelector(`[data-player-id="${audioState.currentPlayer}"]`);
                        if (prevPlayerButton) {
                            updatePlayerVisualState(prevPlayerButton, false);
                        }
                    }
                    
                    // Reset completo dell'audio precedente se necessario
                    try {
                        // Non resettare currentTime qui, potrebbe interrompere la ripresa
                    } catch(e) {
                        console.warn('Impossibile resettare la posizione audio', e);
                    }
                }
                
                // OTTIMIZZAZIONE: Precarica l'audio prima di riprodurlo
                const audioUrl = getAudioUrlForButton(button);
                if (audioUrl && !audioState.loadedAudios.has(audioUrl)) {
                    // Mostra stato di buffering
                    showBufferingState(button);
                }
                
                // Avvia questo player dall'inizio
                if (playlist === null) {
                    // --- Player Principale (Introduzione) ---
                    console.log('Avvio player principale (Introduzione)');
                    // Assicurati di suonare SEMPRE la canzone all'indice 0
                    Amplitude.playSongAtIndex(0);
                    audioState.currentPlaylist = null;
                    audioState.currentSong = null; // Indice 0 della lista principale, non playlist
                } else {
                    // --- Player della Playlist ---
                    console.log(`Avvio episodio: playlist=${playlist}, index=${index}`);
                    // OTTIMIZZAZIONE: Utilizziamo la nostra funzione di riproduzione ottimizzata
                    const success = playPlaylistSongWithProgressiveLoading(index, playlist);
                    
                    if (success) {
                        audioState.currentPlaylist = playlist;
                        audioState.currentSong = index;
                        
                        // OTTIMIZZAZIONE: Precarica le tracce vicine per un'esperienza più fluida
                        preloadNearbyAudios(index, playlist);
                    } else {
                        console.error(`Impossibile riprodurre la tappa ${index + 1}`);
                        alert('Si è verificato un problema con la riproduzione dell\'audio. Prova a ricaricare la pagina.');
                        removeBufferingState(button);
                        return; // Esci se la riproduzione fallisce
                    }
                }
                
                // Aggiorna lo stato globale
                audioState.currentPlayer = playerId;
                audioState.isPlaying = true;
                audioState.pausedPlayer = null; // Resetta il player in pausa
                
                updatePlayerVisualState(button, true);
                console.log(`Nuovo player avviato: ${playerId}`);
            }
        } catch (error) {
            console.error(`Errore nella gestione del player ${playerId}:`, error);
            removeBufferingState(button);
        }
    }
    
    /**
     * OTTIMIZZAZIONE: Ottiene l'URL audio associato a un pulsante
     */
    function getAudioUrlForButton(button) {
        const playlist = button.getAttribute('data-amplitude-playlist');
        const index = parseInt(button.getAttribute('data-amplitude-song-index') ?? '-1');
        
        try {
            if (playlist === null) {
                // Main player (intro)
                const songs = Amplitude.getSongs();
                if (songs && songs.length > 0) {
                    return songs[0].url;
                }
            } else if (playlist && index !== -1) {
                // Playlist song
                const config = Amplitude.getConfig();
                if (config && config.playlists && config.playlists[playlist] && 
                    Array.isArray(config.playlists[playlist].songs) && 
                    index < config.playlists[playlist].songs.length) {
                    
                    return config.playlists[playlist].songs[index].url;
                }
            }
        } catch(e) {
            console.error("Errore nel recupero dell'URL audio:", e);
        }
        
        return null;
    }
    
    /**
     * OTTIMIZZAZIONE: Mostra lo stato di buffering
     */
    function showBufferingState(button) {
        // Aggiungi la classe di buffering
        button.classList.add('buffering');
        
        // Aggiungiamo anche al container del player
        const playerContainer = button.closest('.amplitude-player') || button.closest('.modern-audio-player');
        if (playerContainer) {
            playerContainer.classList.add('buffering');
        }
        
        // Se dopo 5 secondi siamo ancora in buffering, rimuoviamo lo stato per evitare blocchi UI
        setTimeout(() => {
            removeBufferingState(button);
        }, 5000);
    }
    
    /**
     * OTTIMIZZAZIONE: Rimuove lo stato di buffering
     */
    function removeBufferingState(button) {
        // Rimuovi la classe di buffering
        button.classList.remove('buffering');
        
        // Rimuoviamo anche dal container del player
        const playerContainer = button.closest('.amplitude-player') || button.closest('.modern-audio-player');
        if (playerContainer) {
            playerContainer.classList.remove('buffering');
        }
    }
    
    /**
     * OTTIMIZZAZIONE: Funzione che riproduce una canzone con caricamento progressivo
     */
    function playPlaylistSongWithProgressiveLoading(index, playlist) {
        console.log(`Riproduzione progressiva: playlist=${playlist}, index=${index}`);
        
        // Verifica che la playlist e l'indice siano validi
        if (!Amplitude.getConfig().playlists || 
            !Amplitude.getConfig().playlists[playlist] || 
            !Amplitude.getConfig().playlists[playlist].songs || 
            index >= Amplitude.getConfig().playlists[playlist].songs.length) {
            console.error('Playlist o indice non validi');
            return false;
        }
        
        // Ottieni i dati della canzone dalla configurazione di Amplitude
        const song = Amplitude.getConfig().playlists[playlist].songs[index];
        if (!song || !song.url) {
            console.error('Canzone non valida o URL mancante');
            return false;
        }
        
        try {
            // Metodo standard di Amplitude (tenta prima questo)
            Amplitude.playPlaylistSongAtIndex(index, playlist);
            
            // Segna l'audio come caricato
            audioState.loadedAudios.add(song.url);
            
            console.log('Riproduzione avviata tramite metodo standard');
            return true;
        } catch (e) {
            console.warn('Fallimento del metodo standard, provo con il caricamento progressivo:', e);
            
            // Fallback: Manipolazione diretta dell'elemento audio
            const audioElement = Amplitude.getAudio();
            if (audioElement) {
                audioElement.pause();
                
                // OTTIMIZZAZIONE: Aggiungiamo un event listener per il buffering
                const onCanPlayThrough = () => {
                    console.log('Audio pronto per la riproduzione senza interruzioni');
                    
                    // Rimuoviamo gli stati di buffering da tutti i player
                    document.querySelectorAll('.buffering').forEach(el => {
                        el.classList.remove('buffering');
                    });
                    
                    audioState.isBuffering = false;
                    
                    // Rimuovi questo listener
                    audioElement.removeEventListener('canplaythrough', onCanPlayThrough);
                };
                
                // Aggiungi l'event listener
                audioElement.addEventListener('canplaythrough', onCanPlayThrough);
                
                // OTTIMIZZAZIONE: Indicia buffering
                audioState.isBuffering = true;
                
                // Usa direttamente l'URL
                audioElement.src = song.url;
                audioElement.load();
                console.log(`File audio caricato con URL: ${song.url}`);
                
                // Segna l'audio come caricato
                audioState.loadedAudios.add(song.url);
                
                // Inizia a riprodurre appena possibile
                const playPromise = audioElement.play();
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        console.log('Riproduzione avviata con successo tramite caricamento progressivo');
                    }).catch(err => {
                        console.error('Errore durante la riproduzione via caricamento progressivo:', err);
                    });
                }
                
                return true;
            }
        }
        
        console.error('Impossibile avviare la riproduzione con nessun metodo.');
        return false;
    }
    
    /**
     * Reset completo dello stato visuale di tutti i player audio
     * Assicura che tutti i pulsanti siano in stato "pausa" dopo un cambio lingua
     * e riconfigura gli event listener per assicurarsi che funzionino dopo il cambio lingua
     */
    function resetAllPlayerButtonStates() {
        console.log('Reset dello stato di tutti i player audio e riconfigurazione dei controlli');
        
        // Reset dello stato audio interno
        audioState.isPlaying = false;
        audioState.pausedPlayer = null;
        
        // Reset del player principale
        const mainButton = document.querySelector('[data-amplitude-main-play-pause="true"]');
        if (mainButton) {
            updatePlayerVisualState(mainButton, false);
            // Riconfigura il pulsante principale
            setupPlayerButton(mainButton, null, null);
            console.log('Pulsante principale riconfigurato');
        }
        
        // Reset e riconfigurazione di tutti i player della playlist
        document.querySelectorAll('.amplitude-play-pause[data-amplitude-playlist]').forEach(button => {
            updatePlayerVisualState(button, false);
            
            // Riconfigura ogni pulsante con i propri event listener
            const playlist = button.getAttribute('data-amplitude-playlist');
            const songIndex = parseInt(button.getAttribute('data-amplitude-song-index'));
            
            if (!isNaN(songIndex)) {
                // Rimuovi eventuali event listener precedenti sostituendo l'elemento
                const newButton = button.cloneNode(true);
                if (button.parentNode) {
                    button.parentNode.replaceChild(newButton, button);
                    
                    // Riconfigura il nuovo pulsante
                    setupPlayerButton(newButton, playlist, songIndex);
                    console.log(`Pulsante per playlist=${playlist}, index=${songIndex} riconfigurato`);
                }
            }
        });
        
        // Reset di tutti i contenitori player
        document.querySelectorAll('.amplitude-player, .modern-audio-player').forEach(player => {
            player.classList.remove('amplitude-playing');
            player.classList.add('amplitude-paused');
            
            // OTTIMIZZAZIONE: Rimuovi anche eventuali stati di buffering
            player.classList.remove('buffering');
        });
        
        console.log('Reset e riconfigurazione dei player audio completati');
    }
    
    /**
     * Inizializza tutti i player audio con gestione degli eventi personalizzata
     */
    function initializePlayers() {
        // Crea le visualizzazioni per i player
        setupWaveforms();
        
        // Rimuovi TUTTI gli event listener predefiniti di Amplitude dai pulsanti
        removeDefaultAmplitudeListeners();
        
        // Aggiungi i nostri event listener personalizzati
        setupCustomAudioControls();
        
        // Inizializza tutti i player in stato di pausa
        document.querySelectorAll('.amplitude-player').forEach(player => {
            player.classList.add('amplitude-paused');
            player.classList.remove('amplitude-playing');
            
            // OTTIMIZZAZIONE: Rimuovi anche eventuali stati di buffering
            player.classList.remove('buffering');
        });
        
        console.log('Players inizializzati');
    }
    
    /**
     * Configura i controlli audio personalizzati
     */
    function setupCustomAudioControls() {
        // Gestisci il player principale
        const mainButton = document.querySelector('[data-amplitude-main-play-pause="true"]');
        if (mainButton) {
            console.log('Configuro il pulsante principale del player');
            setupPlayerButton(mainButton, null, null);
        } else {
            console.error('Pulsante principale non trovato');
        }
        
        // Gestisci i player della playlist
        document.querySelectorAll('.amplitude-play-pause[data-amplitude-playlist]').forEach(button => {
            const playlist = button.getAttribute('data-amplitude-playlist');
            const songIndex = parseInt(button.getAttribute('data-amplitude-song-index'));
            
            if (!isNaN(songIndex)) {
                console.log(`Configuro pulsante player: playlist=${playlist}, songIndex=${songIndex}`);
                setupPlayerButton(button, playlist, songIndex);
            } else {
                console.error(`Indice canzone non valido nel pulsante: ${button.outerHTML}`);
            }
        });
        
        console.log('Controlli audio configurati');
    }
    
    /**
     * Configura un singolo pulsante player
     */
    function setupPlayerButton(button, playlist, index) {
        // Assegna un ID univoco al pulsante se non ne ha già uno
        // Questo è cruciale per il corretto funzionamento dopo il cambio di lingua
        let playerId = button.getAttribute('data-player-id');
        if (!playerId) {
            if (playlist === null) {
                playerId = 'main-player';
            } else {
                playerId = `playlist-${playlist}-song-${index}`;
            }
            button.setAttribute('data-player-id', playerId);
            console.log(`Assegnato ID player: ${playerId}`);
        }
        
        // Inizializza correttamente lo stato visivo (icona play visibile, icona pause nascosta)
        const playIcon = button.querySelector('.amplitude-play');
        const pauseIcon = button.querySelector('.amplitude-pause');
        
        if (playIcon && pauseIcon) {
            playIcon.style.display = 'inline-block';
            pauseIcon.style.display = 'none';
        }
        
        // Rimuovi eventuali vecchi event listener
        button.removeEventListener('click', handlePlayerClick);
        
        // Aggiungi l'event listener con riferimento diretto alla funzione
        button.addEventListener('click', handlePlayerClick);
        
        console.log(`Pulsante player configurato: ${playerId}`);
    }
    
    /**
     * Aggiorna lo stato visivo del player
     */
    function updatePlayerVisualState(button, isPlaying) {
        const playerContainer = button.closest('.amplitude-player') || button.closest('.modern-audio-player');
        
        if (playerContainer) {
            if (isPlaying) {
                playerContainer.classList.add('amplitude-playing');
                playerContainer.classList.remove('amplitude-paused');
            } else {
                playerContainer.classList.remove('amplitude-playing');
                playerContainer.classList.add('amplitude-paused');
            }
        }
        
        // Aggiorna le icone all'interno del pulsante
        const playIcon = button.querySelector('.amplitude-play');
        const pauseIcon = button.querySelector('.amplitude-pause');
        
        if (playIcon && pauseIcon) {
            if (isPlaying) {
                playIcon.style.display = 'none';
                pauseIcon.style.display = 'inline-block';
            } else {
                playIcon.style.display = 'inline-block';
                pauseIcon.style.display = 'none';
            }
            
            // Aggiorna classi CSS per supportare diversi stili
            if (isPlaying) {
                button.classList.add('playing');
                button.classList.remove('paused');
            } else {
                button.classList.remove('playing');
                button.classList.add('paused');
            }
        }
        
        // Forza un reflow del DOM per assicurarsi che le modifiche CSS vengano applicate immediatamente
        void button.offsetWidth;
    }
    
    /**
     * Rimuove gli event listener predefiniti di Amplitude
     */
    function removeDefaultAmplitudeListeners() {
        document.querySelectorAll('.amplitude-play-pause').forEach(button => {
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
        });
    }
    
    /**
     * Configura le visualizzazioni delle onde audio
     */
    function setupWaveforms() {
        document.querySelectorAll('.amplitude-visualization').forEach(element => {
            if (element.id) {
                createSimpleWaveform(element.id);
            }
        });
    }
    
    /**
     * Crea una visualizzazione a forma d'onda migliorata e più accattivante
     * Il design è più minimalista per il player dell'hero
     */
    function createSimpleWaveform(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const canvas = document.createElement('canvas');
        canvas.width = container.clientWidth || 300;
        canvas.height = container.clientHeight || 80;
        container.appendChild(canvas);
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // Determina se questo è il player dell'hero
        const isHero = containerId === 'intro-visualization';
        
        // Ottieni la larghezza della viewport per adattare le onde audio in base alle dimensioni dello schermo
        const viewportWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
        const isMobile = viewportWidth <= 768;
        const isSmallMobile = viewportWidth <= 480;
        
        // OTTIMIZZAZIONE: Visualizzazione più efficiente
        // Per i dispositivi mobili, soprattutto quelli meno potenti, 
        // utilizziamo una versione più leggera della visualizzazione
        if (isHero) {
            // Crea un effetto di onde sonore minimalista
            const drawHeroWaveform = () => {
                // OTTIMIZZAZIONE: Riduzione del carico di disegno
                // Non disegniamo se il tab non è in focus
                if (document.hidden) {
                    // Richiediamo un nuovo frame di animazione a bassa frequenza
                    setTimeout(() => requestAnimationFrame(drawHeroWaveform), 1000);
                    return;
                }
                
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // Gradiente più leggero e minimal per le onde
                const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
                gradient.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0.25)');
                ctx.fillStyle = gradient;
                
                const time = Date.now() * 0.001; // tempo in secondi per l'animazione
                
                // Adatta la densità delle onde in base alla dimensione dello schermo
                let barWidth = 3;
                let gap = isSmallMobile ? 12 : (isMobile ? 10 : 9);
                
                // Onde più distanziate su mobile per un design pulito
                const barCount = Math.floor(canvas.width / (barWidth + gap));
                
                for (let i = 0; i < barCount; i++) {
                    // Crea onde più semplici
                    const x = i * (barWidth + gap);
                    let amplitude = 0;
                    
                    // Usa meno onde sinusoidali per un aspetto più pulito
                    amplitude += Math.sin((i / barCount * 3) + time * 0.5) * 0.4;
                    amplitude += Math.sin((i / barCount * 1.5) + time * 0.3) * 0.2;
                    amplitude /= 0.6; // normalizza
                    
                    // Meno variazione casuale per un aspetto più ordinato
                    amplitude *= (0.9 + Math.sin(i * 0.1) * 0.1);
                    
                    // Limitare l'ampiezza
                    amplitude = Math.min(Math.max(0.15, amplitude + 0.5), 0.85);
                    
                    const height = amplitude * canvas.height * 0.75;
                    const y = (canvas.height - height) / 2;
                    
                    // Disegno delle barre con bordi completamente arrotondati per un aspetto più morbido
                    ctx.beginPath();
                    ctx.roundRect(x, y, barWidth, height, barWidth / 2);
                    ctx.fill();
                }
                
                // Continua l'animazione
                requestAnimationFrame(drawHeroWaveform);
            };
            
            // Avvia l'animazione solo per il player dell'hero
            drawHeroWaveform();
        } else {
            // Visualizzazione standard per gli altri player
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            
            // Crea una forma d'onda estetica standard
            const barCount = Math.floor(canvas.width / 5);
            const barWidth = 2;
            const gap = 3;
            
            for (let i = 0; i < barCount; i++) {
                let heightRatio = Math.sin((i / barCount) * Math.PI * 5) * 0.5 + 0.5;
                heightRatio = Math.min(Math.max(0.1, heightRatio + (Math.random() * 0.3 - 0.15)), 0.95);
                
                const height = heightRatio * canvas.height * 0.8;
                const x = i * (barWidth + gap);
                const y = (canvas.height - height) / 2;
                
                ctx.fillRect(x, y, barWidth, height);
            }
        }
    }
    
    // Espone le funzioni necessarie come API pubblica
    return {
        initialize: initialize,
        getAudioState: function() { return audioState; },
        setupPlayerButton: setupPlayerButton, // Espone questa funzione per permettere di configurare nuovi pulsanti dinamicamente
        updatePlayerVisualState: updatePlayerVisualState, // Espone questa funzione per aggiornare lo stato visivo
        updateAudioLanguage: updateAudioLanguage // Espone la funzione per aggiornare la lingua dell'audio
    };
})();

// Ascoltiamo un evento personalizzato che sarà emesso da main.js quando i dati sono pronti
document.addEventListener('audioguideDataLoaded', function(event) {
    console.log('Evento audioguideDataLoaded ricevuto');
    
    if (event.detail && event.detail.tourData) {
        AudioPlayerManager.initialize(event.detail.tourData);
    } else {
        console.error('Evento audioguideDataLoaded ricevuto senza dati validi');
    }
});

// Ascoltiamo l'evento di cambio lingua per aggiornare i file audio
document.addEventListener('audioLanguageChanged', function(event) {
    console.log('Evento audioLanguageChanged ricevuto');
    
    if (event.detail && event.detail.language && event.detail.tourData) {
        AudioPlayerManager.updateAudioLanguage(event.detail.language, event.detail.tourData);
    } else {
        console.error('Evento audioLanguageChanged ricevuto senza dati validi');
    }
});
