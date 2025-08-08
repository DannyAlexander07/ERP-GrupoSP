// Archivo: frontend/src/services/ventaService.ts
import axios from 'axios';
import { showSuccessToast, showErrorAlert } from './notificationService';
import { saveAs } from 'file-saver'; // Para la descarga de archivos

// Interfaz para los Detalles de Factura de Venta (debe coincidir con el backend)
export interface DetalleFacturaVenta {
    detalle_factura_venta_id?: number;
    factura_venta_id?: number; // Opcional al crear, se asigna después
    servicio_id: number; // Referencia al servicio vendido
    numero_linea_item: number;
    codigo_item_servicio_factura?: string; // Podría ser el código del servicio
    descripcion_item_servicio_factura: string;
    unidad_medida_item?: string;
    cantidad: number;
    valor_unitario_sin_impuestos: number;
    precio_unitario_con_impuestos?: number;
    monto_descuento_item?: number;
    subtotal_linea_sin_impuestos: number;
    porcentaje_impuesto_principal_item?: number;
    monto_impuesto_principal_item?: number;
    monto_total_linea_item: number;
    tipo_afectacion_impuesto_principal?: string; // Ej: Gravado, Exonerado, Inafecto
    centro_costo_id?: number;
}

// Interfaz para la Factura de Venta (Cabecera) (debe coincidir con el backend)
export interface FacturaVenta {
    factura_venta_id?: number;
    empresa_id_emisora?: number; // Se asignará en el controlador del backend
    cliente_id: number;
    tipo_comprobante_venta_id: number;
    serie_comprobante: string;
    numero_correlativo_comprobante?: number;
    numero_completo_comprobante?: string; // Se genera en el backend
    fecha_emision: string; // DATE en DB, string en TS para manejo fácil
    fecha_vencimiento?: string;
    moneda_id: number;
    tipo_cambio_aplicado?: number;
    condicion_pago_id?: number;
    subtotal_afecto_impuestos?: number;
    subtotal_inafecto_impuestos?: number;
    subtotal_exonerado_impuestos?: number;
    monto_descuento_global?: number;
    monto_impuesto_principal?: number;
    monto_otros_tributos?: number;
    monto_total_factura: number;
    monto_total_pagado?: number; // Actualizado por pagos
    saldo_pendiente_cobro?: number; // Calculado en DB
    estado_factura?: string; // Ej: Emitida, Pagada, Anulada
    orden_compra_cliente_referencia?: string;
    proyecto_id_referencia?: number;
    observaciones_factura?: string;
    vendedor_asignado_usuario_id?: number;
    fecha_anulacion?: string;
    usuario_anulacion_id?: number;
    motivo_anulacion?: string;
    comprobante_referencia_id?: number; // Para notas de crédito/débito

    // Campos de auditoría (se obtienen en selects, no se insertan/actualizan directamente)
    creado_por?: string;
    fecha_creacion?: string;
    modificado_por?: string;
    fecha_modificacion?: string;

    // Para la creación/actualización, incluimos los detalles
    detalles?: DetalleFacturaVenta[];

    // Campos adicionales que pueden venir de JOINs en el backend para la tabla/detalle
    cliente_razon_social?: string;
    // tipo_comprobante_abreviatura?: string; // ¡ELIMINADO AQUÍ!
    tipo_comprobante_descripcion?: string;
    moneda_nombre?: string;
    condicion_pago_descripcion?: string;
    vendedor_nombre?: string;
    servicio_nombre?: string;
    servicio_codigo?: string;
}

// Interfaz para la respuesta paginada (reutilizable)
export interface PagedFacturasResponse {
    records: FacturaVenta[];
    total_records: number;
    total_pages: number;
    current_page: number;
}

// Interfaz para filtros (reutilizable)
export interface VentaFilters {
    [key: string]: string | number | undefined;
}

const API_URL = 'http://localhost:4000/api/ventas';

const apiClient = axios.create({
    baseURL: API_URL,
});

apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('user_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Obtener facturas con paginación y filtros
export const fetchFacturasVenta = async (page: number, limit: number, filters: VentaFilters): Promise<PagedFacturasResponse> => {
    try {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
        });
        Object.keys(filters).forEach(key => {
            if (filters[key]) {
                params.append(key, String(filters[key]));
            }
        });
        const response = await apiClient.get('/', { params });
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al obtener las facturas de venta.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Obtener una factura por su ID
export const fetchFacturaVentaById = async (id: number): Promise<FacturaVenta> => {
    try {
        const response = await apiClient.get(`/${id}`);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al obtener los detalles de la factura de venta.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Crear una nueva factura de venta
export const createFacturaVenta = async (facturaData: Omit<FacturaVenta, 'factura_venta_id' | 'empresa_id_emisora' | 'numero_correlativo_comprobante' | 'numero_completo_comprobante' | 'estado_factura' | 'monto_total_pagado' | 'saldo_pendiente_cobro' | 'creado_por' | 'fecha_creacion' | 'modificado_por' | 'fecha_modificacion'>): Promise<FacturaVenta> => {
    try {
        const response = await apiClient.post('/', facturaData);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al crear la factura de venta.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Actualizar una factura de venta
export const updateFacturaVenta = async (id: number, facturaData: Partial<FacturaVenta>): Promise<FacturaVenta> => {
    try {
        const response = await apiClient.put(`/${id}`, facturaData);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al actualizar la factura de venta.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Anular una factura de venta (eliminación lógica)
export const deleteFacturaVenta = async (id: number): Promise<void> => {
    try {
        await apiClient.delete(`/${id}`);
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al anular la factura de venta.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Exportar facturas a Excel
export const exportFacturasVenta = async (filters: VentaFilters): Promise<void> => {
    try {
        const params = new URLSearchParams();
        Object.keys(filters).forEach(key => {
            if (filters[key]) {
                params.append(key, String(filters[key]));
            }
        });

        const response = await apiClient.get('/export/excel', {
            params,
            responseType: 'blob',
        });

        const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const fecha = new Date().toISOString().split('T')[0];
        saveAs(blob, `Reporte_FacturasVenta_${fecha}.xlsx`);
        showSuccessToast("La descarga de tu reporte Excel ha comenzado.");
    } catch (error) {
        showErrorAlert('Error al generar el archivo Excel de facturas.');
        console.error("Error al exportar facturas de venta:", error);
    }
};

// Descargar XML de Factura de Venta
export const downloadFacturaVentaXml = async (id: number, fileName: string): Promise<void> => {
    try {
        const response = await apiClient.get(`/${id}/download/xml`, { responseType: 'blob' });
        const blob = new Blob([response.data], { type: 'application/xml' });
        saveAs(blob, fileName);
        showSuccessToast("Descarga de XML iniciada.");
    } catch (error) {
        showErrorAlert('Error al descargar el archivo XML.');
        console.error("Error al descargar XML:", error);
    }
};

// Descargar CDR de Factura de Venta
export const downloadFacturaVentaCdr = async (id: number, fileName: string): Promise<void> => {
    try {
        const response = await apiClient.get(`/${id}/download/cdr`, { responseType: 'blob' });
        const blob = new Blob([response.data], { type: 'application/zip' }); // CDRs suelen ser ZIP
        saveAs(blob, fileName);
        showSuccessToast("Descarga de CDR iniciada.");
    } catch (error) {
        showErrorAlert('Error al descargar el archivo CDR.');
        console.error("Error al descargar CDR:", error);
    }
};

// Descargar PDF de Factura de Venta
export const downloadFacturaVentaPdf = async (id: number, fileName: string): Promise<void> => {
    try {
        const response = await apiClient.get(`/${id}/download/pdf`, { responseType: 'blob' });
        const blob = new Blob([response.data], { type: 'application/pdf' });
        saveAs(blob, fileName);
        showSuccessToast("Descarga de PDF iniciada.");
    } catch (error) {
        showErrorAlert('Error al descargar el archivo PDF.');
        console.error("Error al descargar PDF:", error);
    }
};

/**
 * Llama a la API para aplicar el saldo a favor de un cliente a una factura específica.
 * @param facturaId El ID de la factura a la que se aplicará el saldo.
 */
export const aplicarSaldoAFactura = async (facturaId: number): Promise<FacturaVenta> => {
    try {
        const response = await apiClient.post(`/${facturaId}/aplicar-saldo`);
        showSuccessToast('¡Saldo a favor aplicado con éxito!');
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al aplicar el saldo a favor.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};
