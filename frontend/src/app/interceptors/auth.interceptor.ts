import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Skip token for public auth endpoints (login/signup only)
  if (req.url.includes('/api/auth/login') || req.url.includes('/api/auth/signup')) {
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
