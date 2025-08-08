// Archivo: backend/src/routes/dashboard.routes.ts

import { Router } from 'express';
// Importar TODAS las funciones del controlador
import { 
    getKpis, 
    getFlujoCaja, 
    getResumenAnual,
    getResumenPrestamos,
    getTopDeudas,
    getTopClientes,
    getTopProveedores,
    getProyectosPorEstado,
    getVentasPorServicio,
    getRentabilidadClientes 
} from '../controllers/dashboard.controller';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();
router.use(verifyToken);

// Rutas para KPIs y Gráficos
router.get('/kpis', getKpis);
router.get('/flujo-caja', getFlujoCaja);
router.get('/resumen-anual', getResumenAnual);
router.get('/top-clientes', getTopClientes);
router.get('/top-proveedores', getTopProveedores);
router.get('/proyectos-por-estado', getProyectosPorEstado);
router.get('/ventas-por-servicio', getVentasPorServicio);
router.get('/rentabilidad-clientes', getRentabilidadClientes);
// NUEVAS RUTAS para las tablas resumen
router.get('/resumen-prestamos', getResumenPrestamos);
router.get('/top-deudas', getTopDeudas);

export default router;