// Archivo: backend/src/routes/cliente.routes.ts (Protegido con Permisos)
import { Router } from 'express';
import { 
    getClientes, 
    createCliente, 
    updateCliente, 
    deleteCliente, 
    getCliente, 
    getNextClienteCode,
    exportarClientes
} from '../controllers/cliente.controller';
import { verifyToken } from '../middleware/auth.middleware';
import { checkPermission } from '../middleware/authorization.middleware'; // <-- 1. IMPORTAMOS EL MIDDLEWARE

const router = Router();

// Todas las rutas de clientes requieren al menos estar logueado
router.use(verifyToken);

// 2. APLICAMOS LOS PERMISOS A CADA RUTA
router.get('/', checkPermission('VIEW_CLIENTS'), getClientes);
router.post('/', checkPermission('CREATE_CLIENTS'), createCliente);
router.get('/next-code', checkPermission('CREATE_CLIENTS'), getNextClienteCode); // Se necesita permiso de crear para ver el sig. código
router.get('/export', checkPermission('VIEW_CLIENTS'), exportarClientes);
router.get('/:id', checkPermission('VIEW_CLIENTS'), getCliente);
router.put('/:id', checkPermission('EDIT_CLIENTS'), updateCliente);
router.delete('/:id', checkPermission('DELETE_CLIENTS'), deleteCliente);

export default router;