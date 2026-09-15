import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './services/auth.interceptor';

/**
 * App-wide providers.
 *
 * `authInterceptor` is registered first so every HTTP request picks
 * up `withCredentials: true` before reaching the network. Any future
 * logging / metrics interceptors should go AFTER it.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};