// Archivo: backend/src/routes/proveedor.routes.ts (VERSIÓN FINAL)
import { Router } from 'express';
import { 
    getProveedores, 
    getProveedor,
    createProveedor, 
    updateProveedor, 
    deleteProveedor,
    getNextProveedorCode,
    exportarProveedores
} from '../controllers/proveedor.controller';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

// Protegemos todas las rutas de proveedores con nuestro guardián
router.use(verifyToken);

router.get('/', getProveedores);
router.post('/', createProveedor);
router.get('/next-code', getNextProveedorCode);
router.get('/export', exportarProveedores);
router.get('/:id', getProveedor);
router.put('/:id', updateProveedor);
router.delete('/:id', deleteProveedor);

export default router;