import React, { useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import roadsGeoJson from './roads.json'; // your GeoJSON file

export default function App() {
  const [currentRoad, setCurrentRoad] = useState(null);

  useEffect(() => {
    (async () => {
      // Ask for location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is needed!');
        return;
      }

      // Subscribe to location updates
      Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 1 },
        (location) => {
          const userCoords = [location.coords.longitude, location.coords.latitude];
          const userSpeed = location.coords.speed * 3.6; // m/s → km/h

          const road = getCurrentRoad(userCoords);

          // Entered new road
          if (road && road.name !== currentRoad?.name) {
            setCurrentRoad(road);
            sendNotification(`You have entered a ${road.speed_limit} km/h zone: ${road.name}`);
          }

          // Exceeding speed limit
          if (road && userSpeed > road.speed_limit) {
            sendNotification(`Slow down! You are exceeding ${road.speed_limit} km/h on ${road.name}`);
          }
        }
      );
    })();
  }, []);

  // Helper: check which road the user is on
  function getCurrentRoad(coords) {
    for (let feature of roadsGeoJson.features) {
      const line = feature.geometry.coordinates;

      // Simple proximity check (you can improve with polyline distance)
      for (let point of line) {
        const distance = getDistance(coords, point);
        if (distance < 0.01) { // ~10 meters tolerance
          return { name: feature.properties.name, speed_limit: feature.properties.speed_limit };
        }
      }
    }
    return null;
  }

  // Simple distance function between two coords (lon, lat)
  function getDistance([lon1, lat1], [lon2, lat2]) {
    return Math.sqrt(Math.pow(lon1 - lon2, 2) + Math.pow(lat1 - lat2, 2));
  }

  // Expo notification helper
  async function sendNotification(message) {
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Speed Zone Alert', body: message },
      trigger: null,
    });
  }

  return (
    <View>
      <Text>Speed Zone App Running...</Text>
    </View>
  );
}