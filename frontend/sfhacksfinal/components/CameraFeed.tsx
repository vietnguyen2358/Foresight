"use client";
import React, { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import { useCamera } from '@/lib/CameraContext';
import { API_BASE_URL } from '@/lib/api';

interface Detection {
  label: string;
  confidence: number;
  bbox: number[];
}

interface FrameResponse {
  detections: Detection[];
  description: string;
}

export function CameraFeed() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [description, setDescription] = useState<string>('');
  const { selectedCamera } = useCamera();
  const [isProcessing, setIsProcessing] = useState(false);
  const [personDescriptions, setPersonDescriptions] = useState<any[]>([]);
  const [cameraPersonDescriptions, setCameraPersonDescriptions] = useState<Record<string, any[]>>({});
  const [lastProcessedFrame, setLastProcessedFrame] = useState<string | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreaming(true);
      }
    } catch (err) {
      setError('Error accessing camera: ' + (err as Error).message);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsStreaming(false);
    }
  };

  const processFrame = async (frameData: string) => {
    if (!selectedCamera) return;
    
    try {
      setIsProcessing(true);
      setError(null);
      
      console.log(`Processing frame for camera: ${selectedCamera.id}`);
      
      const response = await fetch(`${API_BASE_URL}/process_frame`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          frame_data: frameData,
          camera_id: selectedCamera.id  // Include camera_id in the request
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to process frame: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Frame processing response:', data);
      
      // Update detections and descriptions
      if (data.detections && data.detections.length > 0) {
        setDetections(data.detections);
        
        // Process person descriptions if available
        if (data.person_crops && data.person_crops.length > 0) {
          const descriptions = data.person_crops.map((crop: any) => ({
            ...crop.description,
            id: crop.id,
            yoloCrop: crop.crop,
            camera_id: selectedCamera.id,  // Ensure camera_id is included
            timestamp: new Date().toISOString()
          }));
          
          // Store descriptions by camera ID
          setCameraPersonDescriptions(prev => ({
            ...prev,
            [selectedCamera.id]: descriptions
          }));
          
          // Update current view
          setPersonDescriptions(descriptions);
        }
      } else {
        setDetections([]);
        // Don't clear person descriptions to prevent UI flickering
        // Only reset if no descriptions previously existed for this camera
        if (!cameraPersonDescriptions[selectedCamera.id]) {
          setPersonDescriptions([]);
        }
      }
      
      // Update last processed frame
      setLastProcessedFrame(frameData);
      
    } catch (error) {
      console.error('Error processing frame:', error);
      setError(error instanceof Error ? error.message : 'Unknown error processing frame');
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (selectedCamera) {
      console.log("Selected camera changed in CameraFeed:", selectedCamera);
      
      // Clear any existing intervals
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }
      
      // Reset state for new camera or load existing camera data
      if (cameraPersonDescriptions[selectedCamera.id]) {
        setPersonDescriptions(cameraPersonDescriptions[selectedCamera.id]);
      } else {
        setPersonDescriptions([]);
      }
      setDetections([]);
      
      // Set up frame processing interval
      frameIntervalRef.current = setInterval(() => {
        if (!isProcessing && videoRef.current && canvasRef.current) {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          const context = canvas.getContext('2d');
          
          if (!context) return;
          
          // Set canvas dimensions to match video
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          // Draw current video frame to canvas without affecting video playback
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Convert canvas to base64
          const frameData = canvas.toDataURL('image/jpeg');
          
          // Process the frame
          processFrame(frameData);
        }
      }, 5000); // Process a frame every 5 seconds
      
      return () => {
        if (frameIntervalRef.current) {
          clearInterval(frameIntervalRef.current);
        }
      };
    }
  }, [selectedCamera, isProcessing, cameraPersonDescriptions]);

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <div className="relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="hidden"
        />
        <canvas
          ref={canvasRef}
          className="border border-gray-300 rounded-lg"
        />
      </div>

      <div className="flex gap-4">
        <Button
          onClick={startCamera}
          disabled={isStreaming}
          variant="default"
        >
          Start Camera
        </Button>
        <Button
          onClick={stopCamera}
          disabled={!isStreaming}
          variant="destructive"
        >
          Stop Camera
        </Button>
      </div>

      {error && (
        <div className="text-red-500">{error}</div>
      )}

      {description && (
        <div className="mt-4 p-4 bg-gray-100 rounded-lg">
          <h3 className="font-semibold mb-2">Description:</h3>
          <p>{description}</p>
        </div>
      )}

      {detections.length > 0 && (
        <div className="mt-4 p-4 bg-gray-100 rounded-lg">
          <h3 className="font-semibold mb-2">Detections:</h3>
          <ul>
            {detections.map((detection, index) => (
              <li key={index}>
                {detection.label} ({(detection.confidence * 100).toFixed(1)}%)
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
} 