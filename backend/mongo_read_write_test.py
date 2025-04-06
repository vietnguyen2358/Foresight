"""
MongoDB Read & Write Test

This script demonstrates both reading from and writing to MongoDB.
"""

from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from dotenv import load_dotenv
import os
import uuid
import json
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

# Setup database and collection
db = client['foresight_db']
collection = db['read_write_test']

print("\n--- WRITING TO MONGODB ---")

# Create a new document to insert
write_doc = {
    "id": str(uuid.uuid4()),
    "operation": "write_test",
    "timestamp": datetime.now().isoformat(),
    "message": "This is a write test",
    "random_number": uuid.uuid4().int % 1000,  # Random number between 0-999
    "test_data": {
        "boolean": True,
        "array": [1, 2, 3, 4, 5],
        "nested": {
            "key1": "value1",
            "key2": "value2"
        }
    }
}

# Insert the document
try:
    result = collection.insert_one(write_doc)
    if result.acknowledged:
        print(f"✅ Successfully wrote document with ID: {write_doc['id']}")
        print(f"   Random number generated: {write_doc['random_number']}")
    else:
        print("❌ Write operation not acknowledged")
except Exception as e:
    print(f"❌ Write operation failed: {e}")
    exit(1)

print("\n--- READING FROM MONGODB ---")

# Read the document we just inserted
try:
    # First, let's read our specific document
    read_doc = collection.find_one({"id": write_doc['id']})
    
    if read_doc:
        # Remove MongoDB _id for display
        if "_id" in read_doc:
            del read_doc["_id"]
            
        print("✅ Successfully read back the document we just wrote:")
        print(f"   ID: {read_doc['id']}")
        print(f"   Message: {read_doc['message']}")
        print(f"   Random Number: {read_doc['random_number']}")
        print(f"   Timestamp: {read_doc['timestamp']}")
    else:
        print(f"❌ Could not find the document we just wrote with ID: {write_doc['id']}")
        
    # Now, let's also read the 'mizan_was_here' entry from earlier
    print("\n--- READING 'MIZAN WAS HERE' ENTRIES ---")
    mizan_collection = db['mizan_was_here']
    mizan_entries = list(mizan_collection.find({}, {'_id': 0}).sort('timestamp', -1).limit(5))
    
    if mizan_entries:
        print(f"✅ Found {len(mizan_entries)} 'Mizan was here' entries:")
        for i, entry in enumerate(mizan_entries, 1):
            print(f"\n   Entry #{i}:")
            print(f"   - ID: {entry.get('id', 'N/A')}")
            print(f"   - Message: {entry.get('message', 'N/A')}")
            print(f"   - Timestamp: {entry.get('timestamp', 'N/A')}")
            if 'details' in entry:
                print(f"   - Project: {entry['details'].get('project', 'N/A')}")
                print(f"   - Date: {entry['details'].get('date', 'N/A')}")
    else:
        print("❓ No 'Mizan was here' entries found. Did you run mizan_test.py first?")
    
except Exception as e:
    print(f"❌ Read operation failed: {e}")

print("\n--- CLEANING UP ---")

# Delete the test document we created (but keep Mizan's entries for reference)
try:
    delete_result = collection.delete_one({"id": write_doc['id']})
    if delete_result.deleted_count == 1:
        print("✅ Successfully deleted test document")
    else:
        print("❌ Delete operation didn't remove any documents")
except Exception as e:
    print(f"❌ Delete operation failed: {e}")

print("\n--- TEST COMPLETE ---")
print("MongoDB read and write test completed successfully!")
print("\nYou can view all data in MongoDB Atlas at https://cloud.mongodb.com") 