/**
 * Base API Client
 *
 * Centralized API client with authentication, error handling, and typed responses.
 */

import { API_BASE_URL, API_TIMEOUT, HTTP_STATUS } from "../config/api.config";
import { refreshAccessToken } from "./tokenRefresh";

// Token storage for authentication
let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;
let isLoggingOut = false;

/**
 * Set the authentication token for API requests
 */
export const setAuthToken = (token: string | null): void => {
  console.log(
    "[API] setAuthToken called:",
    token ? `token present (${token.length} chars)` : "null",
  );
  authToken = token;
  if (token) {
    isLoggingOut = false;
  }
};

/**
 * Get current auth token (for debugging)
 */
export const getAuthToken = (): string | null => {
  return authToken;
};

/**
 * Set callback for unauthorized (401) responses
 * Typically used to trigger logout
 */
export const setOnUnauthorized = (callback: () => void): void => {
  onUnauthorized = callback;
};

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: Array<{ field: string; message: string }>;
}

/**
 * API Error class for structured error handling
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public errors?: Array<{ field: string; message: string }>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Build headers for API requests
 */
const buildHeaders = (customHeaders?: HeadersInit): HeadersInit => {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...customHeaders,
  };

  if (authToken) {
    (headers as Record<string, string>)["Authorization"] =
      `Bearer ${authToken}`;
  }

  return headers;
};

/**
 * Build headers for multipart form data (file uploads)
 */
const buildMultipartHeaders = (): HeadersInit => {
  const headers: HeadersInit = {};

  if (authToken) {
    (headers as Record<string, string>)["Authorization"] =
      `Bearer ${authToken}`;
  }

  // Don't set Content-Type for FormData - let fetch set it with boundary
  return headers;
};

/**
 * Make an API request with timeout and error handling
 */
const request = async <T>(
  endpoint: string,
  options: RequestInit = {},
  requestBody?: unknown,
): Promise<ApiResponse<T>> => {
  const url = `${API_BASE_URL}${endpoint}`;

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  const headers = options.headers || buildHeaders();

  // Log request details
  console.log("\n" + "=".repeat(6));
  console.log("[API REQUEST]");
  console.log("=".repeat(6));
  console.log(`[API] Method: ${options.method || "GET"}`);
  console.log(`[API] URL: ${url}`);
  console.log(
    `[API] Auth Token: ${authToken ? `Bearer ${authToken.substring(0, 20)}...` : "NULL (will fail auth)"}`,
  );
  if (requestBody) {
    console.log(`[API] Request Body:`, JSON.stringify(requestBody, null, 2));
  }
  console.log("-".repeat(6));

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse response
    const data = await response.json().catch(() => ({}));

    // Log response details
    console.log("[API RESPONSE]");
    console.log("-".repeat(6));
    console.log(`[API] Status: ${response.status} ${response.statusText}`);
    console.log(`[API] Response Body:`, JSON.stringify(data, null, 2));
    console.log("=".repeat(6) + "\n");

    // Handle error responses
    if (!response.ok) {
      // Handle 401 Unauthorized - try token refresh before logging out
      if (response.status === HTTP_STATUS.UNAUTHORIZED && !isLoggingOut) {
        console.log("[API] 401 received - attempting token refresh");

        const result = await refreshAccessToken();

        if (result.status === 'success') {
          // Update the in-memory token
          authToken = result.token;
          console.log("[API] Token refreshed - retrying original request");

          // Build retry headers with the new token
          const retryHeaders: Record<string, string> = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${result.token}`,
          };

          // For FormData requests, don't set Content-Type
          const retryOptions: RequestInit = { ...options, signal: undefined };
          if (options.body instanceof FormData) {
            delete retryHeaders["Content-Type"];
            retryOptions.headers = { Authorization: `Bearer ${result.token}` };
          } else {
            retryOptions.headers = retryHeaders;
          }

          const retryController = new AbortController();
          const retryTimeout = setTimeout(
            () => retryController.abort(),
            API_TIMEOUT,
          );

          try {
            const retryResponse = await fetch(url, {
              ...retryOptions,
              signal: retryController.signal,
            });

            clearTimeout(retryTimeout);
            const retryData = await retryResponse.json().catch(() => ({}));

            console.log(
              `[API] Retry response: ${retryResponse.status} ${retryResponse.statusText}`,
            );

            if (!retryResponse.ok) {
              if (
                retryResponse.status === HTTP_STATUS.UNAUTHORIZED
              ) {
                console.log("[API] Retry also got 401 - logging out");
                isLoggingOut = true;
                if (onUnauthorized) {
                  onUnauthorized();
                }
              }
              throw new ApiError(
                retryResponse.status,
                retryData.message || "An error occurred",
                retryData.errors,
              );
            }

            return retryData as ApiResponse<T>;
          } catch (retryError) {
            clearTimeout(retryTimeout);
            throw retryError;
          }
        } else if (result.status === 'auth_failed') {
          // Refresh token is definitively invalid/expired - must re-login
          console.log("[API] Refresh token invalid - logging out");
          isLoggingOut = true;
          if (onUnauthorized) {
            onUnauthorized();
          }
        } else {
          // Transient error (network, cold start, 502, etc.)
          // Do NOT logout - the refresh token may still be valid
          console.log("[API] Token refresh failed (transient:", result.error, ") - NOT logging out");
        }
      }

      throw new ApiError(
        response.status,
        data.message || "An error occurred",
        data.errors,
      );
    }

    return data as ApiResponse<T>;
  } catch (error) {
    clearTimeout(timeoutId);

    // Log error
    console.log("[API ERROR]");
    console.log("-".repeat(6));
    console.log(`[API] Error:`, error);
    console.log("=".repeat(6) + "\n");

    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new ApiError(0, "Request timed out");
      }
      throw new ApiError(0, error.message);
    }

    throw new ApiError(0, "An unexpected error occurred");
  }
};

/**
 * HTTP GET request
 */
export const get = async <T>(
  endpoint: string,
  params?: Record<string, string | number | boolean>,
): Promise<ApiResponse<T>> => {
  let url = endpoint;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  return request<T>(url, { method: "GET" });
};

/**
 * HTTP POST request
 */
export const post = async <T>(
  endpoint: string,
  body?: unknown,
): Promise<ApiResponse<T>> => {
  return request<T>(
    endpoint,
    {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    },
    body,
  );
};

/**
 * HTTP PUT request
 */
export const put = async <T>(
  endpoint: string,
  body?: unknown,
): Promise<ApiResponse<T>> => {
  return request<T>(
    endpoint,
    {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    },
    body,
  );
};

/**
 * HTTP DELETE request
 */
export const del = async <T>(endpoint: string): Promise<ApiResponse<T>> => {
  return request<T>(endpoint, { method: "DELETE" });
};

/**
 * HTTP POST request with FormData (for file uploads)
 */
export const postFormData = async <T>(
  endpoint: string,
  formData: FormData,
): Promise<ApiResponse<T>> => {
  return request<T>(endpoint, {
    method: "POST",
    headers: buildMultipartHeaders(),
    body: formData,
  });
};

/**
 * HTTP PUT request with FormData (for file uploads)
 */
export const putFormData = async <T>(
  endpoint: string,
  formData: FormData,
): Promise<ApiResponse<T>> => {
  return request<T>(endpoint, {
    method: "PUT",
    headers: buildMultipartHeaders(),
    body: formData,
  });
};

// Default export with all methods
export default {
  get,
  post,
  put,
  del,
  postFormData,
  putFormData,
  setAuthToken,
  setOnUnauthorized,
};
