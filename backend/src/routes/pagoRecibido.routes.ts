// Archivo: backend/src/routes/pagoRecibido.routes.ts
import { Router } from 'express';
import { 
    getPagosRecibidos,
    getPagoRecibido,
    createPagoRecibido,
    updatePagoRecibido,
    deletePagoRecibido,
    exportarPagosRecibidos
} from '../controllers/pagoRecibido.controller';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

// Protegemos todas las rutas de pagos recibidos
router.use(verifyToken);

// Rutas CRUD básicas
router.get('/', getPagosRecibidos); // Obtener todos los pagos (con paginación/filtros)
router.post('/', createPagoRecibido); // Crear un nuevo pago
router.get('/:id', getPagoRecibido); // Obtener un pago por ID
router.put('/:id', updatePagoRecibido); // Actualizar un pago
router.delete('/:id', deletePagoRecibido); // Anular (eliminación lógica) un pago

// Ruta de exportación
router.get('/export/excel', exportarPagosRecibidos); // Exportar a Excel

export default router;
