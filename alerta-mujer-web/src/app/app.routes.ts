import { Routes } from '@angular/router';

import { LoginComponent } from './features/auth/login/login';
import { RegisterComponent } from './features/auth/register/register';

import { DashboardLayoutComponent } from './core/layouts/dashboard-layout/dashboard-layout';
import { AdminLayoutComponent } from './core/layouts/admin-layout/admin-layout';
import { PublicLayoutComponent } from './core/layouts/public-layout/public-layout';

import { ForgotPasswordComponent } from './features/auth/forgot-password/forgot-password';
import { ForgotPhoneComponent } from './features/auth/forgot-phone/forgot-phone';
import { VerifyCodeComponent } from './features/auth/verify-code/verify-code';
import { ResetPasswordComponent } from './features/auth/reset-password/reset-password';


import {
  authGuard,
  adminGuard,
  userGuard,
} from './core/guards/role.guard';
import { Path } from 'leaflet';
import { EmergencyManagementComponent } from './features/admin/emergency-management/emergency-management';
import { DeviceManagementComponent } from './features/admin/devices-management/devices-management';
export const routes: Routes = [

  // ─────────────────────────────────────────────────────────────
  // Landing pública
  // ─────────────────────────────────────────────────────────────

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

  // ─────────────────────────────────────────────────────────────
  // Auth
  // ─────────────────────────────────────────────────────────────

  {
    path: 'auth',
    children: [
      { path: 'login', component: LoginComponent },
      { path: 'register', component: RegisterComponent },
      {
        path: 'forgot-password',
        loadComponent: () =>
          import('./features/auth/forgot-password/forgot-password')
            .then(m => m.ForgotPasswordComponent)
      },
      {
        path: 'forgot-phone',
        loadComponent: () =>
          import('./features/auth/forgot-phone/forgot-phone')
            .then(m => m.ForgotPhoneComponent)
      },
      {
        path: 'verify-code',
        loadComponent: () =>
          import('./features/auth/verify-code/verify-code')
            .then(m => m.VerifyCodeComponent)
      },
      {
        path: 'reset-password',
        loadComponent: () =>
          import('./features/auth/reset-password/reset-password')
            .then(m => m.ResetPasswordComponent)
      },

    ]
  },

  // ─────────────────────────────────────────────────────────────
  // Dashboard Usuaria
  // ─────────────────────────────────────────────────────────────

  {
    path: 'dashboard',
    component: DashboardLayoutComponent,
    canActivate: [authGuard, userGuard],

    children: [

      // ⬇️ ESTA ES LA RUTA QUE FALTABA. Sin ella, al entrar a "/dashboard"
      // el router-outlet del layout no tiene qué mostrar y queda en blanco.
      {
        path: '',
        loadComponent: () =>
          import('./features/dashboard/home/home')
            .then(m => m.Home),
      },

      {
        path: 'phone-location',
        loadComponent: () =>
          import('./features/dashboard/phone-location/phone-location')
            .then(m => m.PhoneLocationComponent),
      },

      {
        path: 'alert-history',
        loadComponent: () =>
          import('./features/dashboard/alert-history/alert-history')
            .then(m => m.AlertHistory),
      },

      {
        path: 'evidence',
        loadComponent: () =>
          import('./features/dashboard/evidence/evidence')
            .then(m => m.Evidence),
      },

      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/admin/dashboard/dashboard')
            .then(m => m.AdminDashboardComponent),
      },
      
      {
        path: 'usuarios',
        loadComponent: () =>
          import('./features/admin/user/user')
            .then(m => m.UserComponent),
      },
      
      {
        path: 'alertas',
        loadComponent: () =>
          import('./features/admin/alert-admin/alert-admin')
            .then(m => m.AlertAdminComponent),
      },
      
      {
        path: 'zone-management',
        loadComponent: () =>
          import('./features/admin/zone-management/zone-management')
            .then(m => m.ZoneManagementComponent),
      },
      
      {
        path: 'report-management',
        loadComponent: () =>
          import('./features/admin/report-management/report-management')
            .then(m => m.ReportManagementComponent),
      },
      
      {
        path: 'emergency-management',
        loadComponent: () =>
          import('./features/admin/emergency-management/emergency-management')
            .then(m => m.EmergencyManagementComponent),
      },
      
      {
        path: 'evidence-management',
        loadComponent: () =>
          import('./features/admin/evidence-management/evidence-management')
            .then(m => m.EvidencesManagementComponent),
      },
      
      {
        path: 'moderator-management',
        loadComponent: () =>
          import('./features/admin/moderator-management/moderator-management')
            .then(m => m.ModeratorManagementComponent),
      },
      
      {
        path: 'devices-management',
        loadComponent: () =>
          import('./features/admin/devices-management/devices-management')
            .then(m => m.DeviceManagementComponent),
      },

    ],
  },

  // ─────────────────────────────────────────────────────────────
  // Dashboard Administrador
  // ─────────────────────────────────────────────────────────────

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
          import('./features/admin/dashboard/dashboard')
            .then(m => m.AdminDashboardComponent),
      },

      {
        path: 'usuarios',
        loadComponent: () =>
          import('./features/admin/user/user')
            .then(m => m.UserComponent),
      },

      {
        path: 'alertas',
        loadComponent: () =>
          import('./features/admin/alert-admin/alert-admin')
            .then(m => m.AlertAdminComponent),
      },
      {
        path: 'zone-management',
        loadComponent: () =>
          import('./features/admin/zone-management/zone-management')
            .then(m => m.ZoneManagementComponent),
      },
      {
        path: 'report-management',
        loadComponent: () =>
          import('./features/admin/report-management/report-management')
            .then(m => m.ReportManagementComponent),
      },
      {
        path: 'emergency-management',
        loadComponent: ()=> 
           import('./features/admin/emergency-management/emergency-management')
           .then(m =>m.EmergencyManagementComponent),
      },
      {
         path: 'evidence-management',
        loadComponent: () =>
          import('./features/admin/evidence-management/evidence-management')
            .then(m => m.EvidencesManagementComponent)
      },
      {
        path: 'moderator-management',
        loadComponent: () =>
          import('./features/admin/moderator-management/moderator-management')
            .then(m => m.ModeratorManagementComponent)
      },
      {
        path: 'devices-management',
        loadComponent: () =>
          import('./features/admin/devices-management/devices-management')
            .then(m => m.DeviceManagementComponent)
      }

    ],
  },

  // ─────────────────────────────────────────────────────────────
  // Ruta por defecto
  // ─────────────────────────────────────────────────────────────

  {
    path: '**',
    redirectTo: 'auth/login',
  },

];