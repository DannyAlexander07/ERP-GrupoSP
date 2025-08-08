// Archivo: frontend/src/services/usuarioService.ts (VERSIÓN FINAL Y CORREGIDA PARA FILTROS)
import axios from 'axios';
import { showSuccessToast, showErrorAlert } from './notificationService';
import { saveAs } from 'file-saver'; 
import type { Role } from './rolService'; 

// Interfaz completa de Usuario
export interface Usuario {
    usuario_id?: number;
    nombre_usuario_login: string;
    contrasena_raw?: string; 
    
    nombres_completos_persona: string;
    apellidos_completos_persona: string;
    email_corporativo: string;
    telefono_contacto?: string;
    cargo_o_puesto?: string;
    empresa_id_predeterminada: number; 
    activo: boolean; 
    fecha_ultimo_login_exitoso?: string; 
    fecha_creacion_cuenta?: string; 
    fecha_expiracion_cuenta?: string;
    requiere_cambio_contrasena_en_login?: boolean;
    numero_intentos_fallidos_login?: number; 
    cuenta_bloqueada_hasta?: string; 
    foto_perfil_url?: string;

    usuario_creacion_id?: number;
    usuario_modificacion_id?: number;
    fecha_modificacion?: string;

    rol_ids?: number[]; 
    roles?: Role[]; 

    empresa_nombre?: string; 
    creado_por?: string; 
    modificado_por?: string; 
}

export interface PagedUsuariosResponse {
    records: Usuario[];
    total_records: number;
    total_pages: number;
    current_page: number;
}

// ¡INTERFAZ DE FILTROS CORREGIDA! (sin firma de índice genérica)
export interface UsuarioFilters {
    nombre_usuario_login?: string;
    nombres_completos_persona?: string;
    apellidos_completos_persona?: string;
    email_corporativo?: string;
    activo?: boolean;
}

const API_URL = 'http://localhost:4000/api/usuarios'; 

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

// Obtener usuarios con paginación y filtros
export const fetchUsuarios = async (page: number, limit: number, filters: UsuarioFilters): Promise<PagedUsuariosResponse> => {
    try {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
        });
        // ¡CORRECCIÓN AQUÍ! Aserción de tipo para 'key'
        Object.keys(filters).forEach(_key => {
            const key = _key as keyof UsuarioFilters; // Aserción de tipo
            const value = filters[key]; // Acceso a la propiedad con la clave asertada
            if (value !== undefined) { 
                params.append(key, String(value));
            }
        });
        const response = await apiClient.get('/', { params });
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al obtener los usuarios.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

export const fetchUsuarioById = async (id: number): Promise<Usuario> => {
    try {
        const response = await apiClient.get(`/${id}`);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al obtener los detalles del usuario.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

export const createUsuario = async (
    usuarioData: Omit<Usuario, 'usuario_id' | 'fecha_ultimo_login_exitoso' | 'fecha_creacion_cuenta' | 'numero_intentos_fallidos_login' | 'cuenta_bloqueada_hasta' | 'creado_por' | 'fecha_creacion' | 'modificado_por' | 'fecha_modificacion' | 'empresa_nombre' | 'roles' | 'usuario_creacion_id' | 'usuario_modificacion_id'> 
): Promise<Usuario> => {
    try {
        const payload = { ...usuarioData }; 
        const response = await apiClient.post('/', payload);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al crear el usuario.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

export const updateUsuario = async (
    id: number, 
    usuarioData: Partial<Omit<Usuario, 'usuario_id' | 'fecha_ultimo_login_exitoso' | 'fecha_creacion_cuenta' | 'numero_intentos_fallidos_login' | 'cuenta_bloqueada_hasta' | 'creado_por' | 'fecha_creacion' | 'modificado_por' | 'fecha_modificacion' | 'empresa_nombre' | 'roles' | 'usuario_creacion_id' | 'usuario_modificacion_id'>>
): Promise<Usuario> => {
    try {
        const payload = { ...usuarioData };
        const response = await apiClient.put(`/${id}`, payload);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al actualizar el usuario.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

export const deleteUsuario = async (id: number): Promise<void> => {
    try {
        await apiClient.delete(`/${id}`);
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al desactivar el usuario.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Exportar usuarios a Excel
export const exportUsuarios = async (filters: UsuarioFilters): Promise<void> => {
    try {
        const params = new URLSearchParams();
        // ¡CORRECCIÓN AQUÍ! Aserción de tipo para 'key'
        Object.keys(filters).forEach(_key => {
            const key = _key as keyof UsuarioFilters; // Aserción de tipo
            const value = filters[key]; // Acceso a la propiedad con la clave asertada
            if (value !== undefined) {
                params.append(key, String(value));
            }
        });

        const response = await apiClient.get('/export/excel', {
            params,
            responseType: 'blob', 
        });

        const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const fecha = new Date().toISOString().split('T')[0];
        saveAs(blob, `Reporte_Usuarios_${fecha}.xlsx`);
        showSuccessToast("La descarga de tu reporte Excel ha comenzado.");
    } catch (error) {
        showErrorAlert('Error al generar el archivo Excel de usuarios.');
        console.error("Error al exportar usuarios:", error);
    }
};

