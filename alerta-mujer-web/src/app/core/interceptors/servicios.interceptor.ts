import { HttpInterceptorFn } from '@angular/common/http';
import { aServicio } from '../api/servicios';

/** Envía cada petición al microservicio que la atiende (ver core/api/servicios.ts). */
export const serviciosInterceptor: HttpInterceptorFn = (req, next) => {
  const url = aServicio(req.url);
  return next(url === req.url ? req : req.clone({ url }));
};
