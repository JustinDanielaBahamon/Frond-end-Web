export interface Evidence {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  tipo: 'video' | 'foto' | 'audio' | 'documento';
  nombre: string;
  size: string;
  fecha: string; // idealmente ISO parseable, ej. '2026-08-28T20:45:00'
  time: string;
  alertaId: string;
  alertType: string;
  alertCity: string;
  estado: 'Verificada' | 'Pendiente' | 'Rechazada';

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
  tipo: string;
  fecha: string;
  time: string;
  city: string;
  location: string;
  estado: string;
  description?: string;
  activationMethod?: string;
}

export interface EvidenceFilters {
  search: string;
  tipo: string;
  estado: string;
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