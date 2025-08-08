// Archivo: frontend/src/pages/proyectos/ListaProyectosPage.tsx
import React, { useEffect, useState, useCallback } from 'react';
//import { useNavigate } from 'react-router-dom';
import axios from 'axios'; // Importar axios y AxiosError para la llamada directa y manejo de errores
import { 
    fetchProyectos, 
    createProyecto, 
    updateProyecto, 
    deleteProyecto, 
    fetchProyectoById,
    exportProyectos,
    type Proyecto, 
    type PagedProyectosResponse,
    type ProyectoFilters
} from '../../services/proyectoService';
import { fetchClientes, type Cliente } from '../../services/clienteService'; 
// import { fetchUsers, type User } from '../../services/authService'; // ¡ELIMINADO! No se importará desde authService
import { fetchAllMonedas, type Moneda } from '../../services/monedaService';
import { fetchCentrosCosto, type CentroCosto } from '../../services/centroCostoService';
import { showSuccessToast, showErrorAlert, showConfirmDialog, showValidationErrorAlert } from '../../services/notificationService';
import Modal from '../../components/common/Modal';
import { FileDown, FilterX, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'; //Plus al añadir el boton de agregar
import '../../styles/TablePage.css';

interface FormErrors { [key: string]: string; }

// Interfaz para el usuario (REPLICADO AQUÍ para evitar modificar auth.service.ts)
interface User { 
    usuario_id: number;
    nombre_usuario_login: string;
    nombres_completos_persona: string;
    apellidos_completos_persona: string;
    email_corporativo: string;
    empresa_id_predeterminada: number;
}

// Interfaz para la respuesta paginada de usuarios (REPLICADO AQUÍ)
interface PagedUsersResponse {
    records: User[];
    total_records: number;
    total_pages: number;
    current_page: number;
}

// Función para formatear fechas de manera legible
const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('es-PE', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

// Función auxiliar para formatear fecha a YYYY-MM-DD para input type="date"
const formatToInputDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const ListaProyectosPage = () => {
    const [proyectos, setProyectos] = useState<Proyecto[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProyecto, setSelectedProyecto] = useState<Proyecto | null>(null);
    const [isViewMode, setIsViewMode] = useState(false);
    const [formErrors, setFormErrors] = useState<FormErrors>({});
    
    //const navigate = useNavigate();

    // Datos para selects
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [usuarios, setUsuarios] = useState<User[]>([]); // Usar User[]
    const [monedas, setMonedas] = useState<Moneda[]>([]); // Monedas para presupuesto
    const [centrosCosto, setCentrosCosto] = useState<CentroCosto[]>([]); // Centros de costo

    const tiposProyecto = ['Diseño Web', 'Campaña Digital', 'Desarrollo Software', 'Consultoría', 'Otros'];
    const estadosProyecto = ['Planificado', 'En Curso', 'Completado', 'Pausado', 'Cancelado'];

    const [filters, setFilters] = useState<ProyectoFilters>({
        codigo_proyecto_interno: '',
        nombre_proyecto_campaña: '', 
        estado_proyecto: '',
        cliente_razon_social: ''
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const ROWS_PER_PAGE = 8;

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

    // Función local para obtener usuarios (REPLICADO AQUÍ)
    const fetchUsersLocal = async (page: number, limit: number, filters: Record<string, string>): Promise<PagedUsersResponse> => {
        try {
            const token = localStorage.getItem('user_token');
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
            });
            Object.keys(filters).forEach(key => {
                if (filters[key]) {
                    params.append(key, filters[key]);
                }
            });
            const response = await axios.get('http://localhost:4000/api/auth/users', { // Llamada directa a la API
                params,
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }); 
            return response.data;
        } catch (error: unknown) { 
            if (axios.isAxiosError(error) && error.response) { 
                throw new Error(error.response.data.message || 'Error al obtener usuarios.');
            }
            throw new Error('No se pudo conectar con el servidor para obtener usuarios.');
        }
    };

    // Cargar datos iniciales (clientes, usuarios, monedas, centros de costo)
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const clientesData = await fetchClientes(1, 1000, {});
                setClientes(clientesData.records);
                const usuariosData = await fetchUsersLocal(1, 1000, {}); // ¡CAMBIO AQUÍ! Usar fetchUsersLocal
                setUsuarios(usuariosData.records);
                const monedasData = await fetchAllMonedas(); 
                setMonedas(monedasData);
                const centrosCostoData = await fetchCentrosCosto(1, 1000, {}); 
                setCentrosCosto(centrosCostoData.records);

                // Ajustar initialFormData con datos cargados si existen
                setFormData(prev => {
                    const updatedData = { ...prev };
                    if (clientesData.records.length > 0 && prev.cliente_id === undefined) {
                        updatedData.cliente_id = clientesData.records[0].cliente_id;
                    }
                    if (usuariosData.records.length > 0 && prev.usuario_id_responsable_proyecto === undefined) {
                        updatedData.usuario_id_responsable_proyecto = usuariosData.records[0].usuario_id;
                    }
                    if (monedasData.length > 0 && prev.moneda_id_presupuesto === undefined) {
                        updatedData.moneda_id_presupuesto = monedasData[0].moneda_id;
                    }
                    if (centrosCostoData.records.length > 0 && prev.centro_costo_id_asociado === undefined) {
                        updatedData.centro_costo_id_asociado = centrosCostoData.records[0].centro_costo_id;
                    }
                    return updatedData;
                });

                if (clientesData.records.length === 0) showErrorAlert('Advertencia: No hay clientes registrados.');
                if (usuariosData.records.length === 0) console.warn('Advertencia: No hay usuarios registrados para asignar como responsables.');
                if (monedasData.length === 0) showErrorAlert('Advertencia: No hay monedas registradas.');
                if (centrosCostoData.records.length === 0) console.warn('Advertencia: No hay centros de costo registrados.');

            } catch (error) {
                if (error instanceof Error) showErrorAlert(`Error al cargar datos iniciales: ${error.message}`);
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, []);

    const loadProyectos = useCallback(async () => {
        try {
            setLoading(true);
            const data: PagedProyectosResponse = await fetchProyectos(currentPage, ROWS_PER_PAGE, filters);
            setProyectos(data.records);
            setTotalPages(data.total_pages);
            setTotalRecords(data.total_records);
        } catch (error) {
            if (error instanceof Error) showErrorAlert(error.message);
        } finally {
            setLoading(false);
        }
    }, [currentPage, filters]);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadProyectos();
        }, 500);
        return () => clearTimeout(timer);
    }, [loadProyectos]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
        setCurrentPage(1);
    };

    const clearFilters = () => {
        setFilters({ codigo_proyecto_interno: '', nombre_proyecto_campaña: '', estado_proyecto: '', cliente_razon_social: '' });
        setCurrentPage(1);
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) { 
            setCurrentPage(newPage);
        }
    };
    
    const handleExport = async () => {
        try {
            await exportProyectos(filters);
        } catch (error) {
            console.error(error);
        }
    };

    const handleOpenModal = async (proyecto: Proyecto | null = null, viewMode = false) => {
        setIsViewMode(viewMode);
        setFormErrors({});
        if (proyecto && proyecto.proyecto_id) {
            try {
                const fullProyectoData = await fetchProyectoById(proyecto.proyecto_id);
                if (!fullProyectoData) { 
                    showErrorAlert('No se encontró el proyecto o hubo un problema al cargarla.');
                    return;
                }
                // Convertir campos numéricos y fechas a formato input
                const processedProyectoData: Proyecto = {
                    ...fullProyectoData,
                    monto_presupuestado_ingresos: Number(fullProyectoData.monto_presupuestado_ingresos),
                    monto_presupuestado_costos: Number(fullProyectoData.monto_presupuestado_costos),
                    fecha_inicio_proyectada: formatToInputDate(fullProyectoData.fecha_inicio_proyectada),
                    fecha_fin_proyectada: formatToInputDate(fullProyectoData.fecha_fin_proyectada),
                    fecha_inicio_real: formatToInputDate(fullProyectoData.fecha_inicio_real),
                    fecha_fin_real: formatToInputDate(fullProyectoData.fecha_fin_real),
                    // Campos de auditoría
                    creado_por: fullProyectoData.creado_por,
                    fecha_creacion: fullProyectoData.fecha_creacion,
                    modificado_por: fullProyectoData.modificado_por,
                    fecha_modificacion: fullProyectoData.fecha_modificacion,
                };

                setSelectedProyecto(processedProyectoData);
                setFormData(processedProyectoData);
            } catch (error) {
                if (error instanceof Error) showErrorAlert(error.message);
                console.error("Error fetching proyecto data:", error); 
                return;
            }
        } else {
            setSelectedProyecto(null);
            setFormData(initialFormData); 
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedProyecto(null);
        setFormData(initialFormData); 
    };

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
        } else if (name.includes('monto')) {
            inputValue = value === '' ? undefined : Number(value);
        } else if (name.includes('_id')) { 
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
            if (selectedProyecto) {
                await updateProyecto(selectedProyecto.proyecto_id!, formData);
                showSuccessToast('¡Proyecto actualizado con éxito!');
            } else {
                await createProyecto(formData as Proyecto);
                showSuccessToast('¡Proyecto creado con éxito!');
            }
            handleCloseModal(); 
            loadProyectos(); 
        } catch (error) {
            if (error instanceof Error) showErrorAlert(error.message);
        }
    };

    const handleDelete = async (proyectoId: number) => {
        const result = await showConfirmDialog('¿Estás seguro?', 'El proyecto pasará a estado "Cancelado".');
        if (result.isConfirmed) {
            try {
                await deleteProyecto(proyectoId);
                showSuccessToast('Proyecto cancelado con éxito.');
                loadProyectos();
            } catch (error) {
                if (error instanceof Error) showErrorAlert(error.message);
            }
        }
    };


    if (loading) return <div className="loading-spinner">Cargando...</div>;

    return (
        <div className="table-page-container">
            <div className="table-page-header">
                <h1>Proyectos</h1>
                <div className="header-actions">
                    <button onClick={handleExport} className="btn-secondary">
                        <FileDown size={18} /> Exportar Excel
                    </button>
                    {/* <button onClick={() => handleOpenModal()} className="btn-primary">
                        <Plus size={18} /> Nuevo Proyecto
                    </button> */}
                </div>
            </div>
            
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Código Interno</th>
                            <th>Nombre de Proyecto</th>
                            <th>Cliente</th>
                            <th>Responsable</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr><tr className="filter-row">
                            <td>
                            <input
                                type="text"
                                name="codigo_proyecto_interno"
                                value={filters.codigo_proyecto_interno}
                                onChange={handleFilterChange}
                                placeholder="Buscar..."
                            />
                            </td>
                            <td>
                            <input
                                type="text"
                                name="nombre_proyecto_campaña"
                                value={filters.nombre_proyecto_campaña}
                                onChange={handleFilterChange}
                                placeholder="Buscar..."
                            />
                            </td>
                            <td>
                            <input
                                type="text"
                                name="cliente_razon_social"
                                value={filters.cliente_razon_social}
                                onChange={handleFilterChange}
                                placeholder="Buscar..."
                            />
                            </td>
                            <td></td>
                            <td>
                            <select
                                name="estado_proyecto"
                                value={filters.estado_proyecto || ''}
                                onChange={handleFilterChange}
                            >
                                <option value="">Todos</option>
                                {estadosProyecto.map(estado => (
                                <option key={estado} value={estado}>{estado}</option>
                                ))}
                            </select>
                            </td>
                            <td className="filter-actions">
                            <button
                                onClick={clearFilters}
                                className="btn-icon"
                                title="Limpiar filtros"
                            >
                                <FilterX size={18} />
                            </button>
                            </td>
                        </tr>
                        </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6}><div className="loading-spinner">Cargando...</div></td></tr>
                        ) : proyectos.length > 0 ? (
                            proyectos.map((proyecto) => (
                                <tr key={proyecto.proyecto_id}>
                                    <td>{proyecto.codigo_proyecto_interno || 'N/A'}</td>
                                    <td>{proyecto.nombre_proyecto_campaña}</td>
                                    <td>{proyecto.cliente_razon_social}</td>
                                    <td>{proyecto.usuario_responsable_nombre || 'N/A'}</td>
                                    <td>
                                        <span className={`status-badge status-${proyecto.estado_proyecto?.toLowerCase()}`}>
                                            {proyecto.estado_proyecto}
                                        </span>
                                    </td>
                                    <td>
                                        <button onClick={() => handleOpenModal(proyecto, true)} className="btn-icon" title="Ver">👁️</button>
                                        <button onClick={() => handleOpenModal(proyecto)} className="btn-icon" title="Editar">✏️</button>
                                        <button onClick={() => handleDelete(proyecto.proyecto_id!)} className="btn-icon btn-danger" title="Cancelar">🗑️</button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={6} className="no-data">No se encontraron proyectos.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="pagination-container">
                <span>Mostrando {proyectos.length} de {totalRecords} registros</span>
                <div className="pagination-controls">
                    <button onClick={() => handlePageChange(1)} disabled={currentPage === 1}><ChevronsLeft size={16} /></button>
                    <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
                    <span>Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong></span>
                    <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}><ChevronRight size={16} /></button>
                    <button onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages}><ChevronsRight size={16} /></button>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={selectedProyecto ? (isViewMode ? 'Detalle de Proyecto' : 'Editar Proyecto') : 'Nuevo Proyecto'}>
                <form onSubmit={handleSubmit} className="modal-form" noValidate>
                    <div className="form-grid">
                        {/* Datos del Proyecto */}
                        <div className="form-group floating-label">
                            <input id="codigo_proyecto_interno" type="text" name="codigo_proyecto_interno" value={formData.codigo_proyecto_interno || ''} onChange={handleChange} disabled={isViewMode || !!selectedProyecto} placeholder=" " />
                            <label htmlFor="codigo_proyecto_interno">Código Interno</label>
                        </div>
                        <div className="form-group floating-label">
                            <input id="nombre_proyecto_campaña" type="text" name="nombre_proyecto_campaña" value={formData.nombre_proyecto_campaña || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " required />
                            <label htmlFor="nombre_proyecto_campaña">Nombre de Proyecto / Campaña</label>
                            {formErrors.nombre_proyecto_campaña && <span className="error-text">{formErrors.nombre_proyecto_campaña}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <select id="cliente_id" name="cliente_id" value={formData.cliente_id || ''} onChange={handleChange} disabled={isViewMode} required>
                                <option value="">Seleccione Cliente</option>
                                {clientes.map(cliente => (
                                    <option key={cliente.cliente_id} value={cliente.cliente_id}>{cliente.razon_social_o_nombres}</option>
                                ))}
                            </select>
                            <label htmlFor="cliente_id">Cliente</label>
                            {formErrors.cliente_id && <span className="error-text">{formErrors.cliente_id}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <select id="tipo_proyecto" name="tipo_proyecto" value={formData.tipo_proyecto || ''} onChange={handleChange} disabled={isViewMode} required>
                                <option value="">Seleccione Tipo</option>
                                {tiposProyecto.map(tipo => (
                                    <option key={tipo} value={tipo}>{tipo}</option>
                                ))}
                            </select>
                            <label htmlFor="tipo_proyecto">Tipo de Proyecto</label>
                            {formErrors.tipo_proyecto && <span className="error-text">{formErrors.tipo_proyecto}</span>}
                        </div>
                        <div className="form-group floating-label full-width">
                            <textarea id="descripcion_proyecto" name="descripcion_proyecto" value={formData.descripcion_proyecto || ''} onChange={handleChange} rows={2} disabled={isViewMode} placeholder=" "></textarea>
                            <label htmlFor="descripcion_proyecto">Descripción del Proyecto</label>
                        </div>
                        <div className="form-group floating-label">
                            <input id="fecha_inicio_proyectada" type="date" name="fecha_inicio_proyectada" value={formData.fecha_inicio_proyectada || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " required />
                            <label htmlFor="fecha_inicio_proyectada">Fecha Inicio Proyectada</label>
                            {formErrors.fecha_inicio_proyectada && <span className="error-text">{formErrors.fecha_inicio_proyectada}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <input id="fecha_fin_proyectada" type="date" name="fecha_fin_proyectada" value={formData.fecha_fin_proyectada || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="fecha_fin_proyectada">Fecha Fin Proyectada</label>
                        </div>
                        <div className="form-group floating-label">
                            <select id="moneda_id_presupuesto" name="moneda_id_presupuesto" value={formData.moneda_id_presupuesto || ''} onChange={handleChange} disabled={isViewMode}>
                                <option value="">Seleccione Moneda</option>
                                {monedas.map(moneda => (
                                    <option key={moneda.moneda_id} value={moneda.moneda_id}>{moneda.nombre_moneda}</option>
                                ))}
                            </select>
                            <label htmlFor="moneda_id_presupuesto">Moneda Presupuesto</label>
                        </div>
                        <div className="form-group floating-label">
                            <input id="monto_presupuestado_ingresos" type="number" step="0.01" name="monto_presupuestado_ingresos" value={formData.monto_presupuestado_ingresos ?? ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="monto_presupuestado_ingresos">Presupuesto Ingresos</label>
                        </div>
                        <div className="form-group floating-label">
                            <input id="monto_presupuestado_costos" type="number" step="0.01" name="monto_presupuestado_costos" value={formData.monto_presupuestado_costos ?? ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="monto_presupuestado_costos">Presupuesto Costos</label>
                        </div>
                        <div className="form-group floating-label">
                            <select id="usuario_id_responsable_proyecto" name="usuario_id_responsable_proyecto" value={formData.usuario_id_responsable_proyecto || ''} onChange={handleChange} disabled={isViewMode}>
                                <option value="">Seleccione Responsable</option>
                                {usuarios.map(user => (
                                    <option key={user.usuario_id} value={user.usuario_id}>{user.nombres_completos_persona} {user.apellidos_completos_persona}</option>
                                ))}
                            </select>
                            <label htmlFor="usuario_id_responsable_proyecto">Responsable del Proyecto</label>
                        </div>
                        <div className="form-group floating-label">
                            <select id="estado_proyecto" name="estado_proyecto" value={formData.estado_proyecto || ''} onChange={handleChange} disabled={isViewMode} required>
                                <option value="">Seleccione Estado</option>
                                {estadosProyecto.map(estado => (
                                    <option key={estado} value={estado}>{estado}</option>
                                ))}
                            </select>
                            <label htmlFor="estado_proyecto">Estado del Proyecto</label>
                            {formErrors.estado_proyecto && <span className="error-text">{formErrors.estado_proyecto}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <select id="centro_costo_id_asociado" name="centro_costo_id_asociado" value={formData.centro_costo_id_asociado || ''} onChange={handleChange} disabled={isViewMode}>
                                <option value="">Seleccione Centro de Costo</option>
                                {centrosCosto.map(cc => (
                                    <option key={cc.centro_costo_id} value={cc.centro_costo_id}>{cc.nombre_centro_costo}</option>
                                ))}
                            </select>
                            <label htmlFor="centro_costo_id_asociado">Centro de Costo Asociado</label>
                        </div>

                        {selectedProyecto && (
                            <>
                                <div className="form-group floating-label">
                                    <input id="fecha_inicio_real" type="date" name="fecha_inicio_real" value={formData.fecha_inicio_real || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                                    <label htmlFor="fecha_inicio_real">Fecha Inicio Real</label>
                                </div>
                                <div className="form-group floating-label">
                                    <input id="fecha_fin_real" type="date" name="fecha_fin_real" value={formData.fecha_fin_real || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                                    <label htmlFor="fecha_fin_real">Fecha Fin Real</label>
                                </div>
                            </>
                        )}
                    </div>

                    {selectedProyecto && (
                        <div className="audit-section">
                            <h4>Información de Auditoría</h4>
                            <p><strong>Creado por:</strong> {selectedProyecto.creado_por || 'N/A'}</p>
                            <p><strong>Fecha de Creación:</strong> {formatDate(selectedProyecto.fecha_creacion)}</p>
                            <p><strong>Última Modificación por:</strong> {selectedProyecto.modificado_por || 'N/A'}</p>
                            <p><strong>Fecha de Modificación:</strong> {formatDate(selectedProyecto.fecha_modificacion)}</p>
                        </div>
                    )}

                    <div className="form-actions">
                        <button type="button" className="btn-secondary" onClick={handleCloseModal}>{isViewMode ? 'Cerrar' : 'Cancelar'}</button>
                        {!isViewMode && <button type="submit" className="btn-primary">{selectedProyecto ? 'Guardar Cambios' : 'Crear Proyecto'}</button>}
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default ListaProyectosPage;
