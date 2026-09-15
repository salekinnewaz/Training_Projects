import { Router } from 'express';
import { healthController } from '../controllers/healthController';
import authRouter from './auth';
import ticketsRouter from './tickets';

/**
 * Single router for every `/api/*` resource. Mounts:
 *   - /health     (HD-001)
 *   - /auth       (HD-003)
 *   - /tickets    (HD-007 — GET /mine; later stories append to it)
 *
 * Later stories add more resource routers by calling
 *   apiRouter.use('/<resource>', <resourceRouter>)` here.
 *
 * Example for HD-014:
 *   apiRouter.use('/users', usersRouter);
 *   apiRouter.use('/attachments', attachmentsRouter);
 */
const apiRouter = Router();

apiRouter.get('/health', healthController);
apiRouter.use('/auth', authRouter);
apiRouter.use('/tickets', ticketsRouter);

export default apiRouter;
