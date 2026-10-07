import * as L from 'leaflet';

/** Distancia en kilómetros entre dos coordenadas (fórmula de Haversine). */
export function distanciaKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // radio medio de la Tierra en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Marcador en CSS puro (gota de color), sin imágenes externas:
 * no depende de CDNs y siempre se ve.
 */
export function markerIcon(color: string, tamaño = 20): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div class="am-marker" style="--am-marker-color:${color};width:${tamaño}px;height:${tamaño}px"></div>`,
    iconSize: [tamaño, tamaño],
    iconAnchor: [tamaño / 2, tamaño],
  });
}
