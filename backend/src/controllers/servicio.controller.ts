// Archivo: backend/src/controllers/servicio.controller.ts (VERSIÓN FINAL Y COMPLETA)
import { Response } from 'express';
import * as XLSX from 'xlsx';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as servicioService from '../services/servicio.service';

// Obtener todos los servicios con filtros y paginación
export const getServicios = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 8;
        const { page: _page, limit: _limit, ...filters } = req.query;

        const serviciosPaginados = await servicioService.getAllServicios(empresaId, page, limit, filters);
        res.status(200).json(serviciosPaginados);
    } catch (error: any) { 
        console.error("Error en getServicios controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' }); 
    }
};

// Obtener el siguiente código de servicio
export const getNextServicioCode = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });
        const nextCode = await servicioService.getNextServicioCode(empresaId);
        res.status(200).json({ codigo: nextCode });
    } catch (error: any) {
        console.error("Error en getNextServicioCode controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Exportar servicios a Excel
export const exportarServicios = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const { page: _page, limit: _limit, ...filters } = req.query;
        const serviciosParaExportar = await servicioService.getAllServiciosForExport(empresaId, filters);

        const worksheet = XLSX.utils.json_to_sheet(serviciosParaExportar);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Servicios');

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Reporte_Servicios.xlsx');
        res.send(excelBuffer);
    } catch (error: any) { 
        console.error("Error en exportarServicios controller:", error);
        res.status(500).json({ message: 'Error interno del servidor.' }); 
    }
};

// Obtener un solo servicio por ID
export const getServicio = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const servicio = await servicioService.getServicioById(parseInt(id), empresaId);
        if (!servicio) return res.status(404).json({ message: 'Servicio no encontrado.' });
        
        res.status(200).json(servicio);
    } catch (error: any) { 
        res.status(500).json({ message: 'Error interno del servidor.' }); 
    }
};

// Crear un servicio
export const createServicio = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });
        
        const nuevoServicio = await servicioService.createServicio({ ...req.body, empresa_id_oferente: empresaId }, usuarioId, nombreUsuario);
        res.status(201).json(nuevoServicio);
    } catch (error: any) { res.status(500).json({ message: 'Error interno del servidor.' }); }
};

// Actualizar un servicio
export const updateServicio = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });

        const servicioActualizado = await servicioService.updateServicio(parseInt(id), { ...req.body, empresa_id_oferente: empresaId }, usuarioId, nombreUsuario);
        if (!servicioActualizado) return res.status(404).json({ message: 'Servicio no encontrado.' });
        res.status(200).json(servicioActualizado);
    } catch (error: any) { res.status(500).json({ message: 'Error interno del servidor.' }); }
};

// Eliminar un servicio
export const deleteServicio = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });

        const success = await servicioService.deleteServicio(parseInt(id), empresaId, usuarioId, nombreUsuario);
        if (!success) return res.status(404).json({ message: 'Servicio no encontrado.' });
        res.status(204).send();
    } catch (error: any) { res.status(500).json({ message: 'Error interno del servidor.' }); }
};
