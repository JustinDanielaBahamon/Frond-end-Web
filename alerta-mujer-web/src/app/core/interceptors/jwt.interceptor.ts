import { HttpErrorResponse, HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';

export const jwtInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();

  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: unknown) => {
      // Token vencido o inválido: se cierra la sesión y se vuelve al login.
      // Las peticiones de /api/auth (login, registro, Google) manejan su propio 401.
      if (error instanceof HttpErrorResponse && error.status === 401
          && token && !req.url.includes('/api/auth/')) {
        authService.cerrarSesionLocal();
        router.navigate(['/auth/login']);
      }
      return throwError(() => error);
    })
  );
};
