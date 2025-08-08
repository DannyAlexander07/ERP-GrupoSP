// Archivo: frontend/src/services/authService.ts (CORREGIDO)

import axios from 'axios';
import { type UserData } from '../hooks/useAuth'; // Importamos la interfaz actualizada
import type { AxiosRequestHeaders } from 'axios'; // Para el interceptor

const API_URL = 'http://localhost:4000/api/auth';

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

// Interfaz para la respuesta del endpoint de login
interface LoginResponse {
    token: string;
    usuario: UserData;
}

export const loginService = async (nombre_usuario_login: string, contrasena: string): Promise<LoginResponse> => {
    try {
        const response = await axios.post(`${API_URL}/login`, {
            nombre_usuario_login,
            contrasena,
        });

        if (response.data.token) {
            localStorage.setItem('user_token', response.data.token);
        }

        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al iniciar sesión.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Función para obtener el perfil del usuario (CORREGIDA)
export const fetchUserProfile = async (): Promise<UserData> => {
    try {
        const response = await apiClient.get('/profile');
        return response.data;
    } catch (error) {
        // --- ¡CORRECCIÓN AQUÍ! ---
        // Relanzamos el error para que el AuthProvider pueda capturarlo.
        if (axios.isAxiosError(error) && error.response) {
            console.error("Error fetching profile:", error.response.data);
            throw new Error(error.response.data.message || 'La sesión ha expirado o es inválida.');
        }
        throw new Error('No se pudo conectar con el servidor para verificar la sesión.');
    }
};

