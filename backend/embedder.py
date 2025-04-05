# embedder.py

import google.generativeai as genai
import json
import os
from dotenv import load_dotenv
from PIL import Image
import io
import numpy as np

# Load environment variables
load_dotenv()

# Gemini API setup
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY not found in environment variables")
genai.configure(api_key=GEMINI_API_KEY)

# Model - using flash-lite for faster responses
model = genai.GenerativeModel("gemini-2.0-flash-lite")

# Prompts
STRUCTURED_JSON_PROMPT = """
Describe this person in structured JSON format with the following keys:
- gender (male, female, other)
- age_group (child, teen, adult, senior)
- ethnicity (if visible/apparent)
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

Respond with ONLY a valid JSON object, nothing else. Include only the attributes you can confidently identify.
"""

EMBEDDING_PROMPT = """
Convert the following description into a semantic representation that captures the key features for similarity matching.
Focus on attributes like gender, age, clothing, colors, and distinctive features.
Keep your response focused and concise.

Description: {}

Respond with a concise list of key features, one per line.
"""

def describe_person(pil_image):
    """Generate a structured JSON description of a person."""
    try:
        res = model.generate_content([STRUCTURED_JSON_PROMPT, pil_image])
        raw = res.text.strip().replace("```json", "").replace("```", "")
        return json.loads(raw)
    except Exception as e:
        print(f"⚠️ Error describing person: {str(e)}")
        return None

def _get_semantic_features(text):
    """Get semantic features using Gemini model."""
    try:
        prompt = EMBEDDING_PROMPT.format(text)
        response = model.generate_content(prompt)
        features = response.text.strip().split('\n')
        return features
    except Exception as e:
        print(f"⚠️ Error getting semantic features: {str(e)}")
        return []

def _features_to_embedding(features):
    """Convert features to a fixed-size embedding."""
    # Create a deterministic embedding from features
    combined = '|'.join(sorted(features))
    hash_value = hash(combined)
    embedding = np.zeros(768)
    for i in range(768):
        embedding[i] = ((hash_value + i) % 1000) / 1000.0
    return embedding

def embed_description(json_obj):
    """Convert JSON object to embedding using semantic features."""
    try:
        # Convert JSON to text description
        text = json.dumps(json_obj)
        # Get semantic features
        features = _get_semantic_features(text)
        # Convert to embedding
        return _features_to_embedding(features)
    except Exception as e:
        print(f"⚠️ Error embedding description: {str(e)}")
        # Fallback to basic hash
        return _features_to_embedding([str(json_obj)])

def embed_image(image):
    """Convert image to embedding using semantic features."""
    try:
        if isinstance(image, str):
            image = Image.open(image)
        elif isinstance(image, bytes):
            image = Image.open(io.BytesIO(image))
        
        # Get description first
        description = describe_person(image)
        if description:
            return embed_description(description)
        
        # Fallback to basic image hash if description fails
        buffered = io.BytesIO()
        image.save(buffered, format="JPEG")
        img_bytes = buffered.getvalue()
        return _features_to_embedding([str(hash(img_bytes))])
    except Exception as e:
        print(f"⚠️ Error embedding image: {str(e)}")
        return np.random.rand(768)

def embed_text(text):
    """Convert text to embedding using semantic features."""
    try:
        features = _get_semantic_features(text)
        return _features_to_embedding(features)
    except Exception as e:
        print(f"⚠️ Error embedding text: {str(e)}")
        return _features_to_embedding([text])
