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
    
    # Process results to match the format expected by the frontend
    processed_results = []
    for doc, metadata, distance in zip(results["documents"][0], results["metadatas"][0], results["distances"][0]):
        try:
            # Convert distance to similarity score (0-100%)
            similarity = max(0, min(100, (1 - distance) * 100))
            
            # Load and encode image
            image_data = None
            image_path = metadata.get("image_path", "")
            if image_path and os.path.exists(image_path):
                try:
                    with open(image_path, "rb") as img_file:
                        image_data = base64.b64encode(img_file.read()).decode("utf-8")
                except Exception as e:
                    print(f"Error loading image {image_path}: {e}")
            
            # Parse description
            try:
                description = json.loads(doc)
            except json.JSONDecodeError:
                print("Error parsing description JSON")
                description = {}
            
            processed_results.append({
                "description": description,
                "similarity": similarity,
                "image_data": image_data
            })
        except Exception as e:
            print(f"Error processing result: {e}")
            continue
    
    # Return in the format expected by the frontend
    return {
        "query": "find someone",
        "matches": processed_results,
        "count": len(processed_results)
    }