// Archivo: backend/src/routes/moneda.routes.ts
import { Router } from 'express';
import { getAllMonedas } from '../controllers/moneda.controller';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

// Protegemos las rutas de monedas
router.use(verifyToken);

// Ruta para obtener todas las monedas
router.get('/all', getAllMonedas); // Endpoint específico para obtener todas las monedas

export default router;