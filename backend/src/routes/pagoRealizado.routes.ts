// Archivo: backend/src/routes/pagoRealizado.routes.ts
import { Router } from 'express';
import { 
    getPagosRealizados,
    getPagoRealizado,
    createPagoRealizado,
    updatePagoRealizado,
    deletePagoRealizado,
    exportarPagosRealizados
} from '../controllers/pagoRealizado.controller';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

// Protegemos todas las rutas de pagos realizados
router.use(verifyToken);

// Rutas CRUD básicas
router.get('/', getPagosRealizados); // Obtener todos los pagos (con paginación/filtros)
router.post('/', createPagoRealizado); // Crear un nuevo pago
router.get('/:id', getPagoRealizado); // Obtener un pago por ID
router.put('/:id', updatePagoRealizado); // Actualizar un pago
router.delete('/:id', deletePagoRealizado); // Anular (eliminación lógica) un pago

// Ruta de exportación
router.get('/export/excel', exportarPagosRealizados); // Exportar a Excel

export default router;
