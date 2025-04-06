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
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# MongoDB Connection Setup
password = os.getenv("DB_PASS")
uri = f"mongodb+srv://vietnguyen2358:{password}@cluster0.sysyjal.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"

# Create a new client and connect to the server
client = MongoClient(uri, server_api=ServerApi('1'))

# Database and collection setup
db = client['foresight_db']
people_collection = db['people']

# Local storage for uploads
UPLOADS_DIR = "uploads"

# Ensure uploads directory exists
os.makedirs(UPLOADS_DIR, exist_ok=True)

# Optional - Keep the JSON file path for backward compatibility
DB_FILE = "ml.json"

def initialize_database():
    """
    Initialize MongoDB connection and verify it's working.
    """
    try:
        # Send a ping to confirm a successful connection
        client.admin.command('ping')
        logger.info("Pinged your deployment. Successfully connected to MongoDB!")
        
        # Create indexes if needed
        people_collection.create_index([("id", 1)], unique=True)
        logger.info("Database indexes created or verified")
        
        # Log the current count of documents
        count = people_collection.count_documents({})
        logger.info(f"Current database contains {count} people records")
        
        return True
    except Exception as e:
        logger.error(f"MongoDB connection error: {e}")
        return False

# Initialize database on module import
db_initialized = initialize_database()

def load_database() -> Dict[str, Any]:
    """Load the database from MongoDB."""
    try:
        if not db_initialized:
            logger.error("Database not initialized, cannot load data")
            return {"people": []}
            
        # Fetch all people documents
        people = list(people_collection.find({}, {'_id': 0}))
        logger.info(f"Database loaded successfully from MongoDB with {len(people)} people")
        
        return {"people": people}
    except Exception as e:
        logger.error(f"Error loading database from MongoDB: {str(e)}")
        return {"people": []}

def save_database(data: Dict[str, Any]):
    """
    This function is kept for compatibility but is a no-op with MongoDB,
    since documents are saved individually with add_person.
    """
    logger.info("save_database called - this is a no-op with MongoDB as documents are saved individually")
    return

def reset_database():
    """Reset the MongoDB collection."""
    try:
        if not db_initialized:
            logger.error("Database not initialized, cannot reset")
            return
            
        # Drop the collection
        people_collection.delete_many({})
        logger.info("Database reset successfully")
        return
    except Exception as e:
        logger.error(f"Error resetting database: {str(e)}")
        return

def add_person(description_json: Dict[str, Any], metadata: Dict[str, Any] = None):
    """
    Add a person to the MongoDB database.
    Returns the ID of the inserted document.
    """
    try:
        if not db_initialized:
            logger.error("Database not initialized, cannot add person")
            return str(uuid.uuid4())  # Return a random ID for compatibility
        
        # Generate a unique ID
        person_id = str(uuid.uuid4())
        
        # Handle the image if present in metadata
        image_path = None
        if metadata and 'image' in metadata:
            # Save the image to disk
            if hasattr(metadata['image'], 'save'):  # Check if it's a PIL Image
                # Create a unique filename
                filename = f"{person_id}.jpg"
                file_path = os.path.join(UPLOADS_DIR, filename)
                
                # Save the image
                metadata['image'].save(file_path)
                
                # Update metadata with image path
                image_path = file_path
                
                # Remove the PIL image from metadata as it's not JSON serializable
                metadata_copy = metadata.copy()
                metadata_copy.pop('image')
                metadata = metadata_copy
                
                # Add image path to metadata
                metadata['image_path'] = image_path
        
        # Create the document
        person_doc = {
            "id": person_id,
            "description": description_json,
            "metadata": metadata or {},
            "timestamp": datetime.now().isoformat()
        }
        
        # Insert into MongoDB
        people_collection.insert_one(person_doc)
        logger.info(f"Added person to MongoDB with ID: {person_id}")
        
        return person_id
    except Exception as e:
        logger.error(f"Error adding person to MongoDB: {str(e)}")
        return str(uuid.uuid4())  # Return a random ID for compatibility

def cosine_similarity(a: List[float], b: List[float]) -> float:
    """Calculate cosine similarity between two vectors."""
    a = np.array(a)
    b = np.array(b)
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def search_people(query_embedding: List[float], n: int = 3) -> Dict[str, Any]:
    """Search for similar people in the MongoDB database."""
    try:
        if not db_initialized:
            logger.error("Database not initialized, cannot search")
            return {"query": "find someone", "matches": [], "count": 0}
        
        # Get all people documents
        people = list(people_collection.find({}, {'_id': 0}))
        
        # Calculate similarities
        similarities = []
        for person in people:
            # Check if the person has an embedding
            if "embedding" in person:
                similarity = cosine_similarity(query_embedding, person["embedding"])
                similarities.append((person, similarity))
            else:
                logger.warning(f"Person {person.get('id', 'unknown')} missing embedding, skipping")
        
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
                        logger.error(f"Error loading image {image_path}: {e}")
                
                processed_results.append({
                    "description": person["description"],
                    "metadata": person["metadata"],
                    "similarity": similarity_score,
                    "image_data": image_data
                })
            except Exception as e:
                logger.error(f"Error processing result: {e}")
                continue
        
        return {
            "query": "find someone",
            "matches": processed_results,
            "count": len(processed_results)
        }
    except Exception as e:
        logger.error(f"Error searching people in MongoDB: {str(e)}")
        return {"query": "find someone", "matches": [], "count": 0}

# Add function to get direct database reference (for use in other modules)
def get_db_reference():
    """Get reference to MongoDB database and collection"""
    if db_initialized:
        return db, people_collection
    return None, None