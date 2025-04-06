"use client"

import { createContext, useContext, useState, ReactNode } from 'react'

export interface Camera {
  id: string
  name: string
  lat: number
  lng: number
  status: string
  videoSource?: string
}

// Mock camera data with real lat/lng coordinates for San Francisco
export const cameras: Camera[] = [
  {
    id: "SF-MKT-001",
    name: "Market Street & 5th",
    lat: 37.783,
    lng: -122.407,
    status: "active",
    videoSource: "/videos/market_street.mp4"
  },
  {
    id: "SF-EMB-002",
    name: "Embarcadero Plaza",
    lat: 37.795,
    lng: -122.394,
    status: "active",
    videoSource: "/videos/embarcadero.mp4"
  },
  {
    id: "SF-UNS-003",
    name: "Union Square",
    lat: 37.788,
    lng: -122.407,
    status: "active",
    videoSource: "/videos/union_square.mp4"
  },
  {
    id: "SF-FER-004",
    name: "Ferry Building",
    lat: 37.795,
    lng: -122.393,
    status: "active",
    videoSource: "/videos/ferry_building.mp4"
  },
  {
    id: "SF-CHI-005",
    name: "Chinatown Gate",
    lat: 37.79,
    lng: -122.405,
    status: "active",
    videoSource: "/videos/chinatown.mp4"
  },
  {
    id: "SF-MIS-006",
    name: "Mission District",
    lat: 37.763,
    lng: -122.419,
    status: "active",
    videoSource: "/videos/mission.mp4"
  },
  {
    id: "SF-HAI-007",
    name: "Haight Street",
    lat: 37.77,
    lng: -122.446,
    status: "active",
    videoSource: "/videos/haight.mp4"
  },
  {
    id: "SF-NOB-008",
    name: "Nob Hill",
    lat: 37.793,
    lng: -122.416,
    status: "active",
    videoSource: "/videos/nob_hill.mp4"
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