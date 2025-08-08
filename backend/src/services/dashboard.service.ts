// Archivo: backend/src/services/dashboard.service.ts
import pool from '../config/database';

export const getDashboardKpis = async (empresaId: number) => {
    const client = await pool.connect();
    try {
        // --- VENTAS ---
        const ventasHoyResult = await client.query(
            `SELECT COALESCE(SUM(monto_total_factura), 0.00) as total 
             FROM public.facturasventa 
             WHERE empresa_id_emisora = $1 AND fecha_emision = CURRENT_DATE AND estado_factura <> 'Anulada'`,
            [empresaId]
        );
        const ventasSemanaResult = await client.query(
            `SELECT COALESCE(SUM(monto_total_factura), 0.00) as total 
             FROM public.facturasventa 
             WHERE empresa_id_emisora = $1 AND fecha_emision >= (CURRENT_DATE - INTERVAL '6 days') AND estado_factura <> 'Anulada'`,
            [empresaId]
        );
        const ventasMesResult = await client.query(
            `SELECT COALESCE(SUM(monto_total_factura), 0.00) as total 
             FROM public.facturasventa 
             WHERE empresa_id_emisora = $1 AND DATE_TRUNC('month', fecha_emision) = DATE_TRUNC('month', CURRENT_DATE) AND estado_factura <> 'Anulada'`,
            [empresaId]
        );

        // --- CUENTAS POR COBRAR Y PAGAR ---
        const cxcResult = await client.query(
            `SELECT COALESCE(SUM(saldo_pendiente_cobro), 0.00) as total 
             FROM public.facturasventa 
             WHERE empresa_id_emisora = $1 AND estado_factura NOT IN ('Pagada', 'Anulada')`,
            [empresaId]
        );
        const cxpResult = await client.query(
            `SELECT COALESCE(SUM(saldo_pendiente_pago), 0.00) as total 
             FROM public.obligaciones 
             WHERE empresa_id_deudora = $1 AND estado_obligacion NOT IN ('Pagada', 'Anulada')`,
            [empresaId]
        );

        // --- NUEVOS CLIENTES ---
        const nuevosClientesResult = await client.query(
            `SELECT COUNT(*) as total 
             FROM public.clientes 
             WHERE empresa_id_vinculada = $1 AND DATE_TRUNC('month', fecha_alta_sistema) = DATE_TRUNC('month', CURRENT_DATE)`,
            [empresaId]
        );
        
        return {
            ventasHoy: parseFloat(ventasHoyResult.rows[0].total),
            ventasSemana: parseFloat(ventasSemanaResult.rows[0].total),
            ventasMes: parseFloat(ventasMesResult.rows[0].total),
            cuentasPorCobrar: parseFloat(cxcResult.rows[0].total),
            cuentasPorPagar: parseFloat(cxpResult.rows[0].total),
            nuevosClientesMes: parseInt(nuevosClientesResult.rows[0].total, 10),
        };

    } finally {
        client.release();
    }
};

// --- REEMPLAZA ESTA FUNCIÓN COMPLETA ---
export const getFlujoCaja30Dias = async (empresaId: number) => {
    const client = await pool.connect();
    try {
        // --- ¡LÓGICA DE FECHAS CORREGIDA Y ROBUSTA! ---
        // Usamos NOW() y especificamos la zona horaria para evitar ambigüedades.
        // 'America/Lima' es la zona horaria para Perú.
        const query = `
            WITH dias AS (
                SELECT generate_series(
                    (NOW() AT TIME ZONE 'America/Lima')::date - INTERVAL '29 days', 
                    (NOW() AT TIME ZONE 'America/Lima')::date, 
                    '1 day'
                )::date as dia
            ),
            ingresos AS (
                SELECT 
                    fecha_pago::date as dia, 
                    COALESCE(SUM(monto_total_pagado_cliente), 0) as total_ingresos
                FROM pagosrecibidoscxc
                WHERE 
                    empresa_id_receptora = $1 
                    AND fecha_pago >= (NOW() AT TIME ZONE 'America/Lima')::date - INTERVAL '29 days'
                GROUP BY fecha_pago::date
            ),
            egresos AS (
                SELECT 
                    fecha_efectiva_pago::date as dia, 
                    COALESCE(SUM(monto_total_desembolsado), 0) as total_egresos
                FROM pagosrealizadoscxp
                WHERE 
                    empresa_id_pagadora = $1 
                    AND fecha_efectiva_pago >= (NOW() AT TIME ZONE 'America/Lima')::date - INTERVAL '29 days'
                GROUP BY fecha_efectiva_pago::date
            )
            SELECT 
                TO_CHAR(d.dia, 'YYYY-MM-DD') as fecha,
                COALESCE(i.total_ingresos, 0) as ingresos,
                COALESCE(e.total_egresos, 0) as egresos
            FROM dias d
            LEFT JOIN ingresos i ON d.dia = i.dia
            LEFT JOIN egresos e ON d.dia = e.dia
            ORDER BY d.dia ASC;
        `;
        const result = await client.query(query, [empresaId]);
        return result.rows;
    } finally {
        client.release();
    }
};
 

// NUEVA FUNCIÓN para el resumen anual de ventas y compras
export const getResumenAnual = async (empresaId: number, anio: number) => {
    const client = await pool.connect();
    try {
        const query = `
            WITH meses AS (
                SELECT generate_series(1, 12) as mes
            ),
            ventas_mensuales AS (
                SELECT 
                    EXTRACT(MONTH FROM fecha_emision) as mes,
                    COALESCE(SUM(monto_total_factura), 0) as total_ventas
                FROM facturasventa
                WHERE empresa_id_emisora = $1 AND EXTRACT(YEAR FROM fecha_emision) = $2 AND estado_factura <> 'Anulada'
                GROUP BY EXTRACT(MONTH FROM fecha_emision)
            ),
            compras_mensuales AS (
                SELECT 
                    EXTRACT(MONTH FROM fecha_recepcion_documento) as mes,
                    COALESCE(SUM(monto_total_original_obligacion), 0) as total_compras
                FROM obligaciones
                WHERE empresa_id_deudora = $1 AND EXTRACT(YEAR FROM fecha_recepcion_documento) = $2 AND estado_obligacion <> 'Anulada'
                GROUP BY EXTRACT(MONTH FROM fecha_recepcion_documento)
            )
            SELECT 
                m.mes,
                COALESCE(v.total_ventas, 0) as ventas,
                COALESCE(c.total_compras, 0) as compras
            FROM meses m
            LEFT JOIN ventas_mensuales v ON m.mes = v.mes
            LEFT JOIN compras_mensuales c ON m.mes = c.mes
            ORDER BY m.mes ASC;
        `;
        const result = await client.query(query, [empresaId, anio]);
        return result.rows;
    } finally {
        client.release();
    }
};

export const getResumenPrestamos = async (empresaId: number) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT 
                tipo_prestamo,
                COALESCE(SUM(monto_principal_original), 0.00) as total_principal,
                COALESCE(SUM( (SELECT SUM(monto_capital_cuota) FROM public.cuotasprestamo cp WHERE cp.prestamo_id = p.prestamo_id AND cp.estado_cuota = 'Pendiente') ), 0.00) as saldo_pendiente
            FROM public.prestamos p
            WHERE empresa_id_titular = $1 AND estado_prestamo = 'Vigente'
            GROUP BY tipo_prestamo;
        `;
        const result = await client.query(query, [empresaId]);
        return result.rows;
    } finally {
        client.release();
    }
};

// NUEVA FUNCIÓN para el top 5 de deudas
export const getTopDeudas = async (empresaId: number) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT 
                pro.razon_social_o_nombres as proveedor,
                COALESCE(SUM(o.saldo_pendiente_pago), 0.00) as total_deuda
            FROM public.obligaciones o
            JOIN public.proveedores pro ON o.proveedor_id = pro.proveedor_id
            WHERE o.empresa_id_deudora = $1 AND o.estado_obligacion = 'Pendiente'
            GROUP BY pro.razon_social_o_nombres
            ORDER BY total_deuda DESC
            LIMIT 5;
        `;
        const result = await client.query(query, [empresaId]);
        return result.rows;
    } finally {
        client.release();
    }
};

// NUEVA FUNCIÓN para el top 5 de clientes por ventas
export const getTopClientes = async (empresaId: number, anio: number) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT 
                c.razon_social_o_nombres as cliente,
                COALESCE(SUM(fv.monto_total_factura), 0.00) as total_facturado
            FROM public.facturasventa fv
            JOIN public.clientes c ON fv.cliente_id = c.cliente_id
            WHERE fv.empresa_id_emisora = $1 
              AND EXTRACT(YEAR FROM fv.fecha_emision) = $2 
              AND fv.estado_factura <> 'Anulada'
            GROUP BY c.razon_social_o_nombres
            ORDER BY total_facturado DESC
            LIMIT 5;
        `;
        const result = await client.query(query, [empresaId, anio]);
        return result.rows;
    } finally {
        client.release();
    }
};

// NUEVA FUNCIÓN para el top 5 de proveedores por compras
export const getTopProveedores = async (empresaId: number, anio: number) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT 
                p.razon_social_o_nombres as proveedor,
                COALESCE(SUM(o.monto_total_original_obligacion), 0.00) as total_comprado
            FROM public.obligaciones o
            JOIN public.proveedores p ON o.proveedor_id = p.proveedor_id
            WHERE o.empresa_id_deudora = $1 
              AND EXTRACT(YEAR FROM o.fecha_recepcion_documento) = $2 
              AND o.estado_obligacion <> 'Anulada'
            GROUP BY p.razon_social_o_nombres
            ORDER BY total_comprado DESC
            LIMIT 5;
        `;
        const result = await client.query(query, [empresaId, anio]);
        return result.rows;
    } finally {
        client.release();
    }
};

// NUEVA FUNCIÓN para la distribución de proyectos por estado
export const getProyectosPorEstado = async (empresaId: number) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT 
                estado_proyecto as estado,
                COUNT(*) as cantidad
            FROM public.proyectos
            WHERE empresa_id_responsable = $1
            GROUP BY estado_proyecto
            ORDER BY estado;
        `;
        const result = await client.query(query, [empresaId]);
        return result.rows;
    } finally {
        client.release();
    }
};

// NUEVA FUNCIÓN para el gráfico de ventas por servicio
export const getVentasPorServicio = async (empresaId: number, anio: number) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT 
                s.nombre_servicio as servicio,
                COALESCE(SUM(dfv.monto_total_linea_item), 0.00) as total_vendido
            FROM public.detallesfacturaventa dfv
            JOIN public.servicios s ON dfv.servicio_id = s.servicio_id
            JOIN public.facturasventa fv ON dfv.factura_venta_id = fv.factura_venta_id
            WHERE fv.empresa_id_emisora = $1 
              AND EXTRACT(YEAR FROM fv.fecha_emision) = $2 
              AND fv.estado_factura <> 'Anulada'
            GROUP BY s.nombre_servicio
            ORDER BY total_vendido DESC;
        `;
        const result = await client.query(query, [empresaId, anio]);
        return result.rows;
    } finally {
        client.release();
    }
};

// NUEVA FUNCIÓN para el gráfico de rentabilidad por cliente
export const getRentabilidadClientes = async (empresaId: number, anio: number) => {
    const client = await pool.connect();
    try {
        const query = `
            WITH VentasPorCliente AS (
                SELECT
                    c.cliente_id,
                    c.razon_social_o_nombres AS cliente,
                    COALESCE(SUM(fv.monto_total_factura), 0.00) as total_ingresos
                FROM public.facturasventa fv
                JOIN public.clientes c ON fv.cliente_id = c.cliente_id
                WHERE fv.empresa_id_emisora = $1
                  AND EXTRACT(YEAR FROM fv.fecha_emision) = $2
                  AND fv.estado_factura <> 'Anulada'
                GROUP BY c.cliente_id, c.razon_social_o_nombres
            ),
            CostosPorCliente AS (
                SELECT
                    c.cliente_id,
                    COALESCE(SUM(p.monto_presupuestado_costos), 0.00) as total_costos
                FROM public.proyectos p
                JOIN public.clientes c ON p.cliente_id = c.cliente_id
                WHERE p.empresa_id_responsable = $1
                  AND EXTRACT(YEAR FROM p.fecha_inicio_proyectada) = $2 -- Usamos el año del proyecto
                GROUP BY c.cliente_id
            )
            SELECT
                v.cliente,
                v.total_ingresos,
                COALESCE(c.total_costos, 0.00) as total_costos
            FROM VentasPorCliente v
            LEFT JOIN CostosPorCliente c ON v.cliente_id = c.cliente_id
            ORDER BY v.total_ingresos DESC
            LIMIT 5;
        `;
        const result = await client.query(query, [empresaId, anio]);
        return result.rows;
    } finally {
        client.release();
    }
};
