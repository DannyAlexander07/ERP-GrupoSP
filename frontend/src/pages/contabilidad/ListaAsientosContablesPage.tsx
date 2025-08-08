// Archivo: frontend/src/pages/contabilidad/ListaAsientosContablesPage.tsx
import React, { useEffect, useState, useCallback } from 'react';
//import { useNavigate } from 'react-router-dom';
import { 
    fetchAsientosContables, 
    createAsientoContable, 
    updateAsientoContable, 
    deleteAsientoContable, 
    fetchAsientoContableById,
    exportAsientosContables,
    type AsientoContableCabecera, 
    type AsientoContableDetalle,
    type PagedAsientosContablesResponse,
    type AsientoContableFilters
} from '../../services/asientoContableService';
import { fetchPlanContable, type CuentaContable } from '../../services/planContableService'; // Para el selector de cuentas contables
import { fetchClientes, type Cliente } from '../../services/clienteService'; // Para el selector de terceros
import { fetchProveedores, type Proveedor } from '../../services/proveedorService'; // Para el selector de terceros
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

const ListaAsientosContablesPage = () => {
    const [asientos, setAsientos] = useState<AsientoContableCabecera[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAsiento, setSelectedAsiento] = useState<AsientoContableCabecera | null>(null);
    const [isViewMode, setIsViewMode] = useState(false);
    const [formErrors, setFormErrors] = useState<FormErrors>({});
    
    //const navigate = useNavigate();

    // Datos para selects
    const [cuentasContables, setCuentasContables] = useState<CuentaContable[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]); // Para terceros
    const [proveedores, setProveedores] = useState<Proveedor[]>([]); // Para terceros

    const tiposAsientoContable = [
        { id: 1, codigo: 'VTA', descripcion: 'Asiento de Venta' },
        { id: 2, codigo: 'CPA', descripcion: 'Asiento de Compra' },
        { id: 3, codigo: 'DIA', descripcion: 'Asiento de Diario' },
    ];
    const estadosAsiento = ['Borrador', 'Cuadrado', 'Mayorizado', 'Anulado'];
    const monedas = [
        { id: 1, codigo: 'PEN', nombre: 'Soles Peruanos', simbolo: 'S/' },
        { id: 2, codigo: 'USD', nombre: 'Dólares Americanos', simbolo: '$' },
    ];
    //const naturalezaSaldo = ['Deudor', 'Acreedor']; // Para el detalle
    const tiposTercero = ['Cliente', 'Proveedor', 'Empleado', 'Otros']; // Para el detalle

    // Asumiendo que tienes una tabla PeriodosContables y puedes obtenerlos
    const periodosContables = [
        { id: 1, anio_ejercicio: 2025, mes_ejercicio: 1, descripcion: '2025-01' },
        { id: 2, anio_ejercicio: 2025, mes_ejercicio: 2, descripcion: '2025-02' },
        { id: 3, anio_ejercicio: 2025, mes_ejercicio: 7, descripcion: '2025-07' },
    ];

    const [filters, setFilters] = useState<AsientoContableFilters>({
        numero_asiento_completo: '',
        tipo_asiento_descripcion: '', 
        estado_asiento: ''
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const ROWS_PER_PAGE = 8;

    const initialFormData: Partial<AsientoContableCabecera> = {
        periodo_contable_id: periodosContables[0]?.id || undefined,
        tipo_asiento_contable_id: tiposAsientoContable[0]?.id || undefined,
        fecha_contabilizacion_asiento: new Date().toISOString().split('T')[0],
        moneda_id_asiento: monedas[0]?.id || undefined,
        tipo_cambio_asiento: 1.0000,
        glosa_principal_asiento: '',
        total_debe_asiento: 0,
        total_haber_asiento: 0,
        estado_asiento: estadosAsiento[0] || 'Cuadrado',
        origen_documento_referencia_id: undefined,
        origen_documento_tabla_referencia: '',
        detalles: [],
    };
    const [formData, setFormData] = useState<Partial<AsientoContableCabecera>>(initialFormData);

    // Cargar datos iniciales (cuentas contables, clientes, proveedores)
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const cuentasData = await fetchPlanContable(1, 1000, {});
                setCuentasContables(cuentasData.records);
                const clientesData = await fetchClientes(1, 1000, {});
                setClientes(clientesData.records);
                const proveedoresData = await fetchProveedores(1, 1000, {});
                setProveedores(proveedoresData.records);

                // Ajustar initialFormData con datos cargados si existen
                setFormData(prev => {
                    const updatedData = { ...prev };
                    if (cuentasData.records.length > 0 && (!updatedData.detalles || updatedData.detalles.length === 0)) { 
                        // Si no hay detalles, inicializar con uno si hay cuentas
                        updatedData.detalles = [{
                            secuencia_linea_asiento: 1,
                            cuenta_contable_id: cuentasData.records[0].cuenta_contable_id!,
                            moneda_id_linea: monedas[0]?.id || 1,
                            monto_debe: 0,
                            monto_haber: 0,
                            // Inicializar propiedades de análisis si la cuenta lo requiere
                            requiere_analisis_por_centro_costo: cuentasData.records[0].requiere_analisis_por_centro_costo ?? false,
                            requiere_analisis_por_tercero: cuentasData.records[0].requiere_analisis_por_tercero ?? false,
                        }];
                    }
                    if (periodosContables.length > 0 && updatedData.periodo_contable_id === undefined) {
                        updatedData.periodo_contable_id = periodosContables[0].id;
                    }
                    if (tiposAsientoContable.length > 0 && updatedData.tipo_asiento_contable_id === undefined) {
                        updatedData.tipo_asiento_contable_id = tiposAsientoContable[0].id;
                    }
                    if (monedas.length > 0 && updatedData.moneda_id_asiento === undefined) {
                        updatedData.moneda_id_asiento = monedas[0].id;
                    }
                    return updatedData;
                });

                if (cuentasData.records.length === 0) showErrorAlert('Advertencia: No hay cuentas contables registradas.');
                //if (clientes.length === 0) console.warn('Advertencia: No hay clientes registrados para análisis por tercero.');
                //if (proveedores.length === 0) console.warn('Advertencia: No hay proveedores registrados para análisis por tercero.');

            } catch (error) {
                if (error instanceof Error) showErrorAlert(`Error al cargar datos iniciales: ${error.message}`);
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, []); 

    const loadAsientos = useCallback(async () => {
        try {
            setLoading(true);
            const data: PagedAsientosContablesResponse = await fetchAsientosContables(currentPage, ROWS_PER_PAGE, filters);
            setAsientos(data.records);
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
            loadAsientos();
        }, 500);
        return () => clearTimeout(timer);
    }, [loadAsientos]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
        setCurrentPage(1);
    };

    const clearFilters = () => {
        setFilters({ numero_asiento_completo: '', tipo_asiento_descripcion: '', estado_asiento: '' });
        setCurrentPage(1);
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) { 
            setCurrentPage(newPage);
        }
    };
    
    const handleExport = async () => {
        try {
            await exportAsientosContables(filters);
        } catch (error) {
            console.error(error);
        }
    };

    const handleOpenModal = async (asiento: AsientoContableCabecera | null = null, viewMode = false) => {
        setIsViewMode(viewMode);
        setFormErrors({});
        if (asiento && asiento.asiento_cabecera_id) {
            try {
                const fullAsientoData = await fetchAsientoContableById(asiento.asiento_cabecera_id);
                if (!fullAsientoData) { 
                    showErrorAlert('No se encontró el asiento contable o hubo un problema al cargarla.');
                    return;
                }
                // Convertir campos numéricos y fechas a formato input
                const processedAsientoData: AsientoContableCabecera = {
                    ...fullAsientoData,
                    fecha_contabilizacion_asiento: formatToInputDate(fullAsientoData.fecha_contabilizacion_asiento),
                    tipo_cambio_asiento: Number(fullAsientoData.tipo_cambio_asiento),
                    total_debe_asiento: Number(fullAsientoData.total_debe_asiento),
                    total_haber_asiento: Number(fullAsientoData.total_haber_asiento),
                    detalles: fullAsientoData.detalles?.map(d => {
                        const cuentaAsociada = cuentasContables.find(c => c.cuenta_contable_id === d.cuenta_contable_id);
                        return {
                            ...d,
                            monto_debe: Number(d.monto_debe),
                            monto_haber: Number(d.monto_haber),
                            importe_moneda_origen_linea: Number(d.importe_moneda_origen_linea),
                            fecha_documento_referencia_linea: formatToInputDate(d.fecha_documento_referencia_linea),
                            // Adjuntar las propiedades de análisis de la cuenta a la línea de detalle para la UI
                            requiere_analisis_por_centro_costo: cuentaAsociada?.requiere_analisis_por_centro_costo ?? false,
                            requiere_analisis_por_tercero: cuentaAsociada?.requiere_analisis_por_tercero ?? false,
                        };
                    }) || [],
                };

                setSelectedAsiento(processedAsientoData);
                setFormData(processedAsientoData);
            } catch (error) {
                if (error instanceof Error) showErrorAlert(error.message);
                console.error("Error fetching asiento contable data:", error); 
                return;
            }
        } else {
            setSelectedAsiento(null);
            setFormData(initialFormData); 
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedAsiento(null);
        setFormData(initialFormData); 
    };

    const validateForm = (): FormErrors => {
        const errors: FormErrors = {};
        if (!formData.periodo_contable_id) errors.periodo_contable_id = "El período contable es obligatorio.";
        if (!formData.tipo_asiento_contable_id) errors.tipo_asiento_contable_id = "El tipo de asiento es obligatorio.";
        if (!formData.fecha_contabilizacion_asiento) errors.fecha_contabilizacion_asiento = "La fecha de contabilización es obligatoria.";
        if (!formData.moneda_id_asiento) errors.moneda_id_asiento = "La moneda del asiento es obligatoria.";
        if (!formData.glosa_principal_asiento?.trim()) errors.glosa_principal_asiento = "La glosa principal es obligatoria.";
        if (Number(formData.total_debe_asiento).toFixed(2) !== Number(formData.total_haber_asiento).toFixed(2)) {
            errors.total_debe_asiento = "El total del Debe y el Haber deben ser iguales.";
            errors.total_haber_asiento = "El total del Debe y el Haber deben ser iguales.";
        }

        formData.detalles?.forEach((detalle, index) => {
            if (!detalle.cuenta_contable_id) errors[`detalle_cuenta_contable_id_${index}`] = `La cuenta contable en la línea ${index + 1} es obligatoria.`;
            if (detalle.monto_debe === undefined && detalle.monto_haber === undefined) errors[`detalle_monto_${index}`] = `El monto Debe o Haber en la línea ${index + 1} es obligatorio.`;
            if (detalle.monto_debe! > 0 && detalle.monto_haber! > 0) errors[`detalle_monto_doble_${index}`] = `El monto en la línea ${index + 1} no puede tener valor en Debe y Haber a la vez.`;
            if (detalle.monto_debe! < 0 || detalle.monto_haber! < 0) errors[`detalle_monto_negativo_${index}`] = `El monto en la línea ${index + 1} no puede ser negativo.`;
            if (!detalle.moneda_id_linea) errors[`detalle_moneda_id_linea_${index}`] = `La moneda en la línea ${index + 1} es obligatoria.`
            // Validación para terceros
            if (detalle.requiere_analisis_por_tercero && !detalle.tipo_tercero_analisis) { // Si la cuenta requiere tercero, el tipo es obligatorio
                errors[`detalle_tipo_tercero_analisis_${index}`] = `El tipo de tercero es obligatorio para la cuenta en la línea ${index + 1}.`;
            }
            if (detalle.tipo_tercero_analisis && !detalle.tercero_analisis_id) { // Si el tipo de tercero está seleccionado, el ID es obligatorio
                errors[`detalle_tercero_analisis_id_${index}`] = `El tercero es obligatorio para el tipo de análisis en la línea ${index + 1}.`;
            }
        });

        setFormErrors(errors);
        return errors;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        let inputValue: string | number | boolean | undefined = value;

        if (type === 'checkbox') {
            inputValue = (e.target as HTMLInputElement).checked;
        } else if (name.includes('total_debe') || name.includes('total_haber') || name.includes('tipo_cambio')) {
            inputValue = value === '' ? undefined : Number(value);
        } else if (name.includes('_id') || name.includes('nivel_jerarquia')) { 
            inputValue = value === '' ? undefined : Number(value); // Asegurar que los IDs vacíos sean undefined
        }
        
        setFormData(prev => ({ ...prev, [name]: inputValue }));
    };

    const handleDetalleChange = (index: number, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        const updatedDetalles = [...(formData.detalles || [])];
        let inputValue: string | number | undefined = value;

        if (name.includes('monto') || name.includes('importe_moneda_origen_linea')) {
            inputValue = value === '' ? undefined : Number(value);
        } else if (name.includes('_id')) {
            inputValue = value === '' ? undefined : Number(value); // Asegurar que los IDs vacíos sean undefined
            // Si cambia la cuenta contable, actualizar propiedades relacionadas
            if (name === 'cuenta_contable_id') {
                const selectedCuenta = cuentasContables.find(c => c.cuenta_contable_id === inputValue);
                if (selectedCuenta) {
                    updatedDetalles[index].requiere_analisis_por_centro_costo = selectedCuenta.requiere_analisis_por_centro_costo;
                    updatedDetalles[index].requiere_analisis_por_tercero = selectedCuenta.requiere_analisis_por_tercero;
                    // Resetear tipo_tercero_analisis y tercero_analisis_id si la cuenta ya no lo requiere
                    if (!selectedCuenta.requiere_analisis_por_tercero) {
                        updatedDetalles[index].tipo_tercero_analisis = undefined;
                        updatedDetalles[index].tercero_analisis_id = undefined;
                    }
                    // También podrías preseleccionar la moneda de la cuenta si es necesario
                    // updatedDetalles[index].moneda_id_linea = selectedCuenta.moneda_id_predeterminada_cuenta;
                }
            }
        }
        
        updatedDetalles[index] = {
            ...updatedDetalles[index],
            [name]: inputValue,
        } as AsientoContableDetalle; // <-- ¡ASERCION DE TIPO AQUÍ!

        // Recalcular totales de Debe y Haber de la cabecera
        const newTotalDebe = updatedDetalles.reduce((sum, det) => sum + (Number(det.monto_debe) || 0), 0);
        const newTotalHaber = updatedDetalles.reduce((sum, det) => sum + (Number(det.monto_haber) || 0), 0);

        setFormData(prev => ({
            ...prev,
            detalles: updatedDetalles,
            total_debe_asiento: parseFloat(newTotalDebe.toFixed(2)),
            total_haber_asiento: parseFloat(newTotalHaber.toFixed(2)),
        }));
    };

    const addDetalle = () => {
        setFormData(prev => {
            const newDetalles = [...(prev.detalles || []), { 
                secuencia_linea_asiento: (prev.detalles?.length || 0) + 1,
                cuenta_contable_id: cuentasContables[0]?.cuenta_contable_id || undefined, // Default a primera cuenta
                moneda_id_linea: monedas[0]?.id || undefined,
                monto_debe: 0,
                monto_haber: 0,
                // Inicializar propiedades de análisis para el nuevo detalle
                requiere_analisis_por_centro_costo: cuentasContables[0]?.requiere_analisis_por_centro_costo ?? false,
                requiere_analisis_por_tercero: cuentasContables[0]?.requiere_analisis_por_tercero ?? false,
            }] as AsientoContableDetalle[]; // <-- ¡ASERCION DE TIPO AQUÍ!
            return {
                ...prev,
                detalles: newDetalles,
            };
        });
    };

    const removeDetalle = (index: number) => {
        setFormData(prev => {
            const updatedDetalles = (prev.detalles || []).filter((_, i) => i !== index);
            const newTotalDebe = updatedDetalles.reduce((sum, det) => sum + (Number(det.monto_debe) || 0), 0);
            const newTotalHaber = updatedDetalles.reduce((sum, det) => sum + (Number(det.monto_haber) || 0), 0);
            return { 
                ...prev, 
                detalles: updatedDetalles.map((d, i) => ({ ...d, secuencia_linea_asiento: i + 1 })) as AsientoContableDetalle[], // <-- ¡ASERCION DE TIPO AQUÍ!
                total_debe_asiento: parseFloat(newTotalDebe.toFixed(2)),
                total_haber_asiento: parseFloat(newTotalHaber.toFixed(2)),
            };
        });
    };

    useEffect(() => {
        // Recalcular totales de cabecera cada vez que los detalles cambian
        const newTotalDebe = (formData.detalles || []).reduce((sum, det) => sum + (Number(det.monto_debe) || 0), 0);
        const newTotalHaber = (formData.detalles || []).reduce((sum, det) => sum + (Number(det.monto_haber) || 0), 0);
        setFormData(prev => ({
            ...prev,
            total_debe_asiento: parseFloat(newTotalDebe.toFixed(2)),
            total_haber_asiento: parseFloat(newTotalHaber.toFixed(2)),
        }));
    }, [formData.detalles]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const errors = validateForm();
        if (Object.keys(errors).length > 0) {
            showValidationErrorAlert(errors);
            return;
        }

        try {
            if (selectedAsiento) {
                await updateAsientoContable(selectedAsiento.asiento_cabecera_id!, formData);
                showSuccessToast('¡Asiento contable actualizado con éxito!');
            } else {
                await createAsientoContable(formData as AsientoContableCabecera);
                showSuccessToast('¡Asiento contable creado con éxito!');
            }
            handleCloseModal(); 
            loadAsientos(); 
        } catch (error) {
            if (error instanceof Error) showErrorAlert(error.message);
        }
    };

    const handleDelete = async (asientoId: number) => {
        const result = await showConfirmDialog('¿Estás seguro?', 'El asiento contable pasará a estado "Anulado".');
        if (result.isConfirmed) {
            try {
                await deleteAsientoContable(asientoId);
                showSuccessToast('Asiento contable anulado con éxito.');
                loadAsientos();
            } catch (error) {
                if (error instanceof Error) showErrorAlert(error.message);
            }
        }
    };


    if (loading) return <div className="loading-spinner">Cargando...</div>;

    return (
        <div className="table-page-container">
            <div className="table-page-header">
                <h1>Asientos Contables</h1>
                <div className="header-actions">
                    <button onClick={handleExport} className="btn-secondary">
                        <FileDown size={18} /> Exportar Excel
                    </button>
                    <button onClick={() => handleOpenModal()} className="btn-primary">
                        <Plus size={18} /> Nuevo Asiento
                    </button>
                </div>
            </div>
            
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Nro. Asiento</th>
                            <th>Fecha</th>
                            <th>Tipo</th>
                            <th>Glosa Principal</th>
                            <th>Debe</th>
                            <th>Haber</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                        <tr className="filter-row">
                            <td><input type="text" name="numero_asiento_completo" value={filters.numero_asiento_completo} onChange={handleFilterChange} placeholder="Buscar..." /></td>
                            <td><input type="date" name="fecha_contabilizacion_asiento" value={filters.fecha_contabilizacion_asiento || ''} onChange={handleFilterChange} /></td>
                            <td>
                                <select name="tipo_asiento_descripcion" value={filters.tipo_asiento_descripcion || ''} onChange={handleFilterChange}>
                                    <option value="">Todos</option>
                                    {tiposAsientoContable.map(tipo => (
                                        <option key={tipo.id} value={tipo.descripcion}>{tipo.descripcion}</option>
                                    ))}
                                </select>
                            </td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td>
                                <select name="estado_asiento" value={filters.estado_asiento || ''} onChange={handleFilterChange}>
                                    <option value="">Todos</option>
                                    {estadosAsiento.map(estado => (
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
                            <tr><td colSpan={8}><div className="loading-spinner">Cargando...</div></td></tr>
                        ) : asientos.length > 0 ? (
                            asientos.map((asiento) => (
                                <tr key={asiento.asiento_cabecera_id}>
                                    <td>{asiento.numero_asiento_completo}</td>
                                    <td>{new Date(asiento.fecha_contabilizacion_asiento).toLocaleDateString('es-PE')}</td>
                                    <td>{asiento.tipo_asiento_descripcion}</td>
                                    <td>{asiento.glosa_principal_asiento}</td>
                                    <td>{asiento.moneda_nombre_asiento} {Number(asiento.total_debe_asiento).toFixed(2)}</td>
                                    <td>{asiento.moneda_nombre_asiento} {Number(asiento.total_haber_asiento).toFixed(2)}</td>
                                    <td>
                                        <span className={`status-badge status-${asiento.estado_asiento?.toLowerCase()}`}>
                                            {asiento.estado_asiento}
                                        </span>
                                    </td>
                                    <td>
                                        <button onClick={() => handleOpenModal(asiento, true)} className="btn-icon" title="Ver">👁️</button>
                                        <button onClick={() => handleOpenModal(asiento)} className="btn-icon" title="Editar">✏️</button>
                                        <button onClick={() => handleDelete(asiento.asiento_cabecera_id!)} className="btn-icon btn-danger" title="Anular">🗑️</button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={8} className="no-data">No se encontraron asientos contables.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="pagination-container">
                <span>Mostrando {asientos.length} de {totalRecords} registros</span>
                <div className="pagination-controls">
                    <button onClick={() => handlePageChange(1)} disabled={currentPage === 1}><ChevronsLeft size={16} /></button>
                    <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
                    <span>Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong></span>
                    <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}><ChevronRight size={16} /></button>
                    <button onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages}><ChevronsRight size={16} /></button>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={selectedAsiento ? (isViewMode ? 'Detalle de Asiento Contable' : 'Editar Asiento Contable') : 'Nuevo Asiento Contable'}>
                <form onSubmit={handleSubmit} className="modal-form" noValidate>
                    <div className="form-grid">
                        {/* Datos de Cabecera del Asiento */}
                        <div className="form-group floating-label">
                            <input id="numero_asiento_completo" type="text" name="numero_asiento_completo" value={selectedAsiento?.numero_asiento_completo || 'AUTOGENERADO'} disabled={true} placeholder=" " />
                            <label htmlFor="numero_asiento_completo">Nro. Asiento</label>
                        </div>
                        <div className="form-group floating-label">
                            <select id="periodo_contable_id" name="periodo_contable_id" value={formData.periodo_contable_id || ''} onChange={handleChange} disabled={isViewMode || !!selectedAsiento} required>
                                <option value="">Seleccione Período</option>
                                {periodosContables.map(periodo => (
                                    <option key={periodo.id} value={periodo.id}>{periodo.descripcion}</option>
                                ))}
                            </select>
                            <label htmlFor="periodo_contable_id">Período Contable</label>
                            {formErrors.periodo_contable_id && <span className="error-text">{formErrors.periodo_contable_id}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <select id="tipo_asiento_contable_id" name="tipo_asiento_contable_id" value={formData.tipo_asiento_contable_id || ''} onChange={handleChange} disabled={isViewMode || !!selectedAsiento} required>
                                <option value="">Seleccione Tipo Asiento</option>
                                {tiposAsientoContable.map(tipo => (
                                    <option key={tipo.id} value={tipo.id}>{tipo.descripcion}</option>
                                ))}
                            </select>
                            <label htmlFor="tipo_asiento_contable_id">Tipo de Asiento</label>
                            {formErrors.tipo_asiento_contable_id && <span className="error-text">{formErrors.tipo_asiento_contable_id}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <input id="fecha_contabilizacion_asiento" type="date" name="fecha_contabilizacion_asiento" value={formData.fecha_contabilizacion_asiento || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " required />
                            <label htmlFor="fecha_contabilizacion_asiento">Fecha Contabilización</label>
                            {formErrors.fecha_contabilizacion_asiento && <span className="error-text">{formErrors.fecha_contabilizacion_asiento}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <select id="moneda_id_asiento" name="moneda_id_asiento" value={formData.moneda_id_asiento || ''} onChange={handleChange} disabled={isViewMode} required>
                                <option value="">Seleccione Moneda</option>
                                {monedas.map(moneda => (
                                    <option key={moneda.id} value={moneda.id}>{moneda.nombre}</option>
                                ))}
                            </select>
                            <label htmlFor="moneda_id_asiento">Moneda del Asiento</label>
                            {formErrors.moneda_id_asiento && <span className="error-text">{formErrors.moneda_id_asiento}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <input id="tipo_cambio_asiento" type="number" step="0.0001" name="tipo_cambio_asiento" value={formData.tipo_cambio_asiento ?? ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="tipo_cambio_asiento">Tipo de Cambio</label>
                        </div>
                        <div className="form-group floating-label full-width">
                            <textarea id="glosa_principal_asiento" name="glosa_principal_asiento" value={formData.glosa_principal_asiento || ''} onChange={handleChange} rows={2} disabled={isViewMode} placeholder=" " required></textarea>
                            <label htmlFor="glosa_principal_asiento">Glosa Principal</label>
                            {formErrors.glosa_principal_asiento && <span className="error-text">{formErrors.glosa_principal_asiento}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <input id="origen_documento_referencia_id" type="number" name="origen_documento_referencia_id" value={formData.origen_documento_referencia_id ?? ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="origen_documento_referencia_id">ID Documento Origen</label>
                        </div>
                        <div className="form-group floating-label">
                            <input id="origen_documento_tabla_referencia" type="text" name="origen_documento_tabla_referencia" value={formData.origen_documento_tabla_referencia || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="origen_documento_tabla_referencia">Tabla Documento Origen</label>
                        </div>
                        {selectedAsiento && (
                            <div className="form-group floating-label">
                                <select id="estado_asiento" name="estado_asiento" value={formData.estado_asiento || ''} onChange={handleChange} disabled={isViewMode}>
                                    {estadosAsiento.map(estado => (
                                        <option key={estado} value={estado}>{estado}</option>
                                    ))}
                                </select>
                                <label htmlFor="estado_asiento">Estado del Asiento</label>
                            </div>
                        )}

                        {/* Detalles del Asiento */}
                        <h4 className="form-section-title full-width">Detalles del Asiento</h4>
                        {formErrors.detalles && <span className="error-text full-width">{formErrors.detalles}</span>}
                        <div className="full-width">
                            {formData.detalles && formData.detalles.length > 0 ? (
                                formData.detalles.map((detalle, index) => (
                                    <div key={index} className="detalle-item-grid asiento-detalle-grid">
                                        <div className="form-group floating-label">
                                            <select name="cuenta_contable_id" value={detalle.cuenta_contable_id || ''} onChange={(e) => handleDetalleChange(index, e)} disabled={isViewMode} required>
                                                <option value="">Seleccione Cuenta</option>
                                                {cuentasContables.map(cuenta => (
                                                    <option key={cuenta.cuenta_contable_id} value={cuenta.cuenta_contable_id}>{cuenta.codigo_cuenta} - {cuenta.nombre_cuenta_contable}</option>
                                                ))}
                                            </select>
                                            <label htmlFor={`cuenta_contable_id_${index}`}>Cuenta Contable</label>
                                            {formErrors[`detalle_cuenta_contable_id_${index}`] && <span className="error-text">{formErrors[`detalle_cuenta_contable_id_${index}`]}</span>}
                                        </div>
                                        <div className="form-group floating-label">
                                            <input type="number" step="0.01" name="monto_debe" value={detalle.monto_debe ?? ''} onChange={(e) => handleDetalleChange(index, e)} disabled={isViewMode || (detalle.monto_haber! > 0 && !isViewMode)} placeholder=" " />
                                            <label htmlFor={`monto_debe_${index}`}>Monto Debe</label>
                                            {formErrors[`detalle_monto_${index}`] && <span className="error-text">{formErrors[`detalle_monto_${index}`]}</span>}
                                            {formErrors[`detalle_monto_doble_${index}`] && <span className="error-text">{formErrors[`detalle_monto_doble_${index}`]}</span>}
                                            {formErrors[`detalle_monto_negativo_${index}`] && <span className="error-text">{formErrors[`detalle_monto_negativo_${index}`]}</span>}
                                        </div>
                                        <div className="form-group floating-label">
                                            <input type="number" step="0.01" name="monto_haber" value={detalle.monto_haber ?? ''} onChange={(e) => handleDetalleChange(index, e)} disabled={isViewMode || (detalle.monto_debe! > 0 && !isViewMode)} placeholder=" " />
                                            <label htmlFor={`monto_haber_${index}`}>Monto Haber</label>
                                        </div>
                                        <div className="form-group floating-label">
                                            <select name="moneda_id_linea" value={detalle.moneda_id_linea || ''} onChange={(e) => handleDetalleChange(index, e)} disabled={isViewMode} required>
                                                <option value="">Moneda Línea</option>
                                                {monedas.map(moneda => (
                                                    <option key={moneda.id} value={moneda.id}>{moneda.nombre}</option>
                                                ))}
                                            </select>
                                            <label htmlFor={`moneda_id_linea_${index}`}>Moneda Línea</label>
                                            {formErrors[`detalle_moneda_id_linea_${index}`] && <span className="error-text">{formErrors[`detalle_moneda_id_linea_${index}`]}</span>}
                                        </div>
                                        <div className="form-group floating-label">
                                            <textarea id={`glosa_detalle_linea_${index}`} name="glosa_detalle_linea" value={detalle.glosa_detalle_linea || ''} onChange={(e) => handleDetalleChange(index, e)} rows={1} disabled={isViewMode} placeholder=" "></textarea>
                                            <label htmlFor={`glosa_detalle_linea_${index}`}>Glosa Detalle</label>
                                        </div>
                                        {/* Campos de análisis por tercero/centro de costo */}
                                        {cuentasContables.find(c => c.cuenta_contable_id === detalle.cuenta_contable_id)?.requiere_analisis_por_centro_costo && (
                                            <div className="form-group floating-label">
                                                <input type="number" name="centro_costo_id" value={detalle.centro_costo_id ?? ''} onChange={(e) => handleDetalleChange(index, e)} disabled={isViewMode} placeholder=" " />
                                                <label htmlFor={`centro_costo_id_${index}`}>Centro de Costo</label>
                                            </div>
                                        )}
                                        {cuentasContables.find(c => c.cuenta_contable_id === detalle.cuenta_contable_id)?.requiere_analisis_por_tercero && (
                                            <>
                                                <div className="form-group floating-label">
                                                    <select name="tipo_tercero_analisis" value={detalle.tipo_tercero_analisis || ''} onChange={(e) => handleDetalleChange(index, e)} disabled={isViewMode}>
                                                        <option value="">Tipo Tercero</option>
                                                        {tiposTercero.map(tipo => (
                                                            <option key={tipo} value={tipo}>{tipo}</option>
                                                        ))}
                                                    </select>
                                                    <label htmlFor={`tipo_tercero_analisis_${index}`}>Tipo Tercero</label>
                                                </div>
                                                <div className="form-group floating-label">
                                                    <select name="tercero_analisis_id" value={detalle.tercero_analisis_id || ''} onChange={(e) => handleDetalleChange(index, e)} disabled={isViewMode || !detalle.tipo_tercero_analisis}>
                                                        <option value="">Seleccione Tercero</option>
                                                        {detalle.tipo_tercero_analisis === 'Cliente' && clientes.map(c => <option key={c.cliente_id} value={c.cliente_id}>{c.razon_social_o_nombres}</option>)}
                                                        {detalle.tipo_tercero_analisis === 'Proveedor' && proveedores.map(p => <option key={p.proveedor_id} value={p.proveedor_id}>{p.razon_social_o_nombres}</option>)} {/* ¡CORRECCIÓN AQUÍ! */}
                                                        {/* Otros tipos de tercero si se implementan */}
                                                    </select>
                                                    <label htmlFor={`tercero_analisis_id_${index}`}>Tercero</label>
                                                    {formErrors[`detalle_tercero_analisis_id_${index}`] && <span className="error-text">{formErrors[`detalle_tercero_analisis_id_${index}`]}</span>}
                                                </div>
                                            </>
                                        )}
                                        {!isViewMode && (
                                            <button type="button" onClick={() => removeDetalle(index)} className="btn-icon btn-danger" title="Eliminar Línea">🗑️</button>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <p className="no-data-small">No hay líneas de detalle añadidas. Añade una para empezar.</p>
                            )}
                            {!isViewMode && (
                                <button type="button" onClick={addDetalle} className="btn-secondary add-detalle-btn">
                                    <Plus size={18} /> Añadir Línea
                                </button>
                            )}
                        </div>

                        {/* Totales del Asiento */}
                        <h4 className="form-section-title full-width">Totales del Asiento</h4>
                        <div className="form-group floating-label">
                            <input id="total_debe_asiento" type="number" step="0.01" name="total_debe_asiento" value={formData.total_debe_asiento ?? ''} disabled={true} placeholder=" " />
                            <label htmlFor="total_debe_asiento">Total Debe</label>
                            {formErrors.total_debe_asiento && <span className="error-text">{formErrors.total_debe_asiento}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <input id="total_haber_asiento" type="number" step="0.01" name="total_haber_asiento" value={formData.total_haber_asiento ?? ''} disabled={true} placeholder=" " />
                            <label htmlFor="total_haber_asiento">Total Haber</label>
                            {formErrors.total_haber_asiento && <span className="error-text">{formErrors.total_haber_asiento}</span>}
                        </div>
                        {selectedAsiento && (
                            <>
                                <div className="form-group floating-label">
                                    <input id="estado_asiento" type="text" name="estado_asiento" value={formData.estado_asiento || ''} disabled={true} placeholder=" " />
                                    <label htmlFor="estado_asiento">Estado del Asiento</label>
                                </div>
                                <div className="form-group floating-label">
                                    <input id="correlativo_tipo_asiento_periodo" type="number" name="correlativo_tipo_asiento_periodo" value={formData.correlativo_tipo_asiento_periodo ?? ''} disabled={true} placeholder=" " />
                                    <label htmlFor="correlativo_tipo_asiento_periodo">Correlativo</label>
                                </div>
                                <div className="form-group floating-label full-width">
                                    <input id="origen_documento_referencia_id" type="number" name="origen_documento_referencia_id" value={formData.origen_documento_referencia_id ?? ''} disabled={true} placeholder=" " />
                                    <label htmlFor="origen_documento_referencia_id">ID Doc. Origen</label>
                                </div>
                                <div className="form-group floating-label full-width">
                                    <input id="origen_documento_tabla_referencia" type="text" name="origen_documento_tabla_referencia" value={formData.origen_documento_tabla_referencia || ''} disabled={true} placeholder=" " />
                                    <label htmlFor="origen_documento_tabla_referencia">Tabla Doc. Origen</label>
                                </div>
                            </>
                        )}
                    </div>

                    {selectedAsiento && (
                        <div className="audit-section">
                            <h4>Información de Auditoría</h4>
                            <p><strong>Creado por:</strong> {selectedAsiento.creado_por || 'N/A'}</p>
                            <p><strong>Fecha de Creación:</strong> {formatDate(selectedAsiento.fecha_creacion_registro)}</p>
                            <p><strong>Última Modificación por:</strong> {selectedAsiento.modificado_por || 'N/A'}</p>
                            <p><strong>Fecha de Modificación:</strong> {formatDate(selectedAsiento.fecha_modificacion)}</p>
                        </div>
                    )}

                    <div className="form-actions">
                        <button type="button" className="btn-secondary" onClick={handleCloseModal}>{isViewMode ? 'Cerrar' : 'Cancelar'}</button>
                        {!isViewMode && <button type="submit" className="btn-primary">{selectedAsiento ? 'Guardar Cambios' : 'Crear Asiento'}</button>}
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default ListaAsientosContablesPage;
