import React, { useMemo, useEffect } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker } from 'react-native-maps';
import { Image } from 'expo-image';
import { MapUserMarker } from './MapUserMarker';
import { MAPS_CONFIG, DARK_MAP_STYLE } from '../config/maps.config';
import type { MapUser } from '../types';

interface Props {
  users: MapUser[];
  userLocation: { latitude: number; longitude: number } | null;
  onUserPress: (user: MapUser) => void;
  onMapPress: () => void;
  height?: number;
}

export const NearbyMapPreview: React.FC<Props> = ({
  users,
  userLocation,
  onUserPress,
  onMapPress,
  height = 220,
}) => {
  console.log(`[NearbyMapPreview] Rendering: ${users.length} users, userLocation: ${JSON.stringify(userLocation)}, height: ${height}`);
  // Prefetch images for better map marker performance
  useEffect(() => {
    const imagesToPrefetch = users
      .slice(0, 5)
      .map(user => user.primary_photo || 'https://via.placeholder.com/150')
      .filter(Boolean);

    if (imagesToPrefetch.length > 0) {
      console.log(`[NearbyMapPreview] Prefetching ${imagesToPrefetch.length} images`);
      Image.prefetch(imagesToPrefetch);
    }
  }, [users]);

  // Spread out overlapping markers
  const spreadMarkers = useMemo(() => {
    const displayUsers = users.slice(0, 5);
    const result: Array<MapUser & { displayLat: number; displayLng: number }> = [];

    displayUsers.forEach((user) => {
      // Check if this location is too close to any existing marker
      const overlapping = result.filter(existing => {
        const latDiff = Math.abs(existing.latitude - user.latitude);
        const lngDiff = Math.abs(existing.longitude - user.longitude);
        // Consider markers overlapping if within ~10 meters
        return latDiff < 0.0001 && lngDiff < 0.0001;
      });

      if (overlapping.length > 0) {
        // Generate deterministic random angle based on user_id hash
        const hash = user.user_id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const angle = ((hash % 360) + overlapping.length * 60) * (Math.PI / 180);

        // Random offset distance between 100-150 meters
        const offsetDistance = 0.001 + (hash % 6) * 0.00008;
        const latOffset = Math.cos(angle) * offsetDistance;
        const lngOffset = Math.sin(angle) * offsetDistance;

        result.push({
          ...user,
          displayLat: user.latitude + latOffset,
          displayLng: user.longitude + lngOffset,
        });
      } else {
        result.push({
          ...user,
          displayLat: user.latitude,
          displayLng: user.longitude,
        });
      }
    });

    return result;
  }, [users]);

  const region = useMemo(() => {
    if (userLocation && users.length > 0) {
      // Include user location + at least 2 nearby users (or all if less than 2)
      const usersToInclude = users.slice(0, 2);
      const allCoordinates = [
        userLocation,
        ...usersToInclude.map(u => ({ latitude: u.latitude, longitude: u.longitude }))
      ];

      // Calculate bounding box
      const latitudes = allCoordinates.map(c => c.latitude);
      const longitudes = allCoordinates.map(c => c.longitude);

      const minLat = Math.min(...latitudes);
      const maxLat = Math.max(...latitudes);
      const minLng = Math.min(...longitudes);
      const maxLng = Math.max(...longitudes);

      // Calculate center and deltas
      const centerLat = (minLat + maxLat) / 2;
      const centerLng = (minLng + maxLng) / 2;

      // Add 50% padding to ensure markers aren't at edges
      const latDelta = Math.max((maxLat - minLat) * 1.5, 0.01);
      const lngDelta = Math.max((maxLng - minLng) * 1.5, 0.01);

      return {
        latitude: centerLat,
        longitude: centerLng,
        latitudeDelta: latDelta,
        longitudeDelta: lngDelta,
      };
    }

    if (userLocation) {
      return {
        ...userLocation,
        latitudeDelta: MAPS_CONFIG.DEFAULT_REGION.latitudeDelta,
        longitudeDelta: MAPS_CONFIG.DEFAULT_REGION.longitudeDelta,
      };
    }

    return MAPS_CONFIG.DEFAULT_REGION;
  }, [userLocation, users]);

  console.log(`[NearbyMapPreview] Region: ${JSON.stringify(region)}`);
  console.log(`[NearbyMapPreview] spreadMarkers: ${spreadMarkers.length}`);

  return (
    <Pressable onPress={onMapPress} style={[styles.container, { height }]}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={region}
        scrollEnabled={false}
        zoomEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        customMapStyle={DARK_MAP_STYLE}
      >
        {userLocation && (
          <Marker coordinate={userLocation}>
            <View style={styles.userLocationMarker}>
              <View style={styles.userLocationPulse} />
            </View>
          </Marker>
        )}

        {spreadMarkers.map(user => (
          <MapUserMarker
            key={user.user_id}
            user={{
              ...user,
              latitude: user.displayLat,
              longitude: user.displayLng,
            }}
            onPress={onUserPress}
          />
        ))}
      </MapView>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#E53935',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  userLocationMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4CAF50',
    borderWidth: 3,
    borderColor: 'white',
  },
  userLocationPulse: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
    top: -10,
    left: -10,
  },
});
