// Archivo: backend/src/services/cliente.service.ts (VERSIÓN SIN CCI CLIENTE)
import pool from '../config/database';
import { logAuditoria } from './auditoria.service';

// Interfaz definida localmente para evitar errores de importación
export interface Cliente {
    cliente_id?: number;
    codigo_cliente_interno?: string;
    razon_social_o_nombres: string;
    nombre_comercial?: string;
    tipo_documento_identidad: string;
    numero_documento_identidad: string;
    direccion_fiscal_completa?: string;
    email_principal_facturacion?: string;
    telefono_principal?: string;
    estado_cliente?: string;
    empresa_id_vinculada: number;
    condicion_pago_id_predeterminada?: number;
    moneda_id_predeterminada?: number;
    linea_credito_aprobada?: number;
    contacto_principal_nombre?: string;
    contacto_principal_cargo?: string;
    contacto_principal_email?: string;
    contacto_principal_telefono?: string;
    sector_industrial?: string;
    observaciones_generales?: string;
    // ¡CAMPO CCI ELIMINADO DE AQUÍ!
    // codigo_cuenta_interbancaria_cliente?: string; 
    usuario_creacion_id?: number;
    fecha_creacion?: string;
    usuario_modificacion_id?: number;
    fecha_modificacion?: string;
}

export interface PagedResult<T> {
    records: T[];
    total_records: number;
    total_pages: number;
    current_page: number;
}

// --- FUNCIÓN RECONSTRUIDA PARA SER MÁS SEGURA ---
export const getAllClientes = async (empresaId: number, page: number, limit: number, filters: any): Promise<PagedResult<any>> => {
    // Lista blanca de columnas permitidas para filtrar para evitar inyección SQL
    const allowedFilterKeys = ['codigo_cliente_interno', 'razon_social_o_nombres', 'numero_documento_identidad'];

    let query = `
        SELECT 
            c.cliente_id, c.codigo_cliente_interno, c.razon_social_o_nombres, 
            c.numero_documento_identidad, c.telefono_principal, c.estado_cliente,
            u.nombres_completos_persona as creado_por
        FROM clientes c
        LEFT JOIN usuarios u ON c.usuario_creacion_id = u.usuario_id
        WHERE c.empresa_id_vinculada = $1
    `;
    
    const countQueryBase = `SELECT COUNT(*) FROM clientes c WHERE c.empresa_id_vinculada = $1`;

    const queryParams: any[] = [empresaId];
    let whereClause = '';
    let paramIndex = 2;

    Object.keys(filters).forEach(key => {
        // Solo añadimos el filtro si la clave está en nuestra lista blanca y tiene un valor
        if (allowedFilterKeys.includes(key) && filters[key]) {
            whereClause += ` AND c.${key}::text ILIKE $${paramIndex}`; 
            queryParams.push(`%${filters[key]}%`);
            paramIndex++;
        }
    });

    const finalQuery = query + whereClause + ' ORDER BY c.cliente_id DESC';
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


// --- FUNCIÓN DE EXPORTACIÓN ---
export const getAllClientesForExport = async (empresaId: number, filters: any): Promise<any[]> => {
    const allowedFilterKeys = ['codigo_cliente_interno', 'razon_social_o_nombres', 'numero_documento_identidad'];

    let query = `
        SELECT 
            c.codigo_cliente_interno as "Código Interno", 
            c.razon_social_o_nombres as "Razón Social",
            c.nombre_comercial as "Nombre Comercial",
            c.tipo_documento_identidad as "Tipo Doc.",
            c.numero_documento_identidad as "Nro. Documento",
            c.direccion_fiscal_completa as "Dirección Fiscal",
            c.email_principal_facturacion as "Email Facturación",
            c.telefono_principal as "Teléfono Principal",
            cp.descripcion_condicion as "Condición de Pago",
            m.nombre_moneda as "Moneda",
            c.linea_credito_aprobada as "Línea de Crédito",
            c.contacto_principal_nombre as "Nombre Contacto",
            c.contacto_principal_cargo as "Cargo Contacto",
            c.contacto_principal_email as "Email Contacto",
            c.contacto_principal_telefono as "Teléfono Contacto",
            c.sector_industrial as "Sector Industrial",
            c.estado_cliente as "Estado",
            c.observaciones_generales as "Observaciones",
            uc.nombres_completos_persona as "Creado Por",
            TO_CHAR(c.fecha_creacion, 'DD/MM/YYYY HH24:MI:SS') as "Fecha Creación",
            um.nombres_completos_persona as "Modificado Por",
            TO_CHAR(c.fecha_modificacion, 'DD/MM/YYYY HH24:MI:SS') as "Fecha Modificación"
        FROM clientes c
        LEFT JOIN usuarios uc ON c.usuario_creacion_id = uc.usuario_id
        LEFT JOIN usuarios um ON c.usuario_modificacion_id = um.usuario_id
        LEFT JOIN condicionespago cp ON c.condicion_pago_id_predeterminada = cp.condicion_pago_id
        LEFT JOIN monedas m ON c.moneda_id_predeterminada = m.moneda_id
        WHERE c.empresa_id_vinculada = $1
    `;
    
    const queryParams: any[] = [empresaId];
    let whereClause = '';
    let paramIndex = 2;

    Object.keys(filters).forEach(key => {
        if (allowedFilterKeys.includes(key) && filters[key]) {
            whereClause += ` AND c.${key}::text ILIKE $${paramIndex}`; 
            queryParams.push(`%${filters[key]}%`);
            paramIndex++;
        }
    });

    const finalQuery = query + whereClause + ' ORDER BY c.cliente_id DESC';
    
    const result = await pool.query(finalQuery, queryParams);
    return result.rows;
};


export const getNextClienteCode = async (empresaId: number): Promise<string> => {
    const prefix = 'SP';
    const query = `
        SELECT codigo_cliente_interno FROM clientes 
        WHERE empresa_id_vinculada = $1 AND codigo_cliente_interno LIKE $2
        ORDER BY codigo_cliente_interno DESC LIMIT 1
    `;
    const result = await pool.query(query, [empresaId, `${prefix}-%`]);

    if (result.rows.length > 0) {
        const lastCode = result.rows[0].codigo_cliente_interno;
        const lastNumberStr = lastCode.split('-')[1];
        if (lastNumberStr && !isNaN(parseInt(lastNumberStr, 10))) {
            const lastNumber = parseInt(lastNumberStr, 10);
            const nextNumber = lastNumber + 1;
            return `${prefix}-${nextNumber.toString().padStart(3, '0')}`;
        }
    }
    return `${prefix}-001`;
};


export const getClienteById = async (clienteId: number, empresaId: number) => {
    const query = `
        SELECT 
            c.*,
            uc.nombres_completos_persona as creado_por,
            um.nombres_completos_persona as modificado_por
        FROM clientes c
        LEFT JOIN usuarios uc ON c.usuario_creacion_id = uc.usuario_id
        LEFT JOIN usuarios um ON c.usuario_modificacion_id = um.usuario_id
        WHERE c.cliente_id = $1 AND c.empresa_id_vinculada = $2
    `;
    const result = await pool.query(query, [clienteId, empresaId]);
    return result.rows[0] || null;
};


export const createCliente = async (cliente: Cliente, usuarioId: number, nombreUsuario: string) => {
    const { 
        razon_social_o_nombres, tipo_documento_identidad, numero_documento_identidad, empresa_id_vinculada,
        codigo_cliente_interno, nombre_comercial, direccion_fiscal_completa, email_principal_facturacion,
        telefono_principal, linea_credito_aprobada, contacto_principal_nombre, contacto_principal_cargo,
        contacto_principal_email, contacto_principal_telefono, sector_industrial, observaciones_generales,
        condicion_pago_id_predeterminada, moneda_id_predeterminada
        // ¡CAMPO CCI ELIMINADO DE AQUÍ!
        // codigo_cuenta_interbancaria_cliente 
    } = cliente;
    
    try { 
        const result = await pool.query(
            `INSERT INTO clientes (
                razon_social_o_nombres, tipo_documento_identidad, numero_documento_identidad, empresa_id_vinculada, estado_cliente,
                codigo_cliente_interno, nombre_comercial, direccion_fiscal_completa, email_principal_facturacion,
                telefono_principal, linea_credito_aprobada, contacto_principal_nombre, contacto_principal_cargo,
                contacto_principal_email, contacto_principal_telefono, sector_industrial, observaciones_generales,
                condicion_pago_id_predeterminada, moneda_id_predeterminada,
                usuario_creacion_id, fecha_creacion
               ) 
               VALUES ($1, $2, $3, $4, 'Activo', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW()) RETURNING *`, // Se ajusta el número de parámetros
            [
                razon_social_o_nombres, tipo_documento_identidad, numero_documento_identidad, empresa_id_vinculada,
                codigo_cliente_interno || null, nombre_comercial || null, direccion_fiscal_completa || null, email_principal_facturacion || null,
                telefono_principal || null, linea_credito_aprobada || 0, contacto_principal_nombre || null, contacto_principal_cargo || null,
                contacto_principal_email || null, contacto_principal_telefono || null, sector_industrial || null, observaciones_generales || null,
                condicion_pago_id_predeterminada || null, moneda_id_predeterminada || null,
                usuarioId
            ]
        );
        const nuevoCliente = result.rows[0];

        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'CREACION',
            tabla_afectada: 'clientes', 
            registro_afectado_id: nuevoCliente.cliente_id.toString(),
            valor_nuevo: JSON.stringify(nuevoCliente),
            exito_operacion: true, 
            modulo_sistema_origen: 'Clientes'
        });

        return nuevoCliente;
    } catch (error: any) { 
        console.error("Error al crear cliente:", error);
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'CREACION',
            tabla_afectada: 'clientes', 
            registro_afectado_id: cliente.cliente_id?.toString() || 'N/A',
            valor_nuevo: JSON.stringify(cliente),
            exito_operacion: false, 
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Clientes'
        });
        throw error; 
    }
};


export const updateCliente = async (clienteId: number, clienteData: Partial<Cliente>, usuarioId: number, nombreUsuario: string) => {
    const valorAnterior = await getClienteById(clienteId, clienteData.empresa_id_vinculada!);
    if (!valorAnterior) {
        await logAuditoria({
            usuario_id_accion: usuarioId,
            nombre_usuario_accion: nombreUsuario,
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'clientes',
            registro_afectado_id: clienteId.toString(),
            descripcion_detallada_evento: `Intento de actualización de cliente no encontrado (ID: ${clienteId}).`,
            exito_operacion: false,
            mensaje_error_si_fallo: 'Cliente no encontrado para actualizar.',
            modulo_sistema_origen: 'Clientes'
        });
        throw new Error('Cliente no encontrado');
    }

    try { 
        const dataToUpdate = { ...valorAnterior, ...clienteData };

        const result = await pool.query(
            `UPDATE clientes SET
                razon_social_o_nombres = $1, nombre_comercial = $2, tipo_documento_identidad = $3,
                numero_documento_identidad = $4, direccion_fiscal_completa = $5, email_principal_facturacion = $6,
                telefono_principal = $7, condicion_pago_id_predeterminada = $8, moneda_id_predeterminada = $9,
                linea_credito_aprobada = $10, contacto_principal_nombre = $11, contacto_principal_cargo = $12,
                contacto_principal_email = $13, contacto_principal_telefono = $14, sector_industrial = $15,
                observaciones_generales = $16, estado_cliente = $17, usuario_modificacion_id = $18, fecha_modificacion = NOW()
              WHERE cliente_id = $19 RETURNING *`, // Se ajusta el número de parámetros
            [
                dataToUpdate.razon_social_o_nombres, dataToUpdate.nombre_comercial, dataToUpdate.tipo_documento_identidad,
                dataToUpdate.numero_documento_identidad, dataToUpdate.direccion_fiscal_completa, dataToUpdate.email_principal_facturacion,
                dataToUpdate.telefono_principal, dataToUpdate.condicion_pago_id_predeterminada, dataToUpdate.moneda_id_predeterminada,
                dataToUpdate.linea_credito_aprobada, dataToUpdate.contacto_principal_nombre, dataToUpdate.contacto_principal_cargo,
                dataToUpdate.contacto_principal_email, dataToUpdate.contacto_principal_telefono, dataToUpdate.sector_industrial,
                dataToUpdate.observaciones_generales, dataToUpdate.estado_cliente,
                usuarioId, clienteId
            ]
        );
        const clienteActualizado = result.rows[0];

        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'clientes', 
            registro_afectado_id: clienteId.toString(),
            valor_anterior: JSON.stringify(valorAnterior), 
            valor_nuevo: JSON.stringify(clienteActualizado),
            exito_operacion: true, 
            modulo_sistema_origen: 'Clientes'
        });

        return clienteActualizado;
    } catch (error: any) { 
        console.error("Error al actualizar cliente:", error);
        await logAuditoria({
            usuario_id_accion: usuarioId, 
            nombre_usuario_accion: nombreUsuario, 
            tipo_evento: 'MODIFICACION',
            tabla_afectada: 'clientes', 
            registro_afectado_id: clienteId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify(clienteData),
            exito_operacion: false, 
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Clientes'
        });
        throw error; 
    }
};
export const deleteCliente = async (clienteId: number, empresaId: number, usuarioId: number, nombreUsuario: string) => {
    const valorAnterior = await getClienteById(clienteId, empresaId);
    if (!valorAnterior) {
        await logAuditoria({
            usuario_id_accion: usuarioId,
            nombre_usuario_accion: nombreUsuario,
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'clientes',
            registro_afectado_id: clienteId.toString(),
            descripcion_detallada_evento: `Intento de eliminación lógica de cliente no encontrado (ID: ${clienteId}).`,
            exito_operacion: false,
            mensaje_error_si_fallo: 'Cliente no encontrado para desactivar.',
            modulo_sistema_origen: 'Clientes'
        });
        throw new Error('Cliente no encontrado');
    }

    try { 
        const result = await pool.query(
            `UPDATE clientes SET 
                estado_cliente = 'Inactivo',
                usuario_modificacion_id = $1,
                fecha_modificacion = NOW()
              WHERE cliente_id = $2 AND empresa_id_vinculada = $3`,
            [usuarioId, clienteId, empresaId]
        );

        await logAuditoria({
            usuario_id_accion: usuarioId,
            nombre_usuario_accion: nombreUsuario,
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'clientes',
            registro_afectado_id: clienteId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify({ ...valorAnterior, estado_cliente: 'Inactivo' }),
            exito_operacion: true, 
            modulo_sistema_origen: 'Clientes'
        });

        return (result.rowCount ?? 0) > 0;
    } catch (error: any) { 
        console.error("Error al desactivar cliente:", error);
        await logAuditoria({
            usuario_id_accion: usuarioId,
            nombre_usuario_accion: nombreUsuario,
            tipo_evento: 'ELIMINACION_LOGICA',
            tabla_afectada: 'clientes',
            registro_afectado_id: clienteId.toString(),
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify({ ...valorAnterior, estado_cliente: 'ERROR_NO_ACTUALIZADO' }),
            exito_operacion: false, 
            mensaje_error_si_fallo: error.message,
            modulo_sistema_origen: 'Clientes'
        });
        throw error; 
    }
};