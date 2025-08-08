// Archivo: frontend/src/services/asientoContableService.ts
import axios from 'axios';
import { showSuccessToast, showErrorAlert } from './notificationService';
import { saveAs } from 'file-saver'; // Para la descarga de archivos

// Interfaz para los Detalles de Asiento Contable (debe coincidir con el backend)
export interface AsientoContableDetalle {
    asiento_detalle_id?: number;
    asiento_cabecera_id?: number; 
    cuenta_contable_id: number;
    secuencia_linea_asiento: number;
    glosa_detalle_linea?: string;
    monto_debe?: number;
    monto_haber?: number;
    moneda_id_linea: number;
    importe_moneda_origen_linea?: number;
    centro_costo_id?: number;
    tipo_tercero_analisis?: string; 
    tercero_analisis_id?: number; 
    documento_referencia_linea?: string;
    fecha_documento_referencia_linea?: string;

    // ¡CAMPOS DE ANÁLISIS REQUERIDOS AÑADIDOS PARA EL FRONTEND!
    requiere_analisis_por_centro_costo?: boolean; 
    requiere_analisis_por_tercero?: boolean; 

    // Campos adicionales para JOINs
    cuenta_contable_codigo?: string;
    cuenta_contable_nombre?: string;
    moneda_nombre_linea?: string;
    centro_costo_nombre?: string;
    tercero_analisis_nombre?: string; 
}

// Interfaz para la Cabecera de Asiento Contable (debe coincidir con el backend)
export interface AsientoContableCabecera {
    asiento_cabecera_id?: number;
    empresa_id?: number; 
    periodo_contable_id: number;
    tipo_asiento_contable_id: number;
    correlativo_tipo_asiento_periodo?: number; 
    numero_asiento_completo?: string; 
    fecha_contabilizacion_asiento: string;
    moneda_id_asiento: number;
    tipo_cambio_asiento?: number;
    glosa_principal_asiento: string;
    total_debe_asiento: number;
    total_haber_asiento: number;
    estado_asiento?: string; 
    origen_documento_referencia_id?: number;
    origen_documento_tabla_referencia?: string;

    // Campos de auditoría
    usuario_creacion_id?: number;
    fecha_creacion_registro?: string; 
    usuario_modificacion_id?: number; 
    fecha_modificacion?: string; 

    // Detalles del asiento
    detalles?: AsientoContableDetalle[];

    // Campos adicionales para JOINs
    empresa_nombre?: string;
    periodo_contable_anio_mes?: string;
    tipo_asiento_descripcion?: string;
    moneda_nombre_asiento?: string;
    creado_por?: string;
    modificado_por?: string;
}

// Interfaz para la respuesta paginada (reutilizable)
export interface PagedAsientosContablesResponse {
    records: AsientoContableCabecera[];
    total_records: number;
    total_pages: number;
    current_page: number;
}

// Interfaz para filtros (reutilizable)
export interface AsientoContableFilters {
    [key: string]: string | number | undefined;
}

const API_URL = 'http://localhost:4000/api/asientos-contables';

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

// Obtener asientos contables con paginación y filtros
export const fetchAsientosContables = async (page: number, limit: number, filters: AsientoContableFilters): Promise<PagedAsientosContablesResponse> => {
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
            throw new Error(error.response.data.message || 'Error al obtener los asientos contables.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Obtener un asiento contable por su ID
export const fetchAsientoContableById = async (id: number): Promise<AsientoContableCabecera> => {
    try {
        const response = await apiClient.get(`/${id}`);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al obtener los detalles del asiento contable.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Crear un nuevo asiento contable
export const createAsientoContable = async (asientoData: Omit<AsientoContableCabecera, 'asiento_cabecera_id' | 'empresa_id' | 'correlativo_tipo_asiento_periodo' | 'numero_asiento_completo' | 'estado_asiento' | 'creado_por' | 'fecha_creacion_registro' | 'modificado_por' | 'fecha_modificacion' | 'usuario_creacion_id' | 'usuario_modificacion_id' | 'empresa_nombre' | 'periodo_contable_anio_mes' | 'tipo_asiento_descripcion' | 'moneda_nombre_asiento'>): Promise<AsientoContableCabecera> => {
    try {
        const response = await apiClient.post('/', asientoData);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al crear el asiento contable.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Actualizar un asiento contable
export const updateAsientoContable = async (id: number, asientoData: Partial<AsientoContableCabecera>): Promise<AsientoContableCabecera> => {
    try {
        const response = await apiClient.put(`/${id}`, asientoData);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al actualizar el asiento contable.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Eliminar (anular) un asiento contable
export const deleteAsientoContable = async (id: number): Promise<void> => {
    try {
        await apiClient.delete(`/${id}`);
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al anular el asiento contable.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Exportar asientos contables a Excel
export const exportAsientosContables = async (filters: AsientoContableFilters): Promise<void> => {
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
        saveAs(blob, `Reporte_AsientosContables_${fecha}.xlsx`);
        showSuccessToast("La descarga de tu reporte Excel ha comenzado.");
    } catch (error) {
        showErrorAlert('Error al generar el archivo Excel de asientos contables.');
        console.error("Error al exportar asientos contables:", error);
    }
};
