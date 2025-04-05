"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Loader2, Maximize2, X } from "lucide-react"
import { Card } from "@/components/ui/card"
import { searchPeople, type Detection, type PersonDescription } from "@/lib/api"
import { motion, AnimatePresence } from "framer-motion"
import { useCamera } from "@/lib/CameraContext"

export default function SearchSection() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<{
    query: string;
    matches: Array<{
      description: PersonDescription;
      similarity: number;
      image_data?: string;
      camera_id?: string;
    }>;
    message?: string;
    suggestions?: string[];
    camera_id?: string;
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const resultsEndRef = useRef<HTMLDivElement>(null)
  const { setSelectedCamera, cameras } = useCamera()

  const scrollToBottom = () => {
    resultsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [results])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setIsLoading(true)
    try {
      const searchResults = await searchPeople(query)
      setResults(searchResults)

      // If we have a match with a camera ID, select that camera
      if (searchResults.matches?.[0]?.camera_id) {
        const cameraId = searchResults.matches[0].camera_id
        const camera = cameras.find(c => c.id === cameraId)
        if (camera) {
          setSelectedCamera(camera)
          // Optionally scroll to the camera view
          const cameraElement = document.getElementById(`camera-${cameraId}`)
          if (cameraElement) {
            cameraElement.scrollIntoView({ behavior: 'smooth' })
          }
        }
      }
    } catch (error) {
      console.error("Search error:", error)
      setResults({
        query: query,
        matches: [],
        suggestions: ["Try a different search term", "Be more specific about the person you're looking for"]
      })
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
    <div className="flex flex-col h-full bg-gray-900">
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-lg font-semibold text-white">Search for People</h2>
        <p className="text-sm text-gray-400">Describe the person you're looking for</p>
      </div>

      <div className="p-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., man wearing red shirt and blue jeans"
            disabled={isLoading}
            className="flex-1 bg-gray-900 border-gray-800 text-white focus-visible:ring-blue-600"
          />
          <Button 
            type="submit" 
            disabled={isLoading || !query.trim()} 
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
        {results && (
          <div className="space-y-4">
            {results.matches.length > 0 ? (
              results.matches.map((match, index) => (
                <Card key={index} className="bg-gray-800 border-gray-700 p-4">
                  <div className="space-y-4">
                    {match.image_data && (
                      <div className="relative">
                        <img
                          src={`data:image/jpeg;base64,${match.image_data}`}
                          alt={`Match ${index + 1}`}
                          className="w-full h-auto rounded-lg"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedImage(match.image_data)}
                          className="absolute top-2 right-2 text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-700/50"
                        >
                          <Maximize2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    {match.camera_id && (
                      <div className="bg-blue-900/50 text-blue-100 px-3 py-2 rounded-md text-sm">
                        Found on Camera {match.camera_id}
                      </div>
                    )}
                  </div>
                </Card>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-400">No matches found</p>
                {results.suggestions && (
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">Suggestions:</p>
                    <ul className="list-disc list-inside text-sm text-gray-400">
                      {results.suggestions.map((suggestion, index) => (
                        <li key={index}>{suggestion}</li>
                      ))}
                    </ul>
                  </div>
                )}
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
            className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4"
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
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedImage(null)}
                className="absolute top-2 right-2 text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-700/50"
              >
                <X className="h-4 w-4" />
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

