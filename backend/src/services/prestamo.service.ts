// Archivo: backend/src/services/prestamo.service.ts (NUEVO SERVICIO - COMPLETO CON GENERACIÓN DE CUOTAS)
import pool from '../config/database';
import { logAuditoria } from './auditoria.service';

// ¡NUEVAS IMPORTACIONES! (Axios y sus tipos para el interceptor)
import axios, { AxiosRequestConfig, AxiosError } from 'axios'; 
import type { AxiosRequestHeaders } from 'axios'; 

// Importar tipos si fueran necesarios de otros servicios (ej. Empresa, Moneda, Usuario)
import type { Empresa } from './empresa.service';
import type { Moneda } from './moneda.service';
import type { Usuario } from './usuario.service'; // Para auditoría y responsable

// Interfaz para la respuesta paginada (reutilizable)
export interface PagedResult<T> {
    records: T[];
    total_records: number;
    total_pages: number;
    current_page: number;
}

// Interfaz para la Cuota de Préstamo
export interface CuotaPrestamo {
    cuota_prestamo_id?: number;
    prestamo_id?: number; // Se asigna al crear
    numero_cuota: number;
    fecha_vencimiento_cuota: string;
    monto_capital_cuota: number;
    monto_interes_cuota: number;
    monto_seguro_desgravamen_cuota?: number;
    monto_otros_cargos_cuota?: number;
    monto_total_cuota_proyectado: number;
    estado_cuota?: string; // Pendiente, Pagada, Vencida
    fecha_efectiva_pago_cuota?: string;
    monto_efectivamente_pagado_cuota?: number;
    obligacion_id_generada?: number;
    // Campos de auditoría
    usuario_creacion_id?: number;
    fecha_creacion?: string;
    usuario_modificacion_id?: number;
    fecha_modificacion?: string;
}

// Interfaz completa de Préstamo
export interface Prestamo {
    prestamo_id?: number;
    empresa_id_titular: number;
    tipo_prestamo: string; // Recibido, Otorgado
    codigo_contrato_prestamo?: string;
    descripcion_prestamo?: string;
    entidad_financiera_o_contraparte?: string;
    moneda_id_prestamo: number;
    monto_principal_original: number;
    tasa_interes_anual_pactada: number; // Por ejemplo, 0.05 para 5%
    tipo_tasa_interes?: string; // TEA, TNA
    fecha_desembolso_o_inicio: string;
    fecha_primera_cuota?: string;
    fecha_ultima_cuota_proyectada?: string; // Calculado
    numero_total_cuotas_pactadas: number;
    periodicidad_cuotas: string; // Mensual, Trimestral
    estado_prestamo?: string; // Vigente, Cancelado, etc.
    dia_pago_mes?: number;
    // Campos de auditoría
    usuario_creacion_id?: number;
    fecha_creacion?: string;
    usuario_modificacion_id?: number;
    fecha_modificacion?: string;

    // Relacionados (para GET y mostrar en frontend)
    empresa_nombre?: string;
    moneda_nombre?: string;
    usuario_creador_nombre?: string; // Nombre de usuario para creado_por
    usuario_modificador_nombre?: string; // Nombre de usuario para modificado_por
    cuotas?: CuotaPrestamo[]; // Para cuando se obtiene un préstamo con sus cuotas
}

// Interfaz para filtros
export interface PrestamoFilters {
    [key: string]: string | number | boolean | undefined;
    tipo_prestamo?: string;
    estado_prestamo?: string;
    codigo_contrato_prestamo?: string;
    entidad_financiera_o_contraparte?: string;
}

const API_URL = 'http://localhost:4000/api/prestamos';

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

// Obtener todos los préstamos con filtros y paginación
export const getAllPrestamos = async (empresaId: number, page: number, limit: number, filters: PrestamoFilters): Promise<PagedResult<any>> => {
    const allowedFilterKeys = ['tipo_prestamo', 'estado_prestamo', 'codigo_contrato_prestamo', 'entidad_financiera_o_contraparte'];
    let query = `
        SELECT 
            p.prestamo_id, 
            p.empresa_id_titular,
            p.codigo_contrato_prestamo, 
            p.descripcion_prestamo,
            p.entidad_financiera_o_contraparte, -- <-- ¡CORRECCIÓN AÑADIDA AQUÍ!
            p.monto_principal_original, 
            p.tasa_interes_anual_pactada, 
            p.numero_total_cuotas_pactadas,
            p.fecha_desembolso_o_inicio, 
            p.estado_prestamo, 
            p.tipo_prestamo,
            m.nombre_moneda as moneda_nombre,
            e.nombre_empresa as empresa_nombre,
            u_creacion.nombres_completos_persona as creado_por,
            p.fecha_creacion,
            u_modificacion.nombres_completos_persona as modificado_por,
            p.fecha_modificacion
        FROM Prestamos p
        JOIN Monedas m ON p.moneda_id_prestamo = m.moneda_id
        JOIN Empresas e ON p.empresa_id_titular = e.empresa_id
        LEFT JOIN Usuarios u_creacion ON p.usuario_creacion_id = u_creacion.usuario_id
        LEFT JOIN Usuarios u_modificacion ON p.usuario_modificacion_id = u_modificacion.usuario_id
        WHERE p.empresa_id_titular = $1
    `;
    const countQueryBase = `SELECT COUNT(*) FROM Prestamos p WHERE p.empresa_id_titular = $1`;

    const queryParams: any[] = [empresaId];
    let whereClause = '';
    let paramIndex = 2;

    Object.keys(filters).forEach(_key => {
        const key = _key as keyof PrestamoFilters; 
        const value = filters[key];
        if (value !== undefined && value !== null) {
            whereClause += ` AND p.${key}::text ILIKE $${paramIndex}`; 
            queryParams.push(`%${value}%`);
            paramIndex++;
        }
    });

    const finalQuery = query + whereClause + ' ORDER BY p.fecha_desembolso_o_inicio DESC, p.prestamo_id DESC';
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

// Obtener un préstamo por su ID con sus cuotas
export const getPrestamoById = async (prestamoId: number, empresaId: number): Promise<Prestamo | null> => {
    const queryPrestamo = `
        SELECT 
            p.*,
            m.nombre_moneda as moneda_nombre,
            e.nombre_empresa as empresa_nombre,
            u_creacion.nombres_completos_persona as creado_por,
            u_modificacion.nombres_completos_persona as modificado_por
        FROM Prestamos p
        JOIN Monedas m ON p.moneda_id_prestamo = m.moneda_id
        JOIN Empresas e ON p.empresa_id_titular = e.empresa_id
        LEFT JOIN Usuarios u_creacion ON p.usuario_creacion_id = u_creacion.usuario_id
        LEFT JOIN Usuarios u_modificacion ON p.usuario_modificacion_id = u_modificacion.usuario_id
        WHERE p.prestamo_id = $1 AND p.empresa_id_titular = $2
    `;

    const queryCuotas = `
        SELECT 
            cp.*,
            u_creacion.nombres_completos_persona as creado_por_cuota,
            u_modificacion.nombres_completos_persona as modificado_por_cuota
        FROM CuotasPrestamo cp
        LEFT JOIN Usuarios u_creacion ON cp.usuario_creacion_id = u_creacion.usuario_id
        LEFT JOIN Usuarios u_modificacion ON cp.usuario_modificacion_id = u_modificacion.usuario_id
        WHERE cp.prestamo_id = $1
        ORDER BY cp.numero_cuota ASC
    `;

    const prestamoResult = await pool.query(queryPrestamo, [prestamoId, empresaId]);
    if (prestamoResult.rows.length === 0) {
        return null;
    }

    const cuotasResult = await pool.query(queryCuotas, [prestamoId]);
    const prestamo = {
        ...prestamoResult.rows[0],
        cuotas: cuotasResult.rows
    };

    return prestamo;
};

// Generar el plan de pagos (Amortización Francesa - Cuota Fija)
// NOTA: Esta es una implementación simplificada y asume periodicidad mensual.
// Para un ERP real, se necesitaría una librería financiera robusta y manejo de días/meses exactos.
const generateAmortizationSchedule = (
    principal: number, 
    annualInterestRate: number, 
    numPayments: number, 
    startDate: string,
    periodicidad: string // Usado para validar, pero el cálculo es mensual
): CuotaPrestamo[] => {
    if (periodicidad !== 'Mensual') {
        throw new Error('Solo se soporta periodicidad Mensual para el cálculo de cuotas en este momento.');
    }
    if (annualInterestRate < 0 || numPayments <= 0 || principal <= 0) {
        throw new Error('Parámetros de préstamo inválidos para generar el cronograma.');
    }

    const monthlyInterestRate = annualInterestRate / 12; // Tasa mensual
    const payments: CuotaPrestamo[] = [];
    let remainingPrincipal = principal;
    let currentDate = new Date(startDate);

    // Calcular la cuota mensual fija
    let monthlyPayment: number;
    if (monthlyInterestRate === 0) { // Si la tasa es 0, es solo principal dividido por cuotas
        monthlyPayment = principal / numPayments;
    } else {
        monthlyPayment = principal * (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, numPayments)) /
            (Math.pow(1 + monthlyInterestRate, numPayments) - 1);
    }
    
    for (let i = 1; i <= numPayments; i++) {
        const interestPayment = remainingPrincipal * monthlyInterestRate;
        const capitalPayment = monthlyPayment - interestPayment;
        
        remainingPrincipal -= capitalPayment;
        if (remainingPrincipal < 0.01 && remainingPrincipal > -0.01) { // Ajuste para el último pago
            remainingPrincipal = 0;
        }

        // Determinar la fecha de vencimiento de la cuota
        // Asumimos que la primera cuota vence un mes después de la fecha de desembolso
        // y que las siguientes cuotas son mensuales a partir de ahí.
        const cuotaDate = new Date(currentDate);
        cuotaDate.setMonth(currentDate.getMonth() + i); // Añadir i meses desde la fecha de inicio

        payments.push({
            numero_cuota: i,
            fecha_vencimiento_cuota: cuotaDate.toISOString().split('T')[0],
            monto_capital_cuota: parseFloat(capitalPayment.toFixed(2)),
            monto_interes_cuota: parseFloat(interestPayment.toFixed(2)),
            monto_seguro_desgravamen_cuota: 0, // Simplificado, se dejaría en 0
            monto_otros_cargos_cuota: 0, // Simplificado, se dejaría en 0
            monto_total_cuota_proyectado: parseFloat(monthlyPayment.toFixed(2)),
            estado_cuota: 'Pendiente'
        });
    }

    return payments;
};


// Crear un nuevo préstamo con sus cuotas (como una transacción)
export const createPrestamo = async (prestamo: Prestamo, usuarioId: number, nombreUsuario: string): Promise<Prestamo> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const {
            empresa_id_titular, tipo_prestamo, codigo_contrato_prestamo, descripcion_prestamo,
            entidad_financiera_o_contraparte, moneda_id_prestamo, monto_principal_original,
            tasa_interes_anual_pactada, tipo_tasa_interes, fecha_desembolso_o_inicio,
            numero_total_cuotas_pactadas, periodicidad_cuotas, dia_pago_mes
        } = prestamo;

        // Generar el plan de pagos
        const cuotasGeneradas = generateAmortizationSchedule(
            monto_principal_original, 
            tasa_interes_anual_pactada, 
            numero_total_cuotas_pactadas, 
            fecha_desembolso_o_inicio,
            periodicidad_cuotas
        );

        // Calcular fecha_primera_cuota y fecha_ultima_cuota_proyectada de las cuotas generadas
        const fechaPrimeraCuota = cuotasGeneradas[0]?.fecha_vencimiento_cuota || null;
        const fechaUltimaCuotaProyectada = cuotasGeneradas[cuotasGeneradas.length - 1]?.fecha_vencimiento_cuota || null;

        const insertPrestamoQuery = `
            INSERT INTO Prestamos (
                empresa_id_titular, tipo_prestamo, codigo_contrato_prestamo, descripcion_prestamo,
                entidad_financiera_o_contraparte, moneda_id_prestamo, monto_principal_original,
                tasa_interes_anual_pactada, tipo_tasa_interes, fecha_desembolso_o_inicio,
                fecha_primera_cuota, fecha_ultima_cuota_proyectada, numero_total_cuotas_pactadas,
                periodicidad_cuotas, estado_prestamo, dia_pago_mes,
                usuario_creacion_id, fecha_creacion
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'Vigente', $15, $16, NOW())
            RETURNING prestamo_id;
        `;

        const prestamoResult = await client.query(insertPrestamoQuery, [
            empresa_id_titular, tipo_prestamo, codigo_contrato_prestamo || null, descripcion_prestamo || null,
            entidad_financiera_o_contraparte || null, moneda_id_prestamo, monto_principal_original,
            tasa_interes_anual_pactada, tipo_tasa_interes || null, fecha_desembolso_o_inicio,
            fechaPrimeraCuota, fechaUltimaCuotaProyectada, numero_total_cuotas_pactadas,
            periodicidad_cuotas, dia_pago_mes || null,
            usuarioId
        ]);

        const nuevoPrestamoId = prestamoResult.rows[0].prestamo_id;

        // Insertar cuotas generadas
        for (const cuota of cuotasGeneradas) {
            const insertCuotaQuery = `
                INSERT INTO CuotasPrestamo (
                    prestamo_id, numero_cuota, fecha_vencimiento_cuota, monto_capital_cuota,
                    monto_interes_cuota, monto_seguro_desgravamen_cuota, monto_otros_cargos_cuota,
                    monto_total_cuota_proyectado, estado_cuota,
                    usuario_creacion_id, fecha_creacion
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Pendiente', $9, NOW());
            `;
            await client.query(insertCuotaQuery, [
                nuevoPrestamoId, cuota.numero_cuota, cuota.fecha_vencimiento_cuota, cuota.monto_capital_cuota,
                cuota.monto_interes_cuota, cuota.monto_seguro_desgravamen_cuota || 0, cuota.monto_otros_cargos_cuota || 0,
                cuota.monto_total_cuota_proyectado,
                usuarioId
            ]);
        }

        await client.query('COMMIT');

        // Recuperar el préstamo completo con cuotas para auditoría y respuesta
        const prestamoCreadoCompleto = await getPrestamoById(nuevoPrestamoId, empresa_id_titular);
        if (!prestamoCreadoCompleto) throw new Error("Préstamo recién creado no encontrado.");
        
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'CREACION',
            tabla_afectada: 'Prestamos', 
            registro_afectado_id: nuevoPrestamoId.toString(),
            valor_nuevo: JSON.stringify(prestamoCreadoCompleto),
            exito_operacion: true,
            modulo_sistema_origen: 'Préstamos'
        });

        return prestamoCreadoCompleto;

    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error("Error al crear préstamo:", error);
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'CREACION',
            tabla_afectada: 'Prestamos', 
            registro_afectado_id: prestamo.prestamo_id?.toString() || 'N/A', 
            valor_nuevo: JSON.stringify(prestamo),
            exito_operacion: false,
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Préstamos'
        });
        throw error;
    } finally {
        client.release();
    }
};

// Actualizar un préstamo
// Archivo: backend/src/services/prestamo.service.ts (ACTUALIZADO para corregir error en updatePrestamo)

// ... (resto del código hasta updatePrestamo) ...

// Actualizar un préstamo
export const updatePrestamo = async (prestamoId: number, prestamoData: Partial<Prestamo>, usuarioId: number, nombreUsuario: string): Promise<Prestamo | null> => {
    const client = await pool.connect();

    // Paso 1: Determinar la empresa_id_titular actual del préstamo.
    // Esto es necesario para poder buscar el 'valorAnterior' correctamente,
    // ya que getPrestamoById requiere la empresa_id.
    // Primero, intenta usar la que viene en prestamoData.
    // Si no viene en prestamoData, la consultamos directamente de la tabla Prestamos
    // para obtener la empresa_id_titular actual del préstamo existente.
    let empresaIdParaConsulta: number;

    if (prestamoData.empresa_id_titular !== undefined && prestamoData.empresa_id_titular !== null) {
        empresaIdParaConsulta = prestamoData.empresa_id_titular;
    } else {
        const res = await pool.query('SELECT empresa_id_titular FROM Prestamos WHERE prestamo_id = $1', [prestamoId]);
        if (res.rows.length === 0 || res.rows[0].empresa_id_titular === undefined || res.rows[0].empresa_id_titular === null) {
            throw new Error("No se pudo determinar la empresa titular del préstamo existente para la actualización.");
        }
        empresaIdParaConsulta = res.rows[0].empresa_id_titular;
    }

    // Ahora sí, obtenemos el valorAnterior
    const valorAnterior = await getPrestamoById(prestamoId, empresaIdParaConsulta);

    if (!valorAnterior) {
        await logAuditoria({
            usuario_id_accion: usuarioId,
            nombre_usuario_accion: nombreUsuario,
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'Prestamos',
            registro_afectado_id: prestamoId.toString(),
            descripcion_detallada_evento: `Intento de actualización de préstamo no encontrado (ID: ${prestamoId}).`,
            exito_operacion: false,
            mensaje_error_si_fallo: 'Préstamo no encontrado para actualizar.',
            modulo_sistema_origen: 'Préstamos'
        });
        throw new Error('Préstamo no encontrado.');
    }

    try {
        await client.query('BEGIN');

        const {
            tipo_prestamo, codigo_contrato_prestamo, descripcion_prestamo,
            entidad_financiera_o_contraparte, moneda_id_prestamo, monto_principal_original,
            tasa_interes_anual_pactada, tipo_tasa_interes, fecha_desembolso_o_inicio,
            fecha_primera_cuota, fecha_ultima_cuota_proyectada, numero_total_cuotas_pactadas,
            periodicidad_cuotas, estado_prestamo, dia_pago_mes
        } = prestamoData;

        const fieldsToUpdate: string[] = [];
        const queryParams: any[] = [];
        let paramIndex = 1;

        const addField = (field: string, value: any) => {
            fieldsToUpdate.push(`${field} = $${paramIndex}`);
            queryParams.push(value);
            paramIndex++;
        };

        if (tipo_prestamo !== undefined) addField('tipo_prestamo', tipo_prestamo);
        if (codigo_contrato_prestamo !== undefined) addField('codigo_contrato_prestamo', codigo_contrato_prestamo);
        if (descripcion_prestamo !== undefined) addField('descripcion_prestamo', descripcion_prestamo);
        if (entidad_financiera_o_contraparte !== undefined) addField('entidad_financiera_o_contraparte', entidad_financiera_o_contraparte);
        if (moneda_id_prestamo !== undefined) addField('moneda_id_prestamo', moneda_id_prestamo);
        if (monto_principal_original !== undefined) addField('monto_principal_original', monto_principal_original);
        if (tasa_interes_anual_pactada !== undefined) addField('tasa_interes_anual_pactada', tasa_interes_anual_pactada);
        if (tipo_tasa_interes !== undefined) addField('tipo_tasa_interes', tipo_tasa_interes);
        if (fecha_desembolso_o_inicio !== undefined) addField('fecha_desembolso_o_inicio', fecha_desembolso_o_inicio);
        if (fecha_primera_cuota !== undefined) addField('fecha_primera_cuota', fecha_primera_cuota);
        if (fecha_ultima_cuota_proyectada !== undefined) addField('fecha_ultima_cuota_proyectada', fecha_ultima_cuota_proyectada);
        if (numero_total_cuotas_pactadas !== undefined) addField('numero_total_cuotas_pactadas', numero_total_cuotas_pactadas);
        if (periodicidad_cuotas !== undefined) addField('periodicidad_cuotas', periodicidad_cuotas);
        if (estado_prestamo !== undefined) addField('estado_prestamo', estado_prestamo);
        if (dia_pago_mes !== undefined) addField('dia_pago_mes', dia_pago_mes);
        
        // Campos de auditoría de modificación
        addField('usuario_modificacion_id', usuarioId);
        addField('fecha_modificacion', 'NOW()'); // Usar NOW() directamente en SQL

        const updateQuery = `
            UPDATE Prestamos SET
                ${fieldsToUpdate.join(', ')}
            WHERE prestamo_id = $${paramIndex} AND empresa_id_titular = $${paramIndex + 1}
            RETURNING *;
        `;
        queryParams.push(prestamoId, empresaIdParaConsulta); // Usar empresaIdParaConsulta aquí
        
        const result = await client.query(updateQuery, queryParams);
        if (result.rows.length === 0) {
            throw new Error('Préstamo no encontrado para actualizar.');
        }

        await client.query('COMMIT');

        const prestamoActualizadoCompleto = await getPrestamoById(prestamoId, empresaIdParaConsulta); // Usar empresaIdParaConsulta
        
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'Prestamos', 
            registro_afectado_id: prestamoId.toString(),
            valor_anterior: JSON.stringify(valorAnterior), 
            valor_nuevo: JSON.stringify(prestamoActualizadoCompleto), 
            exito_operacion: true,
            modulo_sistema_origen: 'Préstamos'
        });

        return prestamoActualizadoCompleto;
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error("Error al actualizar préstamo:", error);
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'Prestamos', 
            registro_afectado_id: prestamoId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify(prestamoData),
            exito_operacion: false,
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Préstamos'
        });
        throw error;
    } finally {
        client.release();
    }
};

// ... (resto del código del servicio, sin cambios) ...

// Eliminar (desactivar) un préstamo
export const deletePrestamo = async (prestamoId: number, empresaId: number, usuarioId: number, nombreUsuario: string): Promise<boolean> => {
    const client = await pool.connect();
    const valorAnterior = await getPrestamoById(prestamoId, empresaId);
    if (!valorAnterior) {
        await logAuditoria({
            usuario_id_accion: usuarioId,
            nombre_usuario_accion: nombreUsuario,
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'Prestamos',
            registro_afectado_id: prestamoId.toString(),
            descripcion_detallada_evento: `Intento de desactivación de préstamo no encontrado (ID: ${prestamoId}).`,
            exito_operacion: false,
            mensaje_error_si_fallo: 'Préstamo no encontrado para desactivar.',
            modulo_sistema_origen: 'Préstamos'
        });
        throw new Error('Préstamo no encontrado.');
    }

    try {
        await client.query('BEGIN');

        // Lógica: desactiva el préstamo y sus cuotas asociadas.
        const resultPrestamo = await client.query(
            `UPDATE Prestamos SET 
                estado_prestamo = 'Cancelado', -- O 'Inactivo' o un estado lógico adecuado
                usuario_modificacion_id = $1, fecha_modificacion = NOW()
            WHERE prestamo_id = $2 AND empresa_id_titular = $3`,
            [usuarioId, prestamoId, empresaId]
        );

        // Desactivar o marcar como anuladas las cuotas asociadas también
        await client.query(
            `UPDATE CuotasPrestamo SET
                estado_cuota = 'Anulada', -- O 'Cancelada'
                usuario_modificacion_id = $1, fecha_modificacion = NOW()
            WHERE prestamo_id = $2`,
            [usuarioId, prestamoId]
        );

        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'Prestamos', 
            registro_afectado_id: prestamoId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify({ ...valorAnterior, estado_prestamo: 'Cancelado' }),
            exito_operacion: true,
            modulo_sistema_origen: 'Préstamos'
        });

        await client.query('COMMIT');
        return (resultPrestamo.rowCount ?? 0) > 0;
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error("Error al desactivar préstamo:", error);
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'Prestamos', 
            registro_afectado_id: prestamoId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify({ ...valorAnterior, estado_prestamo: 'ERROR_NO_DESACTIVADO' }),
            exito_operacion: false,
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Préstamos'
        });
        throw error;
    } finally {
        if (client) client.release();
    }
};

// Exportar préstamos a Excel
export const exportarPrestamos = async (empresaId: number, filters: PrestamoFilters): Promise<any[]> => { 
    const prestamosToExport = await getAllPrestamos(empresaId, 1, 9999, filters); 
    return prestamosToExport.records.map(prestamo => ({
        "ID Préstamo": prestamo.prestamo_id,
        "Tipo Préstamo": prestamo.tipo_prestamo,
        "Código Contrato": prestamo.codigo_contrato_prestamo,
        "Descripción": prestamo.descripcion_prestamo,
        "Entidad/Contraparte": prestamo.entidad_financiera_o_contraparte,
        "Moneda": prestamo.moneda_nombre,
        "Monto Principal": prestamo.monto_principal_original,
        "Tasa Anual (%)": prestamo.tasa_interes_anual_pactada * 100, // Mostrar como porcentaje
        "Tipo Tasa": prestamo.tipo_tasa_inter,
        "Fecha Desembolso": prestamo.fecha_desembolso_o_inicio,
        "Nro. Cuotas": prestamo.numero_total_cuotas_pactadas,
        "Periodicidad": prestamo.periodicidad_cuotas,
        "Estado": prestamo.estado_prestamo,
        "Creado Por": prestamo.creado_por || 'N/A',
        "Fecha Creación": prestamo.fecha_creacion ? new Date(prestamo.fecha_creacion).toLocaleString('es-PE') : 'N/A',
        "Modificado Por": prestamo.modificado_por || 'N/A',
        "Fecha Modificación": prestamo.fecha_modificacion ? new Date(prestamo.fecha_modificacion).toLocaleString('es-PE') : 'N/A',
    }));
};