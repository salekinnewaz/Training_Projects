/**
 * Auth router — HD-003 + HD-018 + D4.
 *
 * Wires the five auth endpoints. Only `/me` and
 * `/me/password` (HD-018) sit behind authMiddleware —
 * login/logout/register are public. D4 mounts
 * `loginRateLimiter()` on `POST /login` so a burst of wrong-
 * password attempts from the same IP gets a 429
 * `rate_limited` envelope before the bcrypt cost can be
 * weaponized for a side-channel timing attack.
 */

import { Router } from 'express';
import {
  changePassword,
  login,
  logout,
  me,
  register,
} from '../controllers/authController';
import { authMiddleware } from '../middleware/auth';
import { loginRateLimiter } from '../middleware/rateLimit';

const authRouter = Router();

authRouter.post('/login', loginRateLimiter(), login);
authRouter.post('/logout', logout);
authRouter.post('/register', register);
authRouter.get('/me', authMiddleware, me);
authRouter.patch('/me/password', authMiddleware, changePassword);

export default authRouter;
