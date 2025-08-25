// Archivo: backend/src/services/pagoRealizado.service.ts
import pool from '../config/database';
import { logAuditoria } from './auditoria.service';
import { Proveedor } from './proveedor.service'; // Para tipar el proveedor
import { CuentaBancariaPropia } from './cuentaBancaria.service'; // Para tipar la cuenta bancaria

// Interfaz para la respuesta paginada (reutilizable)
export interface PagedResult<T> {
    records: T[];
    total_records: number;
    total_pages: number;
    current_page: number;
}

// Interfaz completa de Pago Realizado
export interface PagoRealizado {
    pago_realizado_id?: number;
    empresa_id_pagadora: number;
    fecha_efectiva_pago: string;
    moneda_id_pago: number;
    monto_total_desembolsado: number;
    tipo_cambio_pago?: number;
    medio_pago_utilizado: string; // Ej: Transferencia, Cheque, Efectivo
    referencia_medio_pago?: string; // Nro. de operación, Nro. de cheque
    cuenta_bancaria_propia_origen_id?: number; // Desde qué cuenta se pagó
    proveedor_id_beneficiario?: number; // A quién se pagó (si es a proveedor)
    glosa_o_descripcion_pago?: string;
    estado_pago?: string; // Ej: Realizado, Pendiente, Anulado

    // Campos de auditoría (asumiendo que existen en la tabla)
    usuario_creacion_id?: number;
    fecha_creacion?: string;
    usuario_modificacion_id?: number;
    fecha_modificacion?: string;

    // Campos adicionales para JOINs
    moneda_nombre?: string;
    cuenta_bancaria_nombre?: string;
    proveedor_razon_social?: string;
}


// --- ASEGÚRATE DE QUE ESTA FUNCIÓN ESTÉ ASÍ EN TU ARCHIVO ---
export const getAllPagosRealizados = async (empresaId: number, page: number, limit: number, filters: any): Promise<PagedResult<any>> => {
    
    // --- CONSULTA PARA OBTENER LOS DATOS CON FILTROS ---
    let query = `
        SELECT 
            pr.pago_realizado_id, 
            pr.fecha_efectiva_pago, 
            pr.monto_total_desembolsado,
            pr.medio_pago_utilizado, 
            pr.estado_pago,
            m.nombre_moneda as moneda_nombre,
            p.razon_social_o_nombres as proveedor_razon_social,
            cb.alias_o_descripcion_cuenta as cuenta_bancaria_nombre,
            u_creacion.nombres_completos_persona as creado_por
        FROM public.pagosrealizadoscxp pr
        JOIN public.monedas m ON pr.moneda_id_pago = m.moneda_id
        LEFT JOIN public.proveedores p ON pr.proveedor_id_beneficiario = p.proveedor_id
        LEFT JOIN public.cuentasbancariaspropias cb ON pr.cuenta_bancaria_propia_origen_id = cb.cuenta_bancaria_id
        LEFT JOIN public.usuarios u_creacion ON pr.usuario_creacion_id = u_creacion.usuario_id
        WHERE pr.empresa_id_pagadora = $1
    `;
    
    const queryParams: any[] = [empresaId];
    let whereClause = '';
    let paramIndex = 2;

    const allowedFilterKeys = ['medio_pago_utilizado', 'proveedor_razon_social', 'estado_pago', 'fecha_efectiva_pago'];

    Object.keys(filters).forEach(key => {
        if (allowedFilterKeys.includes(key) && filters[key]) {
            if (key === 'proveedor_razon_social') {
                whereClause += ` AND p.razon_social_o_nombres ILIKE $${paramIndex}`;
            } else {
                whereClause += ` AND pr.${key}::text ILIKE $${paramIndex}`;
            }
            queryParams.push(`%${filters[key]}%`);
            paramIndex++;
        }
    });

    // --- CONSULTA PARA CONTAR EL TOTAL DE REGISTROS CON FILTROS ---
    const countQueryBase = `
        SELECT COUNT(*) 
        FROM public.pagosrealizadoscxp pr
        LEFT JOIN public.proveedores p ON pr.proveedor_id_beneficiario = p.proveedor_id
        WHERE pr.empresa_id_pagadora = $1
    `;
    const finalCountQuery = countQueryBase + whereClause.replace(/\$\d+/g, (match, offset, string) => {
        const index = parseInt(match.substring(1));
        return `$${index - (string.substring(0, offset).match(/pr\./g) || []).length}`;
    });
    
    const countParams = queryParams.slice(0, paramIndex-1);
    const totalResult = await pool.query(finalCountQuery, countParams);
    const total_records = parseInt(totalResult.rows[0].count, 10);

    const offset = (page - 1) * limit;
    const finalQuery = `${query} ${whereClause} ORDER BY pr.fecha_efectiva_pago DESC, pr.pago_realizado_id DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    const finalParams = [...queryParams, limit, offset];

    const result = await pool.query(finalQuery, finalParams);

    return {
        records: result.rows,
        total_records: total_records,
        total_pages: Math.ceil(total_records / limit) || 1,
        current_page: page
    };
};

// Obtener un pago realizado por su ID
export const getPagoRealizadoById = async (pagoId: number, empresaId: number) => {
    const query = `
        SELECT 
            pr.*,
            m.nombre_moneda as moneda_nombre,
            cb.alias_o_descripcion_cuenta as cuenta_bancaria_nombre,
            p.razon_social_o_nombres as proveedor_razon_social,
            u_creacion.nombres_completos_persona as creado_por,
            u_modificacion.nombres_completos_persona as modificado_por

        FROM pagosrealizadoscxp pr
        JOIN monedas m ON pr.moneda_id_pago = m.moneda_id
        LEFT JOIN cuentasbancariaspropias cb ON pr.cuenta_bancaria_propia_origen_id = cb.cuenta_bancaria_id
        LEFT JOIN proveedores p ON pr.proveedor_id_beneficiario = p.proveedor_id

        -- ¡CORRECCIÓN AQUÍ! Añadimos los LEFT JOIN a la tabla de usuarios
        LEFT JOIN usuarios u_creacion ON pr.usuario_creacion_id = u_creacion.usuario_id
        LEFT JOIN usuarios u_modificacion ON pr.usuario_modificacion_id = u_modificacion.usuario_id

        WHERE pr.pago_realizado_id = $1 AND pr.empresa_id_pagadora = $2
    `;
    const result = await pool.query(query, [pagoId, empresaId]);
    return result.rows[0] || null;
};

// Crear un nuevo pago realizado
export const createPagoRealizado = async (pago: PagoRealizado, usuarioId: number, nombreUsuario: string) => {
    const { 
        empresa_id_pagadora, fecha_efectiva_pago, moneda_id_pago, monto_total_desembolsado,
        tipo_cambio_pago, medio_pago_utilizado, referencia_medio_pago,
        cuenta_bancaria_propia_origen_id, proveedor_id_beneficiario, glosa_o_descripcion_pago
    } = pago;
    
    const result = await pool.query(
        `INSERT INTO pagosrealizadoscxp (
            empresa_id_pagadora, fecha_efectiva_pago, moneda_id_pago, monto_total_desembolsado,
            tipo_cambio_pago, medio_pago_utilizado, referencia_medio_pago,
            cuenta_bancaria_propia_origen_id, proveedor_id_beneficiario, glosa_o_descripcion_pago,
            estado_pago
            -- usuario_creacion_id, fecha_creacion -- Si tu tabla tiene estas columnas
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Realizado')
        RETURNING *`,
        [
            empresa_id_pagadora, fecha_efectiva_pago, moneda_id_pago, monto_total_desembolsado,
            tipo_cambio_pago || 1.0000, medio_pago_utilizado, referencia_medio_pago || null,
            cuenta_bancaria_propia_origen_id || null, proveedor_id_beneficiario || null, glosa_o_descripcion_pago || null
            // usuarioId, NOW() -- Si tu tabla tiene estas columnas
        ]
    );
    const nuevoPago = result.rows[0];

    await logAuditoria({
        usuario_id_accion: usuarioId, 
        nombre_usuario_accion: nombreUsuario, 
        tipo_evento: 'CREACION',
        tabla_afectada: 'pagosrealizadoscxp', 
        registro_afectado_id: nuevoPago.pago_realizado_id.toString(),
        valor_nuevo: JSON.stringify(nuevoPago),
        exito_operacion: true,
        modulo_sistema_origen: 'Tesoreria - Pagos Realizados'
    });

    return nuevoPago;
};

// Actualizar un pago realizado
export const updatePagoRealizado = async (pagoId: number, pagoData: Partial<PagoRealizado>, usuarioId: number, nombreUsuario: string) => {
    const valorAnterior = await getPagoRealizadoById(pagoId, pagoData.empresa_id_pagadora!);
    if (!valorAnterior) {
        await logAuditoria({
            usuario_id_accion: usuarioId,
            nombre_usuario_accion: nombreUsuario,
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'pagosrealizadoscxp',
            registro_afectado_id: pagoId.toString(),
            descripcion_detallada_evento: `Intento de actualización de pago realizado no encontrado (ID: ${pagoId}).`,
            exito_operacion: false,
            mensaje_error_si_fallo: 'Pago realizado no encontrado para actualizar.',
            modulo_sistema_origen: 'Tesoreria - Pagos Realizados'
        });
        throw new Error('Pago realizado no encontrado.');
    }

    const {
        fecha_efectiva_pago, moneda_id_pago, monto_total_desembolsado,
        tipo_cambio_pago, medio_pago_utilizado, referencia_medio_pago,
        cuenta_bancaria_propia_origen_id, proveedor_id_beneficiario, glosa_o_descripcion_pago,
        estado_pago
    } = pagoData;

    try {
        const result = await pool.query(
            `UPDATE pagosrealizadoscxp SET
                fecha_efectiva_pago = $1, moneda_id_pago = $2, monto_total_desembolsado = $3,
                tipo_cambio_pago = $4, medio_pago_utilizado = $5, referencia_medio_pago = $6,
                cuenta_bancaria_propia_origen_id = $7, proveedor_id_beneficiario = $8, glosa_o_descripcion_pago = $9,
                estado_pago = $10
                -- usuario_modificacion_id = $11, fecha_modificacion = NOW() -- Si tu tabla tiene estas columnas
            WHERE pago_realizado_id = $11 AND empresa_id_pagadora = $12
            RETURNING *`,
            [
                fecha_efectiva_pago ?? valorAnterior.fecha_efectiva_pago,
                moneda_id_pago ?? valorAnterior.moneda_id_pago,
                monto_total_desembolsado ?? valorAnterior.monto_total_desembolsado,
                tipo_cambio_pago ?? valorAnterior.tipo_cambio_pago,
                medio_pago_utilizado ?? valorAnterior.medio_pago_utilizado,
                referencia_medio_pago ?? valorAnterior.referencia_medio_pago,
                cuenta_bancaria_propia_origen_id ?? valorAnterior.cuenta_bancaria_propia_origen_id,
                proveedor_id_beneficiario ?? valorAnterior.proveedor_id_beneficiario,
                glosa_o_descripcion_pago ?? valorAnterior.glosa_o_descripcion_pago,
                estado_pago ?? valorAnterior.estado_pago,
                // usuarioId, -- Si tu tabla tiene estas columnas
                pagoId,
                pagoData.empresa_id_pagadora
            ]
        );
        const pagoActualizado = result.rows[0];

        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'pagosrealizadoscxp', 
            registro_afectado_id: pagoId.toString(),
            valor_anterior: JSON.stringify(valorAnterior), 
            valor_nuevo: JSON.stringify(pagoActualizado),
            exito_operacion: true,
            modulo_sistema_origen: 'Tesoreria - Pagos Realizados'
        });

        return pagoActualizado;
    } catch (error: any) {
        console.error("Error al actualizar pago realizado:", error);
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'pagosrealizadoscxp', 
            registro_afectado_id: pagoId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify(pagoData),
            exito_operacion: false,
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Tesoreria - Pagos Realizados'
        });
        throw error;
    }
};

// Eliminar (anular) un pago realizado
export const deletePagoRealizado = async (pagoId: number, empresaId: number, usuarioId: number, nombreUsuario: string) => {
    const valorAnterior = await getPagoRealizadoById(pagoId, empresaId);
    if (!valorAnterior) {
        await logAuditoria({
            usuario_id_accion: usuarioId,
            nombre_usuario_accion: nombreUsuario,
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'pagosrealizadoscxp',
            registro_afectado_id: pagoId.toString(),
            descripcion_detallada_evento: `Intento de anulación de pago realizado no encontrado (ID: ${pagoId}).`,
            exito_operacion: false,
            mensaje_error_si_fallo: 'Pago realizado no encontrado para anular.',
            modulo_sistema_origen: 'Tesoreria - Pagos Realizados'
        });
        throw new Error('Pago realizado no encontrado.');
    }

    try {
        const result = await pool.query(
            `UPDATE pagosrealizadoscxp SET 
                estado_pago = 'Anulado'
                -- usuario_modificacion_id = $1, fecha_modificacion = NOW() -- Si tu tabla tiene estas columnas
              WHERE pago_realizado_id = $1 AND empresa_id_pagadora = $2`,
            [pagoId, empresaId] // Ajuste de parámetros
        );

        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'pagosrealizadoscxp', 
            registro_afectado_id: pagoId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify({ ...valorAnterior, estado_pago: 'Anulado' }),
            exito_operacion: true,
            modulo_sistema_origen: 'Tesoreria - Pagos Realizados'
        });

        return (result.rowCount ?? 0) > 0;
    } catch (error: any) {
        console.error("Error al anular pago realizado:", error);
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'pagosrealizadoscxp', 
            registro_afectado_id: pagoId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify({ ...valorAnterior, estado_pago: 'ERROR_NO_ANULADO' }),
            exito_operacion: false,
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Tesoreria - Pagos Realizados'
        });
        throw error;
    }
};
