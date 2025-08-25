import axios from 'axios';
import { showErrorAlert } from './notificationService';
import type { AxiosRequestHeaders } from 'axios';

// Interfaz que representa la tabla CentrosCosto (debe coincidir con el backend)
export interface CentroCosto {
    centro_costo_id: number;
    empresa_id?: number;
    codigo_centro_costo: string;
    nombre_centro_costo: string;
    descripcion_centro_costo?: string;
    responsable_usuario_id?: number;
    tipo_centro_costo?: string;
    centro_costo_padre_id?: number;
    fecha_inicio_vigencia?: string;
    fecha_fin_vigencia?: string;
    presupuesto_asignado?: number;
    estado?: string;
    creado_por?: string;
    fecha_creacion?: string;
    modificado_por?: string;
    fecha_modificacion?: string;
}

// Interfaz para la respuesta paginada
export interface PagedCentrosCostoResponse {
    records: CentroCosto[];
    total_records: number;
    total_pages: number;
    current_page: number;
}

const API_URL = 'http://localhost:4000/api/centros-costo';

const apiClient = axios.create({
    baseURL: API_URL,
});

apiClient.interceptors.request.use((config) => {
    if (!config.headers) {
        config.headers = {} as AxiosRequestHeaders;
    }
    const token = localStorage.getItem('user_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Función para obtener todos los centros de costo con paginación y filtros
export const fetchCentrosCosto = async (page: number, limit: number, filters: Record<string, string>): Promise<PagedCentrosCostoResponse> => {
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
        // Extraemos el mensaje de error y lo mostramos al usuario con la alerta.
        const message = axios.isAxiosError(error) && error.response 
            ? error.response.data.message 
            : 'Error al obtener los centros de costo.';
        
        showErrorAlert(message); 
        
        throw new Error(message); // Relanzamos el error para que el componente también lo sepa
    }
};

// --- ¡NUEVAS FUNCIONES AÑADIDAS! ---

// Obtener un centro de costo por su ID
export const fetchCentroCostoById = async (id: number): Promise<CentroCosto> => {
    try {
        const response = await apiClient.get(`/${id}`);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al obtener los detalles del centro de costo.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Crear un nuevo centro de costo
export const createCentroCosto = async (data: Partial<Omit<CentroCosto, 'centro_costo_id'>>): Promise<CentroCosto> => {
    try {
        const response = await apiClient.post('/', data);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al crear el centro de costo.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Actualizar un centro de costo
export const updateCentroCosto = async (id: number, data: Partial<CentroCosto>): Promise<CentroCosto> => {
    try {
        const response = await apiClient.put(`/${id}`, data);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al actualizar el centro de costo.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Desactivar (eliminar lógicamente) un centro de costo
export const deleteCentroCosto = async (id: number): Promise<void> => {
    try {
        await apiClient.delete(`/${id}`);
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al desactivar el centro de costo.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};