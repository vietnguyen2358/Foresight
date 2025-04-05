"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Loader2, Maximize2, X } from "lucide-react"
import { Card } from "@/components/ui/card"
import { searchPerson, type SearchResult } from "@/lib/api"
import { motion, AnimatePresence } from "framer-motion"
import MatchSidebar from "./MatchSidebar"

export default function SearchSection() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const resultsEndRef = useRef<HTMLDivElement>(null)

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
      const searchResults = await searchPerson(query)
      setResults(searchResults)
      
      // Check if we have high similarity matches to show the sidebar
      const hasHighSimilarityMatches = searchResults.matches?.some(match => match.similarity > 70);
      setShowSidebar(hasHighSimilarityMatches);
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
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        )}

        {!isLoading && results && (
          <AnimatePresence>
            {results.matches && results.matches.length > 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <h3 className="text-lg font-medium text-white">
                  Found {results.matches.length} potential match{results.matches.length > 1 ? "es" : ""}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {results.matches.map((match, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 * index, duration: 0.3 }}
                    >
                      <Card className="bg-gray-800 border-gray-700 overflow-hidden">
                        {match.image_data && (
                          <div className="relative h-48 w-full">
                            <img
                              src={`data:image/jpeg;base64,${match.image_data}`}
                              alt={`Match ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                            {/* Bounding box overlay */}
                            <div 
                              className="absolute border-2 border-red-500 bg-red-500 bg-opacity-20"
                              style={generateBoundingBox()}
                            />
                            <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                              {match.similarity.toFixed(1)}% Match
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-2 left-2 bg-gray-900 bg-opacity-70 hover:bg-opacity-100"
                              onClick={() => match.image_data ? setSelectedImage(match.image_data) : null}
                            >
                              <Maximize2 className="h-4 w-4 text-white" />
                            </Button>
                          </div>
                        )}
                        <div className="p-4">
                          <h4 className="font-medium text-white mb-2">Match #{index + 1}</h4>
                          <div className="text-sm text-gray-300 space-y-1">
                            <p><span className="font-medium">Gender:</span> {match.description.gender || "N/A"}</p>
                            <p><span className="font-medium">Age:</span> {match.description.age_group || "N/A"}</p>
                            <p>
                              <span className="font-medium">Clothing:</span>{" "}
                              {match.description.clothing_top || "N/A"} ({match.description.clothing_top_color || "N/A"})
                            </p>
                            {match.description.clothing_bottom && (
                              <p>
                                <span className="font-medium">Bottom:</span>{" "}
                                {match.description.clothing_bottom} ({match.description.clothing_bottom_color || "N/A"})
                              </p>
                            )}
                            {match.description.accessories && Array.isArray(match.description.accessories) && match.description.accessories.length > 0 && (
                              <p>
                                <span className="font-medium">Accessories:</span>{" "}
                                {match.description.accessories.join(", ")}
                              </p>
                            )}
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="text-center py-8"
              >
                <h3 className="text-lg font-medium text-white mb-2">No matches found</h3>
                <p className="text-gray-400">
                  Try a different search term or be more specific about the person you're looking for.
                </p>
                {results.suggestions && results.suggestions.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-white mb-2">Suggestions:</h4>
                    <ul className="text-sm text-gray-400 space-y-1">
                      {results.suggestions.map((suggestion, index) => (
                        <li key={index}>{suggestion}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}

        <div ref={resultsEndRef} />
      </div>

      {/* Match Sidebar */}
      <MatchSidebar 
        searchResults={results}
        isVisible={showSidebar}
        onClose={() => setShowSidebar(false)}
      />
      
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

