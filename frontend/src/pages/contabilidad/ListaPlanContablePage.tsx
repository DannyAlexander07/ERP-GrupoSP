// Archivo: frontend/src/pages/contabilidad/ListaPlanContablePage.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { 
    fetchPlanContable, 
    createCuentaContable, 
    updateCuentaContable, 
    deleteCuentaContable, 
    fetchCuentaContableById,
    exportPlanContable,
    type CuentaContable, 
    type PagedPlanContableResponse,
    type PlanContableFilters
} from '../../services/planContableService';
import { showSuccessToast, showErrorAlert, showConfirmDialog, showValidationErrorAlert } from '../../services/notificationService';
import Modal from '../../components/common/Modal';
import { FileDown, FilterX, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus } from 'lucide-react';
import '../../styles/TablePage.css';

interface FormErrors { [key: string]: string; }

// Función para formatear fechas de manera legible (para auditoría)
const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('es-PE', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

const ListaPlanContablePage = () => {
    const [cuentas, setCuentas] = useState<CuentaContable[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCuenta, setSelectedCuenta] = useState<CuentaContable | null>(null);
    const [isViewMode, setIsViewMode] = useState(false);
    const [formErrors, setFormErrors] = useState<FormErrors>({});

    // Datos para selects (hardcodeados por ahora, si no hay servicios para obtenerlos)
    const tiposCuentaGeneral = ['Activo', 'Pasivo', 'Patrimonio', 'Ingresos', 'Gastos', 'Costo'];
    const naturalezaSaldoCuenta = ['Deudor', 'Acreedor'];
    const estadosCuenta = ['Activa', 'Inactiva'];
    const monedas = [ // Asumiendo que Monedas ya está poblada en la BD con IDs 1 y 2
        { id: 1, nombre: 'Soles Peruanos' },
        { id: 2, nombre: 'Dólares Americanos' },
    ];
    // Para la cuenta padre, se cargará la lista de cuentas existentes
    const [cuentasPadre, setCuentasPadre] = useState<CuentaContable[]>([]);

    const [filters, setFilters] = useState<PlanContableFilters>({
        codigo_cuenta: '',
        nombre_cuenta_contable: '', 
        tipo_cuenta_general: '',
        estado_cuenta: ''
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const ROWS_PER_PAGE = 8;

    const initialFormData: Partial<CuentaContable> = {
        codigo_cuenta: '',
        nombre_cuenta_contable: '',
        tipo_cuenta_general: tiposCuentaGeneral[0] || '',
        nivel_jerarquia_cuenta: 1,
        moneda_id_predeterminada_cuenta: monedas[0]?.id || undefined,
        permite_movimientos_directos: true,
        naturaleza_saldo_cuenta: naturalezaSaldoCuenta[0] || '',
        cuenta_padre_id: undefined,
        requiere_analisis_por_centro_costo: false,
        requiere_analisis_por_tercero: false,
        estado_cuenta: estadosCuenta[0] || 'Activa',
        observaciones_cuenta: '',
    };
    const [formData, setFormData] = useState<Partial<CuentaContable>>(initialFormData);

    // Cargar cuentas contables y cuentas padre para selects
    const loadCuentas = useCallback(async () => {
        try {
            setLoading(true);
            const data: PagedPlanContableResponse = await fetchPlanContable(currentPage, ROWS_PER_PAGE, filters);
            setCuentas(data.records);
            setTotalPages(data.total_pages);
            setTotalRecords(data.total_records);

            // Cargar todas las cuentas para el selector de cuenta padre (sin paginación)
            const allCuentasData = await fetchPlanContable(1, 9999, {}); 
            setCuentasPadre(allCuentasData.records);
        } catch (error) {
            if (error instanceof Error) showErrorAlert(error.message);
        } finally {
            setLoading(false);
        }
    }, [currentPage, filters]);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadCuentas();
        }, 500);
        return () => clearTimeout(timer);
    }, [loadCuentas]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
        setCurrentPage(1);
    };

    const clearFilters = () => {
        setFilters({ codigo_cuenta: '', nombre_cuenta_contable: '', tipo_cuenta_general: '', estado_cuenta: '' });
        setCurrentPage(1);
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) { 
            setCurrentPage(newPage);
        }
    };
    
    const handleExport = async () => {
        try {
            await exportPlanContable(filters);
        } catch (error) {
            console.error(error);
        }
    };

    const handleOpenModal = async (cuenta: CuentaContable | null = null, viewMode = false) => {
        setIsViewMode(viewMode);
        setFormErrors({});
        if (cuenta && cuenta.cuenta_contable_id) {
            try {
                const fullCuentaData = await fetchCuentaContableById(cuenta.cuenta_contable_id);
                if (!fullCuentaData) { 
                    showErrorAlert('No se encontró la cuenta contable o hubo un problema al cargarla.');
                    return;
                }
                // Convertir campos numéricos a Number
                const processedCuentaData: CuentaContable = {
                    ...fullCuentaData,
                    nivel_jerarquia_cuenta: Number(fullCuentaData.nivel_jerarquia_cuenta),
                    moneda_id_predeterminada_cuenta: Number(fullCuentaData.moneda_id_predeterminada_cuenta),
                    // Campos booleanos
                    permite_movimientos_directos: fullCuentaData.permite_movimientos_directos ?? false,
                    requiere_analisis_por_centro_costo: fullCuentaData.requiere_analisis_por_centro_costo ?? false,
                    requiere_analisis_por_tercero: fullCuentaData.requiere_analisis_por_tercero ?? false,
                };

                setSelectedCuenta(processedCuentaData);
                setFormData(processedCuentaData);
            } catch (error) {
                if (error instanceof Error) showErrorAlert(error.message);
                console.error("Error fetching cuenta contable data:", error); 
                return;
            }
        } else {
            setSelectedCuenta(null);
            setFormData(initialFormData); 
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedCuenta(null);
        setFormData(initialFormData); 
    };

    const validateForm = (): FormErrors => {
        const errors: FormErrors = {};
        if (!formData.codigo_cuenta?.trim()) errors.codigo_cuenta = "El código de cuenta es obligatorio.";
        if (!formData.nombre_cuenta_contable?.trim()) errors.nombre_cuenta_contable = "El nombre de cuenta es obligatorio.";
        if (!formData.tipo_cuenta_general?.trim()) errors.tipo_cuenta_general = "El tipo de cuenta general es obligatorio.";
        if (formData.nivel_jerarquia_cuenta === undefined || formData.nivel_jerarquia_cuenta <= 0) errors.nivel_jerarquia_cuenta = "El nivel de jerarquía es obligatorio y debe ser mayor a 0.";
        if (!formData.naturaleza_saldo_cuenta?.trim()) errors.naturaleza_saldo_cuenta = "La naturaleza del saldo es obligatoria.";
        
        setFormErrors(errors);
        return errors;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        let inputValue: string | number | boolean | undefined = value;

        if (type === 'checkbox') {
            inputValue = (e.target as HTMLInputElement).checked;
        } else if (name.includes('nivel_jerarquia_cuenta') || name.includes('_id')) { 
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
            if (selectedCuenta) {
                await updateCuentaContable(selectedCuenta.cuenta_contable_id!, formData);
                showSuccessToast('¡Cuenta contable actualizada con éxito!');
            } else {
                await createCuentaContable(formData as CuentaContable);
                showSuccessToast('¡Cuenta contable creada con éxito!');
            }
            handleCloseModal(); 
            loadCuentas(); 
        } catch (error) {
            if (error instanceof Error) showErrorAlert(error.message);
        }
    };

    const handleDelete = async (cuentaId: number) => {
        const result = await showConfirmDialog('¿Estás seguro?', 'La cuenta contable pasará a estado "Inactiva".');
        if (result.isConfirmed) {
            try {
                await deleteCuentaContable(cuentaId);
                showSuccessToast('Cuenta contable desactivada con éxito.');
                loadCuentas();
            } catch (error) {
                if (error instanceof Error) showErrorAlert(error.message);
            }
        }
    };


    if (loading) return <div className="loading-spinner">Cargando...</div>;

    return (
        <div className="table-page-container">
            <div className="table-page-header">
                <h1>Plan de Cuentas</h1>
                <div className="header-actions">
                    <button onClick={handleExport} className="btn-secondary">
                        <FileDown size={18} /> Exportar Excel
                    </button>
                    <button onClick={() => handleOpenModal()} className="btn-primary">
                        <Plus size={18} /> Nueva Cuenta
                    </button>
                </div>
            </div>
            
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Nombre de Cuenta</th>
                            <th>Tipo General</th>
                            <th>Nivel</th>
                            <th>Moneda</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                        <tr className="filter-row">
                            <td>
                            <input
                                type="text"
                                name="codigo_cuenta"
                                value={filters.codigo_cuenta}
                                onChange={handleFilterChange}
                                placeholder="Buscar..."
                            />
                            </td>
                            <td>
                            <input
                                type="text"
                                name="nombre_cuenta_contable"
                                value={filters.nombre_cuenta_contable}
                                onChange={handleFilterChange}
                                placeholder="Buscar..."
                            />
                            </td>
                            <td>
                            <select
                                name="tipo_cuenta_general"
                                value={filters.tipo_cuenta_general || ''}
                                onChange={handleFilterChange}
                            >
                                <option value="">Todos</option>
                                {tiposCuentaGeneral.map((tipo) => (
                                <option key={tipo} value={tipo}>
                                    {tipo}
                                </option>
                                ))}
                            </select>
                            </td>
                            <td></td>
                            <td></td>
                            <td>
                            <select
                                name="estado_cuenta"
                                value={filters.estado_cuenta || ''}
                                onChange={handleFilterChange}
                            >
                                <option value="">Todos</option>
                                {estadosCuenta.map((estado) => (
                                <option key={estado} value={estado}>
                                    {estado}
                                </option>
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
                            <tr><td colSpan={7}><div className="loading-spinner">Cargando...</div></td></tr>
                        ) : cuentas.length > 0 ? (
                            cuentas.map((cuenta) => (
                                <tr key={cuenta.cuenta_contable_id}>
                                    <td>{cuenta.codigo_cuenta}</td>
                                    <td>{cuenta.nombre_cuenta_contable}</td>
                                    <td>{cuenta.tipo_cuenta_general}</td>
                                    <td>{cuenta.nivel_jerarquia_cuenta}</td>
                                    <td>{cuenta.moneda_nombre}</td>
                                    <td>
                                        <span className={`status-badge status-${cuenta.estado_cuenta?.toLowerCase()}`}>
                                            {cuenta.estado_cuenta}
                                        </span>
                                    </td>
                                    <td>
                                        <button onClick={() => handleOpenModal(cuenta, true)} className="btn-icon" title="Ver">👁️</button>
                                        <button onClick={() => handleOpenModal(cuenta)} className="btn-icon" title="Editar">✏️</button>
                                        <button onClick={() => handleDelete(cuenta.cuenta_contable_id!)} className="btn-icon btn-danger" title="Desactivar">🗑️</button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={7} className="no-data">No se encontraron cuentas contables.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="pagination-container">
                <span>Mostrando {cuentas.length} de {totalRecords} registros</span>
                <div className="pagination-controls">
                    <button onClick={() => handlePageChange(1)} disabled={currentPage === 1}><ChevronsLeft size={16} /></button>
                    <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
                    <span>Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong></span>
                    <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}><ChevronRight size={16} /></button>
                    <button onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages}><ChevronsRight size={16} /></button>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={selectedCuenta ? (isViewMode ? 'Detalle de Cuenta Contable' : 'Editar Cuenta Contable') : 'Nueva Cuenta Contable'}>
                <form onSubmit={handleSubmit} className="modal-form" noValidate>
                    <div className="form-grid">
                        {/* Datos de la Cuenta Contable */}
                        <div className="form-group floating-label">
                            <input id="codigo_cuenta" type="text" name="codigo_cuenta" value={formData.codigo_cuenta || ''} onChange={handleChange} disabled={isViewMode || !!selectedCuenta} placeholder=" " required />
                            <label htmlFor="codigo_cuenta">Código de Cuenta</label>
                            {formErrors.codigo_cuenta && <span className="error-text">{formErrors.codigo_cuenta}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <input id="nombre_cuenta_contable" type="text" name="nombre_cuenta_contable" value={formData.nombre_cuenta_contable || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " required />
                            <label htmlFor="nombre_cuenta_contable">Nombre de Cuenta</label>
                            {formErrors.nombre_cuenta_contable && <span className="error-text">{formErrors.nombre_cuenta_contable}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <select id="tipo_cuenta_general" name="tipo_cuenta_general" value={formData.tipo_cuenta_general || ''} onChange={handleChange} disabled={isViewMode} required>
                                <option value="">Seleccione Tipo</option>
                                {tiposCuentaGeneral.map(tipo => (
                                    <option key={tipo} value={tipo}>{tipo}</option>
                                ))}
                            </select>
                            <label htmlFor="tipo_cuenta_general">Tipo de Cuenta General</label>
                            {formErrors.tipo_cuenta_general && <span className="error-text">{formErrors.tipo_cuenta_general}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <input id="nivel_jerarquia_cuenta" type="number" name="nivel_jerarquia_cuenta" value={formData.nivel_jerarquia_cuenta ?? ''} onChange={handleChange} disabled={isViewMode} placeholder=" " required />
                            <label htmlFor="nivel_jerarquia_cuenta">Nivel de Jerarquía</label>
                            {formErrors.nivel_jerarquia_cuenta && <span className="error-text">{formErrors.nivel_jerarquia_cuenta}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <select id="moneda_id_predeterminada_cuenta" name="moneda_id_predeterminada_cuenta" value={formData.moneda_id_predeterminada_cuenta || ''} onChange={handleChange} disabled={isViewMode}>
                                <option value="">Seleccione Moneda</option>
                                {monedas.map(moneda => (
                                    <option key={moneda.id} value={moneda.id}>{moneda.nombre}</option>
                                ))}
                            </select>
                            <label htmlFor="moneda_id_predeterminada_cuenta">Moneda Predeterminada</label>
                        </div>
                        <div className="form-group floating-label">
                            <select id="naturaleza_saldo_cuenta" name="naturaleza_saldo_cuenta" value={formData.naturaleza_saldo_cuenta || ''} onChange={handleChange} disabled={isViewMode} required>
                                <option value="">Seleccione Naturaleza</option>
                                {naturalezaSaldoCuenta.map(naturaleza => (
                                    <option key={naturaleza} value={naturaleza}>{naturaleza}</option>
                                ))}
                            </select>
                            <label htmlFor="naturaleza_saldo_cuenta">Naturaleza del Saldo</label>
                            {formErrors.naturaleza_saldo_cuenta && <span className="error-text">{formErrors.naturaleza_saldo_cuenta}</span>}
                        </div>
                        <div className="form-group checkbox-group">
                            <input id="permite_movimientos_directos" type="checkbox" name="permite_movimientos_directos" checked={formData.permite_movimientos_directos ?? false} onChange={handleChange} disabled={isViewMode} />
                            <label htmlFor="permite_movimientos_directos">Permite Movimientos Directos</label>
                        </div>
                        <div className="form-group floating-label">
                            <select id="cuenta_padre_id" name="cuenta_padre_id" value={formData.cuenta_padre_id || ''} onChange={handleChange} disabled={isViewMode}>
                                <option value="">Seleccione Cuenta Padre (Opcional)</option>
                                {cuentasPadre.filter(cp => cp.cuenta_contable_id !== selectedCuenta?.cuenta_contable_id).map(cp => ( // Evitar que una cuenta sea su propia padre
                                    <option key={cp.cuenta_contable_id} value={cp.cuenta_contable_id}>{cp.codigo_cuenta} - {cp.nombre_cuenta_contable}</option>
                                ))}
                            </select>
                            <label htmlFor="cuenta_padre_id">Cuenta Padre</label>
                        </div>
                        <div className="form-group checkbox-group">
                            <input id="requiere_analisis_por_centro_costo" type="checkbox" name="requiere_analisis_por_centro_costo" checked={formData.requiere_analisis_por_centro_costo ?? false} onChange={handleChange} disabled={isViewMode} />
                            <label htmlFor="requiere_analisis_por_centro_costo">Requiere Análisis por Centro de Costo</label>
                        </div>
                        <div className="form-group checkbox-group">
                            <input id="requiere_analisis_por_tercero" type="checkbox" name="requiere_analisis_por_tercero" checked={formData.requiere_analisis_por_tercero ?? false} onChange={handleChange} disabled={isViewMode} />
                            <label htmlFor="requiere_analisis_por_tercero">Requiere Análisis por Tercero</label>
                        </div>
                        <div className="form-group floating-label full-width">
                            <textarea id="observaciones_cuenta" name="observaciones_cuenta" value={formData.observaciones_cuenta || ''} onChange={handleChange} rows={2} disabled={isViewMode} placeholder=" "></textarea>
                            <label htmlFor="observaciones_cuenta">Observaciones</label>
                        </div>
                        {selectedCuenta && (
                            <div className="form-group floating-label">
                                <select id="estado_cuenta" name="estado_cuenta" value={formData.estado_cuenta || ''} onChange={handleChange} disabled={isViewMode}>
                                    {estadosCuenta.map(estado => (
                                        <option key={estado} value={estado}>{estado}</option>
                                    ))}
                                </select>
                                <label htmlFor="estado_cuenta">Estado de Cuenta</label>
                            </div>
                        )}
                    </div>

                    {isViewMode && selectedCuenta && (
                        <div className="audit-section">
                            <h4>Información de Auditoría</h4>
                            <p><strong>Creado por:</strong> {selectedCuenta.creado_por || 'N/A'}</p>
                            <p><strong>Fecha de Creación:</strong> {formatDate(selectedCuenta.fecha_creacion)}</p>
                            <p><strong>Última Modificación por:</strong> {selectedCuenta.modificado_por || 'N/A'}</p>
                            <p><strong>Fecha de Modificación:</strong> {formatDate(selectedCuenta.fecha_modificacion)}</p>
                        </div>
                    )}

                    <div className="form-actions">
                        <button type="button" className="btn-secondary" onClick={handleCloseModal}>{isViewMode ? 'Cerrar' : 'Cancelar'}</button>
                        {!isViewMode && <button type="submit" className="btn-primary">{selectedCuenta ? 'Guardar Cambios' : 'Crear Cuenta Contable'}</button>}
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default ListaPlanContablePage;
