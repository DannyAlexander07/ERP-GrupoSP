// backend/src/controllers/reporteContable.controller.ts
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as reporteContableService from '../services/reporteContable.service';


export const getEstadoResultados = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) {
            return res.status(400).json({ message: 'Usuario sin empresa asociada.' });
        }

        // Leemos los nuevos parámetros de la URL
        const { fechaInicio, fechaFin } = req.query;

        if (!fechaInicio || !fechaFin) {
            return res.status(400).json({ message: 'La fecha de inicio y la fecha de fin son requeridas.' });
        }

        const data = await reporteContableService.generarEstadoResultados(empresaId, fechaInicio as string, fechaFin as string);
        res.status(200).json(data);

    } catch (error: any) {
        console.error("Error en getEstadoResultados controller:", error);
        res.status(500).json({ message: error.message || 'Error interno al generar el Estado de Resultados.' });
    }
};

export const getEstadoResultadosCascada = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const anio = req.query.anio ? parseInt(req.query.anio as string) : new Date().getFullYear();
        const mes = req.query.mes ? parseInt(req.query.mes as string) : new Date().getMonth() + 1;

        const data = await reporteContableService.generarDatosGraficoCascada(empresaId, anio, mes);
        res.status(200).json(data);

    } catch (error: any) {
        console.error("Error en getEstadoResultadosCascada controller:", error);
        res.status(500).json({ message: error.message || 'Error interno al generar datos para el gráfico.' });
    }
};

export const getBalanceGeneral = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        // La fecha de corte viene como parámetro, si no, se usa la fecha actual
        const fechaCorte = req.query.fechaCorte ? (req.query.fechaCorte as string) : new Date().toISOString().split('T')[0];

        const data = await reporteContableService.generarBalanceGeneral(empresaId, fechaCorte);
        res.status(200).json(data);

    } catch (error: any) {
        console.error("Error en getBalanceGeneral controller:", error);
        res.status(500).json({ message: error.message || 'Error interno al generar el Balance General.' });
    }
};