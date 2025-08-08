// Archivo: backend/src/routes/cuentaBancaria.routes.ts
import { Router } from 'express';
import { 
    getCuentasBancarias,
    getCuentaBancaria,
    createCuentaBancaria,
    updateCuentaBancaria,
    deleteCuentaBancaria,
    exportarCuentasBancarias
} from '../controllers/cuentaBancaria.controller';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

// Protegemos todas las rutas de cuentas bancarias
router.use(verifyToken);

// Rutas CRUD básicas
router.get('/', getCuentasBancarias); // Obtener todas las cuentas (con paginación/filtros)
router.post('/', createCuentaBancaria); // Crear una nueva cuenta
router.get('/:id', getCuentaBancaria); // Obtener una cuenta por ID
router.put('/:id', updateCuentaBancaria); // Actualizar una cuenta
router.delete('/:id', deleteCuentaBancaria); // Desactivar (eliminación lógica) una cuenta

// Ruta de exportación
router.get('/export/excel', exportarCuentasBancarias); // Exportar a Excel

export default router;
