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