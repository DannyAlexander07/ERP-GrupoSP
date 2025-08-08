// Archivo: frontend/src/services/proveedorService.ts (ACTUALIZADO CON CCI)
import axios from 'axios';
import { saveAs } from 'file-saver';
import { showSuccessToast, showErrorAlert } from './notificationService';

// Interfaz completa de Proveedor, incluyendo todos los campos de la BD y de auditoría
export interface Proveedor {
    proveedor_id?: number;
    codigo_proveedor_interno?: string;
    razon_social_o_nombres: string;
    nombre_comercial?: string;
    tipo_documento_identidad: string;
    numero_documento_identidad: string;
    direccion_fiscal_completa?: string;
    email_principal_pagos?: string;
    telefono_principal?: string;
    estado_proveedor?: string;
    condicion_pago_id_predeterminada?: number;
    moneda_id_predeterminada?: number;
    contacto_principal_nombre?: string;
    banco_predeterminado_proveedor?: string;
    numero_cuenta_proveedor?: string;
    // ¡NUEVO CAMPO!
    codigo_cuenta_interbancaria_proveedor?: string; 
    tipo_servicio_principal_proveedor?: string;
    observaciones_generales?: string;
    es_agente_retencion_igv?: boolean;
    requiere_pago_detraccion?: boolean;
    // Campos de auditoría que vienen del backend
    creado_por?: string;
    fecha_creacion?: string;
    modificado_por?: string;
    fecha_modificacion?: string;
}

// Interfaz para la respuesta paginada (AÑADIDA PARA MEJOR TIPADO)
export interface PagedProveedoresResponse {
    records: Proveedor[];
    total_records: number;
    total_pages: number;
    current_page: number;
}

const API_URL = 'http://localhost:4000/api/proveedores';

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

// Obtener proveedores con paginación y filtros (ACTUALIZADO CON TIPO DE RETORNO)
export const fetchProveedores = async (page: number, limit: number, filters: Record<string, string>): Promise<PagedProveedoresResponse> => {
    try {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
        });
        Object.keys(filters).forEach(key => {
            if (filters[key]) {
                params.append(key, filters[key]);
            }
        });
        const response = await apiClient.get('/', { params });
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al obtener los proveedores.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Obtener un proveedor por su ID
export const fetchProveedorById = async (id: number) => {
    try {
        const response = await apiClient.get(`/${id}`);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al obtener los detalles del proveedor.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Obtener el siguiente código de proveedor
export const fetchNextProveedorCode = async (): Promise<string> => {
    try {
        const response = await apiClient.get('/next-code');
        return response.data.codigo;
    } catch (error) {
        console.error("Error al obtener el siguiente código de proveedor", error);
        return '';
    }
};

// Exportar proveedores a Excel
export const exportProveedores = async (filters: Record<string, string>) => {
    try {
        const params = new URLSearchParams();
        Object.keys(filters).forEach(key => {
            if (filters[key]) {
                params.append(key, filters[key]);
            }
        });
        const response = await apiClient.get('/export', {
            params,
            responseType: 'blob',
        });
        const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const fecha = new Date().toISOString().split('T')[0];
        saveAs(blob, `Reporte_Proveedores_${fecha}.xlsx`);
        showSuccessToast("La descarga de tu reporte ha comenzado.");
    } catch (error) {
        showErrorAlert('Error al generar el archivo Excel.');
        console.error("Error al exportar proveedores:", error);
    }
};

// Crear un nuevo proveedor
export const createProveedor = async (proveedorData: Omit<Proveedor, 'proveedor_id'>) => {
    try {
        const response = await apiClient.post('/', proveedorData);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al crear el proveedor.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Actualizar un proveedor
export const updateProveedor = async (id: number, proveedorData: Partial<Proveedor>) => {
    try {
        const response = await apiClient.put(`/${id}`, proveedorData);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al actualizar el proveedor.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Eliminar un proveedor
export const deleteProveedor = async (id: number) => {
    try {
        await apiClient.delete(`/${id}`);
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al eliminar el proveedor.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};