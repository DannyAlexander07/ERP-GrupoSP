// Archivo: backend/src/services/asientoContable.service.ts (VERSIÓN FINAL Y CORREGIDA)
import pool from '../config/database';
import { logAuditoria } from './auditoria.service';
import { PoolClient } from 'pg';
import axios, { AxiosRequestConfig, AxiosError } from 'axios'; 
import type { AxiosRequestHeaders } from 'axios'; 
import type { CuentaContable } from './planContable.service';
import type { Moneda } from './moneda.service';
// ¡CORRECCIÓN! Eliminamos la importación que no existe
// import type { TipoAsientoContable } from './tipoAsientoContable.service';

// Interfaz para la respuesta paginada
export interface PagedResult<T> {
    records: T[];
    total_records: number;
    total_pages: number;
    current_page: number;
}

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
    // Campos adicionales para JOINs
    cuenta_contable_codigo?: string;
    cuenta_contable_nombre?: string;
    moneda_nombre_linea?: string;
    centro_costo_nombre?: string;
    tercero_analisis_nombre?: string;
    requiere_analisis_por_centro_costo?: boolean; 
    requiere_analisis_por_tercero?: boolean; 
}

export interface AsientoContableCabecera {
    asiento_cabecera_id?: number;
    empresa_id: number; 
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

    usuario_creacion_id?: number;
    fecha_creacion?: string; 
    usuario_modificacion_id?: number; 
    fecha_modificacion?: string; 

    detalles?: AsientoContableDetalle[];

    empresa_nombre?: string;
    periodo_contable_anio_mes?: string;
    tipo_asiento_descripcion?: string;
    moneda_nombre_asiento?: string;
    creado_por?: string;
    modificado_por?: string;
}

export interface AsientoContableFilters {
    numero_asiento_completo?: string;
    tipo_asiento_descripcion?: string; 
    estado_asiento?: string;
}

const API_URL = 'http://localhost:4000/api/asientos-contables';

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

// Obtener el siguiente correlativo y número completo de asiento (CORREGIDO)
export const getNextAsientoNumber = async (empresaId: number, periodoContableId: number, tipoAsientoId: number): Promise<{ correlativo: number, numeroCompleto: string }> => {
    const query = `
        SELECT correlativo_tipo_asiento_periodo FROM AsientosContablesCabecera
        WHERE empresa_id = $1 AND periodo_contable_id = $2 AND tipo_asiento_contable_id = $3
        ORDER BY correlativo_tipo_asiento_periodo DESC
        LIMIT 1
    `;
    const result = await pool.query(query, [empresaId, periodoContableId, tipoAsientoId]);
    const nextCorrelativo = result.rows.length > 0 ? result.rows[0].correlativo_tipo_asiento_periodo + 1 : 1;

    // Obtener el código del tipo de asiento para el numero_asiento_completo
    const tipoAsientoQuery = await pool.query(
        `SELECT codigo_tipo_asiento FROM TiposAsientoContable WHERE tipo_asiento_contable_id = $1`,
        [tipoAsientoId]
    );
    const codigoTipoAsiento = tipoAsientoQuery.rows[0]?.codigo_tipo_asiento;
    if (!codigoTipoAsiento) {
        throw new Error('Código de tipo de asiento no encontrado.');
    }

    const periodoResult = await pool.query('SELECT anio_ejercicio, mes_ejercicio FROM PeriodosContables WHERE periodo_contable_id = $1', [periodoContableId]);
    const anio = periodoResult.rows[0]?.anio_ejercicio || 'YYYY';
    const mes = String(periodoResult.rows[0]?.mes_ejercicio || 'MM').padStart(2, '0');

    const numeroCompleto = `${codigoTipoAsiento}-${anio}${mes}-${String(nextCorrelativo).padStart(5, '0')}`; 

    return { correlativo: nextCorrelativo, numeroCompleto };
};

// Obtener todos los asientos contables con filtros y paginación
export const getAllAsientosContables = async (empresaId: number, page: number, limit: number, filters: AsientoContableFilters): Promise<PagedResult<any>> => {
    const allowedFilterKeys = ['numero_asiento_completo', 'tipo_asiento_descripcion', 'estado_asiento'];
    let query = `
        SELECT 
            ac.asiento_cabecera_id, ac.numero_asiento_completo, ac.fecha_contabilizacion_asiento,
            ac.glosa_principal_asiento, ac.total_debe_asiento, ac.total_haber_asiento,
            ac.estado_asiento, ac.origen_documento_referencia_id,
            ta.descripcion_tipo_asiento as tipo_asiento_descripcion,
            m.nombre_moneda as moneda_nombre_asiento,
            u.nombres_completos_persona as creado_por
        FROM AsientosContablesCabecera ac
        JOIN TiposAsientoContable ta ON ac.tipo_asiento_contable_id = ta.tipo_asiento_contable_id
        JOIN Monedas m ON ac.moneda_id_asiento = m.moneda_id
        LEFT JOIN Usuarios u ON ac.usuario_creacion_id = u.usuario_id
        WHERE ac.empresa_id = $1
    `;
    const countQueryBase = `SELECT COUNT(*) FROM AsientosContablesCabecera ac WHERE ac.empresa_id = $1`;

    const queryParams: any[] = [empresaId];
    let whereClause = '';
    let paramIndex = 2;

    Object.keys(filters).forEach(_key => {
        const key = _key as keyof AsientoContableFilters;
        const value = filters[key];
        if (value !== undefined && value !== null) {
            whereClause += ` AND ac.${key}::text ILIKE $${paramIndex}`; 
            queryParams.push(`%${value}%`);
            paramIndex++;
        }
    });

    const finalQuery = query + whereClause + ' ORDER BY ac.fecha_contabilizacion_asiento DESC, ac.asiento_cabecera_id DESC';
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

// Obtener un asiento contable por su ID con sus detalles
export const getAsientoContableById = async (asientoId: number, empresaId: number): Promise<AsientoContableCabecera | null> => {
    const queryCabecera = `
        SELECT 
            ac.*,
            tac.descripcion_tipo_asiento as tipo_asiento_descripcion,
            m.nombre_moneda as moneda_nombre_asiento,
            pc.anio_ejercicio, pc.mes_ejercicio,
            u_creacion.nombres_completos_persona as creado_por
            -- ¡CORRECCIÓN! Se elimina la referencia a la columna inexistente 'usuario_modificacion_id'
            -- u_modificacion.nombres_completos_persona as modificado_por 
        FROM AsientosContablesCabecera ac
        JOIN TiposAsientoContable tac ON ac.tipo_asiento_contable_id = tac.tipo_asiento_contable_id
        JOIN Monedas m ON ac.moneda_id_asiento = m.moneda_id
        JOIN PeriodosContables pc ON ac.periodo_contable_id = pc.periodo_contable_id
        LEFT JOIN Usuarios u_creacion ON ac.usuario_creacion_id = u_creacion.usuario_id
        -- ¡CORRECCIÓN! Se elimina el JOIN que usaba la columna inexistente
        -- LEFT JOIN Usuarios u_modificacion ON ac.usuario_modificacion_id = u_modificacion.usuario_id
        WHERE ac.asiento_cabecera_id = $1 AND ac.empresa_id = $2
    `;

    const queryDetalles = `
        SELECT 
            acd.*,
            pc.codigo_cuenta as cuenta_contable_codigo,
            pc.nombre_cuenta_contable,
            pc.requiere_analisis_por_centro_costo,
            pc.requiere_analisis_por_tercero,
            ml.nombre_moneda as moneda_nombre_linea,
            cco.nombre_centro_costo as centro_costo_nombre,
            CASE acd.tipo_tercero_analisis
                WHEN 'Cliente' THEN c.razon_social_o_nombres
                WHEN 'Proveedor' THEN p.razon_social_o_nombres
                ELSE NULL
            END as tercero_analisis_nombre
        FROM AsientosContablesDetalle acd
        JOIN PlanContable pc ON acd.cuenta_contable_id = pc.cuenta_contable_id
        JOIN Monedas ml ON acd.moneda_id_linea = ml.moneda_id
        LEFT JOIN CentrosCosto cco ON acd.centro_costo_id = cco.centro_costo_id
        LEFT JOIN Clientes c ON acd.tercero_analisis_id = c.cliente_id AND acd.tipo_tercero_analisis = 'Cliente'
        LEFT JOIN Proveedores p ON acd.tercero_analisis_id = p.proveedor_id AND acd.tipo_tercero_analisis = 'Proveedor'
        WHERE acd.asiento_cabecera_id = $1
        ORDER BY acd.secuencia_linea_asiento ASC
    `;

    const cabeceraResult = await pool.query(queryCabecera, [asientoId, empresaId]);
    if (cabeceraResult.rows.length === 0) {
        return null;
    }

    const detallesResult = await pool.query(queryDetalles, [asientoId]);
    const asiento = {
        ...cabeceraResult.rows[0],
        detalles: detallesResult.rows
    };

    return asiento;
};

// Crear un nuevo asiento contable (CORREGIDO Y OPTIMIZADO)
export const createAsientoContable = async (asiento: AsientoContableCabecera, usuarioId: number, nombreUsuario: string): Promise<AsientoContableCabecera> => {
    const client = await pool.connect(); 
    try {
        await client.query('BEGIN'); 

        const {
            empresa_id, periodo_contable_id, tipo_asiento_contable_id,
            fecha_contabilizacion_asiento, moneda_id_asiento, tipo_cambio_asiento,
            glosa_principal_asiento, origen_documento_referencia_id, origen_documento_tabla_referencia,
            detalles 
        } = asiento;

        // --- ¡INICIO DE LA CORRECCIÓN! ---
        // 1. Recalculamos los totales en el backend a partir de los detalles recibidos.
        let totalDebeCalculado = 0;
        let totalHaberCalculado = 0;
        if (detalles && detalles.length > 0) {
            totalDebeCalculado = detalles.reduce((sum, d) => sum + (Number(d.monto_debe) || 0), 0);
            totalHaberCalculado = detalles.reduce((sum, d) => sum + (Number(d.monto_haber) || 0), 0);
        }

        // 2. Validamos que el asiento esté cuadrado ANTES de intentar guardarlo.
        if (totalDebeCalculado.toFixed(2) !== totalHaberCalculado.toFixed(2)) {
            throw new Error(`El asiento está descuadrado. Total Debe: ${totalDebeCalculado.toFixed(2)}, Total Haber: ${totalHaberCalculado.toFixed(2)}`);
        }
        // --- FIN DE LA CORRECCIÓN ---

        const correlativoQuery = await client.query(
            `SELECT COALESCE(MAX(correlativo_tipo_asiento_periodo), 0) + 1 as next_correlativo
             FROM AsientosContablesCabecera
             WHERE empresa_id = $1 AND periodo_contable_id = $2 AND tipo_asiento_contable_id = $3`,
            [empresa_id, periodo_contable_id, tipo_asiento_contable_id]
        );
        const nextCorrelativo = correlativoQuery.rows[0].next_correlativo;

        const tipoAsientoQuery = await client.query(
            `SELECT codigo_tipo_asiento FROM TiposAsientoContable WHERE tipo_asiento_contable_id = $1`,
            [tipo_asiento_contable_id]
        );
        const codigoTipoAsiento = tipoAsientoQuery.rows[0]?.codigo_tipo_asiento;
        if (!codigoTipoAsiento) {
            throw new Error('Código de tipo de asiento no encontrado.');
        }

        const insertAsientoQuery = `
            INSERT INTO AsientosContablesCabecera (
                empresa_id, periodo_contable_id, tipo_asiento_contable_id,
                correlativo_tipo_asiento_periodo, codigo_tipo_asiento_referencia, 
                fecha_contabilizacion_asiento, moneda_id_asiento, tipo_cambio_asiento,
                glosa_principal_asiento, total_debe_asiento, total_haber_asiento,
                estado_asiento, origen_documento_referencia_id, origen_documento_tabla_referencia,
                usuario_creacion_id, fecha_creacion_registro
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
            RETURNING asiento_cabecera_id, numero_asiento_completo;
        `;
        const asientoResult = await client.query(insertAsientoQuery, [
            empresa_id, periodo_contable_id, tipo_asiento_contable_id, nextCorrelativo,
            codigoTipoAsiento, 
            fecha_contabilizacion_asiento, moneda_id_asiento, tipo_cambio_asiento || 1.0000,
            glosa_principal_asiento, 
            totalDebeCalculado, // <-- Se usa el total calculado en el backend
            totalHaberCalculado, // <-- Se usa el total calculado en el backend
            'Cuadrado', 
            origen_documento_referencia_id || null, origen_documento_tabla_referencia || null,
            usuarioId
        ]);

        const nuevoAsiento = asientoResult.rows[0];

        if (detalles && detalles.length > 0) {
            for (const detalle of detalles) {
                const insertDetalleQuery = `
                    INSERT INTO AsientosContablesDetalle (
                        asiento_cabecera_id, cuenta_contable_id, secuencia_linea_asiento, glosa_detalle_linea,
                        monto_debe, monto_haber, moneda_id_linea, importe_moneda_origen_linea,
                        centro_costo_id, tipo_tercero_analisis, tercero_analisis_id,
                        documento_referencia_linea, fecha_documento_referencia_linea
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13);
                `;
                await client.query(insertDetalleQuery, [
                    nuevoAsiento.asiento_cabecera_id, detalle.cuenta_contable_id, detalle.secuencia_linea_asiento,
                    detalle.glosa_detalle_linea || null, detalle.monto_debe || 0, detalle.monto_haber || 0, detalle.moneda_id_linea,
                    detalle.importe_moneda_origen_linea || null, detalle.centro_costo_id || null, detalle.tipo_tercero_analisis || null,
                    detalle.tercero_analisis_id || null, detalle.documento_referencia_linea || null, detalle.fecha_documento_referencia_linea || null
                ]);
            }
        }

        await client.query('COMMIT'); 

        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'CREACION',
            tabla_afectada: 'AsientosContablesCabecera', 
            registro_afectado_id: nuevoAsiento.asiento_cabecera_id.toString(),
            valor_nuevo: JSON.stringify({ ...asiento, ...nuevoAsiento }), 
            exito_operacion: true,
            modulo_sistema_origen: 'Contabilidad - Asientos Contables'
        });

        // Devolvemos el asiento con los totales correctos
        const asientoCreado = await getAsientoContableById(nuevoAsiento.asiento_cabecera_id, empresa_id);
        return asientoCreado!;

    } catch (error: any) {
        await client.query('ROLLBACK'); 
        console.error("Error al crear asiento contable:", error);
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'CREACION',
            tabla_afectada: 'AsientosContablesCabecera', 
            registro_afectado_id: 'N/A',
            valor_nuevo: JSON.stringify(asiento),
            exito_operacion: false,
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Contabilidad - Asientos Contables'
        });
        throw error;
    } finally {
        client.release(); 
    }
};

// Actualizar un asiento contable
export const updateAsientoContable = async (asientoId: number, asientoData: Partial<AsientoContableCabecera>, usuarioId: number, nombreUsuario: string): Promise<AsientoContableCabecera | null> => {
    const client = await pool.connect();
    const valorAnterior = await getAsientoContableById(asientoId, asientoData.empresa_id!); 
    if (!valorAnterior) {
        // ... (lógica de auditoría para error de 'no encontrado' se mantiene) ...
        throw new Error('Asiento contable no encontrado.');
    }

    try {
        await client.query('BEGIN');

        const { detalles, ...cabeceraData } = asientoData;

        // --- ¡INICIO DE LA CORRECCIÓN! ---
        // 1. Recalculamos los totales en el backend. Si vienen detalles nuevos, los usamos. Si no, usamos los existentes.
        const detallesParaCalculo = detalles && detalles.length > 0 ? detalles : valorAnterior.detalles;
        let totalDebeCalculado = 0;
        let totalHaberCalculado = 0;
        if (detallesParaCalculo && detallesParaCalculo.length > 0) {
            totalDebeCalculado = detallesParaCalculo.reduce((sum, d) => sum + (Number(d.monto_debe) || 0), 0);
            totalHaberCalculado = detallesParaCalculo.reduce((sum, d) => sum + (Number(d.monto_haber) || 0), 0);
        }

        // 2. Validamos que el asiento esté cuadrado ANTES de intentar guardarlo.
        if (totalDebeCalculado.toFixed(2) !== totalHaberCalculado.toFixed(2)) {
            throw new Error(`El asiento está descuadrado. Total Debe: ${totalDebeCalculado.toFixed(2)}, Total Haber: ${totalHaberCalculado.toFixed(2)}`);
        }
        // --- FIN DE LA CORRECCIÓN ---

        const updateCabeceraQuery = `
            UPDATE AsientosContablesCabecera SET
                periodo_contable_id = $1, tipo_asiento_contable_id = $2,
                fecha_contabilizacion_asiento = $3, moneda_id_asiento = $4, tipo_cambio_asiento = $5,
                glosa_principal_asiento = $6, total_debe_asiento = $7, total_haber_asiento = $8,
                estado_asiento = $9, origen_documento_referencia_id = $10, origen_documento_tabla_referencia = $11,
                usuario_modificacion_id = $12, fecha_modificacion = NOW()
            WHERE asiento_cabecera_id = $13 AND empresa_id = $14
            RETURNING *;
        `;

        await client.query(updateCabeceraQuery, [
            cabeceraData.periodo_contable_id ?? valorAnterior.periodo_contable_id,
            cabeceraData.tipo_asiento_contable_id ?? valorAnterior.tipo_asiento_contable_id,
            cabeceraData.fecha_contabilizacion_asiento ?? valorAnterior.fecha_contabilizacion_asiento,
            cabeceraData.moneda_id_asiento ?? valorAnterior.moneda_id_asiento,
            cabeceraData.tipo_cambio_asiento ?? valorAnterior.tipo_cambio_asiento,
            cabeceraData.glosa_principal_asiento ?? valorAnterior.glosa_principal_asiento,
            totalDebeCalculado, // <-- Se usa el total calculado en el backend
            totalHaberCalculado, // <-- Se usa el total calculado en el backend
            cabeceraData.estado_asiento ?? valorAnterior.estado_asiento,
            cabeceraData.origen_documento_referencia_id ?? valorAnterior.origen_documento_referencia_id,
            cabeceraData.origen_documento_tabla_referencia ?? valorAnterior.origen_documento_tabla_referencia,
            usuarioId,
            asientoId,
            asientoData.empresa_id
        ]);

        if (detalles) {
            await client.query('DELETE FROM AsientosContablesDetalle WHERE asiento_cabecera_id = $1', [asientoId]);
            for (const detalle of detalles) {
                const insertDetalleQuery = `
                    INSERT INTO AsientosContablesDetalle (
                        asiento_cabecera_id, cuenta_contable_id, secuencia_linea_asiento, glosa_detalle_linea,
                        monto_debe, monto_haber, moneda_id_linea, importe_moneda_origen_linea,
                        centro_costo_id, tipo_tercero_analisis, tercero_analisis_id,
                        documento_referencia_linea, fecha_documento_referencia_linea
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13);
                `;
                await client.query(insertDetalleQuery, [
                    asientoId, detalle.cuenta_contable_id, detalle.secuencia_linea_asiento,
                    detalle.glosa_detalle_linea || null, detalle.monto_debe || 0, detalle.monto_haber || 0, detalle.moneda_id_linea,
                    detalle.importe_moneda_origen_linea || null, detalle.centro_costo_id || null, detalle.tipo_tercero_analisis || null,
                    detalle.tercero_analisis_id || null, detalle.documento_referencia_linea || null, detalle.fecha_documento_referencia_linea || null
                ]);
            }
        }

        await client.query('COMMIT');

        const asientoActualizadoCompleto = await getAsientoContableById(asientoId, asientoData.empresa_id!);

        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'AsientosContablesCabecera', 
            registro_afectado_id: asientoId.toString(),
            valor_anterior: JSON.stringify(valorAnterior), 
            valor_nuevo: JSON.stringify(asientoActualizadoCompleto),
            exito_operacion: true,
            modulo_sistema_origen: 'Contabilidad - Asientos Contables'
        });

        return asientoActualizadoCompleto;

    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error("Error al actualizar asiento contable:", error);
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'AsientosContablesCabecera', 
            registro_afectado_id: asientoId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify(asientoData),
            exito_operacion: false,
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Contabilidad - Asientos Contables'
        });
        throw error;
    } finally {
        client.release();
    }
};

            

// Eliminar (anular) un asiento contable
export const deleteAsientoContable = async (asientoId: number, empresaId: number, usuarioId: number, nombreUsuario: string): Promise<boolean> => {
    // Esta llamada a getAsientoContableById ahora usará la versión corregida sin la columna problemática
    const valorAnterior = await getAsientoContableById(asientoId, empresaId);
    if (!valorAnterior) {
        // ... (lógica de auditoría para 'no encontrado' se mantiene) ...
        throw new Error('Asiento contable no encontrado.');
    }

    try {
        // ¡CORRECCIÓN! La tabla AsientosContablesCabecera NO tiene usuario_modificacion_id ni fecha_modificacion.
        // Solo actualizamos el estado.
        const result = await pool.query(
            `UPDATE AsientosContablesCabecera SET 
                estado_asiento = 'Anulado'
             WHERE asiento_cabecera_id = $1 AND empresa_id = $2`,
            [asientoId, empresaId] // Ya no pasamos usuarioId aquí
        );

        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'AsientosContablesCabecera', 
            registro_afectado_id: asientoId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify({ ...valorAnterior, estado_asiento: 'Anulado' }),
            exito_operacion: true,
            modulo_sistema_origen: 'Contabilidad - Asientos Contables'
        });

        return (result.rowCount ?? 0) > 0;
    } catch (error: any) {
        // ... (código del catch se mantiene igual) ...
        console.error("Error al anular asiento contable:", error);
        await logAuditoria({
             usuario_id_accion: usuarioId, 
             nombre_usuario_accion: nombreUsuario, 
             tipo_evento: 'ELIMINACION_LOGICA',
             tabla_afectada: 'AsientosContablesCabecera', 
             registro_afectado_id: asientoId.toString(),
             valor_anterior: JSON.stringify(valorAnterior),
             valor_nuevo: null,
             exito_operacion: false,
             mensaje_error_si_fallo: error.message,
             modulo_sistema_origen: 'Contabilidad - Asientos Contables'
        });
        throw error;
    }
};

// Exportar asientos contables a Excel
export const exportarAsientosContables = async (empresaId: number, filters: AsientoContableFilters): Promise<any[]> => {
    const allowedFilterKeys = ['numero_asiento_completo', 'tipo_asiento_descripcion', 'estado_asiento'];
    let query = `
        SELECT 
            ac.numero_asiento_completo as "Nro. Asiento",
            TO_CHAR(ac.fecha_contabilizacion_asiento, 'DD/MM/YYYY') as "Fecha",
            tac.descripcion_tipo_asiento as "Tipo Asiento",
            ac.glosa_principal_asiento as "Glosa Principal",
            m.nombre_moneda as "Moneda",
            ac.total_debe_asiento as "Total Debe",
            ac.total_haber_asiento as "Total Haber",
            ac.estado_asiento as "Estado",
            u_creacion.nombres_completos_persona as "Creado Por",
            TO_CHAR(ac.fecha_creacion_registro, 'DD/MM/YYYY HH24:MI:SS') as "Fecha Creación", 
            u_modificacion.nombres_completos_persona as "Modificado Por",
            TO_CHAR(ac.fecha_modificacion, 'DD/MM/YYYY HH24:MI:SS') as "Fecha Modificación" 
        FROM AsientosContablesCabecera ac
        JOIN TiposAsientoContable tac ON ac.tipo_asiento_contable_id = tac.tipo_asiento_contable_id
        JOIN Monedas m ON ac.moneda_id_asiento = m.moneda_id
        LEFT JOIN Usuarios u_creacion ON ac.usuario_creacion_id = u_creacion.usuario_id
        LEFT JOIN Usuarios u_modificacion ON ac.usuario_modificacion_id = u_modificacion.usuario_id
        WHERE ac.empresa_id = $1
    `;
    
    const queryParams: any[] = [empresaId];
    let whereClause = '';
    let paramIndex = 2;

    Object.keys(filters).forEach(_key => {
        const key = _key as keyof AsientoContableFilters;
        const value = filters[key];
        if (allowedFilterKeys.includes(key) && value !== undefined && value !== null) {
            whereClause += ` AND ac.${key}::text ILIKE $${paramIndex}`; 
            queryParams.push(`%${value}%`);
            paramIndex++;
        }
    });

    const finalQuery = query + whereClause + ' ORDER BY ac.fecha_contabilizacion_asiento DESC';
    const result = await pool.query(finalQuery, queryParams);
    return result.rows;
};

export const createAsientoContableConClient = async (asiento: AsientoContableCabecera, usuarioId: number, nombreUsuario: string, client: PoolClient): Promise<AsientoContableCabecera> => {
    // Esta función no inicia ni termina una transacción, solo usa la que se le pasa.
    try {
        const {
            empresa_id, periodo_contable_id, tipo_asiento_contable_id,
            fecha_contabilizacion_asiento, moneda_id_asiento, tipo_cambio_asiento,
            glosa_principal_asiento, origen_documento_referencia_id, origen_documento_tabla_referencia,
            detalles 
        } = asiento;

        let totalDebeCalculado = 0;
        let totalHaberCalculado = 0;
        if (detalles && detalles.length > 0) {
            totalDebeCalculado = detalles.reduce((sum, d) => sum + (Number(d.monto_debe) || 0), 0);
            totalHaberCalculado = detalles.reduce((sum, d) => sum + (Number(d.monto_haber) || 0), 0);
        }

        if (totalDebeCalculado.toFixed(2) !== totalHaberCalculado.toFixed(2)) {
            throw new Error(`Asiento interno descuadrado. Total Debe: ${totalDebeCalculado.toFixed(2)}, Total Haber: ${totalHaberCalculado.toFixed(2)}`);
        }

        const correlativoQuery = await client.query(
            `SELECT COALESCE(MAX(correlativo_tipo_asiento_periodo), 0) + 1 as next_correlativo
             FROM AsientosContablesCabecera
             WHERE empresa_id = $1 AND periodo_contable_id = $2 AND tipo_asiento_contable_id = $3`,
            [empresa_id, periodo_contable_id, tipo_asiento_contable_id]
        );
        const nextCorrelativo = correlativoQuery.rows[0].next_correlativo;

        const tipoAsientoQuery = await client.query(
            `SELECT codigo_tipo_asiento FROM TiposAsientoContable WHERE tipo_asiento_contable_id = $1`,
            [tipo_asiento_contable_id]
        );
        const codigoTipoAsiento = tipoAsientoQuery.rows[0]?.codigo_tipo_asiento;
        if (!codigoTipoAsiento) {
            throw new Error('Código de tipo de asiento no encontrado para el asiento automático.');
        }

        const insertAsientoQuery = `
            INSERT INTO AsientosContablesCabecera (
                empresa_id, periodo_contable_id, tipo_asiento_contable_id, correlativo_tipo_asiento_periodo, 
                codigo_tipo_asiento_referencia, fecha_contabilizacion_asiento, moneda_id_asiento, tipo_cambio_asiento,
                glosa_principal_asiento, total_debe_asiento, total_haber_asiento, estado_asiento, 
                origen_documento_referencia_id, origen_documento_tabla_referencia, usuario_creacion_id, fecha_creacion_registro
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
            RETURNING asiento_cabecera_id, numero_asiento_completo;
        `;
        const asientoResult = await client.query(insertAsientoQuery, [
            empresa_id, periodo_contable_id, tipo_asiento_contable_id, nextCorrelativo,
            codigoTipoAsiento, fecha_contabilizacion_asiento, moneda_id_asiento, tipo_cambio_asiento || 1.0000,
            glosa_principal_asiento, totalDebeCalculado, totalHaberCalculado, 'Cuadrado', 
            origen_documento_referencia_id || null, origen_documento_tabla_referencia || null, usuarioId
        ]);
        const nuevoAsiento = asientoResult.rows[0];

        if (detalles && detalles.length > 0) {
            for (const detalle of detalles) {
                const insertDetalleQuery = `
                    INSERT INTO AsientosContablesDetalle (
                        asiento_cabecera_id, cuenta_contable_id, secuencia_linea_asiento, glosa_detalle_linea,
                        monto_debe, monto_haber, moneda_id_linea, tipo_tercero_analisis, tercero_analisis_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
                `;
                await client.query(insertDetalleQuery, [
                    nuevoAsiento.asiento_cabecera_id, detalle.cuenta_contable_id, detalle.secuencia_linea_asiento,
                    detalle.glosa_detalle_linea || null, detalle.monto_debe || 0, detalle.monto_haber || 0,
                    detalle.moneda_id_linea, detalle.tipo_tercero_analisis || null, detalle.tercero_analisis_id || null
                ]);
            }
        }
        return { ...asiento, ...nuevoAsiento };
    } catch (error) {
        console.error("Error dentro de createAsientoContableConClient:", error);
        // No hacemos rollback aquí, se maneja en la función que llama (createFacturaVenta)
        throw error;
    }
};