// Archivo: backend/src/routes/servicio.routes.ts
import { Router } from 'express';
import { 
    getServicios, // Esta es la función para obtener la lista
    getServicio,  // Esta es la función para obtener un solo servicio por ID
    createServicio,
    updateServicio,
    deleteServicio,
    getNextServicioCode,
    exportarServicios
} from '../controllers/servicio.controller'; // Asegúrate de que estos nombres coincidan con las exportaciones reales
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

// Protegemos todas las rutas de servicios
router.use(verifyToken);

// Rutas CRUD básicas
router.get('/', getServicios); 
router.post('/', createServicio);
router.get('/next-code', getNextServicioCode);
router.get('/export', exportarServicios);
router.get('/:id', getServicio); 
router.put('/:id', updateServicio);
router.delete('/:id', deleteServicio);

export default router;
