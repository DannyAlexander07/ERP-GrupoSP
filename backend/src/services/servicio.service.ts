// Archivo: backend/src/services/servicio.service.ts (VERSIÓN FINAL Y CORREGIDA CON NOMBRE DE COLUMNA BD)
import pool from '../config/database';
import { logAuditoria } from './auditoria.service';

// Interfaz para la respuesta paginada
export interface PagedResult<T> {
    records: T[];
    total_records: number;
    total_pages: number;
    current_page: number;
}

// Interfaz completa de Servicio
export interface Servicio {
    servicio_id?: number;
    empresa_id_oferente: number;
    codigo_servicio_interno: string;
    nombre_servicio: string;
    descripcion_detallada_servicio?: string;
    tipo_servicio: string;
    unidad_medida: string;
    moneda_id_precio_base: number;
    precio_base_unitario: number;
    afecto_impuesto_principal?: boolean;
    porcentaje_impuesto_aplicable?: number;
    // ¡CAMBIO AQUÍ! Nombre de columna corregido a 'codigo' y tipo a 'string'
    cuenta_contable_ingreso_predeterminada_id?: number | null; 
    activo_para_venta?: boolean;
    usuario_creacion_id?: number;
    fecha_creacion?: string;
    usuario_modificacion_id?: number;
    fecha_modificacion?: string;
}

// Generar el siguiente código de servicio secuencial
export const getNextServicioCode = async (empresaId: number): Promise<string> => {
    const prefix = 'SV';
    const query = `
        SELECT codigo_servicio_interno FROM servicios 
        WHERE empresa_id_oferente = $1 AND codigo_servicio_interno LIKE $2
        ORDER BY codigo_servicio_interno DESC LIMIT 1
    `;
    const result = await pool.query(query, [empresaId, `${prefix}-%`]);

    if (result.rows.length > 0) {
        const lastCode = result.rows[0].codigo_servicio_interno;
        const lastNumberStr = lastCode.split('-')[1];
        if (lastNumberStr && !isNaN(parseInt(lastNumberStr, 10))) {
            const lastNumber = parseInt(lastNumberStr, 10);
            const nextNumber = lastNumber + 1;
            return `${prefix}-${nextNumber.toString().padStart(3, '0')}`;
        }
    }
    return `${prefix}-001`;
};

// Obtener servicios con filtros y paginación
export const getAllServicios = async (empresaId: number, page: number, limit: number, filters: any, isActive?: boolean): Promise<PagedResult<any>> => {
    // --- CONSULTA BASE (con todos los campos y JOINs correctos) ---
    let query = `
        SELECT 
            s.servicio_id,
            s.codigo_servicio_interno,
            s.nombre_servicio,
            s.descripcion_detallada_servicio,
            s.tipo_servicio,
            s.unidad_medida,
            s.precio_base_unitario,
            s.activo_para_venta,
            s.afecto_impuesto_principal,
            s.porcentaje_impuesto_aplicable,
            s.cuenta_contable_ingreso_predeterminada_id,
            m.nombre_moneda as moneda_nombre,
            pc.codigo_cuenta as cuenta_contable_codigo
        FROM public.servicios s
        LEFT JOIN public.monedas m ON s.moneda_id_precio_base = m.moneda_id
        LEFT JOIN public.plancontable pc ON s.cuenta_contable_ingreso_predeterminada_id = pc.cuenta_contable_id
        WHERE s.empresa_id_oferente = $1
    `;

    // --- CONSULTA PARA CONTEO (con los mismos JOINs para filtros) ---
    const countQueryBase = `
        SELECT COUNT(*) 
        FROM public.servicios s
        LEFT JOIN public.monedas m ON s.moneda_id_precio_base = m.moneda_id
        LEFT JOIN public.plancontable pc ON s.cuenta_contable_ingreso_predeterminada_id = pc.cuenta_contable_id
        WHERE s.empresa_id_oferente = $1
    `;
    
    const queryParams: any[] = [empresaId];
    let whereClause = '';
    let paramIndex = 2;

    // --- CONSTRUCCIÓN DINÁMICA DE FILTROS ---
    if (isActive !== undefined) {
        whereClause += ` AND s.activo_para_venta = $${paramIndex}`;
        queryParams.push(isActive);
        paramIndex++;
    }

    const allowedFilterKeys = ['codigo_servicio_interno', 'nombre_servicio', 'tipo_servicio'];
    Object.keys(filters).forEach(key => {
        if (allowedFilterKeys.includes(key) && filters[key]) {
            whereClause += ` AND s.${key}::text ILIKE $${paramIndex}`;
            queryParams.push(`%${filters[key]}%`);
            paramIndex++;
        }
    });

    // --- CORRECCIÓN DEFINITIVA DEL ERROR DE SINTAXIS ---
    // Usamos plantillas literales para garantizar el espacio entre la consulta base y los filtros.
    const finalCountQuery = `${countQueryBase}${whereClause}`;
    const finalQuery = `${query}${whereClause} ORDER BY s.codigo_servicio_interno ASC`;

    // --- EJECUCIÓN DE CONSULTAS ---
    const totalResult = await pool.query(finalCountQuery, queryParams);
    const total_records = parseInt(totalResult.rows[0].count, 10);
    const total_pages = Math.ceil(total_records / limit) || 1;

    const offset = (page - 1) * limit;
    
    // Añadimos la paginación a la consulta final
    const paginatedQuery = `${finalQuery} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    const finalParams = [...queryParams, limit, offset];

    const recordsResult = await pool.query(paginatedQuery, finalParams);

    return {
        records: recordsResult.rows,
        total_records,
        total_pages,
        current_page: page,
    };
};

// Obtener todos los servicios para exportar
export const getAllServiciosForExport = async (empresaId: number, filters: any): Promise<any[]> => {
    const allowedFilterKeys = ['codigo_servicio_interno', 'nombre_servicio', 'tipo_servicio'];
    let query = `
        SELECT 
            s.codigo_servicio_interno as "Código Interno", 
            s.nombre_servicio as "Nombre del Servicio",
            s.descripcion_detallada_servicio as "Descripción",
            s.tipo_servicio as "Tipo de Servicio",
            s.unidad_medida as "Unidad de Medida",
            m.nombre_moneda as "Moneda",
            s.precio_base_unitario as "Precio Base",
            s.afecto_impuesto_principal as "Afecto a Impuesto",
            s.porcentaje_impuesto_aplicable as "% Impuesto Aplicable",
            s.cuenta_contable_ingreso_predeterminada_codigo as "Cuenta Contable Ingreso",
            s.activo_para_venta as "Estado (Activo)",
            uc.nombres_completos_persona as "Creado Por",
            TO_CHAR(s.fecha_creacion, 'DD/MM/YYYY HH24:MI:SS') as "Fecha Creación"
        FROM servicios s
        LEFT JOIN usuarios uc ON s.usuario_creacion_id = uc.usuario_id
        LEFT JOIN monedas m ON s.moneda_id_precio_base = m.moneda_id
        WHERE s.empresa_id_oferente = $1
    `;
    
    const queryParams: any[] = [empresaId];
    let whereClause = '';
    let paramIndex = 2;

    Object.keys(filters).forEach(key => {
        if (allowedFilterKeys.includes(key) && filters[key]) {
            whereClause += ` AND s.${key}::text ILIKE $${paramIndex}`; 
            queryParams.push(`%${filters[key]}%`);
            paramIndex++;
        }
    });

    const finalQuery = query + whereClause + ' ORDER BY s.servicio_id DESC';
    const result = await pool.query(finalQuery, queryParams);
    return result.rows;
};

// Obtener un servicio por su ID con datos de auditoría
export const getServicioById = async (servicioId: number, empresaId: number) => {
    const query = `
        SELECT 
            s.*,
            uc.nombres_completos_persona as creado_por,
            um.nombres_completos_persona as modificado_por
        FROM servicios s
        LEFT JOIN usuarios uc ON s.usuario_creacion_id = uc.usuario_id
        LEFT JOIN usuarios um ON s.usuario_modificacion_id = um.usuario_id
        WHERE s.servicio_id = $1 AND s.empresa_id_oferente = $2
    `;
    const result = await pool.query(query, [servicioId, empresaId]);
    return result.rows[0] || null;
};

// --- FUNCIÓN DE CREAR CORREGIDA ---
export const createServicio = async (servicio: Servicio, usuarioId: number, nombreUsuario: string) => {
    const { 
        empresa_id_oferente, codigo_servicio_interno, nombre_servicio, tipo_servicio, 
        unidad_medida, moneda_id_precio_base, precio_base_unitario, descripcion_detallada_servicio,
        afecto_impuesto_principal, porcentaje_impuesto_aplicable, 
        cuenta_contable_ingreso_predeterminada_id 
    } = servicio;
    
    try { 
        const result = await pool.query(
            `INSERT INTO servicios (
                empresa_id_oferente, codigo_servicio_interno, nombre_servicio, tipo_servicio, unidad_medida, 
                moneda_id_precio_base, precio_base_unitario, descripcion_detallada_servicio, afecto_impuesto_principal, 
                porcentaje_impuesto_aplicable, cuenta_contable_ingreso_predeterminada_id, activo_para_venta,
                usuario_creacion_id, fecha_creacion
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE, $12, NOW()) RETURNING *`, // <-- PARÉNTESIS CORREGIDO
            [
                empresa_id_oferente, codigo_servicio_interno, nombre_servicio, tipo_servicio, unidad_medida, 
                moneda_id_precio_base, precio_base_unitario, descripcion_detallada_servicio || null, 
                afecto_impuesto_principal ?? true, porcentaje_impuesto_aplicable || null, 
                cuenta_contable_ingreso_predeterminada_id || null,
                usuarioId
            ]
        );
        const nuevoServicio = result.rows[0];

        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'CREACION',
            tabla_afectada: 'servicios', 
            registro_afectado_id: nuevoServicio.servicio_id.toString(),
            valor_nuevo: JSON.stringify(nuevoServicio),
            exito_operacion: true,
            modulo_sistema_origen: 'Servicios'
        });

        return nuevoServicio;
    } catch (error: any) {
        console.error("Error al crear servicio:", error);
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'CREACION',
            tabla_afectada: 'servicios', 
            registro_afectado_id: servicio.servicio_id?.toString() || 'N/A',
            valor_nuevo: JSON.stringify(servicio),
            exito_operacion: false,
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Servicios'
        });
        throw error;
    }
};

// Actualizar un servicio
export const updateServicio = async (servicioId: number, servicioData: Partial<Servicio>, usuarioId: number, nombreUsuario: string) => {
    // Primero, obtenemos el estado anterior del servicio para la auditoría
    const valorAnterior = await getServicioById(servicioId, servicioData.empresa_id_oferente!);
    if (!valorAnterior) {
        // Logueamos el intento fallido
        await logAuditoria({
            usuario_id_accion: usuarioId,
            nombre_usuario_accion: nombreUsuario,
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'servicios',
            registro_afectado_id: servicioId.toString(),
            descripcion_detallada_evento: `Intento de actualización de servicio no encontrado (ID: ${servicioId}).`,
            exito_operacion: false,
            mensaje_error_si_fallo: 'Servicio no encontrado para actualizar.',
            modulo_sistema_origen: 'Servicios'
        });
        throw new Error('Servicio no encontrado');
    }

    try {
        // Combinamos los datos anteriores con los nuevos para asegurar que no se pierda información
        const dataToUpdate = { ...valorAnterior, ...servicioData };

        const result = await pool.query(
            `UPDATE servicios SET
                codigo_servicio_interno = $1, 
                nombre_servicio = $2, 
                descripcion_detallada_servicio = $3,
                tipo_servicio = $4, 
                unidad_medida = $5, 
                moneda_id_precio_base = $6,
                precio_base_unitario = $7, 
                afecto_impuesto_principal = $8, 
                porcentaje_impuesto_aplicable = $9,
                cuenta_contable_ingreso_predeterminada_id = $10, 
                activo_para_venta = $11, 
                usuario_modificacion_id = $12, 
                fecha_modificacion = NOW()
            WHERE servicio_id = $13 AND empresa_id_oferente = $14 -- <-- Se añadió el filtro de empresa para seguridad
            RETURNING *`,
            [
                dataToUpdate.codigo_servicio_interno, 
                dataToUpdate.nombre_servicio, 
                dataToUpdate.descripcion_detallada_servicio,
                dataToUpdate.tipo_servicio, 
                dataToUpdate.unidad_medida, 
                dataToUpdate.moneda_id_precio_base,
                dataToUpdate.precio_base_unitario, 
                dataToUpdate.afecto_impuesto_principal, 
                dataToUpdate.porcentaje_impuesto_aplicable,
                dataToUpdate.cuenta_contable_ingreso_predeterminada_id,
                dataToUpdate.activo_para_venta,
                usuarioId,
                servicioId,
                dataToUpdate.empresa_id_oferente // <-- Se añadió el parámetro para el WHERE
            ]
        );
        const servicioActualizado = result.rows[0];

        // Logueamos la operación exitosa
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'servicios', 
            registro_afectado_id: servicioId.toString(),
            valor_anterior: JSON.stringify(valorAnterior), 
            valor_nuevo: JSON.stringify(servicioActualizado),
            exito_operacion: true,
            modulo_sistema_origen: 'Servicios'
        });

        return servicioActualizado;

    } catch (error: any) {
        console.error("Error al actualizar servicio:", error);
        // Logueamos el error en la auditoría
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'servicios', 
            registro_afectado_id: servicioId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify(servicioData),
            exito_operacion: false,
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Servicios'
        });
        throw error; // Re-lanzamos el error para que el controlador lo maneje
    }
};

// Eliminar (desactivar) un servicio
export const deleteServicio = async (servicioId: number, empresaId: number, usuarioId: number, nombreUsuario: string) => {
    const valorAnterior = await getServicioById(servicioId, empresaId);
    if (!valorAnterior) {
        // Si no se encuentra el servicio, también se puede loguear un fallo
        await logAuditoria({
            usuario_id_accion: usuarioId,
            nombre_usuario_accion: nombreUsuario,
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'servicios',
            registro_afectado_id: servicioId.toString(),
            descripcion_detallada_evento: `Intento de eliminación lógica de servicio no encontrado (ID: ${servicioId}).`,
            exito_operacion: false,
            mensaje_error_si_fallo: 'Servicio no encontrado para desactivar.',
            modulo_sistema_origen: 'Servicios'
        });
        throw new Error('Servicio no encontrado');
    }

    try { // <-- Bloque try añadido
        const result = await pool.query(
            `UPDATE servicios SET 
                activo_para_venta = FALSE,
                usuario_modificacion_id = $1,
                fecha_modificacion = NOW()
              WHERE servicio_id = $2 AND empresa_id_oferente = $3`,
            [usuarioId, servicioId, empresaId]
        );

        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'servicios', 
            registro_afectado_id: servicioId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify({ ...valorAnterior, activo_para_venta: false }),
            exito_operacion: true, // <-- Éxito
            modulo_sistema_origen: 'Servicios'
        });

        return (result.rowCount ?? 0) > 0;
    } catch (error: any) { // <-- Bloque catch añadido
        console.error("Error al desactivar servicio:", error);
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'servicios', 
            registro_afectado_id: servicioId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify({ ...valorAnterior, activo_para_venta: 'ERROR_NO_ACTUALIZADO' }), // Indicar que no se pudo cambiar
            exito_operacion: false, // <-- Fallo
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Servicios'
        });
        throw error; // Re-lanzar el error
    }
};