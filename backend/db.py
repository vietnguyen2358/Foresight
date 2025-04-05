# db.py

import base64
import uuid
import numpy as np
import os
import json
from dotenv import load_dotenv
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from pymongo.errors import OperationFailure

# Setup MongoDB access uri
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


def to_serializable(obj):
    if isinstance(obj, dict):
        return {k: to_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [to_serializable(v) for v in obj]
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, (np.integer, np.floating)):
        return obj.item()
    else:
        return obj


def add_person(embedding, description_json, metadata={}):
    """Add a person to MongoDB."""
    uid = str(uuid.uuid4())

    if isinstance(embedding, np.ndarray):
        embedding = embedding.tolist()

    description_json = to_serializable(description_json)
    metadata = to_serializable(metadata)

    document = {
        "_id": uid,
        "embedding": embedding,
    }

    # Handle image storage
    if "image_path" not in metadata and "image" in metadata:
        image_dir = os.path.join(os.path.dirname(
            os.path.abspath(__file__)), "uploads")
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
        "documents": description_json,
        "metadata": {
            "gender": description_json.get("gender", ""),
            "age_group": description_json.get("age_group", ""),
            "track_id": metadata.get("track_id", -1),
            "frame": metadata.get("frame", -1),
            "image_path": metadata.get("image_path", "")
        }
    }

    collection.insert_one(document)


def search_people(query_embedding, n=3):
    # Ensure the embedding is a list of floats
    query_embedding = [float(x) for x in query_embedding]

    try:
        pipeline = [
            {
                "$vectorSearch": {
                    "index": "embedding_index",
                    "queryVector": query_embedding,
                    "path": "embedding",
                    "numCandidates": 100,
                    "limit": n,
                    "similarity": "cosine"
                }
            }
        ]

        results = list(collection.aggregate(pipeline))

        documents = []
        metadatas = []
        distances = []

        for person in results:
            description = person.get("documents", {})
            metadata = person.get("metadata", {})
            score = person.get("score", 0)
            distance = 1 - score  # similarity → distance

            # Load image data
            image_path = metadata.get("image_path", "")
            image_data = None
            if image_path and os.path.exists(image_path):
                try:
                    with open(image_path, "rb") as img_file:
                        image_data = base64.b64encode(img_file.read()).decode("utf-8")
                except Exception as e:
                    print(f"⚠️ Failed to load image: {e}")

            # Prepare fields
            documents.append(json.dumps(description))
            metadatas.append({
                **metadata,
                "image_data": image_data
            })
            distances.append(distance)

        return {
            "documents": [documents],
            "metadatas": [metadatas],
            "distances": [distances]
        }

    except OperationFailure as e:
        print(f"❌ MongoDB OperationFailure: {e}")
        return {"documents": [[]], "metadatas": [[]], "distances": [[]]}
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return {"documents": [[]], "metadatas": [[]], "distances": [[]]}