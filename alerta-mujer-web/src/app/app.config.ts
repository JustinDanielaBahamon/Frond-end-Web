import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { jwtInterceptor } from './core/interceptors/jwt.interceptor';
import { servicesInterceptor } from './core/interceptors/service-routes.interceptor';
import { loadTranslations } from './core/i18n/i18n';
import { SettingsService } from './core/settings/settings.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // The chosen language is ready before the first screen is drawn
    provideAppInitializer(() => loadTranslations(inject(SettingsService).language())),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([servicesInterceptor, jwtInterceptor])
    ),
  ]
};