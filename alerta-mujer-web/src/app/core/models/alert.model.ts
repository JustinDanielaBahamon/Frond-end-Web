export type ActivationMethod = 'Botón de pánico' | 'Contacto' | 'Widget' | 'Movimiento sospechoso' | 'Botón de encendido' | 'Manual';
export type AlertStatus = 'Pendiente' | 'Atendida' | 'Cancelada';

export interface Alert {
  id: number;
  name: string;
  description: string;
  activationMethod: ActivationMethod;
  time: string;
  location: string;
  /** true cuando ubicacion ya es barrio y dirección (no coordenadas). */
  resolvedAddress?: boolean;
  lat: number;
  lng: number;
  status: AlertStatus;
  userId?: number; // opcional: admin no lo usa, usuaria sí lo necesita para filtrar

  // Campos extra que pueden venir en db.json (los usa el dashboard)
  type: string;
  created_at?: string;
  started_at?: string;
}