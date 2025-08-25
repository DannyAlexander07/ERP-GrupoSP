// Archivo: backend/src/services/venta.service.ts 
import pool from '../config/database';
import QRCode from 'qrcode';
import path from 'path';
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
    servicio_codigo?: string; // <-- La propiedad que faltaba
    servicio_nombre?: string;
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
    codigo_hash?: string | null;

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
            empresa_id_emisora, cliente_id, tipo_comprobante_venta_id, 
            serie_comprobante, // <-- VOLVEMOS A USAR ESTE
            numero_correlativo_comprobante, // <-- VOLVEMOS A USAR ESTE
            fecha_emision, fecha_vencimiento, moneda_id, tipo_cambio_aplicado,
            condicion_pago_id, subtotal_afecto_impuestos, subtotal_inafecto_impuestos,
            subtotal_exonerado_impuestos, monto_descuento_global, monto_impuesto_principal,
            monto_otros_tributos, monto_total_factura, orden_compra_cliente_referencia,
            proyecto_id_referencia, observaciones_factura, vendedor_asignado_usuario_id,
            detalles 
        } = factura;

        const insertFacturaQuery = `
            INSERT INTO public.facturasventa (
                empresa_id_emisora, cliente_id, tipo_comprobante_venta_id, 
                serie_comprobante, numero_correlativo_comprobante, -- <-- VOLVEMOS A INSERTAR LAS PARTES
                fecha_emision, fecha_vencimiento, moneda_id, tipo_cambio_aplicado,
                condicion_pago_id, subtotal_afecto_impuestos, subtotal_inafecto_impuestos,
                subtotal_exonerado_impuestos, monto_descuento_global, monto_impuesto_principal,
                monto_otros_tributos, monto_total_factura, estado_factura, orden_compra_cliente_referencia,
                proyecto_id_referencia, observaciones_factura, vendedor_asignado_usuario_id, usuario_creacion_id, fecha_creacion
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'Emitida', $18, $19, $20, $21, $22, NOW())
            RETURNING *;
        `;

        const facturaResult = await client.query(insertFacturaQuery, [
            empresa_id_emisora, cliente_id, tipo_comprobante_venta_id, 
            serie_comprobante, // <-- PASAMOS LA SERIE
            numero_correlativo_comprobante, // <-- PASAMOS EL NÚMERO
            fecha_emision, fecha_vencimiento || null,
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
    // 1. Obtener todos los datos necesarios (esta parte no cambia)
    const facturaData = await getFacturaVentaById(facturaId, empresaId);
    if (!facturaData) {
        throw new Error('Factura no encontrada para generar XML.');
    }
    // ... (las demás consultas a empresa y cliente se mantienen igual)
    const empresaQuery = await pool.query('SELECT * FROM Empresas WHERE empresa_id = $1', [empresaId]);
    const emisor = empresaQuery.rows[0];
    const clienteQuery = await pool.query('SELECT * FROM Clientes WHERE cliente_id = $1', [facturaData.cliente_id]);
    const receptor = clienteQuery.rows[0];


    // 2. Construir el XML con las correcciones de tipo
    const root = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('Invoice', {
        'xmlns': 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
        'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
        'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
        'xmlns:ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2'
      })
        .ele('ext:UBLExtensions')
          .ele('ext:UBLExtension')
            .ele('ext:ExtensionContent')
              .ele('ds:Signature', { Id: 'SignatureSP' }).up()
            .up()
          .up()
        .up()
        .ele('cbc:UBLVersionID').txt('2.1').up()
        .ele('cbc:CustomizationID').txt('2.0').up()
        .ele('cbc:ID').txt(facturaData.numero_completo_comprobante || '').up() // <-- CORRECCIÓN: Añadir fallback para undefined
        .ele('cbc:IssueDate').txt(new Date(facturaData.fecha_emision).toISOString().split('T')[0]).up()
        .ele('cbc:InvoiceTypeCode', { listID: '0101' }).txt('01').up()
        .ele('cbc:Note', { languageLocaleID: '1000' }).txt('CIENTO CINCUENTA SOLES CON 00/100').up()
        .ele('cbc:DocumentCurrencyCode').txt(facturaData.moneda_nombre === 'Soles Peruanos' ? 'PEN' : 'USD').up()
        
        .ele('cac:Signature')
          .ele('cbc:ID').txt(emisor.numero_identificacion_fiscal || '').up() // <-- CORRECCIÓN: Añadir fallback
          .ele('cac:SignatoryParty')
            .ele('cac:PartyIdentification').ele('cbc:ID').txt(emisor.numero_identificacion_fiscal || '').up().up() // <-- CORRECCIÓN: Añadir fallback
            .ele('cac:PartyName').ele('cbc:Name').txt(emisor.nombre_empresa || '').up().up() // <-- CORRECCIÓN: Añadir fallback
          .up()
          .ele('cac:DigitalSignatureAttachment').ele('cac:ExternalReference').ele('cbc:URI').txt(`#SignatureSP`).up().up().up()
        .up()

        .ele('cac:AccountingSupplierParty')
          .ele('cac:Party')
            .ele('cac:PartyIdentification').ele('cbc:ID', { schemeID: '6' }).txt(emisor.numero_identificacion_fiscal || '').up().up() // <-- CORRECCIÓN: Añadir fallback
            .ele('cac:PartyName').ele('cbc:Name').txt(emisor.nombre_comercial || emisor.nombre_empresa || '').up().up() // <-- CORRECCIÓN: Añadir fallback
            .ele('cac:PartyLegalEntity').ele('cbc:RegistrationName').txt(emisor.nombre_empresa || '').up().up() // <-- CORRECCIÓN: Añadir fallback
          .up()
        .up()

        .ele('cac:AccountingCustomerParty')
          .ele('cac:Party')
            .ele('cac:PartyIdentification').ele('cbc:ID', { schemeID: receptor.tipo_documento_identidad === 'RUC' ? '6' : '1' }).txt(receptor.numero_documento_identidad || '').up().up() // <-- CORRECCIÓN: Añadir fallback
            .ele('cac:PartyLegalEntity').ele('cbc:RegistrationName').txt(receptor.razon_social_o_nombres || '').up().up() // <-- CORRECCIÓN: Añadir fallback
          .up()
        .up()

        // ... (Los totales con .toFixed(2) ya devuelven un string, así que están bien)
        .ele('cac:TaxTotal')
          .ele('cbc:TaxAmount', { currencyID: 'PEN' }).txt(Number(facturaData.monto_impuesto_principal).toFixed(2)).up()
          // ...
        .up()
        .ele('cac:LegalMonetaryTotal')
            .ele('cbc:LineExtensionAmount', { currencyID: 'PEN' }).txt(Number(facturaData.subtotal_afecto_impuestos).toFixed(2)).up()
            .ele('cbc:TaxInclusiveAmount', { currencyID: 'PEN' }).txt(Number(facturaData.monto_total_factura).toFixed(2)).up()
            .ele('cbc:PayableAmount', { currencyID: 'PEN' }).txt(Number(facturaData.monto_total_factura).toFixed(2)).up()
        .up();

    facturaData.detalles?.forEach((item, index) => {
        root.ele('cac:InvoiceLine')
            .ele('cbc:ID').txt((index + 1).toString()).up() // <-- CORRECCIÓN: Convertir número a string
            .ele('cbc:InvoicedQuantity', { unitCode: 'NIU' }).txt(item.cantidad.toString()).up() // <-- CORRECCIÓN: Convertir número a string
            .ele('cbc:LineExtensionAmount', { currencyID: 'PEN' }).txt(Number(item.subtotal_linea_sin_impuestos).toFixed(2)).up()
            .ele('cac:PricingReference')
              .ele('cac:AlternativeConditionPrice')
                .ele('cbc:PriceAmount', { currencyID: 'PEN' }).txt(Number(item.precio_unitario_con_impuestos).toFixed(2)).up()
                .ele('cbc:PriceTypeCode').txt('01').up()
              .up()
            .up()
            .ele('cac:TaxTotal')
              .ele('cbc:TaxAmount', { currencyID: 'PEN' }).txt(Number(item.monto_impuesto_principal_item).toFixed(2)).up()
            .up()
            .ele('cac:Item')
              .ele('cbc:Description').txt(item.descripcion_item_servicio_factura || '').up() // <-- CORRECCIÓN: Añadir fallback
            .up()
            .ele('cac:Price')
              .ele('cbc:PriceAmount', { currencyID: 'PEN' }).txt(Number(item.valor_unitario_sin_impuestos).toFixed(2)).up()
            .up()
        .up();
    });

    const xmlString = root.end({ prettyPrint: true });
    return Buffer.from(xmlString, 'utf-8');
};

export const getFacturaVentaCdr = async (facturaId: number, empresaId: number): Promise<Buffer | null> => {
    // 1. Buscamos en la base de datos si ya existe un CDR para esta factura.
    const result = await pool.query(
        'SELECT archivo_cdr FROM facturasventa WHERE factura_venta_id = $1 AND empresa_id_emisora = $2',
        [facturaId, empresaId]
    );

    if (result.rows.length > 0 && result.rows[0].archivo_cdr) {
        // 2. Si la columna tiene datos (el Buffer del ZIP), lo devolvemos.
        return result.rows[0].archivo_cdr;
    } else {
        // 3. Si no hay CDR guardado, devolvemos null para que el controlador indique un error 404 (No Encontrado).
        return null;
    }
};

// Generar PDF de la factura de venta (RENOMBRADO y CORREGIDO)
export const generateFacturaVentaPdf = async (facturaId: number, empresaId: number): Promise<Buffer> => {
    // 1. Obtener los datos completos de la factura (incluyendo el nuevo campo codigo_hash)
    const factura = await getFacturaVentaById(facturaId, empresaId);
    if (!factura) throw new Error('Factura no encontrada');

    const empresaQuery = await pool.query('SELECT * FROM Empresas WHERE empresa_id = $1', [empresaId]);
    const emisor = empresaQuery.rows[0];

    const clienteQuery = await pool.query('SELECT * FROM Clientes WHERE cliente_id = $1', [factura.cliente_id]);
    const receptor = clienteQuery.rows[0];

    // 2. Construir la cadena de texto para el Código QR
    // El formato oficial de SUNAT es: RUC|TIPO|SERIE|NUMERO|IGV|TOTAL|FECHA|TIPO_DOC_CLIENTE|NRO_DOC_CLIENTE|HASH
    const tipoComprobanteQuery = await pool.query('SELECT codigo_fiscal FROM tiposcomprobanteventa WHERE tipo_comprobante_venta_id = $1', [factura.tipo_comprobante_venta_id]);
    const tipoComprobanteCodigo = tipoComprobanteQuery.rows[0]?.codigo_fiscal || '01';
    
    const tipoDocClienteCodigo = receptor.tipo_documento_identidad === 'RUC' ? '6' : '1';

    const hashFinal = factura.codigo_hash || 'PENDIENTE DE ENVÍO A SUNAT';

    const qrDataString = [
        emisor.numero_identificacion_fiscal,
        tipoComprobanteCodigo,
        factura.serie_comprobante,
        factura.numero_correlativo_comprobante,
        Number(factura.monto_impuesto_principal).toFixed(2),
        Number(factura.monto_total_factura).toFixed(2),
        new Date(factura.fecha_emision).toISOString().split('T')[0],
        tipoDocClienteCodigo,
        receptor.numero_documento_identidad,
        hashFinal // Nota: El hash real se genera después de firmar el XML
    ].join('|');

    // 3. Generar la imagen del QR como un Data URL (formato de texto)
    const qrCodeDataURL = await QRCode.toDataURL(qrDataString);

    // 4. Construir el PDF
    return new Promise((resolve) => {
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // Paleta de Colores
        const colorPrincipal = '#2c3e50';
        const colorSecundario = '#34495e';
        const colorGrisTexto = '#333333';
        const colorGrisClaro = '#7f8c8d';
        const colorBordeTabla = '#bdc3c7';

        // Función de Ayuda para la Cabecera
        const drawHeader = () => {
            try {
                const logoPath = path.join(__dirname, '../../public/images/logo.jpeg');
                doc.image(logoPath, 40, 40, { width: 80 });
            } catch (error) {
                console.error("No se pudo cargar el logo.");
            }

            const textStartX = 140;
            doc.fillColor(colorPrincipal).fontSize(16).font('Helvetica-Bold').text(emisor.nombre_empresa, textStartX, 45, { width: 220 });

            const fullAddress = emisor.direccion_fiscal_completa || '';
            const addressParts = fullAddress.split(',');
            let addressLine1 = fullAddress;
            let addressLine2 = '';
            if (addressParts.length >= 2) {
                addressLine1 = addressParts.slice(0, addressParts.length - 2).join(',');
                addressLine2 = addressParts.slice(addressParts.length - 2).join(',').trim();
            }

            doc.fontSize(9).font('Helvetica').fillColor(colorGrisClaro)
                .text(addressLine1, textStartX, doc.y, { width: 220 })
                .text(addressLine2, textStartX, doc.y, { width: 220 })
                .text(`Tel: ${emisor.telefono_contacto || ''}`, textStartX, doc.y)
                .text(`RUC: ${emisor.numero_identificacion_fiscal}`, textStartX, doc.y);

            const boxX = 380;
            const boxY = 40;
            const boxHeight = 40;
            const tipoComprobanteTexto = `${(factura.tipo_comprobante_descripcion || 'COMPROBANTE').toUpperCase()}\nELECTRÓNICA`;
            
            doc.fillColor(colorPrincipal).rect(boxX, boxY, 170, 35).fill();
            doc.fillColor('white').fontSize(11).font('Helvetica-Bold').text(tipoComprobanteTexto, boxX, boxY + 7, { align: 'center', width: 170 });
            
            const bottomOfBox = boxY + boxHeight;
            doc.fillColor(colorGrisTexto).fontSize(11).font('Helvetica-Bold').text(`RUC: ${emisor.numero_identificacion_fiscal}`, boxX + 10, bottomOfBox + 5);
            doc.text(`${factura.numero_completo_comprobante}`, boxX + 10, bottomOfBox + 20);
        };

        // Función de Ayuda para la Info del Cliente
        const drawClientInfo = () => {
            const yPos = Math.max(doc.y, 120) + 15;
            doc.moveTo(40, yPos).lineTo(550, yPos).stroke(colorBordeTabla);
            const clientInfoY = yPos + 15;
            doc.fillColor(colorGrisClaro).fontSize(9).font('Helvetica-Bold').text('CLIENTE:', 40, clientInfoY);
            doc.fillColor(colorGrisTexto).font('Helvetica')
               .text(`${receptor.razon_social_o_nombres}`, 90, clientInfoY, { width: 280 })
               .text(`DOCUMENTO: ${receptor.numero_documento_identidad}`, 90, doc.y)
               .text(`DIRECCIÓN: ${receptor.direccion_fiscal_completa || 'N/A'}`, 90, doc.y, { width: 280 });
            const emissionDateY = clientInfoY;
            doc.fillColor(colorGrisClaro).font('Helvetica-Bold').text('Fecha Emisión:', 380, emissionDateY, {align: 'right', width: 90});
            doc.fillColor(colorGrisTexto).font('Helvetica').text(new Date(factura.fecha_emision).toLocaleDateString('es-PE'), 470, emissionDateY, {align: 'right', width: 80});
            if (factura.fecha_vencimiento) {
                doc.fillColor(colorGrisClaro).font('Helvetica-Bold').text('Fecha Venc.:', 380, emissionDateY + 15, {align: 'right', width: 90});
                doc.fillColor(colorGrisTexto).font('Helvetica').text(new Date(factura.fecha_vencimiento).toLocaleDateString('es-PE'), 470, emissionDateY + 15, {align: 'right', width: 80});
            }
            doc.moveTo(40, doc.y + 10).lineTo(550, doc.y + 10).stroke(colorBordeTabla);
        };

        // Función de Ayuda para la Tabla de Items
        const drawInvoiceTable = () => {
            const tableTop = doc.y + 20;
            let y = tableTop;
            const tableHeadersX = 40;
            
            doc.rect(40, y, 510, 25).fill(colorSecundario);
            doc.fillColor('white').font('Helvetica-Bold').fontSize(10);
            doc.text('CÓDIGO', tableHeadersX + 10, y + 8);
            doc.text('DESCRIPCIÓN', tableHeadersX + 70, y + 8);
            doc.text('CANT.', tableHeadersX + 310, y + 8, { width: 40, align: 'right' });
            doc.text('V. UNIT.', tableHeadersX + 360, y + 8, { width: 60, align: 'right' });
            doc.text('TOTAL', tableHeadersX + 430, y + 8, { width: 70, align: 'right' });
            y += 25;

            doc.font('Helvetica').fontSize(10).fillColor(colorGrisTexto);
            
            factura.detalles?.forEach((item, i) => {
                const rowY = y + (i * 25);
                doc.text(item.servicio_codigo || 'N/A', tableHeadersX + 10, rowY + 8, { width: 50 });
                doc.text(item.descripcion_item_servicio_factura, tableHeadersX + 70, rowY + 8, { width: 240 });
                doc.text(item.cantidad.toString(), tableHeadersX + 310, rowY + 8, { width: 40, align: 'right' });
                doc.text(Number(item.valor_unitario_sin_impuestos).toFixed(2), tableHeadersX + 360, rowY + 8, { width: 60, align: 'right' });
                doc.text(Number(item.monto_total_linea_item).toFixed(2), tableHeadersX + 430, rowY + 8, { width: 70, align: 'right' });
                doc.moveTo(40, rowY + 25).lineTo(550, rowY + 25).stroke(colorBordeTabla);
            });

            y += (factura.detalles?.length || 0) * 25;
            
            const totalsY = y + 10;
            const totalLabelX = 370;
            const totalValueX = 460;
            doc.font('Helvetica').text('Subtotal', totalLabelX, totalsY, { align: 'right', width: 80 });
            doc.text(Number(factura.subtotal_afecto_impuestos).toFixed(2), totalValueX, totalsY, { align: 'right', width: 90 });
            doc.text('IGV (18%)', totalLabelX, totalsY + 15, { align: 'right', width: 80 });
            doc.text(Number(factura.monto_impuesto_principal).toFixed(2), totalValueX, totalsY + 15, { align: 'right', width: 90 });
            doc.moveDown(1);
            const finalTotalY = doc.y;
            doc.font('Helvetica-Bold').fontSize(12);
            doc.rect(totalLabelX - 20, finalTotalY - 5, 200, 25).fill(colorPrincipal);
            doc.fillColor('#FFFFFF').text('TOTAL', totalLabelX, finalTotalY, { align: 'right', width: 80 });
            doc.text(`${factura.moneda_nombre === 'Soles Peruanos' ? 'S/' : '$'} ${Number(factura.monto_total_factura).toFixed(2)}`, totalValueX, finalTotalY, { align: 'right', width: 90 });
        };

        // Función de Ayuda para el Pie de Página
        const drawFooter = () => {
            const yPos = 700;
            doc.image(qrCodeDataURL, 40, yPos - 40, { width: 90 });
            doc.fontSize(8).fillColor(colorGrisClaro)
                .text('Representación impresa de la Factura Electrónica.', 150, yPos)
                .text('Consulte su documento en nuestro portal web.', 150, doc.y)
                .text(`HASH: ${hashFinal}`, 150, doc.y, { // <-- Se usa el hash correcto
                    // Añadimos estas opciones para que el hash largo no se desborde
                    width: 400,
                    lineBreak: true
                });
        };
        
        // --- Dibujar el documento ---
        drawHeader();
        drawClientInfo();
        drawInvoiceTable();
        drawFooter();
        
        doc.end();
    });
};

// NUEVA FUNCIÓN AUXILIAR (puedes ponerla al final del archivo)
async function generarAsientoDeVenta(factura: FacturaVenta, client: any, usuarioId: number, nombreUsuario: string) {
    // --- Configuración de Cuentas Contables (Asegúrate de que estos IDs sean correctos) ---
    const CUENTA_CLIENTES_NACIONALES = 1;
    const CUENTA_IGV_POR_PAGAR = 2;
    const CUENTA_VENTA_SERVICIOS = 3;

    // --- ¡INICIO DE LA MEJORA! Lógica para encontrar el período contable correcto ---
    const fechaFactura = new Date(factura.fecha_emision);
    // getMonth() es 0-11, por eso sumamos 1
    const anioFactura = fechaFactura.getFullYear();
    const mesFactura = fechaFactura.getMonth() + 1;

    const periodoResult = await client.query(
        'SELECT periodo_contable_id FROM public.periodoscontables WHERE anio_ejercicio = $1 AND mes_ejercicio = $2 AND empresa_id = $3',
        [anioFactura, mesFactura, factura.empresa_id_emisora]
    );

    if (periodoResult.rows.length === 0) {
        // Si no se encuentra el período, lanzamos un error claro.
        throw new Error(`No se encontró un período contable abierto para la fecha ${factura.fecha_emision}. Por favor, créalo en la configuración del sistema.`);
    }
    const periodoId = periodoResult.rows[0].periodo_contable_id;


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

export const firmarFacturaYEnviarASunat = async (facturaId: number, empresaId: number): Promise<{ exito: boolean; mensaje: string; hash: string }> => {
    // 1. OBTENER LOS DATOS DE LA FACTURA
    const factura = await getFacturaVentaById(facturaId, empresaId);
    if (!factura) {
        throw new Error('Factura no encontrada para firmar.');
    }
    console.log(`Paso 1: Obtenida información para la factura ${factura.numero_completo_comprobante}`);

    // 2. SIMULAR EL PROCESO DE FIRMA DIGITAL
    // En un caso real, aquí usarías tu certificado digital y una librería de firma.
    const crypto = require('crypto');
    const hashSimulado = crypto.createHash('sha256').update(new Date().toISOString()).digest('hex');
    console.log(`Paso 2: Firma digital simulada. Hash generado: ${hashSimulado}`);
    
    // 3. SIMULAR EL ENVÍO A SUNAT Y RECEPCIÓN DEL CDR
    console.log("Paso 3: Enviando a SUNAT (simulación)... ¡SUNAT aceptó!");
    const cdrSimulado = Buffer.from("Este es un CDR de prueba en un ZIP simulado para la factura " + factura.numero_completo_comprobante);

    // 4. GUARDAR LOS RESULTADOS EN LA BASE DE DATOS
    await pool.query(
        `UPDATE facturasventa 
         SET 
            codigo_hash = $1, 
            estado_sunat = 'Aceptada',
            archivo_cdr = $2,
            estado_factura = 'Aceptada'
         WHERE factura_venta_id = $3`,
        [hashSimulado, cdrSimulado, facturaId]
    );
    console.log(`Paso 4: Base de datos actualizada para la factura ${facturaId}.`);

    return {
        exito: true,
        mensaje: `Factura ${factura.numero_completo_comprobante} fue firmada y aceptada por SUNAT (simulación).`,
        hash: hashSimulado
    };
};