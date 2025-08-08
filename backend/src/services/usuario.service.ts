// Archivo: backend/src/services/usuario.service.ts (VERSIÓN FINAL con HASH DE CONTRASEÑA EN BACKEND y JSON en lugar de JSONB)
import pool from '../config/database';
import bcrypt from 'bcryptjs'; 
import { logAuditoria } from './auditoria.service';
import { Empresa } from './empresa.service'; 
import type { Role } from './rol.service'; 

import axios, { AxiosRequestConfig, AxiosError } from 'axios'; 
import type { AxiosRequestHeaders } from 'axios'; 

// Interfaz para la respuesta paginada (reutilizable)
export interface PagedResult<T> {
    records: T[];
    total_records: number;
    total_pages: number;
    current_page: number;
}

// Interfaz completa de Usuario
export interface Usuario {
    usuario_id?: number;
    nombre_usuario_login: string;
    contrasena_raw?: string; 
    
    nombres_completos_persona: string;
    apellidos_completos_persona: string;
    email_corporativo: string;
    telefono_contacto?: string;
    cargo_o_puesto?: string;
    empresa_id_predeterminada: number;
    activo: boolean;
    fecha_ultimo_login_exitoso?: string;
    fecha_creacion_cuenta?: string; 
    fecha_expiracion_cuenta?: string;
    requiere_cambio_contrasena_en_login?: boolean;
    numero_intentos_fallidos_login?: number; 
    cuenta_bloqueada_hasta?: string; 
    foto_perfil_url?: string;

    usuario_creacion_id?: number;
    usuario_modificacion_id?: number;
    fecha_modificacion?: string;

    rol_ids?: number[]; 
    roles?: Role[]; 

    empresa_nombre?: string; 
    creado_por?: string; 
    modificado_por?: string; 
}

export interface UsuarioFilters {
    nombre_usuario_login?: string;
    nombres_completos_persona?: string;
    apellidos_completos_persona?: string;
    email_corporativo?: string;
    activo?: boolean;
}

const API_URL = 'http://localhost:4000/api/usuarios'; 

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

// Obtener todos los usuarios con filtros y paginación
export const getAllUsuarios = async (empresaId: number, page: number, limit: number, filters: UsuarioFilters): Promise<PagedResult<any>> => {
    const allowedFilterKeys = ['nombre_usuario_login', 'nombres_completos_persona', 'apellidos_completos_persona', 'email_corporativo', 'activo'];
    let query = `
        SELECT 
            u.usuario_id, u.nombre_usuario_login, u.nombres_completos_persona, 
            u.apellidos_completos_persona, u.email_corporativo, u.activo,
            u.fecha_creacion_cuenta, 
            u.fecha_ultimo_login_exitoso,
            u.fecha_expiracion_cuenta,
            u.requiere_cambio_contrasena_en_login,
            u.numero_intentos_fallidos_login,
            u.cuenta_bloqueada_hasta,
            u.foto_perfil_url,
            
            e.nombre_empresa as empresa_nombre, 
            
            u_creacion.nombres_completos_persona as creado_por,
            u.usuario_creacion_id, 
            
            u_modificacion.nombres_completos_persona as modificado_por,
            u.usuario_modificacion_id, 
            u.fecha_modificacion, 

            COALESCE(
                (SELECT JSON_AGG(json_build_object('rol_id', r.rol_id, 'nombre_rol', r.nombre_rol)) -- ¡CAMBIO CLAVE AQUÍ! USAR json_build_object
                 FROM UsuarioRoles ur
                 JOIN Roles r ON ur.rol_id = r.rol_id
                 WHERE ur.usuario_id = u.usuario_id),
                '[]'::json -- ¡CAMBIO CLAVE AQUÍ! USAR '[]'::json
            ) as roles -- ¡SE ELIMINA EL CAST ::json FINAL!
        FROM Usuarios u
        LEFT JOIN Empresas e ON u.empresa_id_predeterminada = e.empresa_id
        LEFT JOIN Usuarios u_creacion ON u.usuario_creacion_id = u_creacion.usuario_id 
        LEFT JOIN Usuarios u_modificacion ON u.usuario_modificacion_id = u_modificacion.usuario_id 
        WHERE u.empresa_id_predeterminada = $1
    `;
    const countQueryBase = `SELECT COUNT(*) FROM Usuarios u WHERE u.empresa_id_predeterminada = $1`;

    const params = new URLSearchParams(); 
    const queryParams: any[] = [empresaId];
    let whereClause = '';
    let paramIndex = 2;

    Object.keys(filters).forEach(_key => {
        const key = _key as keyof UsuarioFilters; 
        const value = filters[key]; 
        if (value !== undefined) { 
            params.append(key, String(value));
        }
    });

    const finalQuery = query + whereClause + ' ORDER BY u.nombres_completos_persona ASC';
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

// Obtener un usuario por su ID
export const getUsuarioById = async (usuarioId: number, empresaId: number): Promise<Usuario | null> => {
    const query = `
        SELECT 
            u.usuario_id, u.nombre_usuario_login, u.nombres_completos_persona, 
            u.apellidos_completos_persona, u.email_corporativo, u.telefono_contacto,
            u.cargo_o_puesto, u.empresa_id_predeterminada, u.activo,
            u.fecha_ultimo_login_exitoso, u.fecha_creacion_cuenta, 
            u.fecha_expiracion_cuenta, u.requiere_cambio_contrasena_en_login,
            u.numero_intentos_fallidos_login, u.cuenta_bloqueada_hasta, u.foto_perfil_url,
            
            e.nombre_empresa as empresa_nombre, 
            
            u_creacion.nombres_completos_persona as creado_por,
            u.usuario_creacion_id,
            
            u_modificacion.nombres_completos_persona as modificado_por,
            u.usuario_modificacion_id,
            u.fecha_modificacion,

            COALESCE(
                (SELECT JSON_AGG(json_build_object('rol_id', r.rol_id, 'nombre_rol', r.nombre_rol, 'descripcion_detallada_rol', r.descripcion_detallada_rol)) -- ¡CAMBIO CLAVE AQUÍ! USAR json_build_object
                 FROM UsuarioRoles ur
                 JOIN Roles r ON ur.rol_id = r.rol_id
                 WHERE ur.usuario_id = u.usuario_id),
                '[]'::json -- ¡CAMBIO CLAVE AQUÍ! USAR '[]'::json
            ) as roles -- ¡SE ELIMINA EL CAST ::json FINAL!
        FROM Usuarios u
        LEFT JOIN Empresas e ON u.empresa_id_predeterminada = e.empresa_id
        LEFT JOIN Usuarios u_creacion ON u.usuario_creacion_id = u_creacion.usuario_id
        LEFT JOIN Usuarios u_modificacion ON u.usuario_modificacion_id = u_modificacion.usuario_id
        WHERE u.usuario_id = $1 AND u.empresa_id_predeterminada = $2
    `;
    const result = await pool.query(query, [usuarioId, empresaId]);
    return result.rows[0] || null;
};

// Crear un nuevo usuario
export const createUsuario = async (userData: Usuario, creadorId: number, creadorNombre: string): Promise<Usuario> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const {
            nombre_usuario_login, contrasena_raw, nombres_completos_persona,
            apellidos_completos_persona, email_corporativo, telefono_contacto,
            cargo_o_puesto, empresa_id_predeterminada, activo,
            fecha_expiracion_cuenta, requiere_cambio_contrasena_en_login,
            foto_perfil_url, rol_ids
        } = userData;

        if (!contrasena_raw) {
            throw new Error('La contraseña es obligatoria para crear un nuevo usuario.');
        }

        // 1. Encriptar la contraseña usando bcrypt
        const salt = await bcrypt.genSalt(10);
        const contrasenaEncriptada = await bcrypt.hash(contrasena_raw, salt);

        // 2. Insertar el usuario con la contraseña encriptada en la columna correcta
        //    (Usa 'contrasena' o 'hash_contrasena' según el nombre final de tu columna)
        const insertUserQuery = `
            INSERT INTO public.usuarios (
                nombre_usuario_login, contrasena, nombres_completos_persona,
                apellidos_completos_persona, email_corporativo, telefono_contacto,
                cargo_o_puesto, empresa_id_predeterminada, activo,
                fecha_expiracion_cuenta, requiere_cambio_contrasena_en_login, foto_perfil_url,
                usuario_creacion_id, fecha_creacion_cuenta
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
            RETURNING *;
        `;
        const userResult = await client.query(insertUserQuery, [
            nombre_usuario_login, contrasenaEncriptada, nombres_completos_persona,
            apellidos_completos_persona, email_corporativo, telefono_contacto || null,
            cargo_o_puesto || null, empresa_id_predeterminada, activo,
            fecha_expiracion_cuenta || null, requiere_cambio_contrasena_en_login || false,
            foto_perfil_url || null, creadorId
        ]);

        const nuevoUsuario = userResult.rows[0];

        // 3. Insertar los roles del usuario
        if (rol_ids && rol_ids.length > 0) {
            for (const rolId of rol_ids) {
                await client.query(
                    'INSERT INTO public.usuarioroles (usuario_id, rol_id) VALUES ($1, $2)',
                    [nuevoUsuario.usuario_id, rolId]
                );
            }
        }

        await client.query('COMMIT');
        
        // Excluimos la contraseña del objeto que se devuelve y se audita
        const { contrasena, ...usuarioParaAuditoria } = nuevoUsuario;

        await logAuditoria({
            usuario_id_accion: creadorId,
            nombre_usuario_accion: creadorNombre,
            tipo_evento: 'CREACION',
            tabla_afectada: 'Usuarios',
            registro_afectado_id: nuevoUsuario.usuario_id.toString(),
            valor_nuevo: JSON.stringify(usuarioParaAuditoria),
            exito_operacion: true,
            modulo_sistema_origen: 'Configuración - Usuarios'
        });

        return usuarioParaAuditoria;

    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error("Error al crear usuario:", error);
        await logAuditoria({
            usuario_id_accion: creadorId,
            nombre_usuario_accion: creadorNombre,
            tipo_evento: 'CREACION',
            tabla_afectada: 'Usuarios',
            registro_afectado_id: 'N/A',
            valor_nuevo: JSON.stringify(userData), // Logueamos lo que se intentó guardar
            exito_operacion: false,
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Configuración - Usuarios'
        });
        throw error;
    } finally {
        client.release();
    }
};

// Actualizar un usuario
export const updateUsuario = async (usuarioId: number, usuarioData: Partial<Usuario>, modificadorId: number, nombreModificador: string): Promise<Usuario | null> => {
    const client = await pool.connect();
    
    let empresaIdParaConsulta: number;
    if (usuarioData.empresa_id_predeterminada !== undefined && usuarioData.empresa_id_predeterminada !== null) {
        empresaIdParaConsulta = usuarioData.empresa_id_predeterminada;
    } else {
        const res = await pool.query('SELECT empresa_id_predeterminada FROM Usuarios WHERE usuario_id = $1', [usuarioId]);
        if (res.rows.length === 0 || res.rows[0].empresa_id_predeterminada === undefined || res.rows[0].empresa_id_predeterminada === null) {
            throw new Error("No se pudo determinar la empresa predeterminada del usuario existente para la actualización.");
        }
        empresaIdParaConsulta = res.rows[0].empresa_id_predeterminada;
    }

    const valorAnterior = await getUsuarioById(usuarioId, empresaIdParaConsulta);

    if (!valorAnterior) {
        await logAuditoria({
            usuario_id_accion: modificadorId,
            nombre_usuario_accion: nombreModificador,
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'Usuarios',
            registro_afectado_id: usuarioId.toString(),
            descripcion_detallada_evento: `Intento de actualización de usuario no encontrado (ID: ${usuarioId}).`,
            exito_operacion: false,
            mensaje_error_si_fallo: 'Usuario no encontrado para actualizar.',
            modulo_sistema_origen: 'Configuracion - Usuarios'
        });
        throw new Error('Usuario no encontrado.');
    }

    try {
        await client.query('BEGIN');

        const {
            nombre_usuario_login, contrasena_raw, 
            nombres_completos_persona, apellidos_completos_persona, email_corporativo,
            telefono_contacto, cargo_o_puesto, empresa_id_predeterminada, activo,
            fecha_expiracion_cuenta, requiere_cambio_contrasena_en_login,
            numero_intentos_fallidos_login, cuenta_bloqueada_hasta, foto_perfil_url,
            rol_ids 
        } = usuarioData;

        const fieldsToUpdate: string[] = [];
        const queryParams: any[] = [];
        let paramIndex = 1;

        const addField = (field: string, value: any) => {
            fieldsToUpdate.push(`${field} = $${paramIndex}`);
            queryParams.push(value);
            paramIndex++;
        };

        if (nombre_usuario_login !== undefined) addField('nombre_usuario_login', nombre_usuario_login);
        if (nombres_completos_persona !== undefined) addField('nombres_completos_persona', nombres_completos_persona);
        if (apellidos_completos_persona !== undefined) addField('apellidos_completos_persona', apellidos_completos_persona);
        if (email_corporativo !== undefined) addField('email_corporativo', email_corporativo);
        if (telefono_contacto !== undefined) addField('telefono_contacto', telefono_contacto);
        if (cargo_o_puesto !== undefined) addField('cargo_o_puesto', cargo_o_puesto);
        if (empresa_id_predeterminada !== undefined) addField('empresa_id_predeterminada', empresa_id_predeterminada);
        if (activo !== undefined) addField('activo', activo);
        if (fecha_expiracion_cuenta !== undefined) addField('fecha_expiracion_cuenta', fecha_expiracion_cuenta);
        if (requiere_cambio_contrasena_en_login !== undefined) addField('requiere_cambio_contrasena_en_login', requiere_cambio_contrasena_en_login);
        if (numero_intentos_fallidos_login !== undefined) addField('numero_intentos_fallidos_login', numero_intentos_fallidos_login);
        if (cuenta_bloqueada_hasta !== undefined) addField('cuenta_bloqueada_hasta', cuenta_bloqueada_hasta);
        if (foto_perfil_url !== undefined) addField('foto_perfil_url', foto_perfil_url);
        
        if (contrasena_raw !== undefined && contrasena_raw !== null && contrasena_raw.trim() !== '') {
            const salt = bcrypt.genSaltSync(10);
            const contrasena = bcrypt.hashSync(contrasena_raw, salt);
            const sal_contrasena = salt; 
            addField('contrasena', contrasena);
            addField('sal_contrasena', sal_contrasena);
        }

        addField('usuario_modificacion_id', modificadorId);
        addField('fecha_modificacion', 'NOW()'); 

        const updateQuery = `
            UPDATE Usuarios SET
                ${fieldsToUpdate.join(', ')}
            WHERE usuario_id = $${paramIndex} AND empresa_id_predeterminada = $${paramIndex + 1} RETURNING *`;
        queryParams.push(usuarioId, empresaIdParaConsulta); 
        
        const result = await client.query(updateQuery, queryParams);
        if (result.rows.length === 0) {
            throw new Error('Usuario no encontrado para actualizar después de la consulta.');
        }
        
        if (rol_ids !== undefined) {
            await client.query(`DELETE FROM UsuarioRoles WHERE usuario_id = $1`, [usuarioId]);
            if (rol_ids.length > 0) {
                for (const rolId of rol_ids) {
                    await client.query(
                        `INSERT INTO UsuarioRoles (usuario_id, rol_id, asignado_por_usuario_id) VALUES ($1, $2, $3)`,
                        [usuarioId, rolId, modificadorId]
                    );
                }
            }
        }

        await client.query('COMMIT');

        const usuarioActualizadoCompleto = await getUsuarioById(usuarioId, empresaIdParaConsulta); 
        
        await logAuditoria({
            usuario_id_accion: modificadorId, 
            nombre_usuario_accion: nombreModificador, 
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'Usuarios', 
            registro_afectado_id: usuarioId.toString(),
            valor_anterior: JSON.stringify(valorAnterior), 
            valor_nuevo: JSON.stringify(usuarioActualizadoCompleto), 
            exito_operacion: true,
            modulo_sistema_origen: 'Configuracion - Usuarios'
        });

        return usuarioActualizadoCompleto;
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error("Error al actualizar usuario:", error);
        await logAuditoria({
            usuario_id_accion: modificadorId, 
            nombre_usuario_accion: nombreModificador, 
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'Usuarios', 
            registro_afectado_id: usuarioId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify(usuarioData),
            exito_operacion: false,
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Configuracion - Usuarios'
        });
        throw error;
    } finally {
        client.release();
    }
};

export const deleteUsuario = async (usuarioId: number, empresaId: number, modificadorId: number, nombreModificador: string): Promise<boolean> => {
    const client = await pool.connect();
    const valorAnterior = await getUsuarioById(usuarioId, empresaId);
    if (!valorAnterior) {
        await logAuditoria({
            usuario_id_accion: modificadorId,
            nombre_usuario_accion: nombreModificador,
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'Usuarios',
            registro_afectado_id: usuarioId.toString(),
            descripcion_detallada_evento: `Intento de desactivación de usuario no encontrado (ID: ${usuarioId}).`,
            exito_operacion: false,
            mensaje_error_si_fallo: 'Usuario no encontrado para desactivar.',
            modulo_sistema_origen: 'Configuracion - Usuarios'
        });
        throw new Error('Usuario no encontrado.');
    }

    try {
        await client.query('BEGIN'); 

        const result = await pool.query(
            `UPDATE Usuarios SET 
                activo = FALSE,
                usuario_modificacion_id = $1, fecha_modificacion = NOW()
              WHERE usuario_id = $2 AND empresa_id_predeterminada = $3`,
            [modificadorId, usuarioId, empresaId]
        );

        await logAuditoria({
            usuario_id_accion: modificadorId, 
            nombre_usuario_accion: nombreModificador, 
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'Usuarios', 
            registro_afectado_id: usuarioId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify({ ...valorAnterior, activo: false }),
            exito_operacion: true,
            modulo_sistema_origen: 'Configuracion - Usuarios'
        });
        await client.query('COMMIT'); 
        return (result.rowCount ?? 0) > 0;
    } catch (error: any) {
        await client.query('ROLLBACK'); 
        console.error("Error al desactivar usuario:", error);
        await logAuditoria({
            usuario_id_accion: modificadorId, 
            nombre_usuario_accion: nombreModificador, 
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'Usuarios', 
            registro_afectado_id: usuarioId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify({ ...valorAnterior, activo: false, estado_usuario: 'ERROR_NO_DESACTIVADO' }),
            exito_operacion: false,
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Configuracion - Usuarios'
        });
        throw error;
    } finally {
        client.release();
    }
};

export const exportUsuarios = async (empresaId: number, filters: UsuarioFilters): Promise<any[]> => {
    const usersToExport = await getAllUsuarios(empresaId, 1, 9999, filters); 
    return usersToExport.records.map(user => ({
        "ID Usuario": user.usuario_id,
        "Nombre de Usuario": user.nombre_usuario_login,
        "Nombres Completos": user.nombres_completos_persona,
        "Apellidos Completos": user.apellidos_completos_persona,
        "Email Corporativo": user.email_corporativo,
        "Teléfono": user.telefono_contacto,
        "Cargo": user.cargo_o_puesto,
        "Empresa Predeterminada": user.empresa_nombre,
        "Activo": user.activo ? "Sí" : "No",
        "Fecha Creación Cuenta": user.fecha_creacion_cuenta ? new Date(user.fecha_creacion_cuenta).toLocaleString('es-PE') : 'N/A',
        "Último Login": user.fecha_ultimo_login_exitoso ? new Date(user.fecha_ultimo_login_exitoso).toLocaleString('es-PE') : 'N/A',
        "Fecha Expiración Cuenta": user.fecha_expiracion_cuenta || 'N/A',
        "Requiere Cambio Contraseña": user.requiere_cambio_contrasena_en_login ? "Sí" : "No",
        "Intentos Fallidos": user.numero_intentos_fallidos_login,
        "Cuenta Bloqueada Hasta": user.cuenta_bloqueada_hasta ? new Date(user.cuenta_bloqueada_hasta).toLocaleString('es-PE') : 'N/A',
        "Roles Asignados": user.roles ? user.roles.map((r: Role) => r.nombre_rol).join(', ') : 'Ninguno', 
        "Creado Por": user.creado_por || 'N/A',
        "Fecha Creación": user.fecha_creacion_cuenta ? new Date(user.fecha_creacion_cuenta).toLocaleString('es-PE') : 'N/A', 
        "Fecha Modificación": user.fecha_modificacion ? new Date(user.fecha_modificacion).toLocaleString('es-PE') : 'N/A',
        "Modificado Por": user.modificado_por || 'N/A'
    }));
};