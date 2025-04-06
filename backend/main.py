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
import uuid
import supervision as sv
import google.generativeai as palm
from describe import describe_person
from db import add_person, search_people, reset_database, load_database
from search import find_similar_people, generate_rag_response
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
async def search_person(request: SearchRequest):
    try:
        logger.info(f"Searching for: {request.description}")
        
        # Search for similar people using the JSON database
        matches = find_similar_people(request.description)
        logger.info(f"Search returned {len(matches)} matches")
        
        if not matches:
            logger.info("No matches found")
            return {
                "matches": [],
                "message": "No matches found",
                "suggestions": [
                    "Try using more general terms",
                    "Include fewer specific details",
                    "Check for typos in your search",
                    "Try searching for a different person"
                ]
            }
        
        # Log match details for debugging
        for i, match in enumerate(matches):
            logger.info(f"Match {i+1}: Similarity {match['similarity']}%")
            logger.info(f"Description: {match['description']}")
            logger.info(f"Metadata: {match['metadata']}")
        
        # Generate RAG-enhanced response using Gemini
        rag_result = generate_rag_response(request.description, matches)
        
        return {
            "matches": matches,
            "count": len(matches),
            "rag_response": rag_result["response"] if isinstance(rag_result, dict) and "response" in rag_result else "I found some matches for your search."
        }
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
            
            # Add to detections list with camera_id from request
            detections.append({
                "type": "person",
                "confidence": conf,
                "bbox": [float(x1), float(y1), float(x2), float(y2)],
                "timestamp": datetime.now().isoformat(),
                "camera_id": request.camera_id
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
                        
                        # Add to database with image and camera_id from request
                        add_person(
                            description_json=person_description,
                            metadata={
                                "track_id": detection_id,
                                "frame": -1,  # We don't have frame number in this context
                                "image": person_pil,
                                "camera_id": request.camera_id,
                                "confidence": conf,
                                "bbox": [float(x1), float(y1), float(x2), float(y2)]
                            }
                        )
                        logger.info(f"Added person to database with ID: {detection_id}")
                        
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
        
        # Check for amber alert matches for each person description
        amber_alert_match = None
        for person_crop in person_crops:
            if "description" in person_crop and isinstance(person_crop["description"], dict):
                # Check if this person matches any active amber alerts
                match_result = check_amber_alert_match(person_crop["description"])
                if match_result:
                    logger.info(f"Found amber alert match: {match_result}")
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


# Add health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


if __name__ == "__main__":
    logger.info("Starting server...")
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
