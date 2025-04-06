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
import { addPersonToDatabase } from './DatabaseSearch'
import { connectWebSocket, disconnectWebSocket, addWebSocketEventListener, isWebSocketConnected } from "@/lib/websocket"
// Define local interface to extend PersonDescription
interface ExtendedPersonDescription extends PersonDescription {
  id?: string;
  yoloCrop?: string;
  gender?: string;
  age_group?: string;
  clothing_top?: string;
  clothing_top_color?: string;
  clothing_bottom?: string;
  clothing_bottom_color?: string;
  hair_color?: string;
  similarity?: number;
  camera_id?: string;
  cropped_image?: string;
  raw_data?: Record<string, any>;  // Add raw_data field for Gemini output
  description?: string;  // Add description field for AI model output
  timestamp?: string;    // Add timestamp field for when the description was generated
}

// Define extended SearchResult type to include suggestions and message
interface ExtendedSearchResult {
  matches: Array<{
    description: {
      gender?: string;
      age_group?: string;
      ethnicity?: string;
      skin_tone?: string;
      hair_style?: string;
      hair_color?: string;
      facial_features?: string;
      clothing_top?: string;
      clothing_top_color?: string;
      clothing_top_pattern?: string;
      clothing_bottom?: string;
      clothing_bottom_color?: string;
      clothing_bottom_pattern?: string;
      accessories?: string;
      bag_type?: string;
      bag_color?: string;
      location_context?: string;
      pose?: string;
    };
    metadata: {
      timestamp: string;
      camera_id?: string;
      location?: string;
    };
    similarity: number;
    imageData?: string;
  }>;
  suggestions?: string[];
  message?: string;
}

// Define WebSocket message interface
interface WebSocketMessage {
  message: string;
  type?: string;
  content?: string;
}

type Camera = {
  id: string;
  name: string;
  feed_url?: string;
  image_url?: string;
};

export default function RightSidebar() {
  const { selectedCamera, setSelectedCamera } = useCamera()
  const [transcription, setTranscription] = useState('');
  const [isCallActive, setIsCallActive] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState(0);

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
  const [searching, setSearching] = useState(false)
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([])
  const [searchMessage, setSearchMessage] = useState<string>('')
  const sidebarRef = useRef<HTMLDivElement>(null)

  // Add a useEffect hook to check server health and clear detections on mount
  useEffect(() => {
    const checkHealthAndClear = async () => {
      try {
        // Check if the server is healthy
        console.log("Checking server health on mount...");
        const isHealthy = await checkServerHealth();
        if (isHealthy) {
          console.log("Server is healthy, clearing detections and descriptions");
          setDetections([]);
          setPersonDescriptions([]);
          setLastProcessedFrame(null);
        } else {
          console.error("Server is not healthy on mount");
          setError("Server is not healthy - please check the backend server");
        }
      } catch (error) {
        console.error("Error checking server health on mount:", error);
        setError("Failed to check server health");
      }
    };

    checkHealthAndClear();
  }, []); // Empty dependency array means this runs once on mount

  // Reset detections and descriptions when camera changes
  useEffect(() => {
    if (selectedCamera) {
      console.log('Camera selected:', selectedCamera);
      
      // Clear previous detections and descriptions
      setDetections([]);
      setPersonDescriptions([]);
      setSearchResults([]);
      setSelectedDetection(null);
      setSelectedPerson(null);
      setShowJsonView(false);
      
      // Set the camera feed based on the selected camera
      if (selectedCamera.feed_url) {
        setCameraFeed(selectedCamera.feed_url);
      } else if (selectedCamera.image_url) {
        setCameraImage(selectedCamera.image_url);
      }
      
      // Reset error state
      setError(null);
    }
  }, [selectedCamera]);

  // Add a useEffect hook that depends on the selectedCamera state
  useEffect(() => {
    if (selectedCamera) {
      console.log("Selected camera changed in RightSidebar:", selectedCamera);
      
      // Clear all state when camera changes
      setDetections([]);
      setPersonDescriptions([]);
      setLastProcessedFrame(null);
      setSearchResults([]);
      setSelectedDetection(null);
      setSelectedPerson(null);
      setShowJsonView(false);
      
      // Clear any existing intervals
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }
      if (frameExtractionIntervalRef.current) {
        clearInterval(frameExtractionIntervalRef.current);
      }
      
      // Set initial camera image based on camera ID
      const cameraVideoMap: { [key: string]: string } = {
        "SF-MKT-001": "/videos/market.mp4",
        "SF-EMB-002": "/videos/sf_street_001.mov",
        "SF-UNS-003": "/videos/sf_building_001.mov",
        "SF-FER-004": "/videos/sf_park_001.mov",
        "SF-CHI-005": "/videos/IMG_8252.mov",
        "SF-MIS-006": "/videos/MIS.mov",
        "SF-HAI-007": "/videos/workingCLip.mov"
      };

      if (cameraVideoMap[selectedCamera.id]) {
        // For cameras with video feeds
        setCameraImage(null);
        setCurrentImageUrl(null);
        setIsVideoPlaying(true);
        setCameraFeed(cameraVideoMap[selectedCamera.id]);
      } else {
        // For other cameras, use random images
        const initialImageUrl = `https://picsum.photos/800/600?random=${Math.random()}`;
        setCameraImage(initialImageUrl);
        setCurrentImageUrl(initialImageUrl);
        setIsVideoPlaying(false);
        setCameraFeed(null);
      }
      
      // Reset error state
      setError(null);
      
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
          
          // Get the current frame to process
          let frameUrl = lastProcessedFrame;
          
          // If we don't have a frame yet, wait for the next interval
          if (!frameUrl) {
            console.log("No frame available yet, waiting for next interval");
            processingRef.current = false;
            setIsProcessing(false);
            return;
          }
          
          console.log(`Processing frame for camera ${selectedCamera.id}, frame length:`, frameUrl.length);
          
          // Process the frame with YOLO
          console.log("Sending frame to API for processing...");
          const response = await fetch(`${API_BASE_URL}/process_frame`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              frame_data: frameUrl,
              camera_id: selectedCamera.id
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
            // Add camera ID to each detection
            const detectionsWithCameraId = data.detections.map((detection: Detection) => ({
              ...detection,
              camera_id: selectedCamera.id
            }));
            setDetections(detectionsWithCameraId);
          } else {
            console.log("No detections found in this frame");
            // Don't clear existing detections if we don't find new ones
            // This prevents flickering of the UI
          }
          
          // Process person descriptions if available
          if (data.person_crops && data.person_crops.length > 0) {
            console.log("Processing person descriptions:", data.person_crops.length);
            const descriptions = data.person_crops.map((crop: any) => ({
              ...crop.description,
              id: crop.id,
              yoloCrop: crop.crop,
              camera_id: selectedCamera.id,
              timestamp: new Date().toISOString()
            }));
            setPersonDescriptions(descriptions);
          } else {
            console.log("No person descriptions found in this frame");
            // Don't clear existing descriptions if we don't find new ones
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

  const fetchTranscription = async () => {
    try {
      const response = await fetch(`http://localhost:8000/transcription`);
      const data = await response.json();
      if (data.transcription) {
        setTranscription(data.transcription);
        if (data.search_results) {
          setSearchResults(data.search_results);
        }

        setLastFetchTime(Date.now());
      }
    } catch (error) {
      console.error("Error fetching transcription:", error);
    }
  };

// Set up WebSocket connection and polling for transcription
  useEffect(() => {
    // Connect to WebSocket
    connectWebSocket();
  
    // Add event listener for WebSocket connection status
    const removeConnectedListener = addWebSocketEventListener('connected', () => {
      setIsCallActive(true);
    });

    const removeDisconnectedListener = addWebSocketEventListener('disconnected', () => {
      setIsCallActive(false);
    });

    const removeStatusListener = addWebSocketEventListener('status', (data: WebSocketMessage) => {
      if (data.message == 'Transcription Updated') {
        fetchTranscription();
      }
    })

    const pollInterval = setInterval(() => {
      fetchTranscription();
    }, 2000);

    return () => {
      disconnectWebSocket();
      removeConnectedListener();
      removeDisconnectedListener();
      removeStatusListener();
      clearInterval(pollInterval);
    };
  }, []);

  //119

  // Handle frame extraction from video
  const handleFrameExtracted = (frameUrl: string) => {
    console.log("Frame extracted from video, length:", frameUrl.length);
    setLastProcessedFrame(frameUrl);
    
    // Process the frame with YOLO if not already processing
    if (!isProcessing) {
      console.log(`Processing frame for camera ${selectedCamera?.id || 'unknown'}`);
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
      if (!selectedCamera) {
        console.error("No camera selected");
        return;
      }
      console.log("Frame URL length:", frameUrl.length);
      
      // Log the first 100 characters of the frame URL to help with debugging
      console.log("Frame URL preview:", frameUrl.substring(0, 100) + "...");
      
      const response = await fetch(`${API_BASE_URL}/process_frame`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          frame_data: frameUrl,
          camera_id: selectedCamera.id
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
        // Add camera ID to each detection
        const detectionsWithCameraId = data.detections.map((detection: Detection) => ({
          ...detection,
          camera_id: selectedCamera.id
        }));
        setDetections(detectionsWithCameraId);
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
            camera_id: selectedCamera.id, // Always use the current selected camera ID
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
          camera_id: selectedCamera.id // Always use the current selected camera ID
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
    if (!searchQuery.trim()) return;
    
    try {
      setSearching(true);
      
      // Parse the search query to extract key attributes
      const searchTerms = searchQuery.toLowerCase().split(' ');
      const gender = searchTerms.find(term => ['male', 'female', 'man', 'woman'].includes(term));
      const hairColor = searchTerms.find(term => ['blonde', 'blond', 'black', 'brown', 'red', 'white', 'gray'].includes(term));
      const clothingColor = searchTerms.find(term => ['blue', 'red', 'green', 'yellow', 'black', 'white', 'brown'].includes(term));
      const clothingType = searchTerms.find(term => ['hoodie', 'shirt', 't-shirt', 'jacket', 'coat', 'sweater'].includes(term));
      
      // Add facial hair detection
      const facialHair = searchTerms.find(term => ['beard', 'mustache', 'goatee', 'stubble', 'facial hair'].includes(term));
      
      // Construct a more specific search query
      let enhancedQuery = searchQuery;
      if (gender) enhancedQuery += ` gender:${gender}`;
      if (hairColor) enhancedQuery += ` hair_color:${hairColor}`;
      if (clothingColor && clothingType) enhancedQuery += ` clothing:${clothingColor} ${clothingType}`;
      if (facialHair) enhancedQuery += ` facial_features:${facialHair}`;
      
      console.log("Enhanced search query:", enhancedQuery);
      
      const result = await searchPeople(enhancedQuery) as ExtendedSearchResult;
      
      if (result.suggestions && result.suggestions.length > 0) {
        setSearchSuggestions(result.suggestions);
      } else {
        setSearchSuggestions([]);
      }
      
      if (result.message) {
        setSearchMessage(result.message);
      } else {
        setSearchMessage('');
      }
      
      // Map the search results to ExtendedPersonDescription type
      const mappedResults: ExtendedPersonDescription[] = result.matches.map(match => ({
        id: match.metadata.camera_id,
        gender: match.description.gender,
        age_group: match.description.age_group,
        clothing_top: match.description.clothing_top,
        clothing_top_color: match.description.clothing_top_color,
        clothing_bottom: match.description.clothing_bottom,
        clothing_bottom_color: match.description.clothing_bottom_color,
        hair_color: match.description.hair_color,
        similarity: match.similarity,
        camera_id: match.metadata.camera_id,
        description: JSON.stringify(match.description), // Convert description object to string
        timestamp: match.metadata.timestamp,
        raw_data: match.description // Store the raw description data
      }));
      
      // Sort results by similarity score
      mappedResults.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
      
      // Remove duplicates based on a unique identifier
      // We'll use a combination of gender, age_group, and clothing as a unique identifier
      const uniqueResults: ExtendedPersonDescription[] = [];
      const seenIdentifiers = new Set<string>();
      
      for (const person of mappedResults) {
        // Create a unique identifier based on key attributes
        const identifier = [
          person.gender || 'unknown',
          person.age_group || 'unknown',
          person.clothing_top || 'unknown',
          person.clothing_top_color || 'unknown',
          person.clothing_bottom || 'unknown',
          person.clothing_bottom_color || 'unknown',
          person.hair_color || 'unknown'
        ].join('|');
        
        // Only add if we haven't seen this identifier before
        if (!seenIdentifiers.has(identifier)) {
          seenIdentifiers.add(identifier);
          uniqueResults.push(person);
        }
      }
      
      setSearchResults(uniqueResults);
    } catch (error) {
      console.error('Error searching people:', error);
      setSearchMessage('Error searching people. Please try again.');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

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
    <div 
      ref={sidebarRef}
      className="w-80 bg-gray-900 border-l border-gray-800 h-screen overflow-y-auto right-sidebar-content"
      style={{ 
        scrollbarWidth: 'thin',
        scrollbarColor: '#4B5563 #1F2937',
        msOverflowStyle: 'none'
      }}
    >
      <style jsx>{`
        div::-webkit-scrollbar {
          width: 6px;
        }
        div::-webkit-scrollbar-track {
          background: #1F2937;
        }
        div::-webkit-scrollbar-thumb {
          background-color: #4B5563;
          border-radius: 3px;
        }
        div::-webkit-scrollbar-thumb:hover {
          background-color: #6B7280;
        }
      `}</style>
      
      {/* Phone Call Transcription */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center space-x-2 mb-4">
          <Phone className="h-5 w-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-white">Live Call Transcription</h2>
        </div>
        <div className="space-y-3">
          {transcription ? (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-gray-800 rounded-lg p-3"
            >
              <p className="text-sm text-gray-300">{transcription}</p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-gray-800 rounded-lg p-3"
            >
              <p className="text-sm text-gray-300">{isCallActive ? 'Connecting...' : 'Waiting for call...'}</p>
            </motion.div>
          )}
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
            {cameraFeed ? (
              // Use VideoPlayer for cameras with video feeds
              <div className="relative">
                <VideoPlayer 
                  videoSrc={cameraFeed}
                  onFrameExtracted={handleFrameExtracted}
                  isProcessing={isProcessing}
                />
                
              </div>
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
                  detections.map((detection, index) => (
                    <motion.div
                      key={detection.id || `detection-${index}-${detection.timestamp}`}
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
          <div className="aspect-video bg-gray-800 rounded-lg flex items-center justify-center">
            <p className="text-gray-400">Select a camera to view feed</p>
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
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-400">{person.timestamp}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-green-400 hover:text-green-300"
                        onClick={async (e) => {
                          e.stopPropagation(); // Prevent triggering the parent onClick
                          try {
                            const result = await addPersonToDatabase(person);
                            
                            if (result.duplicate) {
                              alert('This person is already in the database!');
                            } else {
                              alert('Person added to database!');
                            }
                            
                            // Refresh the database display
                            // @ts-ignore
                            if (window.refreshDatabase) {
                              // @ts-ignore
                              window.refreshDatabase();
                            }
                          } catch (error) {
                            console.error('Error adding person to database:', error);
                            alert('Error adding person to database.');
                          }
                        }}
                      >
                        Add to Database
                      </Button>
                    </div>
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
                        {person.raw_data.beard_length && (
                          <p><span className="text-gray-400">Beard Length:</span> {person.raw_data.beard_length}</p>
                        )}
                        {person.raw_data.beard_style && (
                          <p><span className="text-gray-400">Beard Style:</span> {person.raw_data.beard_style}</p>
                        )}
                        {person.raw_data.beard_color && (
                          <p><span className="text-gray-400">Beard Color:</span> {person.raw_data.beard_color}</p>
                        )}
                        {person.raw_data.child_context && (
                          <p><span className="text-gray-400">Child Context:</span> {person.raw_data.child_context}</p>
                        )}
                        {person.raw_data.height_estimate && (
                          <p><span className="text-gray-400">Height:</span> {person.raw_data.height_estimate}</p>
                        )}
                        {person.raw_data.build_type && (
                          <p><span className="text-gray-400">Build:</span> {person.raw_data.build_type}</p>
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
         
          <div className="flex space-x-2 mb-4">
           
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
                    {result.gender && (
                      <p><span className="text-blue-400">Gender:</span> {result.gender}</p>
                    )}
                    {result.age_group && (
                      <p><span className="text-blue-400">Age Group:</span> {result.age_group}</p>
                    )}
                    {result.hair_color && (
                      <p><span className="text-blue-400">Hair Color:</span> {result.hair_color}</p>
                    )}
                    {result.clothing_top && (
                      <p><span className="text-blue-400">Top:</span> {result.clothing_top}
                        {result.clothing_top_color && ` (${result.clothing_top_color})`}
                      </p>
                    )}
                    {result.clothing_bottom && (
                      <p><span className="text-blue-400">Bottom:</span> {result.clothing_bottom}
                        {result.clothing_bottom_color && ` (${result.clothing_bottom_color})`}
                      </p>
                    )}
                    {result.raw_data?.accessories && (
                      <p><span className="text-blue-400">Accessories:</span> {result.raw_data.accessories}</p>
                    )}
                    {result.raw_data?.pose && (
                      <p><span className="text-blue-400">Pose:</span> {result.raw_data.pose}</p>
                    )}
                    {result.raw_data?.location_context && (
                      <p><span className="text-blue-400">Location:</span> {result.raw_data.location_context}</p>
                    )}
                    {result.camera_id && (
                      <p><span className="text-blue-400">Camera:</span> {result.camera_id || selectedCamera?.id || 'Unknown'}</p>
                    )}
                    {result.similarity && (
                      <p><span className="text-blue-400">Similarity:</span> {result.similarity.toFixed(1)}%</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* JSON View Modal */}
      {showJsonView && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
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