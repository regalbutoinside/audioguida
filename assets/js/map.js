/**
 * Simplified map implementation for audioguida Regalbuto
 * Clean implementation focused on essential functionality
 * This replaces the complex map.js with a cleaner approach
 */

class AudioGuideMap {
    constructor() {
        this.map = null;
        this.markers = [];
        this.tourStops = [];
        this.userMarker = null;
        this.config = {
            defaultView: [37.652207, 14.640707], // Regalbuto center
            defaultZoom: 15,
            colors: {
                primary: '#6b46c1',
                secondary: '#3b82f6', 
                accent: '#10b981'
            }
        };
    }

    async init() {
        console.log('Initializing simplified map...');
        
        try {
            // Load tour data
            await this.loadTourData();
            
            // Initialize map
            this.initMap();
            
            // Create markers
            this.createMarkers();
            
            // Setup controls
            this.setupControls();
            
            // Handle URL parameters
            this.handleURLParams();
            
            console.log('Map initialization complete');
        } catch (error) {
            console.error('Error initializing map:', error);
            this.showError('Errore durante il caricamento della mappa. Verifica la connessione internet.');
        }
    }

    async loadTourData() {
        try {
            const response = await fetch('assets/data/audioguide.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const data = await response.json();
            
            // Get Italian content and static data
            const stops = data.tour.content.it.stops;
            const staticStops = data.tour.staticData.stops;
            
            // Combine data
            this.tourStops = stops.map((stop, index) => {
                const staticData = staticStops.find(s => s.id === stop.id) || {};
                return {
                    id: stop.id,
                    title: stop.title,
                    description: stop.description,
                    duration: stop.duration,
                    coordinates: staticData.coordinates ? 
                        [staticData.coordinates.latitude, staticData.coordinates.longitude] : null,
                    icon: staticData.icon || 'fa-map-marker-alt',
                    order: staticData.order || (index + 1),
                    googleMapsUrl: staticData.googleMapsUrl || '',
                    imagePath: staticData.imagePath || 'assets/img/default.jpg'
                };
            }).filter(stop => stop.coordinates && stop.coordinates[0] && stop.coordinates[1]); 
            
            console.log('Loaded', this.tourStops.length, 'tour stops');
        } catch (error) {
            console.error('Error loading tour data:', error);
            // Use fallback data if needed
            this.tourStops = this.getFallbackData();
        }
    }

    getFallbackData() {
        return [
            { 
                id: "piazza", 
                title: "Piazza della Repubblica", 
                coordinates: [37.652467, 14.6408218], 
                icon: "fa-map-marker-alt", 
                order: 1,
                description: "Il cuore storico e sociale di Regalbuto",
                duration: "2:38",
                imagePath: "assets/img/piazza.jpg"
            },
            { 
                id: "comune", 
                title: "Palazzo Comunale", 
                coordinates: [37.6523334, 14.6407522], 
                icon: "fa-landmark", 
                order: 2,
                description: "La sede dell'amministrazione comunale",
                duration: "2:48",
                imagePath: "assets/img/comune.jpg"
            },
            { 
                id: "chiesa_madre", 
                title: "Chiesa Madre di San Basilio", 
                coordinates: [37.6526445, 14.6408936], 
                icon: "fa-church", 
                order: 3,
                description: "La chiesa principale di Regalbuto",
                duration: "11:19",
                imagePath: "assets/img/chiesa_madre.jpg"
            }
        ];
    }

    initMap() {
        const container = document.getElementById('tour-map-container');
        if (!container) {
            throw new Error('Map container not found');
        }

        // Initialize Leaflet map
        this.map = L.map('tour-map-container', {
            zoomControl: false,
            attributionControl: true
        }).setView(this.config.defaultView, this.config.defaultZoom);

        // Add tile layer with CARTO Voyager
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        }).addTo(this.map);

        // Add custom zoom control in bottom right
        L.control.zoom({
            position: 'bottomright'
        }).addTo(this.map);
    }

    createMarkers() {
        this.markers = [];
        
        this.tourStops.forEach((stop, index) => {
            const marker = L.marker(stop.coordinates, {
                icon: this.createCustomIcon(stop.icon, stop.order),
                alt: stop.title,
                stopData: stop
            }).addTo(this.map);

            // Create popup with card-like design matching home page
            const popupContent = this.createPopupContent(stop);
            marker.bindPopup(popupContent, {
                maxWidth: 320,
                className: 'tour-stop-popup'
            });

            // Add click handler
            marker.on('click', () => {
                this.onMarkerClick(stop);
            });

            this.markers.push(marker);
        });

        // Fit map to show all markers
        this.fitMapToMarkers();
    }

    createCustomIcon(iconClass, order) {
        // Create icon color based on stop type
        let iconColor = this.config.colors.primary;
        if (iconClass.includes('church')) {
            iconColor = this.config.colors.secondary;
        } else if (iconClass.includes('tree') || iconClass.includes('water')) {
            iconColor = this.config.colors.accent;
        }

        return L.divIcon({
            html: `
                <div class="map-marker-wrapper">
                    <div class="map-marker-main" style="border-color: ${iconColor};">
                        <div class="map-marker-number" style="background-color: ${iconColor};">
                            ${order}
                        </div>
                    </div>
                    <div class="map-marker-tip" style="border-top-color: ${iconColor};"></div>
                </div>
            `,
            className: 'custom-marker-icon',
            iconSize: [48, 48],
            iconAnchor: [24, 48],
            popupAnchor: [0, -48]
        });
    }

    createPopupContent(stop) {
        // Create popup content that matches home page card design exactly
        return `
            <div class="map-popup-card">
                <!-- Header with image -->
                <div class="map-popup-header">
                    <img src="${stop.imagePath}" alt="${stop.title}" 
                         class="map-popup-image"
                         onerror="this.src='assets/img/illustration-2.png'">
                    <div class="map-popup-overlay"></div>
                    <div class="map-popup-content">
                        <div class="map-popup-badges">
                            <span class="map-popup-badge-stop">Tappa ${stop.order}</span>
                            ${stop.duration ? `<span class="map-popup-badge-duration">
                                <i class="fas fa-clock"></i>${stop.duration}
                            </span>` : ''}
                        </div>
                        <h3 class="map-popup-title">${stop.title}</h3>
                    </div>
                </div>
                
                <!-- Content -->
                <div class="map-popup-body">
                    <p class="map-popup-description">${stop.description || 'Scopri questa tappa del tour.'}</p>
                    
                    <!-- Action buttons -->
                    <div class="map-popup-actions">
                        <a href="index.html#${stop.id}" 
                           class="map-popup-button-primary"
                           aria-label="Ascolta l'audio per ${stop.title}">
                            <i class="fas fa-headphones"></i>
                            Ascolta
                        </a>
                        ${stop.googleMapsUrl ? `
                        <a href="${stop.googleMapsUrl}" target="_blank" rel="noopener"
                           class="map-popup-button-secondary"
                           aria-label="Apri ${stop.title} in Google Maps">
                            <i class="fas fa-external-link-alt"></i>
                        </a>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    setupControls() {
        // Reset button - show all markers
        const resetBtn = document.getElementById('map-view-all');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.fitMapToMarkers();
            });
        }

        // Locate button - find user location
        const locateBtn = document.getElementById('map-locate-me');
        if (locateBtn) {
            locateBtn.addEventListener('click', () => {
                this.locateUser();
            });
        }
    }

    fitMapToMarkers() {
        if (this.markers.length === 0) return;
        
        const group = new L.featureGroup(this.markers);
        this.map.fitBounds(group.getBounds().pad(0.1), {
            maxZoom: 16
        });
    }

    locateUser() {
        const locateBtn = document.getElementById('map-locate-me');
        
        if ("geolocation" in navigator) {
            // Show loading
            if (locateBtn) {
                locateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            }
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const userLatLng = [position.coords.latitude, position.coords.longitude];
                    
                    // Center map on user location
                    this.map.setView(userLatLng, 16);
                    
                    // Add user location marker
                    if (this.userMarker) {
                        this.map.removeLayer(this.userMarker);
                    }
                    
                    this.userMarker = L.marker(userLatLng, {
                        icon: L.divIcon({
                            html: `
                                <div class="w-6 h-6 rounded-full bg-blue-500 border-2 border-white shadow-lg flex items-center justify-center relative">
                                    <div class="w-2 h-2 bg-white rounded-full"></div>
                                    <div class="absolute w-8 h-8 bg-blue-500/20 rounded-full animate-ping"></div>
                                </div>
                            `,
                            className: 'user-location-marker',
                            iconSize: [24, 24],
                            iconAnchor: [12, 12]
                        })
                    }).addTo(this.map);
                    
                    this.userMarker.bindPopup('<div class="text-center text-sm"><strong>La tua posizione</strong></div>');
                    
                    // Restore button
                    if (locateBtn) {
                        locateBtn.innerHTML = '<i class="fas fa-location-crosshairs"></i>';
                    }
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    this.showError('Impossibile ottenere la posizione. Verifica i permessi di geolocalizzazione.');
                    if (locateBtn) {
                        locateBtn.innerHTML = '<i class="fas fa-location-crosshairs"></i>';
                    }
                },
                { timeout: 10000, maximumAge: 300000 }
            );
        } else {
            this.showError('Il tuo browser non supporta la geolocalizzazione.');
        }
    }

    handleURLParams() {
        // Check for stop parameter in URL
        const urlParams = new URLSearchParams(window.location.search);
        const stopId = urlParams.get('stop');
        
        if (stopId) {
            setTimeout(() => {
                this.highlightStop(stopId);
            }, 500);
        }
    }

    highlightStop(stopId) {
        const marker = this.markers.find(m => m.options.stopData.id === stopId);
        if (marker) {
            this.map.setView(marker.getLatLng(), 17);
            marker.openPopup();
        }
    }

    onMarkerClick(stop) {
        console.log('Marker clicked:', stop.title);
        // Additional analytics or actions can be added here
    }

    showError(message) {
        // Simple error display
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fixed top-4 left-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50';
        errorDiv.innerHTML = `
            <div class="flex items-center">
                <i class="fas fa-exclamation-triangle mr-2"></i>
                <span>${message}</span>
                <button class="ml-auto" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        document.body.appendChild(errorDiv);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.remove();
            }
        }, 5000);
    }
}

// Initialize map when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('tour-map-container')) {
        const mapInstance = new AudioGuideMap();
        mapInstance.init();
        
        // Make globally accessible for debugging
        window.audioGuideMap = mapInstance;
    }
});