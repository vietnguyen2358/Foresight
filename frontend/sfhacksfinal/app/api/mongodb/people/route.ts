import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function GET() {
  try {
    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db('foresight_db');
    
    // Get the people collection
    const peopleCollection = db.collection('people');
    
    // Get all people (consider adding pagination for large collections)
    const allPeople = await peopleCollection.find({}).toArray();
    
    // Create the response object with the same structure as db.json
    const response = {
      people: allPeople.map(person => {
        // Remove MongoDB _id field
        const { _id, ...cleanPerson } = person;
        return cleanPerson;
      })
    };
    
    // Return the data as JSON
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching people from MongoDB:', error);
    
    // If MongoDB fails, try to load from db.json
    try {
      // Attempt to fetch from db.json
      const response = await fetch(new URL('/db.json', process.env.NEXT_PUBLIC_APP_URL));
      if (!response.ok) {
        throw new Error(`Failed to fetch fallback database: ${response.statusText}`);
      }
      
      const data = await response.json();
      return NextResponse.json(data, {
        headers: {
          'X-Data-Source': 'Fallback db.json'
        }
      });
    } catch (fallbackError) {
      console.error('Error fetching fallback data:', fallbackError);
      return NextResponse.json(
        { error: 'Failed to load database from MongoDB and fallback' },
        { status: 500 }
      );
    }
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db('foresight_db');
    
    // Get the people collection
    const peopleCollection = db.collection('people');
    
    // Insert the new person
    const result = await peopleCollection.insertOne(data);
    
    if (result.acknowledged) {
      return NextResponse.json({ success: true, id: result.insertedId });
    } else {
      return NextResponse.json(
        { error: 'Failed to insert person into database' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error adding person to MongoDB:', error);
    return NextResponse.json(
      { error: 'Failed to add person to database' },
      { status: 500 }
    );
  }
} 