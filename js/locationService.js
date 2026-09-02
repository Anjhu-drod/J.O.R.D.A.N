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

async function fetchJson(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "Accept-Language": "pt-BR,pt;q=0.9" },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`http-${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

const CATEGORY_CONFIG = {
  fuel: { tag: '["amenity"="fuel"]', label: "posto de combustível", fallback: "Posto de combustível" },
  pharmacy: { tag: '["amenity"="pharmacy"]', label: "farmácia", fallback: "Farmácia" },
  hospital: { tag: '["amenity"="hospital"]', label: "hospital", fallback: "Hospital" },
  supermarket: { tag: '["shop"="supermarket"]', label: "supermercado", fallback: "Supermercado" },
  restaurant: { tag: '["amenity"="restaurant"]', label: "restaurante", fallback: "Restaurante" }
};

export class LocationService {
  async currentPosition() {
    const position = await getCurrentPosition();
    return {
      lat: position.coords.latitude,
      lon: position.coords.longitude,
      accuracy: position.coords.accuracy
    };
  }

  async nearest(category = "fuel", { radius = 6000, limit = 5 } = {}) {
    if (!navigator.onLine) throw new Error("offline");
    const config = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.fuel;
    const position = await this.currentPosition();
    const { lat, lon } = position;

    const query = `[out:json][timeout:18];(
      node${config.tag}(around:${radius},${lat},${lon});
      way${config.tag}(around:${radius},${lat},${lon});
      relation${config.tag}(around:${radius},${lat},${lon});
    );out center tags;`;

    const endpoint = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 19000);

    try {
      const response = await fetch(endpoint, {
        headers: { Accept: "application/json" },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`overpass-${response.status}`);
      const data = await response.json();

      const places = (data.elements ?? [])
        .map((item) => {
          const placeLat = item.lat ?? item.center?.lat;
          const placeLon = item.lon ?? item.center?.lon;
          if (!Number.isFinite(placeLat) || !Number.isFinite(placeLon)) return null;

          const tags = item.tags ?? {};
          return {
            id: `${item.type}-${item.id}`,
            name: tags.name || tags.brand || config.fallback,
            brand: tags.brand || "",
            address: [tags["addr:street"], tags["addr:housenumber"], tags["addr:city"]].filter(Boolean).join(", "),
            lat: placeLat,
            lon: placeLon,
            distanceMeters: distanceMeters(lat, lon, placeLat, placeLon),
            mapsUrl: this.buildDirectionsUrl(`${placeLat},${placeLon}`, position)
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.distanceMeters - b.distanceMeters)
        .slice(0, limit)
        .map((item) => ({ ...item, distanceLabel: readableDistance(item.distanceMeters) }));

      return { category, label: config.label, position, places };
    } finally {
      clearTimeout(timeout);
    }
  }

  async geocode(destination) {
    if (!navigator.onLine) throw new Error("offline");
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.search = new URLSearchParams({
      q: destination,
      format: "jsonv2",
      limit: "1",
      addressdetails: "1"
    }).toString();
    const results = await fetchJson(url, 10000);
    const hit = results?.[0];
    if (!hit) return null;
    return {
      name: hit.display_name,
      lat: Number(hit.lat),
      lon: Number(hit.lon)
    };
  }

  buildDirectionsUrl(destination, origin = null) {
    const url = new URL("https://www.google.com/maps/dir/");
    const params = {
      api: "1",
      destination: typeof destination === "string" ? destination : `${destination.lat},${destination.lon}`,
      travelmode: "driving"
    };
    if (origin?.lat != null && origin?.lon != null) params.origin = `${origin.lat},${origin.lon}`;
    url.search = new URLSearchParams(params).toString();
    return url.toString();
  }

  async directionsTo(destination) {
    if (!destination?.trim()) throw new Error("destination-missing");
    const position = await this.currentPosition();
    let target = null;

    if (navigator.onLine) {
      try {
        target = await this.geocode(destination);
      } catch {
        target = null;
      }
    }

    if (target) {
      const distance = distanceMeters(position.lat, position.lon, target.lat, target.lon);
      return {
        destinationQuery: destination,
        destinationName: target.name,
        target,
        position,
        straightDistanceMeters: distance,
        straightDistanceLabel: readableDistance(distance),
        mapsUrl: this.buildDirectionsUrl(target, position)
      };
    }

    return {
      destinationQuery: destination,
      destinationName: destination,
      target: null,
      position,
      straightDistanceMeters: null,
      straightDistanceLabel: "—",
      mapsUrl: this.buildDirectionsUrl(destination, position)
    };
  }

  nearestFuel(options = {}) {
    return this.nearest("fuel", options);
  }

  mapsSearchUrl(query = "gas station") {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }
}
