// Archivo: frontend/src/services/prestamoService.ts (VERSIÓN DEFINITIVA CORREGIDA - ALINEACIÓN TOTAL)
import axios from 'axios';
import { showSuccessToast, showErrorAlert } from './notificationService';
import { saveAs } from 'file-saver'; 

import type { AxiosRequestHeaders } from 'axios'; 
//import type { UserData } from '../hooks/useAuth'; // Para usar UserData

export interface CuotaPrestamo {
    cuota_prestamo_id?: number;
    prestamo_id?: number; 
    numero_cuota: number;
    fecha_vencimiento_cuota: string;
    monto_capital_cuota: number;
    monto_interes_cuota: number;
    monto_seguro_desgravamen_cuota?: number;
    monto_otros_cargos_cuota?: number;
    monto_total_cuota_proyectado: number;
    estado_cuota?: string; 
    fecha_efectiva_pago_cuota?: string;
    monto_efectivamente_pagado_cuota?: number;
    obligacion_id_generada?: number;
    usuario_creacion_id?: number;
    fecha_creacion?: string;
    usuario_modificacion_id?: number;
    fecha_modificacion?: string;
    creado_por_cuota?: string; 
    modificado_por_cuota?: string; 
}

export interface Prestamo {
    prestamo_id?: number;
    empresa_id_titular: number; 
    tipo_prestamo: string; 
    codigo_contrato_prestamo?: string;
    descripcion_prestamo?: string;
    entidad_financiera_o_contraparte?: string;
    moneda_id_prestamo: number;
    monto_principal_original: number;
    tasa_interes_anual_pactada: number; 
    tipo_tasa_interes?: string; 
    fecha_desembolso_o_inicio: string;
    fecha_primera_cuota?: string;
    fecha_ultima_cuota_proyectada?: string; 
    numero_total_cuotas_pactadas: number;
    periodicidad_cuotas: string; 
    estado_prestamo?: string; 
    dia_pago_mes?: number;
    usuario_creacion_id?: number;
    fecha_creacion?: string;
    usuario_modificacion_id?: number;
    fecha_modificacion?: string;

    empresa_nombre?: string;
    moneda_nombre?: string;
    creado_por?: string; 
    modificado_por?: string; 
    cuotas?: CuotaPrestamo[]; 
}

export interface PagedPrestamosResponse {
    records: Prestamo[];
    total_records: number;
    total_pages: number;
    current_page: number;
}

export interface PrestamoFilters {
    tipo_prestamo?: string;
    estado_prestamo?: string;
    codigo_contrato_prestamo?: string;
    entidad_financiera_o_contraparte?: string;
}

const API_URL = 'http://localhost:4000/api/prestamos';

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

export const fetchPrestamos = async (page: number, limit: number, filters: PrestamoFilters): Promise<PagedPrestamosResponse> => {
    try {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
        });
        Object.keys(filters).forEach(_key => {
            const key = _key as keyof PrestamoFilters; 
            const value = filters[key];
            if (value !== undefined && value !== null) {
                params.append(key, String(value));
            }
        });
        const response = await apiClient.get('/', { params });
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al obtener los préstamos.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// ¡SOLUCIÓN 3! fetchPrestamoById ahora acepta empresaId
export const fetchPrestamoById = async (id: number, empresaId: number): Promise<Prestamo> => {
    try {
        // Asegurarse de pasar empresaId como un parámetro de consulta si es necesario para el backend
        // O si el backend lo toma del JWT, este parámetro en el frontend solo es para la firma.
        const response = await apiClient.get(`/${id}`, { params: { empresaId } }); // Pasa empresaId al backend
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al obtener los detalles del préstamo.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

export const createPrestamo = async (
    prestamoData: Omit<Prestamo, 'prestamo_id' | 'fecha_primera_cuota' | 'fecha_ultima_cuota_proyectada' | 'estado_prestamo' | 'usuario_creacion_id' | 'fecha_creacion' | 'usuario_modificacion_id' | 'fecha_modificacion' | 'empresa_nombre' | 'moneda_nombre' | 'creado_por' | 'modificado_por' | 'cuotas'>
): Promise<Prestamo> => {
    try {
        const response = await apiClient.post('/', prestamoData);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al crear el préstamo.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// ¡SOLUCIÓN 2! updatePrestamo ahora acepta usuarioId y nombreUsuario
export const updatePrestamo = async (
    id: number, 
    prestamoData: Partial<Omit<Prestamo, 'prestamo_id' | 'empresa_id_titular' | 'fecha_primera_cuota' | 'fecha_ultima_cuota_proyectada' | 'estado_prestamo' | 'usuario_creacion_id' | 'fecha_creacion' | 'usuario_modificacion_id' | 'fecha_modificacion' | 'empresa_nombre' | 'moneda_nombre' | 'creado_por' | 'modificado_por' | 'cuotas'>>,
    usuarioId: number, 
    nombreUsuario: string
): Promise<Prestamo> => {
    try {
        const response = await apiClient.put(`/${id}`, prestamoData, {
            // Puedes enviar usuarioId y nombreUsuario en los headers o body si el backend lo requiere así
            // Por ahora, asumimos que el backend los toma del JWT o los ignora si vienen en el body de una actualización
            // y que los utiliza con logAuditoria.
            headers: {
                'X-Auditoria-Usuario-Id': usuarioId.toString(),
                'X-Auditoria-Nombre-Usuario': nombreUsuario
            }
        });
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al actualizar el préstamo.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// ¡SOLUCIÓN 1! deletePrestamo ahora acepta empresaId, usuarioId, nombreUsuario
export const deletePrestamo = async (id: number, empresaId: number, usuarioId: number, nombreUsuario: string): Promise<void> => {
    try {
        await apiClient.delete(`/${id}`, {
            // Puedes enviar datos de auditoría en el body o headers si el backend los requiere así para un DELETE
            data: { empresa_id: empresaId }, // Ejemplo: si el backend requiere empresa_id en el body para DELETE
            headers: {
                'X-Auditoria-Usuario-Id': usuarioId.toString(),
                'X-Auditoria-Nombre-Usuario': nombreUsuario
            }
        });
        showSuccessToast("Préstamo desactivado con éxito."); 
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al desactivar el préstamo.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

export const exportarPrestamos = async (empresaId: number, filters: PrestamoFilters): Promise<void> => { 
    try {
        const params = new URLSearchParams();
        Object.keys(filters).forEach(_key => {
            const key = _key as keyof PrestamoFilters; 
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
        saveAs(blob, `Reporte_Prestamos_${fecha}.xlsx`);
        showSuccessToast("La descarga de tu reporte Excel ha comenzado.");
    } catch (error) {
        showErrorAlert('Error al generar el archivo Excel de préstamos.');
        console.error("Error al exportar préstamos:", error);
    }
};