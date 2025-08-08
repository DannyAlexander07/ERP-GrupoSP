// Archivo: backend/src/controllers/proveedor.controller.ts
import { Response } from 'express';
import * as XLSX from 'xlsx';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as proveedorService from '../services/proveedor.service';

// Obtener todos los proveedores con filtros y paginación
export const getProveedores = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 8;
        const { page: _page, limit: _limit, ...filters } = req.query;

        const proveedoresPaginados = await proveedorService.getAllProveedores(empresaId, page, limit, filters);
        res.status(200).json(proveedoresPaginados);
    } catch (error: any) { // Añadido :any para mejor tipado de errores
        console.error("Error en getProveedores controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' }); 
    }
};

// Obtener el siguiente código de proveedor
export const getNextProveedorCode = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });
        const nextCode = await proveedorService.getNextProveedorCode(empresaId);
        res.status(200).json({ codigo: nextCode });
    } catch (error: any) { // Añadido :any para mejor tipado de errores
        console.error("Error en getNextProveedorCode controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Exportar proveedores a Excel
export const exportarProveedores = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const { page: _page, limit: _limit, ...filters } = req.query;
        const proveedoresParaExportar = await proveedorService.getAllProveedoresForExport(empresaId, filters);

        const worksheet = XLSX.utils.json_to_sheet(proveedoresParaExportar);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Proveedores');

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Reporte_Proveedores.xlsx');
        res.send(excelBuffer);
    } catch (error: any) { // Añadido :any para mejor tipado de errores
        console.error("Error en exportarProveedores controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' }); 
    }
};

// Obtener un solo proveedor por ID
export const getProveedor = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const proveedor = await proveedorService.getProveedorById(parseInt(id), empresaId);
        if (!proveedor) return res.status(404).json({ message: 'Proveedor no encontrado.' });
        
        res.status(200).json(proveedor);
    } catch (error: any) { // Añadido :any para mejor tipado de errores
        console.error("Error en getProveedor controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' }); 
    }
};

// Crear un proveedor
export const createProveedor = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });
        
        const nuevoProveedor = await proveedorService.createProveedor({ ...req.body, empresa_id_principal_compradora: empresaId }, usuarioId, nombreUsuario);
        res.status(201).json(nuevoProveedor);
    } catch (error: any) { // Añadido :any para mejor tipado de errores
        console.error("Error en createProveedor controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' }); 
    }
};

// Actualizar un proveedor
export const updateProveedor = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });

        const proveedorActualizado = await proveedorService.updateProveedor(parseInt(id), { ...req.body, empresa_id_principal_compradora: empresaId }, usuarioId, nombreUsuario);
        if (!proveedorActualizado) return res.status(404).json({ message: 'Proveedor no encontrado.' });
        res.status(200).json(proveedorActualizado);
    } catch (error: any) { // Añadido :any para mejor tipado de errores
        console.error("Error en updateProveedor controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' }); 
    }
};

// Eliminar un proveedor
export const deleteProveedor = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });

        const success = await proveedorService.deleteProveedor(parseInt(id), empresaId, usuarioId, nombreUsuario);
        if (!success) return res.status(404).json({ message: 'Proveedor no encontrado.' });
        res.status(204).send();
    } catch (error: any) { // Añadido :any para mejor tipado de errores
        console.error("Error en deleteProveedor controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' }); 
    }
};
