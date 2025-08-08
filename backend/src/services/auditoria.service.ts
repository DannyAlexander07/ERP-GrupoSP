// Archivo: backend/src/services/auditoria.service.ts (VERSIÓN FINAL Y CORREGIDA)
import pool from '../config/database';

export interface LogData {
    usuario_id_accion: number | null; 
    nombre_usuario_accion: string;
    tipo_evento: 'CREACION' | 'MODIFICACION' | 'ELIMINACION_LOGICA' | 'LOGIN_EXITOSO' | 'LOGIN_FALLIDO';
    tabla_afectada: string;
    registro_afectado_id: string;
    descripcion_detallada_evento?: string | null; // <-- CORRECCIÓN AQUÍ
    valor_anterior?: string | null; // <-- CORRECCIÓN AQUÍ
    valor_nuevo?: string | null; // <-- CORRECCIÓN AQUÍ
    direccion_ip_origen?: string | null; // <-- CORRECCIÓN AQUÍ
    modulo_sistema_origen?: string | null; // <-- CORRECCIÓN AQUÍ
    exito_operacion?: boolean; 
    mensaje_error_si_fallo?: string | null; // <-- CORRECCIÓN AQUÍ
}

export const logAuditoria = async (data: LogData) => {
    const {
        usuario_id_accion, 
        nombre_usuario_accion, 
        tipo_evento, 
        tabla_afectada,
        registro_afectado_id, 
        descripcion_detallada_evento, 
        valor_anterior, 
        valor_nuevo,
        direccion_ip_origen, 
        modulo_sistema_origen, 
        exito_operacion = true, 
        mensaje_error_si_fallo 
    } = data;

    const finalDescripcion = descripcion_detallada_evento || 
                             `${tipo_evento} en ${tabla_afectada} (ID: ${registro_afectado_id}) por ${nombre_usuario_accion}`;

    try {
        await pool.query(
            `INSERT INTO RegistrosAuditoria (
                usuario_id_accion, 
                nombre_usuario_accion, 
                tipo_evento, 
                tabla_afectada, 
                registro_afectado_id, 
                descripcion_detallada_evento, 
                valor_anterior, 
                valor_nuevo, 
                direccion_ip_origen, 
                modulo_sistema_origen, 
                exito_operacion, 
                mensaje_error_si_fallo
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
                usuario_id_accion, 
                nombre_usuario_accion, 
                tipo_evento, 
                tabla_afectada, 
                registro_afectado_id, 
                finalDescripcion, 
                valor_anterior, 
                valor_nuevo,
                direccion_ip_origen, 
                modulo_sistema_origen, 
                exito_operacion, 
                mensaje_error_si_fallo 
            ]
        );
    } catch (error) {
        console.error("Error crítico al registrar en auditoría:", error);
    }
};