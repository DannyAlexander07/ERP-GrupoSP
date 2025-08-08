// Archivo: backend/src/services/compra.service.ts
import pool from '../config/database';
import { logAuditoria } from './auditoria.service';
import { Proveedor } from './proveedor.service'; 
import * as asientoContableService from './asientoContable.service';
import { Servicio } from './servicio.service'; // Se mantiene para tipado conceptual, aunque no se usa directamente en este módulo

// Interfaz para la respuesta paginada (reutilizable)
export interface PagedResult<T> {
    records: T[];
    total_records: number;
    total_pages: number;
    current_page: number;
}

// Interfaz para los Detalles de Factura de Compra (coincide con DetallesObligacion)
export interface DetalleFacturaCompra {
    detalle_factura_compra_id?: number; // Mapea a detalle_obligacion_id
    factura_compra_id?: number; // Mapea a obligacion_id
    descripcion_item_gasto: string; 
    cantidad?: number;
    valor_unitario_gasto?: number;
    monto_total_item_gasto: number;
    centro_costo_id?: number;
    proyecto_id_referencia?: number;
}

// Interfaz para la Factura de Compra (Cabecera) (coincide con Obligaciones)
export interface FacturaCompra {
    factura_compra_id?: number; // Mapea a obligacion_id
    empresa_id_compradora: number; // Mapea a empresa_id_deudora
    proveedor_id: number;
    tipo_comprobante_compra_id: number;
    tipo_obligacion_principal: string; 
    descripcion_general_compra: string; // Mapea a descripcion_general_obligacion
    numero_documento_proveedor?: string; 
    fecha_emision_documento_proveedor?: string; 
    fecha_recepcion_documento: string; 
    fecha_vencimiento_original: string;
    fecha_programada_pago?: string;
    moneda_id_obligacion: number;
    monto_total_original_obligacion: number;
    monto_detraccion?: number;
    monto_retencion_impuestos?: number;
    monto_neto_a_pagar_calculado?: number; 
    monto_total_pagado?: number; 
    saldo_pendiente_pago?: number; 
    estado_factura_compra?: string; // Mapea a estado_obligacion
    observaciones_compra?: string; // Mapea a observaciones_obligacion
    prioridad_pago?: number; 

    // ¡CAMPOS DE AUDITORÍA ELIMINADOS DE LA INTERFAZ!
    // No existen en tu tabla 'Obligaciones'
    // creado_por?: string;
    // fecha_creacion?: string;
    // modificado_por?: string;
    // fecha_modificacion?: string;

    // Para la creación/actualización, incluimos los detalles
    detalles?: DetalleFacturaCompra[];

    // Campos adicionales que pueden venir de JOINs para la tabla/detalle
    proveedor_razon_social?: string;
    tipo_comprobante_descripcion?: string;
    moneda_nombre?: string;
}

// Generar el siguiente número de documento de compra secuencial (si aplica)
export const getNextCompraDocumentNumber = async (empresaId: number, tipoComprobanteId: number, serie?: string): Promise<string> => {
    return `REG-${Math.floor(Math.random() * 10000).toString().padStart(5, '0')}`;
};

// Obtener todas las facturas de compra con filtros y paginación
export const getAllFacturasCompra = async (empresaId: number, page: number, limit: number, filters: any): Promise<PagedResult<any>> => {
    const allowedFilterKeys = ['numero_documento_proveedor', 'proveedor_razon_social', 'estado_factura_compra', 'fecha_recepcion_documento'];
    let query = `
        SELECT 
            fc.obligacion_id as factura_compra_id, -- Mapeo de ID
            fc.numero_documento_proveedor, fc.fecha_recepcion_documento,
            fc.monto_total_original_obligacion, 
            fc.estado_obligacion as estado_factura_compra, -- Mapeo de estado
            p.razon_social_o_nombres as proveedor_razon_social,
            tc.descripcion_comprobante as tipo_comprobante_descripcion,
            m.nombre_moneda as moneda_nombre
            -- Columnas de auditoría eliminadas de la selección
        FROM Obligaciones fc -- ¡CAMBIO DE NOMBRE DE TABLA!
        JOIN Proveedores p ON fc.proveedor_id = p.proveedor_id
        JOIN TiposComprobanteCompra tc ON fc.tipo_comprobante_compra_id = tc.tipo_comprobante_compra_id
        JOIN Monedas m ON fc.moneda_id_obligacion = m.moneda_id
        -- JOINs para usuarios de auditoría eliminados
        WHERE fc.empresa_id_deudora = $1 -- ¡CAMBIO DE NOMBRE DE COLUMNA!
    `;
    const countQueryBase = `SELECT COUNT(*) FROM Obligaciones fc WHERE fc.empresa_id_deudora = $1`; // ¡CAMBIO DE NOMBRE DE TABLA Y COLUMNA!

    const queryParams: any[] = [empresaId];
    let whereClause = '';
    let paramIndex = 2;

    Object.keys(filters).forEach(key => {
        if (allowedFilterKeys.includes(key) && filters[key]) {
            if (key === 'fecha_recepcion_documento') {
                whereClause += ` AND fc.${key} = $${paramIndex}`;
                queryParams.push(filters[key]);
            } else if (key === 'proveedor_razon_social') {
                whereClause += ` AND p.razon_social_o_nombres ILIKE $${paramIndex}`;
                queryParams.push(`%${filters[key]}%`);
            } else if (key === 'estado_factura_compra') { // Manejar el filtro por el nuevo nombre
                whereClause += ` AND fc.estado_obligacion ILIKE $${paramIndex}`;
                queryParams.push(`%${filters[key]}%`);
            }
            else {
                whereClause += ` AND fc.${key}::text ILIKE $${paramIndex}`; 
                queryParams.push(`%${filters[key]}%`);
            }
            paramIndex++;
        }
    });

    const finalQuery = query + whereClause + ' ORDER BY fc.fecha_recepcion_documento DESC, fc.obligacion_id DESC'; // Mapeo de ID
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

// Obtener una factura de compra por su ID con sus detalles y datos relacionados
export const getFacturaCompraById = async (facturaId: number, empresaId: number) => {
    const queryCabecera = `
        SELECT 
            fc.obligacion_id as factura_compra_id, -- Mapeo de ID
            fc.empresa_id_deudora as empresa_id_compradora, -- Mapeo de nombre
            fc.proveedor_id,
            fc.tipo_comprobante_compra_id,
            fc.tipo_obligacion_principal,
            fc.descripcion_general_obligacion as descripcion_general_compra, -- Mapeo de nombre
            fc.numero_documento_proveedor,
            fc.fecha_emision_documento_proveedor,
            fc.fecha_recepcion_documento,
            fc.fecha_vencimiento_original,
            fc.fecha_programada_pago,
            fc.moneda_id_obligacion,
            fc.monto_total_original_obligacion,
            fc.monto_detraccion,
            fc.monto_retencion_impuestos,
            fc.monto_neto_a_pagar_calculado,
            fc.monto_total_pagado,
            fc.saldo_pendiente_pago,
            fc.estado_obligacion as estado_factura_compra, -- Mapeo de nombre
            fc.observaciones_obligacion as observaciones_compra, -- Mapeo de nombre
            fc.prioridad_pago
            -- Columnas de auditoría eliminadas
        FROM Obligaciones fc -- ¡CAMBIO DE NOMBRE DE TABLA!
        JOIN Proveedores p ON fc.proveedor_id = p.proveedor_id
        JOIN TiposComprobanteCompra tc ON fc.tipo_comprobante_compra_id = tc.tipo_comprobante_compra_id
        JOIN Monedas m ON fc.moneda_id_obligacion = m.moneda_id
        -- JOINs para usuarios de auditoría eliminados
        WHERE fc.obligacion_id = $1 AND fc.empresa_id_deudora = $2 -- Mapeo de ID y nombre de columna
    `;

    const queryDetalles = `
        SELECT 
            dfc.detalle_obligacion_id as detalle_factura_compra_id, -- Mapeo de ID
            dfc.obligacion_id as factura_compra_id, -- Mapeo de ID
            dfc.descripcion_item_gasto, dfc.cantidad, dfc.valor_unitario_gasto,
            dfc.monto_total_item_gasto, dfc.centro_costo_id, dfc.proyecto_id_referencia,
            cc.nombre_centro_costo as centro_costo_nombre,
            pr.nombre_proyecto_campaña as proyecto_nombre
        FROM DetallesObligacion dfc -- ¡CAMBIO DE NOMBRE DE TABLA!
        LEFT JOIN CentrosCosto cc ON dfc.centro_costo_id = cc.centro_costo_id
        LEFT JOIN Proyectos pr ON dfc.proyecto_id_referencia = pr.proyecto_id
        WHERE dfc.obligacion_id = $1 -- Mapeo de ID
        ORDER BY dfc.detalle_obligacion_id ASC -- Mapeo de ID
    `;

    const cabeceraResult = await pool.query(queryCabecera, [facturaId, empresaId]);
    if (cabeceraResult.rows.length === 0) {
        return null;
    }

    const detallesResult = await pool.query(queryDetalles, [facturaId]);
    const factura = {
        ...cabeceraResult.rows[0],
        detalles: detallesResult.rows
    };

    return factura;
};

// Obtener todas las facturas de compra para exportar a Excel
export const getAllFacturasCompraForExport = async (empresaId: number, filters: any): Promise<any[]> => {
    const allowedFilterKeys = ['numero_documento_proveedor', 'proveedor_razon_social', 'estado_factura_compra', 'fecha_recepcion_documento'];
    let query = `
        SELECT 
            fc.numero_documento_proveedor as "Nro. Documento Proveedor",
            tc.descripcion_comprobante as "Tipo Comprobante",
            TO_CHAR(fc.fecha_emision_documento_proveedor, 'DD/MM/YYYY') as "Fecha Emisión Doc.",
            TO_CHAR(fc.fecha_recepcion_documento, 'DD/MM/YYYY') as "Fecha Recepción",
            TO_CHAR(fc.fecha_vencimiento_original, 'DD/MM/YYYY') as "Fecha Vencimiento",
            p.razon_social_o_nombres as "Proveedor",
            p.numero_documento_identidad as "RUC/DNI Proveedor",
            m.codigo_moneda as "Moneda",
            fc.monto_total_original_obligacion as "Monto Original",
            fc.monto_detraccion as "Monto Detracción",
            fc.monto_retencion_impuestos as "Monto Retención",
            fc.monto_neto_a_pagar_calculado as "Monto Neto a Pagar",
            fc.saldo_pendiente_pago as "Saldo Pendiente",
            fc.estado_obligacion as "Estado", -- Mapeo de nombre
            fc.observaciones_obligacion as "Observaciones" -- Mapeo de nombre
            -- Columnas de auditoría eliminadas de la selección
        FROM Obligaciones fc -- ¡CAMBIO DE NOMBRE DE TABLA!
        JOIN Proveedores p ON fc.proveedor_id = p.proveedor_id
        JOIN TiposComprobanteCompra tc ON fc.tipo_comprobante_compra_id = tc.tipo_comprobante_compra_id
        JOIN Monedas m ON fc.moneda_id_obligacion = m.moneda_id
        -- JOINs para usuarios de auditoría eliminados
        WHERE fc.empresa_id_deudora = $1 -- Mapeo de nombre de columna
    `;
    
    const queryParams: any[] = [empresaId];
    let whereClause = '';
    let paramIndex = 2;

    Object.keys(filters).forEach(key => {
        if (allowedFilterKeys.includes(key) && filters[key]) {
            if (key === 'fecha_recepcion_documento') {
                whereClause += ` AND fc.${key} = $${paramIndex}`;
                queryParams.push(filters[key]);
            } else if (key === 'proveedor_razon_social') {
                whereClause += ` AND p.razon_social_o_nombres ILIKE $${paramIndex}`;
                queryParams.push(`%${filters[key]}%`);
            } else if (key === 'estado_factura_compra') {
                whereClause += ` AND fc.estado_obligacion ILIKE $${paramIndex}`; // Mapeo de nombre
                queryParams.push(`%${filters[key]}%`);
            } else {
                whereClause += ` AND fc.${key}::text ILIKE $${paramIndex}`; 
                queryParams.push(`%${filters[key]}%`);
            }
            paramIndex++;
        }
    });

    const finalQuery = query + whereClause + ' ORDER BY fc.fecha_recepcion_documento DESC, fc.obligacion_id DESC'; // Mapeo de ID
    const result = await pool.query(finalQuery, queryParams);
    return result.rows;
};

// Crear una nueva factura de compra con sus detalles (como una transacción)
export const createFacturaCompra = async (factura: FacturaCompra, usuarioId: number, nombreUsuario: string): Promise<FacturaCompra> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const {
            empresa_id_compradora, proveedor_id, tipo_comprobante_compra_id, tipo_obligacion_principal,
            descripcion_general_compra, numero_documento_proveedor, fecha_emision_documento_proveedor,
            fecha_recepcion_documento, fecha_vencimiento_original, fecha_programada_pago,
            moneda_id_obligacion, monto_total_original_obligacion, monto_detraccion,
            monto_retencion_impuestos, observaciones_compra, prioridad_pago,
            detalles
        } = factura;

        const insertFacturaQuery = `
            INSERT INTO public.obligaciones (
                empresa_id_deudora, proveedor_id, tipo_comprobante_compra_id, tipo_obligacion_principal,
                descripcion_general_obligacion, numero_documento_proveedor, fecha_emision_documento_proveedor,
                fecha_recepcion_documento, fecha_vencimiento_original, fecha_programada_pago,
                moneda_id_obligacion, monto_total_original_obligacion, monto_detraccion,
                monto_retencion_impuestos, estado_obligacion, observaciones_obligacion, prioridad_pago
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'Pendiente', $15, $16)
            RETURNING *;
        `;

        const facturaResult = await client.query(insertFacturaQuery, [
            empresa_id_compradora, proveedor_id, tipo_comprobante_compra_id, tipo_obligacion_principal,
            descripcion_general_compra, numero_documento_proveedor || null, fecha_emision_documento_proveedor || null,
            fecha_recepcion_documento, fecha_vencimiento_original, fecha_programada_pago || null,
            moneda_id_obligacion, monto_total_original_obligacion, monto_detraccion || 0,
            monto_retencion_impuestos || 0, observaciones_compra || null, prioridad_pago || 3
        ]);
        
        const facturaCreada = facturaResult.rows[0];
        
        // Creamos alias para consistencia con la interfaz del frontend
        facturaCreada.factura_compra_id = facturaCreada.obligacion_id; 

        if (detalles && detalles.length > 0) {
            for (const detalle of detalles) {
                const insertDetalleQuery = `
                    INSERT INTO public.detallesobligacion (
                        obligacion_id, descripcion_item_gasto, cantidad, valor_unitario_gasto,
                        monto_total_item_gasto, centro_costo_id, proyecto_id_referencia
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7);
                `;
                await client.query(insertDetalleQuery, [
                    facturaCreada.obligacion_id, detalle.descripcion_item_gasto, detalle.cantidad || null,
                    detalle.valor_unitario_gasto || null, detalle.monto_total_item_gasto,
                    detalle.centro_costo_id || null, detalle.proyecto_id_referencia || null
                ]);
            }
        }
        
        const datosAdicionalesResult = await client.query(`
            SELECT p.razon_social_o_nombres as proveedor_razon_social
            FROM public.proveedores p
            WHERE p.proveedor_id = $1
        `, [facturaCreada.proveedor_id]);
        const datosAdicionales = datosAdicionalesResult.rows[0];

        let facturaCompletaParaAsiento = { ...facturaCreada, ...datosAdicionales };

        // --- ¡AQUÍ ESTÁ LA CORRECCIÓN CLAVE! ---
        // "Traducimos" el nombre de la columna de la BD al nombre que espera la interfaz/función.
        facturaCompletaParaAsiento.empresa_id_compradora = facturaCreada.empresa_id_deudora;

        if (facturaCompletaParaAsiento.estado_obligacion === 'Pendiente') {
            await generarAsientoDeCompra(facturaCompletaParaAsiento, client, usuarioId, nombreUsuario);
        }

        await client.query('COMMIT');
        
        await logAuditoria({
            usuario_id_accion: usuarioId,
            nombre_usuario_accion: nombreUsuario,
            tipo_evento: 'CREACION',
            tabla_afectada: 'Obligaciones',
            registro_afectado_id: facturaCreada.obligacion_id.toString(),
            valor_nuevo: JSON.stringify(facturaCompletaParaAsiento),
            exito_operacion: true,
            modulo_sistema_origen: 'Compras'
        });

        return facturaCompletaParaAsiento; 

    } catch (error: any) {
        await client.query('ROLLBACK'); 
        console.error("Error al crear factura de compra:", error);
        await logAuditoria({
            usuario_id_accion: usuarioId,
            nombre_usuario_accion: nombreUsuario,
            tipo_evento: 'CREACION',
            tabla_afectada: 'Obligaciones',
            registro_afectado_id: 'N/A',
            valor_nuevo: JSON.stringify(factura),
            exito_operacion: false,
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Compras'
        });
        throw error;
    } finally {
        client.release(); 
    }
};

// Actualizar una factura de compra
export const updateFacturaCompra = async (facturaId: number, facturaData: Partial<FacturaCompra>, usuarioId: number, nombreUsuario: string) => {
    const client = await pool.connect();
    const valorAnterior = await getFacturaCompraById(facturaId, facturaData.empresa_id_compradora!);
    if (!valorAnterior) {
        await logAuditoria({
            usuario_id_accion: usuarioId,
            nombre_usuario_accion: nombreUsuario,
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'Obligaciones', // Nombre de tabla en log
            registro_afectado_id: facturaId.toString(),
            descripcion_detallada_evento: `Intento de actualización de factura de compra no encontrada (ID: ${facturaId}).`,
            exito_operacion: false,
            mensaje_error_si_fallo: 'Factura de compra no encontrada para actualizar.',
            modulo_sistema_origen: 'Compras'
        });
        throw new Error('Factura de compra no encontrada.');
    }

    try {
        await client.query('BEGIN');

        const {
            proveedor_id, tipo_comprobante_compra_id, tipo_obligacion_principal,
            descripcion_general_compra, numero_documento_proveedor, fecha_emision_documento_proveedor,
            fecha_recepcion_documento, fecha_vencimiento_original, fecha_programada_pago,
            moneda_id_obligacion, monto_total_original_obligacion, monto_detraccion,
            monto_retencion_impuestos, estado_factura_compra, observaciones_compra, prioridad_pago,
            detalles
        } = facturaData;

        const updateFacturaQuery = `
            UPDATE Obligaciones SET -- ¡CAMBIO DE NOMBRE DE TABLA!
                proveedor_id = $1, tipo_comprobante_compra_id = $2, tipo_obligacion_principal = $3,
                descripcion_general_obligacion = $4, numero_documento_proveedor = $5, fecha_emision_documento_proveedor = $6, -- ¡CAMBIO DE NOMBRE DE COLUMNA!
                fecha_recepcion_documento = $7, fecha_vencimiento_original = $8, fecha_programada_pago = $9,
                moneda_id_obligacion = $10, monto_total_original_obligacion = $11, monto_detraccion = $12,
                monto_retencion_impuestos = $13, estado_obligacion = $14, observaciones_obligacion = $15, -- ¡CAMBIO DE NOMBRE DE COLUMNA!
                prioridad_pago = $16
                -- Columnas de auditoría eliminadas de la actualización
            WHERE obligacion_id = $17 AND empresa_id_deudora = $18 -- Mapeo de ID y nombre de columna
            RETURNING obligacion_id as factura_compra_id; -- Mapeo de ID
        `;

        const updatedFacturaResult = await client.query(updateFacturaQuery, [
            proveedor_id ?? valorAnterior.proveedor_id,
            tipo_comprobante_compra_id ?? valorAnterior.tipo_comprobante_compra_id,
            tipo_obligacion_principal ?? valorAnterior.tipo_obligacion_principal,
            descripcion_general_compra ?? valorAnterior.descripcion_general_compra,
            numero_documento_proveedor ?? valorAnterior.numero_documento_proveedor,
            fecha_emision_documento_proveedor ?? valorAnterior.fecha_emision_documento_proveedor,
            fecha_recepcion_documento ?? valorAnterior.fecha_recepcion_documento,
            fecha_vencimiento_original ?? valorAnterior.fecha_vencimiento_original,
            fecha_programada_pago ?? valorAnterior.fecha_programada_pago,
            moneda_id_obligacion ?? valorAnterior.moneda_id_obligacion,
            monto_total_original_obligacion ?? valorAnterior.monto_total_original_obligacion,
            monto_detraccion ?? valorAnterior.monto_detraccion,
            monto_retencion_impuestos ?? valorAnterior.monto_retencion_impuestos,
            estado_factura_compra ?? valorAnterior.estado_factura_compra,
            observaciones_compra ?? valorAnterior.observaciones_compra,
            prioridad_pago ?? valorAnterior.prioridad_pago,
            facturaId,
            facturaData.empresa_id_compradora
        ]);

        const facturaActualizada = updatedFacturaResult.rows[0];

        // Actualizar detalles: Borrar los existentes y reinsertar los nuevos
        if (detalles) {
            await client.query('DELETE FROM DetallesObligacion WHERE obligacion_id = $1', [facturaId]); // ¡CAMBIO DE NOMBRE DE TABLA Y COLUMNA!
            for (const detalle of detalles) {
                const insertDetalleQuery = `
                    INSERT INTO DetallesObligacion ( -- ¡CAMBIO DE NOMBRE DE TABLA!
                        obligacion_id, descripcion_item_gasto, cantidad, valor_unitario_gasto, -- ¡CAMBIO DE NOMBRE DE COLUMNA!
                        monto_total_item_gasto, centro_costo_id, proyecto_id_referencia
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7);
                `;
                await client.query(insertDetalleQuery, [
                    facturaId, detalle.descripcion_item_gasto, detalle.cantidad || null,
                    detalle.valor_unitario_gasto || null, detalle.monto_total_item_gasto,
                    detalle.centro_costo_id || null, detalle.proyecto_id_referencia || null
                ]);
            }
        }

        await client.query('COMMIT');

        await logAuditoria({
            usuario_id_accion: usuarioId,
            nombre_usuario_accion: nombreUsuario,
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'Obligaciones', // Nombre de tabla en log
            registro_afectado_id: facturaId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify({ ...facturaData, ...facturaActualizada }),
            exito_operacion: true,
            modulo_sistema_origen: 'Compras'
        });

        return { ...facturaData, ...facturaActualizada };
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error("Error al actualizar factura de compra:", error);
        await logAuditoria({
            usuario_id_accion: usuarioId,
            nombre_usuario_accion: nombreUsuario,
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'Obligaciones', // Nombre de tabla en log
            registro_afectado_id: facturaId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify(facturaData),
            exito_operacion: false,
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Compras'
        });
        throw error;
    } finally {
        client.release();
    }
};

// Eliminar (anular) una factura de compra
export const deleteFacturaCompra = async (facturaId: number, empresaId: number, usuarioId: number, nombreUsuario: string) => {
    const valorAnterior = await getFacturaCompraById(facturaId, empresaId);
    if (!valorAnterior) {
        await logAuditoria({
            usuario_id_accion: usuarioId,
            nombre_usuario_accion: nombreUsuario,
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'Obligaciones', // Nombre de tabla en log
            registro_afectado_id: facturaId.toString(),
            descripcion_detallada_evento: `Intento de anulación de factura de compra no encontrada (ID: ${facturaId}).`,
            exito_operacion: false,
            mensaje_error_si_fallo: 'Factura de compra no encontrada para anular.',
            modulo_sistema_origen: 'Compras'
        });
        throw new Error('Factura de compra no encontrada.');
    }

    try {
        const result = await pool.query(
            `UPDATE Obligaciones SET -- ¡CAMBIO DE NOMBRE DE TABLA!
                estado_obligacion = 'Anulada' -- ¡CAMBIO DE NOMBRE DE COLUMNA!
                -- Columnas de auditoría eliminadas de la actualización
            WHERE obligacion_id = $1 AND empresa_id_deudora = $2`, 
            [facturaId, empresaId]
        );

        await logAuditoria({
            usuario_id_accion: usuarioId,
            nombre_usuario_accion: nombreUsuario,
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'Obligaciones', // Nombre de tabla en log
            registro_afectado_id: facturaId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify({ ...valorAnterior, estado_factura_compra: 'Anulada' }),
            exito_operacion: true,
            modulo_sistema_origen: 'Compras'
        });

        return (result.rowCount ?? 0) > 0;
    } catch (error: any) {
        console.error("Error al anular factura de compra:", error);
        await logAuditoria({
            usuario_id_accion: usuarioId,
            nombre_usuario_accion: nombreUsuario,
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'Obligaciones', // Nombre de tabla en log
            registro_afectado_id: facturaId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify({ ...valorAnterior, estado_factura_compra: 'ERROR_NO_ANULADA' }),
            exito_operacion: false,
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Compras'
        });
        throw error;
    }
};

async function generarAsientoDeCompra(factura: FacturaCompra, client: any, usuarioId: number, nombreUsuario: string) {
    // --- ¡IMPORTANTE! Reemplaza estos IDs de ejemplo con los que encontraste en el Paso 1 ---
    const CUENTA_GASTO_GENERICA = 4;      // <-- REEMPLAZAR (Ej: ID de la cuenta "636 Servicios Básicos")
    const CUENTA_IGV_CREDITO_FISCAL = 5;  // <-- REEMPLAZAR (Ej: ID de la cuenta "40111 IGV - Crédito Fiscal")
    const CUENTA_PROVEEDORES = 6;         // <-- REEMPLAZAR (Ej: ID de la cuenta "4212 Cuentas por Pagar Comerciales")

    // Asumimos IGV del 18% para el cálculo inverso del subtotal
    const montoTotal = Number(factura.monto_total_original_obligacion);
    const montoIGV = parseFloat((montoTotal / 1.18 * 0.18).toFixed(2));
    const subtotal = montoTotal - montoIGV;

    const asientoDetalles: asientoContableService.AsientoContableDetalle[] = [
        { cuenta_contable_id: CUENTA_GASTO_GENERICA, secuencia_linea_asiento: 1, glosa_detalle_linea: `Compra a ${factura.proveedor_razon_social}`, monto_debe: subtotal, monto_haber: 0, moneda_id_linea: factura.moneda_id_obligacion },
        { cuenta_contable_id: CUENTA_IGV_CREDITO_FISCAL, secuencia_linea_asiento: 2, glosa_detalle_linea: `IGV Compra ${factura.numero_documento_proveedor}`, monto_debe: montoIGV, monto_haber: 0, moneda_id_linea: factura.moneda_id_obligacion },
        { cuenta_contable_id: CUENTA_PROVEEDORES, secuencia_linea_asiento: 3, glosa_detalle_linea: `Factura por Pagar ${factura.numero_documento_proveedor}`, monto_debe: 0, monto_haber: montoTotal, moneda_id_linea: factura.moneda_id_obligacion, tipo_tercero_analisis: 'Proveedor', tercero_analisis_id: factura.proveedor_id }
    ];
    
    const asientoCabecera: asientoContableService.AsientoContableCabecera = {
        empresa_id: factura.empresa_id_compradora!,
        periodo_contable_id: 1, // TEMPORAL: Idealmente, buscar el periodo contable abierto para la fecha de recepción
        tipo_asiento_contable_id: 2, // Asumiendo que el ID 2 es "Asiento de Compra"
        fecha_contabilizacion_asiento: factura.fecha_recepcion_documento,
        moneda_id_asiento: factura.moneda_id_obligacion,
        glosa_principal_asiento: `Por la compra según doc. ${factura.numero_documento_proveedor} de ${factura.proveedor_razon_social}`,
        total_debe_asiento: 0, 
        total_haber_asiento: 0, 
        origen_documento_referencia_id: factura.factura_compra_id,
        origen_documento_tabla_referencia: 'obligaciones',
        detalles: asientoDetalles,
    };
    
    await asientoContableService.createAsientoContableConClient(asientoCabecera, usuarioId, nombreUsuario, client);
}