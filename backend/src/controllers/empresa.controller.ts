// Archivo: backend/src/controllers/empresa.controller.ts (VERSIÓN FINAL Y CORREGIDA CON EXPORTS)
import { Response } from 'express';
import * as XLSX from 'xlsx'; // Para exportación a Excel
import { AuthenticatedRequest } from '../middleware/auth.middleware'; // Para acceder a req.user
import * as empresaService from '../services/empresa.service'; // Importa el servicio de empresas

// Obtener todos los empresas con filtros y paginación
export const getEmpresas = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 8;
        const { page: _page, limit: _limit, ...filters } = req.query;

        const empresasPaginadas = await empresaService.getAllEmpresas(page, limit, filters as empresaService.EmpresaFilters);
        res.status(200).json(empresasPaginadas);
    } catch (error: any) {
        console.error("Error en getEmpresas controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Obtener un empresa por ID
export const getEmpresa = async (req: AuthenticatedRequest, res: Response) => { // <--- ¡AÑADIDO EXPORT!
    try {
        const { id } = req.params;
        const empresa = await empresaService.getEmpresaById(parseInt(id));
        if (!empresa) return res.status(404).json({ message: 'Empresa no encontrada.' });
        
        res.status(200).json(empresa);
    } catch (error: any) {
        console.error("Error en getEmpresa controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor al obtener empresa.' });
    }
};

// Crear un empresa
export const createEmpresa = async (req: AuthenticatedRequest, res: Response) => { // <--- ¡AÑADIDO EXPORT!
    try {
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos para auditoría.' });
        
        const nuevaEmpresa = await empresaService.createEmpresa(req.body, usuarioId, nombreUsuario);
        res.status(201).json(nuevaEmpresa);
    } catch (error: any) {
        console.error("Error en createEmpresa controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor al crear empresa.' });
    }
};

// Actualizar un empresa
export const updateEmpresa = async (req: AuthenticatedRequest, res: Response) => { // <--- ¡AÑADIDO EXPORT!
    try {
        const { id } = req.params;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos para auditoría.' });

        const empresaActualizada = await empresaService.updateEmpresa(parseInt(id), req.body, usuarioId, nombreUsuario);
        if (!empresaActualizada) return res.status(404).json({ message: 'Empresa no encontrada.' });
        res.status(200).json(empresaActualizada);
    } catch (error: any) {
        console.error("Error en updateEmpresa controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor al actualizar empresa.' });
    }
};

// Eliminar (desactivar) un empresa
export const deleteEmpresa = async (req: AuthenticatedRequest, res: Response) => { // <--- ¡AÑADIDO EXPORT!
    try {
        const { id } = req.params;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos para auditoría.' });

        const success = await empresaService.deleteEmpresa(parseInt(id), usuarioId, nombreUsuario);
        if (!success) return res.status(404).json({ message: 'Empresa no encontrada.' });
        res.status(204).send(); // 204 No Content para eliminación exitosa
    } catch (error: any) {
        console.error("Error en deleteEmpresa controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor al eliminar empresa.' });
    }
};

// Exportar empresas a Excel
export const exportarEmpresas = async (req: AuthenticatedRequest, res: Response) => { // <--- Ya tenía EXPORT
    try {
        const { page: _page, limit: _limit, ...filters } = req.query;
        // Se usa getAllEmpresas sin paginación para la exportación completa
        const empresasParaExportar = await empresaService.exportarEmpresas(1, 9999, filters as empresaService.EmpresaFilters); 

        const worksheet = XLSX.utils.json_to_sheet(empresasParaExportar); 
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Empresas');

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Reporte_Empresas.xlsx');
        res.send(excelBuffer);
    } catch (error: any) {
        console.error("Error en exportarEmpresas controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};