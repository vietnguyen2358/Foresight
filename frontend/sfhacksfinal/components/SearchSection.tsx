"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Loader2, Maximize2, X } from "lucide-react"
import { Card } from "@/components/ui/card"
import { searchPeople, type SearchResult, type Match } from "@/lib/api"
import { motion, AnimatePresence } from "framer-motion"
import { User } from "lucide-react"
import { useCamera } from "@/lib/CameraContext"
import { cameras, Camera as CameraType } from "@/lib/cameraData"

export default function SearchSection() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const resultsEndRef = useRef<HTMLDivElement>(null)
  const { setSelectedCamera } = useCamera()

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const results = await searchPeople(searchQuery)
      setSearchResults(results)
      
      // If we have results, zoom to the top match camera
      if (results.matches && results.matches.length > 0) {
        // Get camera ID from top match
        const topMatch = results.matches[0];
        const cameraId = topMatch.metadata?.camera_id;
        
        if (cameraId) {
          // Find the camera in the cameras array and zoom to it
          zoomToCamera(cameraId);
        }
        
        // Scroll to results
        setTimeout(() => {
          resultsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 300)
      }
    } catch (err) {
      setError('Failed to search people. Please try again.')
      console.error('Search error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Function to zoom to camera by ID
  const zoomToCamera = (cameraId: string) => {
    try {
      // Find the camera in the cameras array
      const camera = cameras.find((cam: CameraType) => cam.id === cameraId);
      if (!camera) {
        console.error(`Camera with ID ${cameraId} not found`);
        return;
      }
      
      // Select the camera in context
      setSelectedCamera(camera);
      
      // If window.zoomToCamera exists, call it
      if (typeof window.zoomToCamera === 'function') {
        window.zoomToCamera(camera);
        console.log(`Zoomed to camera: ${cameraId}`);
      } else {
        console.warn('zoomToCamera function not available on window object');
      }
    } catch (error) {
      console.error('Error zooming to camera:', error);
    }
  }

  // Handle suggested search
  const handleSuggestedSearch = (suggestion: string) => {
    setSearchQuery(suggestion)
    // Execute search with a small delay to show the query change
    setTimeout(() => {
      handleSearch()
    }, 300)
  }

  // Generate a random bounding box for visualization
  const generateBoundingBox = () => {
    // These values create a realistic-looking bounding box
    const x = 20 + Math.random() * 20 // 20-40% from left
    const y = 20 + Math.random() * 20 // 20-40% from top
    const width = 40 + Math.random() * 20 // 40-60% width
    const height = 50 + Math.random() * 20 // 50-70% height
    
    return {
      left: `${x}%`,
      top: `${y}%`,
      width: `${width}%`,
      height: `${height}%`
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-lg font-semibold text-white">Search for People</h2>
        <p className="text-sm text-gray-400">Describe the person you're looking for</p>
      </div>

      <div className="p-4">
        <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="flex gap-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="e.g., man wearing red shirt and blue jeans"
            disabled={isLoading}
            className="flex-1 bg-gray-900 border-gray-800 text-white focus-visible:ring-blue-600"
          />
          <Button 
            type="submit" 
            disabled={isLoading || !searchQuery.trim()} 
            className="bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>

      {/* Error message */}
      {error && (
        <div className="px-4 py-2 m-4 bg-red-900/40 border border-red-800 rounded-md text-white text-sm">
          {error}
        </div>
      )}

      {/* Search message and suggestions */}
      {searchResults && !isLoading && (
        <div className="px-4 py-2">
          <p className="text-sm text-gray-300 mb-2">
            {searchResults.message || (searchResults.matches.length > 0 
              ? `Found ${searchResults.matches.length} potential matches` 
              : 'No matches found')}
          </p>
          
          {searchResults.rag_response && (
            <div className="mb-3 p-3 bg-blue-950/30 border border-blue-900/50 rounded-md">
              <p className="text-sm text-blue-300">{searchResults.rag_response}</p>
            </div>
          )}
          
          {searchResults.suggestions && searchResults.suggestions.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-gray-400 mb-1">Try searching for:</p>
              <div className="flex flex-wrap gap-2">
                {searchResults.suggestions.map((suggestion, i) => (
                  <Button 
                    key={i} 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleSuggestedSearch(suggestion)}
                    className="text-xs bg-gray-800/50 hover:bg-gray-700 border-gray-700 text-gray-300"
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {searchResults && searchResults.matches && searchResults.matches.length > 0 ? (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {searchResults.matches.map((match, i) => (
              <Card 
                key={i} 
                className="overflow-hidden bg-gray-900/70 border-gray-800 hover:border-gray-700 transition-all"
              >
                <div className="relative aspect-video bg-gray-950 overflow-hidden">
                  {match.image_data ? (
                    <div className="relative w-full h-full">
                      <img 
                        src={`data:image/jpeg;base64,${match.image_data}`} 
                        alt={`Person ${i+1}`}
                        className="w-full h-full object-cover"
                      />
                      <div 
                        className="absolute border-2 border-blue-500 bg-blue-500/20 rounded-md"
                        style={generateBoundingBox()}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-900 text-gray-700">
                      <User size={48} />
                    </div>
                  )}
                  
                  {/* Match score */}
                  <div className="absolute top-2 right-2 bg-gray-900/80 text-white text-xs px-2 py-1 rounded-full">
                    {match.similarity.toFixed(0)}% match
                  </div>
                  
                  {/* Enlarge button */}
                  {match.image_data && (
                    <Button
                      className="absolute bottom-2 right-2 h-7 w-7 p-0 bg-gray-900/80 hover:bg-gray-900"
                      onClick={() => setSelectedImage(`data:image/jpeg;base64,${match.image_data}`)}
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                
                <div className="p-3">
                  {/* Match highlights */}
                  {match.highlights && match.highlights.length > 0 && (
                    <div className="mb-2">
                      <div className="flex flex-wrap gap-1.5">
                        {match.highlights.map((highlight: string, idx: number) => (
                          <span 
                            key={idx} 
                            className="inline-block text-xs px-2 py-0.5 bg-blue-900/40 text-blue-300 rounded-full"
                          >
                            {highlight}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                
                  <div className="grid grid-cols-2 gap-y-2 text-xs">
                    {match.description.gender && (
                      <div>
                        <span className="text-gray-400">Gender:</span> {match.description.gender}
                      </div>
                    )}
                    {match.description.age_group && (
                      <div>
                        <span className="text-gray-400">Age:</span> {match.description.age_group}
                      </div>
                    )}
                    {match.description.clothing_top && (
                      <div className="col-span-2">
                        <span className="text-gray-400">Top:</span> {match.description.clothing_top_color && (
                          <span>{match.description.clothing_top_color} </span>
                        )}
                        {match.description.clothing_top}
                      </div>
                    )}
                    {match.description.clothing_bottom && (
                      <div className="col-span-2">
                        <span className="text-gray-400">Bottom:</span> {match.description.clothing_bottom_color && (
                          <span>{match.description.clothing_bottom_color} </span>
                        )}
                        {match.description.clothing_bottom}
                      </div>
                    )}
                    {match.description.hair_color && (
                      <div className="col-span-2">
                        <span className="text-gray-400">Hair:</span> {match.description.hair_style && (
                          <span>{match.description.hair_style} </span>
                        )}
                        {match.description.hair_color}
                      </div>
                    )}
                    {match.description.facial_features && (
                      <div className="col-span-2">
                        <span className="text-gray-400">Face:</span> {match.description.facial_features}
                      </div>
                    )}
                    {match.description.accessories && (
                      <div className="col-span-2">
                        <span className="text-gray-400">Accessories:</span> {match.description.accessories}
                      </div>
                    )}
                    {match.metadata.camera_id && (
                      <div className="col-span-2 mt-1 pt-1 border-t border-gray-800">
                        <span className="text-gray-400">Seen at:</span> {match.metadata.camera_id}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          !isLoading && searchResults && (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
                <Search className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="text-gray-300 font-medium mb-1">No matches found</h3>
              <p className="text-gray-500 text-sm mb-4 max-w-md">
                Try a different search or use one of the suggestions above.
              </p>
            </div>
          )
        )}
        <div ref={resultsEndRef} />
      </div>

      {/* Enlarged image modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img 
              src={selectedImage} 
              alt="Enlarged person" 
              className="max-h-[90vh] max-w-full object-contain"
            />
            <Button
              className="absolute top-2 right-2 h-8 w-8 p-0 rounded-full bg-black/50 hover:bg-black"
              onClick={() => setSelectedImage(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

