# db.py

import chromadb
import uuid
import json
import os
from dotenv import load_dotenv
import base64

# Setup persistent ChromaDB client
load_dotenv()

# Initialize ChromaDB client with persistent storage
client = chromadb.PersistentClient(path="chroma_storage")

# Get or create the collection
collection = client.get_or_create_collection(
    name="people",
    metadata={"hnsw:space": "cosine"}
)

def reset_collection():
    """Reset the ChromaDB collection (for debugging/testing)."""
    client.delete_collection("people")
    return client.get_or_create_collection(
        name="people",
        metadata={"hnsw:space": "cosine"}
    )

def add_person(embedding, description_json, metadata={}):
    """Add a person to ChromaDB."""
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

    # Prepare metadata for ChromaDB
    chroma_metadata = {
        "gender": description_json.get("gender", ""),
        "age_group": description_json.get("age_group", ""),
        "track_id": metadata.get("track_id", -1),
        "frame": metadata.get("frame", -1),
        "image_path": metadata.get("image_path", "")
    }
    
    # Add to ChromaDB
    collection.add(
        embeddings=[embedding],
        documents=[json.dumps(description_json)],
        metadatas=[chroma_metadata],
        ids=[uid]
    )

def search_people(query_embedding, n=3):
    """Search for similar people in ChromaDB."""
    # Query ChromaDB
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=n
    )
    
    # Return the raw results for compatibility with search.py
    return results