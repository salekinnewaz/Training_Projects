import { Router } from 'express';
import { healthController } from '../controllers/healthController';
import authRouter from './auth';
import ticketsRouter from './tickets';
import usersRouter from './users';

/**
 * Single router for every `/api/*` resource. Mounts:
 *   - /health     (HD-001)
 *   - /auth       (HD-003)
 *   - /tickets    (HD-007 — GET /mine; HD-008/009/010 extend it)
 *   - /users      (HD-010 — GET /agents; HD-014 will extend it)
 *
 * Later stories add more resource routers by calling
 *   apiRouter.use('/<resource>', <resourceRouter>)` here.
 *
 * Example for HD-011 / HD-015:
 *   apiRouter.use('/attachments', attachmentsRouter);
 *   apiRouter.use('/search', searchRouter);
 */
const apiRouter = Router();

apiRouter.get('/health', healthController);
apiRouter.use('/auth', authRouter);
apiRouter.use('/tickets', ticketsRouter);
apiRouter.use('/users', usersRouter);

export default apiRouter;
