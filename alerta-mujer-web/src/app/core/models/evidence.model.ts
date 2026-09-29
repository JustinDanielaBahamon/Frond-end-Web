export interface Evidencia {
  id: number;
  usuarioId: number;
  usuarioNombre: string;
  usuarioEmail: string;
  tipo: 'video' | 'foto' | 'audio' | 'documento';
  nombre: string;
  tamanio: string;
  fecha: string; // idealmente ISO parseable, ej. '2026-08-28T20:45:00'
  hora: string;
  alertaId: string;
  alertaTipo: string;
  alertaCiudad: string;
  estado: 'Verificada' | 'Pendiente' | 'Rechazada';

  // Campos opcionales para futuro
  ubicacion?: string;        // ej. 'Neiva, Huila'
  metodoActivacion?: string; // ej. 'Movimiento brusco'
  archivoUrl?: string;       // imagen/miniatura real. Sin esto, se usa el ícono por tipo.
  duracion?: string;         // solo video/audio, ej. '01:23'
}

export interface EvidenciaFilters {
  busqueda: string;
  tipo: string;
  estado: string;
  fechaInicio: Date | null;
  fechaFin: Date | null;
}

export interface EvidenciaStats {
  totalEvidencias: number;
  verificadas: number;
  pendientes: number;
  rechazadas: number;
  descargas: number;
}