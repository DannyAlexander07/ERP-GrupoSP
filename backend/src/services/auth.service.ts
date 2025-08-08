// Archivo: backend/src/services/auth.service.ts (VERSIÓN FINAL Y CORREGIDA - USANDO JSON EN LUGAR DE JSONB)
import pool from '../config/database';
import bcrypt from 'bcryptjs';
import { HttpError } from '../utils/errors';
import jwt from 'jsonwebtoken';
import { logAuditoria, LogData } from './auditoria.service'; 
import type { Role } from './rol.service'; 

interface UserLoginData {
    usuario_id: number;
    nombre_usuario_login: string;
    nombres_completos_persona: string;
    apellidos_completos_persona: string;
    email_corporativo: string;
    empresa_id_predeterminada: number;
    roles: Role[]; 
}

// --- REEMPLAZA ESTA FUNCIÓN COMPLETA ---
export const loginUser = async (nombre_usuario_login: string, contrasena: string) => {
    // Inicializamos la data de auditoría
    let logData: LogData = { 
        usuario_id_accion: null, 
        nombre_usuario_accion: nombre_usuario_login,
        tipo_evento: 'LOGIN_FALLIDO', 
        tabla_afectada: 'Usuarios',
        registro_afectado_id: 'N/A', 
        modulo_sistema_origen: 'Autenticación',
        exito_operacion: false
    };

    try {
        // 1. Buscamos al usuario y su contraseña encriptada en una sola consulta
        const userQuery = await pool.query(
            'SELECT usuario_id, contrasena, activo FROM public.usuarios WHERE nombre_usuario_login = $1', 
            [nombre_usuario_login]
        );

        if (userQuery.rows.length === 0) {
            logData.mensaje_error_si_fallo = 'Usuario no encontrado.';
            await logAuditoria(logData); 
            throw new HttpError(401, 'Usuario o contraseña incorrectos.');
        }

        const user = userQuery.rows[0];
        logData.usuario_id_accion = user.usuario_id;
        logData.registro_afectado_id = user.usuario_id.toString();

        if (!user.activo) {
            logData.mensaje_error_si_fallo = 'La cuenta de usuario está desactivada.';
            await logAuditoria(logData); 
            throw new HttpError(403, 'La cuenta de usuario está desactivada.');
        }

        if (!user.contrasena) {
            logData.mensaje_error_si_fallo = 'El usuario no tiene una contraseña configurada en la base de datos.';
            await logAuditoria(logData);
            throw new HttpError(500, 'Error de configuración de usuario.');
        }
        
        // 2. Comparamos la contraseña proporcionada con el hash guardado usando bcrypt
        const passwordIsValid = await bcrypt.compare(contrasena, user.contrasena);

        if (!passwordIsValid) {
            logData.mensaje_error_si_fallo = 'Contraseña incorrecta.';
            await logAuditoria(logData); 
            throw new HttpError(401, 'Usuario o contraseña incorrectos.');
        }

        // 3. Si todo es correcto, obtenemos el perfil completo del usuario (con roles y permisos)
        const userProfile = await getUserProfile(user.usuario_id);
        if (!userProfile) {
            throw new HttpError(404, 'No se pudo cargar el perfil del usuario después del login.');
        }

        // 4. Generamos el token JWT
        const token = jwt.sign(
            { 
                usuario_id: userProfile.id,
                nombre_usuario: `${userProfile.nombres} ${userProfile.apellidos}`,
                empresa_id: userProfile.empresa_id,
                roles: userProfile.roles // Pasamos la estructura completa de roles y permisos
            },
            process.env.JWT_SECRET as string,
            { expiresIn: '8h' }
        );

        // 5. Registramos el login exitoso en la auditoría
        logData.tipo_evento = 'LOGIN_EXITOSO';
        logData.exito_operacion = true;
        await logAuditoria(logData);

        return { token, usuario: userProfile };

    } catch (error) {
        // Si el error ya fue manejado y es un HttpError, simplemente lo relanzamos.
        if (error instanceof HttpError) {
            throw error;
        }
        // Si es un error inesperado, lo registramos y lanzamos uno genérico.
        console.error("Error inesperado en loginUser:", error);
        logData.mensaje_error_si_fallo = 'Error inesperado en el servidor.';
        await logAuditoria(logData);
        throw new HttpError(500, 'Error interno del servidor.');
    }
};

export const getUserProfile = async (userId: number) => {
    try {
        const userQuery = await pool.query(`
            SELECT 
                u.usuario_id, 
                u.nombre_usuario_login, 
                u.nombres_completos_persona, 
                u.apellidos_completos_persona, 
                u.email_corporativo, 
                u.empresa_id_predeterminada,
                COALESCE(
                    (SELECT json_agg(
                        json_build_object(
                            'rol_id', r.rol_id, 
                            'nombre_rol', r.nombre_rol,
                            'permisos', COALESCE(
                                (SELECT json_agg(json_build_object('codigo_permiso', p.codigo_permiso)) 
                                 FROM public.rolpermisos rp 
                                 JOIN public.permisos p ON rp.permiso_id = p.permiso_id 
                                 WHERE rp.rol_id = r.rol_id), 
                                '[]'::json
                            )
                        )
                    )
                     FROM public.usuarioroles ur
                     JOIN public.roles r ON ur.rol_id = r.rol_id
                     WHERE ur.usuario_id = u.usuario_id),
                    '[]'::json
                ) as roles
            FROM Usuarios u
            WHERE u.usuario_id = $1
        `, [userId]);

        if (userQuery.rows.length === 0) {
            return null;
        }

        // Renombramos las propiedades para que coincidan con la interfaz UserData del frontend
        const user = userQuery.rows[0];
        return {
            id: user.usuario_id,
            nombres: user.nombres_completos_persona,
            apellidos: user.apellidos_completos_persona,
            email: user.email_corporativo,
            empresa_id: user.empresa_id_predeterminada,
            roles: user.roles
        };

    } catch (error) {
        console.error("Error al obtener el perfil del usuario:", error);
        throw new Error('Error al obtener el perfil del usuario.');
    }
};