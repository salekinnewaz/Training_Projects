import { Router } from 'express';
import { healthController } from '../controllers/healthController';
import authRouter from './auth';

/**
 * Single router for every `/api/*` resource. Mounts:
 *   - /health (HD-001)
 *   - /auth   (HD-003)
 *
 * Later stories add more resource routers by calling
 *   apiRouter.use('/<resource>', <resourceRouter>)` here.
 *
 * Example for HD-007+:
 *   apiRouter.use('/tickets', ticketsRouter);
 *   apiRouter.use('/users', usersRouter);
 *   apiRouter.use('/attachments', attachmentsRouter);
 */
const apiRouter = Router();

apiRouter.get('/health', healthController);
apiRouter.use('/auth', authRouter);

export default apiRouter;
