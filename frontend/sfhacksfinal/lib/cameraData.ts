// Camera data with real lat/lng coordinates for San Francisco
export interface Camera {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: string;
}

export const cameras: Camera[] = [
  {
    id: "SF-MKT-001",
    name: "Market Street & 5th",
    lat: 37.783,
    lng: -122.407,
    status: "active",
  },
  {
    id: "SF-UNS-003",
    name: "Union Square",
    lat: 37.788,
    lng: -122.407,
    status: "active",
  },
  {
    id: "SF-MIS-006",
    name: "Mission District",
    lat: 37.763,
    lng: -122.419,
    status: "active",
  },
  {
    id: "SF-HAI-007",
    name: "Haight Street",
    lat: 37.77,
    lng: -122.446,
    status: "active",
  },
  {
    id: "SF-NOB-008",
    name: "Nob Hill",
    lat: 37.793,
    lng: -122.416,
    status: "active",
  },
]; 