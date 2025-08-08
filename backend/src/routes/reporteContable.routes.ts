// Archivo: backend/src/routes/reporteContable.routes.ts

import { Router } from 'express';
import { getEstadoResultados, getEstadoResultadosCascada ,getBalanceGeneral } from '../controllers/reporteContable.controller'; 
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();
router.use(verifyToken);

// Endpoint para el reporte de tabla
router.get('/estado-resultados', getEstadoResultados);

// --- ¡NUEVA RUTA AÑADIDA! ---
// Endpoint específico para los datos del gráfico de cascada
router.get('/estado-resultados-cascada', getEstadoResultadosCascada);
router.get('/balance-general', getBalanceGeneral);

export default router;