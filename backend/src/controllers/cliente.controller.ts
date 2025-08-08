// Archivo: backend/src/controllers/cliente.controller.ts
import { Response } from 'express';
import * as XLSX from 'xlsx';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as clienteService from '../services/cliente.service';

// Obtener todos los clientes con filtros y paginación
export const getClientes = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 8; 
        
        const { page: _page, limit: _limit, ...filters } = req.query;

        const clientesPaginados = await clienteService.getAllClientes(empresaId, page, limit, filters);
        res.status(200).json(clientesPaginados);
    } catch (error: any) { 
        console.error("Error en getClientes controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' }); 
    }
};


// Obtener el siguiente código de cliente
export const getNextClienteCode = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });
        const nextCode = await clienteService.getNextClienteCode(empresaId);
        res.status(200).json({ codigo: nextCode });
    } catch (error: any) { 
        console.error("Error en getNextClienteCode controller:", error); 
        res.status(500).json({ message: error.message || 'Error interno del servidor.' }); 
    }
};

// Obtener un solo cliente por ID
export const getCliente = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const cliente = await clienteService.getClienteById(parseInt(id), empresaId);
        if (!cliente) return res.status(404).json({ message: 'Cliente no encontrado.' });
        
        res.status(200).json(cliente);
    } catch (error: any) { 
        console.error("Error en getCliente controller:", error); 
        res.status(500).json({ message: error.message || 'Error interno del servidor.' }); 
    }
};

// Crear un cliente
export const createCliente = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });
        
        const nuevoCliente = await clienteService.createCliente({ ...req.body, empresa_id_vinculada: empresaId }, usuarioId, nombreUsuario);
        res.status(201).json(nuevoCliente);
    } catch (error: any) { 
        console.error("Error en createCliente controller:", error); 
        res.status(500).json({ message: error.message || 'Error interno del servidor.' }); 
    }
};

// Actualizar un cliente
export const updateCliente = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });

        const clienteActualizado = await clienteService.updateCliente(parseInt(id), { ...req.body, empresa_id_vinculada: empresaId }, usuarioId, nombreUsuario);
        if (!clienteActualizado) return res.status(404).json({ message: 'Cliente no encontrado.' });
        res.status(200).json(clienteActualizado);
    } catch (error: any) { 
        console.error("Error en updateCliente controller:", error); 
        res.status(500).json({ message: error.message || 'Error interno del servidor.' }); 
    }
};

// Eliminar un cliente
export const deleteCliente = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });

        const success = await clienteService.deleteCliente(parseInt(id), empresaId, usuarioId, nombreUsuario);
        if (!success) return res.status(404).json({ message: 'Cliente no encontrado.' });
        res.status(204).send();
    } catch (error: any) { 
        res.status(500).json({ message: error.message || 'Error interno del servidor.' }); 
    }
};

// Exportar clientes que coinciden con los filtros
export const exportarClientes = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const { page: _page, limit: _limit, ...filters } = req.query;
        const clientesParaExportar = await clienteService.getAllClientesForExport(empresaId, filters);

        // Crear una hoja de cálculo a partir de los datos JSON
        const worksheet = XLSX.utils.json_to_sheet(clientesParaExportar);
        // Crear un nuevo libro de trabajo
        const workbook = XLSX.utils.book_new();
        // Añadir la hoja de cálculo al libro de trabajo
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Clientes');

        // Generar el archivo Excel en formato de buffer
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

        // Configurar las cabeceras de la respuesta para la descarga del archivo
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Reporte_Clientes.xlsx');

        // Enviar el buffer del archivo Excel como respuesta
        res.send(excelBuffer);

    } catch (error: any) { 
        console.error("Error en exportarClientes controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' }); 
    }
};
