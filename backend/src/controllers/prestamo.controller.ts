// Archivo: backend/src/controllers/prestamo.controller.ts (NUEVO CONTROLADOR - COMPLETO)
import { Response } from 'express';
import * as XLSX from 'xlsx'; // Para exportación a Excel
import { AuthenticatedRequest } from '../middleware/auth.middleware'; // Para acceder a req.user
import * as prestamoService from '../services/prestamo.service'; // Importa el servicio de préstamos

// Obtener todos los préstamos con filtros y paginación
export const getPrestamos = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 8;
        const { page: _page, limit: _limit, ...filters } = req.query;

        // Aserción de tipo para los filtros de req.query
        const prestamosPaginados = await prestamoService.getAllPrestamos(empresaId, page, limit, filters as prestamoService.PrestamoFilters);
        res.status(200).json(prestamosPaginados);
    } catch (error: any) {
        console.error("Error en getPrestamos controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor al obtener préstamos.' });
    }
};

// Obtener un préstamo por ID con sus cuotas
export const getPrestamo = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const prestamo = await prestamoService.getPrestamoById(parseInt(id), empresaId);
        if (!prestamo) return res.status(404).json({ message: 'Préstamo no encontrado.' });
        
        res.status(200).json(prestamo);
    } catch (error: any) {
        console.error("Error en getPrestamo controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor al obtener préstamo.' });
    }
};

// Crear un préstamo con su plan de cuotas
export const createPrestamo = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario/empresa incompletos.' });
        
        // Se asume que req.body contiene los datos del préstamo principal
        const nuevoPrestamo = await prestamoService.createPrestamo({ ...req.body, empresa_id_titular: empresaId }, usuarioId, nombreUsuario);
        res.status(201).json(nuevoPrestamo);
    } catch (error: any) {
        console.error("Error en createPrestamo controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor al crear préstamo.' });
    }
};

// Actualizar un préstamo
export const updatePrestamo = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario/empresa incompletos.' });

        const prestamoActualizado = await prestamoService.updatePrestamo(parseInt(id), { ...req.body, empresa_id_titular: empresaId }, usuarioId, nombreUsuario);
        if (!prestamoActualizado) return res.status(404).json({ message: 'Préstamo no encontrado.' });
        res.status(200).json(prestamoActualizado);
    } catch (error: any) {
        console.error("Error en updatePrestamo controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor al actualizar préstamo.' });
    }
};

// Eliminar (desactivar) un préstamo
export const deletePrestamo = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario/empresa incompletos.' });

        const success = await prestamoService.deletePrestamo(parseInt(id), empresaId, usuarioId, nombreUsuario);
        if (!success) return res.status(404).json({ message: 'Préstamo no encontrado.' });
        res.status(204).send(); // 204 No Content para eliminación exitosa
    } catch (error: any) {
        console.error("Error en deletePrestamo controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor al eliminar préstamo.' });
    }
};

// Exportar préstamos a Excel
export const exportarPrestamos = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const { page: _page, limit: _limit, ...filters } = req.query;
        // Se usa getAllPrestamos sin paginación para la exportación completa
        const prestamosParaExportar = await prestamoService.exportarPrestamos(empresaId, filters as prestamoService.PrestamoFilters); 

        const worksheet = XLSX.utils.json_to_sheet(prestamosParaExportar); 
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Prestamos');

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Reporte_Prestamos.xlsx');
        res.send(excelBuffer);
    } catch (error: any) {
        console.error("Error en exportarPrestamos controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};