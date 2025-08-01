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
                console.log('Zoom level:', this.map.getZoom());
            });

            this.map.on('popupclose', () => {
                this.clearAllHighlights();
                // Remove auto-centering behavior that can cause jarring movements
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
        
        // Fit map to show all markers after a short delay (only on initial load)
        setTimeout(() => {
            if (this.markers.length > 0) {
                this.fitToMarkersInitial();
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
            maxWidth: 280,
            minWidth: 250,
            className: 'improved-popup',
            closeButton: true,
            autoPan: false, // Disable automatic panning, we'll handle it manually
            autoPanPadding: [50, 50],
            keepInView: true
            // No offset - rely on popupAnchor positioning
        });

        // Add enhanced click behavior
        marker.on('click', (e) => {
            this.handleMarkerClick(marker, stop, e);
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
            iconAnchor: [16, 16], // Center the marker on the point
            popupAnchor: [0, -120] // Position popup tip well above the marker (increased)
        });
    }

    createPopupContent(stop) {
        const languages = this.audioguideData?.tour?.languages || ['it'];
        const currentLangData = this.audioguideData?.tour?.content?.[this.currentLanguage]?.stops?.find(s => s.id === stop.id);
        
        const title = currentLangData?.title || stop.title || stop.id;
        const description = currentLangData?.description || stop.description || '';
        
        // Truncate description for preview (first 80 characters)
        const shortDescription = description.length > 80 ? description.substring(0, 80) + '...' : description;
        const hasLongDescription = description.length > 80;
        
        return `
            <div class="popup-content-wrapper">
                <div class="popup-header">
                    <div class="popup-number-badge">${stop.order}</div>
                    <div class="popup-title-section">
                        <h3 class="popup-title">${title}</h3>
                    </div>
                </div>
                <div class="popup-body">
                    <div class="popup-description-container">
                        <p class="popup-description-short">${shortDescription}</p>
                        ${hasLongDescription ? `
                            <p class="popup-description-full" style="display: none;">${description}</p>
                            <button class="popup-expand-btn" onclick="this.parentElement.querySelector('.popup-description-short').style.display = this.parentElement.querySelector('.popup-description-short').style.display === 'none' ? 'block' : 'none'; this.parentElement.querySelector('.popup-description-full').style.display = this.parentElement.querySelector('.popup-description-full').style.display === 'none' ? 'block' : 'none'; this.textContent = this.textContent === 'Leggi di più' ? 'Leggi meno' : 'Leggi di più';">
                                Leggi di più
                            </button>
                        ` : ''}
                    </div>
                    <div class="popup-actions">
                        <button class="popup-btn primary centered" onclick="mapManager.startAudio('${stop.id}')" title="Ascolta l'audio di questa tappa">
                            <i class="fas fa-play"></i> Ascolta
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // Simplified marker click handler
    handleMarkerClick(marker, stop, event) {
        // Clear all highlights first
        this.clearAllHighlights();
        
        // Add highlight to clicked marker
        const markerElement = marker.getElement();
        if (markerElement) {
            markerElement.classList.add('highlighted');
            
            // Auto-remove highlight after 4 seconds
            setTimeout(() => {
                if (markerElement.classList.contains('highlighted')) {
                    markerElement.classList.remove('highlighted');
                }
            }, 4000);
        }
        
        // Get current map bounds and center
        const mapBounds = this.map.getBounds();
        const mapCenter = this.map.getCenter();
        const markerLatLng = marker.getLatLng();
        
        // Calculate if marker is in viewport and if popup would be visible
        const mapSize = this.map.getSize();
        const markerPoint = this.map.latLngToContainerPoint(markerLatLng);
        
        // Check if popup would be clipped at the top (popup height ~150px)
        const popupHeight = 150;
        const needsPanning = markerPoint.y < popupHeight + 20;
        
        if (needsPanning) {
            // Calculate offset to center popup properly
            const zoom = this.map.getZoom();
            const offsetLat = 0.002 / Math.pow(2, zoom - 15); // Increased offset
            const adjustedLatLng = [markerLatLng.lat + offsetLat, markerLatLng.lng];
            
            // Pan to adjusted position with smooth animation
            this.map.panTo(adjustedLatLng, {
                animate: true,
                duration: 0.5
            });
            
            // Open popup after panning completes
            setTimeout(() => {
                marker.openPopup();
            }, 500);
        } else {
            // Popup fits in current view, open immediately
            marker.openPopup();
        }
    }

    highlightStop(stopId) {
        this.highlightMarker(stopId);
    }

    // Clear highlights from all markers
    clearAllHighlights() {
        this.markers.forEach(markerData => {
            const markerElement = markerData.marker.getElement();
            if (markerElement) {
                markerElement.classList.remove('highlighted');
            }
        });
    }

    // Simplified highlight marker method 
    highlightMarker(stopId) {
        const markerData = this.markers.find(m => m.stopId === stopId);
        if (markerData) {
            // Clear highlights first
            this.clearAllHighlights();
            
            // Add highlight to marker
            const markerElement = markerData.marker.getElement();
            if (markerElement) {
                markerElement.classList.add('highlighted');
                
                // Auto-remove highlight after 4 seconds
                setTimeout(() => {
                    if (markerElement.classList.contains('highlighted')) {
                        markerElement.classList.remove('highlighted');
                    }
                }, 4000);
            }
            
            // Just open popup without panning to avoid jarring movements
            markerData.marker.openPopup();
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

    // Method to fit map to all markers (only for initial load)
    fitToMarkersInitial() {
        if (this.markers.length === 0) return;
        
        try {
            const group = new L.featureGroup(this.markers.map(m => m.marker));
            const bounds = group.getBounds();
            
            // Add padding and fit bounds (only on initial load)
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