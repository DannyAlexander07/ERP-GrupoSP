// Archivo: frontend/src/services/monedaService.ts
import axios from 'axios';
import { showErrorAlert } from './notificationService';

// Interfaz que representa la tabla Monedas (debe coincidir con el backend)
export interface Moneda {
    moneda_id: number;
    codigo_moneda: string;
    nombre_moneda: string;
    simbolo_moneda?: string;
    numero_decimales?: number;
    activa?: boolean;
}

const API_URL = 'http://localhost:4000/api/monedas'; // Asumiendo que tienes un endpoint para monedas

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

// Función para obtener todas las monedas activas
export const fetchAllMonedas = async (): Promise<Moneda[]> => {
    try {
        // Asumiendo que tu backend tiene un endpoint para obtener todas las monedas sin paginación
        // O podrías usar el endpoint paginado con un límite muy alto
        const response = await apiClient.get('/all'); // Asumiendo /api/monedas/all o similar
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            showErrorAlert(error.response.data.message || 'Error al obtener las monedas.');
        } else {
            showErrorAlert('No se pudo conectar con el servidor para obtener monedas.');
        }
        throw error;
    }
};
