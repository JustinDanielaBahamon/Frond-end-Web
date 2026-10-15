export interface ContactoEmergencia {
  id: number;
  usuarioId: number;
  nombre: string;
  telefono: string;
  email?: string;
  relacion: string;
  activo: boolean;
}

// Modelo que devuelve el backend EmergencyContact
export interface EmergencyContactApi {
  id: number;
  userProfileId: number;
  contactName: string;
  telephone: string;
  email?: string;
  relationship?: string;
  createdAt: string;
  updatedAt?: string;
}