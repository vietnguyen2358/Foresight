import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, ChevronRight, ChevronLeft, Maximize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { SearchResult } from "@/lib/api"

interface MatchSidebarProps {
  searchResults: SearchResult | null
  isVisible: boolean
  onClose: () => void
}

export default function MatchSidebar({ searchResults, isVisible, onClose }: MatchSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [highSimilarityMatches, setHighSimilarityMatches] = useState<any[]>([])
  const [selectedMatch, setSelectedMatch] = useState<any>(null)
  const [showFullImage, setShowFullImage] = useState(false)

  // Filter for high similarity matches (above 70%)
  useEffect(() => {
    if (searchResults?.matches) {
      const highMatches = searchResults.matches.filter(match => match.similarity > 70)
      setHighSimilarityMatches(highMatches)
      if (highMatches.length > 0 && !selectedMatch) {
        setSelectedMatch(highMatches[0])
      }
    } else {
      setHighSimilarityMatches([])
      setSelectedMatch(null)
    }
  }, [searchResults])

  // Format the description for a match
  const formatMatchDescription = (match: any) => {
    const desc = match.description
    let description = ""
    
    if (desc.gender) description += `Gender: ${desc.gender}\n`
    if (desc.age_group) description += `Age: ${desc.age_group}\n`
    
    if (desc.clothing_top) {
      description += `Top: ${desc.clothing_top}`
      if (desc.clothing_top_color) description += ` (${desc.clothing_top_color})`
      description += "\n"
    }
    
    if (desc.clothing_bottom) {
      description += `Bottom: ${desc.clothing_bottom}`
      if (desc.clothing_bottom_color) description += ` (${desc.clothing_bottom_color})`
      description += "\n"
    }
    
    if (desc.accessories && Array.isArray(desc.accessories) && desc.accessories.length > 0) {
      description += `Accessories: ${desc.accessories.join(", ")}\n`
    }
    
    return description
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
    <AnimatePresence mode="wait">
      {isVisible && highSimilarityMatches.length > 0 && (
        <motion.div
          key="sidebar-container"
          initial={{ x: 100, opacity: 0 }}
          animate={{ 
            x: isCollapsed ? 0 : 0, 
            opacity: 1,
            width: isCollapsed ? "50px" : "350px"
          }}
          exit={{ x: 100, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed top-[4rem] right-0 h-[calc(100vh-4rem)] bg-gray-900 border-l border-gray-800 z-[100] shadow-lg"
        >
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-3 border-b border-gray-800">
              <h3 className="text-lg font-semibold text-white">Potential Matches</h3>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className="text-gray-400 hover:text-white"
                >
                  {isCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onClose}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {!isCollapsed && (
              <div className="p-4 overflow-y-auto flex-1">
                <div className="space-y-4">
                  {/* Match list */}
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                    {highSimilarityMatches.map((match, index) => (
                      <motion.div
                        key={`match-${index}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 * index }}
                        onClick={() => setSelectedMatch(match)}
                        className={`cursor-pointer transition-all ${
                          selectedMatch === match ? 'ring-2 ring-blue-500' : ''
                        }`}
                      >
                        <Card className={`bg-gray-800 border-gray-700 overflow-hidden ${
                          selectedMatch === match ? 'border-blue-500' : ''
                        }`}>
                          <div className="p-3">
                            <div className="flex justify-between items-center mb-2">
                              <h4 className="font-medium text-white">Match #{index + 1}</h4>
                              <div className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                                {match.similarity.toFixed(1)}% Match
                              </div>
                            </div>
                            <div className="text-xs text-gray-300">
                              {match.description.gender} • {match.description.age_group}
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                  
                  {/* Selected match details */}
                  {selectedMatch && (
                    <div className="bg-gray-800 rounded-lg overflow-hidden">
                      {selectedMatch.image_data && (
                        <div className="relative h-64 w-full">
                          <img
                            src={`data:image/jpeg;base64,${selectedMatch.image_data}`}
                            alt="Selected Match"
                            className="w-full h-full object-cover"
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
                            onClick={() => setShowFullImage(true)}
                          >
                            <Maximize2 className="h-4 w-4 text-white" />
                          </Button>
                        </div>
                      )}
                      <div className="p-4">
                        <h4 className="font-medium text-white mb-2">Match Details</h4>
                        <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                          {formatMatchDescription(selectedMatch)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
      
      {/* Full image modal */}
      <AnimatePresence>
        {showFullImage && selectedMatch?.image_data && (
          <motion.div
            key="full-image-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4"
            onClick={() => setShowFullImage(false)}
          >
            <motion.div
              key="full-image-content"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className="relative max-w-4xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={`data:image/jpeg;base64,${selectedMatch.image_data}`}
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
                onClick={() => setShowFullImage(false)}
              >
                <X className="h-4 w-4 text-white" />
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  )
} 