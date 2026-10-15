import Constants from 'expo-constants';

const PRODUCTION_API_URL = 'https://split.cvweb.qzz.io';

export function resolveApiBaseUrl(): string {
  const extraUrl = Constants.expoConfig?.extra?.apiUrl;
  if (
    extraUrl &&
    typeof extraUrl === 'string' &&
    !extraUrl.includes('localhost') &&
    !extraUrl.includes('127.0.0.1') &&
    !extraUrl.includes('10.0.2.2')
  ) {
    return extraUrl;
  }
  return PRODUCTION_API_URL;
}

export const API_BASE_URL = resolveApiBaseUrl();

/**
 * Builds headers for Better-Auth and backend API requests with required Origin,
 * Referer, and session cookie headers to avoid 403 MISSING_OR_NULL_ORIGIN or
 * unauthorized session rejections on HTTPS production servers.
 */
export function getAuthenticatedHeaders(
  token?: string | null,
  extra?: Record<string, string>
): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Origin': API_BASE_URL,
    'Referer': `${API_BASE_URL}/`,
    ...extra,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    // Send both cookie variants: standard and __Secure- for HTTPS environments
    headers['Cookie'] = `__Secure-better-auth.session_token=${token}; better-auth.session_token=${token}`;
  }

  return headers;
}
