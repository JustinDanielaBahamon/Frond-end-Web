import * as L from 'leaflet';

/**
 * Emojis de las zonas de auxilio, los mismos del mapa del inicio, para que todos los mapas se lean
 * igual. Sirven para los tipos de zona del backend y para las categorías de los recursos de ayuda.
 */
const EMOJIS: Record<string, string> = {
  risk: '⚠️', riesgo: '⚠️',
  safe: '🛡️', segura: '🛡️',
  help: '🆘', apoyo: '🆘',
  policia: '👮',
  asistencia: '🏥', salud: '🏥',
  linea: '📞',
  bomberos: '🚒',
};

export function emojiZona(tipo: string): string {
  return EMOJIS[tipo] ?? '📍';
}

/** Marcador redondo con el emoji del tipo, del color de su categoría. */
export function iconoZona(tipo: string, color: string, activo = false): L.DivIcon {
  const lado = activo ? 42 : 34;
  return L.divIcon({
    className: '',
    html: `<div style="width:${lado}px;height:${lado}px;border-radius:50%;display:flex;align-items:center;
      justify-content:center;font-size:${activo ? 21 : 17}px;background:${color};border:${activo ? 3 : 2}px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,.35)">${emojiZona(tipo)}</div>`,
    iconSize: [lado, lado],
    iconAnchor: [lado / 2, lado / 2],
    popupAnchor: [0, -lado / 2],
  });
}
