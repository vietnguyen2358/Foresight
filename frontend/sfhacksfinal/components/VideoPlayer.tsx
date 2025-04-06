import React, { useRef, useEffect, useState } from 'react';

interface VideoPlayerProps {
  videoSrc: string;
  onFrameExtracted?: (frameData: string) => void;
  isProcessing?: boolean;
  cameraId?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  videoSrc, 
  onFrameExtracted, 
  isProcessing = false,
  cameraId
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Log the video source for debugging
  useEffect(() => {
    console.log(`VideoPlayer: Loading video source: ${videoSrc} for camera: ${cameraId}`);
  }, [videoSrc, cameraId]);

  // Handle video errors
  const handleVideoError = () => {
    console.error('Video error occurred for camera:', cameraId);
    setError('Error loading video. Using fallback images.');
    setUseFallback(true);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Set up error handling
    video.addEventListener('error', handleVideoError);

    // Set up frame extraction interval
    if (onFrameExtracted) {
      frameIntervalRef.current = setInterval(() => {
        extractFrame();
      }, 5000); // Extract a frame every 5 seconds
    }

    return () => {
      video.removeEventListener('error', handleVideoError);
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }
    };
  }, [onFrameExtracted]);

  // Extract frame from video
  const extractFrame = () => {
    if (videoRef.current && videoRef.current.readyState >= 2) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const frameData = canvas.toDataURL('image/jpeg');
        console.log(`Frame extracted from camera ${cameraId || 'unknown'}`);
        if (onFrameExtracted) {
          onFrameExtracted(frameData);
        }
      }
    }
  };

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        src={videoSrc}
        className="w-full h-full object-contain"
        autoPlay
        muted
        loop
        playsInline
        onError={handleVideoError}
      />
      {isProcessing && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mx-auto mb-2"></div>
            <p>Processing frame...</p>
          </div>
        </div>
      )}
      {cameraId && (
        <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs">
          Camera: {cameraId}
        </div>
      )}
      {error && (
        <div className="absolute bottom-2 left-2 bg-red-900/80 text-white text-xs p-2 rounded">
          {error}
        </div>
      )}
    </div>
  );
};

export default VideoPlayer; 