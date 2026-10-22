export interface EmergencyContact {
  id: number;
  userId: number;
  name: string;
  telephone: string;
  email?: string;
  relationship: string;
  /** Data URI de la foto (la misma que se pone desde la app). */
  photo?: string | null;
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