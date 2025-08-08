// Archivo: backend/src/routes/compra.routes.ts
import { Router } from 'express';
import { 
    getFacturasCompra,
    getFacturaCompra,
    createFacturaCompra,
    updateFacturaCompra,
    deleteFacturaCompra,
    exportarFacturasCompra
} from '../controllers/compra.controller';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

// Protegemos todas las rutas de facturas de compra
router.use(verifyToken);

// Rutas CRUD básicas
router.get('/', getFacturasCompra); // Obtener todas las facturas (con paginación/filtros)
router.post('/', createFacturaCompra); // Crear una nueva factura
router.get('/:id', getFacturaCompra); // Obtener una factura por ID
router.put('/:id', updateFacturaCompra); // Actualizar una factura
router.delete('/:id', deleteFacturaCompra); // Anular (eliminación lógica) una factura

// Ruta de exportación
router.get('/export/excel', exportarFacturasCompra); // Exportar a Excel

export default router;
