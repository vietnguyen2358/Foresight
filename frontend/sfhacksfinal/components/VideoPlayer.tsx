import { useEffect, useRef, useState } from 'react';
import { useCamera } from '@/lib/CameraContext';

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
  const [isExtracting, setIsExtracting] = useState(false);
  // Get current camera context to ensure frames are associated with the correct camera
  const { selectedCamera } = useCamera();
  // Track frames that have already been processed for this video
  const [processedFrameHashes, setProcessedFrameHashes] = useState<Set<string>>(new Set());

  // Initialize video player or fallback to image
  useEffect(() => {
    const video = videoRef.current;

    if (!video) return;

    // Reset state when video source changes
    setError(null);
    setUseFallback(false);
    // Only clear the frame interval, not the processed frames
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
    }
    
    // Reset the processed frames when video source changes
    setProcessedFrameHashes(new Set());

    // Set up video source
    video.src = videoSrc;
    video.load();

    // Handle video end
    const handleEnded = () => {
      console.log('Video ended, refreshing...');
      // Reset video to start
      video.currentTime = 0;
      // Reload the video source to ensure fresh start
      video.load();
      video.play().catch(err => {
        console.error('Error replaying video:', err);
        setError('Error replaying video - using image feed instead');
        setUseFallback(true);
        startFallbackFrameExtraction();
      });
      
      // Don't clear the processed frames when video loops
      // This ensures we don't reprocess the same frames
    };

    // Handle errors
    const handleError = (e: Event) => {
      console.error('Video error:', e);
      setError(`Error loading video: ${videoSrc}`);
      setUseFallback(true);
      startFallbackFrameExtraction();
    };

    video.addEventListener('error', handleError);
    video.addEventListener('ended', handleEnded);
    
    // Start playing when loaded
    const handleLoadedData = () => {
      // Set video properties for full playback
      video.loop = false; // Disable loop to allow our custom handling
      video.muted = true; // Mute to allow autoplay
      video.playsInline = true; // Ensure inline playback on mobile
      
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
            if (!isProcessing && !isExtracting) {
              console.log('Extracting frame for AI detection...');
              extractFrame();
            } else {
              console.log('Skipping frame extraction - still processing previous frame');
            }
          }, FRAME_INTERVAL);
        })
        .catch(err => {
          console.error('Play error:', err);
          setError(`Video playback not supported - using image feed instead`);
          setUseFallback(true);
          
          // Start extracting frames from the fallback image
          startFallbackFrameExtraction();
        });
    };
    
    video.addEventListener('loadeddata', handleLoadedData);
    
    return () => {
      video.removeEventListener('error', handleError);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('ended', handleEnded);
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }
    };
  }, [videoSrc, isProcessing]);

  // Create a simple hash for a frame to avoid duplicates
  const getFrameHash = (frameData: string): string => {
    // Use a simple hashing approach - take parts of the data at different positions
    const length = frameData.length;
    const sampleSize = 100; // Sample this many characters
    const samples = 5; // Take this many samples from the data
    
    let hash = '';
    for (let i = 0; i < samples; i++) {
      const position = Math.floor((i * length) / samples);
      hash += frameData.substring(position, position + sampleSize);
    }
    
    // Return a numeric hash of the combined samples
    let numericHash = 0;
    for (let i = 0; i < hash.length; i++) {
      numericHash = ((numericHash << 5) - numericHash) + hash.charCodeAt(i);
      numericHash = numericHash & numericHash; // Convert to 32bit integer
    }
    
    return `${selectedCamera?.id || 'unknown'}_${numericHash}`;
  };

  // Extract frame from video
  const extractFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas || isProcessing || isExtracting || !selectedCamera) return;
    
    try {
      setIsExtracting(true);
      
      // Check if video is actually ready and has dimensions
      if (video.videoWidth === 0 || video.videoHeight === 0 || video.readyState < 2) {
        console.warn("Video not ready for frame extraction, will retry...");
        setTimeout(() => {
          setIsExtracting(false);
          extractFrame();
        }, 500);
        return;
      }
      
      // Set canvas dimensions to match video's native resolution
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Clear canvas first
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error("Could not get canvas context");
        setError("Failed to extract frame - canvas context unavailable");
        setIsExtracting(false);
        return;
      }
      
      // Clear the canvas and use high-quality image rendering
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Draw the video frame at full resolution
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // First try with PNG for maximum quality
      let frameUrl = canvas.toDataURL('image/png'); 
      
      // Check if the frame URL is valid - if not, try JPEG as fallback
      if (!frameUrl || frameUrl.length < 100) {
        console.warn("PNG format failed, trying JPEG...");
        frameUrl = canvas.toDataURL('image/jpeg', 0.95); // High quality JPEG
      }
      
      // Check if we've already processed this frame (approximately)
      const frameHash = getFrameHash(frameUrl);
      
      if (processedFrameHashes.has(frameHash)) {
        console.log(`Skipping already processed frame: ${frameHash}`);
        setIsExtracting(false);
        return;
      }
      
      // Add this frame to processed frames
      setProcessedFrameHashes(prev => {
        const updated = new Set(prev);
        updated.add(frameHash);
        return updated;
      });
      
      // Log the frame extraction with detailed information
      console.log(`Frame extracted at ${new Date().toLocaleTimeString()} for camera ${selectedCamera.id}`);
      console.log(`Frame dimensions: ${canvas.width}x${canvas.height} pixels`);
      console.log(`Frame size: ${Math.round(frameUrl.length / 1024)} KB`);
      console.log(`Frame hash: ${frameHash}`);
      
      // Final validation check
      if (!frameUrl || frameUrl.length < 100) {
        console.error("Invalid frame URL generated after multiple attempts");
        setError("Failed to extract frame - invalid data");
        setIsExtracting(false);
        return;
      }
      
      // Check if the frame contains actual content (not just a blank frame)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      let nonZeroPixels = 0;
      const sampleSize = 1000; // Check a sample of pixels for efficiency
      const stride = Math.max(1, Math.floor(data.length / 4 / sampleSize));
      
      // Check if the frame has any non-blank pixels (sampling approach for performance)
      for (let i = 0; i < data.length; i += 4 * stride) {
        // Check if the pixel has any significant color or alpha
        if (data[i] > 10 || data[i + 1] > 10 || data[i + 2] > 10 || data[i + 3] > 10) {
          nonZeroPixels++;
          if (nonZeroPixels > 10) { // If we find at least 10 non-blank pixels, consider it valid
            break;
          }
        }
      }
      
      if (nonZeroPixels <= 10) {
        console.warn("Frame appears to be blank or nearly blank");
        setError("Extracted frame is blank - waiting for next frame");
        setIsExtracting(false);
        return;
      }
      
      // Pass the frame URL to the parent component
      console.log(`Sending frame to parent component for processing (camera: ${selectedCamera.id})`);
      onFrameExtracted(frameUrl);
    } catch (err) {
      console.error('Error extracting frame:', err);
      setError(`Error extracting frame - using image feed instead`);
      setUseFallback(true);
      startFallbackFrameExtraction();
    } finally {
      setIsExtracting(false);
    }
  };

  // Add a separate useEffect to ensure frame extraction starts immediately
  useEffect(() => {
    // Extract a frame immediately when the component mounts
    console.log('Component mounted, extracting initial frame...');
    
    // Use a small timeout to ensure the video is loaded
    const timeoutId = setTimeout(() => {
      if (!isProcessing && !isExtracting) {
        extractFrame();
      }
    }, 1000);
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  // Start fallback frame extraction using static image
  const startFallbackFrameExtraction = () => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
    }

    // Create an image element for the fallback
    const img = new Image();
    img.crossOrigin = "anonymous"; // Enable CORS for the image
    
    // Try multiple fallback images in case one fails
    const fallbackImages = [
      '/images/image.jpg',
      '/images/image1.jpg',
      '/images/image2.jpg',
      '/images/image3.jpg',
      '/images/image4.jpg',
      '/images/image5.jpg'
    ];
    
    let currentImageIndex = 0;
    
    const tryNextImage = () => {
      if (currentImageIndex < fallbackImages.length) {
        console.log(`Trying fallback image ${currentImageIndex + 1}: ${fallbackImages[currentImageIndex]}`);
        img.src = fallbackImages[currentImageIndex];
        currentImageIndex++;
      } else {
        console.error('All fallback images failed to load');
        setError('Failed to load any fallback images');
      }
    };
    
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Set canvas dimensions to match image's native resolution
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw image to canvas with high quality
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Use high-quality image rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Draw the image at full resolution
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Extract first frame immediately with maximum quality
      console.log('Extracting initial frame from fallback image...');
      const frameUrl = canvas.toDataURL('image/png'); // PNG for maximum quality
      
      // Check if the frame URL is valid
      if (!frameUrl || frameUrl.length < 100) {
        console.error("Invalid frame URL generated from fallback image");
        setError("Failed to extract frame from fallback image - invalid data");
        tryNextImage();
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
      
      if (!hasContent) {
        console.warn("Fallback image appears to be blank or transparent");
        setError("Fallback image is blank - trying next image");
        tryNextImage();
        return;
      }
      
      // Log detailed information about the extracted frame
      console.log(`Fallback frame extracted from ${img.src}`);
      console.log(`Frame dimensions: ${canvas.width}x${canvas.height} pixels`);
      console.log(`Frame size: ${Math.round(frameUrl.length / 1024)} KB`);
      console.log(`Frame format: PNG (lossless)`);
      
      console.log("Sending fallback frame to parent component for processing");
      onFrameExtracted(frameUrl);

      // Set up interval for continuous frame extraction
      frameIntervalRef.current = setInterval(() => {
        if (!isProcessing && !isExtracting) {
          console.log('Extracting frame from fallback image for AI detection...');
          const frameUrl = canvas.toDataURL('image/png'); // PNG for maximum quality
          
          // Check if the frame URL is valid
          if (!frameUrl || frameUrl.length < 100) {
            console.error("Invalid frame URL generated from fallback image");
            return;
          }
          
          // Check if the frame contains actual content
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
          
          if (!hasContent) {
            console.warn("Fallback image appears to be blank or transparent");
            return;
          }
          
          // Log detailed information about the extracted frame
          console.log(`Fallback frame extracted from ${img.src}`);
          console.log(`Frame dimensions: ${canvas.width}x${canvas.height} pixels`);
          console.log(`Frame size: ${Math.round(frameUrl.length / 1024)} KB`);
          console.log(`Frame format: PNG (lossless)`);
          
          console.log("Sending fallback frame to parent component for processing");
          onFrameExtracted(frameUrl);
        } else {
          console.log('Skipping frame extraction - still processing previous frame');
        }
      }, FRAME_INTERVAL);
    };
    
    img.onerror = (err) => {
      console.error('Error loading fallback image:', err);
      setError(`Failed to load fallback image: ${img.src}`);
      tryNextImage();
    };
    
    // Start with the first fallback image
    tryNextImage();
  };

  // Manual frame extraction
  const handleManualExtract = () => {
    console.log('Manual frame extraction requested');
    extractFrame();
  };

  return (
    <div className="relative w-full">
      {!useFallback && (
        <video
          ref={videoRef}
          src={videoSrc}
          className="w-full h-full object-cover rounded-lg"
          style={{ maxHeight: '300px' }}
        />
      )}
      
      {useFallback && (
        <img
          src="/images/image.jpg"
          alt="Camera feed"
          className="w-full h-full object-cover rounded-lg"
          style={{ maxHeight: '300px' }}
        />
      )}
      
      {/* Hidden canvas for frame extraction */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      
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