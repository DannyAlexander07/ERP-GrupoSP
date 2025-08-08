// Archivo: frontend/src/services/empresaService.ts (ACTUALIZADO con CAMPOS DE AUDITORÍA)
import axios from 'axios';
import { showSuccessToast, showErrorAlert } from './notificationService';
import { saveAs } from 'file-saver'; // Para la descarga de archivos

// Importación para el tipo de encabezado en Axios interceptor
import type { AxiosRequestHeaders } from 'axios'; 

// Interfaz completa de Empresa (¡ACTUALIZADA CON AUDITORÍA PARA EL FRONTEND!)
export interface Empresa {
    empresa_id?: number;
    nombre_empresa: string;
    alias_empresa?: string;
    numero_identificacion_fiscal: string;
    direccion_fiscal_completa?: string;
    telefono_contacto?: string;
    email_contacto?: string;
    representante_legal_nombre?: string;
    fecha_inicio_actividades?: string; // Formato YYYY-MM-DD
    logo_url?: string;
    activa?: boolean;
    // fecha_creacion_registro: string; // Nombre original de la columna en DB, se mapea a 'fecha_creacion'
    // usuario_creacion_registro?: string; // Columna original VARCHAR, no mapeada si usamos ID

    // ¡CAMPOS DE AUDITORÍA AÑADIDOS PARA LECTURA Y ESCRITURA EN BACKEND!
    // Estos son los que el backend va a retornar en GET y puede usar para auditoría en INSERT/UPDATE
    usuario_creacion_id?: number; 
    fecha_creacion_registro?: string; // El nombre exacto de la columna en tu DB
    usuario_modificacion_id?: number;
    fecha_modificacion?: string;

    // Campos adicionales para JOINs (para mostrar nombres en el frontend)
    creado_por?: string; // Nombre del usuario creador (viene del JOIN)
    modificado_por?: string; // Nombre del usuario modificador (viene del JOIN)
}

// Interfaz para la respuesta paginada (reutilizable)
export interface PagedEmpresasResponse {
    records: Empresa[];
    total_records: number;
    total_pages: number;
    current_page: number;
}

// Interfaz para filtros (reutilizable)
export interface EmpresaFilters {
    nombre_empresa?: string;
    numero_identificacion_fiscal?: string;
    activa?: boolean;
}

const API_URL = 'http://localhost:4000/api/empresas'; // Asumiendo un endpoint para empresas

const apiClient = axios.create({
    baseURL: API_URL,
});

// Interceptor de Axios (¡CON LA CORRECCIÓN GLOBAL!)
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

// Obtener empresas con paginación y filtros
export const fetchEmpresas = async (page: number, limit: number, filters: EmpresaFilters): Promise<PagedEmpresasResponse> => {
    try {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
        });
        Object.keys(filters).forEach(_key => {
            const key = _key as keyof EmpresaFilters; 
            const value = filters[key];
            if (value !== undefined && value !== null) {
                params.append(key, String(value));
            }
        });
        const response = await apiClient.get('/', { params });
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al obtener las empresas.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Obtener una empresa por su ID
export const fetchEmpresaById = async (id: number): Promise<Empresa> => {
    try {
        const response = await apiClient.get(`/${id}`);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al obtener los detalles de la empresa.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Crear una nueva empresa
// Omitimos los campos que se generan en el backend o son de auditoría de lectura/gestión interna
export const createEmpresa = async (
    empresaData: Omit<Empresa, 'empresa_id' | 'usuario_creacion_id' | 'fecha_creacion_registro' | 'usuario_modificacion_id' | 'fecha_modificacion' | 'creado_por' | 'modificado_por'>
): Promise<Empresa> => {
    try {
        const response = await apiClient.post('/', empresaData);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al crear la empresa.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Actualizar una empresa
// Omitimos los campos de auditoría de lectura/gestión interna
export const updateEmpresa = async (
    id: number, 
    empresaData: Partial<Omit<Empresa, 'empresa_id' | 'usuario_creacion_id' | 'fecha_creacion_registro' | 'usuario_modificacion_id' | 'fecha_modificacion' | 'creado_por' | 'modificado_por'>>
): Promise<Empresa> => {
    try {
        const response = await apiClient.put(`/${id}`, empresaData);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al actualizar la empresa.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Eliminar (desactivar) una empresa
export const deleteEmpresa = async (id: number): Promise<void> => {
    try {
        await apiClient.delete(`/${id}`);
        showSuccessToast("Empresa desactivada con éxito."); // Mover notificación aquí desde el controlador si se prefiere.
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al desactivar la empresa.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Exportar empresas a Excel
export const exportEmpresas = async (filters: EmpresaFilters): Promise<void> => {
    try {
        const params = new URLSearchParams();
        Object.keys(filters).forEach(_key => {
            const key = _key as keyof EmpresaFilters; 
            const value = filters[key];
            if (value !== undefined && value !== null) {
                params.append(key, String(value));
            }
        });

        const response = await apiClient.get('/export/excel', {
            params,
            responseType: 'blob', 
        });

        const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const fecha = new Date().toISOString().split('T')[0];
        saveAs(blob, `Reporte_Empresas_${fecha}.xlsx`);
        showSuccessToast("La descarga de tu reporte Excel ha comenzado.");
    } catch (error) {
        showErrorAlert('Error al generar el archivo Excel de empresas.');
        console.error("Error al exportar empresas:", error);
    }
};