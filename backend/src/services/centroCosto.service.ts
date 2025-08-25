    // Archivo: backend/src/services/centroCosto.service.ts
    import pool from '../config/database';
    import { logAuditoria } from './auditoria.service';

    // Interfaz para la respuesta paginada (reutilizable)
    export interface PagedResult<T> {
        records: T[];
        total_records: number;
        total_pages: number;
        current_page: number;
    }

    // Interfaz que representa la tabla CentrosCosto
    export interface CentroCosto {
        centro_costo_id?: number; // Hacemos opcional para creación
        empresa_id: number;
        codigo_centro_costo: string;
        nombre_centro_costo: string;
        descripcion_centro_costo?: string;
        responsable_usuario_id?: number;
        tipo_centro_costo?: string;
        centro_costo_padre_id?: number;
        fecha_inicio_vigencia?: string;
        fecha_fin_vigencia?: string;
        presupuesto_asignado?: number;
        estado?: string;
        // Campos de auditoría (asumiendo que existen en la tabla CentrosCosto)
        usuario_creacion_id?: number;
        fecha_creacion?: string;
        usuario_modificacion_id?: number;
        fecha_modificacion?: string;
        // Campos adicionales para JOINs
        creado_por?: string;
        modificado_por?: string;
        responsable_nombre?: string; // Nombre del usuario responsable
        centro_costo_padre_nombre?: string; // Nombre del centro de costo padre
        centro_costo_padre_codigo?: string; // Código del centro de costo padre
    }

    // Obtener todos los centros de costo con filtros y paginación
    export const getAllCentrosCosto = async (empresaId: number, page: number, limit: number, filters: any): Promise<PagedResult<any>> => {
        const allowedFilterKeys = ['codigo_centro_costo', 'nombre_centro_costo', 'tipo_centro_costo', 'estado'];
        let query = `
            SELECT 
                cc.centro_costo_id, cc.codigo_centro_costo, cc.nombre_centro_costo,
                cc.tipo_centro_costo, cc.estado, cc.presupuesto_asignado,
                cc.descripcion_centro_costo,
                u.nombres_completos_persona as responsable_nombre,
                cc_padre.codigo_centro_costo as centro_costo_padre_codigo,
                cc_padre.nombre_centro_costo as centro_costo_padre_nombre,
                u_creacion.nombres_completos_persona as creado_por,
                cc.fecha_creacion,
                u_modificacion.nombres_completos_persona as modificado_por,
                cc.fecha_modificacion
            FROM CentrosCosto cc
            LEFT JOIN Usuarios u ON cc.responsable_usuario_id = u.usuario_id
            LEFT JOIN CentrosCosto cc_padre ON cc.centro_costo_padre_id = cc_padre.centro_costo_id
            LEFT JOIN Usuarios u_creacion ON cc.usuario_creacion_id = u_creacion.usuario_id
            LEFT JOIN Usuarios u_modificacion ON cc.usuario_modificacion_id = u_modificacion.usuario_id
            WHERE cc.empresa_id = $1
        `;
        const countQueryBase = `SELECT COUNT(*) FROM CentrosCosto cc WHERE cc.empresa_id = $1`;

        const queryParams: any[] = [empresaId];
        let whereClause = '';
        let paramIndex = 2;

        Object.keys(filters).forEach(key => {
            if (allowedFilterKeys.includes(key) && filters[key]) {
                whereClause += ` AND cc.${key}::text ILIKE $${paramIndex}`; 
                queryParams.push(`%${filters[key]}%`);
                paramIndex++;
            }
        });

        const finalQuery = query + whereClause + ' ORDER BY cc.codigo_centro_costo ASC';
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

    // Obtener un centro de costo por su ID
    export const getCentroCostoById = async (centroCostoId: number, empresaId: number) => {
        const query = `
            SELECT 
                cc.*,
                u.nombres_completos_persona as responsable_nombre,
                cc_padre.codigo_centro_costo as centro_costo_padre_codigo,
                cc_padre.nombre_centro_costo as centro_costo_padre_nombre,
                u_creacion.nombres_completos_persona as creado_por,
                u_modificacion.nombres_completos_persona as modificado_por
            FROM CentrosCosto cc
            LEFT JOIN Usuarios u ON cc.responsable_usuario_id = u.usuario_id
            LEFT JOIN CentrosCosto cc_padre ON cc.centro_costo_padre_id = cc_padre.centro_costo_id
            LEFT JOIN Usuarios u_creacion ON cc.usuario_creacion_id = u_creacion.usuario_id
            LEFT JOIN Usuarios u_modificacion ON cc.usuario_modificacion_id = u_modificacion.usuario_id
            WHERE cc.centro_costo_id = $1 AND cc.empresa_id = $2
        `;
        const result = await pool.query(query, [centroCostoId, empresaId]);
        return result.rows[0] || null;
    };

    // Crear un nuevo centro de costo
    export const createCentroCosto = async (centroCosto: CentroCosto, usuarioId: number, nombreUsuario: string) => {
        let client;
        try {
            client = await pool.connect();
            await client.query('BEGIN');

            const { 
                empresa_id, codigo_centro_costo, nombre_centro_costo, descripcion_centro_costo,
                responsable_usuario_id, tipo_centro_costo, centro_costo_padre_id,
                fecha_inicio_vigencia, fecha_fin_vigencia, presupuesto_asignado, estado
            } = centroCosto;
            
            const result = await client.query(
                `INSERT INTO CentrosCosto (
                    empresa_id, codigo_centro_costo, nombre_centro_costo, descripcion_centro_costo,
                    responsable_usuario_id, tipo_centro_costo, centro_costo_padre_id,
                    fecha_inicio_vigencia, fecha_fin_vigencia, presupuesto_asignado, estado,
                    usuario_creacion_id, fecha_creacion
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
                RETURNING *`,
                [
                    empresa_id, codigo_centro_costo, nombre_centro_costo, descripcion_centro_costo || null,
                    responsable_usuario_id || null, tipo_centro_costo || null, centro_costo_padre_id || null,
                    fecha_inicio_vigencia || null, fecha_fin_vigencia || null, presupuesto_asignado || 0, estado || 'Activo',
                    usuarioId
                ]
            );
            const nuevoCentroCosto = result.rows[0];

            await logAuditoria({
                usuario_id_accion: usuarioId, 
                nombre_usuario_accion: nombreUsuario, 
                tipo_evento: 'CREACION',
                tabla_afectada: 'CentrosCosto', 
                registro_afectado_id: nuevoCentroCosto.centro_costo_id.toString(),
                valor_nuevo: JSON.stringify(nuevoCentroCosto),
                exito_operacion: true,
                modulo_sistema_origen: 'Maestros - Centros de Costo'
            });

            await client.query('COMMIT');
            return nuevoCentroCosto;
        } catch (error: any) {
            if (client) await client.query('ROLLBACK');
            console.error("Error al crear centro de costo:", error);
            await logAuditoria({
                usuario_id_accion: usuarioId, 
                nombre_usuario_accion: nombreUsuario, 
                tipo_evento: 'CREACION',
                tabla_afectada: 'CentrosCosto', 
                registro_afectado_id: centroCosto.centro_costo_id?.toString() || 'N/A',
                valor_nuevo: JSON.stringify(centroCosto),
                exito_operacion: false,
                mensaje_error_si_fallo: error.message,
                modulo_sistema_origen: 'Maestros - Centros de Costo'
            });
            throw error;
        } finally {
            if (client) client.release();
        }
    };

    // Actualizar un centro de costo
    export const updateCentroCosto = async (centroCostoId: number, centroCostoData: Partial<CentroCosto>, usuarioId: number, nombreUsuario: string) => {
        let client;
        const valorAnterior = await getCentroCostoById(centroCostoId, centroCostoData.empresa_id!);
        if (!valorAnterior) {
            await logAuditoria({
                usuario_id_accion: usuarioId,
                nombre_usuario_accion: nombreUsuario,
                tipo_evento: 'MODIFICACION',
                tabla_afectada: 'CentrosCosto',
                registro_afectado_id: centroCostoId.toString(),
                descripcion_detallada_evento: `Intento de actualización de centro de costo no encontrado (ID: ${centroCostoId}).`,
                exito_operacion: false,
                mensaje_error_si_fallo: 'Centro de costo no encontrado para actualizar.',
                modulo_sistema_origen: 'Maestros - Centros de Costo'
            });
            throw new Error('Centro de costo no encontrado.');
        }

        const {
            codigo_centro_costo, nombre_centro_costo, descripcion_centro_costo,
            responsable_usuario_id, tipo_centro_costo, centro_costo_padre_id,
            fecha_inicio_vigencia, fecha_fin_vigencia, presupuesto_asignado, estado
        } = centroCostoData;

        try {
            client = await pool.connect();
            await client.query('BEGIN');

            const result = await client.query(
                `UPDATE CentrosCosto SET 
                    codigo_centro_costo = $1, nombre_centro_costo = $2, descripcion_centro_costo = $3,
                    responsable_usuario_id = $4, tipo_centro_costo = $5, centro_costo_padre_id = $6,
                    fecha_inicio_vigencia = $7, fecha_fin_vigencia = $8, presupuesto_asignado = $9, estado = $10,
                    usuario_modificacion_id = $11, fecha_modificacion = NOW()
                WHERE centro_costo_id = $12 AND empresa_id = $13
                RETURNING *`,
                [
                    codigo_centro_costo ?? valorAnterior.codigo_centro_costo,
                    nombre_centro_costo ?? valorAnterior.nombre_centro_costo,
                    descripcion_centro_costo ?? valorAnterior.descripcion_centro_costo,
                    responsable_usuario_id ?? valorAnterior.responsable_usuario_id,
                    tipo_centro_costo ?? valorAnterior.tipo_centro_costo,
                    centro_costo_padre_id ?? valorAnterior.centro_costo_padre_id,
                    fecha_inicio_vigencia ?? valorAnterior.fecha_inicio_vigencia,
                    fecha_fin_vigencia ?? valorAnterior.fecha_fin_vigencia,
                    presupuesto_asignado ?? valorAnterior.presupuesto_asignado,
                    estado ?? valorAnterior.estado,
                    usuarioId,
                    centroCostoId,
                    centroCostoData.empresa_id
                ]
            );
            const centroCostoActualizado = result.rows[0];

            await logAuditoria({
                usuario_id_accion: usuarioId, 
                nombre_usuario_accion: nombreUsuario, 
                tipo_evento: 'MODIFICACION',
                tabla_afectada: 'CentrosCosto', 
                registro_afectado_id: centroCostoId.toString(),
                valor_anterior: JSON.stringify(valorAnterior), 
                valor_nuevo: JSON.stringify(centroCostoActualizado),
                exito_operacion: true,
                modulo_sistema_origen: 'Maestros - Centros de Costo'
            });

            await client.query('COMMIT');
            return centroCostoActualizado;
        } catch (error: any) {
            if (client) await client.query('ROLLBACK');
            console.error("Error al actualizar centro de costo:", error);
            await logAuditoria({
                usuario_id_accion: usuarioId, 
                nombre_usuario_accion: nombreUsuario, 
                tipo_evento: 'MODIFICACION',
                tabla_afectada: 'CentrosCosto', 
                registro_afectado_id: centroCostoId.toString(),
                valor_anterior: JSON.stringify(valorAnterior),
                valor_nuevo: JSON.stringify(centroCostoData),
                exito_operacion: false,
                mensaje_error_si_fallo: error.message,
                modulo_sistema_origen: 'Maestros - Centros de Costo'
            });
            throw error;
        } finally {
            if (client) client.release();
        }
    };

    // Eliminar (desactivar) un centro de costo
    export const deleteCentroCosto = async (centroCostoId: number, empresaId: number, usuarioId: number, nombreUsuario: string) => {
        let client;
        const valorAnterior = await getCentroCostoById(centroCostoId, empresaId);
        if (!valorAnterior) {
            await logAuditoria({
                usuario_id_accion: usuarioId,
                nombre_usuario_accion: nombreUsuario,
                tipo_evento: 'ELIMINACION_LOGICA',
                tabla_afectada: 'CentrosCosto',
                registro_afectado_id: centroCostoId.toString(),
                descripcion_detallada_evento: `Intento de desactivación de centro de costo no encontrado (ID: ${centroCostoId}).`,
                exito_operacion: false,
                mensaje_error_si_fallo: 'Centro de costo no encontrado para desactivar.',
                modulo_sistema_origen: 'Maestros - Centros de Costo'
            });
            throw new Error('Centro de costo no encontrado.');
        }

        try {
            client = await pool.connect();
            await client.query('BEGIN');

            const result = await client.query(
                `UPDATE CentrosCosto SET 
                    estado = 'Inactivo',
                    usuario_modificacion_id = $1, fecha_modificacion = NOW()
                  WHERE centro_costo_id = $2 AND empresa_id = $3`,
                [usuarioId, centroCostoId, empresaId]
            );

            await logAuditoria({
                usuario_id_accion: usuarioId, 
                nombre_usuario_accion: nombreUsuario, 
                tipo_evento: 'ELIMINACION_LOGICA',
                tabla_afectada: 'CentrosCosto', 
                registro_afectado_id: centroCostoId.toString(),
                valor_anterior: JSON.stringify(valorAnterior),
                valor_nuevo: JSON.stringify({ ...valorAnterior, estado: 'Inactivo' }),
                exito_operacion: true,
                modulo_sistema_origen: 'Maestros - Centros de Costo'
            });

            await client.query('COMMIT');
            return (result.rowCount ?? 0) > 0;
        } catch (error: any) {
            if (client) await client.query('ROLLBACK');
            console.error("Error al desactivar centro de costo:", error);
            await logAuditoria({
                usuario_id_accion: usuarioId, 
                nombre_usuario_accion: nombreUsuario, 
                tipo_evento: 'ELIMINACION_LOGICA',
                tabla_afectada: 'CentrosCosto', 
                registro_afectado_id: centroCostoId.toString(),
                valor_anterior: JSON.stringify(valorAnterior),
                valor_nuevo: JSON.stringify({ ...valorAnterior, estado: 'ERROR_NO_DESACTIVADA' }),
                exito_operacion: false,
                mensaje_error_si_fallo: error.message,
                modulo_sistema_origen: 'Maestros - Centros de Costo'
            });
            throw error;
        } finally {
            if (client) client.release();
        }
    };
