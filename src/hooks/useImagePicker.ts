/**
 * Custom hook for handling image picker functionality
 * with camera and gallery access
 */

import { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';

export interface ImagePickerResult {
  uri: string;
  width: number;
  height: number;
  type: 'image' | 'video';
}

export interface UseImagePickerReturn {
  pickFromCamera: () => Promise<ImagePickerResult | null>;
  pickFromGallery: () => Promise<ImagePickerResult | null>;
  hasPermission: {
    camera: boolean | null;
    gallery: boolean | null;
  };
  requestCameraPermission: () => Promise<boolean>;
  requestGalleryPermission: () => Promise<boolean>;
}

export const useImagePicker = (): UseImagePickerReturn => {
  const [hasPermission, setHasPermission] = useState<{
    camera: boolean | null;
    gallery: boolean | null;
  }>({
    camera: null,
    gallery: null,
  });

  /**
   * Request camera permission
   */
  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      const granted = status === 'granted';
      setHasPermission(prev => ({ ...prev, camera: granted }));
      return granted;
    } catch (error) {
      console.error('[useImagePicker] Camera permission error:', error);
      setHasPermission(prev => ({ ...prev, camera: false }));
      return false;
    }
  }, []);

  /**
   * Request gallery permission
   */
  const requestGalleryPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      const granted = status === 'granted';
      setHasPermission(prev => ({ ...prev, gallery: granted }));
      return granted;
    } catch (error) {
      console.error('[useImagePicker] Gallery permission error:', error);
      setHasPermission(prev => ({ ...prev, gallery: false }));
      return false;
    }
  }, []);

  /**
   * Pick image from camera
   */
  const pickFromCamera = useCallback(async (): Promise<ImagePickerResult | null> => {
    try {
      // Request permission
      const hasPermission = await requestCameraPermission();
      if (!hasPermission) {
        return null;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [9, 16], // Story aspect ratio
        quality: 0.8,
        exif: false,
      });

      if (result.canceled) {
        return null;
      }

      const asset = result.assets[0];
      return {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        type: 'image',
      };
    } catch (error) {
      console.error('[useImagePicker] Camera error:', error);
      return null;
    }
  }, [requestCameraPermission]);

  /**
   * Pick image from gallery
   */
  const pickFromGallery = useCallback(async (): Promise<ImagePickerResult | null> => {
    try {
      // Request permission
      const hasPermission = await requestGalleryPermission();
      if (!hasPermission) {
        return null;
      }

      // Launch gallery
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        allowsMultipleSelection: false,
        aspect: [9, 16], // Story aspect ratio
        quality: 0.8,
        exif: false,
      });

      if (result.canceled) {
        return null;
      }

      const asset = result.assets[0];
      return {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        type: 'image',
      };
    } catch (error) {
      console.error('[useImagePicker] Gallery error:', error);
      return null;
    }
  }, [requestGalleryPermission]);

  return {
    pickFromCamera,
    pickFromGallery,
    hasPermission,
    requestCameraPermission,
    requestGalleryPermission,
  };
};
