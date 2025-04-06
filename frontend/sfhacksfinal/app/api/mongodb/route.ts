import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { MongoClient } from 'mongodb';

// Global variable to cache connection
let client: MongoClient | null = null;
let dbPromise: Promise<any> | null = null;

// Function to get database connection
async function getDatabase() {
  if (!dbPromise) {
    // If we're running in a serverless environment, we need to connect every time
    try {
      // Use existing clientPromise for the first connection
      client = await clientPromise;
      // Get the database instance
      const db = client.db('foresight_db'); // Use your actual database name
      dbPromise = Promise.resolve(db);
    } catch (error) {
      console.error('Error connecting to MongoDB:', error);
      throw new Error('Failed to connect to database');
    }
  }
  return dbPromise;
}

export async function GET() {
  try {
    // Get database instance
    const db = await getDatabase();
    
    // Get the people collection - use the actual collection name from your MongoDB setup
    const peopleCollection = db.collection('people');
    
    // Get all people (consider adding pagination for large collections)
    const allPeople = await peopleCollection.find({}).toArray();
    
    // Create the response object in the same format as db.json
    const response = {
      people: allPeople.map(person => {
        // Clean up MongoDB _id field
        const { _id, ...cleanPerson } = person;
        return cleanPerson;
      })
    };
    
    // Return the data as JSON
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching people from MongoDB:', error);
    return NextResponse.json(
      { error: 'Failed to load database' },
      { status: 500 }
    );
  }
} 