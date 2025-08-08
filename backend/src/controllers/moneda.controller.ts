// Archivo: backend/src/controllers/moneda.controller.ts
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as monedaService from '../services/moneda.service'; // Importa el servicio de monedas

// Obtener todas las monedas (sin paginación, para selectores)
export const getAllMonedas = async (req: AuthenticatedRequest, res: Response) => {
    try {
        // No se requiere empresaId si las monedas son globales
        const monedas = await monedaService.getAllMonedas(); 
        res.status(200).json(monedas);
    } catch (error: any) {
        console.error("Error en getAllMonedas controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Puedes añadir más funciones CRUD si las necesitas para gestionar monedas
// export const getMoneda = async (req: AuthenticatedRequest, res: Response) => { ... };
// export const createMoneda = async (req: AuthenticatedRequest, res: Response) => { ... };
// export const updateMoneda = async (req: AuthenticatedRequest, res: Response) => { ... };
// export const deleteMoneda = async (req: AuthenticatedRequest, res: Response) => { ... };
