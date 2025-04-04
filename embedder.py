# embedder.py

import google.generativeai as genai
from chromadb.utils import embedding_functions
import json
import os
from dotenv import load_dotenv
from PIL import Image
import io

# Load environment variables
load_dotenv()

# Gemini API setup
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
genai.configure(api_key=GEMINI_API_KEY)

# Models
gemini_vision = genai.GenerativeModel("gemini-2.0-flash-lite")
embed_model = embedding_functions.GoogleGenerativeAiEmbeddingFunction(api_key=GEMINI_API_KEY)

# Prompt to generate structured appearance info
STRUCTURED_JSON_PROMPT = """
Describe this person in structured JSON format with the following keys:
- gender (male, female, other)
- age_group (child, teen, adult, senior)
- clothing_top (shirt, hoodie, etc.)
- clothing_color (top color)
- clothing_bottom (jeans, pants, skirt, etc.)
- accessories (bag, hat, etc.)

Respond with ONLY a valid JSON object, nothing else.
"""


def describe_person(pil_image):
    """Generate a structured JSON description of a person."""
    res = gemini_vision.generate_content([STRUCTURED_JSON_PROMPT, pil_image])
    raw = res.text.strip().replace("```json", "").replace("```", "")
    try:
        return json.loads(raw)
    except:
        print("⚠️ Gemini failed to parse JSON:")
        print(raw)
        return None


def embed_description(json_obj):
    """Convert JSON object to embedding using Google embedding model."""
    text = json.dumps(json_obj)
    return embed_model([text])[0]  # returns vector


def embed_image(image):
    """Convert image to embedding using Google embedding model."""
    if isinstance(image, str):
        # If image is a path, load it
        image = Image.open(image)
    elif isinstance(image, bytes):
        # If image is bytes, convert to PIL Image
        image = Image.open(io.BytesIO(image))
    
    # Convert image to base64 for embedding
    buffered = io.BytesIO()
    image.save(buffered, format="JPEG")
    img_str = buffered.getvalue()
    
    # Get embedding
    return embed_model([img_str])[0]


def embed_text(text):
    """Convert text to embedding using Google embedding model."""
    return embed_model([text])[0]
