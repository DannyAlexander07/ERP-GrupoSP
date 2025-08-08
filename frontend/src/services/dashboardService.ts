// Archivo: frontend/src/services/dashboardService.ts (CORREGIDO)
import axios from 'axios';
import type { AxiosRequestHeaders } from 'axios';

// ... (Las interfaces KpiData, FlujoCajaData, ResumenAnualData y la configuración de apiClient se mantienen igual) ...
export interface KpiData {
    ventasHoy: number;
    ventasSemana: number;
    ventasMes: number;
    cuentasPorCobrar: number;
    cuentasPorPagar: number;
    nuevosClientesMes: number;
}

export interface FlujoCajaData {
    fecha: string;
    ingresos: number;
    egresos: number;
}

export interface ResumenAnualData {
    mes: number;
    ventas: number;
    compras: number;
}



export interface ResumenPrestamo {
    tipo_prestamo: 'Recibido' | 'Otorgado';
    total_principal: string; // La BD lo devuelve como string
    saldo_pendiente: string; // La BD lo devuelve como string
}

// NUEVA Interfaz para el top de deudas
export interface TopDeuda {
    proveedor: string;
    total_deuda: string; // La BD lo devuelve como string
}

const API_URL = 'http://localhost:4000/api/dashboard';
const apiClient = axios.create({ baseURL: API_URL });
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
// ... (La función fetchKpis se mantiene igual) ...
export const fetchKpis = async (): Promise<KpiData> => {
    try {
        const response = await apiClient.get('/kpis');
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al obtener los indicadores del dashboard.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};


// --- INICIO DE LA CORRECCIÓN ---

// 1. Definimos el tipo que esperamos del backend para Flujo de Caja.
//    Las consultas SQL devuelven strings para los números, por eso los definimos como string.
interface FlujoCajaApiResponseItem {
    fecha: string;
    ingresos: string;
    egresos: string;
}

// 2. Definimos el tipo que esperamos del backend para Resumen Anual.
interface ResumenAnualApiResponseItem {
    mes: number;
    ventas: string;
    compras: string;
}

// Función para obtener los datos del flujo de caja (CORREGIDA)
export const fetchFlujoCajaData = async (): Promise<FlujoCajaData[]> => {
    try {
        const response = await apiClient.get('/flujo-caja');
        // Ahora usamos el tipo específico en lugar de 'any'
        return response.data.map((item: FlujoCajaApiResponseItem) => ({
            fecha: item.fecha,
            ingresos: parseFloat(item.ingresos),
            egresos: parseFloat(item.egresos),
        }));
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al obtener los datos del flujo de caja.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Función para obtener los datos del resumen anual (CORREGIDA)
export const fetchResumenAnualData = async (anio?: number): Promise<ResumenAnualData[]> => {
    try {
        const params = anio ? { anio } : {};
        const response = await apiClient.get('/resumen-anual', { params });
        // Ahora usamos el tipo específico en lugar de 'any'
        return response.data.map((item: ResumenAnualApiResponseItem) => ({
            mes: item.mes,
            ventas: parseFloat(item.ventas),
            compras: parseFloat(item.compras),
        }));
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al obtener los datos del resumen anual.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// NUEVA Interfaz para el resumen de préstamos
export interface ResumenPrestamo {
    tipo_prestamo: 'Recibido' | 'Otorgado';
    total_principal: string; // La BD lo devuelve como string
    saldo_pendiente: string; // La BD lo devuelve como string
}

// NUEVA Interfaz para el top de deudas
export interface TopDeuda {
    proveedor: string;
    total_deuda: string; // La BD lo devuelve como string
}


// NUEVA Función para obtener el resumen de préstamos
export const fetchResumenPrestamos = async (): Promise<ResumenPrestamo[]> => {
    try {
        const response = await apiClient.get('/resumen-prestamos');
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al obtener el resumen de préstamos.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// NUEVA Función para obtener el top 5 de deudas
export const fetchTopDeudas = async (): Promise<TopDeuda[]> => {
    try {
        const response = await apiClient.get('/top-deudas');
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al obtener el top de deudas.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

export interface TopCliente {
    cliente: string;
    total_facturado: string; // La BD lo devuelve como string
}

export interface TopProveedor {
    proveedor: string;
    total_comprado: string; // La BD lo devuelve como string
}

export interface ProyectoPorEstado {
    estado: string;
    cantidad: string; // La BD lo devuelve como string
}

// Obtener datos para el gráfico de Top 5 Clientes
export const fetchTopClientes = async (anio?: number): Promise<TopCliente[]> => {
    try {
        const params = anio ? { anio } : {};
        const response = await apiClient.get('/top-clientes', { params });
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al obtener el top de clientes.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Obtener datos para el gráfico de Top 5 Proveedores
export const fetchTopProveedores = async (anio?: number): Promise<TopProveedor[]> => {
    try {
        const params = anio ? { anio } : {};
        const response = await apiClient.get('/top-proveedores', { params });
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al obtener el top de proveedores.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// Obtener datos para el gráfico de Proyectos por Estado
export const fetchProyectosPorEstado = async (): Promise<ProyectoPorEstado[]> => {
    try {
        const response = await apiClient.get('/proyectos-por-estado');
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al obtener la distribución de proyectos.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// --- ¡NUEVAS INTERFACES! ---
export interface VentaPorServicio {
    servicio: string;
    total_vendido: string; // La BD lo devuelve como string
}

// Obtener datos para el gráfico de Ventas por Servicio
export const fetchVentasPorServicio = async (anio?: number): Promise<VentaPorServicio[]> => {
    try {
        const params = anio ? { anio } : {};
        const response = await apiClient.get('/ventas-por-servicio', { params });
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al obtener las ventas por servicio.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// --- ¡NUEVA INTERFAZ! ---
export interface EstadoResultadosData {
    totalIngresos: number;
    totalGastos: number;
    utilidadNeta: number;
}


// --- ¡NUEVA FUNCIÓN! ---
/**
 * Obtiene los datos consolidados del Estado de Resultados para un período.
 * @param anio El año del período.
 * @param mes El mes del período.
 * @returns Un objeto con los totales de ingresos, gastos y la utilidad neta.
 */
// Llama al nuevo endpoint del backend para reportes contables
export const fetchEstadoResultadosData = async (anio?: number, mes?: number): Promise<EstadoResultadosData> => {
    try {
        // Construimos la URL completa para el endpoint de reportes contables
        const url = 'http://localhost:4000/api/reportes-contables/estado-resultados-cascada';
        
        const params = new URLSearchParams();
        if (anio) params.append('anio', anio.toString());
        if (mes) params.append('mes', mes.toString());
        
        // Usamos el apiClient principal, pero le pasamos la URL completa.
        // El interceptor que añade el token seguirá funcionando.
        const response = await apiClient.get(url, { params });
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al obtener los datos para el gráfico de Estado de Resultados.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};

// --- ¡NUEVA INTERFAZ! ---
export interface RentabilidadCliente {
    cliente: string;
    total_ingresos: string; // La BD lo devuelve como string
    total_costos: string;   // La BD lo devuelve como string
}

// --- ¡NUEVA FUNCIÓN! ---
export const fetchRentabilidadClientes = async (anio?: number): Promise<RentabilidadCliente[]> => {
    try {
        const params = anio ? { anio } : {};
        const response = await apiClient.get('/rentabilidad-clientes', { params });
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Error al obtener la rentabilidad por cliente.');
        }
        throw new Error('No se pudo conectar con el servidor.');
    }
};
