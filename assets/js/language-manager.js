/**
 * Language Manager - Sistema di gestione multilingua per l'audioguida di Regalbuto
 */
const LanguageManager = (function() {
    // Elenco delle lingue supportate
    const supportedLanguages = ['it', 'en', 'es', 'de', 'fr'];
    
    // Lingua predefinita
    const defaultLanguage = 'it';
    
    // Mappa delle traduzioni UI che non sono nel file JSON
    const uiTranslations = {
        'it': {
            'tourButton': 'Inizia il tour',
            'showTranscription': 'Mostra trascrizione',
            'hideTranscription': 'Nascondi trascrizione',
            'locations': 'Tappe',
            'history': 'Storia',
            'map': 'Mappa',
            'locationNumber': 'Tappa',
            'locationOnMaps': 'Posizione su Maps',
            'skipToContent': 'Salta al contenuto principale',
            'footer-prefix': 'Un progetto di ',
            'footer-suffix': ' concesso in ',
            'footer-license': 'Licenza CC BY-SA 4.0',
            'findOutStops': 'Scopri le tappe',
            'discoverStops': 'Scopri tutte le tappe',
            'scrollToStops': 'Scorri verso le tappe del tour',
            'map-title': 'Mappa delle Tappe',
            'map-description': 'Esplora tutti i luoghi del tour attraverso una mappa interattiva. Clicca sui marcatori per scoprire informazioni dettagliate su ogni tappa.',
            'map-loading': 'Caricamento mappa...'
        },
        'en': {
            'tourButton': 'Start the tour',
            'showTranscription': 'Show transcription',
            'hideTranscription': 'Hide transcription',
            'locations': 'Stops',
            'history': 'History',
            'map': 'Map',
            'locationNumber': 'Stop',
            'locationOnMaps': 'View on Maps',
            'skipToContent': 'Skip to main content',
            'footer-prefix': 'A project by ',
            'footer-suffix': ' licensed under ',
            'footer-license': 'CC BY-SA 4.0 License',
            'findOutStops': 'Discover the stops',
            'discoverStops': 'Discover all stops',
            'scrollToStops': 'Scroll to tour stops',
            'map-title': 'Stops Map',
            'map-description': 'Explore all tour locations through an interactive map. Click on markers to discover detailed information about each stop.',
            'map-loading': 'Loading map...'
        },
        'es': {
            'tourButton': 'Iniciar el tour',
            'showTranscription': 'Mostrar transcripción',
            'hideTranscription': 'Ocultar transcripción',
            'locations': 'Paradas',
            'history': 'Historia',
            'map': 'Mapa',
            'locationNumber': 'Parada',
            'locationOnMaps': 'Ver en Maps',
            'skipToContent': 'Saltar al contenido principal',
            'footer-prefix': 'Un proyecto de ',
            'footer-suffix': ' con licencia ',
            'footer-license': 'Licencia CC BY-SA 4.0',
            'findOutStops': 'Descubre las paradas',
            'discoverStops': 'Descubre todas las paradas',
            'scrollToStops': 'Desplázate a las paradas del tour',
            'map-title': 'Mapa de Paradas',
            'map-description': 'Explora todos los lugares del tour a través de un mapa interactivo. Haz clic en los marcadores para descubrir información detallada sobre cada parada.',
            'map-loading': 'Cargando mapa...'
        },
        'de': {
            'tourButton': 'Tour starten',
            'showTranscription': 'Transkription anzeigen',
            'hideTranscription': 'Transkription ausblenden',
            'locations': 'Stationen',
            'history': 'Geschichte',
            'map': 'Karte',
            'locationNumber': 'Station',
            'locationOnMaps': 'Auf Maps anzeigen',
            'skipToContent': 'Zum Hauptinhalt springen',
            'footer-prefix': 'Ein Projekt von ',
            'footer-suffix': ' lizenziert unter ',
            'footer-license': 'CC BY-SA 4.0 Lizenz',
            'findOutStops': 'Entdecke die Stationen',
            'discoverStops': 'Entdecke alle Stationen',
            'scrollToStops': 'Zu den Tour-Stationen scrollen',
            'map-title': 'Stationskarte',
            'map-description': 'Erkunden Sie alle Tour-Orte über eine interaktive Karte. Klicken Sie auf die Markierungen, um detaillierte Informationen zu jeder Station zu entdecken.',
            'map-loading': 'Karte wird geladen...'
        },
        'fr': {
            'tourButton': 'Commencer la visite',
            'showTranscription': 'Afficher la transcription',
            'hideTranscription': 'Masquer la transcription',
            'locations': 'Étapes',
            'history': 'Histoire',
            'map': 'Carte',
            'locationNumber': 'Étape',
            'locationOnMaps': 'Voir sur Maps',
            'skipToContent': 'Passer au contenu principal',
            'footer-prefix': 'Un projet de ',
            'footer-suffix': ' sous licence ',
            'footer-license': 'Licence CC BY-SA 4.0',
            'findOutStops': 'Découvrez les étapes',
            'discoverStops': 'Découvrez toutes les étapes',
            'scrollToStops': 'Défiler vers les étapes de la visite',
            'map-title': 'Carte des Étapes',
            'map-description': 'Explorez tous les lieux de la visite à travers une carte interactive. Cliquez sur les marqueurs pour découvrir des informations détaillées sur chaque étape.',
            'map-loading': 'Chargement de la carte...'
        }
    };
    
    // Lingua corrente (impostata dal localStorage o dal default)
    let currentLang = localStorage.getItem('preferredLanguage') || defaultLanguage;
    
    // Riferimento ai dati del tour
    let tourData = null;
    
    /**
     * Inizializza il gestore della lingua
     * @param {Object} data - I dati JSON dell'audioguida
     */
    function initialize(data) {
        tourData = data;
        
        // Verifica che la lingua salvata sia supportata
        if (!supportedLanguages.includes(currentLang)) {
            currentLang = defaultLanguage;
            localStorage.setItem('preferredLanguage', currentLang);
        }
        
        // Imposta l'attributo lang nell'HTML anche all'inizializzazione
        document.documentElement.setAttribute('lang', currentLang);
        
        // Imposta la lingua corrente nell'interfaccia
        setLanguageInUI();
        
        // Configurazione dei pulsanti di selezione lingua
        setupLanguageSelectors();
        
        console.log(`Language Manager inizializzato con lingua: ${currentLang}`);
        
        // Emetti un evento per informare che la lingua è stata impostata
        document.dispatchEvent(new CustomEvent('languageSet', {
            detail: { language: currentLang }
        }));
    }
    
    /**
     * Configura i selettori della lingua (desktop e mobile)
     */
    function setupLanguageSelectors() {
        // Selettore lingua desktop
        document.querySelectorAll('.language-option').forEach(option => {
            option.addEventListener('click', function(e) {
                e.preventDefault();
                const lang = this.getAttribute('data-lang');
                changeLanguage(lang);
            });
        });
        
        // Selettore lingua mobile
        document.querySelectorAll('.language-option-mobile').forEach(option => {
            option.addEventListener('click', function() {
                const lang = this.getAttribute('data-lang');
                changeLanguage(lang);
                
                // Rimuovi selezione precedente
                document.querySelectorAll('.language-option-mobile').forEach(opt => 
                    opt.classList.remove('border-primary', 'bg-primary/10'));
                
                // Evidenzia opzione selezionata
                this.classList.add('border-primary', 'bg-primary/10');
                
                // Chiudi il menu mobile quando si seleziona una lingua
                const mobileMenu = document.getElementById('mobile-menu');
                const mobileMenuButton = document.getElementById('mobile-menu-button');
                
                if (mobileMenu && mobileMenu.classList.contains('open')) {
                    mobileMenu.classList.remove('open');
                    mobileMenu.setAttribute('aria-hidden', 'true');
                    if (mobileMenuButton) {
                        mobileMenuButton.setAttribute('aria-expanded', 'false');
                        mobileMenuButton.classList.remove('menu-open');
                    }
                    document.body.classList.remove('overflow-hidden');
                }
            });
        });
        
        // Imposta la lingua corrente nei selettori
        highlightCurrentLanguage();
    }
    
    /**
     * Evidenzia la lingua corrente nei selettori
     */
    function highlightCurrentLanguage() {
        // Selettore desktop
        document.querySelector('.current-language').textContent = getLanguageDisplayName(currentLang);
        
        // Selettore mobile con attributi ARIA per accessibilità
        document.querySelectorAll('.language-option-mobile').forEach(option => {
            const lang = option.getAttribute('data-lang');
            if (lang === currentLang) {
                option.classList.add('border-primary', 'bg-primary/10');
                option.setAttribute('aria-pressed', 'true');
            } else {
                option.classList.remove('border-primary', 'bg-primary/10');
                option.setAttribute('aria-pressed', 'false');
            }
        });
    }
    
    /**
     * Ottiene il nome visualizzato di una lingua
     */
    function getLanguageDisplayName(code) {
        const names = {
            'it': 'Italiano',
            'en': 'English',
            'es': 'Español',
            'de': 'Deutsch',
            'fr': 'Français'
        };
        return names[code] || code;
    }
    
    /**
     * Cambia la lingua corrente e aggiorna l'interfaccia
     * @param {string} lang - Il codice della lingua
     */
    function changeLanguage(lang) {
        if (!supportedLanguages.includes(lang) || lang === currentLang) {
            return; // Lingua non supportata o già attiva
        }
        
        // Salva la nuova lingua
        currentLang = lang;
        localStorage.setItem('preferredLanguage', lang);
        
        console.log(`Lingua cambiata a: ${lang}`);
        
        // Aggiorna l'attributo lang dell'HTML
        document.documentElement.setAttribute('lang', lang);
        
        // Aggiorna l'interfaccia
        setLanguageInUI();
        
        // Evidenzia la lingua corrente nei selettori
        highlightCurrentLanguage();
        
        // Emetti un evento per informare altri componenti del cambio di lingua
        document.dispatchEvent(new CustomEvent('languageChanged', {
            detail: { language: lang }
        }));
        
        // Annuncio accessibile per screen reader
        announceLangChange(lang);
    }
    
    /**
     * Crea un annuncio accessibile per screen reader quando cambia la lingua
     * @param {string} lang - Il codice della lingua corrente
     */
    function announceLangChange(lang) {
        // Crea un elemento per annunciare il cambio di lingua agli screen reader
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'assertive');
        announcement.setAttribute('role', 'status');
        announcement.classList.add('sr-only'); // Nascosto visivamente ma accessibile agli screen reader
        announcement.textContent = `Lingua cambiata in ${getLanguageDisplayName(lang)}`;
        
        // Aggiungi l'elemento al DOM
        document.body.appendChild(announcement);
        
        // Rimuovi l'elemento dopo che è stato annunciato (circa 3 secondi)
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 3000);
    }
    
    /**
     * Imposta la lingua nell'interfaccia utente
     */
    function setLanguageInUI() {
        if (!tourData || !tourData.tour || !tourData.tour.content[currentLang]) {
            console.error(`Dati della lingua ${currentLang} non disponibili`);
            return;
        }
        
        // Aggiorna gli elementi UI hardcoded
        updateUIText();
        
        // Se la pagina è stata già inizializzata, ricarica i contenuti
        if (document.querySelector('.timeline-stops')) {
            // Questo evento verrà gestito da main.js per ricaricare i contenuti
            document.dispatchEvent(new CustomEvent('reloadContent', {
                detail: { language: currentLang }
            }));
        }
    }
    
    /**
     * Aggiorna i testi dell'interfaccia con le traduzioni
     */
    function updateUIText() {
        const translations = uiTranslations[currentLang];
        if (!translations) return;
        
        // Pulsanti "Inizia il tour"
        document.querySelectorAll('.tour-button').forEach(button => {
            const icon = button.querySelector('i');
            button.innerHTML = '';
            if (icon) button.appendChild(icon);
            button.innerHTML += ` ${translations.tourButton}`;
        });
        
        // Link di navigazione
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href === '#tour-timeline') {
                link.textContent = translations.locations;
            } else if (href === '#') {
                link.textContent = translations.history;
            } else if (href === 'mappa.html') {
                link.textContent = translations.map;
            }
        });
        
        // Scopri le tappe
        const findOutStops = document.querySelector('[aria-label="Scorri verso le tappe del tour"]');
        if (findOutStops) {
            const span = findOutStops.querySelector('span');
            if (span) span.textContent = translations.findOutStops;
            findOutStops.setAttribute('aria-label', translations.scrollToStops);
        }
        
        // Link scopri tutte le tappe
        const discoverAllStops = document.querySelector('[href="#tour-timeline"].group');
        if (discoverAllStops) {
            const span = discoverAllStops.querySelector('span') || discoverAllStops;
            span.textContent = translations.discoverStops;
        }
        
        // Skip link accessibilità
        const skipLink = document.querySelector('.skip-to-content');
        if (skipLink) skipLink.textContent = translations.skipToContent;
        
        // Footer
        const footer = document.querySelector('#copyright-text');
        if (footer) {
            // Aggiorna ogni elemento con attributo data-i18n-key
            footer.querySelectorAll('[data-i18n-key]').forEach(element => {
                const key = element.getAttribute('data-i18n-key');
                if (translations[key]) {
                    // Se è un elemento di ancoraggio (link), preserva gli attributi href, target, ecc.
                    if (element.tagName === 'A') {
                        element.textContent = translations[key];
                    } else {
                        element.textContent = translations[key];
                    }
                }
            });
            
            // Assicurati che "Regalbuto Inside" non venga tradotto
            const noTranslate = footer.querySelector('.no-translate');
            if (noTranslate) {
                noTranslate.textContent = 'Regalbuto Inside';
            }
        }
    }
    
    /**
     * Ottiene la lingua corrente
     */
    function getCurrentLanguage() {
        return currentLang;
    }
    
    /**
     * Traduce un testo specifico dell'UI
     */
    function getUITranslation(key) {
        const translations = uiTranslations[currentLang];
        return translations && translations[key] ? translations[key] : key;
    }
    
    // API pubblica
    return {
        initialize,
        changeLanguage,
        getCurrentLanguage,
        getUITranslation,
        supportedLanguages
    };
})();

// Esposizione globale per l'uso in altri file
window.LanguageManager = LanguageManager;