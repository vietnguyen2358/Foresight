import cv2
import torch
import numpy as np
from ultralytics import YOLO
import os

# Load model
model = YOLO("yolo11n.pt")

# Use a sample image from ultralytics assets
image_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sample.jpg")
if not os.path.exists(image_path):
    # If sample image doesn't exist, use the bus image from ultralytics assets
    workspace_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    image_path = os.path.join(workspace_root, "venv/lib/python3.11/site-packages/ultralytics/assets/bus.jpg")

# Load image
frame = cv2.imread(image_path)
if frame is None:
    raise ValueError(f"Could not load image at {image_path}")

# Run detection on M1 GPU
results = model(frame, device='mps')[0]  # You can also use device='cpu'

# Convert results to usable format
bboxes = results.boxes.xyxy.cpu().numpy().astype("int")
classes = results.boxes.cls.cpu().numpy().astype("int")

# Draw boxes
for cls, bbox in zip(classes, bboxes):
    x1, y1, x2, y2 = bbox
    label = model.names[cls]
    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
    cv2.putText(frame, label, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

# Show image
cv2.imshow("YOLOv8 Detection", frame)
cv2.waitKey(0)
cv2.destroyAllWindows()
