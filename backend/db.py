# db.py

import json
import uuid
import os
from dotenv import load_dotenv
import base64
from datetime import datetime
import numpy as np
from typing import List, Dict, Any
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Setup JSON storage
DB_FILE = "people_database.json"
UPLOADS_DIR = "uploads"

# Ensure uploads directory exists
os.makedirs(UPLOADS_DIR, exist_ok=True)

def load_database() -> Dict[str, Any]:
    """Load the database from JSON file."""
    if os.path.exists(DB_FILE):
        with open(DB_FILE, 'r') as f:
            return json.load(f)
    return {"people": []}

def save_database(data: Dict[str, Any]):
    """Save the database to JSON file."""
    try:
        with open(DB_FILE, 'w') as f:
            json.dump(data, f, indent=2)
        logger.info(f"Database saved successfully with {len(data.get('people', []))} people")
    except Exception as e:
        logger.error(f"Error saving database: {str(e)}")
        raise

def reset_database():
    """Reset the database (for debugging/testing)."""
    save_database({"people": []})
    print("Database reset successfully")

def initialize_database():
    """Initialize the database if it doesn't exist."""
    if not os.path.exists(DB_FILE):
        save_database({"people": []})
        print("Database initialized successfully")
    else:
        print("Database already exists, not resetting")

# Initialize database on module import
initialize_database()

def add_person(description_json: Dict[str, Any], metadata: Dict[str, Any] = None):
    """Add a person to the database."""
    if metadata is None:
        metadata = {}
    
    # Generate unique ID for the person
    person_id = str(uuid.uuid4())
    
    # Handle image storage
    if "image_path" not in metadata and "image" in metadata:
        image_path = os.path.join(UPLOADS_DIR, f"{person_id}.jpg")
        
        if isinstance(metadata["image"], bytes):
            with open(image_path, "wb") as f:
                f.write(metadata["image"])
        else:
            metadata["image"].save(image_path)
        
        metadata["image_path"] = image_path
    
    # Create person entry
    person = {
        "id": person_id,
        "description": description_json,
        "metadata": {
            "gender": description_json.get("gender", ""),
            "age_group": description_json.get("age_group", ""),
            "track_id": metadata.get("track_id", -1),
            "frame": metadata.get("frame", -1),
            "image_path": metadata.get("image_path", ""),
            "camera_id": metadata.get("camera_id", ""),
            "timestamp": datetime.now().isoformat()
        }
    }
    
    # Load current database
    db = load_database()
    
    # Add to database
    db["people"].append(person)
    
    # Save updated database
    save_database(db)
    
    return person_id

def cosine_similarity(a: List[float], b: List[float]) -> float:
    """Calculate cosine similarity between two vectors."""
    a = np.array(a)
    b = np.array(b)
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def search_people(query_embedding: List[float], n: int = 3) -> Dict[str, Any]:
    """Search for similar people in the database."""
    db = load_database()
    
    # Calculate similarities
    similarities = []
    for person in db["people"]:
        similarity = cosine_similarity(query_embedding, person["embedding"])
        similarities.append((person, similarity))
    
    # Sort by similarity (descending)
    similarities.sort(key=lambda x: x[1], reverse=True)
    
    # Take top n results
    top_results = similarities[:n]
    
    # Process results
    processed_results = []
    for person, similarity in top_results:
        try:
            # Convert similarity to percentage (0-100%)
            similarity_score = max(0, min(100, similarity * 100))
            
            # Load and encode image
            image_data = None
            image_path = person["metadata"].get("image_path", "")
            if image_path and os.path.exists(image_path):
                try:
                    with open(image_path, "rb") as img_file:
                        image_data = base64.b64encode(img_file.read()).decode("utf-8")
                except Exception as e:
                    print(f"Error loading image {image_path}: {e}")
            
            processed_results.append({
                "description": person["description"],
                "metadata": person["metadata"],
                "similarity": similarity_score,
                "image_data": image_data
            })
        except Exception as e:
            print(f"Error processing result: {e}")
            continue
    
    return {
        "query": "find someone",
        "matches": processed_results,
        "count": len(processed_results)
    }