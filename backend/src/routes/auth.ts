/**
 * Auth router — HD-003.
 *
 * Wires the four auth endpoints. Only `/me` sits behind
 * authMiddleware — login/logout/register are public.
 */

import { Router } from 'express';
import { login, logout, me, register } from '../controllers/authController';
import { authMiddleware } from '../middleware/auth';

const authRouter = Router();

authRouter.post('/login', login);
authRouter.post('/logout', logout);
authRouter.post('/register', register);
authRouter.get('/me', authMiddleware, me);

export default authRouter;
