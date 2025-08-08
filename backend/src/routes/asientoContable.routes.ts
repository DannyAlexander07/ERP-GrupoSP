// Archivo: backend/src/routes/asientoContable.routes.ts
import { Router } from 'express';
import { 
    getAsientosContables,
    getAsientoContable,
    createAsientoContable,
    updateAsientoContable,
    deleteAsientoContable,
    exportarAsientosContables
} from '../controllers/asientoContable.controller';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

// Protegemos todas las rutas de asientos contables
router.use(verifyToken);

// Rutas CRUD básicas
router.get('/', getAsientosContables); // Obtener todos los asientos (con paginación/filtros)
router.post('/', createAsientoContable); // Crear un nuevo asiento
router.get('/:id', getAsientoContable); // Obtener un asiento por ID
router.put('/:id', updateAsientoContable); // Actualizar un asiento
router.delete('/:id', deleteAsientoContable); // Anular (eliminación lógica) un asiento

// Ruta de exportación
router.get('/export/excel', exportarAsientosContables); // Exportar a Excel

export default router;
