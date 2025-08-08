// Archivo: frontend/src/services/pagoRecibidoService.ts
import axios from 'axios';
import { showSuccessToast, showErrorAlert } from './notificationService';
import { saveAs } from 'file-saver'; // Para la descarga de archivos

// Interfaz completa de Pago Recibido (debe coincidir con el backend)
export interface PagoRecibido {
    pago_recibido_id?: number;
    empresa_id_receptora?: number; // Se asignará en el controlador del backend
    fecha_pago: string;
    moneda_id_pago: number;
    monto_total_pagado_cliente: number;
    tipo_cambio_pago?: number;
    medio_pago_utilizado: string; // Ej: Transferencia, Cheque, Efectivo
    referencia_medio_pago?: string; // Nro. de operación, Nro. de cheque
    cuenta_bancaria_propia_destino_id?: number; // A qué cuenta se recibió el pago
    cliente_id?: number; // De quién se recibió el pago (si es de cliente)
    glosa_o_descripcion_pago?: string;
    estado_pago?: string; // Ej: Recibido, Pendiente, Anulado

    // Campos de auditoría (asumiendo que vienen del backend)
    creado_por?: string;
    fecha_creacion?: string;
    modificado_por?: string;
    fecha_modificacion?: string;

    // Campos adicionales para JOINs
    moneda_nombre?: string;
    cuenta_bancaria_nombre?: string;
    cliente_razon_social?: string;
}

// Interfaz para la respuesta paginada (reutilizable)
export interface PagedPagosRecibidosResponse {
    records: PagoRecibido[];
    total_records: number;
    total_pages: number;
    current_page: number;
}

// Interfaz para filtros (reutilizable)
export interface PagoRecibidoFilters {
    [key: string]: string | number | undefined;
}

const API_URL = 'http://localhost:4000/api/pagos-recibidos';

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

// Obtener pagos recibidos con paginación y filtros
export const fetchPagosRecibidos = async (page: number, limit: number, filters: PagoRecibidoFilters): Promise<PagedPagosRecibidosResponse> => {
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
            throw new Error(error.response.data.message || 'Error al obtener los pagos recibidos.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Obtener un pago recibido por su ID
export const fetchPagoRecibidoById = async (id: number): Promise<PagoRecibido> => {
    try {
        const response = await apiClient.get(`/${id}`);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al obtener los detalles del pago recibido.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Crear un nuevo pago recibido
export const createPagoRecibido = async (pagoData: Omit<PagoRecibido, 'pago_recibido_id' | 'empresa_id_receptora' | 'creado_por' | 'fecha_creacion' | 'modificado_por' | 'fecha_modificacion'>): Promise<PagoRecibido> => {
    try {
        const response = await apiClient.post('/', pagoData);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al crear el pago recibido.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Actualizar un pago recibido
export const updatePagoRecibido = async (id: number, pagoData: Partial<PagoRecibido>): Promise<PagoRecibido> => {
    try {
        const response = await apiClient.put(`/${id}`, pagoData);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al actualizar el pago recibido.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Eliminar (anular) un pago recibido
export const deletePagoRecibido = async (id: number): Promise<void> => {
    try {
        await apiClient.delete(`/${id}`);
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al anular el pago recibido.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Exportar pagos recibidos a Excel
export const exportPagosRecibidos = async (filters: PagoRecibidoFilters): Promise<void> => {
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
        saveAs(blob, `Reporte_PagosRecibidos_${fecha}.xlsx`);
        showSuccessToast("La descarga de tu reporte Excel ha comenzado.");
    } catch (error) {
        showErrorAlert('Error al generar el archivo Excel de pagos recibidos.');
        console.error("Error al exportar pagos recibidos:", error);
    }
};
