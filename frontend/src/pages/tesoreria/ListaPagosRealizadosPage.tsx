// Archivo: frontend/src/pages/tesoreria/ListaPagosRealizadosPage.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { 
    fetchPagosRealizados, 
    createPagoRealizado, 
    updatePagoRealizado, 
    deletePagoRealizado, 
    fetchPagoRealizadoById,
    exportPagosRealizados,
    type PagoRealizado, 
    type PagedPagosRealizadosResponse,
    type PagoRealizadoFilters
} from '../../services/pagoRealizadoService';
import { fetchProveedores, type Proveedor } from '../../services/proveedorService'; // Para el selector de proveedores
import { fetchCuentasBancarias, type CuentaBancariaPropia } from '../../services/cuentaBancariaService'; // Para el selector de cuentas bancarias
import { showSuccessToast, showErrorAlert, showConfirmDialog, showValidationErrorAlert } from '../../services/notificationService';
import Modal from '../../components/common/Modal';
import { FileDown, FilterX, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus } from 'lucide-react';
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

// Función auxiliar para formatear fecha a YYYY-MM-DD para input type="date"
const formatToInputDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const ListaPagosRealizadosPage = () => {
    const [pagos, setPagos] = useState<PagoRealizado[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedPago, setSelectedPago] = useState<PagoRealizado | null>(null);
    const [isViewMode, setIsViewMode] = useState(false);
    const [formErrors, setFormErrors] = useState<FormErrors>({});
    

    // Datos para selects
    const [proveedores, setProveedores] = useState<Proveedor[]>([]);
    const [cuentasBancarias, setCuentasBancarias] = useState<CuentaBancariaPropia[]>([]);
    const mediosPago = ['Transferencia Bancaria', 'Cheque', 'Efectivo', 'Tarjeta de Crédito', 'Tarjeta de Débito', 'Otros'];
    const estadosPago = ['Realizado', 'Pendiente', 'Anulado'];
    const monedas = [
        { id: 1, codigo: 'PEN', nombre: 'Soles Peruanos', simbolo: 'S/' },
        { id: 2, codigo: 'USD', nombre: 'Dólares Americanos', simbolo: '$' },
    ];

    const [filters, setFilters] = useState<PagoRealizadoFilters>({
        medio_pago_utilizado: '',
        proveedor_razon_social: '', 
        estado_pago: ''
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const ROWS_PER_PAGE = 8;

    const initialFormData: Partial<PagoRealizado> = {
        fecha_efectiva_pago: new Date().toISOString().split('T')[0],
        moneda_id_pago: monedas[0]?.id || undefined,
        monto_total_desembolsado: 0,
        medio_pago_utilizado: mediosPago[0] || '',
        referencia_medio_pago: '',
        cuenta_bancaria_propia_origen_id: undefined,
        proveedor_id_beneficiario: undefined,
        glosa_o_descripcion_pago: '',
        estado_pago: estadosPago[0] || 'Realizado',
    };
    const [formData, setFormData] = useState<Partial<PagoRealizado>>(initialFormData);

    // Cargar datos iniciales (proveedores, cuentas bancarias)
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const proveedoresData = await fetchProveedores(1, 1000, {});
                setProveedores(proveedoresData.records);
                const cuentasData = await fetchCuentasBancarias(1, 1000, {});
                setCuentasBancarias(cuentasData.records);

                setFormData(prev => {
                    const updatedData = { ...prev };
                    if (proveedoresData.records.length > 0 && prev.proveedor_id_beneficiario === undefined) {
                        updatedData.proveedor_id_beneficiario = proveedoresData.records[0].proveedor_id;
                    }
                    if (cuentasData.records.length > 0 && prev.cuenta_bancaria_propia_origen_id === undefined) {
                        updatedData.cuenta_bancaria_propia_origen_id = cuentasData.records[0].cuenta_bancaria_id;
                    }
                    if (monedas.length > 0 && prev.moneda_id_pago === undefined) {
                        updatedData.moneda_id_pago = monedas[0].id;
                    }
                    return updatedData;
                });

                if (proveedoresData.records.length === 0) {
                    showErrorAlert('Advertencia: No hay proveedores registrados.');
                }
                if (cuentasData.records.length === 0) {
                    showErrorAlert('Advertencia: No hay cuentas bancarias registradas.');
                }
            } catch (error) {
                if (error instanceof Error) showErrorAlert(`Error al cargar datos iniciales: ${error.message}`);
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, []);

    const loadPagos = useCallback(async () => {
        try {
            setLoading(true);
            const data: PagedPagosRealizadosResponse = await fetchPagosRealizados(currentPage, ROWS_PER_PAGE, filters);
            setPagos(data.records);
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
            loadPagos();
        }, 500);
        return () => clearTimeout(timer);
    }, [loadPagos]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
        setCurrentPage(1);
    };

    const clearFilters = () => {
        setFilters({ medio_pago_utilizado: '', proveedor_razon_social: '', estado_pago: '' });
        setCurrentPage(1);
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) { 
            setCurrentPage(newPage);
        }
    };
    
    const handleExport = async () => {
        try {
            await exportPagosRealizados(filters);
        } catch (error) {
            console.error(error);
        }
    };

    const handleOpenModal = async (pago: PagoRealizado | null = null, viewMode = false) => {
        setIsViewMode(viewMode);
        setFormErrors({});
        if (pago && pago.pago_realizado_id) {
            try {
                const fullPagoData = await fetchPagoRealizadoById(pago.pago_realizado_id);
                if (!fullPagoData) { 
                    showErrorAlert('No se encontró el pago realizado o hubo un problema al cargarla.');
                    return;
                }
                // Convertir campos numéricos a Number y fechas a formato input
                const processedPagoData: PagoRealizado = {
                    ...fullPagoData,
                    monto_total_desembolsado: Number(fullPagoData.monto_total_desembolsado),
                    tipo_cambio_pago: Number(fullPagoData.tipo_cambio_pago),
                    fecha_efectiva_pago: formatToInputDate(fullPagoData.fecha_efectiva_pago),
                    // Campos de auditoría no se cargan si no existen en la BD
                    // creado_por: fullPagoData.creado_por,
                    // fecha_creacion: formatDate(fullPagoData.fecha_creacion),
                    // modificado_por: fullPagoData.modificado_por,
                    // fecha_modificacion: formatDate(fullPagoData.fecha_modificacion),
                };

                setSelectedPago(processedPagoData);
                setFormData(processedPagoData);
            } catch (error) {
                if (error instanceof Error) showErrorAlert(error.message);
                console.error("Error fetching pago realizado data:", error); 
                return;
            }
        } else {
            setSelectedPago(null);
            setFormData(initialFormData); 
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedPago(null);
        setFormData(initialFormData); 
    };

    const validateForm = (): FormErrors => {
        const errors: FormErrors = {};
        if (!formData.fecha_efectiva_pago) errors.fecha_efectiva_pago = "La fecha efectiva de pago es obligatoria.";
        if (!formData.moneda_id_pago) errors.moneda_id_pago = "La moneda es obligatoria.";
        if (formData.monto_total_desembolsado === undefined || formData.monto_total_desembolsado <= 0) errors.monto_total_desembolsado = "El monto total desembolsado debe ser mayor a 0.";
        if (!formData.medio_pago_utilizado?.trim()) errors.medio_pago_utilizado = "El medio de pago es obligatorio.";
        // Si se selecciona un medio de pago que requiere cuenta bancaria, validar cuenta
        if (['Transferencia Bancaria', 'Cheque'].includes(formData.medio_pago_utilizado || '') && !formData.cuenta_bancaria_propia_origen_id) {
            errors.cuenta_bancaria_propia_origen_id = "La cuenta bancaria de origen es obligatoria para este medio de pago.";
        }
        // Si se selecciona un medio de pago que implica proveedor, validar proveedor
        // Esto es una simplificación, en un ERP real se validaría la relación con la obligación
        if (formData.proveedor_id_beneficiario === undefined) { // Asumimos que siempre se paga a un proveedor para simplificar
            errors.proveedor_id_beneficiario = "El proveedor beneficiario es obligatorio.";
        }
        
        setFormErrors(errors);
        return errors;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        let inputValue: string | number | boolean | undefined = value;

        if (type === 'checkbox') {
            inputValue = (e.target as HTMLInputElement).checked;
        } else if (name.includes('monto') || name.includes('tipo_cambio')) {
            inputValue = value === '' ? undefined : Number(value);
        } else if (name.includes('_id')) { 
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
            if (selectedPago) {
                await updatePagoRealizado(selectedPago.pago_realizado_id!, formData);
                showSuccessToast('¡Pago realizado actualizado con éxito!');
            } else {
                await createPagoRealizado(formData as PagoRealizado);
                showSuccessToast('¡Pago realizado creado con éxito!');
            }
            handleCloseModal(); 
            loadPagos(); 
        } catch (error) {
            if (error instanceof Error) showErrorAlert(error.message);
        }
    };

    const handleDelete = async (pagoId: number) => {
        const result = await showConfirmDialog('¿Estás seguro?', 'El pago pasará a estado "Anulado".');
        if (result.isConfirmed) {
            try {
                await deletePagoRealizado(pagoId);
                showSuccessToast('Pago realizado anulado con éxito.');
                loadPagos();
            } catch (error) {
                if (error instanceof Error) showErrorAlert(error.message);
            }
        }
    };


    if (loading) return <div className="loading-spinner">Cargando...</div>;

    return (
        <div className="table-page-container">
            <div className="table-page-header">
                <h1>Pagos Realizados</h1>
                <div className="header-actions">
                    <button onClick={handleExport} className="btn-secondary">
                        <FileDown size={18} /> Exportar Excel
                    </button>
                    <button onClick={() => handleOpenModal()} className="btn-primary">
                        <Plus size={18} /> Nuevo Pago
                    </button>
                </div>
            </div>
            
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Medio de Pago</th>
                            <th>Monto</th>
                            <th>Cuenta Origen</th>
                            <th>Proveedor</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                        <tr className="filter-row">
                            <td><input type="date" name="fecha_efectiva_pago" value={filters.fecha_efectiva_pago || ''} onChange={handleFilterChange} placeholder="Buscar..." /></td>
                            <td><input type="text" name="medio_pago_utilizado" value={filters.medio_pago_utilizado || ''} onChange={handleFilterChange} placeholder="Buscar..." /></td>
                            <td></td>
                            <td></td>
                            <td><input type="text" name="proveedor_razon_social" value={filters.proveedor_razon_social || ''} onChange={handleFilterChange} placeholder="Buscar..." /></td>
                            <td>
                                <select name="estado_pago" value={filters.estado_pago || ''} onChange={handleFilterChange}>
                                    <option value="">Todos</option>
                                    {estadosPago.map(estado => (
                                        <option key={estado} value={estado}>{estado}</option>
                                    ))}
                                </select>
                            </td>
                            <td className="filter-actions">
                                <button onClick={clearFilters} className="btn-icon" title="Limpiar filtros"><FilterX size={18} /></button>
                            </td>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7}><div className="loading-spinner">Cargando...</div></td></tr>
                        ) : pagos.length > 0 ? (
                            pagos.map((pago) => (
                                <tr key={pago.pago_realizado_id}>
                                    <td>{new Date(pago.fecha_efectiva_pago).toLocaleDateString('es-PE')}</td>
                                    <td>{pago.medio_pago_utilizado}</td>
                                    <td>{pago.moneda_nombre} {Number(pago.monto_total_desembolsado).toFixed(2)}</td>
                                    <td>{pago.cuenta_bancaria_nombre || 'N/A'}</td>
                                    <td>{pago.proveedor_razon_social || 'N/A'}</td>
                                    <td>
                                        <span className={`status-badge status-${pago.estado_pago?.toLowerCase()}`}>
                                            {pago.estado_pago}
                                        </span>
                                    </td>
                                    <td>
                                        <button onClick={() => handleOpenModal(pago, true)} className="btn-icon" title="Ver">👁️</button>
                                        <button onClick={() => handleOpenModal(pago)} className="btn-icon" title="Editar">✏️</button>
                                        <button onClick={() => handleDelete(pago.pago_realizado_id!)} className="btn-icon btn-danger" title="Anular">🗑️</button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={7} className="no-data">No se encontraron pagos realizados.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="pagination-container">
                <span>Mostrando {pagos.length} de {totalRecords} registros</span>
                <div className="pagination-controls">
                    <button onClick={() => handlePageChange(1)} disabled={currentPage === 1}><ChevronsLeft size={16} /></button>
                    <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
                    <span>Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong></span>
                    <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}><ChevronRight size={16} /></button>
                    <button onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages}><ChevronsRight size={16} /></button>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={selectedPago ? (isViewMode ? 'Detalle de Pago Realizado' : 'Editar Pago Realizado') : 'Nuevo Pago Realizado'}>
                <form onSubmit={handleSubmit} className="modal-form" noValidate>
                    <div className="form-grid">
                        {/* Datos del Pago */}
                        <div className="form-group floating-label">
                            <input id="fecha_efectiva_pago" type="date" name="fecha_efectiva_pago" value={formData.fecha_efectiva_pago || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " required />
                            <label htmlFor="fecha_efectiva_pago">Fecha Efectiva de Pago</label>
                            {formErrors.fecha_efectiva_pago && <span className="error-text">{formErrors.fecha_efectiva_pago}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <select id="moneda_id_pago" name="moneda_id_pago" value={formData.moneda_id_pago || ''} onChange={handleChange} disabled={isViewMode} required>
                                <option value="">Seleccione Moneda</option>
                                {monedas.map(moneda => (
                                    <option key={moneda.id} value={moneda.id}>{moneda.nombre}</option>
                                ))}
                            </select>
                            <label htmlFor="moneda_id_pago">Moneda</label>
                            {formErrors.moneda_id_pago && <span className="error-text">{formErrors.moneda_id_pago}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <input id="monto_total_desembolsado" type="number" step="0.01" name="monto_total_desembolsado" value={formData.monto_total_desembolsado ?? ''} onChange={handleChange} disabled={isViewMode} placeholder=" " required />
                            <label htmlFor="monto_total_desembolsado">Monto Desembolsado</label>
                            {formErrors.monto_total_desembolsado && <span className="error-text">{formErrors.monto_total_desembolsado}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <select id="medio_pago_utilizado" name="medio_pago_utilizado" value={formData.medio_pago_utilizado || ''} onChange={handleChange} disabled={isViewMode} required>
                                <option value="">Seleccione Medio de Pago</option>
                                {mediosPago.map(medio => (
                                    <option key={medio} value={medio}>{medio}</option>
                                ))}
                            </select>
                            <label htmlFor="medio_pago_utilizado">Medio de Pago</label>
                            {formErrors.medio_pago_utilizado && <span className="error-text">{formErrors.medio_pago_utilizado}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <input id="referencia_medio_pago" type="text" name="referencia_medio_pago" value={formData.referencia_medio_pago || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="referencia_medio_pago">Referencia de Pago</label>
                        </div>
                        <div className="form-group floating-label">
                            <select id="cuenta_bancaria_propia_origen_id" name="cuenta_bancaria_propia_origen_id" value={formData.cuenta_bancaria_propia_origen_id || ''} onChange={handleChange} disabled={isViewMode || !['Transferencia Bancaria', 'Cheque'].includes(formData.medio_pago_utilizado || '')}>
                                <option value="">Seleccione Cuenta</option>
                                {cuentasBancarias.map(cuenta => (
                                    <option key={cuenta.cuenta_bancaria_id} value={cuenta.cuenta_bancaria_id}>{cuenta.alias_o_descripcion_cuenta || cuenta.numero_cuenta_unico}</option>
                                ))}
                            </select>
                            <label htmlFor="cuenta_bancaria_propia_origen_id">Cuenta Bancaria Origen</label>
                            {formErrors.cuenta_bancaria_propia_origen_id && <span className="error-text">{formErrors.cuenta_bancaria_propia_origen_id}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <select id="proveedor_id_beneficiario" name="proveedor_id_beneficiario" value={formData.proveedor_id_beneficiario || ''} onChange={handleChange} disabled={isViewMode} required>
                                <option value="">Seleccione Proveedor</option>
                                {proveedores.map(proveedor => (
                                    <option key={proveedor.proveedor_id} value={proveedor.proveedor_id}>{proveedor.razon_social_o_nombres}</option>
                                ))}
                            </select>
                            <label htmlFor="proveedor_id_beneficiario">Proveedor Beneficiario</label>
                            {formErrors.proveedor_id_beneficiario && <span className="error-text">{formErrors.proveedor_id_beneficiario}</span>}
                        </div>
                        <div className="form-group floating-label full-width">
                            <textarea id="glosa_o_descripcion_pago" name="glosa_o_descripcion_pago" value={formData.glosa_o_descripcion_pago || ''} onChange={handleChange} rows={2} disabled={isViewMode} placeholder=" "></textarea>
                            <label htmlFor="glosa_o_descripcion_pago">Glosa / Descripción</label>
                        </div>
                        {selectedPago && (
                            <>
                                <div className="form-group floating-label">
                                    <input id="tipo_cambio_pago" type="number" step="0.0001" name="tipo_cambio_pago" value={formData.tipo_cambio_pago ?? ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                                    <label htmlFor="tipo_cambio_pago">Tipo de Cambio</label>
                                </div>
                                <div className="form-group floating-label">
                                    <input id="estado_pago" type="text" name="estado_pago" value={formData.estado_pago || ''} disabled={true} placeholder=" " />
                                    <label htmlFor="estado_pago">Estado del Pago</label>
                                </div>
                            </>
                        )}
                    </div>

                    {isViewMode && selectedPago && (
                        <div className="audit-section">
                            <h4>Información de Auditoría</h4>
                            <p><strong>Creado por:</strong> {selectedPago.creado_por || 'N/A'}</p>
                            <p><strong>Fecha de Creación:</strong> {formatDate(selectedPago.fecha_creacion)}</p>
                            <p><strong>Última Modificación por:</strong> {selectedPago.modificado_por || 'N/A'}</p>
                            <p><strong>Fecha de Modificación:</strong> {formatDate(selectedPago.fecha_modificacion)}</p>
                        </div>
                    )}

                    <div className="form-actions">
                        <button type="button" className="btn-secondary" onClick={handleCloseModal}>{isViewMode ? 'Cerrar' : 'Cancelar'}</button>
                        {!isViewMode && <button type="submit" className="btn-primary">{selectedPago ? 'Guardar Cambios' : 'Registrar Pago'}</button>}
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default ListaPagosRealizadosPage;
