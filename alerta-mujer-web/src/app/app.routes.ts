import { Routes } from '@angular/router';

import { LoginComponent } from './features/auth/login/login';
import { RegisterComponent } from './features/auth/register/register';
import { DashboardLayoutComponent } from './core/layouts/dashboard-layout/dashboard-layout';
import { AdminLayoutComponent } from './core/layouts/admin-layout/admin-layout';
import { authGuard, adminGuard, userGuard } from './core/guards/role.guard';

import { PublicLayoutComponent } from './core/layouts/public-layout/public-layout';

export const routes: Routes = [

<<<<<<< HEAD
  // ─── Raíz ───────────────────────────────────────────────────────────────────
  { path: '', redirectTo: 'auth/login', pathMatch: 'full' },
=======
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
>>>>>>> LandingPage

  // ─── Auth ────────────────────────────────────────────────────────────────────
  {
    path: 'auth',
    children: [
<<<<<<< HEAD
      { path: 'login',    component: LoginComponent },
      { path: 'register', component: RegisterComponent },
    ],
  },

  // ─── Dashboard usuaria ───────────────────────────────────────────────────────
  {
    path: 'dashboard',
    component: DashboardLayoutComponent,
    canActivate: [authGuard, userGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/dashboard/home/home').then((m) => m.Home),
      },
      {
        path: 'phone-location',
        loadComponent: () =>
          import('./features/dashboard/phone-location/phone-location').then(
            (m) => m.PhoneLocationComponent
          ),
      },
      {
        path: 'device-status',
        loadComponent: () =>
          import('./features/dashboard/device-status/device-status').then(
            (m) => m.DeviceStatusComponent
          ),
      },
      {
        path: 'alert-history',
        loadComponent: () =>
          import('./features/dashboard/alert-history/alert-history').then(
            (m) => m.AlertHistory
          ),
      },
      {
        path: 'evidence',
        loadComponent: () =>
          import('./features/dashboard/evidence/evidence').then(
            (m) => m.Evidence
          ),
      },
    ],
  },

  // ─── Dashboard administrador ─────────────────────────────────────────────────

  
  {
   path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [authGuard, adminGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/admin/dashboard/dashboard').then(
            (m) => m.AdminDashboardComponent
          ),
      },
      {
        path: 'usuarios',
        loadComponent: () =>
        import('./features/admin/user/user').then(m => m.UserComponent)
      },
      {
        path: 'alertas',
        loadComponent: () =>
          import('./features/admin/alert-admin/alert-admin').then(  // ← era "alertas-admin/alertas-admin"
            (m) => m.AlertAdminComponent
          ),
      },
    ],
  },
  

  // ─── Fallback ────────────────────────────────────────────────────────────────
  { path: '**', redirectTo: 'auth/login' },
=======
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

>>>>>>> LandingPage
];