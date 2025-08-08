// Archivo: backend/src/controllers/pagoRealizado.controller.ts
import { Response } from 'express';
import * as XLSX from 'xlsx'; // Aunque no se usa directamente aquí, es común para exportaciones
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as pagoRealizadoService from '../services/pagoRealizado.service'; // Importa el servicio de pagos realizados

// Obtener todos los pagos realizados con filtros y paginación
export const getPagosRealizados = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 8;
        const { page: _page, limit: _limit, ...filters } = req.query;

        const pagosPaginados = await pagoRealizadoService.getAllPagosRealizados(empresaId, page, limit, filters);
        res.status(200).json(pagosPaginados);
    } catch (error: any) {
        console.error("Error en getPagosRealizados controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Obtener un pago realizado por ID
export const getPagoRealizado = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const pago = await pagoRealizadoService.getPagoRealizadoById(parseInt(id), empresaId);
        if (!pago) return res.status(404).json({ message: 'Pago realizado no encontrado.' });
        
        res.status(200).json(pago);
    } catch (error: any) {
        console.error("Error en getPagoRealizado controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Crear un pago realizado
export const createPagoRealizado = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });
        
        const nuevoPago = await pagoRealizadoService.createPagoRealizado({ ...req.body, empresa_id_pagadora: empresaId }, usuarioId, nombreUsuario);
        res.status(201).json(nuevoPago);
    } catch (error: any) {
        console.error("Error en createPagoRealizado controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Actualizar un pago realizado
export const updatePagoRealizado = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });

        const pagoActualizado = await pagoRealizadoService.updatePagoRealizado(parseInt(id), { ...req.body, empresa_id_pagadora: empresaId }, usuarioId, nombreUsuario);
        if (!pagoActualizado) return res.status(404).json({ message: 'Pago realizado no encontrado.' });
        res.status(200).json(pagoActualizado);
    } catch (error: any) {
        console.error("Error en updatePagoRealizado controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Eliminar (anular) un pago realizado
export const deletePagoRealizado = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });

        const success = await pagoRealizadoService.deletePagoRealizado(parseInt(id), empresaId, usuarioId, nombreUsuario);
        if (!success) return res.status(404).json({ message: 'Pago realizado no encontrado.' });
        res.status(204).send(); // 204 No Content para eliminación exitosa
    } catch (error: any) {
        console.error("Error en deletePagoRealizado controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Exportar pagos realizados a Excel
export const exportarPagosRealizados = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const { page: _page, limit: _limit, ...filters } = req.query;
        // Se usa getAllPagosRealizados sin paginación para la exportación completa
        const pagosParaExportar = await pagoRealizadoService.getAllPagosRealizados(empresaId, 1, 9999, filters); 

        const worksheet = XLSX.utils.json_to_sheet(pagosParaExportar.records); 
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'PagosRealizados');

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Reporte_PagosRealizados.xlsx');
        res.send(excelBuffer);
    } catch (error: any) {
        console.error("Error en exportarPagosRealizados controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};
