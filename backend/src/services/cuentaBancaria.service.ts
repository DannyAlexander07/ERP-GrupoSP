// Archivo: backend/src/services/cuentaBancaria.service.ts (ACTUALIZADO con CAMPOS DE AUDITORÍA)
import pool from '../config/database';
import { logAuditoria } from './auditoria.service';

// ¡NUEVAS IMPORTACIONES! (Axios y sus tipos para el interceptor)
import axios, { AxiosRequestConfig, AxiosError } from 'axios'; 
import type { AxiosRequestHeaders } from 'axios'; 
import type { UsuarioFilters } from './usuario.service'; // Para tipar los filters de usuario si se usa en JOINs

// Interfaz para la respuesta paginada (reutilizable)
export interface PagedResult<T> {
    records: T[];
    total_records: number;
    total_pages: number;
    current_page: number;
}

// Interfaz completa de Cuenta Bancaria Propia (¡ACTUALIZADA CON AUDITORÍA!)
export interface CuentaBancariaPropia {
    cuenta_bancaria_id?: number;
    empresa_id: number;
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
    
    // ¡CAMPOS DE AUDITORÍA AÑADIDOS EN LA INTERFAZ!
    usuario_creacion_id?: number;
    fecha_creacion?: string;
    usuario_modificacion_id?: number;
    fecha_modificacion?: string;

    // Campos adicionales para JOINs (para mostrar nombres en el frontend)
    moneda_nombre?: string; // Nombre de la moneda
    creado_por?: string; // Nombre del usuario creador
    modificado_por?: string; // Nombre del usuario modificador
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

// Interceptor de Axios (¡APLICADA LA CORRECCIÓN GLOBAL!)
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

// Obtener todas las cuentas bancarias con filtros y paginación (¡CONSULTA ACTUALIZADA!)
export const getAllCuentasBancarias = async (empresaId: number, page: number, limit: number, filters: CuentaBancariaFilters): Promise<PagedResult<any>> => {
    const allowedFilterKeys = ['nombre_banco', 'numero_cuenta_unico', 'estado_cuenta_bancaria'];
    let query = `
        SELECT 
            cb.cuenta_bancaria_id, cb.nombre_banco, cb.tipo_cuenta_bancaria,
            cb.numero_cuenta_unico, cb.moneda_id, m.nombre_moneda as moneda_nombre,
            cb.saldo_disponible_actual, cb.estado_cuenta_bancaria,
            cb.usuario_creacion_id,
            cb.fecha_creacion,
            u_creacion.nombres_completos_persona as creado_por,
            cb.usuario_modificacion_id,
            cb.fecha_modificacion,
            u_modificacion.nombres_completos_persona as modificado_por
        FROM cuentasbancariaspropias cb
        JOIN monedas m ON cb.moneda_id = m.moneda_id
        LEFT JOIN Usuarios u_creacion ON cb.usuario_creacion_id = u_creacion.usuario_id
        LEFT JOIN Usuarios u_modificacion ON cb.usuario_modificacion_id = u_modificacion.usuario_id
        WHERE cb.empresa_id = $1
    `;
    const countQueryBase = `SELECT COUNT(*) FROM cuentasbancariaspropias cb WHERE cb.empresa_id = $1`;

    const queryParams: any[] = [empresaId];
    let whereClause = '';
    let paramIndex = 2;

    Object.keys(filters).forEach(_key => {
        const key = _key as keyof CuentaBancariaFilters; 
        const value = filters[key];
        if (value !== undefined && value !== null) {
            whereClause += ` AND cb.${key}::text ILIKE $${paramIndex}`; 
            queryParams.push(`%${value}%`);
            paramIndex++;
        }
    });

    const finalQuery = query + whereClause + ' ORDER BY cb.nombre_banco ASC, cb.numero_cuenta_unico ASC';
    const finalCountQuery = countQueryBase + whereClause;
    
    const countParams = queryParams.slice(0, paramIndex - 1);
    const totalResult = await pool.query(finalCountQuery, countParams);
    const total_records = parseInt(totalResult.rows[0].count, 10);
    const total_pages = Math.ceil(total_records / limit) || 1;

    const offset = (page - 1) * limit;
    const paginatedQuery = `${finalQuery} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    const paginatedParams = [...countParams, limit, offset];

    const recordsResult = await pool.query(paginatedQuery, paginatedParams);

    return {
        records: recordsResult.rows,
        total_records,
        total_pages,
        current_page: page,
    };
};

// Obtener una cuenta bancaria por su ID (¡CONSULTA ACTUALIZADA!)
export const getCuentaBancariaById = async (cuentaId: number, empresaId: number): Promise<CuentaBancariaPropia | null> => {
    const query = `
        SELECT 
            cb.*,
            m.nombre_moneda as moneda_nombre,
            u_creacion.nombres_completos_persona as creado_por,
            u_modificacion.nombres_completos_persona as modificado_por
        FROM cuentasbancariaspropias cb
        JOIN monedas m ON cb.moneda_id = m.moneda_id
        LEFT JOIN Usuarios u_creacion ON cb.usuario_creacion_id = u_creacion.usuario_id
        LEFT JOIN Usuarios u_modificacion ON cb.usuario_modificacion_id = u_modificacion.usuario_id
        WHERE cb.cuenta_bancaria_id = $1 AND cb.empresa_id = $2
    `;
    const result = await pool.query(query, [cuentaId, empresaId]);
    return result.rows[0] || null;
};

// Crear una nueva cuenta bancaria (¡FUNCIÓN ACTUALIZADA!)
export const createCuentaBancaria = async (cuenta: CuentaBancariaPropia, usuarioId: number, nombreUsuario: string): Promise<CuentaBancariaPropia> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { 
            empresa_id, moneda_id, nombre_banco, tipo_cuenta_bancaria,
            numero_cuenta_unico, numero_cuenta_interbancario_cci, alias_o_descripcion_cuenta,
            ejecutivo_asignado_banco, saldo_contable_inicial, fecha_saldo_contable_inicial,
            observaciones_cuenta
        } = cuenta;
        
        const result = await client.query(
            `INSERT INTO cuentasbancariaspropias (
                empresa_id, moneda_id, nombre_banco, tipo_cuenta_bancaria,
                numero_cuenta_unico, numero_cuenta_interbancario_cci, alias_o_descripcion_cuenta,
                ejecutivo_asignado_banco, saldo_contable_inicial, fecha_saldo_contable_inicial,
                estado_cuenta_bancaria, observaciones_cuenta,
                usuario_creacion_id, fecha_creacion -- ¡NUEVOS CAMPOS EN INSERT!
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Activa', $11, $12, NOW())
            RETURNING *`,
            [
                empresa_id, moneda_id, nombre_banco, tipo_cuenta_bancaria,
                numero_cuenta_unico, numero_cuenta_interbancario_cci || null, alias_o_descripcion_cuenta || null,
                ejecutivo_asignado_banco || null, saldo_contable_inicial || 0, fecha_saldo_contable_inicial || null,
                observaciones_cuenta || null,
                usuarioId // El ID del usuario creador
            ]
        );
        const nuevaCuenta = result.rows[0];

        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'CREACION',
            tabla_afectada: 'cuentasbancariaspropias', 
            registro_afectado_id: nuevaCuenta.cuenta_bancaria_id.toString(),
            valor_nuevo: JSON.stringify(nuevaCuenta),
            exito_operacion: true,
            modulo_sistema_origen: 'Tesoreria - Cuentas Bancarias'
        });

        await client.query('COMMIT');
        return nuevaCuenta;
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error("Error al crear cuenta bancaria:", error);
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'CREACION',
            tabla_afectada: 'cuentasbancariaspropias', 
            registro_afectado_id: cuenta.cuenta_bancaria_id?.toString() || 'N/A', 
            valor_nuevo: JSON.stringify(cuenta),
            exito_operacion: false,
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Tesoreria - Cuentas Bancarias'
        });
        throw error;
    } finally {
        client.release();
    }
};

// Actualizar una cuenta bancaria (¡FUNCIÓN ACTUALIZADA!)
export const updateCuentaBancaria = async (cuentaId: number, cuentaData: Partial<CuentaBancariaPropia>, usuarioId: number, nombreUsuario: string): Promise<CuentaBancariaPropia> => {
    const client = await pool.connect();
    const valorAnterior = await getCuentaBancariaById(cuentaId, cuentaData.empresa_id!); // empresa_id debe estar en cuentaData para la validación
    if (!valorAnterior) {
        await logAuditoria({
            usuario_id_accion: usuarioId,
            nombre_usuario_accion: nombreUsuario,
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'cuentasbancariaspropias',
            registro_afectado_id: cuentaId.toString(),
            descripcion_detallada_evento: `Intento de actualización de cuenta bancaria no encontrada (ID: ${cuentaId}).`,
            exito_operacion: false,
            mensaje_error_si_fallo: 'Cuenta bancaria no encontrada para actualizar.',
            modulo_sistema_origen: 'Tesoreria - Cuentas Bancarias'
        });
        throw new Error('Cuenta bancaria no encontrada.');
    }

    const {
        moneda_id, nombre_banco, tipo_cuenta_bancaria,
        numero_cuenta_unico, numero_cuenta_interbancario_cci, alias_o_descripcion_cuenta,
        ejecutivo_asignado_banco, saldo_contable_inicial, fecha_saldo_contable_inicial,
        estado_cuenta_bancaria, observaciones_cuenta
    } = cuentaData;

    try {
        await client.query('BEGIN');

        const result = await client.query(
            `UPDATE cuentasbancariaspropias SET
                moneda_id = $1, nombre_banco = $2, tipo_cuenta_bancaria = $3,
                numero_cuenta_unico = $4, numero_cuenta_interbancario_cci = $5, alias_o_descripcion_cuenta = $6,
                ejecutivo_asignado_banco = $7, saldo_contable_inicial = $8, fecha_saldo_contable_inicial = $9,
                estado_cuenta_bancaria = $10, observaciones_cuenta = $11,
                usuario_modificacion_id = $12, fecha_modificacion = NOW() -- ¡NUEVOS CAMPOS EN UPDATE!
            WHERE cuenta_bancaria_id = $13 AND empresa_id = $14
            RETURNING *`,
            [
                moneda_id ?? valorAnterior.moneda_id,
                nombre_banco ?? valorAnterior.nombre_banco,
                tipo_cuenta_bancaria ?? valorAnterior.tipo_cuenta_bancaria,
                numero_cuenta_unico ?? valorAnterior.numero_cuenta_unico,
                numero_cuenta_interbancario_cci ?? valorAnterior.numero_cuenta_interbancario_cci,
                alias_o_descripcion_cuenta ?? valorAnterior.alias_o_descripcion_cuenta,
                ejecutivo_asignado_banco ?? valorAnterior.ejecutivo_asignado_banco,
                saldo_contable_inicial ?? valorAnterior.saldo_contable_inicial,
                fecha_saldo_contable_inicial ?? valorAnterior.fecha_saldo_contable_inicial,
                estado_cuenta_bancaria ?? valorAnterior.estado_cuenta_bancaria,
                observaciones_cuenta ?? valorAnterior.observaciones_cuenta,
                usuarioId, // El ID del usuario modificador
                cuentaId,
                cuentaData.empresa_id // Asegurar que empresa_id esté presente
            ]
        );
        const cuentaActualizada = result.rows[0];

        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'cuentasbancariaspropias', 
            registro_afectado_id: cuentaId.toString(),
            valor_anterior: JSON.stringify(valorAnterior), 
            valor_nuevo: JSON.stringify(cuentaActualizada),
            exito_operacion: true,
            modulo_sistema_origen: 'Tesoreria - Cuentas Bancarias'
        });

        await client.query('COMMIT');
        return cuentaActualizada;
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error("Error al actualizar cuenta bancaria:", error);
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'cuentasbancariaspropias', 
            registro_afectado_id: cuentaId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify(cuentaData),
            exito_operacion: false,
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Tesoreria - Cuentas Bancarias'
        });
        throw error;
    } finally {
        client.release();
    }
};

// Eliminar (desactivar) una cuenta bancaria (¡FUNCIÓN ACTUALIZADA!)
export const deleteCuentaBancaria = async (cuentaId: number, empresaId: number, usuarioId: number, nombreUsuario: string): Promise<boolean> => {
    const client = await pool.connect();
    const valorAnterior = await getCuentaBancariaById(cuentaId, empresaId);
    if (!valorAnterior) {
        await logAuditoria({
            usuario_id_accion: usuarioId,
            nombre_usuario_accion: nombreUsuario,
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'cuentasbancariaspropias',
            registro_afectado_id: cuentaId.toString(),
            descripcion_detallada_evento: `Intento de desactivación de cuenta bancaria no encontrada (ID: ${cuentaId}).`,
            exito_operacion: false,
            mensaje_error_si_fallo: 'Cuenta bancaria no encontrada para desactivar.',
            modulo_sistema_origen: 'Tesoreria - Cuentas Bancarias'
        });
        throw new Error('Cuenta bancaria no encontrada.');
    }

    try {
        await client.query('BEGIN');

        const result = await pool.query(
            `UPDATE cuentasbancariaspropias SET 
                estado_cuenta_bancaria = 'Inactiva',
                usuario_modificacion_id = $1, fecha_modificacion = NOW() -- ¡NUEVOS CAMPOS EN UPDATE!
            WHERE cuenta_bancaria_id = $2 AND empresa_id = $3`,
            [usuarioId, cuentaId, empresaId]
        );

        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'cuentasbancariaspropias', 
            registro_afectado_id: cuentaId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify({ ...valorAnterior, estado_cuenta_bancaria: 'Inactiva' }),
            exito_operacion: true,
            modulo_sistema_origen: 'Tesoreria - Cuentas Bancarias'
        });

        await client.query('COMMIT');
        return (result.rowCount ?? 0) > 0;
    } catch (error: any) {
        if (client) await client.query('ROLLBACK');
        console.error("Error al desactivar cuenta bancaria:", error);
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'cuentasbancariaspropias', 
            registro_afectado_id: cuentaId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify({ ...valorAnterior, estado_cuenta_bancaria: 'ERROR_NO_DESACTIVADA' }),
            exito_operacion: false,
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Tesoreria - Cuentas Bancarias'
        });
        throw error;
    } finally {
        if (client) client.release();
    }
};

// Exportar cuentas bancarias a Excel (¡FUNCIÓN ACTUALIZADA!)
export const exportarCuentasBancarias = async (empresaId: number, filters: CuentaBancariaFilters): Promise<any[]> => { 
    const cuentasParaExportar = await getAllCuentasBancarias(empresaId, 1, 9999, filters); 
    return cuentasParaExportar.records.map(cuenta => ({
        "ID Cuenta": cuenta.cuenta_bancaria_id,
        "Nombre Banco": cuenta.nombre_banco,
        "Tipo Cuenta": cuenta.tipo_cuenta_bancaria,
        "Número Cuenta": cuenta.numero_cuenta_unico,
        "CCI": cuenta.numero_cuenta_interbancario_cci,
        "Alias/Descripción": cuenta.alias_o_descripcion_cuenta,
        "Ejecutivo Banco": cuenta.ejecutivo_asignado_banco,
        "Saldo Inicial": cuenta.saldo_contable_inicial,
        "Fecha Saldo Inicial": cuenta.fecha_saldo_contable_inicial,
        "Saldo Actual": cuenta.saldo_disponible_actual,
        "Último Movimiento": cuenta.fecha_ultimo_movimiento_registrado,
        "Estado": cuenta.estado_cuenta_bancaria,
        "Observaciones": cuenta.observaciones_cuenta,
        "Creado Por": cuenta.creado_por || 'N/A',
        "Fecha Creación": cuenta.fecha_creacion ? new Date(cuenta.fecha_creacion).toLocaleString('es-PE') : 'N/A', 
        "Modificado Por": cuenta.modificado_por || 'N/A',
        "Fecha Modificación": cuenta.fecha_modificacion ? new Date(cuenta.fecha_modificacion).toLocaleString('es-PE') : 'N/A'
    }));
};