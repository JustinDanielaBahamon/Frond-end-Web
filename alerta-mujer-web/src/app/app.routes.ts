import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login';
import { RegisterComponent } from './features/auth/register/register';
import { DashboardLayoutComponent } from './core/layouts/dashboard-layout/dashboard-layout';

export const routes: Routes = [
  { path: '', redirectTo: 'auth/login', pathMatch: 'full' },

  {
    path: 'auth',
    children: [
      { path: 'login',    component: LoginComponent },
      { path: 'register', component: RegisterComponent },
    ]
  },

  {
    path: 'dashboard',
    component: DashboardLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./features/dashboard/home/home').then(m => m.Home)
      },
      {
        path: 'phone-location',
        loadComponent: () => import('./features/dashboard/phone-location/phone-location').then(m => m.PhoneLocationComponent)
      },
      {
        path: 'location-history',
        loadComponent: () => import('./features/dashboard/location-history/location-history').then(m => m.LocationHistoryComponent)
      },
      {
        path: 'device-status',
        loadComponent: () => import('./features/dashboard/device-status/device-status').then(m => m.DeviceStatusComponent)
      },
    ]
  },

  { path: '**', redirectTo: 'auth/login' }
];