import { useEffect, useRef, useState } from 'react';
import { getPersonImage } from "@/lib/api";

interface VideoPlayerProps {
  videoSrc: string;
  onFrameExtracted: (frameUrl: string) => void;
  isProcessing: boolean;
}

export default function VideoPlayer({ videoSrc, onFrameExtracted, isProcessing }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const FRAME_INTERVAL = 5000; // 5 seconds between frame extractions

  // Add a state for person images
  const [personImages, setPersonImages] = useState<Record<string, string>>({});

  // Add a function to load person images
  const loadPersonImage = async (personId: string) => {
    try {
      // Use the API_BASE_URL from the environment or default to localhost
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const imageUrl = `${apiBaseUrl}/person_image/${personId}`;
      
      // Test if the image exists before setting it
      const response = await fetch(imageUrl, { method: 'HEAD' });
      if (response.ok) {
        setPersonImages(prev => ({
          ...prev,
          [personId]: imageUrl
        }));
        console.log(`Successfully loaded image for person ${personId}`);
      } else {
        console.error(`Failed to load image for person ${personId}: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error(`Error loading image for person ${personId}:`, error);
    }
  };

  // Initialize video player or fallback to image
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Set video properties
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    
    // Handle video errors
    const handleError = () => {
      console.error('Video error:', video.error);
      setError(`Video playback not supported - using image feed instead`);
      setUseFallback(true);
      
      // Start extracting frames from the fallback image
      startFallbackFrameExtraction();
    };
    
    video.addEventListener('error', handleError);
    
    // Start playing when loaded
    const handleLoadedData = () => {
      video.play()
        .then(() => {
          setError(null);
          setUseFallback(false);
          
          // Extract first frame immediately
          console.log('Extracting initial frame from video...');
          extractFrame();
          
          // Start extracting frames at regular intervals
          if (frameIntervalRef.current) {
            clearInterval(frameIntervalRef.current);
          }
          
          frameIntervalRef.current = setInterval(() => {
            if (!isProcessing) {
              console.log('Extracting frame from video...');
              extractFrame();
            } else {
              console.log('Skipping frame extraction - still processing previous frame');
            }
          }, FRAME_INTERVAL);
        })
        .catch(err => {
          console.error('Error playing video:', err);
          setError(`Error playing video - using image feed instead`);
          setUseFallback(true);
          startFallbackFrameExtraction();
        });
    };
    
    video.addEventListener('loadeddata', handleLoadedData);
    
    // Clean up
    return () => {
      video.removeEventListener('error', handleError);
      video.removeEventListener('loadeddata', handleLoadedData);
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }
    };
  }, [videoSrc, isProcessing]);

  // Add a separate useEffect to ensure frame extraction starts immediately
  useEffect(() => {
    // Extract a frame immediately when the component mounts
    console.log('Component mounted, extracting initial frame...');
    
    // Use a small timeout to ensure the video is loaded
    const timeoutId = setTimeout(() => {
      if (!isProcessing) {
        extractFrame();
      }
    }, 1000);
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  // Start fallback frame extraction using static image
  const startFallbackFrameExtraction = () => {
    console.log('Starting fallback frame extraction...');
    
    // Clear any existing interval
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
    }
    
    // Extract first frame immediately
    tryNextImage();
    
    // Set up interval for frame extraction
    frameIntervalRef.current = setInterval(() => {
      if (!isProcessing) {
        tryNextImage();
      } else {
        console.log('Skipping fallback frame extraction - still processing previous frame');
      }
    }, FRAME_INTERVAL);
  };
  
  // Try to load the next image in sequence
  const tryNextImage = () => {
    // Get the camera ID from the video source
    const cameraId = videoSrc.includes('camera') 
      ? videoSrc.match(/camera(\d+)\.mov/)?.[1] 
      : 'mkt';
    
    // Use a sequence of images for the specific camera
    const imageIndex = Math.floor(Math.random() * 4) + 1;
    const imageUrl = `/images/camera${cameraId}_${imageIndex}.jpg`;
    
    console.log(`Loading fallback image: ${imageUrl}`);
    
    // Create a new image to test if it exists
    const img = new Image();
    img.onload = () => {
      console.log(`Fallback image loaded: ${imageUrl}`);
      
      // Extract frame from the image
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Set canvas dimensions to match the image
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw the image on the canvas
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Convert canvas to data URL
      const frameUrl = canvas.toDataURL('image/jpeg', 0.8);
      
      // Pass the frame URL to the parent component
      onFrameExtracted(frameUrl);
    };
    
    img.onerror = () => {
      console.error(`Failed to load fallback image: ${imageUrl}`);
      // Try a different image
      const fallbackImageUrl = `/images/camera${cameraId}_fallback.jpg`;
      console.log(`Trying fallback image: ${fallbackImageUrl}`);
      
      const fallbackImg = new Image();
      fallbackImg.onload = () => {
        console.log(`Fallback image loaded: ${fallbackImageUrl}`);
        
        // Extract frame from the fallback image
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // Set canvas dimensions to match the image
        canvas.width = fallbackImg.width;
        canvas.height = fallbackImg.height;
        
        // Draw the image on the canvas
        ctx.drawImage(fallbackImg, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to data URL
        const frameUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        // Pass the frame URL to the parent component
        onFrameExtracted(frameUrl);
      };
      
      fallbackImg.onerror = () => {
        console.error(`Failed to load fallback image: ${fallbackImageUrl}`);
        // Use a default image as a last resort
        const defaultImageUrl = '/images/default_camera.jpg';
        console.log(`Using default image: ${defaultImageUrl}`);
        
        const defaultImg = new Image();
        defaultImg.onload = () => {
          console.log(`Default image loaded: ${defaultImageUrl}`);
          
          // Extract frame from the default image
          const canvas = canvasRef.current;
          if (!canvas) return;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          
          // Set canvas dimensions to match the image
          canvas.width = defaultImg.width;
          canvas.height = defaultImg.height;
          
          // Draw the image on the canvas
          ctx.drawImage(defaultImg, 0, 0, canvas.width, canvas.height);
          
          // Convert canvas to data URL
          const frameUrl = canvas.toDataURL('image/jpeg', 0.8);
          
          // Pass the frame URL to the parent component
          onFrameExtracted(frameUrl);
        };
        
        defaultImg.src = defaultImageUrl;
      };
      
      fallbackImg.src = fallbackImageUrl;
    };
    
    img.src = imageUrl;
  };

  // Extract frame from video
  const extractFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas || isProcessing) return;
    
    try {
      // Set canvas dimensions to match video's native resolution
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw current video frame to canvas
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Use high-quality image rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Draw the video frame at full resolution
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert canvas to data URL with maximum quality using PNG format
      const frameUrl = canvas.toDataURL('image/png'); // PNG for maximum quality
      
      // Log the frame extraction with detailed information
      console.log(`Frame extracted at ${new Date().toLocaleTimeString()}`);
      console.log(`Frame dimensions: ${canvas.width}x${canvas.height} pixels`);
      console.log(`Frame size: ${Math.round(frameUrl.length / 1024)} KB`);
      console.log(`Frame format: PNG (lossless)`);
      
      // Check if the frame URL is valid
      if (!frameUrl || frameUrl.length < 100) {
        console.error("Invalid frame URL generated");
        setError("Failed to extract frame - invalid data");
        return;
      }
      
      // Check if the frame contains actual content (not just a blank frame)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      let hasContent = false;
      
      // Check if the frame has any non-transparent pixels
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0) { // Alpha channel
          hasContent = true;
          break;
        }
      }
      
      // Pass the frame URL to the parent component
      console.log("Sending frame to parent component for processing");
      onFrameExtracted(frameUrl);

      // If the frame contains detections, load the person images
      if (frameUrl.includes('detection')) {
        try {
          const detections = JSON.parse(frameUrl.split('detection:')[1]);
          detections.forEach((detection: any) => {
            if (detection.id && !personImages[detection.id]) {
              loadPersonImage(detection.id);
            }
          });
        } catch (error) {
          console.error('Error parsing detections:', error);
        }
      }
    } catch (err) {
      console.error('Error extracting frame:', err);
      setError(`Error extracting frame - using image feed instead`);
      setUseFallback(true);
      startFallbackFrameExtraction();
    }
  };

  // Manual frame extraction
  const handleManualExtract = () => {
    console.log('Manual frame extraction requested');
    extractFrame();
  };

  // Add the handleVideoError function
  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error('Video error:', e);
    setError('Failed to load video. Switching to fallback image.');
    setUseFallback(true);
  };

  return (
    <div className="relative w-full h-full">
      {useFallback ? (
        <div className="w-full h-full flex items-center justify-center bg-gray-100">
          <img 
            src="/images/fallback.jpg" 
            alt="Fallback" 
            className="max-w-full max-h-full object-contain"
          />
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            src={videoSrc}
            className="w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            onError={handleVideoError}
          />
          
          {/* Hidden canvas for frame extraction */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          
          {/* Display person images */}
          <div className="absolute bottom-0 left-0 right-0 p-2 bg-black bg-opacity-50 flex overflow-x-auto">
            {Object.entries(personImages).map(([id, imageUrl]) => (
              <div key={id} className="flex-shrink-0 mr-2">
                <img 
                  src={imageUrl} 
                  alt={`Person ${id}`} 
                  className="w-16 h-16 object-cover rounded-full border border-white"
                  onError={(e) => {
                    console.error(`Error loading image for person ${id}`);
                    e.currentTarget.src = '/images/fallback-person.jpg';
                  }}
                />
              </div>
            ))}
          </div>
        </>
      )}
      
      {/* Error message */}
      {error && (
        <div className="absolute top-0 left-0 right-0 bg-red-900/80 text-white text-xs p-2 rounded-t-lg">
          {error}
        </div>
      )}

      {isProcessing && (
        <div className="absolute top-0 right-0 m-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
          Processing...
        </div>
      )}

      {/* Live indicator */}
      <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center">
        <span className="relative flex h-2 w-2 mr-1">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
        </span>
        {useFallback ? 'LIVE (Image Feed)' : 'LIVE'}
      </div>
    </div>
  );
} 