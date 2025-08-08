// Archivo: backend/src/services/pagoRecibido.service.ts
import pool from '../config/database';
import { logAuditoria } from './auditoria.service';
import { Cliente } from './cliente.service'; // Para tipar el cliente
import { CuentaBancariaPropia } from './cuentaBancaria.service'; // Para tipar la cuenta bancaria

// Interfaz para la respuesta paginada (reutilizable)
export interface PagedResult<T> {
    records: T[];
    total_records: number;
    total_pages: number;
    current_page: number;
}

// Interfaz completa de Pago Recibido
export interface PagoRecibido {
    pago_recibido_id?: number;
    empresa_id_receptora: number;
    fecha_pago: string;
    moneda_id_pago: number;
    monto_total_pagado_cliente: number;
    tipo_cambio_pago?: number;
    medio_pago_utilizado: string; // Ej: Transferencia, Cheque, Efectivo
    referencia_medio_pago?: string; // Nro. de operación, Nro. de cheque
    cuenta_bancaria_propia_destino_id?: number; // A qué cuenta se recibió el pago
    cliente_id?: number; // De quién se recibió el pago (si es de cliente)
    glosa_o_descripcion_pago?: string;
    estado_pago?: string; // Ej: Recibido, Pendiente, Anulado
    es_adelanto?: boolean;
    facturas_a_pagar?: { factura_venta_id: number; monto_aplicado: number }[];
    // Campos de auditoría (asumiendo que existen en la tabla)
    usuario_creacion_id?: number;
    fecha_creacion?: string;
    usuario_modificacion_id?: number;
    fecha_modificacion?: string;

    // Campos adicionales para JOINs
    moneda_nombre?: string;
    cuenta_bancaria_nombre?: string;
    cliente_razon_social?: string;
}

// Obtener todos los pagos recibidos con filtros y paginación
export const getAllPagosRecibidos = async (empresaId: number, page: number, limit: number, filters: any): Promise<PagedResult<any>> => {
    const allowedFilterKeys = ['medio_pago_utilizado', 'cliente_razon_social', 'estado_pago', 'fecha_pago'];
    let query = `
        SELECT 
            pr.pago_recibido_id, pr.fecha_pago, pr.monto_total_pagado_cliente,
            pr.medio_pago_utilizado, pr.estado_pago,
            m.nombre_moneda as moneda_nombre,
            cb.alias_o_descripcion_cuenta as cuenta_bancaria_nombre,
            c.razon_social_o_nombres as cliente_razon_social
            -- u.nombres_completos_persona as creado_por -- Si tu tabla tiene usuario_creacion_id
        FROM pagosrecibidoscxc pr
        JOIN monedas m ON pr.moneda_id_pago = m.moneda_id
        LEFT JOIN cuentasbancariaspropias cb ON pr.cuenta_bancaria_propia_destino_id = cb.cuenta_bancaria_id
        LEFT JOIN clientes c ON pr.cliente_id = c.cliente_id
        -- LEFT JOIN usuarios u ON pr.usuario_creacion_id = u.usuario_id
        WHERE pr.empresa_id_receptora = $1
    `;
    const countQueryBase = `SELECT COUNT(*) FROM pagosrecibidoscxc pr WHERE pr.empresa_id_receptora = $1`;

    const queryParams: any[] = [empresaId];
    let whereClause = '';
    let paramIndex = 2;

    Object.keys(filters).forEach(key => {
        if (allowedFilterKeys.includes(key) && filters[key]) {
            if (key === 'fecha_pago') {
                whereClause += ` AND pr.${key} = $${paramIndex}`;
                queryParams.push(filters[key]);
            } else if (key === 'cliente_razon_social') {
                whereClause += ` AND c.razon_social_o_nombres ILIKE $${paramIndex}`;
                queryParams.push(`%${filters[key]}%`);
            } else {
                whereClause += ` AND pr.${key}::text ILIKE $${paramIndex}`; 
                queryParams.push(`%${filters[key]}%`);
            }
            paramIndex++;
        }
    });

    const finalQuery = query + whereClause + ' ORDER BY pr.fecha_pago DESC, pr.pago_recibido_id DESC';
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

// Obtener un pago recibido por su ID
export const getPagoRecibidoById = async (pagoId: number, empresaId: number) => {
    const query = `
        SELECT 
            pr.*,
            m.nombre_moneda as moneda_nombre,
            cb.alias_o_descripcion_cuenta as cuenta_bancaria_nombre,
            c.razon_social_o_nombres as cliente_razon_social
            -- uc.nombres_completos_persona as creado_por, -- Si tu tabla tiene usuario_creacion_id
            -- um.nombres_completos_persona as modificado_por -- Si tu tabla tiene usuario_modificacion_id
        FROM pagosrecibidoscxc pr
        JOIN monedas m ON pr.moneda_id_pago = m.moneda_id
        LEFT JOIN cuentasbancariaspropias cb ON pr.cuenta_bancaria_propia_destino_id = cb.cuenta_bancaria_id
        LEFT JOIN clientes c ON pr.cliente_id = c.cliente_id
        -- LEFT JOIN usuarios uc ON pr.usuario_creacion_id = uc.usuario_id
        -- LEFT JOIN usuarios um ON pr.usuario_modificacion_id = um.usuario_id
        WHERE pr.pago_recibido_id = $1 AND pr.empresa_id_receptora = $2
    `;
    const result = await pool.query(query, [pagoId, empresaId]);
    return result.rows[0] || null;
};

// Crear un nuevo pago recibido
export const createPagoRecibido = async (pago: PagoRecibido, usuarioId: number, nombreUsuario: string): Promise<PagoRecibido> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const {
            empresa_id_receptora, cliente_id, fecha_pago, moneda_id_pago,
            monto_total_pagado_cliente, tipo_cambio_pago, medio_pago_utilizado,
            referencia_medio_pago, cuenta_bancaria_propia_destino_id,
            glosa_o_descripcion_pago, es_adelanto, facturas_a_pagar
        } = pago;

        let pagoCreado;

        // Hacemos la comprobación de forma explícita y segura.
        // Un pago se considera adelanto si el checkbox `es_adelanto` es true.
        if (es_adelanto === true) {
            // --- FLUJO PARA PAGO POR ADELANTADO ---
            if (!cliente_id) {
                throw new Error('Se requiere un cliente para registrar un pago por adelantado.');
            }
            
            const insertPagoQuery = `
                INSERT INTO public.pagosrecibidoscxc (
                    empresa_id_receptora, cliente_id, fecha_pago, moneda_id_pago, monto_total_pagado_cliente, 
                    medio_pago_utilizado, referencia_medio_pago, cuenta_bancaria_propia_destino_id, 
                    glosa_o_descripcion_pago, estado_pago, usuario_creacion_id, fecha_creacion
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'No Aplicado', $10, NOW()) RETURNING *;
            `;
            const pagoResult = await client.query(insertPagoQuery, [
                empresa_id_receptora, cliente_id, fecha_pago, moneda_id_pago,
                monto_total_pagado_cliente, medio_pago_utilizado, referencia_medio_pago || null,
                cuenta_bancaria_propia_destino_id || null, 'PAGO POR ADELANTADO', usuarioId
            ]);
            pagoCreado = pagoResult.rows[0];
            
            // Actualizamos el saldo a favor del cliente
            await client.query(
                'UPDATE public.clientes SET saldo_a_favor = saldo_a_favor + $1 WHERE cliente_id = $2;',
                [monto_total_pagado_cliente, cliente_id]
            );

        } else {
            // --- FLUJO NORMAL (para pagos aplicados a facturas o pagos genéricos) ---
            const insertPagoQuery = `
                INSERT INTO public.pagosrecibidoscxc (
                    empresa_id_receptora, fecha_pago, moneda_id_pago, monto_total_pagado_cliente,
                    tipo_cambio_pago, medio_pago_utilizado, referencia_medio_pago,
                    cuenta_bancaria_propia_destino_id, cliente_id, glosa_o_descripcion_pago,
                    estado_pago, usuario_creacion_id, fecha_creacion
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Recibido', $11, NOW())
                RETURNING *`;
            const result = await client.query(insertPagoQuery, [
                empresa_id_receptora, fecha_pago, moneda_id_pago, monto_total_pagado_cliente,
                tipo_cambio_pago || 1.0000, medio_pago_utilizado, referencia_medio_pago || null,
                cuenta_bancaria_propia_destino_id || null, cliente_id || null, glosa_o_descripcion_pago || null,
                usuarioId
            ]);
            pagoCreado = result.rows[0];
            
            // (Futuro) Aquí se añadiría la lógica para iterar sobre 'facturas_a_pagar' y crear las aplicaciones.
        }

        await client.query('COMMIT');

        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'CREACION',
            tabla_afectada: 'pagosrecibidoscxc', 
            registro_afectado_id: pagoCreado.pago_recibido_id.toString(),
            valor_nuevo: JSON.stringify(pagoCreado),
            exito_operacion: true,
            modulo_sistema_origen: 'Tesoreria - Pagos Recibidos'
        });

        return pagoCreado;

    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error("Error al crear pago recibido:", error);
        
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'CREACION',
            tabla_afectada: 'pagosrecibidoscxc', 
            registro_afectado_id: 'N/A',
            valor_nuevo: JSON.stringify(pago),
            exito_operacion: false,
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Tesoreria - Pagos Recibidos'
        });

        throw error;
    } finally {
        client.release();
    }
};

// Actualizar un pago recibido
export const updatePagoRecibido = async (pagoId: number, pagoData: Partial<PagoRecibido>, usuarioId: number, nombreUsuario: string) => {
    const valorAnterior = await getPagoRecibidoById(pagoId, pagoData.empresa_id_receptora!);
    if (!valorAnterior) {
        await logAuditoria({
            usuario_id_accion: usuarioId,
            nombre_usuario_accion: nombreUsuario,
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'pagosrecibidoscxc',
            registro_afectado_id: pagoId.toString(),
            descripcion_detallada_evento: `Intento de actualización de pago recibido no encontrado (ID: ${pagoId}).`,
            exito_operacion: false,
            mensaje_error_si_fallo: 'Pago recibido no encontrado para actualizar.',
            modulo_sistema_origen: 'Tesoreria - Pagos Recibidos'
        });
        throw new Error('Pago recibido no encontrado.');
    }

    const {
        fecha_pago, moneda_id_pago, monto_total_pagado_cliente,
        tipo_cambio_pago, medio_pago_utilizado, referencia_medio_pago,
        cuenta_bancaria_propia_destino_id, cliente_id, glosa_o_descripcion_pago,
        estado_pago
    } = pagoData;

    try {
        const result = await pool.query(
            `UPDATE pagosrecibidoscxc SET
                fecha_pago = $1, moneda_id_pago = $2, monto_total_pagado_cliente = $3,
                tipo_cambio_pago = $4, medio_pago_utilizado = $5, referencia_medio_pago = $6,
                cuenta_bancaria_propia_destino_id = $7, cliente_id = $8, glosa_o_descripcion_pago = $9,
                estado_pago = $10
                -- usuario_modificacion_id = $11, fecha_modificacion = NOW() -- Si tu tabla tiene estas columnas
            WHERE pago_recibido_id = $11 AND empresa_id_receptora = $12
            RETURNING *`,
            [
                fecha_pago ?? valorAnterior.fecha_pago,
                moneda_id_pago ?? valorAnterior.moneda_id_pago,
                monto_total_pagado_cliente ?? valorAnterior.monto_total_pagado_cliente,
                tipo_cambio_pago ?? valorAnterior.tipo_cambio_pago,
                medio_pago_utilizado ?? valorAnterior.medio_pago_utilizado,
                referencia_medio_pago ?? valorAnterior.referencia_medio_pago,
                cuenta_bancaria_propia_destino_id ?? valorAnterior.cuenta_bancaria_propia_destino_id,
                cliente_id ?? valorAnterior.cliente_id,
                glosa_o_descripcion_pago ?? valorAnterior.glosa_o_descripcion_pago,
                estado_pago ?? valorAnterior.estado_pago,
                // usuarioId, -- Si tu tabla tiene estas columnas
                pagoId,
                pagoData.empresa_id_receptora
            ]
        );
        const pagoActualizado = result.rows[0];

        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'pagosrecibidoscxc', 
            registro_afectado_id: pagoId.toString(),
            valor_anterior: JSON.stringify(valorAnterior), 
            valor_nuevo: JSON.stringify(pagoActualizado),
            exito_operacion: true,
            modulo_sistema_origen: 'Tesoreria - Pagos Recibidos'
        });

        return pagoActualizado;
    } catch (error: any) {
        console.error("Error al actualizar pago recibido:", error);
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'pagosrecibidoscxc', 
            registro_afectado_id: pagoId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify(pagoData),
            exito_operacion: false,
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Tesoreria - Pagos Recibidos'
        });
        throw error;
    }
};

// Eliminar (anular) un pago recibido
export const deletePagoRecibido = async (pagoId: number, empresaId: number, usuarioId: number, nombreUsuario: string) => {
    const valorAnterior = await getPagoRecibidoById(pagoId, empresaId);
    if (!valorAnterior) {
        await logAuditoria({
            usuario_id_accion: usuarioId,
            nombre_usuario_accion: nombreUsuario,
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'pagosrecibidoscxc',
            registro_afectado_id: pagoId.toString(),
            descripcion_detallada_evento: `Intento de anulación de pago recibido no encontrado (ID: ${pagoId}).`,
            exito_operacion: false,
            mensaje_error_si_fallo: 'Pago recibido no encontrado para anular.',
            modulo_sistema_origen: 'Tesoreria - Pagos Recibidos'
        });
        throw new Error('Pago recibido no encontrado.');
    }

    try {
        const result = await pool.query(
            `UPDATE pagosrecibidoscxc SET 
                estado_pago = 'Anulado'
                -- usuario_modificacion_id = $1, fecha_modificacion = NOW() -- Si tu tabla tiene estas columnas
              WHERE pago_recibido_id = $1 AND empresa_id_receptora = $2`,
            [pagoId, empresaId] // Ajuste de parámetros
        );

        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'pagosrecibidoscxc', 
            registro_afectado_id: pagoId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify({ ...valorAnterior, estado_pago: 'Anulado' }),
            exito_operacion: true,
            modulo_sistema_origen: 'Tesoreria - Pagos Recibidos'
        });

        return (result.rowCount ?? 0) > 0;
    } catch (error: any) {
        console.error("Error al anular pago recibido:", error);
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'pagosrecibidoscxc', 
            registro_afectado_id: pagoId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify({ ...valorAnterior, estado_pago: 'ERROR_NO_ANULADO' }),
            exito_operacion: false,
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Tesoreria - Pagos Recibidos'
        });
        throw error;
    }
};
