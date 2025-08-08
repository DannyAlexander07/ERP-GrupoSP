// Archivo: frontend/src/services/servicioService.ts (VERSIÓN DEFINITIVA CORREGIDA - Acepta null en ID de cuenta)
import axios from 'axios';
import { saveAs } from 'file-saver';
import { showSuccessToast, showErrorAlert } from './notificationService';

// Interfaz completa de Servicio, incluyendo campos de auditoría y campos de JOIN
export interface Servicio {
    servicio_id?: number;
    empresa_id_oferente?: number; // Se asigna en el controlador del backend
    codigo_servicio_interno: string;
    nombre_servicio: string;
    descripcion_detallada_servicio?: string;
    tipo_servicio: string;
    unidad_medida: string;
    moneda_id_precio_base: number;
    precio_base_unitario: number;
    afecto_impuesto_principal?: boolean;
    porcentaje_impuesto_aplicable?: number;
    // ¡CAMBIO CLAVE AQUÍ! Ahora acepta 'null' explícitamente
    cuenta_contable_ingreso_predeterminada_id?: number | null; 
    activo_para_venta?: boolean;

    // Campos de auditoría (vienen del backend, solo para lectura)
    creado_por?: string;
    fecha_creacion?: string;
    modificado_por?: string;
    fecha_modificacion?: string;

    // Campos adicionales para JOINs (vienen del backend, solo para visualización en el frontend)
    moneda_nombre?: string;
    cuenta_contable_codigo?: string; 
    cuenta_contable_nombre?: string;
}

// Interfaz para la respuesta paginada
export interface PagedServiciosResponse {
    records: Servicio[];
    total_records: number;
    total_pages: number;
    current_page: number;
}

const API_URL = 'http://localhost:4000/api/servicios';

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

// Obtener servicios con paginación y filtros
export const fetchServicios = async (page: number, limit: number, filters: Record<string, string>, isActive?: boolean): Promise<PagedServiciosResponse> => {
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
        if (isActive !== undefined) {
            params.append('activo_para_venta', isActive.toString());
        }

        const response = await apiClient.get('/', { params });
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al obtener los servicios.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Obtener un servicio por su ID
export const fetchServicioById = async (id: number) => {
    try {
        const response = await apiClient.get(`/${id}`);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al obtener los detalles del servicio.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Obtener el siguiente código de servicio
export const fetchNextServicioCode = async (): Promise<string> => {
    try {
        const response = await apiClient.get('/next-code');
        return response.data.codigo;
    } catch (error) {
        console.error("Error al obtener el siguiente código de servicio", error);
        return '';
    }
};

// Exportar servicios a Excel
export const exportServicios = async (filters: Record<string, string>) => {
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
        saveAs(blob, `Reporte_Servicios_${fecha}.xlsx`);
        showSuccessToast("La descarga de tu reporte ha comenzado.");
    } catch (error) {
        showErrorAlert('Error al generar el archivo Excel.');
        console.error("Error al exportar servicios:", error);
    }
};

// Crear un nuevo servicio
export const createServicio = async (servicioData: Omit<Servicio, 'servicio_id' | 'creado_por' | 'fecha_creacion' | 'modificado_por' | 'fecha_modificacion' | 'cuenta_contable_codigo' | 'cuenta_contable_nombre'>): Promise<Servicio> => {
    try {
        const response = await apiClient.post('/', servicioData);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al crear el servicio.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Actualizar un servicio
export const updateServicio = async (id: number, servicioData: Partial<Omit<Servicio, 'servicio_id' | 'creado_por' | 'fecha_creacion' | 'modificado_por' | 'fecha_modificacion' | 'cuenta_contable_codigo' | 'cuenta_contable_nombre'>>): Promise<Servicio> => {
    try {
        const response = await apiClient.put(`/${id}`, servicioData);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al actualizar el servicio.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Desactivar un servicio
export const deleteServicio = async (id: number): Promise<void> => {
    try {
        await apiClient.delete(`/${id}`);
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al desactivar el servicio.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};