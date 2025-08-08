// Archivo: frontend/src/services/clienteService.ts (VERSIÓN COMPLETA CON CCI CLIENTE)
import axios from 'axios';
import { showSuccessToast, showErrorAlert } from './notificationService'

// Interfaz actualizada con todos los campos de la base de datos
export interface Cliente {
    cliente_id?: number;
    codigo_cliente_interno?: string;
    razon_social_o_nombres: string;
    nombre_comercial?: string;
    tipo_documento_identidad: string;
    numero_documento_identidad: string;
    direccion_fiscal_completa?: string;
    email_principal_facturacion?: string;
    telefono_principal?: string;
    estado_cliente?: string;
    // --- CAMPOS YA EXISTENTES ---
    condicion_pago_id_predeterminada?: number;
    moneda_id_predeterminada?: number;
    linea_credito_aprobada?: number;
    contacto_principal_nombre?: string;
    contacto_principal_cargo?: string;
    contacto_principal_email?: string;
    contacto_principal_telefono?: string;
    sector_industrial?: string;
    observaciones_generales?: string;
    // --- CAMPOS DE AUDITORÍA ---
    creado_por?: string;
    fecha_creacion?: string;
    modificado_por?: string;
    fecha_modificacion?: string;
}


const API_URL = 'http://localhost:4000/api/clientes';

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


export const fetchClienteById = async (id: number) => {
    try {
        const response = await apiClient.get(`/${id}`);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al obtener los detalles del cliente.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

export interface ClienteFilters {
    [key: string]: string | number | undefined;
}

export const fetchClientes = async (page: number, limit: number, filters: ClienteFilters) => {
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
            throw new Error(error.response.data.message || 'Error al obtener los clientes.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// --- NUEVA FUNCIÓN PARA EXPORTAR ---
export const exportClientes = async (filters: ClienteFilters) => {
    try {
        const params = new URLSearchParams();
        Object.keys(filters).forEach(key => {
            if (filters[key]) {
                params.append(key, String(filters[key]));
            }
        });

        const response = await apiClient.get('/export', {
            params,
            responseType: 'blob', // ¡Importante! Le decimos a Axios que espere un archivo.
        });

        // Creamos una URL temporal para el archivo recibido
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        
        // Le damos un nombre al archivo
        const fecha = new Date().toISOString().split('T')[0];
        link.setAttribute('download', `Reporte_Clientes_${fecha}.xlsx`);
        
        // Simulamos un clic en el enlace para iniciar la descarga
        document.body.appendChild(link);
        link.click();

        // Limpiamos
        link.parentNode?.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        showSuccessToast("La descarga de tu reporte ha comenzado.");

    } catch (error) {
        showErrorAlert('Error al generar el archivo Excel.');
        console.error("Error al exportar clientes:", error);
    }
};

// Se mantiene la función para el código autogenerado
export const fetchNextClienteCode = async (): Promise<string> => {
    try {
        const response = await apiClient.get('/next-code');
        return response.data.codigo;
    } catch (error) {
        console.error("Error al obtener el siguiente código de cliente", error);
        return '';
    }
};

export const createCliente = async (clienteData: Omit<Cliente, 'cliente_id'>) => {
    try {
        const response = await apiClient.post('/', clienteData);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al crear el cliente.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

export const updateCliente = async (id: number, clienteData: Partial<Cliente>) => {
    try {
        const response = await apiClient.put(`/${id}`, clienteData);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al actualizar el cliente.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

export const deleteCliente = async (id: number) => {
    try {
        await apiClient.delete(`/${id}`);
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al eliminar el cliente.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};
