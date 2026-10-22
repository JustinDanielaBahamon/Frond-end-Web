export interface Evidence {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  type: 'video' | 'foto' | 'audio' | 'documento';
  name: string;
  size: string;
  date: string; // idealmente ISO parseable, ej. '2026-08-28T20:45:00'
  time: string;
  alertId: string;
  alertType: string;
  alertCity: string;
  status: 'Verificada' | 'Pendiente' | 'Rechazada';

  // Campos opcionales para futuro
  location?: string;        // ej. 'Neiva, Huila'
  activationMethod?: string; // ej. 'Movimiento brusco'
  fileUrl?: string;       // imagen/miniatura real. Sin esto, se usa el ícono por tipo.
  duration?: string;         // solo video/audio, ej. '01:23'

  // Información completa de alerta asociada
  linkedAlert?: LinkedAlert;
}

export interface LinkedAlert {
  id: string;
  type: string;
  date: string;
  time: string;
  city: string;
  location: string;
  status: string;
  description?: string;
  activationMethod?: string;
}

export interface EvidenceFilters {
  search: string;
  type: string;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
}

export interface EvidenceStats {
  totalEvidenceCount: number;
  verified: number;
  pending: number;
  rejected: number;
  downloads: number;
}