// Archivo: backend/src/routes/centroCosto.routes.ts
import { Router } from 'express';
import { getCentrosCosto } from '../controllers/centroCosto.controller';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

// Protegemos las rutas de centros de costo
router.use(verifyToken);

// Ruta para obtener todos los centros de costo (con filtros y paginación)
router.get('/', getCentrosCosto); 

export default router;