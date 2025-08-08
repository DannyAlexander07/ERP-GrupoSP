// Archivo: backend/src/routes/planContable.routes.ts
import { Router } from 'express';
import { 
    getPlanContable,
    getCuentaContable,
    createCuentaContable,
    updateCuentaContable,
    deleteCuentaContable,
    exportarPlanContable
} from '../controllers/planContable.controller';
import { AuthenticatedRequest } from '../middleware/auth.middleware'; // Importar AuthenticatedRequest
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

// Protegemos todas las rutas del plan contable
router.use(verifyToken);

// Rutas CRUD básicas
router.get('/', getPlanContable); // Obtener todas las cuentas (con paginación/filtros)
router.post('/', createCuentaContable); // Crear una nueva cuenta
router.get('/:id', getCuentaContable); // Obtener una cuenta por ID
router.put('/:id', updateCuentaContable); // Actualizar una cuenta
router.delete('/:id', deleteCuentaContable); // Desactivar (eliminación lógica) una cuenta

// Ruta de exportación
router.get('/export/excel', exportarPlanContable); // Exportar a Excel

export default router;
