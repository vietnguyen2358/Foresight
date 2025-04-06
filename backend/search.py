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
    """Convert natural language query to structured JSON."""
    try:
        original_query = query
        query = query.lower()
        logger.info(f"Converting query to structured JSON: {query}")
        
        # Detect gender explicitly as a preprocessing step
        gender_terms = {
            "male": ["man", "male", "boy", "guy", "men", "boys", "guys", "gentleman", "masculine"],
            "female": ["woman", "female", "girl", "lady", "women", "girls", "ladies", "feminine"],
            "other": ["person", "non-binary", "nonbinary", "transgender", "trans", "neutral", "other gender"]
        }
        
        detected_gender = None
        for gender, terms in gender_terms.items():
            if any(f" {term} " in f" {query} " or query.startswith(f"{term} ") or query.endswith(f" {term}") or query == term for term in terms):
                detected_gender = gender
                logger.info(f"Detected gender '{gender}' in query")
                break
        
        # Create more comprehensive prompt with clearer examples and structure
        gemini_prompt = f"""
You are a computer vision AI assistant that helps convert natural language descriptions into structured JSON format.

TASK: Convert the following query about a person's appearance into a structured JSON object.

QUERY: "{query}"

Extract only the attributes explicitly mentioned or strongly implied in the query.
Follow these formatting rules:
1. Include only attributes that are mentioned or strongly implied in the query
2. Use null for any attributes not mentioned
3. Format the response as valid, clean JSON with no explanations
4. For multi-word values, keep spaces (e.g., "light brown" not "lightbrown")
5. Standardize terms when appropriate (e.g., "male" not "man")

The JSON should ONLY include these attributes if they're mentioned:
{{
  "gender": null,         // "male", "female", or "other"
  "age_group": null,      // "child", "teen", "adult", "senior"
  "height_estimate": null, // "short", "average", "tall"
  "build_type": null,     // "thin", "average", "athletic", "heavy"
  "ethnicity": null,      // ethnicity if mentioned
  "skin_tone": null,      // "light", "medium", "dark" if mentioned
  "hair_style": null,     // "short", "medium", "long", "bald", "ponytail", "braided", etc.
  "hair_color": null,     // hair color if mentioned
  "facial_features": null, // facial features like "glasses", "beard", "mustache", etc.
  "clothing_top": null,   // type of top clothing (e.g., "shirt", "jacket", "hoodie")
  "clothing_top_color": null, // color of top clothing
  "clothing_top_pattern": null, // pattern of top clothing (e.g., "solid", "striped", "plaid")
  "clothing_bottom": null, // type of bottom clothing (e.g., "pants", "shorts", "skirt")
  "clothing_bottom_color": null, // color of bottom clothing
  "clothing_bottom_pattern": null, // pattern of bottom clothing
  "footwear": null,       // type of footwear (e.g., "sneakers", "boots", "sandals")
  "footwear_color": null, // color of footwear
  "accessories": null,    // accessories (e.g., "backpack", "hat", "sunglasses")
  "bag_type": null,       // type of bag if carrying (e.g., "backpack", "purse", "suitcase")
  "bag_color": null,      // color of bag
  "pose": null,           // pose or activity (e.g., "standing", "walking", "sitting")
  "location_context": null // context of location (e.g., "indoor", "outdoor", "street")
}}

Examples:
1. "man in red shirt" → {{"gender":"male","clothing_top":"shirt","clothing_top_color":"red"}}
2. "woman with blonde hair wearing glasses" → {{"gender":"female","hair_color":"blonde","facial_features":"glasses"}}
3. "elderly asian man with a cane" → {{"gender":"male","age_group":"senior","ethnicity":"asian","accessories":"cane"}}

Make sure to only include attributes that are explicitly mentioned or strongly implied in the query.
DO NOT include attributes just because they seem likely or reasonable.
Return ONLY the JSON object with no other text.
"""

        # Perform the API call
        logger.info("Sending query to Gemini")
        response = model.generate_content(gemini_prompt)
        response_text = response.text
        
        # Additional logging for debugging
        logger.info(f"Raw Gemini response: {response_text[:1000]}")
        
        # Attempt to extract JSON from the response if wrapped in ``` or other text
        json_text = response_text.strip()
        if "```json" in json_text:
            json_text = json_text.split("```json")[1].split("```")[0].strip()
        elif "```" in json_text:
            json_text = json_text.split("```")[1].split("```")[0].strip()
        
        # Parse the JSON
        try:
            result = json.loads(json_text)
            logger.info(f"Successfully parsed JSON from Gemini response")
            
            # Add detected gender if it wasn't in the response
            if detected_gender and (result.get('gender') is None or result.get('gender') == ""):
                result['gender'] = detected_gender
                logger.info(f"Added detected gender '{detected_gender}' to query result")
            
            # Clean up the result - remove null values and empty strings
            result = {k: v for k, v in result.items() if v is not None and v != ""}
            
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

def find_similar_people(user_description: str, top_k=1, include_match_highlights=True, include_camera_location=True, include_rag_response=True) -> List[Dict[str, Any]]:
    """Find similar people based on text description.
    
    Now defaults to only returning the top 1 match.
    
    Args:
        user_description: Natural language description to search for
        top_k: Number of top matches to return
        include_match_highlights: Whether to include key attributes that matched
        include_camera_location: Whether to add camera locations to results
        include_rag_response: Whether to include a natural language response using Gemini
        
    Returns:
        List of matching people with descriptions and metadata
    """
    try:
        logger.info(f"Starting search for: '{user_description}'")
        
        # Add more comprehensive logging
        if not user_description or len(user_description.strip()) < 3:
            logger.warning(f"Search query too short or empty: '{user_description}'")
            return []
            
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
            logger.error(f"Could not parse query into structured JSON: '{user_description}'")
            # Try a simple fallback approach for basic queries
            basic_query = {}
            
            # Check for basic gender terms
            if any(term in lower_desc for term in ["man", "male", "boy", "guy"]):
                basic_query["gender"] = "male"
            elif any(term in lower_desc for term in ["woman", "female", "girl", "lady"]):
                basic_query["gender"] = "female"
                
            # Check for basic color terms
            for color in color_terms:
                if color in lower_desc:
                    if "wearing" in lower_desc or any(term in lower_desc for term in clothing_terms):
                        basic_query["clothing_top_color"] = color
                    elif any(term in lower_desc for term in hair_terms):
                        basic_query["hair_color"] = color
            
            if basic_query:
                logger.info(f"Using basic fallback query: {basic_query}")
                query_json = basic_query
            else:
                empty_response = {
                    "matches": [],
                    "count": 0,
                    "message": "Could not understand your search query. Please try again with more specific details.",
                    "suggestions": ["Try describing clothing colors", "Mention gender (man/woman)", "Describe hair color or style"]
                }
                if include_rag_response:
                    empty_response["rag_response"] = "I couldn't understand your search query. Please try describing the person with more specific details like clothing colors, gender, or hair characteristics."
                return empty_response

        # Log the structured query for debugging
        logger.info(f"Structured query: {json.dumps(query_json, indent=2)}")

        # Load database
        db = load_database()
        if not db or "people" not in db:
            logger.error("Database is empty or invalid")
            empty_response = {
                "matches": [],
                "count": 0,
                "message": "Search database is empty or not available.",
                "suggestions": ["Try again later", "Check if the database has been initialized"]
            }
            if include_rag_response:
                empty_response["rag_response"] = "I'm sorry, but the database appears to be empty or not accessible right now. Please try again later."
            return empty_response
        
        logger.info(f"Database loaded with {len(db['people'])} people")
        
        # Calculate similarities for each person
        similarities = []
        for idx, person in enumerate(db["people"]):
            if "description" not in person:
                logger.warning(f"Person missing description: {person.get('id', 'unknown')}")
                continue
            
            # Log for debugging first few entries    
            if idx < 3:
                logger.info(f"Checking person {idx}: {person.get('id', 'unknown')}")
                logger.info(f"Description: {person['description']}")
                
            # If critical terms are present, check for exact matches
            if critical_terms:
                # Check if all critical terms exist in the person's description
                meets_critical_requirements = True
                for term, attr in critical_terms.items():
                    if attr not in person["description"] or term not in str(person["description"][attr]).lower():
                        meets_critical_requirements = False
                        if idx < 3:  # Only log for first few entries
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
            logger.info(f"No matches found for critical terms: {critical_terms}")
            empty_response = {
                "matches": [],
                "count": 0,
                "message": f"No matches found for specific criteria: {', '.join(critical_terms.keys())}",
                "suggestions": ["Try broader terms", "Remove specific requirements like colors or accessories"]
            }
            if include_rag_response:
                empty_response["rag_response"] = f"I couldn't find anyone matching your specific criteria for {', '.join(critical_terms.keys())}. Try broadening your search by removing specific details."
            return empty_response
        
        # Log how many similarities we found
        logger.info(f"Found {len(similarities)} potential matches before normalization")
        
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
        logger.info(f"Selected top {len(top_results)} results")
        
        # Process results
        matches = []
        for person, similarity, match_details in top_results:
            try:
                # Only include results with reasonable similarity
                if similarity < 0.1:
                    logger.info(f"Skipping match with similarity below threshold: {similarity}")
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
                        
                        # Check if values match or are similar
                        if query_val == person_val:
                            match_highlights.append(f"{key}: {person_val}")
                        elif query_val in person_val or person_val in query_val:
                            match_highlights.append(f"{key}: {person_val} (partial match)")
                
                # Add camera location if requested
                camera_location = None
                if include_camera_location:
                    camera_id = person["metadata"].get("camera_id", "")
                    camera_location = get_camera_location(camera_id)
                    logger.info(f"Added camera location '{camera_location}' for camera ID '{camera_id}'")
                
                # Build the match object
                match_obj = {
                    "description": person["description"],
                    "metadata": {
                        **person["metadata"],
                        "detection_id": person.get("id", ""),
                    },
                    "similarity": similarity_score,
                    "image_data": image_data
                }
                
                # Add camera location if available
                if camera_location:
                    match_obj["metadata"]["camera_location"] = camera_location
                
                # Add match highlights if requested
                if include_match_highlights and match_highlights:
                    match_obj["highlights"] = match_highlights
                    match_obj["match_details"] = match_details
                
                matches.append(match_obj)
            except Exception as e:
                logger.error(f"Error processing match: {e}")
                continue
        
        # Build the complete response
        response = {
            "matches": matches,
            "count": len(matches),
            "message": f"Found {len(matches)} potential matches.",
            "suggestions": suggested_refinements
        }
        
        # Add RAG-enhanced response if requested
        if include_rag_response and matches:
            rag_result = generate_rag_response(user_description, matches)
            response["rag_response"] = rag_result.get("response", "")
        
        return response
        
    except Exception as e:
        logger.error(f"Error in find_similar_people: {e}")
        # Return a user-friendly error
        error_response = {
            "matches": [],
            "count": 0,
            "message": "An error occurred during search. Please try again.",
            "error": str(e)
        }
        if include_rag_response:
            error_response["rag_response"] = "I'm sorry, but an error occurred while searching. Please try again with a different query."
        return error_response

# Helper function to get camera location from camera ID
def get_camera_location(camera_id: str) -> str:
    """Map camera ID to a human-readable location name."""
    camera_locations = {
        "SF-MIS-001": "Mission District - 16th Street",
        "SF-MIS-002": "Mission District - 24th Street",
        "SF-MIS-003": "Mission District - Valencia Street",
        "SF-MIS-004": "Mission District - Dolores Park",
        "SF-MIS-005": "Mission District - Bryant Street",
        "SF-MIS-006": "Mission District - Folsom Street", 
        "SF-MIS-007": "Mission District - Guerrero Street",
        "SF-MIS-008": "Mission District - South Van Ness Avenue",
        "SF-MKT-001": "Market Street - Powell Station",
        "SF-MKT-002": "Market Street - Montgomery Station",
        "SF-MKT-003": "Market Street - Embarcadero",
        "SF-MKT-004": "Market Street - UN Plaza",
        "SF-MKT-005": "Market Street - Van Ness Avenue",
        "SF-MKT-006": "Market Street - Castro District",
        "SF-FID-001": "Financial District - California Street",
        "SF-FID-002": "Financial District - Montgomery Street",
        "SF-FID-003": "Financial District - Embarcadero Center",
        "SF-NOB-001": "Nob Hill - California Cable Car Line",
        "SF-NOB-002": "Nob Hill - Grace Cathedral",
        "SF-CHI-001": "Chinatown - Grant Avenue",
        "SF-CHI-002": "Chinatown - Portsmouth Square",
        "SF-NOR-001": "North Beach - Columbus Avenue",
        "SF-NOR-002": "North Beach - Washington Square",
        "SF-FIS-001": "Fisherman's Wharf - Pier 39",
        "SF-FIS-002": "Fisherman's Wharf - Ghirardelli Square"
    }
    
    return camera_locations.get(camera_id, f"Unknown Location (Camera {camera_id})")

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
        logger.info(f"Generating RAG response for query: '{user_query}' with {len(matches)} matches")
        
        if not matches:
            logger.info("No matches found for RAG response")
            return {
                "response": "I couldn't find any matches for your search. Try using more general terms or fewer specific details.",
                "matches": []
            }
        
        # Format matches for the prompt
        matches_text = ""
        for i, match in enumerate(matches):
            # Ensure match is a dictionary
            if not isinstance(match, dict):
                logger.error(f"Match {i} is not a dictionary: {type(match)}")
                continue
                
            desc = match.get("description", {})
            if not isinstance(desc, dict):
                logger.error(f"Match description is not a dictionary: {type(desc)}")
                continue
                
            metadata = match.get("metadata", {})
            if not isinstance(metadata, dict):
                logger.error(f"Match metadata is not a dictionary: {type(metadata)}")
                metadata = {}
                
            similarity = match.get("similarity", 0)
            
            # Log match details for debugging
            logger.info(f"Processing match {i+1}: similarity={similarity}, description keys={list(desc.keys())}")
            
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
                top_color = desc.get("clothing_top_color", "")
                match_text += f"- Wearing: {top_color} {desc['clothing_top']}\n"
            if "clothing_bottom" in desc:
                bottom_color = desc.get("clothing_bottom_color", "")
                match_text += f"- Bottom: {bottom_color} {desc['clothing_bottom']}\n"
            if "location_context" in desc:
                match_text += f"- Location: {desc['location_context']}\n"
            if "camera_id" in metadata:
                match_text += f"- Camera: {metadata['camera_id']}\n"
            if "timestamp" in metadata:
                match_text += f"- Time: {metadata['timestamp']}\n"
            
            matches_text += match_text + "\n"
        
        logger.info(f"Formatted matches for RAG: {matches_text[:200]}...")
        
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
        logger.info("Sending prompt to Gemini for RAG response")
        response = model.generate_content(rag_prompt)
        rag_response = response.text
        logger.info(f"Received RAG response: {rag_response[:100]}...")
        
        # Return both the RAG response and the original matches
        return {
            "response": rag_response,
            "matches": matches
        }
    except Exception as e:
        logger.error(f"Error generating RAG response: {str(e)}")
        # Fall back to returning just the matches if RAG fails
        return {
            "response": "I found some matches for your search, but couldn't generate a detailed explanation.",
            "matches": matches
        }

def direct_database_search(query: str, top_k=5) -> Dict[str, Any]:
    """
    Use Gemini to directly search the database with natural language.
    This function:
    1. Loads the entire database from ml.json (read-only mode)
    2. Formats it as a context for Gemini
    3. Asks Gemini to find the best matches for the query
    4. Returns structured results with camera locations and detailed explanations
    
    Note: The database is accessed in read-only mode from ml.json
    
    Args:
        query: Natural language query string
        top_k: Maximum number of results to return
        
    Returns:
        Dictionary with matches, count, explanations and suggestions
    """
    try:
        logger.info(f"Starting direct database search with Gemini for: '{query}'")
        
        # Load the database from ml.json (read-only)
        db = load_database()  # This now loads from ml.json
        if not db or "people" not in db or len(db["people"]) == 0:
            logger.error("Database is empty or invalid")
            return {
                "matches": [],
                "count": 0,
                "message": "Search database (ml.json) is empty or not available.",
                "suggestions": ["Check if ml.json exists and is properly formatted"],
                "rag_response": "I'm sorry, but the database appears to be empty or not accessible right now. Please ensure ml.json contains valid data."
            }
        
        # Count how many entries we have
        people_count = len(db["people"])
        logger.info(f"Loaded database with {people_count} entries")
        
        # Format the database entries for Gemini
        db_entries = []
        
        for idx, person in enumerate(db["people"]):
            if "description" not in person or not isinstance(person["description"], dict):
                continue
                
            # Get metadata
            metadata = person.get("metadata", {})
            camera_id = metadata.get("camera_id", "unknown")
            timestamp = metadata.get("timestamp", "unknown time")
            
            # Map camera ID to location
            camera_location = get_camera_location(camera_id)
            
            # Create a formatted entry
            entry = {
                "id": person.get("id", f"person_{idx}"),
                "description": person["description"],
                "camera_id": camera_id,
                "camera_location": camera_location,
                "timestamp": timestamp
            }
            
            db_entries.append(entry)
        
        # Limit entries if database is too large
        if len(db_entries) > 200:
            logger.warning(f"Database too large ({len(db_entries)} entries), limiting to 200 for Gemini")
            db_entries = db_entries[:200]
        
        # Create a context for Gemini with the database entries
        database_json = json.dumps(db_entries, indent=2)
        
        # Create the prompt for Gemini
        gemini_prompt = f"""
You are a powerful search system for surveillance camera footage. 
Your task is to find people matching a user's description in the database.

USER QUERY: "{query}"

SURVEILLANCE DATABASE (JSON):
{database_json}

INSTRUCTIONS:
1. Find the best matches for this query, considering:
   - Exact attribute matches (e.g., specific clothing items, colors)
   - Semantic matches (e.g., "man" = "male", "kid" = "child")
   - Partial matches when no exact match exists
   - Best overall match of multiple criteria

2. For each match, explain why it matches the query and include:
   - Camera location
   - Key attributes that matched
   - Any notable differences
   - Similarity score (0-100%)

3. Format your response as structured JSON with these components:
   - best_matches: Array of up to {top_k} best matching entries
   - explanations: Object with entry IDs as keys and explanation strings as values
   - summary: A natural language summary of the search results
   - suggestions: Array of suggested alternative queries if results are not satisfactory

RESPONSE FORMAT:
{{
  "best_matches": [
    {{
      "id": "entry_id",
      "similarity": 92,
      "description": {{...original description object...}},
      "camera_id": "camera_id",
      "camera_location": "Human readable location"
    }}
  ],
  "explanations": {{
    "entry_id": "This person matches because they have X, Y, and Z attributes that match the query."
  }},
  "summary": "I found 3 people matching your description. The best match is a male child wearing a red shirt at Mission District.",
  "suggestions": ["Try specifying clothing colors", "Include age group (child, teen, adult)"]
}}

Return ONLY a valid JSON object, no additional text.
"""

        # Call Gemini for the search
        logger.info("Sending search request to Gemini with database context")
        response = model.generate_content(gemini_prompt)
        
        # Extract the JSON response
        result_text = response.text.strip()
        
        # Attempt to extract JSON if wrapped in code blocks
        if "```json" in result_text:
            result_text = result_text.split("```json")[1].split("```")[0].strip()
        elif "```" in result_text:
            result_text = result_text.split("```")[1].split("```")[0].strip()
            
        logger.info(f"Received response from Gemini (length: {len(result_text)})")
        
        try:
            result = json.loads(result_text)
            
            # Structure the response for the frontend
            matches = []
            for match in result.get("best_matches", []):
                # Format each match entry
                entry = {
                    "description": match.get("description", {}),
                    "metadata": {
                        "camera_id": match.get("camera_id", "unknown"),
                        "camera_location": match.get("camera_location", "Unknown location"),
                        "detection_id": match.get("id", "")
                    },
                    "similarity": match.get("similarity", 0),
                    "explanation": result.get("explanations", {}).get(match.get("id", ""), "")
                }
                matches.append(entry)
                
            # Build the complete response
            search_response = {
                "matches": matches,
                "count": len(matches),
                "message": f"Found {len(matches)} potential matches.",
                "suggestions": result.get("suggestions", []),
                "rag_response": result.get("summary", "I searched the database for matches to your query.")
            }
            
            logger.info(f"Returning {len(matches)} matches from direct Gemini search")
            return search_response
            
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing Gemini response as JSON: {e}")
            logger.error(f"Raw response: {result_text[:500]}...")
            return {
                "matches": [],
                "count": 0,
                "message": "Error parsing search results. Please try again.",
                "error": f"JSON parse error: {str(e)}",
                "rag_response": "I had trouble understanding the search results. Please try rephrasing your query."
            }
            
    except Exception as e:
        logger.error(f"Error in direct_database_search: {str(e)}")
        return {
            "matches": [],
            "count": 0,
            "message": "An error occurred during search. Please try again.",
            "error": str(e),
            "rag_response": "I'm sorry, but an error occurred while searching. Please try again with a different query."
        }
