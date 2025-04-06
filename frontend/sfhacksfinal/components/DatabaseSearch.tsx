"use client"

import React, { useState, useEffect } from 'react';
import { Search, Filter, X, Camera, MapPin, Clock, User, Tag, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCamera } from '@/lib/CameraContext';
import { API_BASE_URL } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';

// Define the database data structure
interface DatabaseData {
  people: Person[];
}

interface Person {
  id: string;
  description: {
    gender?: string;
    age_group?: string;
    clothing_top?: string;
    clothing_bottom?: string;
    pose?: string;
    location_context?: string;
    hair_style?: string;
    hair_color?: string;
    skin_tone?: string;
    facial_features?: string;
    accessories?: string;
    [key: string]: any;
  };
  metadata: {
    camera_id?: string;
    timestamp?: string;
    image_path?: string;
    [key: string]: any;
  };
  cropped_image?: string;
}

// Function to add a person from camera view to the database
export const addPersonToDatabase = async (personData: any) => {
  try {
    // Create a new person object with the required structure
    const newPerson = {
      id: personData.id || `person_${Date.now()}`,
      description: {
        gender: personData.description?.gender || personData.gender || 'unknown',
        age_group: personData.description?.age_group || personData.age_group || 'unknown',
        clothing_top: personData.description?.clothing_top || personData.clothing_top || 'unknown',
        clothing_bottom: personData.description?.clothing_bottom || personData.clothing_bottom || 'unknown',
        pose: personData.description?.pose || personData.pose || 'unknown',
        location_context: personData.description?.location_context || personData.location_context || 'outdoor',
        hair_style: personData.description?.hair_style || personData.hair_style,
        hair_color: personData.description?.hair_color || personData.hair_color,
        skin_tone: personData.description?.skin_tone || personData.skin_tone,
        facial_features: personData.description?.facial_features || personData.facial_features,
        accessories: personData.description?.accessories || personData.accessories,
        clothing_top_color: personData.description?.clothing_top_color || personData.clothing_top_color,
        clothing_bottom_color: personData.description?.clothing_bottom_color || personData.clothing_bottom_color,
        clothing_top_pattern: personData.description?.clothing_top_pattern || personData.clothing_top_pattern,
        clothing_bottom_pattern: personData.description?.clothing_bottom_pattern || personData.clothing_bottom_pattern,
        footwear: personData.description?.footwear || personData.footwear,
        footwear_color: personData.description?.footwear_color || personData.footwear_color,
        ...personData.description
      },
      metadata: {
        camera_id: personData.metadata?.camera_id || personData.camera_id || 'unknown',
        timestamp: personData.metadata?.timestamp || personData.timestamp || new Date().toISOString(),
        image_path: personData.metadata?.image_path || personData.image_path || '',
        track_id: personData.metadata?.track_id || personData.track_id || `person_${Date.now()}`,
        frame: personData.metadata?.frame || personData.frame || -1,
        ...personData.metadata
      }
    };
    
    // Send to the API endpoint for duplicate checking and adding
    const response = await fetch('/api/people_database', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newPerson),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to add person: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // Return the result indicating if it was a duplicate
    return result;
  } catch (error) {
    console.error('Error adding person to database:', error);
    throw error;
  }
};

export default function DatabaseSearch() {
  const { selectedCamera, setSelectedCamera, cameras } = useCamera();
  const [searchTerm, setSearchTerm] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [filteredPeople, setFilteredPeople] = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [databaseData, setDatabaseData] = useState<DatabaseData>({ people: [] });

  // Load people from the JSON data
  useEffect(() => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Load data directly from the public/db.json file
      fetch('/db.json')
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to fetch database: ${response.statusText}`);
          }
          return response.json();
        })
        .then(data => {
          // Transform data and add image URLs
          const loadedPeople = data.people.map((person: any) => {
            // Split the camera_id and person id from metadata for structured identifiers
            const cameraId = person.metadata?.camera_id || 'unknown';
            const personIdParts = person.id.split('-');
            const shortId = personIdParts[0] || 'unknown';
            
            return {
              ...person,
              id: person.id || `${cameraId}:${shortId}`,
              gender: person.description?.gender || 'unknown',
              age_group: person.description?.age_group || 'unknown',
              clothing_top: person.description?.clothing_top || 'unknown',
              clothing_top_color: person.description?.clothing_top_color,
              clothing_bottom: person.description?.clothing_bottom,
              clothing_bottom_color: person.description?.clothing_bottom_color,
              hair_color: person.description?.hair_color,
              camera_id: cameraId,
              timestamp: person.metadata?.timestamp || new Date().toISOString(),
              description: JSON.stringify(person.description),
              raw_data: person.description,
              // Generate a placeholder image URL - in production you'd use real cropped images
              cropped_image: `/images/placeholder-person.png`
            };
          });
          
          // Set the data in state
          setPeople(loadedPeople);
          setFilteredPeople(loadedPeople);
          setDatabaseData({ people: data.people });
          
          // Extract all possible tags
          const tags = new Set<string>();
          
          loadedPeople.forEach((person: Person) => {
            // Extract tags from description
            Object.entries(person.description).forEach(([key, value]) => {
              if (value && typeof value === 'string') {
                tags.add(`${key}:${value}`);
              }
            });
            
            // Extract tags from metadata
            Object.entries(person.metadata).forEach(([key, value]) => {
              if (value && typeof value === 'string') {
                tags.add(`${key}:${value}`);
              }
            });
          });
          
          setAvailableTags(Array.from(tags).sort());
        })
        .catch(error => {
          console.error('Error fetching database:', error);
          setError(`Failed to load database: ${error.message}`);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } catch (error) {
      console.error('Error loading database:', error);
      setError(error instanceof Error ? error.message : 'Unknown error loading database');
      setIsLoading(false);
    }
  }, [refreshKey]);

  // Filter people based on search term and tags
  useEffect(() => {
    let filtered = [...people];
    
    // Apply search term filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(person => {
        // Search in description
        const description = JSON.stringify(person.description).toLowerCase();
        if (description.includes(term)) return true;
        
        // Search in metadata
        const metadata = JSON.stringify(person.metadata).toLowerCase();
        if (metadata.includes(term)) return true;
        
        return false;
      });
    }
    
    // Apply tag filters
    if (selectedTags.length > 0) {
      filtered = filtered.filter(person => {
        return selectedTags.every(tag => {
          const [key, value] = tag.split(':');
          return person.description[key as keyof typeof person.description] === value;
        });
      });
    }
    
    setFilteredPeople(filtered);
  }, [searchTerm, selectedTags, people]);

  // Handle camera selection
  const handleCameraSelect = (cameraId: string | undefined) => {
    if (!cameraId) return;
    const camera = cameras.find(c => c.id === cameraId);
    if (camera) {
      setSelectedCamera(camera);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedTags([]);
  };

  // Toggle a tag
  const toggleTag = (tag: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag);
      } else {
        return [...prev, tag];
      }
    });
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  // Handle image error
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.style.display = 'none';
  };

  // Add a function to refresh the database display
  const refreshDatabase = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Export the refresh function
  useEffect(() => {
    // @ts-ignore
    window.refreshDatabase = refreshDatabase;
    return () => {
      // @ts-ignore
      window.refreshDatabase = undefined;
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Filter bar */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search for people..."
              className="pl-10 bg-gray-800 border-gray-700 text-white"
            />
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowFilters(!showFilters)}
            className="ml-2 text-gray-400 hover:text-white"
          >
            <Filter className="h-4 w-4 mr-1" />
            Filters
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={refreshDatabase}
            className="ml-2 text-blue-400 hover:text-blue-300"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
        
        {/* Active filters */}
        {(searchTerm || selectedTags.length > 0) && (
          <div className="flex flex-wrap gap-2 mt-3">
            {searchTerm && (
              <div className="flex items-center bg-blue-900/50 text-blue-300 px-2 py-1 rounded-full text-xs">
                <span>Search: {searchTerm}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 ml-1 text-blue-300 hover:text-white"
                  onClick={() => setSearchTerm('')}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            {selectedTags.map(tag => (
              <div 
                key={tag} 
                className="flex items-center bg-green-900/50 text-green-300 px-2 py-1 rounded-full text-xs"
              >
                <Tag className="h-3 w-3 mr-1" />
                <span>{tag}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 ml-1 text-green-300 hover:text-white"
                  onClick={() => toggleTag(tag)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-gray-400 hover:text-white"
              onClick={clearFilters}
            >
              Clear all
            </Button>
          </div>
        )}
      </div>
      
      {/* Filter panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-b border-gray-800 overflow-hidden"
          >
            <div className="p-4">
              <h3 className="text-sm font-medium text-white mb-2">Quick Tags</h3>
              <div className="flex flex-wrap gap-2">
                {availableTags.map(tag => (
                  <Button
                    key={tag}
                    variant={selectedTags.includes(tag) ? "default" : "outline"}
                    size="sm"
                    className={`text-xs ${selectedTags.includes(tag) ? 'bg-green-600' : 'bg-gray-800'}`}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="text-red-500 text-center p-4">
            {error}
          </div>
        ) : filteredPeople.length === 0 ? (
          <div className="text-gray-400 text-center p-4">
            No people found matching your criteria
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPeople.map((person) => (
              <motion.div
                key={person.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-gray-800 rounded-lg overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center">
                      <User className="h-4 w-4 text-blue-400 mr-2" />
                      <span className="text-sm font-medium text-white">
                        {person.description.gender || 'Unknown'} {person.description.age_group || ''}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-blue-400 hover:text-blue-300"
                      onClick={() => handleCameraSelect(person.metadata.camera_id)}
                    >
                      View Camera
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-300 mb-3">
                    <div className="flex items-center">
                      <Camera className="h-3 w-3 mr-1 text-gray-400" />
                      <span>{person.metadata.camera_id || 'Unknown Camera'}</span>
                    </div>
                    <div className="flex items-center">
                      <Clock className="h-3 w-3 mr-1 text-gray-400" />
                      <span>{person.metadata.timestamp ? formatTimestamp(person.metadata.timestamp) : 'Unknown Time'}</span>
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-300">
                    {person.description.skin_tone && (
                      <div className="mb-1">
                        <span className="text-gray-400">Skin tone:</span> {person.description.skin_tone}
                      </div>
                    )}
                    {person.description.hair_style && (
                      <div className="mb-1">
                        <span className="text-gray-400">Hair:</span> {person.description.hair_style}
                        {person.description.hair_color && ` (${person.description.hair_color})`}
                      </div>
                    )}
                    {person.description.facial_features && (
                      <div className="mb-1">
                        <span className="text-gray-400">Facial features:</span> {person.description.facial_features}
                      </div>
                    )}
                    {person.description.accessories && (
                      <div className="mb-1">
                        <span className="text-gray-400">Accessories:</span> {person.description.accessories}
                      </div>
                    )}
                    {person.description.clothing_top && (
                      <div className="mb-1">
                        <span className="text-gray-400">Top:</span> {person.description.clothing_top}
                        {person.description.clothing_top_color && ` (${person.description.clothing_top_color})`}
                      </div>
                    )}
                    {person.description.clothing_bottom && (
                      <div className="mb-1">
                        <span className="text-gray-400">Bottom:</span> {person.description.clothing_bottom}
                        {person.description.clothing_bottom_color && ` (${person.description.clothing_bottom_color})`}
                      </div>
                    )}
                    {person.description.footwear && (
                      <div className="mb-1">
                        <span className="text-gray-400">Footwear:</span> {person.description.footwear}
                        {person.description.footwear_color && ` (${person.description.footwear_color})`}
                      </div>
                    )}
                    {person.description.pose && (
                      <div className="mb-1">
                        <span className="text-gray-400">Pose:</span> {person.description.pose}
                      </div>
                    )}
                    {person.description.location_context && (
                      <div>
                        <span className="text-gray-400">Location:</span> {person.description.location_context}
                      </div>
                    )}
                  </div>
                </div>
                
                {person.metadata.image_path && (
                  <div className="h-40 w-full overflow-hidden">
                    <img
                      src={`${API_BASE_URL}/uploads/${person.metadata.image_path.split('/').pop()}`}
                      alt="Person"
                      className="w-full h-full object-cover"
                      onError={handleImageError}
                    />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 