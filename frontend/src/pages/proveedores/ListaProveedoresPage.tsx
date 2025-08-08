// Archivo: frontend/src/pages/proveedores/ListaProveedoresPage.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { 
    fetchProveedores, 
    createProveedor, 
    updateProveedor, 
    deleteProveedor, 
    type Proveedor, 
    fetchProveedorById,
    fetchNextProveedorCode,
    exportProveedores
} from '../../services/proveedorService';
import { showSuccessToast, showErrorAlert, showConfirmDialog, showValidationErrorAlert } from '../../services/notificationService';
import Modal from '../../components/common/Modal';
import { FileDown, FilterX, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import '../../styles/TablePage.css'; // Kikin estilotam servichikunchik

interface FormErrors { [key: string]: string; }

const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('es-PE', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

const ListaProveedoresPage = () => {
    const [proveedores, setProveedores] = useState<Proveedor[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProveedor, setSelectedProveedor] = useState<Proveedor | null>(null);
    const [isViewMode, setIsViewMode] = useState(false);
    const [formErrors, setFormErrors] = useState<FormErrors>({});
    
    const [filters, setFilters] = useState({
        codigo_proveedor_interno: '',
        razon_social_o_nombres: '',
        numero_documento_identidad: ''
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const ROWS_PER_PAGE = 8;

    const initialFormData: Partial<Proveedor> = {
        codigo_proveedor_interno: '',
        razon_social_o_nombres: '',
        nombre_comercial: '',
        tipo_documento_identidad: 'RUC',
        numero_documento_identidad: '',
        direccion_fiscal_completa: '',
        email_principal_pagos: '',
        telefono_principal: '',
        condicion_pago_id_predeterminada: 1,
        moneda_id_predeterminada: 1,
        contacto_principal_nombre: '',
        banco_predeterminado_proveedor: '',
        numero_cuenta_proveedor: '',
        // ¡NUEVO CAMPO EN initialFormData!
        codigo_cuenta_interbancaria_proveedor: '', 
        tipo_servicio_principal_proveedor: '',
        observaciones_generales: '',
        es_agente_retencion_igv: false,
        requiere_pago_detraccion: false,
        estado_proveedor: 'Activo',
    };
    const [formData, setFormData] = useState<Partial<Proveedor>>(initialFormData);

    const loadProveedores = useCallback(async () => {
        try {
            setLoading(true);
            const data = await fetchProveedores(currentPage, ROWS_PER_PAGE, filters);
            setProveedores(data.records);
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
            loadProveedores();
        }, 500);
        return () => clearTimeout(timer);
    }, [loadProveedores]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
        setCurrentPage(1);
    };

    const clearFilters = () => {
        setFilters({ codigo_proveedor_interno: '', razon_social_o_nombres: '', numero_documento_identidad: '' });
        setCurrentPage(1);
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };
    
    const handleExport = async () => {
        try {
            await exportProveedores(filters);
        } catch (error) {
            console.error(error);
        }
    };

    const handleOpenModal = async (proveedor: Proveedor | null = null, viewMode = false) => {
        setIsViewMode(viewMode);
        setFormErrors({});
        if (proveedor && proveedor.proveedor_id) {
            try {
                const fullProveedorData = await fetchProveedorById(proveedor.proveedor_id);
                setSelectedProveedor(fullProveedorData);
                setFormData(fullProveedorData);
            } catch (error) {
                if (error instanceof Error) showErrorAlert(error.message);
                return;
            }
        } else {
            setSelectedProveedor(null);
            try {
                const nextCode = await fetchNextProveedorCode();
                setFormData({ ...initialFormData, codigo_proveedor_interno: nextCode });
            } catch {
                setFormData(initialFormData);
            }
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedProveedor(null);
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
        if (formData.email_principal_pagos && !/\S+@\S+\.\S+/.test(formData.email_principal_pagos)) errors.email_principal_pagos = "El formato del email no es válido.";
        setFormErrors(errors);
        return errors;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const isCheckbox = type === 'checkbox';
        
        let inputValue: string | boolean | number | undefined = isCheckbox ? (e.target as HTMLInputElement).checked : value;

        // Convertir a número si es un campo de ID numérico
        if (name === 'condicion_pago_id_predeterminada' || name === 'moneda_id_predeterminada') {
            inputValue = Number(value);
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
            if (selectedProveedor) {
                await updateProveedor(selectedProveedor.proveedor_id!, formData);
                showSuccessToast('¡Proveedor actualizado con éxito!');
            } else {
                await createProveedor(formData as Proveedor);
                showSuccessToast('¡Proveedor creado con éxito!');
            }
            handleCloseModal();
            loadProveedores();
        } catch (error) {
            if (error instanceof Error) showErrorAlert(error.message);
        }
    };

    const handleDelete = async (proveedorId: number) => {
        const result = await showConfirmDialog('¿Estás seguro?', 'El proveedor pasará a estado "Inactivo".');
        if (result.isConfirmed) {
            try {
                await deleteProveedor(proveedorId);
                showSuccessToast('Proveedor desactivado con éxito.');
                loadProveedores();
            } catch (error) {
                if (error instanceof Error) showErrorAlert(error.message);
            }
        }
    };

    if (loading) return <div className="loading-spinner">Cargando...</div>;

    return (
        <>
            <div className="table-page-container">
                <div className="table-page-header">
                    <h1>Lista de Proveedores</h1>
                     <div className="header-actions">
                        <button onClick={handleExport} className="btn-secondary">
                            <FileDown size={18} /> Exportar Excel
                        </button>
                        <button onClick={() => handleOpenModal()} className="btn-primary">
                            + Agregar Proveedor
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
                            <tr className="filter-row">
                                <td><input type="text" name="codigo_proveedor_interno" value={filters.codigo_proveedor_interno} onChange={handleFilterChange} placeholder="Buscar..." /></td>
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
                            {proveedores.length > 0 ? (
                                proveedores.map((proveedor) => (
                                    <tr key={proveedor.proveedor_id}>
                                        <td>{proveedor.codigo_proveedor_interno || 'N/A'}</td>
                                        <td>{proveedor.razon_social_o_nombres}</td>
                                        <td>{proveedor.numero_documento_identidad}</td>
                                        <td><span className="user-badge">{proveedor.creado_por || 'N/A'}</span></td>
                                        <td>
                                            <span className={`status-badge status-${proveedor.estado_proveedor?.toLowerCase()}`}>
                                                {proveedor.estado_proveedor}
                                            </span>
                                        </td>
                                        <td>
                                            <button onClick={() => handleOpenModal(proveedor, true)} className="btn-icon" title="Ver">👁️</button>
                                            <button onClick={() => handleOpenModal(proveedor)} className="btn-icon" title="Editar">✏️</button>
                                            <button onClick={() => handleDelete(proveedor.proveedor_id!)} className="btn-icon btn-danger" title="Desactivar">🗑️</button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={6} className="no-data">No se encontraron proveedores.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                 <div className="pagination-container">
                    <span>Mostrando {proveedores.length} de {totalRecords} registros</span>
                    <div className="pagination-controls">
                        <button onClick={() => handlePageChange(1)} disabled={currentPage === 1}><ChevronsLeft size={16} /></button>
                        <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
                        <span>Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong></span>
                        <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}><ChevronRight size={16} /></button>
                        <button onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages}><ChevronsRight size={16} /></button>
                    </div>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={isViewMode ? 'Detalle del Proveedor' : (selectedProveedor ? 'Editar Proveedor' : 'Agregar Proveedor')}>
                <form onSubmit={handleSubmit} className="modal-form" noValidate>
                    <div className="form-grid">
                        <div className="form-group floating-label">
                            <input id="codigo_proveedor_interno" type="text" name="codigo_proveedor_interno" value={formData.codigo_proveedor_interno || ''} onChange={handleChange} disabled={true} placeholder=" " />
                            <label htmlFor="codigo_proveedor_interno">Código Interno</label>
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
                        {/* Removí los <br /> extra que tenías, ya que form-grid debería manejar el espaciado */}
                        
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
                            <input id="email_principal_pagos" type="email" name="email_principal_pagos" value={formData.email_principal_pagos || ''} onChange={handleChange} disabled={isViewMode} className={formErrors.email_principal_pagos ? 'error' : ''} placeholder=" " />
                            <label htmlFor="email_principal_pagos">Email para Pagos</label>
                            {formErrors.email_principal_pagos && <span className="error-text">{formErrors.email_principal_pagos}</span>}
                        </div>
                        {/* Removí los <br /> extra */}
                        
                        <div className="form-group floating-label">
                            <input id="contacto_principal_nombre" type="text" name="contacto_principal_nombre" value={formData.contacto_principal_nombre || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="contacto_principal_nombre">Nombre de Contacto</label>
                        </div>
                        <div className="form-group floating-label">
                            <input id="telefono_principal" type="tel" name="telefono_principal" value={formData.telefono_principal || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="telefono_principal">Teléfono Principal</label>
                        </div>

                        <h4 className="form-section-title full-width">Datos Bancarios y Adicionales</h4> {/* Título de sección añadido/modificado */}
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
                            <input id="banco_predeterminado_proveedor" type="text" name="banco_predeterminado_proveedor" value={formData.banco_predeterminado_proveedor || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="banco_predeterminado_proveedor">Banco Predeterminado</label>
                        </div>
                        <div className="form-group floating-label">
                            <input id="numero_cuenta_proveedor" type="text" name="numero_cuenta_proveedor" value={formData.numero_cuenta_proveedor || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="numero_cuenta_proveedor">Número de Cuenta</label>
                        </div>
                        {/* ¡NUEVO CAMPO: CCI! */}
                        <div className="form-group floating-label full-width"> {/* Usar full-width si quieres que ocupe todo el ancho de la grilla */}
                            <input 
                                id="codigo_cuenta_interbancaria_proveedor" 
                                type="text" 
                                name="codigo_cuenta_interbancaria_proveedor" 
                                value={formData.codigo_cuenta_interbancaria_proveedor || ''} 
                                onChange={handleChange} 
                                disabled={isViewMode} 
                                placeholder=" " 
                            />
                            <label htmlFor="codigo_cuenta_interbancaria_proveedor">CCI (Cuenta Interbancaria)</label>
                            {/* Opcional: añadir validación aquí para el formato del CCI */}
                        </div>
                        {/* FIN NUEVO CAMPO CCI */}
                        <div className="form-group floating-label">
                            <input id="tipo_servicio_principal_proveedor" type="text" name="tipo_servicio_principal_proveedor" value={formData.tipo_servicio_principal_proveedor || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="tipo_servicio_principal_proveedor">Tipo de Servicio Principal</label>
                        </div>
                        <div className="form-group floating-label full-width">
                            <textarea id="observaciones_generales" name="observaciones_generales" value={formData.observaciones_generales || ''} onChange={handleChange} rows={2} disabled={isViewMode} placeholder=" "></textarea>
                            <label htmlFor="observaciones_generales">Observaciones Generales</label>
                        </div>
                        <div className="form-group checkbox-group">
                            <input id="es_agente_retencion_igv" type="checkbox" name="es_agente_retencion_igv" checked={formData.es_agente_retencion_igv ?? false} onChange={handleChange} disabled={isViewMode} />
                            <label htmlFor="es_agente_retencion_igv">Agente de Retención</label>
                        </div>
                        <div className="form-group checkbox-group">
                            <input id="requiere_pago_detraccion" type="checkbox" name="requiere_pago_detraccion" checked={formData.requiere_pago_detraccion ?? false} onChange={handleChange} disabled={isViewMode} />
                            <label htmlFor="requiere_pago_detraccion">Sujeto a Detracción</label>
                        </div>
                        {selectedProveedor && (
                            <div className="form-group floating-label">
                                <select id="estado_proveedor" name="estado_proveedor" value={formData.estado_proveedor || 'Activo'} onChange={handleChange} disabled={isViewMode}>
                                    <option value="Activo">Activo</option>
                                    <option value="Inactivo">Inactivo</option>
                                </select>
                                <label htmlFor="estado_proveedor">Estado</label>
                            </div>
                        )}
                    </div>

                    {isViewMode && selectedProveedor && (
                        <div className="audit-section">
                            <h4>Información de Auditoría</h4>
                            <p><strong>Creado por:</strong> {selectedProveedor.creado_por || 'N/A'}</p>
                            <p><strong>Fecha de Creación:</strong> {formatDate(selectedProveedor.fecha_creacion)}</p>
                            <p><strong>Última Modificación por:</strong> {selectedProveedor.modificado_por || 'N/A'}</p>
                            <p><strong>Fecha de Modificación:</strong> {formatDate(selectedProveedor.fecha_modificacion)}</p>
                        </div>
                    )}

                    <div className="form-actions">
                        <button type="button" className="btn-secondary" onClick={handleCloseModal}>{isViewMode ? 'Cerrar' : 'Cancelar'}</button>
                        {!isViewMode && <button type="submit" className="btn-primary">{selectedProveedor ? 'Guardar Cambios' : 'Crear Proveedor'}</button>}
                    </div>
                </form>
            </Modal>
        </>
    );
};

export default ListaProveedoresPage;