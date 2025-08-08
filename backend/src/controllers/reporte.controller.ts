import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as reporteService from '../services/reporte.service';

export const getPleCompras = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const anio = parseInt(req.query.anio as string);
        const mes = parseInt(req.query.mes as string);
        if (!anio || !mes) return res.status(400).json({ message: 'El año y el mes son requeridos.' });

        const { fileName, content } = await reporteService.generarPleRegistroCompras(empresaId, anio, mes);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.send(content);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Error interno al generar el reporte.' });
    }
};

export const getPleVentas = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const anio = parseInt(req.query.anio as string);
        const mes = parseInt(req.query.mes as string);
        if (!anio || !mes) return res.status(400).json({ message: 'El año y el mes son requeridos.' });

        const { fileName, content } = await reporteService.generarPleRegistroVentas(empresaId, anio, mes);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.send(content);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Error interno al generar el reporte.' });
    }
};