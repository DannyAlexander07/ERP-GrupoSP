// Archivo: backend/src/services/reporteContable.service.ts
import pool from '../config/database';

export interface EstadoResultados {
    ingresos: { descripcion: string; total: number }[];
    totalIngresos: number;
    gastos: { descripcion: string; total: number }[];
    totalGastos: number;
    utilidadNeta: number;
}

export const generarEstadoResultados = async (empresaId: number, fechaInicio: string, fechaFin: string): Promise<EstadoResultados> => {
    const client = await pool.connect();
    try {
        // ¡CORRECCIÓN! Eliminamos el cálculo de fechas aquí, ya que ahora las recibimos como parámetros.
        // const fechaInicio = new Date(anio, mes - 1, 1);
        // const fechaFin = new Date(anio, mes, 0);

        const query = `
            SELECT 
                pc.tipo_cuenta_general AS tipo,
                pc.nombre_cuenta_contable AS descripcion,
                COALESCE(SUM(acd.monto_haber - acd.monto_debe), 0.00) as total
            FROM 
                public.asientoscontablesdetalle acd
            JOIN 
                public.asientoscontablescabecera acc ON acd.asiento_cabecera_id = acc.asiento_cabecera_id
            JOIN 
                public.plancontable pc ON acd.cuenta_contable_id = pc.cuenta_contable_id
            WHERE 
                acc.empresa_id = $1
                AND acc.fecha_contabilizacion_asiento BETWEEN $2 AND $3 -- <-- Ahora usará las fechas correctas
                AND acc.estado_asiento <> 'Anulado'
                AND (pc.codigo_cuenta LIKE '7%' OR pc.codigo_cuenta LIKE '6%')
            GROUP BY 
                pc.tipo_cuenta_general, pc.nombre_cuenta_contable
            HAVING 
                SUM(acd.monto_haber - acd.monto_debe) <> 0
            ORDER BY 
                tipo, descripcion;
        `;

        // Pasamos las fechas recibidas directamente a la consulta
        const result = await client.query(query, [empresaId, fechaInicio, fechaFin]);

        const reporte: EstadoResultados = {
            ingresos: [],
            totalIngresos: 0,
            gastos: [],
            totalGastos: 0,
            utilidadNeta: 0,
        };

        result.rows.forEach(row => {
            const total = parseFloat(row.total);
            if (row.tipo === 'Ingresos') {
                reporte.ingresos.push({ descripcion: row.descripcion, total: total });
                reporte.totalIngresos += total;
            } else if (row.tipo === 'Gastos') {
                const gastoPositivo = -total;
                reporte.gastos.push({ descripcion: row.descripcion, total: gastoPositivo });
                reporte.totalGastos += gastoPositivo;
            }
        });

        reporte.utilidadNeta = reporte.totalIngresos - reporte.totalGastos;

        return reporte;

    } finally {
        client.release();
    }
};

export const generarDatosGraficoCascada = async (empresaId: number, anio: number, mes: number) => {
    const client = await pool.connect();
    try {
        const fechaInicio = new Date(anio, mes - 1, 1);
        const fechaFin = new Date(anio, mes, 0);

        const query = `
            SELECT
                COALESCE(SUM(acd.monto_haber) FILTER (WHERE pc.codigo_cuenta LIKE '7%'), 0.00) AS "totalIngresos",
                COALESCE(SUM(acd.monto_debe) FILTER (WHERE pc.codigo_cuenta LIKE '6%'), 0.00) AS "totalGastos"
            FROM 
                public.asientoscontablesdetalle acd
            JOIN 
                public.asientoscontablescabecera acc ON acd.asiento_cabecera_id = acc.asiento_cabecera_id
            JOIN 
                public.plancontable pc ON acd.cuenta_contable_id = pc.cuenta_contable_id
            WHERE 
                acc.empresa_id = $1
                AND acc.fecha_contabilizacion_asiento BETWEEN $2 AND $3
                AND acc.estado_asiento <> 'Anulado';
        `;

        const result = await client.query(query, [empresaId, fechaInicio, fechaFin]);

        const totalIngresos = parseFloat(result.rows[0].totalIngresos);
        const totalGastos = parseFloat(result.rows[0].totalGastos);
        const utilidadNeta = totalIngresos - totalGastos;

        // Devolvemos un objeto simple con los totales
        return {
            totalIngresos,
            totalGastos,
            utilidadNeta
        };

    } finally {
        client.release();
    }
};

export interface BalanceGeneralCuenta {
    codigo: string;
    descripcion: string;
    total: number;
}

export interface BalanceGeneral {
    activos: BalanceGeneralCuenta[];
    totalActivos: number;
    pasivos: BalanceGeneralCuenta[];
    totalPasivos: number;
    patrimonio: BalanceGeneralCuenta[];
    totalPatrimonio: number;
    verificacion: number; // Debe ser Pasivo + Patrimonio
}

// --- ¡NUEVA FUNCIÓN PARA GENERAR EL BALANCE GENERAL! ---
export const generarBalanceGeneral = async (empresaId: number, fechaCorte: string): Promise<BalanceGeneral> => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT 
                pc.codigo_cuenta,
                pc.nombre_cuenta_contable,
                pc.tipo_cuenta_general,
                -- Para cuentas de naturaleza DEUDORA (Activos), el saldo es DEBE - HABER
                -- Para cuentas de naturaleza ACREEDORA (Pasivo, Patrimonio), el saldo es HABER - DEBE
                COALESCE(SUM(
                    CASE 
                        WHEN pc.naturaleza_saldo_cuenta = 'Deudor' THEN acd.monto_debe - acd.monto_haber
                        ELSE acd.monto_haber - acd.monto_debe
                    END
                ), 0.00) as saldo_final
            FROM 
                public.plancontable pc
            LEFT JOIN 
                public.asientoscontablesdetalle acd ON pc.cuenta_contable_id = acd.cuenta_contable_id
            LEFT JOIN 
                public.asientoscontablescabecera acc ON acd.asiento_cabecera_id = acc.asiento_cabecera_id
                AND acc.empresa_id = $1
                AND acc.fecha_contabilizacion_asiento <= $2
                AND acc.estado_asiento <> 'Anulado'
            WHERE 
                pc.empresa_id = $1
                AND pc.tipo_cuenta_general IN ('Activo', 'Pasivo', 'Patrimonio')
            GROUP BY 
                pc.cuenta_contable_id, pc.codigo_cuenta, pc.nombre_cuenta_contable, pc.tipo_cuenta_general
            HAVING
                -- Solo mostramos cuentas con saldo diferente de cero
                COALESCE(SUM(
                    CASE 
                        WHEN pc.naturaleza_saldo_cuenta = 'Deudor' THEN acd.monto_debe - acd.monto_haber
                        ELSE acd.monto_haber - acd.monto_debe
                    END
                ), 0.00) <> 0.00
            ORDER BY 
                pc.codigo_cuenta;
        `;

        const result = await client.query(query, [empresaId, fechaCorte]);

        const reporte: BalanceGeneral = {
            activos: [], totalActivos: 0,
            pasivos: [], totalPasivos: 0,
            patrimonio: [], totalPatrimonio: 0,
            verificacion: 0,
        };

        result.rows.forEach(row => {
            const cuenta: BalanceGeneralCuenta = {
                codigo: row.codigo_cuenta,
                descripcion: row.nombre_cuenta_contable,
                total: parseFloat(row.saldo_final)
            };

            if (row.tipo_cuenta_general === 'Activo') {
                reporte.activos.push(cuenta);
                reporte.totalActivos += cuenta.total;
            } else if (row.tipo_cuenta_general === 'Pasivo') {
                reporte.pasivos.push(cuenta);
                reporte.totalPasivos += cuenta.total;
            } else if (row.tipo_cuenta_general === 'Patrimonio') {
                reporte.patrimonio.push(cuenta);
                reporte.totalPatrimonio += cuenta.total;
            }
        });

        reporte.verificacion = reporte.totalPasivos + reporte.totalPatrimonio;

        return reporte;

    } finally {
        client.release();
    }
};