// ========================================
//=            MODELOS DE REPORTE
//======================================

// Datos de la alerta
export interface AlertaData {
  id: number;
  tipo: 'main' | 'mini' | 'reminder';
  metodoActivacion: 'boton_fisico' | 'widget' | 'movimiento_brusco' | 'voz' | 'automatico';
  estadoFinal: 'resolved' | 'cancelled' | 'completed' | 'failed';
  horaInicio: Date;
  horaFin: Date | null;
  duracionTotal: number; // en segundos
}

// Quién activó la alerta
export interface AlertActivator {
  usuaria: {
    id: number;
    nombre: string;
    nombrePrivado?: string; // Solo visible para admin
  };
  dispositivo: {
    marca: string;
    modelo: string;
    versionAndroid: string;
    deviceId: string;
  };
}

// Ubicación durante la alerta
export interface AlertLocation {
  coordenadas: {
    latitud: number;
    longitud: number;
    hora: Date;
  }[];
  puntoInicio: {
    latitud: number;
    longitud: number;
    hora: Date;
  };
  ultimoPunto: {
    latitud: number;
    longitud: number;
    hora: Date;
  };
  mapaImagenUrl?: string; // URL de imagen estática del mapa
}

// Contactos notificados
export interface AlertContact {
  id: number;
  nombre: string;
  relacion: string;
  canal: 'SMS' | 'llamada' | 'email' | 'push';
  estadoEntrega: 'sent' | 'delivered' | 'failed';
  horaNotificacion: Date;
}

// Recordatorios disparados
export interface AlertReminder {
  id: number;
  numeroSecuencia: number;
  horaDisparo: Date;
  metodo: 'SMS' | 'llamada' | 'push';
  estado: 'enviado' | 'fallido';
}

// Evidencia generada
export interface AlertEvidence {
  id: number;
  tipo: 'foto' | 'video' | 'audio';
  fileUrl: string;
  fileName: string;
  fileSize: string;
  fechaCaptura: Date;
  thumbnailUrl?: string; // Para miniaturas en PDF
}

// Llamadas a recursos de emergencia
export interface ResourceCall {
  id: number;
  recurso: string; // hospital, policía, línea de ayuda, etc.
  numero: string;
  horaLlamada: Date;
  duracion: number; // en segundos
  estado: 'completada' | 'no_respondida' | 'fallida';
}

// Qué pasó durante la alerta
export interface AlertEvents {
  ubicacion: AlertLocation;
  contactosNotificados: AlertContact[];
  recordatorios: AlertReminder[];
  evidencia: AlertEvidence[];
  llamadasRecursos: ResourceCall[];
}

// Metadatos del reporte
export interface ReportMetadata {
  generadoPor: {
    id: number;
    nombre: string;
    rol: string;
  };
  fechaGeneracion: Date;
  versionReporte: string;
}

// Reporte completo
export interface Reporte {
  id: number;
  nombre: string;
  fecha: Date;
  ciudad: string;
  estado: 'Pendiente' | 'Cerrada' | 'Atendida';
  usuaria?: string;
  acontecimiento?: string;
  generadoPor: string;
  formato: 'PDF' | 'Excel' | 'CSV';
  tamano: string;
  descripcion?: string;
  
  // Datos detallados de la alerta
  alertaData?: AlertaData;
  activador?: AlertActivator;
  eventos?: AlertEvents;
  metadatos?: ReportMetadata;
}

// Filtros de búsqueda
export interface ReporteFilters {
  busqueda: string;
  fechaInicio: Date | null;
  fechaFin: Date | null;
  ciudad: string;
  estado: string;
}

export interface ReporteStats {
  totalReportes: number;
  totalAlertas: number;
  zonasActivas: number;
  exportaciones: number;
}

export interface Paginacion {
  paginaActual: number;
  elementosPorPagina: number;
  totalElementos: number;
  totalPaginas: number;
}