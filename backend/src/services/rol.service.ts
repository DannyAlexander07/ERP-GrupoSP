// Archivo: backend/src/services/rol.service.ts (VERSIÓN MEJORADA CON AUDITORÍA Y COMPLETA - CORREGIDA)
import pool from '../config/database';
import { logAuditoria } from './auditoria.service';

// Interfaz para la respuesta paginada (reutilizable)
export interface PagedResult<T> {
    records: T[];
    total_records: number;
    total_pages: number;
    current_page: number;
}

// Interfaz que representa la tabla Roles
export interface Role {
    rol_id?: number; // Opcional para creación
    nombre_rol: string;
    descripcion_detallada_rol?: string;
    activo?: boolean;
    es_rol_sistema?: boolean;
    // ¡CAMPOS DE AUDITORÍA AÑADIDOS AHORA EN LA INTERFAZ!
    usuario_creacion_id?: number;
    fecha_creacion?: string;
    usuario_modificacion_id?: number;
    fecha_modificacion?: string;
    // Campos adicionales para JOINs
    creado_por?: string;
    modificado_por?: string;
}

// ¡DEFINICIÓN DE ROLE FILTERS AÑADIDA AQUÍ!
export interface RoleFilters {
    [key: string]: string | boolean | undefined; // Permitir boolean para 'activo'
}

// Obtener todos los roles con filtros y paginación
export const getAllRoles = async (page: number, limit: number, filters: RoleFilters): Promise<PagedResult<any>> => {
    const allowedFilterKeys = ['nombre_rol', 'activo'];
    let query = `
        SELECT 
            r.rol_id, r.nombre_rol, r.descripcion_detallada_rol, r.activo, r.es_rol_sistema,
            u_creacion.nombres_completos_persona as creado_por,
            r.fecha_creacion,
            u_modificacion.nombres_completos_persona as modificado_por,
            r.fecha_modificacion
        FROM Roles r
        LEFT JOIN Usuarios u_creacion ON r.usuario_creacion_id = u_creacion.usuario_id
        LEFT JOIN Usuarios u_modificacion ON r.usuario_modificacion_id = u_modificacion.usuario_id
        WHERE 1 = 1
    `;
    let countQueryBase = `SELECT COUNT(*) FROM Roles r WHERE 1 = 1`;

    const queryParams: any[] = [];
    let paramIndex = 1;

    Object.keys(filters).forEach(key => {
        if (allowedFilterKeys.includes(key) && filters[key] !== undefined && filters[key] !== null) {
            if (key === 'activo') {
                query += ` AND r.${key} = $${paramIndex}`;
                countQueryBase += ` AND r.${key} = $${paramIndex}`;
                queryParams.push(filters[key]);
            } else {
                query += ` AND r.${key}::text ILIKE $${paramIndex}`; 
                countQueryBase += ` AND r.${key}::text ILIKE $${paramIndex}`; 
                queryParams.push(`%${filters[key]}%`);
            }
            paramIndex++;
        }
    });

    const finalQuery = query + ' ORDER BY r.nombre_rol ASC';
    const finalCountQuery = countQueryBase;
    
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

// Obtener un rol por su ID
export const getRoleById = async (rolId: number): Promise<Role | null> => {
    const query = `
        SELECT 
            r.*,
            u_creacion.nombres_completos_persona as creado_por,
            u_modificacion.nombres_completos_persona as modificado_por
        FROM Roles r
        LEFT JOIN Usuarios u_creacion ON r.usuario_creacion_id = u_creacion.usuario_id
        LEFT JOIN Usuarios u_modificacion ON r.usuario_modificacion_id = u_modificacion.usuario_id
        WHERE r.rol_id = $1
    `;
    const result = await pool.query(query, [rolId]);
    return result.rows[0] || null;
};

// Crear un nuevo rol
export const createRole = async (role: Role, usuarioId: number, nombreUsuario: string): Promise<Role> => {
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const { 
            nombre_rol, descripcion_detallada_rol, activo, es_rol_sistema
        } = role;
        
        const result = await client.query(
            `INSERT INTO Roles (
                nombre_rol, descripcion_detallada_rol, activo, es_rol_sistema,
                usuario_creacion_id, fecha_creacion
            ) VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING *`,
            [
                nombre_rol, descripcion_detallada_rol || null, activo ?? true, es_rol_sistema ?? false,
                usuarioId
            ]
        );
        const nuevoRol = result.rows[0];

        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'CREACION',
            tabla_afectada: 'Roles', 
            registro_afectado_id: nuevoRol.rol_id.toString(),
            valor_nuevo: JSON.stringify(nuevoRol),
            exito_operacion: true,
            modulo_sistema_origen: 'Configuracion - Roles'
        });

        await client.query('COMMIT');
        return nuevoRol;
    } catch (error: any) {
        if (client) await client.query('ROLLBACK');
        console.error("Error al crear rol:", error);
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'CREACION',
            tabla_afectada: 'Roles', 
            registro_afectado_id: role.rol_id?.toString() || 'N/A', 
            valor_nuevo: JSON.stringify(role),
            exito_operacion: false,
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Configuracion - Roles'
        });
        throw error;
    } finally {
        if (client) client.release();
    }
};

// Actualizar un rol
export const updateRole = async (rolId: number, roleData: Partial<Role>, usuarioId: number, nombreUsuario: string): Promise<Role> => {
    let client;
    const valorAnterior = await getRoleById(rolId);
    if (!valorAnterior) {
        await logAuditoria({
            usuario_id_accion: usuarioId,
            nombre_usuario_accion: nombreUsuario,
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'Roles',
            registro_afectado_id: rolId.toString(),
            descripcion_detallada_evento: `Intento de actualización de rol no encontrado (ID: ${rolId}).`,
            exito_operacion: false,
            mensaje_error_si_fallo: 'Rol no encontrado para actualizar.',
            modulo_sistema_origen: 'Configuracion - Roles'
        });
        throw new Error('Rol no encontrado.');
    }

    const {
        nombre_rol, descripcion_detallada_rol, activo, es_rol_sistema
    } = roleData;

    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(
            `UPDATE Roles SET 
                nombre_rol = $1, descripcion_detallada_rol = $2, activo = $3, es_rol_sistema = $4,
                usuario_modificacion_id = $5, fecha_modificacion = NOW()
            WHERE rol_id = $6
            RETURNING *`,
            [
                nombre_rol ?? valorAnterior.nombre_rol,
                descripcion_detallada_rol ?? valorAnterior.descripcion_detallada_rol,
                activo ?? valorAnterior.activo,
                es_rol_sistema ?? valorAnterior.es_rol_sistema,
                usuarioId,
                rolId
            ]
        );
        const rolActualizado = result.rows[0];

        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'Roles', 
            registro_afectado_id: rolId.toString(),
            valor_anterior: JSON.stringify(valorAnterior), 
            valor_nuevo: JSON.stringify(rolActualizado),
            exito_operacion: true,
            modulo_sistema_origen: 'Configuracion - Roles'
        });

        await client.query('COMMIT');
        return rolActualizado;
    } catch (error: any) {
        if (client) await client.query('ROLLBACK');
        console.error("Error al actualizar rol:", error);
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'Roles', 
            registro_afectado_id: rolId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify(roleData),
            exito_operacion: false,
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Configuracion - Roles'
        });
        throw error;
    } finally {
        if (client) client.release();
    }
};

// Eliminar (desactivar) un rol
export const deleteRole = async (rolId: number, usuarioId: number, nombreUsuario: string): Promise<boolean> => {
    let client;
    const valorAnterior = await getRoleById(rolId);
    if (!valorAnterior) {
        await logAuditoria({
            usuario_id_accion: usuarioId,
            nombre_usuario_accion: nombreUsuario,
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'Roles',
            registro_afectado_id: rolId.toString(),
            descripcion_detallada_evento: `Intento de desactivación de rol no encontrado (ID: ${rolId}).`,
            exito_operacion: false,
            mensaje_error_si_fallo: 'Rol no encontrado para desactivar.',
            modulo_sistema_origen: 'Configuracion - Roles'
        });
        throw new Error('Rol no encontrado.');
    }

    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await pool.query(
            `UPDATE Roles SET 
                activo = FALSE,
                usuario_modificacion_id = $1, fecha_modificacion = NOW()
            WHERE rol_id = $2`,
            [usuarioId, rolId]
        );

        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'Roles', 
            registro_afectado_id: rolId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify({ ...valorAnterior, activo: false }),
            exito_operacion: true,
            modulo_sistema_origen: 'Configuracion - Roles'
        });

        await client.query('COMMIT');
        return (result.rowCount ?? 0) > 0;
    } catch (error: any) {
        if (client) await client.query('ROLLBACK');
        console.error("Error al desactivar rol:", error);
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'Roles', 
            registro_afectado_id: rolId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify({ ...valorAnterior, activo: false, estado_rol: 'ERROR_NO_DESACTIVADO' }),
            exito_operacion: false,
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Configuracion - Roles'
        });
        throw error;
    } finally {
        if (client) client.release();
    }
};

// Exportar roles a Excel
export const exportRoles = async (filters: RoleFilters): Promise<any[]> => {
    // Se usa getAllRoles sin paginación para la exportación completa
    const rolesToExport = await getAllRoles(1, 9999, filters); 
    // Para la exportación a Excel, asegúrate de que los objetos Role son "aplanados" adecuadamente
    // Aquí se asume que PagedResult<any> devuelve objetos con nombres de columna directamente.
    // Si RoleFilters tiene campos de auditoría, se reflejarán aquí también.
    return rolesToExport.records.map(role => ({
        "ID Rol": role.rol_id,
        "Nombre Rol": role.nombre_rol,
        "Descripción": role.descripcion_detallada_rol,
        "Activo": role.activo ? "Sí" : "No",
        "Rol de Sistema": role.es_rol_sistema ? "Sí" : "No",
        "Creado Por": role.creado_por || 'N/A',
        "Fecha Creación": role.fecha_creacion ? new Date(role.fecha_creacion).toLocaleString('es-PE') : 'N/A',
        "Modificado Por": role.modificado_por || 'N/A',
        "Fecha Modificación": role.fecha_modificacion ? new Date(role.fecha_modificacion).toLocaleString('es-PE') : 'N/A',
    }));
};