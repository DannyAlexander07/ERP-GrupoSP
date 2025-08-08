// Archivo: backend/src/controllers/compra.controller.ts
import { Response } from 'express';
import * as XLSX from 'xlsx';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as compraService from '../services/compra.service'; // Importa el servicio de compras

// Obtener todas las facturas de compra con filtros y paginación
export const getFacturasCompra = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 8;
        const { page: _page, limit: _limit, ...filters } = req.query;

        const facturasPaginadas = await compraService.getAllFacturasCompra(empresaId, page, limit, filters);
        res.status(200).json(facturasPaginadas);
    } catch (error: any) {
        console.error("Error en getFacturasCompra controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Obtener una factura de compra por ID
export const getFacturaCompra = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const factura = await compraService.getFacturaCompraById(parseInt(id), empresaId);
        if (!factura) return res.status(404).json({ message: 'Factura de compra no encontrada.' });
        
        res.status(200).json(factura);
    } catch (error: any) {
        console.error("Error en getFacturaCompra controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Crear una factura de compra
export const createFacturaCompra = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });
        
        const nuevaFactura = await compraService.createFacturaCompra({ ...req.body, empresa_id_compradora: empresaId }, usuarioId, nombreUsuario);
        res.status(201).json(nuevaFactura);
    } catch (error: any) {
        console.error("Error en createFacturaCompra controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Actualizar una factura de compra
export const updateFacturaCompra = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });

        const facturaActualizada = await compraService.updateFacturaCompra(parseInt(id), { ...req.body, empresa_id_compradora: empresaId }, usuarioId, nombreUsuario);
        if (!facturaActualizada) return res.status(404).json({ message: 'Factura de compra no encontrada.' });
        res.status(200).json(facturaActualizada);
    } catch (error: any) {
        console.error("Error en updateFacturaCompra controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Anular (eliminar lógicamente) una factura de compra
export const deleteFacturaCompra = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });

        const success = await compraService.deleteFacturaCompra(parseInt(id), empresaId, usuarioId, nombreUsuario);
        if (!success) return res.status(404).json({ message: 'Factura de compra no encontrada.' });
        res.status(204).send(); // 204 No Content para eliminación exitosa
    } catch (error: any) {
        console.error("Error en deleteFacturaCompra controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Exportar facturas de compra a Excel
export const exportarFacturasCompra = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const { page: _page, limit: _limit, ...filters } = req.query;
        const facturasParaExportar = await compraService.getAllFacturasCompraForExport(empresaId, filters);

        const worksheet = XLSX.utils.json_to_sheet(facturasParaExportar);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'FacturasCompra');

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Reporte_FacturasCompra.xlsx');
        res.send(excelBuffer);
    } catch (error: any) {
        console.error("Error en exportarFacturasCompra controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};
