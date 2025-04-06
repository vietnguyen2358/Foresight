import os
import google.generativeai as genai
from PIL import Image
from dotenv import load_dotenv
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Configure Gemini
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY not found in environment variables")
genai.configure(api_key=GEMINI_API_KEY)

# Use gemini-1.5-pro model for better vision capabilities
model = genai.GenerativeModel("gemini-1.5-pro")

VISION_PROMPT = """
Analyze this image of a person and describe them in detail. Provide the following attributes in JSON format:

- gender (male, female, other)
- age_group (child, teen, adult, senior)
- hair_style (short, long, curly, straight, bald, etc.)
- hair_color (black, brown, blonde, red, gray, etc.)
- skin_tone (if visible)
- facial_features (beard, mustache, glasses, etc.)
- clothing_top (shirt, hoodie, t-shirt, jacket, etc.)
- clothing_top_color (primary color of top)
- clothing_top_pattern (solid, striped, plaid, etc.)
- clothing_bottom (jeans, pants, skirt, shorts, etc.)
- clothing_bottom_color (primary color of bottom)
- clothing_bottom_pattern (solid, striped, plaid, etc.)
- accessories (bag, hat, jewelry, etc.)
- bag_type (backpack, handbag, shoulder bag, etc.)
- bag_color (primary color of bag)
- pose (standing, sitting, walking, etc.)
- location_context (indoor, outdoor, etc.)

Be as specific and accurate as possible. If you can't determine an attribute with confidence, omit it from the response.
Return ONLY a JSON object with these fields and nothing else.
"""

def describe_person(image: Image.Image) -> dict:
    """
    Takes a PIL Image of a person and returns a description using Gemini.
    
    Args:
        image: PIL Image object of a person
        
    Returns:
        dict: Description of the person with attributes like gender, age, clothing, etc.
    """
    try:
        logger.info("Generating description for person image")
        
        # Generate content with Gemini using the image
        response = model.generate_content([VISION_PROMPT, image])
        
        # Clean up the response text
        response_text = response.text.strip()
        
        # Handle markdown code blocks if present
        if response_text.startswith("```json"):
            response_text = response_text[7:]  # Remove ```json prefix
        if response_text.endswith("```"):
            response_text = response_text[:-3]  # Remove ``` suffix
        
        # Convert response to dictionary
        import json
        try:
            description = json.loads(response_text.strip())
            logger.info(f"Successfully generated description with {len(description)} attributes")
            return description
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing JSON response: {e}")
            logger.error(f"Response text: {response_text}")
            # Fallback to a basic description
            return {
                "gender": "unknown",
                "age_group": "unknown",
                "clothing_top": "unknown",
                "clothing_bottom": "unknown"
            }
            
    except Exception as e:
        logger.error(f"Error generating description with Gemini: {e}")
        # Return a minimal fallback description
        return {
            "gender": "unknown",
            "age_group": "unknown",
            "error": str(e)
        } 