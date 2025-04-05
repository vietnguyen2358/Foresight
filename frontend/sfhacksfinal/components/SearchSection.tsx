"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Filter, Clock, MapPin, User, Calendar, ChevronDown, ChevronUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { searchPerson, type SearchResult } from "@/lib/api"

// Mock data for individuals
const mockPeople = [
  {
    id: "P001",
    description: "Male, mid-30s, wearing a red jacket and black jeans",
    location: "Market Street & 5th",
    time: "2:30 PM",
    date: "Today",
    camera: "SF-MKT-001",
    attributes: {
      gender: "Male",
      ageRange: "30-40",
      height: "Medium",
      build: "Average",
      hairColor: "Brown",
      clothing: ["Red jacket", "Black jeans", "White sneakers"],
    },
  },
  {
    id: "P002",
    description: "Female, early 20s, blue dress with white handbag",
    location: "Embarcadero Plaza",
    time: "11:45 AM",
    date: "Today",
    camera: "SF-EMB-002",
    attributes: {
      gender: "Female",
      ageRange: "20-30",
      height: "Short",
      build: "Slim",
      hairColor: "Blonde",
      clothing: ["Blue dress", "White handbag", "Sandals"],
    },
  },
  {
    id: "P003",
    description: "Male, teenager, green hoodie and backpack",
    location: "Union Square",
    time: "3:15 PM",
    date: "Yesterday",
    camera: "SF-UNS-003",
    attributes: {
      gender: "Male",
      ageRange: "15-20",
      height: "Tall",
      build: "Slim",
      hairColor: "Black",
      clothing: ["Green hoodie", "Black backpack", "Jeans"],
    },
  },
  {
    id: "P004",
    description: "Female, middle-aged, yellow coat and glasses",
    location: "Ferry Building",
    time: "9:20 AM",
    date: "Today",
    camera: "SF-FER-004",
    attributes: {
      gender: "Female",
      ageRange: "40-50",
      height: "Medium",
      build: "Average",
      hairColor: "Brown",
      clothing: ["Yellow coat", "Black pants", "Glasses"],
    },
  },
  {
    id: "P005",
    description: "Male, elderly, gray suit with cane",
    location: "Chinatown Gate",
    time: "1:05 PM",
    date: "Yesterday",
    camera: "SF-CHI-005",
    attributes: {
      gender: "Male",
      ageRange: "60+",
      height: "Short",
      build: "Thin",
      hairColor: "Gray",
      clothing: ["Gray suit", "Blue tie", "Using a cane"],
    },
  },
  {
    id: "P006",
    description: "Female, young adult, purple hair with leather jacket",
    location: "Mission District",
    time: "8:50 PM",
    date: "Yesterday",
    camera: "SF-MIS-006",
    attributes: {
      gender: "Female",
      ageRange: "20-30",
      height: "Medium",
      build: "Average",
      hairColor: "Purple (dyed)",
      clothing: ["Black leather jacket", "Ripped jeans", "Boots"],
    },
  },
  {
    id: "P007",
    description: "Male, young adult, white t-shirt and baseball cap",
    location: "Haight Street",
    time: "4:30 PM",
    date: "Today",
    camera: "SF-HAI-007",
    attributes: {
      gender: "Male",
      ageRange: "20-30",
      height: "Tall",
      build: "Athletic",
      hairColor: "Brown",
      clothing: ["White t-shirt", "Blue baseball cap", "Khaki shorts"],
    },
  },
  {
    id: "P008",
    description: "Female, middle-aged, business suit with briefcase",
    location: "Nob Hill",
    time: "8:15 AM",
    date: "Today",
    camera: "SF-NOB-008",
    attributes: {
      gender: "Female",
      ageRange: "40-50",
      height: "Medium",
      build: "Slim",
      hairColor: "Black",
      clothing: ["Navy business suit", "Red blouse", "Carrying briefcase"],
    },
  },
]

export default function SearchSection() {
  const [searchQuery, setSearchQuery] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    gender: "",
    ageRange: "",
    timeOfDay: "",
    date: "",
    location: "",
    clothing: {
      red: false,
      blue: false,
      green: false,
      black: false,
      white: false,
      yellow: false,
    },
  })

  const [results, setResults] = useState<SearchResult["matches"]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Handle search
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const searchResults = await searchPerson(searchQuery);
      setResults(searchResults.matches || []);
    } catch (err) {
      console.error("Search error:", err);
      setError("Failed to perform search. Please try again.");
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }

  // Reset filters
  const resetFilters = () => {
    setFilters({
      gender: "",
      ageRange: "",
      timeOfDay: "",
      date: "",
      location: "",
      clothing: {
        red: false,
        blue: false,
        green: false,
        black: false,
        white: false,
        yellow: false,
      },
    })
    setSearchQuery("")
    setResults([])
  }

  // Get unique locations for filter dropdown
  const locations = [...new Set(mockPeople.map((person) => person.location))]

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <div className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Describe who you're looking for..."
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <Button onClick={handleSearch} disabled={isLoading}>
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {showFilters ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
          </Button>
        </div>

        {error && (
          <div className="text-red-500 text-sm">{error}</div>
        )}

        {isLoading && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          </div>
        )}

        {results.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.map((result, index) => (
              <Card key={index} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-2">
                    {result.image_data && (
                      <img
                        src={`data:image/jpeg;base64,${result.image_data}`}
                        alt={`Match ${index + 1}`}
                        className="w-full h-48 object-cover rounded-lg"
                      />
                    )}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary">
                          {result.similarity.toFixed(1)}% Match
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm">
                          <span className="font-semibold">Gender:</span> {result.description.gender || "N/A"}
                        </p>
                        <p className="text-sm">
                          <span className="font-semibold">Age:</span> {result.description.age_group || "N/A"}
                        </p>
                        <p className="text-sm">
                          <span className="font-semibold">Clothing:</span>{" "}
                          {result.description.clothing_top
                            ? `${result.description.clothing_top} (${result.description.clothing_top_color || "N/A"})`
                            : "N/A"}
                        </p>
                        {result.description.clothing_bottom && (
                          <p className="text-sm">
                            <span className="font-semibold">Bottom:</span>{" "}
                            {`${result.description.clothing_bottom} (${result.description.clothing_bottom_color || "N/A"})`}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !isLoading && searchQuery && (
          <div className="text-center py-8 text-gray-500">
            No matches found. Try adjusting your search criteria.
          </div>
        )}
      </div>
    </div>
  )
}

