// Archivo: frontend/src/services/compraService.ts
import axios from 'axios';
import { showSuccessToast, showErrorAlert } from './notificationService';
import { saveAs } from 'file-saver'; // Para la descarga de archivos

// Interfaz para los Detalles de Factura de Compra (debe coincidir con DetallesObligacion y el mapeo del backend)
export interface DetalleFacturaCompra {
    detalle_factura_compra_id?: number; // Mapea a detalle_obligacion_id
    factura_compra_id?: number; // Mapea a obligacion_id
    descripcion_item_gasto: string; 
    cantidad?: number;
    valor_unitario_gasto?: number;
    monto_total_item_gasto: number;
    centro_costo_id?: number;
    proyecto_id_referencia?: number;
}

// Interfaz para la Factura de Compra (Cabecera) (debe coincidir con Obligaciones y el mapeo del backend)
export interface FacturaCompra {
    factura_compra_id?: number; // Mapea a obligacion_id
    empresa_id_compradora?: number; // Mapea a empresa_id_deudora
    proveedor_id: number;
    tipo_comprobante_compra_id: number;
    tipo_obligacion_principal: string; 
    descripcion_general_compra: string; // Mapea a descripcion_general_obligacion
    numero_documento_proveedor?: string; 
    fecha_emision_documento_proveedor?: string; 
    fecha_recepcion_documento: string; 
    fecha_vencimiento_original: string;
    fecha_programada_pago?: string;
    moneda_id_obligacion: number;
    monto_total_original_obligacion: number;
    monto_detraccion?: number;
    monto_retencion_impuestos?: number;
    monto_neto_a_pagar_calculado?: number; 
    monto_total_pagado?: number; 
    saldo_pendiente_pago?: number; 
    estado_factura_compra?: string; // Mapea a estado_obligacion
    observaciones_compra?: string; // Mapea a observaciones_obligacion
    prioridad_pago?: number; 

    // ¡CAMPOS DE AUDITORÍA ELIMINADOS DE LA INTERFAZ!
    // No existen en tu tabla 'Obligaciones' ni se mapean en el servicio del backend.
    // creado_por?: string;
    // fecha_creacion?: string;
    // modificado_por?: string;
    // fecha_modificacion?: string;

    // Para la creación/actualización, incluimos los detalles
    detalles?: DetalleFacturaCompra[];

    // Campos adicionales que pueden venir de JOINs en el backend para la tabla/detalle
    proveedor_razon_social?: string;
    tipo_comprobante_descripcion?: string;
    moneda_nombre?: string;
}

// Interfaz para la respuesta paginada (reutilizable)
export interface PagedFacturasCompraResponse {
    records: FacturaCompra[];
    total_records: number;
    total_pages: number;
    current_page: number;
}

// Interfaz para filtros (reutilizable)
export interface CompraFilters {
    [key: string]: string | number | undefined;
}

const API_URL = 'http://localhost:4000/api/compras';

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

// Obtener facturas de compra con paginación y filtros
export const fetchFacturasCompra = async (page: number, limit: number, filters: CompraFilters): Promise<PagedFacturasCompraResponse> => {
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
            throw new Error(error.response.data.message || 'Error al obtener las facturas de compra.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Obtener una factura de compra por su ID
export const fetchFacturaCompraById = async (id: number): Promise<FacturaCompra> => {
    try {
        const response = await apiClient.get(`/${id}`);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al obtener los detalles de la factura de compra.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Crear una nueva factura de compra
export const createFacturaCompra = async (facturaData: Omit<FacturaCompra, 'factura_compra_id' | 'empresa_id_compradora' | 'monto_neto_a_pagar_calculado' | 'monto_total_pagado' | 'saldo_pendiente_pago' | 'estado_factura_compra' | 'creado_por' | 'fecha_creacion' | 'modificado_por' | 'fecha_modificacion'>): Promise<FacturaCompra> => {
    try {
        const response = await apiClient.post('/', facturaData);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al crear la factura de compra.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Actualizar una factura de compra
export const updateFacturaCompra = async (id: number, facturaData: Partial<FacturaCompra>): Promise<FacturaCompra> => {
    try {
        const response = await apiClient.put(`/${id}`, facturaData);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al actualizar la factura de compra.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Anular una factura de compra (eliminación lógica)
export const deleteFacturaCompra = async (id: number): Promise<void> => {
    try {
        await apiClient.delete(`/${id}`);
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al anular la factura de compra.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Exportar facturas de compra a Excel
export const exportFacturasCompra = async (filters: CompraFilters): Promise<void> => {
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
        saveAs(blob, `Reporte_FacturasCompra_${fecha}.xlsx`);
        showSuccessToast("La descarga de tu reporte Excel ha comenzado.");
    } catch (error) {
        showErrorAlert('Error al generar el archivo Excel de facturas de compra.');
        console.error("Error al exportar facturas de compra:", error);
    }
};
