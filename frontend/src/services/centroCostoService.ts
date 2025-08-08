// Archivo: frontend/src/services/centroCostoService.ts
import axios from 'axios';
import { showErrorAlert } from './notificationService';

// Interfaz que representa la tabla CentrosCosto (debe coincidir con el backend)
export interface CentroCosto {
    centro_costo_id: number;
    empresa_id?: number; // Se asignará en el controlador del backend
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
    // Campos de auditoría (asumiendo que vienen del backend)
    creado_por?: string;
    fecha_creacion?: string;
    modificado_por?: string;
    fecha_modificacion?: string;
}

// Interfaz para la respuesta paginada (reutilizable)
export interface PagedCentrosCostoResponse {
    records: CentroCosto[];
    total_records: number;
    total_pages: number;
    current_page: number;
}

const API_URL = 'http://localhost:4000/api/centros-costo'; // Asumiendo un endpoint para centros de costo

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
        if (axios.isAxiosError(error) && error.response) {
            showErrorAlert(error.response.data.message || 'Error al obtener centros de costo.');
        } else {
            showErrorAlert('No se pudo conectar con el servidor para obtener centros de costo.');
        }
        throw error;
    }
};

// Opcional: Funciones CRUD para CentroCosto si se necesitan en el frontend
// export const createCentroCosto = async (data: Omit<CentroCosto, 'centro_costo_id'>) => { ... };
// export const updateCentroCosto = async (id: number, data: Partial<CentroCosto>) => { ... };
// export const deleteCentroCosto = async (id: number) => { ... };
