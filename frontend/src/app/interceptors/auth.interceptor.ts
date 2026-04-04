import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Skip adding token for auth endpoints themselves
  if (req.url.includes('/api/auth/')) {
    return next(req);
  }

  const token = localStorage.getItem('renmito-token');
  if (token) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  return next(req);
};
