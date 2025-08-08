// Archivo: backend/src/routes/usuario.routes.ts
import { Router } from 'express';
import { 
    getUsuarios,
    getUsuario,
    createUsuario,
    updateUsuario,
    deleteUsuario,
    exportarUsuarios
} from '../controllers/usuario.controller';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

// Protegemos todas las rutas de usuarios
router.use(verifyToken);

// Rutas CRUD básicas
router.get('/', getUsuarios); // Obtener todos los usuarios (con paginación/filtros)
router.post('/', createUsuario); // Crear un nuevo usuario
router.get('/:id', getUsuario); // Obtener un usuario por ID
router.put('/:id', updateUsuario); // Actualizar un usuario
router.delete('/:id', deleteUsuario); // Eliminar (desactivar) un usuario

// Ruta de exportación
router.get('/export/excel', exportarUsuarios); // Exportar a Excel

export default router;
