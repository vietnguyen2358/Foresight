# test_json_db.py

import os
from json_db import db
from embedder import embed_description, describe_person, embed_text
import json
from PIL import Image
import numpy as np
import google.generativeai as genai
from dotenv import load_dotenv

def test_json_db():
    print("\n=== Testing JSON Database Functionality ===\n")
    
    # 1. Reset and Initialize Database
    print("1. Testing database initialization...")
    db.reset_database()
    assert os.path.exists("people_db.json"), "❌ Database file not created"
    print("✅ Database initialized successfully")

    # 2. Test Writing to Database
    print("\n2. Testing writing to database...")
    test_person = {
        "gender": "male",
        "age_group": "adult",
        "clothing_top": "blue t-shirt",
        "clothing_bottom": "black pants"
    }
    
    # Create test embedding
    test_embedding = np.random.rand(768).tolist()
    
    # Add person to database
    person_id = db.add_person(
        embedding=test_embedding,
        description_json=test_person,
        metadata={"test": True}
    )
    
    # Verify person was added
    with open("people_db.json", 'r') as f:
        data = json.load(f)
        assert len(data["people"]) > 0, "❌ Person not added to database"
        assert data["people"][0]["description"] == test_person, "❌ Person data mismatch"
    print("✅ Successfully wrote to database")

    # 3. Test Reading from Database
    print("\n3. Testing reading from database...")
    search_results = db.search_people(test_embedding, n=1)
    assert search_results["matches"], "❌ No search results found"
    assert search_results["matches"][0]["description"] == test_person, "❌ Retrieved data mismatch"
    print("✅ Successfully read from database")

    # 4. Test AI Integration
    print("\n4. Testing AI integration...")
    
    # Test text embedding
    test_query = "Find someone wearing a blue shirt"
    try:
        text_embedding = embed_text(test_query)
        assert len(text_embedding) == 768, "❌ Text embedding dimension mismatch"
        print("✅ Text embedding generation working")
    except Exception as e:
        print(f"❌ Text embedding failed: {str(e)}")

    # Test description embedding
    try:
        desc_embedding = embed_description(test_person)
        assert len(desc_embedding) == 768, "❌ Description embedding dimension mismatch"
        print("✅ Description embedding generation working")
    except Exception as e:
        print(f"❌ Description embedding failed: {str(e)}")

    # 5. Test Search Functionality
    print("\n5. Testing search functionality...")
    try:
        # Search with the text embedding
        results = db.search_people(text_embedding, n=1)
        assert results["matches"], "❌ No search results found"
        print("✅ Search functionality working")
        
        # Print the top match details
        top_match = results["matches"][0]
        print(f"\nTop Match Details:")
        print(f"Similarity: {top_match['similarity']:.2f}%")
        print("Description:", json.dumps(top_match["description"], indent=2))
    except Exception as e:
        print(f"❌ Search test failed: {str(e)}")

    print("\n=== All tests completed! ===")

if __name__ == "__main__":
    # Load environment variables
    load_dotenv()
    
    # Configure Gemini
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
    if not GEMINI_API_KEY:
        raise ValueError("❌ GEMINI_API_KEY not found in environment variables")
    genai.configure(api_key=GEMINI_API_KEY)
    
    # Run tests
    test_json_db() 