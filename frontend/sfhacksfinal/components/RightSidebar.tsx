"use client"

import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Phone, Camera, Activity, X, Search, Send } from "lucide-react"
import { useCamera } from "@/lib/CameraContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  uploadImage, 
  searchPeople, 
  chatWithAI, 
  Detection, 
  PersonDescription,
  ChatResponse,
  uploadImageStream,
  API_BASE_URL
} from "@/lib/api"

// Define local interface to extend PersonDescription
interface ExtendedPersonDescription extends PersonDescription {
  yoloCrop?: string;
  gender?: string;
  age_group?: string;
  clothing_top?: string;
  clothing_bottom?: string;
  similarity?: number;
  camera_id?: string;
}

export default function RightSidebar() {
  const { selectedCamera, setSelectedCamera } = useCamera()
  const [transcription, setTranscription] = useState([
    { id: 1, speaker: "Operator", text: "911, what's your emergency?", timestamp: "10:30:15" },
    { id: 2, speaker: "Caller", text: "There's a suspicious person near the park.", timestamp: "10:30:20" },
    { id: 3, speaker: "Operator", text: "Can you describe what they look like?", timestamp: "10:30:25" },
  ])

  const [detections, setDetections] = useState<Detection[]>([])
  const [personDescriptions, setPersonDescriptions] = useState<ExtendedPersonDescription[]>([])
  const [cameraImage, setCameraImage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<ExtendedPersonDescription[]>([])
  const [chatMessages, setChatMessages] = useState<Array<{role: string, content: string}>>([])
  const [chatInput, setChatInput] = useState("")
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null)
  const [showJsonView, setShowJsonView] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState<ExtendedPersonDescription | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const processingRef = useRef<boolean>(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null)
  const [cameraFeed, setCameraFeed] = useState<string | null>(null)

  // Simulate camera feed updates and YOLO processing
  useEffect(() => {
    if (!selectedCamera) return

    // Set camera image based on selected camera
    if (selectedCamera.id === "SF-MKT-001") {
      setCameraImage("/images/image.jpg")
    } else {
      // For other cameras, use a random image
      setCameraImage(`https://picsum.photos/seed/${selectedCamera.id}/800/450`)
    }

    // Clear any existing interval
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current)
    }

    // Check if server is available
    const checkServer = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/health`)
        return response.ok
      } catch (err) {
        console.error('Server health check failed:', err)
        return false
      }
    }

    // Process new frames every 3 seconds
    frameIntervalRef.current = setInterval(async () => {
      // Check server health before processing
      const isServerAvailable = await checkServer()
      if (!isServerAvailable) {
        console.error('Server is not available')
        setError('Server is not responding. Please try again later.')
        return
      }

      // Generate a new frame URL
      const frameUrl = selectedCamera.id === "SF-MKT-001" 
        ? "/images/image.jpg" 
        : `https://picsum.photos/seed/${Date.now()}/800/450`
      
      setCameraImage(frameUrl)
      
      // Process the frame with YOLO
      if (!processingRef.current) {
        processingRef.current = true
        processCameraFrame(frameUrl)
          .catch(err => {
            console.error('Error processing frame:', err)
            setError('Failed to process camera frame. Please try again later.')
          })
          .finally(() => {
            processingRef.current = false
          })
      }
    }, 3000)

    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current)
      }
    }
  }, [selectedCamera])

  // Process camera frame
  const processCameraFrame = async (frameUrl: string) => {
    try {
      setIsProcessing(true)
      setError(null)
      
      console.log('Processing camera frame:', frameUrl)
      
      // Extract camera ID from the URL or use the selected camera ID
      let cameraId = selectedCamera?.id || 'unknown'
      
      // If it's a random image, extract a seed from the URL
      if (frameUrl.includes('picsum.photos/seed/')) {
        const seedMatch = frameUrl.match(/seed\/([^/]+)/)
        if (seedMatch && seedMatch[1]) {
          cameraId = `CAM-${seedMatch[1].substring(0, 8)}`
        }
      }
      
      console.log('Camera ID:', cameraId)
      
      // Try to fetch the image, with fallback to picsum.photos if local image fails
      let response: Response;
      try {
        response = await fetch(frameUrl)
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
        }
      } catch (err) {
        console.warn('Failed to fetch local image, using fallback:', err)
        // Use picsum.photos as fallback
        response = await fetch(`https://picsum.photos/seed/${Math.random()}/800/450`)
        if (!response.ok) {
          throw new Error(`Failed to fetch fallback image: ${response.status} ${response.statusText}`)
        }
      }
      
      const blob = await response.blob()
      
      // Create a File object from the blob with camera-specific name
      const file = new File([blob], `${cameraId}.jpg`, { type: "image/jpeg" })
      
      // Use the uploadImage function to process the frame with camera ID
      const result = await uploadImage(file, false, cameraId)
      console.log('Upload result for camera', cameraId, ':', result)
      
      if (!result || !result.descriptions) {
        throw new Error('No descriptions returned from server')
      }
      
      // Update state with new detections and descriptions
      setDetections(result.detections || [])
      setPersonDescriptions(result.descriptions as ExtendedPersonDescription[])
      
      console.log('Updated person descriptions for camera', cameraId, ':', result.descriptions)
    } catch (err) {
      console.error('Error processing camera frame:', err)
      setError(err instanceof Error ? err.message : 'Failed to process camera frame')
    } finally {
      setIsProcessing(false)
    }
  }

  // Handle detection click
  const handleDetectionClick = (detection: Detection) => {
    setSelectedDetection(detection)
    setShowJsonView(true)
  }

  // Handle person description click
  const handlePersonClick = (person: ExtendedPersonDescription) => {
    setSelectedPerson(person)
    setShowJsonView(true)
  }

  // Close JSON view
  const closeJsonView = () => {
    setShowJsonView(false)
    setSelectedDetection(null)
    setSelectedPerson(null)
  }

  // Handle search
  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    
    setIsLoading(true)
    try {
      // Use the actual API
      const result = await searchPeople(searchQuery)
      setSearchResults(result.matches.map(match => match.description) as ExtendedPersonDescription[])
    } catch (error) {
      console.error("Search error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle chat
  const handleChat = async () => {
    if (!chatInput.trim()) return
    
    const newMessage = { role: "user", content: chatInput }
    setChatMessages(prev => [...prev, newMessage])
    setChatInput("")
    
    setIsLoading(true)
    try {
      // Use the actual API
      const result = await chatWithAI([...chatMessages, newMessage])
      setChatMessages(prev => [...prev, { role: "assistant", content: result.response }])
    } catch (error) {
      console.error("Chat error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    
    const file = e.target.files[0];
    setIsLoading(true);
    setError(null);
    
    try {
      // Create a URL for the uploaded image
      const imageUrl = URL.createObjectURL(file);
      setCameraFeed(imageUrl);
      
      // Clear previous detections and descriptions
      setDetections([]);
      setPersonDescriptions([]);
      
      // Use the streaming API to process the image
      const abortStream = uploadImageStream(
        file,
        false,
        // Handle each person as it's processed
        (detection, description) => {
          // Add the detection to the list
          setDetections(prev => [...prev, detection]);
          
          // Add the description to the list
          setPersonDescriptions(prev => [...prev, description as ExtendedPersonDescription]);
        },
        // Handle completion
        (count) => {
          console.log(`Processing complete. Found ${count} people.`);
          setIsLoading(false);
        },
        // Handle errors
        (errorMessage) => {
          console.error('Error processing file:', errorMessage);
          setError('Failed to process file. Please try again.');
          setIsLoading(false);
        }
      );
      
      // Clear the file input
      e.target.value = '';
      
      // Return a cleanup function to abort the stream if needed
      return () => {
        abortStream();
      };
    } catch (err) {
      console.error('Error processing file:', err);
      setError('Failed to process file. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-800 h-screen overflow-y-auto">
      {/* Phone Call Transcription */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center space-x-2 mb-4">
          <Phone className="h-5 w-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-white">Live Call Transcription</h2>
        </div>
        <div className="space-y-3">
          {transcription.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-gray-800 rounded-lg p-3"
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-blue-400">{entry.speaker}</span>
                <span className="text-xs text-gray-400">{entry.timestamp}</span>
              </div>
              <p className="text-sm text-gray-300">{entry.text}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Camera Feed Section */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold text-white">Camera Feed</h2>
          {selectedCamera && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setSelectedCamera(null)}
              className="text-gray-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        {selectedCamera ? (
          <div>
            <p className="text-sm text-gray-400 mb-2">
              {selectedCamera.name} ({selectedCamera.id})
              <span className="ml-2 text-red-500 flex items-center">
                <span className="relative flex h-3 w-3 mr-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                LIVE
              </span>
            </p>
            {cameraImage ? (
              <div className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden">
                <img 
                  src={cameraImage} 
                  alt={`Camera feed from ${selectedCamera.name}`} 
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center">
                  <span className="relative flex h-2 w-2 mr-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                  LIVE
                </div>
              </div>
            ) : (
              <div className="aspect-video bg-gray-800 rounded-lg flex items-center justify-center">
                <p className="text-gray-400">Loading camera feed...</p>
              </div>
            )}
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-400 mb-4">Select a camera on the map to view live feed</p>
          </div>
        )}
      </div>

      {/* Live Detections - Only show when a camera is selected */}
      {selectedCamera && (
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center space-x-2 mb-4">
            <Activity className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Live Detections</h2>
          </div>
          <div className="space-y-2">
            {isProcessing ? (
              <p>Processing frame...</p>
            ) : error ? (
              <p className="error">{error}</p>
            ) : detections.length > 0 ? (
              detections.map((detection) => (
                <motion.div
                  key={detection.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`bg-gray-800 rounded-lg p-3 ${detection.type === "Person" ? "cursor-pointer hover:bg-gray-700" : ""}`}
                  onClick={() => detection.type === "Person" && handleDetectionClick(detection)}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-white">{detection.type}</span>
                    <span className="text-xs text-gray-400">{detection.timestamp}</span>
                  </div>
                  <div className="mt-1 flex items-center">
                    <div className="w-full bg-gray-700 rounded-full h-1.5">
                      <div 
                        className="bg-blue-500 h-1.5 rounded-full" 
                        style={{ width: `${detection.confidence * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-400 ml-2">{Math.round(detection.confidence * 100)}%</span>
                  </div>
                  <div className="text-xs text-blue-400 mt-1">
                    Camera: {detection.camera_id || selectedCamera?.id || 'Unknown'}
                  </div>
                  {detection.image && (
                    <div className="mt-2 rounded overflow-hidden">
                      <img 
                        src={detection.image} 
                        alt={`${detection.type} detection`} 
                        className="w-full h-20 object-cover"
                      />
                    </div>
                  )}
                </motion.div>
              ))
            ) : (
              <p className="text-sm text-gray-400">No detections yet. Processing frames...</p>
            )}
          </div>
        </div>
      )}

      {/* Person Descriptions - Only show when a camera is selected */}
      {selectedCamera && personDescriptions.length > 0 && (
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center space-x-2 mb-4">
            <Search className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Person Descriptions</h2>
          </div>
          <div className="space-y-2">
            {personDescriptions.map((person, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-gray-800 rounded-lg p-3 cursor-pointer hover:bg-gray-700"
                onClick={() => handlePersonClick(person)}
              >
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-white">Person {index + 1}</span>
                  <span className="text-xs text-gray-400">{person.timestamp}</span>
                </div>
                <div className="mt-2 text-sm text-gray-300">
                  <p><span className="text-gray-400">Appearance:</span> {person.appearance}</p>
                  <p><span className="text-gray-400">Clothing:</span> {person.clothing}</p>
                  <p><span className="text-gray-400">Accessories:</span> {person.accessories}</p>
                  <p><span className="text-gray-400">Actions:</span> {person.actions}</p>
                  <p><span className="text-gray-400">Location:</span> {person.location}</p>
                  <p><span className="text-gray-400">Camera:</span> {person.camera_id || selectedCamera?.id || 'Unknown'}</p>
                </div>
                {/* Add image display */}
                {person.image && (
                  <div className="mt-3 rounded overflow-hidden">
                    <img 
                      src={`${API_BASE_URL}/${person.image}`}
                      alt={`Person ${index + 1}`} 
                      className="w-full h-32 object-cover"
                    />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Search Section - Only show when a camera is selected */}
      {selectedCamera && (
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center space-x-2 mb-4">
            <Search className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Search</h2>
          </div>
          <div className="flex space-x-2 mb-4">
            <Input
              placeholder="Search for people..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white"
            />
            <Button 
              variant="outline" 
              size="icon"
              onClick={handleSearch}
              disabled={!searchQuery.trim() || isLoading}
              className="text-gray-400 hover:text-white"
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
          {searchResults.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-white">Results</h3>
              {searchResults.map((result, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="bg-gray-800 rounded-lg p-3 cursor-pointer hover:bg-gray-700"
                  onClick={() => handlePersonClick(result)}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-white">Match {index + 1}</span>
                    <span className="text-xs text-gray-400">{result.timestamp}</span>
                  </div>
                  <div className="text-xs text-gray-300 space-y-1">
                    <p><span className="text-blue-400">Appearance:</span> {result.appearance}</p>
                    <p><span className="text-blue-400">Clothing:</span> {result.clothing}</p>
                    <p><span className="text-blue-400">Accessories:</span> {result.accessories}</p>
                    <p><span className="text-blue-400">Actions:</span> {result.actions}</p>
                    <p><span className="text-blue-400">Location:</span> {result.location}</p>
                  </div>
                  {/* YOLO crop preview for search results */}
                  {result.yoloCrop && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-400 mb-1">YOLO Detection:</p>
                      <div className="relative w-full h-24 bg-gray-900 rounded overflow-hidden">
                        <img 
                          src={result.yoloCrop} 
                          alt={`Match ${index + 1} YOLO detection`} 
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute inset-0 border-2 border-red-500 border-dashed"></div>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">Search Results</h3>
          <div className="space-y-2">
            {searchResults.map((result, index) => (
              <div
                key={index}
                className="p-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  setSelectedPerson(result);
                  setShowJsonView(true);
                }}
              >
                <div className="flex items-start gap-3">
                  {result.yoloCrop && (
                    <img
                      src={result.yoloCrop}
                      alt="Person crop"
                      className="w-16 h-16 object-cover rounded"
                    />
                  )}
                  <div>
                    <p className="font-medium">{result.gender} - {result.age_group}</p>
                    <p className="text-sm text-gray-600">{result.clothing_top} with {result.clothing_bottom}</p>
                    <p className="text-xs text-gray-500">Similarity: {result.similarity}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* JSON View Modal */}
      {showJsonView && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-semibold">Details</h3>
              <button
                onClick={() => setShowJsonView(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {selectedDetection && (
              <div className="mb-6">
                <h4 className="font-medium mb-2">Detection</h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <pre className="text-sm overflow-x-auto">
                    {JSON.stringify({
                      ...selectedDetection,
                      camera_id: selectedDetection.camera_id || selectedCamera?.id || 'Unknown'
                    }, null, 2)}
                  </pre>
                </div>
              </div>
            )}
            
            {selectedPerson && (
              <div>
                <h4 className="font-medium mb-2">Person Description</h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <pre className="text-sm overflow-x-auto">
                    {JSON.stringify({
                      ...selectedPerson,
                      camera_id: selectedPerson.camera_id || selectedCamera?.id || 'Unknown'
                    }, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Person Descriptions */}
      {personDescriptions.length > 0 && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">Person Descriptions</h3>
          <div className="space-y-2">
            {personDescriptions.map((person, index) => (
              <div
                key={index}
                className="p-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  setSelectedPerson(person);
                  setShowJsonView(true);
                }}
              >
                <div className="flex items-start gap-3">
                  {person.yoloCrop && (
                    <img
                      src={person.yoloCrop}
                      alt="Person crop"
                      className="w-16 h-16 object-cover rounded"
                    />
                  )}
                  <div>
                    <p className="font-medium">{person.appearance}</p>
                    <p className="text-sm text-gray-600">{person.clothing}</p>
                    <p className="text-xs text-gray-500">
                      {person.hair && person.hair !== "unknown" && `Hair: ${person.hair} • `}
                      {person.facial_features && person.facial_features !== "none" && `Facial: ${person.facial_features} • `}
                      {person.footwear && person.footwear !== "unknown" && `Footwear: ${person.footwear}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      {person.accessories && person.accessories !== "none" && `Accessories: ${person.accessories} • `}
                      {person.bag && person.bag !== "none" && `Bag: ${person.bag} • `}
                      {person.pose && person.pose !== "unknown" && `${person.pose} • `}
                      {person.location && person.location !== "unknown" && person.location}
                    </p>
                    <p className="text-xs text-blue-400 mt-1">
                      Camera: {person.camera_id || selectedCamera?.id || 'Unknown'} • {person.timestamp}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}