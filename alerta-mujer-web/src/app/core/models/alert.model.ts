export type MedioActivacion = 'Botón de pánico' | 'Contacto' | 'Widget' | 'Movimiento sospechoso' | 'Manual';
export type EstadoAlerta = 'Pendiente' | 'Atendida' | 'Cancelada';

export interface Alerta {
  id: number;
  nombre: string;
  descripcion: string;
  medioActivacion: MedioActivacion;
  tiempo: string;
  ubicacion: string;
  /** true cuando ubicacion ya es barrio y dirección (no coordenadas). */
  direccionResuelta?: boolean;
  lat: number;
  lng: number;
  estado: EstadoAlerta;
  usuarioId?: number; // opcional: admin no lo usa, usuaria sí lo necesita para filtrar

  // Campos extra que pueden venir en db.json (los usa el dashboard)
  tipo: string;
  created_at?: string;
  started_at?: string;
}