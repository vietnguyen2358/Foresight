"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { MapPin, Navigation, Camera } from "lucide-react"

// Mock camera data with real lat/lng coordinates for San Francisco
const cameras = [
  {
    id: "SF-MKT-001",
    name: "Market Street & 5th",
    lat: 37.783,
    lng: -122.407,
    status: "active",
  },
  {
    id: "SF-EMB-002",
    name: "Embarcadero Plaza",
    lat: 37.795,
    lng: -122.394,
    status: "active",
  },
  {
    id: "SF-UNS-003",
    name: "Union Square",
    lat: 37.788,
    lng: -122.407,
    status: "active",
  },
  {
    id: "SF-FER-004",
    name: "Ferry Building",
    lat: 37.795,
    lng: -122.393,
    status: "active",
  },
  {
    id: "SF-CHI-005",
    name: "Chinatown Gate",
    lat: 37.79,
    lng: -122.405,
    status: "active",
  },
  {
    id: "SF-MIS-006",
    name: "Mission District",
    lat: 37.763,
    lng: -122.419,
    status: "active",
  },
  {
    id: "SF-HAI-007",
    name: "Haight Street",
    lat: 37.77,
    lng: -122.446,
    status: "active",
  },
  {
    id: "SF-NOB-008",
    name: "Nob Hill",
    lat: 37.793,
    lng: -122.416,
    status: "active",
  },
]

// Default center coordinates (San Francisco)
const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 }

export default function Map() {
  const mapRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [nearestCamera, setNearestCamera] = useState<any>(null)
  const [isLoadingLocation, setIsLoadingLocation] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const markersRef = useRef<any[]>([])
  const userMarkerRef = useRef<any>(null)
  const pulseCircleRef = useRef<any>(null)
  const pulseAnimationRef = useRef<any>(null)
  const nearestCameraLineRef = useRef<any>(null)

  // Initialize or reinitialize the map
  const initializeMap = async () => {
    if (!mapContainerRef.current) return

    try {
      // Clean up existing map if it exists
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }

      // Import Leaflet dynamically
      const L = await import("leaflet")

      // Fix Leaflet's icon paths
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
      })

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

      // Store map reference
      mapRef.current = map

      // Add camera markers
      addCameraMarkers(map, L)

      // Try to get user location if we don't have it yet
      if (!userLocation) {
        getUserLocation(map, L)
      } else {
        addUserLocationMarker(map, L, userLocation)
      }

      return map
    } catch (error) {
      console.error("Error initializing map:", error)
      return null
    }
  }

  // Add camera markers to the map
  const addCameraMarkers = (map: any, L: any) => {
    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []

    // Create custom camera icon
    const cameraIcon = L.divIcon({
      html: `
        <div class="p-1 rounded-full bg-blue-600 shadow-lg flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path>
            <circle cx="12" cy="13" r="3"></circle>
          </svg>
        </div>
      `,
      className: "camera-marker",
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    })

    // Add camera markers
    cameras.forEach((camera) => {
      const marker = L.marker([camera.lat, camera.lng], { icon: cameraIcon })
        .addTo(map)
        .bindPopup(`
          <div class="p-2">
            <h3 class="font-bold">${camera.name}</h3>
            <p class="text-sm">ID: ${camera.id}</p>
            <p class="text-sm text-green-500">Status: ${camera.status}</p>
          </div>
        `)

      markersRef.current.push(marker)
    })
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
    const pulseCircle = L.circleMarker([location.lat, location.lng], {
      radius: 0,
      fillColor: "#3b82f6",
      color: "#3b82f6",
      weight: 2,
      opacity: 0.5,
      fillOpacity: 0.3,
    }).addTo(map)

    // Animate the pulse
    const animatePulse = () => {
      let radius = 0
      const interval = setInterval(() => {
        radius += 1
        pulseCircle.setRadius(radius)
        pulseCircle.setStyle({
          opacity: Math.max(0, 0.5 - radius / 30),
          fillOpacity: Math.max(0, 0.3 - radius / 30),
        })

        if (radius > 30) {
          clearInterval(interval)
          pulseCircle.setRadius(0)
          setTimeout(animatePulse, 500)
        }
      }, 50)

      pulseAnimationRef.current = interval
    }

    animatePulse()

    // Save references
    userMarkerRef.current = userMarker
    pulseCircleRef.current = pulseCircle
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

  // Initialize map when component mounts
  useEffect(() => {
    // Add Leaflet CSS if it doesn't exist
    let link = document.querySelector('link[href*="leaflet.css"]') as HTMLLinkElement | null
    if (!link) {
      link = document.createElement("link") as HTMLLinkElement
      link.href = "https://unpkg.com/leaflet@1.7.1/dist/leaflet.css"
      link.rel = "stylesheet"
      document.head.appendChild(link)
    }
  
    // Initialize map with a longer delay to ensure DOM is ready
    const timer = setTimeout(() => {
      if (mapContainerRef.current) {
        initializeMap()
      }
    }, 300)
  
    // Clean up on unmount
    return () => {
      clearTimeout(timer)
      if (mapRef.current) {
        mapRef.current.remove()
      }
      if (pulseAnimationRef.current) {
        clearInterval(pulseAnimationRef.current)
      }
      // Only remove the link if we created it
      if (link && link.parentNode && !document.querySelector('link[href*="leaflet.css"]:not(:first-of-type)')) {
        link.parentNode.removeChild(link)
      }
    }
  }, [])

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

      {/* Nearest camera info */}
      {nearestCamera && (
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
    </div>
  )
}

