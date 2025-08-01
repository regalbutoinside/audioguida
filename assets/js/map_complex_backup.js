/**
 * Gestione della mappa interattiva dell'audioguida di Regalbuto
 */
const AudioGuideMap = (function() {
    // Oggetti principali
    let map = null;
    let markers = {};
    
    // Configurazione
    const config = {
        defaultView: [37.652207, 14.640707], // Coordinate centrali di Regalbuto
        defaultZoom: 15,
        markerColors: {
            default: '#6b46c1', // Colore primario
            active: '#10b981',  // Colore accent
            highlight: '#3b82f6' // Colore secondario
        }
    };
    
    // Dati delle tappe
    let tourStops = [];
    
    /**
     * Inizializza la mappa con i dati delle tappe
     * @param {string} containerId - ID del container della mappa
     * @param {boolean} isFullPage - Indica se è la versione pagina intera della mappa
     */
    function initMap(containerId, isFullPage = false) {
        console.log('Inizializzazione mappa...', containerId);
        
        // Verifica se il container della mappa esiste
        const mapContainer = document.getElementById(containerId);
        if (!mapContainer) {
            console.error('Container della mappa non trovato:', containerId);
            return;
        }
        
        // Aggiungi la classe specifica se è la pagina dedicata
        if (isFullPage) {
            mapContainer.classList.add('map-page-container');
        }
        
        // Inizializzazione della mappa Leaflet con stile migliorato
        map = L.map(containerId, {
            zoomControl: false,
            attributionControl: false
        }).setView(config.defaultView, config.defaultZoom);
        
        // Aggiunta del layer di mappa base (migliorato visivamente)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        }).addTo(map);
        
        // Aggiunta controllo zoom in un'altra posizione
        L.control.zoom({
            position: 'bottomright'
        }).addTo(map);
        
        console.log('Mappa inizializzata, caricamento dati...');
        
        // Carica i dati delle tappe dal JSON
        loadTourStops().then(() => {
            console.log('Dati caricati, creazione markers...');
            
            // Crea i marker sulla mappa
            createMarkers();
            
            // Inizializza i controlli della mappa
            initMapControls(containerId, isFullPage);
            
            // Inizializza gli eventi specifici della pagina
            if (isFullPage) {
                initFullPageEvents();
            }
            
            // Imposta la vista iniziale
            resetMapView();
            
            // Registra gli ascoltatori di eventi personalizzati
            document.addEventListener('highlightMarker', function(event) {
                const { stopId, animated } = event.detail;
                highlightMarker(stopId, animated);
            });
            
            document.addEventListener('resetMapView', function() {
                resetMapView();
            });
            
            console.log('Mappa completamente inizializzata');
        });
    }
    
    /**
     * Carica i dati delle tappe dal JSON
     */
    async function loadTourStops() {
        try {
            console.log('Caricamento dati dal JSON...');
            const response = await fetch('assets/data/audioguide.json');
            if (!response.ok) {
                throw new Error(`Errore HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('JSON caricato con successo');
            
            // Uso diretto dei dati dal file JSON
            const stops = data.tour.staticData.stops;
            
            if (stops && stops.length > 0) {
                // Recupera i titoli delle tappe e le descrizioni in italiano
                const titlesIT = data.tour.content.it.stops.map(stop => stop.title);
                const descriptionsIT = data.tour.content.it.stops.map(stop => stop.description);
                const durationsIT = data.tour.content.it.stops.map(stop => stop.duration);
                
                // Costruisci l'array delle tappe usando le coordinate dal JSON
                tourStops = stops.map((stop, index) => {
                    return {
                        id: stop.id,
                        title: titlesIT[index] || `Tappa ${index + 1}`,
                        description: descriptionsIT[index] || '',
                        coordinates: [stop.coordinates.latitude, stop.coordinates.longitude],
                        icon: stop.icon || 'fa-map-marker-alt',
                        order: stop.order || index + 1,
                        url: stop.googleMapsUrl || '#',
                        imagePath: stop.imagePath || '',
                        duration: durationsIT[index] || ''
                    };
                });
                console.log('Tappe caricate con successo:', tourStops);
            } else {
                console.warn('Nessuna tappa trovata nel JSON');
                // Usa dati di fallback solo se necessario
                tourStops = getDefaultTourStops();
            }
        } catch (error) {
            console.error('Errore durante il caricamento del JSON:', error);
            // Usa dati di fallback
            tourStops = getDefaultTourStops();
        }
    }
    
    /**
     * Fornisce dati di fallback nel caso il JSON non sia disponibile
     */
    function getDefaultTourStops() {
        return [
            { id: "piazza", title: "Piazza della Repubblica", coordinates: [37.652467, 14.6408218], icon: "fa-map-marker-alt", order: 1 },
            { id: "comune", title: "Palazzo Comunale", coordinates: [37.6523334, 14.6407522], icon: "fa-landmark", order: 2 },
            { id: "chiesa_madre", title: "Chiesa Madre di San Basilio", coordinates: [37.6526445, 14.6408936], icon: "fa-church", order: 3 },
            { id: "lombardi", title: "Monumento R. Lombardi", coordinates: [37.652006, 14.6411328], icon: "fa-monument", order: 4 },
            { id: "campione", title: "Monumento G. Campione", coordinates: [37.6521778, 14.6406708], icon: "fa-monument", order: 5 },
            { id: "corso", title: "Corso G.F. Ingrassia", coordinates: [37.652076, 14.6408725], icon: "fa-road", order: 6 },
            { id: "santa_maria", title: "Chiesa Santa Maria La Croce", coordinates: [37.6498226, 14.6406302], icon: "fa-place-of-worship", order: 7 },
            { id: "piano", title: "Piazza Vittorio Veneto", coordinates: [37.6497021, 14.6408261], icon: "fa-square", order: 8 },
            { id: "villa", title: "Villa Comunale", coordinates: [37.6498436, 14.642395], icon: "fa-tree", order: 9 },
            { id: "lago", title: "Lago Pozzillo", coordinates: [37.6583729, 14.6191883], icon: "fa-water", order: 10 }
        ];
    }
    
    /**
     * Crea i marker sulla mappa con stile migliorato
     */
    function createMarkers() {
        // Cancella i marker esistenti
        if (Object.keys(markers).length > 0) {
            Object.values(markers).forEach(marker => {
                map.removeLayer(marker);
            });
            markers = {};
        }
        
        if (tourStops.length === 0) {
            console.error('Nessuna tappa disponibile per creare i marker.');
            return;
        }
        
        console.log('Creazione markers per', tourStops.length, 'tappe');
        
        // Crea e aggiungi i marker alla mappa con design migliorato e accessibilità
        tourStops.forEach(stop => {
            try {
                // Verifica che le coordinate siano valide
                if (!stop.coordinates || stop.coordinates.length !== 2 || 
                    isNaN(stop.coordinates[0]) || isNaN(stop.coordinates[1])) {
                    console.error('Coordinate non valide per la tappa:', stop);
                    return;
                }
                
                console.log(`Creazione marker per ${stop.id} alle coordinate [${stop.coordinates}]`);
                
                const marker = L.marker(stop.coordinates, {
                    icon: createCustomIcon(stop.icon),
                    alt: stop.title,
                    stopId: stop.id
                }).addTo(map);
                
                // Crea il popup con informazioni sulla tappa (design migliorato con Tailwind e accessibilità)
                const popupContent = `
                    <div class="text-center p-1">
                        <h4 class="text-primary font-semibold mb-1">${stop.title}</h4>
                        <p class="text-xs text-gray-500 mb-2">Tappa ${stop.order}</p>
                        <div class="flex justify-center gap-2">
                            <a href="index.html#${stop.id}" class="px-3 py-1.5 bg-primary text-white text-xs rounded-full hover:bg-primary-dark transition-colors shadow-sm flex items-center" aria-label="Ascolta la guida audio per ${stop.title}">
                                <i class="fas fa-headphones mr-1.5" aria-hidden="true"></i>
                                Audio
                            </a>
                            <a href="${stop.url}" target="_blank" class="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-full hover:bg-gray-200 transition-colors flex items-center" aria-label="Visualizza ${stop.title} su Google Maps">
                                <i class="fas fa-map-marked-alt mr-1.5" aria-hidden="true"></i>
                                Google Maps
                            </a>
                        </div>
                    </div>
                `;
                
                marker.bindPopup(popupContent);
                markers[stop.id] = marker;
                
                // Aggiungi gestione accessibilità dopo che il marker è aggiunto alla mappa
                setTimeout(() => {
                    const markerElement = marker.getElement();
                    if (markerElement) {
                        // Aggiungi attributi aria per accessibilità
                        markerElement.setAttribute('role', 'button');
                        markerElement.setAttribute('aria-label', `${stop.title}, Tappa ${stop.order}`);
                        markerElement.setAttribute('tabindex', '0');
                        
                        // Aggiungi gestione eventi da tastiera
                        markerElement.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                marker.openPopup();
                                highlightMarker(stop.id);
                            }
                        });
                    }
                }, 100);
            } catch (error) {
                console.error('Errore durante la creazione del marker:', error, stop);
            }
        });
        
        console.log('Markers creati:', Object.keys(markers).length);
    }
    
    /**
     * Crea un'icona personalizzata per il marker con design migliorato
     * @param {string} icon - Nome dell'icona Font Awesome
     * @param {string} color - Colore del marker (opzionale)
     * @returns {L.divIcon} Icona personalizzata per Leaflet
     */
    function createCustomIcon(icon, color = config.markerColors.default) {
        return L.divIcon({
            html: `
                <div class="flex items-center justify-center">
                    <div class="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-lg border-2 transform hover:scale-110 transition-transform" style="border-color: ${color};">
                        <i class="fas ${icon}" style="color: ${color};"></i>
                    </div>
                </div>
            `,
            className: 'custom-marker-icon',
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32]
        });
    }
    
    /**
     * Inizializza i controlli della mappa
     * @param {string} containerId - ID del container della mappa
     * @param {boolean} isFullPage - Indica se è la versione pagina intera della mappa
     */
    function initMapControls(containerId, isFullPage) {
        // Pulsante di reset
        const resetBtn = document.getElementById('map-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', resetMapView);
            console.log('Evento reset registrato');
        } else {
            console.warn('Pulsante reset non trovato');
        }
        
        // Pulsante di espansione (solo nella versione non fullpage)
        const expandBtn = document.getElementById('map-expand');
        if (expandBtn && !isFullPage) {
            expandBtn.addEventListener('click', toggleMapSize);
        }
        
        // Pulsante di localizzazione
        const locateBtn = document.getElementById('map-locate-me');
        if (locateBtn) {
            locateBtn.addEventListener('click', locateUser);
            console.log('Evento localizzazione registrato');
        } else {
            console.warn('Pulsante localizzazione non trovato');
        }
        
        // Pulsante modalità schermo intero
        const fullscreenBtn = document.getElementById('map-toggle-fullscreen');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', toggleFullscreen);
            console.log('Evento fullscreen registrato');
        } else {
            console.warn('Pulsante fullscreen non trovato con ID map-toggle-fullscreen');
        }
        
        // Pulsante "mostra tutto"
        const viewAllBtn = document.getElementById('map-view-all');
        if (viewAllBtn) {
            viewAllBtn.addEventListener('click', resetMapView);
            console.log('Evento view-all registrato');
        }
    }
    
    /**
     * Inizializza gli eventi specifici per la pagina dedicata alla mappa
     */
    function initFullPageEvents() {
        // Adattato al nuovo design: ora usiamo .stop-item invece di .map-sidebar-item
        document.querySelectorAll('.stop-item').forEach(item => {
            item.addEventListener('click', function() {
                const stopId = this.getAttribute('data-stop-id');
                highlightMarker(stopId);
                
                // Aggiunge classe attiva all'elemento cliccato
                document.querySelectorAll('.stop-item').forEach(el => {
                    el.classList.remove('active');
                });
                this.classList.add('active');
                
                // Aggiorna anche i dettagli della tappa
                updateStopDetails(stopId);
            });
            
            console.log('Evento click registrato per tappa:', item.getAttribute('data-stop-id'));
        });
        
        // Gestione dettagli tappa
        const highlightButton = document.getElementById('stop-highlight');
        if (highlightButton) {
            highlightButton.addEventListener('click', function() {
                const stopId = this.getAttribute('data-stop-id');
                if (stopId) {
                    highlightMarker(stopId, true);
                }
            });
        }
    }
    
    /**
     * Aggiorna i dettagli della tappa selezionata
     * @param {string} stopId - ID della tappa
     */
    function updateStopDetails(stopId) {
        const stopDetails = document.getElementById('stop-details');
        if (!stopDetails) return;
        
        const stopData = tourStops.find(stop => stop.id === stopId);
        if (!stopData) return;
        
        // Mostra il pannello dettagli
        stopDetails.classList.remove('hidden');
        
        // Aggiorna tutti i campi
        const numberElement = document.getElementById('stop-number');
        const titleElement = document.getElementById('stop-title');
        const descriptionElement = document.getElementById('stop-description');
        const durationElement = document.getElementById('stop-duration');
        const mapsLinkElement = document.getElementById('stop-maps-link');
        const audioLinkElement = document.getElementById('stop-audio-link');
        const highlightButton = document.getElementById('stop-highlight');
        
        if (numberElement) numberElement.textContent = stopData.order;
        if (titleElement) titleElement.textContent = stopData.title;
        if (descriptionElement) descriptionElement.textContent = stopData.description || 'Nessuna descrizione disponibile.';
        if (durationElement) durationElement.textContent = stopData.duration || '--:--';
        if (mapsLinkElement) mapsLinkElement.href = stopData.url || '#';
        if (audioLinkElement) audioLinkElement.href = `index.html#${stopId}`;
        if (highlightButton) highlightButton.setAttribute('data-stop-id', stopId);
    }
    
    /**
     * Evidenzia un marker sulla mappa
     * @param {string} stopId - ID della tappa da evidenziare
     * @param {boolean} animated - Se l'animazione dovrebbe essere più pronunciata
     */
    function highlightMarker(stopId, animated = false) {
        console.log('Evidenziazione marker:', stopId, 'con animazione:', animated);
        
        if (!map || Object.keys(markers).length === 0) {
            console.warn('Mappa o markers non inizializzati');
            return;
        }
        
        // Ripristina tutti i marker allo stato normale
        Object.values(markers).forEach(marker => {
            const id = marker.options.stopId;
            const stopData = tourStops.find(stop => stop.id === id);
            if (stopData) {
                marker.setIcon(createCustomIcon(stopData.icon));
            }
        });
        
        // Evidenzia il marker selezionato
        if (stopId && markers[stopId]) {
            const stopData = tourStops.find(stop => stop.id === stopId);
            if (stopData) {
                markers[stopId].setIcon(createCustomIcon(stopData.icon, config.markerColors.highlight));
                markers[stopId].openPopup();
                
                // Aggiunge classe per lo z-index elevato
                const markerElement = markers[stopId].getElement();
                if (markerElement) {
                    markerElement.classList.add('map-marker-selected');
                    
                    // Aggiungi animazione se richiesto
                    if (animated) {
                        markerElement.classList.add('marker-bounce');
                        setTimeout(() => {
                            markerElement.classList.remove('marker-bounce');
                        }, 700);
                    }
                }
                
                // Centra la mappa sul marker selezionato con animazione fluida
                map.flyTo(markers[stopId].getLatLng(), 17, {
                    animate: true,
                    duration: 1.5
                });
                
                // Aggiorna anche i dettagli nella sidebar se necessario
                updateStopDetails(stopId);
                
                // Evidenzia anche l'elemento nella sidebar
                const sidebarItem = document.querySelector(`.stop-item[data-stop-id="${stopId}"]`);
                if (sidebarItem) {
                    document.querySelectorAll('.stop-item').forEach(el => {
                        el.classList.remove('active');
                    });
                    sidebarItem.classList.add('active');
                }
            }
        }
    }
    
    /**
     * Reimposta la vista della mappa per mostrare tutti i marker
     */
    function resetMapView() {
        console.log('Reset vista mappa');
        
        if (!map || Object.keys(markers).length === 0) {
            console.warn('Mappa o markers non inizializzati');
            return;
        }
        
        Object.values(markers).forEach(marker => {
            marker.setIcon(createCustomIcon(tourStops.find(stop => stop.id === marker.options.stopId).icon));
            marker.closePopup();
            
            const markerElement = marker.getElement();
            if (markerElement) {
                markerElement.classList.remove('map-marker-selected', 'marker-bounce');
            }
        });
        
        // Adatta la vista per mostrare tutti i marker con animazione
        const coordinates = tourStops.map(stop => stop.coordinates);
        if (coordinates.length > 0) {
            try {
                const bounds = L.latLngBounds(coordinates);
                map.flyToBounds(bounds, {
                    padding: [50, 50],
                    maxZoom: 16,
                    animate: true,
                    duration: 1.5
                });
            } catch (error) {
                console.error('Errore durante il reset della vista:', error);
                // Fallback alla vista di default
                map.flyTo(config.defaultView, config.defaultZoom, {
                    animate: true,
                    duration: 1.5
                });
            }
        }
    }
    
    /**
     * Espande o riduce la dimensione della mappa
     */
    function toggleMapSize() {
        const mapContainer = document.getElementById('tour-map-container');
        if (!mapContainer) return;
        
        const isExpanded = mapContainer.classList.toggle('expanded');
        const expandText = document.getElementById('map-expand-text');
        if (expandText) {
            expandText.textContent = isExpanded ? 'Riduci' : 'Espandi';
        }
        
        // Attendere che la transizione CSS sia completa prima di aggiornare la mappa
        setTimeout(() => {
            map.invalidateSize();
            resetMapView();
        }, 300);
    }
    
    /**
     * Localizza l'utente sulla mappa
     */
    function locateUser() {
        console.log('Localizzazione utente richiesta');
        const locateBtn = document.getElementById('map-locate-me');
        
        // Verifica se il browser supporta la geolocalizzazione
        if ("geolocation" in navigator) {
            // Attiva l'indicatore di caricamento
            if (locateBtn) locateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            
            navigator.geolocation.getCurrentPosition(position => {
                // Centra la mappa sulla posizione dell'utente
                const userLatLng = [position.coords.latitude, position.coords.longitude];
                map.flyTo(userLatLng, 15, {
                    animate: true,
                    duration: 1.5
                });
                
                // Aggiungi un marker per la posizione dell'utente con design migliorato
                const userIcon = L.divIcon({
                    html: `
                        <div class="w-8 h-8 rounded-full bg-blue-500/90 flex items-center justify-center shadow-lg">
                            <div class="w-3 h-3 bg-white rounded-full"></div>
                            <div class="absolute w-8 h-8 bg-blue-500/30 rounded-full animate-ping"></div>
                        </div>
                    `,
                    className: 'user-location-icon',
                    iconSize: [32, 32],
                    iconAnchor: [16, 16]
                });
                
                // Rimuovi marker precedenti se esistono
                if (window.userLocationMarker) {
                    map.removeLayer(window.userLocationMarker);
                }
                
                // Aggiungi nuovo marker
                window.userLocationMarker = L.marker(userLatLng, { icon: userIcon })
                    .addTo(map)
                    .bindPopup('<div class="text-center"><strong>La tua posizione</strong></div>')
                    .openPopup();
                
                // Ripristina l'icona del pulsante
                if (locateBtn) locateBtn.innerHTML = '<i class="fas fa-location-crosshairs"></i>';
            }, error => {
                console.error('Errore durante la geolocalizzazione:', error);
                alert('Non è stato possibile ottenere la tua posizione. Verifica di aver concesso i permessi di geolocalizzazione.');
                if (locateBtn) locateBtn.innerHTML = '<i class="fas fa-location-crosshairs"></i>';
            });
        } else {
            alert('Il tuo browser non supporta la geolocalizzazione.');
        }
    }
    
    /**
     * Attiva/disattiva la modalità a schermo intero
     */
    function toggleFullscreen() {
        const mapContainer = document.querySelector('.map-layout');
        if (!mapContainer) {
            console.warn('Container mappa non trovato per toggle fullscreen');
            return;
        }
        
        const fullscreenBtn = document.getElementById('map-toggle-fullscreen');
        
        mapContainer.classList.toggle('map-fullscreen');
        
        // Aggiorna l'icona e il testo
        const isFullscreen = mapContainer.classList.contains('map-fullscreen');
        if (fullscreenBtn) {
            fullscreenBtn.innerHTML = isFullscreen ? 
                '<i class="fas fa-compress text-xs mr-1.5"></i> Esci' : 
                '<i class="fas fa-expand text-xs mr-1.5"></i> Schermo intero';
        }
        
        // Aggiorna la mappa dopo il cambio di dimensioni
        setTimeout(() => {
            if (map) {
                map.invalidateSize();
                resetMapView();
            }
        }, 100);
    }
    
    // Espone le funzioni pubbliche
    return {
        init: initMap,
        highlightMarker: highlightMarker,
        resetView: resetMapView
    };
})();

// Inizializza la mappa quando il documento è pronto, se siamo nella pagina della mappa
document.addEventListener('DOMContentLoaded', function() {
    // Verifica se siamo nella pagina della mappa dedicata
    const isMapPage = document.querySelector('.map-layout') !== null;
    
    if (isMapPage) {
        console.log('Pagina mappa rilevata, inizializzazione mappa...');
        
        // Inizializza la mappa a tutta pagina
        AudioGuideMap.init('tour-map-container', true);
        
        // Controlla se c'è un parametro 'stop' nell'URL e evidenzia quel marker
        const urlParams = new URLSearchParams(window.location.search);
        const stopId = urlParams.get('stop');
        
        if (stopId) {
            console.log('Parametro stop rilevato:', stopId);
            
            // Aspetta un momento per permettere alla mappa di caricarsi completamente
            setTimeout(() => {
                AudioGuideMap.highlightMarker(stopId);
                
                // Evidenzia anche l'elemento nella sidebar
                const sidebarItem = document.querySelector(`.stop-item[data-stop-id="${stopId}"]`);
                if (sidebarItem) {
                    // Rimuovi la classe attiva da tutti gli elementi
                    document.querySelectorAll('.stop-item').forEach(item => {
                        item.classList.remove('active');
                    });
                    
                    // Aggiungi classe attiva a questo elemento
                    sidebarItem.classList.add('active');
                    
                    // Scorri fino all'elemento
                    sidebarItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 1000);
        } else {
            console.log('Nessun parametro stop nell\'URL');
        }
    } else {
        console.log('Non siamo nella pagina della mappa');
    }
});