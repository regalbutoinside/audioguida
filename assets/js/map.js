/**
 * Map Manager - Interactive map for Regalbuto audioguide stops
 * Uses Leaflet with OpenStreetMap and CartoDB tiles
 */

class MapManager {
    constructor() {
        this.map = null;
        this.markers = [];
        this.audioguideData = null;
        this.currentLanguage = 'it';
        
        // Regalbuto center coordinates
        this.centerCoords = [37.651872, 14.640747];
        this.defaultZoom = 16;
        
        this.init();
    }

    async init() {
        try {
            // Load audioguide data
            await this.loadAudioguideData();
            
            // Initialize map
            this.initializeMap();
            
            // Add markers
            this.addMarkers();
            
            // Hide loading indicator
            this.hideLoading();
            
        } catch (error) {
            console.error('Error initializing map:', error);
            this.showError();
        }
    }

    async loadAudioguideData() {
        try {
            const response = await fetch('assets/data/audioguide.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.audioguideData = await response.json();
            console.log('Audioguide data loaded successfully:', this.audioguideData);
        } catch (error) {
            console.error('Error loading audioguide data:', error);
            throw error;
        }
    }

    initializeMap() {
        try {
            // Check if Leaflet is available
            if (typeof L === 'undefined') {
                throw new Error('Leaflet library not loaded');
            }

            // Initialize Leaflet map
            this.map = L.map('map', {
                center: this.centerCoords,
                zoom: this.defaultZoom,
                zoomControl: true,
                scrollWheelZoom: true,
                doubleClickZoom: true,
                touchZoom: true,
                boxZoom: true,
                keyboard: true,
                attributionControl: true,
                preferCanvas: false
            });

            // Add CartoDB Positron tile layer
            const tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd',
                maxZoom: 20,
                minZoom: 10,
                errorTileUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgZmlsbD0iI2Y4ZmFmYyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNHB4IiBmaWxsPSIjNjc3Mjg5Ij5NYXBwYSBub24gZGlzcG9uaWJpbGU8L3RleHQ+PC9zdmc+'
            });

            // Handle tile layer errors
            tileLayer.on('tileerror', (error) => {
                console.warn('Tile loading error:', error);
            });

            tileLayer.addTo(this.map);

            // Add scale control
            L.control.scale({
                position: 'bottomleft',
                metric: true,
                imperial: false
            }).addTo(this.map);

            // Add event listeners
            this.map.on('zoomend', () => {
                // Event listener for future features
                console.log('Zoom level:', this.map.getZoom());
            });

            console.log('Map initialized successfully');

        } catch (error) {
            console.error('Error initializing map:', error);
            this.showMapError();
            throw error;
        }
    }

    showMapError() {
        const loadingElement = document.getElementById('map-loading');
        if (loadingElement) {
            loadingElement.innerHTML = `
                <div class="loading-spinner">
                    <i class="fas fa-exclamation-triangle text-red-500 text-3xl"></i>
                </div>
                <p class="text-gray-600 mt-3">Errore nel caricamento della mappa</p>
                <p class="text-sm text-gray-500 mt-2">Verifica la connessione internet e riprova</p>
                <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors">
                    Riprova
                </button>
            `;
        }
    }

    addMarkers() {
        if (!this.audioguideData?.tour?.staticData?.stops) {
            console.error('No stops data available');
            console.log('Available data structure:', this.audioguideData);
            return;
        }

        const stops = this.audioguideData.tour.staticData.stops;
        console.log(`Adding ${stops.length} markers to map:`, stops);
        
        // Clear existing markers
        this.clearMarkers();
        
        stops.forEach((stop, index) => {
            if (stop.coordinates && stop.coordinates.latitude && stop.coordinates.longitude) {
                const marker = this.createCustomMarker(stop, index);
                this.markers.push({
                    marker: marker,
                    stopId: stop.id,
                    stop: stop
                });
            } else {
                console.warn(`Stop ${stop.id} missing coordinates:`, stop);
            }
        });
        
        // Fit map to show all markers after a short delay
        setTimeout(() => {
            if (this.markers.length > 0) {
                this.fitToMarkers();
            }
        }, 1000);
    }

    clearMarkers() {
        this.markers.forEach(markerData => {
            if (markerData.marker) {
                this.map.removeLayer(markerData.marker);
            }
        });
        this.markers = [];
    }

    createCustomMarker(stop, index = 0) {
        const { latitude, longitude } = stop.coordinates;
        
        // Create numbered custom marker
        const customIcon = this.createNumberedIcon(stop.order, index);
        const marker = L.marker([latitude, longitude], {
            icon: customIcon,
            title: `Tappa ${stop.order}: ${stop.id}`,
            alt: `Tappa ${stop.order}`,
            riseOnHover: true
        });

        // Create popup content
        const popupContent = this.createPopupContent(stop);
        marker.bindPopup(popupContent, {
            maxWidth: 300,
            className: 'custom-popup',
            offset: [0, -10]
        });

        // Add click event for highlighting
        marker.on('click', () => {
            this.highlightMarker(stop.id);
        });

        // Add to map
        marker.addTo(this.map);

        return marker;
    }

    createNumberedIcon(number, animationDelay = 0) {
        // Create a DivIcon with numbered circle (no triangle)
        return L.divIcon({
            className: 'custom-marker',
            html: `
                <div class="marker-container">
                    <div class="marker-circle">
                        <span class="marker-number">${number}</span>
                    </div>
                </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -20]
        });
    }

    createPopupContent(stop) {
        const languages = this.audioguideData?.tour?.languages || ['it'];
        const currentLangData = this.audioguideData?.tour?.content?.[this.currentLanguage]?.stops?.find(s => s.id === stop.id);
        
        const title = currentLangData?.title || stop.title || stop.id;
        const description = currentLangData?.description || stop.description || '';
        const duration = currentLangData?.duration || stop.duration || '';
        
        return `
            <div class="popup-content">
                <div class="popup-header">
                    <span class="popup-number">${stop.order}</span>
                    <h3 class="popup-title">${title}</h3>
                </div>
                ${duration ? `<div class="popup-duration">⏱️ ${duration}</div>` : ''}
                <p class="popup-description">${description}</p>
                <div class="popup-actions">
                    <button class="popup-btn primary" onclick="mapManager.startAudio('${stop.id}')">
                        🎵 Ascolta
                    </button>
                    <button class="popup-btn secondary" onclick="mapManager.viewDetails('${stop.id}')">
                        ℹ️ Dettagli
                    </button>
                </div>
            </div>
        `;
    }

    highlightStop(stopId) {
        this.highlightMarker(stopId);
    }

    highlightMarker(stopId) {
        // Remove highlight from all markers first
        this.markers.forEach(markerData => {
            const markerElement = markerData.marker.getElement();
            if (markerElement) {
                markerElement.classList.remove('highlighted');
            }
        });

        // Find and highlight the specific marker
        const markerData = this.markers.find(m => m.stopId === stopId);
        
        if (markerData) {
            const { marker, stop } = markerData;
            
            // Add highlight class
            const markerElement = marker.getElement();
            if (markerElement) {
                markerElement.classList.add('highlighted');
            }
            
            // Center map on marker with smooth animation
            this.map.flyTo(
                [stop.coordinates.latitude, stop.coordinates.longitude], 
                this.defaultZoom + 1,
                {
                    duration: 1.5,
                    easeLinearity: 0.25
                }
            );
            
            // Open popup
            marker.openPopup();
            
            // Remove highlight after 3 seconds
            setTimeout(() => {
                if (markerElement) {
                    markerElement.classList.remove('highlighted');
                }
            }, 3000);
        }
    }

    hideLoading() {
        const loadingElement = document.getElementById('map-loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }

    showError() {
        const loadingElement = document.getElementById('map-loading');
        if (loadingElement) {
            loadingElement.innerHTML = `
                <div class="loading-spinner">
                    <i class="fas fa-exclamation-triangle text-red-500 text-3xl"></i>
                </div>
                <p class="text-gray-600 mt-3">Errore nel caricamento della mappa</p>
                <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors">
                    Riprova
                </button>
            `;
        }
    }

    // Method to update language
    updateLanguage(newLanguage) {
        this.currentLanguage = newLanguage;
        // Language update logic can be added later if needed
    }

    // Method to fit map to all markers
    fitToMarkers() {
        if (this.markers.length === 0) return;
        
        try {
            const group = new L.featureGroup(this.markers.map(m => m.marker));
            const bounds = group.getBounds();
            
            // Add padding and fit bounds
            this.map.fitBounds(bounds.pad(0.1), {
                maxZoom: 17,
                animate: true,
                duration: 1
            });
        } catch (error) {
            console.error('Error fitting bounds:', error);
            // Fallback: center on Regalbuto
            this.map.setView(this.centerCoords, this.defaultZoom);
        }
    }

    // Method to get marker by stop ID
    getMarkerByStopId(stopId) {
        return this.markers.find(m => m.stopId === stopId);
    }

    // Handle audio playback
    startAudio(stopId) {
        const markerData = this.markers.find(m => m.stopId === stopId);
        if (!markerData) return;

        // Try to find and trigger audio player
        const audioPlayer = document.querySelector('audio');
        if (audioPlayer && window.amplitude) {
            // Find the song index in amplitude playlist
            const playlist = window.amplitude.getConfig().songs;
            const songIndex = playlist.findIndex(song => song.name.includes(stopId));
            
            if (songIndex !== -1) {
                window.amplitude.playSongAtIndex(songIndex);
            }
        }
        
        // Emit custom event for audio components
        document.dispatchEvent(new CustomEvent('playAudioStop', {
            detail: { stopId: stopId }
        }));
    }

    // Handle view details
    viewDetails(stopId) {
        // Navigate to details or trigger details view
        const event = new CustomEvent('viewStopDetails', {
            detail: { stopId: stopId }
        });
        document.dispatchEvent(event);
    }
}

// Initialize map when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on the map page
    if (document.getElementById('map')) {
        window.mapManager = new MapManager();
        
        // Listen for language changes
        document.addEventListener('languageChanged', function(event) {
            if (window.mapManager) {
                window.mapManager.updateLanguage(event.detail.language);
            }
        });
    }
});

// Export for potential external use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MapManager;
}