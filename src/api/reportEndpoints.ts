// Hand-written content-report endpoint. Unlike legalEndpoints.ts, this one
// INJECTS its endpoint because endpoints.ts is generated and does not contain
// `submitContentReport` yet. Injecting a name the generated file does not
// declare is allowed; redeclaring one it does declare is not (RTK keeps the
// first definition). See the README's "API client" section.
import { baseApi } from './baseApi';
import type { ReportCategory } from '../utils/reportCopy';

export interface SubmitContentReportRequest {
  shopId: string;
  category: ReportCategory;
  reason: string;
  contentUrl?: string;
  reporterName?: string;
  reporterEmail?: string;
}

export interface SubmitContentReportResponse {
  reportId: string;
  status: 'received';
  receivedAt: string;
}

export const { useSubmitContentReportMutation } = baseApi.injectEndpoints({
  endpoints: (build) => ({
    submitContentReport: build.mutation<SubmitContentReportResponse, SubmitContentReportRequest>({
      query: ({ shopId, ...body }) => ({
        url: `/shops/${encodeURIComponent(shopId)}/content-reports`,
        method: 'POST',
        body,
      }),
    }),
  }),
});

/** The backend's literal max lengths, mirrored so the form can hint them. */
export const REPORT_REASON_MAX_LENGTH = 4000;
export const REPORT_URL_MAX_LENGTH = 500;
export const REPORTER_NAME_MAX_LENGTH = 200;
export const REPORTER_EMAIL_MAX_LENGTH = 254;

export type ReportField = 'category' | 'reason' | 'contentUrl' | 'reporterName' | 'reporterEmail';

const REPORT_FIELDS: readonly ReportField[] = [
  'category',
  'reason',
  'contentUrl',
  'reporterName',
  'reporterEmail',
];

/** Shown when the error body is missing or unreadable. */
export const REPORT_FAILED_FALLBACK = 'The report could not be sent. Please try again.';

/**
 * The backend answers `{ error: '<message>' }` and every field message begins with the field name.
 * Returns the field the message belongs to, or null when it is not about one field.
 */
export function readApiError(error: unknown): { field: ReportField | null; message: string } | null {
  if (!error || typeof error !== 'object') return null;
  const data = (error as { data?: unknown }).data;
  let message: string | null = null;
  if (typeof data === 'string') {
    message = data;
  } else if (data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string') {
    message = (data as { error: string }).error;
  } else if (typeof (error as { error?: unknown }).error === 'string') {
    message = (error as { error: string }).error;
  }
  const trimmed = message?.trim();
  if (!trimmed) return null;
  const leading = trimmed.split(/[\s:]/)[0] as ReportField;
  const field = REPORT_FIELDS.includes(leading) ? leading : null;
  return { field, message: trimmed };
}
