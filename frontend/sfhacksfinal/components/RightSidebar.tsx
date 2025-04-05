"use client"

import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Phone, Camera, Activity, X, Search, Send, Loader2 } from "lucide-react"
import { useCamera } from "@/lib/CameraContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import VideoPlayer from "./VideoPlayer"
import { 
  uploadImage, 
  searchPeople, 
  chatWithAI, 
  Detection, 
  PersonDescription,
  ChatResponse,
  uploadImageStream,
  API_BASE_URL,
  checkServerHealth
} from "@/lib/api"

// Define local interface to extend PersonDescription
interface ExtendedPersonDescription extends PersonDescription {
  id?: string;
  yoloCrop?: string;
  gender?: string;
  age_group?: string;
  clothing_top?: string;
  clothing_bottom?: string;
  similarity?: number;
  camera_id?: string;
  cropped_image?: string;
  raw_data?: Record<string, any>;  // Add raw_data field for Gemini output
  description?: string;  // Add description field for AI model output
  timestamp?: string;    // Add timestamp field for when the description was generated
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
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [lastProcessedFrame, setLastProcessedFrame] = useState<string | null>(null)
  const frameExtractionIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Add a useEffect hook that depends on the selectedCamera state
  useEffect(() => {
    if (selectedCamera) {
      console.log("Selected camera changed in RightSidebar:", selectedCamera);
      
      // Clear any existing intervals
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }
      if (frameExtractionIntervalRef.current) {
        clearInterval(frameExtractionIntervalRef.current);
      }
      
      // Set initial camera image
      if (selectedCamera.id === "SF-MKT-001") {
        // For Market Street camera, we'll use the video player
        setCameraImage(null);
        setCurrentImageUrl(null);
        setIsVideoPlaying(true);
      } else {
        // For other cameras, use random images
        const initialImageUrl = `https://picsum.photos/800/600?random=${Math.random()}`;
        setCameraImage(initialImageUrl);
        setCurrentImageUrl(initialImageUrl);
        setIsVideoPlaying(false);
      }
      
      // Start a new interval to process frames
      frameIntervalRef.current = setInterval(async () => {
        if (processingRef.current) {
          console.log("Skipping frame processing - previous frame still being processed");
          return;
        }
        
        try {
          processingRef.current = true;
          setIsProcessing(true);
          setError(null);
          
          // Check if the server is healthy
          console.log("Checking server health...");
          const isHealthy = await checkServerHealth();
          if (!isHealthy) {
            throw new Error("Server is not healthy - please check the backend server");
          }
          console.log("Server health check passed");
          
          // For Market Street camera, we need a frame from the video
          // This will be handled by the VideoPlayer component
          if (selectedCamera.id === "SF-MKT-001") {
            if (!lastProcessedFrame) {
              console.log("Waiting for video frame...");
              processingRef.current = false;
              setIsProcessing(false);
              return;
            }
            
            // Use the last processed frame
            const frameUrl = lastProcessedFrame;
            console.log("Processing frame for Market Street camera, frame length:", frameUrl.length);
            
            // Process the frame with YOLO
            console.log("Sending frame to API for processing...");
            const response = await fetch(`${API_BASE_URL}/process_frame`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                frame_data: frameUrl
              }),
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error("API error response:", errorText);
              throw new Error(`Failed to process frame: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log("API response:", data);
            console.log("Detections:", data.detections?.length || 0);
            console.log("Descriptions:", data.descriptions?.length || 0);
            
            // Only update detections and descriptions if we have new data
            if (data.detections && data.detections.length > 0) {
              console.log("Updating detections:", data.detections);
              setDetections(data.detections);
            } else {
              console.log("No detections found in this frame");
              // Don't clear existing detections if we don't find new ones
              // This prevents flickering of the UI
            }
            
            if (data.descriptions && data.descriptions.length > 0) {
              console.log("Updating descriptions:", data.descriptions);
              setPersonDescriptions(data.descriptions);
            } else {
              console.log("No descriptions found in this frame");
              // Don't clear existing descriptions if we don't find new ones
              // This prevents flickering of the UI
            }
          } else {
            // For other cameras, use random images
            console.log("Using random images for non-Market Street camera");
            const randomImage = `/images/image${Math.floor(Math.random() * 5) + 1}.jpg`;
            console.log("Selected random image:", randomImage);
            
            // Process the random image with YOLO
            console.log("Sending random image to API for processing...");
            const response = await fetch(`${API_BASE_URL}/process_frame`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                frame_data: randomImage
              }),
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error("API error response:", errorText);
              throw new Error(`Failed to process random image: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log("API response for random image:", data);
            console.log("Detections:", data.detections?.length || 0);
            console.log("Descriptions:", data.descriptions?.length || 0);
            
            // Only update detections and descriptions if we have new data
            if (data.detections && data.detections.length > 0) {
              console.log("Updating detections for random image:", data.detections);
              setDetections(data.detections);
            } else {
              console.log("No detections found in random image");
              // Don't clear existing detections if we don't find new ones
            }
            
            if (data.descriptions && data.descriptions.length > 0) {
              console.log("Updating descriptions for random image:", data.descriptions);
              setPersonDescriptions(data.descriptions);
            } else {
              console.log("No descriptions found in random image");
              // Don't clear existing descriptions if we don't find new ones
            }
          }
          
        } catch (error) {
          console.error("Error processing frame:", error);
          setError(error instanceof Error ? error.message : "Failed to process frame");
          // Don't clear existing detections/descriptions on error
          // This prevents UI flickering
        } finally {
          processingRef.current = false;
          setIsProcessing(false);
        }
      }, 3000); // Process every 3 seconds
      
      // Cleanup function
      return () => {
        if (frameIntervalRef.current) {
          clearInterval(frameIntervalRef.current);
        }
        if (frameExtractionIntervalRef.current) {
          clearInterval(frameExtractionIntervalRef.current);
        }
      };
    }
  }, [selectedCamera, lastProcessedFrame]);

  // Handle frame extraction from video
  const handleFrameExtracted = (frameUrl: string) => {
    console.log("Frame extracted from video, length:", frameUrl.length);
    setLastProcessedFrame(frameUrl);
    
    // Process the frame with YOLO if not already processing
    if (!isProcessing) {
      processFrame(frameUrl);
    } else {
      console.log("Skipping frame processing - still processing previous frame");
    }
  };
  
  // Process a frame with YOLO
  const processFrame = async (frameUrl: string) => {
    if (isProcessing) return;
    
    try {
      setIsProcessing(true);
      setError(null);
      
      // Check if the server is healthy
      console.log("Checking server health...");
      const isHealthy = await checkServerHealth();
      if (!isHealthy) {
        throw new Error("Server is not healthy - please check the backend server");
      }
      console.log("Server health check passed");
      
      // Process the frame with YOLO
      console.log("Sending frame to API for processing...");
      console.log("Frame URL length:", frameUrl.length);
      
      // Log the first 100 characters of the frame URL to help with debugging
      console.log("Frame URL preview:", frameUrl.substring(0, 100) + "...");
      
      const response = await fetch(`${API_BASE_URL}/process_frame`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          frame_data: frameUrl
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("API error response:", errorText);
        throw new Error(`Failed to process frame: ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log("API response:", data);
      
      // Debug: Log detailed information about the response
      console.log(`Response contains ${data.detections?.length || 0} detections`);
      console.log(`Response contains ${data.person_crops?.length || 0} person crops`);
      console.log(`Response description: ${data.description?.substring(0, 100)}...`);
      
      // Update detections and descriptions
      if (data.detections && data.detections.length > 0) {
        console.log("Updating detections:", data.detections);
        setDetections(data.detections);
      } else {
        console.log("No detections found in the response");
      }
      
      // Process person crops if available
      if (data.person_crops && data.person_crops.length > 0) {
        console.log("Processing person crops:", data.person_crops.length);
        
        const newPersonDescriptions: ExtendedPersonDescription[] = data.person_crops.map((crop: any) => {
          // Parse the description if it's a string
          let parsedDescription = crop.description;
          let structuredData: Record<string, any> = {};
          
          if (typeof crop.description === 'string') {
            try {
              // Try to parse as JSON
              parsedDescription = JSON.parse(crop.description);
            } catch (e) {
              // If not JSON, use as is
              console.log("Description is not JSON, using as string");
            }
          }
          
          // If it's an object, extract structured data
          if (typeof parsedDescription === 'object' && parsedDescription !== null) {
            structuredData = parsedDescription;
          }
          
          return {
            id: crop.id,
            description: typeof parsedDescription === 'string' ? parsedDescription : JSON.stringify(parsedDescription),
            timestamp: data.timestamp || new Date().toISOString(),
            camera_id: selectedCamera?.id || "SF-MKT-001",
            cropped_image: `data:image/jpeg;base64,${crop.crop}`,
            raw_data: structuredData
          };
        });
        
        console.log("Setting person descriptions:", newPersonDescriptions);
        setPersonDescriptions(newPersonDescriptions);
      } else if (data.description) {
        // Fallback to the general description if no person crops
        console.log("No person crops found, using general description:", data.description);
        
        // Parse the description string into structured data if possible
        let parsedDescription: ExtendedPersonDescription = {
          id: `general_${Date.now()}`,
          description: data.description,
          timestamp: data.timestamp || new Date().toISOString(),
          camera_id: selectedCamera?.id || "SF-MKT-001"
        };
        
        // Try to extract structured data from the description
        try {
          // Check if the description is in a format like "Gender: male. Age Group: adult."
          const descriptionParts = data.description.split('. ');
          const structuredData: Record<string, string> = {};
          
          descriptionParts.forEach((part: string) => {
            const [key, value] = part.split(': ');
            if (key && value) {
              // Convert key from "Title Case" to "snake_case"
              const snakeKey = key.toLowerCase().replace(/\s+/g, '_');
              structuredData[snakeKey] = value;
            }
          });
          
          // Add structured data to the description object
          parsedDescription = {
            ...parsedDescription,
            ...structuredData,
            raw_data: structuredData
          };
        } catch (parseError) {
          console.error("Error parsing description:", parseError);
          // If parsing fails, just use the raw description
        }
        
        setPersonDescriptions([parsedDescription]);
      } else {
        console.log("No descriptions found in the response");
        // Keep existing descriptions if no new ones are available
      }
    } catch (error) {
      console.error("Error processing frame:", error);
      setError(error instanceof Error ? error.message : "Failed to process frame");
    } finally {
      setIsProcessing(false);
    }
  };

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
    setError(null)
    try {
      // Use the actual API
      const result = await searchPeople(searchQuery)
      console.log('Search results:', result)
      
      if (result.matches && result.matches.length > 0) {
        setSearchResults(result.matches.map(match => match.description) as ExtendedPersonDescription[])
      } else {
        setSearchResults([])
        // Show suggestions if available
        if (result.suggestions && result.suggestions.length > 0) {
          setError(result.message || 'No matches found. Try these suggestions:')
        } else {
          setError(result.message || 'No matches found')
        }
      }
    } catch (error) {
      console.error("Search error:", error)
      setError('Failed to search. Please try again.')
      setSearchResults([])
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

  // Debug image loading
  useEffect(() => {
    if (personDescriptions.length > 0) {
      console.log("Person descriptions in RightSidebar:", personDescriptions);
      personDescriptions.forEach((person, index) => {
        if (person.cropped_image) {
          console.log(`Person ${index} has cropped image data in RightSidebar`);
        } else if (person.image) {
          const imageUrl = `${API_BASE_URL}/${person.image}`;
          console.log(`Person ${index} image URL in RightSidebar:`, imageUrl);
          
          // Test if image is accessible
          fetch(imageUrl)
            .then(response => {
              if (!response.ok) {
                console.error(`Image load error for person ${index} in RightSidebar:`, response.status, response.statusText);
                setError(`Failed to load image: ${response.status} ${response.statusText}`);
              } else {
                console.log(`Image ${index} is accessible in RightSidebar`);
              }
            })
            .catch(error => {
              console.error(`Image fetch error for person ${index} in RightSidebar:`, error);
              setError(`Error fetching image: ${error.message}`);
            });
        }
      });
    }
  }, [personDescriptions]);

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
        <div className="flex items-center space-x-2 mb-4">
          <Camera className="h-5 w-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-white">Camera Feed</h2>
          {isProcessing && (
            <div className="ml-auto flex items-center">
              <Loader2 className="h-4 w-4 animate-spin text-blue-400 mr-2" />
              <span className="text-xs text-gray-400">Processing...</span>
            </div>
          )}
        </div>

        {selectedCamera ? (
          <div className="space-y-4">
            {selectedCamera.id === "SF-MKT-001" ? (
              // Use VideoPlayer for Market Street camera
              <VideoPlayer 
                videoSrc="/images/market.mov" 
                onFrameExtracted={handleFrameExtracted}
                isProcessing={isProcessing}
              />
            ) : cameraImage ? (
              // Use image for other cameras
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

            {/* Processing Frames Section */}
        <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-white">Recent Detections</h3>
                <span className="text-xs text-gray-400">{detections.length} people detected</span>
              </div>
              
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {detections.length > 0 ? (
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
                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="text-sm text-gray-400">No detections yet. Processing frames...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-400 mb-4">Select a camera on the map to view live feed</p>
          </div>
        )}
      </div>

      {/* Person Descriptions - Only show when a camera is selected */}
      {selectedCamera && (
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center space-x-2 mb-4">
            <Search className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Person Descriptions</h2>
            <span className="text-xs text-gray-400 ml-auto">{personDescriptions.length} people detected</span>
          </div>
          
          <div className="space-y-2">
            {personDescriptions.length > 0 ? (
              personDescriptions.map((person, index) => (
                <motion.div
                  key={person.id || index}
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
                  
                  {/* Display cropped image if available */}
                  {person.cropped_image && (
                    <div className="mt-2 relative h-32 w-full">
                      <img
                        src={person.cropped_image}
                        alt={`Person ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    </div>
                  )}
                  
                  <div className="mt-2 text-sm text-gray-300">
                    {/* Display structured data if available */}
                    {person.raw_data ? (
                      <>
                        {person.raw_data.gender && (
                          <p><span className="text-gray-400">Gender:</span> {person.raw_data.gender}</p>
                        )}
                        {person.raw_data.age_group && (
                          <p><span className="text-gray-400">Age:</span> {person.raw_data.age_group}</p>
                        )}
                        {person.raw_data.ethnicity && (
                          <p><span className="text-gray-400">Ethnicity:</span> {person.raw_data.ethnicity}</p>
                        )}
                        {person.raw_data.skin_tone && (
                          <p><span className="text-gray-400">Skin Tone:</span> {person.raw_data.skin_tone}</p>
                        )}
                        {person.raw_data.hair_style && (
                          <p><span className="text-gray-400">Hair Style:</span> {person.raw_data.hair_style}</p>
                        )}
                        {person.raw_data.hair_color && (
                          <p><span className="text-gray-400">Hair Color:</span> {person.raw_data.hair_color}</p>
                        )}
                        {person.raw_data.facial_features && (
                          <p><span className="text-gray-400">Facial Features:</span> {person.raw_data.facial_features}</p>
                        )}
                        {person.raw_data.clothing_top && (
                          <p><span className="text-gray-400">Top:</span> {person.raw_data.clothing_top}</p>
                        )}
                        {person.raw_data.clothing_top_color && (
                          <p><span className="text-gray-400">Top Color:</span> {person.raw_data.clothing_top_color}</p>
                        )}
                        {person.raw_data.clothing_bottom && (
                          <p><span className="text-gray-400">Bottom:</span> {person.raw_data.clothing_bottom}</p>
                        )}
                        {person.raw_data.clothing_bottom_color && (
                          <p><span className="text-gray-400">Bottom Color:</span> {person.raw_data.clothing_bottom_color}</p>
                        )}
                        {person.raw_data.footwear && (
                          <p><span className="text-gray-400">Footwear:</span> {person.raw_data.footwear}</p>
                        )}
                        {person.raw_data.accessories && (
                          <p><span className="text-gray-400">Accessories:</span> {person.raw_data.accessories}</p>
                        )}
                        {person.raw_data.pose && (
                          <p><span className="text-gray-400">Pose:</span> {person.raw_data.pose}</p>
                        )}
                        {person.raw_data.location_context && (
                          <p><span className="text-gray-400">Location:</span> {person.raw_data.location_context}</p>
                        )}
                      </>
                    ) : (
                      // Fallback to the raw description if structured data is not available
                      <p className="text-gray-300">{person.description}</p>
                    )}
                    <p className="text-xs text-blue-400 mt-2">
                      Camera: {person.camera_id || selectedCamera?.id || 'Unknown'}
                    </p>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-sm text-gray-400">No person descriptions yet. Processing frames...</p>
              </div>
            )}
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
          
          {isLoading ? (
            <div className="text-center py-4">
              <p className="text-gray-400">Searching...</p>
            </div>
          ) : error ? (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 mb-4">
              <p className="text-red-400">{error}</p>
              {error.includes('suggestions') && (
                <ul className="mt-2 text-sm text-gray-400 list-disc pl-4">
                  <li>Try using more general terms</li>
                  <li>Include fewer specific details</li>
                  <li>Check for typos in your search</li>
                  <li>Try searching for a different person</li>
                </ul>
              )}
            </div>
          ) : searchResults.length > 0 ? (
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
                  {/* Add image display */}
                  {result.image && (
                    <div className="mt-3 rounded overflow-hidden">
                      <img 
                        src={`${API_BASE_URL}/${result.image}`}
                        alt={`Match ${index + 1}`} 
                        className="w-full h-32 object-cover"
                      />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* JSON View Modal */}
      {showJsonView && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-semibold text-white">Details</h3>
              <button
                onClick={closeJsonView}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            {selectedDetection && (
              <div className="mb-6">
                <h4 className="font-medium mb-2 text-white">Detection</h4>
                <div className="bg-gray-800 p-4 rounded-lg">
                  <pre className="text-sm overflow-x-auto text-gray-300">
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
                <h4 className="font-medium mb-2 text-white">Person Description</h4>
                <div className="bg-gray-800 p-4 rounded-lg">
                  <pre className="text-sm overflow-x-auto text-gray-300">
                    {JSON.stringify({
                      ...selectedPerson,
                      camera_id: selectedPerson.camera_id || selectedCamera?.id || 'Unknown',
                      // Include all available fields
                      gender: selectedPerson.gender || 'Unknown',
                      age_group: selectedPerson.age_group || 'Unknown',
                      clothing_top: selectedPerson.clothing_top || 'Unknown',
                      clothing_bottom: selectedPerson.clothing_bottom || 'Unknown',
                      similarity: selectedPerson.similarity || 0,
                      // Include the raw data from Gemini
                      raw_data: selectedPerson.raw_data || {},
                      // Include the cropped image if available
                      cropped_image: selectedPerson.cropped_image || null
                    }, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
} 