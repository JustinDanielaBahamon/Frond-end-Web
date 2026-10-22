import { HttpInterceptorFn } from '@angular/common/http';
import { toService } from '../api/servicios';

/** Envía cada petición al microservicio que la atiende (ver core/api/servicios.ts). */
export const servicesInterceptor: HttpInterceptorFn = (req, next) => {
  const url = toService(req.url);
  return next(url === req.url ? req : req.clone({ url }));
};
