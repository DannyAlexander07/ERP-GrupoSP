// Archivo: backend/src/routes/centroCosto.routes.ts (VERSIÓN COMPLETA)
import { Router } from 'express';
import { 
    getCentrosCosto,
    getCentroCosto,
    createCentroCosto,
    updateCentroCosto,
    deleteCentroCosto,
    exportarCentrosCosto
} from '../controllers/centroCosto.controller';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

// Protegemos todas las rutas de centros de costo
router.use(verifyToken);

// Rutas CRUD completas
router.get('/', getCentrosCosto);
router.post('/', createCentroCosto);
router.get('/export/excel', exportarCentrosCosto); // Ruta de exportación
router.get('/:id', getCentroCosto);
router.put('/:id', updateCentroCosto);
router.delete('/:id', deleteCentroCosto);

export default router;