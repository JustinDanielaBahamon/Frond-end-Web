import { environment } from '../../../environments/environment';

/**
 * The backend is 3 microservices (Auth, Alert and Evidence) without an API Gateway: each request goes to the
 * owning service depending on the start of the path. If alertApiUrl or evidenceApiUrl are empty, everything
 * goes to
 * apiUrl (the monolith or Auth), so the web works the same while they are deployed.
 */
const EVIDENCE_PATHS = ['/api/evidences'];
const ALERT_PATHS = [
  '/api/alerts', '/api/contacts', '/api/location-logs', '/api/zones', '/api/resources', '/api/saved-routes',
  '/api/frequent-locations', '/api/received-alerts', '/api/zone-reports', '/api/resource-calls', '/api/public/tracking',
];

const beginsWith = (route: string, prefixes: string[]) =>
  prefixes.some((p) => route === p || route.startsWith(p + '/') || route.startsWith(p + '?'));

/** Base address of the service that serves that path (/api/...). */
export function serviceFor(route: string): string {
  const env = environment as { apiUrl: string; alertApiUrl?: string; evidenceApiUrl?: string };
  if (env.evidenceApiUrl && beginsWith(route, EVIDENCE_PATHS)) return env.evidenceApiUrl;
  if (env.alertApiUrl && beginsWith(route, ALERT_PATHS)) return env.alertApiUrl;
  return env.apiUrl;
}

/** Replaces the backend address (apiUrl) with the one of the service that owns the path. */
export function toService(url: string): string {
  if (!url.startsWith(environment.apiUrl)) return url;
  const route = url.slice(environment.apiUrl.length);
  return serviceFor(route) + route;
}
