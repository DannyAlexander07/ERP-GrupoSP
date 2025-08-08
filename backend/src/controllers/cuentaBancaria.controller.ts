// Archivo: backend/src/controllers/cuentaBancaria.controller.ts (VERSIÓN FINAL Y CORREGIDA CON EXPORTS)
import { Response } from 'express';
import * as XLSX from 'xlsx'; // Para exportación a Excel
import { AuthenticatedRequest } from '../middleware/auth.middleware'; // Para acceder a req.user
import * as cuentaBancariaService from '../services/cuentaBancaria.service'; // Importa el servicio de cuentas bancarias

// Obtener todos los cuentas bancarias con filtros y paginación
export const getCuentasBancarias = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 8;
        const { page: _page, limit: _limit, ...filters } = req.query;

        const cuentasPaginadas = await cuentaBancariaService.getAllCuentasBancarias(empresaId, page, limit, filters as cuentaBancariaService.CuentaBancariaFilters);
        res.status(200).json(cuentasPaginadas);
    } catch (error: any) {
        console.error("Error en getCuentasBancarias controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Obtener un cuenta bancaria por ID
export const getCuentaBancaria = async (req: AuthenticatedRequest, res: Response) => { // <--- ¡AÑADIDO EXPORT!
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const cuenta = await cuentaBancariaService.getCuentaBancariaById(parseInt(id), empresaId);
        if (!cuenta) return res.status(404).json({ message: 'Cuenta bancaria no encontrada.' });
        
        res.status(200).json(cuenta);
    } catch (error: any) {
        console.error("Error en getCuentaBancaria controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Crear un cuenta bancaria
export const createCuentaBancaria = async (req: AuthenticatedRequest, res: Response) => { // <--- ¡AÑADIDO EXPORT!
    try {
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });
        
        const nuevaCuenta = await cuentaBancariaService.createCuentaBancaria({ ...req.body, empresa_id: empresaId }, usuarioId, nombreUsuario);
        res.status(201).json(nuevaCuenta);
    } catch (error: any) {
        console.error("Error en createCuentaBancaria controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Actualizar un cuenta bancaria
export const updateCuentaBancaria = async (req: AuthenticatedRequest, res: Response) => { // <--- ¡AÑADIDO EXPORT!
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });

        const cuentaActualizada = await cuentaBancariaService.updateCuentaBancaria(parseInt(id), { ...req.body, empresa_id: empresaId }, usuarioId, nombreUsuario);
        if (!cuentaActualizada) return res.status(404).json({ message: 'Cuenta bancaria no encontrada.' });
        res.status(200).json(cuentaActualizada);
    } catch (error: any) {
        console.error("Error en updateCuentaBancaria controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Eliminar (desactivar) un cuenta bancaria
export const deleteCuentaBancaria = async (req: AuthenticatedRequest, res: Response) => { // <--- ¡AÑADIDO EXPORT!
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });

        const success = await cuentaBancariaService.deleteCuentaBancaria(parseInt(id), empresaId, usuarioId, nombreUsuario);
        if (!success) return res.status(404).json({ message: 'Cuenta bancaria no encontrada.' });
        res.status(204).send(); // 204 No Content para eliminación exitosa
    } catch (error: any) {
        console.error("Error en deleteCuentaBancaria controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Exportar cuentas bancarias a Excel
export const exportarCuentasBancarias = async (req: AuthenticatedRequest, res: Response) => { // <--- Ya tenía EXPORT
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const { page: _page, limit: _limit, ...filters } = req.query;
        // Se usa getAllCuentasBancarias sin paginación para la exportación completa
        const cuentasParaExportar = await cuentaBancariaService.exportarCuentasBancarias(empresaId, filters as cuentaBancariaService.CuentaBancariaFilters); 

        const worksheet = XLSX.utils.json_to_sheet(cuentasParaExportar); 
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'CuentasBancarias');

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Reporte_CuentasBancarias.xlsx');
        res.send(excelBuffer);
    } catch (error: any) {
        console.error("Error en exportarCuentasBancarias controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};