# main.py

from fastapi import File, UploadFile, Form, HTTPException, Request, FastAPI
from fastapi.responses import HTMLResponse, FileResponse
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
import json
import asyncio
from contextlib import asynccontextmanager

from tracker import process_image, process_video
from embedder import embed_image, embed_text, describe_person, embed_description
from db import add_person, search_people, get_person_image
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
DETECTED_PEOPLE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "detected_people")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(DETECTED_PEOPLE_DIR, exist_ok=True)

# Load YOLO model
yolo_model = YOLO("yolo11n.pt")

# Define lifespan context manager for proper startup and shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize resources
    logger.info("Starting up the application...")
    yield
    # Shutdown: Clean up resources
    logger.info("Shutting down the application...")
    try:
        # Clean up OpenCV windows
        cv2.destroyAllWindows()
        # Cancel any pending tasks
        for task in asyncio.all_tasks():
            if not task.done() and task != asyncio.current_task():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")

# Update the app to use the lifespan context manager
app = FastAPI(title="Person Detection and Search API", lifespan=lifespan)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"]  # Needed for file downloads
)

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
    camera_id: str = Field(default="unknown")

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
        
        # Get the last user message
        last_message = request.messages[-1].content.lower()
        
        # Check if it's a database-related query
        db_keywords = [
            "find", "search", "look for", "show", "who", "wearing", "person", "people",
            "database", "stored", "saved", "detected", "seen", "camera", "video"
        ]
        
        # Check if it's asking about the database state
        if "database" in last_message or "stored" in last_message or "saved" in last_message:
            try:
                # Check if database file exists
                db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "people_db.json")
                if not os.path.exists(db_path):
                    return ChatResponse(response="The database is empty. No people have been detected and stored yet.")
                
                # Read database to get count
                with open(db_path, 'r') as f:
                    db_data = json.load(f)
                    count = len(db_data.get("people", []))
                    return ChatResponse(response=f"The database currently contains {count} people. You can search for them using descriptions like 'find someone wearing a blue shirt' or 'who was wearing glasses?'")
            except Exception as e:
                logger.error(f"Error checking database state: {str(e)}")
                return ChatResponse(response="I had trouble checking the database state. Please try again.")
        
        # Check if it's a search query
        is_db_query = any(keyword in last_message for keyword in db_keywords)
        
        if is_db_query:
            # Search the database using the query
            matches = find_similar_people(last_message)
            
            if not matches:
                response_text = (
                    "I couldn't find anyone matching that description in the database. "
                    "Try being more general in your description or check if the person has been added to the database. "
                    "You can ask me about what's in the database by saying 'what's in the database?'"
                )
            else:
                # Format the response with match details
                response_parts = [f"I found {len(matches)} matches in the database:"]
                for idx, match in enumerate(matches, 1):
                    description = match["description"]
                    similarity = match.get("similarity", 0)
                    
                    # Format description details
                    details = []
                    if description.get("gender"):
                        details.append(description["gender"])
                    if description.get("age_group"):
                        details.append(description["age_group"])
                    if description.get("clothing_top"):
                        details.append(f"wearing {description['clothing_top']}")
                    if description.get("clothing_bottom"):
                        details.append(f"with {description['clothing_bottom']}")
                    
                    match_text = f"\n{idx}. Match ({similarity:.1f}% similar): {' '.join(details)}"
                    response_parts.append(match_text)
                
                response_text = "\n".join(response_parts)
        else:
            # For non-database queries, use Gemini
            model = genai.GenerativeModel('gemini-2.0-flash')
            chat = model.start_chat(history=[])
            
            # Process conversation history
            for msg in request.messages:
                if msg.role == "user":
                    response = chat.send_message(msg.content)
                    chat.history.append({"role": "assistant", "parts": [response.text]})
            
            # Generate response for the last message
            response = chat.send_message(last_message)
            response_text = response.text
        
        return ChatResponse(response=response_text)
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
                "message": "No matches found in the database",
                "suggestions": [
                    "Try using more general terms",
                    "Include fewer specific details",
                    "Check for typos in your search",
                    "Try searching for a different person"
                ]
            }
        
        # Get the best match (even if similarity is low)
        best_match = matches[0]
        similarity = best_match.get("similarity", 0)
        
        # Process the best match to include image data
        try:
            # Create a visualization of the match
            description = best_match["description"]
            metadata = best_match.get("metadata", {})
            
            # Get camera ID from metadata or description
            camera_id = metadata.get("camera_id") or description.get("camera_id")
            
            # Create a visualization image
            img = np.zeros((600, 800, 3), dtype=np.uint8)
            img.fill(255)  # White background
            
            # Add match information to the image
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.7
            thickness = 2
            color = (0, 128, 0)  # Dark green
            
            # Add similarity score with appropriate message
            if similarity < 30:
                similarity_text = f"Best Match (Low Confidence): {similarity:.1f}%"
                color = (0, 0, 255)  # Red for low confidence
            elif similarity < 50:
                similarity_text = f"Best Match (Moderate Confidence): {similarity:.1f}%"
                color = (0, 165, 255)  # Orange for moderate confidence
            else:
                similarity_text = f"Best Match (High Confidence): {similarity:.1f}%"
                color = (0, 128, 0)  # Green for high confidence
            
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
            
            # Convert to base64 for sending to client
            _, buffer = cv2.imencode('.jpg', img)
            img_base64 = base64.b64encode(buffer).decode('utf-8')
            
            # Create processed match
            processed_match = {
                "description": description,
                "metadata": metadata,
                "similarity": similarity,
                "similarity_percentage": f"{similarity:.1f}%",
                "image_data": img_base64,
                "camera_id": camera_id  # Use the camera ID we found
            }
            
            # Add confidence level message
            confidence_message = ""
            if similarity < 30:
                confidence_message = "This is the closest match found, but confidence is low. The person might be different from your search."
            elif similarity < 50:
                confidence_message = "This is the closest match found with moderate confidence. Some details might not match exactly."
            else:
                confidence_message = "This is a high-confidence match to your search."
            
            return {
                "query": query,
                "matches": [processed_match],
                "count": 1,
                "confidence_message": confidence_message,
                "camera_id": camera_id  # Include camera ID at top level too
            }
            
        except Exception as e:
            logger.error(f"Error processing match: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))
            
    except Exception as e:
        logger.error(f"Error in search endpoint: {str(e)}")
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
    host = request.url.hostname
    connect = Connect()
    connect.stream(url=f'wss://{host}/process_stream')
    response.append(connect)
    return HTMLResponse(content=str(response), media_type="application/xml")


@app.on_event("shutdown")
async def shutdown_event():
    # This function is now handled by the lifespan context manager
    # Keeping it for backward compatibility
    logger.info("Shutdown event triggered")
    try:
        # Clean up OpenCV windows when the server shuts down
        cv2.destroyAllWindows()
    except Exception as e:
        logger.error(f"Error in shutdown_event: {e}")


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
        logger.info(f"Processing frame from camera: {request.camera_id}")
        
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
                        
                        # Convert crop to base64 for frontend display
                        _, buffer = cv2.imencode('.jpg', person_crop)
                        crop_base64 = base64.b64encode(buffer).decode('utf-8')
                        
                        # Save the cropped image to the database
                        try:
                            # Create a data URL for the cropped image
                            crop_data_url = f"data:image/jpeg;base64,{crop_base64}"
                            
                            # Add the person to the database with the cropped image
                            person_id = add_person(
                                description_json=person_description,
                                metadata={
                                    "detection_id": detection_id,
                                    "confidence": conf,
                                    "timestamp": datetime.now().isoformat(),
                                    "camera_id": request.camera_id,
                                    "bbox": [float(x1), float(y1), float(x2), float(y2)]
                                },
                                crop_image=crop_data_url
                            )
                            
                            # Add the person ID to the detection
                            if person_id:
                                detection_id = person_id
                                logger.info(f"Updated detection ID to person ID: {detection_id}")
                        except Exception as save_error:
                            logger.error(f"Error saving person to database: {str(save_error)}")
                        
                        # Add to person crops list
                        person_crops.append({
                            "id": detection_id,
                            "crop": crop_base64,
                            "description": person_description
                        })
                        logger.info(f"Added person crop with ID {detection_id}")
                        
                        # Add to detections list with description
                        detections.append({
                            "id": detection_id,
                            "type": "person",
                            "confidence": conf,
                            "bbox": [float(x1), float(y1), float(x2), float(y2)],
                            "timestamp": datetime.now().isoformat(),
                            "camera_id": request.camera_id,
                            "description": person_description  # Add the description to the detection
                        })
                    except Exception as desc_error:
                        logger.error(f"Error generating description or saving to database: {str(desc_error)}")
                        person_description = {"error": f"Description generation failed: {str(desc_error)}"}
                        
                        # Add to detections list without description
                        detections.append({
                            "id": detection_id,
                            "type": "person",
                            "confidence": conf,
                            "bbox": [float(x1), float(y1), float(x2), float(y2)],
                            "timestamp": datetime.now().isoformat(),
                            "camera_id": request.camera_id
                        })
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
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.get("/person_image/{person_id}")
async def get_person_image(person_id: str):
    try:
        # Get the person from the database
        person = db.get_person(person_id)
        if not person:
            raise HTTPException(status_code=404, detail="Person not found")
        
        # Get the image path from the person's data
        image_path = person.get("image_path")
        if not image_path:
            raise HTTPException(status_code=404, detail="No image found for this person")
        
        # Check if the image exists
        if not os.path.exists(image_path):
            raise HTTPException(status_code=404, detail="Image file not found")
        
        # Return the image file
        return FileResponse(image_path)
        
    except Exception as e:
        logger.error(f"Error retrieving person image: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    logger.info("Starting server...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
