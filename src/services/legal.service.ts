/**
 * Legal Service
 *
 * API calls for fetching legal pages (T&C, Privacy Policy, Safety Tips, etc.)
 * managed via the admin panel.
 */

import { get, ApiResponse } from "./api";
import { ENDPOINTS } from "../config/api.config";

export interface LegalPage {
  slug: string;
  title: string;
  content: string; // HTML
  last_updated: string | null;
}

export const getLegalPage = (
  slug: string
): Promise<ApiResponse<LegalPage>> => {
  return get<LegalPage>(ENDPOINTS.LEGAL.PAGE(slug));
};
