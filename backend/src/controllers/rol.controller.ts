// Archivo: backend/src/controllers/rol.controller.ts
import { Response } from 'express';
import * as XLSX from 'xlsx'; // Para exportación a Excel
import { AuthenticatedRequest } from '../middleware/auth.middleware'; // Para acceder a req.user
import * as rolService from '../services/rol.service'; // Importa el servicio de roles

// Obtener todos los roles con filtros y paginación
export const getRoles = async (req: AuthenticatedRequest, res: Response) => {
    try {
        // Los roles son globales y no dependen de empresa_id del usuario,
        // pero se puede pasar 1 como empresaId si el servicio lo requiere por convención
        // o si los roles pueden ser específicos por empresa.
        // Asumiendo que getAllRoles del servicio no usa empresaId como filtro primario.
        // Si roles deben estar vinculados a empresa_id, habría que filtrar.
        
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 9999; // Límite alto para obtener todos para selectores
        const { page: _page, limit: _limit, ...filters } = req.query;

        // Asegurarse de que los filtros se pasen correctamente tipados
        const rolesPaginados = await rolService.getAllRoles(page, limit, filters as rolService.RoleFilters);
        res.status(200).json(rolesPaginados);
    } catch (error: any) {
        console.error("Error en getRoles controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor al obtener roles.' });
    }
};

// Obtener un rol por ID
export const getRole = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const role = await rolService.getRoleById(parseInt(id));
        if (!role) return res.status(404).json({ message: 'Rol no encontrado.' });
        
        res.status(200).json(role);
    } catch (error: any) {
        console.error("Error en getRole controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor al obtener rol.' });
    }
};

// Crear un rol
export const createRole = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos para auditoría.' });
        
        const nuevoRol = await rolService.createRole(req.body, usuarioId, nombreUsuario);
        res.status(201).json(nuevoRol);
    } catch (error: any) {
        console.error("Error en createRole controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor al crear rol.' });
    }
};

// Actualizar un rol
export const updateRole = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos para auditoría.' });

        const rolActualizado = await rolService.updateRole(parseInt(id), req.body, usuarioId, nombreUsuario);
        if (!rolActualizado) return res.status(404).json({ message: 'Rol no encontrado.' });
        res.status(200).json(rolActualizado);
    } catch (error: any) {
        console.error("Error en updateRole controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor al actualizar rol.' });
    }
};

// Eliminar (desactivar) un rol
export const deleteRole = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos para auditoría.' });

        const success = await rolService.deleteRole(parseInt(id), usuarioId, nombreUsuario);
        if (!success) return res.status(404).json({ message: 'Rol no encontrado.' });
        res.status(204).send(); // 204 No Content para eliminación exitosa
    } catch (error: any) {
        console.error("Error en deleteRole controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor al eliminar rol.' });
    }
};

// Exportar roles a Excel
export const exportarRoles = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { page: _page, limit: _limit, ...filters } = req.query;
        // Se usa getAllRoles sin paginación para la exportación completa
        const rolesParaExportar = await rolService.exportRoles(filters as rolService.RoleFilters); 

        const worksheet = XLSX.utils.json_to_sheet(rolesParaExportar); 
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Roles');

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Reporte_Roles.xlsx');
        res.send(excelBuffer);
    } catch (error: any) {
        console.error("Error en exportarRoles controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor al exportar roles.' });
    }
};