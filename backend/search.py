# search.py

import json
import google.generativeai as genai
from chromadb.utils import embedding_functions
from db import search_people
import os
from dotenv import load_dotenv
import base64
from PIL import Image

# Load environment variables
load_dotenv()

# Gemini setup
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-2.0-flash-lite")

# Embedder
embedder = embedding_functions.GoogleGenerativeAiEmbeddingFunction(api_key=GEMINI_API_KEY)

# Prompt for Gemini
QUERY_PROMPT_TEMPLATE = """
You are helping an AI vision system identify people.

Convert the following sentence into structured JSON with these attributes:
- gender (male, female, other)
- age_group (child, teen, adult, senior)
- ethnicity (if mentioned)
- skin_tone (light, medium, dark, etc.)
- hair_style (short, long, curly, straight, bald, etc.)
- hair_color (black, brown, blonde, red, gray, etc.)
- facial_features (beard, mustache, glasses, etc.)
- clothing_top (shirt, hoodie, t-shirt, jacket, etc.)
- clothing_top_color (primary color of top)
- clothing_top_pattern (solid, striped, plaid, floral, etc.)
- clothing_bottom (jeans, pants, skirt, shorts, etc.)
- clothing_bottom_color (primary color of bottom)
- clothing_bottom_pattern (solid, striped, plaid, etc.)
- footwear (sneakers, boots, sandals, etc.)
- footwear_color (primary color of shoes)
- accessories (bag, hat, jewelry, etc.)
- bag_type (backpack, handbag, shoulder bag, etc.)
- bag_color (primary color of bag)
- pose (standing, sitting, walking, etc.)
- location_context (indoor, outdoor, etc.)

Extract as much detail as possible from the description. If an attribute is not mentioned, omit it from the JSON.

Sentence: "{}"

Respond with ONLY a valid JSON object.
"""


def query_to_structured_json(description: str):
    prompt = QUERY_PROMPT_TEMPLATE.format(description)
    res = model.generate_content(prompt, generation_config={"temperature": 0.3})
    raw = res.text.strip().replace("```json", "").replace("```", "")
    try:
        return json.loads(raw)
    except:
        print("⚠️ Could not parse Gemini response.")
        print(raw)
        return None


def find_similar_people(user_description: str, top_k=3):
    """Find similar people based on text description."""
    try:
        # Convert query to structured JSON
        json_query = query_to_structured_json(user_description)
        if not json_query:
            print("⚠️ Could not parse query into structured JSON")
            return []

        # Get embedding for query
        query_string = json.dumps(json_query)
        query_vector = embedder([query_string])[0]

        # Search database
        results = search_people(query_vector, n=top_k)
        
        # Check if we got any results
        if not results or not results["documents"] or len(results["documents"][0]) == 0:
            print("⚠️ No matches found in database")
            return []

        # Process matches
        matches = []
        for doc, metadata, distance in zip(results["documents"][0], results["metadatas"][0], results["distances"][0]):
            try:
                # Convert distance to similarity score (0-100%)
                similarity = max(0, min(100, (1 - distance) * 100))
                
                # Get image data if available
                image_data = None
                if "image_path" in metadata and os.path.exists(metadata["image_path"]):
                    try:
                        with open(metadata["image_path"], "rb") as img_file:
                            image_data = base64.b64encode(img_file.read()).decode('utf-8')
                    except Exception as e:
                        print(f"⚠️ Error loading image {metadata['image_path']}: {e}")
                
                # Parse description
                try:
                    description = json.loads(doc)
                except json.JSONDecodeError:
                    print("⚠️ Error parsing description JSON")
                    description = {}
                
                matches.append({
                    "description": description,
                    "metadata": metadata,
                    "similarity": similarity,
                    "image_data": image_data
                })
            except Exception as e:
                print(f"⚠️ Error processing match: {e}")
                continue

        return matches
    except Exception as e:
        print(f"⚠️ Error in find_similar_people: {e}")
        return []
