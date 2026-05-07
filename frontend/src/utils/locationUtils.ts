/**
 * Haversine distance from the geographic center of Pennsylvania
 * (near Bellefonte, PA: 40.9176° N, 77.7383° W).
 *
 * Returns distance in miles. Lower = closer to PA.
 * Remote jobs score 50 miles (treated as nearby flexible).
 * Unknown / international locations score 8000+ miles.
 */

const PA_CENTER: [number, number] = [40.9176, -77.7383];

function haversineDistance(
  [lat1, lon1]: [number, number],
  [lat2, lon2]: [number, number]
): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Approximate geographic centers of US states
const STATE_COORDS: Record<string, [number, number]> = {
  AL: [32.799, -86.807], AK: [64.201, -153.494], AZ: [34.274, -111.660],
  AR: [34.894, -92.443], CA: [36.778, -119.418], CO: [39.550, -105.782],
  CT: [41.603, -73.088], DE: [39.319, -75.507], FL: [27.665, -81.516],
  GA: [32.166, -82.900], HI: [19.897, -155.583], ID: [44.068, -114.742],
  IL: [40.633, -89.399], IN: [40.267, -86.135], IA: [41.878, -93.098],
  KS: [38.527, -96.727], KY: [37.668, -84.670], LA: [30.984, -91.962],
  ME: [45.254, -69.446], MD: [39.046, -76.641], MA: [42.407, -71.382],
  MI: [44.315, -85.602], MN: [46.730, -94.686], MS: [32.355, -89.399],
  MO: [37.964, -91.832], MT: [46.880, -110.363], NE: [41.493, -99.902],
  NV: [38.803, -116.419], NH: [43.194, -71.572], NJ: [40.058, -74.406],
  NM: [34.520, -105.870], NY: [42.166, -74.948], NC: [35.760, -79.019],
  ND: [47.552, -101.002], OH: [40.417, -82.907], OK: [35.008, -97.093],
  OR: [43.804, -120.554], PA: [41.203, -77.195], RI: [41.681, -71.512],
  SC: [33.836, -81.164], SD: [43.970, -99.902], TN: [35.518, -86.580],
  TX: [31.969, -99.902], UT: [39.321, -111.094], VT: [44.559, -72.578],
  VA: [37.432, -78.657], WA: [47.751, -120.740], WV: [38.598, -80.455],
  WI: [43.784, -88.788], WY: [43.076, -107.290], DC: [38.907, -77.037],
};

// Major cities (lowercase keys)
const CITY_COORDS: Record<string, [number, number]> = {
  "new york": [40.713, -74.006],
  "new york city": [40.713, -74.006],
  "nyc": [40.713, -74.006],
  "manhattan": [40.758, -73.986],
  "brooklyn": [40.679, -73.944],
  "philadelphia": [39.952, -75.164],
  "philly": [39.952, -75.164],
  "pittsburgh": [40.441, -79.996],
  "harrisburg": [40.261, -76.882],
  "allentown": [40.602, -75.470],
  "state college": [40.793, -77.860],
  "baltimore": [39.290, -76.612],
  "washington": [38.907, -77.037],
  "washington dc": [38.907, -77.037],
  "dc": [38.907, -77.037],
  "boston": [42.360, -71.059],
  "new jersey": [40.058, -74.406],
  "newark": [40.735, -74.172],
  "jersey city": [40.717, -74.043],
  "san francisco": [37.774, -122.419],
  "sf": [37.774, -122.419],
  "bay area": [37.774, -122.419],
  "silicon valley": [37.387, -122.058],
  "san jose": [37.339, -121.894],
  "palo alto": [37.441, -122.143],
  "menlo park": [37.453, -122.182],
  "mountain view": [37.386, -122.084],
  "sunnyvale": [37.369, -122.036],
  "los angeles": [34.052, -118.244],
  "la": [34.052, -118.244],
  "santa monica": [34.019, -118.491],
  "san diego": [32.716, -117.161],
  "seattle": [47.606, -122.332],
  "bellevue": [47.610, -122.201],
  "austin": [30.267, -97.743],
  "dallas": [32.777, -96.797],
  "houston": [29.763, -95.363],
  "denver": [39.739, -104.984],
  "chicago": [41.878, -87.630],
  "miami": [25.774, -80.194],
  "atlanta": [33.749, -84.388],
  "nashville": [36.165, -86.784],
  "charlotte": [35.227, -80.843],
  "raleigh": [35.772, -78.639],
  "durham": [35.994, -78.899],
  "richmond": [37.541, -77.434],
  "cleveland": [41.499, -81.694],
  "columbus": [39.961, -82.999],
  "cincinnati": [39.103, -84.512],
  "detroit": [42.331, -83.046],
  "minneapolis": [44.980, -93.271],
  "phoenix": [33.449, -112.076],
  "las vegas": [36.175, -115.136],
  "salt lake city": [40.761, -111.891],
  "portland": [45.523, -122.676],
  "sacramento": [38.582, -121.494],
  "kansas city": [39.098, -94.578],
  "st louis": [38.627, -90.198],
  "st. louis": [38.627, -90.198],
  "indianapolis": [39.768, -86.158],
  "milwaukee": [43.039, -87.906],
  "tampa": [27.948, -82.458],
  "orlando": [28.538, -81.379],
  // International
  "london": [51.508, -0.128],
  "toronto": [43.653, -79.383],
  "vancouver": [49.283, -123.121],
  "berlin": [52.520, 13.405],
  "paris": [48.857, 2.352],
  "amsterdam": [52.374, 4.899],
  "dublin": [53.333, -6.249],
  "singapore": [1.352, 103.820],
  "bangalore": [12.972, 77.594],
  "bengaluru": [12.972, 77.594],
  "hyderabad": [17.387, 78.480],
  "mumbai": [19.076, 72.878],
  "tokyo": [35.689, 139.692],
  "sydney": [-33.869, 151.209],
  "tel aviv": [32.085, 34.782],
};

export function distanceFromPA(location: string | null): number {
  if (!location) return 9000;
  const loc = location.toLowerCase().trim();

  // Remote → near PA (flexible location, treat as low distance)
  if (/\bremote\b/.test(loc)) return 50;

  // Try city match (longest match wins)
  let bestCity: [number, number] | null = null;
  let bestLen = 0;
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (loc.includes(city) && city.length > bestLen) {
      bestCity = coords;
      bestLen = city.length;
    }
  }
  if (bestCity) return haversineDistance(PA_CENTER, bestCity);

  // Try state abbreviation: e.g. "Philadelphia, PA" or "CA" at end
  const stateMatch = location.match(/,\s*([A-Z]{2})(?:\s|,|$)/);
  if (stateMatch && STATE_COORDS[stateMatch[1]]) {
    return haversineDistance(PA_CENTER, STATE_COORDS[stateMatch[1]]);
  }

  // Try bare 2-letter state code
  const bareState = location.match(/\b([A-Z]{2})\b/);
  if (bareState && STATE_COORDS[bareState[1]]) {
    return haversineDistance(PA_CENTER, STATE_COORDS[bareState[1]]);
  }

  // Unknown / international
  return 8000;
}

// ── India detection ─────────────────────────────────────────────────────────
const INDIA_MARKERS = [
  "india", "bangalore", "bengaluru", "hyderabad", "mumbai", "delhi",
  "chennai", "pune", "kolkata", "noida", "gurgaon", "gurugram",
  "ahmedabad", "jaipur", "lucknow", "coimbatore", "kochi", "chandigarh",
];

/**
 * Returns true if the location is clearly in India.
 * Remote or unknown locations return false.
 */
export function isIndia(location: string | null): boolean {
  if (!location) return false;
  const loc = location.toLowerCase();
  if (/\bremote\b/.test(loc)) return false;
  return INDIA_MARKERS.some((m) => loc.includes(m));
}

// Keywords that indicate a non-US location
const INTERNATIONAL_MARKERS = [
  "united kingdom", "uk", " england", "london", "manchester", "edinburgh",
  "canada", "toronto", "vancouver", "montreal", "ottawa",
  "germany", "berlin", "munich", "hamburg", "frankfurt",
  "france", "paris", "lyon",
  "netherlands", "amsterdam",
  "ireland", "dublin",
  "spain", "madrid", "barcelona",
  "sweden", "stockholm",
  "norway", "oslo",
  "denmark", "copenhagen",
  "finland", "helsinki",
  "switzerland", "zurich", "geneva",
  "australia", "sydney", "melbourne", "brisbane",
  "new zealand", "auckland",
  "singapore",
  "india", "bangalore", "bengaluru", "hyderabad", "mumbai", "delhi", "chennai", "pune",
  "japan", "tokyo", "osaka",
  "china", "beijing", "shanghai", "shenzhen",
  "south korea", "seoul",
  "brazil", "são paulo", "rio de janeiro",
  "mexico", "mexico city",
  "israel", "tel aviv",
  "emea", "apac", "latam", " eu ",
];

/**
 * Returns true if the location is clearly NOT in the USA.
 * Remote or unknown locations return false (treated as potentially US).
 */
export function isInternational(location: string | null): boolean {
  if (!location) return false;
  const loc = location.toLowerCase();
  if (/\bremote\b/.test(loc)) return false; // remote could be US
  return INTERNATIONAL_MARKERS.some((m) => loc.includes(m));
}

export function formatDistance(miles: number): string {
  if (miles <= 50) return "Remote / Flexible";
  if (miles < 100) return `~${Math.round(miles)} mi from PA`;
  if (miles < 1000) return `~${Math.round(miles / 10) * 10} mi from PA`;
  if (miles >= 8000) return "International";
  return `~${Math.round(miles / 100) * 100} mi from PA`;
}
