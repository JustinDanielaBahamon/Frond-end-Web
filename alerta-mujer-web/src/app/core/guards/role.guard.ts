// role.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) return true;
  return router.createUrlTree(['/auth/login']);
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.getRole() === 'Admin' || auth.getRole() === 'admin') return true;
  return router.createUrlTree(['/auth/login']); // ← manda a login, no a /dashboard
};

export const userGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const role = auth.getRole();
  if (role === 'Usuaria' || role === 'usuaria' || role === 'operador') return true;
  if (role === 'Admin' || role === 'admin') return router.createUrlTree(['/admin/dashboard']);
  return router.createUrlTree(['/auth/login']); // ← si no hay sesión
};