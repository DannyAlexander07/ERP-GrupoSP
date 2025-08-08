// Archivo: backend/src/controllers/asientoContable.controller.ts
import { Response } from 'express';
import * as XLSX from 'xlsx';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as asientoContableService from '../services/asientoContable.service'; // Importa el servicio de asientos contables

// Obtener todos los asientos contables con filtros y paginación
export const getAsientosContables = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 8;
        const { page: _page, limit: _limit, ...filters } = req.query;

        const asientosPaginados = await asientoContableService.getAllAsientosContables(empresaId, page, limit, filters);
        res.status(200).json(asientosPaginados);
    } catch (error: any) {
        console.error("Error en getAsientosContables controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Obtener un asiento contable por ID
export const getAsientoContable = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const asiento = await asientoContableService.getAsientoContableById(parseInt(id), empresaId);
        if (!asiento) return res.status(404).json({ message: 'Asiento contable no encontrado.' });
        
        res.status(200).json(asiento);
    } catch (error: any) {
        console.error("Error en getAsientoContable controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Crear un asiento contable
export const createAsientoContable = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });
        
        const nuevoAsiento = await asientoContableService.createAsientoContable({ ...req.body, empresa_id: empresaId }, usuarioId, nombreUsuario);
        res.status(201).json(nuevoAsiento);
    } catch (error: any) {
        console.error("Error en createAsientoContable controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Actualizar un asiento contable
export const updateAsientoContable = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });

        const asientoActualizado = await asientoContableService.updateAsientoContable(parseInt(id), { ...req.body, empresa_id: empresaId }, usuarioId, nombreUsuario);
        if (!asientoActualizado) return res.status(404).json({ message: 'Asiento contable no encontrado.' });
        res.status(200).json(asientoActualizado);
    } catch (error: any) {
        console.error("Error en updateAsientoContable controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Eliminar (anular) un asiento contable
export const deleteAsientoContable = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });

        const success = await asientoContableService.deleteAsientoContable(parseInt(id), empresaId, usuarioId, nombreUsuario);
        if (!success) return res.status(404).json({ message: 'Asiento contable no encontrado.' });
        res.status(204).send(); // 204 No Content para eliminación exitosa
    } catch (error: any) {
        console.error("Error en deleteAsientoContable controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Exportar asientos contables a Excel
export const exportarAsientosContables = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const { page: _page, limit: _limit, ...filters } = req.query;
        // Se usa getAllAsientosContables sin paginación para la exportación completa
        const asientosParaExportar = await asientoContableService.getAllAsientosContables(empresaId, 1, 9999, filters); 

        const worksheet = XLSX.utils.json_to_sheet(asientosParaExportar.records); 
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'AsientosContables');

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Reporte_AsientosContables.xlsx');
        res.send(excelBuffer);
    } catch (error: any) {
        console.error("Error en exportarAsientosContables controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};
