import { Routes } from '@angular/router';

import { LoginComponent } from './features/auth/login/login';
import { RegisterComponent } from './features/auth/register/register';

import { DashboardLayoutComponent } from './core/layouts/dashboard-layout/dashboard-layout';
import { AdminLayoutComponent } from './core/layouts/admin-layout/admin-layout';
import { PublicLayoutComponent } from './core/layouts/public-layout/public-layout';

import { ForgotPasswordComponent } from './features/auth/forgot-password/forgot-password';
import { VerifyCodeComponent } from './features/auth/verify-code/verify-code';
import { TermsComponent } from './features/auth/terms/terms'; // NUEVO
import { PrivacyComponent } from './features/auth/privacy/privacy'; // NUEVO



import {
  authGuard,
  adminGuard,
  userGuard,
} from './core/guards/role.guard';
import { DeviceManagementComponent } from './features/admin/devices-management/devices-management';
export const routes: Routes = [

  // ─────────────────────────────────────────────────────────────
  // Public landing
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
  // Public tracking of an alert (link in the email to the contacts)
  // ─────────────────────────────────────────────────────────────

  {
    path: 'seguimiento/:codigo',
    loadComponent: () =>
      import('./features/tracking/tracking')
        .then(m => m.TrackingComponent)
  },

  // ─────────────────────────────────────────────────────────────
  // Auth
  // ─────────────────────────────────────────────────────────────

  {
    path: 'auth',
    children: [
      { path: 'login', component: LoginComponent },
      { path: 'register', component: RegisterComponent },
      { path: 'terms', component: TermsComponent }, // NUEVO
      { path: 'privacy', component: PrivacyComponent }, // NUEVO
      {
        path: 'forgot-password',
        loadComponent: () =>
          import('./features/auth/forgot-password/forgot-password')
            .then(m => m.ForgotPasswordComponent)
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

      // ⬇️ THIS IS THE ROUTE THAT WAS MISSING. Without it, when entering "/dashboard"
      // the layout router-outlet has nothing to show and stays blank.
      {
        path: '',
        loadComponent: () =>
          import('./features/dashboard/home/home')
            .then(m => m.Home),
      },

      

      {
        path: 'ubicacion',
        loadComponent: () =>
          import('./features/dashboard/location/location-shell')
            .then(m => m.LocationShellComponent),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'my-location' },
          {
            path: 'my-location',
            loadComponent: () =>
              import('./features/dashboard/my-location/my-location')
                .then(m => m.MyLocationComponent),
          },
          { path: 'history', redirectTo: 'my-location', pathMatch: 'full' },
          { path: 'frequent-places', redirectTo: 'ubicaciones-guardadas', pathMatch: 'full' },
          { path: 'nearby-zones', redirectTo: 'zonas-auxiliares', pathMatch: 'full' },
          { path: 'guardar-ubicacion', redirectTo: 'ubicaciones-guardadas', pathMatch: 'full' },
          {
            path: 'ubicaciones-guardadas',
            loadComponent: () =>
              import('./features/dashboard/saved-locations/saved-locations')
                .then(m => m.SavedLocationsComponent),
          },
          {
            path: 'zonas-auxiliares',
            loadComponent: () =>
              import('./features/dashboard/help-zones/help-zones')
                .then(m => m.HelpZonesComponent),
          },
          {
            path: 'guardar-recorrido',
            loadComponent: () =>
              import('./features/dashboard/save-route/save-route')
                .then(m => m.SaveRouteComponent),
          },
          { path: 'historial-recorridos', redirectTo: 'guardar-recorrido', pathMatch: 'full' },
        ],
      },

      {
        path: 'alertas-contactos',
        loadComponent: () =>
          import('./features/dashboard/contact-alerts/contact-alerts')
            .then(m => m.AlertContactsComponent),
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

      // ── New modules of the user panel ─────────────────
      {
        path: 'emergency-contacts',
        loadComponent: () =>
          import('./features/dashboard/emergency-contacts/emergency-contacts')
            .then(m => m.EmergencyContacts),
      },

      {
        path: 'assistance',
        loadComponent: () =>
          import('./features/dashboard/assistance/assistance')
            .then(m => m.Assistance),
      },

      {
        path: 'device',
        loadComponent: () =>
          import('./features/dashboard/device/device')
            .then(m => m.Device),
      },

      {
        path: 'settings',
        loadComponent: () =>
          import('./features/dashboard/settings/settings')
            .then(m => m.Settings),
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
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/admin/settings/settings')
            .then(m => m.AdminSettingsComponent)
      },
      {
        path: 'perfil',
        loadComponent: () =>
          import('./features/admin/profile/profile')
            .then(m => m.AdminProfileComponent)
      },
      {
        path: 'auditoria',
        loadComponent: () =>
          import('./features/admin/audit/audit')
            .then(m => m.AuditComponent)
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