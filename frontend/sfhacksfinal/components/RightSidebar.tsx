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
  checkServerHealth,
  getPersonImage
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
  image_data?: string;
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
  const [searchMatch, setSearchMatch] = useState<{
    query: string;
    match: ExtendedPersonDescription;
    similarity: number;
  } | null>(null)
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
  const [personImages, setPersonImages] = useState<Record<string, string>>({})

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
      
      // Reset state when camera changes
      setDetections([]);
      setPersonDescriptions([]);
      setLastProcessedFrame(null);
      setIsProcessing(false);
      setError(null);
      
      // Set initial camera image
      if (selectedCamera.id === "SF-MKT-001") {
        // For Market Street camera, we'll use the video player
        setCameraImage(null);
        setCurrentImageUrl(null);
        setIsVideoPlaying(true);
      } else {
        // For other cameras, use video player with camera-specific videos
        setCameraImage(null);
        setCurrentImageUrl(null);
        setIsVideoPlaying(true);
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
          
          // Only process if we have a frame from the current camera
          if (!lastProcessedFrame) {
            console.log("Waiting for video frame from current camera...");
            processingRef.current = false;
            setIsProcessing(false);
            return;
          }
          
          // Process the frame with YOLO
          console.log("Sending frame to API for processing...");
          console.log("Frame URL length:", lastProcessedFrame.length);
          
          // Log the first 100 characters of the frame URL to help with debugging
          console.log("Frame URL preview:", lastProcessedFrame.substring(0, 100) + "...");
          
          const response = await fetch(`${API_BASE_URL}/process_frame`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              frame_data: lastProcessedFrame,
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
            
            // Ensure each detection has the correct camera_id
            const detectionsWithCamera = data.detections.map((detection: Detection) => ({
              ...detection,
              camera_id: selectedCamera.id
            }));
            
            setDetections(detectionsWithCamera);
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
                camera_id: selectedCamera.id,
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
              camera_id: selectedCamera.id
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
    if (!selectedCamera) {
      console.log("No camera selected, skipping frame processing");
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      console.log(`Processing frame from camera ${selectedCamera.id}: ${frameUrl}`);
      
      // Create form data with the frame URL and camera ID
      const formData = new FormData();
      formData.append('frame_url', frameUrl);
      formData.append('camera_id', selectedCamera.id);
      
      // Send the frame to the backend for processing
      const response = await fetch(`${API_BASE_URL}/process_frame`, {
        method: 'POST',
        body: formData
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
        
        // Ensure each detection has the correct camera_id
        const detectionsWithCamera = data.detections.map((detection: Detection) => ({
          ...detection,
          camera_id: selectedCamera.id // Always use the selected camera ID
        }));
        
        setDetections(detectionsWithCamera);
      } else {
        console.log("No detections found in the response");
      }
      
      // Process person crops if available
      if (data.person_crops && data.person_crops.length > 0) {
        console.log("Processing person crops:", data.person_crops.length);
        
        const newPersonDescriptions: ExtendedPersonDescription[] = data.person_crops.map((crop: any) => ({
          ...crop,
          camera_id: selectedCamera.id, // Always use the selected camera ID
          timestamp: new Date().toISOString()
        }));
        
        setPersonDescriptions(prev => [...newPersonDescriptions, ...prev]);
      }
      
      // Update the last processed frame
      setLastProcessedFrame(frameUrl);
      
    } catch (error) {
      console.error("Error processing frame:", error);
      setError(error instanceof Error ? error.message : "Unknown error processing frame");
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

  // Function to handle search results
  const handleSearchResults = (results: any) => {
    if (results.matches && results.matches.length > 0) {
      const firstMatch = results.matches[0];
      const matchDescription = firstMatch.description;
      
      // Create a search match object
      const newSearchMatch = {
        query: results.query,
        match: {
          ...matchDescription,
          similarity: firstMatch.similarity,
          camera_id: firstMatch.camera_id || selectedCamera?.id
        },
        similarity: firstMatch.similarity
      };
      
      // Set the search match
      setSearchMatch(newSearchMatch);
      
      // Add to person descriptions if not already there
      const isAlreadyInDescriptions = personDescriptions.some(
        p => p.id === matchDescription.id
      );
      
      if (!isAlreadyInDescriptions) {
        setPersonDescriptions(prev => [
          {
            ...matchDescription,
            similarity: firstMatch.similarity,
            camera_id: firstMatch.camera_id || selectedCamera?.id,
            timestamp: new Date().toISOString()
          },
          ...prev
        ]);
      }
      
      // Show a notification that a match was found
      console.log(`Found a match for "${results.query}" with similarity ${(firstMatch.similarity * 100).toFixed(1)}%`);
    }
  };

  // Listen for search results from ChatAgent
  useEffect(() => {
    const handleSearchEvent = (event: CustomEvent) => {
      if (event.detail && event.detail.matches && event.detail.matches.length > 0) {
        handleSearchResults(event.detail);
      }
    };
    
    window.addEventListener('searchResults', handleSearchEvent as EventListener);
    
    return () => {
      window.removeEventListener('searchResults', handleSearchEvent as EventListener);
    };
  }, [selectedCamera, personDescriptions]);

  // Handle search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || isLoading) return;
    
    setIsLoading(true);
    try {
      const results = await searchPeople(searchQuery);
      handleSearchResults(results);
      
      // Dispatch event for ChatAgent to handle
      const searchEvent = new CustomEvent('searchResults', { detail: results });
      window.dispatchEvent(searchEvent);
    } catch (error) {
      console.error("Search error:", error);
      setError("Failed to search for people. Please try again.");
    } finally {
      setIsLoading(false);
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

  const formatMatchDescription = (match: { description: PersonDescription; similarity: number }) => {
    const { description, similarity } = match
    let text = `Similarity: ${(similarity * 100).toFixed(1)}%\n\n`
    
    if (description.gender) text += `Gender: ${description.gender}\n`
    if (description.age_group) text += `Age: ${description.age_group}\n`
    if (description.ethnicity) text += `Ethnicity: ${description.ethnicity}\n`
    if (description.skin_tone) text += `Skin Tone: ${description.skin_tone}\n`
    if (description.hair_style) text += `Hair Style: ${description.hair_style}\n`
    if (description.hair_color) text += `Hair Color: ${description.hair_color}\n`
    if (description.facial_features) text += `Facial Features: ${description.facial_features}\n`
    if (description.clothing_top) text += `Top: ${description.clothing_top}\n`
    if (description.clothing_top_color) text += `Top Color: ${description.clothing_top_color}\n`
    if (description.clothing_bottom) text += `Bottom: ${description.clothing_bottom}\n`
    if (description.clothing_bottom_color) text += `Bottom Color: ${description.clothing_bottom_color}\n`
    if (description.footwear) text += `Footwear: ${description.footwear}\n`
    if (description.accessories) text += `Accessories: ${description.accessories}\n`
    if (description.pose) text += `Pose: ${description.pose}\n`
    if (description.location_context) text += `Location: ${description.location_context}\n`
    if (description.timestamp) text += `Last seen: ${new Date(description.timestamp).toLocaleString()}\n`
    if (description.camera_id) text += `Camera: ${description.camera_id}\n`
    
    return text
  }

  // Add a function to load person images
  const loadPersonImage = async (personId: string) => {
    try {
      // Use the API_BASE_URL from the environment or default to localhost
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const imageUrl = `${apiBaseUrl}/person_image/${personId}`;
      
      // Use GET request to fetch the image
      const response = await fetch(imageUrl);
      
      if (response.ok) {
        // Convert the response to a blob and create an object URL
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        
        setPersonImages(prev => ({
          ...prev,
          [personId]: objectUrl
        }));
        console.log(`Successfully loaded image for person ${personId}`);
      } else {
        console.error(`Failed to load image for person ${personId}: ${response.status} ${response.statusText}`);
        // Set a placeholder image or handle the error case
        setPersonImages(prev => ({
          ...prev,
          [personId]: '/images/placeholder-person.png' // Make sure this placeholder image exists
        }));
      }
    } catch (error) {
      console.error(`Error loading image for person ${personId}:`, error);
      // Set a placeholder image on error
      setPersonImages(prev => ({
        ...prev,
        [personId]: '/images/placeholder-person.png' // Make sure this placeholder image exists
      }));
    }
  };

  // Update the useEffect that processes frames to load person images
  useEffect(() => {
    if (detections.length > 0) {
      // Load images for all detected people
      detections.forEach(detection => {
        if (detection.id && !personImages[detection.id]) {
          loadPersonImage(detection.id);
        }
      });
    }
  }, [detections]);

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
            ) : selectedCamera.id === "SF-EMB-002" ? (
              // Use VideoPlayer for Embarcadero Plaza camera
              <VideoPlayer 
                videoSrc="/images/IMG_8251.mov" 
                onFrameExtracted={handleFrameExtracted}
                isProcessing={isProcessing}
              />
            ) : selectedCamera.id === "SF-UNS-003" ? (
              // Use VideoPlayer for Union Square camera
              <VideoPlayer 
                videoSrc="/images/IMG_8252.mov" 
                onFrameExtracted={handleFrameExtracted}
                isProcessing={isProcessing}
              />
            ) : selectedCamera.id === "SF-FER-004" ? (
              // Use VideoPlayer for Ferry Building camera
              <VideoPlayer 
                videoSrc="/images/IMG_8253.mov" 
                onFrameExtracted={handleFrameExtracted}
                isProcessing={isProcessing}
              />
            ) : selectedCamera.id === "SF-CHI-005" ? (
              // Use VideoPlayer for Chinatown Gate camera
              <VideoPlayer 
                videoSrc="/images/IMG_8254.mov" 
                onFrameExtracted={handleFrameExtracted}
                isProcessing={isProcessing}
              />
            ) : selectedCamera.id === "SF-MIS-006" ? (
              // Use VideoPlayer for Mission District camera
              <VideoPlayer 
                videoSrc="/images/market.mp4" 
                onFrameExtracted={handleFrameExtracted}
                isProcessing={isProcessing}
              />
            ) : selectedCamera.id === "SF-HAI-007" ? (
              // Use VideoPlayer for Haight Street camera
              <VideoPlayer 
                videoSrc="/images/market.mov" 
                onFrameExtracted={handleFrameExtracted}
                isProcessing={isProcessing}
              />
            ) : selectedCamera.id === "SF-NOB-008" ? (
              // Use VideoPlayer for Nob Hill camera
              <VideoPlayer 
                videoSrc="/images/market.mp4" 
                onFrameExtracted={handleFrameExtracted}
                isProcessing={isProcessing}
              />
            ) : cameraImage ? (
              // Fallback to image for any other cameras
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
                  // Sort detections to show search match first
                  [...detections].sort((a, b) => {
                    // If there's a search match, prioritize it
                    if (searchMatch) {
                      if (a.id === searchMatch.match.id) return -1;
                      if (b.id === searchMatch.match.id) return 1;
                    }
                    // Otherwise sort by timestamp (newest first)
                    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
                  }).map((detection, index) => (
                    <div 
                      key={detection.id || index} 
                      className={`p-4 rounded-lg mb-3 ${
                        searchQuery && 
                        detection.description && 
                        typeof detection.description === 'string' && 
                        detection.description.toLowerCase().includes(searchQuery.toLowerCase())
                          ? 'bg-green-900/20 border border-green-500/30' 
                          : 'bg-gray-900/20 border border-gray-700/30'
                      }`}
                    >
                      <div className="flex items-start">
                        <div className="flex-shrink-0 mr-3">
                          {detection.id ? (
                            <div className="w-16 h-16 overflow-hidden rounded-full border border-gray-700/30">
                              <img 
                                src={personDescriptions.find(p => p.id === detection.id)?.cropped_image || (lastProcessedFrame || '')}
                                alt={`Person ${detection.id}`}
                                className="w-full h-full object-cover object-center"
                                style={{
                                  aspectRatio: '1/1',
                                  objectFit: 'cover',
                                  objectPosition: 'center'
                                }}
                              />
                            </div>
                          ) : (
                            <div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center border border-gray-700/30">
                              <span className="text-gray-400 text-xs">No image</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-medium text-gray-200">
                                {detection.type.charAt(0).toUpperCase() + detection.type.slice(1)} Detection
                              </h3>
                              <p className="text-sm text-gray-400">
                                {new Date(detection.timestamp).toLocaleString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900/30 text-blue-300 border border-blue-700/30">
                                {Math.round(detection.confidence * 100)}% confidence
                              </span>
                            </div>
                          </div>
                          
                          <div className="mt-2 text-sm text-gray-300">
                            {detection.bbox && (
                              <p>Location: {detection.bbox.join(', ')}</p>
                            )}
                            <p>Camera: {detection.camera_id}</p>
                            
                            {detection.description && (
                              <div className="mt-2 pt-2 border-t border-gray-700/30">
                                <p className="font-medium text-blue-400">Description:</p>
                                {typeof detection.description === 'string' ? (
                                  <p className="text-gray-300">{detection.description}</p>
                                ) : (
                                  <div className="mt-1">
                                    {Object.entries(detection.description).map(([key, value]) => (
                                      value && (
                                        <p key={key} className="text-gray-300">
                                          <span className="font-medium text-blue-400">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</span> {value}
                                        </p>
                                      )
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
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
                    {result.gender && (
                      <p><span className="text-blue-400">Gender:</span> {result.gender}</p>
                    )}
                    {result.age_group && (
                      <p><span className="text-blue-400">Age:</span> {result.age_group}</p>
                    )}
                    {result.clothing_top && (
                      <p><span className="text-blue-400">Top:</span> {result.clothing_top}</p>
                    )}
                    {result.clothing_bottom && (
                      <p><span className="text-blue-400">Bottom:</span> {result.clothing_bottom}</p>
                    )}
                    {result.accessories && (
                      <p><span className="text-blue-400">Accessories:</span> {result.accessories}</p>
                    )}
                    {result.location_context && (
                      <p><span className="text-blue-400">Location:</span> {result.location_context}</p>
                    )}
                    {result.timestamp && (
                      <p><span className="text-blue-400">Last seen:</span> {new Date(result.timestamp).toLocaleString()}</p>
                    )}
                    {result.camera_id && (
                      <p><span className="text-blue-400">Camera:</span> {result.camera_id}</p>
                    )}
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
                  <div className="space-y-2 text-sm">
                    {selectedPerson.gender && (
                      <p><span className="text-gray-400">Gender:</span> {selectedPerson.gender}</p>
                    )}
                    {selectedPerson.age_group && (
                      <p><span className="text-gray-400">Age:</span> {selectedPerson.age_group}</p>
                    )}
                    {selectedPerson.ethnicity && (
                      <p><span className="text-gray-400">Ethnicity:</span> {selectedPerson.ethnicity}</p>
                    )}
                    {selectedPerson.skin_tone && (
                      <p><span className="text-gray-400">Skin Tone:</span> {selectedPerson.skin_tone}</p>
                    )}
                    {selectedPerson.hair_style && (
                      <p><span className="text-gray-400">Hair Style:</span> {selectedPerson.hair_style}</p>
                    )}
                    {selectedPerson.hair_color && (
                      <p><span className="text-gray-400">Hair Color:</span> {selectedPerson.hair_color}</p>
                    )}
                    {selectedPerson.facial_features && (
                      <p><span className="text-gray-400">Facial Features:</span> {selectedPerson.facial_features}</p>
                    )}
                    {selectedPerson.clothing_top && (
                      <p><span className="text-gray-400">Top:</span> {selectedPerson.clothing_top}</p>
                    )}
                    {selectedPerson.clothing_top_color && (
                      <p><span className="text-gray-400">Top Color:</span> {selectedPerson.clothing_top_color}</p>
                    )}
                    {selectedPerson.clothing_bottom && (
                      <p><span className="text-gray-400">Bottom:</span> {selectedPerson.clothing_bottom}</p>
                    )}
                    {selectedPerson.clothing_bottom_color && (
                      <p><span className="text-gray-400">Bottom Color:</span> {selectedPerson.clothing_bottom_color}</p>
                    )}
                    {selectedPerson.footwear && (
                      <p><span className="text-gray-400">Footwear:</span> {selectedPerson.footwear}</p>
                    )}
                    {selectedPerson.accessories && (
                      <p><span className="text-gray-400">Accessories:</span> {selectedPerson.accessories}</p>
                    )}
                    {selectedPerson.pose && (
                      <p><span className="text-gray-400">Pose:</span> {selectedPerson.pose}</p>
                    )}
                    {selectedPerson.location_context && (
                      <p><span className="text-gray-400">Location:</span> {selectedPerson.location_context}</p>
                    )}
                    {selectedPerson.timestamp && (
                      <p><span className="text-gray-400">Last seen:</span> {new Date(selectedPerson.timestamp).toLocaleString()}</p>
                    )}
                    {selectedPerson.camera_id && (
                      <p><span className="text-gray-400">Camera:</span> {selectedPerson.camera_id}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
} 