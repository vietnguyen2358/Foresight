"use client"

import React, { useState, useEffect } from 'react';
import { Search, Loader2, X, User, Clock, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { useCamera } from '@/lib/CameraContext';

interface Person {
  id: string;
  description: {
    gender?: string;
    age_group?: string;
    clothing_top?: string;
    clothing_bottom?: string;
    [key: string]: any;
  };
  metadata: {
    camera_id?: string;
    timestamp?: string;
    [key: string]: any;
  };
}

interface SearchResult {
  id: string;
  relevance_score: number;
  explanation: string;
  highlighted_attributes: string[];
  person: Person;
}

interface SearchResponse {
  response: string;
  matches: SearchResult[];
}

export default function PersonalizedSearch() {
  const { selectedCamera, setSelectedCamera, cameras } = useCamera();
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load database data
  useEffect(() => {
    setIsLoading(true);
    
    fetch('/db.json')
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to load database');
        }
        return response.json();
      })
      .then(data => {
        setPeople(data.people || []);
      })
      .catch(error => {
        console.error('Error loading database:', error);
        setError('Failed to load people database');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setIsSearching(true);
    setError(null);
    setSearchResults(null);
    
    try {
      // Process search with loaded people data
      const searchData = analyzeSearch(searchTerm, people);
      setSearchResults(searchData);
    } catch (error) {
      console.error('Search error:', error);
      setError('Failed to process search');
    } finally {
      setIsSearching(false);
    }
  };

  // Simple local search function since we don't have the backend setup yet
  const analyzeSearch = (query: string, people: Person[]): SearchResponse => {
    // Convert query to lowercase for easier matching
    const lowerQuery = query.toLowerCase();
    
    // Extract potential terms to search for
    const queryTerms = lowerQuery.split(/\s+/).filter(term => term.length > 2);
    
    // Score each person based on match quality
    const scoredPeople = people.map(person => {
      let score = 0;
      const highlightedAttributes: string[] = [];
      
      // Convert description and metadata to string for searching
      const descriptionStr = JSON.stringify(person.description).toLowerCase();
      const metadataStr = JSON.stringify(person.metadata).toLowerCase();
      
      // Check if any terms are in the description or metadata
      for (const term of queryTerms) {
        if (descriptionStr.includes(term)) {
          score += 10;
          
          // Find which attributes matched
          for (const [key, value] of Object.entries(person.description)) {
            const stringValue = String(value).toLowerCase();
            if (stringValue.includes(term) || key.includes(term)) {
              highlightedAttributes.push(key);
              score += 5;
            }
          }
        }
        
        if (metadataStr.includes(term)) {
          score += 5;
          
          // Find which metadata matched
          for (const [key, value] of Object.entries(person.metadata)) {
            const stringValue = String(value).toLowerCase();
            if (stringValue.includes(term) || key.includes(term)) {
              highlightedAttributes.push(key);
              score += 3;
            }
          }
        }
      }
      
      // Direct matches in specific attributes are more valuable
      const genderTerms = ["man", "woman", "male", "female", "boy", "girl"];
      const ageTerms = ["child", "kid", "teen", "young", "adult", "old", "elderly"];
      const clothingTerms = ["shirt", "jacket", "pants", "jeans", "dress", "hoodie", "hat"];
      const colorTerms = ["red", "blue", "green", "black", "white", "yellow", "orange", "purple", "brown"];
      
      // Check for important attribute matches
      if (genderTerms.some(term => lowerQuery.includes(term))) {
        if (person.description.gender && lowerQuery.includes(person.description.gender.toLowerCase())) {
          score += 20;
          highlightedAttributes.push("gender");
        }
      }
      
      if (ageTerms.some(term => lowerQuery.includes(term))) {
        if (person.description.age_group && lowerQuery.includes(person.description.age_group.toLowerCase())) {
          score += 20;
          highlightedAttributes.push("age_group");
        }
      }
      
      // Check for clothing and color combinations
      for (const clothingTerm of clothingTerms) {
        if (lowerQuery.includes(clothingTerm)) {
          for (const [key, value] of Object.entries(person.description)) {
            if (key.includes("clothing") && String(value).toLowerCase().includes(clothingTerm)) {
              score += 20;
              highlightedAttributes.push(key);
            }
          }
        }
      }
      
      for (const colorTerm of colorTerms) {
        if (lowerQuery.includes(colorTerm)) {
          for (const [key, value] of Object.entries(person.description)) {
            if (key.includes("color") && String(value).toLowerCase().includes(colorTerm)) {
              score += 20;
              highlightedAttributes.push(key);
            }
          }
        }
      }
      
      // Generate explanation
      let explanation = '';
      if (score > 50) {
        explanation = `Strong match based on ${highlightedAttributes.join(', ')}.`;
      } else if (score > 20) {
        explanation = `Moderate match found in ${highlightedAttributes.join(', ')}.`;
      } else if (score > 0) {
        explanation = `Weak match on limited attributes.`;
      } else {
        explanation = 'No significant matching attributes found.';
      }
      
      // Scale score to 0-100
      const normalizedScore = Math.min(100, Math.max(0, score));
      
      return {
        id: person.id,
        relevance_score: normalizedScore,
        explanation,
        highlighted_attributes: [...new Set(highlightedAttributes)],
        person
      };
    });
    
    // Sort people by score
    const sortedPeople = scoredPeople
      .filter(p => p.relevance_score > 0)  // Only include matches
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, 5);  // Take top 5
    
    // Create response
    let responseText = '';
    if (sortedPeople.length > 0) {
      responseText = `Found ${sortedPeople.length} potential matches for "${query}".`;
    } else {
      responseText = `No matches found for "${query}". Try using more descriptive terms about appearance, clothing, or location.`;
    }
    
    return {
      response: responseText,
      matches: sortedPeople
    };
  };

  const handleCameraSelect = (cameraId: string | undefined) => {
    if (!cameraId) return;
    const camera = cameras.find(c => c.id === cameraId);
    if (camera) {
      setSelectedCamera(camera);
    }
  };
  
  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch (e) {
      return 'Unknown time';
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Search bar */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Describe the person you're looking for..."
              className="pl-10 bg-gray-800 border-gray-700 text-white"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            onClick={handleSearch}
            disabled={isSearching || !searchTerm.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSearching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              'Search'
            )}
          </Button>
        </div>
      </div>

      {/* Results area */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-400">Loading database...</span>
          </div>
        ) : error ? (
          <div className="text-red-500 text-center p-4">
            {error}
          </div>
        ) : searchResults ? (
          <div className="space-y-4">
            {/* Response message */}
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
              <p className="text-gray-200">{searchResults.response}</p>
            </div>

            {/* Results list */}
            {searchResults.matches.length > 0 ? (
              <div className="space-y-4">
                {searchResults.matches.map((match) => (
                  <motion.div
                    key={match.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 shadow-lg"
                  >
                    <div className="bg-gradient-to-r from-blue-900 to-gray-800 px-4 py-2 border-b border-gray-700">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center">
                          <h3 className="text-sm font-medium text-white">
                            Person {match.id.substring(0, 8)}
                          </h3>
                          <div className="ml-3 px-2 py-1 bg-green-900/60 text-green-300 rounded-full text-xs">
                            {match.relevance_score}% match
                          </div>
                        </div>
                        <div className="text-xs text-gray-300 flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {match.person.metadata.timestamp 
                            ? formatTimestamp(match.person.metadata.timestamp) 
                            : 'Unknown time'}
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4">
                      {/* Match explanation */}
                      <div className="mb-3 text-sm text-gray-300 italic">
                        {match.explanation}
                      </div>
                      
                      {/* Highlighted attributes */}
                      {match.highlighted_attributes.length > 0 && (
                        <div className="mb-3">
                          <div className="text-xs text-gray-400 mb-1">Matched attributes:</div>
                          <div className="flex flex-wrap gap-1">
                            {match.highlighted_attributes.map((attr) => (
                              <span 
                                key={attr} 
                                className="px-2 py-1 bg-blue-900/40 text-blue-300 rounded-full text-xs"
                              >
                                {attr.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Person details */}
                      <div className="bg-gray-900 p-3 rounded-md text-sm text-gray-300">
                        <div className="grid grid-cols-2 gap-2">
                          {match.person.description.gender && (
                            <div>
                              <span className="text-blue-400 font-medium">Gender:</span>{' '}
                              {match.person.description.gender}
                            </div>
                          )}
                          {match.person.description.age_group && (
                            <div>
                              <span className="text-blue-400 font-medium">Age:</span>{' '}
                              {match.person.description.age_group}
                            </div>
                          )}
                          {match.person.description.clothing_top && (
                            <div>
                              <span className="text-blue-400 font-medium">Top:</span>{' '}
                              {match.person.description.clothing_top_color 
                                ? `${match.person.description.clothing_top_color} ` 
                                : ''}
                              {match.person.description.clothing_top}
                            </div>
                          )}
                          {match.person.description.clothing_bottom && (
                            <div>
                              <span className="text-blue-400 font-medium">Bottom:</span>{' '}
                              {match.person.description.clothing_bottom_color 
                                ? `${match.person.description.clothing_bottom_color} ` 
                                : ''}
                              {match.person.description.clothing_bottom}
                            </div>
                          )}
                          {match.person.metadata.camera_id && (
                            <div className="col-span-2">
                              <span className="text-blue-400 font-medium">Camera:</span>{' '}
                              {match.person.metadata.camera_id}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Camera button */}
                      <Button
                        variant="outline" 
                        size="sm"
                        className="w-full mt-3 text-xs text-blue-400 hover:text-blue-300 border-gray-700"
                        onClick={() => handleCameraSelect(match.person.metadata.camera_id)}
                      >
                        <Camera className="h-3 w-3 mr-1" />
                        View Camera Feed
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-gray-400 text-center p-4">
                No matches found. Try refining your search with more details.
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <User className="h-12 w-12 text-gray-700 mb-4" />
            <h3 className="text-lg text-gray-300 mb-2">Personalized Search</h3>
            <p className="text-gray-500 max-w-md">
              Search for people using natural language descriptions like "man wearing red shirt" 
              or "woman with blonde hair near entrance"
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 