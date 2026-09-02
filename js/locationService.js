function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("geolocation-unavailable"));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 60000,
      ...options
    });
  });
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (value) => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function readableDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}

export class LocationService {
  async nearestFuel({ radius = 6000, limit = 5 } = {}) {
    if (!navigator.onLine) throw new Error("offline");
    const position = await getCurrentPosition();
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;

    const query = `[out:json][timeout:18];(
      node["amenity"="fuel"](around:${radius},${lat},${lon});
      way["amenity"="fuel"](around:${radius},${lat},${lon});
      relation["amenity"="fuel"](around:${radius},${lat},${lon});
    );out center tags;`;

    const endpoint = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`overpass-${response.status}`);
    const data = await response.json();

    const places = (data.elements ?? []).map((item) => {
      const placeLat = item.lat ?? item.center?.lat;
      const placeLon = item.lon ?? item.center?.lon;
      if (!Number.isFinite(placeLat) || !Number.isFinite(placeLon)) return null;

      const tags = item.tags ?? {};
      return {
        id: `${item.type}-${item.id}`,
        name: tags.name || tags.brand || "Posto de combustível",
        brand: tags.brand || "",
        address: [tags["addr:street"], tags["addr:housenumber"], tags["addr:city"]].filter(Boolean).join(", "),
        lat: placeLat,
        lon: placeLon,
        distanceMeters: distanceMeters(lat, lon, placeLat, placeLon)
      };
    }).filter(Boolean)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, limit)
      .map((item) => ({ ...item, distanceLabel: readableDistance(item.distanceMeters) }));

    return {
      position: { lat, lon, accuracy: position.coords.accuracy },
      places
    };
  }

  mapsSearchUrl(query = "gas station") {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }
}
