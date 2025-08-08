// Archivo: backend/src/controllers/dashboard.controller.ts
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as dashboardService from '../services/dashboard.service';

export const getKpis = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) {
            return res.status(400).json({ message: 'Usuario sin empresa asociada.' });
        }
        const kpis = await dashboardService.getDashboardKpis(empresaId);
        res.status(200).json(kpis);
    } catch (error: any) {
        console.error("Error en getKpis controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

export const getFlujoCaja = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) {
            return res.status(400).json({ message: 'Usuario sin empresa asociada.' });
        }
        const data = await dashboardService.getFlujoCaja30Dias(empresaId);
        res.status(200).json(data);
    } catch (error: any) {
        console.error("Error en getFlujoCaja controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// NUEVO controlador para el resumen anual
export const getResumenAnual = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) {
            return res.status(400).json({ message: 'Usuario sin empresa asociada.' });
        }
        // Obtenemos el año de la consulta, si no, usamos el año actual
        const anio = req.query.anio ? parseInt(req.query.anio as string) : new Date().getFullYear();
        const data = await dashboardService.getResumenAnual(empresaId, anio);
        res.status(200).json(data);
    } catch (error: any) {
        console.error("Error en getResumenAnual controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// NUEVO controlador para el resumen de préstamos
export const getResumenPrestamos = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) {
            return res.status(400).json({ message: 'Usuario sin empresa asociada.' });
        }
        const data = await dashboardService.getResumenPrestamos(empresaId);
        res.status(200).json(data);
    } catch (error: any) {
        console.error("Error en getResumenPrestamos controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// NUEVO controlador para el top 5 de deudas
export const getTopDeudas = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) {
            return res.status(400).json({ message: 'Usuario sin empresa asociada.' });
        }
        const data = await dashboardService.getTopDeudas(empresaId);
        res.status(200).json(data);
    } catch (error: any) {
        console.error("Error en getTopDeudas controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// NUEVO controlador para el top 5 de clientes
export const getTopClientes = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });
        const anio = req.query.anio ? parseInt(req.query.anio as string) : new Date().getFullYear();
        
        const data = await dashboardService.getTopClientes(empresaId, anio);
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// NUEVO controlador para el top 5 de proveedores
export const getTopProveedores = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });
        const anio = req.query.anio ? parseInt(req.query.anio as string) : new Date().getFullYear();

        const data = await dashboardService.getTopProveedores(empresaId, anio);
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// NUEVO controlador para la distribución de proyectos
export const getProyectosPorEstado = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const data = await dashboardService.getProyectosPorEstado(empresaId);
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// NUEVO controlador para el gráfico de ventas por servicio
export const getVentasPorServicio = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });
        const anio = req.query.anio ? parseInt(req.query.anio as string) : new Date().getFullYear();
        
        const data = await dashboardService.getVentasPorServicio(empresaId, anio);
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// NUEVO controlador para la rentabilidad por cliente
export const getRentabilidadClientes = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });
        const anio = req.query.anio ? parseInt(req.query.anio as string) : new Date().getFullYear();
        
        const data = await dashboardService.getRentabilidadClientes(empresaId, anio);
        res.status(200).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};