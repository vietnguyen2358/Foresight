# search.py

import json
import google.generativeai as genai
from db import load_database
import os
from dotenv import load_dotenv
import base64
from PIL import Image
from typing import List, Dict, Any
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Gemini setup
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-2.0-flash-lite")

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

def query_to_structured_json(query: str) -> Dict[str, Any]:
    """Convert a natural language query to structured JSON."""
    try:
        # Extensive preprocessing
        query = query.lower().strip()
        
        # Record original query for logging
        original_query = query
        logger.info(f"Original query: {original_query}")
        
        # Expanded gender terms dictionary
        gender_terms = {
            'female': [
                'female', 'woman', 'girl', 'lady', 'women', 'girls', 'ladies', 
                'she', 'her', 'feminine', 'mom', 'mother', 'daughter', 'sister',
                'aunt', 'grandma', 'grandmother', 'wife'
            ],
            'male': [
                'male', 'man', 'boy', 'guy', 'men', 'boys', 'guys', 'he', 
                'him', 'his', 'masculine', 'dad', 'father', 'son', 'brother',
                'uncle', 'grandpa', 'grandfather', 'husband'
            ]
        }
        
        # Expanded clothing color dictionary
        colors = [
            "red", "blue", "green", "yellow", "orange", "purple", "pink", "brown", 
            "black", "white", "grey", "gray", "light blue", "dark blue", "navy", 
            "teal", "turquoise", "maroon", "burgundy", "beige", "tan", "cream", 
            "gold", "silver", "olive", "lime", "aqua", "cyan", "magenta", "violet"
        ]
        
        # Expanded clothing types dictionary
        clothing_types = {
            "top": [
                "hoodie", "shirt", "t-shirt", "t shirt", "tshirt", "sweater", "sweatshirt", 
                "jacket", "coat", "blazer", "blouse", "tank top", "vest", "jersey", 
                "polo", "cardigan", "dress shirt", "button-up", "button up", "top"
            ],
            "bottom": [
                "jeans", "pants", "shorts", "skirt", "trousers", "slacks", "leggings", 
                "sweatpants", "joggers", "khakis", "capris", "cargo pants", "chinos",
                "dress pants", "bottom"
            ],
            "footwear": [
                "shoes", "sneakers", "boots", "sandals", "heels", "flats", "loafers", 
                "slippers", "flip-flops", "flip flops", "running shoes", "tennis shoes", 
                "basketball shoes", "hiking boots", "dress shoes"
            ]
        }
        
        # Expanded accessories dictionary
        accessories = [
            "hat", "cap", "beanie", "glasses", "sunglasses", "backpack", "bag", 
            "handbag", "purse", "wallet", "watch", "bracelet", "necklace", "ring",
            "earrings", "scarf", "tie", "belt", "headband", "bandana", "mask"
        ]
        
        # Extract gender
        detected_gender = None
        for gender, terms in gender_terms.items():
            if any(f" {term} " in f" {query} " or query.startswith(f"{term} ") or query.endswith(f" {term}") or query == term for term in terms):
                detected_gender = gender
                # If gender isn't mentioned in a structured way, add it
                if not any(term in query for term in ["gender", "male", "female", "woman", "man"]):
                    query = f"Find a {gender} {query}"
                break
        
        # Handle "with" queries more broadly
        hair_colors = ['blonde', 'blond', 'black', 'brown', 'red', 'white', 'gray', 'grey', 'dark', 'light', 'brunette', 'redhead']
        hair_styles = ['long', 'short', 'curly', 'straight', 'wavy', 'bald', 'balding', 'buzz cut', 'pixie', 'ponytail', 'bun', 'braided']
        
        if "with" in query:
            parts = query.split("with")
            if len(parts) > 1:
                after_with = parts[1].strip()
                
                # Check for hair color and style patterns
                for color in hair_colors:
                    if color in after_with and "hair" in after_with:
                        query = f"Find a person with {color} hair {parts[0].strip()}"
                        break
                
                for style in hair_styles:
                    if style in after_with and "hair" in after_with:
                        query = f"Find a person with {style} hair {parts[0].strip()}"
                        break
        
        # Enhanced handling of "wearing" queries
        if "wearing" in query:
            parts = query.split("wearing")
            if len(parts) > 1:
                clothing_part = parts[1].strip()
                
                # Extract color information
                found_color = None
                for color in colors:
                    if f" {color} " in f" {clothing_part} " or clothing_part.startswith(f"{color} ") or clothing_part.endswith(f" {color}") or clothing_part == color:
                        found_color = color
                        break
                
                # Extract clothing type information
                found_type = None
                clothing_category = None
                
                # Check for all clothing categories
                for category, types in clothing_types.items():
                    for clothing_type in types:
                        if f" {clothing_type} " in f" {clothing_part} " or clothing_part.startswith(f"{clothing_type} ") or clothing_part.endswith(f" {clothing_type}") or clothing_part == clothing_type:
                            found_type = clothing_type
                            clothing_category = category
                            break
                    if found_type:
                        break
                
                # Create more specific structured queries
                if found_color and found_type:
                    if clothing_category == "top":
                        query = f"Find a person wearing a {found_color} {found_type} {parts[0].strip()}"
                    elif clothing_category == "bottom":
                        query = f"Find a person wearing {found_color} {found_type} {parts[0].strip()}"
                    elif clothing_category == "footwear":
                        query = f"Find a person wearing {found_color} {found_type} {parts[0].strip()}"
                elif found_color and "shirt" not in clothing_part and "pants" not in clothing_part:
                    # If only color is mentioned, assume it's a top
                    query = f"Find a person wearing a {found_color} shirt {parts[0].strip()}"
                elif found_type:
                    query = f"Find a person wearing a {found_type} {parts[0].strip()}"
        
        # Special handling for accessory queries
        for accessory in accessories:
            if f" {accessory} " in f" {query} " or query.startswith(f"{accessory} ") or query.endswith(f" {accessory}") or query == accessory:
                if "with" not in query:
                    query = f"Find a person with {accessory} {query}"
                break
        
        # Handle queries about facial hair
        facial_hair_terms = ['beard', 'mustache', 'moustache', 'goatee', 'stubble', 'clean-shaven', 'clean shaven']
        for term in facial_hair_terms:
            if f" {term} " in f" {query} " or query.startswith(f"{term} ") or query.endswith(f" {term}") or query == term:
                if "facial features" not in query:
                    query = f"Find a person with facial features including {term} {query}"
                break
        
        # Age-related handling
        age_terms = {
            'child': ['child', 'kid', 'young', 'little', 'small', 'toddler', 'baby'],
            'teen': ['teen', 'teenager', 'adolescent', 'youth'],
            'adult': ['adult', 'grown-up', 'grown up', 'mature', 'middle-aged', 'middle aged'],
            'senior': ['senior', 'elderly', 'old', 'older', 'aged', 'retired']
        }
        
        for age_group, terms in age_terms.items():
            if any(f" {term} " in f" {query} " or query.startswith(f"{term} ") or query.endswith(f" {term}") or query == term for term in terms):
                if "age_group" not in query and "age" not in query:
                    query = f"Find a person in age group {age_group} {query}"
                break
        
        # Handle location context
        location_terms = {
            'indoor': ['inside', 'indoor', 'indoors', 'in the building', 'in the room'],
            'outdoor': ['outside', 'outdoor', 'outdoors', 'in the street', 'on the street']
        }
        
        for context, terms in location_terms.items():
            if any(term in query for term in terms):
                if "location_context" not in query:
                    query = f"Find a person in {context} setting {query}"
                break
        
        logger.info(f"Processed query: {query}")
        
        # Format the prompt with the processed query
        prompt = QUERY_PROMPT_TEMPLATE.format(query)
        
        # Get response from Gemini
        response = model.generate_content(prompt)
        
        # Clean up the response text by removing markdown formatting
        response_text = response.text.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:]  # Remove ```json prefix
        if response_text.endswith("```"):
            response_text = response_text[:-3]  # Remove ``` suffix
        response_text = response_text.strip()
        
        # Parse the response as JSON
        try:
            result = json.loads(response_text)
            
            # If we detected a gender but it's not in the result, add it
            if detected_gender and ('gender' not in result or not result['gender']):
                result['gender'] = detected_gender
                logger.info(f"Added detected gender '{detected_gender}' to query result")
            
            logger.info(f"Structured JSON result: {result}")
            return result
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing JSON response: {e}")
            logger.error(f"Response text: {response_text}")
            
            # Fallback: If JSON parsing fails, attempt to extract key information directly
            fallback_result = {}
            
            # Add detected gender if available
            if detected_gender:
                fallback_result['gender'] = detected_gender
            
            # Extract any clothing colors mentioned
            for color in colors:
                if color in original_query:
                    if any(top in original_query for top in clothing_types['top']):
                        fallback_result['clothing_top_color'] = color
                    elif any(bottom in original_query for bottom in clothing_types['bottom']):
                        fallback_result['clothing_bottom_color'] = color
                    else:
                        fallback_result['clothing_top_color'] = color
            
            # Extract any clothing types mentioned
            for category, types in clothing_types.items():
                for clothing_type in types:
                    if clothing_type in original_query:
                        if category == 'top':
                            fallback_result['clothing_top'] = clothing_type
                        elif category == 'bottom':
                            fallback_result['clothing_bottom'] = clothing_type
                        elif category == 'footwear':
                            fallback_result['footwear'] = clothing_type
            
            logger.info(f"Using fallback JSON result: {fallback_result}")
            return fallback_result
    except Exception as e:
        logger.error(f"Error in query_to_structured_json: {e}")
        return {}

def calculate_similarity(query_json: Dict[str, Any], person_json: Dict[str, Any]) -> float:
    """Calculate similarity between query and person description."""
    try:
        # Define weights for different attributes - adjusted to improve matching priorities
        weights = {
            'gender': 4.0,  # Critical match - increased weight
            'age_group': 3.0,  # Very important match - increased weight
            'child_context': 1.5,
            'height_estimate': 1.0,
            'build_type': 1.0,
            'ethnicity': 1.2,
            'skin_tone': 1.2,
            'hair_style': 1.5,  # Increased importance
            'hair_color': 2.5,  # Increased importance
            'facial_features': 3.0,  # Key identifying feature
            'clothing_top': 2.5,  # Increased importance
            'clothing_top_color': 3.0,  # Increased importance as often mentioned
            'clothing_top_pattern': 1.2,
            'clothing_bottom': 2.0,  # Increased importance
            'clothing_bottom_color': 2.0,  # Increased importance
            'clothing_bottom_pattern': 1.0,
            'footwear': 1.2,
            'footwear_color': 1.0,
            'accessories': 1.5,  # Increased importance
            'bag_type': 1.0,
            'bag_color': 1.0,
            'pose': 0.8,  # Reduced as this can change
            'location_context': 0.8  # Reduced as this can change
        }
        
        # Define critical attributes that must match exactly when specified
        must_match_exact = [
            'facial_features',  # For glasses, beard, etc.
            'accessories',       # For specific accessories
            'clothing_top',      # For specific top clothing items
            'clothing_bottom'    # For specific bottom clothing items
        ]
        
        # Expanded color variations mapping
        color_variations = {
            'grey': ['grey', 'gray', 'silver', 'light gray', 'light grey', 'dark gray', 'dark grey', 'charcoal'],
            'gray': ['grey', 'gray', 'silver', 'light gray', 'light grey', 'dark gray', 'dark grey', 'charcoal'],
            'black': ['black', 'dark', 'jet black', 'midnight', 'ebony', 'onyx'],
            'white': ['white', 'light', 'cream', 'ivory', 'off-white', 'snow', 'pale'],
            'red': ['red', 'maroon', 'burgundy', 'crimson', 'scarlet', 'ruby', 'wine', 'cherry'],
            'blue': ['blue', 'navy', 'light blue', 'sky blue', 'azure', 'cobalt', 'indigo', 'royal blue', 'denim'],
            'green': ['green', 'olive', 'emerald', 'lime', 'forest green', 'mint', 'sage', 'teal'],
            'yellow': ['yellow', 'gold', 'amber', 'mustard', 'lemon', 'honey'],
            'brown': ['brown', 'tan', 'beige', 'khaki', 'chocolate', 'caramel', 'coffee', 'mocha', 'taupe'],
            'orange': ['orange', 'peach', 'coral', 'rust', 'amber', 'tangerine'],
            'purple': ['purple', 'violet', 'lavender', 'plum', 'magenta', 'lilac', 'mauve'],
            'pink': ['pink', 'salmon', 'coral', 'rose', 'fuchsia', 'blush', 'hot pink']
        }
        
        # Expanded gender variations mapping
        gender_variations = {
            'female': ['female', 'woman', 'girl', 'lady', 'women', 'girls', 'ladies', 'feminine'],
            'male': ['male', 'man', 'boy', 'guy', 'men', 'boys', 'guys', 'masculine'],
            'other': ['other', 'non-binary', 'nonbinary', 'transgender', 'trans', 'neutral']
        }
        
        # Expanded age group variations mapping
        age_group_variations = {
            'child': ['child', 'kid', 'children', 'kids', 'young', 'little', 'small', 'toddler', 'baby'],
            'teen': ['teen', 'teenager', 'adolescent', 'youth', 'young adult', 'juvenile'],
            'adult': ['adult', 'grown-up', 'grown up', 'mature', 'middle-aged', 'middle aged'],
            'senior': ['senior', 'elderly', 'old', 'older', 'aged', 'retired', 'elder']
        }
        
        # Check for specific critical terms that require exact matching
        critical_terms = {
            'glasses': 'facial_features',
            'beard': 'facial_features',
            'mustache': 'facial_features',
            'hat': 'accessories',
            'backpack': 'accessories',
            'hoodie': 'clothing_top',
            'jacket': 'clothing_top',
            'jeans': 'clothing_bottom'
        }
        
        # Check if any critical terms are present in the query
        strict_match_terms = {}
        for key in query_json:
            if key in must_match_exact and query_json[key]:
                query_val = str(query_json[key]).lower()
                
                # Extract specific terms that need exact matching
                for term, attr in critical_terms.items():
                    if term in query_val and attr == key:
                        strict_match_terms[term] = attr
                        logger.info(f"Found critical term '{term}' in {attr}. Will require exact match.")

        # First check strict match conditions
        for term, attr in strict_match_terms.items():
            # If the person doesn't have this attribute or it doesn't contain the term, return 0
            if attr not in person_json or term not in str(person_json[attr]).lower():
                logger.info(f"Critical term '{term}' not found in person's {attr}, returning 0 similarity")
                return 0
                
        # Child context variations mapping
        child_context_variations = {
            'with_parent': ['with parent', 'with parents', 'with mother', 'with father', 'with guardian', 'with family'],
            'with_guardian': ['with guardian', 'with caregiver', 'with adult', 'with supervisor'],
            'alone': ['alone', 'by themselves', 'independent', 'unaccompanied'],
            'playing': ['playing', 'engaged in play', 'playing with toys', 'playing with others'],
            'learning': ['learning', 'studying', 'reading', 'in class', 'at school'],
            'with_peers': ['with peers', 'with friends', 'with other children', 'in group']
        }
        
        # Expanded facial hair variations mapping
        facial_hair_variations = {
            'beard': ['beard', 'bearded', 'facial hair', 'facial-hair', 'full beard', 'has beard'],
            'mustache': ['mustache', 'moustache', 'stache', 'mustachio', 'has mustache'],
            'goatee': ['goatee', 'goatee beard', 'chin beard', 'has goatee'],
            'stubble': ['stubble', '5 o\'clock shadow', 'facial stubble', 'light beard', 'stubbled'],
            'clean-shaven': ['clean-shaven', 'clean shaven', 'no facial hair', 'no beard', 'cleanly shaven'],
            'beard_length': ['short beard', 'medium beard', 'long beard', 'full beard'],
            'beard_style': ['trimmed', 'neat', 'well-groomed', 'unkempt', 'messy'],
            'beard_color': ['black beard', 'brown beard', 'gray beard', 'white beard', 'colored beard']
        }
        
        # Expanded clothing types mapping for better matching
        clothing_top_variations = {
            'shirt': ['shirt', 'top', 'tee', 't-shirt', 'tshirt', 't shirt', 'button-up', 'button up', 'blouse'],
            'sweater': ['sweater', 'jumper', 'pullover', 'cardigan', 'sweatshirt'],
            'jacket': ['jacket', 'coat', 'blazer', 'windbreaker', 'outerwear', 'hoodie', 'hooded'],
            'hoodie': ['hoodie', 'hooded sweatshirt', 'hooded jacket', 'sweatshirt with hood'],
            'tank top': ['tank top', 'sleeveless top', 'camisole', 'vest'],
            'dress shirt': ['dress shirt', 'button-down', 'formal shirt', 'collared shirt', 'oxford'],
            'polo': ['polo', 'polo shirt', 'golf shirt', 'tennis shirt']
        }
        
        clothing_bottom_variations = {
            'jeans': ['jeans', 'denim', 'blue jeans', 'denim pants', 'denim trousers'],
            'pants': ['pants', 'trousers', 'slacks', 'khakis', 'chinos', 'bottoms'],
            'shorts': ['shorts', 'short pants', 'bermudas', 'short trousers'],
            'skirt': ['skirt', 'midi skirt', 'mini skirt', 'maxi skirt'],
            'leggings': ['leggings', 'tights', 'yoga pants', 'stretch pants'],
            'joggers': ['joggers', 'sweatpants', 'track pants', 'athletic pants']
        }
        
        # Pattern variations for better matching
        pattern_variations = {
            'solid': ['solid', 'plain', 'single color', 'no pattern', 'flat', 'uniform'],
            'striped': ['striped', 'stripes', 'lined', 'pinstriped', 'vertical stripes', 'horizontal stripes'],
            'plaid': ['plaid', 'checkered', 'checked', 'tartan', 'gingham'],
            'floral': ['floral', 'flowery', 'flower pattern', 'botanical'],
            'polka dot': ['polka dot', 'dotted', 'dots', 'spotted'],
            'graphic': ['graphic', 'printed', 'design', 'logo', 'text', 'image', 'picture']
        }
        
        weighted_matches = 0
        weighted_total = 0
        
        # Debug tracking for more detailed logs
        match_details = []
        
        # Check if the query contains child-related terms
        query_contains_child_terms = False
        if 'age_group' in query_json:
            query_age = str(query_json['age_group']).lower()
            if any(term in query_age for term in ['child', 'kid', 'children', 'kids']):
                query_contains_child_terms = True
        
        # Check if the person is a child
        person_is_child = False
        if 'age_group' in person_json:
            person_age = str(person_json['age_group']).lower()
            if person_age == 'child':
                person_is_child = True
        
        # Check if the query contains facial hair terms
        query_contains_facial_hair = False
        if 'facial_features' in query_json:
            query_features = str(query_json['facial_features']).lower()
            for feature, variations in facial_hair_variations.items():
                if any(term in query_features for term in variations):
                    query_contains_facial_hair = True
                    break
        
        # Check if the person has facial hair
        person_has_facial_hair = False
        if 'facial_features' in person_json:
            person_features = str(person_json['facial_features']).lower()
            for feature, variations in facial_hair_variations.items():
                if feature != 'clean-shaven' and any(term in person_features for term in variations):
                    person_has_facial_hair = True
                    break
        
        # If query contains facial hair terms but person doesn't have facial hair, return 0
        if query_contains_facial_hair and not person_has_facial_hair:
            logger.info(f"Query contains facial hair terms but person doesn't have facial hair")
            return 0
        
        # If query specifically contains "clean-shaven" but person has facial hair, return 0
        if 'facial_features' in query_json and 'clean-shaven' in str(query_json['facial_features']).lower() and person_has_facial_hair:
            logger.info(f"Query specifies clean-shaven but person has facial hair")
            return 0
        
        # Process each attribute in the query
        for key in query_json:
            if key in person_json:
                weight = weights.get(key, 1.0)
                weighted_total += weight
                
                # Get the values to compare
                query_val = str(query_json[key]).lower()
                person_val = str(person_json[key]).lower()
                
                # For attributes in must_match_exact, check if specific critical terms are included
                if key in must_match_exact:
                    # Extract all terms from the query value
                    query_terms = set()
                    for term in query_val.split(','):
                        query_terms.update(term.strip().split())
                    
                    # Check for critical terms in the query value
                    critical_found = False
                    for term in critical_terms:
                        if term in query_terms and critical_terms[term] == key:
                            critical_found = True
                            # If the term is not in the person's value, this is a strict mismatch
                            if term not in person_val:
                                logger.info(f"Critical term '{term}' from {key} not found in person's attributes")
                                return 0
                
                # Special handling for gender - strict matching
                if key == 'gender':
                    # Check for exact match first
                    if query_val == person_val:
                        weighted_matches += weight
                        match_details.append(f"Exact match on gender: {query_val} = {person_val}, +{weight}")
                    else:
                        # Check for variations
                        query_genders = set([query_val])
                        person_genders = set([person_val])
                        
                        # Add variations
                        for base_gender, variations in gender_variations.items():
                            if base_gender in query_val or any(var == query_val for var in variations):
                                query_genders.update(variations)
                                query_genders.add(base_gender)
                            if base_gender in person_val or any(var == person_val for var in variations):
                                person_genders.update(variations)
                                person_genders.add(base_gender)
                        
                        # Check for matches including variations
                        if query_genders & person_genders:  # If there's any intersection
                            weighted_matches += weight
                            match_details.append(f"Match on gender with variations: {query_genders} ~ {person_genders}, +{weight}")
                        else:
                            match_details.append(f"No match on gender: {query_val} != {person_val}, +0")
                            # Return 0 similarity if gender doesn't match (strict matching)
                            return 0
                
                # Special handling for age_group - strict matching for child-related queries
                elif key == 'age_group':
                    # Check for exact match first
                    if query_val == person_val:
                        weighted_matches += weight
                        match_details.append(f"Exact match on age_group: {query_val} = {person_val}, +{weight}")
                    else:
                        # Check for variations
                        query_ages = set([query_val])
                        person_ages = set([person_val])
                        
                        # Add variations
                        for base_age, variations in age_group_variations.items():
                            if base_age in query_val or any(var == query_val for var in variations):
                                query_ages.update(variations)
                                query_ages.add(base_age)
                            if base_age in person_val or any(var == person_val for var in variations):
                                person_ages.update(variations)
                                person_ages.add(base_age)
                        
                        # Check for matches including variations
                        if query_ages & person_ages:  # If there's any intersection
                            weighted_matches += weight
                            match_details.append(f"Match on age_group with variations: {query_ages} ~ {person_ages}, +{weight}")
                        else:
                            # If query contains child-related terms and person is not a child, return 0
                            if query_contains_child_terms and not person_is_child:
                                match_details.append(f"Query contains child terms but person is not a child: {query_val} != {person_val}, +0")
                                return 0
                            # Check for partial matches with reduced weight
                            for query_age in query_ages:
                                for person_age in person_ages:
                                    if query_age in person_age or person_age in query_age:
                                        partial_match = weight * 0.7
                                        weighted_matches += partial_match
                                        match_details.append(f"Partial match on age_group: {query_age} ~ {person_age}, +{partial_match}")
                                        break
                
                # Special handling for clothing top
                elif key == 'clothing_top':
                    # If this is a must-match attribute and contains specific item, require exact match
                    exact_item_match_required = False
                    for term in clothing_top_variations:
                        if term in query_val:
                            exact_item_match_required = True
                            if term not in person_val:
                                logger.info(f"Specific clothing item '{term}' not found in person's top")
                                return 0
                    
                    # If no exact match required, proceed with normal matching
                    if not exact_item_match_required:
                        # Continue with standard clothing top matching logic
                        # ... (rest of the clothing_top matching code)
                        pass
                    
                    # Exact match
                    if query_val == person_val:
                        weighted_matches += weight
                        match_details.append(f"Exact match on clothing top: {query_val} = {person_val}, +{weight}")
                    # Categorical match
                    else:
                        # Check clothing categories
                        query_category = None
                        person_category = None
                        
                        for category, variations in clothing_top_variations.items():
                            if category in query_val or any(var in query_val for var in variations):
                                query_category = category
                            if category in person_val or any(var in person_val for var in variations):
                                person_category = category
                                
                        if query_category and person_category and query_category == person_category:
                            weighted_matches += weight
                            match_details.append(f"Category match on clothing top: {query_category} ~ {person_category}, +{weight}")
                        elif query_val in person_val or person_val in query_val:
                            partial_match = weight * 0.7
                            weighted_matches += partial_match
                            match_details.append(f"Partial text match on clothing top: {query_val} ~ {person_val}, +{partial_match}")
                
                # Apply similar strict matching for other attributes
                elif key == 'clothing_bottom':
                    # Check for specific bottom type requirements
                    for term, attr in critical_terms.items():
                        if attr == 'clothing_bottom' and term in query_val:
                            if term not in person_val:
                                logger.info(f"Specific bottom item '{term}' not found in person's clothing")
                                return 0
                    
                    # Calculate standard match if no exact match was required
                    if query_val == person_val:
                        weighted_matches += weight
                        match_details.append(f"Exact match on clothing bottom: {query_val} = {person_val}, +{weight}")
                    else:
                        weighted_matches += weight * 0.7
                        match_details.append(f"Partial match on clothing bottom: {query_val} ~ {person_val}, +{weight * 0.7}")
                
                # Handle accessories exact matching
                elif key == 'accessories':
                    # Check for specific accessory requirements
                    for term, attr in critical_terms.items():
                        if attr == 'accessories' and term in query_val:
                            if term not in person_val:
                                logger.info(f"Specific accessory '{term}' not found")
                                return 0
                    
                    # Calculate standard match
                    if query_val == person_val:
                        weighted_matches += weight
                        match_details.append(f"Exact match on accessories: {query_val} = {person_val}, +{weight}")
                    else:
                        weighted_matches += weight * 0.7
                        match_details.append(f"Partial match on accessories: {query_val} ~ {person_val}, +{weight * 0.7}")
                
                # Default handling for other attributes
                else:
                    # Exact match
                    if query_val == person_val:
                        weighted_matches += weight
                        match_details.append(f"Exact match on {key}: {query_val} = {person_val}, +{weight}")
                    # Partial match
                    elif query_val in person_val or person_val in query_val:
                        partial_match = weight * 0.7
                        weighted_matches += partial_match
                        match_details.append(f"Partial match on {key}: {query_val} ~ {person_val}, +{partial_match}")
                    # Word-level match
                    elif any(word in person_val.split() for word in query_val.split() if len(word) > 2):
                        word_match = weight * 0.5
                        weighted_matches += word_match
                        match_details.append(f"Word-level match on {key}: {query_val} ~ {person_val}, +{word_match}")
        
        # Calculate final similarity score (0-1)
        if weighted_total == 0:
            return 0
             
        similarity = weighted_matches / weighted_total
         
        # Log all match details as debug info
        logger.info(f"Match details: {'; '.join(match_details)}")
        logger.info(f"Total weighted score: {weighted_matches}/{weighted_total} = {similarity:.4f}")
        
        # Boost score if all queried attributes match
        if weighted_matches == weighted_total:
            similarity = min(1.0, similarity * 1.2)
            logger.info(f"Perfect match boost: {similarity:.4f}")
            
        # Boost score if key attributes match strongly
        key_attributes = ['gender', 'age_group', 'hair_color', 'clothing_top_color', 'clothing_top']
        key_attributes_in_query = [attr for attr in key_attributes if attr in query_json]
        if len(key_attributes_in_query) >= 3:
            # Calculate how many key attributes matched well
            key_match_count = 0
            key_total = 0
            for attr in key_attributes_in_query:
                if attr in person_json:
                    key_total += 1
                    query_val = str(query_json[attr]).lower()
                    person_val = str(person_json[attr]).lower()
                    if query_val == person_val:
                        key_match_count += 1
                    elif attr == 'gender' and any(g in person_val for g in gender_variations.get(query_val, [])):
                        key_match_count += 1
                    elif attr == 'age_group' and any(a in person_val for a in age_group_variations.get(query_val, [])):
                        key_match_count += 1
                    elif attr == 'hair_color' and any(c in person_val for c in color_variations.get(query_val, [])):
                        key_match_count += 1
                    elif attr == 'clothing_top_color' and any(c in person_val for c in color_variations.get(query_val, [])):
                        key_match_count += 1
                    elif attr == 'clothing_top' and any(t in person_val for t in clothing_top_variations.get(query_val, [])):
                        key_match_count += 1
                        
            # If most key attributes match, boost the score
            if key_total > 0 and key_match_count / key_total >= 0.7:
                key_match_boost = 1.0 + ((key_match_count / key_total) * 0.2)  # Up to 20% boost based on match ratio
                similarity = min(1.0, similarity * key_match_boost)
                logger.info(f"Key attribute boost ({key_match_count}/{key_total}): final similarity = {similarity:.4f}")
        
        return similarity
    except Exception as e:
        logger.error(f"Error in calculate_similarity: {e}")
        return 0

def find_similar_people(user_description: str, top_k=1) -> List[Dict[str, Any]]:
    """Find similar people based on text description.
    
    Now defaults to only returning the top 1 match.
    """
    try:
        logger.info(f"Searching for: {user_description}")
        
        # Extract critical terms from the query that will require exact matching
        critical_terms = extract_critical_terms(user_description)
        if critical_terms:
            logger.info(f"Extracted critical terms for exact matching: {critical_terms}")
        
        # Create suggestions from the query to help users refine their search
        suggested_refinements = []
        
        # Check for potential ambiguities
        lower_desc = user_description.lower()
        
        # Check for color terms without context
        color_terms = ["red", "blue", "green", "yellow", "black", "white", "purple", "orange", "pink", "grey", "gray", "brown"]
        clothing_terms = ["wearing", "shirt", "pants", "dress", "hoodie", "jacket", "sweater", "top", "bottom", "clothes"]
        hair_terms = ["hair", "hairstyle", "blonde", "brunette", "redhead"]
        
        for color in color_terms:
            if color in lower_desc:
                # If color exists but no clothing context
                if not any(term in lower_desc for term in clothing_terms) and not any(term in lower_desc for term in hair_terms):
                    suggested_refinements.append(f"{color} shirt")
                    suggested_refinements.append(f"{color} hair")
        
        # Check for vague age descriptors
        if "young" in lower_desc and not any(term in lower_desc for term in ["child", "teen", "kid", "baby"]):
            suggested_refinements.append("child")
            suggested_refinements.append("teenager")
        
        if "old" in lower_desc and not any(term in lower_desc for term in ["senior", "elderly"]):
            suggested_refinements.append("elderly person")
            suggested_refinements.append("senior")
        
        # Convert query to structured JSON
        query_json = query_to_structured_json(user_description)
        if not query_json:
            logger.error("Could not parse query into structured JSON")
            return {
                "matches": [],
                "count": 0,
                "message": "Could not understand the query. Please try rephrasing.",
                "suggestions": ["Try including specific details like gender, clothing colors, or hair style."]
            }

        # Log the structured query for debugging
        logger.info(f"Structured query: {json.dumps(query_json, indent=2)}")

        # Load database
        db = load_database()
        if not db or "people" not in db:
            logger.error("Database is empty or invalid")
            return {
                "matches": [],
                "count": 0,
                "message": "No people in database to search against."
            }
        
        logger.info(f"Database loaded with {len(db['people'])} people")
        
        # Calculate similarities for each person
        similarities = []
        for idx, person in enumerate(db["people"]):
            if "description" not in person:
                logger.warning(f"Person missing description: {person.get('id', 'unknown')}")
                continue
                
            # If critical terms are present, check for exact matches
            if critical_terms:
                # Check if all critical terms exist in the person's description
                meets_critical_requirements = True
                for term, attr in critical_terms.items():
                    if attr not in person["description"] or term not in str(person["description"][attr]).lower():
                        meets_critical_requirements = False
                        logger.info(f"Person {person.get('id', 'unknown')} missing critical term '{term}' in {attr}")
                        break
                
                # Skip this person if they don't match critical terms
                if not meets_critical_requirements:
                    continue
            
            similarity = calculate_similarity(query_json, person["description"])
            
            # Only include results with non-zero similarity
            if similarity > 0:
                # Log first few matches in detail
                if idx < 10 or similarity > 0.6:
                    logger.info(f"Person {person.get('id', 'unknown')} similarity: {similarity:.4f}")
                
                # Store more detailed differential scoring for better ranking
                match_details = calculate_match_details(query_json, person["description"])
                similarities.append((person, similarity, match_details))
        
        # Add a message if there are critical terms but no matches
        if critical_terms and not similarities:
            return {
                "matches": [],
                "count": 0,
                "message": f"No exact matches found for critical terms: {', '.join(critical_terms.keys())}",
                "suggestions": ["Try broadening your search by removing specific requirements."]
            }
        
        # Normalize similarities for better differentiation
        if similarities:
            max_sim = max(sim for _, sim, _ in similarities)
            min_sim = min(sim for _, sim, _ in similarities)
            
            # If all scores are the same, create artificial differentiation
            if max_sim == min_sim and len(similarities) > 1:
                # Use match details to create more nuanced scoring
                similarities = sorted(similarities, key=lambda x: (x[1], score_match_details(x[2])), reverse=True)
                
                # Create artificial spread between 85% and 100%
                normalized_sims = []
                for i, (person, _, match_details) in enumerate(similarities):
                    # Top match gets 100%, others get progressively lower
                    normalized_score = 1.0 - (i * (0.15 / len(similarities)))
                    normalized_sims.append((person, normalized_score, match_details))
                similarities = normalized_sims
            elif max_sim > min_sim:
                # Normalize to amplify small differences
                similarities = [(p, 0.85 + (0.15 * (s - min_sim) / (max_sim - min_sim)), m) 
                               for p, s, m in similarities]
        
        # Sort by similarity (descending)
        similarities.sort(key=lambda x: x[1], reverse=True)
        
        # Take top k results
        top_results = similarities[:top_k]
        
        # Process results
        matches = []
        for person, similarity, match_details in top_results:
            try:
                # Only include results with reasonable similarity
                if similarity < 0.1:
                    continue
                    
                # Convert similarity to percentage (0-100%)
                similarity_score = max(0, min(100, similarity * 100))
                
                # If critical terms were found, ensure this is marked as 100%
                # This creates a clear distinction between exact matches and fuzzy matches
                if critical_terms:
                    similarity_score = 100
                
                # Load and encode image
                image_data = None
                image_path = person["metadata"].get("image_path", "")
                if image_path and os.path.exists(image_path):
                    try:
                        with open(image_path, "rb") as img_file:
                            image_data = base64.b64encode(img_file.read()).decode("utf-8")
                    except Exception as e:
                        logger.error(f"Error loading image {image_path}: {e}")
                
                # Extract match highlights - the key attributes that matched
                match_highlights = []
                
                # If critical terms were specified, highlight those first
                if critical_terms:
                    for term, attr in critical_terms.items():
                        match_highlights.append(f"{attr}: {term}")
                
                # Get the values from both query and person for comparison
                for key in query_json:
                    if key in person["description"] and key not in [attr for _, attr in critical_terms.items()]:
                        query_val = str(query_json[key]).lower()
                        person_val = str(person["description"][key]).lower()
                        
                        # Check for exact or synonymous matches
                        if query_val == person_val:
                            match_highlights.append(f"{key}: {person_val}")
                        elif key == 'gender':
                            for gender, variations in gender_variations.items():
                                if gender in query_val and gender in person_val:
                                    match_highlights.append(f"gender: {person_val}")
                                    break
                        elif key == 'hair_color':
                            for color, variations in color_variations.items():
                                if color in query_val and color in person_val:
                                    match_highlights.append(f"hair color: {person_val}")
                                    break
                        elif key == 'clothing_top_color':
                            for color, variations in color_variations.items():
                                if color in query_val and color in person_val:
                                    match_highlights.append(f"top color: {person_val}")
                                    break
                
                matches.append({
                    "description": person["description"],
                    "metadata": person["metadata"],
                    "similarity": similarity_score,
                    "image_data": image_data,
                    "highlights": match_highlights[:3],  # Limit to top 3 highlights
                    "match_details": match_details  # Add detailed matching info
                })
            except Exception as e:
                logger.error(f"Error processing result: {e}")
                continue
        
        # Return empty result if no matches
        if not matches:
            message = "No matching people found for your query."
            if critical_terms:
                message = f"No exact matches found for critical terms: {', '.join(critical_terms.keys())}"
            
            return {
                "matches": [],
                "count": 0,
                "message": message,
                "suggestions": [
                    "Try being more general in your search.",
                    "Check if you specified details correctly (like colors, gender, age).",
                    "Try searching just by clothing or just by physical appearance."
                ] + suggested_refinements
            }
        
        # Generate RAG response for the query
        rag_response = None
        try:
            rag_result = generate_rag_response(user_description, matches[:1])  # Only use top match for RAG
            rag_response = rag_result.get("response")
        except Exception as e:
            logger.error(f"Error generating RAG response: {e}")
        
        # Create helpful suggestions based on the query and results
        suggestions = []
        
        # If query is very general, suggest adding more specific details
        if len(query_json) <= 2:
            suggestions.append("Try adding more details like clothing colors, hair style, or accessories.")
        
        # Include query refinement suggestions
        suggestions.extend(suggested_refinements)
        
        # Create a message based on whether critical terms were used
        message = f"Found {len(matches)} potential matches."
        if critical_terms:
            message = f"Found {len(matches)} exact matches for critical terms: {', '.join(critical_terms.keys())}"
        
        return {
            "query": user_description,
            "matches": matches,
            "count": len(matches),
            "message": message if matches else "No matches found.",
            "suggestions": suggestions[:5],  # Limit to top 5 suggestions
            "rag_response": rag_response
        }
    except Exception as e:
        logger.error(f"Error in find_similar_people: {e}")
        return {
            "matches": [],
            "count": 0,
            "message": f"Search error: {str(e)}",
            "suggestions": ["Try simplifying your search query."]
        }

def extract_critical_terms(query: str) -> Dict[str, str]:
    """Extract critical terms from a query that must be matched exactly.
    Returns a dictionary of {term: attribute_name}
    """
    critical_terms = {}
    
    # List of terms that require exact matching
    exact_match_terms = {
        'glasses': 'facial_features',
        'beard': 'facial_features',
        'mustache': 'facial_features',
        'hat': 'accessories',
        'backpack': 'accessories',
        'hoodie': 'clothing_top',
        'jacket': 'clothing_top',
        'jeans': 'clothing_bottom'
    }
    
    # Check for each term in the query
    query_lower = query.lower()
    for term, attr in exact_match_terms.items():
        # Check if the term is in the query as a standalone word (not part of another word)
        if f" {term} " in f" {query_lower} " or query_lower.startswith(f"{term} ") or query_lower.endswith(f" {term}") or query_lower == term:
            critical_terms[term] = attr
    
    return critical_terms

def calculate_match_details(query_json: Dict[str, Any], person_json: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate detailed matching information for better ranking."""
    match_details = {
        "exact_matches": 0,
        "partial_matches": 0,
        "key_attribute_matches": 0,
        "total_attributes": len(query_json),
    }
    
    # Define key attributes that are most important for differentiation
    key_attributes = ['gender', 'age_group', 'facial_features', 'clothing_top_color', 'clothing_top']
    
    for key in query_json:
        if key not in person_json:
            continue
            
        query_val = str(query_json[key]).lower()
        person_val = str(person_json[key]).lower()
        
        if query_val == person_val:
            match_details["exact_matches"] += 1
            if key in key_attributes:
                match_details["key_attribute_matches"] += 1
        elif query_val in person_val or person_val in query_val:
            match_details["partial_matches"] += 1
            if key in key_attributes:
                match_details["key_attribute_matches"] += 0.5
    
    return match_details

def score_match_details(match_details: Dict[str, Any]) -> float:
    """Convert match details to a single score for secondary sorting."""
    exact_weight = 1.0
    partial_weight = 0.3
    key_attr_weight = 2.0
    
    score = (match_details["exact_matches"] * exact_weight + 
             match_details["partial_matches"] * partial_weight + 
             match_details["key_attribute_matches"] * key_attr_weight)
             
    # Normalize by total attributes
    if match_details["total_attributes"] > 0:
        score = score / match_details["total_attributes"]
    
    return score

def generate_rag_response(user_query: str, matches: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Use Gemini to generate a RAG-enhanced response based on the user query and matches.
    This function takes the top matches from our database and uses Gemini to provide
    a more natural language response that explains why these matches were found.
    """
    try:
        if not matches:
            return {
                "response": "I couldn't find any matches for your search. Try using more general terms or fewer specific details.",
                "matches": []
            }
        
        # Format matches for the prompt
        matches_text = ""
        for i, match in enumerate(matches):
            desc = match.get("description", {})
            metadata = match.get("metadata", {})
            similarity = match.get("similarity", 0)
            
            # Format the match as a readable string
            match_text = f"Match {i+1} (Similarity: {similarity:.1f}%):\n"
            
            # Add key attributes
            if "gender" in desc:
                match_text += f"- Gender: {desc['gender']}\n"
            if "age_group" in desc:
                match_text += f"- Age: {desc['age_group']}\n"
            if "facial_features" in desc and desc["facial_features"]:
                match_text += f"- Facial features: {desc['facial_features']}\n"
            if "hair_color" in desc:
                match_text += f"- Hair color: {desc['hair_color']}\n"
            if "clothing_top" in desc:
                match_text += f"- Wearing: {desc.get('clothing_top_color', '')} {desc['clothing_top']}\n"
            if "clothing_bottom" in desc:
                match_text += f"- Bottom: {desc.get('clothing_bottom_color', '')} {desc['clothing_bottom']}\n"
            if "location_context" in desc:
                match_text += f"- Location: {desc['location_context']}\n"
            if "camera_id" in metadata:
                match_text += f"- Camera: {metadata['camera_id']}\n"
            if "timestamp" in metadata:
                match_text += f"- Time: {metadata['timestamp']}\n"
            
            matches_text += match_text + "\n"
        
        # Create the RAG prompt
        rag_prompt = f"""
You are an AI assistant helping with a person search system. A user has searched for: "{user_query}"

The system found the following matches in the database:

{matches_text}

Based on these matches, provide a natural language response that:
1. Explains why these matches were found
2. Highlights the key similarities between the matches and the user's query
3. Mentions any notable differences or limitations
4. Suggests how the user could refine their search if needed

Keep your response concise and focused on helping the user understand the search results.
"""
        
        # Generate response using Gemini
        response = model.generate_content(rag_prompt)
        rag_response = response.text
        
        # Return both the RAG response and the original matches
        return {
            "response": rag_response,
            "matches": matches
        }
    except Exception as e:
        logger.error(f"Error generating RAG response: {e}")
        # Fall back to returning just the matches if RAG fails
        return {
            "response": "I found some matches for your search, but couldn't generate a detailed explanation.",
            "matches": matches
        }
