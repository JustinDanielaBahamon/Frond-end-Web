/** Categoría de un recurso de ayuda, derivada del resourceType del backend. */
export type ResourceCategory = 'linea' | 'policia' | 'salud' | 'apoyo' | 'bomberos';

/** Recurso de ayuda (GET /api/resources) adaptado para la UI. */
export interface HelpResource {
  id: number;
  nombre: string;
  category: ResourceCategory;
  description: string;
  telefono: string | null;
  telephone2: string | null;
  email: string | null;
  address: string | null;
  city: string;
  lat: number | null;
  lng: number | null;
}

/** Llamada registrada por la usuaria (GET /api/resource-calls/me). */
export interface RecordedCall {
  id: number;
  resourceId: number;
  telefono: string;
  estado: string;
  fecha: Date;
}
