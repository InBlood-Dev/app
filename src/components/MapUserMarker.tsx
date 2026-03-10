import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { Image } from "expo-image";
import { Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import type { MapUser } from "../types";

interface Props {
  user: MapUser;
  onPress: (user: MapUser) => void;
  isSelected?: boolean;
}

export const MapUserMarker: React.FC<Props> = ({
  user,
  onPress,
  isSelected,
}) => {
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [stopTracking, setStopTracking] = React.useState(false);
  const imageUri = user.primary_photo || "https://via.placeholder.com/150";
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  // console.log(`[MapUserMarker] Rendering marker for ${user.name}, image: ${imageUri}`);

  // Stop tracking view changes after a delay to improve performance
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setStopTracking(true);
    }, 3000); // Give 3 seconds for images to load
    return () => clearTimeout(timer);
  }, []);

  return (
    <Marker
      coordinate={{
        latitude: user.latitude,
        longitude: user.longitude,
      }}
      onPress={() => {
        console.log("[MapUserMarker] Marker pressed:", user.name);
        onPress(user);
      }}
      tracksViewChanges={!stopTracking}
    >
      <View
        style={[styles.markerContainer, isSelected && styles.markerSelected]}
      >
        {/* Fallback background with initials */}
        <View style={styles.fallbackContainer}>
          <Text style={styles.initials}>{initials}</Text>
        </View>
        {/* Image overlay */}
        <Image
          source={{ uri: imageUri }}
          style={styles.markerImage}
          contentFit="cover"
          cachePolicy="memory-disk"
          priority="high"
          onLoad={() => {
            console.log(`[MapUserMarker] Image loaded for ${user.name}`);
            setImageLoaded(true);
          }}
          onError={(error) => {
            console.error(
              `[MapUserMarker] Image error for ${user.name}:`,
              error,
            );
          }}
        />
        {user.is_verified && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark" size={10} color="white" />
          </View>
        )}
      </View>
      <View style={styles.markerPoint} />
    </Marker>
  );
};

const styles = StyleSheet.create({
  markerContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: "#E53935",
    overflow: "hidden",
    backgroundColor: "#E53935",
  },
  markerSelected: {
    borderWidth: 4,
    borderColor: "#FF6F61",
    transform: [{ scale: 1.2 }],
  },
  fallbackContainer: {
    position: "absolute",
    width: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E53935",
  },
  initials: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  markerImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  verifiedBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
  },
  markerPoint: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E53935",
    marginTop: -4,
    alignSelf: "center",
  },
});
