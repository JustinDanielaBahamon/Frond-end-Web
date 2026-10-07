import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../auth/auth.service';

export const jwtInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  if (token) {
    const authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
    return next(authReq).pipe(
      catchError((error) => {
        // 401/403 en un endpoint protegido = token expirado o
        // inválido (el backend responde 403 sin/expirado el JWT).
        // Se cierra la sesión y se vuelve al login: el flujo de
        // autenticación que ya maneja el proyecto.
        // Se excluye /api/auth/ porque ahí un 403 es simplemente
        // credencial incorrecta, no sesión vencida.
        if (
          error instanceof HttpErrorResponse &&
          (error.status === 401 || error.status === 403) &&
          !req.url.includes('/api/auth/')
        ) {
          authService.logout();
        }
        return throwError(() => error);
      })
    );
  }

  return next(req);
};