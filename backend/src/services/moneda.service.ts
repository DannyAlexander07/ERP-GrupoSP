// Archivo: backend/src/services/moneda.service.ts
import pool from '../config/database'; // Se mantiene por si se añaden funciones de BD

// Interfaz que representa la tabla Monedas
export interface Moneda {
    moneda_id: number;
    codigo_moneda: string;
    nombre_moneda: string;
    simbolo_moneda?: string;
    numero_decimales?: number;
    activa?: boolean;
}

// Opcional: Función para obtener todas las monedas (si es que se necesita en algún servicio del backend)
export const getAllMonedas = async (): Promise<Moneda[]> => {
    try {
        const result = await pool.query('SELECT * FROM Monedas WHERE activa = TRUE ORDER BY nombre_moneda ASC');
        return result.rows;
    } catch (error) {
        console.error("Error al obtener monedas:", error);
        throw error;
    }
};
