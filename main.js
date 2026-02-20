const statusEl = document.getElementById("status");
const outputEl = document.getElementById("output");
const WEATHER_API_KEY = "d38e722d38f23ebea9f35e0ab9176154";

function setStatus(message){
  statusEl.textContent = message;
}

function setOutput(text){
  outputEl.textContent = "";
  outputEl.classList.remove("html-mode");
  outputEl.textContent = text;
}

function setOutputHtml(html){
  outputEl.textContent = "";
  outputEl.classList.add("html-mode");
  outputEl.innerHTML = html;
}

function onClick(id, handler){
  const element = document.getElementById(id);
  if(!element) return;

  element.addEventListener("click", async (event) => {
    document.querySelectorAll(".card.is-selected").forEach((card) => {
      card.classList.remove("is-selected");
    });

    element.classList.add("is-selected");
    element.classList.remove("is-done");
    element.classList.remove("is-error");

    try{
      const result = handler(event);
      if(result && typeof result.then === "function"){
        element.classList.add("is-busy");
        element.setAttribute("aria-busy", "true");
        await result;
      }

      element.classList.add("is-done");
      window.setTimeout(() => {
        element.classList.remove("is-done");
      }, 900);
    }catch(error){
      element.classList.add("is-error");
      window.setTimeout(() => {
        element.classList.remove("is-error");
      }, 1200);
    }finally{
      element.classList.remove("is-busy");
      element.removeAttribute("aria-busy");
    }
  });
}

async function fetchDirectionsToDestination(originLat, originLon, destLat, destLon){
  const apiUrl = new URL("/api/directions", window.location.origin);
  apiUrl.searchParams.set("originLat", String(originLat));
  apiUrl.searchParams.set("originLon", String(originLon));
  apiUrl.searchParams.set("destLat", String(destLat));
  apiUrl.searchParams.set("destLon", String(destLon));

  const response = await fetch(apiUrl.toString());
  const payload = await response.json();
  if(!response.ok){
    throw new Error(payload?.error || `Directions API error: ${response.status}`);
  }
  return payload;
}

function attachOpenRouteHandler(){
  document.addEventListener("click", async (event) => {
    const trigger = event.target?.closest?.(".js-open-route");
    if(!trigger) return;

    event.preventDefault();
    const destLat = Number(trigger.getAttribute("data-lat"));
    const destLon = Number(trigger.getAttribute("data-lon"));
    const placeName = trigger.getAttribute("data-name") || "destination";

    if(Number.isNaN(destLat) || Number.isNaN(destLon)){
      setStatus("Route failed.");
      setOutput("Invalid destination coordinates for navigation.");
      return;
    }

    try{
      setStatus("Getting your location for navigation...");
      const position = await getCurrentPosition();
      const originLat = position.coords.latitude;
      const originLon = position.coords.longitude;

      setStatus("Calculating route...");
      const routeData = await fetchDirectionsToDestination(originLat, originLon, destLat, destLon);
      setStatus(`Route ready: ${routeData.distanceText} - ${routeData.durationText}`);

      setOutputHtml(`
        <div class="route-summary-card">
          <div class="route-summary-title">Route to ${escapeHtml(placeName)}</div>
          <div class="route-summary-line"><strong>Distance:</strong> ${escapeHtml(routeData.distanceText)}</div>
          <div class="route-summary-line"><strong>ETA:</strong> ${escapeHtml(routeData.durationText)}</div>
          <div class="route-summary-line"><strong>From:</strong> ${escapeHtml(routeData.startAddress || "Current location")}</div>
          <div class="route-summary-line"><strong>To:</strong> ${escapeHtml(routeData.endAddress || placeName)}</div>
          <a class="route-summary-link" href="${routeData.googleMapsUrl}" target="_blank" rel="noopener noreferrer">Open navigation in Google Maps</a>
        </div>
      `);

      window.open(routeData.googleMapsUrl, "_blank", "noopener,noreferrer");
    }catch(error){
      setStatus("Route failed.");
      const geoMessage = formatGeoError(error);
      setOutput(geoMessage ?? `Could not open route. ${error?.message ?? ""}`.trim());
    }
  });
}

function getCurrentPosition(){
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 300000
    });
  });
}

function weatherCodeToText(code){
  const map = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Freezing drizzle",
    57: "Heavy freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail",
    99: "Severe thunderstorm with hail"
  };
  return map[code] ?? "Unknown";
}

function weatherCodeToIcon(code){
  if(code === 0) return "☀️";
  if(code === 1 || code === 2) return "⛅";
  if(code === 3) return "☁️";
  if(code === 45 || code === 48) return "🌫️";
  if((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "🌧️";
  if(code >= 71 && code <= 77) return "❄️";
  if(code === 95 || code === 96 || code === 99) return "⛈️";
  return "🌤️";
}

function weatherIconFromOwm(iconCode){
  const map = {
    "01d": "☀️",
    "01n": "🌙",
    "02d": "🌤️",
    "02n": "☁️",
    "03d": "☁️",
    "03n": "☁️",
    "04d": "☁️",
    "04n": "☁️",
    "09d": "🌧️",
    "09n": "🌧️",
    "10d": "🌦️",
    "10n": "🌧️",
    "11d": "⛈️",
    "11n": "⛈️",
    "13d": "❄️",
    "13n": "❄️",
    "50d": "🌫️",
    "50n": "🌫️"
  };
  return map[iconCode] ?? "🌤️";
}

function buildGoogleTrafficUrl(lat, lon){
  return `https://www.google.com/maps/@${lat},${lon},12z/data=!5m1!1e1`;
}

function isTruthyOsmValue(value){
  if(typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "yes" || normalized === "true" || normalized === "1" || normalized === "designated";
}

function getElementLatLon(element){
  if(typeof element?.lat === "number" && typeof element?.lon === "number"){
    return { lat: element.lat, lon: element.lon };
  }
  if(typeof element?.center?.lat === "number" && typeof element?.center?.lon === "number"){
    return { lat: element.center.lat, lon: element.center.lon };
  }
  return null;
}

function toRadians(value){
  return (value * Math.PI) / 180;
}

function haversineKm(aLat, aLon, bLat, bLon){
  const earthRadiusKm = 6371;
  const dLat = toRadians(bLat - aLat);
  const dLon = toRadians(bLon - aLon);
  const aa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(aLat)) * Math.cos(toRadians(bLat)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return earthRadiusKm * c;
}

function kmToMiles(km){
  return km * 0.621371;
}

function milesToKm(miles){
  return miles / 0.621371;
}

function escapeHtml(value){
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

async function fetchDieselDefStations(lat, lon, radiusMeters = 25000){
  const query = `
[out:json][timeout:25];
(
  node(around:${radiusMeters},${lat},${lon})["amenity"="fuel"]["fuel:diesel"="yes"];
  way(around:${radiusMeters},${lat},${lon})["amenity"="fuel"]["fuel:diesel"="yes"];
  relation(around:${radiusMeters},${lat},${lon})["amenity"="fuel"]["fuel:diesel"="yes"];
);
out center tags;`;

  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
    },
    body: `data=${encodeURIComponent(query)}`
  });

  if(!response.ok){
    throw new Error(`Overpass API error: ${response.status}`);
  }

  const payload = await response.json();
  const rows = Array.isArray(payload?.elements) ? payload.elements : [];

  return rows
    .map((element) => {
      const coords = getElementLatLon(element);
      if(!coords) return null;

      const tags = element.tags ?? {};
      const hasDef =
        isTruthyOsmValue(tags["fuel:adblue"]) ||
        isTruthyOsmValue(tags["fuel:AdBlue"]) ||
        isTruthyOsmValue(tags["fuel:def"]) ||
        isTruthyOsmValue(tags["fuel:DEF"]);

      const name = tags.name || tags.brand || tags.operator || "Unnamed fuel station";
      const addressParts = [
        tags["addr:housenumber"],
        tags["addr:street"],
        tags["addr:city"],
        tags["addr:state"]
      ].filter(Boolean);

      return {
        id: element.id,
        name,
        hasDef,
        distanceKm: haversineKm(lat, lon, coords.lat, coords.lon),
        lat: coords.lat,
        lon: coords.lon,
        address: addressParts.join(", "),
        openingHours: tags.opening_hours || "n/a"
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

async function fetchTruckStops(lat, lon, radiusMeters = 40000){
  const query = `
[out:json][timeout:25];
(
  node(around:${radiusMeters},${lat},${lon})["amenity"="truck_stop"];
  way(around:${radiusMeters},${lat},${lon})["amenity"="truck_stop"];
  relation(around:${radiusMeters},${lat},${lon})["amenity"="truck_stop"];

  node(around:${radiusMeters},${lat},${lon})["amenity"="fuel"]["hgv"="yes"];
  way(around:${radiusMeters},${lat},${lon})["amenity"="fuel"]["hgv"="yes"];
  relation(around:${radiusMeters},${lat},${lon})["amenity"="fuel"]["hgv"="yes"];

  node(around:${radiusMeters},${lat},${lon})["highway"="rest_area"]["hgv"="yes"];
  way(around:${radiusMeters},${lat},${lon})["highway"="rest_area"]["hgv"="yes"];
  relation(around:${radiusMeters},${lat},${lon})["highway"="rest_area"]["hgv"="yes"];
);
out center tags;`;

  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
    },
    body: `data=${encodeURIComponent(query)}`
  });

  if(!response.ok){
    throw new Error(`Overpass API error: ${response.status}`);
  }

  const payload = await response.json();
  const rows = Array.isArray(payload?.elements) ? payload.elements : [];

  return rows
    .map((element) => {
      const coords = getElementLatLon(element);
      if(!coords) return null;

      const tags = element.tags ?? {};
      const name = tags.name || tags.brand || tags.operator || "Unnamed truck stop";
      const addressParts = [
        tags["addr:housenumber"],
        tags["addr:street"],
        tags["addr:city"],
        tags["addr:state"]
      ].filter(Boolean);

      let category = "Truck stop";
      if(tags.amenity === "fuel") category = "Fuel station (HGV)";
      if(tags.highway === "rest_area") category = "Rest area (HGV)";

      return {
        id: `${element.type}-${element.id}`,
        name,
        category,
        distanceKm: haversineKm(lat, lon, coords.lat, coords.lon),
        lat: coords.lat,
        lon: coords.lon,
        address: addressParts.join(", "),
        openingHours: tags.opening_hours || "n/a"
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

async function reverseGeocode(lat, lon){
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json"
    }
  });

  if(!response.ok){
    throw new Error(`Reverse geocode error: ${response.status}`);
  }

  const payload = await response.json();
  const address = payload.address ?? {};
  const city = address.city || address.town || address.village || address.hamlet || address.county || "";
  const state = address.state || address.region || "";
  const road = [address.house_number, address.road].filter(Boolean).join(" ");
  const locality = [city, state, address.postcode].filter(Boolean).join(", ");

  const full = [road, locality].filter(Boolean).join(", ") || payload.display_name || "Address not available";
  const short = [city, state].filter(Boolean).join(", ") || payload.display_name || "Location unavailable";
  return { full, short };
}

async function geocodePlace(query){
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json"
    }
  });
  if(!response.ok){
    throw new Error(`Geocode error: ${response.status}`);
  }

  const payload = await response.json();
  if(!Array.isArray(payload) || payload.length === 0){
    throw new Error(`Location not found: ${query}`);
  }

  const first = payload[0];
  return {
    lat: Number(first.lat),
    lon: Number(first.lon),
    label: first.display_name || query
  };
}

async function fetchRoute(start, end){
  const url = new URL(`https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}`);
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("steps", "false");

  const response = await fetch(url.toString());
  if(!response.ok){
    throw new Error(`Route API error: ${response.status}`);
  }

  const payload = await response.json();
  const route = payload?.routes?.[0];
  if(!route || !route.geometry?.coordinates){
    throw new Error("Route not found.");
  }

  const geometry = route.geometry.coordinates.map(([lon, lat]) => ({ lat, lon }));
  return {
    distanceKm: route.distance / 1000,
    durationHours: route.duration / 3600,
    geometry
  };
}

function getPointAtMile(geometry, targetMile){
  if(!Array.isArray(geometry) || geometry.length === 0){
    return null;
  }

  if(targetMile <= 0){
    return geometry[0];
  }

  let cumulativeMiles = 0;
  for(let index = 1; index < geometry.length; index += 1){
    const prev = geometry[index - 1];
    const next = geometry[index];
    const segmentMiles = kmToMiles(haversineKm(prev.lat, prev.lon, next.lat, next.lon));

    if(cumulativeMiles + segmentMiles >= targetMile){
      const remaining = targetMile - cumulativeMiles;
      const ratio = segmentMiles === 0 ? 0 : remaining / segmentMiles;
      return {
        lat: prev.lat + (next.lat - prev.lat) * ratio,
        lon: prev.lon + (next.lon - prev.lon) * ratio
      };
    }

    cumulativeMiles += segmentMiles;
  }

  return geometry[geometry.length - 1];
}

function buildRouteSampleMiles(totalMiles){
  const baseStepMiles = 120;
  const samples = [];
  samples.push(0);
  let marker = baseStepMiles;
  while(marker < totalMiles){
    samples.push(marker);
    marker += baseStepMiles;
  }
  if(totalMiles > 0){
    samples.push(totalMiles);
  }
  return samples;
}

async function fetchTruckStopsAlongRoute(routeGeometry, totalMiles){
  const sampleMiles = buildRouteSampleMiles(totalMiles);
  const sampleResults = await Promise.all(
    sampleMiles.map(async (mileMarker) => {
      const point = getPointAtMile(routeGeometry, mileMarker);
      if(!point){
        return [];
      }

      try{
        const stops = await fetchTruckStops(point.lat, point.lon, 16000);
        return stops.slice(0, 10).map((stop) => ({
          ...stop,
          routeMile: mileMarker
        }));
      }catch{
        return [];
      }
    })
  );

  const merged = sampleResults.flat();
  const deduped = [];
  const seen = new Set();

  for(const stop of merged){
    const key = stop.id || `${stop.name}|${stop.lat.toFixed(4)}|${stop.lon.toFixed(4)}`;
    if(seen.has(key)) continue;
    seen.add(key);
    deduped.push(stop);
  }

  deduped.sort((a, b) => {
    if(a.routeMile !== b.routeMile){
      return a.routeMile - b.routeMile;
    }
    return a.distanceKm - b.distanceKm;
  });

  return deduped;
}

function computeEldPlan(totalMiles, departureAtIso, speedMph){
  const maxHoursBeforeBreak = 8;
  const breakHours = 0.5;
  const maxDrivingHoursPerShift = 11;
  const offDutyHours = 10;

  const stops = [];
  let milesRemaining = totalMiles;
  let milesDriven = 0;
  let drivingSinceBreakHours = 0;
  let drivingSinceShiftStartHours = 0;
  let eventTime = new Date(departureAtIso);

  if(Number.isNaN(eventTime.getTime())){
    throw new Error("Invalid departure date/time.");
  }

  while(milesRemaining > 0.01){
    const hoursUntilBreak = maxHoursBeforeBreak - drivingSinceBreakHours;
    const hoursUntilShiftLimit = maxDrivingHoursPerShift - drivingSinceShiftStartHours;
    const hoursUntilDestination = milesRemaining / speedMph;
    const drivingStepHours = Math.min(hoursUntilBreak, hoursUntilShiftLimit, hoursUntilDestination);

    if(drivingStepHours <= 0){
      break;
    }

    const stepMiles = drivingStepHours * speedMph;
    milesDriven += stepMiles;
    milesRemaining -= stepMiles;
    drivingSinceBreakHours += drivingStepHours;
    drivingSinceShiftStartHours += drivingStepHours;
    eventTime = new Date(eventTime.getTime() + drivingStepHours * 3600 * 1000);

    if(milesRemaining <= 0.01){
      break;
    }

    if(drivingSinceShiftStartHours >= maxDrivingHoursPerShift - 0.0001){
      stops.push({
        type: "10h_off_duty",
        mile: milesDriven,
        at: new Date(eventTime.getTime()),
        durationHours: offDutyHours
      });
      eventTime = new Date(eventTime.getTime() + offDutyHours * 3600 * 1000);
      drivingSinceShiftStartHours = 0;
      drivingSinceBreakHours = 0;
      continue;
    }

    if(drivingSinceBreakHours >= maxHoursBeforeBreak - 0.0001){
      stops.push({
        type: "30m_break",
        mile: milesDriven,
        at: new Date(eventTime.getTime()),
        durationHours: breakHours
      });
      eventTime = new Date(eventTime.getTime() + breakHours * 3600 * 1000);
      drivingSinceBreakHours = 0;
    }
  }

  return {
    arrivalAt: eventTime,
    stops
  };
}

async function fetchRestPlacesNear(lat, lon, radiusMeters = 16000){
  const query = `
[out:json][timeout:25];
(
  node(around:${radiusMeters},${lat},${lon})["highway"="rest_area"];
  way(around:${radiusMeters},${lat},${lon})["highway"="rest_area"];
  relation(around:${radiusMeters},${lat},${lon})["highway"="rest_area"];

  node(around:${radiusMeters},${lat},${lon})["highway"="services"];
  way(around:${radiusMeters},${lat},${lon})["highway"="services"];
  relation(around:${radiusMeters},${lat},${lon})["highway"="services"];

  node(around:${radiusMeters},${lat},${lon})["amenity"="truck_stop"];
  way(around:${radiusMeters},${lat},${lon})["amenity"="truck_stop"];
  relation(around:${radiusMeters},${lat},${lon})["amenity"="truck_stop"];
);
out center tags;`;

  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
    },
    body: `data=${encodeURIComponent(query)}`
  });

  if(!response.ok){
    throw new Error(`Rest places API error: ${response.status}`);
  }

  const payload = await response.json();
  const rows = Array.isArray(payload?.elements) ? payload.elements : [];

  const mapped = rows
    .map((element) => {
      const coords = getElementLatLon(element);
      if(!coords) return null;
      const tags = element.tags ?? {};
      const name = tags.name || tags.operator || tags.brand || "Rest location";

      let type = "Rest location";
      if(tags.highway === "rest_area") type = "Rest area";
      if(tags.highway === "services") type = "Service area";
      if(tags.amenity === "truck_stop") type = "Truck stop";

      const addressParts = [
        tags["addr:housenumber"],
        tags["addr:street"],
        tags["addr:city"],
        tags["addr:state"]
      ].filter(Boolean);

      return {
        id: `${element.type}-${element.id}`,
        name,
        type,
        lat: coords.lat,
        lon: coords.lon,
        distanceMiles: kmToMiles(haversineKm(lat, lon, coords.lat, coords.lon)),
        address: addressParts.join(", "),
        openingHours: tags.opening_hours || "n/a"
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceMiles - b.distanceMiles);

  const unique = [];
  const seen = new Set();
  for(const row of mapped){
    const key = `${row.name}|${row.type}|${row.lat.toFixed(4)}|${row.lon.toFixed(4)}`;
    if(seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
    if(unique.length >= 5) break;
  }

  return unique;
}

async function fetchWeatherAtTime(lat, lon, targetDate){
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("hourly", "temperature_2m,precipitation_probability,weather_code,wind_speed_10m");
  url.searchParams.set("forecast_days", "16");
  url.searchParams.set("timezone", "auto");

  const response = await fetch(url.toString());
  if(!response.ok){
    throw new Error(`Weather API error: ${response.status}`);
  }

  const data = await response.json();
  const hourly = data.hourly ?? {};
  const hourlyUnits = data.hourly_units ?? {};
  if(!hourly.time || !hourly.temperature_2m){
    throw new Error("Weather response missing required fields.");
  }

  const targetMs = targetDate.getTime();
  let bestIndex = 0;
  let bestDelta = Number.POSITIVE_INFINITY;
  for(let index = 0; index < hourly.time.length; index += 1){
    const sampleMs = new Date(hourly.time[index]).getTime();
    const delta = Math.abs(sampleMs - targetMs);
    if(delta < bestDelta){
      bestDelta = delta;
      bestIndex = index;
    }
  }

  return {
    time: hourly.time[bestIndex],
    temperature: hourly.temperature_2m?.[bestIndex],
    weatherCode: hourly.weather_code?.[bestIndex],
    rainProbability: hourly.precipitation_probability?.[bestIndex],
    windSpeed: hourly.wind_speed_10m?.[bestIndex],
    units: {
      temp: hourlyUnits.temperature_2m ?? "",
      rain: hourlyUnits.precipitation_probability ?? "%",
      wind: hourlyUnits.wind_speed_10m ?? ""
    }
  };
}

function formatGeoError(error){
  if(!(error && typeof error === "object" && "code" in error)){
    return null;
  }

  if(error.code === 1) return "Location permission denied. Allow location access and try again.";
  if(error.code === 2) return "Unable to determine your location. Check GPS/network and try again.";
  if(error.code === 3) return "Location request timed out. Try again.";
  return null;
}

function formatTimelineTime(date){
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function compactLocationLabel(label){
  if(!label) return "Unknown";
  const first = String(label).split(",")[0]?.trim();
  return first || String(label).trim();
}

function isSevereWeatherSample(sample){
  if(!sample) return false;
  if(typeof sample.weatherCode === "number" && sample.weatherCode >= 95) return true;
  if(Number(sample.rainProbability) >= 70) return true;
  if(Number(sample.windSpeed) >= 35) return true;
  return false;
}

function isNightByLocalHour(){
  const hour = new Date().getHours();
  return hour < 6 || hour >= 19;
}

async function applyDriverEyeMode(){
  const nightByHour = isNightByLocalHour();
  const setMode = (isNight) => {
    document.body.classList.toggle("night-mode", Boolean(isNight));
  };

  setMode(nightByHour);

  if(!("permissions" in navigator) || !("geolocation" in navigator)){
    return;
  }

  try{
    const permission = await navigator.permissions.query({ name: "geolocation" });
    if(permission.state !== "granted"){
      return;
    }

    const position = await getCurrentPosition();
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;

    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lon));
    url.searchParams.set("daily", "sunrise,sunset");
    url.searchParams.set("forecast_days", "1");
    url.searchParams.set("timezone", "auto");

    const response = await fetch(url.toString());
    if(!response.ok){
      return;
    }

    const data = await response.json();
    const sunriseText = data?.daily?.sunrise?.[0];
    const sunsetText = data?.daily?.sunset?.[0];
    if(!sunriseText || !sunsetText){
      return;
    }

    const nowMs = Date.now();
    const sunriseMs = new Date(sunriseText).getTime();
    const sunsetMs = new Date(sunsetText).getTime();
    const nightBySun = nowMs < sunriseMs || nowMs >= sunsetMs;

    setMode(nightBySun);
  }catch{
    setMode(nightByHour);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  applyDriverEyeMode();
  attachOpenRouteHandler();

  onClick("btnTrip", () => {
    setStatus("Trip planner ready.");
    setOutputHtml(`
      <div class="trip-builder">
        <div class="trip-title">Trip Weather Timeline + ELD Planner</div>
        <form id="tripPlanForm" class="trip-form">
          <label class="trip-label" for="tripOrigin">Origin</label>
          <input id="tripOrigin" class="trip-input" type="text" placeholder="e.g. Los Angeles, CA" required />

          <label class="trip-label" for="tripDestination">Destination</label>
          <input id="tripDestination" class="trip-input" type="text" placeholder="e.g. Savannah, GA" required />

          <label class="trip-label" for="tripDeparture">Departure (local)</label>
          <input id="tripDeparture" class="trip-input" type="datetime-local" required />

          <label class="trip-label" for="tripSpeed">Average speed (mph)</label>
          <input id="tripSpeed" class="trip-input" type="number" min="35" max="75" value="58" required />

          <button class="trip-submit" type="submit">Build timeline</button>
        </form>
      </div>
    `);

    const departureInput = document.getElementById("tripDeparture");
    if(departureInput){
      const now = new Date();
      const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      departureInput.value = local;
    }

    const form = document.getElementById("tripPlanForm");
    if(!form) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const originValue = document.getElementById("tripOrigin")?.value?.trim() ?? "";
      const destinationValue = document.getElementById("tripDestination")?.value?.trim() ?? "";
      const departureValue = document.getElementById("tripDeparture")?.value ?? "";
      const speedValue = Number(document.getElementById("tripSpeed")?.value ?? "58");

      if(!originValue || !destinationValue || !departureValue || !Number.isFinite(speedValue) || speedValue <= 0){
        setStatus("Trip planner validation failed.");
        setOutput("Please complete origin, destination, departure time and speed.");
        return;
      }

      try{
        setStatus("Building trip route...");
        setOutput("Resolving origin and destination...");

        const [origin, destination] = await Promise.all([
          geocodePlace(originValue),
          geocodePlace(destinationValue)
        ]);

        const route = await fetchRoute(origin, destination);
        const totalMiles = kmToMiles(route.distanceKm);
        const eldPlan = computeEldPlan(totalMiles, departureValue, speedValue);

        const etd = new Date(departureValue);
        const eta = eldPlan.arrivalAt;

        const timelineCount = 5;
        const timelineCheckpoints = Array.from({ length: timelineCount }, (_, index) => {
          const ratio = timelineCount === 1 ? 0 : index / (timelineCount - 1);
          const mile = totalMiles * ratio;
          const point = getPointAtMile(route.geometry, mile) || route.geometry[index === 0 ? 0 : route.geometry.length - 1];
          const at = new Date(etd.getTime() + (eta.getTime() - etd.getTime()) * ratio);
          return { index, ratio, mile, point, at };
        });

        setStatus("Loading weather timeline...");

        const timelineWithLocation = await Promise.all(
          timelineCheckpoints.map(async (item) => {
            if(item.index === 0){
              return { ...item, location: compactLocationLabel(origin.label) };
            }
            if(item.index === timelineCheckpoints.length - 1){
              return { ...item, location: compactLocationLabel(destination.label) };
            }
            try{
              const reverse = await reverseGeocode(item.point.lat, item.point.lon);
              return { ...item, location: compactLocationLabel(reverse.short) };
            }catch{
              return { ...item, location: `Mile ${item.mile.toFixed(0)}` };
            }
          })
        );

        const timelineData = await Promise.all(
          timelineWithLocation.map(async (item) => {
            try{
              const weather = await fetchWeatherAtTime(item.point.lat, item.point.lon, item.at);
              return { ...item, weather };
            }catch{
              return { ...item, weather: null };
            }
          })
        );

        const severePoint = timelineData.find((item) => isSevereWeatherSample(item.weather));
        const severeText = severePoint
          ? `Strong weather risk near ${severePoint.location}.`
          : "";

        const routeTitle = `${compactLocationLabel(origin.label)} \u2192 ${compactLocationLabel(destination.label)}`;

        const segmentHtml = timelineData.map((item) => {
          const icon = item.weather ? weatherCodeToIcon(item.weather.weatherCode) : "\u25CF";
          const temp = item.weather?.temperature == null ? "--" : Math.round(item.weather.temperature);
          const condition = item.weather ? weatherCodeToText(item.weather.weatherCode) : "Weather unavailable";
          return `
            <div class="trip-board-segment">
              <div class="trip-board-segment-icon" aria-hidden="true">${icon}</div>
              <div class="trip-board-segment-time">${escapeHtml(formatTimelineTime(item.at))}</div>
              <div class="trip-board-segment-place">${escapeHtml(item.location)}</div>
              <div class="trip-board-segment-temp">${escapeHtml(temp)}${escapeHtml(item.weather?.units?.temp || "\u00B0F")}</div>
              <div class="trip-board-segment-cond">${escapeHtml(condition)}</div>
            </div>
          `;
        }).join("");

        const timelineMeta = [
          { key: "Departure", value: formatTimelineTime(etd) },
          { key: "Avg speed", value: `${speedValue.toFixed(0)} mph` },
          { key: "Distance", value: `${totalMiles.toFixed(0)} mi` },
          { key: "Final ETA", value: formatTimelineTime(eta) }
        ]
          .map((row) => `<div class="trip-board-meta-item"><span>${escapeHtml(row.key)}</span><strong>${escapeHtml(row.value)}</strong></div>`)
          .join("");

        setStatus("Trip timeline ready.");
        setOutputHtml(`
          <div class="trip-weather-board">
            <div class="trip-board-head">
              <div class="trip-board-title">Clima en Ruta</div>
            </div>
            <div class="trip-board-route">${escapeHtml(routeTitle)}</div>
            <div class="trip-board-meta">${timelineMeta}</div>
            <div class="trip-board-strip"></div>
            <div class="trip-board-timeline">${segmentHtml}</div>
            <div class="trip-board-eta">ETA Final: ${escapeHtml(formatTimelineTime(eta))}</div>
            ${severeText ? `<div class="trip-board-alert">\u26A0 ${escapeHtml(severeText)}</div>` : ""}
          </div>
        `);
      }catch(error){
        setStatus("Trip planner failed.");
        setOutput(`Could not build trip timeline. ${error?.message ?? ""}`.trim());
      }
    });
  });

  onClick("btnWeatherNow", async () => {
    if(!("geolocation" in navigator)){
      setStatus("Weather now failed.");
      setOutput("Geolocation is not available in this browser.");
      return;
    }

    try{
      setStatus("Loading weather...");
      setOutput("Detecting your location...");

      const position = await getCurrentPosition();
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      setOutput("Location found. Requesting weather...");

      if(!WEATHER_API_KEY || WEATHER_API_KEY.includes("PUT_YOUR_OPENWEATHERMAP_API_KEY_HERE")){
        throw new Error("Set WEATHER_API_KEY in main.js before using WEATHER NOW.");
      }

      const currentUrl = new URL("https://api.openweathermap.org/data/2.5/weather");
      currentUrl.searchParams.set("lat", String(lat));
      currentUrl.searchParams.set("lon", String(lon));
      currentUrl.searchParams.set("units", "imperial");
      currentUrl.searchParams.set("appid", WEATHER_API_KEY);

      const forecastUrl = new URL("https://api.openweathermap.org/data/2.5/forecast");
      forecastUrl.searchParams.set("lat", String(lat));
      forecastUrl.searchParams.set("lon", String(lon));
      forecastUrl.searchParams.set("units", "imperial");
      forecastUrl.searchParams.set("appid", WEATHER_API_KEY);

      const [currentResponse, forecastResponse] = await Promise.all([
        fetch(currentUrl.toString()),
        fetch(forecastUrl.toString())
      ]);

      if(!currentResponse.ok){
        throw new Error(`Weather API error: ${currentResponse.status}`);
      }
      if(!forecastResponse.ok){
        throw new Error(`Forecast API error: ${forecastResponse.status}`);
      }

      const currentData = await currentResponse.json();
      const forecastData = await forecastResponse.json();

      const weatherEntry = currentData?.weather?.[0] ?? {};
      const conditionLabel = weatherEntry.description || weatherEntry.main || "Unknown";
      const currentIcon = weatherIconFromOwm(weatherEntry.icon);
      const updatedAt = currentData?.dt ? new Date(currentData.dt * 1000).toLocaleString() : new Date().toLocaleString();
      const cityLabel = [
        currentData?.name,
        currentData?.sys?.country
      ].filter(Boolean).join(", ") || "Current location";

      const forecastList = Array.isArray(forecastData?.list) ? forecastData.list : [];
      const nowMs = Date.now();
      const nextForecast = forecastList.find((item) => (item?.dt ?? 0) * 1000 > nowMs + 30 * 60 * 1000) || forecastList[0];
      const nextHourText = nextForecast
        ? `${new Date(nextForecast.dt * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${Math.round(nextForecast.main?.temp ?? 0)}°F`
        : "n/a";

      setStatus("Weather loaded.");
      setOutputHtml(`
        <div class="weather-result-card">
          <div class="weather-result-head">
            <div>
              <div class="weather-city">${escapeHtml(cityLabel)}</div>
              <div class="weather-updated">Updated: ${escapeHtml(updatedAt)}</div>
            </div>
            <div class="weather-icon" aria-hidden="true">${currentIcon}</div>
          </div>
          <div class="weather-main-temp">${escapeHtml(Math.round(currentData?.main?.temp ?? 0))}°F</div>
          <div class="weather-main-condition">${escapeHtml(conditionLabel)}</div>
          <div class="weather-stats-grid">
            <div class="weather-stat"><span>Humidity</span><strong>${escapeHtml(currentData?.main?.humidity ?? "n/a")}%</strong></div>
            <div class="weather-stat"><span>Wind</span><strong>${escapeHtml(currentData?.wind?.speed ?? "n/a")} mph</strong></div>
            <div class="weather-stat"><span>Direction</span><strong>${escapeHtml(currentData?.wind?.deg ?? "n/a")}°</strong></div>
            <div class="weather-stat"><span>Next hour</span><strong>${escapeHtml(nextHourText)}</strong></div>
          </div>
        </div>
      `);
    }catch(error){
      setStatus("Weather now failed.");
      setOutput(formatGeoError(error) ?? `Could not load weather data. ${error?.message ?? ""}`.trim());
    }
  });

  onClick("btnTrafficAhead", async () => {
    if(!("geolocation" in navigator)){
      setStatus("Traffic failed.");
      setOutput("Geolocation is not available in this browser.");
      return;
    }

    try{
      setStatus("Loading traffic around you...");
      setOutput("Detecting your location...");

      const position = await getCurrentPosition();
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      let userLocation = "Current location";
      try{
        const geo = await reverseGeocode(lat, lon);
        userLocation = geo.short || userLocation;
      }catch{
        userLocation = "Current location";
      }

      const trafficUrl = buildGoogleTrafficUrl(lat, lon);
      setStatus("Traffic map ready.");
      setOutputHtml(`
        <div class="route-summary-card">
          <div class="route-summary-title">Traffic Ahead</div>
          <div class="route-summary-line"><strong>Area:</strong> ${escapeHtml(userLocation)}</div>
          <div class="route-summary-line"><strong>Coordinates:</strong> ${escapeHtml(lat.toFixed(5))}, ${escapeHtml(lon.toFixed(5))}</div>
          <a class="route-summary-link" href="${trafficUrl}" target="_blank" rel="noopener noreferrer">Open live traffic in Google Maps</a>
        </div>
      `);

      window.open(trafficUrl, "_blank", "noopener,noreferrer");
    }catch(error){
      setStatus("Traffic failed.");
      setOutput(formatGeoError(error) ?? `Could not load traffic map. ${error?.message ?? ""}`.trim());
    }
  });

  onClick("btnTruckNear", async () => {
    if(!("geolocation" in navigator)){
      setStatus("Truck Stops failed.");
      setOutput("Geolocation is not available in this browser.");
      return;
    }

    try{
      setStatus("Truck Stops near me: loading...");
      setOutput("Detecting your location...");

      const position = await getCurrentPosition();
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      let userLocation = "Location unavailable";
      try{
        const userGeo = await reverseGeocode(lat, lon);
        userLocation = userGeo.short;
      }catch{
        userLocation = "Location unavailable";
      }

      setOutput("Location found. Searching nearby truck stops...");
      const stops = await fetchTruckStops(lat, lon, 40000);

      if(stops.length === 0){
        setStatus("No truck stops found.");
        setOutput("No nearby truck stops found in OpenStreetMap data.");
        return;
      }

      const topStops = stops.slice(0, 10);
      const enrichedStops = await Promise.all(
        topStops.map(async (item) => {
          if(item.address){
            return { ...item, displayAddress: item.address };
          }
          try{
            const reverse = await reverseGeocode(item.lat, item.lon);
            return { ...item, displayAddress: reverse.full };
          }catch{
            return { ...item, displayAddress: "Address not available" };
          }
        })
      );

      const header = [
        "Truck Stops Near Me",
        `Your location: ${userLocation}`,
        `Stops shown: ${enrichedStops.length} (within 25 miles)`
      ];

      const list = enrichedStops.map((item, index) => {
        const miles = kmToMiles(item.distanceKm);
        const mapUrl = `https://www.openstreetmap.org/?mlat=${item.lat}&mlon=${item.lon}#map=15/${item.lat}/${item.lon}`;
        return [
          `${index + 1}. ${item.name}`,
          `   Distance: ${miles.toFixed(1)} mi | Type: ${item.category}`,
          `   Address: ${item.displayAddress}`,
          `   Hours: ${item.openingHours}`,
          `   Map: ${mapUrl}`
        ].join("\n");
      });

      setStatus("Truck Stops loaded.");
      setOutput(`${header.join("\n")}\n\n${list.join("\n\n")}`);
    }catch(error){
      setStatus("Truck Stops failed.");
      setOutput(formatGeoError(error) ?? `Could not load truck stops. ${error?.message ?? ""}`.trim());
    }
  });

  onClick("btnTruckRoute", () => {
    setStatus("Truck Stops in route ready.");
    setOutputHtml(`
      <div class="trip-builder">
        <div class="trip-title">Truck Stops In My Route</div>
        <form id="truckRouteForm" class="trip-form">
          <label class="trip-label" for="truckRouteOrigin">Origin</label>
          <input id="truckRouteOrigin" class="trip-input" type="text" placeholder="e.g. Dallas, TX" required />

          <label class="trip-label" for="truckRouteDestination">Destination</label>
          <input id="truckRouteDestination" class="trip-input" type="text" placeholder="e.g. Atlanta, GA" required />

          <button class="trip-submit" type="submit">Find truck stops on route</button>
        </form>
      </div>
    `);

    const form = document.getElementById("truckRouteForm");
    if(!form) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const originValue = document.getElementById("truckRouteOrigin")?.value?.trim() ?? "";
      const destinationValue = document.getElementById("truckRouteDestination")?.value?.trim() ?? "";

      if(!originValue || !destinationValue){
        setStatus("Truck route validation failed.");
        setOutput("Please provide both origin and destination.");
        return;
      }

      try{
        setStatus("Building route...");
        setOutput("Resolving locations and route...");

        const [origin, destination] = await Promise.all([
          geocodePlace(originValue),
          geocodePlace(destinationValue)
        ]);

        const route = await fetchRoute(origin, destination);
        const totalMiles = kmToMiles(route.distanceKm);

        setStatus("Finding truck stops along route...");
        const stopsOnRoute = await fetchTruckStopsAlongRoute(route.geometry, totalMiles);
        if(stopsOnRoute.length === 0){
          setStatus("No truck stops found.");
          setOutput("No truck stops found along this route in OpenStreetMap data.");
          return;
        }

        const topStops = stopsOnRoute.slice(0, 18);
        const enrichedStops = await Promise.all(
          topStops.map(async (stop) => {
            if(stop.address){
              return { ...stop, displayAddress: stop.address };
            }
            try{
              const reverse = await reverseGeocode(stop.lat, stop.lon);
              return { ...stop, displayAddress: reverse.full };
            }catch{
              return { ...stop, displayAddress: "Address not available" };
            }
          })
        );

        const summaryRows = [
          { key: "Origin", value: origin.label },
          { key: "Destination", value: destination.label },
          { key: "Route length", value: `${totalMiles.toFixed(1)} mi` },
          { key: "Stops shown", value: String(enrichedStops.length) }
        ]
          .map((row) => `<div class="trip-kv"><span>${escapeHtml(row.key)}:</span><strong>${escapeHtml(row.value)}</strong></div>`)
          .join("");

        const stopsHtml = enrichedStops.map((stop, index) => {
          const milesOffRouteSample = kmToMiles(stop.distanceKm);
          const mapUrl = `https://www.openstreetmap.org/?mlat=${stop.lat}&mlon=${stop.lon}#map=15/${stop.lat}/${stop.lon}`;
          return `
            <div class="trip-stop-card">
              <div class="trip-stop-title">${index + 1}. ${escapeHtml(stop.name)}</div>
              <div class="trip-stop-line">Near route mile: ${escapeHtml(stop.routeMile.toFixed(0))} mi</div>
              <div class="trip-stop-line">Distance from sampled route point: ${escapeHtml(milesOffRouteSample.toFixed(1))} mi</div>
              <div class="trip-stop-line">Type: ${escapeHtml(stop.category)}</div>
              <div class="trip-stop-line">Address: ${escapeHtml(stop.displayAddress)}</div>
              <div class="trip-stop-line">Hours: ${escapeHtml(stop.openingHours)}</div>
              <a class="trip-link js-open-route" href="${mapUrl}" data-lat="${stop.lat}" data-lon="${stop.lon}" data-name="${escapeHtml(stop.name)}">Open map</a>
            </div>
          `;
        }).join("");

        setStatus("Truck stops in route loaded.");
        setOutputHtml(`
          <div class="trip-results">
            <div class="trip-section">
              <div class="trip-section-title">Route Summary</div>
              <div class="trip-kv-grid">${summaryRows}</div>
            </div>
            <div class="trip-section">
              <div class="trip-section-title">Truck Stops Along Route</div>
              <div class="trip-stop-grid">${stopsHtml}</div>
            </div>
          </div>
        `);
      }catch(error){
        setStatus("Truck stops in route failed.");
        setOutput(`Could not load route truck stops. ${error?.message ?? ""}`.trim());
      }
    });
  });

  onClick("btnDieselNear", async () => {
    if(!("geolocation" in navigator)){
      setStatus("Diesel + DEF failed.");
      setOutput("Geolocation is not available in this browser.");
      return;
    }

    try{
      setStatus("Diesel + DEF near me: loading...");
      setOutput("Detecting your location...");

      const position = await getCurrentPosition();
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      let userLocation = "Location unavailable";
      try{
        const userGeo = await reverseGeocode(lat, lon);
        userLocation = userGeo.short;
      }catch{
        userLocation = "Location unavailable";
      }

      setOutput("Location found. Searching nearby stations...");
      const stations = await fetchDieselDefStations(lat, lon, 40000);

      if(stations.length === 0){
        setStatus("No stations found.");
        setOutput("No diesel stations found nearby in OpenStreetMap data. Try again in another area.");
        return;
      }

      const topStations = stations.slice(0, 10);
      const enrichedStations = await Promise.all(
        topStations.map(async (item) => {
          if(item.address){
            return { ...item, displayAddress: item.address };
          }
          try{
            const reverse = await reverseGeocode(item.lat, item.lon);
            return { ...item, displayAddress: reverse.full };
          }catch{
            return { ...item, displayAddress: "Address not available" };
          }
        })
      );

      const defCount = enrichedStations.filter((item) => item.hasDef).length;
      const summaryHtml = `
        <div class="diesel-summary">
          <div class="diesel-summary-title">Diesel + DEF Near Me</div>
          <div class="diesel-summary-sub">${escapeHtml(userLocation)}</div>
          <div class="diesel-summary-chips">
            <span class="diesel-chip">Stations: ${escapeHtml(enrichedStations.length)}</span>
            <span class="diesel-chip">Radius: 25 mi</span>
            <span class="diesel-chip">DEF tagged: ${escapeHtml(defCount)}</span>
          </div>
        </div>
      `;

      const stationsHtml = enrichedStations.map((item, index) => {
        const defLabel = item.hasDef ? "DEF available" : "DEF unknown";
        const defClass = item.hasDef ? "is-yes" : "is-unknown";
        const miles = kmToMiles(item.distanceKm);
        const mapUrl = `https://www.openstreetmap.org/?mlat=${item.lat}&mlon=${item.lon}#map=15/${item.lat}/${item.lon}`;
        return `
          <div class="diesel-card">
            <div class="diesel-card-top">
              <div class="diesel-name">${index + 1}. ${escapeHtml(item.name)}</div>
              <span class="diesel-def-badge ${defClass}">${defLabel}</span>
            </div>
            <div class="diesel-line"><strong>Distance:</strong> ${escapeHtml(miles.toFixed(1))} mi</div>
            <div class="diesel-line"><strong>Address:</strong> ${escapeHtml(item.displayAddress)}</div>
            <div class="diesel-line"><strong>Hours:</strong> ${escapeHtml(item.openingHours)}</div>
            <a class="diesel-link js-open-route" href="${mapUrl}" data-lat="${item.lat}" data-lon="${item.lon}" data-name="${escapeHtml(item.name)}">Open map</a>
          </div>
        `;
      }).join("");

      setStatus("Diesel + DEF loaded.");
      setOutputHtml(`
        <div class="diesel-result-wrap">
          ${summaryHtml}
          <div class="diesel-grid">${stationsHtml}</div>
        </div>
      `);
    }catch(error){
      setStatus("Diesel + DEF failed.");
      setOutput(formatGeoError(error) ?? `Could not load diesel/DEF stations. ${error?.message ?? ""}`.trim());
    }
  });

  onClick("btnDieselRoute", () => {
    setStatus("Diesel + DEF (In my route): demo.");
    setOutput("Next step: route-aware diesel and DEF stations.");
  });

  onClick("btnRestRoute", () => {
    setStatus("Rest Areas (In my route): demo.");
    setOutput(
`Wanted data:
- Amenities (restroom, food, shower)
- Parking limits
- Overnight allowed
- Rules and hours

Next step: dataset + card UI.`
    );
  });

  onClick("btnPort", () => {
    setStatus("Port cameras loaded.");

    const cameras = [
      {
        port: "Port of Los Angeles",
        area: "Los Angeles, CA",
        note: "Official Port of Los Angeles livestream page (EarthCam feeds).",
        url: "https://www.portoflosangeles.org/news/livestream"
      },
      {
        port: "Port of New York and New Jersey",
        area: "NY/NJ Harbor",
        note: "Live harbor view from Weehawken, NJ (PTZtv).",
        url: "https://www.ptztv.live/port-new-york-webcam/"
      },
      {
        port: "New York Harbor",
        area: "Staten Island / Upper Bay",
        note: "Additional NY Harbor live camera feed (PTZtv).",
        url: "https://www.nyharborwebcam.com/"
      },
      {
        port: "Port of Oakland Area",
        area: "Oakland, CA",
        note: "Live estuary/port-area view (KTVU camera).",
        url: "https://www.ktvu.com/oakland-estuary-web"
      },
      {
        port: "Port of Savannah Area",
        area: "Savannah, GA",
        note: "Georgia Ports area live view.",
        url: "https://www.savannahcams.com/live-views/georgia-ports/"
      }
    ];

    const items = cameras
      .map((camera) => {
        return `
          <div class="cam-item">
            <div class="cam-title">${camera.port}</div>
            <div class="cam-sub">${camera.area}</div>
            <div class="cam-note">${camera.note}</div>
            <a class="cam-link" href="${camera.url}" target="_blank" rel="noopener noreferrer">Open live camera</a>
          </div>
        `;
      })
      .join("");

    setOutputHtml(`
      <div class="cam-grid">
        ${items}
      </div>
    `);
  });

  setStatus("Ready. Click a button to test the flow.");
});
