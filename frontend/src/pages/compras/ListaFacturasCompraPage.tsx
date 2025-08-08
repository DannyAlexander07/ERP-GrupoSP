// Archivo: frontend/src/pages/compras/ListaFacturasCompraPage.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
    fetchFacturasCompra, 
    createFacturaCompra, 
    updateFacturaCompra, 
    deleteFacturaCompra, 
    fetchFacturaCompraById,
    exportFacturasCompra,
    type FacturaCompra, 
    type DetalleFacturaCompra,
    type PagedFacturasCompraResponse,
    type CompraFilters
} from '../../services/compraService';
import { fetchProveedores, type Proveedor } from '../../services/proveedorService'; // Para el selector de proveedores
import { showSuccessToast, showErrorAlert, showConfirmDialog, showValidationErrorAlert } from '../../services/notificationService';
import Modal from '../../components/common/Modal';
import { FileDown, FilterX, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus } from 'lucide-react';
import '../../styles/TablePage.css';

interface FormErrors { [key: string]: string; }


// Función auxiliar para formatear fecha a YYYY-MM-DD para input type="date"
const formatToInputDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const ListaFacturasCompraPage = () => {
    const [facturas, setFacturas] = useState<FacturaCompra[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedFactura, setSelectedFactura] = useState<FacturaCompra | null>(null);
    const [isViewMode, setIsViewMode] = useState(false);
    const [formErrors, setFormErrors] = useState<FormErrors>({});
    
    // Hooks de React Router
    const location = useLocation();
    const navigate = useNavigate();

    // Datos para selects
    const [proveedores, setProveedores] = useState<Proveedor[]>([]);
    const tiposComprobanteCompra = [
        { id: 1, descripcion: 'Factura', abreviatura: 'F' },
        { id: 2, descripcion: 'Recibo por Honorarios', abreviatura: 'RH' },
        { id: 3, descripcion: 'Boleta de Venta', abreviatura: 'B' },
    ];
    const tiposObligacion = [
        'Gasto Operativo', 'Compra de Mercadería', 'Activo Fijo', 'Servicio Profesional'
    ];
    const monedas = [
        { id: 1, codigo: 'PEN', nombre: 'Soles Peruanos', simbolo: 'S/' },
        { id: 2, codigo: 'USD', nombre: 'Dólares Americanos', simbolo: '$' },
    ];

    const [filters, setFilters] = useState<CompraFilters>({
        numero_documento_proveedor: '',
        proveedor_razon_social: '', 
        estado_factura_compra: ''
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const ROWS_PER_PAGE = 8;

    const initialFormData: Partial<FacturaCompra> = {
        proveedor_id: undefined,
        tipo_comprobante_compra_id: tiposComprobanteCompra[0].id,
        tipo_obligacion_principal: tiposObligacion[0],
        descripcion_general_compra: '',
        numero_documento_proveedor: '',
        fecha_emision_documento_proveedor: '',
        fecha_recepcion_documento: new Date().toISOString().split('T')[0], // Fecha actual
        fecha_vencimiento_original: '',
        moneda_id_obligacion: monedas[0].id,
        monto_total_original_obligacion: 0,
        detalles: [], // Inicializar detalles como un array vacío
        estado_factura_compra: 'Pendiente', // Estado inicial
        monto_detraccion: 0,
        monto_retencion_impuestos: 0,
        observaciones_compra: '',
        prioridad_pago: 3, // Prioridad Media
    };
    const [formData, setFormData] = useState<Partial<FacturaCompra>>(initialFormData);

    // Cargar datos iniciales (proveedores)
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const proveedoresData = await fetchProveedores(1, 1000, {}); // Cargar todos los proveedores
                setProveedores(proveedoresData.records);
            } catch (error) {
                if (error instanceof Error) showErrorAlert(`Error al cargar datos iniciales: ${error.message}`);
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, []);

    // Efecto para abrir el modal si la URL tiene ?action=new
    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        if (queryParams.get('action') === 'new') {
            handleOpenModal(); // Abre el modal para crear nueva factura
            navigate(location.pathname, { replace: true }); 
        }
    }, [location.search, navigate]);


    const loadFacturas = useCallback(async () => {
        try {
            setLoading(true);
            const data: PagedFacturasCompraResponse = await fetchFacturasCompra(currentPage, ROWS_PER_PAGE, filters);
            setFacturas(data.records);
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
            loadFacturas();
        }, 500);
        return () => clearTimeout(timer);
    }, [loadFacturas]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
        setCurrentPage(1);
    };

    const clearFilters = () => {
        setFilters({ numero_documento_proveedor: '', proveedor_razon_social: '', estado_factura_compra: '' });
        setCurrentPage(1);
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) { 
            setCurrentPage(newPage);
        }
    };
    
    const handleExport = async () => {
        try {
            await exportFacturasCompra(filters);
        } catch (error) {
            console.error(error);
        }
    };

    const handleOpenModal = async (factura: FacturaCompra | null = null, viewMode = false) => {
        setIsViewMode(viewMode);
        setFormErrors({});
        if (factura && factura.factura_compra_id) {
            try {
                const fullFacturaData = await fetchFacturaCompraById(factura.factura_compra_id);
                if (!fullFacturaData) { 
                    showErrorAlert('No se encontró la factura de compra o hubo un problema al cargarla.');
                    return;
                }
                // Convertir campos numéricos a Number y fechas a formato input
                const processedFacturaData: FacturaCompra = {
                    ...fullFacturaData,
                    monto_total_original_obligacion: Number(fullFacturaData.monto_total_original_obligacion),
                    monto_detraccion: Number(fullFacturaData.monto_detraccion),
                    monto_retencion_impuestos: Number(fullFacturaData.monto_retencion_impuestos),
                    monto_neto_a_pagar_calculado: Number(fullFacturaData.monto_neto_a_pagar_calculado),
                    monto_total_pagado: Number(fullFacturaData.monto_total_pagado),
                    saldo_pendiente_pago: Number(fullFacturaData.saldo_pendiente_pago),
                    fecha_emision_documento_proveedor: formatToInputDate(fullFacturaData.fecha_emision_documento_proveedor),
                    fecha_recepcion_documento: formatToInputDate(fullFacturaData.fecha_recepcion_documento),
                    fecha_vencimiento_original: formatToInputDate(fullFacturaData.fecha_vencimiento_original),
                    fecha_programada_pago: formatToInputDate(fullFacturaData.fecha_programada_pago),
                    detalles: fullFacturaData.detalles?.map(d => ({
                        ...d,
                        cantidad: Number(d.cantidad),
                        valor_unitario_gasto: Number(d.valor_unitario_gasto),
                        monto_total_item_gasto: Number(d.monto_total_item_gasto),
                    })) || [],
                };

                setSelectedFactura(processedFacturaData);
                setFormData(processedFacturaData);
            } catch (error) {
                if (error instanceof Error) showErrorAlert(error.message);
                console.error("Error fetching factura compra data:", error); 
                return;
            }
        } else {
            setSelectedFactura(null);
            setFormData(initialFormData); 
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedFactura(null);
        setFormData(initialFormData); 
    };

    const validateForm = (): FormErrors => {
        const errors: FormErrors = {};
        if (!formData.proveedor_id) errors.proveedor_id = "El proveedor es obligatorio.";
        if (!formData.tipo_comprobante_compra_id) errors.tipo_comprobante_compra_id = "El tipo de comprobante es obligatorio.";
        if (!formData.tipo_obligacion_principal?.trim()) errors.tipo_obligacion_principal = "El tipo de obligación es obligatorio.";
        if (!formData.descripcion_general_compra?.trim()) errors.descripcion_general_compra = "La descripción general es obligatoria.";
        if (!formData.fecha_recepcion_documento) errors.fecha_recepcion_documento = "La fecha de recepción es obligatoria.";
        if (!formData.fecha_vencimiento_original) errors.fecha_vencimiento_original = "La fecha de vencimiento es obligatoria.";
        if (!formData.moneda_id_obligacion) errors.moneda_id_obligacion = "La moneda es obligatoria.";
        if (formData.monto_total_original_obligacion === undefined || formData.monto_total_original_obligacion <= 0) errors.monto_total_original_obligacion = "El monto total debe ser mayor a 0.";
        if (!formData.detalles || formData.detalles.length === 0) errors.detalles = "Debe añadir al menos un detalle a la factura de compra.";

        formData.detalles?.forEach((detalle, index) => {
            if (!detalle.descripcion_item_gasto?.trim()) errors[`detalle_descripcion_item_gasto_${index}`] = `La descripción del item en la línea ${index + 1} es obligatoria.`;
            if (detalle.monto_total_item_gasto === undefined || detalle.monto_total_item_gasto <= 0) errors[`detalle_monto_total_item_gasto_${index}`] = `El monto total del item en la línea ${index + 1} debe ser mayor a 0.`;
        });

        setFormErrors(errors);
        return errors;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        let inputValue: string | number | boolean | undefined = value;

        if (type === 'checkbox') {
            inputValue = (e.target as HTMLInputElement).checked;
        } else if (name.includes('monto') || name.includes('cantidad') || name.includes('valor_unitario') || name.includes('prioridad')) {
            inputValue = value === '' ? undefined : Number(value);
        } else if (name.includes('_id')) { 
            inputValue = Number(value);
        }
        
        setFormData(prev => ({ ...prev, [name]: inputValue }));
    };

    const handleDetalleChange = (index: number, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        const updatedDetalles = [...(formData.detalles || [])];
        let inputValue: string | number | undefined = value;

        if (name.includes('cantidad') || name.includes('valor_unitario') || name.includes('monto')) {
            inputValue = value === '' ? undefined : Number(value);
        }
        
        updatedDetalles[index] = {
            ...updatedDetalles[index],
            [name]: inputValue,
        };

        // Recalcular monto total del item si cantidad o valor unitario cambian
        const cantidad = updatedDetalles[index].cantidad || 0;
        const valorUnitario = updatedDetalles[index].valor_unitario_gasto || 0;
        if (name === 'cantidad' || name === 'valor_unitario_gasto') {
            updatedDetalles[index].monto_total_item_gasto = parseFloat((cantidad * valorUnitario).toFixed(2));
        }

        setFormData(prev => ({ ...prev, detalles: updatedDetalles }));
        recalculateTotals(updatedDetalles);
    };

    const addDetalle = () => {
        setFormData(prev => ({
            ...prev,
            detalles: [...(prev.detalles || []), { 
                descripcion_item_gasto: '',
                cantidad: 1,
                valor_unitario_gasto: 0,
                monto_total_item_gasto: 0,
                centro_costo_id: undefined,
                proyecto_id_referencia: undefined,
            }],
        }));
        recalculateTotals(formData.detalles || []); 
    };

    const removeDetalle = (index: number) => {
        const updatedDetalles = (formData.detalles || []).filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, detalles: updatedDetalles }));
        recalculateTotals(updatedDetalles);
    };

    const recalculateTotals = (currentDetalles: DetalleFacturaCompra[]) => {
        let totalOriginal = 0;
        currentDetalles.forEach(detalle => {
            totalOriginal += Number(detalle.monto_total_item_gasto) || 0;
        });

        setFormData(prev => ({
            ...prev,
            monto_total_original_obligacion: parseFloat(totalOriginal.toFixed(2)),
        }));
    };

    useEffect(() => {
        recalculateTotals(formData.detalles || []);
    }, [formData.detalles]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const errors = validateForm();
        if (Object.keys(errors).length > 0) {
            showValidationErrorAlert(errors);
            return;
        }

        try {
            if (selectedFactura) {
                await updateFacturaCompra(selectedFactura.factura_compra_id!, formData);
                showSuccessToast('¡Factura de compra actualizada con éxito!');
            } else {
                await createFacturaCompra(formData as FacturaCompra);
                showSuccessToast('¡Factura de compra creada con éxito!');
            }
            handleCloseModal(); // Cierra el modal después de la operación
            loadFacturas(); // Recarga la lista
        } catch (error) {
            if (error instanceof Error) showErrorAlert(error.message);
        }
    };

    const handleDelete = async (facturaId: number) => {
        const result = await showConfirmDialog('¿Estás seguro?', 'La factura de compra pasará a estado "Anulada".');
        if (result.isConfirmed) {
            try {
                await deleteFacturaCompra(facturaId);
                showSuccessToast('Factura de compra anulada con éxito.');
                loadFacturas();
            } catch (error) {
                if (error instanceof Error) showErrorAlert(error.message);
            }
        }
    };


    if (loading) return <div className="loading-spinner">Cargando...</div>;

    return (
        <div className="table-page-container">
            <div className="table-page-header">
                <h1>Lista de Facturas de Compra</h1>
                <div className="header-actions">
                    <button onClick={handleExport} className="btn-secondary">
                        <FileDown size={18} /> Exportar Excel
                    </button>
                    <button onClick={() => handleOpenModal()} className="btn-primary">
                        <Plus size={18} /> Nueva Factura de Compra
                    </button>
                </div>
            </div>
            
            <div className="table-container">
                <table>
                    <thead>
                            <tr>
                                <th>Nro. Documento</th>
                                <th>Proveedor</th>
                                <th>Tipo Comprobante</th>
                                <th>Fecha Recepción</th>
                                <th>Monto Total</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                            <tr className="filter-row">
                                <td><input type="text" name="numero_documento_proveedor" value={filters.numero_documento_proveedor} onChange={handleFilterChange} placeholder="Buscar..." /></td><td><input type="text" name="proveedor_razon_social" value={filters.proveedor_razon_social} onChange={handleFilterChange} placeholder="Buscar..." /></td><td></td><td><input type="date" name="fecha_recepcion_documento" value={filters.fecha_recepcion_documento} onChange={handleFilterChange} /></td><td></td><td>
                                <select name="estado_factura_compra" value={filters.estado_factura_compra} onChange={handleFilterChange}>
                                    <option value="">Todos</option>
                                    <option value="Pendiente">Pendiente</option>
                                    <option value="Pagada">Pagada</option>
                                    <option value="Anulada">Anulada</option>
                                </select>
                            </td><td className="filter-actions">
                                <button onClick={clearFilters} className="btn-icon" title="Limpiar filtros"><FilterX size={18} /></button>
                            </td>
                            </tr>
                    </thead>

                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7}><div className="loading-spinner">Cargando...</div></td></tr>
                        ) : facturas.length > 0 ? (
                            facturas.map((factura: FacturaCompra) => ( // Aseguramos el tipado explícito aquí
                                <tr key={factura.factura_compra_id}>
                                    <td>{factura.numero_documento_proveedor || 'N/A'}</td>
                                    <td>{factura.proveedor_razon_social}</td>
                                    <td>{factura.tipo_comprobante_descripcion}</td>
                                    <td>{new Date(factura.fecha_recepcion_documento).toLocaleDateString('es-PE')}</td>
                                    <td>{factura.moneda_nombre} {Number(factura.monto_total_original_obligacion).toFixed(2)}</td>
                                    <td>
                                        <span className={`status-badge status-${(factura.estado_factura_compra || '').toLowerCase()}`}>
                                            {factura.estado_factura_compra}
                                        </span>
                                    </td>
                                    <td>
                                        <button onClick={() => handleOpenModal(factura, true)} className="btn-icon" title="Ver">👁️</button>
                                        <button onClick={() => handleOpenModal(factura)} className="btn-icon" title="Editar">✏️</button>
                                        <button onClick={() => handleDelete(factura.factura_compra_id!)} className="btn-icon btn-danger" title="Anular">🗑️</button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={7} className="no-data">No se encontraron facturas de compra.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="pagination-container">
                <span>Mostrando {facturas.length} de {totalRecords} registros</span>
                <div className="pagination-controls">
                    <button onClick={() => handlePageChange(1)} disabled={currentPage === 1}><ChevronsLeft size={16} /></button>
                    <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
                    <span>Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong></span>
                    <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}><ChevronRight size={16} /></button>
                    <button onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages}><ChevronsRight size={16} /></button>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={isViewMode ? 'Detalle de Factura de Compra' : (selectedFactura ? 'Editar Factura de Compra' : 'Crear Factura de Compra')}>
                <form onSubmit={handleSubmit} className="modal-form" noValidate>
                    <div className="form-grid">
                        {/* Datos de Cabecera */}
                        <div className="form-group floating-label">
                            <input id="numero_documento_proveedor" type="text" name="numero_documento_proveedor" value={formData.numero_documento_proveedor || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="numero_documento_proveedor">Nro. Documento Proveedor</label>
                        </div>
                        <div className="form-group floating-label">
                            <select id="proveedor_id" name="proveedor_id" value={formData.proveedor_id || ''} onChange={handleChange} disabled={isViewMode} required>
                                <option value="">Seleccione un Proveedor</option>
                                {proveedores.map(proveedor => (
                                    <option key={proveedor.proveedor_id} value={proveedor.proveedor_id}>{proveedor.razon_social_o_nombres}</option>
                                ))}
                            </select>
                            <label htmlFor="proveedor_id">Proveedor</label>
                            {formErrors.proveedor_id && <span className="error-text">{formErrors.proveedor_id}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <select id="tipo_comprobante_compra_id" name="tipo_comprobante_compra_id" value={formData.tipo_comprobante_compra_id || ''} onChange={handleChange} disabled={isViewMode} required>
                                <option value="">Seleccione Tipo Comprobante</option> {/* Added default empty option */}
                                {tiposComprobanteCompra.map(tipo => (
                                    <option key={tipo.id} value={tipo.id}>{tipo.descripcion}</option>
                                ))}
                            </select>
                            <label htmlFor="tipo_comprobante_compra_id">Tipo Comprobante</label>
                             {formErrors.tipo_comprobante_compra_id && <span className="error-text">{formErrors.tipo_comprobante_compra_id}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <select id="tipo_obligacion_principal" name="tipo_obligacion_principal" value={formData.tipo_obligacion_principal || ''} onChange={handleChange} disabled={isViewMode} required>
                                <option value="">Seleccione Tipo Obligación</option> {/* Added default empty option */}
                                {tiposObligacion.map(tipo => (
                                    <option key={tipo} value={tipo}>{tipo}</option>
                                ))}
                            </select>
                            <label htmlFor="tipo_obligacion_principal">Tipo de Obligación</label>
                            {formErrors.tipo_obligacion_principal && <span className="error-text">{formErrors.tipo_obligacion_principal}</span>}
                        </div>
                        <div className="form-group floating-label full-width">
                            <textarea id="descripcion_general_compra" name="descripcion_general_compra" value={formData.descripcion_general_compra || ''} onChange={handleChange} rows={2} disabled={isViewMode} placeholder=" " required></textarea>
                            <label htmlFor="descripcion_general_compra">Descripción General</label>
                            {formErrors.descripcion_general_compra && <span className="error-text">{formErrors.descripcion_general_compra}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <input id="fecha_emision_documento_proveedor" type="date" name="fecha_emision_documento_proveedor" value={formData.fecha_emision_documento_proveedor || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="fecha_emision_documento_proveedor">Fecha Emisión Doc.</label>
                        </div>
                        <div className="form-group floating-label">
                            <input id="fecha_recepcion_documento" type="date" name="fecha_recepcion_documento" value={formData.fecha_recepcion_documento || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " required />
                            <label htmlFor="fecha_recepcion_documento">Fecha Recepción</label>
                            {formErrors.fecha_recepcion_documento && <span className="error-text">{formErrors.fecha_recepcion_documento}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <input id="fecha_vencimiento_original" type="date" name="fecha_vencimiento_original" value={formData.fecha_vencimiento_original || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " required />
                            <label htmlFor="fecha_vencimiento_original">Fecha Vencimiento</label>
                            {formErrors.fecha_vencimiento_original && <span className="error-text">{formErrors.fecha_vencimiento_original}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <input id="fecha_programada_pago" type="date" name="fecha_programada_pago" value={formData.fecha_programada_pago || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="fecha_programada_pago">Fecha Programada Pago</label>
                        </div>
                        <div className="form-group floating-label">
                            <select id="moneda_id_obligacion" name="moneda_id_obligacion" value={formData.moneda_id_obligacion || ''} onChange={handleChange} disabled={isViewMode} required>
                                <option value="">Seleccione Moneda</option> {/* Added default empty option */}
                                {monedas.map(moneda => (
                                    <option key={moneda.id} value={moneda.id}>{moneda.nombre}</option>
                                ))}
                            </select>
                            <label htmlFor="moneda_id_obligacion">Moneda</label>
                            {formErrors.moneda_id_obligacion && <span className="error-text">{formErrors.moneda_id_obligacion}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <input id="prioridad_pago" type="number" name="prioridad_pago" value={formData.prioridad_pago ?? ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="prioridad_pago">Prioridad de Pago</label>
                        </div>

                        {/* Detalles de la Factura de Compra */}
                        <h4 className="form-section-title full-width">Detalles de Compra</h4>
                        {formErrors.detalles && <span className="error-text full-width">{formErrors.detalles}</span>}
                        <div className="full-width">
                            {formData.detalles && formData.detalles.length > 0 ? (
                                formData.detalles.map((detalle, index) => (
                                    <div key={index} className="detalle-item-grid">
                                        <div className="form-group floating-label full-width">
                                            <textarea id={`descripcion_item_gasto_${index}`} name="descripcion_item_gasto" value={detalle.descripcion_item_gasto || ''} onChange={(e) => handleDetalleChange(index, e)} rows={1} disabled={isViewMode} placeholder=" " required></textarea>
                                            <label htmlFor={`descripcion_item_gasto_${index}`}>Descripción Item</label>
                                            {formErrors[`detalle_descripcion_item_gasto_${index}`] && <span className="error-text">{formErrors[`detalle_descripcion_item_gasto_${index}`]}</span>}
                                        </div>
                                        <div className="form-group floating-label">
                                            <input type="number" name="cantidad" value={detalle.cantidad ?? ''} onChange={(e) => handleDetalleChange(index, e)} disabled={isViewMode} placeholder=" " />
                                            <label htmlFor={`cantidad_${index}`}>Cantidad</label>
                                        </div>
                                        <div className="form-group floating-label">
                                            <input type="number" step="0.01" name="valor_unitario_gasto" value={detalle.valor_unitario_gasto ?? ''} onChange={(e) => handleDetalleChange(index, e)} disabled={isViewMode} placeholder=" " />
                                            <label htmlFor={`valor_unitario_gasto_${index}`}>Valor Unitario</label>
                                        </div>
                                        <div className="form-group floating-label">
                                            <input type="number" step="0.01" name="monto_total_item_gasto" value={detalle.monto_total_item_gasto ?? ''} onChange={(e) => handleDetalleChange(index, e)} disabled={isViewMode} placeholder=" " required />
                                            <label htmlFor={`monto_total_item_gasto_${index}`}>Monto Total Item</label>
                                            {formErrors[`detalle_monto_total_item_gasto_${index}`] && <span className="error-text">{formErrors[`detalle_monto_total_item_gasto_${index}`]}</span>}
                                        </div>
                                        {/* Aquí se podrían añadir campos para Centro de Costo y Proyecto si se implementan */}
                                        {!isViewMode && (
                                            <button type="button" onClick={() => removeDetalle(index)} className="btn-icon btn-danger" title="Eliminar Detalle">🗑️</button>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <p className="no-data-small">No hay detalles añadidos. Añade uno para empezar.</p>
                            )}
                            {!isViewMode && (
                                <button type="button" onClick={addDetalle} className="btn-secondary add-detalle-btn">
                                    <Plus size={18} /> Añadir Detalle
                                </button>
                            )}
                        </div>

                        {/* Totales de la Factura de Compra */}
                        <h4 className="form-section-title full-width">Resumen de Totales</h4>
                        <div className="form-group floating-label">
                            <input type="number" step="0.01" name="monto_total_original_obligacion" value={formData.monto_total_original_obligacion ?? ''} disabled={true} placeholder=" " />
                            <label htmlFor="monto_total_original_obligacion">Monto Total Original</label>
                            {formErrors.monto_total_original_obligacion && <span className="error-text">{formErrors.monto_total_original_obligacion}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <input type="number" step="0.01" name="monto_detraccion" value={formData.monto_detraccion ?? ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="monto_detraccion">Monto Detracción</label>
                        </div>
                        <div className="form-group floating-label">
                            <input type="number" step="0.01" name="monto_retencion_impuestos" value={formData.monto_retencion_impuestos ?? ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="monto_retencion_impuestos">Monto Retención</label>
                        </div>
                        {isViewMode && selectedFactura && (
                            <>
                                <div className="form-group floating-label">
                                    <input type="number" step="0.01" name="monto_neto_a_pagar_calculado" value={selectedFactura.monto_neto_a_pagar_calculado ?? ''} disabled={true} placeholder=" " />
                                    <label htmlFor="monto_neto_a_pagar_calculado">Monto Neto a Pagar</label>
                                </div>
                                <div className="form-group floating-label">
                                    <input type="number" step="0.01" name="saldo_pendiente_pago" value={selectedFactura.saldo_pendiente_pago ?? ''} disabled={true} placeholder=" " />
                                    <label htmlFor="saldo_pendiente_pago">Saldo Pendiente</label>
                                </div>
                                <div className="form-group floating-label">
                                    <input type="text" name="estado_factura_compra" value={selectedFactura.estado_factura_compra || ''} disabled={true} placeholder=" " />
                                    <label htmlFor="estado_factura_compra">Estado</label>
                                </div>
                            </>
                        )}
                        <div className="form-group floating-label full-width">
                            <textarea id="observaciones_compra" name="observaciones_compra" value={formData.observaciones_compra || ''} onChange={handleChange} rows={2} disabled={isViewMode} placeholder=" "></textarea>
                            <label htmlFor="observaciones_compra">Observaciones Adicionales</label>
                        </div>
                    </div>


                    <div className="form-actions">
                        <button type="button" className="btn-secondary" onClick={handleCloseModal}>{isViewMode ? 'Cerrar' : 'Cancelar'}</button>
                        {!isViewMode && <button type="submit" className="btn-primary">{selectedFactura ? 'Guardar Cambios' : 'Crear Factura de Compra'}</button>}
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default ListaFacturasCompraPage;
