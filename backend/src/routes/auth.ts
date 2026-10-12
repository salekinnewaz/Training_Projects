/**
 * Auth router — HD-003 + HD-018.
 *
 * Wires the five auth endpoints. Only `/me` and
 * `/me/password` (HD-018) sit behind authMiddleware —
 * login/logout/register are public.
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

const authRouter = Router();

authRouter.post('/login', login);
authRouter.post('/logout', logout);
authRouter.post('/register', register);
authRouter.get('/me', authMiddleware, me);
authRouter.patch('/me/password', authMiddleware, changePassword);

export default authRouter;
