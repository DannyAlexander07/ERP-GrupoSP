// Archivo: backend/src/services/proveedor.service.ts (ACTUALIZADO CON AUDITORÍA MEJORADA)
import pool from '../config/database';
import { logAuditoria } from './auditoria.service';

// Interfaz para la respuesta paginada
export interface PagedResult<T> {
    records: T[];
    total_records: number;
    total_pages: number;
    current_page: number;
}

// Interfaz completa de Proveedor
export interface Proveedor {
    proveedor_id?: number;
    codigo_proveedor_interno?: string;
    razon_social_o_nombres: string;
    nombre_comercial?: string;
    tipo_documento_identidad: string;
    numero_documento_identidad: string;
    direccion_fiscal_completa?: string;
    email_principal_pagos?: string;
    telefono_principal?: string;
    estado_proveedor?: string;
    empresa_id_principal_compradora: number;
    condicion_pago_id_predeterminada?: number;
    moneda_id_predeterminada?: number;
    contacto_principal_nombre?: string;
    banco_predeterminado_proveedor?: string;
    numero_cuenta_proveedor?: string;
    codigo_cuenta_interbancaria_proveedor?: string; 
    tipo_servicio_principal_proveedor?: string;
    observaciones_generales?: string;
    es_agente_retencion_igv?: boolean;
    requiere_pago_detraccion?: boolean;
    usuario_creacion_id?: number;
    fecha_creacion?: string;
    usuario_modificacion_id?: number;
    fecha_modificacion?: string;
}

// Generar el siguiente código de proveedor secuencial
export const getNextProveedorCode = async (empresaId: number): Promise<string> => {
    const prefix = 'PV';
    const query = `
        SELECT codigo_proveedor_interno FROM proveedores 
        WHERE empresa_id_principal_compradora = $1 AND codigo_proveedor_interno LIKE $2
        ORDER BY codigo_proveedor_interno DESC LIMIT 1
    `;
    const result = await pool.query(query, [empresaId, `${prefix}-%`]);

    if (result.rows.length > 0) {
        const lastCode = result.rows[0].codigo_proveedor_interno;
        const lastNumberStr = lastCode.split('-')[1];
        if (lastNumberStr && !isNaN(parseInt(lastNumberStr, 10))) {
            const lastNumber = parseInt(lastNumberStr, 10);
            const nextNumber = lastNumber + 1;
            return `${prefix}-${nextNumber.toString().padStart(3, '0')}`;
        }
    }
    return `${prefix}-001`;
};

// Obtener proveedores con filtros y paginación
export const getAllProveedores = async (empresaId: number, page: number, limit: number, filters: any): Promise<PagedResult<any>> => {
    const allowedFilterKeys = ['codigo_proveedor_interno', 'razon_social_o_nombres', 'numero_documento_identidad'];
    let query = `
        SELECT 
            p.proveedor_id, p.codigo_proveedor_interno, p.razon_social_o_nombres, 
            p.numero_documento_identidad, p.telefono_principal, p.estado_proveedor,
            u.nombres_completos_persona as creado_por
        FROM proveedores p
        LEFT JOIN usuarios u ON p.usuario_creacion_id = u.usuario_id
        WHERE p.empresa_id_principal_compradora = $1
    `;
    const countQueryBase = `SELECT COUNT(*) FROM proveedores p WHERE p.empresa_id_principal_compradora = $1`;

    const queryParams: any[] = [empresaId];
    let whereClause = '';
    let paramIndex = 2;

    Object.keys(filters).forEach(key => {
        if (allowedFilterKeys.includes(key) && filters[key]) {
            whereClause += ` AND p.${key}::text ILIKE $${paramIndex}`; 
            queryParams.push(`%${filters[key]}%`);
            paramIndex++;
        }
    });

    const finalQuery = query + whereClause + ' ORDER BY p.proveedor_id DESC';
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

// Obtener todos los proveedores para exportar
export const getAllProveedoresForExport = async (empresaId: number, filters: any): Promise<any[]> => {
    const allowedFilterKeys = ['codigo_proveedor_interno', 'razon_social_o_nombres', 'numero_documento_identidad'];
   let query = `
        SELECT 
            p.codigo_proveedor_interno as "Código Interno", 
            p.razon_social_o_nombres as "Razón Social",
            p.nombre_comercial as "Nombre Comercial",
            p.tipo_documento_identidad as "Tipo Documento",
            p.numero_documento_identidad as "Nro. Documento",
            p.direccion_fiscal_completa as "Dirección Fiscal",
            p.telefono_principal as "Teléfono",
            p.email_principal_pagos as "Email Pagos",
            p.contacto_principal_nombre as "Nombre Contacto Principal",
            cp.descripcion_condicion as "Condición de Pago",
            m.nombre_moneda as "Moneda Predeterminada",
            p.banco_predeterminado_proveedor as "Banco Predeterminado",
            p.numero_cuenta_proveedor as "Nro. Cuenta",
            p.codigo_cuenta_interbancaria_proveedor as "CCI",
            p.tipo_servicio_principal_proveedor as "Tipo de Servicio Principal",
            p.observaciones_generales as "Observaciones",
            p.es_agente_retencion_igv as "Es Agente Retención IGV",
            p.requiere_pago_detraccion as "Sujeto a Detracción",
            p.estado_proveedor as "Estado",
            uc.nombres_completos_persona as "Creado Por",
            TO_CHAR(p.fecha_creacion, 'DD/MM/YYYY HH24:MI:SS') as "Fecha Creación",
            um.nombres_completos_persona as "Modificado Por",
            TO_CHAR(p.fecha_modificacion, 'DD/MM/YYYY HH24:MI:SS') as "Fecha Modificación"
        FROM proveedores p
        LEFT JOIN usuarios uc ON p.usuario_creacion_id = uc.usuario_id
        LEFT JOIN usuarios um ON p.usuario_modificacion_id = um.usuario_id
        LEFT JOIN condicionespago cp ON p.condicion_pago_id_predeterminada = cp.condicion_pago_id
        LEFT JOIN monedas m ON p.moneda_id_predeterminada = m.moneda_id
        WHERE p.empresa_id_principal_compradora = $1
    `;
    
    const queryParams: any[] = [empresaId];
    let whereClause = '';
    let paramIndex = 2;

    Object.keys(filters).forEach(key => {
        if (allowedFilterKeys.includes(key) && filters[key]) {
            whereClause += ` AND p.${key}::text ILIKE $${paramIndex}`; 
            queryParams.push(`%${filters[key]}%`);
            paramIndex++;
        }
    });

    const finalQuery = query + whereClause + ' ORDER BY p.proveedor_id DESC';
    const result = await pool.query(finalQuery, queryParams);
    return result.rows;
};


// Obtener un proveedor por ID con datos de auditoría
export const getProveedorById = async (proveedorId: number, empresaId: number) => {
    const query = `
        SELECT 
            p.*,
            uc.nombres_completos_persona as creado_por,
            um.nombres_completos_persona as modificado_por
        FROM proveedores p
        LEFT JOIN usuarios uc ON p.usuario_creacion_id = uc.usuario_id
        LEFT JOIN usuarios um ON p.usuario_modificacion_id = um.usuario_id
        WHERE p.proveedor_id = $1 AND p.empresa_id_principal_compradora = $2
    `;
    const result = await pool.query(query, [proveedorId, empresaId]);
    return result.rows[0] || null;
};

// Crear un nuevo proveedor con todos los campos (ACTUALIZADO CON AUDITORÍA)
export const createProveedor = async (proveedor: Proveedor, usuarioId: number, nombreUsuario: string) => {
    const { 
        razon_social_o_nombres, tipo_documento_identidad, numero_documento_identidad, empresa_id_principal_compradora,
        codigo_proveedor_interno, nombre_comercial, direccion_fiscal_completa, email_principal_pagos,
        telefono_principal, condicion_pago_id_predeterminada, moneda_id_predeterminada, 
        contacto_principal_nombre, banco_predeterminado_proveedor, numero_cuenta_proveedor, 
        codigo_cuenta_interbancaria_proveedor,
        tipo_servicio_principal_proveedor, observaciones_generales, 
        es_agente_retencion_igv, requiere_pago_detraccion
    } = proveedor;
    
    try { // <-- Bloque try añadido
        const result = await pool.query(
            `INSERT INTO proveedores (
                razon_social_o_nombres, tipo_documento_identidad, numero_documento_identidad, empresa_id_principal_compradora, estado_proveedor,
                codigo_proveedor_interno, nombre_comercial, direccion_fiscal_completa, email_principal_pagos,
                telefono_principal, condicion_pago_id_predeterminada, moneda_id_predeterminada, 
                contacto_principal_nombre, banco_predeterminado_proveedor, numero_cuenta_proveedor, 
                codigo_cuenta_interbancaria_proveedor,
                tipo_servicio_principal_proveedor, observaciones_generales, 
                es_agente_retencion_igv, requiere_pago_detraccion,
                usuario_creacion_id, fecha_creacion
               ) 
               VALUES ($1, $2, $3, $4, 'Activo', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW()) RETURNING *`,
            [
                razon_social_o_nombres, tipo_documento_identidad, numero_documento_identidad, empresa_id_principal_compradora,
                codigo_proveedor_interno || null, 
                nombre_comercial || null, 
                direccion_fiscal_completa || null, 
                email_principal_pagos || null,
                telefono_principal || null, 
                condicion_pago_id_predeterminada || null, 
                moneda_id_predeterminada || null, 
                contacto_principal_nombre || null, 
                banco_predeterminado_proveedor || null, 
                numero_cuenta_proveedor || null, 
                codigo_cuenta_interbancaria_proveedor || null,
                tipo_servicio_principal_proveedor || null, 
                observaciones_generales || null, 
                es_agente_retencion_igv || false, 
                requiere_pago_detraccion || false,
                usuarioId
            ]
        );
        const nuevoProveedor = result.rows[0];

        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'CREACION',
            tabla_afectada: 'proveedores', 
            registro_afectado_id: nuevoProveedor.proveedor_id.toString(),
            valor_nuevo: JSON.stringify(nuevoProveedor),
            exito_operacion: true, // <-- Éxito
            modulo_sistema_origen: 'Proveedores'
        });

        return nuevoProveedor;
    } catch (error: any) { // <-- Bloque catch añadido
        console.error("Error al crear proveedor:", error);
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'CREACION',
            tabla_afectada: 'proveedores', 
            registro_afectado_id: proveedor.proveedor_id?.toString() || 'N/A',
            valor_nuevo: JSON.stringify(proveedor),
            exito_operacion: false, // <-- Fallo
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Proveedores'
        });
        throw error; // Re-lanzar el error
    }
};

// Actualizar un proveedor (ACTUALIZADO CON AUDITORÍA)
export const updateProveedor = async (proveedorId: number, proveedorData: Partial<Proveedor>, usuarioId: number, nombreUsuario: string) => {
    const valorAnterior = await getProveedorById(proveedorId, proveedorData.empresa_id_principal_compradora!);
    if (!valorAnterior) {
        // Si no se encuentra el proveedor, también se puede loguear un fallo
        await logAuditoria({
            usuario_id_accion: usuarioId,
            nombre_usuario_accion: nombreUsuario,
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'proveedores',
            registro_afectado_id: proveedorId.toString(),
            descripcion_detallada_evento: `Intento de actualización de proveedor no encontrado (ID: ${proveedorId}).`,
            exito_operacion: false,
            mensaje_error_si_fallo: 'Proveedor no encontrado para actualizar.',
            modulo_sistema_origen: 'Proveedores'
        });
        throw new Error('Proveedor no encontrado');
    }

    try { // <-- Bloque try añadido
        const dataToUpdate = { ...valorAnterior, ...proveedorData };

        const result = await pool.query(
            `UPDATE proveedores SET
                razon_social_o_nombres = $1, 
                nombre_comercial = $2, 
                tipo_documento_identidad = $3,
                numero_documento_identidad = $4, 
                direccion_fiscal_completa = $5, 
                email_principal_pagos = $6,
                telefono_principal = $7, 
                condicion_pago_id_predeterminada = $8, 
                moneda_id_predeterminada = $9,
                contacto_principal_nombre = $10, 
                banco_predeterminado_proveedor = $11, 
                numero_cuenta_proveedor = $12,
                codigo_cuenta_interbancaria_proveedor = $13,
                tipo_servicio_principal_proveedor = $14, 
                observaciones_generales = $15, 
                es_agente_retencion_igv = $16,
                requiere_pago_detraccion = $17, 
                estado_proveedor = $18, 
                usuario_modificacion_id = $19, 
                fecha_modificacion = NOW()
              WHERE proveedor_id = $20 RETURNING *`,
            [
                dataToUpdate.razon_social_o_nombres, 
                dataToUpdate.nombre_comercial, 
                dataToUpdate.tipo_documento_identidad,
                dataToUpdate.numero_documento_identidad, 
                dataToUpdate.direccion_fiscal_completa, 
                dataToUpdate.email_principal_pagos,
                dataToUpdate.telefono_principal, 
                dataToUpdate.condicion_pago_id_predeterminada, 
                dataToUpdate.moneda_id_predeterminada,
                dataToUpdate.contacto_principal_nombre, 
                dataToUpdate.banco_predeterminado_proveedor, 
                dataToUpdate.numero_cuenta_proveedor,
                dataToUpdate.codigo_cuenta_interbancaria_proveedor,
                dataToUpdate.tipo_servicio_principal_proveedor, 
                dataToUpdate.observaciones_generales, 
                dataToUpdate.es_agente_retencion_igv,
                dataToUpdate.requiere_pago_detraccion, 
                dataToUpdate.estado_proveedor,
                usuarioId, 
                proveedorId
            ]
        );
        const proveedorActualizado = result.rows[0];

        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'proveedores', 
            registro_afectado_id: proveedorId.toString(),
            valor_anterior: JSON.stringify(valorAnterior), 
            valor_nuevo: JSON.stringify(proveedorActualizado),
            exito_operacion: true, // <-- Éxito
            modulo_sistema_origen: 'Proveedores'
        });

        return proveedorActualizado;
    } catch (error: any) { // <-- Bloque catch añadido
        console.error("Error al actualizar proveedor:", error);
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'proveedores', 
            registro_afectado_id: proveedorId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify(proveedorData),
            exito_operacion: false, // <-- Fallo
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Proveedores'
        });
        throw error; // Re-lanzar el error
    }
};

// Eliminar un proveedor (ACTUALIZADO CON AUDITORÍA)
export const deleteProveedor = async (proveedorId: number, empresaId: number, usuarioId: number, nombreUsuario: string) => {
    const valorAnterior = await getProveedorById(proveedorId, empresaId);
    if (!valorAnterior) {
        // Si no se encuentra el proveedor, también se puede loguear un fallo
        await logAuditoria({
            usuario_id_accion: usuarioId,
            nombre_usuario_accion: nombreUsuario,
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'proveedores',
            registro_afectado_id: proveedorId.toString(),
            descripcion_detallada_evento: `Intento de eliminación lógica de proveedor no encontrado (ID: ${proveedorId}).`,
            exito_operacion: false,
            mensaje_error_si_fallo: 'Proveedor no encontrado para desactivar.',
            modulo_sistema_origen: 'Proveedores'
        });
        throw new Error('Proveedor no encontrado');
    }

    try { // <-- Bloque try añadido
        const result = await pool.query(
            `UPDATE proveedores SET 
                estado_proveedor = 'Inactivo',
                usuario_modificacion_id = $1,
                fecha_modificacion = NOW()
              WHERE proveedor_id = $2 AND empresa_id_principal_compradora = $3`,
            [usuarioId, proveedorId, empresaId]
        );

        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'proveedores', 
            registro_afectado_id: proveedorId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify({ ...valorAnterior, estado_proveedor: 'Inactivo' }),
            exito_operacion: true, // <-- Éxito
            modulo_sistema_origen: 'Proveedores'
        });

        return (result.rowCount ?? 0) > 0;
    } catch (error: any) { // <-- Bloque catch añadido
        console.error("Error al desactivar proveedor:", error);
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'proveedores', 
            registro_afectado_id: proveedorId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify({ ...valorAnterior, estado_proveedor: 'ERROR_NO_ACTUALIZADO' }),
            exito_operacion: false, // <-- Fallo
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Proveedores'
        });
        throw error; // Re-lanzar el error
    }
};