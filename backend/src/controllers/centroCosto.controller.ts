// Archivo: backend/src/controllers/centroCosto.controller.ts
import { Response } from 'express';
import * as XLSX from 'xlsx'; // Aunque no se usa directamente aquí, es común para exportaciones
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as centroCostoService from '../services/centroCosto.service'; // Importa el servicio de centros de costo

// Obtener todos los centros de costo con filtros y paginación
export const getCentrosCosto = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 9999; // Límite alto para obtener todos para selectores
        const { page: _page, limit: _limit, ...filters } = req.query;

        const centrosCostoPaginados = await centroCostoService.getAllCentrosCosto(empresaId, page, limit, filters); 
        res.status(200).json(centrosCostoPaginados);
    } catch (error: any) {
        console.error("Error en getCentrosCosto controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Obtener un centro de costo por ID
export const getCentroCosto = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const centroCosto = await centroCostoService.getCentroCostoById(parseInt(id), empresaId); // Asumiendo getCentroCostoById
        if (!centroCosto) return res.status(404).json({ message: 'Centro de costo no encontrado.' });
        
        res.status(200).json(centroCosto);
    } catch (error: any) {
        console.error("Error en getCentroCosto controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Crear un centro de costo
export const createCentroCosto = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });
        
        const nuevoCentroCosto = await centroCostoService.createCentroCosto({ ...req.body, empresa_id: empresaId }, usuarioId, nombreUsuario); // Asumiendo createCentroCosto
        res.status(201).json(nuevoCentroCosto);
    } catch (error: any) {
        console.error("Error en createCentroCosto controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Actualizar un centro de costo
export const updateCentroCosto = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });

        const centroCostoActualizado = await centroCostoService.updateCentroCosto(parseInt(id), { ...req.body, empresa_id: empresaId }, usuarioId, nombreUsuario); // Asumiendo updateCentroCosto
        if (!centroCostoActualizado) return res.status(404).json({ message: 'Centro de costo no encontrado.' });
        res.status(200).json(centroCostoActualizado);
    } catch (error: any) {
        console.error("Error en updateCentroCosto controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Eliminar (desactivar) un centro de costo
export const deleteCentroCosto = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });

        const success = await centroCostoService.deleteCentroCosto(parseInt(id), empresaId, usuarioId, nombreUsuario); // Asumiendo deleteCentroCosto
        if (!success) return res.status(404).json({ message: 'Centro de costo no encontrado.' });
        res.status(204).send(); // 204 No Content para eliminación exitosa
    } catch (error: any) {
        console.error("Error en deleteCentroCosto controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Exportar centros de costo a Excel
export const exportarCentrosCosto = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const { page: _page, limit: _limit, ...filters } = req.query;
        // Se usa getAllCentrosCosto sin paginación para la exportación completa
        const centrosCostoParaExportar = await centroCostoService.getAllCentrosCosto(empresaId, 1, 9999, filters); 

        const worksheet = XLSX.utils.json_to_sheet(centrosCostoParaExportar.records); 
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'CentrosCosto');

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Reporte_CentrosCosto.xlsx');
        res.send(excelBuffer);
    } catch (error: any) {
        console.error("Error en exportarCentrosCosto controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};
