import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { jwtInterceptor } from './jwt.interceptor';
import { AuthService } from '../auth/auth.service';

describe('jwtInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  const router = { navigate: vi.fn() };
  const auth = { getToken: () => 'token-viejo', cerrarSesionLocal: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([jwtInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
        { provide: AuthService, useValue: auth },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  it('el seguimiento público no lleva token ni manda al login aunque falle', () => {
    http.get('https://alert.example/api/public/tracking/abc').subscribe({ error: () => {} });
    const req = backend.expectOne('https://alert.example/api/public/tracking/abc');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(router.navigate).not.toHaveBeenCalled();
    expect(auth.cerrarSesionLocal).not.toHaveBeenCalled();
  });

  it('las rutas privadas llevan el token y un 401 cierra la sesión', () => {
    http.get('https://alert.example/api/alerts/me').subscribe({ error: () => {} });
    const req = backend.expectOne('https://alert.example/api/alerts/me');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-viejo');
    req.flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
  });
});
