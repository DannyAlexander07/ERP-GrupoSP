// Archivo: backend/src/controllers/usuario.controller.ts
import { Response } from 'express';
import * as XLSX from 'xlsx';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as usuarioService from '../services/usuario.service'; // Importa el servicio de usuarios

// Obtener todos los usuarios con filtros y paginación
export const getUsuarios = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 8;
        const { page: _page, limit: _limit, ...filters } = req.query;

        const usuariosPaginados = await usuarioService.getAllUsuarios(empresaId, page, limit, filters);
        res.status(200).json(usuariosPaginados);
    } catch (error: any) {
        console.error("Error en getUsuarios controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Obtener un usuario por ID
export const getUsuario = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const usuario = await usuarioService.getUsuarioById(parseInt(id), empresaId);
        if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado.' });
        
        res.status(200).json(usuario);
    } catch (error: any) {
        console.error("Error en getUsuario controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Crear un usuario
export const createUsuario = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });
        
        const nuevoUsuario = await usuarioService.createUsuario({ ...req.body, empresa_id_predeterminada: empresaId }, usuarioId, nombreUsuario);
        res.status(201).json(nuevoUsuario);
    } catch (error: any) {
        console.error("Error en createUsuario controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Actualizar un usuario
export const updateUsuario = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });

        const usuarioActualizado = await usuarioService.updateUsuario(parseInt(id), { ...req.body, empresa_id_predeterminada: empresaId }, usuarioId, nombreUsuario);
        if (!usuarioActualizado) return res.status(404).json({ message: 'Usuario no encontrado.' });
        res.status(200).json(usuarioActualizado);
    } catch (error: any) {
        console.error("Error en updateUsuario controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Eliminar (desactivar) un usuario
export const deleteUsuario = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });

        const success = await usuarioService.deleteUsuario(parseInt(id), empresaId, usuarioId, nombreUsuario);
        if (!success) return res.status(404).json({ message: 'Usuario no encontrado.' });
        res.status(204).send(); // 204 No Content para eliminación exitosa
    } catch (error: any) {
        console.error("Error en deleteUsuario controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Exportar usuarios a Excel
export const exportarUsuarios = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const { page: _page, limit: _limit, ...filters } = req.query;
        // Se usa getAllUsuarios sin paginación para la exportación completa
        // ¡CAMBIO CLAVE AQUÍ! Corregir el nombre de la función
        const usuariosParaExportar = await usuarioService.exportUsuarios(empresaId, filters as usuarioService.UsuarioFilters); 

        const worksheet = XLSX.utils.json_to_sheet(usuariosParaExportar); 
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Usuarios');

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Reporte_Usuarios.xlsx');
        res.send(excelBuffer);
    } catch (error: any) {
        console.error("Error en exportarUsuarios controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};
