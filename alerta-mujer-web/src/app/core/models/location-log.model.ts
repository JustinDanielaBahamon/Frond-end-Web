export interface LocationLog {
  id: number;
  userProfileId: number;
  alertId?: number;
  latitude: number;
  longitude: number;
  accuracy?: number;
  recordedAt: string;
}