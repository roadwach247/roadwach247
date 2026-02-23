const STORAGE_ACTIVE_TRIP_KEY = "rw_active_trip_v2";
const STORAGE_UI_STATE_KEY = "rw_ui_state_v1";

const appState = {
  currentView: "viewHome",
  backStack: [],
  forwardStack: [],
  activeTrip: null,
  lastPlannedTrip: null,
  routeDraftOriginCoords: null,
  tripOverviewStarted: false,
  tripMapExpanded: false
};

const VIEW_IDS = [
  "viewHome",
  "viewRoutePlanning",
  "viewTripOverview",
  "viewWeatherNow",
  "viewTruckStopNear",
  "viewPlacesStopNow",
  "viewDieselDefNear",
  "viewDieselDefRoute",
  "viewRestAreasRoute",
  "viewTrafficAhead",
  "viewPortWatch",
  "viewDetails",
  "viewNoActiveTrip"
];

const ICONS = {
  temp: "🌡️",
  condition: "☁️",
  wind: "💨",
  precip: "🌧️",
  restroom: "🚻",
  food: "🍔",
  shower: "🚿",
  parking: "🅿️",
  overnight: "🌙",
  diesel: "⛽",
  def: "🧪",
  accident: "🚧",
  construction: "🏗️",
  congestion: "🚗"
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function showView(viewName, { pushHistory = true } = {}) {
  if (!VIEW_IDS.includes(viewName)) return;

  if (pushHistory && appState.currentView !== viewName) {
    appState.backStack.push(appState.currentView);
    appState.forwardStack = [];
  }

  document.querySelectorAll(".view").forEach((el) => {
    el.classList.toggle("is-active", el.id === viewName);
  });

  appState.currentView = viewName;
  const nav = document.getElementById("screenNav");
  if (nav) nav.hidden = false;
  document.body.classList.toggle("subview-open", viewName !== "viewHome");
  updateNavButtons();
  document.querySelector(".page")?.scrollTo?.({ top: 0, behavior: "auto" });
  saveUiState();
}

function updateNavButtons() {
  const backBtn = document.getElementById("btnNavBack");
  const forwardBtn = document.getElementById("btnNavForward");
  if (backBtn) backBtn.disabled = appState.backStack.length === 0;
  if (forwardBtn) forwardBtn.disabled = appState.forwardStack.length === 0;
}

function goBackView() {
  if (appState.backStack.length === 0) return;
  const prev = appState.backStack.pop();
  appState.forwardStack.push(appState.currentView);
  showView(prev, { pushHistory: false });
}

function goForwardView() {
  if (appState.forwardStack.length === 0) return;
  const next = appState.forwardStack.pop();
  appState.backStack.push(appState.currentView);
  showView(next, { pushHistory: false });
}

function goHome() {
  appState.backStack = [];
  appState.forwardStack = [];
  showView("viewHome", { pushHistory: false });
}

function saveUiState() {
  try {
    const routeStartAt = document.getElementById("routeStartAt")?.value || "";
    const routeOrigin = document.getElementById("routeOrigin")?.value || "";
    const routeDestination = document.getElementById("routeDestination")?.value || "";
    const routeAvgSpeed = document.getElementById("routeAvgSpeed")?.value || "";
    const routeDriveHoursStart = document.getElementById("routeDriveHoursStart")?.value || "";
    const routeBreakRule = Boolean(document.getElementById("routeBreakRule")?.checked);
    const routeIncludeReset = Boolean(document.getElementById("routeIncludeReset")?.checked);

    const payload = {
      currentView: appState.currentView,
      tripMapExpanded: appState.tripMapExpanded,
      routeForm: {
        routeOrigin,
        routeDestination,
        routeStartAt,
        routeAvgSpeed,
        routeDriveHoursStart,
        routeBreakRule,
        routeIncludeReset
      }
    };

    localStorage.setItem(STORAGE_UI_STATE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage may be blocked
  }
}

function loadUiState() {
  try {
    const raw = localStorage.getItem(STORAGE_UI_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatTime(date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function deterministicSeed(text) {
  let hash = 0;
  const str = String(text || "").toLowerCase();
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 33 + str.charCodeAt(i)) % 100000;
  }
  return hash;
}

function deterministicCoord(text, salt = 0) {
  const seed = deterministicSeed(`${text}|${salt}`);
  const lat = 25 + (seed % 2200) / 100;
  const lng = -124 + ((seed * 7) % 5600) / 100;
  return {
    lat: Number(Math.max(25, Math.min(49, lat)).toFixed(5)),
    lng: Number(Math.max(-124, Math.min(-67, lng)).toFixed(5))
  };
}

function buildMockGeometry(origin, destination) {
  const points = [];
  for (let i = 0; i <= 10; i += 1) {
    const t = i / 10;
    const wave = Math.sin(Math.PI * t) * 0.12;
    points.push({
      lat: Number((origin.lat + (destination.lat - origin.lat) * t + wave).toFixed(5)),
      lng: Number((origin.lng + (destination.lng - origin.lng) * t - wave).toFixed(5))
    });
  }
  return points;
}

function saveActiveTrip() {
  try {
    if (!appState.activeTrip) {
      localStorage.removeItem(STORAGE_ACTIVE_TRIP_KEY);
      return;
    }
    localStorage.setItem(STORAGE_ACTIVE_TRIP_KEY, JSON.stringify(appState.activeTrip));
  } catch {
    // localStorage may be unavailable
  }
}

function loadActiveTrip() {
  try {
    const raw = localStorage.getItem(STORAGE_ACTIVE_TRIP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.origin?.text || !parsed?.destination?.text || !parsed?.routeSummary) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearActiveTrip() {
  appState.activeTrip = null;
  appState.lastPlannedTrip = null;
  appState.backStack = [];
  appState.forwardStack = [];
  appState.tripOverviewStarted = false;
  appState.tripMapExpanded = false;
  saveActiveTrip();
  saveUiState();
  renderActiveTripIndicator();
  goHome();
}

function renderActiveTripIndicator() {
  const wrap = document.getElementById("activeTripIndicator");
  const routeEl = document.getElementById("activeTripRoute");
  const etaEl = document.getElementById("activeTripEta");
  if (!wrap || !routeEl || !etaEl) return;
  const clearTopBtn = document.getElementById("btnClearTripTop");

  if (!appState.activeTrip) {
    wrap.hidden = true;
    if (clearTopBtn) clearTopBtn.hidden = true;
    routeEl.textContent = "";
    etaEl.textContent = "";
    return;
  }

  wrap.hidden = false;
  if (clearTopBtn) clearTopBtn.hidden = false;
  routeEl.textContent = `${appState.activeTrip.origin.text} → ${appState.activeTrip.destination.text}`;
  etaEl.textContent = `ETA ${formatDateTime(new Date(appState.activeTrip.routeSummary.eta))}`;
}

function tryAutofillOriginFromGeo() {
  if (!("geolocation" in navigator)) return;
  const originInput = document.getElementById("routeOrigin");
  if (!originInput || originInput.value.trim()) return;

  navigator.geolocation.getCurrentPosition(
    (position) => {
      appState.routeDraftOriginCoords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      originInput.value = "Current location";
    },
    () => {},
    { enableHighAccuracy: true, timeout: 6000, maximumAge: 300000 }
  );
}

function ensureRoutePlanningDefaults() {
  const startInput = document.getElementById("routeStartAt");
  if (startInput && !startInput.value) {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    startInput.value = local;
  }
}

function buildTimelineLite(startAt, totalMiles, avgSpeedMph) {
  const cities = ["Start City", "Memphis, TN", "Birmingham, AL", "Atlanta, GA", "Destination"];
  const timeline = [];
  const totalHours = totalMiles / Math.max(avgSpeedMph, 1);

  for (let i = 0; i < 5; i += 1) {
    const ratio = i / 4;
    const sampleTime = new Date(startAt.getTime() + totalHours * ratio * 3600 * 1000);
    const tempF = 44 + i * 8 + Math.round(Math.sin(i + 1) * 3);
    const windMph = 10 + i * 4;
    const precipPct = [10, 20, 35, 55, 18][i];
    const condition = ["Clear", "Cloudy", "Fog", "Rain", "Clear"][i];

    const anomalies = [];
    if (windMph >= 25) anomalies.push("Strong wind: 25+ mph");
    if (condition === "Fog") anomalies.push("Low visibility / fog risk");
    if (tempF <= 32 && precipPct > 20) anomalies.push("Possible ice risk (freezing + precipitation)");
    if (condition === "Rain" && precipPct >= 50) anomalies.push("Heavy rain risk");
    if (i === 3) anomalies.push("Official alert placeholder");

    timeline.push({
      id: `t-${i}`,
      cityState: cities[i],
      time: sampleTime,
      tempF,
      condition,
      windMph,
      precipPct,
      anomalies
    });
  }

  return timeline;
}

function buildPlannedTripFromForm(values) {
  const originCoords = appState.routeDraftOriginCoords || deterministicCoord(values.originText || "Current location", 1);
  const destinationCoords = deterministicCoord(values.destinationText, 2);
  const totalMiles = 320 + (deterministicSeed(`${values.originText}|${values.destinationText}`) % 1800);
  const durationHours = totalMiles / Math.max(values.avgSpeedMph, 1);
  const eta = new Date(new Date(values.departDateTime).getTime() + durationHours * 3600 * 1000);
  const routeGeometry = buildMockGeometry(originCoords, destinationCoords);
  const timelineLite = buildTimelineLite(new Date(values.departDateTime), totalMiles, values.avgSpeedMph);

  const eldPlan = [];
  const breakCount = values.breakRule ? Math.max(1, Math.floor(durationHours / 7.5)) : 0;
  for (let i = 0; i < breakCount; i += 1) {
    eldPlan.push({
      type: "30m_break",
      at: new Date(new Date(values.departDateTime).getTime() + (i + 1) * 7.5 * 3600 * 1000).toISOString()
    });
  }
  const resetCount = values.includeReset ? Math.max(0, Math.floor(durationHours / 11) - 1) : 0;
  for (let i = 0; i < resetCount; i += 1) {
    eldPlan.push({
      type: "10h_off_duty",
      at: new Date(new Date(values.departDateTime).getTime() + (i + 1) * 11 * 3600 * 1000).toISOString()
    });
  }

  return {
    origin: { text: values.originText || "Current location", ...originCoords },
    destination: { text: values.destinationText, ...destinationCoords },
    departDateTime: values.departDateTime,
    routeSummary: {
      miles: Number(totalMiles.toFixed(0)),
      durationHours: Number(durationHours.toFixed(1)),
      eta: eta.toISOString()
    },
    routeGeometry,
    eldPlan,
    savedAt: new Date().toISOString(),
    avgSpeedMph: values.avgSpeedMph,
    timelineLite
  };
}

function persistPlannedTripAsActive(plannedTrip) {
  appState.activeTrip = {
    origin: plannedTrip.origin,
    destination: plannedTrip.destination,
    departDateTime: new Date(plannedTrip.departDateTime).toISOString(),
    routeSummary: plannedTrip.routeSummary,
    routeGeometry: plannedTrip.routeGeometry,
    eldPlan: plannedTrip.eldPlan,
    savedAt: new Date().toISOString()
  };
  saveActiveTrip();
  renderActiveTripIndicator();
}

function routeFormValues() {
  return {
    originText: (document.getElementById("routeOrigin")?.value || "").trim(),
    destinationText: (document.getElementById("routeDestination")?.value || "").trim(),
    departDateTime: document.getElementById("routeStartAt")?.value || "",
    avgSpeedMph: Number(document.getElementById("routeAvgSpeed")?.value || "65"),
    driveHoursStart: Number(document.getElementById("routeDriveHoursStart")?.value || "11"),
    breakRule: Boolean(document.getElementById("routeBreakRule")?.checked),
    includeReset: Boolean(document.getElementById("routeIncludeReset")?.checked)
  };
}

function validateRouteForm(values) {
  if (!values.destinationText || !values.departDateTime) {
    window.alert("Destination and start date/time are required.");
    return false;
  }
  if (!Number.isFinite(values.avgSpeedMph) || values.avgSpeedMph <= 0) {
    window.alert("Average speed must be a positive mph value.");
    return false;
  }
  if (!Number.isFinite(values.driveHoursStart) || values.driveHoursStart < 0 || values.driveHoursStart > 11) {
    window.alert("Driving hours available must be between 0 and 11.");
    return false;
  }
  return true;
}

function amenityIconRow(amenities = [], fuel = null) {
  const chips = amenities
    .map((a) => `<span class="icon-chip">${escapeHtml(a.icon)} ${escapeHtml(a.label)}</span>`)
    .join("");
  const fuelChips = fuel
    ? `<span class="icon-chip fuel">${ICONS.diesel} Diesel ${escapeHtml(fuel.dieselPrice)}</span><span class="icon-chip fuel">${ICONS.def} DEF ${escapeHtml(fuel.defPrice)}</span>`
    : "";
  return `<div class="icon-row">${chips}${fuelChips}</div>`;
}

function weatherIconRow(weather) {
  return `
    <div class="icon-row">
      <span class="icon-chip">${ICONS.temp} ${escapeHtml(weather.tempF)}°F</span>
      <span class="icon-chip">${ICONS.condition} ${escapeHtml(weather.condition)}</span>
      <span class="icon-chip">${ICONS.wind} ${escapeHtml(weather.windMph)} mph</span>
      <span class="icon-chip">${ICONS.precip} ${escapeHtml(weather.precipPct)}%</span>
    </div>
  `;
}

function buildAmenities(type, includeFuel = false) {
  const amenities = [
    { label: "Restroom", icon: ICONS.restroom },
    { label: "Parking", icon: ICONS.parking },
    { label: "Food", icon: ICONS.food }
  ];
  if (type !== "Rest Area") amenities.push({ label: "Shower", icon: ICONS.shower });
  amenities.push({ label: "Overnight TBD", icon: ICONS.overnight });
  const fuel = includeFuel
    ? {
        dieselPrice: `$${(3.79 + Math.random() * 0.4).toFixed(2)}`,
        defPrice: `$${(3.95 + Math.random() * 0.35).toFixed(2)}`
      }
    : null;
  return { amenities, fuel };
}

function buildStopMockList(kind, count, { routeMode = false } = {}) {
  const cityPool = [
    ["Nashville", "TN"],
    ["Memphis", "TN"],
    ["Birmingham", "AL"],
    ["Atlanta", "GA"],
    ["Columbia", "SC"],
    ["Savannah", "GA"],
    ["Knoxville", "TN"],
    ["Little Rock", "AR"]
  ];
  const typePools = {
    truckNear: ["Truck Stop", "Rest Area", "Service Plaza"],
    placesRoute: ["Truck Stop", "Rest Area", "Service Plaza"],
    dieselNear: ["Fuel Plaza", "Truck Stop", "Service Plaza"],
    dieselRoute: ["Fuel Plaza", "Truck Stop", "Service Plaza"],
    restRoute: ["Rest Area", "Service Plaza"],
    portWatch: ["Port Camera"]
  };

  const items = [];
  for (let i = 0; i < count; i += 1) {
    const [city, state] = cityPool[i % cityPool.length];
    const type = (typePools[kind] || ["Truck Stop"])[i % (typePools[kind] || ["Truck Stop"]).length];
    const baseDistance = routeMode ? 10 + i * 16 : 1.2 + i * 1.4;
    const onRouteLabel = routeMode ? (i % 2 === 0 ? "On-route" : `${(0.8 + i * 0.4).toFixed(1)} mi off-route`) : null;
    const names = ["Pilot", "Love's", "TA", "Petro", "Service Plaza", "Travel Center"];
    const baseName = kind === "portWatch"
      ? `${city} Harbor Cam`
      : `${names[i % names.length]} ${city}`;
    const address = kind === "portWatch" ? "Address unavailable" : `${100 + i * 17} Highway Dr, ${city}, ${state}`;
    const includeFuel = kind.includes("diesel");
    const { amenities, fuel } = buildAmenities(type, includeFuel);

    items.push({
      id: `${kind}-${i}`,
      name: baseName,
      type,
      city,
      state,
      address,
      distanceMi: Number(baseDistance.toFixed(1)),
      etaMin: Math.round(baseDistance * 1.4),
      onRouteLabel,
      amenities,
      fuel,
      overnightRule: i % 2 === 0 ? "Overnight allowed: placeholder" : "Parking time limit posted: placeholder",
      googleQuery: `${baseName} ${city} ${state}`
    });
  }

  return items.sort((a, b) => a.distanceMi - b.distanceMi);
}

function buildTrafficMockList() {
  const routeLabel = appState.activeTrip
    ? `${appState.activeTrip.origin.text} → ${appState.activeTrip.destination.text}`
    : "Local route";
  return [
    { icon: ICONS.accident, kind: "Accident", segment: `${routeLabel} / Segment A`, delayMin: 16, severity: "High" },
    { icon: ICONS.construction, kind: "Construction", segment: `${routeLabel} / Segment B`, delayMin: 8, severity: "Medium" },
    { icon: ICONS.congestion, kind: "Congestion", segment: `${routeLabel} / Segment C`, delayMin: 12, severity: "Medium" },
    { icon: ICONS.congestion, kind: "Congestion", segment: `${routeLabel} / Segment D`, delayMin: 5, severity: "Low" }
  ];
}

function getDatasetRegistry() {
  return {
    truckNear: buildStopMockList("truckNear", 10),
    placesRoute: buildStopMockList("placesRoute", 9, { routeMode: true }),
    dieselNear: buildStopMockList("dieselNear", 8),
    dieselRoute: buildStopMockList("dieselRoute", 8, { routeMode: true }),
    restRoute: buildStopMockList("restRoute", 8, { routeMode: true }),
    portWatch: buildStopMockList("portWatch", 5)
  };
}

function renderStopCards(list, container, { listKind = "generic", showFuel = false, showOnRoute = false } = {}) {
  if (!container) return;

  container.innerHTML = list
    .map((stop) => {
      const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.googleQuery)}`;
      const badge = showOnRoute && stop.onRouteLabel
        ? `<span class="stop-card-badge">${escapeHtml(stop.onRouteLabel)}</span>`
        : "";
      return `
        <article class="stop-card">
          <div class="stop-card-head">
            <div>
              <div class="stop-card-title">${escapeHtml(stop.name)}</div>
              <div class="stop-card-type">${escapeHtml(stop.type)} • ${escapeHtml(stop.city)}, ${escapeHtml(stop.state)}</div>
            </div>
            ${badge}
          </div>
          <div class="stop-card-meta">Distance ${escapeHtml(stop.distanceMi)} mi • ETA ${escapeHtml(stop.etaMin)} min</div>
          <div class="stop-card-address">${escapeHtml(stop.address || "Address unavailable")}</div>
          ${amenityIconRow(stop.amenities, showFuel ? stop.fuel : null)}
          <div class="stop-card-actions">
            <button class="btn-mini primary js-stop-details" type="button" data-stop-id="${escapeHtml(stop.id)}" data-list-kind="${escapeHtml(listKind)}">Details/Amenities</button>
            <a class="btn-mini direction" href="${directionsUrl}" target="_blank" rel="noopener noreferrer">Directions</a>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderTrafficCards(list, container) {
  if (!container) return;
  container.innerHTML = list
    .map((item) => `
      <article class="traffic-card">
        <div class="traffic-title">${escapeHtml(item.icon)} ${escapeHtml(item.segment)}</div>
        <div class="traffic-meta">${escapeHtml(item.kind)} • Delay ${escapeHtml(item.delayMin)} min • Severity ${escapeHtml(item.severity)}</div>
        <div class="icon-row">
          <span class="icon-chip traffic">${escapeHtml(item.icon)} ${escapeHtml(item.kind)}</span>
          <span class="icon-chip warning">⏱️ ${escapeHtml(item.delayMin)} min delay</span>
        </div>
      </article>
    `)
    .join("");
}

function findStopById(listKind, stopId) {
  const group = getDatasetRegistry()[listKind];
  if (!Array.isArray(group)) return null;
  return group.find((item) => item.id === stopId) || null;
}

function renderStopDetails(stop) {
  const el = document.getElementById("detailsContent");
  if (!el || !stop) return;
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.googleQuery)}`;

  el.innerHTML = `
    <div class="details-head">
      <div class="details-name">${escapeHtml(stop.name)}</div>
      <div class="details-sub">${escapeHtml(stop.type)} • ${escapeHtml(stop.city)}, ${escapeHtml(stop.state)}</div>
      <div class="details-line">${escapeHtml(stop.address || "Address unavailable")}</div>
    </div>
    <div class="details-block">
      <div class="details-block-title">Amenities</div>
      ${amenityIconRow(stop.amenities, stop.fuel)}
    </div>
    <div class="details-block">
      <div class="details-block-title">Fuel / DEF</div>
      <div class="details-line">${stop.fuel ? `${ICONS.diesel} Diesel ${escapeHtml(stop.fuel.dieselPrice)} • ${ICONS.def} DEF ${escapeHtml(stop.fuel.defPrice)}` : "Fuel / DEF placeholder not available for this stop."}</div>
    </div>
    <div class="details-block">
      <div class="details-block-title">Parking / Overnight</div>
      <div class="details-line">${escapeHtml(stop.overnightRule || "Overnight allowed / time limit placeholder")}</div>
    </div>
    <div class="stop-card-actions">
      <a class="btn-mini direction" href="${directionsUrl}" target="_blank" rel="noopener noreferrer">Directions</a>
    </div>
  `;
  showView("viewDetails");
}

function renderTimelineCards(timeline, container) {
  if (!container) return;
  container.innerHTML = (timeline || [])
    .map((row) => `
      <article class="timeline-lite-card">
        <div class="timeline-lite-head">
          <div class="timeline-lite-time">${escapeHtml(formatTime(new Date(row.time)))}</div>
          <div class="timeline-lite-city">${escapeHtml(row.cityState)}</div>
        </div>
        <div class="timeline-lite-weather">
          <span>${ICONS.temp} ${escapeHtml(row.tempF)}°F</span>
          <span>${ICONS.condition} ${escapeHtml(row.condition)}</span>
          ${row.anomalies.length ? `<button class="warning-btn js-warning-btn" type="button" data-warning='${escapeHtml(JSON.stringify(row.anomalies))}'>⚠ ${escapeHtml(row.anomalies[0].split(":")[0])}</button>` : ""}
        </div>
      </article>
    `)
    .join("");
}

function openWarningModal(anomalies) {
  document.getElementById("warningModal")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "warningModal";
  overlay.className = "warning-modal";
  overlay.innerHTML = `
    <div class="warning-modal-card" role="dialog" aria-modal="true" aria-label="Weather warning details">
      <div class="warning-modal-title">⚠ Weather Warning</div>
      <div class="warning-modal-text">${anomalies.map((item) => `<div>• ${escapeHtml(item)}</div>`).join("")}</div>
      <div class="warning-modal-actions"><button id="btnCloseWarningModal" class="btn-mini primary" type="button">Close</button></div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.getElementById("btnCloseWarningModal")?.addEventListener("click", () => overlay.remove());
}

function renderWeatherNow() {
  const card = document.getElementById("weatherNowCard");
  if (!card) return;
  const weather = { city: "Nashville", st: "TN", tempF: 64, condition: "Partly Cloudy", windMph: 13, precipPct: 20 };
  card.innerHTML = `
    <div class="weather-now-card">
      <div class="weather-now-head">
        <div>
          <div class="weather-now-place">${escapeHtml(weather.city)}, ${escapeHtml(weather.st)}</div>
          <div class="weather-now-sub">Current conditions</div>
        </div>
        <span class="stop-card-badge">Now</span>
      </div>
      <div class="weather-now-grid">
        <div class="weather-now-item"><span class="weather-now-emoji">${ICONS.temp}</span><div><small>Temperature</small><strong>${escapeHtml(weather.tempF)}°F</strong></div></div>
        <div class="weather-now-item"><span class="weather-now-emoji">${ICONS.condition}</span><div><small>Condition</small><strong>${escapeHtml(weather.condition)}</strong></div></div>
        <div class="weather-now-item"><span class="weather-now-emoji">${ICONS.wind}</span><div><small>Wind</small><strong>${escapeHtml(weather.windMph)} mph</strong></div></div>
        <div class="weather-now-item"><span class="weather-now-emoji">${ICONS.precip}</span><div><small>Precip</small><strong>${escapeHtml(weather.precipPct)}%</strong></div></div>
      </div>
    </div>
  `;
}

function ensureActiveTripOrShowNoTrip() {
  if (appState.activeTrip) return true;
  showView("viewNoActiveTrip");
  return false;
}

function renderTripOverview(trip, { started = false } = {}) {
  appState.tripOverviewStarted = started;
  const summary = document.getElementById("tripOverviewSummary");
  const map = document.getElementById("tripMapPlaceholder");
  const lite = document.getElementById("tripTimelineLite");
  const compact = document.getElementById("tripTimelineCompact");
  if (!summary || !map || !lite || !compact) return;

  const mapExpanded = appState.tripMapExpanded;
  summary.innerHTML = `
    <div class="rw-summary-row"><strong>${escapeHtml(trip.origin.text)} → ${escapeHtml(trip.destination.text)}</strong></div>
    <div class="rw-summary-grid">
      <div><span>Total miles</span><strong>${escapeHtml(trip.routeSummary.miles)} mi</strong></div>
      <div><span>Departure</span><strong>${escapeHtml(formatDateTime(new Date(trip.departDateTime)))}</strong></div>
      <div><span>Avg speed</span><strong>${escapeHtml(trip.avgSpeedMph || 65)} mph</strong></div>
      <div><span>ETA</span><strong>${escapeHtml(formatDateTime(new Date(trip.routeSummary.eta)))}</strong></div>
      <div><span>30-min breaks</span><strong>${escapeHtml(trip.eldPlan.filter((s) => s.type === "30m_break").length)}</strong></div>
      <div><span>10-hour stops</span><strong>${escapeHtml(trip.eldPlan.filter((s) => s.type === "10h_off_duty").length)}</strong></div>
    </div>
    <div class="rw-summary-label">Smart ETA (ELD-aware + traffic history)</div>
    <div class="rw-summary-actions">
      <button id="btnStartFromOverview" class="rw-btn-primary" type="button">Start My Trip</button>
      <span class="rw-summary-note">${started ? "Active trip view" : "Planned trip preview"}</span>
    </div>
  `;

  map.innerHTML = `
    <div class="map-collapsible">
      <div class="map-collapsible-head">
        <button id="btnToggleMap" class="rw-link-btn" type="button">${mapExpanded ? "Hide/Collapse Map" : "Show/Expand Map"}</button>
        <span class="forward-note">${started ? "Active route map" : "Trip preview map"}</span>
      </div>
      <div id="mapPanel" class="map-collapsible-panel" ${mapExpanded ? "" : "hidden"}>
        <div class="trip-map-placeholder">
          🗺️ ${started ? "Route Map Placeholder" : "Route Preview Placeholder"}<br>
          <span class="forward-note">${escapeHtml(trip.origin.text)} → ${escapeHtml(trip.destination.text)}</span>
        </div>
      </div>
    </div>
  `;

  renderTimelineCards(trip.timelineLite || [], lite);
  compact.innerHTML = started
    ? (trip.timelineLite || [])
        .map((row) => `<div class="timeline-compact-line">${escapeHtml(row.cityState)} — ${escapeHtml(formatTime(new Date(row.time)))} — ${escapeHtml(row.tempF)}°F${row.anomalies.length ? " — ⚠" : ""}</div>`)
        .join("")
    : "";

  document.getElementById("btnStartFromOverview")?.addEventListener("click", () => {
    persistPlannedTripAsActive(trip);
    renderTripOverview(trip, { started: true });
  });
  document.getElementById("btnToggleMap")?.addEventListener("click", () => {
    appState.tripMapExpanded = !appState.tripMapExpanded;
    renderTripOverview(trip, { started: appState.tripOverviewStarted });
  });
}

function openListViewForButton(buttonId) {
  const registry = getDatasetRegistry();
  if (buttonId === "btnTrip") {
    ensureRoutePlanningDefaults();
    tryAutofillOriginFromGeo();
    showView("viewRoutePlanning");
    return;
  }
  if (buttonId === "btnWeatherNow") {
    renderWeatherNow();
    showView("viewWeatherNow");
    return;
  }
  if (buttonId === "btnTruckNear") {
    renderStopCards(registry.truckNear, document.getElementById("truckNearList"), { listKind: "truckNear" });
    showView("viewTruckStopNear");
    return;
  }
  if (buttonId === "btnTruckRoute") {
    if (!ensureActiveTripOrShowNoTrip()) return;
    renderStopCards(registry.placesRoute, document.getElementById("placesStopNowList"), { listKind: "placesRoute", showOnRoute: true });
    showView("viewPlacesStopNow");
    return;
  }
  if (buttonId === "btnDieselNear") {
    renderStopCards(registry.dieselNear, document.getElementById("dieselNearList"), { listKind: "dieselNear", showFuel: true });
    showView("viewDieselDefNear");
    return;
  }
  if (buttonId === "btnDieselRoute") {
    if (!ensureActiveTripOrShowNoTrip()) return;
    renderStopCards(registry.dieselRoute, document.getElementById("dieselRouteList"), { listKind: "dieselRoute", showFuel: true, showOnRoute: true });
    showView("viewDieselDefRoute");
    return;
  }
  if (buttonId === "btnRestRoute") {
    if (!ensureActiveTripOrShowNoTrip()) return;
    renderStopCards(registry.restRoute, document.getElementById("restRouteList"), { listKind: "restRoute", showOnRoute: true });
    showView("viewRestAreasRoute");
    return;
  }
  if (buttonId === "btnTrafficAhead") {
    if (!ensureActiveTripOrShowNoTrip()) return;
    renderTrafficCards(buildTrafficMockList(), document.getElementById("trafficAheadList"));
    showView("viewTrafficAhead");
    return;
  }
  if (buttonId === "btnPort") {
    renderStopCards(registry.portWatch, document.getElementById("portWatchList"), { listKind: "portWatch" });
    showView("viewPortWatch");
  }
}

function handleGlobalClick(event) {
  const detailsBtn = event.target.closest(".js-stop-details");
  if (detailsBtn) {
    const stopId = detailsBtn.getAttribute("data-stop-id") || "";
    const listKind = detailsBtn.getAttribute("data-list-kind") || "";
    const stop = findStopById(listKind, stopId);
    if (stop) renderStopDetails(stop);
    return;
  }

  const warningBtn = event.target.closest(".js-warning-btn");
  if (warningBtn) {
    try {
      const anomalies = JSON.parse(warningBtn.getAttribute("data-warning") || "[]");
      openWarningModal(Array.isArray(anomalies) ? anomalies : ["Weather anomaly placeholder"]);
    } catch {
      openWarningModal(["Weather anomaly placeholder"]);
    }
  }
}

function bindHomeButtons() {
  [
    "btnTrip",
    "btnWeatherNow",
    "btnTruckNear",
    "btnTruckRoute",
    "btnDieselNear",
    "btnDieselRoute",
    "btnRestRoute",
    "btnTrafficAhead",
    "btnPort"
  ].forEach((id) => {
    document.getElementById(id)?.addEventListener("click", () => openListViewForButton(id));
  });
}

function bindNavButtons() {
  document.getElementById("btnNavBack")?.addEventListener("click", goBackView);
  document.getElementById("btnNavHome")?.addEventListener("click", goHome);
  document.getElementById("btnNavForward")?.addEventListener("click", goForwardView);
}

function bindRoutePlanning() {
  document.getElementById("routePlanForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = routeFormValues();
    if (!validateRouteForm(values)) return;
    const trip = buildPlannedTripFromForm(values);
    appState.lastPlannedTrip = trip;
    appState.tripMapExpanded = false;
    renderTripOverview(trip, { started: false });
    showView("viewTripOverview");
  });

  document.getElementById("btnStartTripDirect")?.addEventListener("click", () => {
    const values = routeFormValues();
    if (!validateRouteForm(values)) return;
    const trip = buildPlannedTripFromForm(values);
    appState.lastPlannedTrip = trip;
    appState.tripMapExpanded = true;
    persistPlannedTripAsActive(trip);
    renderTripOverview(trip, { started: true });
    showView("viewTripOverview");
  });

  [
    "routeOrigin",
    "routeDestination",
    "routeStartAt",
    "routeAvgSpeed",
    "routeDriveHoursStart",
    "routeBreakRule",
    "routeIncludeReset"
  ].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", saveUiState);
    document.getElementById(id)?.addEventListener("change", saveUiState);
  });
}

function bindNoTripView() {
  document.getElementById("btnGoPlanFromNoTrip")?.addEventListener("click", () => {
    ensureRoutePlanningDefaults();
    tryAutofillOriginFromGeo();
    showView("viewRoutePlanning");
  });
}

function bindClearTripButtons() {
  document.getElementById("btnClearTripTop")?.addEventListener("click", clearActiveTrip);
  document.getElementById("btnClearTripOverview")?.addEventListener("click", clearActiveTrip);
}

function hydrateRouteFormFromActiveTrip() {
  const trip = appState.activeTrip;
  if (!trip) return;
  const origin = document.getElementById("routeOrigin");
  const destination = document.getElementById("routeDestination");
  const startAt = document.getElementById("routeStartAt");
  if (origin && !origin.value) origin.value = trip.origin.text;
  if (destination && !destination.value) destination.value = trip.destination.text;
  if (startAt && !startAt.value) {
    const d = new Date(trip.departDateTime);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    startAt.value = local;
  }
}

function hydrateRouteFormFromUiState(uiState) {
  if (!uiState?.routeForm) return;
  const form = uiState.routeForm;
  const mappings = [
    ["routeOrigin", form.routeOrigin],
    ["routeDestination", form.routeDestination],
    ["routeStartAt", form.routeStartAt],
    ["routeAvgSpeed", form.routeAvgSpeed],
    ["routeDriveHoursStart", form.routeDriveHoursStart]
  ];

  mappings.forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el && value != null && String(value) !== "") {
      el.value = value;
    }
  });

  const breakRule = document.getElementById("routeBreakRule");
  const includeReset = document.getElementById("routeIncludeReset");
  if (breakRule && typeof form.routeBreakRule === "boolean") breakRule.checked = form.routeBreakRule;
  if (includeReset && typeof form.routeIncludeReset === "boolean") includeReset.checked = form.routeIncludeReset;
}

function bootstrapActiveTripForOverview() {
  if (!appState.activeTrip) return;
  appState.lastPlannedTrip = {
    ...appState.activeTrip,
    avgSpeedMph: 65,
    timelineLite: buildTimelineLite(
      new Date(appState.activeTrip.departDateTime),
      Number(appState.activeTrip.routeSummary.miles || 800),
      65
    )
  };
}

function restoreViewFromUiState(uiState) {
  if (!uiState?.currentView) return;
  const view = uiState.currentView;
  appState.tripMapExpanded = Boolean(uiState.tripMapExpanded);

  if (view === "viewHome") return;
  if (view === "viewRoutePlanning") {
    ensureRoutePlanningDefaults();
    showView("viewRoutePlanning", { pushHistory: false });
    return;
  }
  if (view === "viewTripOverview" && appState.lastPlannedTrip) {
    renderTripOverview(appState.lastPlannedTrip, { started: appState.tripOverviewStarted });
    showView("viewTripOverview", { pushHistory: false });
    return;
  }

  // Re-render list-based views safely from current mock generators
  const buttonMap = {
    viewWeatherNow: "btnWeatherNow",
    viewTruckStopNear: "btnTruckNear",
    viewPlacesStopNow: "btnTruckRoute",
    viewDieselDefNear: "btnDieselNear",
    viewDieselDefRoute: "btnDieselRoute",
    viewRestAreasRoute: "btnRestRoute",
    viewTrafficAhead: "btnTrafficAhead",
    viewPortWatch: "btnPort"
  };
  const buttonId = buttonMap[view];
  if (buttonId) {
    openListViewForButton(buttonId);
    appState.backStack = [];
    appState.forwardStack = [];
    updateNavButtons();
  }
}

function init() {
  const uiState = loadUiState();
  appState.activeTrip = loadActiveTrip();
  bindNavButtons();
  bindHomeButtons();
  bindRoutePlanning();
  bindNoTripView();
  bindClearTripButtons();
  document.addEventListener("click", handleGlobalClick);

  ensureRoutePlanningDefaults();
  hydrateRouteFormFromActiveTrip();
  hydrateRouteFormFromUiState(uiState);
  bootstrapActiveTripForOverview();
  renderWeatherNow();
  renderActiveTripIndicator();
  updateNavButtons();
  showView("viewHome", { pushHistory: false });
  restoreViewFromUiState(uiState);
}

document.addEventListener("DOMContentLoaded", init);
