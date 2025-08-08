// Archivo: frontend/src/pages/clientes/ListaClientesPage.tsx (VERSIÓN SIN CAMPO CCI)
import React, { useEffect, useState, useCallback } from 'react';
import { 
    fetchClientes, 
    createCliente, 
    updateCliente, 
    deleteCliente, 
    type Cliente, 
    fetchClienteById,
    fetchNextClienteCode,
    exportClientes
} from '../../services/clienteService';
import { showSuccessToast, showErrorAlert, showConfirmDialog, showValidationErrorAlert } from '../../services/notificationService';
import Modal from '../../components/common/Modal';
import { FileDown, FilterX, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import '../../styles/TablePage.css';

interface FormErrors { [key: string]: string; }

// Función para formatear fechas de manera legible
const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('es-PE', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

const ListaClientesPage = () => {
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
    const [isViewMode, setIsViewMode] = useState(false);
    const [formErrors, setFormErrors] = useState<FormErrors>({});

    const [filters, setFilters] = useState({
        codigo_cliente_interno: '',
        razon_social_o_nombres: '',
        numero_documento_identidad: ''
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const ROWS_PER_PAGE = 8;

    const initialFormData: Partial<Cliente> = {
        codigo_cliente_interno: '',
        razon_social_o_nombres: '',
        nombre_comercial: '',
        tipo_documento_identidad: 'RUC',
        numero_documento_identidad: '',
        direccion_fiscal_completa: '',
        email_principal_facturacion: '',
        telefono_principal: '',
        condicion_pago_id_predeterminada: 1,
        moneda_id_predeterminada: 1,
        linea_credito_aprobada: 0,
        contacto_principal_nombre: '',
        contacto_principal_cargo: '',
        contacto_principal_email: '',
        contacto_principal_telefono: '',
        sector_industrial: '',
        observaciones_generales: '',
        // ¡CAMPO CCI ELIMINADO DE AQUÍ!
        // codigo_cuenta_interbancaria_cliente: '',
        estado_cliente: 'Activo',
    };
    const [formData, setFormData] = useState<Partial<Cliente>>(initialFormData);

    const loadClientes = useCallback(async () => {
        try {
            setLoading(true);
            const data = await fetchClientes(currentPage, ROWS_PER_PAGE, filters);
            setClientes(data.records);
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
            loadClientes();
        }, 500); // Debounce para no llamar a la API en cada tecleo
        return () => clearTimeout(timer);
    }, [loadClientes]);

   const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
        setCurrentPage(1); // Resetea a la primera página al filtrar
    };

    const clearFilters = () => {
        setFilters({ codigo_cliente_interno: '', razon_social_o_nombres: '', numero_documento_identidad: '' });
        setCurrentPage(1);
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    const handleOpenModal = async (cliente: Cliente | null = null, viewMode = false) => {
        setIsViewMode(viewMode);
        setFormErrors({});
        if (cliente && cliente.cliente_id) {
            try {
                const fullClienteData = await fetchClienteById(cliente.cliente_id);
                setSelectedCliente(fullClienteData);
                setFormData(fullClienteData);
            } catch (error) { if (error instanceof Error) showErrorAlert(error.message); return; }
        } else {
            setSelectedCliente(null);
            try {
                const nextCode = await fetchNextClienteCode();
                setFormData({ ...initialFormData, codigo_cliente_interno: nextCode });
            } catch { setFormData(initialFormData); }
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedCliente(null);
    };

    const validateForm = (): FormErrors => {
        const errors: FormErrors = {};
        if (!formData.razon_social_o_nombres?.trim()) errors.razon_social_o_nombres = "La razón social es obligatoria.";
        if (!formData.numero_documento_identidad?.trim()) {
            errors.numero_documento_identidad = "El número de documento es obligatorio.";
        } else {
            if (formData.tipo_documento_identidad === 'DNI' && formData.numero_documento_identidad.length !== 8) errors.numero_documento_identidad = "El DNI debe tener 8 dígitos.";
            if (formData.tipo_documento_identidad === 'RUC' && formData.numero_documento_identidad.length !== 11) errors.numero_documento_identidad = "El RUC debe tener 11 dígitos.";
        }
        if (formData.email_principal_facturacion && !/\S+@\S+\.\S+/.test(formData.email_principal_facturacion)) errors.email_principal_facturacion = "El formato del email no es válido.";
        setFormErrors(errors);
        return errors;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        
        let inputValue: string | boolean | number | undefined = value;

        if (type === 'checkbox') {
            inputValue = (e.target as HTMLInputElement).checked;
        } else if (name === 'condicion_pago_id_predeterminada' || 
                   name === 'moneda_id_predeterminada' ||
                   name === 'linea_credito_aprobada') { 
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

        const dataToSend = { ...formData, linea_credito_aprobada: formData.linea_credito_aprobada || 0 };

        try {
            if (selectedCliente) {
                await updateCliente(selectedCliente.cliente_id!, dataToSend);
                showSuccessToast('¡Cliente actualizado con éxito!');
            } else {
                await createCliente(dataToSend as Cliente);
                showSuccessToast('¡Cliente creado con éxito!');
            }
            handleCloseModal();
            loadClientes();
        } catch (error) {
            if (error instanceof Error) showErrorAlert(error.message);
        }
    };

    const handleDelete = async (clienteId: number) => {
        const result = await showConfirmDialog('¿Estás seguro?', 'El cliente pasará a estado "Inactivo".');
        if (result.isConfirmed) {
            try {
                await deleteCliente(clienteId);
                showSuccessToast('Cliente desactivado con éxito.');
                loadClientes();
            } catch (error) {
                if (error instanceof Error) showErrorAlert(error.message);
            }
        }
    };

   const handleExport = async () => {
        try {
            await exportClientes(filters);
        } catch (error) {
            console.error(error);
        }
    };

    if (loading) return <div className="loading-spinner">Cargando...</div>;

    return (
        <>
            <div className="table-page-container">
                <div className="table-page-header">
                    <h1>Lista de Clientes</h1>
                    <div className="header-actions">
                        <button onClick={handleExport} className="btn-secondary">
                            <FileDown size={18} /> Exportar Excel
                        </button>
                        <button onClick={() => handleOpenModal()} className="btn-primary">
                            + Agregar Cliente
                        </button>
                    </div>
                </div>
                
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Razón Social / Nombres</th>
                                <th>Nro. Documento</th>
                                <th>Creado Por</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                            {/* --- FILA DE FILTROS --- */}
                            <tr className="filter-row">
                                <td><input type="text" name="codigo_cliente_interno" value={filters.codigo_cliente_interno} onChange={handleFilterChange} placeholder="Buscar..." /></td>
                                <td><input type="text" name="razon_social_o_nombres" value={filters.razon_social_o_nombres} onChange={handleFilterChange} placeholder="Buscar..." /></td>
                                <td><input type="text" name="numero_documento_identidad" value={filters.numero_documento_identidad} onChange={handleFilterChange} placeholder="Buscar..." /></td>
                                <td></td>
                                <td></td>
                                <td className="filter-actions">
                                    <button onClick={clearFilters} className="btn-icon" title="Limpiar filtros"><FilterX size={18} /></button>
                                </td>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6}><div className="loading-spinner">Cargando...</div></td></tr>
                            ) : clientes.length > 0 ? (
                                clientes.map((cliente) => (
                                    <tr key={cliente.cliente_id}>
                                        <td>{cliente.codigo_cliente_interno || 'N/A'}</td>
                                        <td>{cliente.razon_social_o_nombres}</td>
                                        <td>{cliente.numero_documento_identidad}</td>
                                        <td><span className="user-badge">{cliente.creado_por || 'N/A'}</span></td>
                                        <td>
                                            <span className={`status-badge status-${cliente.estado_cliente?.toLowerCase()}`}>
                                                {cliente.estado_cliente}
                                            </span>
                                        </td>
                                        <td>
                                            <button onClick={() => handleOpenModal(cliente, true)} className="btn-icon" title="Ver">👁️</button>
                                            <button onClick={() => handleOpenModal(cliente)} className="btn-icon" title="Editar">✏️</button>
                                            <button onClick={() => handleDelete(cliente.cliente_id!)} className="btn-icon btn-danger" title="Desactivar">🗑️</button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={6} className="no-data">No se encontraron clientes con los filtros aplicados.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {/* --- CONTROLES DE PAGINACIÓN --- */}
                <div className="pagination-container">
                    <span>Mostrando {clientes.length} de {totalRecords} registros</span>
                    <div className="pagination-controls">
                        <button onClick={() => handlePageChange(1)} disabled={currentPage === 1}><ChevronsLeft size={16} /></button>
                        <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
                        <span>Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong></span>
                        <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}><ChevronRight size={16} /></button>
                        <button onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages}><ChevronsRight size={16} /></button>
                    </div>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={isViewMode ? 'Detalle del Cliente' : (selectedCliente ? 'Editar Cliente' : 'Agregar Cliente')}>
                <form onSubmit={handleSubmit} className="modal-form" noValidate>
                    <div className="form-grid">
                        {/* --- Sección de Datos Generales --- */}
                        <div className="form-group floating-label">
                            <input id="codigo_cliente_interno" type="text" name="codigo_cliente_interno" value={formData.codigo_cliente_interno || ''} onChange={handleChange} disabled={true} placeholder=" " />
                            <label htmlFor="codigo_cliente_interno">Código Interno</label>
                        </div>
                        <div className="form-group floating-label">
                            <input id="razon_social_o_nombres" type="text" name="razon_social_o_nombres" value={formData.razon_social_o_nombres || ''} onChange={handleChange} disabled={isViewMode} className={formErrors.razon_social_o_nombres ? 'error' : ''} placeholder=" " required />
                            <label htmlFor="razon_social_o_nombres">Razón Social / Nombres</label>
                            {formErrors.razon_social_o_nombres && <span className="error-text">{formErrors.razon_social_o_nombres}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <input id="nombre_comercial" type="text" name="nombre_comercial" value={formData.nombre_comercial || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="nombre_comercial">Nombre Comercial</label>
                        </div>
                        
                        <div className="form-group floating-label">
                            <select id="tipo_documento_identidad" name="tipo_documento_identidad" value={formData.tipo_documento_identidad || 'RUC'} onChange={handleChange} disabled={isViewMode}>
                                <option value="RUC">RUC</option>
                                <option value="DNI">DNI</option>
                            </select>
                            <label htmlFor="tipo_documento_identidad">Tipo de Documento</label>
                        </div>
                        <div className="form-group floating-label">
                            <input id="numero_documento_identidad" type="text" name="numero_documento_identidad" value={formData.numero_documento_identidad || ''} onChange={handleChange} disabled={isViewMode} className={formErrors.numero_documento_identidad ? 'error' : ''} placeholder=" " required />
                            <label htmlFor="numero_documento_identidad">Número de Documento</label>
                            {formErrors.numero_documento_identidad && <span className="error-text">{formErrors.numero_documento_identidad}</span>}
                        </div>
                        <div className="form-group floating-label full-width">
                            <textarea id="direccion_fiscal_completa" name="direccion_fiscal_completa" value={formData.direccion_fiscal_completa || ''} onChange={handleChange} rows={2} disabled={isViewMode} placeholder=" "></textarea>
                            <label htmlFor="direccion_fiscal_completa">Dirección Fiscal</label>
                        </div>
                        <div className="form-group floating-label">
                            <input id="email_principal_facturacion" type="email" name="email_principal_facturacion" value={formData.email_principal_facturacion || ''} onChange={handleChange} disabled={isViewMode} className={formErrors.email_principal_facturacion ? 'error' : ''} placeholder=" " />
                            <label htmlFor="email_principal_facturacion">Email Facturación</label>
                            {formErrors.email_principal_facturacion && <span className="error-text">{formErrors.email_principal_facturacion}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <input id="telefono_principal" type="tel" name="telefono_principal" value={formData.telefono_principal || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="telefono_principal">Teléfono Principal</label>
                        </div>

                        {/* --- Sección de Datos Comerciales --- */}
                        <h4 className="form-section-title full-width">Datos Comerciales</h4>
                        <div className="form-group floating-label">
                            <select id="condicion_pago_id_predeterminada" name="condicion_pago_id_predeterminada" value={formData.condicion_pago_id_predeterminada || 1} onChange={handleChange} disabled={isViewMode}>
                                <option value={1}>Contado</option>
                                <option value={2}>Crédito 15 días</option>
                                <option value={3}>Crédito 30 días</option>
                            </select>
                            <label htmlFor="condicion_pago_id_predeterminada">Condición de Pago</label>
                        </div>
                        <div className="form-group floating-label">
                            <select id="moneda_id_predeterminada" name="moneda_id_predeterminada" value={formData.moneda_id_predeterminada || 1} onChange={handleChange} disabled={isViewMode}>
                                <option value={1}>Soles (PEN)</option>
                                <option value={2}>Dólares (USD)</option>
                            </select>
                            <label htmlFor="moneda_id_predeterminada">Moneda</label>
                        </div>
                        <div className="form-group floating-label">
                            <input id="linea_credito_aprobada" type="number" inputMode="decimal" name="linea_credito_aprobada" value={formData.linea_credito_aprobada ?? ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="linea_credito_aprobada">Línea de Crédito (S/)</label>
                        </div>
                        <div className="form-group floating-label">
                            <input id="sector_industrial" type="text" name="sector_industrial" value={formData.sector_industrial || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="sector_industrial">Sector Industrial</label>
                        </div>

                        {/* --- Sección de Contacto Principal --- */}
                        <h4 className="form-section-title full-width">Contacto Principal</h4>
                        <div className="form-group floating-label">
                            <input id="contacto_principal_nombre" type="text" name="contacto_principal_nombre" value={formData.contacto_principal_nombre || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="contacto_principal_nombre">Nombre</label>
                        </div>
                        <div className="form-group floating-label">
                            <input id="contacto_principal_cargo" type="text" name="contacto_principal_cargo" value={formData.contacto_principal_cargo || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="contacto_principal_cargo">Cargo</label>
                        </div>
                        <div className="form-group floating-label">
                            <input id="contacto_principal_telefono" type="tel" name="contacto_principal_telefono" value={formData.contacto_principal_telefono || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="contacto_principal_telefono">Teléfono</label>
                        </div>
                        <div className="form-group floating-label">
                            <input id="contacto_principal_email" type="email" name="contacto_principal_email" value={formData.contacto_principal_email || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="contacto_principal_email">Email</label>
                        </div>

                        {/* --- ¡CAMPO CCI ELIMINADO DE AQUÍ! --- */}
                        {/* <div className="form-group floating-label full-width">
                            <input 
                                id="codigo_cuenta_interbancaria_cliente" 
                                type="text" 
                                name="codigo_cuenta_interbancaria_cliente" 
                                value={formData.codigo_cuenta_interbancaria_cliente || ''} 
                                onChange={handleChange} 
                                disabled={isViewMode} 
                                placeholder=" " 
                            />
                            <label htmlFor="codigo_cuenta_interbancaria_cliente">CCI (Cuenta Interbancaria)</label>
                        </div>
                        */}

                        {/* --- Otras Secciones --- */}
                        <div className="form-group floating-label full-width">
                            <textarea id="observaciones_generales" name="observaciones_generales" value={formData.observaciones_generales || ''} onChange={handleChange} rows={3} disabled={isViewMode} placeholder=" "></textarea>
                            <label htmlFor="observaciones_generales">Observaciones</label>
                        </div>
                        
                        {selectedCliente && (
                            <div className="form-group floating-label">
                                <select id="estado_cliente" name="estado_cliente" value={formData.estado_cliente || 'Activo'} onChange={handleChange} disabled={isViewMode}>
                                    <option value="Activo">Activo</option>
                                    <option value="Inactivo">Inactivo</option>
                                </select>
                                <label htmlFor="estado_cliente">Estado</label>
                            </div>
                        )}
                    </div>

                    {isViewMode && selectedCliente && (
                        <div className="audit-section">
                            <h4>Información de Auditoría</h4>
                            <p><strong>Creado por:</strong> {selectedCliente.creado_por || 'N/A'}</p>
                            <p><strong>Fecha de Creación:</strong> {formatDate(selectedCliente.fecha_creacion)}</p>
                            <p><strong>Última Modificación por:</strong> {selectedCliente.modificado_por || 'N/A'}</p>
                            <p><strong>Fecha de Modificación:</strong> {formatDate(selectedCliente.fecha_modificacion)}</p>
                        </div>
                    )}

                    <div className="form-actions">
                        <button type="button" className="btn-secondary" onClick={handleCloseModal}>{isViewMode ? 'Cerrar' : 'Cancelar'}</button>
                        {!isViewMode && <button type="submit" className="btn-primary">{selectedCliente ? 'Guardar Cambios' : 'Crear Cliente'}</button>}
                    </div>
                </form>
            </Modal>
        </>
    );
};

export default ListaClientesPage;
