// Archivo: frontend/src/services/pagoRealizadoService.ts
import axios from 'axios';
import { showSuccessToast, showErrorAlert } from './notificationService';
import { saveAs } from 'file-saver'; // Para la descarga de archivos

// Interfaz completa de Pago Realizado (debe coincidir con el backend)
export interface PagoRealizado {
    pago_realizado_id?: number;
    empresa_id_pagadora?: number; // Se asignará en el controlador del backend
    fecha_efectiva_pago: string;
    moneda_id_pago: number;
    monto_total_desembolsado: number;
    tipo_cambio_pago?: number;
    medio_pago_utilizado: string; // Ej: Transferencia, Cheque, Efectivo
    referencia_medio_pago?: string; // Nro. de operación, Nro. de cheque
    cuenta_bancaria_propia_origen_id?: number; // Desde qué cuenta se pagó
    proveedor_id_beneficiario?: number; // A quién se pagó (si es a proveedor)
    glosa_o_descripcion_pago?: string;
    estado_pago?: string; // Ej: Realizado, Pendiente, Anulado

    // Campos de auditoría (asumiendo que vienen del backend)
    creado_por?: string;
    fecha_creacion?: string;
    modificado_por?: string;
    fecha_modificacion?: string;

    // Campos adicionales para JOINs
    moneda_nombre?: string;
    cuenta_bancaria_nombre?: string;
    proveedor_razon_social?: string;
}

// Interfaz para la respuesta paginada (reutilizable)
export interface PagedPagosRealizadosResponse {
    records: PagoRealizado[];
    total_records: number;
    total_pages: number;
    current_page: number;
}

// Interfaz para filtros (reutilizable)
export interface PagoRealizadoFilters {
    [key: string]: string | number | undefined;
}

const API_URL = 'http://localhost:4000/api/pagos-realizados';

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

// Obtener pagos realizados con paginación y filtros
export const fetchPagosRealizados = async (page: number, limit: number, filters: PagoRealizadoFilters): Promise<PagedPagosRealizadosResponse> => {
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
            throw new Error(error.response.data.message || 'Error al obtener los pagos realizados.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Obtener un pago realizado por su ID
export const fetchPagoRealizadoById = async (id: number): Promise<PagoRealizado> => {
    try {
        const response = await apiClient.get(`/${id}`);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al obtener los detalles del pago realizado.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Crear un nuevo pago realizado
export const createPagoRealizado = async (pagoData: Omit<PagoRealizado, 'pago_realizado_id' | 'empresa_id_pagadora' | 'saldo_disponible_actual' | 'fecha_ultimo_movimiento_registrado' | 'creado_por' | 'fecha_creacion' | 'modificado_por' | 'fecha_modificacion'>): Promise<PagoRealizado> => {
    try {
        const response = await apiClient.post('/', pagoData);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al crear el pago realizado.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Actualizar un pago realizado
export const updatePagoRealizado = async (id: number, pagoData: Partial<PagoRealizado>): Promise<PagoRealizado> => {
    try {
        const response = await apiClient.put(`/${id}`, pagoData);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al actualizar el pago realizado.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Eliminar (anular) un pago realizado
export const deletePagoRealizado = async (id: number): Promise<void> => {
    try {
        await apiClient.delete(`/${id}`);
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al anular el pago realizado.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Exportar pagos realizados a Excel
export const exportPagosRealizados = async (filters: PagoRealizadoFilters): Promise<void> => {
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
        saveAs(blob, `Reporte_PagosRealizados_${fecha}.xlsx`);
        showSuccessToast("La descarga de tu reporte Excel ha comenzado.");
    } catch (error) {
        showErrorAlert('Error al generar el archivo Excel de pagos realizados.');
        console.error("Error al exportar pagos realizados:", error);
    }
};
