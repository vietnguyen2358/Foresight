"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"

// Dynamically import the Map component with no SSR
const MapWithNoSSR = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full border-4 border-blue-600 border-t-transparent animate-spin mb-4"></div>
        <p className="text-white">Loading map...</p>
      </div>
    </div>
  ),
})

interface MapWrapperProps {
  mapKey?: number
}

export default function MapWrapper({ mapKey }: MapWrapperProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)

    // Set a timeout to ensure DOM is fully rendered
    const timer = setTimeout(() => {
      setIsMounted(true)
    }, 200)

    return () => clearTimeout(timer)
  }, [])

  if (!isClient) {
    return (
      <div className="w-full h-full bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-blue-600 border-t-transparent animate-spin mb-4"></div>
          <p className="text-white">Initializing map...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full">
      {isMounted && <MapWithNoSSR key={mapKey} />}
      {!isMounted && (
        <div className="w-full h-full bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full border-4 border-blue-600 border-t-transparent animate-spin mb-4"></div>
            <p className="text-white">Preparing map...</p>
          </div>
        </div>
      )}
    </div>
  )
}

