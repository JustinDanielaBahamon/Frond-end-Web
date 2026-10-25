import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

// All tests use the HTTP testing backend (no spec calls the real API) and an empty router
export default [provideHttpClient(), provideHttpClientTesting(), provideRouter([])];
