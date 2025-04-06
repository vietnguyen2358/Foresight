"use client"

import { createContext, useContext, useState, ReactNode } from 'react'

export interface Camera {
  id: string
  name: string
  lat: number
  lng: number
  status: string
  feed_url?: string
  image_url?: string
}

// Mock camera data with real lat/lng coordinates for San Francisco
export const cameras: Camera[] = [
  {
    id: "SF-MKT-001",
    name: "Market Street & 5th",
    lat: 37.783,
    lng: -122.407,
    status: "active",
    feed_url: "http://localhost:8000/camera/SF-MKT-001/feed",
    image_url: "http://localhost:8000/camera/SF-MKT-001/image"
  },

  {
    id: "SF-UNS-003",
    name: "Union Square",
    lat: 37.788,
    lng: -122.407,
    status: "active",
    feed_url: "http://localhost:8000/camera/SF-UNS-003/feed",
    image_url: "http://localhost:8000/camera/SF-UNS-003/image"
  },

  {
    id: "SF-CHI-005",
    name: "Chinatown Gate",
    lat: 37.79,
    lng: -122.405,
    status: "active",
    feed_url: "http://localhost:8000/camera/SF-CHI-005/feed",
    image_url: "http://localhost:8000/camera/SF-CHI-005/image"
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

interface CameraContextType {
  selectedCamera: Camera | null
  setSelectedCamera: (camera: Camera | null) => void
  cameras: Camera[]
}

const CameraContext = createContext<CameraContextType | undefined>(undefined)

export function CameraProvider({ children }: { children: ReactNode }) {
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null)

  // Create a wrapper function for setSelectedCamera that logs the camera selection
  const handleSetSelectedCamera = (camera: Camera | null) => {
    console.log("Setting selected camera:", camera);
    
    // If a camera is selected, log its details
    if (camera) {
      console.log(`Camera selected: ${camera.name} (${camera.id}) at [${camera.lat}, ${camera.lng}]`);
      
      // Try to use the zoomToCamera method if available
      setTimeout(() => {
        // @ts-ignore
        if (window.zoomToCamera) {
          console.log("Using zoomToCamera method from CameraContext");
          // @ts-ignore
          window.zoomToCamera(camera);
        } else {
          console.log("zoomToCamera method not available from CameraContext");
        }
      }, 500);
    } else {
      console.log("Camera selection cleared");
    }
    
    setSelectedCamera(camera);
  }

  return (
    <CameraContext.Provider value={{ selectedCamera, setSelectedCamera: handleSetSelectedCamera, cameras }}>
      {children}
    </CameraContext.Provider>
  )
}

export function useCamera() {
  const context = useContext(CameraContext)
  if (context === undefined) {
    throw new Error('useCamera must be used within a CameraProvider')
  }
  return context
}