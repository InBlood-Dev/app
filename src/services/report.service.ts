import { post } from './api';
import { ENDPOINTS } from '../config/api.config';

export type ReportType =
  | 'spam'
  | 'harassment'
  | 'fake_profile'
  | 'inappropriate_content'
  | 'solicitation'
  | 'underage'
  | 'other';

interface ReportPayload {
  reported_user_id: string;
  report_type: ReportType;
  reason: string;
  description?: string;
  reported_message_id?: string;
}

interface ReportData {
  report_id: string;
  reporter_user_id: string;
  reported_user_id: string;
  report_type: string;
  reason: string;
  status: string;
  created_at: string;
}

interface ReportResponse {
  report: ReportData;
}

/**
 * Submit a report against a user
 */
export const reportUser = async (payload: ReportPayload): Promise<void> => {
  const response = await post<ReportResponse>(ENDPOINTS.REPORTS.CREATE, payload);

  if (!response.success) {
    throw new Error(response.message || 'Failed to submit report');
  }
};
