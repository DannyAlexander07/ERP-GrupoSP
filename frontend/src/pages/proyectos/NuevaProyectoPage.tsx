import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
    createProyecto, 
    fetchNextProyectoCode, // <-- 1. IMPORTAMOS LA NUEVA FUNCIÓN
    type Proyecto, 
} from '../../services/proyectoService';
import { fetchClientes, type Cliente } from '../../services/clienteService';
import { fetchAllMonedas, type Moneda } from '../../services/monedaService';
import { fetchCentrosCosto, type CentroCosto } from '../../services/centroCostoService';
import { showSuccessToast, showErrorAlert, showValidationErrorAlert } from '../../services/notificationService';
import '../../styles/TablePage.css'; 

// --- Interfaces (Replicadas para autonomía del componente) ---
interface FormErrors { [key: string]: string; }

interface User { 
    usuario_id: number;
    nombre_usuario_login: string;
    nombres_completos_persona: string;
    apellidos_completos_persona: string;
    email_corporativo: string;
    empresa_id_predeterminada: number;
}

interface PagedUsersResponse {
    records: User[];
    total_records: number;
    total_pages: number;
    current_page: number;
}


const NuevaProyectoPage = () => {
    const navigate = useNavigate();

    // --- Estados del componente ---
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [usuarios, setUsuarios] = useState<User[]>([]);
    const [monedas, setMonedas] = useState<Moneda[]>([]);
    const [centrosCosto, setCentrosCosto] = useState<CentroCosto[]>([]);
    const [formErrors, setFormErrors] = useState<FormErrors>({});
    const [loading, setLoading] = useState(true);

    const tiposProyecto = ['Diseño Web', 'Campaña Digital', 'Desarrollo Software', 'Consultoría', 'Otros'];
    const estadosProyecto = ['Planificado', 'En Curso', 'Completado', 'Pausado', 'Cancelado'];

    const initialFormData: Partial<Proyecto> = {
        cliente_id: undefined,
        nombre_proyecto_campaña: '',
        codigo_proyecto_interno: '',
        descripcion_proyecto: '',
        tipo_proyecto: tiposProyecto[0] || '',
        fecha_inicio_proyectada: new Date().toISOString().split('T')[0],
        fecha_fin_proyectada: '',
        fecha_inicio_real: '',
        fecha_fin_real: '',
        moneda_id_presupuesto: undefined, 
        monto_presupuestado_ingresos: 0,
        monto_presupuestado_costos: 0,
        usuario_id_responsable_proyecto: undefined, 
        estado_proyecto: estadosProyecto[0] || 'Planificado',
        centro_costo_id_asociado: undefined, 
    };
    const [formData, setFormData] = useState<Partial<Proyecto>>(initialFormData);

    // --- Función local para obtener usuarios ---
    const fetchUsersLocal = async (page: number, limit: number): Promise<PagedUsersResponse> => {
        try {
            const token = localStorage.getItem('user_token');
            const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
            const response = await axios.get('http://localhost:4000/api/auth/users', {
                params,
                headers: { Authorization: `Bearer ${token}` },
            }); 
            return response.data;
        } catch (error) { 
            if (axios.isAxiosError(error) && error.response) { 
                throw new Error(error.response.data.message || 'Error al obtener usuarios.');
            }
            throw new Error('No se pudo conectar con el servidor para obtener usuarios.');
        }
    };

    // --- Carga de datos iniciales y el nuevo código ---
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                setLoading(true);
                // 2. Usamos Promise.all para cargar todo en paralelo
                const [
                    clientesData, 
                    usuariosData, 
                    monedasData, 
                    centrosCostoData, 
                    nextCode
                ] = await Promise.all([
                    fetchClientes(1, 1000, {}),
                    fetchUsersLocal(1, 1000),
                    fetchAllMonedas(),
                    fetchCentrosCosto(1, 1000, {}),
                    fetchNextProyectoCode() // <-- Llamada a la nueva función
                ]);

                setClientes(clientesData.records);
                setUsuarios(usuariosData.records);
                setMonedas(monedasData);
                setCentrosCosto(centrosCostoData.records);

                // 3. Establecemos los valores por defecto en el formulario, incluyendo el CÓDIGO
                setFormData(prev => ({
                    ...prev,
                    codigo_proyecto_interno: nextCode, // <-- Asignamos el código
                    cliente_id: prev.cliente_id || (clientesData.records.length > 0 ? clientesData.records[0].cliente_id : undefined),
                    usuario_id_responsable_proyecto: prev.usuario_id_responsable_proyecto || (usuariosData.records.length > 0 ? usuariosData.records[0].usuario_id : undefined),
                    moneda_id_presupuesto: prev.moneda_id_presupuesto || (monedasData.length > 0 ? monedasData[0].moneda_id : undefined),
                }));

                if (clientesData.records.length === 0) showErrorAlert('Advertencia: No hay clientes registrados.');

            } catch (error) {
                if (error instanceof Error) showErrorAlert(`Error al cargar datos iniciales: ${error.message}`);
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, []);

    const validateForm = (): FormErrors => {
        const errors: FormErrors = {};
        if (!formData.cliente_id) errors.cliente_id = "El cliente es obligatorio.";
        if (!formData.nombre_proyecto_campaña?.trim()) errors.nombre_proyecto_campaña = "El nombre del proyecto es obligatorio.";
        if (!formData.tipo_proyecto?.trim()) errors.tipo_proyecto = "El tipo de proyecto es obligatorio.";
        if (!formData.fecha_inicio_proyectada) errors.fecha_inicio_proyectada = "La fecha de inicio proyectada es obligatoria.";
        if (!formData.estado_proyecto?.trim()) errors.estado_proyecto = "El estado del proyecto es obligatorio.";
        setFormErrors(errors);
        return errors;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        let inputValue: string | number | boolean | undefined = value;

        if (type === 'checkbox') {
            inputValue = (e.target as HTMLInputElement).checked;
        } else if (name.includes('monto') || name.includes('_id')) { 
            inputValue = value === '' ? undefined : Number(value); 
        }
        
        setFormData(prev => ({ ...prev, [name]: inputValue }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const errors = validateForm();
        if (Object.keys(errors).length > 0) {
            showValidationErrorAlert(errors);
            return;
        }

        try {
            await createProyecto(formData as Proyecto);
            showSuccessToast('¡Proyecto creado con éxito!');
            navigate('/proyectos');
        } catch (error) {
            if (error instanceof Error) showErrorAlert(error.message);
        }
    };

    if (loading) return <div className="loading-spinner">Cargando...</div>;

    return (
        <div className="table-page-container">
            <div className="table-page-header">
                <h1>Nuevo Proyecto</h1>
            </div>
            <form onSubmit={handleSubmit} className="modal-form" noValidate>
                <div className="form-grid">
                    <div className="form-group floating-label">
                        <input 
                            id="codigo_proyecto_interno" 
                            type="text" 
                            name="codigo_proyecto_interno" 
                            value={formData.codigo_proyecto_interno || ''} 
                            onChange={handleChange} 
                            disabled={true} // <-- 4. CAMPO DESHABILITADO
                            placeholder=" " 
                        />
                        <label htmlFor="codigo_proyecto_interno">Código Interno</label>
                    </div>

                    <div className="form-group floating-label">
                        <input id="nombre_proyecto_campaña" type="text" name="nombre_proyecto_campaña" value={formData.nombre_proyecto_campaña || ''} onChange={handleChange} placeholder=" " required />
                        <label htmlFor="nombre_proyecto_campaña">Nombre de Proyecto / Campaña</label>
                        {formErrors.nombre_proyecto_campaña && <span className="error-text">{formErrors.nombre_proyecto_campaña}</span>}
                    </div>

                    <div className="form-group floating-label">
                        <select id="cliente_id" name="cliente_id" value={formData.cliente_id || ''} onChange={handleChange} required>
                            <option value="">Seleccione Cliente</option>
                            {clientes.map(cliente => (
                                <option key={cliente.cliente_id} value={cliente.cliente_id}>{cliente.razon_social_o_nombres}</option>
                            ))}
                        </select>
                        <label htmlFor="cliente_id">Cliente</label>
                        {formErrors.cliente_id && <span className="error-text">{formErrors.cliente_id}</span>}
                    </div>

                    <div className="form-group floating-label">
                        <select id="tipo_proyecto" name="tipo_proyecto" value={formData.tipo_proyecto || ''} onChange={handleChange} required>
                            <option value="">Seleccione Tipo</option>
                            {tiposProyecto.map(tipo => (
                                <option key={tipo} value={tipo}>{tipo}</option>
                            ))}
                        </select>
                        <label htmlFor="tipo_proyecto">Tipo de Proyecto</label>
                        {formErrors.tipo_proyecto && <span className="error-text">{formErrors.tipo_proyecto}</span>}
                    </div>

                    <div className="form-group floating-label full-width">
                        <textarea id="descripcion_proyecto" name="descripcion_proyecto" value={formData.descripcion_proyecto || ''} onChange={handleChange} rows={2} placeholder=" "></textarea>
                        <label htmlFor="descripcion_proyecto">Descripción del Proyecto</label>
                    </div>

                    <div className="form-group floating-label">
                        <input id="fecha_inicio_proyectada" type="date" name="fecha_inicio_proyectada" value={formData.fecha_inicio_proyectada || ''} onChange={handleChange} placeholder=" " required />
                        <label htmlFor="fecha_inicio_proyectada">Fecha Inicio Proyectada</label>
                        {formErrors.fecha_inicio_proyectada && <span className="error-text">{formErrors.fecha_inicio_proyectada}</span>}
                    </div>

                    <div className="form-group floating-label">
                        <input id="fecha_fin_proyectada" type="date" name="fecha_fin_proyectada" value={formData.fecha_fin_proyectada || ''} onChange={handleChange} placeholder=" " />
                        <label htmlFor="fecha_fin_proyectada">Fecha Fin Proyectada</label>
                    </div>

                    <div className="form-group floating-label">
                        <select id="moneda_id_presupuesto" name="moneda_id_presupuesto" value={formData.moneda_id_presupuesto || ''} onChange={handleChange}>
                            <option value="">Seleccione Moneda</option>
                            {monedas.map(moneda => (
                                <option key={moneda.moneda_id} value={moneda.moneda_id}>{moneda.nombre_moneda}</option>
                            ))}
                        </select>
                        <label htmlFor="moneda_id_presupuesto">Moneda Presupuesto</label>
                    </div>

                    <div className="form-group floating-label">
                        <input id="monto_presupuestado_ingresos" type="number" step="0.01" name="monto_presupuestado_ingresos" value={formData.monto_presupuestado_ingresos ?? ''} onChange={handleChange} placeholder=" " />
                        <label htmlFor="monto_presupuestado_ingresos">Presupuesto Ingresos</label>
                    </div>

                    <div className="form-group floating-label">
                        <input id="monto_presupuestado_costos" type="number" step="0.01" name="monto_presupuestado_costos" value={formData.monto_presupuestado_costos ?? ''} onChange={handleChange} placeholder=" " />
                        <label htmlFor="monto_presupuestado_costos">Presupuesto Costos</label>
                    </div>

                    <div className="form-group floating-label">
                        <select id="usuario_id_responsable_proyecto" name="usuario_id_responsable_proyecto" value={formData.usuario_id_responsable_proyecto || ''} onChange={handleChange}>
                            <option value="">Seleccione Responsable</option>
                            {usuarios.map(user => (
                                <option key={user.usuario_id} value={user.usuario_id}>{user.nombres_completos_persona} {user.apellidos_completos_persona}</option>
                            ))}
                        </select>
                        <label htmlFor="usuario_id_responsable_proyecto">Responsable del Proyecto</label>
                    </div>

                    <div className="form-group floating-label">
                        <select id="estado_proyecto" name="estado_proyecto" value={formData.estado_proyecto || ''} onChange={handleChange} required>
                            <option value="">Seleccione Estado</option>
                            {estadosProyecto.map(estado => (
                                <option key={estado} value={estado}>{estado}</option>
                            ))}
                        </select>
                        <label htmlFor="estado_proyecto">Estado del Proyecto</label>
                        {formErrors.estado_proyecto && <span className="error-text">{formErrors.estado_proyecto}</span>}
                    </div>

                    <div className="form-group floating-label">
                        <select id="centro_costo_id_asociado" name="centro_costo_id_asociado" value={formData.centro_costo_id_asociado || ''} onChange={handleChange}>
                            <option value="">Seleccione Centro de Costo</option>
                            {centrosCosto.map(cc => (
                                <option key={cc.centro_costo_id} value={cc.centro_costo_id}>{cc.nombre_centro_costo}</option>
                            ))}
                        </select>
                        <label htmlFor="centro_costo_id_asociado">Centro de Costo Asociado</label>
                    </div>
                </div>

                <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={() => navigate('/proyectos')}>Cancelar</button>
                    <button type="submit" className="btn-primary">Crear Proyecto</button>
                </div>
            </form>
        </div>
    );
};

export default NuevaProyectoPage;