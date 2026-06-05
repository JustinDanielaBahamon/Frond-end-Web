import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login';
import { RegisterComponent } from './features/auth/register/register';

export const routes: Routes = [
  { path: '', redirectTo: 'auth/login', pathMatch: 'full' },

  {
    path: 'auth',
    children: [
      { path: 'login',    component: LoginComponent },
      { path: 'register', component: RegisterComponent },
    ]
  },

  { path: 'dashboard', loadComponent: () =>
      import('./features/dashboard/home/home').then((m) => m.Home)
  },

  { path: '**', redirectTo: 'auth/login' }
];