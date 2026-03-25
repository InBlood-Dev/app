/**
 * Chat Service
 *
 * Handles chat-specific API operations like image uploads.
 */

import { postFormData, ApiResponse } from "./api";
import { ENDPOINTS } from "../config/api.config";

interface ChatImageUploadResponse {
  url: string;
  file_type: string;
  file_size: number;
  resource_type: string;
}

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB — Cloudinary free tier limit

/**
 * Upload a chat image to Cloudinary via the backend upload endpoint.
 * @param imageUri - Local URI of the image to upload
 * @returns The Cloudinary URL of the uploaded image
 * @throws Error if file is too large or upload fails
 */
export const uploadChatImage = async (imageUri: string): Promise<string> => {
  const formData = new FormData();

  formData.append("file", {
    uri: imageUri,
    type: "image/jpeg",
    name: `chat_image_${Date.now()}.jpg`,
  } as any);

  const response = await postFormData<ChatImageUploadResponse>(
    ENDPOINTS.UPLOAD.SINGLE,
    formData,
  );

  if (!response.data?.url) {
    throw new Error("Upload failed: no URL returned");
  }

  return response.data.url;
};

export { MAX_IMAGE_SIZE };
