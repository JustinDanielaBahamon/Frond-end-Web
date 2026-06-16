import { Routes } from '@angular/router';

import { LoginComponent } from './features/auth/login/login';
import { RegisterComponent } from './features/auth/register/register';

import { PublicLayoutComponent } from './core/layouts/public-layout/public-layout';

export const routes: Routes = [

  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/landing/home/home')
            .then(m => m.LandingHomeComponent)
      }
    ]
  },

  {
    path: 'auth',
    children: [
      {
        path: 'login',
        component: LoginComponent
      },
      {
        path: 'register',
        component: RegisterComponent
      }
    ]
  },

  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/home/home')
        .then(m => m.Home)
  },

  {
    path: '**',
    redirectTo: ''
  }

];