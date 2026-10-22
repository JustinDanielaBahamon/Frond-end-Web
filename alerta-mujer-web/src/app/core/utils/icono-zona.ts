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

export function zoneEmoji(type: string): string {
  return EMOJIS[type] ?? '📍';
}

/** Marcador redondo con el emoji del tipo, del color de su categoría. */
export function zoneIcon(type: string, color: string, active = false): L.DivIcon {
  const side = active ? 42 : 34;
  return L.divIcon({
    className: '',
    html: `<div style="width:${side}px;height:${side}px;border-radius:50%;display:flex;align-items:center;
      justify-content:center;font-size:${active ? 21 : 17}px;background:${color};border:${active ? 3 : 2}px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,.35)">${zoneEmoji(type)}</div>`,
    iconSize: [side, side],
    iconAnchor: [side / 2, side / 2],
    popupAnchor: [0, -side / 2],
  });
}
