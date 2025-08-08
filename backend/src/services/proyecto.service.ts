    // Archivo: backend/src/services/proyecto.service.ts
    import pool from '../config/database';
    import { logAuditoria } from './auditoria.service';
    import { Cliente } from './cliente.service';  
    import { Moneda } from './moneda.service'; 
    import { CentroCosto } from './centroCosto.service'; 

    // Interfaz para la respuesta paginada (reutilizable)
    export interface PagedResult<T> {
        records: T[];
        total_records: number;
        total_pages: number;
        current_page: number;
    }

    // Interfaz completa de Proyecto
    export interface Proyecto {
        proyecto_id?: number;
        empresa_id_responsable: number;
        cliente_id: number;
        nombre_proyecto_campaña: string;
        codigo_proyecto_interno?: string;
        descripcion_proyecto?: string;
        tipo_proyecto?: string; 
        fecha_inicio_proyectada?: string;
        fecha_fin_proyectada?: string;
        fecha_inicio_real?: string;
        fecha_fin_real?: string;
        moneda_id_presupuesto?: number;
        monto_presupuestado_ingresos?: number;
        monto_presupuestado_costos?: number;
        usuario_id_responsable_proyecto?: number;
        estado_proyecto?: string; 
        centro_costo_id_asociado?: number;

        // ¡CAMPOS DE AUDITORÍA ACTIVADOS EN LA INTERFAZ!
        usuario_creacion_id?: number;
        fecha_creacion?: string;
        usuario_modificacion_id?: number;
        fecha_modificacion?: string;

        // Campos adicionales para JOINs
        cliente_razon_social?: string;
        moneda_nombre?: string;
        usuario_responsable_nombre?: string;
        centro_costo_nombre?: string;
        creado_por?: string;
        modificado_por?: string;
    }

    // Obtener todos los proyectos con filtros y paginación
    export const getAllProyectos = async (empresaId: number, page: number, limit: number, filters: any): Promise<PagedResult<any>> => {
        const allowedFilterKeys = ['codigo_proyecto_interno', 'nombre_proyecto_campaña', 'estado_proyecto', 'cliente_razon_social'];
        let query = `
            SELECT 
                p.proyecto_id, p.codigo_proyecto_interno, p.nombre_proyecto_campaña,
                p.estado_proyecto, p.fecha_inicio_proyectada, p.fecha_fin_proyectada,
                c.razon_social_o_nombres as cliente_razon_social,
                m.nombre_moneda as moneda_nombre,
                u_responsable.nombres_completos_persona as usuario_responsable_nombre,
                u_creacion.nombres_completos_persona as creado_por,
                p.fecha_creacion,
                u_modificacion.nombres_completos_persona as modificado_por,
                p.fecha_modificacion
            FROM Proyectos p
            JOIN Clientes c ON p.cliente_id = c.cliente_id
            LEFT JOIN Monedas m ON p.moneda_id_presupuesto = m.moneda_id
            LEFT JOIN Usuarios u_responsable ON p.usuario_id_responsable_proyecto = u_responsable.usuario_id
            LEFT JOIN Usuarios u_creacion ON p.usuario_creacion_id = u_creacion.usuario_id 
            LEFT JOIN Usuarios u_modificacion ON p.usuario_modificacion_id = u_modificacion.usuario_id 
            WHERE p.empresa_id_responsable = $1
        `;
        const countQueryBase = `SELECT COUNT(*) FROM Proyectos p WHERE p.empresa_id_responsable = $1`;

        const queryParams: any[] = [empresaId];
        let whereClause = '';
        let paramIndex = 2;

        Object.keys(filters).forEach(key => {
            if (allowedFilterKeys.includes(key) && filters[key]) {
                if (key === 'fecha_inicio_proyectada' || key === 'fecha_fin_proyectada') {
                    whereClause += ` AND p.${key} = $${paramIndex}`;
                    queryParams.push(filters[key]);
                } else if (key === 'cliente_razon_social') {
                    whereClause += ` AND c.razon_social_o_nombres ILIKE $${paramIndex}`;
                    queryParams.push(`%${filters[key]}%`);
                } else {
                    whereClause += ` AND p.${key}::text ILIKE $${paramIndex}`; 
                    queryParams.push(`%${filters[key]}%`);
                }
                paramIndex++;
            }
        });

        const finalQuery = query + whereClause + ' ORDER BY p.fecha_inicio_proyectada DESC, p.proyecto_id DESC';
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

    // NUEVA FUNCIÓN para obtener el siguiente código de proyecto
    export const getNextProyectoCode = async (empresaId: number): Promise<string> => {
        const prefix = 'PY';
        const query = `
            SELECT codigo_proyecto_interno FROM public.proyectos 
            WHERE empresa_id_responsable = $1 AND codigo_proyecto_interno LIKE $2
            ORDER BY codigo_proyecto_interno DESC LIMIT 1
        `;
        const result = await pool.query(query, [empresaId, `${prefix}-%`]);

        if (result.rows.length > 0) {
            const lastCode = result.rows[0].codigo_proyecto_interno;
            const lastNumberStr = lastCode.split('-')[1];
            if (lastNumberStr && !isNaN(parseInt(lastNumberStr, 10))) {
                const lastNumber = parseInt(lastNumberStr, 10);
                const nextNumber = lastNumber + 1;
                // Usamos padStart para asegurar que tenga 3 dígitos (ej: 001, 012, 123)
                return `${prefix}-${nextNumber.toString().padStart(3, '0')}`;
            }
        }
        // Si no se encuentra ningún código previo, empezamos con 001
        return `${prefix}-001`;
    };

    // Obtener un proyecto por su ID
    export const getProyectoById = async (proyectoId: number, empresaId: number) => {
        const query = `
            SELECT 
                p.*,
                c.razon_social_o_nombres as cliente_razon_social,
                m.nombre_moneda as moneda_nombre,
                u_responsable.nombres_completos_persona as usuario_responsable_nombre,
                cc.nombre_centro_costo as centro_costo_nombre,
                u_creacion.nombres_completos_persona as creado_por,
                u_modificacion.nombres_completos_persona as modificado_por
            FROM Proyectos p
            JOIN Clientes c ON p.cliente_id = c.cliente_id
            LEFT JOIN Monedas m ON p.moneda_id_presupuesto = m.moneda_id
            LEFT JOIN Usuarios u_responsable ON p.usuario_id_responsable_proyecto = u_responsable.usuario_id
            LEFT JOIN CentrosCosto cc ON p.centro_costo_id_asociado = cc.centro_costo_id
            LEFT JOIN Usuarios u_creacion ON p.usuario_creacion_id = u_creacion.usuario_id
            LEFT JOIN Usuarios u_modificacion ON p.usuario_modificacion_id = u_modificacion.usuario_id
            WHERE p.proyecto_id = $1 AND p.empresa_id_responsable = $2
        `;
        const result = await pool.query(query, [proyectoId, empresaId]);
        return result.rows[0] || null;
    };

    // Crear un nuevo proyecto
    export const createProyecto = async (proyecto: Proyecto, usuarioId: number, nombreUsuario: string) => {
        let client; 
        try {
            client = await pool.connect(); 
            await client.query('BEGIN');

            const { 
                empresa_id_responsable, cliente_id, nombre_proyecto_campaña, codigo_proyecto_interno,
                descripcion_proyecto, tipo_proyecto, fecha_inicio_proyectada, fecha_fin_proyectada,
                fecha_inicio_real, fecha_fin_real, moneda_id_presupuesto, monto_presupuestado_ingresos,
                monto_presupuestado_costos, usuario_id_responsable_proyecto, estado_proyecto,
                centro_costo_id_asociado
            } = proyecto;
            
            const result = await client.query( 
                `INSERT INTO Proyectos (
                    empresa_id_responsable, cliente_id, nombre_proyecto_campaña, codigo_proyecto_interno,
                    descripcion_proyecto, tipo_proyecto, fecha_inicio_proyectada, fecha_fin_proyectada,
                    fecha_inicio_real, fecha_fin_real, moneda_id_presupuesto, monto_presupuestado_ingresos,
                    monto_presupuestado_costos, usuario_id_responsable_proyecto, estado_proyecto,
                    centro_costo_id_asociado, usuario_creacion_id, fecha_creacion
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
                RETURNING *`,
                [
                    empresa_id_responsable, cliente_id, nombre_proyecto_campaña, codigo_proyecto_interno || null,
                    descripcion_proyecto || null, tipo_proyecto || null, fecha_inicio_proyectada || null, fecha_fin_proyectada || null,
                    fecha_inicio_real || null, fecha_fin_real || null, moneda_id_presupuesto || null, monto_presupuestado_ingresos || 0,
                    monto_presupuestado_costos || 0, usuario_id_responsable_proyecto || null, estado_proyecto || 'Planificado',
                    centro_costo_id_asociado || null, usuarioId
                ]
            );
            const nuevoProyecto = result.rows[0];

            await logAuditoria({
                usuario_id_accion: usuarioId, 
                nombre_usuario_accion: nombreUsuario, 
                tipo_evento: 'CREACION',
                tabla_afectada: 'Proyectos', 
                registro_afectado_id: nuevoProyecto.proyecto_id.toString(),
                valor_nuevo: JSON.stringify(nuevoProyecto),
                exito_operacion: true,
                modulo_sistema_origen: 'Proyectos'
            });

            await client.query('COMMIT'); 
            return nuevoProyecto;
        } catch (error: any) {
            if (client) await client.query('ROLLBACK'); 
            console.error("Error al crear proyecto:", error);
            await logAuditoria({
                usuario_id_accion: usuarioId, 
                nombre_usuario_accion: nombreUsuario, 
                tipo_evento: 'CREACION',
                tabla_afectada: 'Proyectos', 
                registro_afectado_id: proyecto.proyecto_id?.toString() || 'N/A',
                valor_nuevo: JSON.stringify(proyecto),
                exito_operacion: false,
                mensaje_error_si_fallo: error.message,
                modulo_sistema_origen: 'Proyectos'
            });
            throw error;
        } finally {
            if (client) client.release(); 
        }
    };

    // Actualizar un proyecto
    export const updateProyecto = async (proyectoId: number, proyectoData: Partial<Proyecto>, usuarioId: number, nombreUsuario: string) => {
        let client; 
        const valorAnterior = await getProyectoById(proyectoId, proyectoData.empresa_id_responsable!);
        if (!valorAnterior) {
            await logAuditoria({
                usuario_id_accion: usuarioId,
                nombre_usuario_accion: nombreUsuario,
                tipo_evento: 'MODIFICACION',
                tabla_afectada: 'Proyectos',
                registro_afectado_id: proyectoId.toString(),
                descripcion_detallada_evento: `Intento de actualización de proyecto no encontrado (ID: ${proyectoId}).`,
                exito_operacion: false,
                mensaje_error_si_fallo: 'Proyecto no encontrado para actualizar.',
                modulo_sistema_origen: 'Proyectos'
            });
            throw new Error('Proyecto no encontrado.');
        }

        const {
            cliente_id, nombre_proyecto_campaña, codigo_proyecto_interno,
            descripcion_proyecto, tipo_proyecto, fecha_inicio_proyectada, fecha_fin_proyectada,
            fecha_inicio_real, fecha_fin_real, moneda_id_presupuesto, monto_presupuestado_ingresos,
            monto_presupuestado_costos, usuario_id_responsable_proyecto, estado_proyecto,
            centro_costo_id_asociado
        } = proyectoData;

        try {
            client = await pool.connect(); 
            await client.query('BEGIN');

            const result = await client.query( 
                `UPDATE Proyectos SET 
                    cliente_id = $1, nombre_proyecto_campaña = $2, codigo_proyecto_interno = $3,
                    descripcion_proyecto = $4, tipo_proyecto = $5, fecha_inicio_proyectada = $6,
                    fecha_fin_proyectada = $7, fecha_inicio_real = $8, fecha_fin_real = $9,
                    moneda_id_presupuesto = $10, monto_presupuestado_ingresos = $11, monto_presupuestado_costos = $12,
                    usuario_id_responsable_proyecto = $13, estado_proyecto = $14, centro_costo_id_asociado = $15,
                    usuario_modificacion_id = $16, fecha_modificacion = NOW()
                WHERE proyecto_id = $17 AND empresa_id_responsable = $18
                RETURNING *`,
                [
                    cliente_id ?? valorAnterior.cliente_id,
                    nombre_proyecto_campaña ?? valorAnterior.nombre_proyecto_campaña,
                    codigo_proyecto_interno ?? valorAnterior.codigo_proyecto_interno,
                    descripcion_proyecto ?? valorAnterior.descripcion_proyecto,
                    tipo_proyecto ?? valorAnterior.tipo_proyecto,
                    fecha_inicio_proyectada ?? valorAnterior.fecha_inicio_proyectada,
                    fecha_fin_proyectada ?? valorAnterior.fecha_fin_proyectada,
                    fecha_inicio_real ?? valorAnterior.fecha_inicio_real,
                    fecha_fin_real ?? valorAnterior.fecha_fin_real,
                    moneda_id_presupuesto ?? valorAnterior.moneda_id_presupuesto,
                    monto_presupuestado_ingresos ?? valorAnterior.monto_presupuestado_ingresos,
                    monto_presupuestado_costos ?? valorAnterior.monto_presupuestado_costos,
                    usuario_id_responsable_proyecto ?? valorAnterior.usuario_id_responsable_proyecto,
                    estado_proyecto ?? valorAnterior.estado_proyecto,
                    centro_costo_id_asociado ?? valorAnterior.centro_costo_id_asociado,
                    usuarioId,
                    proyectoId,
                    proyectoData.empresa_id_responsable
                ]
            );
            const proyectoActualizado = result.rows[0];

            await logAuditoria({
                usuario_id_accion: usuarioId, 
                nombre_usuario_accion: nombreUsuario, 
                tipo_evento: 'MODIFICACION',
                tabla_afectada: 'Proyectos', 
                registro_afectado_id: proyectoId.toString(),
                valor_anterior: JSON.stringify(valorAnterior), 
                valor_nuevo: JSON.stringify({ ...proyectoData, ...proyectoActualizado }),
                exito_operacion: true,
                modulo_sistema_origen: 'Proyectos'
            });

            await client.query('COMMIT'); 
            return proyectoActualizado;
        } catch (error: any) {
            if (client) await client.query('ROLLBACK'); 
            console.error("Error al actualizar proyecto:", error);
            await logAuditoria({
                usuario_id_accion: usuarioId, 
                nombre_usuario_accion: nombreUsuario, 
                tipo_evento: 'MODIFICACION',
                tabla_afectada: 'Proyectos', 
                registro_afectado_id: proyectoId.toString(),
                valor_anterior: JSON.stringify(valorAnterior),
                valor_nuevo: JSON.stringify(proyectoData),
                exito_operacion: false,
                mensaje_error_si_fallo: error.message,
                modulo_sistema_origen: 'Proyectos'
            });
            throw error;
        } finally {
            if (client) client.release(); 
        }
    };

    // Eliminar (desactivar) un proyecto
    export const deleteProyecto = async (proyectoId: number, empresaId: number, usuarioId: number, nombreUsuario: string) => {
        let client; 
        const valorAnterior = await getProyectoById(proyectoId, empresaId);
        if (!valorAnterior) {
            await logAuditoria({
                usuario_id_accion: usuarioId,
                nombre_usuario_accion: nombreUsuario,
                tipo_evento: 'ELIMINACION_LOGICA',
                tabla_afectada: 'Proyectos',
                registro_afectado_id: proyectoId.toString(),
                descripcion_detallada_evento: `Intento de desactivación de proyecto no encontrado (ID: ${proyectoId}).`,
                exito_operacion: false,
                mensaje_error_si_fallo: 'Proyecto no encontrado para desactivar.',
                modulo_sistema_origen: 'Proyectos'
            });
            throw new Error('Proyecto no encontrado.');
        }

        try {
            client = await pool.connect(); 
            await client.query('BEGIN');

            const result = await client.query( 
                `UPDATE Proyectos SET 
                    estado_proyecto = 'Cancelado', 
                    usuario_modificacion_id = $1, fecha_modificacion = NOW()
                  WHERE proyecto_id = $2 AND empresa_id_responsable = $3`,
                [usuarioId, proyectoId, empresaId]
            );

            await logAuditoria({
                usuario_id_accion: usuarioId, 
                nombre_usuario_accion: nombreUsuario, 
                tipo_evento: 'ELIMINACION_LOGICA',
                tabla_afectada: 'Proyectos', 
                registro_afectado_id: proyectoId.toString(),
                valor_anterior: JSON.stringify(valorAnterior),
                valor_nuevo: JSON.stringify({ ...valorAnterior, estado_proyecto: 'Cancelado' }),
                exito_operacion: true,
                modulo_sistema_origen: 'Proyectos'
            });

            await client.query('COMMIT'); 
            return (result.rowCount ?? 0) > 0;
        } catch (error: any) {
            if (client) await client.query('ROLLBACK'); 
            console.error("Error al desactivar proyecto:", error);
            await logAuditoria({
                usuario_id_accion: usuarioId, 
                nombre_usuario_accion: nombreUsuario, 
                tipo_evento: 'ELIMINACION_LOGICA',
                tabla_afectada: 'Proyectos', 
                registro_afectado_id: proyectoId.toString(),
                valor_anterior: JSON.stringify(valorAnterior),
                valor_nuevo: JSON.stringify({ ...valorAnterior, estado_proyecto: 'ERROR_NO_DESACTIVADA' }),
                exito_operacion: false,
                mensaje_error_si_fallo: error.message,
                modulo_sistema_origen: 'Proyectos'
            });
            throw error;
        } finally {
            if (client) client.release(); 
        }
    };
