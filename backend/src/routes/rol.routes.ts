// Archivo: backend/src/routes/rol.routes.ts (ACTUALIZADO CON CONTROLADOR)
import { Router } from 'express';
import { 
    getRoles, 
    getRole, 
    createRole, 
    updateRole, 
    deleteRole, 
    exportarRoles // Asegúrate de que este nombre coincida con la exportación del controlador
} from '../controllers/rol.controller'; // ¡IMPORTADO EL NUEVO CONTROLADOR!
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

// Protegemos todas las rutas de roles
router.use(verifyToken);

// Rutas CRUD básicas
router.get('/', getRoles); // Obtener todos los roles (con paginación/filtros)
router.post('/', createRole); // Crear un nuevo rol
router.get('/:id', getRole); // Obtener un rol por ID
router.put('/:id', updateRole); // Actualizar un rol
router.delete('/:id', deleteRole); // Desactivar (eliminación lógica) un rol

// Ruta de exportación
router.get('/export/excel', exportarRoles); // Exportar a Excel

export default router;