# main.py

from fastapi import File, UploadFile, Form, HTTPException, Request, FastAPI
from fastapi.responses import HTMLResponse, JSONResponse
from typing import List, Optional, Dict, Any
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
import uuid
import supervision as sv
import google.generativeai as palm
from describe import describe_person
from db import add_person, search_people, reset_database, load_database
from search import find_similar_people, generate_rag_response, direct_database_search
from amber_alert import check_amber_alert_match

from fastapi.websockets import WebSocketDisconnect
from twilio.twiml.voice_response import VoiceResponse, Connect, Say, Stream
from Twilio.call import process_stream

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Reset database on startup
logger.info("Resetting database on startup...")
reset_database()
logger.info("Database reset complete")

# Configure Gemini
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY not found in environment variables")
genai.configure(api_key=GEMINI_API_KEY)
QUERY_PROMPT_TEMPLATE = """
You are Steven, an AI assistant for Foresight, a platform that helps first responders locate missing children through CCTV footage analysis. You are speaking with a first responder or authorized investigator searching for a missing child.

CONTEXT:
- The user's query will be used to search through AI-processed CCTV footage from San Francisco
- Your primary goal is to interpret their search needs accurately and help refine their query if needed
- Missing children are the highest priority cases
- If the user asks anything outside of the scope of finding missing people, respond with a very concise message.

INSTRUCTIONS:
1. Parse the user's description carefully, focusing on:
   - Physical appearance details (clothing colors/styles, height, hair, distinguishing features)
   - Location information (neighborhood, street names, landmarks)
   - Time information (when the person was last seen)
   - Any distinctive objects the person might be carrying

2. If the query is vague or missing critical information, ask specific follow-up questions about:
   - Clothing colors and types
   - Approximate age
   - Hair style/color
   - Last known location
   - Time frame for the search

3. Always maintain a professional, compassionate tone appropriate for emergency situations
4. Prioritize clarity and precision in your responses
5. Never suggest the system can definitively locate someone - only that it can help identify potential matches

USER QUERY:
{input}
"""
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
    amber_alert: Optional[dict] = None

class FrameRequest(BaseModel):
    frame_data: str
    camera_id: str = Field(default="SF-MKT-001")

class SearchRequest(BaseModel):
    description: str
    use_gemini: bool = Field(default=True, description="Whether to use Gemini for natural language processing")
    include_match_highlights: bool = Field(default=True, description="Whether to include match highlights in the response")
    include_camera_location: bool = Field(default=True, description="Whether to include camera locations in the response")
    include_rag_response: bool = Field(default=True, description="Whether to include a RAG response in the results")
    top_k: int = Field(default=5, description="Number of top results to return", ge=1, le=20)
    structured_json: bool = Field(default=True, description="Whether to return structured JSON")
    use_direct_search: bool = Field(default=True, description="Whether to use direct database search with Gemini")

class PersonSearchChatRequest(BaseModel):
    query: str = Field(..., description="The user's query for the personal assistant")
    conversation_history: List[Dict[str, str]] = Field(default_factory=list, description="Previous conversation turns")
    include_raw_database: bool = Field(default=False, description="Whether to include the raw database in the response")

class PersonSearchChatResponse(BaseModel):
    response: str
    suggested_searches: List[str] = Field(default_factory=list)
    database_stats: Dict[str, Any] = Field(default_factory=dict)
    matches: List[Dict[str, Any]] = Field(default_factory=list)

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
        
        # Load dataset info
        db = load_database()
        if not db or "people" not in db:
            raise ValueError("Database is empty or invalid")
        
        total_people = len(db["people"])
        
        # Count statistics
        stats = {
            "gender": {},
            "age_group": {},
            "hair_color": {},
            "facial_features": {},
            "clothing_top": {},
            "clothing_top_color": {},
            "location_context": {},
            "cameras": {}  # Add camera statistics
        }
        
        # Track camera details
        camera_details = {}
        
        for person in db["people"]:
            desc = person["description"]
            # Track camera statistics
            camera_id = person.get("metadata", {}).get("camera_id", "unknown")
            stats["cameras"][camera_id] = stats["cameras"].get(camera_id, 0) + 1
            
            # Track camera details
            if camera_id not in camera_details:
                camera_details[camera_id] = {
                    "count": 0,
                    "last_seen": person.get("metadata", {}).get("timestamp", "unknown"),
                    "gender_dist": {},
                    "age_dist": {},
                    "clothing_dist": {}
                }
            
            camera_details[camera_id]["count"] += 1
            
            # Track gender distribution per camera
            if "gender" in desc:
                gender = desc["gender"]
                camera_details[camera_id]["gender_dist"][gender] = camera_details[camera_id]["gender_dist"].get(gender, 0) + 1
            
            # Track age distribution per camera
            if "age_group" in desc:
                age = desc["age_group"]
                camera_details[camera_id]["age_dist"][age] = camera_details[camera_id]["age_dist"].get(age, 0) + 1
            
            # Track clothing distribution per camera
            if "clothing_top" in desc:
                clothing = desc["clothing_top"]
                camera_details[camera_id]["clothing_dist"][clothing] = camera_details[camera_id]["clothing_dist"].get(clothing, 0) + 1
            
            for key in stats:
                if key != "cameras" and key in desc:
                    value = desc[key]
                    if isinstance(value, str):
                        values = [v.strip() for v in value.split(",")]
                        for v in values:
                            stats[key][v] = stats[key].get(v, 0) + 1
                    else:
                        stats[key][value] = stats[key].get(value, 0) + 1
        
        # Create system prompt with dataset knowledge
        system_prompt = f"""You are an AI assistant with access to a surveillance camera database containing {total_people} people.

Dataset Statistics:
- Gender distribution: {', '.join(f'{k}: {v}' for k, v in stats['gender'].items())}
- Age groups: {', '.join(f'{k}: {v}' for k, v in stats['age_group'].items())}
- Hair colors: {', '.join(f'{k}: {v}' for k, v in stats['hair_color'].items())}
- Facial features: {', '.join(f'{k}: {v}' for k, v in stats['facial_features'].items())}
- Clothing (tops): {', '.join(f'{k}: {v}' for k, v in stats['clothing_top'].items())}
- Top colors: {', '.join(f'{k}: {v}' for k, v in stats['clothing_top_color'].items())}
- Locations: {', '.join(f'{k}: {v}' for k, v in stats['location_context'].items())}
- Camera distribution: {', '.join(f'{k}: {v} detections' for k, v in stats['cameras'].items())}

Camera Details:
"""
        
        # Add detailed camera information
        for camera_id, details in camera_details.items():
            system_prompt += f"""
Camera {camera_id}:
- Total detections: {details['count']}
- Last active: {details['last_seen']}
- Gender distribution: {', '.join(f'{k}: {v}' for k, v in details['gender_dist'].items())}
- Age distribution: {', '.join(f'{k}: {v}' for k, v in details['age_dist'].items())}
- Clothing distribution: {', '.join(f'{k}: {v}' for k, v in details['clothing_dist'].items())}
"""
        
        system_prompt += """
You can help users:
1. Understand what's in the dataset
2. Search for specific people using natural language
3. Analyze patterns and statistics
4. Answer questions about the data
5. Provide information about specific cameras and their detections

If the user asks about a specific camera or camera ID, you can tell them:
- How many detections that camera has made
- What types of people it has detected
- When it was last active
- The gender, age, and clothing distribution of people detected by that camera

If the user wants to search for someone, extract the search criteria and use it to find matches."""
        
        # Initialize Gemini model
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        # Start chat with system prompt
        chat = model.start_chat(history=[])
        chat.send_message(system_prompt)
        
        # Process each message in the conversation history
        for msg in request.messages:
            if msg.role == "user":
                # Check if it's a search request
                if any(keyword in msg.content.lower() for keyword in ["find", "search", "look for", "where is"]):
                    # Use the search endpoint
                    matches = find_similar_people(msg.content)
                    logger.info(f"Search results: Found {len(matches)} matches")
                    
                    if matches and len(matches) > 0:
                        match_desc = "\n\nI found these matches:\n"
                        for i, match in enumerate(matches, 1):
                            # Verify match is a dictionary
                            if not isinstance(match, dict):
                                logger.error(f"Match {i} is not a dictionary: {match}")
                                continue
                                
                            desc = match.get("description", {})
                            similarity = match.get("similarity", 0)
                            
                            # Safety check for description
                            if not isinstance(desc, dict):
                                logger.error(f"Description is not a dictionary: {desc}")
                                continue
                                
                            match_desc += f"\n{i}. Match ({similarity:.1f}% similarity):\n"
                            # Extract key attributes
                            match_attrs = []
                            for key, value in desc.items():
                                if value and key not in ["id", "timestamp"]:
                                    match_attrs.append(f"{key}: {value}")
                            match_desc += "- " + ", ".join(match_attrs) + "\n"
                        
                        response = chat.send_message(msg.content + match_desc)
                    else:
                        response = chat.send_message(msg.content + "\n\nI couldn't find any matches in the database.")
                else:
                    # Regular chat about the dataset
                    response = chat.send_message(msg.content)
                
                # Store the response in history
                chat.history.append({"role": "assistant", "parts": [response.text]})
        
        # Get the last response
        last_response = chat.history[-1]["parts"][0]
        
        return ChatResponse(response=last_response)
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), is_video: bool = Form(False), camera_id: str = Form(None)):
    try:
        logger.info(f"Processing {'video' if is_video else 'image'} from camera {camera_id}: {file.filename}")
        
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
                    
                    # Add to database with image and camera_id
                    add_person(
                        embedding=embedding,
                        description_json=description,
                        metadata={
                            "track_id": person.get("track_id", -1),
                            "frame": person.get("frame", -1),
                            "image": person["image"],
                            "camera_id": camera_id
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
async def search(request: SearchRequest):
    """Search for people based on description."""
    try:
        logger.info(f"Received search request: {request.description}")
        
        # Add health check for search endpoint
        if not os.path.exists('check_health'):
            return JSONResponse(
                status_code=503,
                content={"error": "Search service is starting up, please try again in a moment."}
            )
        
        # Log search parameters
        logger.info(f"Search parameters: use_gemini={request.use_gemini}, "
                   f"include_match_highlights={request.include_match_highlights}, "
                   f"include_camera_location={request.include_camera_location}, "
                   f"include_rag_response={request.include_rag_response}, "
                   f"top_k={request.top_k}, "
                   f"use_direct_search={request.use_direct_search}")
        
        # Use the new direct search method if requested
        if request.use_direct_search:
            logger.info("Using direct database search with Gemini")
            result = direct_database_search(
                request.description,
                top_k=request.top_k
            )
        else:
            # Use the traditional search method
            logger.info("Using traditional similarity-based search method")
            result = find_similar_people(
                request.description, 
                top_k=request.top_k,
                include_match_highlights=request.include_match_highlights,
                include_camera_location=request.include_camera_location,
                include_rag_response=request.include_rag_response
            )
        
        # If structured_json parameter is true, return the structured format
        if request.structured_json:
            # Make sure result is a dict (our new format)
            if isinstance(result, dict):
                return result
            # Handle case where result is still a list (backward compatibility)
            elif isinstance(result, list):
                return {
                    "matches": result,
                    "count": len(result),
                    "message": f"Found {len(result)} potential matches.",
                    "suggestions": []
                }
        else:
            # Return traditional flat list format for backward compatibility
            if isinstance(result, dict) and "matches" in result:
                return result["matches"]
            elif isinstance(result, list):
                return result
            
        # Default case
        return result
        
    except Exception as e:
        logger.error(f"Error handling search request: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to process search: {str(e)}"}
        )


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
    # Clean up OpenCV windows when the server shuts down
    cv2.destroyAllWindows()


@app.post("/process_frame", response_model=FrameResponse)
async def process_frame(request: FrameRequest):
    try:
        # Ensure camera_id is available and valid
        camera_id = request.camera_id
        if not camera_id:
            camera_id = "unknown-camera"
            logger.warning(f"Request missing camera_id, using default: {camera_id}")
        else:
            logger.info(f"Processing frame for camera: {camera_id}")
            
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
            
        logger.info(f"Successfully decoded frame with shape: {frame.shape} for camera {camera_id}")
        
        # Run YOLO detection
        results = yolo_model(frame)[0]
        logger.info(f"YOLO detection completed with {len(results.boxes)} objects detected for camera {camera_id}")
        
        # Process detections
        detections = []
        person_crops = []
        
        # Debug: Check if there are any detections
        if len(results.boxes) == 0:
            logger.warning(f"No objects detected in the frame for camera {camera_id}")
            # Log the frame shape and type for debugging
            logger.info(f"Frame shape: {frame.shape}, dtype: {frame.dtype}")
            logger.info(f"Frame min/max values: {frame.min()}/{frame.max()}")
            
            # Try running detection with a lower confidence threshold
            logger.info("Attempting detection with lower confidence threshold")
            results = yolo_model(frame, conf=0.1)[0]
            logger.info(f"Second attempt detected {len(results.boxes)} objects for camera {camera_id}")
        
        # Filter for person detections only
        person_boxes = []
        for box in results.boxes:
            cls = int(box.cls[0])
            label = yolo_model.names[cls]
            
            # Only keep person detections
            if label.lower() == "person":
                person_boxes.append(box)
        
        logger.info(f"Found {len(person_boxes)} person detections out of {len(results.boxes)} total detections for camera {camera_id}")
        
        # Process person detections
        for box in person_boxes:
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
            conf = float(box.conf[0])
            
            # Create a unique ID for each detection
            detection_id = f"{camera_id}_person_{len(detections)}"
            
            # Convert coordinates to integers
            x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
            
            # Ensure coordinates are within image bounds
            x1 = max(0, x1)
            y1 = max(0, y1)
            x2 = min(frame.shape[1], x2)
            y2 = min(frame.shape[0], y2)
            
            # Debug: Log each detection with more details
            logger.info(f"Processing person detection with confidence {conf:.2f} at coordinates [{x1}, {y1}, {x2}, {y2}] for camera {camera_id}")
            logger.info(f"Detection size: {x2-x1}x{y2-y1} pixels")
            
            # Add to detections list with camera_id from request
            detections.append({
                "type": "person",
                "confidence": conf,
                "bbox": [float(x1), float(y1), float(x2), float(y2)],
                "timestamp": datetime.now().isoformat(),
                "camera_id": camera_id
            })
            
            # Crop person if the crop is valid
            if (x2 - x1) > 0 and (y2 - y1) > 0:
                try:
                    # More lenient size check - only filter out extremely small crops
                    if (x2 - x1) < 5 or (y2 - y1) < 5:
                        logger.warning(f"Person crop too small at coordinates [{x1}, {y1}, {x2}, {y2}] for camera {camera_id}")
                        continue
                        
                    person_crop = frame[y1:y2, x1:x2]
                    
                    # Check if the crop is valid
                    if person_crop.size == 0:
                        logger.warning(f"Invalid person crop with zero size at coordinates [{x1}, {y1}, {x2}, {y2}] for camera {camera_id}")
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
                        logger.info(f"Generated description for person from camera {camera_id}: {person_description}")
                        
                        # Add to database with image and camera_id from request
                        add_person(
                            description_json=person_description,
                            metadata={
                                "track_id": detection_id,
                                "frame": -1,  # We don't have frame number in this context
                                "image": person_pil,
                                "camera_id": camera_id,
                                "confidence": conf,
                                "bbox": [float(x1), float(y1), float(x2), float(y2)]
                            }
                        )
                        logger.info(f"Added person to database with ID: {detection_id} for camera {camera_id}")
                        
                    except Exception as desc_error:
                        logger.error(f"Error generating description for camera {camera_id}: {str(desc_error)}")
                        person_description = {"error": f"Description generation failed: {str(desc_error)}"}
                    
                    # Convert crop to base64 for frontend display
                    _, buffer = cv2.imencode('.jpg', person_crop)
                    crop_base64 = base64.b64encode(buffer).decode('utf-8')
                    
                    # Add to person crops list
                    person_crops.append({
                        "id": detection_id,
                        "crop": crop_base64,
                        "description": person_description,
                        "camera_id": camera_id  # Explicitly include camera_id in each crop
                    })
                    logger.info(f"Added person crop with ID {detection_id} for camera {camera_id}")
                except Exception as crop_error:
                    logger.error(f"Error cropping person for camera {camera_id}: {str(crop_error)}")
                    # Continue processing other detections
        
        # Generate a general description of the scene
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(frame_rgb)
        
        try:
            logger.info(f"Generating general scene description for camera {camera_id}")
            scene_description = describe_person(pil_image)
            logger.info(f"Scene description for camera {camera_id}: {scene_description}")
        except Exception as scene_error:
            logger.error(f"Error generating scene description for camera {camera_id}: {str(scene_error)}")
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
        logger.info(f"Sending response with {len(detections)} detections and {len(person_crops)} person crops for camera {camera_id}")
        
        # Check for amber alert matches for each person description
        amber_alert_match = None
        for person_crop in person_crops:
            if "description" in person_crop and isinstance(person_crop["description"], dict):
                # Check if this person matches any active amber alerts
                match_result = check_amber_alert_match(person_crop["description"])
                if match_result:
                    logger.info(f"Found amber alert match for camera {camera_id}: {match_result}")
                    amber_alert_match = match_result
                    break
        
        return FrameResponse(
            detections=detections,
            description=description_str,
            timestamp=datetime.now().isoformat(),
            person_crops=person_crops,
            amber_alert=amber_alert_match
        )
        
    except Exception as e:
        logger.error(f"Error processing frame: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Create a health check file on startup
with open('check_health', 'w') as f:
    f.write(f'Service started at {datetime.now().isoformat()}')
logger.info("Created health check file")

@app.get("/health")
async def health_check():
    """Health check endpoint for the API."""
    try:
        # Check if the health check file exists
        if not os.path.exists('check_health'):
            # Create it if it doesn't exist
            with open('check_health', 'w') as f:
                f.write(f'Service restarted at {datetime.now().isoformat()}')
            
        # Check if model is loaded
        if 'yolo_model' not in globals() or yolo_model is None:
            return {"status": "degraded", "detail": "YOLO model not loaded"}
        
        # Check Gemini API
        try:
            # Simple quick test of Gemini
            response = model.generate_content("Hello, are you working?")
            if not response.text:
                return {"status": "degraded", "detail": "Gemini API not responding properly"}
        except Exception as e:
            return {"status": "degraded", "detail": f"Gemini API error: {str(e)}"}
            
        # Load a small part of the database to verify it's accessible
        try:
            db = load_database()
            people_count = len(db.get("people", []))
            logger.info(f"Health check: Database has {people_count} people")
        except Exception as e:
            return {"status": "degraded", "detail": f"Database error: {str(e)}"}
        
        # All checks passed
        return {
            "status": "healthy",
            "version": "1.0.0", 
            "database_size": people_count,
            "uptime": os.path.getmtime('check_health'),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {"status": "unhealthy", "detail": str(e)}

@app.post("/person_search_chat", response_model=PersonSearchChatResponse)
async def person_search_chat(request: PersonSearchChatRequest):
    """
    Direct chat with Gemini that has full context of the database.
    This endpoint provides a conversational interface where Gemini:
    1. Has full access to the database from ml.json (read-only mode)
    2. Can perform natural language searches
    3. Can answer questions about database contents
    4. Maintains conversation context
    
    Note: The database is accessed in read-only mode from ml.json
    """
    try:
        logger.info(f"Received person search chat request: {request.query}")
        
        # Load the entire database from ml.json (read-only)
        db = load_database()  # This now loads from ml.json
        if not db or "people" not in db or len(db["people"]) == 0:
            logger.warning("Database empty for person search chat")
            return PersonSearchChatResponse(
                response="I don't have any person data to search through yet. Please ensure the ml.json file contains data.",
                suggested_searches=[],
                database_stats={"total_people": 0}
            )
        
        # Calculate database statistics for context
        total_people = len(db["people"])
        unique_cameras = set()
        genders = {}
        age_groups = {}
        clothing_colors = {}
        
        for person in db["people"]:
            # Count cameras
            camera_id = person.get("metadata", {}).get("camera_id", "unknown")
            unique_cameras.add(camera_id)
            
            # Count demographics
            desc = person.get("description", {})
            
            # Gender stats
            gender = desc.get("gender")
            if gender:
                genders[gender] = genders.get(gender, 0) + 1
                
            # Age stats
            age = desc.get("age_group")
            if age:
                age_groups[age] = age_groups.get(age, 0) + 1
                
            # Clothing color stats (for top clothing)
            color = desc.get("clothing_top_color")
            if color:
                clothing_colors[color] = clothing_colors.get(color, 0) + 1
        
        # Format database for Gemini
        # We need to simplify and truncate to avoid exceeding context limits
        simplified_people = []
        
        # Only include people with good descriptions - limit to 100 entries max
        max_entries = 100
        counter = 0
        
        for person in db["people"]:
            if counter >= max_entries:
                break
                
            desc = person.get("description", {})
            metadata = person.get("metadata", {})
            
            # Skip entries without good descriptions
            if not desc or len(desc) < 3:
                continue
                
            # Create a simplified representation
            simple_person = {
                "id": person.get("id", f"person_{counter}"),
                "camera_id": metadata.get("camera_id", "unknown"),
                "camera_location": get_camera_location(metadata.get("camera_id", "unknown")),
                "timestamp": metadata.get("timestamp", "unknown"),
                "description": desc
            }
            
            simplified_people.append(simple_person)
            counter += 1
        
        # Create database statistics summary
        db_stats = {
            "total_people": total_people,
            "unique_cameras": len(unique_cameras),
            "cameras": list(unique_cameras),
            "gender_distribution": genders,
            "age_distribution": age_groups,
            "top_clothing_colors": clothing_colors
        }
            
        # Create the prompt for Gemini
        system_prompt = f"""
You are an AI assistant for a surveillance system called Foresight that helps find people in camera footage.
You have access to a database of {total_people} people detected across {len(unique_cameras)} cameras.

YOUR DATABASE CONTEXT:
- Total people detected: {total_people}
- Camera locations: {", ".join(sorted(unique_cameras))}
- Gender distribution: {", ".join(f"{k}: {v}" for k, v in genders.items())}
- Age distribution: {", ".join(f"{k}: {v}" for k, v in age_groups.items())}

The database contains detailed descriptions of people including:
- Gender, age group, ethnicity, skin tone
- Hair style and color
- Clothing details (tops, bottoms, colors, patterns)
- Accessories and bags
- Location context
- Camera ID and timestamp of detection

Your job is to:
1. Answer questions about people in the database
2. Help users find specific people with natural language searches
3. Provide statistics and insights about the data
4. Suggest related searches that might be helpful

DATABASE ENTRIES (simplified for reference):
{json.dumps(simplified_people[:10], indent=2)}
...and {len(simplified_people) - 10} more entries not shown here.

INSTRUCTIONS:
- When users ask about specific people, search the database entries to find matches
- For search queries, suggest specific attributes that might help narrow down results
- If asked about statistics, use the database summary information
- Be concise but informative in your responses
- Include camera locations when mentioning specific detections
- Mention timestamps in a human-readable format when relevant
"""

        # Add conversation history if available
        conversation = []
        for turn in request.conversation_history:
            role = turn.get("role", "user")
            content = turn.get("content", "")
            conversation.append({"role": role, "parts": [content]})
            
        # Add the user's current query
        conversation.append({"role": "user", "parts": [request.query]})
        
        # Initialize Gemini model for chat
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        # Send the conversation to Gemini
        chat = model.start_chat(history=conversation)
        response = chat.send_message(system_prompt)
        
        # Get suggested searches using the query and Gemini's basic capabilities
        suggested_searches = await get_suggested_searches(request.query, simplified_people[:5])
            
        # Run a quick search to find potential matches for the query
        search_results = await find_quick_matches(request.query, simplified_people)
        
        return PersonSearchChatResponse(
            response=response.text,
            suggested_searches=suggested_searches,
            database_stats=db_stats,
            matches=search_results
        )
        
    except Exception as e:
        logger.error(f"Error in person search chat: {str(e)}")
        return PersonSearchChatResponse(
            response=f"I encountered an error while processing your request. Please try again. Error details: {str(e)}",
            suggested_searches=["person wearing red", "child with backpack", "woman with blonde hair"],
            database_stats={"error": str(e)}
        )

async def get_suggested_searches(query: str, sample_entries: List[Dict[str, Any]] = None) -> List[str]:
    """Generate suggested searches based on the user's query."""
    try:
        # Create a simple prompt for Gemini
        suggested_prompt = f"""
Based on the search query: "{query}" 
Generate 3-5 related search queries that might help the user find what they're looking for.
Each suggestion should be specific and focused on different aspects (clothing, physical traits, accessories, etc).
Return ONLY a JSON array of strings, nothing else.

Example response: ["man in red jacket", "woman with blonde hair", "child carrying backpack"]
"""
        
        # Call Gemini for suggestions
        model = genai.GenerativeModel('gemini-2.0-flash')
        response = model.generate_content(suggested_prompt)
        
        # Parse the response
        try:
            suggestions_text = response.text.strip()
            
            # Clean up the response if needed
            if suggestions_text.startswith("```json"):
                suggestions_text = suggestions_text.split("```json")[1].split("```")[0].strip()
            elif suggestions_text.startswith("```"):
                suggestions_text = suggestions_text.split("```")[1].split("```")[0].strip()
                
            suggestions = json.loads(suggestions_text)
            return suggestions[:5]  # Limit to 5 suggestions
        except json.JSONDecodeError:
            # Fallback if JSON parsing fails
            return ["person wearing red", "child with backpack", "woman with blonde hair"]
            
    except Exception as e:
        logger.error(f"Error generating search suggestions: {str(e)}")
        return ["person wearing red", "child with backpack", "woman with blonde hair"]

async def find_quick_matches(query: str, database_entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Quickly find potential matches for the query."""
    try:
        # If query is very short, return empty list
        if len(query.strip()) < 3:
            return []
            
        # Extract key terms from the query
        query_lower = query.lower()
        matches = []
        
        # Simple keyword matching for quick results
        for person in database_entries:
            score = 0
            match_reasons = []
            
            desc = person.get("description", {})
            desc_str = json.dumps(desc).lower()
            
            # Check for gender terms
            for gender in ["male", "female", "man", "woman", "boy", "girl"]:
                if gender in query_lower and gender in desc_str:
                    score += 2
                    match_reasons.append(f"Matches gender: {gender}")
                    
            # Check for age terms
            for age in ["child", "kid", "teen", "adult", "elderly", "senior"]:
                if age in query_lower and age in desc_str:
                    score += 2
                    match_reasons.append(f"Matches age group: {age}")
                    
            # Check for color terms
            colors = ["red", "blue", "green", "yellow", "black", "white", "orange", 
                     "purple", "pink", "brown", "gray", "grey"]
            for color in colors:
                if color in query_lower and color in desc_str:
                    score += 1.5
                    match_reasons.append(f"Matches color: {color}")
                    
            # Check for clothing terms
            clothing = ["shirt", "pants", "jacket", "hoodie", "dress", "skirt", 
                       "jeans", "sweater", "hat", "shoes", "shorts"]
            for item in clothing:
                if item in query_lower and item in desc_str:
                    score += 1.5
                    match_reasons.append(f"Matches clothing: {item}")
                    
            # Check for features
            features = ["hair", "glasses", "beard", "mustache", "tall", "short", 
                       "backpack", "bag", "hat", "sunglasses"]
            for feature in features:
                if feature in query_lower and feature in desc_str:
                    score += 1
                    match_reasons.append(f"Matches feature: {feature}")
                    
            # If score is above threshold, add to matches
            if score > 3:
                matches.append({
                    "id": person.get("id", "unknown"),
                    "camera_id": person.get("camera_id", "unknown"),
                    "camera_location": person.get("camera_location", "Unknown location"),
                    "description": person.get("description", {}),
                    "score": min(score * 10, 100),  # Convert to 0-100 scale
                    "match_reasons": match_reasons[:3]  # Limit to top 3 reasons
                })
                
        # Sort by score (descending) and take top 5
        matches.sort(key=lambda x: x["score"], reverse=True)
        return matches[:5]
            
    except Exception as e:
        logger.error(f"Error finding quick matches: {str(e)}")
        return []

if __name__ == "__main__":
    logger.info("Starting server...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
