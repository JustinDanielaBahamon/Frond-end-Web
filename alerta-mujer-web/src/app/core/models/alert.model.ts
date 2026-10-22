export type ActivationMethod = 'Botón de pánico' | 'Contacto' | 'Widget' | 'Movimiento sospechoso' | 'Botón de encendido' | 'Manual';
export type AlertStatus = 'Pendiente' | 'Atendida' | 'Cancelada';

export interface Alert {
  id: number;
  name: string;
  description: string;
  activationMethod: ActivationMethod;
  time: string;
  location: string;
  /** true when location is already neighborhood and address (not coordinates). */
  resolvedAddress?: boolean;
  lat: number;
  lng: number;
  status: AlertStatus;
  userId?: number; // optional: admin does not use it, the user needs it to filter

  // Extra fields that may come in db.json (used by the dashboard)
  type: string;
  created_at?: string;
  started_at?: string;
}