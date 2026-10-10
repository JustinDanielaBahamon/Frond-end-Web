export interface ZoneReport {
  id: number;
  zoneId: number;
  userProfileId: number;
  zoneName: string;
  zoneType?: string;
  status: 'active' | 'inactive' | 'approved' | 'pending';
  reportedAt: string;
  resolvedAt?: string;
  description?: string;
}