import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

// Todas las pruebas usan el backend HTTP de pruebas: ningún spec llama a la API real
export default [provideHttpClient(), provideHttpClientTesting()];
