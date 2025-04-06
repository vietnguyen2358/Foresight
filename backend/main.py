# main.py

from fastapi import File, UploadFile, Form, HTTPException, Request, FastAPI
from fastapi.responses import HTMLResponse
from typing import List, Optional
from PIL import Image
import uvicorn
import shutil
import os
import logging
from datetime import datetime
from dotenv import load_dotenv
import google.generativeai as genai
import cv2
import numpy as np
import base64
from app_init import app
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from ultralytics import YOLO

from tracker import process_image, process_video
from embedder import embed_image, embed_text, describe_person, embed_description
from db import add_person, search_people
from search import find_similar_people

from fastapi.websockets import WebSocketDisconnect
from twilio.twiml.voice_response import VoiceResponse, Connect, Say, Stream
from Twilio.call import process_stream

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure Gemini
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY not found in environment variables")
genai.configure(api_key=GEMINI_API_KEY)

# Setup directories
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Load YOLO model
yolo_model = YOLO("yolo11n.pt")

# Define models for chat
class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]

class ChatResponse(BaseModel):
    response: str

class FrameResponse(BaseModel):
    detections: List[dict]
    description: str
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())
    person_crops: List[dict] = Field(default_factory=list)

class FrameRequest(BaseModel):
    frame_data: str

def save_upload_file(upload_file: UploadFile) -> str:
    """Save uploaded file and return the path"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{timestamp}_{upload_file.filename}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(upload_file.file, buffer)
        return file_path
    except Exception as e:
        logger.error(f"Error saving file: {str(e)}")
        raise HTTPException(status_code=500, detail="Could not save uploaded file")

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        logger.info("Processing chat request")
        
        # Initialize Gemini model
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        # Start a new chat
        chat = model.start_chat(history=[])
        
        # Process each message in the conversation history
        for msg in request.messages:
            if msg.role == "user":
                # Send user message to Gemini
                response = chat.send_message(msg.content)
                # Store the response in history
                chat.history.append({"role": "assistant", "parts": [response.text]})
        
        # Get the last user message
        last_message = request.messages[-1].content
        
        # Generate response
        response = chat.send_message(last_message)
        
        return ChatResponse(response=response.text)
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), is_video: bool = Form(False)):
    try:
        logger.info(f"Processing {'video' if is_video else 'image'}: {file.filename}")
        
        # Save the uploaded file
        file_path = save_upload_file(file)
        
        # Process the file
        if is_video:
            people = process_video(file_path)
        else:
            # For images, convert to PIL Image
            image = Image.open(file_path)
            people = process_image(image)
        
        # Process each detected person
        results = []
        for person in people:
            try:
                # Get person description
                description = describe_person(person["image"])
                if description:
                    # Embed the description
                    embedding = embed_description(description)
                    
                    # Add to database with image
                    add_person(
                        embedding=embedding,
                        description_json=description,
                        metadata={
                            "track_id": person.get("track_id", -1),
                            "frame": person.get("frame", -1),
                            "image": person["image"]
                        }
                    )
                    
                    results.append(description)
            except Exception as e:
                logger.error(f"Error processing person: {str(e)}")
        
        return {
            "status": "success",
            "count": len(results),
            "descriptions": results
        }
    except Exception as e:
        logger.error(f"Error in upload endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clean up the uploaded file
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            logger.error(f"Error cleaning up file: {str(e)}")


@app.post("/search")
async def search_person(query: str = Form(...)):
    try:
        logger.info(f"Searching for: {query}")
        
        # Search for similar people
        matches = find_similar_people(query)
        if not matches:
            return {
                "query": query,
                "matches": [],
                "message": "No matches found",
                "suggestions": [
                    "Try using more general terms",
                    "Include fewer specific details",
                    "Check for typos in your search",
                    "Try searching for a different person",
                    "Visit /search_guidelines for tips on writing effective queries"
                ]
            }
        
        # Process each match to include image data and similarity percentage
        processed_matches = []
        for idx, match in enumerate(matches):
            try:
                # Create a visualization of the match
                description = match["description"]
                metadata = match["metadata"]
                similarity = match.get("similarity", 0)
                
                # Create a blank image if no image data is available
                if match.get("image_data"):
                    # Convert base64 image to OpenCV format
                    img_data = base64.b64decode(match["image_data"])
                    nparr = np.frombuffer(img_data, np.uint8)
                    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                else:
                    # Create a blank image with text
                    img = np.zeros((600, 800, 3), dtype=np.uint8)
                    img.fill(255)  # White background
                
                # Add match information to the image
                font = cv2.FONT_HERSHEY_SIMPLEX
                font_scale = 0.7
                thickness = 2
                color = (0, 128, 0)  # Dark green
                
                # Add similarity score
                similarity_text = f"Match: {similarity:.1f}%"
                cv2.putText(img, similarity_text, (10, 30), font, font_scale, color, thickness)
                
                # Add description details
                y_offset = 70
                line_height = 25
                
                # Basic information
                basic_details = [
                    f"Gender: {description.get('gender', 'N/A')}",
                    f"Age: {description.get('age_group', 'N/A')}",
                    f"Ethnicity: {description.get('ethnicity', 'N/A')}",
                    f"Skin Tone: {description.get('skin_tone', 'N/A')}"
                ]
                
                # Hair details
                hair_details = [
                    f"Hair Style: {description.get('hair_style', 'N/A')}",
                    f"Hair Color: {description.get('hair_color', 'N/A')}",
                    f"Facial Features: {description.get('facial_features', 'N/A')}"
                ]
                
                # Clothing details
                clothing_details = [
                    f"Top: {description.get('clothing_top', 'N/A')}",
                    f"Top Color: {description.get('clothing_top_color', 'N/A')}",
                    f"Top Pattern: {description.get('clothing_top_pattern', 'N/A')}",
                    f"Bottom: {description.get('clothing_bottom', 'N/A')}",
                    f"Bottom Color: {description.get('clothing_bottom_color', 'N/A')}",
                    f"Bottom Pattern: {description.get('clothing_bottom_pattern', 'N/A')}"
                ]
                
                # Footwear and accessories
                accessories_details = [
                    f"Footwear: {description.get('footwear', 'N/A')}",
                    f"Footwear Color: {description.get('footwear_color', 'N/A')}",
                    f"Accessories: {description.get('accessories', 'N/A')}",
                    f"Bag Type: {description.get('bag_type', 'N/A')}",
                    f"Bag Color: {description.get('bag_color', 'N/A')}"
                ]
                
                # Context
                context_details = [
                    f"Pose: {description.get('pose', 'N/A')}",
                    f"Location: {description.get('location_context', 'N/A')}"
                ]
                
                # Draw all details
                all_details = basic_details + hair_details + clothing_details + accessories_details + context_details
                
                for line in all_details:
                    cv2.putText(img, line, (10, y_offset), font, font_scale, (0, 0, 0), thickness)
                    y_offset += line_height
                
                # Show the image in a window
                window_name = f"Match {idx + 1} - {similarity:.1f}% Similar"
                cv2.imshow(window_name, img)
                cv2.moveWindow(window_name, idx * 850, 0)  # Position windows side by side
                
                # Convert back to base64 for sending to client
                _, buffer = cv2.imencode('.jpg', img)
                img_base64 = base64.b64encode(buffer).decode('utf-8')
                
                # Add to processed matches
                processed_match = {
                    "description": description,
                    "similarity": similarity,
                    "similarity_percentage": f"{similarity:.1f}%",
                    "processed_image": img_base64
                }
                processed_matches.append(processed_match)
                
            except Exception as e:
                logger.error(f"Error processing match: {str(e)}")
                continue
        
        # Wait for a key press (1ms) to keep windows open
        cv2.waitKey(1)
        
        return {
            "query": query,
            "matches": processed_matches,
            "count": len(processed_matches)
        }
    except Exception as e:
        logger.error(f"Error in search endpoint: {str(e)}")
        # Clean up OpenCV windows in case of error
        cv2.destroyAllWindows()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/search_guidelines")
async def search_guidelines():
    """Provide guidelines for writing effective search queries."""
    return {
        "guidelines": [
            "Be specific about physical characteristics (e.g., 'tall Asian man with black hair')",
            "Include clothing details (e.g., 'wearing a red striped shirt and blue jeans')",
            "Mention accessories (e.g., 'carrying a black backpack')",
            "Describe footwear (e.g., 'wearing white sneakers')",
            "Include hair style and color (e.g., 'short blonde hair')",
            "Mention facial features (e.g., 'wearing glasses', 'with a beard')",
            "Describe skin tone if relevant (e.g., 'light-skinned', 'dark-skinned')",
            "Include pose or activity (e.g., 'standing', 'walking')",
            "Mention location context if relevant (e.g., 'indoors', 'outdoors')",
            "Combine multiple attributes for better results (e.g., 'young woman with long brown hair wearing a floral dress and carrying a brown leather bag')"
        ],
        "example_queries": [
            "Asian man with short black hair wearing a blue plaid shirt and khaki pants",
            "Young woman with long blonde hair wearing a red dress and white sneakers",
            "Elderly man with gray hair and glasses wearing a brown jacket and carrying a black backpack",
            "Teenage boy with curly brown hair wearing a striped hoodie and blue jeans",
            "Middle-aged woman with shoulder-length brown hair wearing a floral blouse and black skirt"
        ]
    }


@app.api_route("/incoming_call", methods=["GET", "POST"])
async def handle_incoming_call(request: Request):
    """Handle incoming call and return TwiML response to connect to Media Stream."""
    response = VoiceResponse()
    # <Say> punctuation to improve text-to-speech flow
    response.say("Please wait while we connect your call.")
    response.pause(length=1)
    response.say("O.K. you can start talking!")
    
    # Get the host and determine the protocol
    host = request.url.hostname
    scheme = request.url.scheme
    ws_protocol = "wss" if scheme == "https" else "ws"
    
    # Construct the WebSocket URL
    ws_url = f"{ws_protocol}://{host}/process_stream"
    logging.info(f"Connecting to WebSocket at {ws_url}")
    
    connect = Connect()
    connect.stream(url=ws_url)
    response.append(connect)
    return HTMLResponse(content=str(response), media_type="application/xml")


@app.on_event("shutdown")
async def shutdown_event():
    # Clean up OpenCV windows when the server shuts down
    cv2.destroyAllWindows()


@app.post("/process_frame", response_model=FrameResponse)
async def process_frame(request: FrameRequest):
    try:
        # Decode base64 image
        frame_data = request.frame_data
        if ',' in frame_data:
            # If it's a data URL, extract the base64 part
            frame_data = frame_data.split(',')[1]
        
        image_bytes = base64.b64decode(frame_data)
        nparr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            raise ValueError("Failed to decode image data")
            
        logger.info(f"Successfully decoded frame with shape: {frame.shape}")
        
        # Run YOLO detection
        results = yolo_model(frame)[0]
        logger.info(f"YOLO detection completed with {len(results.boxes)} objects detected")
        
        # Process detections
        detections = []
        person_crops = []
        
        # Debug: Check if there are any detections
        if len(results.boxes) == 0:
            logger.warning("No objects detected in the frame")
            # Log the frame shape and type for debugging
            logger.info(f"Frame shape: {frame.shape}, dtype: {frame.dtype}")
            logger.info(f"Frame min/max values: {frame.min()}/{frame.max()}")
            
            # Try running detection with a lower confidence threshold
            logger.info("Attempting detection with lower confidence threshold")
            results = yolo_model(frame, conf=0.1)[0]
            logger.info(f"Second attempt detected {len(results.boxes)} objects")
        
        # Filter for person detections only
        person_boxes = []
        for box in results.boxes:
            cls = int(box.cls[0])
            label = yolo_model.names[cls]
            
            # Only keep person detections
            if label.lower() == "person":
                person_boxes.append(box)
        
        logger.info(f"Found {len(person_boxes)} person detections out of {len(results.boxes)} total detections")
        
        # Process person detections
        for box in person_boxes:
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
            conf = float(box.conf[0])
            
            # Create a unique ID for each detection
            detection_id = f"person_{len(detections)}"
            
            # Convert coordinates to integers
            x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
            
            # Ensure coordinates are within image bounds
            x1 = max(0, x1)
            y1 = max(0, y1)
            x2 = min(frame.shape[1], x2)
            y2 = min(frame.shape[0], y2)
            
            # Debug: Log each detection with more details
            logger.info(f"Processing person detection with confidence {conf:.2f} at coordinates [{x1}, {y1}, {x2}, {y2}]")
            logger.info(f"Detection size: {x2-x1}x{y2-y1} pixels")
            
            # Add to detections list
            detections.append({
                "id": detection_id,
                "type": "person",
                "confidence": conf,
                "bbox": [float(x1), float(y1), float(x2), float(y2)],
                "timestamp": datetime.now().isoformat(),
                "camera_id": "SF-MKT-001"  # You can make this dynamic based on the request
            })
            
            # Crop person if the crop is valid
            if (x2 - x1) > 0 and (y2 - y1) > 0:
                try:
                    # More lenient size check - only filter out extremely small crops
                    if (x2 - x1) < 5 or (y2 - y1) < 5:
                        logger.warning(f"Person crop too small at coordinates [{x1}, {y1}, {x2}, {y2}]")
                        continue
                        
                    person_crop = frame[y1:y2, x1:x2]
                    
                    # Check if the crop is valid
                    if person_crop.size == 0:
                        logger.warning(f"Invalid person crop with zero size at coordinates [{x1}, {y1}, {x2}, {y2}]")
                        continue
                    
                    # Log crop details
                    logger.info(f"Person crop shape: {person_crop.shape}, dtype: {person_crop.dtype}")
                    logger.info(f"Person crop min/max values: {person_crop.min()}/{person_crop.max()}")
                    
                    # Convert to PIL Image for Gemini
                    person_crop_rgb = cv2.cvtColor(person_crop, cv2.COLOR_BGR2RGB)
                    person_pil = Image.fromarray(person_crop_rgb)
                    
                    # Generate description for this person
                    try:
                        person_description = describe_person(person_pil)
                        logger.info(f"Generated description for person: {person_description}")
                    except Exception as desc_error:
                        logger.error(f"Error generating description: {str(desc_error)}")
                        person_description = {"error": f"Description generation failed: {str(desc_error)}"}
                    
                    # Convert crop to base64 for frontend display
                    _, buffer = cv2.imencode('.jpg', person_crop)
                    crop_base64 = base64.b64encode(buffer).decode('utf-8')
                    
                    # Add to person crops list
                    person_crops.append({
                        "id": detection_id,
                        "crop": crop_base64,
                        "description": person_description
                    })
                    logger.info(f"Added person crop with ID {detection_id}")
                except Exception as crop_error:
                    logger.error(f"Error cropping person: {str(crop_error)}")
                    # Continue processing other detections
        
        # Generate a general description of the scene
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(frame_rgb)
        
        try:
            logger.info("Generating general scene description")
            scene_description = describe_person(pil_image)
            logger.info(f"Scene description: {scene_description}")
        except Exception as scene_error:
            logger.error(f"Error generating scene description: {str(scene_error)}")
            scene_description = {"error": f"Scene description failed: {str(scene_error)}"}
        
        # Convert description dictionary to a formatted string
        description_str = ""
        if scene_description:
            if isinstance(scene_description, dict):
                # Format the dictionary into a readable string
                description_parts = []
                for key, value in scene_description.items():
                    if value:  # Only include non-empty values
                        # Convert key from snake_case to Title Case
                        key_formatted = key.replace('_', ' ').title()
                        description_parts.append(f"{key_formatted}: {value}")
                description_str = ". ".join(description_parts)
            else:
                # If it's already a string, use it directly
                description_str = str(scene_description)
        
        # Debug: Log the response being sent
        logger.info(f"Sending response with {len(detections)} detections and {len(person_crops)} person crops")
        
        return FrameResponse(
            detections=detections,
            description=description_str,
            timestamp=datetime.now().isoformat(),
            person_crops=person_crops
        )
        
    except Exception as e:
        logger.error(f"Error processing frame: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Add health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


if __name__ == "__main__":
    logger.info("Starting server...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
