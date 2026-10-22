import { HttpInterceptorFn } from '@angular/common/http';
import { toService } from '../api/servicios';

/** Sends each request to the microservice that serves it (see core/api/servicios.ts). */
export const servicesInterceptor: HttpInterceptorFn = (req, next) => {
  const url = toService(req.url);
  return next(url === req.url ? req : req.clone({ url }));
};
