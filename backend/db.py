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

# Setup JSON storage - Use ml.json as the source
DB_FILE = "ml.json"  # Changed from people_database.json to ml.json
UPLOADS_DIR = "uploads"

# Ensure uploads directory exists
os.makedirs(UPLOADS_DIR, exist_ok=True)

def load_database() -> Dict[str, Any]:
    """Load the database from JSON file."""
    try:
        if os.path.exists(DB_FILE):
            with open(DB_FILE, 'r') as f:
                try:
                    data = json.load(f)
                    
                    # Validate basic database structure
                    if not isinstance(data, dict):
                        logger.error(f"Database is not a dictionary: {type(data)}")
                        return {"people": []}
                        
                    if "people" not in data:
                        logger.error("Database is missing 'people' key")
                        return {"people": []}
                        
                    if not isinstance(data["people"], list):
                        logger.error(f"Database 'people' is not a list: {type(data['people'])}")
                        return {"people": []}
                    
                    # Log database load success
                    logger.info(f"Database loaded successfully from {DB_FILE} with {len(data.get('people', []))} people")
                    return data
                except json.JSONDecodeError as e:
                    logger.error(f"Error parsing database JSON: {str(e)}")
                    return {"people": []}
        else:
            logger.warning(f"Database file not found: {DB_FILE}")
            return {"people": []}
    except Exception as e:
        logger.error(f"Error loading database: {str(e)}")
        return {"people": []}

# Note: The following functions are kept for compatibility but will log warnings when called since we're in read-only mode

def save_database(data: Dict[str, Any]):
    """
    This function is kept for compatibility but will not write to the file.
    We're using ml.json in read-only mode.
    """
    logger.warning("Attempted to save to database, but ml.json is being used in read-only mode. No changes were made.")
    return

def reset_database():
    """
    This function is kept for compatibility but will not reset the database.
    We're using ml.json in read-only mode.
    """
    logger.warning("Attempted to reset database, but ml.json is being used in read-only mode. No changes were made.")
    return

def initialize_database():
    """
    Check if the ml.json file exists, but don't create or modify it.
    """
    if os.path.exists(DB_FILE):
        logger.info(f"Database file {DB_FILE} found and will be used in read-only mode.")
    else:
        logger.error(f"Database file {DB_FILE} not found. Please ensure it exists.")

# Initialize database check on module import
initialize_database()

def add_person(description_json: Dict[str, Any], metadata: Dict[str, Any] = None):
    """
    This function is kept for compatibility but will not add to the database.
    We're using ml.json in read-only mode.
    """
    logger.warning("Attempted to add person to database, but ml.json is being used in read-only mode. No changes were made.")
    
    # Generate a fake ID to return for API compatibility
    return str(uuid.uuid4())

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