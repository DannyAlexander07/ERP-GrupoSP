import pool from '../config/database';

/**
 * Construye el nombre de archivo estándar para los Libros Electrónicos (PLE) de SUNAT.
 */
const buildPleFileName = (ruc: string, anio: number, mes: number, identificadorLibro: string): string => {
    const anioStr = anio.toString();
    const mesStr = mes.toString().padStart(2, '0');
    // Asumimos: Día 00, con contenido (1), moneda en PEN (1), y estado de operación (1)
    const flags = '00' + identificadorLibro + '010000' + '1' + '1';
    return `LE${ruc}${anioStr}${mesStr}${flags}.txt`;
};

/**
 * Genera el contenido del Libro Electrónico 8.1: Registro de Compras.
 */
export const generarPleRegistroCompras = async (empresaId: number, anio: number, mes: number): Promise<{ fileName: string, content: string }> => {
    const client = await pool.connect();
    try {
        const empresaResult = await client.query('SELECT numero_identificacion_fiscal FROM public.empresas WHERE empresa_id = $1', [empresaId]);
        if (empresaResult.rows.length === 0) throw new Error('No se encontró la empresa.');
        const ruc = empresaResult.rows[0].numero_identificacion_fiscal;
        
        const fileName = buildPleFileName(ruc, anio, mes, '080100'); // 080100: Código para Registro de Compras

        const query = `
            SELECT 
                TO_CHAR(o.fecha_recepcion_documento, 'YYYYMM00') AS f01_periodo,
                (o.obligacion_id)::text AS f02_cuo,
                'M' || LPAD(o.obligacion_id::text, 10, '0') AS f03_correlativo,
                TO_CHAR(o.fecha_emision_documento_proveedor, 'DD/MM/YYYY') AS f04_fecha_emision,
                TO_CHAR(o.fecha_vencimiento_original, 'DD/MM/YYYY') AS f05_fecha_vencimiento,
                COALESCE(tcc.codigo_fiscal, '00') AS f06_tipo_comprobante,
                COALESCE(SPLIT_PART(o.numero_documento_proveedor, '-', 1), '0') AS f07_serie_comprobante,
                '' AS f08_anio_dua_dsi,
                COALESCE(SPLIT_PART(o.numero_documento_proveedor, '-', 2), o.numero_documento_proveedor) AS f09_nro_comprobante,
                '' AS f10_pago_consolidado,
                p.tipo_documento_identidad AS f11_tipo_doc_proveedor,
                p.numero_documento_identidad AS f12_nro_doc_proveedor,
                p.razon_social_o_nombres AS f13_razon_social_proveedor,
                ROUND(o.monto_total_original_obligacion / 1.18, 2) AS f14_base_imponible_gravada,
                ROUND(o.monto_total_original_obligacion - (o.monto_total_original_obligacion / 1.18), 2) AS f15_igv_gravado,
                0.00 AS f16_base_imponible_mixta, 0.00 AS f17_igv_mixto,
                0.00 AS f18_base_imponible_no_gravada, 0.00 AS f19_igv_no_gravado,
                0.00 AS f20_valor_no_gravado, 0.00 AS f21_isc, 0.00 AS f22_otros_tributos,
                o.monto_total_original_obligacion AS f23_importe_total,
                m.codigo_moneda AS f24_moneda,
                1.0000 AS f25_tipo_cambio,
                '' AS f26_fecha_ref_nota, '' AS f27_tipo_ref_nota, '' AS f28_serie_ref_nota, '' AS f29_nro_ref_nota,
                o.monto_detraccion AS f30_monto_detraccion,
                '' AS f31_constancia_detraccion, '' AS f32_fecha_constancia_detraccion,
                '' AS f33_retencion_igv, '1' as f34_estado
            FROM public.obligaciones o
            JOIN public.proveedores p ON o.proveedor_id = p.proveedor_id
            JOIN public.tiposcomprobantecompra tcc ON o.tipo_comprobante_compra_id = tcc.tipo_comprobante_compra_id
            JOIN public.monedas m ON o.moneda_id_obligacion = m.moneda_id
            WHERE o.empresa_id_deudora = $1 AND EXTRACT(YEAR FROM o.fecha_recepcion_documento) = $2 AND EXTRACT(MONTH FROM o.fecha_recepcion_documento) = $3 AND o.estado_obligacion <> 'Anulada'
            ORDER BY o.fecha_emision_documento_proveedor, o.obligacion_id;
        `;
        
        const result = await client.query(query, [empresaId, anio, mes]);
        
        if (result.rows.length === 0) return { fileName, content: ' ' };
        
        const content = result.rows.map(row => Object.values(row).map(val => val ?? '').join('|') + '|').join('\r\n');
        return { fileName, content };
    } finally {
        client.release();
    }
};

/**
 * Genera el contenido del Libro Electrónico 14.1: Registro de Ventas e Ingresos.
 */
export const generarPleRegistroVentas = async (empresaId: number, anio: number, mes: number): Promise<{ fileName: string, content: string }> => {
    const client = await pool.connect();
    try {
        const empresaResult = await client.query('SELECT numero_identificacion_fiscal FROM public.empresas WHERE empresa_id = $1', [empresaId]);
        if (empresaResult.rows.length === 0) throw new Error('No se encontró la empresa.');
        const ruc = empresaResult.rows[0].numero_identificacion_fiscal;

        const fileName = buildPleFileName(ruc, anio, mes, '140100'); // 140100: Registro de Ventas

        const query = `
            SELECT 
                TO_CHAR(fv.fecha_emision, 'YYYYMM00') AS f01_periodo,
                (fv.factura_venta_id)::text AS f02_cuo,
                'M' || LPAD(fv.factura_venta_id::text, 10, '0') AS f03_correlativo,
                TO_CHAR(fv.fecha_emision, 'DD/MM/YYYY') AS f04_fecha_emision,
                TO_CHAR(fv.fecha_vencimiento, 'DD/MM/YYYY') AS f05_fecha_vencimiento,
                COALESCE(tcv.codigo_fiscal, '01') AS f06_tipo_comprobante,
                fv.serie_comprobante AS f07_serie_comprobante,
                fv.numero_correlativo_comprobante::text AS f08_nro_comprobante,
                '' AS f09_ticket,
                c.tipo_documento_identidad AS f10_tipo_doc_cliente,
                c.numero_documento_identidad AS f11_nro_doc_cliente,
                c.razon_social_o_nombres AS f12_razon_social_cliente,
                0.00 AS f13_valor_exportacion,
                fv.subtotal_afecto_impuestos AS f14_base_imponible_gravada,
                0.00 AS f15_descuento_base_imponible,
                fv.monto_impuesto_principal AS f16_igv,
                0.00 AS f17_descuento_igv,
                fv.subtotal_exonerado_impuestos AS f18_importe_exonerado,
                fv.subtotal_inafecto_impuestos AS f19_importe_inafecto,
                0.00 AS f20_isc,
                0.00 AS f21_base_imponible_arroz_pilado,
                0.00 AS f22_igv_arroz_pilado,
                0.00 AS f23_otros_tributos,
                fv.monto_total_factura AS f24_importe_total,
                m.codigo_moneda AS f25_moneda,
                fv.tipo_cambio_aplicado AS f26_tipo_cambio,
                '' AS f27_fecha_ref_nota, '' AS f28_tipo_ref_nota, '' AS f29_serie_ref_nota, '' AS f30_nro_ref_nota,
                '1' AS f31_estado
            FROM public.facturasventa fv
            JOIN public.clientes c ON fv.cliente_id = c.cliente_id
            JOIN public.tiposcomprobanteventa tcv ON fv.tipo_comprobante_venta_id = tcv.tipo_comprobante_venta_id
            JOIN public.monedas m ON fv.moneda_id = m.moneda_id
            WHERE fv.empresa_id_emisora = $1 
              AND EXTRACT(YEAR FROM fv.fecha_emision) = $2 
              AND EXTRACT(MONTH FROM fv.fecha_emision) = $3
              AND fv.estado_factura <> 'Anulada'
            ORDER BY fv.fecha_emision, fv.factura_venta_id;
        `;
        
        const result = await client.query(query, [empresaId, anio, mes]);
        
        if (result.rows.length === 0) return { fileName, content: ' ' };
        
        const content = result.rows.map(row => Object.values(row).map(val => val ?? '').join('|') + '|').join('\r\n');
        return { fileName, content };
    } finally {
        client.release();
    }
};