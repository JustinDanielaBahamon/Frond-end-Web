export type TipoLinea = 'emergencia' | 'policia' | 'bomberos' | 'mujeres' | 'defensoria' | 'saludMental';

export interface LineaAyuda {
  id: number;
  nombre: string;
  numero: string;
  descripcion: string;
  disponibilidad: string; // 'Disponible 24/7' o 'Horario: Lun - Vie 7:00 a.m. - 7:00 p.m.'
  tipo: TipoLinea;
}

export type CategoriaCentro = 'mujeres' | 'seguridad' | 'salud' | 'legal' | 'psicologico' | 'refugios';

export interface CentroAyuda {
  id: number;
  nombre: string;
  descripcion: string;
  categoria: CategoriaCentro;
  distanciaKm: number;
  estado: string; // '8:00 a.m. - 5:00 p.m.' o '24/7'
  abierto: boolean;
  lat: number;
  lng: number;
}

export interface RecursoGuardado {
  id: number;
  usuarioId: number;
  refTipo: 'centro' | 'linea';
  refId: number;
  nombre: string;
  subtitulo: string; // 'Entidad · 2.4 km' o 'Línea · 24/7'
}