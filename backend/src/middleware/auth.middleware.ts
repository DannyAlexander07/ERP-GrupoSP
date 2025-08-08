// Archivo: backend/src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extendemos la interfaz Request de Express para poder añadir nuestros propios datos
export interface AuthenticatedRequest extends Request {
    user?: {
        usuario_id: number;
        nombre_usuario: string;
        empresa_id: number;
    };
}

export const verifyToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Formato "Bearer TOKEN"

    if (!token) {
        return res.status(403).json({ message: 'No se proveyó un token.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'DEFAULT_SECRET');
        req.user = decoded as AuthenticatedRequest['user'];
        next(); // El token es válido, permite que la petición continúe
    } catch (error) {
        return res.status(401).json({ message: 'No autorizado. Token inválido o expirado.' });
    }
};
