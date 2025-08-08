// Archivo: frontend/src/pages/configuracion/ListaEmpresasPage.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth'; // Para obtener datos del usuario logueado
import { 
    fetchEmpresas, 
    createEmpresa, 
    updateEmpresa, 
    deleteEmpresa, 
    exportEmpresas,
    fetchEmpresaById,
    type Empresa, 
    type PagedEmpresasResponse,
    type EmpresaFilters
} from '../../services/empresaService';
import { showSuccessToast, showErrorAlert, showConfirmDialog, showValidationErrorAlert } from '../../services/notificationService';
import Modal from '../../components/common/Modal';
import { FileDown, FilterX, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus } from 'lucide-react';
import '../../styles/TablePage.css'; // Estilos generales de tabla/formularios

interface FormErrors { 
    [key: string]: string | undefined; 
}

// Función para formatear fechas de manera legible (para display en UI)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'N/A';
        return date.toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
        return 'N/A';
    }
};

const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'N/A';
        return date.toLocaleString('es-PE', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch {
        return 'N/A';
    }
};

// Función auxiliar para formatear fecha a YYYY-MM-DD para input type="date"
const formatToInputDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch {
        return '';
    }
};

const ListaEmpresasPage = () => {
    const { user: currentUser } = useAuth(); // Usuario logueado para auditoría
    const [empresas, setEmpresas] = useState<Empresa[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);
    const [isViewMode, setIsViewMode] = useState(false);
    const [formErrors, setFormErrors] = useState<FormErrors>({});

    const [filters, setFilters] = useState<EmpresaFilters>({
        nombre_empresa: '',
        numero_identificacion_fiscal: '',
        activa: undefined // Por defecto no filtrar por activa
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const ROWS_PER_PAGE = 8;

    // Estado para el formulario de nuevo/editar empresa
    const initialFormData: Partial<Empresa> = {
        nombre_empresa: '',
        alias_empresa: '',
        numero_identificacion_fiscal: '',
        direccion_fiscal_completa: '',
        telefono_contacto: '',
        email_contacto: '',
        representante_legal_nombre: '',
        fecha_inicio_actividades: '',
        logo_url: '',
        activa: true, // Por defecto activa
    };
    const [formData, setFormData] = useState<Partial<Empresa>>(initialFormData);

    // Cargar empresas
    const loadEmpresas = useCallback(async () => {
        try {
            setLoading(true);
            const empresasData: PagedEmpresasResponse = await fetchEmpresas(currentPage, ROWS_PER_PAGE, filters);
            setEmpresas(empresasData.records);
            setTotalPages(empresasData.total_pages);
            setTotalRecords(empresasData.total_records);
        } catch (error) {
            if (error instanceof Error) showErrorAlert(error.message);
        } finally {
            setLoading(false);
        }
    }, [currentPage, filters]);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadEmpresas();
        }, 500);
        return () => clearTimeout(timer);
    }, [loadEmpresas]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        let filterValue: string | boolean | undefined = value;

        if (name === 'activa') {
            filterValue = value === 'true' ? true : value === 'false' ? false : undefined;
        }

        setFilters(prev => ({ ...prev, [name]: filterValue }));
        setCurrentPage(1);
    };

    const clearFilters = () => {
        setFilters({ 
            nombre_empresa: '', 
            numero_identificacion_fiscal: '', 
            activa: undefined 
        });
        setCurrentPage(1);
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) { 
            setCurrentPage(newPage);
        }
    };
    
    const handleExport = async (currentFilters: EmpresaFilters) => {
        try {
            await exportEmpresas(currentFilters);
        } catch (error) {
            console.error(error);
            if (error instanceof Error) showErrorAlert(error.message);
        }
    };

    const handleOpenModal = async (empresa: Empresa | null = null, viewMode = false) => {
        setIsViewMode(viewMode);
        setFormErrors({});

        if (empresa && empresa.empresa_id) {
            try {
                const fullEmpresaData = await fetchEmpresaById(empresa.empresa_id);
                if (!fullEmpresaData) { 
                    showErrorAlert('No se encontró la empresa o hubo un problema al cargarla.');
                    return;
                }
                // Procesar datos para el formulario
                const processedEmpresaData: Empresa = {
                    ...fullEmpresaData,
                    fecha_inicio_actividades: formatToInputDate(fullEmpresaData.fecha_inicio_actividades),
                    activa: !!fullEmpresaData.activa // Asegurar que sea booleano
                };
                setSelectedEmpresa(processedEmpresaData);
                setFormData(processedEmpresaData);
            } catch (error) {
                if (error instanceof Error) showErrorAlert(error.message);
                console.error("Error fetching empresa data:", error); 
                return;
            }
        } else {
            setSelectedEmpresa(null);
            setFormData(initialFormData); 
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedEmpresa(null);
        setFormData(initialFormData); 
    };

    const validateForm = (): FormErrors => {
        const errors: FormErrors = {};
        if (!formData.nombre_empresa?.trim()) errors.nombre_empresa = "El nombre de la empresa es obligatorio.";
        if (!formData.numero_identificacion_fiscal?.trim()) errors.numero_identificacion_fiscal = "El número de identificación fiscal (RUC) es obligatorio.";
        else if (formData.numero_identificacion_fiscal.length !== 11) errors.numero_identificacion_fiscal = "El RUC debe tener 11 dígitos.";
        
        if (formData.email_contacto && !/\S+@\S+\.\S+/.test(formData.email_contacto)) errors.email_contacto = "El formato del email no es válido.";
        
        setFormErrors(errors);
        return errors;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        let inputValue: string | number | boolean | undefined = value;

        if (type === 'checkbox') {
            inputValue = (e.target as HTMLInputElement).checked;
        } else if (type === 'date' && value === '') { // Manejar fechas vacías
            inputValue = undefined;
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
            // Eliminar campos de solo lectura antes de enviar al backend
            const dataToSend: Partial<Empresa> = { ...formData };
            // Los campos de auditoría y ID generado se omiten por el tipo del servicio, no se borran aquí

            if (selectedEmpresa) {
                await updateEmpresa(selectedEmpresa.empresa_id!, dataToSend);
                showSuccessToast('¡Empresa actualizada con éxito!');
            } else {
                await createEmpresa(dataToSend as Empresa); // Castear a Empresa ya que es una creación completa
                showSuccessToast('¡Empresa creada con éxito!');
            }
            handleCloseModal(); 
            loadEmpresas(); 
        } catch (error) {
            if (error instanceof Error) showErrorAlert(error.message);
        }
    };

    const handleDelete = async (empresaId: number) => {
        const result = await showConfirmDialog('¿Estás seguro?', 'La empresa pasará a estado "Inactiva".');
        if (result.isConfirmed) {
            try {
                // Obtenemos el nombre y ID del usuario logueado para auditoría
                const modificadorId = currentUser?.id;
                const nombreModificador = currentUser?.nombres + ' ' + currentUser?.apellidos; 
                if (!modificadorId || !nombreModificador) {
                    showErrorAlert('No se pudieron obtener los datos del usuario logueado para la auditoría.');
                    return;
                }
                await deleteEmpresa(empresaId); // La notificación de éxito está en el servicio deleteEmpresa
                loadEmpresas();
            } catch (error) {
                if (error instanceof Error) showErrorAlert(error.message);
            }
        }
    };

    if (loading && empresas.length === 0) {
        return <div className="loading-spinner">Cargando...</div>;
    }

    return (
        <>
            <div className="table-page-container">
                <div className="table-page-header">
                    <h1>Gestión de Empresas</h1>
                    <div className="header-actions">
                        <button onClick={() => handleExport(filters)} className="btn-secondary">
                            <FileDown size={18} /> Exportar Excel
                        </button>
                        <button onClick={() => handleOpenModal()} className="btn-primary">
                            <Plus size={18} /> Nueva Empresa
                        </button>
                    </div>
                </div>
                
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Nombre Empresa</th>
                                <th>RUC/NIF</th>
                                <th>Teléfono</th>
                                <th>Email</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                            <tr className="filter-row">
                                <td><input type="text" name="nombre_empresa" value={filters.nombre_empresa || ''} onChange={handleFilterChange} placeholder="Buscar..." /></td>
                                <td><input type="text" name="numero_identificacion_fiscal" value={filters.numero_identificacion_fiscal || ''} onChange={handleFilterChange} placeholder="Buscar..." /></td>
                                <td></td> 
                                <td></td> 
                                <td>
                                    <select name="activa" value={filters.activa === true ? 'true' : filters.activa === false ? 'false' : ''} onChange={handleFilterChange}>
                                        <option value="">Todos</option>
                                        <option value="true">Activa</option>
                                        <option value="false">Inactiva</option>
                                    </select>
                                </td>
                                <td className="filter-actions">
                                    <button onClick={clearFilters} className="btn-icon" title="Limpiar filtros"><FilterX size={18} /></button>
                                </td>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6}><div className="loading-spinner">Cargando...</div></td></tr>
                            ) : empresas.length > 0 ? (
                                empresas.map((empresa) => (
                                    <tr key={empresa.empresa_id}>
                                        <td>{empresa.nombre_empresa}</td>
                                        <td>{empresa.numero_identificacion_fiscal}</td>
                                        <td>{empresa.telefono_contacto || 'N/A'}</td>
                                        <td>{empresa.email_contacto || 'N/A'}</td>
                                        <td>
                                            <span className={`status-badge ${empresa.activa ? 'status-activo' : 'status-inactivo'}`}>
                                                {empresa.activa ? 'Activa' : 'Inactiva'}
                                            </span>
                                        </td>
                                        <td>
                                            <button onClick={() => handleOpenModal(empresa, true)} className="btn-icon" title="Ver">👁️</button>
                                            <button onClick={() => handleOpenModal(empresa)} className="btn-icon" title="Editar">✏️</button>
                                            <button onClick={() => handleDelete(empresa.empresa_id!)} className="btn-icon btn-danger" title="Desactivar">🗑️</button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={6} className="no-data">No se encontraron empresas.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="pagination-container">
                    <span>Mostrando {empresas.length} de {totalRecords} registros</span>
                    <div className="pagination-controls">
                        <button onClick={() => handlePageChange(1)} disabled={currentPage === 1}><ChevronsLeft size={16} /></button>
                        <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
                        <span>Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong></span>
                        <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}><ChevronRight size={16} /></button>
                        <button onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages}><ChevronsRight size={16} /></button>
                    </div>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={isViewMode ? 'Detalle de la Empresa' : (selectedEmpresa ? 'Editar Empresa' : 'Nueva Empresa')}>
                <form onSubmit={handleSubmit} className="modal-form" noValidate>
                    <div className="form-grid">
                        {/* Datos Básicos de la Empresa */}
                        <div className="form-group floating-label">
                            <input id="nombre_empresa" type="text" name="nombre_empresa" value={formData.nombre_empresa || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " required />
                            <label htmlFor="nombre_empresa">Nombre de la Empresa</label>
                            {formErrors.nombre_empresa && <span className="error-text">{formErrors.nombre_empresa}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <input id="alias_empresa" type="text" name="alias_empresa" value={formData.alias_empresa || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="alias_empresa">Alias de la Empresa</label>
                        </div>
                        <div className="form-group floating-label">
                            <input id="numero_identificacion_fiscal" type="text" name="numero_identificacion_fiscal" value={formData.numero_identificacion_fiscal || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " required />
                            <label htmlFor="numero_identificacion_fiscal">RUC/NIF</label>
                            {formErrors.numero_identificacion_fiscal && <span className="error-text">{formErrors.numero_identificacion_fiscal}</span>}
                        </div>
                        <div className="form-group floating-label full-width">
                            <textarea id="direccion_fiscal_completa" name="direccion_fiscal_completa" value={formData.direccion_fiscal_completa || ''} onChange={handleChange} rows={2} disabled={isViewMode} placeholder=" "></textarea>
                            <label htmlFor="direccion_fiscal_completa">Dirección Fiscal Completa</label>
                        </div>
                        <div className="form-group floating-label">
                            <input id="telefono_contacto" type="tel" name="telefono_contacto" value={formData.telefono_contacto || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="telefono_contacto">Teléfono de Contacto</label>
                        </div>
                        <div className="form-group floating-label">
                            <input id="email_contacto" type="email" name="email_contacto" value={formData.email_contacto || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="email_contacto">Email de Contacto</label>
                            {formErrors.email_contacto && <span className="error-text">{formErrors.email_contacto}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <input id="representante_legal_nombre" type="text" name="representante_legal_nombre" value={formData.representante_legal_nombre || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="representante_legal_nombre">Representante Legal</label>
                        </div>
                        <div className="form-group floating-label">
                            <input id="fecha_inicio_actividades" type="date" name="fecha_inicio_actividades" value={formData.fecha_inicio_actividades || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="fecha_inicio_actividades">Fecha Inicio Actividades</label>
                        </div>
                        <div className="form-group floating-label full-width">
                            <input id="logo_url" type="text" name="logo_url" value={formData.logo_url || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="logo_url">URL del Logo</label>
                        </div>
                        
                        {/* Opciones de la Empresa */}
                        {selectedEmpresa && (
                            <div className="form-group checkbox-group full-width">
                                <input id="activa" type="checkbox" name="activa" checked={formData.activa ?? true} onChange={handleChange} disabled={isViewMode} />
                                <label htmlFor="activa">Empresa Activa</label>
                            </div>
                        )}
                    </div>

                    {isViewMode && selectedEmpresa && (
                        <div className="audit-section">
                            <h4>Información de Auditoría</h4>
                            <p><strong>Creado por:</strong> {selectedEmpresa.creado_por || 'N/A'}</p>
                            <p><strong>Fecha de Creación:</strong> {formatDateTime(selectedEmpresa.fecha_creacion_registro)}</p> 
                            <p><strong>Última Modificación por:</strong> {selectedEmpresa.modificado_por || 'N/A'}</p>
                            <p><strong>Fecha de Modificación:</strong> {formatDateTime(selectedEmpresa.fecha_modificacion)}</p>
                        </div>
                    )}

                    <div className="form-actions">
                        <button type="button" className="btn-secondary" onClick={handleCloseModal}>{isViewMode ? 'Cerrar' : 'Cancelar'}</button>
                        {!isViewMode && <button type="submit" className="btn-primary">{selectedEmpresa ? 'Guardar Cambios' : 'Crear Empresa'}</button>}
                    </div>
                </form>
            </Modal>
        </>
    );
};

export default ListaEmpresasPage;