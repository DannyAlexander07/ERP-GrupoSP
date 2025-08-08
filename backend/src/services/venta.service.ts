// Archivo: backend/src/services/venta.service.ts (VERSIÓN FINAL Y COMPLETA CON IMPLEMENTACIÓN MOCK)
import pool from '../config/database';
import { logAuditoria } from './auditoria.service';
import type { Servicio } from './servicio.service';
import type { Cliente } from './cliente.service';
import PDFDocument from 'pdfkit'; 
import { create } from 'xmlbuilder2';
import axios, { AxiosRequestConfig, AxiosError } from 'axios'; 
import type { AxiosRequestHeaders } from 'axios';
import * as asientoContableService from './asientoContable.service';
// Importar tipos si fueran necesarios
//import type { CondicionesPago } from './condicionesPago.service';
import type { Moneda } from './moneda.service';
//import type { TipoComprobanteVenta } from './tipoComprobanteVenta.service';


// Interfaz para los Detalles de Factura de Venta (debe coincidir con el backend)
export interface DetalleFacturaVenta {
    detalle_factura_venta_id?: number;
    factura_venta_id?: number;
    servicio_id: number;
    numero_linea_item: number;
    codigo_item_servicio_factura?: string;
    descripcion_item_servicio_factura: string;
    unidad_medida_item?: string;
    cantidad: number;
    valor_unitario_sin_impuestos: number;
    precio_unitario_con_impuestos?: number;
    monto_descuento_item?: number;
    subtotal_linea_sin_impuestos: number;
    porcentaje_impuesto_principal_item?: number;
    monto_impuesto_principal_item?: number;
    monto_total_linea_item: number;
    tipo_afectacion_impuesto_principal?: string;
    centro_costo_id?: number;
}

// Interfaz para la Factura de Venta (Cabecera) (debe coincidir con el backend)
export interface FacturaVenta {
    factura_venta_id?: number;
    empresa_id_emisora: number;
    cliente_id: number;
    tipo_comprobante_venta_id: number;
    serie_comprobante: string;
    numero_correlativo_comprobante: number; 
    numero_completo_comprobante?: string; 
    fecha_emision: string;
    fecha_vencimiento?: string;
    moneda_id: number;
    tipo_cambio_aplicado?: number;
    condicion_pago_id?: number;
    subtotal_afecto_impuestos?: number;
    subtotal_inafecto_impuestos?: number;
    subtotal_exonerado_impuestos?: number;
    monto_descuento_global?: number;
    monto_impuesto_principal?: number;
    monto_otros_tributos?: number;
    monto_total_factura: number;
    monto_total_pagado?: number; 
    saldo_pendiente_cobro?: number; 
    estado_factura?: string; 
    orden_compra_cliente_referencia?: string;
    proyecto_id_referencia?: number;
    observaciones_factura?: string;
    vendedor_asignado_usuario_id?: number;
    fecha_anulacion?: string;
    usuario_anulacion_id?: number;
    motivo_anulacion?: string;
    comprobante_referencia_id?: number; 

    creado_por?: string;
    fecha_creacion?: string;
    modificado_por?: string;
    fecha_modificacion?: string;

    detalles?: DetalleFacturaVenta[];

    cliente_razon_social?: string;
    tipo_comprobante_abreviatura?: string;
    tipo_comprobante_descripcion?: string;
    moneda_nombre?: string;
    condicion_pago_descripcion?: string;
    vendedor_nombre?: string;
    servicio_nombre?: string;
    servicio_codigo?: string;
}

// Interfaz para la respuesta paginada
export interface PagedFacturasResponse {
    records: FacturaVenta[];
    total_records: number;
    total_pages: number;
    current_page: number;
}

// Interfaz para filtros (CORREGIDA)
export interface VentaFilters {
    numero_completo_comprobante?: string;
    estado_factura?: string;
    fecha_emision?: string;
    cliente_razon_social?: string; // <-- AÑADIDO
}

const API_URL = 'http://localhost:4000/api/ventas';

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

// Obtener el siguiente correlativo (LÓGICA MOVIDA AQUÍ DESDE UN SERVICIO EXTERNO)
export const getNextCorrelativoComprobante = async (empresaId: number, tipoComprobanteId: number, serie: string): Promise<number> => {
    const query = `
        SELECT numero_correlativo_comprobante FROM facturasventa
        WHERE empresa_id_emisora = $1
        AND tipo_comprobante_venta_id = $2
        AND serie_comprobante = $3
        ORDER BY numero_correlativo_comprobante DESC
        LIMIT 1
    `;
    const result = await pool.query(query, [empresaId, tipoComprobanteId, serie]);
    if (result.rows.length > 0) {
        return result.rows[0].numero_correlativo_comprobante + 1;
    }
    return 1;
};

// Obtener todas las facturas de venta con filtros y paginación
export const getAllFacturasVenta = async (empresaId: number, page: number, limit: number, filters: VentaFilters): Promise<PagedFacturasResponse> => {
    const allowedFilterKeys = ['numero_completo_comprobante', 'estado_factura', 'fecha_emision', 'cliente_razon_social']; 
    
    let query = `
        SELECT 
            fv.factura_venta_id, fv.numero_completo_comprobante, fv.fecha_emision,
            fv.monto_total_factura, fv.estado_factura,
            c.razon_social_o_nombres as cliente_razon_social,
            tc.abreviatura_comprobante as tipo_comprobante_abreviatura, 
            m.nombre_moneda as moneda_nombre, 
            u.nombres_completos_persona as creado_por
        FROM facturasventa fv
        JOIN clientes c ON fv.cliente_id = c.cliente_id
        JOIN tiposcomprobanteventa tc ON fv.tipo_comprobante_venta_id = tc.tipo_comprobante_venta_id
        JOIN monedas m ON fv.moneda_id = m.moneda_id 
        LEFT JOIN usuarios u ON fv.usuario_creacion_id = u.usuario_id
        WHERE fv.empresa_id_emisora = $1
    `;
    const countQueryBase = `
        SELECT COUNT(*) 
        FROM facturasventa fv
        JOIN clientes c ON fv.cliente_id = c.cliente_id
        WHERE fv.empresa_id_emisora = $1
    `;

    const queryParams: any[] = [empresaId];
    let whereClause = '';
    let paramIndex = 2;

    Object.keys(filters).forEach(_key => {
        const key = _key as keyof VentaFilters;
        const value = filters[key];
        if (allowedFilterKeys.includes(key) && value !== undefined && value !== null && value !== '') {
            
            // Ahora esta comprobación es válida porque el tipo 'key' ya incluye 'cliente_razon_social'
            if (key === 'cliente_razon_social') {
                whereClause += ` AND c.razon_social_o_nombres ILIKE $${paramIndex}`;
                queryParams.push(`%${value}%`);
                paramIndex++;
            } else if (key === 'fecha_emision') {
                whereClause += ` AND fv.${key} = $${paramIndex}`;
                queryParams.push(value);
                paramIndex++;
            } else {
                whereClause += ` AND fv.${key}::text ILIKE $${paramIndex}`;
                queryParams.push(`%${value}%`);
                paramIndex++;
            }
        }
    });

    const finalQuery = query + whereClause + ' ORDER BY fv.fecha_emision DESC, fv.numero_correlativo_comprobante DESC';
    const finalCountQuery = countQueryBase + whereClause;
    
    const countParams = queryParams.slice(0, paramIndex - 1);
    const totalResult = await pool.query(finalCountQuery, countParams);
    const total_records = parseInt(totalResult.rows[0].count, 10);
    const total_pages = Math.ceil(total_records / limit) || 1;

    const offset = (page - 1) * limit;
    const paginatedQuery = `${finalQuery} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    const paginatedParams = [...queryParams.slice(0, paramIndex-1), limit, offset]; // CORREGIDO: usar queryParams sin limit y offset

    const recordsResult = await pool.query(paginatedQuery, paginatedParams);

    return {
        records: recordsResult.rows,
        total_records,
        total_pages,
        current_page: page,
    };
};


// Obtener una factura de venta por su ID con sus detalles y datos relacionados (RENOMBRADO Y EXPORTADO)
export const getFacturaVentaById = async (facturaId: number, empresaId: number): Promise<FacturaVenta | null> => {
    const queryCabecera = `
        SELECT 
            fv.*,
            c.razon_social_o_nombres as cliente_razon_social,
            c.numero_documento_identidad as cliente_numero_documento,
            tc.descripcion_comprobante as tipo_comprobante_descripcion,
            m.nombre_moneda as moneda_nombre,
            cp.descripcion_condicion as condicion_pago_descripcion,
            uc.nombres_completos_persona as creado_por,
            um.nombres_completos_persona as modificado_por,
            uv.nombres_completos_persona as vendedor_nombre
        FROM facturasventa fv
        JOIN clientes c ON fv.cliente_id = c.cliente_id
        JOIN tiposcomprobanteventa tc ON fv.tipo_comprobante_venta_id = tc.tipo_comprobante_venta_id
        JOIN monedas m ON fv.moneda_id = m.moneda_id
        LEFT JOIN condicionespago cp ON fv.condicion_pago_id = cp.condicion_pago_id
        LEFT JOIN usuarios uc ON fv.vendedor_asignado_usuario_id = uc.usuario_id 
        LEFT JOIN usuarios um ON fv.usuario_anulacion_id = um.usuario_id 
        LEFT JOIN usuarios uv ON fv.vendedor_asignado_usuario_id = uv.usuario_id
        WHERE fv.factura_venta_id = $1 AND fv.empresa_id_emisora = $2
    `;

    const queryDetalles = `
        SELECT 
            dfv.*,
            s.nombre_servicio as servicio_nombre,
            s.codigo_servicio_interno as servicio_codigo
        FROM detallesfacturaventa dfv
        JOIN servicios s ON dfv.servicio_id = s.servicio_id
        WHERE dfv.factura_venta_id = $1
        ORDER BY dfv.numero_linea_item ASC
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

// Crear una nueva factura de venta (CORREGIDO)
export const createFacturaVenta = async (factura: FacturaVenta, usuarioId: number, nombreUsuario: string): Promise<FacturaVenta> => {
    const client = await pool.connect(); 
    try {
        await client.query('BEGIN'); 

        const {
            empresa_id_emisora, cliente_id, tipo_comprobante_venta_id, serie_comprobante,
            fecha_emision, fecha_vencimiento, moneda_id, tipo_cambio_aplicado,
            condicion_pago_id, subtotal_afecto_impuestos, subtotal_inafecto_impuestos,
            subtotal_exonerado_impuestos, monto_descuento_global, monto_impuesto_principal,
            monto_otros_tributos, monto_total_factura, orden_compra_cliente_referencia,
            proyecto_id_referencia, observaciones_factura, vendedor_asignado_usuario_id,
            detalles 
        } = factura;

        const nextCorrelativo = await getNextCorrelativoComprobante(empresa_id_emisora!, tipo_comprobante_venta_id, serie_comprobante);

        const insertFacturaQuery = `
            INSERT INTO public.facturasventa (
                empresa_id_emisora, cliente_id, tipo_comprobante_venta_id, serie_comprobante,
                numero_correlativo_comprobante, fecha_emision, fecha_vencimiento, moneda_id, tipo_cambio_aplicado,
                condicion_pago_id, subtotal_afecto_impuestos, subtotal_inafecto_impuestos,
                subtotal_exonerado_impuestos, monto_descuento_global, monto_impuesto_principal,
                monto_otros_tributos, monto_total_factura, estado_factura, orden_compra_cliente_referencia,
                proyecto_id_referencia, observaciones_factura, vendedor_asignado_usuario_id, usuario_creacion_id, fecha_creacion
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'Emitida', $18, $19, $20, $21, $22, NOW())
            RETURNING *;
        `;

        const facturaResult = await client.query(insertFacturaQuery, [
            empresa_id_emisora, cliente_id, tipo_comprobante_venta_id, serie_comprobante,
            nextCorrelativo, fecha_emision, fecha_vencimiento || null,
            moneda_id, tipo_cambio_aplicado || 1.0000, condicion_pago_id || null, subtotal_afecto_impuestos || 0,
            subtotal_inafecto_impuestos || 0, subtotal_exonerado_impuestos || 0, monto_descuento_global || 0, monto_impuesto_principal || 0,
            monto_otros_tributos || 0, monto_total_factura, orden_compra_cliente_referencia || null,
            proyecto_id_referencia || null, observaciones_factura || null, vendedor_asignado_usuario_id || usuarioId, usuarioId
        ]);
        
        const facturaCreada = facturaResult.rows[0];

        if (detalles && detalles.length > 0) {
            for (const detalle of detalles) {
                const insertDetalleQuery = `
                    INSERT INTO public.detallesfacturaventa (
                        factura_venta_id, servicio_id, numero_linea_item, codigo_item_servicio_factura,
                        descripcion_item_servicio_factura, unidad_medida_item, cantidad, valor_unitario_sin_impuestos,
                        precio_unitario_con_impuestos, monto_descuento_item, subtotal_linea_sin_impuestos,
                        porcentaje_impuesto_principal_item, monto_impuesto_principal_item, monto_total_linea_item,
                        tipo_afectacion_impuesto_principal, centro_costo_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16);
                `;
                await client.query(insertDetalleQuery, [
                    facturaCreada.factura_venta_id, detalle.servicio_id, detalle.numero_linea_item, detalle.codigo_item_servicio_factura || null,
                    detalle.descripcion_item_servicio_factura, detalle.unidad_medida_item || null, detalle.cantidad, detalle.valor_unitario_sin_impuestos,
                    detalle.precio_unitario_con_impuestos || null, detalle.monto_descuento_item || 0, detalle.subtotal_linea_sin_impuestos,
                    detalle.porcentaje_impuesto_principal_item || null, detalle.monto_impuesto_principal_item || 0, detalle.monto_total_linea_item,
                    detalle.tipo_afectacion_impuesto_principal || null, detalle.centro_costo_id || null
                ]);
            }
        }
        
        const datosParaAsientoResult = await client.query(`
            SELECT c.razon_social_o_nombres as cliente_razon_social, tcv.descripcion_comprobante as tipo_comprobante_descripcion
            FROM public.clientes c, public.tiposcomprobanteventa tcv
            WHERE c.cliente_id = $1 AND tcv.tipo_comprobante_venta_id = $2
        `, [facturaCreada.cliente_id, facturaCreada.tipo_comprobante_venta_id]);
        const datosAdicionales = datosParaAsientoResult.rows[0];

        const facturaCompletaParaAsiento = { ...facturaCreada, ...datosAdicionales };

        if (facturaCompletaParaAsiento.estado_factura === 'Emitida') {
            await generarAsientoDeVenta(facturaCompletaParaAsiento, client, usuarioId, nombreUsuario);
        }

        await client.query('COMMIT'); 
        
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'CREACION',
            tabla_afectada: 'facturasventa', 
            registro_afectado_id: facturaCreada.factura_venta_id.toString(),
            valor_nuevo: JSON.stringify(facturaCompletaParaAsiento), 
            exito_operacion: true,
            modulo_sistema_origen: 'Ventas'
        });

        return facturaCompletaParaAsiento; 
    } catch (error: any) {
        await client.query('ROLLBACK'); 
        console.error("Error al crear factura de venta:", error);
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'CREACION',
            tabla_afectada: 'facturasventa', 
            registro_afectado_id: 'N/A',
            valor_nuevo: JSON.stringify(factura),
            exito_operacion: false,
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Ventas'
        });
        throw error;
    } finally {
        client.release(); 
    }
};

// Actualizar una factura de venta (CORREGIDO)
export const updateFacturaVenta = async (facturaId: number, facturaData: Partial<FacturaVenta>, usuarioId: number, nombreUsuario: string): Promise<FacturaVenta | null> => {
    const client = await pool.connect();
    const valorAnterior = await getFacturaVentaById(facturaId, facturaData.empresa_id_emisora!); 
    if (!valorAnterior) {
        await logAuditoria({
            usuario_id_accion: usuarioId,
            nombre_usuario_accion: nombreUsuario,
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'facturasventa',
            registro_afectado_id: facturaId.toString(),
            descripcion_detallada_evento: `Intento de actualización de factura de venta no encontrada (ID: ${facturaId}).`,
            exito_operacion: false,
            mensaje_error_si_fallo: 'Factura de venta no encontrada para actualizar.',
            modulo_sistema_origen: 'Ventas'
        });
        throw new Error('Factura de venta no encontrada.');
    }

    try {
        await client.query('BEGIN');

        const {
            cliente_id, tipo_comprobante_venta_id, serie_comprobante,
            fecha_emision, fecha_vencimiento, moneda_id, tipo_cambio_aplicado,
            condicion_pago_id, subtotal_afecto_impuestos, subtotal_inafecto_impuestos,
            subtotal_exonerado_impuestos, monto_descuento_global, monto_impuesto_principal,
            monto_otros_tributos, monto_total_factura, orden_compra_cliente_referencia,
            proyecto_id_referencia, observaciones_factura, vendedor_asignado_usuario_id,
            estado_factura, fecha_anulacion, usuario_anulacion_id, motivo_anulacion, comprobante_referencia_id,
            detalles 
        } = facturaData;

        const updateFacturaQuery = `
            UPDATE facturasventa SET
                cliente_id = $1, tipo_comprobante_venta_id = $2, serie_comprobante = $3,
                fecha_emision = $4, fecha_vencimiento = $5, moneda_id = $6, tipo_cambio_aplicado = $7,
                condicion_pago_id = $8, subtotal_afecto_impuestos = $9, subtotal_inafecto_impuestos = $10,
                subtotal_exonerado_impuestos = $11, monto_descuento_global = $12, monto_impuesto_principal = $13,
                monto_otros_tributos = $14, monto_total_factura = $15, estado_factura = $16,
                orden_compra_cliente_referencia = $17, proyecto_id_referencia = $18, 
                observaciones_factura = $19, vendedor_asignado_usuario_id = $20,
                fecha_anulacion = $21, usuario_anulacion_id = $22, motivo_anulacion = $23,
                comprobante_referencia_id = $24
            WHERE factura_venta_id = $25 AND empresa_id_emisora = $26
            RETURNING *;
        `;

        const updatedFacturaResult = await client.query(updateFacturaQuery, [
            cliente_id ?? valorAnterior.cliente_id,
            tipo_comprobante_venta_id ?? valorAnterior.tipo_comprobante_venta_id,
            serie_comprobante ?? valorAnterior.serie_comprobante,
            fecha_emision ?? valorAnterior.fecha_emision,
            fecha_vencimiento ?? valorAnterior.fecha_vencimiento,
            moneda_id ?? valorAnterior.moneda_id,
            tipo_cambio_aplicado ?? valorAnterior.tipo_cambio_aplicado,
            condicion_pago_id ?? valorAnterior.condicion_pago_id,
            subtotal_afecto_impuestos ?? valorAnterior.subtotal_afecto_impuestos,
            subtotal_inafecto_impuestos ?? valorAnterior.subtotal_inafecto_impuestos,
            subtotal_exonerado_impuestos ?? valorAnterior.subtotal_exonerado_impuestos,
            monto_descuento_global ?? valorAnterior.monto_descuento_global,
            monto_impuesto_principal ?? valorAnterior.monto_impuesto_principal,
            monto_otros_tributos ?? valorAnterior.monto_otros_tributos,
            monto_total_factura ?? valorAnterior.monto_total_factura,
            estado_factura ?? valorAnterior.estado_factura,
            orden_compra_cliente_referencia ?? valorAnterior.orden_compra_cliente_referencia,
            proyecto_id_referencia ?? valorAnterior.proyecto_id_referencia,
            observaciones_factura ?? valorAnterior.observaciones_factura,
            vendedor_asignado_usuario_id ?? valorAnterior.vendedor_asignado_usuario_id,
            fecha_anulacion ?? valorAnterior.fecha_anulacion,
            usuario_anulacion_id ?? valorAnterior.usuario_anulacion_id,
            motivo_anulacion ?? valorAnterior.motivo_anulacion,
            comprobante_referencia_id ?? valorAnterior.comprobante_referencia_id,
            facturaId,
            facturaData.empresa_id_emisora
        ]);

        const facturaActualizada = updatedFacturaResult.rows[0];

        if (detalles) {
            await client.query('DELETE FROM detallesfacturaventa WHERE factura_venta_id = $1', [facturaId]);
            for (const detalle of detalles) {
                const insertDetalleQuery = `
                    INSERT INTO detallesfacturaventa (
                        factura_venta_id, servicio_id, numero_linea_item, codigo_item_servicio_factura,
                        descripcion_item_servicio_factura, unidad_medida_item, cantidad, valor_unitario_sin_impuestos,
                        precio_unitario_con_impuestos, monto_descuento_item, subtotal_linea_sin_impuestos,
                        porcentaje_impuesto_principal_item, monto_impuesto_principal_item, monto_total_linea_item,
                        tipo_afectacion_impuesto_principal, centro_costo_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16);
                `;
                await client.query(insertDetalleQuery, [
                    facturaId, detalle.servicio_id, detalle.numero_linea_item, detalle.codigo_item_servicio_factura || null,
                    detalle.descripcion_item_servicio_factura, detalle.unidad_medida_item || null, detalle.cantidad, detalle.valor_unitario_sin_impuestos,
                    detalle.precio_unitario_con_impuestos || null, detalle.monto_descuento_item || 0, detalle.subtotal_linea_sin_impuestos,
                    detalle.porcentaje_impuesto_principal_item || null, detalle.monto_impuesto_principal_item || 0, detalle.monto_total_linea_item,
                    detalle.tipo_afectacion_impuesto_principal || null, detalle.centro_costo_id || null
                ]);
            }
        }

        await client.query('COMMIT');
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'facturasventa', 
            registro_afectado_id: facturaId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify({ ...facturaData, ...facturaActualizada }),
            exito_operacion: true,
            modulo_sistema_origen: 'Ventas'
        });

        return { ...facturaData, ...facturaActualizada };
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error("Error al actualizar factura de venta:", error);
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'facturasventa', 
            registro_afectado_id: facturaId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify(facturaData),
            exito_operacion: false,
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Ventas'
        });
        throw error;
    } finally {
        client.release();
    }
};

// Anular una factura de venta (eliminación lógica) (CORREGIDO)
export const deleteFacturaVenta = async (facturaId: number, empresaId: number, usuarioId: number, nombreUsuario: string): Promise<boolean> => {
    const valorAnterior = await getFacturaVentaById(facturaId, empresaId);
    if (!valorAnterior) {
        await logAuditoria({
            usuario_id_accion: usuarioId,
            nombre_usuario_accion: nombreUsuario,
            tipo_evento: 'ELIMINACION_LOGICA', 
            tabla_afectada: 'facturasventa',
            registro_afectado_id: facturaId.toString(),
            descripcion_detallada_evento: `Intento de anulación de factura de venta no encontrada (ID: ${facturaId}).`,
            exito_operacion: false,
            mensaje_error_si_fallo: 'Factura de venta no encontrada para anular.',
            modulo_sistema_origen: 'Ventas'
        });
        throw new Error('Factura de venta no encontrada.');
    }

    try {
        const result = await pool.query(
            `UPDATE facturasventa SET 
                estado_factura = 'Anulada',
                fecha_anulacion = NOW(),
                usuario_anulacion_id = $1
             WHERE factura_venta_id = $2 AND empresa_id_emisora = $3`,
            [usuarioId, facturaId, empresaId]
        );

        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'ELIMINACION_LOGICA', 
            tabla_afectada: 'facturasventa', 
            registro_afectado_id: facturaId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify({ ...valorAnterior, estado_factura: 'Anulada', fecha_anulacion: new Date().toISOString() }),
            exito_operacion: true,
            modulo_sistema_origen: 'Ventas'
        });

        return (result.rowCount ?? 0) > 0;
    } catch (error: any) {
        console.error("Error al anular factura de venta:", error);
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'ELIMINACION_LOGICA', 
            tabla_afectada: 'facturasventa', 
            registro_afectado_id: facturaId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify({ ...valorAnterior, estado_factura: 'ERROR_NO_ANULADA' }),
            exito_operacion: false,
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Ventas'
        });
        throw error;
    }
};

// Exportar facturas de venta a Excel (CORREGIDO)
export const getAllFacturasVentaForExport = async (empresaId: number, filters: VentaFilters): Promise<any[]> => {
    const allowedFilterKeys = ['numero_completo_comprobante', 'estado_factura', 'fecha_emision'];
    let query = `
        SELECT 
            fv.numero_completo_comprobante as "Nro. Comprobante",
            tc.descripcion_comprobante as "Tipo Comprobante",
            TO_CHAR(fv.fecha_emision, 'DD/MM/YYYY') as "Fecha Emisión",
            TO_CHAR(fv.fecha_vencimiento, 'DD/MM/YYYY') as "Fecha Vencimiento",
            c.razon_social_o_nombres as "Cliente",
            c.numero_documento_identidad as "RUC/DNI Cliente",
            m.codigo_moneda as "Moneda",
            fv.monto_total_factura as "Monto Total",
            fv.saldo_pendiente_cobro as "Saldo Pendiente",
            fv.estado_factura as "Estado",
            uv.nombres_completos_persona as "Vendedor",
            p.nombre_proyecto_campaña as "Proyecto Referencia",
            fv.observaciones_factura as "Observaciones",
            uc.nombres_completos_persona as "Creado Por",
            TO_CHAR(fv.fecha_creacion, 'DD/MM/YYYY HH24:MI:SS') as "Fecha Creación", 
            um.nombres_completos_persona as "Modificado Por",
            TO_CHAR(fv.fecha_anulacion, 'DD/MM/YYYY HH24:MI:SS') as "Fecha Modificación" 
        FROM facturasventa fv
        JOIN clientes c ON fv.cliente_id = c.cliente_id
        JOIN tiposcomprobanteventa tc ON fv.tipo_comprobante_venta_id = tc.tipo_comprobante_venta_id
        JOIN monedas m ON fv.moneda_id = m.moneda_id
        LEFT JOIN usuarios uv ON fv.vendedor_asignado_usuario_id = uv.usuario_id
        LEFT JOIN proyectos p ON fv.proyecto_id_referencia = p.proyecto_id
        LEFT JOIN usuarios uc ON fv.vendedor_asignado_usuario_id = uc.usuario_id 
        LEFT JOIN usuarios um ON fv.usuario_anulacion_id = um.usuario_id 
        WHERE fv.empresa_id_emisora = $1
    `;
    
    const queryParams: any[] = [empresaId];
    let whereClause = '';
    let paramIndex = 2;

    Object.keys(filters).forEach(_key => {
        const key = _key as keyof VentaFilters;
        const value = filters[key];
        if (allowedFilterKeys.includes(key) && value !== undefined && value !== null) {
            if (key === 'fecha_emision') {
                whereClause += ` AND fv.${key} = $${paramIndex}`;
                queryParams.push(value);
            } else {
                whereClause += ` AND fv.${key}::text ILIKE $${paramIndex}`; 
                queryParams.push(`%${value}%`);
            }
            paramIndex++;
        }
    });

    const finalQuery = query + whereClause + ' ORDER BY fv.fecha_emision DESC, fv.numero_correlativo_comprobante DESC';
    const result = await pool.query(finalQuery, queryParams);
    return result.rows;
};

// ... Funciones para descargar XML, CDR, PDF (RENOMBRADO y CORREGIDO)
export const generateFacturaVentaXml = async (facturaId: number, empresaId: number): Promise<Buffer> => {
    const xmlMock = `<factura><id>${facturaId}</id><empresa>${empresaId}</empresa></factura>`;
    return Buffer.from(xmlMock, 'utf-8');
};

export const generateFacturaVentaCdr = async (facturaId: number, empresaId: number): Promise<Buffer> => {
    // Simula un archivo zip vacío o de prueba
    const cdrMock = 'Mock CDR content';
    return Buffer.from(cdrMock, 'utf-8');
};

export const generateFacturaVentaPdf = async (facturaId: number, empresaId: number): Promise<Buffer> => {
    const factura = await getFacturaVentaById(facturaId, empresaId);
    if (!factura) {
        throw new Error('Factura no encontrada');
    }

    // --- CORRECCIÓN: Asegurarse de que los datos numéricos sean tratados como números ---
    // El objeto 'factura' puede traer montos como strings desde la base de datos.
    const montoTotalNumerico = parseFloat(factura.monto_total_factura as any);

    const doc = new PDFDocument({ margin: 40 });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    
    // Aquí va tu plantilla PDF
    doc.fontSize(16).text(`Factura N° ${factura.numero_completo_comprobante}`, { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).text(`Cliente: ${factura.cliente_razon_social}`);
    doc.text(`Fecha de emisión: ${new Date(factura.fecha_emision).toLocaleDateString('es-PE')}`); // Formatear fecha
    doc.text(`Moneda: ${factura.moneda_nombre}`);
    
    // --- ¡CORRECCIÓN AQUÍ! Usamos la variable numérica ---
    doc.text(`Monto total: ${montoTotalNumerico.toFixed(2)}`);

    doc.moveDown().text('Detalles:', { underline: true });
    
    factura.detalles?.forEach((item) => {
        // --- ¡CORRECCIÓN AQUÍ! También convertimos el total de la línea a número ---
        const montoTotalItemNumerico = parseFloat(item.monto_total_linea_item as any);
        doc.text(`- ${item.descripcion_item_servicio_factura} (x${item.cantidad}) = S/ ${montoTotalItemNumerico.toFixed(2)}`);
    });

    doc.end();

    return new Promise((resolve) => {
        doc.on('end', () => {
            const pdfBuffer = Buffer.concat(buffers);
            resolve(pdfBuffer);
        });
    });
};

// NUEVA FUNCIÓN AUXILIAR (puedes ponerla al final del archivo)
async function generarAsientoDeVenta(factura: FacturaVenta, client: any, usuarioId: number, nombreUsuario: string) {
    // --- IMPORTANTE: Configuración de Cuentas Contables ---
    // Reemplaza estos IDs con los correctos de tu Plan de Cuentas.
    const CUENTA_CLIENTES_NACIONALES = 1; // Ej: ID de la cuenta "1212 Cuentas por Cobrar Comerciales"
    const CUENTA_IGV_POR_PAGAR = 2;       // Ej: ID de la cuenta "4011 IGV por Pagar"
    const CUENTA_VENTA_SERVICIOS = 3;    // Ej: ID de la cuenta "7041 Venta de Servicios"

    const asientoDetalles: asientoContableService.AsientoContableDetalle[] = [
        {
            cuenta_contable_id: CUENTA_CLIENTES_NACIONALES,
            secuencia_linea_asiento: 1,
            glosa_detalle_linea: `Venta a ${factura.cliente_razon_social}`,
            monto_debe: factura.monto_total_factura,
            monto_haber: 0,
            moneda_id_linea: factura.moneda_id,
            tipo_tercero_analisis: 'Cliente',
            tercero_analisis_id: factura.cliente_id,
        },
        {
            cuenta_contable_id: CUENTA_IGV_POR_PAGAR,
            secuencia_linea_asiento: 2,
            glosa_detalle_linea: `IGV Venta ${factura.numero_completo_comprobante}`,
            monto_debe: 0,
            monto_haber: factura.monto_impuesto_principal || 0,
            moneda_id_linea: factura.moneda_id,
        },
        {
            cuenta_contable_id: CUENTA_VENTA_SERVICIOS,
            secuencia_linea_asiento: 3,
            glosa_detalle_linea: `Ingreso por servicios ${factura.numero_completo_comprobante}`,
            monto_debe: 0,
            monto_haber: (Number(factura.subtotal_afecto_impuestos) || 0) + (Number(factura.subtotal_exonerado_impuestos) || 0) + (Number(factura.subtotal_inafecto_impuestos) || 0),
            moneda_id_linea: factura.moneda_id,
        }
    ];
    
    const detallesFiltrados = asientoDetalles.filter(d => d.monto_debe! > 0 || d.monto_haber! > 0);

    const asientoCabecera: asientoContableService.AsientoContableCabecera = {
        empresa_id: factura.empresa_id_emisora!,
        periodo_contable_id: 1, // TEMPORAL: Idealmente, esto debería buscar el periodo contable abierto según la fecha_emision.
        tipo_asiento_contable_id: 1, // Asumiendo que el ID 1 es "Asiento de Venta"
        fecha_contabilizacion_asiento: factura.fecha_emision,
        moneda_id_asiento: factura.moneda_id,
        glosa_principal_asiento: `Por la venta según ${factura.tipo_comprobante_descripcion} ${factura.numero_completo_comprobante} a ${factura.cliente_razon_social}`,
        total_debe_asiento: 0, // El servicio lo recalculará
        total_haber_asiento: 0, // El servicio lo recalculará
        origen_documento_referencia_id: factura.factura_venta_id,
        origen_documento_tabla_referencia: 'facturasventa',
        detalles: detallesFiltrados,
    };
    
    await asientoContableService.createAsientoContableConClient(asientoCabecera, usuarioId, nombreUsuario, client);
}

export const aplicarSaldoAFactura = async (facturaId: number, empresaId: number, usuarioId: number, nombreUsuario: string): Promise<FacturaVenta> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Obtener la factura y verificar que se puede aplicar un pago
        const facturaResult = await client.query('SELECT * FROM public.facturasventa WHERE factura_venta_id = $1 AND empresa_id_emisora = $2 FOR UPDATE', [facturaId, empresaId]);
        if (facturaResult.rows.length === 0) {
            throw new Error('Factura no encontrada.');
        }
        const factura = facturaResult.rows[0];
        
        // Convertimos a número para asegurar que las comparaciones funcionen bien
        const saldoPendienteNumerico = parseFloat(factura.saldo_pendiente_cobro);
        if (saldoPendienteNumerico <= 0) {
            throw new Error('La factura ya está completamente pagada.');
        }

        // 2. Obtener el cliente y su saldo a favor
        const clienteResult = await client.query('SELECT * FROM public.clientes WHERE cliente_id = $1 FOR UPDATE', [factura.cliente_id]);
        if (clienteResult.rows.length === 0) {
            throw new Error('Cliente asociado a la factura no encontrado.');
        }
        const cliente = clienteResult.rows[0];
        const saldoAFavorNumerico = parseFloat(cliente.saldo_a_favor);
        if (saldoAFavorNumerico <= 0) {
            throw new Error('El cliente no tiene saldo a favor para aplicar.');
        }

        // 3. Determinar el monto a aplicar
        const montoAAplicar = Math.min(saldoAFavorNumerico, saldoPendienteNumerico);

        // 4. Actualizar el saldo del cliente
        await client.query('UPDATE public.clientes SET saldo_a_favor = saldo_a_favor - $1 WHERE cliente_id = $2', [montoAAplicar, cliente.cliente_id]);

        // 5. Actualizar el saldo de la factura
        await client.query('UPDATE public.facturasventa SET monto_total_pagado = monto_total_pagado + $1 WHERE factura_venta_id = $2', [montoAAplicar, facturaId]);

        // 6. (Recomendado) Registrar un "Pago Recibido" para auditoría
        await client.query(`
            INSERT INTO public.pagosrecibidoscxc (empresa_id_receptora, cliente_id, fecha_pago, moneda_id_pago, monto_total_pagado_cliente, medio_pago_utilizado, glosa_o_descripcion_pago, estado_pago, usuario_creacion_id, fecha_creacion)
            VALUES ($1, $2, NOW(), $3, $4, 'Aplicación de Saldo a Favor', $5, 'Aplicado', $6, NOW())
        `, [empresaId, cliente.cliente_id, factura.moneda_id, montoAAplicar, `Aplicación a factura ${factura.numero_completo_comprobante}`, usuarioId]);

        await client.query('COMMIT');

        // --- ¡CORRECCIÓN AQUÍ! ---
        // Volvemos a obtener la factura y nos aseguramos de que no sea nula antes de devolverla.
        const facturaActualizada = await getFacturaVentaById(facturaId, empresaId);
        if (!facturaActualizada) {
            // Esto es muy improbable que ocurra, pero satisface a TypeScript.
            throw new Error('No se pudo obtener la factura actualizada después de aplicar el saldo.');
        }
        
        // Aquí puedes añadir el log de auditoría si lo deseas

        return facturaActualizada;

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error al aplicar saldo a factura:", error);
        throw error;
    } finally {
        client.release();
    }
};