import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { ZonesService, countAlertsInZones } from './zones.service';

const URL = `${environment.apiUrl}/api/zones`;

const zone = (over: Record<string, unknown>) => ({
  id: 1, name: 'Zona', zoneType: 'risk', riskLevel: 'high', city: 'Neiva',
  latitude: 2.93, longitude: -75.28, radiusMeters: 200, isActive: true, ...over,
});

describe('ZonesService', () => {
  let service: ZonesService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ZonesService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('el mapa de alertas solo dibuja zonas de riesgo activas, como área o pin', () => {
    let result: any[] = [];
    service.getRiskZones().subscribe((z) => (result = z));
    backend.expectOne(URL).flush([
      zone({ id: 1, radiusMeters: 200 }),
      zone({ id: 2, radiusMeters: 50, riskLevel: 'low' }),
      zone({ id: 3, zoneType: 'policia' }),
      zone({ id: 4, isActive: false }),
    ]);
    expect(result.map((z) => z.id)).toEqual([1, 2]);
    expect(result[0]).toMatchObject({ method: 'area', radio: 200, level: 'Alto' });
    expect(result[1]).toMatchObject({ method: 'pin', level: 'Bajo' });
  });

  it('el panel de la usuaria conserva el tipo real (una estación de policía no es riesgo)', () => {
    let result: any[] = [];
    service.getNearby().subscribe((z) => (result = z));
    backend.expectOne(URL).flush([zone({ zoneType: 'policia' }), zone({ id: 2, zoneType: 'raro' })]);
    expect(result.map((z) => z.type)).toEqual(['policia', 'risk']);
  });

  it('al editar en Gestión de zonas no se pierden los campos que el panel no muestra', () => {
    service.getAll().subscribe();
    backend.expectOne(URL).flush([zone({ zoneType: 'policia', riskLevel: 'low', description: 'CAI centro' })]);

    service.update('1', { name: 'CAI' }).subscribe();
    const req = backend.expectOne(`${URL}/1`);
    expect(req.request.body).toMatchObject({ name: 'CAI', zoneType: 'policia', description: 'CAI centro' });
    req.flush(zone({ name: 'CAI' }));
  });

  it('cuenta las alertas que caen dentro de cada zona', () => {
    const [counted] = countAlertsInZones(
      [{ id: 1, name: 'Z', level: 'Alto', method: 'area', radio: 100, centerLat: 2.93, centerLng: -75.28, alertsInZone: 0 }],
      [{ lat: 2.9301, lng: -75.2801 }, { lat: 3.5, lng: -75.0 }, { lat: 0, lng: 0 }],
    );
    expect(counted.alertsInZone).toBe(1);
  });
});
