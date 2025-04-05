# main.py

from fastapi import File, UploadFile, Form, HTTPException, Request, FastAPI
from fastapi.responses import HTMLResponse
from typing import List
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
from pydantic import BaseModel

from tracker import process_image, process_video
from embedder import embed_image, embed_text, describe_person, embed_description
from db import add_person
from search import find_similar_people

from twilio.twiml.voice_response import VoiceResponse, Connect
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

# Define models for chat
class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]

class ChatResponse(BaseModel):
    response: str

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
    host = request.url.hostname
    connect = Connect()
    connect.stream(url=f'wss://{host}/process_stream')
    response.append(connect)
    return HTMLResponse(content=str(response), media_type="application/xml")


@app.on_event("shutdown")
async def shutdown_event():
    # Clean up OpenCV windows when the server shuts down
    cv2.destroyAllWindows()


if __name__ == "__main__":
    logger.info("Starting server...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
