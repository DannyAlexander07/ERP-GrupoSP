// Archivo: backend/src/routes/auth.routes.ts (CORREGIDO)
import { Router } from 'express';
// --- ¡CORRECCIÓN EN LA IMPORTACIÓN! ---
import { login, getProfile, getUsuarios } from '../controllers/auth.controller';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

// Definimos la ruta POST para el login (pública)
router.post('/login', login);

// Rutas protegidas que requieren token
router.get('/profile', verifyToken, getProfile);
router.get('/users', verifyToken, getUsuarios);

export default router;