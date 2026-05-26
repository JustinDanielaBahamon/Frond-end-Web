import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },

  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login').then(
        (m) => m.LoginComponent
      ),
  },

  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/home/home').then(
        (m) => m.Home
      ),
  },

  {
    path: '**',
    redirectTo: 'login',
  },
];