// Archivo: frontend/src/services/planContableService.ts
import axios from 'axios';
import { showSuccessToast, showErrorAlert } from './notificationService';
import { saveAs } from 'file-saver'; // Para la descarga de archivos

// Interfaz completa de Cuenta Contable (debe coincidir con el backend)
export interface CuentaContable {
    cuenta_contable_id?: number;
    empresa_id?: number; // Se asignará en el controlador del backend
    codigo_cuenta: string;
    nombre_cuenta_contable: string;
    tipo_cuenta_general: string; // Ej: Activo, Pasivo, Patrimonio, Ingresos, Gastos
    nivel_jerarquia_cuenta: number; // Ej: 1 para cuentas de balance, 2 para subcuentas, etc.
    moneda_id_predeterminada_cuenta?: number;
    permite_movimientos_directos?: boolean;
    naturaleza_saldo_cuenta: string; // Ej: Deudor, Acreedor
    cuenta_padre_id?: number; // Referencia a otra cuenta contable (para jerarquía)
    requiere_analisis_por_centro_costo?: boolean;
    requiere_analisis_por_tercero?: boolean;
    estado_cuenta?: string; // Ej: Activa, Inactiva
    observaciones_cuenta?: string;

    // Campos de auditoría (asumiendo que vienen del backend)
    usuario_creacion_id?: number;
    fecha_creacion?: string;
    usuario_modificacion_id?: number;
    fecha_modificacion?: string;

    // Campos adicionales para JOINs
    moneda_nombre?: string;
    cuenta_padre_codigo?: string; 
    cuenta_padre_nombre?: string; 
    creado_por?: string;
    modificado_por?: string;
}

// Interfaz para la respuesta paginada (reutilizable)
export interface PagedPlanContableResponse {
    records: CuentaContable[];
    total_records: number;
    total_pages: number;
    current_page: number;
}

// Interfaz para filtros (reutilizable)
export interface PlanContableFilters {
    [key: string]: string | number | undefined;
}

const API_URL = 'http://localhost:4000/api/plan-contable';

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

// Obtener cuentas contables con paginación y filtros
export const fetchPlanContable = async (page: number, limit: number, filters: PlanContableFilters): Promise<PagedPlanContableResponse> => {
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
            throw new Error(error.response.data.message || 'Error al obtener el plan contable.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Obtener una cuenta contable por su ID
export const fetchCuentaContableById = async (id: number): Promise<CuentaContable> => {
    try {
        const response = await apiClient.get(`/${id}`);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al obtener los detalles de la cuenta contable.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Crear una nueva cuenta contable
export const createCuentaContable = async (cuentaData: Omit<CuentaContable, 'cuenta_contable_id' | 'empresa_id' | 'saldo_disponible_actual' | 'fecha_ultimo_movimiento_registrado' | 'creado_por' | 'fecha_creacion' | 'modificado_por' | 'fecha_modificacion' | 'usuario_creacion_id' | 'usuario_modificacion_id'>): Promise<CuentaContable> => {
    try {
        const response = await apiClient.post('/', cuentaData);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al crear la cuenta contable.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Actualizar una cuenta contable
export const updateCuentaContable = async (id: number, cuentaData: Partial<CuentaContable>): Promise<CuentaContable> => {
    try {
        const response = await apiClient.put(`/${id}`, cuentaData);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al actualizar la cuenta contable.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Eliminar (desactivar) una cuenta contable
export const deleteCuentaContable = async (id: number): Promise<void> => {
    try {
        await apiClient.delete(`/${id}`);
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al desactivar la cuenta contable.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Exportar plan contable a Excel
export const exportPlanContable = async (filters: PlanContableFilters): Promise<void> => {
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
        saveAs(blob, `Reporte_PlanContable_${fecha}.xlsx`);
        showSuccessToast("La descarga de tu reporte Excel ha comenzado.");
    } catch (error) {
        showErrorAlert('Error al generar el archivo Excel del plan contable.');
        console.error("Error al exportar plan contable:", error);
    }
};
