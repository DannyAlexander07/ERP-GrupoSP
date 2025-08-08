// Archivo: backend/src/controllers/planContable.controller.ts (VERSIÓN FINAL Y CORREGIDA)
import { Response } from 'express';
import * as XLSX from 'xlsx';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as planContableService from '../services/planContable.service'; 

// Obtener todas las cuentas contables con filtros y paginación
export const getPlanContable = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 8;
        const { page: _page, limit: _limit, ...filters } = req.query;

        const cuentasPaginadas = await planContableService.getAllPlanContable(empresaId, page, limit, filters as planContableService.PlanContableFilters);
        res.status(200).json(cuentasPaginadas);
    } catch (error: any) {
        console.error("Error en getPlanContable controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Obtener una cuenta contable por ID
export const getCuentaContable = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const cuenta = await planContableService.getPlanContableById(parseInt(id), empresaId);
        if (!cuenta) return res.status(404).json({ message: 'Cuenta contable no encontrada.' });
        
        res.status(200).json(cuenta);
    } catch (error: any) {
        console.error("Error en getCuentaContable controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Crear una nueva cuenta contable
export const createCuentaContable = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });

        const nuevaCuenta = await planContableService.createPlanContable({ ...req.body, empresa_id: empresaId }, usuarioId, nombreUsuario);
        res.status(201).json(nuevaCuenta);
    } catch (error: any) {
        console.error("Error en createCuentaContable controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Actualizar una cuenta contable
export const updateCuentaContable = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });

        const cuentaActualizada = await planContableService.updatePlanContable(parseInt(id), { ...req.body, empresa_id: empresaId }, usuarioId, nombreUsuario);
        if (!cuentaActualizada) return res.status(404).json({ message: 'Cuenta contable no encontrada.' });
        res.status(200).json(cuentaActualizada);
    } catch (error: any) {
        console.error("Error en updateCuentaContable controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Eliminar (desactivar) una cuenta contable
export const deleteCuentaContable = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });

        const success = await planContableService.deletePlanContable(parseInt(id), empresaId, usuarioId, nombreUsuario);
        if (!success) return res.status(404).json({ message: 'Cuenta contable no encontrada.' });
        res.status(204).send(); // 204 No Content para eliminación exitosa
    } catch (error: any) {
        console.error("Error en deleteCuentaContable controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Exportar plan contable a Excel
export const exportarPlanContable = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const { page: _page, limit: _limit, ...filters } = req.query;
        const cuentasParaExportar = await planContableService.exportarPlanContable(empresaId, filters as planContableService.PlanContableFilters); 

        const worksheet = XLSX.utils.json_to_sheet(cuentasParaExportar);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'PlanContable');

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Reporte_PlanContable.xlsx');
        res.send(excelBuffer);
    } catch (error: any) {
        console.error("Error en exportarPlanContable controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};