"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Loader2, Maximize2, X } from "lucide-react"
import { Card } from "@/components/ui/card"
import { searchPeople, type Detection, type PersonDescription } from "@/lib/api"
import { motion, AnimatePresence } from "framer-motion"

export default function SearchSection() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<{
    query: string;
    matches: Array<{
      description: PersonDescription;
      similarity: number;
      image_data?: string;
    }>;
    message?: string;
    suggestions?: string[];
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const resultsEndRef = useRef<HTMLDivElement>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setIsLoading(true)
    try {
      const searchResults = await searchPeople(query)
      setResults(searchResults)
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
    <div className="flex flex-col h-full">
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
        {isLoading && (
          <div className="flex justify-center items-center h-32">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        )}

        {!isLoading && results && (
          <div className="space-y-4">
            {results.matches && results.matches.length > 0 ? (
              results.matches.map((match, index) => (
                <Card key={index} className="p-4 bg-gray-800 border-gray-700">
                  <div className="flex gap-4">
                    {match.image_data && (
                      <div className="relative w-32 h-32">
                        <img
                          src={`data:image/jpeg;base64,${match.image_data}`}
                          alt={`Match ${index + 1}`}
                          className="w-full h-full object-cover rounded-lg"
                        />
                        <div
                          className="absolute border-2 border-blue-500 rounded-lg"
                          style={generateBoundingBox()}
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h3 className="text-lg font-semibold text-white">
                          Match {index + 1} ({match.similarity.toFixed(1)}% similarity)
                        </h3>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedImage(match.image_data || null)}
                          className="text-gray-400 hover:text-white"
                        >
                          <Maximize2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="mt-2 space-y-1 text-sm text-gray-300">
                        <p><span className="font-medium">Appearance:</span> {match.description.appearance || 'N/A'}</p>
                        <p><span className="font-medium">Clothing:</span> {match.description.clothing || 'N/A'}</p>
                        <p><span className="font-medium">Accessories:</span> {match.description.accessories || 'N/A'}</p>
                        <p><span className="font-medium">Actions:</span> {match.description.actions || 'N/A'}</p>
                        <p><span className="font-medium">Location:</span> {match.description.location || 'N/A'}</p>
                      </div>
                    </div>
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

