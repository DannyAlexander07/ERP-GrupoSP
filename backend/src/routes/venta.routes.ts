// Archivo: backend/src/routes/venta.routes.ts
import { Router } from 'express';
import { 
    getFacturasVenta,
    getFacturaVenta,
    createFacturaVenta,
    updateFacturaVenta,
    deleteFacturaVenta,
    exportarFacturasVenta,
    downloadFacturaVentaXml,
    downloadFacturaVentaCdr,
    downloadFacturaVentaPdf,
    aplicarSaldoAFactura
} from '../controllers/venta.controller';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

// Protegemos todas las rutas de facturas de venta
router.use(verifyToken);

// Rutas CRUD básicas
router.get('/', getFacturasVenta); // Obtener todas las facturas (con paginación/filtros)
router.post('/', createFacturaVenta); // Crear una nueva factura
router.get('/:id', getFacturaVenta); // Obtener una factura por ID
router.put('/:id', updateFacturaVenta); // Actualizar una factura
router.delete('/:id', deleteFacturaVenta); // Anular (eliminación lógica) una factura
router.post('/:id/aplicar-saldo', verifyToken, aplicarSaldoAFactura);

// Rutas de exportación y descarga de comprobantes
router.get('/export/excel', exportarFacturasVenta); // Exportar a Excel
router.get('/:id/download/xml', downloadFacturaVentaXml); // Descargar XML
router.get('/:id/download/cdr', downloadFacturaVentaCdr); // Descargar CDR
router.get('/:id/download/pdf', downloadFacturaVentaPdf); // Descargar PDF

export default router;
