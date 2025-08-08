// Archivo: backend/src/controllers/pagoRecibido.controller.ts
import { Response } from 'express';
import * as XLSX from 'xlsx'; // Aunque no se usa directamente aquí, es común para exportaciones
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as pagoRecibidoService from '../services/pagoRecibido.service'; // Importa el servicio de pagos recibidos

// Obtener todos los pagos recibidos con filtros y paginación
export const getPagosRecibidos = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 8;
        const { page: _page, limit: _limit, ...filters } = req.query;

        const pagosPaginados = await pagoRecibidoService.getAllPagosRecibidos(empresaId, page, limit, filters);
        res.status(200).json(pagosPaginados);
    } catch (error: any) {
        console.error("Error en getPagosRecibidos controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Obtener un pago recibido por ID
export const getPagoRecibido = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const pago = await pagoRecibidoService.getPagoRecibidoById(parseInt(id), empresaId);
        if (!pago) return res.status(404).json({ message: 'Pago recibido no encontrado.' });
        
        res.status(200).json(pago);
    } catch (error: any) {
        console.error("Error en getPagoRecibido controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Crear un pago recibido
export const createPagoRecibido = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });
        
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });

        // --- ¡CORRECCIÓN AQUÍ! ---
        // Nos aseguramos de pasar el body completo, que incluye 'es_adelanto'
        const pagoData: pagoRecibidoService.PagoRecibido = { 
            ...req.body, 
            empresa_id_receptora: empresaId 
        };

        const nuevoPago = await pagoRecibidoService.createPagoRecibido(pagoData, usuarioId, nombreUsuario);
        res.status(201).json(nuevoPago);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};


// Actualizar un pago recibido
export const updatePagoRecibido = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });

        const pagoActualizado = await pagoRecibidoService.updatePagoRecibido(parseInt(id), { ...req.body, empresa_id_receptora: empresaId }, usuarioId, nombreUsuario);
        if (!pagoActualizado) return res.status(404).json({ message: 'Pago recibido no encontrado.' });
        res.status(200).json(pagoActualizado);
    } catch (error: any) {
        console.error("Error en updatePagoRecibido controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Eliminar (anular) un pago recibido
export const deletePagoRecibido = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });

        const success = await pagoRecibidoService.deletePagoRecibido(parseInt(id), empresaId, usuarioId, nombreUsuario);
        if (!success) return res.status(404).json({ message: 'Pago recibido no encontrado.' });
        res.status(204).send(); // 204 No Content para eliminación exitosa
    } catch (error: any) {
        console.error("Error en deletePagoRecibido controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Exportar pagos recibidos a Excel
export const exportarPagosRecibidos = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const { page: _page, limit: _limit, ...filters } = req.query;
        // Se usa getAllPagosRecibidos sin paginación para la exportación completa
        const pagosParaExportar = await pagoRecibidoService.getAllPagosRecibidos(empresaId, 1, 9999, filters); 

        const worksheet = XLSX.utils.json_to_sheet(pagosParaExportar.records); 
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'PagosRecibidos');

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Reporte_PagosRecibidos.xlsx');
        res.send(excelBuffer);
    } catch (error: any) {
        console.error("Error en exportarPagosRecibidos controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};
