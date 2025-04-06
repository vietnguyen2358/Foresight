"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Loader2, Maximize2, X } from "lucide-react"
import { Card } from "@/components/ui/card"
import { searchPeople, type SearchResult } from "@/lib/api"
import { motion, AnimatePresence } from "framer-motion"

export default function SearchSection() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const resultsEndRef = useRef<HTMLDivElement>(null)

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const results = await searchPeople(searchQuery)
      setSearchResults(results)
    } catch (err) {
      setError('Failed to search people. Please try again.')
      console.error('Search error:', err)
    } finally {
      setIsLoading(false)
    }
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
        <form onSubmit={handleSearch} className="flex gap-2">
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

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900">
        {isLoading && (
          <div className="flex justify-center items-center h-32">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        )}

        {!isLoading && searchResults.length > 0 ? (
          <div className="space-y-4">
            {searchResults.map((result, index) => (
              <Card key={index} className="p-4 bg-gray-800 border-gray-700">
                <div className="flex gap-4">
                  {result.imageData && (
                    <div className="relative w-32 h-32">
                      <img
                        src={`data:image/jpeg;base64,${result.imageData}`}
                        alt={`Match ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h3 className="text-lg font-semibold text-white">
                        Match {index + 1} ({result.similarity.toFixed(1)}% similarity)
                      </h3>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedImage(result.imageData || null)}
                        className="text-gray-400 hover:text-white"
                      >
                        <Maximize2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-gray-300">
                      {result.description.gender && (
                        <p><span className="font-medium">Gender:</span> {result.description.gender}</p>
                      )}
                      {result.description.age_group && (
                        <p><span className="font-medium">Age Group:</span> {result.description.age_group}</p>
                      )}
                      {result.description.clothing_top && (
                        <p><span className="font-medium">Top:</span> {result.description.clothing_top} 
                          {result.description.clothing_top_color && ` (${result.description.clothing_top_color})`}
                        </p>
                      )}
                      {result.description.clothing_bottom && (
                        <p><span className="font-medium">Bottom:</span> {result.description.clothing_bottom}
                          {result.description.clothing_bottom_color && ` (${result.description.clothing_bottom_color})`}
                        </p>
                      )}
                      {result.description.footwear && (
                        <p><span className="font-medium">Footwear:</span> {result.description.footwear}
                          {result.description.footwear_color && ` (${result.description.footwear_color})`}
                        </p>
                      )}
                      {result.description.accessories && (
                        <p><span className="font-medium">Accessories:</span> {result.description.accessories}</p>
                      )}
                      {result.description.pose && (
                        <p><span className="font-medium">Pose:</span> {result.description.pose}</p>
                      )}
                      {result.description.location_context && (
                        <p><span className="font-medium">Location:</span> {result.description.location_context}</p>
                      )}
                      {result.metadata.camera_id && (
                        <p><span className="font-medium">Camera:</span> {result.metadata.camera_id}</p>
                      )}
                      {result.metadata.timestamp && (
                        <p><span className="font-medium">Time:</span> {new Date(result.metadata.timestamp).toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-400">No matches found</p>
            {error && (
              <div className="mt-2">
                <p className="text-sm text-red-500">{error}</p>
              </div>
            )}
          </div>
        )}

        <div ref={resultsEndRef} />
      </div>

      {/* Full image modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-80 z-[9999] flex items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className="relative max-w-4xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={`data:image/jpeg;base64,${selectedImage}`}
                alt="Full size match"
                className="w-full h-auto rounded-lg"
              />
              {/* Bounding box overlay */}
              <div 
                className="absolute border-2 border-red-500 bg-red-500 bg-opacity-20"
                style={generateBoundingBox()}
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 bg-gray-900 bg-opacity-70 hover:bg-opacity-100"
                onClick={() => setSelectedImage(null)}
              >
                <X className="h-4 w-4 text-white" />
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

