// Archivo: backend/src/controllers/venta.controller.ts (VERSIÓN FINAL Y CORREGIDA)
import { Response } from 'express';
import * as XLSX from 'xlsx';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as ventaService from '../services/venta.service'; 

// Obtener todas las facturas de venta con filtros y paginación
export const getFacturasVenta = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 8;
        const { page: _page, limit: _limit, ...filters } = req.query;

        const facturasPaginadas = await ventaService.getAllFacturasVenta(empresaId, page, limit, filters as ventaService.VentaFilters);
        res.status(200).json(facturasPaginadas);
    } catch (error: any) {
        console.error("Error en getFacturasVenta controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Obtener una factura de venta por ID
export const getFacturaVenta = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const factura = await ventaService.getFacturaVentaById(parseInt(id), empresaId);
        if (!factura) return res.status(404).json({ message: 'Factura de venta no encontrada.' });
        
        res.status(200).json(factura);
    } catch (error: any) {
        console.error("Error en getFacturaVenta controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Crear una factura de venta
export const createFacturaVenta = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });
        
        const nuevaFactura = await ventaService.createFacturaVenta({ ...req.body, empresa_id_emisora: empresaId }, usuarioId, nombreUsuario);
        res.status(201).json(nuevaFactura);
    } catch (error: any) {
        console.error("Error en createFacturaVenta controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Actualizar una factura de venta
export const updateFacturaVenta = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });

        const facturaActualizada = await ventaService.updateFacturaVenta(parseInt(id), { ...req.body, empresa_id_emisora: empresaId }, usuarioId, nombreUsuario);
        if (!facturaActualizada) return res.status(404).json({ message: 'Factura de venta no encontrada.' });
        res.status(200).json(facturaActualizada);
    } catch (error: any) {
        console.error("Error en updateFacturaVenta controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Anular (eliminar lógicamente) una factura de venta
export const deleteFacturaVenta = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });

        const success = await ventaService.deleteFacturaVenta(parseInt(id), empresaId, usuarioId, nombreUsuario);
        if (!success) return res.status(404).json({ message: 'Factura de venta no encontrada.' });
        res.status(204).send(); // 204 No Content para eliminación exitosa
    } catch (error: any) {
        console.error("Error en deleteFacturaVenta controller:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

// Exportar facturas de venta a Excel
export const exportarFacturasVenta = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const empresaId = req.user?.empresa_id;
        if (!empresaId) {
            return res.status(400).json({ message: 'Usuario sin empresa asociada.' });
        }

        const { page: _page, limit: _limit, ...filters } = req.query;

        // --- ¡ESTA ES LA CORRECCIÓN PRINCIPAL! ---
        // 1. Llamamos a la función correcta del servicio que formatea los datos para Excel.
        const facturasParaExportar = await ventaService.getAllFacturasVentaForExport(empresaId, filters as ventaService.VentaFilters);

        // 2. Creamos la hoja de cálculo con los datos recibidos.
        const worksheet = XLSX.utils.json_to_sheet(facturasParaExportar);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'FacturasVenta');

        // 3. Generamos el buffer del archivo Excel para enviarlo como respuesta.
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

        // 4. Configuramos las cabeceras de la respuesta para la descarga.
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Reporte_FacturasVenta.xlsx');
        
        // 5. Enviamos el buffer.
        res.send(excelBuffer);

    } catch (error: any) {
        console.error("Error en exportarFacturasVenta controller:", error);
        // Enviamos un error claro si algo falla en el proceso.
        res.status(500).json({ message: error.message || 'Error interno del servidor al generar el archivo Excel.' });
    }
};

// Descargar XML de Factura de Venta
export const downloadFacturaVentaXml = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const xmlBuffer = await ventaService.generateFacturaVentaXml(parseInt(id), empresaId);
        if (!xmlBuffer) return res.status(404).json({ message: 'XML no encontrado o no generado.' });

        const factura = await ventaService.getFacturaVentaById(parseInt(id), empresaId);
        const fileName = factura ? `${factura.numero_completo_comprobante}.xml` : `factura_${id}.xml`;

        res.setHeader('Content-Type', 'application/xml');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.send(xmlBuffer);
    } catch (error: any) {
        console.error("Error al descargar XML de factura:", error);
        res.status(500).json({ message: error.message || 'Error al generar el XML.' });
    }
};

// Descargar CDR de Factura de Venta
export const downloadFacturaVentaCdr = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        // CAMBIO: Llamar a la nueva función 'getFacturaVentaCdr'
        const cdrBuffer = await ventaService.getFacturaVentaCdr(parseInt(id), empresaId);
        
        if (!cdrBuffer) {
            return res.status(404).json({ message: 'El CDR para esta factura no ha sido encontrado. Probablemente aún no ha sido procesado por la SUNAT.' });
        }

        const factura = await ventaService.getFacturaVentaById(parseInt(id), empresaId);
        const fileName = factura ? `R-${factura.numero_completo_comprobante}.zip` : `cdr_${id}.zip`; 

        res.setHeader('Content-Type', 'application/zip'); 
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.send(cdrBuffer);
    } catch (error: any) {
        console.error("Error al descargar CDR de factura:", error);
        res.status(500).json({ message: error.message || 'Error al obtener el CDR.' });
    }
};

// Descargar PDF de Factura de Venta
export const downloadFacturaVentaPdf = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        if (!empresaId) return res.status(400).json({ message: 'Usuario sin empresa asociada.' });

        const pdfBuffer = await ventaService.generateFacturaVentaPdf(parseInt(id), empresaId);
        if (!pdfBuffer) return res.status(404).json({ message: 'PDF no encontrado o no generado.' });

        const factura = await ventaService.getFacturaVentaById(parseInt(id), empresaId);
        const fileName = factura ? `${factura.numero_completo_comprobante}.pdf` : `factura_${id}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.send(pdfBuffer);
    } catch (error: any) {
        console.error("Error al descargar PDF de factura:", error);
        res.status(500).json({ message: error.message || 'Error al generar el PDF.' });
    }
};

export const enviarFacturaASunat = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        if (!empresaId) {
            return res.status(400).json({ message: 'Usuario sin empresa asociada.' });
        }

        const resultado = await ventaService.firmarFacturaYEnviarASunat(parseInt(id), empresaId);

        res.status(200).json(resultado);
    } catch (error: any) {
        console.error("Error en el proceso de envío a SUNAT:", error);
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};

export const aplicarSaldoAFactura = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const empresaId = req.user?.empresa_id;
        const usuarioId = req.user?.usuario_id;
        const nombreUsuario = req.user?.nombre_usuario;
        
        if (!empresaId || !usuarioId || !nombreUsuario) return res.status(400).json({ message: 'Datos de usuario incompletos.' });

        const facturaActualizada = await ventaService.aplicarSaldoAFactura(parseInt(id), empresaId, usuarioId, nombreUsuario);
        res.status(200).json(facturaActualizada);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Error interno del servidor.' });
    }
};