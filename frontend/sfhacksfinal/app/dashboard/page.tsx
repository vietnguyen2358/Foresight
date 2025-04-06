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
  
  // Add scroll locking for the main page and left sidebar
  useEffect(() => {
    // Function to prevent scrolling on the main page and left sidebar
    const preventScroll = (e: Event) => {
      // Get the target element
      const target = e.target as Node;
      
      // Check if the event is from a scrollable container in the right sidebar
      const rightSidebarContent = document.querySelector('.right-sidebar-content');
      const leftSidebarContent = document.querySelector('.left-sidebar-content');
      
      // Allow scrolling only if the event is from a scrollable container in either sidebar
      if ((rightSidebarContent && rightSidebarContent.contains(target)) || 
          (leftSidebarContent && leftSidebarContent.contains(target))) {
        return; // Allow the scroll
      }
      
      // Prevent scrolling for all other elements
      e.preventDefault();
    };

    // Add event listener to prevent scrolling
    document.body.style.overflow = 'hidden';
    document.addEventListener('wheel', preventScroll, { passive: false });
    document.addEventListener('touchmove', preventScroll, { passive: false });

    // Cleanup function
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('wheel', preventScroll);
      document.removeEventListener('touchmove', preventScroll);
    };
  }, []);
  
  return (
    <div className="flex h-[calc(100vh-4rem)] bg-black overflow-hidden">

      <div 
        ref={leftSidebarRef}
        className="w-80 bg-gray-950 border-r border-gray-800 h-[calc(100vh-4rem)] overflow-hidden"
      >
        <ChatAgent />
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
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
        <div className="flex-1 relative overflow-hidden">
          {activeTab === "map" && (
            <div className="absolute inset-0">
              <MapWrapper mapKey={mapKey} />
            </div>
          )}

          {activeTab === "search" && (
            <div className="h-full w-full overflow-hidden">
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

