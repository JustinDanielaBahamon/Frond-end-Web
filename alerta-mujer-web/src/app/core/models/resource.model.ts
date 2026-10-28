export interface EmergencyResource {
  id: number;
  name: string;
  type: string;
  city: string;
  address: string;
  phone?: string;
  description?: string;
  isActive?: boolean;
}

export interface ResourceCall {
  id: number;
  userProfileId: number;
  emergencyResourceId: number;
  resourceName: string;
  phone: string;
  callType?: string;
  durationSeconds?: number;
  status?: 'completada' | 'no_respondida' | 'fallida';
  createdAt?: string;
}
/** Resource as the backend returns it (/api/resources). */
export interface EmergencyResourceApi {
  id: number;
  name: string;
  resourceType: string;
  telephone?: string | null;
  secondaryTelephone?: string | null;
  email?: string | null;
  address?: string | null;
  city: string;
  latitude?: number | null;
  longitude?: number | null;
  description?: string | null;
  isActive?: boolean;
}
