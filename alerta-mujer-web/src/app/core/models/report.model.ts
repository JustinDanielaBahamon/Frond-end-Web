// ========================================
//=            MODELOS DE REPORTE
//======================================

// Alert data
export interface AlertData {
  id: number;
  type: 'main' | 'mini' | 'reminder';
  activationMethod: 'boton_fisico' | 'widget' | 'movimiento_brusco' | 'voz' | 'automatico';
  finalStatus: 'resolved' | 'cancelled' | 'completed' | 'failed';
  startTime: Date;
  endTime: Date | null;
  totalDuration: number; // en segundos
}

// Who activated the alert
export interface AlertActivator {
  user: {
    id: number;
    name: string;
    privateName?: string; // Only visible to admin
  };
  device: {
    brand: string;
    model: string;
    versionAndroid: string;
    deviceId: string;
  };
}

// Location during the alert
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
  mapImageUrl?: string; // Static map image URL
}

// Contactos notificados
export interface AlertContact {
  id: number;
  name: string;
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
  status: 'enviado' | 'fallido';
}

// Evidencia generada
export interface AlertEvidence {
  id: number;
  type: 'foto' | 'video' | 'audio';
  fileUrl: string;
  fileName: string;
  fileSize: string;
  captureDate: Date;
  thumbnailUrl?: string; // For thumbnails in the PDF
}

// Llamadas a recursos de emergencia
export interface ResourceCall {
  id: number;
  resource: string; // hospital, police, help line, etc.
  number: string;
  callTime: Date;
  duration: number; // en segundos
  status: 'completada' | 'no_respondida' | 'fallida';
}

// What happened during the alert
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
    name: string;
    role: string;
  };
  generatedAt: Date;
  reportVersion: string;
}

// Reporte completo
export interface AlertReport {
  id: number;
  name: string;
  date: Date;
  city: string;
  status: 'Pendiente' | 'Cerrada' | 'Atendida';
  user?: string;
  incident?: string;
  generatedBy: string;
  format: 'PDF' | 'Excel' | 'CSV';
  size: string;
  description?: string;
  
  // Referencia a alertas del sistema
  alertIdList?: number[]; // IDs of the alerts included in this report
  // Without chosen alerts, the report covers the alerts started in this range
  from?: Date | null;
  to?: Date | null;
  exports?: number;
  
  // Detailed alert data
  alertData?: AlertData;
  activator?: AlertActivator;
  events?: AlertEvents;
  metadata?: ReportMetadata;
}

// Search filters
export interface ReportFilters {
  search: string;
  startDate: Date | null;
  endDate: Date | null;
  city: string;
  status: string;
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