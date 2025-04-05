import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, ChevronRight, ChevronLeft } from "lucide-react"
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

  // Filter for high similarity matches (above 70%)
  useEffect(() => {
    if (searchResults?.matches) {
      const highMatches = searchResults.matches.filter(match => match.similarity > 70)
      setHighSimilarityMatches(highMatches)
    } else {
      setHighSimilarityMatches([])
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
    
    if (desc.accessories && desc.accessories.length > 0) {
      description += `Accessories: ${desc.accessories.join(", ")}\n`
    }
    
    return description
  }

  return (
    <AnimatePresence>
      {isVisible && highSimilarityMatches.length > 0 && (
        <motion.div
          initial={{ x: 100, opacity: 0 }}
          animate={{ 
            x: isCollapsed ? 300 : 0, 
            opacity: 1,
            width: isCollapsed ? "50px" : "300px"
          }}
          exit={{ x: 100, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed right-0 top-0 h-full bg-gray-900 border-l border-gray-800 z-50 shadow-lg"
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
            
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {highSimilarityMatches.map((match, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                >
                  <Card className="bg-gray-800 border-gray-700 overflow-hidden">
                    {match.image_data && (
                      <div className="relative h-40 w-full">
                        <img
                          src={`data:image/jpeg;base64,${match.image_data}`}
                          alt={`Match ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                          {match.similarity.toFixed(1)}% Match
                        </div>
                      </div>
                    )}
                    <div className="p-3">
                      <h4 className="font-medium text-white mb-2">Match #{index + 1}</h4>
                      <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                        {formatMatchDescription(match)}
                      </pre>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
} 