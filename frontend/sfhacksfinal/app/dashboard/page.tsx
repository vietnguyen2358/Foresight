"use client"

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Map, Database, Search, MessageCircle } from 'lucide-react';
import RightSidebar from '@/components/RightSidebar';
import MapWrapper from '@/components/MapWrapper';
import DatabaseSearch from '@/components/DatabaseSearch';
import PersonalizedSearch from '@/components/PersonalizedSearch';
import { CameraProvider } from '@/lib/CameraContext';
import { cn } from '@/lib/utils';
import Navbar from '@/components/navbar';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('map');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);

  return (
    <CameraProvider>
      <div className="flex flex-col h-screen bg-gray-950 overflow-hidden">
        <Navbar />
        <div className="flex flex-grow overflow-hidden">
          {/* Main content area */}
          <div className="flex-grow overflow-hidden">
            {/* Tabs */}
            <div className="border-b border-gray-800 bg-gray-900 px-4">
              <div className="flex space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab('map')}
                  className={cn(
                    "relative py-3 text-sm font-medium text-gray-500",
                    activeTab === 'map' && "text-white"
                  )}
                >
                  <Map className="h-4 w-4 mr-2" />
                  Map
                  {activeTab === 'map' && (
                    <span className="absolute inset-x-0 -bottom-px h-0.5 bg-sky-500"></span>
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab('search')}
                  className={cn(
                    "relative py-3 text-sm font-medium text-gray-500",
                    activeTab === 'search' && "text-white"
                  )}
                >
                  <Database className="h-4 w-4 mr-2" />
                  Search Database
                  {activeTab === 'search' && (
                    <span className="absolute inset-x-0 -bottom-px h-0.5 bg-sky-500"></span>
                  )}
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab('personalized')}
                  className={cn(
                    "relative py-3 text-sm font-medium text-gray-500",
                    activeTab === 'personalized' && "text-white"
                  )}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Personalized Search
                  {activeTab === 'personalized' && (
                    <span className="absolute inset-x-0 -bottom-px h-0.5 bg-sky-500"></span>
                  )}
                </Button>
              </div>
            </div>

            {/* Tab content */}
            <div className="h-full overflow-hidden">
              {activeTab === 'map' && (
                <div className="h-full w-full">
                  <MapWrapper mapKey={1} />
                </div>
              )}
              {activeTab === 'search' && (
                <DatabaseSearch />
              )}
              {activeTab === 'personalized' && (
                <PersonalizedSearch />
              )}
            </div>
          </div>

          {/* Right sidebar */}
          {!isFullScreen && (
            <div className="w-80 bg-gray-950 border-l border-gray-800 overflow-auto">
              <RightSidebar />
            </div>
          )}
        </div>
      </div>
    </CameraProvider>
  );
}

