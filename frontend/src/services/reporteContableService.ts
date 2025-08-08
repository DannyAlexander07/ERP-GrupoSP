// Archivo: frontend/src/services/reporteContable.service.ts
import axios from 'axios';
import type { AxiosRequestHeaders } from 'axios';
import { showErrorAlert } from './notificationService'; // Importamos la alerta de error

// --- INTERFACES DE DATOS (versión limpia sin duplicados) ---

export interface EstadoResultados {
    ingresos: { descripcion: string; total: number }[];
    totalIngresos: number;
    gastos: { descripcion: string; total: number }[];
    totalGastos: number;
    utilidadNeta: number;
}

export interface BalanceGeneralCuenta {
    codigo: string;
    descripcion: string;
    total: number;
}

export interface BalanceGeneral {
    activos: BalanceGeneralCuenta[];
    totalActivos: number;
    pasivos: BalanceGeneralCuenta[];
    totalPasivos: number;
    patrimonio: BalanceGeneralCuenta[];
    totalPatrimonio: number;
    verificacion: number;
}


// --- CONFIGURACIÓN DE LA API ---

const API_URL = 'http://localhost:4000/api/reportes-contables';

const apiClient = axios.create({
    baseURL: API_URL,
});

// Interceptor para añadir el token a todas las peticiones
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


// --- FUNCIONES DE SERVICIO ---

/**
 * Llama a la API para generar el Estado de Resultados para un período específico.
 * @param anio El año del período.
 * @param mes El mes del período.
 */
export const fetchEstadoResultados = async (fechaInicio: string, fechaFin: string): Promise<EstadoResultados> => {
    try {
        const params = new URLSearchParams({ 
            fechaInicio, 
            fechaFin,
            // --- ¡CORRECCIÓN ANTI-CACHÉ! ---
            // Añadimos un parámetro único a la URL para forzar al navegador a hacer una nueva petición.
            _: new Date().getTime().toString() 
        });

        const response = await apiClient.get('/estado-resultados', { params });
        return response.data;
    } catch (error) {
        const message = axios.isAxiosError(error) && error.response 
            ? error.response.data.message 
            : 'Error al obtener el Estado de Resultados.';
        showErrorAlert(message);
        throw new Error(message);
    }
};

/**
 * Llama a la API para generar el Balance General a una fecha de corte.
 * @param fechaCorte La fecha en formato YYYY-MM-DD.
 */
export const fetchBalanceGeneral = async (fechaCorte: string): Promise<BalanceGeneral> => {
    try {
        const params = new URLSearchParams({ fechaCorte });
        const response = await apiClient.get('/balance-general', { params });
        return response.data;
    } catch (error) {
        const message = axios.isAxiosError(error) && error.response 
            ? error.response.data.message 
            : 'Error al obtener el Balance General.';
        showErrorAlert(message);
        throw new Error(message);
    }
};