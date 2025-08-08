// Archivo: backend/src/controllers/auth.controller.ts (VERSIÓN FINAL COMPLETA)

import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as authService from '../services/auth.service';
import pool from '../config/database'; // Necesario para getUsuarios

export const login = async (req: Request, res: Response): Promise<Response> => {
    const { nombre_usuario_login, contrasena } = req.body;

    if (!nombre_usuario_login || !contrasena) {
        return res.status(400).json({ message: 'Nombre de usuario y contraseña son requeridos.' });
    }

    try {
        const loginData = await authService.loginUser(nombre_usuario_login, contrasena);
        return res.status(200).json({
            message: 'Login exitoso',
            ...loginData
        });
    } catch (error: any) {
        const statusCode = error.statusCode || 500;
        const message = error.statusCode ? error.message : 'Error interno del servidor.';
        return res.status(statusCode).json({ message });
    }
};

export const getProfile = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.usuario_id;
        if (!userId) {
            return res.status(401).json({ message: 'ID de usuario no encontrado en el token.' });
        }
        
        const userData = await authService.getUserProfile(userId);
        if (!userData) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        
        res.status(200).json(userData);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// --- ¡FUNCIÓN getUsuarios AÑADIDA DE VUELTA! ---
export const getUsuarios = async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 1000 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        const usuariosResult = await pool.query(`
            SELECT usuario_id, nombre_usuario_login, nombres_completos_persona, apellidos_completos_persona, email_corporativo, empresa_id_predeterminada
            FROM Usuarios
            ORDER BY nombres_completos_persona
            LIMIT $1 OFFSET $2
        `, [limit, offset]);
        
        const countResult = await pool.query(`SELECT COUNT(*) FROM Usuarios`);

        res.status(200).json({
            records: usuariosResult.rows,
            total_records: Number(countResult.rows[0].count),
            total_pages: Math.ceil(Number(countResult.rows[0].count) / Number(limit)),
            current_page: Number(page)
        });
    } catch (error: any) {
        console.error("Error al obtener usuarios:", error);
        res.status(500).json({ message: "Error al obtener usuarios." });
    }
};