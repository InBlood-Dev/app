/**
 * Location Service
 *
 * API calls for location-based features
 */

import { get, put, ApiResponse } from './api';
import { ENDPOINTS } from '../config/api.config';
import type {
  NearbyActiveResponse,
  MapNearbyResponse,
  LocationUpdateResponse,
} from '../types';

/**
 * Get nearby active users for homepage widget
 */
export const getNearbyActiveUsers = async (
  limit: number = 10
): Promise<ApiResponse<NearbyActiveResponse>> => {
  return get<NearbyActiveResponse>(ENDPOINTS.LOCATION.NEARBY_ACTIVE, { limit });
};

/**
 * Get nearby users with coordinates for map view
 */
export const getMapNearbyUsers = async (
  latitude: number,
  longitude: number,
  radius: number = 25
): Promise<ApiResponse<MapNearbyResponse>> => {
  return get<MapNearbyResponse>(ENDPOINTS.LOCATION.MAP_NEARBY, {
    latitude,
    longitude,
    radius,
  });
};

/**
 * Update user's current location
 */
export const updateUserLocation = async (
  latitude: number,
  longitude: number
): Promise<ApiResponse<LocationUpdateResponse>> => {
  return put<LocationUpdateResponse>(ENDPOINTS.USERS.LOCATION, {
    latitude,
    longitude,
  });
};

export default {
  getNearbyActiveUsers,
  getMapNearbyUsers,
  updateUserLocation,
};
