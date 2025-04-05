// API service for backend communication

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export type SearchResult = {
  query: string;
  matches: Array<{
    similarity: number;
    description: {
      gender?: string;
      age_group?: string;
      clothing_top?: string;
      clothing_top_color?: string;
      clothing_bottom?: string;
      clothing_bottom_color?: string;
      accessories?: string[];
    };
    image_data?: string;
  }>;
  message?: string;
  suggestions?: string[];
};

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export async function searchPerson(query: string): Promise<SearchResult> {
  try {
    const formData = new FormData();
    formData.append('query', query);
    
    const response = await fetch(`${API_BASE_URL}/search`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Search error:", error);
    return {
      query,
      matches: [],
      suggestions: ["Try a different search term", "Be more specific about the person you're looking for"]
    };
  }
}

export async function uploadImage(file: File): Promise<SearchResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Upload request failed');
  }

  return response.json();
}

export async function chat(messages: ChatMessage[]): Promise<string> {
  try {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages }),
    });
    
    if (!response.ok) {
      throw new Error(`Chat failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error("Chat error:", error);
    return "I'm having trouble processing your request right now. Please try again later.";
  }
} 