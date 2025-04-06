"use client"

import { useState, useEffect, useRef } from "react"
import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Phone, Camera, Activity, X, Search, Send, Loader2, User, Filter, RefreshCw, Tag, Upload } from "lucide-react"
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
  FrameResponse,
  personSearchChat,
  PersonSearchChatResponse
} from "@/lib/api"
import { addPersonToDatabase } from './DatabaseSearch'
import { amberAlertEvents } from './Map'
import { toast } from "react-hot-toast"
import DatabaseSearch from "./DatabaseSearch"

// Define our own detection interface that accommodates all the data we need
interface ExtendedDetection {
  id?: string;
  type: string;
  confidence: number;
  timestamp?: string;
  bbox?: number[];
  camera_id?: string;
  image?: string;
}

// Define local interface to extend PersonDescription
interface ExtendedPersonDescription extends PersonDescription {
  id?: string;
  yoloCrop?: string;
  gender?: string;
  age_group?: string;
  hair_color?: string;
  hair_style?: string;
  clothing_top?: string;
  clothing_top_color?: string;
  clothing_bottom?: string;
  clothing_bottom_color?: string;
  camera_id?: string;
  camera_location?: string;
  similarity?: number;
  cropped_image?: string;
  raw_data?: Record<string, any>;  // Raw data field for Gemini output
  description?: string;  // Description field for AI model output
  timestamp?: string;    // Timestamp field for when the description was generated
  search_result?: boolean;
  explanation?: string;
  highlights?: string[];
}

// Define extended SearchResult type to include suggestions and message
interface ExtendedSearchResult {
  matches: Array<{
    description: Record<string, any>;
    metadata: {
      timestamp: string;
      camera_id?: string;
      camera_location?: string;
      explanation?: string;
      [key: string]: any;
    };
    similarity: number;
    imageData?: string;
    image?: string;
    highlights?: string[];
    explanation?: string;
    match_details?: Record<string, any>;
  }>;
  count: number;
  message?: string;
  suggestions?: string[];
  rag_response?: string;
}

type Camera = {
  id: string;
  name: string;
  feed_url?: string;
  image_url?: string;
};

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
  const [chatMessages, setChatMessages] = useState<{role: string, content: string}[]>([])
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
  const [specialCameraProcessed, setSpecialCameraProcessed] = useState(false)
  // Add a map to store descriptions per camera ID
  const [cameraPeopleDescriptions, setCameraPeopleDescriptions] = useState<Record<string, ExtendedPersonDescription[]>>({})
  // Add a map to store detections per camera ID
  const [cameraDetections, setCameraDetections] = useState<Record<string, ExtendedDetection[]>>({})
  // Track processed detection IDs to avoid duplicates
  const [processedDetectionIds, setProcessedDetectionIds] = useState<Record<string, Set<string>>>({})

  // Add new state variables for database search
  const [showDatabaseSearch, setShowDatabaseSearch] = useState(false)
  const [databaseSearchTerm, setDatabaseSearchTerm] = useState("")
  const [dbPeople, setDbPeople] = useState<ExtendedPersonDescription[]>([])
  const [filteredDbPeople, setFilteredDbPeople] = useState<ExtendedPersonDescription[]>([])
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [isDbLoading, setIsDbLoading] = useState(false)
  const [dbError, setDbError] = useState<string | null>(null)

  // Add a new state variable for the RAG response
  const [searchRagResponse, setSearchRagResponse] = useState<string>('');

  // Add to the state variables in the RightSidebar component
  const [activeTab, setActiveTab] = useState<'search' | 'upload' | 'chat' | 'database'>('search');
  const [chatQuery, setChatQuery] = useState('');
  const [chatResponse, setChatResponse] = useState<PersonSearchChatResponse | null>(null);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Add these state variables near the other state variables
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Add the handleFileChange and uploadFile functions
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadError('');
    }
  };

  const uploadFile = async () => {
    if (!selectedFile) return;
    
    setIsUploading(true);
    setUploadError('');
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Upload successful:', data);
      
      toast.success('Image uploaded and processed successfully!');
      setSelectedFile(null);
      
      // Refresh the current view after successful upload
      if (selectedCamera) {
        // Reload the camera detections
        fetchLatestFrame(selectedCamera.id);
      }
      
    } catch (error) {
      console.error('Error uploading file:', error);
      setUploadError(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      toast.error('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

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

  // Combined camera selection effect
  useEffect(() => {
    if (selectedCamera) {
      console.log('Camera selected:', selectedCamera);
      
      // Don't clear search results and UI state
      setSearchResults([]);
      setSelectedDetection(null);
      setSelectedPerson(null);
      setShowJsonView(false);
      
      // Load camera-specific descriptions if they exist
      if (cameraPeopleDescriptions[selectedCamera.id]) {
        setPersonDescriptions(cameraPeopleDescriptions[selectedCamera.id]);
      } else {
        setPersonDescriptions([]);
      }
      
      // Load camera-specific detections if they exist
      if (cameraDetections[selectedCamera.id]) {
        setDetections(cameraDetections[selectedCamera.id].map(detection => ({
          ...detection,
          type: detection.type || 'Unknown',
          confidence: detection.confidence || 0,
          timestamp: detection.timestamp || '',
          bbox: detection.bbox || [],
          camera_id: detection.camera_id || '',
          image: detection.image || '',
          id: detection.id || ''
        })));
      } else {
        setDetections([]);
      }
      
      // Clear any existing intervals to avoid multiple intervals
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
        "SF-UNS-003": "/videos/IMG_8252.mov",
        "SF-FER-004": "/videos/sf_park_001.mov",
        "SF-CHI-005": "/videos/IMG_8252.mov",
        "SF-MIS-006": "/videos/MIS.mov",
        "SF-HAI-007": "/videos/testingCam1.mov",
        "SF-NOB-008": "/videos/workingCam4.mov"
      };

      if (cameraVideoMap[selectedCamera.id]) {
        // For cameras with video feeds
        setCameraImage(null);
        setCurrentImageUrl(null);
        setIsVideoPlaying(true);
        setCameraFeed(cameraVideoMap[selectedCamera.id]);
        setLastProcessedFrame(null); // Reset the frame so VideoPlayer can provide a new one
      } else {
        // For other cameras, use random images
        const initialImageUrl = `https://picsum.photos/800/600?random=${Math.random()}`;
        setCameraImage(initialImageUrl);
        setCurrentImageUrl(initialImageUrl);
        setIsVideoPlaying(false);
        setCameraFeed(null);
        
        // For static image cameras, we need to extract frames ourselves
        // Start a process to fetch and convert the image to base64
        if (initialImageUrl) {
          console.log(`Fetching static image for camera ${selectedCamera.id}: ${initialImageUrl}`);
          
          // Create a temporary canvas to convert the image to a data URL
          const canvas = document.createElement('canvas');
          const img = new Image();
          img.crossOrigin = 'anonymous'; // Important for CORS
          img.onload = () => {
            // Set canvas dimensions to match image
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              try {
                // Convert to data URL
                const dataUrl = canvas.toDataURL('image/jpeg');
                console.log(`Extracted frame from static image for camera ${selectedCamera.id}`);
                // Set as last processed frame, which will trigger AI processing
                setLastProcessedFrame(dataUrl);
              } catch (err) {
                console.error(`Error converting image to data URL: ${err}`);
              }
            }
          };
          img.onerror = (err) => {
            console.error(`Error loading static image: ${err}`);
            setError(`Failed to load image for camera ${selectedCamera.id}`);
          };
          img.src = initialImageUrl;
          
          // Also set up an interval to periodically extract frames from static images
          // This ensures static image cameras get regular AI processing
          frameExtractionIntervalRef.current = setInterval(() => {
            if (!processingRef.current && selectedCamera) {
              console.log(`Periodically extracting frame from static image for camera ${selectedCamera.id}`);
              
              // Create a small random offset to make each frame slightly different
              // This helps avoid duplicate frame detection
              const canvas = document.createElement('canvas');
              const img = new Image();
              img.crossOrigin = 'anonymous';
              
              img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                
                if (ctx) {
                  // Draw image with slight variation to avoid duplicate detection
                  ctx.drawImage(img, 0, 0);
                  
                  // Add a tiny timestamp to the corner to make each frame unique
                  ctx.fillStyle = "rgba(255,255,255,0.01)"; // Nearly invisible
                  ctx.font = "8px sans-serif";
                  ctx.fillText(Date.now().toString(), 5, 5);
                  
                  try {
                    const dataUrl = canvas.toDataURL('image/jpeg');
                    console.log(`New periodic frame extracted for static camera ${selectedCamera.id}`);
                    setLastProcessedFrame(dataUrl);
                  } catch (err) {
                    console.error(`Error creating data URL for periodic frame: ${err}`);
                  }
                }
              };
              
              img.onerror = (err) => {
                console.error(`Error loading static image for periodic frame: ${err}`);
              };
              
              // Add cache-busting parameter to avoid browser caching
              img.src = initialImageUrl + `&t=${Date.now()}`;
            }
          }, 10000); // Extract every 10 seconds for static images
        }
      }
      
      // Reset error state
      setError(null);
      
      // Reset the special camera processed flag when camera changes
      if (selectedCamera.id !== "SF-MIS-006") {
        setSpecialCameraProcessed(false);
      }
      
      // Initialize processed detection IDs for this camera if needed
      if (!processedDetectionIds[selectedCamera.id]) {
        setProcessedDetectionIds(prev => ({
          ...prev,
          [selectedCamera.id]: new Set()
        }));
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
          
          const data = await response.json() as FrameResponse;
          console.log("API response:", data);
          console.log("Detections:", data.detections?.length || 0);
          console.log("Person crops:", data.person_crops?.length || 0);
          
          // Add a simple alert for testing purposes
          console.log("⚠️ TESTING ALERT SYSTEM - Frame processed successfully");
          
          // Only trigger Amber Alert for SF-MIS-006 camera
          if (selectedCamera.id === "SF-MIS-006" && !specialCameraProcessed && data.person_crops && data.person_crops.length > 0) {
            console.log("SF-MIS-006 Camera detected - triggering AMBER alert");
            
            // Mark as processed so we don't trigger it again
            setSpecialCameraProcessed(true);
            
            // Create a synthetic amber alert match
            const syntheticAlert = {
              match: true,
              alert: {
                id: "amber-auto-test",
                timestamp: new Date().toISOString(),
                location: selectedCamera.name,
                description: {
                  gender: "male",
                  age_group: "child",
                  hair_style: "short",
                  clothing_top: "jacket",
                  clothing_top_color: "black",
                  clothing_bottom: "pants",
                  clothing_bottom_color: "black",
                  location_context: "outdoor"
                },
                alert_message: `AMBER ALERT: Missing child potentially detected in ${selectedCamera.name} camera feed.`
              },
              score: 0.92 // 92% match
            };
            
            // Show a browser alert for immediate testing
           
            
            // Dispatch the amber alert event
            console.log("Triggering Amber Alert for SF-MIS-006 camera");
            amberAlertEvents.dispatch({ 
              amber_alert: syntheticAlert,
              camera_id: selectedCamera.id
            });
            
            // Play alert sound
            try {
              const alertSound = new Audio('/alert-sound.mp3');
              alertSound.play().catch(e => console.log('Error playing alert sound:', e));
            } catch (soundError) {
              console.error('Error with alert sound:', soundError);
            }
          }
          
          // Check for amber alert matches from backend (keeping this functionality)
          if (data.amber_alert && selectedCamera.id === "SF-MIS-006") {
            console.log("AMBER ALERT MATCH DETECTED FROM BACKEND:", data.amber_alert);
            
            // Dispatch amber alert event only for SF-MIS-006
            console.log("Triggering backend-provided Amber Alert for SF-MIS-006 camera");
            amberAlertEvents.dispatch({ 
              amber_alert: data.amber_alert,
              camera_id: selectedCamera.id
            });
            
            // Optional: Play alert sound
            try {
              const alertSound = new Audio('/alert-sound.mp3');
              alertSound.play().catch(e => console.log('Error playing alert sound:', e));
            } catch (soundError) {
              console.error('Error with alert sound:', soundError);
            }
          } else if (data.amber_alert) {
            // For other cameras, just log it but don't trigger the UI alert
            console.log(`AMBER ALERT detected but not displayed (camera ${selectedCamera.id} is not SF-MIS-006)`);
          }
          
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
              cropped_image: `data:image/jpeg;base64,${crop.crop}`,
              camera_id: selectedCamera.id,
              timestamp: new Date().toISOString()
            }));
            
            // Update the camera-specific descriptions
            setCameraPeopleDescriptions(prev => ({
              ...prev,
              [selectedCamera.id]: descriptions
            }));
            
            // Update the current view only if for the selected camera
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
  }, [selectedCamera, cameraPeopleDescriptions, cameraDetections, processedDetectionIds]);

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
      
      // Retry logic for API calls
      let retries = 0;
      const maxRetries = 3;
      let success = false;
      let responseData: FrameResponse | null = null;
      
      while (retries < maxRetries && !success) {
        try {
          // Log the first 100 characters of the frame URL to help with debugging
          console.log(`Attempt ${retries + 1}/${maxRetries} - Processing frame for camera ${selectedCamera.id}`);
          
          const response = await fetch(`${API_BASE_URL}/process_frame`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              frame_data: frameUrl,
              camera_id: selectedCamera.id
            }),
            // Add a timeout to the fetch request
            signal: AbortSignal.timeout(30000) // 30 second timeout
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`API error response (attempt ${retries + 1}/${maxRetries}):`, errorText);
            throw new Error(`Failed to process frame: ${response.statusText} - ${errorText}`);
          }
          
          responseData = await response.json() as FrameResponse;
          console.log("API response received:", responseData);
          success = true;
        } catch (err) {
          retries++;
          if (retries >= maxRetries) {
            console.error(`Failed after ${maxRetries} attempts:`, err);
            throw err;
          }
          console.log(`Retrying... (${retries}/${maxRetries})`);
          // Wait with exponential backoff
          await new Promise(resolve => setTimeout(resolve, retries * 1000));
        }
      }
      
      if (!responseData) {
        throw new Error("No response data received from API after retries");
      }
      
      const data = responseData;
      
      // Add a simple alert for testing purposes
      console.log("⚠️ TESTING ALERT SYSTEM - Frame processed successfully");
      
      // Only trigger Amber Alert for SF-MIS-006 camera
      if (selectedCamera.id === "SF-MIS-006" && !specialCameraProcessed && data.person_crops && data.person_crops.length > 0) {
        console.log("SF-MIS-006 Camera detected - triggering AMBER alert");
        
        // Mark as processed so we don't trigger it again
        setSpecialCameraProcessed(true);
        
        // Create a synthetic amber alert match
        const syntheticAlert = {
          match: true,
          alert: {
            id: "amber-auto-test",
            timestamp: new Date().toISOString(),
            location: selectedCamera.name,
            description: {
              gender: "male",
              age_group: "child",
              hair_style: "short",
              clothing_top: "jacket",
              clothing_top_color: "black",
              clothing_bottom: "pants",
              clothing_bottom_color: "black",
              location_context: "outdoor"
            },
            alert_message: `AMBER ALERT: Missing child potentially detected in ${selectedCamera.name} camera feed.`
          },
          score: 0.92 // 92% match
        };
        
        
        
        // Dispatch the amber alert event
        console.log("Triggering Amber Alert for SF-MIS-006 camera");
        amberAlertEvents.dispatch({ 
          amber_alert: syntheticAlert,
          camera_id: selectedCamera.id
        });
        
        // Play alert sound
        try {
          const alertSound = new Audio('/alert-sound.mp3');
          alertSound.play().catch(e => console.log('Error playing alert sound:', e));
        } catch (soundError) {
          console.error('Error with alert sound:', soundError);
        }
      }
      
      // Check for amber alert matches from backend (keeping this functionality)
      if (data.amber_alert && selectedCamera.id === "SF-MIS-006") {
        console.log("AMBER ALERT MATCH DETECTED FROM BACKEND:", data.amber_alert);
        
        // Dispatch amber alert event only for SF-MIS-006
        console.log("Triggering backend-provided Amber Alert for SF-MIS-006 camera");
        amberAlertEvents.dispatch({ 
          amber_alert: data.amber_alert,
          camera_id: selectedCamera.id
        });
        
        // Optional: Play alert sound
        try {
          const alertSound = new Audio('/alert-sound.mp3');
          alertSound.play().catch(e => console.log('Error playing alert sound:', e));
        } catch (soundError) {
          console.error('Error with alert sound:', soundError);
        }
      } else if (data.amber_alert) {
        // For other cameras, just log it but don't trigger the UI alert
        console.log(`AMBER ALERT detected but not displayed (camera ${selectedCamera.id} is not SF-MIS-006)`);
      }
      
      // Debug: Log detailed information about the response
      console.log(`Response contains ${data.detections?.length || 0} detections`);
      console.log(`Response contains ${data.person_crops?.length || 0} person crops`);
      console.log(`Response description: ${data.description?.substring(0, 100)}...`);
      
      // Only add new detections that haven't been processed before
      if (data.detections && data.detections.length > 0) {
        console.log("Processing new detections:", data.detections.length);
        
        // Get current processed IDs for this camera
        const processedIds = processedDetectionIds[selectedCamera.id] || new Set();
        
        // Filter out detections we've already processed
        const newDetections = data.detections.filter(detection => {
          // Create a unique ID for each detection based on its properties
          const detectionId = detection.id || 
            `${detection.camera_id || ''}_${detection.type}_${(detection as any).bbox ? JSON.stringify((detection as any).bbox) : ''}_${detection.confidence}`;
            
          // Check if we've processed this detection before
          return !processedIds.has(detectionId);
        });
        
        if (newDetections.length > 0) {
          console.log(`Adding ${newDetections.length} new detections to camera ${selectedCamera.id}`);
          
          // Add camera ID to each detection
          const detectionsWithCameraId = newDetections.map(detection => ({
            ...detection,
            id: detection.id || `detection_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            camera_id: selectedCamera.id,
            timestamp: detection.timestamp || new Date().toISOString()
          }));
          
          // Update the tracked detection IDs
          const updatedProcessedIds = new Set(processedIds);
          detectionsWithCameraId.forEach(detection => {
            updatedProcessedIds.add(detection.id);
          });
          
          setProcessedDetectionIds(prev => ({
            ...prev,
            [selectedCamera.id]: updatedProcessedIds
          }));
          
          // Update camera-specific detections
          setCameraDetections(prev => {
            const existingDetections = prev[selectedCamera.id] || [];
            const updatedDetections = [...existingDetections, ...detectionsWithCameraId];
            return {
              ...prev,
              [selectedCamera.id]: updatedDetections
            };
          });
          
          // Update current view
          setDetections(prev => [...prev, ...detectionsWithCameraId]);
        } else {
          console.log("No new detections to add (already processed)");
        }
      }
      
      // Process person descriptions if available (similar logic)
      if (data.person_crops && data.person_crops.length > 0) {
        console.log("Processing person descriptions:", data.person_crops.length);
        
        // Get currently processed descriptions for deduplication
        const existingDescriptions = cameraPeopleDescriptions[selectedCamera.id] || [];
        const existingIds = new Set(existingDescriptions.map(desc => desc.id));
        
        // Process new descriptions
        const newDescriptions = data.person_crops
          .filter(crop => !crop.id || !existingIds.has(crop.id))
          .map(crop => ({
            ...crop.description,
            id: crop.id || `description_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            yoloCrop: crop.crop,
            cropped_image: `data:image/jpeg;base64,${crop.crop}`,
            camera_id: selectedCamera.id,
            timestamp: new Date().toISOString()
          }));
        
        if (newDescriptions.length > 0) {
          console.log(`Adding ${newDescriptions.length} new person descriptions to camera ${selectedCamera.id}`);
          
          // Update the camera-specific descriptions
          setCameraPeopleDescriptions(prev => {
            const existingDescriptions = prev[selectedCamera.id] || [];
            const updatedDescriptions = [...existingDescriptions, ...newDescriptions];
            return {
              ...prev,
              [selectedCamera.id]: updatedDescriptions
            };
          });
          
          // Update current view
          setPersonDescriptions(prev => [...prev, ...newDescriptions]);
        } else {
          console.log("No new person descriptions to add (already processed)");
        }
      }
    } catch (error) {
      console.error("Error processing frame:", error);
      setError(error instanceof Error ? error.message : "Failed to process frame");
    } finally {
      processingRef.current = false;
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
      setSearchResults([]);
      
      // Log that we're using Gemini direct search
      console.log("Searching with Gemini direct database search:", searchQuery);
      
      const result = await searchPeople(searchQuery) as ExtendedSearchResult;
      
      // Set search suggestions and message
      setSearchSuggestions(result.suggestions || []);
      setSearchMessage(result.message || '');
      
      // Store the RAG response for display
      setSearchRagResponse(result.rag_response || '');
      
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
        hair_style: match.description.hair_style,
        similarity: match.similarity,
        camera_id: match.metadata.camera_id,
        camera_location: match.metadata.camera_location || 'Unknown location',
        description: JSON.stringify(match.description), // Convert description object to string
        timestamp: match.metadata.timestamp,
        raw_data: match.description, // Store the raw description data
        search_result: true, // Flag to indicate this came from a search
        explanation: match.explanation || match.metadata.explanation || '', // Store the explanation from Gemini
        highlights: match.highlights || [] // Store any highlights
      }));
      
      // Sort results by similarity score
      mappedResults.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
      
      // Remove duplicates based on a unique identifier
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
          person.hair_color || 'unknown',
          person.camera_id || 'unknown' // Include camera ID to prevent collapsing results from different cameras
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

  // Add function to load database
  const loadDatabase = async () => {
    try {
      setIsDbLoading(true)
      setDbError(null)
      
      // Try to load from localStorage first
      let loadedPeople: ExtendedPersonDescription[] = []
      try {
        const storedData = localStorage.getItem('people_database')
        if (storedData) {
          const parsedData = JSON.parse(storedData)
          
          // Group by camera ID to assign sequential IDs
          const cameraGroups: Record<string, ExtendedPersonDescription[]> = {}
          
          // First pass - group by camera
          parsedData.people.forEach((person: any, index: number) => {
            const cameraId = person.metadata?.camera_id || 'unknown'
            if (!cameraGroups[cameraId]) {
              cameraGroups[cameraId] = []
            }
            
            // Add to camera group
            cameraGroups[cameraId].push({
              ...person,
              id: person.id || `${cameraId}:${index + 1}`,
              gender: person.description?.gender || 'unknown',
              age_group: person.description?.age_group || 'unknown',
              clothing_top: person.description?.clothing_top || 'unknown',
              clothing_top_color: person.description?.clothing_top_color,
              clothing_bottom: person.description?.clothing_bottom,
              clothing_bottom_color: person.description?.clothing_bottom_color,
              hair_color: person.description?.hair_color,
              camera_id: cameraId,
              timestamp: person.metadata?.timestamp || new Date().toISOString(),
              description: JSON.stringify(person.description),
              raw_data: person.description,
              cropped_image: person.cropped_image || `/cropped_images/${cameraId}_${index + 1}.jpg`
            })
          })
          
          // Second pass - assign sequential IDs within each camera group
          Object.entries(cameraGroups).forEach(([cameraId, people]) => {
            people.forEach((person, index) => {
              // Format ID as "cameraId:personNumber"
              person.id = `${cameraId}:${index + 1}`
              // Update cropped image path to match new ID format
              person.cropped_image = `/cropped_images/${person.id.replace(':', '_')}.jpg`
              loadedPeople.push(person)
            })
          })
        } else {
          // If not in localStorage, try to fetch from the API
          const response = await fetch('/api/people_database')
          if (!response.ok) {
            throw new Error(`Failed to fetch database: ${response.statusText}`)
          }
          const data = await response.json()
          
          // Group by camera ID to assign sequential IDs
          const cameraGroups: Record<string, ExtendedPersonDescription[]> = {}
          
          // First pass - group by camera
          data.people.forEach((person: any, index: number) => {
            const cameraId = person.metadata?.camera_id || 'unknown'
            if (!cameraGroups[cameraId]) {
              cameraGroups[cameraId] = []
            }
            
            // Add to camera group
            cameraGroups[cameraId].push({
              ...person,
              id: person.id || `${cameraId}:${index + 1}`,
              gender: person.description?.gender || 'unknown',
              age_group: person.description?.age_group || 'unknown',
              clothing_top: person.description?.clothing_top || 'unknown',
              clothing_top_color: person.description?.clothing_top_color,
              clothing_bottom: person.description?.clothing_bottom,
              clothing_bottom_color: person.description?.clothing_bottom_color,
              hair_color: person.description?.hair_color,
              camera_id: cameraId,
              timestamp: person.metadata?.timestamp || new Date().toISOString(),
              description: JSON.stringify(person.description),
              raw_data: person.description,
              cropped_image: person.cropped_image || `/cropped_images/${cameraId}_${index + 1}.jpg`
            })
          })
          
          // Second pass - assign sequential IDs within each camera group
          Object.entries(cameraGroups).forEach(([cameraId, people]) => {
            people.forEach((person, index) => {
              // Format ID as "cameraId:personNumber"
              person.id = `${cameraId}:${index + 1}`
              // Update cropped image path to match new ID format
              person.cropped_image = `/cropped_images/${person.id.replace(':', '_')}.jpg`
              loadedPeople.push(person)
            })
          })
          
          // Save the reorganized data to localStorage
          const reorganizedData = {
            ...data,
            people: loadedPeople
          }
          localStorage.setItem('people_database', JSON.stringify(reorganizedData))
        }
      } catch (error) {
        console.error('Error loading database:', error)
        setDbError('Failed to load database. Please try again later.')
      }
      
      setDbPeople(loadedPeople)
      setFilteredDbPeople(loadedPeople)
      
      // Display results grouped by camera when no filters are applied
      organizeResultsByCameraId(loadedPeople)
      
      // Extract all possible tags
      const categorizedTags = new Map<string, Set<string>>()
      
      // Define attribute mapping for consolidation
      const attributeCategories: Record<string, string> = {
        // Gender consolidation
        'gender:male': 'gender:male',
        'gender:man': 'gender:male',
        'gender:boy': 'gender:male',
        'gender:female': 'gender:female',
        'gender:woman': 'gender:female',
        'gender:girl': 'gender:female',
        
        // Age consolidation
        'age_group:child': 'age_group:child',
        'age_group:kid': 'age_group:child',
        'age_group:young': 'age_group:child',
        'age_group:teen': 'age_group:teen',
        'age_group:teenager': 'age_group:teen',
        'age_group:adult': 'age_group:adult',
        'age_group:middle-aged': 'age_group:adult',
        'age_group:senior': 'age_group:senior',
        'age_group:elderly': 'age_group:senior',
        
        // Facial features consolidation
        'facial_features:beard': 'facial_features:beard',
        'facial_features:stubble': 'facial_features:beard',
        'facial_features:goatee': 'facial_features:beard',
        'facial_features:mustache': 'facial_features:mustache',
        'facial_features:glasses': 'facial_features:glasses',
        'facial_features:sunglasses': 'facial_features:glasses',
        
        // Hair color consolidation
        'hair_color:black': 'hair_color:black',
        'hair_color:brown': 'hair_color:brown',
        'hair_color:blonde': 'hair_color:blonde',
        'hair_color:blond': 'hair_color:blonde',
        'hair_color:red': 'hair_color:red',
        'hair_color:gray': 'hair_color:gray',
        'hair_color:grey': 'hair_color:gray',
        'hair_color:white': 'hair_color:white',
        
        // Clothing top
        'clothing_top:shirt': 'clothing_top:shirt',
        'clothing_top:t-shirt': 'clothing_top:shirt',
        'clothing_top:tshirt': 'clothing_top:shirt',
        'clothing_top:hoodie': 'clothing_top:hoodie',
        'clothing_top:jacket': 'clothing_top:jacket',
        'clothing_top:coat': 'clothing_top:jacket',
        'clothing_top:sweater': 'clothing_top:sweater',
        
        // Clothing bottom
        'clothing_bottom:pants': 'clothing_bottom:pants',
        'clothing_bottom:jeans': 'clothing_bottom:jeans',
        'clothing_bottom:shorts': 'clothing_bottom:shorts',
        'clothing_bottom:skirt': 'clothing_bottom:skirt',
        'clothing_bottom:dress': 'clothing_bottom:dress',
        
        // Location context
        'location_context:indoor': 'location_context:indoor',
        'location_context:inside': 'location_context:indoor',
        'location_context:outdoor': 'location_context:outdoor',
        'location_context:outside': 'location_context:outdoor',
      }
      
      loadedPeople.forEach((person: ExtendedPersonDescription) => {
        // Extract tags from raw_data
        if (person.raw_data) {
          Object.entries(person.raw_data).forEach(([key, value]) => {
            if (value && typeof value === 'string') {
              const tagKey = `${key}:${value.toLowerCase()}`
              const normalizedTag = attributeCategories[tagKey] || tagKey
              
              // Get or create category
              const [category] = normalizedTag.split(':')
              if (!categorizedTags.has(category)) {
                categorizedTags.set(category, new Set<string>())
              }
              categorizedTags.get(category)?.add(normalizedTag)
            }
          })
        }
      })
      
      // Convert map to sorted array of tags
      const tags: string[] = []
      const sortedCategories = Array.from(categorizedTags.keys()).sort()
      
      for (const category of sortedCategories) {
        const categoryTags = Array.from(categorizedTags.get(category) || []).sort()
        tags.push(...categoryTags)
      }
      
      setAvailableTags(tags)
    } catch (error) {
      console.error('Error loading database:', error)
      setDbError(error instanceof Error ? error.message : 'Unknown error loading database')
    } finally {
      setIsDbLoading(false)
    }
  }

  // Add function to organize results by camera ID
  const organizeResultsByCameraId = (people: ExtendedPersonDescription[]) => {
    // Group people by camera ID
    const groupedByCameraId: Record<string, ExtendedPersonDescription[]> = {}
    
    people.forEach(person => {
      const cameraId = person.camera_id || 'unknown'
      if (!groupedByCameraId[cameraId]) {
        groupedByCameraId[cameraId] = []
      }
      groupedByCameraId[cameraId].push(person)
    })
    
    // Sort each group by person detection number
    Object.values(groupedByCameraId).forEach(group => {
      group.sort((a, b) => {
        // Extract person number from ID (format: "cameraId:personNumber")
        const aNum = parseInt(a.id?.split(':')[1] || '0', 10)
        const bNum = parseInt(b.id?.split(':')[1] || '0', 10)
        return aNum - bNum
      })
    })
    
    // Flatten back to an array, with camera groups maintained
    const organizedResults: ExtendedPersonDescription[] = []
    
    // Sort camera IDs for consistent display
    const sortedCameraIds = Object.keys(groupedByCameraId).sort()
    
    sortedCameraIds.forEach(cameraId => {
      organizedResults.push(...groupedByCameraId[cameraId])
    })
    
    setFilteredDbPeople(organizedResults)
  }

  // Load database on mount
  useEffect(() => {
    if (showDatabaseSearch) {
      loadDatabase()
    }
  }, [showDatabaseSearch])

  // Filter db people based on search term and tags
  useEffect(() => {
    if (!dbPeople.length) return
    
    let filtered = [...dbPeople]
    
    // Apply search term filter
    if (databaseSearchTerm) {
      const term = databaseSearchTerm.toLowerCase()
      filtered = filtered.filter(person => {
        // Check if description contains the term
        if (person.description?.toLowerCase().includes(term)) return true
        
        // Check specific fields
        if (person.gender?.toLowerCase().includes(term)) return true
        if (person.age_group?.toLowerCase().includes(term)) return true
        if (person.clothing_top?.toLowerCase().includes(term)) return true
        if (person.clothing_bottom?.toLowerCase().includes(term)) return true
        if (person.hair_color?.toLowerCase().includes(term)) return true
        if (person.camera_id?.toLowerCase().includes(term)) return true
        
        return false
      })
    }
    
    // Apply tag filters with normalized matching
    if (selectedTags.length > 0) {
      filtered = filtered.filter(person => {
        if (!person.raw_data) return false
        
        return selectedTags.every(tag => {
          const [key, value] = tag.split(':')
          
          // Handle special consolidation cases
          if (key === 'gender') {
            if (value === 'male' && ['male', 'man', 'boy'].includes(person.raw_data?.[key]?.toLowerCase())) return true
            if (value === 'female' && ['female', 'woman', 'girl'].includes(person.raw_data?.[key]?.toLowerCase())) return true
          }
          
          if (key === 'age_group') {
            if (value === 'child' && ['child', 'kid', 'young'].includes(person.raw_data?.[key]?.toLowerCase())) return true
            if (value === 'teen' && ['teen', 'teenager'].includes(person.raw_data?.[key]?.toLowerCase())) return true
            if (value === 'adult' && ['adult', 'middle-aged'].includes(person.raw_data?.[key]?.toLowerCase())) return true
            if (value === 'senior' && ['senior', 'elderly'].includes(person.raw_data?.[key]?.toLowerCase())) return true
          }
          
          if (key === 'facial_features') {
            const facialFeatures = person.raw_data?.[key]?.toLowerCase() || ''
            if (value === 'beard' && ['beard', 'goatee', 'stubble'].some(term => facialFeatures.includes(term))) return true
            if (value === 'glasses' && ['glasses', 'sunglasses'].some(term => facialFeatures.includes(term))) return true
          }
          
          if (key === 'clothing_top') {
            if (value === 'shirt' && ['shirt', 't-shirt', 'tshirt'].includes(person.raw_data?.[key]?.toLowerCase())) return true
            if (value === 'jacket' && ['jacket', 'coat'].includes(person.raw_data?.[key]?.toLowerCase())) return true
          }
          
          if (key === 'location_context') {
            if (value === 'indoor' && ['indoor', 'inside'].includes(person.raw_data?.[key]?.toLowerCase())) return true
            if (value === 'outdoor' && ['outdoor', 'outside'].includes(person.raw_data?.[key]?.toLowerCase())) return true
          }
          
          // Default case - exact match
          return person.raw_data?.[key]?.toLowerCase() === value.toLowerCase()
        })
      })
    }
    
    // If no filters are active, organize by camera ID
    if (!databaseSearchTerm && selectedTags.length === 0) {
      organizeResultsByCameraId(dbPeople)
      return
    }
    
    // Otherwise, show filtered results
    setFilteredDbPeople(filtered)
  }, [databaseSearchTerm, selectedTags, dbPeople])

  // Toggle a tag
  const toggleTag = (tag: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag)
      } else {
        return [...prev, tag]
      }
    })
  }

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString()
  }

  // Clear all filters
  const clearFilters = () => {
    setDatabaseSearchTerm('')
    setSelectedTags([])
  }

  // Add the handleChatSubmit function
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!chatQuery.trim()) return;
    
    // Add user message to chat
    const userMessage = { role: 'user', content: chatQuery };
    const updatedMessages = [...chatMessages, userMessage];
    setChatMessages(updatedMessages);
    
    // Clear input and set loading
    setChatQuery('');
    setIsChatLoading(true);
    
    try {
      // Call the API
      const response = await personSearchChat({
        query: chatQuery,
        conversation_history: chatMessages,
      });
      
      // Update state with response
      setChatResponse(response);
      
      // Add assistant response to chat
      setChatMessages([...updatedMessages, { role: 'assistant', content: response.response }]);
    } catch (error) {
      console.error('Error in chat:', error);
      toast.error('Error in chat. Please try again.');
    } finally {
      setIsChatLoading(false);
    }
  };

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
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #111827;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #4B5563;
          border-radius: 2px;
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #4B5563 #111827;
        }
      `}</style>
      
      {/* Toggle buttons for different sections */}
      <div className="border-b border-gray-800 p-2">
        <div className="flex justify-between w-full">
          <div className="flex space-x-1">
            <Button 
              variant="outline"
              size="sm"
              className={activeTab === 'search' ? "bg-blue-600 text-white" : "text-gray-400"}
              onClick={() => {
                setActiveTab('search');
                setShowDatabaseSearch(false);
              }}
            >
              Search
            </Button>
            <Button 
              variant="outline"
              size="sm"
              className={activeTab === 'upload' ? "bg-blue-600 text-white" : "text-gray-400"}
              onClick={() => {
                setActiveTab('upload');
                setShowDatabaseSearch(false);
              }}
            >
              Upload
            </Button>
            <Button 
              variant="outline"
              size="sm"
              className={activeTab === 'chat' ? "bg-blue-600 text-white" : "text-gray-400"}
              onClick={() => {
                setActiveTab('chat');
                setShowDatabaseSearch(false);
              }}
            >
              Chat
            </Button>
            <Button 
              variant="outline"
              size="sm"
              className={activeTab === 'database' ? "bg-blue-600 text-white" : "text-gray-400"}
              onClick={() => {
                setActiveTab('database');
                setShowDatabaseSearch(true);
              }}
            >
              Database
            </Button>
          </div>
        </div>
      </div>
      
      {activeTab === 'database' && (
        // Database content
        <DatabaseSearch />
      )}
      
      {activeTab === 'search' && !showDatabaseSearch && (
        // Original content
        <>
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
              {selectedCamera && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    if (!selectedCamera) return; // Safety check
                    
                    if (cameraFeed) {
                      // For video feeds, we need to manually trigger a frame extraction
                      const video = document.querySelector('video') as HTMLVideoElement | null;
                      const canvas = document.createElement('canvas');
                      if (video && canvas) {
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                          const frameUrl = canvas.toDataURL('image/jpeg');
                          console.log(`Manually extracted frame for camera ${selectedCamera.id}`);
                          setLastProcessedFrame(frameUrl);
                          processFrame(frameUrl);
                        }
                      }
                    } else if (cameraImage) {
                      // For static images, we can directly process the image
                      const img = document.querySelector('img[alt^="Camera feed"]') as HTMLImageElement | null;
                      const canvas = document.createElement('canvas');
                      if (img && canvas) {
                        canvas.width = img.width || img.clientWidth;
                        canvas.height = img.height || img.clientHeight;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                          const frameUrl = canvas.toDataURL('image/jpeg');
                          console.log(`Manually extracted frame for camera ${selectedCamera.id}`);
                          setLastProcessedFrame(frameUrl);
                          processFrame(frameUrl);
                        }
                      }
                    }
                  }}
                  className="ml-auto"
                >
                  Analyze Now
                </Button>
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
                <User className="h-5 w-5 text-blue-400" />
                <h2 className="text-lg font-semibold text-white">Person Descriptions</h2>
                <span className="text-xs text-gray-400 ml-auto">{personDescriptions.length} people</span>
              </div>
              
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {personDescriptions.length > 0 ? (
                  personDescriptions.map((person, index) => (
                    <motion.div
                      key={person.id || `person-${index}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="bg-gray-800 rounded-lg p-3 cursor-pointer hover:bg-gray-700"
                      onClick={() => handlePersonClick(person)}
                    >
                      <div className="flex justify-between items-center mb-2">
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
                                } else if (result.filtered) {
                                  alert(`Not added: ${result.reason}`);
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
                      
                      <div className="flex flex-col mb-3">
                        <div className="bg-gray-900 rounded-lg p-1 mb-2 flex items-center justify-center h-40">
                          <img
                            src={person.cropped_image || (person.yoloCrop ? `data:image/jpeg;base64,${person.yoloCrop}` : undefined)}
                            alt={`Person ${index + 1}`}
                            className="h-full object-contain bg-black/30 rounded"
                            onError={(e) => {
                              console.error(`Error loading person image for ${index}:`, e);
                              (e.target as HTMLImageElement).src = '/placeholder-person.png';
                            }}
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                          {person.gender && (
                            <div><span className="text-blue-400">Gender:</span> {person.gender}</div>
                          )}
                          {person.age_group && (
                            <div><span className="text-blue-400">Age:</span> {person.age_group}</div>
                          )}
                          {person.hair_color && (
                            <div><span className="text-blue-400">Hair:</span> {person.hair_color}</div>
                          )}
                          {person.clothing_top && (
                            <div><span className="text-blue-400">Top:</span> {person.clothing_top_color ? `${person.clothing_top_color} ` : ''}{person.clothing_top}</div>
                          )}
                          {person.clothing_bottom && (
                            <div><span className="text-blue-400">Bottom:</span> {person.clothing_bottom_color ? `${person.clothing_bottom_color} ` : ''}{person.clothing_bottom}</div>
                          )}
                          <div>
                            <span className="text-blue-400">Camera:</span> {person.camera_id || selectedCamera?.id || 'Unknown'}
                          </div>
                          {/* Display camera location if available (especially from search results) */}
                          {person.camera_location && (
                            <div className="col-span-2"><span className="text-blue-400">Location:</span> {person.camera_location}</div>
                          )}
                          {/* Display if this is from a search */}
                          {person.search_result && (
                            <div className="col-span-2"><span className="text-xs text-blue-500 bg-blue-950/50 px-2 py-0.5 rounded">Search Result</span></div>
                          )}
                        </div>
                      </div>
                      
                      <div className="mt-2 px-2 py-2 bg-gray-900 rounded-lg">
                        <pre className="text-xs overflow-x-auto text-gray-300 whitespace-pre-wrap">
                          {JSON.stringify(person.raw_data || JSON.parse(person.description || '{}'), null, 2)}
                        </pre>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center text-gray-400 py-4">
                    <p>No people detected yet.</p>
                    <p className="text-xs mt-1">People will appear here as they are detected.</p>
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
                <div className="space-y-3 mt-2">
                  <h3 className="text-sm font-medium text-white">Results</h3>
                  
                  {/* RAG response from Gemini */}
                  {searchRagResponse && (
                    <div className="bg-blue-900/30 border border-blue-800/50 rounded-lg p-3 text-sm text-gray-200 mb-3">
                      <p>{searchRagResponse}</p>
                    </div>
                  )}
                  
                  {/* Search results */}
                  {searchResults.map((result, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="bg-gray-800 rounded-lg p-3 cursor-pointer hover:bg-gray-700 border border-gray-700"
                      onClick={() => handlePersonClick(result)}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-blue-400">
                          {result.camera_id ? `Camera ${result.camera_id}` : 'Unknown Camera'}
                        </span>
                        {result.similarity !== undefined && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            result.similarity > 80 ? 'bg-green-900/70 text-green-300' : 
                            result.similarity > 60 ? 'bg-yellow-900/70 text-yellow-300' : 
                            'bg-red-900/70 text-red-300'
                          }`}>
                            {result.similarity.toFixed(0)}% Match
                          </span>
                        )}
                      </div>
                      
                      {/* Display the image if available */}
                      <div className="flex gap-3 mb-3">
                        {(result.cropped_image || result.yoloCrop) && (
                          <div className="w-20 h-20 bg-gray-900 rounded flex items-center justify-center overflow-hidden">
                            <img 
                              src={result.cropped_image || (result.yoloCrop ? `data:image/jpeg;base64,${result.yoloCrop}` : undefined)} 
                              alt="Person" 
                              className="object-contain w-full h-full"
                              onError={(e) => {
                                console.error(`Error loading search result image:`, e);
                                (e.target as HTMLImageElement).src = '/placeholder-person.png';
                              }}
                            />
                          </div>
                        )}
                        
                        {/* Person details in grid layout */}
                        <div className="flex-1 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-300">
                          {result.gender && (
                            <div><span className="text-blue-400">Gender:</span> {result.gender}</div>
                          )}
                          {result.age_group && (
                            <div><span className="text-blue-400">Age:</span> {result.age_group}</div>
                          )}
                          {result.hair_color && (
                            <div>
                              <span className="text-blue-400">Hair:</span> 
                              {result.hair_style ? `${result.hair_style} ` : ''}
                              {result.hair_color}
                            </div>
                          )}
                          {result.clothing_top && (
                            <div>
                              <span className="text-blue-400">Top:</span> 
                              {result.clothing_top_color ? `${result.clothing_top_color} ` : ''}
                              {result.clothing_top}
                            </div>
                          )}
                          {result.clothing_bottom && (
                            <div>
                              <span className="text-blue-400">Bottom:</span> 
                              {result.clothing_bottom_color ? `${result.clothing_bottom_color} ` : ''}
                              {result.clothing_bottom}
                            </div>
                          )}
                          {result.camera_location && (
                            <div className="col-span-2">
                              <span className="text-blue-400">Location:</span> {result.camera_location}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Explanation from Gemini if available */}
                      {result.explanation && (
                        <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-400">
                          <p className="italic">{result.explanation}</p>
                        </div>
                      )}
                      
                      {/* Attributes that matched the search query */}
                      {result.highlights && result.highlights.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {result.highlights.map((highlight, i) => (
                            <span key={i} className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded">
                              {highlight}
                            </span>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </>
      )}
      
      {activeTab === 'chat' && (
        <div className="p-4">
          <div className="flex flex-col h-full">
            {/* Chat messages display */}
            <div className="flex-1 overflow-y-auto mb-4 p-2 border border-gray-800 rounded bg-gray-900 max-h-[50vh] custom-scrollbar">
              {chatMessages.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  <p className="mb-2">Welcome to Foresight AI Chat!</p>
                  <p>Ask about people detected in the camera feeds or search for specific individuals.</p>
                  <p className="text-xs mt-4">Example: "Show me all males wearing red shirts" or "Are there any children with backpacks?"</p>
                </div>
              ) : (
                chatMessages.map((msg, index) => (
                  <div key={index} className={`mb-4 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                    <div className={`inline-block p-3 rounded-lg ${
                      msg.role === 'user' 
                        ? 'bg-blue-900 text-blue-100' 
                        : 'bg-gray-800 text-gray-100'
                    }`}>
                      <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                    </div>
                  </div>
                ))
              )}
              {isChatLoading && (
                <div className="text-center py-3">
                  <div className="inline-block p-2 bg-gray-800 rounded-lg">
                    <div className="flex space-x-2 justify-center items-center">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* If we have search suggestions, show them */}
            {chatResponse?.suggested_searches && chatResponse.suggested_searches.length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-gray-400 mb-2">Suggested searches:</p>
                <div className="flex flex-wrap gap-2">
                  {chatResponse.suggested_searches.map((suggestion, index) => (
                    <button
                      key={index}
                      className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded-full"
                      onClick={() => {
                        setChatQuery(suggestion);
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Quick match results */}
            {chatResponse?.matches && chatResponse.matches.length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-gray-400 mb-2">Potential matches:</p>
                <div className="grid grid-cols-1 gap-2">
                  {chatResponse.matches.map((match, index) => (
                    <div key={index} className="p-2 border border-gray-800 rounded-lg bg-gray-800">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium">{match.camera_location || match.camera_id}</p>
                        <span className="text-xs px-2 py-0.5 bg-blue-900 text-blue-200 rounded-full">
                          {Math.round(match.score)}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mb-1">
                        {match.description.gender || ''} {match.description.age_group || ''}
                        {match.description.clothing_top_color ? `, ${match.description.clothing_top_color} ${match.description.clothing_top || 'top'}` : ''}
                      </p>
                      <div className="text-xs text-gray-500">
                        {match.match_reasons?.map((reason, i) => (
                          <span key={i} className="inline-block mr-2 mb-1">✓ {reason}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Chat input form */}
            <form onSubmit={handleChatSubmit} className="mt-auto">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={chatQuery}
                  onChange={(e) => setChatQuery(e.target.value)}
                  placeholder="Ask about people in the feeds..."
                  className="flex-1 p-2 border border-gray-700 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-800 text-white"
                  disabled={isChatLoading}
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
                  disabled={isChatLoading || !chatQuery.trim()}
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {activeTab === 'upload' && (
        <div className="p-4">
          <div className="flex items-center space-x-2 mb-4">
            <Upload className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Upload Image</h2>
          </div>
          
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center">
              <input
                type="file"
                id="file-upload"
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
                disabled={isUploading}
              />
              <label
                htmlFor="file-upload"
                className="flex flex-col items-center justify-center cursor-pointer"
              >
                <Upload className="h-12 w-12 text-gray-500 mb-4" />
                <p className="text-lg text-gray-400 mb-2">Drag and drop an image here</p>
                <p className="text-sm text-gray-500">- or -</p>
                <button
                  type="button"
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none"
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  Browse Files
                </button>
              </label>
            </div>
            
            {selectedFile && (
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-white mb-2">Selected File:</p>
                <div className="flex items-center">
                  <div className="h-20 w-20 bg-gray-700 rounded-md overflow-hidden mr-4">
                    <img
                      src={URL.createObjectURL(selectedFile)}
                      alt="Selected"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-gray-300">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                  </div>
                  <button
                    className="ml-auto text-gray-400 hover:text-white"
                    onClick={() => setSelectedFile(null)}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                
                <button
                  className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={uploadFile}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <div className="flex items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span>Uploading...</span>
                    </div>
                  ) : (
                    "Upload and Analyze"
                  )}
                </button>
              </div>
            )}
            
            {uploadError && (
              <div className="bg-red-900/50 text-red-200 p-3 rounded-md">
                <p className="text-sm">{uploadError}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
} 