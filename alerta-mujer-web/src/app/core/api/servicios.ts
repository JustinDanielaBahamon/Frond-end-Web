import { environment } from '../../../environments/environment';

/**
 * El backend son 3 microservicios (Auth, Alert y Evidence) sin API Gateway: cada petición va al
 * servicio dueño según el inicio de la ruta. Si alertApiUrl o evidenceApiUrl están vacías, todo va a
 * apiUrl (el monolito o Auth), así la web funciona igual mientras se despliegan.
 */
const EVIDENCE_PATHS = ['/api/evidences'];
const ALERT_PATHS = [
  '/api/alerts', '/api/contacts', '/api/location-logs', '/api/zones', '/api/resources', '/api/saved-routes',
  '/api/frequent-locations', '/api/received-alerts', '/api/zone-reports', '/api/resource-calls', '/api/public/tracking',
];

const beginsWith = (route: string, prefixes: string[]) =>
  prefixes.some((p) => route === p || route.startsWith(p + '/') || route.startsWith(p + '?'));

/** Dirección base del servicio que atiende esa ruta (/api/...). */
export function serviceFor(route: string): string {
  const env = environment as { apiUrl: string; alertApiUrl?: string; evidenceApiUrl?: string };
  if (env.evidenceApiUrl && beginsWith(route, EVIDENCE_PATHS)) return env.evidenceApiUrl;
  if (env.alertApiUrl && beginsWith(route, ALERT_PATHS)) return env.alertApiUrl;
  return env.apiUrl;
}

/** Cambia la dirección del backend (apiUrl) por la del servicio dueño de la ruta. */
export function toService(url: string): string {
  if (!url.startsWith(environment.apiUrl)) return url;
  const route = url.slice(environment.apiUrl.length);
  return serviceFor(route) + route;
}
