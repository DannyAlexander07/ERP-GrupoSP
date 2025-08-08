import { Router } from 'express';
import { getPleCompras, getPleVentas } from '../controllers/reporte.controller';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();
router.use(verifyToken);

router.get('/ple/compras', getPleCompras);
router.get('/ple/ventas', getPleVentas);

export default router;