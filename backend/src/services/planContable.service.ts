// Archivo: backend/src/services/planContable.service.ts (VERSIÓN FINAL Y CONSOLIDADA - CORREGIDO DE ERRORES)
import pool from '../config/database';
import { logAuditoria } from './auditoria.service';

import axios, { AxiosRequestConfig, AxiosError } from 'axios'; 
import type { AxiosRequestHeaders } from 'axios'; 
import type { Moneda } from './moneda.service';
import type { Usuario } from './usuario.service';

// Interfaz para la respuesta paginada (reutilizable)
export interface PagedResult<T> {
    records: T[];
    total_records: number;
    total_pages: number;
    current_page: number;
}

// Interfaz completa de Cuenta Contable
export interface CuentaContable {
    cuenta_contable_id?: number;
    empresa_id: number;
    codigo_cuenta: string;
    nombre_cuenta_contable: string;
    tipo_cuenta_general: string; 
    nivel_jerarquia_cuenta: number; 
    moneda_id_predeterminada_cuenta?: number;
    permite_movimientos_directos?: boolean;
    naturaleza_saldo_cuenta: string; 
    cuenta_padre_id?: number; 
    requiere_analisis_por_centro_costo?: boolean;
    requiere_analisis_por_tercero?: boolean;
    estado_cuenta?: string; 
    observaciones_cuenta?: string; 

    // Campos de auditoría 
    usuario_creacion_id?: number;
    fecha_creacion?: string; // Nombre de la columna en la BD
    usuario_modificacion_id?: number;
    fecha_modificacion?: string; // Nombre de la columna en la BD

    // Campos adicionales para JOINs
    moneda_nombre?: string;
    cuenta_padre_codigo?: string; 
    cuenta_padre_nombre?: string; 
    creado_por?: string; 
    modificado_por?: string; 
}

// Interfaz para filtros (reutilizable)
export interface PlanContableFilters {
    codigo_cuenta?: string;
    nombre_cuenta_contable?: string; 
    tipo_cuenta_general?: string;
    estado_cuenta?: string;
}

const API_URL = 'http://localhost:4000/api/plan-contable';

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
}, (error: AxiosError) => { 
    return Promise.reject(error);
});

// Obtener todas las cuentas contables con filtros y paginación (¡CONSULTA ACTUALIZADA!)
export const getAllPlanContable = async (empresaId: number, page: number, limit: number, filters: PlanContableFilters): Promise<PagedResult<any>> => {
    let query = `
        SELECT 
            pc.cuenta_contable_id, pc.codigo_cuenta, pc.nombre_cuenta_contable,
            pc.tipo_cuenta_general, pc.nivel_jerarquia_cuenta, pc.estado_cuenta,
            pc.observaciones_cuenta, 
            m.nombre_moneda as moneda_nombre,
            pc_padre.codigo_cuenta as cuenta_padre_codigo,
            u_creacion.nombres_completos_persona as creado_por, 
            pc.fecha_creacion,
            u_modificacion.nombres_completos_persona as modificado_por,
            pc.fecha_modificacion
        FROM public.plancontable pc
        LEFT JOIN public.monedas m ON pc.moneda_id_predeterminada_cuenta = m.moneda_id
        LEFT JOIN public.plancontable pc_padre ON pc.cuenta_padre_id = pc_padre.cuenta_contable_id
        LEFT JOIN public.usuarios u_creacion ON pc.usuario_creacion_id = u_creacion.usuario_id 
        LEFT JOIN public.usuarios u_modificacion ON pc.usuario_modificacion_id = u_modificacion.usuario_id 
        WHERE pc.empresa_id = $1
    `;
    const countQueryBase = `SELECT COUNT(*) FROM public.plancontable pc WHERE pc.empresa_id = $1`;

    const queryParams: any[] = [empresaId];
    let whereClause = '';
    let paramIndex = 2;

    Object.keys(filters).forEach(_key => {
        const key = _key as keyof PlanContableFilters; 
        const value = filters[key];
        // Aseguramos que el filtro no esté vacío y no sea 'Todos'
        if (value && value !== 'Todos') {
            whereClause += ` AND pc.${key}::text ILIKE $${paramIndex}`; 
            queryParams.push(`%${value}%`);
            paramIndex++;
        }
    });
    // 1. Construimos la consulta de conteo final aplicando los filtros.
    const finalCountQuery = countQueryBase + whereClause;
    
    // 2. Ejecutamos el conteo con los parámetros del filtro.
    const totalResult = await pool.query(finalCountQuery, queryParams);
    const total_records = parseInt(totalResult.rows[0].count, 10);
    const total_pages = Math.ceil(total_records / limit) || 1;

    // 3. Construimos la consulta de datos final, añadiendo paginación.
    const offset = (page - 1) * limit;
    const finalQuery = `${query} ${whereClause} ORDER BY pc.codigo_cuenta ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    const paginatedParams = [...queryParams, limit, offset];

    const recordsResult = await pool.query(finalQuery, paginatedParams);

    return {
        records: recordsResult.rows,
        total_records,
        total_pages,
        current_page: page,
    };
};

// Obtener una cuenta contable por su ID
export const getPlanContableById = async (cuentaId: number, empresaId: number): Promise<CuentaContable | null> => {
    const query = `
        SELECT 
            pc.*, 
            m.nombre_moneda as moneda_nombre,
            pc_padre.codigo_cuenta as cuenta_padre_codigo,
            pc_padre.nombre_cuenta_contable as cuenta_padre_nombre,
            u_creacion.nombres_completos_persona as creado_por, 
            u_modificacion.nombres_completos_persona as modificado_por 
        FROM plancontable pc
        LEFT JOIN monedas m ON pc.moneda_id_predeterminada_cuenta = m.moneda_id
        LEFT JOIN plancontable pc_padre ON pc.cuenta_padre_id = pc_padre.cuenta_contable_id
        LEFT JOIN usuarios u_creacion ON pc.usuario_creacion_id = u_creacion.usuario_id 
        LEFT JOIN usuarios u_modificacion ON pc.usuario_modificacion_id = u_modificacion.usuario_id 
        WHERE pc.cuenta_contable_id = $1 AND pc.empresa_id = $2
    `;
    const result = await pool.query(query, [cuentaId, empresaId]);
    return result.rows[0] || null;
};

// Crear una nueva cuenta contable (¡FUNCIÓN ACTUALIZADA!)
export const createPlanContable = async (cuenta: CuentaContable, usuarioId: number, nombreUsuario: string): Promise<CuentaContable> => {
    const { 
        empresa_id, codigo_cuenta, nombre_cuenta_contable, tipo_cuenta_general,
        nivel_jerarquia_cuenta, moneda_id_predeterminada_cuenta, permite_movimientos_directos,
        naturaleza_saldo_cuenta, cuenta_padre_id, requiere_analisis_por_centro_costo,
        requiere_analisis_por_tercero, estado_cuenta, observaciones_cuenta
    } = cuenta;
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const result = await client.query(
            `INSERT INTO plancontable (
                empresa_id, codigo_cuenta, nombre_cuenta_contable, tipo_cuenta_general,
                nivel_jerarquia_cuenta, moneda_id_predeterminada_cuenta, permite_movimientos_directos,
                naturaleza_saldo_cuenta, cuenta_padre_id, requiere_analisis_por_centro_costo,
                requiere_analisis_por_tercero, estado_cuenta, observaciones_cuenta, 
                usuario_creacion_id, fecha_creacion
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
            RETURNING *`,
            [
                empresa_id, codigo_cuenta, nombre_cuenta_contable, tipo_cuenta_general,
                nivel_jerarquia_cuenta, moneda_id_predeterminada_cuenta || null, permite_movimientos_directos ?? true,
                naturaleza_saldo_cuenta, cuenta_padre_id || null, requiere_analisis_por_centro_costo ?? false,
                requiere_analisis_por_tercero ?? false, estado_cuenta || 'Activa', observaciones_cuenta || null, 
                usuarioId 
            ]
        );
        const nuevaCuenta = result.rows[0];

        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'CREACION',
            tabla_afectada: 'plancontable', 
            registro_afectado_id: nuevaCuenta.cuenta_contable_id.toString(),
            valor_nuevo: JSON.stringify(nuevaCuenta),
            exito_operacion: true,
            modulo_sistema_origen: 'Contabilidad - Plan de Cuentas'
        });

        await client.query('COMMIT');
        return nuevaCuenta;
    } catch (error: any) {
        if (client) await client.query('ROLLBACK');
        console.error("Error al crear cuenta contable:", error);
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'CREACION',
            tabla_afectada: 'plancontable', 
            registro_afectado_id: cuenta.cuenta_contable_id?.toString() || 'N/A',
            valor_nuevo: JSON.stringify(cuenta),
            exito_operacion: false,
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Contabilidad - Plan de Cuentas'
        });
        throw error;
    } finally {
        if (client) client.release();
    }
};

// Actualizar una cuenta contable (¡FUNCIÓN ACTUALIZADA!)
export const updatePlanContable = async (cuentaId: number, cuentaData: Partial<CuentaContable>, usuarioId: number, nombreUsuario: string): Promise<CuentaContable> => {
    const client = await pool.connect();
    const valorAnterior = await getPlanContableById(cuentaId, cuentaData.empresa_id!);
    if (!valorAnterior) {
        await logAuditoria({
            usuario_id_accion: usuarioId,
            nombre_usuario_accion: nombreUsuario,
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'plancontable',
            registro_afectado_id: cuentaId.toString(),
            descripcion_detallada_evento: `Intento de actualización de cuenta contable no encontrada (ID: ${cuentaId}).`,
            exito_operacion: false,
            mensaje_error_si_fallo: 'Cuenta contable no encontrada para actualizar.',
            modulo_sistema_origen: 'Contabilidad - Plan de Cuentas'
        });
        throw new Error('Cuenta contable no encontrada.');
    }

    const {
        codigo_cuenta, nombre_cuenta_contable, tipo_cuenta_general,
        nivel_jerarquia_cuenta, moneda_id_predeterminada_cuenta, permite_movimientos_directos,
        naturaleza_saldo_cuenta, cuenta_padre_id, requiere_analisis_por_centro_costo,
        requiere_analisis_por_tercero, estado_cuenta, observaciones_cuenta
    } = cuentaData;

    try {
        await client.query('BEGIN');

        const dataToUpdate = {
            ...valorAnterior,
            ...cuentaData,
            moneda_id_predeterminada_cuenta: cuentaData.moneda_id_predeterminada_cuenta || null,
            cuenta_padre_id: cuentaData.cuenta_padre_id || null
        };

        const result = await pool.query(
            `UPDATE plancontable SET
                codigo_cuenta = $1, nombre_cuenta_contable = $2, tipo_cuenta_general = $3,
                nivel_jerarquia_cuenta = $4, moneda_id_predeterminada_cuenta = $5, permite_movimientos_directos = $6,
                naturaleza_saldo_cuenta = $7, cuenta_padre_id = $8, requiere_analisis_por_centro_costo = $9,
                requiere_analisis_por_tercero = $10, estado_cuenta = $11, observaciones_cuenta = $12, 
                usuario_modificacion_id = $13, fecha_modificacion = NOW() 
            WHERE cuenta_contable_id = $14 AND empresa_id = $15
            RETURNING *`,
            [
                dataToUpdate.codigo_cuenta, dataToUpdate.nombre_cuenta_contable, dataToUpdate.tipo_cuenta_general,
                dataToUpdate.nivel_jerarquia_cuenta, dataToUpdate.moneda_id_predeterminada_cuenta, dataToUpdate.permite_movimientos_directos,
                dataToUpdate.naturaleza_saldo_cuenta, dataToUpdate.cuenta_padre_id, dataToUpdate.requiere_analisis_por_centro_costo,
                dataToUpdate.requiere_analisis_por_tercero, dataToUpdate.estado_cuenta, dataToUpdate.observaciones_cuenta, 
                usuarioId, 
                cuentaId,
                dataToUpdate.empresa_id
            ]
        );
        const cuentaActualizada = result.rows[0];

        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'plancontable', 
            registro_afectado_id: cuentaId.toString(),
            valor_anterior: JSON.stringify(valorAnterior), 
            valor_nuevo: JSON.stringify(cuentaActualizada),
            exito_operacion: true,
            modulo_sistema_origen: 'Contabilidad - Plan de Cuentas'
        });

        await client.query('COMMIT');
        return cuentaActualizada;
    } catch (error: any) {
        if (client) await client.query('ROLLBACK');
        console.error("Error al actualizar cuenta contable:", error);
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'plancontable', 
            registro_afectado_id: cuentaId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify(cuentaData),
            exito_operacion: false,
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Contabilidad - Plan de Cuentas'
        });
        throw error;
    } finally {
        if (client) client.release();
    }
};

// Eliminar (desactivar) una cuenta contable (¡FUNCIÓN ACTUALIZADA!)
export const deletePlanContable = async (cuentaId: number, empresaId: number, usuarioId: number, nombreUsuario: string): Promise<boolean> => {
    const client = await pool.connect();
    const valorAnterior = await getPlanContableById(cuentaId, empresaId);
    if (!valorAnterior) {
        await logAuditoria({
            usuario_id_accion: usuarioId,
            nombre_usuario_accion: nombreUsuario,
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'plancontable',
            registro_afectado_id: cuentaId.toString(),
            descripcion_detallada_evento: `Intento de desactivación de cuenta contable no encontrada (ID: ${cuentaId}).`,
            exito_operacion: false,
            mensaje_error_si_fallo: 'Cuenta contable no encontrada para desactivar.',
            modulo_sistema_origen: 'Contabilidad - Plan de Cuentas'
        });
        throw new Error('Cuenta contable no encontrada.');
    }

    try {
        await client.query('BEGIN');

        const result = await pool.query(
            `UPDATE plancontable SET 
                estado_cuenta = 'Inactiva',
                usuario_modificacion_id = $1, fecha_modificacion = NOW() 
            WHERE cuenta_contable_id = $2 AND empresa_id = $3`,
            [usuarioId, cuentaId, empresaId]
        );

        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'plancontable', 
            registro_afectado_id: cuentaId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify({ ...valorAnterior, estado_cuenta: 'Inactiva' }),
            exito_operacion: true,
            modulo_sistema_origen: 'Contabilidad - Plan de Cuentas'
        });

        await client.query('COMMIT');
        return (result.rowCount ?? 0) > 0;
    } catch (error: any) {
        if (client) await client.query('ROLLBACK');
        console.error("Error al desactivar cuenta contable:", error);
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'plancontable', 
            registro_afectado_id: cuentaId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify({ ...valorAnterior, estado_cuenta: 'ERROR_NO_DESACTIVADA' }),
            exito_operacion: false,
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Contabilidad - Plan de Cuentas'
        });
        throw error;
    } finally {
        if (client) client.release();
    }
};

// Exportar plan contable a Excel (¡FUNCIÓN ACTUALIZADA!)
export const exportarPlanContable = async (empresaId: number, filters: PlanContableFilters): Promise<any[]> => { 
    const cuentasParaExportar = await getAllPlanContable(empresaId, 1, 9999, filters); 
    return cuentasParaExportar.records.map(cuenta => ({
        "ID Cuenta": cuenta.cuenta_contable_id,
        "Código Cuenta": cuenta.codigo_cuenta,
        "Nombre Cuenta": cuenta.nombre_cuenta_contable,
        "Tipo General": cuenta.tipo_cuenta_general,
        "Nivel Jerarquía": cuenta.nivel_jerarquia_cuenta,
        "Moneda Predeterminada": cuenta.moneda_nombre,
        "Permite Movimientos Directos": cuenta.permite_movimientos_directos ? "Sí" : "No",
        "Naturaleza Saldo": cuenta.naturaleza_saldo_cuenta,
        "Código Cuenta Padre": cuenta.cuenta_padre_codigo,
        "Nombre Cuenta Padre": cuenta.cuenta_padre_nombre,
        "Requiere CC": cuenta.requiere_analisis_por_centro_costo ? "Sí" : "No",
        "Requiere Tercero": cuenta.requiere_analisis_por_tercero ? "Sí" : "No",
        "Estado": cuenta.estado_cuenta,
        "Observaciones": cuenta.observaciones_cuenta, // ¡AÑADIDO PARA EXPORTACIÓN!
        "Creado Por": cuenta.creado_por || 'N/A',
        "Fecha Creación": cuenta.fecha_creacion ? new Date(cuenta.fecha_creacion).toLocaleString('es-PE') : 'N/A',
        "Modificado Por": cuenta.modificado_por || 'N/A',
        "Fecha Modificación": cuenta.fecha_modificacion ? new Date(cuenta.fecha_modificacion).toLocaleString('es-PE') : 'N/A'
    }));
};