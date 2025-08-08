// Archivo: backend/src/routes/proyecto.routes.ts (NUEVO ARCHIVO - COMPLETO)
import { Router } from 'express';
import { 
    getProyectos,
    getProyecto,
    createProyecto,
    updateProyecto,
    deleteProyecto,
    exportarProyectos,
    getNextProyectoCode 
} from '../controllers/proyecto.controller';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

// Todas las rutas de proyectos deben ser protegidas
router.use(verifyToken);

// Rutas CRUD para Proyectos
router.get('/', getProyectos);
router.post('/', createProyecto);
router.get('/next-code', getNextProyectoCode); 
router.get('/:id', getProyecto);
router.put('/:id', updateProyecto);
router.delete('/:id', deleteProyecto);

// Ruta de exportación a Excel
router.get('/export/excel', exportarProyectos);

export default router;