// Archivo: frontend/src/pages/tesoreria/ListaCuentasBancariasPage.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth'; // Para obtener datos del usuario logueado
import { 
    fetchCuentasBancarias, 
    createCuentaBancaria, 
    updateCuentaBancaria, 
    deleteCuentaBancaria, 
    exportarCuentasBancarias,
    fetchCuentaBancariaById,
    type CuentaBancariaPropia, 
    type PagedCuentasBancariasResponse,
    type CuentaBancariaFilters
} from '../../services/cuentaBancariaService';
import { fetchAllMonedas, type Moneda } from '../../services/monedaService'; // Importar para el selector de moneda
import { showSuccessToast, showErrorAlert, showConfirmDialog, showValidationErrorAlert } from '../../services/notificationService';
import Modal from '../../components/common/Modal';
import { FileDown, FilterX, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus } from 'lucide-react';
import '../../styles/TablePage.css';

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
    } catch  {
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

const ListaCuentasBancariasPage = () => {
    const { user: currentUser } = useAuth(); // Usuario logueado para auditoría
    const [cuentas, setCuentas] = useState<CuentaBancariaPropia[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCuenta, setSelectedCuenta] = useState<CuentaBancariaPropia | null>(null);
    const [isViewMode, setIsViewMode] = useState(false);
    const [formErrors, setFormErrors] = useState<FormErrors>({});

    // Datos para selects en el formulario
    const [monedasDisponibles, setMonedasDisponibles] = useState<Moneda[]>([]);
    const tiposCuentaBancaria = ['Corriente', 'Ahorros', 'Crédito']; // Hardcodeado si no hay tabla de tipos
    const estadosCuentaBancaria = ['Activa', 'Inactiva', 'Cerrada']; // Hardcodeado si no hay tabla de estados

    const [filters, setFilters] = useState<CuentaBancariaFilters>({
        nombre_banco: '',
        numero_cuenta_unico: '', 
        estado_cuenta_bancaria: undefined // Por defecto no filtrar por activa
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const ROWS_PER_PAGE = 8;

    // Estado para el formulario de nueva/editar cuenta
    const initialFormData: Partial<CuentaBancariaPropia> = {
        empresa_id: currentUser?.empresa_id, // Asignar la empresa del usuario logueado
        moneda_id: undefined, // Se inicializará con la primera moneda disponible
        nombre_banco: '',
        tipo_cuenta_bancaria: tiposCuentaBancaria[0], 
        numero_cuenta_unico: '',
        numero_cuenta_interbancario_cci: '',
        alias_o_descripcion_cuenta: '',
        ejecutivo_asignado_banco: '',
        saldo_contable_inicial: 0,
        fecha_saldo_contable_inicial: formatToInputDate(new Date().toISOString()), // Fecha actual por defecto
        estado_cuenta_bancaria: estadosCuentaBancaria[0],
        observaciones_cuenta: '',
    };
    const [formData, setFormData] = useState<Partial<CuentaBancariaPropia>>(initialFormData);

    // Cargar cuentas y monedas
    const loadCuentasAndDependencies = useCallback(async () => {
        try {
            setLoading(true);
            const cuentasData: PagedCuentasBancariasResponse = await fetchCuentasBancarias(currentPage, ROWS_PER_PAGE, filters);
            setCuentas(cuentasData.records);
            setTotalPages(cuentasData.total_pages);
            setTotalRecords(cuentasData.total_records);

            // Cargar todas las monedas (para el selector en el modal)
            const allMonedasData = await fetchAllMonedas(); 
            setMonedasDisponibles(allMonedasData);

            // Si es nueva cuenta, preseleccionar primera moneda y empresa
            if (!selectedCuenta) {
                setFormData(prev => ({
                    ...prev,
                    moneda_id: allMonedasData.length > 0 ? allMonedasData[0].moneda_id : undefined,
                    empresa_id: currentUser?.empresa_id || undefined,
                }));
            }

        } catch (error) {
            if (error instanceof Error) showErrorAlert(error.message);
        } finally {
            setLoading(false);
        }
    }, [currentPage, filters, currentUser?.empresa_id, selectedCuenta]); // Añadir selectedCuenta a las dependencias

    useEffect(() => {
        const timer = setTimeout(() => {
            loadCuentasAndDependencies();
        }, 500);
        return () => clearTimeout(timer);
    }, [loadCuentasAndDependencies]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target; // 'type' ya no es necesario si la lógica 'activa' se elimina
        
        // ¡CORRECCIÓN AQUÍ! Usar const, ya que filterValue no se reasigna
        const filterValue: string | undefined = value === '' ? undefined : value; 

        setFilters(prev => ({ ...prev, [name]: filterValue }));
        setCurrentPage(1);
    };

    const clearFilters = () => {
        setFilters({ 
            nombre_banco: '', 
            numero_cuenta_unico: '', 
            estado_cuenta_bancaria: undefined 
        });
        setCurrentPage(1);
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) { 
            setCurrentPage(newPage);
        }
    };
    
    const handleExport = async (currentFilters: CuentaBancariaFilters) => {
        try {
            if (currentUser?.empresa_id) {
                await exportarCuentasBancarias(currentUser.empresa_id, currentFilters);
            } else {
                console.error("empresa_id no está definido");
            } // Se requiere empresa_id en el servicio
        } catch (error) {
            console.error(error);
            if (error instanceof Error) showErrorAlert(error.message);
        }
    };

    const handleOpenModal = async (cuenta: CuentaBancariaPropia | null = null, viewMode = false) => {
        setIsViewMode(viewMode);
        setFormErrors({});

        if (cuenta && cuenta.cuenta_bancaria_id) {
            try {
                // Se requiere empresa_id para fetchCuentaBancariaById
                const fullCuentaData = await fetchCuentaBancariaById(cuenta.cuenta_bancaria_id!);
                if (!fullCuentaData) { 
                    showErrorAlert('No se encontró la cuenta bancaria o hubo un problema al cargarla.');
                    return;
                }
                // Procesar datos para el formulario
                const processedCuentaData: CuentaBancariaPropia = {
                    ...fullCuentaData,
                    saldo_contable_inicial: Number(fullCuentaData.saldo_contable_inicial),
                    fecha_saldo_contable_inicial: formatToInputDate(fullCuentaData.fecha_saldo_contable_inicial),
                    saldo_disponible_actual: Number(fullCuentaData.saldo_disponible_actual),
                    // No pasar campos de auditoría generados por el backend en el formData para edición
                };
                setSelectedCuenta(processedCuentaData);
                setFormData(processedCuentaData);
            } catch (error) {
                if (error instanceof Error) showErrorAlert(error.message);
                console.error("Error fetching account data:", error); 
                return;
            }
        } else {
            setSelectedCuenta(null);
            setFormData({ 
                ...initialFormData,
                // Asegurar que la moneda_id esté preseleccionada si hay disponibles
                moneda_id: monedasDisponibles.length > 0 ? monedasDisponibles[0].moneda_id : undefined,
                empresa_id: currentUser?.empresa_id || undefined,
            }); 
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
        if (!formData.nombre_banco?.trim()) errors.nombre_banco = "El nombre del banco es obligatorio.";
        if (!formData.tipo_cuenta_bancaria?.trim()) errors.tipo_cuenta_bancaria = "El tipo de cuenta es obligatorio.";
        if (!formData.numero_cuenta_unico?.trim()) errors.numero_cuenta_unico = "El número de cuenta es obligatorio.";
        if (!formData.moneda_id) errors.moneda_id = "La moneda es obligatoria.";
        if (formData.saldo_contable_inicial === undefined || formData.saldo_contable_inicial < 0) errors.saldo_contable_inicial = "El saldo inicial debe ser un número positivo o cero.";
        if (!formData.fecha_saldo_contable_inicial) errors.fecha_saldo_contable_inicial = "La fecha del saldo inicial es obligatoria.";
        
        setFormErrors(errors);
        return errors;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        let inputValue: string | number | boolean | undefined = value;

        if (type === 'checkbox') {
            inputValue = (e.target as HTMLInputElement).checked;
        } else if (name.includes('saldo') || name.includes('monto') || name.includes('moneda_id')) { // Incluir moneda_id si es numérica
            inputValue = value === '' ? undefined : Number(value);
        } else if (type === 'date' && value === '') { 
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
            const dataToSend: Partial<CuentaBancariaPropia> = { ...formData };
            // Los campos de auditoría y ID generado se omiten por el tipo del servicio, no se borran aquí
            // Asegurar que empresa_id esté presente para el servicio
            dataToSend.empresa_id = currentUser?.empresa_id;

            if (selectedCuenta) {
                await updateCuentaBancaria(selectedCuenta.cuenta_bancaria_id!, dataToSend);
                showSuccessToast('¡Cuenta bancaria actualizada con éxito!');
            } else {
                await createCuentaBancaria(dataToSend as CuentaBancariaPropia); 
                showSuccessToast('¡Cuenta bancaria creada con éxito!');
            }
            handleCloseModal(); 
            loadCuentasAndDependencies(); 
        } catch (error) {
            if (error instanceof Error) showErrorAlert(error.message);
        }
    };

    const handleDelete = async (cuentaId: number) => {
        const result = await showConfirmDialog('¿Estás seguro?', 'La cuenta bancaria pasará a estado "Inactiva".');
        if (result.isConfirmed) {
            try {
                // Se requiere empresa_id y datos de usuario para el servicio deleteCuentaBancaria
                const empresaId = currentUser?.empresa_id;
                const usuarioId = currentUser?.id;
                const nombreUsuario = currentUser?.nombres + ' ' + currentUser?.apellidos; 
                if (!empresaId || !usuarioId || !nombreUsuario) {
                    showErrorAlert('No se pudieron obtener los datos de empresa/usuario logueado para la auditoría.');
                    return;
                }
                await deleteCuentaBancaria(cuentaId); 
                loadCuentasAndDependencies();
            } catch (error) {
                if (error instanceof Error) showErrorAlert(error.message);
            }
        }
    };

    if (loading && cuentas.length === 0 && monedasDisponibles.length === 0) {
        return <div className="loading-spinner">Cargando...</div>;
    }

    return (
        <>
            <div className="table-page-container">
                <div className="table-page-header">
                    <h1>Gestión de Cuentas Bancarias</h1>
                    <div className="header-actions">
                        <button onClick={() => handleExport(filters)} className="btn-secondary">
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
                                <th>Banco</th>
                                <th>Nro. Cuenta</th>
                                <th>Tipo</th>
                                <th>Moneda</th>
                                <th>Saldo Actual</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                            <tr className="filter-row">
                                <td><input type="text" name="nombre_banco" value={filters.nombre_banco || ''} onChange={handleFilterChange} placeholder="Buscar..." /></td>
                                <td><input type="text" name="numero_cuenta_unico" value={filters.numero_cuenta_unico || ''} onChange={handleFilterChange} placeholder="Buscar..." /></td>
                                <td></td> 
                                <td></td> 
                                <td></td> 
                                <td>
                                    <select name="estado_cuenta_bancaria" value={filters.estado_cuenta_bancaria === undefined ? '' : filters.estado_cuenta_bancaria} onChange={handleFilterChange}>
                                        <option value="">Todos</option>
                                        <option value="Activa">Activa</option>
                                        <option value="Inactiva">Inactiva</option>
                                        <option value="Cerrada">Cerrada</option>
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
                            ) : cuentas.length > 0 ? (
                                cuentas.map((cuenta) => (
                                    <tr key={cuenta.cuenta_bancaria_id}>
                                        <td>{cuenta.nombre_banco}</td>
                                        <td>{cuenta.numero_cuenta_unico}</td>
                                        <td>{cuenta.tipo_cuenta_bancaria}</td>
                                        <td>{cuenta.moneda_nombre}</td>
                                        <td>{cuenta.moneda_nombre} {Number(cuenta.saldo_disponible_actual).toFixed(2)}</td>
                                        <td>
                                            <span className={`status-badge status-${cuenta.estado_cuenta_bancaria?.toLowerCase()}`}>
                                                {cuenta.estado_cuenta_bancaria}
                                            </span>
                                        </td>
                                        <td>
                                            <button onClick={() => handleOpenModal(cuenta, true)} className="btn-icon" title="Ver">👁️</button>
                                            <button onClick={() => handleOpenModal(cuenta)} className="btn-icon" title="Editar">✏️</button>
                                            <button onClick={() => handleDelete(cuenta.cuenta_bancaria_id!)} className="btn-icon btn-danger" title="Desactivar">🗑️</button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={7} className="no-data">No se encontraron cuentas bancarias.</td></tr>
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
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={isViewMode ? 'Detalle de Cuenta Bancaria' : (selectedCuenta ? 'Editar Cuenta Bancaria' : 'Nueva Cuenta Bancaria')}>
                <form onSubmit={handleSubmit} className="modal-form" noValidate>
                    <div className="form-grid">
                        {/* Datos Básicos de la Cuenta */}
                        <div className="form-group floating-label">
                            <input id="nombre_banco" type="text" name="nombre_banco" value={formData.nombre_banco || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " required />
                            <label htmlFor="nombre_banco">Nombre del Banco</label>
                            {formErrors.nombre_banco && <span className="error-text">{formErrors.nombre_banco}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <select id="tipo_cuenta_bancaria" name="tipo_cuenta_bancaria" value={formData.tipo_cuenta_bancaria || ''} onChange={handleChange} disabled={isViewMode} required>
                                <option value="">Seleccione Tipo</option>
                                {tiposCuentaBancaria.map(tipo => (
                                    <option key={tipo} value={tipo}>{tipo}</option>
                                ))}
                            </select>
                            <label htmlFor="tipo_cuenta_bancaria">Tipo de Cuenta</label>
                            {formErrors.tipo_cuenta_bancaria && <span className="error-text">{formErrors.tipo_cuenta_bancaria}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <input id="numero_cuenta_unico" type="text" name="numero_cuenta_unico" value={formData.numero_cuenta_unico || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " required />
                            <label htmlFor="numero_cuenta_unico">Número de Cuenta</label>
                            {formErrors.numero_cuenta_unico && <span className="error-text">{formErrors.numero_cuenta_unico}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <input id="numero_cuenta_interbancario_cci" type="text" name="numero_cuenta_interbancario_cci" value={formData.numero_cuenta_interbancario_cci || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="numero_cuenta_interbancario_cci">Número de Cuenta CCI</label>
                        </div>
                        <div className="form-group floating-label">
                            <select id="moneda_id" name="moneda_id" value={formData.moneda_id || ''} onChange={handleChange} disabled={isViewMode} required>
                                <option value="">Seleccione Moneda</option>
                                {monedasDisponibles.map(moneda => (
                                    <option key={moneda.moneda_id} value={moneda.moneda_id}>{moneda.nombre_moneda}</option>
                                ))}
                            </select>
                            <label htmlFor="moneda_id">Moneda</label>
                            {formErrors.moneda_id && <span className="error-text">{formErrors.moneda_id}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <input id="saldo_contable_inicial" type="number" step="0.01" name="saldo_contable_inicial" value={formData.saldo_contable_inicial ?? ''} onChange={handleChange} disabled={isViewMode} placeholder=" " required />
                            <label htmlFor="saldo_contable_inicial">Saldo Contable Inicial</label>
                            {formErrors.saldo_contable_inicial && <span className="error-text">{formErrors.saldo_contable_inicial}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <input id="fecha_saldo_contable_inicial" type="date" name="fecha_saldo_contable_inicial" value={formData.fecha_saldo_contable_inicial || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " required />
                            <label htmlFor="fecha_saldo_contable_inicial">Fecha Saldo Inicial</label>
                            {formErrors.fecha_saldo_contable_inicial && <span className="error-text">{formErrors.fecha_saldo_contable_inicial}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <input id="ejecutivo_asignado_banco" type="text" name="ejecutivo_asignado_banco" value={formData.ejecutivo_asignado_banco || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="ejecutivo_asignado_banco">Ejecutivo Asignado</label>
                        </div>
                        <div className="form-group floating-label full-width">
                            <textarea id="alias_o_descripcion_cuenta" name="alias_o_descripcion_cuenta" value={formData.alias_o_descripcion_cuenta || ''} onChange={handleChange} rows={2} disabled={isViewMode} placeholder=" "></textarea>
                            <label htmlFor="alias_o_descripcion_cuenta">Alias / Descripción</label>
                        </div>
                        <div className="form-group floating-label full-width">
                            <textarea id="observaciones_cuenta" name="observaciones_cuenta" value={formData.observaciones_cuenta || ''} onChange={handleChange} rows={2} disabled={isViewMode} placeholder=" "></textarea>
                            <label htmlFor="observaciones_cuenta">Observaciones</label>
                        </div>
                        {selectedCuenta && (
                            <>
                                <div className="form-group floating-label">
                                    <input id="saldo_disponible_actual" type="number" step="0.01" name="saldo_disponible_actual" value={selectedCuenta.saldo_disponible_actual ?? ''} disabled={true} placeholder=" " />
                                    <label htmlFor="saldo_disponible_actual">Saldo Disponible Actual</label>
                                </div>
                                <div className="form-group floating-label">
                                    <input id="fecha_ultimo_movimiento_registrado" type="text" name="fecha_ultimo_movimiento_registrado" value={formatDateTime(selectedCuenta.fecha_ultimo_movimiento_registrado) || ''} disabled={true} placeholder=" " />
                                    <label htmlFor="fecha_ultimo_movimiento_registrado">Último Movimiento</label>
                                </div>
                                <div className="form-group floating-label">
                                    <select id="estado_cuenta_bancaria" name="estado_cuenta_bancaria" value={formData.estado_cuenta_bancaria || ''} onChange={handleChange} disabled={isViewMode}>
                                        {estadosCuentaBancaria.map(estado => (
                                            <option key={estado} value={estado}>{estado}</option>
                                        ))}
                                    </select>
                                    <label htmlFor="estado_cuenta_bancaria">Estado de Cuenta</label>
                                </div>
                            </>
                        )}
                    </div>

                    {isViewMode && selectedCuenta && (
                        <div className="audit-section">
                            <h4>Información de Auditoría</h4>
                            <p><strong>Creado por:</strong> {selectedCuenta.creado_por || 'N/A'}</p>
                            <p><strong>Fecha de Creación:</strong> {formatDateTime(selectedCuenta.fecha_creacion)}</p> 
                            <p><strong>Última Modificación por:</strong> {selectedCuenta.modificado_por || 'N/A'}</p>
                            <p><strong>Fecha de Modificación:</strong> {formatDateTime(selectedCuenta.fecha_modificacion)}</p>
                        </div>
                    )}

                    <div className="form-actions">
                        <button type="button" className="btn-secondary" onClick={handleCloseModal}>{isViewMode ? 'Cerrar' : 'Cancelar'}</button>
                        {!isViewMode && <button type="submit" className="btn-primary">{selectedCuenta ? 'Guardar Cambios' : 'Crear Cuenta Bancaria'}</button>}
                    </div>
                </form>
            </Modal>
        </>
    );
};

export default ListaCuentasBancariasPage;