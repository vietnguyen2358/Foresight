import cv2
import numpy as np
from PIL import Image
import torch
from ultralytics import YOLO
from ultralytics.nn.tasks import DetectionModel
import supervision as sv
import os

# ✅ Load YOLOv8 model safely
MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "yolo11n.pt")
yolo_model = YOLO(MODEL_PATH)

# Force CPU usage for YOLO model to avoid MPS issues
DEVICE = 'cpu'
print(f"Using device: {DEVICE}")

TARGET_CLASS_ID = 0  # person class
byte_tracker = sv.ByteTrack()


def process_image(image: Image.Image, camera_id: str = None):
    """
    Detect people in a single image using YOLOv8.
    Returns list of cropped images and bounding boxes.
    """
    try:
        np_image = np.array(image)
        results = yolo_model(np_image, classes=[TARGET_CLASS_ID], device=DEVICE)[0]
        crops = []

        # Convert results to usable format
        bboxes = results.boxes.xyxy.cpu().numpy().astype("int")
        classes = results.boxes.cls.cpu().numpy().astype("int")
        
        for bbox, cls in zip(bboxes, classes):
            if cls == TARGET_CLASS_ID:  # Only process person class
                x1, y1, x2, y2 = bbox
                pad = 20
                x1, y1 = max(0, x1 - pad), max(0, y1 - pad)
                x2, y2 = min(np_image.shape[1], x2 + pad), min(np_image.shape[0], y2 + pad)
                roi = image.crop((x1, y1, x2, y2))
                crops.append({
                    "image": roi,
                    "box": (x1, y1, x2, y2),
                    "camera_id": camera_id
                })

        return crops
    except Exception as e:
        print(f"Error processing image: {str(e)}")
        return []


def process_video(path: str, camera_id: str = None, every_n_frames=10):
    """
    Detect and track people in video using YOLOv8 + ByteTrack.
    Returns list of cropped images per person track.
    
    Args:
        path: Path to the video file
        camera_id: ID of the camera that recorded the video
        every_n_frames: Process every nth frame
    """
    try:
        if not os.path.exists(path):
            raise FileNotFoundError(f"Video file not found: {path}")
            
        cap = cv2.VideoCapture(path)
        if not cap.isOpened():
            raise ValueError(f"Could not open video file: {path}")
            
        frame_idx = 0
        tracked_crops = []

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % every_n_frames != 0:
                frame_idx += 1
                continue

            results = yolo_model(frame, classes=[TARGET_CLASS_ID], device=DEVICE)[0]
            
            # Convert results to usable format
            bboxes = results.boxes.xyxy.cpu().numpy().astype("int")
            classes = results.boxes.cls.cpu().numpy().astype("int")
            
            detections = sv.Detections.from_ultralytics(results)
            tracks = byte_tracker.update_with_detections(detections)

            for track in tracks:
                x1, y1, x2, y2 = map(int, track[1])
                tid = track[2]
                crop = frame[y1:y2, x1:x2]
                crop_pil = Image.fromarray(cv2.cvtColor(crop, cv2.COLOR_BGR2RGB))
                tracked_crops.append({
                    "track_id": tid,
                    "frame": frame_idx,
                    "image": crop_pil,
                    "box": (x1, y1, x2, y2),
                    "camera_id": camera_id
                })

            frame_idx += 1

        cap.release()
        return tracked_crops
        
    except Exception as e:
        print(f"Error processing video: {str(e)}")
        if 'cap' in locals():
            cap.release()
        return []
