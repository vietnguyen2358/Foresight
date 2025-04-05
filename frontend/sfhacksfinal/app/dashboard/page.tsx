"use client"

import { useState, useEffect } from "react"
import MapWrapper from "@/components/MapWrapper"
import ChatAgent from "@/components/ChatAgent"
import SearchSection from "@/components/SearchSection"
import { MapPin, Search, Maximize2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("map")
  const [mapKey, setMapKey] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // When switching to the map tab, force a re-render of the Map component
  useEffect(() => {
    if (activeTab === "map") {
      // Small delay to ensure the tab content is visible before map initialization
      const timer = setTimeout(() => {
        setMapKey((prev) => prev + 1)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [activeTab])

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  return (
    <div className={`flex h-[calc(100vh-4rem)] bg-black ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* AI Chat - Always visible unless in fullscreen */}
      {!isFullscreen && (
        <div className="w-80 bg-gray-950 border-r border-gray-800 h-[calc(100vh-4rem)] z-10">
          <ChatAgent />
        </div>
      )}

      {/* Main Content */}
      <div className={`flex-1 flex flex-col overflow-hidden ${isFullscreen ? 'w-full' : ''}`}>
        {/* Custom Tabs - Replacing the shadcn Tabs component */}
        <div className="bg-gray-950 border-b border-gray-800 px-4 py-2 flex justify-between items-center z-20">
          <div className="flex bg-gray-900 border border-gray-800 rounded-md h-10 overflow-hidden">
            <button
              onClick={() => setActiveTab("map")}
              className={`flex items-center justify-center flex-1 h-full ${
                activeTab === "map"
                  ? "bg-blue-600 text-white"
                  : "bg-transparent text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <MapPin className="h-4 w-4 mr-2" />
              Map View
            </button>
            <button
              onClick={() => setActiveTab("search")}
              className={`flex items-center justify-center flex-1 h-full ${
                activeTab === "search"
                  ? "bg-blue-600 text-white"
                  : "bg-transparent text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <Search className="h-4 w-4 mr-2" />
              Search Database
            </button>
          </div>
          
          {/* Fullscreen toggle button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="text-gray-400 hover:text-white"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 relative overflow-hidden">
          {activeTab === "map" && (
            <div className="absolute inset-0">
              <MapWrapper mapKey={mapKey} />
            </div>
          )}

          {activeTab === "search" && (
            <div className="h-full">
              <SearchSection />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

