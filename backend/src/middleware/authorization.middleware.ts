// Archivo: backend/src/middleware/authorization.middleware.ts
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import pool from '../config/database';

export const checkPermission = (requiredPermission: string) => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const userId = req.user?.usuario_id;

        // Primero, una verificación básica de que el usuario existe en la petición
        if (!userId) {
            return res.status(401).json({ message: 'No autenticado. ID de usuario no encontrado en el token.' });
        }

        try {
            // Consulta para verificar si el usuario tiene el permiso requerido a través de sus roles
            const query = `
                SELECT 1
                FROM public.usuarioroles ur
                JOIN public.rolpermisos rp ON ur.rol_id = rp.rol_id
                JOIN public.permisos p ON rp.permiso_id = p.permiso_id
                WHERE ur.usuario_id = $1 AND p.codigo_permiso = $2
                LIMIT 1;
            `;
            const result = await pool.query(query, [userId, requiredPermission]);

            if (result.rows.length > 0) {
                // El usuario tiene el permiso, puede continuar
                next(); 
            } else {
                // El usuario no tiene el permiso
                res.status(403).json({ message: 'Acceso denegado. No tienes los permisos necesarios para realizar esta acción.' });
            }
        } catch (error) {
            console.error("Error al verificar permisos:", error);
            res.status(500).json({ message: 'Error interno del servidor al verificar los permisos.' });
        }
    };
};