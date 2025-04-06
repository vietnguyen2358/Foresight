"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"

// Dynamically import the Map component with no SSR
const MapWithNoSSR = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-900 flex items-center justify-center">
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 rounded-full border-4 border-blue-600 border-t-transparent animate-spin mb-4"></div>
        <p className="text-white">Loading map...</p>
      </div>
    </div>
  ),
})

interface MapWrapperProps {
  mapKey?: number
}

export default function MapWrapper({ mapKey = 1 }: MapWrapperProps) {
  return <MapWithNoSSR key={mapKey} />
}

