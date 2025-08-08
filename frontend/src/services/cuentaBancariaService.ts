// Archivo: frontend/src/services/cuentaBancariaService.ts (ACTUALIZADO con CAMPOS DE AUDITORÍA)
import axios from 'axios';
import { showSuccessToast, showErrorAlert } from './notificationService';
import { saveAs } from 'file-saver'; // Para la descarga de archivos

// Importación para el tipo de encabezado en Axios interceptor
import type { AxiosRequestHeaders } from 'axios'; 

// Interfaz completa de Cuenta Bancaria Propia (¡ACTUALIZADA CON AUDITORÍA PARA EL FRONTEND!)
export interface CuentaBancariaPropia {
    cuenta_bancaria_id?: number;
    empresa_id?: number; // Se asignará en el controlador del backend
    moneda_id: number;
    nombre_banco: string;
    tipo_cuenta_bancaria: string; // Ej: Corriente, Ahorros
    numero_cuenta_unico: string;
    numero_cuenta_interbancario_cci?: string;
    alias_o_descripcion_cuenta?: string;
    ejecutivo_asignado_banco?: string;
    saldo_contable_inicial?: number;
    fecha_saldo_contable_inicial?: string;
    saldo_disponible_actual?: number; 
    fecha_ultimo_movimiento_registrado?: string;
    estado_cuenta_bancaria?: string; // Ej: Activa, Inactiva, Cerrada
    observaciones_cuenta?: string;
    
    // ¡CAMPOS DE AUDITORÍA AÑADIDOS PARA LECTURA EN EL FRONTEND!
    usuario_creacion_id?: number;
    fecha_creacion?: string; // Este es el que viene mapeado del backend
    usuario_modificacion_id?: number;
    fecha_modificacion?: string;

    // Campos adicionales para JOINs (para mostrar nombres en el frontend)
    moneda_nombre?: string; // Nombre de la moneda
    creado_por?: string; // Nombre del usuario creador (viene del JOIN)
    modificado_por?: string; // Nombre del usuario modificador (viene del JOIN)
}

// Interfaz para la respuesta paginada (reutilizable)
export interface PagedCuentasBancariasResponse {
    records: CuentaBancariaPropia[];
    total_records: number;
    total_pages: number;
    current_page: number;
}

// Interfaz para filtros (reutilizable)
export interface CuentaBancariaFilters {
    nombre_banco?: string;
    numero_cuenta_unico?: string; 
    estado_cuenta_bancaria?: string;
}

const API_URL = 'http://localhost:4000/api/cuentas-bancarias';

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

// Obtener cuentas bancarias con paginación y filtros
export const fetchCuentasBancarias = async (page: number, limit: number, filters: CuentaBancariaFilters): Promise<PagedCuentasBancariasResponse> => {
    try {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
        });
        Object.keys(filters).forEach(_key => {
            const key = _key as keyof CuentaBancariaFilters; 
            const value = filters[key];
            if (value !== undefined && value !== null) {
                params.append(key, String(value));
            }
        });
        const response = await apiClient.get('/', { params });
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al obtener las cuentas bancarias.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Obtener una cuenta bancaria por su ID
export const fetchCuentaBancariaById = async (id: number): Promise<CuentaBancariaPropia> => {
    try {
        const response = await apiClient.get(`/${id}`);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al obtener los detalles de la cuenta bancaria.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Crear una nueva cuenta bancaria (¡FUNCIÓN ACTUALIZADA EN OMITS!)
// Omitimos los campos que se generan en el backend o son de auditoría de lectura/gestión interna
export const createCuentaBancaria = async (
    cuentaData: Omit<CuentaBancariaPropia, 'cuenta_bancaria_id' | 'empresa_id' | 'saldo_disponible_actual' | 'fecha_ultimo_movimiento_registrado' | 'usuario_creacion_id' | 'fecha_creacion' | 'usuario_modificacion_id' | 'fecha_modificacion' | 'moneda_nombre' | 'creado_por' | 'modificado_por'>
): Promise<CuentaBancariaPropia> => {
    try {
        const response = await apiClient.post('/', cuentaData);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al crear la cuenta bancaria.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Actualizar una cuenta bancaria (¡FUNCIÓN ACTUALIZADA EN OMITS!)
// Omitimos los campos de auditoría de lectura/gestión interna
export const updateCuentaBancaria = async (
    id: number, 
    cuentaData: Partial<Omit<CuentaBancariaPropia, 'cuenta_bancaria_id' | 'empresa_id' | 'saldo_disponible_actual' | 'fecha_ultimo_movimiento_registrado' | 'usuario_creacion_id' | 'fecha_creacion' | 'usuario_modificacion_id' | 'fecha_modificacion' | 'moneda_nombre' | 'creado_por' | 'modificado_por'>>
): Promise<CuentaBancariaPropia> => {
    try {
        const response = await apiClient.put(`/${id}`, cuentaData);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al actualizar la cuenta bancaria.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Eliminar (desactivar) una cuenta bancaria
export const deleteCuentaBancaria = async (id: number): Promise<void> => {
    try {
        await apiClient.delete(`/${id}`);
        showSuccessToast("Cuenta bancaria desactivada con éxito."); // Mover notificación aquí desde el controlador si se prefiere.
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al desactivar la cuenta bancaria.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Exportar cuentas bancarias a Excel
export const exportarCuentasBancarias = async (empresaId: number, filters: CuentaBancariaFilters): Promise<void> => { 
    try {
        const params = new URLSearchParams();
        Object.keys(filters).forEach(_key => {
            const key = _key as keyof CuentaBancariaFilters; 
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
        saveAs(blob, `Reporte_CuentasBancarias_${fecha}.xlsx`);
        showSuccessToast("La descarga de tu reporte Excel ha comenzado.");
    } catch (error) {
        showErrorAlert('Error al generar el archivo Excel de cuentas bancarias.');
        console.error("Error al exportar cuentas bancarias:", error);
    }
};