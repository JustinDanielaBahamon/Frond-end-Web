export interface ZonaManual {
  id: number;
  nombre: string;
  nivel: 'Alto' | 'Medio' | 'Bajo';
  metodo: 'pin' | 'area';
  radio?: number;
  centroLat: number;
  centroLng: number;
  alertasEnZona: number;
}

export interface ZonaCaliente {
  nombre: string;
  lat: number;
  lng: number;
  alertas: number;
  nivel: 'Alto' | 'Medio' | 'Bajo';
}

/** Tipos de punto de apoyo: los mismos resource_type que acepta el backend (con ubicación). */
export type TipoPunto =
  | 'police_post' | 'police_station' | 'hospital' | 'health_center'
  | 'ambulance' | 'fire_station' | 'support_organization';

/** Capa del mapa en la que se muestra cada tipo. */
export type CapaPunto = 'cais' | 'hospitales' | 'apoyo';

export const TIPOS_PUNTO: Record<TipoPunto, { etiqueta: string; emoji: string; fondo: string; capa: CapaPunto }> = {
  police_post:          { etiqueta: 'CAI',                    emoji: '🚔', fondo: '#ede9fe', capa: 'cais' },
  police_station:       { etiqueta: 'Estación de policía',    emoji: '👮', fondo: '#ede9fe', capa: 'cais' },
  hospital:             { etiqueta: 'Hospital',               emoji: '🏥', fondo: '#fae8ff', capa: 'hospitales' },
  health_center:        { etiqueta: 'Centro de salud',        emoji: '🩺', fondo: '#fae8ff', capa: 'hospitales' },
  ambulance:            { etiqueta: 'Base de ambulancias',    emoji: '🚑', fondo: '#fae8ff', capa: 'hospitales' },
  fire_station:         { etiqueta: 'Bomberos',               emoji: '🚒', fondo: '#f3e8ff', capa: 'apoyo' },
  support_organization: { etiqueta: 'Apoyo a mujeres',        emoji: '💜', fondo: '#f3e8ff', capa: 'apoyo' },
};

export interface PuntoMapa {
  id: number;
  tipo: TipoPunto;
  nombre: string;
  lat: number;
  lng: number;
}