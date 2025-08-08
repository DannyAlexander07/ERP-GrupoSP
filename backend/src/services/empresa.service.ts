// Archivo: backend/src/services/empresa.service.ts (ACTUALIZADO con CAMPOS DE AUDITORÍA)
import pool from '../config/database';
import { logAuditoria } from './auditoria.service';

// ¡NUEVAS IMPORTACIONES! (Axios y sus tipos para el interceptor)
import axios, { AxiosRequestConfig, AxiosError } from 'axios'; 
import type { AxiosRequestHeaders } from 'axios'; 
import type { UsuarioFilters } from './usuario.service'; // Para tipar los filters de usuario si getUsuarioById lo usa

// Interfaz para la respuesta paginada (reutilizable)
export interface PagedResult<T> {
    records: T[];
    total_records: number;
    total_pages: number;
    current_page: number;
}

// Interfaz que representa la tabla Empresas (¡ACTUALIZADA CON AUDITORÍA!)
export interface Empresa {
    empresa_id?: number;
    nombre_empresa: string;
    alias_empresa?: string;
    numero_identificacion_fiscal: string;
    direccion_fiscal_completa?: string;
    telefono_contacto?: string;
    email_contacto?: string;
    representante_legal_nombre?: string;
    fecha_inicio_actividades?: string;
    logo_url?: string;
    activa?: boolean;
    // fecha_creacion_registro TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, (Se mapeará a fecha_creacion en UI)
    // usuario_creacion_registro VARCHAR(100) (Ignorado si usamos usuario_creacion_id)

    // ¡CAMPOS DE AUDITORÍA AÑADIDOS EN LA INTERFAZ!
    usuario_creacion_id?: number; 
    fecha_creacion?: string; // Mapeado de fecha_creacion_registro en backend SQL
    usuario_modificacion_id?: number;
    fecha_modificacion?: string;

    // Campos adicionales para JOINs
    creado_por?: string; // Nombre del usuario creador
    modificado_por?: string; // Nombre del usuario modificador
}

// Filtros para empresas (sin cambios)
export interface EmpresaFilters {
    [key: string]: string | boolean | undefined; 
}

const API_URL = 'http://localhost:4000/api/empresas'; 

const apiClient = axios.create({
    baseURL: API_URL,
});

// Interceptor de Axios (¡APLICADA LA CORRECCIÓN GLOBAL!)
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

// Obtener todas las empresas con filtros y paginación (¡CONSULTA ACTUALIZADA!)
export const getAllEmpresas = async (page: number, limit: number, filters: EmpresaFilters): Promise<PagedResult<any>> => {
    const allowedFilterKeys = ['nombre_empresa', 'numero_identificacion_fiscal', 'activa'];
    let query = `
        SELECT 
            e.empresa_id, e.nombre_empresa, e.alias_empresa, e.numero_identificacion_fiscal,
            e.direccion_fiscal_completa, e.telefono_contacto, e.email_contacto,
            e.representante_legal_nombre, e.fecha_inicio_actividades, e.logo_url, e.activa,
            e.fecha_creacion_registro, -- Ya existía, la usamos como fecha_creacion
            u_creacion.nombres_completos_persona as creado_por,
            e.usuario_creacion_id, -- ¡NUEVO CAMPO EN SELECT!
            u_modificacion.nombres_completos_persona as modificado_por,
            e.usuario_modificacion_id, -- ¡NUEVO CAMPO EN SELECT!
            e.fecha_modificacion -- ¡NUEVO CAMPO EN SELECT!
        FROM Empresas e
        LEFT JOIN Usuarios u_creacion ON e.usuario_creacion_id = u_creacion.usuario_id
        LEFT JOIN Usuarios u_modificacion ON e.usuario_modificacion_id = u_modificacion.usuario_id
        WHERE 1 = 1 
    `;
    let countQueryBase = `SELECT COUNT(*) FROM Empresas e WHERE 1 = 1`;

    const queryParams: any[] = [];
    let paramIndex = 1;

    Object.keys(filters).forEach(_key => {
        const key = _key as keyof EmpresaFilters; 
        const value = filters[key];
        if (value !== undefined && value !== null) {
            if (key === 'activa') {
                query += ` AND e.${key} = $${paramIndex}`;
                countQueryBase += ` AND e.${key} = $${paramIndex}`;
                queryParams.push(value);
            } else {
                query += ` AND e.${key}::text ILIKE $${paramIndex}`; 
                countQueryBase += ` AND e.${key}::text ILIKE $${paramIndex}`; 
                queryParams.push(`%${value}%`);
            }
            paramIndex++;
        }
    });

    const finalQuery = query + ' ORDER BY e.nombre_empresa ASC';
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

// Obtener una empresa por su ID (¡CONSULTA ACTUALIZADA!)
export const getEmpresaById = async (empresaId: number): Promise<Empresa | null> => {
    const query = `
        SELECT 
            e.empresa_id, e.nombre_empresa, e.alias_empresa, e.numero_identificacion_fiscal,
            e.direccion_fiscal_completa, e.telefono_contacto, e.email_contacto,
            e.representante_legal_nombre, e.fecha_inicio_actividades, e.logo_url, e.activa,
            e.fecha_creacion_registro, -- Ya existía
            u_creacion.nombres_completos_persona as creado_por,
            e.usuario_creacion_id,
            u_modificacion.nombres_completos_persona as modificado_por,
            e.usuario_modificacion_id,
            e.fecha_modificacion
        FROM Empresas e
        LEFT JOIN Usuarios u_creacion ON e.usuario_creacion_id = u_creacion.usuario_id
        LEFT JOIN Usuarios u_modificacion ON e.usuario_modificacion_id = u_modificacion.usuario_id
        WHERE e.empresa_id = $1
    `;
    const result = await pool.query(query, [empresaId]);
    return result.rows[0] || null;
};

// Crear una nueva empresa (¡FUNCIÓN ACTUALIZADA!)
export const createEmpresa = async (empresa: Empresa, usuarioId: number, nombreUsuario: string): Promise<Empresa> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { 
            nombre_empresa, alias_empresa, numero_identificacion_fiscal,
            direccion_fiscal_completa, telefono_contacto, email_contacto,
            representante_legal_nombre, fecha_inicio_actividades, logo_url, activa
        } = empresa;
        
        const result = await client.query(
            `INSERT INTO Empresas (
                nombre_empresa, alias_empresa, numero_identificacion_fiscal,
                direccion_fiscal_completa, telefono_contacto, email_contacto,
                representante_legal_nombre, fecha_inicio_actividades, logo_url, activa,
                fecha_creacion_registro, usuario_creacion_id -- ¡NUEVO CAMPO EN INSERT!
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11) -- ¡NUEVO PARÁMETRO!
            RETURNING *`,
            [
                nombre_empresa, alias_empresa || null, numero_identificacion_fiscal,
                direccion_fiscal_completa || null, telefono_contacto || null, email_contacto || null,
                representante_legal_nombre || null, fecha_inicio_actividades || null, logo_url || null, activa ?? true,
                usuarioId // El usuario que crea esta empresa
            ]
        );
        const nuevaEmpresa = result.rows[0];

        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'CREACION',
            tabla_afectada: 'Empresas', 
            registro_afectado_id: nuevaEmpresa.empresa_id.toString(),
            valor_nuevo: JSON.stringify(nuevaEmpresa),
            exito_operacion: true,
            modulo_sistema_origen: 'Configuracion - Empresas'
        });

        await client.query('COMMIT');
        return nuevaEmpresa;
    } catch (error: any) {
        if (client) await client.query('ROLLBACK');
        console.error("Error al crear empresa:", error);
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'CREACION',
            tabla_afectada: 'Empresas', 
            registro_afectado_id: empresa.empresa_id?.toString() || 'N/A', 
            valor_nuevo: JSON.stringify(empresa),
            exito_operacion: false,
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Configuracion - Empresas'
        });
        throw error;
    } finally {
        if (client) client.release();
    }
};

// Actualizar una empresa (¡FUNCIÓN ACTUALIZADA!)
export const updateEmpresa = async (empresaId: number, empresaData: Partial<Empresa>, usuarioId: number, nombreUsuario: string): Promise<Empresa> => {
    let client = await pool.connect();
    const valorAnterior = await getEmpresaById(empresaId);
    if (!valorAnterior) {
        await logAuditoria({
            usuario_id_accion: usuarioId,
            nombre_usuario_accion: nombreUsuario,
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'Empresas',
            registro_afectado_id: empresaId.toString(),
            descripcion_detallada_evento: `Intento de actualización de empresa no encontrada (ID: ${empresaId}).`,
            exito_operacion: false,
            mensaje_error_si_fallo: 'Empresa no encontrada para actualizar.',
            modulo_sistema_origen: 'Configuracion - Empresas'
        });
        throw new Error('Empresa no encontrada.');
    }

    const {
        nombre_empresa, alias_empresa, numero_identificacion_fiscal,
        direccion_fiscal_completa, telefono_contacto, email_contacto,
        representante_legal_nombre, fecha_inicio_actividades, logo_url, activa
    } = empresaData;

    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(
            `UPDATE Empresas SET 
                nombre_empresa = $1, alias_empresa = $2, numero_identificacion_fiscal = $3,
                direccion_fiscal_completa = $4, telefono_contacto = $5, email_contacto = $6,
                representante_legal_nombre = $7, fecha_inicio_actividades = $8, logo_url = $9, activa = $10,
                usuario_modificacion_id = $11, fecha_modificacion = NOW() -- ¡NUEVOS CAMPOS EN UPDATE!
            WHERE empresa_id = $12
            RETURNING *`,
            [
                nombre_empresa ?? valorAnterior.nombre_empresa,
                alias_empresa ?? valorAnterior.alias_empresa,
                numero_identificacion_fiscal ?? valorAnterior.numero_identificacion_fiscal,
                direccion_fiscal_completa ?? valorAnterior.direccion_fiscal_completa,
                telefono_contacto ?? valorAnterior.telefono_contacto,
                email_contacto ?? valorAnterior.email_contacto,
                representante_legal_nombre ?? valorAnterior.representante_legal_nombre,
                fecha_inicio_actividades ?? valorAnterior.fecha_inicio_actividades,
                logo_url ?? valorAnterior.logo_url,
                activa ?? valorAnterior.activa,
                usuarioId, // Usuario que modifica
                empresaId
            ]
        );
        const empresaActualizada = result.rows[0];

        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'Empresas', 
            registro_afectado_id: empresaId.toString(),
            valor_anterior: JSON.stringify(valorAnterior), 
            valor_nuevo: JSON.stringify(empresaActualizada),
            exito_operacion: true,
            modulo_sistema_origen: 'Configuracion - Empresas'
        });

        await client.query('COMMIT');
        return empresaActualizada;
    } catch (error: any) {
        if (client) await client.query('ROLLBACK');
        console.error("Error al actualizar empresa:", error);
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'Empresas', 
            registro_afectado_id: empresaId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify(empresaData),
            exito_operacion: false,
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Configuracion - Empresas'
        });
        throw error;
    } finally {
        if (client) client.release();
    }
};

// Eliminar (desactivar) una empresa (¡FUNCIÓN ACTUALIZADA!)
export const deleteEmpresa = async (empresaId: number, usuarioId: number, nombreUsuario: string): Promise<boolean> => {
    let client = await pool.connect();
    const valorAnterior = await getEmpresaById(empresaId);
    if (!valorAnterior) {
        await logAuditoria({
            usuario_id_accion: usuarioId,
            nombre_usuario_accion: nombreUsuario,
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'Empresas',
            registro_afectado_id: empresaId.toString(),
            descripcion_detallada_evento: `Intento de desactivación de empresa no encontrada (ID: ${empresaId}).`,
            exito_operacion: false,
            mensaje_error_si_fallo: 'Empresa no encontrada para desactivar.',
            modulo_sistema_origen: 'Configuracion - Empresas'
        });
        throw new Error('Empresa no encontrada.');
    }

    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await pool.query(
            `UPDATE Empresas SET 
                activa = FALSE,
                usuario_modificacion_id = $1, fecha_modificacion = NOW()
            WHERE empresa_id = $2`,
            [usuarioId, empresaId]
        );

        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'Empresas', 
            registro_afectado_id: empresaId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify({ ...valorAnterior, activa: false }),
            exito_operacion: true,
            modulo_sistema_origen: 'Configuracion - Empresas'
        });

        await client.query('COMMIT');
        return (result.rowCount ?? 0) > 0;
    } catch (error: any) {
        if (client) await client.query('ROLLBACK');
        console.error("Error al desactivar empresa:", error);
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'Empresas', 
            registro_afectado_id: empresaId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify({ ...valorAnterior, activa: false, estado_empresa: 'ERROR_NO_DESACTIVADA' }),
            exito_operacion: false,
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Configuracion - Empresas'
        });
        throw error;
    } finally {
        if (client) client.release();
    }
};

// Exportar empresas a Excel (¡FUNCIÓN ACTUALIZADA!)
export const exportarEmpresas = async (page: number, limit: number, filters: EmpresaFilters): Promise<any[]> => { // Cambio para que use filtros y paginación si se quiere usar directamente getAllEmpresas
    const empresasToExport = await getAllEmpresas(1, 9999, filters); // Usa getAllEmpresas para obtener todos los registros con filtros
    return empresasToExport.records.map(empresa => ({
        "ID Empresa": empresa.empresa_id,
        "Nombre Empresa": empresa.nombre_empresa,
        "Alias": empresa.alias_empresa,
        "RUC/NIF": empresa.numero_identificacion_fiscal,
        "Dirección Fiscal": empresa.direccion_fiscal_completa,
        "Teléfono": empresa.telefono_contacto,
        "Email": empresa.email_contacto,
        "Representante Legal": empresa.representante_legal_nombre,
        "Fecha Inicio Actividades": empresa.fecha_inicio_actividades,
        "Logo URL": empresa.logo_url,
        "Activa": empresa.activa ? "Sí" : "No",
        "Fecha Creación": empresa.fecha_creacion_registro ? new Date(empresa.fecha_creacion_registro).toLocaleString('es-PE') : 'N/A',
        "Creado Por": empresa.creado_por || 'N/A',
        "Fecha Modificación": empresa.fecha_modificacion ? new Date(empresa.fecha_modificacion).toLocaleString('es-PE') : 'N/A',
        "Modificado Por": empresa.modificado_por || 'N/A'
    }));
};