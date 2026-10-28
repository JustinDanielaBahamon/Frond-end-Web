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
  // Public tracking (link in the email to the contacts) uses no session: the token is never sent
  // and an error never sends it to the login, even if the browser has an old stored session
  if (req.url.includes('/api/public/')) return next(req);

  const token = authService.getToken();

  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: unknown) => {
      // Expired or invalid token: the session is closed and it goes back to the login.
      // /api/auth requests (login, registration, Google) handle their own 401.
      if (error instanceof HttpErrorResponse && error.status === 401
          && token && !req.url.includes('/api/auth/')) {
        authService.signOutLocally();
        router.navigate(['/auth/login']);
      }
      return throwError(() => error);
    })
  );
};
