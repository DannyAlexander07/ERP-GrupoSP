// Archivo: backend/src/controllers/proyecto.controller.ts
import { Response } from 'express';
import * as XLSX from 'xlsx';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as proyectoService from '../services/proyecto.service'; // Importa el servicio de proyectos

// Obtener todos los proyectos con filtros y paginación
export const getProyectos = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 8;
        const { page: _page, limit: _limit, ...filters } = req.query;

        const proyectosPaginados = await proyectoService.getAllProyectos(empresaId, page, limit, filters);
        res.status(200).json(proyectosPaginados);
    } catch (error: any) {
        console.error("Error en getProyectos controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// NUEVO controlador para obtener el siguiente código
export const getNextProyectoCode = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) {
            return res.status(400).json({ message: 'Usuario sin empresa asociada.' });
        }
        const nextCode = await proyectoService.getNextProyectoCode(empresaId);
        res.status(200).json({ codigo: nextCode });
    } catch (error: any) {
        console.error("Error en getNextProyectoCode controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Obtener un proyecto por ID
export const getProyecto = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const proyecto = await proyectoService.getProyectoById(parseInt(id), empresaId);
        if (!proyecto) return res.status(404).json({ message: 'Proyecto no encontrado.' });
        
        res.status(200).json(proyecto);
    } catch (error: any) {
        console.error("Error en getProyecto controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Crear un proyecto
export const createProyecto = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });
        
        const nuevoProyecto = await proyectoService.createProyecto({ ...req.body, empresa_id_responsable: empresaId }, usuarioId, nombreUsuario);
        res.status(201).json(nuevoProyecto);
    } catch (error: any) {
        console.error("Error en createProyecto controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Actualizar un proyecto
export const updateProyecto = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });

        const proyectoActualizado = await proyectoService.updateProyecto(parseInt(id), { ...req.body, empresa_id_responsable: empresaId }, usuarioId, nombreUsuario);
        if (!proyectoActualizado) return res.status(404).json({ message: 'Proyecto no encontrado.' });
        res.status(200).json(proyectoActualizado);
    } catch (error: any) {
        console.error("Error en updateProyecto controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Eliminar (desactivar) un proyecto
export const deleteProyecto = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });

        const success = await proyectoService.deleteProyecto(parseInt(id), empresaId, usuarioId, nombreUsuario);
        if (!success) return res.status(404).json({ message: 'Proyecto no encontrado.' });
        res.status(204).send(); // 204 No Content para eliminación exitosa
    } catch (error: any) {
        console.error("Error en deleteProyecto controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Exportar proyectos a Excel
export const exportarProyectos = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const { page: _page, limit: _limit, ...filters } = req.query;
        // Se usa getAllProyectos sin paginación para la exportación completa
        const proyectosParaExportar = await proyectoService.getAllProyectos(empresaId, 1, 9999, filters); 

        const worksheet = XLSX.utils.json_to_sheet(proyectosParaExportar.records); 
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Proyectos');

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Reporte_Proyectos.xlsx');
        res.send(excelBuffer);
    } catch (error: any) {
        console.error("Error en exportarProyectos controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};
