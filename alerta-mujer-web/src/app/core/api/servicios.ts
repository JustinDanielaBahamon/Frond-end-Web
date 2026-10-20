import { environment } from '../../../environments/environment';

/**
 * El backend son 3 microservicios (Auth, Alert y Evidence) sin API Gateway: cada petición va al
 * servicio dueño según el inicio de la ruta. Si alertApiUrl o evidenceApiUrl están vacías, todo va a
 * apiUrl (el monolito o Auth), así la web funciona igual mientras se despliegan.
 */
const RUTAS_EVIDENCE = ['/api/evidences'];
const RUTAS_ALERT = [
  '/api/alerts', '/api/contacts', '/api/location-logs', '/api/zones', '/api/resources', '/api/saved-routes',
  '/api/frequent-locations', '/api/received-alerts', '/api/zone-reports', '/api/resource-calls', '/api/public/tracking',
];

const empiezaCon = (ruta: string, prefijos: string[]) =>
  prefijos.some((p) => ruta === p || ruta.startsWith(p + '/') || ruta.startsWith(p + '?'));

/** Dirección base del servicio que atiende esa ruta (/api/...). */
export function servicioPara(ruta: string): string {
  const env = environment as { apiUrl: string; alertApiUrl?: string; evidenceApiUrl?: string };
  if (env.evidenceApiUrl && empiezaCon(ruta, RUTAS_EVIDENCE)) return env.evidenceApiUrl;
  if (env.alertApiUrl && empiezaCon(ruta, RUTAS_ALERT)) return env.alertApiUrl;
  return env.apiUrl;
}

/** Cambia la dirección del backend (apiUrl) por la del servicio dueño de la ruta. */
export function aServicio(url: string): string {
  if (!url.startsWith(environment.apiUrl)) return url;
  const ruta = url.slice(environment.apiUrl.length);
  return servicioPara(ruta) + ruta;
}
