"use client"

import React, { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { MapPin, Navigation, Camera, X } from "lucide-react"
import { useCamera } from "@/lib/CameraContext"
// Dynamically import Leaflet to avoid SSR issues
import dynamic from 'next/dynamic'
import { cameras, Camera as CameraType } from '@/lib/cameraData'
import AlertOverlay from './AlertOverlay'

// Let's access Leaflet only on the client side
let L: any;
if (typeof window !== 'undefined') {
  L = require('leaflet');
}

// Event system for amber alerts
interface AmberAlertEvent {
  amber_alert: {
    match: boolean;
    alert: {
      id: string;
      timestamp: string;
      location: string;
      description: any;
      alert_message: string;
    };
    score: number;
    metadata?: {
      camera_id?: string;
    };
  };
  camera_id?: string;
}

// Create a custom event system
const createAmberAlertEventSystem = () => {
  const eventTarget = new EventTarget();
  
  return {
    dispatch: (data: AmberAlertEvent) => {
      const event = new CustomEvent('amber-alert', { detail: data });
      eventTarget.dispatchEvent(event);
    },
    subscribe: (callback: (data: AmberAlertEvent) => void) => {
      const handler = (e: Event) => {
        const customEvent = e as CustomEvent<AmberAlertEvent>;
        callback(customEvent.detail);
      };
      
      eventTarget.addEventListener('amber-alert', handler);
      
      return () => {
        eventTarget.removeEventListener('amber-alert', handler);
      };
    }
  };
};

// Create the event system
export const amberAlertEvents = createAmberAlertEventSystem();

// Default center coordinates (San Francisco)
const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 }

// Add functions to window object
declare global {
  interface Window {
    zoomToCamera: (camera: CameraType) => void;
    triggerAmberAlert: (alertData: AmberAlertEvent) => void;
  }
}

export default function Map() {
  const mapRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [nearestCamera, setNearestCamera] = useState<any>(null)
  const [isLoadingLocation, setIsLoadingLocation] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const { selectedCamera, setSelectedCamera } = useCamera()
  const markersRef = useRef<any[]>([])
  const userMarkerRef = useRef<any>(null)
  const pulseCircleRef = useRef<any>(null)
  const pulseAnimationRef = useRef<any>(null)
  const nearestCameraLineRef = useRef<any>(null)
  const mapClickHandlerRef = useRef<any>(null)
  
  // Add amber alert state
  const [activeAlert, setActiveAlert] = useState<AmberAlertEvent["amber_alert"] | null>(null);
  
  // Add camera markers to the map
  function addCameraMarkers(map: any, L: any) {
    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove())
    markersRef.current = []

    // Add markers for each camera
    cameras.forEach(camera => {
      const marker = L.marker([camera.lat, camera.lng], {
        icon: L.divIcon({
          className: 'custom-marker',
          html: `
            <div class="relative">
              <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path>
                  <circle cx="12" cy="13" r="3"></circle>
                </svg>
              </div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        }),
      })

      // Add click handler
      marker.on('click', (e: any) => {
        e.originalEvent.stopPropagation()
        setSelectedCamera(camera)
        // Smooth zoom to camera location
        map.flyTo([camera.lat, camera.lng], 18, {
          animate: true,
          duration: 1.5,
          easeLinearity: 0.25
        })
      })

      marker.addTo(map)
      markersRef.current.push(marker)
    })
  }

  // Initialize or reinitialize the map
  const initializeMap = async () => {
    if (!mapContainerRef.current) return

    try {
      // Clean up existing map if it exists
      if (mapRef.current) {
        // Remove existing click handler if it exists
        if (mapClickHandlerRef.current) {
          mapRef.current.off('click', mapClickHandlerRef.current)
        }
        mapRef.current.remove()
        mapRef.current = null
      }

      // Create map with saved state or default
      const map = L.map(mapContainerRef.current, {
        center: [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng],
        zoom: 13,
        zoomControl: false, // We'll add custom zoom controls
      })

      // Add dark-themed map tiles
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map)

      // Create a map click handler function
      const handleMapClick = (e: any) => {
        // Only process if a camera is selected
        if (!selectedCamera) return;
        
        // Check if the click was on a marker
        const clickedOnMarker = markersRef.current.some(marker => {
          const markerLatLng = marker.getLatLng();
          const clickLatLng = e.latlng;
          
          // Calculate distance between click and marker
          const distance = Math.sqrt(
            Math.pow(markerLatLng.lat - clickLatLng.lat, 2) + 
            Math.pow(markerLatLng.lng - clickLatLng.lng, 2)
          );
          
          // If distance is small, consider it a click on the marker
          return distance < 0.0001; // Adjust this threshold as needed
        });
        
        // If not clicked on a marker, deselect the camera
        if (!clickedOnMarker) {
          console.log("Map clicked outside markers, deselecting camera");
          setSelectedCamera(null);
        }
      };

      // Store the handler reference so we can remove it later
      mapClickHandlerRef.current = handleMapClick;
      
      // Add the click handler to the map
      map.on('click', handleMapClick);

      // Store map reference
      mapRef.current = map

      // Add camera markers
      addCameraMarkers(map, L)

      // Try to get user location if we don't have it yet
      // if (!userLocation) {
      //   getUserLocation(map, L)
      // } else {
      //   addUserLocationMarker(map, L, userLocation)
      // }

      return map
    } catch (error) {
      console.error("Error initializing map:", error)
      return null
    }
  }

  // Get user's current location
  const getUserLocation = (map: any, L: any) => {
    setIsLoadingLocation(true)
    setLocationError(null)

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userPos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }

          setUserLocation(userPos)
          addUserLocationMarker(map, L, userPos)

          // Fly to user location
          map.flyTo([userPos.lat, userPos.lng], 15, {
            animate: true,
            duration: 1.5,
          })

          setIsLoadingLocation(false)
        },
        (error) => {
          console.error("Error getting location:", error)
          setLocationError("Unable to access your location. Using default location.")
          setIsLoadingLocation(false)
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        },
      )
    } else {
      setLocationError("Geolocation is not supported by your browser")
      setIsLoadingLocation(false)
    }
  }

  // Add user location marker
  const addUserLocationMarker = (map: any, L: any, location: { lat: number; lng: number }) => {
    // Clear existing user marker and pulse
    if (userMarkerRef.current) {
      userMarkerRef.current.remove()
    }
    if (pulseCircleRef.current) {
      pulseCircleRef.current.remove()
    }
    if (pulseAnimationRef.current) {
      clearInterval(pulseAnimationRef.current)
    }

    // Add a marker for user location
    const userMarker = L.circleMarker([location.lat, location.lng], {
      radius: 8,
      fillColor: "#3b82f6",
      color: "#fff",
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8,
    }).addTo(map)

    // Add a pulsing effect
    const animatePulse = () => {
      let radius = 0
      const interval = setInterval(() => {
        radius += 1
        pulseCircleRef.current.setRadius(radius)
        pulseCircleRef.current.setStyle({
          opacity: Math.max(0, 0.5 - radius / 30),
          fillOpacity: Math.max(0, 0.3 - radius / 30),
        })

        if (radius > 30) {
          clearInterval(interval)
          pulseCircleRef.current.setRadius(0)
          setTimeout(animatePulse, 500)
        }
      }, 50)

      pulseAnimationRef.current = interval
    }

    animatePulse()

    // Save references
    userMarkerRef.current = userMarker
  }

  // Find nearest camera to user location
  const findNearestCamera = () => {
    if (!userLocation) {
      setLocationError("Please enable location services first")
      return
    }

    // Calculate distance to each camera
    const camerasWithDistance = cameras.map((camera) => {
      const distance = calculateDistance(userLocation.lat, userLocation.lng, camera.lat, camera.lng)
      return { ...camera, distance }
    })

    // Sort by distance and get the nearest
    const nearest = camerasWithDistance.sort((a, b) => a.distance - b.distance)[0]
    setNearestCamera(nearest)

    // Draw line to nearest camera
    drawLineToNearestCamera(nearest)

    // Fit bounds to show both user and nearest camera
    if (mapRef.current) {
      const bounds = [
        [userLocation.lat, userLocation.lng],
        [nearest.lat, nearest.lng],
      ]
      mapRef.current.fitBounds(bounds, {
        padding: [50, 50],
      })
    }
  }

  // Draw a line from user to nearest camera
  const drawLineToNearestCamera = (camera: any) => {
    if (!mapRef.current || !userLocation) return

    // Remove existing line
    if (nearestCameraLineRef.current) {
      nearestCameraLineRef.current.remove()
    }

    // Import Leaflet
    import("leaflet").then((L) => {
      // Create a polyline
      const line = L.polyline(
        [
          [userLocation.lat, userLocation.lng],
          [camera.lat, camera.lng],
        ],
        {
          color: "#3b82f6",
          weight: 3,
          opacity: 0.7,
          dashArray: "5, 10",
          lineCap: "round",
        },
      ).addTo(mapRef.current)

      nearestCameraLineRef.current = line
    })
  }

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371 // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1)
    const dLon = deg2rad(lon2 - lon1)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const d = R * c // Distance in km
    return d
  }

  const deg2rad = (deg: number) => {
    return deg * (Math.PI / 180)
  }

  // Reset map view to default when camera is deselected
  useEffect(() => {
    if (!selectedCamera && mapRef.current) {
      mapRef.current.flyTo([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 13, {
        animate: true,
        duration: 1.5,
      })
    }
  }, [selectedCamera])

  // Add a direct click handler to the map container for better reliability
  useEffect(() => {
    const handleContainerClick = (e: MouseEvent) => {
      // Only process if a camera is selected
      if (!selectedCamera) return;
      
      // Check if the click was on a marker
      const target = e.target as HTMLElement;
      const isMarker = target.closest('.camera-marker');
      
      // If not clicked on a marker, deselect the camera
      if (!isMarker) {
        console.log("Container clicked outside markers, deselecting camera");
        setSelectedCamera(null);
      }
    };
    
    const container = mapContainerRef.current;
    if (container) {
      container.addEventListener('click', handleContainerClick);
      
      return () => {
        container.removeEventListener('click', handleContainerClick);
      };
    }
  }, [selectedCamera, setSelectedCamera]);

  // Add effect to handle camera selection changes
  useEffect(() => {
    console.log("Camera selection changed:", selectedCamera);
    if (selectedCamera && mapRef.current) {
      console.log("Camera selected, zooming to:", selectedCamera);
      console.log("Map reference exists:", !!mapRef.current);
      console.log("Map methods available:", {
        flyTo: !!mapRef.current.flyTo,
        getCenter: !!mapRef.current.getCenter,
        getZoom: !!mapRef.current.getZoom
      });
      
      // Force a small delay to ensure the map is ready
      setTimeout(() => {
        if (mapRef.current) {
          console.log("Executing flyTo after delay");
          // Smooth zoom to selected camera
          mapRef.current.flyTo([selectedCamera.lat, selectedCamera.lng], 18, {
            animate: true,
            duration: 1.5,
            easeLinearity: 0.25
          });
          
          // Log current map state
          console.log("Current map center:", mapRef.current.getCenter());
          console.log("Current map zoom:", mapRef.current.getZoom());
        }
      }, 200);
      
      // Update marker styles
      markersRef.current.forEach(marker => {
        const markerLatLng = marker.getLatLng();
        if (markerLatLng.lat === selectedCamera.lat && markerLatLng.lng === selectedCamera.lng) {
          console.log("Updating marker style for selected camera");
          marker.setIcon(L.divIcon({
            className: 'custom-marker',
            html: `
              <div class="relative">
                <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path>
                    <circle cx="12" cy="13" r="3"></circle>
                  </svg>
                </div>
              </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          }));
        }
      });
    }
  }, [selectedCamera]);

  // Expose the zoomToCamera method to the window object for testing
  useEffect(() => {
    if (mapRef.current) {
      // @ts-ignore
      window.zoomToCamera = (camera: typeof cameras[0]) => {
        console.log("Zooming to camera:", camera);
        if (mapRef.current) {
          // Smooth zoom to camera location
          mapRef.current.flyTo({
            center: [camera.lng, camera.lat],
            zoom: 15,
            duration: 2000
          });
          
          // Update marker styles
          markersRef.current.forEach(marker => {
            const markerLatLng = marker.getLatLng();
            if (markerLatLng.lat === camera.lat && markerLatLng.lng === camera.lng) {
              marker.setIcon(L.divIcon({
                className: 'custom-marker',
                html: `
                  <div class="relative">
                    <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path>
                        <circle cx="12" cy="13" r="3"></circle>
                      </svg>
                    </div>
                  </div>
                `,
                iconSize: [32, 32],
                iconAnchor: [16, 16],
              }));
              
              // Add a popup to the marker
              marker.bindPopup(`<strong>${camera.name}</strong><br>Camera ID: ${camera.id}`).openPopup();
            }
          });
          
          // Log success message
          console.log(`Successfully zoomed to camera ${camera.name} (${camera.id})`);
        } else {
          console.error("Map reference not available");
        }
      };
    }
  }, [markersRef]);

  // Initialize map when component mounts
  useEffect(() => {
    // Add Leaflet CSS if it doesn't exist
    let link = document.querySelector('link[href*="leaflet.css"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link") as HTMLLinkElement;
      link.href = "https://unpkg.com/leaflet@1.7.1/dist/leaflet.css";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
  
    // Initialize map with a longer delay to ensure DOM is ready
    const timer = setTimeout(() => {
      if (mapContainerRef.current) {
        initializeMap();
      }
    }, 300);
  
    // Clean up on unmount
    return () => {
      clearTimeout(timer);
      if (mapRef.current) {
        mapRef.current.remove();
      }
      if (pulseAnimationRef.current) {
        clearInterval(pulseAnimationRef.current);
      }
      // Only remove the link if we created it
      if (link && link.parentNode && !document.querySelector('link[href*="leaflet.css"]:not(:first-of-type)')) {
        link.parentNode.removeChild(link);
      }
    };
  }, []);

  // Add amber alert subscription
  useEffect(() => {
    // Subscribe to amber alert events
    const unsubscribe = amberAlertEvents.subscribe((data) => {
      console.log('Amber alert received:', data);
      
      // Check if this alert is for SF-MIS-006 camera or contains camera ID in metadata
      const alertCameraId = data.camera_id || data.amber_alert?.metadata?.camera_id;
      
      if (alertCameraId && alertCameraId !== "SF-MIS-006") {
        console.log(`Ignoring amber alert for camera ${alertCameraId} - only showing alerts for SF-MIS-006`);
        return;
      }
      
      // Only show the alert if it's from SF-MIS-006 or no camera ID is specified
      setActiveAlert(data.amber_alert);
    });
    
    // Expose global trigger function
    window.triggerAmberAlert = (alertData) => {
      amberAlertEvents.dispatch(alertData);
    };
    
    return () => {
      unsubscribe();
      // Clean up global function
      if ('triggerAmberAlert' in window) {
        // @ts-ignore - TypeScript doesn't like delete on window properties
        window.triggerAmberAlert = undefined;
      }
    };
  }, []);

  return (
    <div className="w-full h-full bg-gray-900 relative">
      {/* Map container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Loading overlay */}
      {isLoadingLocation && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-[1000]">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full border-4 border-blue-600 border-t-transparent animate-spin mb-4"></div>
            <p className="text-white">Getting your location...</p>
          </div>
        </div>
      )}

      {/* Error message */}
      {locationError && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-900/80 text-white p-3 rounded-lg z-[1000] max-w-md text-center">
          {locationError}
          <button className="ml-2 text-blue-300 hover:text-blue-100" onClick={() => setLocationError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* Selected camera info with close button */}
      {selectedCamera && (
        <div className="absolute top-4 left-4 bg-gray-900/90 border border-gray-800 text-white p-4 rounded-lg z-[1000] max-w-xs">
          <div className="flex justify-between items-start">
            <h3 className="font-bold flex items-center">
              <Camera className="h-4 w-4 mr-2 text-blue-500" />
              Camera {selectedCamera.id}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedCamera(null)}
              className="h-6 w-6 text-gray-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm mt-1">{selectedCamera.name}</p>
          <p className="text-xs text-gray-400 mt-1">Status: {selectedCamera.status}</p>
          <p className="text-sm text-red-500 mt-1 flex items-center">
            <span className="relative flex h-2 w-2 mr-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            LIVE
          </p>
        </div>
      )}

      {/* Click anywhere to exit indicator */}
      {selectedCamera && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-gray-900/90 border border-gray-800 text-white p-3 rounded-lg z-[1000] text-center">
          <p className="text-sm text-gray-300">Click anywhere on the map to exit camera view</p>
        </div>
      )}

      {/* Nearest camera info */}
      {nearestCamera && !selectedCamera && (
        <div className="absolute top-4 left-4 bg-gray-900/90 border border-gray-800 text-white p-4 rounded-lg z-[1000] max-w-xs">
          <h3 className="font-bold flex items-center">
            <Camera className="h-4 w-4 mr-2 text-blue-500" />
            Nearest Camera
          </h3>
          <p className="text-sm mt-1">{nearestCamera.name}</p>
          <p className="text-xs text-gray-400 mt-1">Distance: {nearestCamera.distance.toFixed(2)} km</p>
        </div>
      )}

      {/* Map controls */}
      <div className="absolute bottom-4 right-4 z-[1000] flex flex-col gap-2">
        <Button
          onClick={() => {
            if (mapRef.current && userLocation) {
              mapRef.current.flyTo([userLocation.lat, userLocation.lng], 15, {
                animate: true,
                duration: 1.5,
              })
            } else if (mapRef.current) {
              import("leaflet").then((L) => {
                getUserLocation(mapRef.current, L)
              })
            }
          }}
          className="bg-gray-900 border border-gray-800 hover:bg-gray-800 text-white"
          disabled={isLoadingLocation}
        >
          <Navigation className="h-4 w-4 mr-2" />
          My Location
        </Button>

        <Button
          onClick={findNearestCamera}
          className="bg-blue-600 hover:bg-blue-700 text-white"
          disabled={!userLocation || isLoadingLocation}
        >
          <MapPin className="h-4 w-4 mr-2" />
          Find Nearest Camera
        </Button>
      </div>

      {/* Amber Alert Overlay */}
      {activeAlert && (
        <AlertOverlay 
          alert={activeAlert.alert} 
          onClose={() => setActiveAlert(null)} 
        />
      )}
    </div>
  )
}

