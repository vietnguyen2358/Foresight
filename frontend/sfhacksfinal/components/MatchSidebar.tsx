import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, ChevronRight, ChevronLeft, Maximize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { PersonDescription, SearchResult } from "@/lib/api"
import { API_BASE_URL } from "@/lib/api"

interface MatchSidebarProps {
  searchResults: SearchResult | null
  isVisible: boolean
  onClose: () => void
}

export default function MatchSidebar({ searchResults, isVisible, onClose }: MatchSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState<{ description: PersonDescription; similarity: number } | null>(null)
  const [showFullImage, setShowFullImage] = useState(false)
  const [imageLoadError, setImageLoadError] = useState<string | null>(null)

  // Debug image loading
  useEffect(() => {
    if (searchResults?.matches) {
      console.log("Search results in MatchSidebar:", searchResults);
      searchResults.matches.forEach((match, index) => {
        if (match.description.cropped_image) {
          console.log(`Match ${index} has cropped image data`);
        } else if (match.description.image) {
          const imageUrl = `${API_BASE_URL}/${match.description.image}`;
          console.log(`Match ${index} image URL:`, imageUrl);
          
          // Test if image is accessible
          fetch(imageUrl)
            .then(response => {
              if (!response.ok) {
                console.error(`Image load error for match ${index}:`, response.status, response.statusText);
                setImageLoadError(`Failed to load image: ${response.status} ${response.statusText}`);
              } else {
                console.log(`Image ${index} is accessible`);
              }
            })
            .catch(error => {
              console.error(`Image fetch error for match ${index}:`, error);
              setImageLoadError(`Error fetching image: ${error.message}`);
            });
        }
      });
    }
  }, [searchResults]);

  const generateBoundingBox = () => {
    if (!selectedMatch?.description.boundingBox) return {}
    
    const { x1, y1, x2, y2 } = selectedMatch.description.boundingBox
    const width = x2 - x1
    const height = y2 - y1
    
    return {
      left: `${x1 * 100}%`,
      top: `${y1 * 100}%`,
      width: `${width * 100}%`,
      height: `${height * 100}%`,
    }
  }

  const formatMatchDescription = (match: { description: PersonDescription; similarity: number }) => {
    const { description, similarity } = match
    let text = `Similarity: ${(similarity * 100).toFixed(1)}%\n\n`
    
    if (description.appearance) text += `Appearance: ${description.appearance}\n`
    if (description.clothing) text += `Clothing: ${description.clothing}\n`
    if (description.accessories) text += `Accessories: ${description.accessories}\n`
    if (description.actions) text += `Actions: ${description.actions}\n`
    if (description.location) text += `Location: ${description.location}\n`
    if (description.timestamp) text += `Last seen: ${new Date(description.timestamp).toLocaleString()}\n`
    if (description.camera_id) text += `Camera: ${description.camera_id}\n`
    
    return text
  }

  // Handle image load errors
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>, index: number) => {
    const imgElement = e.currentTarget;
    const src = imgElement.src;
    console.error(`Image load error for match ${index}:`, {
      src,
      naturalWidth: imgElement.naturalWidth,
      naturalHeight: imgElement.naturalHeight,
      complete: imgElement.complete
    });
    
    // Set a more descriptive error message
    setImageLoadError(`Failed to load image for match ${index + 1}. Source: ${src.split('/').pop()}`);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: isCollapsed ? "calc(100% - 48px)" : "0" }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed right-0 top-0 h-full w-96 bg-gray-900 shadow-xl z-50"
        >
          <div className="flex h-full">
            {/* Collapse/Expand button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              {isCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>

            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-12 text-gray-400 hover:text-white"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              <h3 className="text-lg font-medium text-white mb-4">Search Results</h3>
              
              {imageLoadError && (
                <div className="mb-4 p-2 bg-red-900 text-red-100 rounded text-sm">
                  {imageLoadError}
                </div>
              )}
              
              {/* Matches list */}
              <div className="space-y-4">
                {searchResults?.matches.map((match, index) => (
                  <Card
                    key={index}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedMatch === match
                        ? "bg-blue-600 text-white"
                        : "bg-gray-800 text-gray-100 hover:bg-gray-700"
                    }`}
                    onClick={() => setSelectedMatch(match)}
                  >
                    <div className="flex items-start gap-4">
                      {match.description.cropped_image ? (
                        <div className="relative h-16 w-16 flex-shrink-0">
                          <img
                            src={match.description.cropped_image}
                            alt={`Match ${index + 1}`}
                            className="w-full h-full object-cover rounded"
                            onError={(e) => handleImageError(e, index)}
                          />
                        </div>
                      ) : match.description.image ? (
                        <div className="relative h-16 w-16 flex-shrink-0">
                          <img
                            src={`${API_BASE_URL}/${match.description.image}`}
                            alt={`Match ${index + 1}`}
                            className="w-full h-full object-cover rounded"
                            onError={(e) => handleImageError(e, index)}
                          />
                        </div>
                      ) : (
                        <div className="relative h-16 w-16 flex-shrink-0 bg-gray-700 rounded flex items-center justify-center">
                          <span className="text-xs text-gray-400">No image</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium truncate">
                            Match {index + 1} ({(match.similarity * 100).toFixed(1)}% similar)
                          </p>
                          {match.description.camera_id && (
                            <span className="text-xs bg-blue-900 text-blue-100 px-2 py-1 rounded">
                              Camera {match.description.camera_id}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-300 truncate">
                          {match.description.appearance || "No description available"}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Selected match details */}
              {selectedMatch && (
                <div className="mt-6 p-4 bg-gray-800 rounded-lg">
                  <h4 className="text-lg font-medium text-white mb-4">Match Details</h4>
                  {selectedMatch.description.cropped_image ? (
                    <div className="relative h-64 w-full mb-4">
                      <img
                        src={selectedMatch.description.cropped_image}
                        alt="Selected Match"
                        className="w-full h-full object-cover rounded-lg"
                        onError={(e) => handleImageError(e, -1)}
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
                  ) : selectedMatch.description.image ? (
                    <div className="relative h-64 w-full mb-4">
                      <img
                        src={`${API_BASE_URL}/${selectedMatch.description.image}`}
                        alt="Selected Match"
                        className="w-full h-full object-cover rounded-lg"
                        onError={(e) => handleImageError(e, -1)}
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
                  ) : (
                    <div className="relative h-64 w-full mb-4 bg-gray-700 rounded-lg flex items-center justify-center">
                      <span className="text-gray-400">No image available</span>
                    </div>
                  )}
                  <div className="space-y-2 text-sm">
                    <p><span className="text-gray-400">Appearance:</span> {selectedMatch.description.appearance}</p>
                    <p><span className="text-gray-400">Clothing:</span> {selectedMatch.description.clothing}</p>
                    <p><span className="text-gray-400">Accessories:</span> {selectedMatch.description.accessories}</p>
                    <p><span className="text-gray-400">Actions:</span> {selectedMatch.description.actions}</p>
                    <p><span className="text-gray-400">Location:</span> {selectedMatch.description.location}</p>
                    <p><span className="text-gray-400">Last seen:</span> {selectedMatch.description.timestamp ? new Date(selectedMatch.description.timestamp).toLocaleString() : 'Unknown'}</p>
                    {selectedMatch.description.camera_id && (
                      <p><span className="text-gray-400">Camera:</span> {selectedMatch.description.camera_id}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Full image modal */}
          <AnimatePresence>
            {showFullImage && selectedMatch?.description.cropped_image && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black bg-opacity-80 z-[9999] flex items-center justify-center p-4"
                onClick={() => setShowFullImage(false)}
              >
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.8 }}
                  className="relative max-w-4xl w-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  <img
                    src={selectedMatch.description.cropped_image}
                    alt="Full size match"
                    className="w-full h-auto rounded-lg"
                  />
                  {/* Bounding box overlay */}
                  {selectedMatch.description.boundingBox && (
                    <div 
                      className="absolute border-2 border-red-500 bg-red-500 bg-opacity-20"
                      style={generateBoundingBox()}
                    />
                  )}
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
        </motion.div>
      )}
    </AnimatePresence>
  )
} 