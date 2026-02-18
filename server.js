const path = require("path");
const express = require("express");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || "";

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/directions", async (req, res) => {
  try {
    if (!googleMapsApiKey) {
      res.status(500).json({
        error: "Missing GOOGLE_MAPS_API_KEY in backend environment."
      });
      return;
    }

    const { originLat, originLon, destLat, destLon } = req.query;
    const values = [originLat, originLon, destLat, destLon].map((value) => Number(value));
    if (values.some((value) => Number.isNaN(value))) {
      res.status(400).json({ error: "Invalid coordinates." });
      return;
    }

    const [oLat, oLon, dLat, dLon] = values;
    const directionsUrl = new URL("https://maps.googleapis.com/maps/api/directions/json");
    directionsUrl.searchParams.set("origin", `${oLat},${oLon}`);
    directionsUrl.searchParams.set("destination", `${dLat},${dLon}`);
    directionsUrl.searchParams.set("mode", "driving");
    directionsUrl.searchParams.set("alternatives", "false");
    directionsUrl.searchParams.set("key", googleMapsApiKey);

    const directionsResponse = await fetch(directionsUrl.toString());
    if (!directionsResponse.ok) {
      res.status(502).json({
        error: `Directions provider error: ${directionsResponse.status}`
      });
      return;
    }

    const directionsData = await directionsResponse.json();
    if (directionsData.status !== "OK" || !Array.isArray(directionsData.routes) || directionsData.routes.length === 0) {
      res.status(404).json({
        error: `No route found: ${directionsData.status || "UNKNOWN"}`
      });
      return;
    }

    const leg = directionsData.routes[0]?.legs?.[0];
    if (!leg) {
      res.status(404).json({ error: "No route leg found." });
      return;
    }

    res.json({
      distanceText: leg.distance?.text || "n/a",
      durationText: leg.duration?.text || "n/a",
      distanceValueMeters: leg.distance?.value || null,
      durationValueSeconds: leg.duration?.value || null,
      startAddress: leg.start_address || "",
      endAddress: leg.end_address || "",
      googleMapsUrl: `https://www.google.com/maps/dir/?api=1&origin=${oLat},${oLon}&destination=${dLat},${dLon}&travelmode=driving`
    });
  } catch (error) {
    res.status(500).json({
      error: `Directions request failed: ${error.message || "unknown error"}`
    });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(port, () => {
  console.log(`RoadWatch server running on http://localhost:${port}`);
});
