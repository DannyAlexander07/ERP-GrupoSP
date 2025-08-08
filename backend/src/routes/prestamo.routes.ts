// Archivo: backend/src/routes/prestamo.routes.ts (ACTUALIZADO CON CONTROLADOR)
import { Router } from 'express';
import { 
    getPrestamos, // Obtener todos
    getPrestamo, // Obtener por ID
    createPrestamo, // Crear
    updatePrestamo, // Actualizar
    deletePrestamo, // Eliminar (desactivar)
    exportarPrestamos // Exportar a Excel
} from '../controllers/prestamo.controller'; // ¡IMPORTADO EL NUEVO CONTROLADOR!
import { verifyToken } from '../middleware/auth.middleware'; // Para proteger las rutas

const router = Router();

// Protegemos todas las rutas de préstamos con el middleware de autenticación
router.use(verifyToken);

// Rutas CRUD básicas para Préstamos
router.get('/', getPrestamos); // Obtener todos los préstamos (con paginación/filtros)
router.post('/', createPrestamo); // Crear un nuevo préstamo con su plan de cuotas
router.get('/:id', getPrestamo); // Obtener un préstamo por ID con sus cuotas
router.put('/:id', updatePrestamo); // Actualizar un préstamo
router.delete('/:id', deletePrestamo); // Desactivar (eliminación lógica) un préstamo

// Ruta de exportación
router.get('/export/excel', exportarPrestamos); // Exportar a Excel

export default router;