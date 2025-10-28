// MapScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import * as Speech from "expo-speech";
import * as Location from "expo-location";
import baguioRoads from "./assets/baguioRoads.json";
import { point as turfPoint, lineString as turfLineString } from "@turf/helpers";
import pointToLineDistance from "@turf/point-to-line-distance";
import type { Feature, LineString } from "geojson";

const roadsSpeeds: Record<string, number> = {
  "Session Road": 20,
  "Marcos Highway": 60,
  "Kennon Road": 50,
  "Naguilian Road": 50,
  "Asin Road": 40,
  "Loakan Road": 40,
  "Halsema Highway": 50,
  "Magsaysay Avenue": 30,
  "Governor Pack Road": 30,
  "Military Cut-Off Road": 20,
};

type RoadFeature = Feature<LineString, { name: string; speed_limit?: number }>;

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState({
    latitude: 16.412,
    longitude: 120.599,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState<RoadFeature[]>([]);
  const [userSpeed, setUserSpeed] = useState<number>(0);
  const [currentRoad, setCurrentRoad] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [routeRoads, setRouteRoads] = useState<
    { name: string; speed_limit: number; color: string }[]
  >([]);

  const roadFeatures = (baguioRoads.features || []) as RoadFeature[];
  const lastSpokenRef = useRef<number>(0);
  const userLocationRef = useRef<{ lat: number; lon: number } | null>(null);

  const getColorForSpeed = (limit: number) => {
    if (limit <= 20) return "rgba(255,255,0,0.9)";
    if (limit <= 30) return "rgba(255,165,0,0.9)";
    if (limit <= 40) return "rgba(255,0,0,0.9)";
    return "rgba(0,128,0,0.9)";
  };

  const speak = (text: string) => {
    try {
      Speech.stop();
      Speech.speak(text, { rate: 1.0 });
    } catch (e) {
      console.warn("Speech error:", e);
    }
  };

  // 📍 Watch user position
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Location access is required.");
        return;
      }

      await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Highest,
          distanceInterval: 5,
          timeInterval: 1000,
        },
        (loc) => {
          const { latitude, longitude, speed } = loc.coords;
          userLocationRef.current = { lat: latitude, lon: longitude };
          setRegion((r) => ({ ...r, latitude, longitude }));
          setUserSpeed((speed ?? 0) * 3.6);

          // Detect nearest road
          let nearest: string | null = null;
          let limit = 0;
          let minDist = Infinity;

          for (const road of roadFeatures) {
            try {
              const line = turfLineString(road.geometry.coordinates as any);
              const dist = pointToLineDistance(turfPoint([longitude, latitude]), line, { units: "meters" });
              if (dist < minDist) {
                minDist = dist;
                nearest = road.properties?.name || null;
                limit = road.properties?.speed_limit ?? roadsSpeeds[nearest ?? ""] ?? 30;
              }
            } catch {}
          }

          if (nearest && minDist <= 30) {
            setCurrentRoad(nearest);

            const now = Date.now();
            if (now - lastSpokenRef.current > 7000) {
              if (userSpeed > limit + 3) {
                speak(`Warning! You are overspeeding on ${nearest}. The limit is ${limit}.`);
              } else {
                speak(`You are now on ${nearest}. The speed limit is ${limit}.`);
              }
              lastSpokenRef.current = now;
            }
          }
        }
      );
    })();
  }, []);

  // 🔍 Handle search → fetch route via OSRM
  const handleSearch = async (query: string) => {
    if (!query.trim()) return;

    try {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query + ", Baguio City, Philippines"
        )}`
      );
      const geo = await geoRes.json();
      if (!geo?.length) {
        Alert.alert("Not found", "Could not find that location.");
        return;
      }

      const destLat = parseFloat(geo[0].lat);
      const destLon = parseFloat(geo[0].lon);
      const userLoc = userLocationRef.current;

      if (!userLoc) {
        Alert.alert("Error", "User location not yet detected.");
        return;
      }

      const routeRes = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${userLoc.lon},${userLoc.lat};${destLon},${destLat}?overview=full&geometries=geojson`
      );

      const routeJson = await routeRes.json();
      if (!routeJson?.routes?.length) {
        Alert.alert("Routing failed", "No route found.");
        return;
      }

      const coords = routeJson.routes[0].geometry.coordinates.map(([lon, lat]: [number, number]) => ({
        latitude: lat,
        longitude: lon,
      }));
      setRouteCoords(coords);
      setShowLegend(true);

      // Match roads from GeoJSON along route
      const matched: { name: string; speed_limit: number; color: string }[] = [];
      for (const road of roadFeatures) {
        for (const [lon, lat] of routeJson.routes[0].geometry.coordinates) {
          const dist = pointToLineDistance(turfPoint([lon, lat]), road as any, { units: "meters" });
          if (dist <= 30) {
            const name = road.properties?.name ?? "Unnamed";
            const limit = road.properties?.speed_limit ?? roadsSpeeds[name] ?? 30;
            if (!matched.find((m) => m.name === name)) {
              matched.push({ name, speed_limit: limit, color: getColorForSpeed(limit) });
            }
          }
        }
      }
      setRouteRoads(matched);

      const mid = coords[Math.floor(coords.length / 2)];
      mapRef.current?.animateToRegion(
        { ...mid, latitudeDelta: 0.03, longitudeDelta: 0.03 },
        1000
      );

      speak(`Route found to ${query}.`);
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to find route.");
    }
  };

  // 🔍 On typing search
  const handleSearchChange = (text: string) => {
    setSearchText(text);
    if (!text.trim()) setSuggestions([]);
    else {
      const matches = roadFeatures.filter((r) =>
        r.properties?.name?.toLowerCase().includes(text.toLowerCase())
      );
      setSuggestions(matches.slice(0, 5));
    }
  };

  return (
    <View style={styles.container}>
      {/* 🔍 Search bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search for a road or place..."
          value={searchText}
          onChangeText={handleSearchChange}
          onSubmitEditing={() => handleSearch(searchText)}
        />
        {suggestions.length > 0 && (
          <ScrollView style={styles.suggestionsBox}>
            {suggestions.map((road, i) => (
              <TouchableOpacity key={`${road.properties?.name}-${i}`} onPress={() => handleSearch(road.properties?.name ?? "")}>
                <Text style={styles.suggestionText}>{road.properties?.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* 🗺️ Map */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        showsUserLocation={true}
        followsUserLocation={true}
        region={region}
      >
        {/* Route path */}
        {routeCoords.length > 0 && (
          <Polyline coordinates={routeCoords} strokeColor="#0000FF" strokeWidth={5} />
        )}

        {/* Colored segments based on speed limits */}
        {routeRoads.map((r, i) => {
          const feature = roadFeatures.find((f) => f.properties?.name === r.name);
          if (!feature) return null;
          const coords = feature.geometry.coordinates.map(([lon, lat]) => ({
            latitude: lat,
            longitude: lon,
          }));
          return (
            <Polyline
              key={`${r.name}-${i}`}
              coordinates={coords}
              strokeColor={r.color}
              strokeWidth={4}
            />
          );
        })}
      </MapView>

      {/* 🧾 Legend */}
      {showLegend && (
        <View style={styles.legendBox}>
          <Text style={styles.legendTitle}>Roads Along Route</Text>
          <ScrollView>
            {routeRoads.map((r, i) => (
              <View key={`${r.name}-${i}`} style={styles.legendRow}>
                <View style={[styles.colorDot, { backgroundColor: r.color }]} />
                <Text style={styles.legendText}>
                  {r.name} — {r.speed_limit} km/h
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* 🚗 Status */}
      <View style={styles.statusBox}>
        <Text style={styles.statusText}>
          {currentRoad
            ? `${currentRoad} • ${userSpeed.toFixed(1)} km/h`
            : `Speed: ${userSpeed.toFixed(1)} km/h`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  searchContainer: {
    position: "absolute",
    top: 50,
    left: 10,
    right: 10,
    zIndex: 10,
    backgroundColor: "white",
    borderRadius: 10,
    elevation: 4,
    padding: 8,
  },
  searchInput: { fontSize: 16, paddingVertical: 6, paddingHorizontal: 8 },
  suggestionsBox: { backgroundColor: "white", borderRadius: 6, marginTop: 4, elevation: 3 },
  suggestionText: { padding: 10, fontSize: 15, borderBottomWidth: 1, borderBottomColor: "#eee" },
  statusBox: {
    position: "absolute",
    top: 20,
    left: 10,
    backgroundColor: "rgba(255,255,255,0.9)",
    padding: 8,
    borderRadius: 8,
    elevation: 4,
  },
  statusText: { fontWeight: "bold" },
  legendBox: {
    position: "absolute",
    bottom: 20,
    left: 10,
    right: 10,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 10,
    padding: 10,
    elevation: 6,
    maxHeight: 200,
  },
  legendTitle: { fontWeight: "bold", fontSize: 16, marginBottom: 6 },
  legendRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  colorDot: { width: 20, height: 20, borderRadius: 10, marginRight: 8 },
  legendText: { fontSize: 14 },
});
