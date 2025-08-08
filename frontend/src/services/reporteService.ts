import axios from 'axios';
import { saveAs } from 'file-saver';
import { showErrorAlert, showSuccessToast } from './notificationService';
import type { AxiosRequestHeaders } from 'axios';

// --- INTERFACES PARA REPORTES CONTABLES ---
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

// --- CONFIGURACIÓN DE API UNIFICADA ---
// Cliente genérico que usaremos para todas las llamadas
const apiClient = axios.create(); 

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

// --- FUNCIONES PARA LIBROS ELECTRÓNICOS (PLE) ---

export const descargarPleCompras = async (anio: number, mes: number): Promise<void> => {
    const API_URL_PLE = 'http://localhost:4000/api/reportes';
    try {
        const params = new URLSearchParams({ anio: anio.toString(), mes: mes.toString() });
        const response = await apiClient.get(`${API_URL_PLE}/ple/compras`, {
            params,
            responseType: 'blob',
        });

        const contentDisposition = response.headers['content-disposition'];
        let fileName = `ple_compras_${anio}_${mes}.txt`;
        if (contentDisposition) {
            const fileNameMatch = contentDisposition.match(/filename="(.+)"/);
            if (fileNameMatch && fileNameMatch.length > 1) {
                fileName = fileNameMatch[1];
            }
        }
        const blob = new Blob([response.data], { type: 'text/plain;charset=utf-8' });
        saveAs(blob, fileName);
        showSuccessToast('La descarga del PLE de Compras ha comenzado.');
    } catch (error) {
        showErrorAlert('Error al generar el reporte de compras.');
        console.error("Error al descargar el PLE de Compras:", error);
    }
};

export const descargarPleVentas = async (anio: number, mes: number): Promise<void> => {
    const API_URL_PLE = 'http://localhost:4000/api/reportes';
    try {
        const params = new URLSearchParams({ anio: anio.toString(), mes: mes.toString() });
        const response = await apiClient.get(`${API_URL_PLE}/ple/ventas`, {
            params,
            responseType: 'blob',
        });

        const contentDisposition = response.headers['content-disposition'];
        let fileName = `ple_ventas_${anio}_${mes}.txt`;
        if (contentDisposition) {
            const fileNameMatch = contentDisposition.match(/filename="(.+)"/);
            if (fileNameMatch && fileNameMatch.length > 1) {
                fileName = fileNameMatch[1];
            }
        }
        const blob = new Blob([response.data], { type: 'text/plain;charset=utf-8' });
        saveAs(blob, fileName);
        showSuccessToast('La descarga del PLE de Ventas ha comenzado.');
    } catch (error) {
        showErrorAlert('Error al generar el reporte de ventas.');
        console.error("Error al descargar el PLE de Ventas:", error);
    }
};


// --- FUNCIONES PARA REPORTES CONTABLES ---
const API_URL_CONTABLE = 'http://localhost:4000/api/reportes-contables';

export const fetchEstadoResultados = async (anio: number, mes: number): Promise<EstadoResultados> => {
    try {
        const params = new URLSearchParams({ anio: anio.toString(), mes: mes.toString() });
        const response = await apiClient.get(`${API_URL_CONTABLE}/estado-resultados`, { params });
        return response.data;
    } catch (error) {
        const message = axios.isAxiosError(error) && error.response ? error.response.data.message : 'Error al obtener el Estado de Resultados.';
        showErrorAlert(message);
        throw new Error(message);
    }
};

export const fetchBalanceGeneral = async (fechaCorte: string): Promise<BalanceGeneral> => {
    try {
        const params = new URLSearchParams({ fechaCorte });
        const response = await apiClient.get(`${API_URL_CONTABLE}/balance-general`, { params });
        return response.data;
    } catch (error) {
        const message = axios.isAxiosError(error) && error.response ? error.response.data.message : 'Error al obtener el Balance General.';
        showErrorAlert(message);
        throw new Error(message);
    }
};