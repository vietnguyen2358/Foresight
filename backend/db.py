# db.py

import chromadb
import uuid
import json
import os
from dotenv import load_dotenv
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
# Setup persistent ChromaDB client
load_dotenv()
password = (os.getenv("DB_PASS"))
uri = f"mongodb+srv://localmatt:{password}@sfhacks.xbqsdad.mongodb.net/?appName=SFHacks"

client = MongoClient(uri, server_api=ServerApi('1'))

# Send a ping to confirm a successful connection
try:
    client.admin.command('ping')
    print("Pinged your deployment. You successfully connected to MongoDB!")
except Exception as e:
    print(e)

# Use the 'people' collection in MongoDB
db = client['sfhacks']
collection = db['people']

def reset_collection():
    """Reset the MongoDB collection (for debugging/testing)."""
    collection.drop()
    return collection

def add_person(embedding, description_json, metadata={}):
    """Add a person to MongoDB."""
    uid = str(uuid.uuid4())
    
    # Handle image storage
    if "image_path" not in metadata and "image" in metadata:
        image_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
        os.makedirs(image_dir, exist_ok=True)
        image_path = os.path.join(image_dir, f"{uid}.jpg")
        
        if isinstance(metadata["image"], bytes):
            with open(image_path, "wb") as f:
                f.write(metadata["image"])
        else:
            metadata["image"].save(image_path)
        
        metadata["image_path"] = image_path

    # Prepare document for MongoDB
    document = {
        "_id": uid,
        "embedding": embedding,
        "description": description_json,
        "metadata": {
            "gender": description_json.get("gender", ""),
            "age_group": description_json.get("age_group", ""),
            "track_id": metadata.get("track_id", -1),
            "frame": metadata.get("frame", -1),
            "image_path": metadata.get("image_path", "")
        }
    }
    
    collection.insert_one(document)

import math
import base64

def cosine_similarity(vec1, vec2):
    """Compute cosine similarity between two lists."""
    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    magnitude1 = math.sqrt(sum(a * a for a in vec1))
    magnitude2 = math.sqrt(sum(b * b for b in vec2))
    if magnitude1 == 0 or magnitude2 == 0:
        return 0.0
    return dot_product / (magnitude1 * magnitude2)

def search_people(query_embedding, n=3):
    people = list(collection.find({}))
    results = []

    for person in people:
        person_embedding = person['embedding']
        sim = cosine_similarity(query_embedding, person_embedding)
        sim_percentage = round(sim * 100, 1)

        # Load and encode image
        image_path = person["metadata"].get("image_path", "")
        try:
            with open(image_path, "rb") as img_file:
                encoded_img = base64.b64encode(img_file.read()).decode("utf-8")
        except Exception:
            encoded_img = None  # If image path is bad or file is missing

        results.append({
            "description": person["description"],
            "similarity": sim * 100,
            "similarity_percentage": f"{sim_percentage}%",
            "processed_image": encoded_img
        })

    # Sort results by similarity and get top N
    top_matches = sorted(results, key=lambda x: x["similarity"], reverse=True)[:n]

    return {
        "query": "find someone",
        "matches": top_matches,
        "count": len(top_matches)
    }