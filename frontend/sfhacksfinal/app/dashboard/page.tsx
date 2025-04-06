"use client"

import { useState, useEffect, useRef } from "react"
import MapWrapper from "@/components/MapWrapper"
import ChatAgent from "@/components/ChatAgent"
import DatabaseSearch from "@/components/DatabaseSearch"
import { MapPin, Search } from "lucide-react"
import RightSidebar from "@/components/RightSidebar"

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("map")
  const [mapKey, setMapKey] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const leftSidebarRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    window.scrollTo(0, 0)
  }, []) 
  
  useEffect(() => {
    if (activeTab === "map") {
      const timer = setTimeout(() => {
        setMapKey((prev) => prev + 1)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [activeTab])
  
  // Removed scroll locking for the main page and left sidebar
  
  return (
    <div className="flex h-[calc(100vh-4rem)] bg-black">
      <div 
        ref={leftSidebarRef}
        className="w-80 bg-gray-950 border-r border-gray-800 h-[calc(100vh-4rem)] overflow-auto"
      >
        <ChatAgent />
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <div className="bg-gray-950 border-b border-gray-800 px-4 py-2 flex z-20">
          <div className="flex bg-gray-900 border border-gray-800 rounded-md h-10 overflow-hidden w-full">
            <button
              onClick={() => setActiveTab("map")}
              className={`flex items-center justify-center w-1/2 h-full px-4 ${
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
              className={`flex items-center justify-center w-1/2 h-full px-4 ${
                activeTab === "search"
                  ? "bg-blue-600 text-white"
                  : "bg-transparent text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <Search className="h-4 w-4 mr-2" />
              Search Database
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 relative">
          {activeTab === "map" && (
            <div className="absolute inset-0">
              <MapWrapper mapKey={mapKey} />
            </div>
          )}

          {activeTab === "search" && (
            <div className="h-full w-full overflow-auto">
              <DatabaseSearch />
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar - Only visible on dashboard */}
      {!isFullscreen && (
        <div className="w-80 bg-gray-950 border-l border-gray-800 h-[calc(100vh-4rem)] z-10 overflow-y-auto right-sidebar">
          <RightSidebar />
        </div>
      )}
    </div>
  )
}

