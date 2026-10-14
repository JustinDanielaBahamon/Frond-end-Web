/** Categoría de un recurso de ayuda, derivada del resourceType del backend. */
export type CategoriaRecurso = 'linea' | 'policia' | 'salud' | 'apoyo' | 'bomberos';

/** Recurso de ayuda (GET /api/resources) adaptado para la UI. */
export interface RecursoAyuda {
  id: number;
  nombre: string;
  categoria: CategoriaRecurso;
  descripcion: string;
  telefono: string | null;
  telefono2: string | null;
  email: string | null;
  direccion: string | null;
  ciudad: string;
  lat: number | null;
  lng: number | null;
}

/** Llamada registrada por la usuaria (GET /api/resource-calls/me). */
export interface LlamadaRegistrada {
  id: number;
  recursoId: number;
  telefono: string;
  estado: string;
  fecha: Date;
}
