import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

// Todas las pruebas usan el backend HTTP de pruebas (ningún spec llama a la API real) y un router vacío
export default [provideHttpClient(), provideHttpClientTesting(), provideRouter([])];
