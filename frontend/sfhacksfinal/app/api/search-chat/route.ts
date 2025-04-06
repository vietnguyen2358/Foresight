import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

// Helper function to format database data for Gemini prompt
function formatDatabaseForPrompt(people: any[]) {
  // Simplify and format people data for the prompt
  const simplifiedPeople = people.map((person, index) => {
    const { _id, ...cleanPerson } = person;
    
    // Create a simplified person object
    return {
      id: cleanPerson.id || `person_${index}`,
      gender: cleanPerson.description?.gender || 'unknown',
      age_group: cleanPerson.description?.age_group || 'unknown',
      clothing: {
        top: {
          type: cleanPerson.description?.clothing_top || 'unknown',
          color: cleanPerson.description?.clothing_top_color || 'unknown',
          pattern: cleanPerson.description?.clothing_top_pattern || 'unknown',
        },
        bottom: {
          type: cleanPerson.description?.clothing_bottom || 'unknown',
          color: cleanPerson.description?.clothing_bottom_color || 'unknown',
          pattern: cleanPerson.description?.clothing_bottom_pattern || 'unknown',
        },
        footwear: {
          type: cleanPerson.description?.footwear || 'unknown',
          color: cleanPerson.description?.footwear_color || 'unknown',
        }
      },
      facial_features: cleanPerson.description?.facial_features || [],
      accessories: cleanPerson.description?.accessories || [],
      hair: {
        style: cleanPerson.description?.hair_style || 'unknown',
        color: cleanPerson.description?.hair_color || 'unknown',
      },
      skin_tone: cleanPerson.description?.skin_tone || 'unknown',
      pose: cleanPerson.description?.pose || 'unknown',
      location: cleanPerson.description?.location_context || 'unknown',
      camera_id: cleanPerson.metadata?.camera_id || 'unknown',
      timestamp: cleanPerson.metadata?.timestamp || 'unknown',
    };
  });

  return JSON.stringify(simplifiedPeople);
}

export async function POST(request: Request) {
  try {
    const { query } = await request.json();
    
    if (!query) {
      return NextResponse.json(
        { error: 'No search query provided' },
        { status: 400 }
      );
    }

    // Retrieve database data
    let databaseData;
    try {
      // Try to get data from MongoDB first
      const client = await clientPromise;
      const db = client.db('foresight_db');
      const peopleCollection = db.collection('people');
      const allPeople = await peopleCollection.find({}).toArray();
      databaseData = allPeople;
    } catch (dbError) {
      console.error('Error fetching from MongoDB:', dbError);
      
      // Fallback to db.json
      try {
        const response = await fetch(new URL('/db.json', process.env.NEXT_PUBLIC_APP_URL));
        if (!response.ok) {
          throw new Error(`Failed to fetch db.json: ${response.statusText}`);
        }
        const jsonData = await response.json();
        databaseData = jsonData.people;
      } catch (jsonError) {
        console.error('Error fetching from db.json:', jsonError);
        return NextResponse.json(
          { error: 'Failed to retrieve database for search' },
          { status: 500 }
        );
      }
    }

    // Format the database data for Gemini
    const formattedDatabase = formatDatabaseForPrompt(databaseData);
    
    // Gemini API key from environment variables
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      );
    }

    // Build the prompt for Gemini
    const prompt = `
    You are a helpful AI assistant for searching people in the Foresight security system.
    
    I'll provide you with a database of people detected by our surveillance system and a search query.
    Your task is to identify the most relevant matches based on the query and explain your reasoning.
    
    PEOPLE DATABASE:
    ${formattedDatabase}
    
    SEARCH QUERY:
    "${query}"
    
    Return your response in JSON format with:
    1. A direct answer to the query
    2. Relevant matches from the database (up to 5 most relevant)
    3. For each match, explain why it's relevant with a confidence score (0-100)
    
    {
      "response": "Your direct answer to the query",
      "matches": [
        {
          "id": "person_id",
          "relevance_score": 95,
          "explanation": "This person matches because...",
          "highlighted_attributes": ["gender", "clothing_top", "hair_color"]
        }
      ]
    }
    
    Focus on finding the most accurate matches based on the query's intent and descriptive elements.
    If there are no relevant matches, explain why and suggest how to improve the search query.
    `;

    // Call Gemini API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Gemini API error:', errorData);
      return NextResponse.json(
        { error: 'Error from Gemini API', details: errorData },
        { status: response.status }
      );
    }

    const geminiResponse = await response.json();
    
    // Extract the text from Gemini's response
    let rawText = '';
    try {
      rawText = geminiResponse.candidates[0].content.parts[0].text;
    } catch (e) {
      console.error('Error parsing Gemini response:', e, geminiResponse);
      return NextResponse.json(
        { error: 'Invalid response format from Gemini API' },
        { status: 500 }
      );
    }

    // Extract JSON from the response text
    let jsonResult;
    try {
      // Handle cases where the JSON might be wrapped in markdown code blocks
      if (rawText.includes('```json')) {
        const jsonText = rawText.split('```json')[1].split('```')[0].trim();
        jsonResult = JSON.parse(jsonText);
      } else if (rawText.includes('```')) {
        const jsonText = rawText.split('```')[1].split('```')[0].trim();
        jsonResult = JSON.parse(jsonText);
      } else {
        // Assume the whole text is JSON
        jsonResult = JSON.parse(rawText);
      }
    } catch (jsonError) {
      console.error('Error parsing JSON from Gemini response:', jsonError);
      // Return the raw text if we can't parse JSON
      return NextResponse.json({
        response: "Could not parse a structured response. Here's the raw output:",
        rawText: rawText
      });
    }

    // Return the results
    return NextResponse.json(jsonResult);
    
  } catch (error) {
    console.error('Error in search-chat API:', error);
    return NextResponse.json(
      { error: 'Failed to process search query' },
      { status: 500 }
    );
  }
} 