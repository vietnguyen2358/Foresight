import React, { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';

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
  const [detections, setDetections] = useState<Detection[]>([]);
  const [description, setDescription] = useState<string>('');
  const [error, setError] = useState<string>('');

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

  const processFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to base64
    const frameData = canvas.toDataURL('image/jpeg');

    try {
      const response = await fetch('http://localhost:8000/process_frame', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ frame_data: frameData }),
      });

      if (!response.ok) {
        throw new Error('Failed to process frame');
      }

      const data: FrameResponse = await response.json();
      setDetections(data.detections);
      setDescription(data.description);

      // Draw detections on canvas
      context.strokeStyle = '#00ff00';
      context.lineWidth = 2;
      context.font = '16px Arial';
      context.fillStyle = '#00ff00';

      data.detections.forEach(detection => {
        const [x1, y1, x2, y2] = detection.bbox;
        context.strokeRect(x1, y1, x2 - x1, y2 - y1);
        context.fillText(
          `${detection.label} (${(detection.confidence * 100).toFixed(1)}%)`,
          x1,
          y1 - 5
        );
      });
    } catch (err) {
      setError('Error processing frame: ' + (err as Error).message);
    }
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isStreaming) {
      intervalId = setInterval(processFrame, 1000); // Process every second
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isStreaming]);

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