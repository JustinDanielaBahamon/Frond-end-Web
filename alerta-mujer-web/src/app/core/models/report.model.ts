// ========================================
//=            MODELOS DE REPORTE
//======================================

// Datos de la alerta
export interface AlertData {
  id: number;
  tipo: 'main' | 'mini' | 'reminder';
  activationMethod: 'boton_fisico' | 'widget' | 'movimiento_brusco' | 'voz' | 'automatico';
  finalStatus: 'resolved' | 'cancelled' | 'completed' | 'failed';
  startTime: Date;
  endTime: Date | null;
  totalDuration: number; // en segundos
}

// Quién activó la alerta
export interface AlertActivator {
  user: {
    id: number;
    nombre: string;
    privateName?: string; // Solo visible para admin
  };
  device: {
    brand: string;
    model: string;
    versionAndroid: string;
    deviceId: string;
  };
}

// Ubicación durante la alerta
export interface AlertLocation {
  coordinates: {
    latitude: number;
    longitude: number;
    time: Date;
  }[];
  startPoint: {
    latitude: number;
    longitude: number;
    time: Date;
  };
  lastPoint: {
    latitude: number;
    longitude: number;
    time: Date;
  };
  mapImageUrl?: string; // URL de imagen estática del mapa
}

// Contactos notificados
export interface AlertContact {
  id: number;
  nombre: string;
  relationship: string;
  channel: 'SMS' | 'llamada' | 'email' | 'push';
  deliveryStatus: 'sent' | 'delivered' | 'failed';
  notificationTime: Date;
}

// Recordatorios disparados
export interface AlertReminder {
  id: number;
  sequenceNumber: number;
  triggerTime: Date;
  method: 'SMS' | 'llamada' | 'push';
  estado: 'enviado' | 'fallido';
}

// Evidencia generada
export interface AlertEvidence {
  id: number;
  tipo: 'foto' | 'video' | 'audio';
  fileUrl: string;
  fileName: string;
  fileSize: string;
  captureDate: Date;
  thumbnailUrl?: string; // Para miniaturas en PDF
}

// Llamadas a recursos de emergencia
export interface ResourceCall {
  id: number;
  resource: string; // hospital, policía, línea de ayuda, etc.
  number: string;
  callTime: Date;
  duration: number; // en segundos
  estado: 'completada' | 'no_respondida' | 'fallida';
}

// Qué pasó durante la alerta
export interface AlertEvents {
  location: AlertLocation;
  notifiedContacts: AlertContact[];
  reminders: AlertReminder[];
  evidence: AlertEvidence[];
  resourceCalls: ResourceCall[];
}

// Metadatos del reporte
export interface ReportMetadata {
  generatedBy: {
    id: number;
    nombre: string;
    role: string;
  };
  generatedAt: Date;
  reportVersion: string;
}

// Reporte completo
export interface AlertReport {
  id: number;
  nombre: string;
  fecha: Date;
  city: string;
  estado: 'Pendiente' | 'Cerrada' | 'Atendida';
  user?: string;
  incident?: string;
  generatedBy: string;
  format: 'PDF' | 'Excel' | 'CSV';
  size: string;
  description?: string;
  
  // Referencia a alertas del sistema
  alertIdList?: number[]; // IDs de las alertas incluidas en este reporte
  // Sin alertas elegidas, el informe cubre las alertas iniciadas en este rango
  from?: Date | null;
  to?: Date | null;
  exports?: number;
  
  // Datos detallados de la alerta
  alertData?: AlertData;
  activator?: AlertActivator;
  events?: AlertEvents;
  metadata?: ReportMetadata;
}

// Filtros de búsqueda
export interface ReportFilters {
  search: string;
  startDate: Date | null;
  endDate: Date | null;
  city: string;
  estado: string;
}

export interface ReportStats {
  totalReportCount: number;
  totalAlertCount: number;
  activeZones: number;
  exports: number;
}

export interface Pagination {
  currentPage: number;
  itemsPerPage: number;
  totalElements: number;
  totalPageCount: number;
}