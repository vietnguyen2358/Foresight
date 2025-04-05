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

  const [results, setResults] = useState(mockPeople)

  // Handle search
  const handleSearch = () => {
    let filtered = [...mockPeople]

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (person) =>
          person.description.toLowerCase().includes(query) ||
          person.location.toLowerCase().includes(query) ||
          person.attributes.clothing.some((item) => item.toLowerCase().includes(query)),
      )
    }

    // Apply filters
    if (filters.gender) {
      filtered = filtered.filter((person) => person.attributes.gender.toLowerCase() === filters.gender.toLowerCase())
    }

    if (filters.ageRange) {
      filtered = filtered.filter((person) => person.attributes.ageRange === filters.ageRange)
    }

    if (filters.timeOfDay) {
      // Simple time of day filtering
      const isAfternoon = (time: string) => {
        const hour = Number.parseInt(time.split(":")[0])
        return hour >= 12
      }

      filtered = filtered.filter((person) => {
        if (filters.timeOfDay === "Morning") {
          return !isAfternoon(person.time)
        } else {
          return isAfternoon(person.time)
        }
      })
    }

    if (filters.date) {
      filtered = filtered.filter((person) => person.date === filters.date)
    }

    if (filters.location) {
      filtered = filtered.filter((person) => person.location === filters.location)
    }

    // Filter by clothing colors
    const selectedColors = Object.entries(filters.clothing)
      .filter(([_, isSelected]) => isSelected)
      .map(([color]) => color)

    if (selectedColors.length > 0) {
      filtered = filtered.filter((person) =>
        person.attributes.clothing.some((item) =>
          selectedColors.some((color) => item.toLowerCase().includes(color.toLowerCase())),
        ),
      )
    }

    setResults(filtered)
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
    setResults(mockPeople)
  }

  // Get unique locations for filter dropdown
  const locations = [...new Set(mockPeople.map((person) => person.location))]

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Search Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by description, location, or clothing..."
              className="pl-9 bg-gray-900 border-gray-800 text-white focus-visible:ring-blue-600"
            />
          </div>
          <Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700">
            Search
          </Button>
          <Button
            variant="outline"
            className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {showFilters ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
          </Button>
        </div>

        {/* Filters Section */}
        {showFilters && (
          <div className="bg-gray-900 rounded-md p-4 border border-gray-800 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Gender Filter */}
              <div>
                <Label className="text-sm text-gray-400 mb-1 block">Gender</Label>
                <Select value={filters.gender} onValueChange={(value) => setFilters({ ...filters, gender: value })}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Any gender" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="any">Any gender</SelectItem>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Age Range Filter */}
              <div>
                <Label className="text-sm text-gray-400 mb-1 block">Age Range</Label>
                <Select value={filters.ageRange} onValueChange={(value) => setFilters({ ...filters, ageRange: value })}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Any age" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="any">Any age</SelectItem>
                    <SelectItem value="15-20">15-20</SelectItem>
                    <SelectItem value="20-30">20-30</SelectItem>
                    <SelectItem value="30-40">30-40</SelectItem>
                    <SelectItem value="40-50">40-50</SelectItem>
                    <SelectItem value="60+">60+</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Time of Day Filter */}
              <div>
                <Label className="text-sm text-gray-400 mb-1 block">Time of Day</Label>
                <Select
                  value={filters.timeOfDay}
                  onValueChange={(value) => setFilters({ ...filters, timeOfDay: value })}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Any time" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="any">Any time</SelectItem>
                    <SelectItem value="Morning">Morning</SelectItem>
                    <SelectItem value="Afternoon">Afternoon/Evening</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Filter */}
              <div>
                <Label className="text-sm text-gray-400 mb-1 block">Date</Label>
                <Select value={filters.date} onValueChange={(value) => setFilters({ ...filters, date: value })}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Any date" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="any">Any date</SelectItem>
                    <SelectItem value="Today">Today</SelectItem>
                    <SelectItem value="Yesterday">Yesterday</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Location Filter */}
              <div>
                <Label className="text-sm text-gray-400 mb-1 block">Location</Label>
                <Select value={filters.location} onValueChange={(value) => setFilters({ ...filters, location: value })}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Any location" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="any">Any location</SelectItem>
                    {locations.map((location) => (
                      <SelectItem key={location} value={location}>
                        {location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Clothing Color Filters */}
              <div>
                <Label className="text-sm text-gray-400 mb-1 block">Clothing Colors</Label>
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="red"
                      checked={filters.clothing.red}
                      onCheckedChange={(checked) =>
                        setFilters({
                          ...filters,
                          clothing: { ...filters.clothing, red: checked === true },
                        })
                      }
                    />
                    <label
                      htmlFor="red"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-white"
                    >
                      Red
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="blue"
                      checked={filters.clothing.blue}
                      onCheckedChange={(checked) =>
                        setFilters({
                          ...filters,
                          clothing: { ...filters.clothing, blue: checked === true },
                        })
                      }
                    />
                    <label
                      htmlFor="blue"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-white"
                    >
                      Blue
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="green"
                      checked={filters.clothing.green}
                      onCheckedChange={(checked) =>
                        setFilters({
                          ...filters,
                          clothing: { ...filters.clothing, green: checked === true },
                        })
                      }
                    />
                    <label
                      htmlFor="green"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-white"
                    >
                      Green
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="black"
                      checked={filters.clothing.black}
                      onCheckedChange={(checked) =>
                        setFilters({
                          ...filters,
                          clothing: { ...filters.clothing, black: checked === true },
                        })
                      }
                    />
                    <label
                      htmlFor="black"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-white"
                    >
                      Black
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="white"
                      checked={filters.clothing.white}
                      onCheckedChange={(checked) =>
                        setFilters({
                          ...filters,
                          clothing: { ...filters.clothing, white: checked === true },
                        })
                      }
                    />
                    <label
                      htmlFor="white"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-white"
                    >
                      White
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="yellow"
                      checked={filters.clothing.yellow}
                      onCheckedChange={(checked) =>
                        setFilters({
                          ...filters,
                          clothing: { ...filters.clothing, yellow: checked === true },
                        })
                      }
                    />
                    <label
                      htmlFor="yellow"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-white"
                    >
                      Yellow
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button
                variant="outline"
                className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white mr-2"
                onClick={resetFilters}
              >
                Reset Filters
              </Button>
              <Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700">
                Apply Filters
              </Button>
            </div>
          </div>
        )}

        {/* Results count */}
        <div className="text-sm text-gray-400">
          Found {results.length} {results.length === 1 ? "person" : "people"} matching your search
        </div>
      </div>

      {/* Results Section */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-950">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.length > 0 ? (
            results.map((person) => (
              <Card key={person.id} className="bg-gray-900 border-gray-800 hover:border-blue-600 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0">
                      <User className="h-6 w-6 text-gray-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-medium mb-1">Person {person.id}</h3>
                      <p className="text-gray-300 text-sm mb-3">{person.description}</p>

                      <div className="flex flex-wrap gap-1 mb-3">
                        <Badge variant="outline" className="bg-gray-800 text-blue-400 border-blue-800 text-xs">
                          {person.attributes.gender}
                        </Badge>
                        <Badge variant="outline" className="bg-gray-800 text-blue-400 border-blue-800 text-xs">
                          {person.attributes.ageRange}
                        </Badge>
                        <Badge variant="outline" className="bg-gray-800 text-blue-400 border-blue-800 text-xs">
                          {person.attributes.height}
                        </Badge>
                      </div>

                      <div className="flex items-center text-xs text-gray-400 mb-1">
                        <MapPin className="h-3 w-3 mr-1" />
                        {person.location}
                      </div>

                      <div className="flex items-center text-xs text-gray-400 mb-1">
                        <Clock className="h-3 w-3 mr-1" />
                        {person.time}
                      </div>

                      <div className="flex items-center text-xs text-gray-400">
                        <Calendar className="h-3 w-3 mr-1" />
                        {person.date}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-500">
              <Search className="h-12 w-12 mb-4 opacity-20" />
              <h3 className="text-lg font-medium mb-1">No results found</h3>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

