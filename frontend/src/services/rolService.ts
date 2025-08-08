// Archivo: frontend/src/services/rolService.ts
import axios from 'axios';
import { showSuccessToast, showErrorAlert } from './notificationService';
import { saveAs } from 'file-saver'; // Para la descarga de archivos

// Interfaz para el Role (debe coincidir con el backend Role interface)
export interface Role {
    rol_id?: number;
    nombre_rol: string;
    descripcion_detallada_rol?: string;
    activo?: boolean;
    es_rol_sistema?: boolean; // Booleano para indicar si es un rol de sistema
    // Campos de auditoría (solo para lectura, vienen del backend)
    creado_por?: string;
    fecha_creacion?: string;
    modificado_por?: string;
    fecha_modificacion?: string;
}

// Interfaz para la respuesta paginada (reutilizable)
export interface PagedRolesResponse {
    records: Role[];
    total_records: number;
    total_pages: number;
    current_page: number;
}

// Interfaz para filtros (reutilizable)
export interface RoleFilters {
    [key: string]: string | boolean | undefined; // Permitir boolean para 'activo'
}

const API_URL = 'http://localhost:4000/api/roles'; // Asumiendo un endpoint para roles

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

// Obtener roles con paginación y filtros
export const fetchRoles = async (page: number, limit: number, filters: RoleFilters): Promise<PagedRolesResponse> => {
    try {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
        });
        Object.keys(filters).forEach(key => {
            if (filters[key] !== undefined) { 
                params.append(key, String(filters[key]));
            }
        });
        const response = await apiClient.get('/', { params });
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al obtener los roles.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Obtener un rol por su ID
export const fetchRoleById = async (id: number): Promise<Role> => {
    try {
        const response = await apiClient.get(`/${id}`);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al obtener los detalles del rol.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Crear un nuevo rol
export const createRole = async (roleData: Omit<Role, 'rol_id' | 'creado_por' | 'fecha_creacion' | 'modificado_por' | 'fecha_modificacion'>): Promise<Role> => {
    try {
        const response = await apiClient.post('/', roleData);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al crear el rol.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Actualizar un rol
export const updateRole = async (id: number, roleData: Partial<Omit<Role, 'rol_id' | 'creado_por' | 'fecha_creacion' | 'modificado_por' | 'fecha_modificacion'>>): Promise<Role> => {
    try {
        const response = await apiClient.put(`/${id}`, roleData);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al actualizar el rol.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Eliminar (desactivar) un rol
export const deleteRole = async (id: number): Promise<void> => {
    try {
        await apiClient.delete(`/${id}`);
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al desactivar el rol.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Exportar roles a Excel
export const exportRoles = async (filters: RoleFilters): Promise<void> => {
    try {
        const params = new URLSearchParams();
        Object.keys(filters).forEach(key => {
            if (filters[key] !== undefined) {
                params.append(key, String(filters[key]));
            }
        });

        const response = await apiClient.get('/export/excel', {
            params,
            responseType: 'blob', // Esperamos una respuesta binaria (archivo)
        });

        const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const fecha = new Date().toISOString().split('T')[0];
        saveAs(blob, `Reporte_Roles_${fecha}.xlsx`);
        showSuccessToast("La descarga de tu reporte Excel ha comenzado.");
    } catch (error) {
        showErrorAlert('Error al generar el archivo Excel de roles.');
        console.error("Error al exportar roles:", error);
    }
};