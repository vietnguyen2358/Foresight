# db.py

import chromadb
import uuid
import json
import os
from chromadb.utils import embedding_functions

# Setup persistent ChromaDB client
PERSIST_DIR = "./chroma_storage"
COLLECTION_NAME = "people"
chroma_client = chromadb.PersistentClient(path=PERSIST_DIR)

# Ensure collection exists
if COLLECTION_NAME in [c.name for c in chroma_client.list_collections()]:
    collection = chroma_client.get_collection(COLLECTION_NAME)
else:
    collection = chroma_client.create_collection(COLLECTION_NAME)

def reset_collection():
    """Reset the ChromaDB collection (for debugging/testing)."""
    chroma_client.delete_collection(COLLECTION_NAME)
    return chroma_client.create_collection(COLLECTION_NAME)


def add_person(embedding, description_json, metadata={}):
    """Add a person to the ChromaDB vector database."""
    uid = str(uuid.uuid4())
    
    # Add image path to metadata if available
    if "image_path" not in metadata and "image" in metadata:
        # Save the image to a file
        image_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
        os.makedirs(image_dir, exist_ok=True)
        image_path = os.path.join(image_dir, f"{uid}.jpg")
        
        # Save the image
        if isinstance(metadata["image"], bytes):
            with open(image_path, "wb") as f:
                f.write(metadata["image"])
        else:
            metadata["image"].save(image_path)
        
        metadata["image_path"] = image_path
    
    collection.add(
        ids=[uid],
        embeddings=[embedding],
        documents=[json.dumps(description_json)],
        metadatas=[{
            "gender": description_json.get("gender", ""),
            "age_group": description_json.get("age_group", ""),
            "track_id": metadata.get("track_id", -1),
            "frame": metadata.get("frame", -1),
            "image_path": metadata.get("image_path", ""),
        }]
    )


def search_people(query_embedding, n=3):
    """Search for similar people in ChromaDB."""
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=n,
        include=["documents", "metadatas", "distances"]
    )
    return results
