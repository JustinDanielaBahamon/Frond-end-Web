export interface ContactoEmergencia {
  id: number;
  usuarioId: number;
  nombre: string;
  telefono: string;
  email?: string;
  relacion: string;
  /** Data URI de la foto (la misma que se pone desde la app). */
  foto?: string | null;
}

// Modelo que devuelve el backend EmergencyContact
export interface EmergencyContactApi {
  id: number;
  userProfileId: number;
  contactName: string;
  telephone: string;
  email?: string;
  relationship?: string;
  photo?: string | null;
  createdAt: string;
  updatedAt?: string;
}