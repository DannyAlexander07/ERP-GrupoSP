// Archivo: backend/src/routes/empresa.routes.ts
import { Router } from 'express';
import { 
    getEmpresas,
    getEmpresa,
    createEmpresa,
    updateEmpresa,
    deleteEmpresa,
    exportarEmpresas
} from '../controllers/empresa.controller';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

// Protegemos todas las rutas de empresas
router.use(verifyToken);

// Rutas CRUD básicas
router.get('/', getEmpresas); // Obtener todas las empresas (con paginación/filtros)
router.post('/', createEmpresa); // Crear una nueva empresa
router.get('/:id', getEmpresa); // Obtener una empresa por ID
router.put('/:id', updateEmpresa); // Actualizar una empresa
router.delete('/:id', deleteEmpresa); // Eliminar (desactivar) una empresa

// Ruta de exportación
router.get('/export/excel', exportarEmpresas); // Exportar a Excel

export default router;
