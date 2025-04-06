"""
MongoDB Test Script - Add "Mizan was here" entry
"""

from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from dotenv import load_dotenv
import os
import uuid
from datetime import datetime

# Load environment variables
load_dotenv()

# Get MongoDB password from environment
password = os.getenv("DB_PASS")
if not password:
    print("ERROR: DB_PASS environment variable not found or empty")
    exit(1)

# MongoDB Connection Setup
uri = f"mongodb+srv://vietnguyen2358:{password}@cluster0.sysyjal.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"

# Create a new client and connect to the server
print("Connecting to MongoDB...")
client = MongoClient(uri, server_api=ServerApi('1'))

# Send a ping to confirm a successful connection
try:
    client.admin.command('ping')
    print("✅ Successfully connected to MongoDB!")
except Exception as e:
    print(f"❌ Failed to connect to MongoDB: {e}")
    exit(1)

# Setup database and collection for Mizan's entry
db = client['foresight_db']  # Main database name
collection = db['mizan_was_here']  # Special collection name

# Create Mizan's entry
mizan_doc = {
    "id": str(uuid.uuid4()),
    "message": "Mizan was here",
    "timestamp": datetime.now().isoformat(),
    "details": {
        "project": "Foresight",
        "branch": "mongo",
        "date": datetime.now().strftime("%Y-%m-%d"),
        "time": datetime.now().strftime("%H:%M:%S")
    }
}

# Insert the document
try:
    result = collection.insert_one(mizan_doc)
    
    if result.acknowledged:
        print(f"✅ Successfully added 'Mizan was here' entry with ID: {mizan_doc['id']}")
        print("\nYou can find this in the MongoDB Atlas UI at:")
        print("1. Go to https://cloud.mongodb.com")
        print("2. Sign in and select your cluster (Cluster0)")
        print("3. Click on 'Browse Collections'")
        print("4. Look for database 'foresight_db'")
        print("5. Look for collection 'mizan_was_here'")
        print("6. You'll see your entry with message 'Mizan was here'")
    else:
        print("❌ Write operation not acknowledged")
except Exception as e:
    print(f"❌ Write operation failed: {e}")

print("\nTest Complete!") 