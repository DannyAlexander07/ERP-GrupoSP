// Archivo: frontend/src/services/proyectoService.ts
import axios from 'axios';
import { showSuccessToast, showErrorAlert } from './notificationService';
import { saveAs } from 'file-saver'; // Para la descarga de archivos

// Interfaz completa de Proyecto (debe coincidir con el backend)
export interface Proyecto {
    proyecto_id?: number;
    empresa_id_responsable?: number; // Se asignará en el controlador del backend
    cliente_id: number;
    nombre_proyecto_campaña: string;
    codigo_proyecto_interno?: string;
    descripcion_proyecto?: string;
    tipo_proyecto?: string; 
    fecha_inicio_proyectada?: string;
    fecha_fin_proyectada?: string;
    fecha_inicio_real?: string;
    fecha_fin_real?: string;
    moneda_id_presupuesto?: number;
    monto_presupuestado_ingresos?: number;
    monto_presupuestado_costos?: number;
    usuario_id_responsable_proyecto?: number;
    estado_proyecto?: string; 
    centro_costo_id_asociado?: number;

    // Campos de auditoría (asumiendo que vienen del backend)
    usuario_creacion_id?: number;
    fecha_creacion?: string;
    usuario_modificacion_id?: number;
    fecha_modificacion?: string;

    // Campos adicionales para JOINs
    cliente_razon_social?: string;
    moneda_nombre?: string;
    usuario_responsable_nombre?: string;
    centro_costo_nombre?: string;
    creado_por?: string;
    modificado_por?: string;
}

// Interfaz para la respuesta paginada (reutilizable)
export interface PagedProyectosResponse {
    records: Proyecto[];
    total_records: number;
    total_pages: number;
    current_page: number;
}

// Interfaz para filtros (reutilizable)
export interface ProyectoFilters {
    [key: string]: string | number | undefined;
}

const API_URL = 'http://localhost:4000/api/proyectos';

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

// Obtener proyectos con paginación y filtros
export const fetchProyectos = async (page: number, limit: number, filters: ProyectoFilters): Promise<PagedProyectosResponse> => {
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
            throw new Error(error.response.data.message || 'Error al obtener los proyectos.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Obtener un proyecto por su ID
export const fetchProyectoById = async (id: number): Promise<Proyecto> => {
    try {
        const response = await apiClient.get(`/${id}`);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al obtener los detalles del proyecto.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Crear un nuevo proyecto
export const createProyecto = async (proyectoData: Omit<Proyecto, 'proyecto_id' | 'empresa_id_responsable' | 'creado_por' | 'fecha_creacion' | 'modificado_por' | 'fecha_modificacion' | 'usuario_creacion_id' | 'usuario_modificacion_id'>): Promise<Proyecto> => {
    try {
        const response = await apiClient.post('/', proyectoData);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al crear el proyecto.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// NUEVA FUNCIÓN para obtener el siguiente código de proyecto
export const fetchNextProyectoCode = async (): Promise<string> => {
    try {
        const response = await apiClient.get('/next-code');
        return response.data.codigo;
    } catch (error) {
        console.error("Error al obtener el siguiente código de proyecto", error);
        // Devolvemos una cadena vacía en caso de error para no romper el formulario
        return '';
    }
};

// Actualizar un proyecto
export const updateProyecto = async (id: number, proyectoData: Partial<Proyecto>): Promise<Proyecto> => {
    try {
        const response = await apiClient.put(`/${id}`, proyectoData);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al actualizar el proyecto.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Eliminar (desactivar) un proyecto
export const deleteProyecto = async (id: number): Promise<void> => {
    try {
        await apiClient.delete(`/${id}`);
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al desactivar el proyecto.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Exportar proyectos a Excel
export const exportProyectos = async (filters: ProyectoFilters): Promise<void> => {
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
        saveAs(blob, `Reporte_Proyectos_${fecha}.xlsx`);
        showSuccessToast("La descarga de tu reporte Excel ha comenzado.");
    } catch (error) {
        showErrorAlert('Error al generar el archivo Excel de proyectos.');
        console.error("Error al exportar proyectos:", error);
    }
};
