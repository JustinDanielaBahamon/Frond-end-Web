export interface EmergencyContact {
  id: number;
  userId: number;
  name: string;
  telephone: string;
  email?: string;
  relationship: string;
  /** Photo data URI (the same one set from the app). */
  photo?: string | null;
}

// Model returned by the backend EmergencyContact
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