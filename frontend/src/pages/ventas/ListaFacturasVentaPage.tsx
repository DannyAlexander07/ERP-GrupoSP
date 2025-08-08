// Archivo: frontend/src/pages/ventas/ListaFacturasVentaPage.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react'; // Importar useRef
import { useLocation, useNavigate } from 'react-router-dom';
import { 
    fetchFacturasVenta, 
    createFacturaVenta, 
    updateFacturaVenta, 
    deleteFacturaVenta, 
    fetchFacturaVentaById,
    exportFacturasVenta,
    downloadFacturaVentaXml,
    downloadFacturaVentaCdr,
    downloadFacturaVentaPdf,
    type FacturaVenta,
    aplicarSaldoAFactura,
    type DetalleFacturaVenta,
    type PagedFacturasResponse,
    type VentaFilters
} from '../../services/ventaService';
import { fetchClientes, type Cliente } from '../../services/clienteService'; 
import { fetchServicios, type Servicio } from '../../services/servicioService'; 
import { showSuccessToast, showErrorAlert, showConfirmDialog, showValidationErrorAlert } from '../../services/notificationService';
import Modal from '../../components/common/Modal';
// Se eliminan las importaciones de iconos individuales de lucide-react (Eye, Edit, Trash)
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


const ListaFacturasVentaPage = () => {
    const [facturas, setFacturas] = useState<FacturaVenta[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedFactura, setSelectedFactura] = useState<FacturaVenta | null>(null);
    const [isViewMode, setIsViewMode] = useState(false);
    const [formErrors, setFormErrors] = useState<FormErrors>({});
    
    // Hooks de React Router
    const location = useLocation();
    const navigate = useNavigate();

    // Estado para controlar el dropdown de descarga
    const [openDropdownId, setOpenDropdownId] = useState<number | null>(null); 
    const dropdownRef = useRef<HTMLDivElement>(null); 

    // Datos para selects
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [servicios, setServicios] = useState<Servicio[]>([]);
    const tiposComprobanteVenta = [
        { id: 1, codigo: '01', descripcion: 'Factura', abreviatura: 'F' },
        { id: 2, codigo: '03', descripcion: 'Boleta', abreviatura: 'B' },
        { id: 3, codigo: '07', descripcion: 'Nota de Crédito', abreviatura: 'NC' },
        { id: 4, codigo: '08', descripcion: 'Nota de Débito', abreviatura: 'ND' },
    ];
    const monedas = [
        { id: 1, codigo: 'PEN', nombre: 'Soles Peruanos', simbolo: 'S/' },
        { id: 2, codigo: 'USD', nombre: 'Dólares Americanos', simbolo: '$' },
    ];
    const condicionesPago = [
        { id: 1, descripcion: 'Contado' },
        { id: 2, descripcion: 'Crédito 15 días' },
        { id: 3, descripcion: 'Crédito 30 días' },
    ];

    const [filters, setFilters] = useState<VentaFilters>({
        numero_completo_comprobante: '',
        cliente_razon_social: '', 
        estado_factura: ''
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const ROWS_PER_PAGE = 8;

    const initialFormData: Partial<FacturaVenta> = {
        cliente_id: undefined,
        tipo_comprobante_venta_id: tiposComprobanteVenta[0].id,
        serie_comprobante: 'F001', 
        fecha_emision: new Date().toISOString().split('T')[0], 
        moneda_id: monedas[0].id,
        monto_total_factura: 0,
        detalles: [], 
        estado_factura: 'Emitida',
        subtotal_afecto_impuestos: 0,
        subtotal_inafecto_impuestos: 0,
        subtotal_exonerado_impuestos: 0,
        monto_descuento_global: 0,
        monto_impuesto_principal: 0,
        monto_otros_tributos: 0,
        tipo_cambio_aplicado: 1.0000,
        condicion_pago_id: condicionesPago[0].id,
    };

    
    const [formData, setFormData] = useState<Partial<FacturaVenta>>(initialFormData);

    // Cargar datos iniciales (clientes, servicios)
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const clientesData = await fetchClientes(1, 1000, {}); 
                setClientes(clientesData.records);
                const serviciosData = await fetchServicios(1, 1000, {}, true); 
                setServicios(serviciosData.records);
            } catch (error) {
                if (error instanceof Error) showErrorAlert(`Error al cargar datos iniciales: ${error.message}`);
            }
        };
        loadInitialData();
    }, []);

    // Efecto para abrir el modal si la URL tiene ?action=new
    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        if (queryParams.get('action') === 'new') {
            handleOpenModal(); 
            navigate(location.pathname, { replace: true }); 
        }
    }, [location.search, navigate]);

    // Efecto para cerrar el dropdown al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setOpenDropdownId(null); 
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);


    const loadFacturas = useCallback(async () => {
        try {
            setLoading(true);
            const data: PagedFacturasResponse = await fetchFacturasVenta(currentPage, ROWS_PER_PAGE, filters);
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

    const handleAplicarSaldo = async (facturaId: number) => {
        const result = await showConfirmDialog(
            'Aplicar Saldo a Favor', 
            '¿Estás seguro de que quieres usar el saldo a favor de este cliente para pagar esta factura? Esta acción no se puede deshacer.'
        );
        if (result.isConfirmed) {
            try {
                await aplicarSaldoAFactura(facturaId);
                // Volvemos a cargar las facturas para ver el saldo actualizado
                loadFacturas(); 
            } catch (error) {
                if (error instanceof Error) {
                    showErrorAlert(error.message);
                }
            }
        }
    };

    const clearFilters = () => {
        setFilters({ numero_completo_comprobante: '', cliente_razon_social: '', estado_factura: '' });
        setCurrentPage(1);
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) { 
            setCurrentPage(newPage);
        }
    };
    
    const handleExport = async () => {
        try {
            await exportFacturasVenta(filters);
        } catch (error) {
            console.error(error);
        }
    };

    const handleOpenModal = async (factura: FacturaVenta | null = null, viewMode = false) => {
        setIsViewMode(viewMode);
        setFormErrors({});
        if (factura && factura.factura_venta_id) {
            try {
                const fullFacturaData = await fetchFacturaVentaById(factura.factura_venta_id);
                console.log("Fetched fullFacturaData:", fullFacturaData); 
                if (!fullFacturaData) { 
                    showErrorAlert('No se encontró la factura o hubo un problema al cargarla.');
                    return;
                }
                const processedFacturaData: FacturaVenta = {
                    ...fullFacturaData,
                    monto_total_factura: Number(fullFacturaData.monto_total_factura),
                    subtotal_afecto_impuestos: Number(fullFacturaData.subtotal_afecto_impuestos),
                    subtotal_inafecto_impuestos: Number(fullFacturaData.subtotal_inafecto_impuestos),
                    subtotal_exonerado_impuestos: Number(fullFacturaData.subtotal_exonerado_impuestos),
                    monto_descuento_global: Number(fullFacturaData.monto_descuento_global),
                    monto_impuesto_principal: Number(fullFacturaData.monto_impuesto_principal),
                    monto_otros_tributos: Number(fullFacturaData.monto_otros_tributos),
                    tipo_cambio_aplicado: Number(fullFacturaData.tipo_cambio_aplicado),
                    fecha_emision: formatToInputDate(fullFacturaData.fecha_emision), 
                    fecha_vencimiento: formatToInputDate(fullFacturaData.fecha_vencimiento), 
                    detalles: fullFacturaData.detalles?.map(d => ({
                        ...d,
                        cantidad: Number(d.cantidad),
                        valor_unitario_sin_impuestos: Number(d.valor_unitario_sin_impuestos),
                        precio_unitario_con_impuestos: Number(d.precio_unitario_con_impuestos),
                        monto_descuento_item: Number(d.monto_descuento_item),
                        subtotal_linea_sin_impuestos: Number(d.subtotal_linea_sin_impuestos),
                        porcentaje_impuesto_principal_item: Number(d.porcentaje_impuesto_principal_item),
                        monto_impuesto_principal_item: Number(d.monto_impuesto_principal_item),
                        monto_total_linea_item: Number(d.monto_total_linea_item),
                    })) || [],
                };

                setSelectedFactura(processedFacturaData);
                setFormData(processedFacturaData);
            } catch (error) {
                if (error instanceof Error) showErrorAlert(error.message);
                console.error("Error fetching factura data:", error); 
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
        if (!formData.cliente_id) errors.cliente_id = "El cliente es obligatorio.";
        if (!formData.fecha_emision) errors.fecha_emision = "La fecha de emisión es obligatoria.";
        if (!formData.moneda_id) errors.moneda_id = "La moneda es obligatoria.";
        if (formData.monto_total_factura === undefined || formData.monto_total_factura <= 0) errors.monto_total_factura = "El monto total debe ser mayor a 0.";
        if (!formData.detalles || formData.detalles.length === 0) errors.detalles = "Debe añadir al menos un detalle a la factura.";

        formData.detalles?.forEach((detalle, index) => {
            if (!detalle.servicio_id) errors[`detalle_servicio_id_${index}`] = `El servicio en la línea ${index + 1} es obligatorio.`;
            if (detalle.cantidad === undefined || detalle.cantidad <= 0) errors[`detalle_cantidad_${index}`] = `La cantidad en la línea ${index + 1} debe ser mayor a 0.`;
            if (detalle.valor_unitario_sin_impuestos === undefined || detalle.valor_unitario_sin_impuestos < 0) errors[`detalle_valor_unitario_${index}`] = `El valor unitario en la línea ${index + 1} debe ser positivo.`;
        });

        setFormErrors(errors);
        return errors;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        let inputValue: string | number | boolean | undefined = value;

        if (type === 'checkbox') {
            inputValue = (e.target as HTMLInputElement).checked;
        } else if (name.includes('monto') || name.includes('subtotal') || name.includes('porcentaje') || name.includes('tipo_cambio') || name.includes('cantidad') || name.includes('valor_unitario')) {
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

        if (name.includes('cantidad') || name.includes('valor_unitario') || name.includes('monto') || name.includes('porcentaje')) {
            inputValue = value === '' ? undefined : Number(value);
        } else if (name === 'servicio_id') {
            inputValue = Number(value);
            const selectedService = servicios.find(s => s.servicio_id === inputValue);
            if (selectedService) {
                updatedDetalles[index] = {
                    ...updatedDetalles[index],
                    servicio_id: inputValue,
                    descripcion_item_servicio_factura: selectedService.nombre_servicio,
                    unidad_medida_item: selectedService.unidad_medida,
                    valor_unitario_sin_impuestos: selectedService.precio_base_unitario,
                    porcentaje_impuesto_principal_item: selectedService.afecto_impuesto_principal ? selectedService.porcentaje_impuesto_aplicable : 0,
                    tipo_afectacion_impuesto_principal: selectedService.afecto_impuesto_principal ? 'Gravado' : 'Exonerado',
                };
            }
        }

        updatedDetalles[index] = {
            ...updatedDetalles[index],
            [name]: inputValue,
        };

        // Recalcular montos de línea
        const cantidad = updatedDetalles[index].cantidad || 0;
        const valorUnitario = updatedDetalles[index].valor_unitario_sin_impuestos || 0;
        const porcentajeImpuesto = updatedDetalles[index].porcentaje_impuesto_principal_item || 0;

        const subtotalSinImpuestos = cantidad * valorUnitario;
        const montoImpuesto = subtotalSinImpuestos * (porcentajeImpuesto / 100);
        const montoTotalLinea = subtotalSinImpuestos + montoImpuesto;

        updatedDetalles[index].subtotal_linea_sin_impuestos = parseFloat(subtotalSinImpuestos.toFixed(2));
        updatedDetalles[index].monto_impuesto_principal_item = parseFloat(montoImpuesto.toFixed(2));
        updatedDetalles[index].monto_total_linea_item = parseFloat(montoTotalLinea.toFixed(2));

        setFormData(prev => ({ ...prev, detalles: updatedDetalles }));
        recalculateTotals(updatedDetalles);
    };

    const addDetalle = () => {
        if (servicios.length === 0) {
            showErrorAlert('No se pueden añadir detalles. Primero asegúrate de tener servicios registrados.');
            return;
        }

        const defaultService = servicios[0];
        if (!defaultService) {
            showErrorAlert('No se pueden añadir detalles. No hay servicios disponibles para seleccionar.');
            return;
        }

        // Calculate initial values for the new detail based on the defaultService
        const initialCantidad = 1;
        const initialValorUnitario = defaultService.precio_base_unitario || 0;
        const initialPorcentajeImpuesto = defaultService.afecto_impuesto_principal ? (defaultService.porcentaje_impuesto_aplicable || 0) : 0;
        
        const initialSubtotalSinImpuestos = initialCantidad * initialValorUnitario;
        const initialMontoImpuesto = initialSubtotalSinImpuestos * (initialPorcentajeImpuesto / 100);
        const initialMontoTotalLinea = initialSubtotalSinImpuestos + initialMontoImpuesto;

        const newDetalle: DetalleFacturaVenta = {
            numero_linea_item: (formData.detalles?.length || 0) + 1,
            servicio_id: defaultService.servicio_id!, 
            descripcion_item_servicio_factura: defaultService.nombre_servicio || '',
            unidad_medida_item: defaultService.unidad_medida || '',
            cantidad: initialCantidad,
            valor_unitario_sin_impuestos: initialValorUnitario,
            precio_unitario_con_impuestos: initialValorUnitario + (initialValorUnitario * (initialPorcentajeImpuesto / 100)), 
            monto_descuento_item: 0,
            subtotal_linea_sin_impuestos: parseFloat(initialSubtotalSinImpuestos.toFixed(2)),
            porcentaje_impuesto_principal_item: initialPorcentajeImpuesto,
            monto_impuesto_principal_item: parseFloat(initialMontoImpuesto.toFixed(2)),
            monto_total_linea_item: parseFloat(initialMontoTotalLinea.toFixed(2)),
            tipo_afectacion_impuesto_principal: defaultService.afecto_impuesto_principal ? 'Gravado' : 'Exonerado',
            centro_costo_id: undefined,
        };

        const updatedDetalles = [...(formData.detalles || []), newDetalle];

        setFormData(prev => ({
            ...prev,
            detalles: updatedDetalles,
        }));
        
        recalculateTotals(updatedDetalles); 
    };

    const removeDetalle = (index: number) => {
        const updatedDetalles = (formData.detalles || []).filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, detalles: updatedDetalles.map((d, i) => ({ ...d, numero_linea_item: i + 1 })) }));
        recalculateTotals(updatedDetalles);
    };

    const recalculateTotals = (currentDetalles: DetalleFacturaVenta[]) => {
        let totalAfecto = 0;
        let totalImpuesto = 0;
        let totalExonerado = 0;
        let totalInafecto = 0;
        let montoTotal = 0;

        currentDetalles.forEach(detalle => {
            const subtotal = Number(detalle.subtotal_linea_sin_impuestos) || 0; 
            const impuesto = Number(detalle.monto_impuesto_principal_item) || 0; 
            const totalLinea = Number(detalle.monto_total_linea_item) || 0; 

            if (detalle.tipo_afectacion_impuesto_principal === 'Gravado') {
                totalAfecto += subtotal;
                totalImpuesto += impuesto;
            } else if (detalle.tipo_afectacion_impuesto_principal === 'Exonerado') {
                totalExonerado += subtotal;
            } else if (detalle.tipo_afectacion_impuesto_principal === 'Inafecto') {
                totalInafecto += subtotal;
            }
            montoTotal += totalLinea;
        });

        setFormData(prev => ({
            ...prev,
            subtotal_afecto_impuestos: parseFloat(totalAfecto.toFixed(2)),
            subtotal_inafecto_impuestos: parseFloat(totalInafecto.toFixed(2)),
            subtotal_exonerado_impuestos: parseFloat(totalExonerado.toFixed(2)),
            monto_impuesto_principal: parseFloat(totalImpuesto.toFixed(2)),
            monto_total_factura: parseFloat(montoTotal.toFixed(2)),
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
                await updateFacturaVenta(selectedFactura.factura_venta_id!, formData);
                showSuccessToast('¡Factura de venta actualizada con éxito!');
            } else {
                await createFacturaVenta(formData as FacturaVenta);
                showSuccessToast('¡Factura de venta creada con éxito!');
            }
            handleCloseModal();
            loadFacturas();
        } catch (error) {
            if (error instanceof Error) showErrorAlert(error.message);
        }
    };

    const handleDelete = async (facturaId: number) => {
        const result = await showConfirmDialog('¿Estás seguro?', 'La factura pasará a estado "Anulada".');
        if (result.isConfirmed) {
            try {
                await deleteFacturaVenta(facturaId);
                showSuccessToast('Factura de venta anulada con éxito.');
                loadFacturas();
            } catch (error) { 
                if (error instanceof Error) showErrorAlert(error.message);
            }
        }
    };

    const handleDownload = async (facturaId: number, type: 'xml' | 'cdr' | 'pdf', numeroComprobante: string) => {
        try {
            let fileName = '';
            if (type === 'xml') {
                fileName = `${numeroComprobante}.xml`;
                await downloadFacturaVentaXml(facturaId, fileName);
            } else if (type === 'cdr') {
                fileName = `R-${numeroComprobante}.zip`; // CDRs suelen ser ZIP
                await downloadFacturaVentaCdr(facturaId, fileName);
            } else if (type === 'pdf') {
                fileName = `${numeroComprobante}.pdf`;
                await downloadFacturaVentaPdf(facturaId, fileName);
            }
        } catch (error) {
            console.error(`Error al descargar ${type}:`, error);
            if (error instanceof Error) showErrorAlert(error.message);
        }
    };

    if (loading && facturas.length === 0) return <div className="loading-spinner">Cargando...</div>;

    return (
        <>
            <div className="table-page-container">
                <div className="table-page-header">
                    <h1>Lista de Facturas de Venta</h1>
                    <div className="header-actions">
                        <button onClick={handleExport} className="btn-secondary">
                            <FileDown size={18} /> Exportar Excel
                        </button>
                        <button onClick={() => handleOpenModal()} className="btn-primary">
                            <Plus size={18} /> Nueva Factura
                        </button>
                    </div>
                </div>
                
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Nro. Comprobante</th>
                                <th>Fecha Emisión</th>
                                <th>Cliente</th>
                                <th>Monto Total</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                            <tr className="filter-row">
                                <td><input type="text" name="numero_completo_comprobante" value={filters.numero_completo_comprobante} onChange={handleFilterChange} placeholder="Buscar..." /></td>
                                <td><input type="date" name="fecha_emision" value={filters.fecha_emision} onChange={handleFilterChange} /></td>
                                <td><input type="text" name="cliente_razon_social" value={filters.cliente_razon_social} onChange={handleFilterChange} placeholder="Buscar..." /></td>
                                <td></td>
                                <td>
                                    <select name="estado_factura" value={filters.estado_factura} onChange={handleFilterChange}>
                                        <option value="">Todos</option>
                                        <option value="Emitida">Emitida</option>
                                        <option value="Pagada">Pagada</option>
                                        <option value="Anulada">Anulada</option>
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
                            ) : facturas.length > 0 ? (
                                facturas.map((factura: FacturaVenta) => { 
                                    return ( 
                                    <tr key={factura.factura_venta_id}>
                                        <td>{factura.numero_completo_comprobante}</td>
                                        <td>{new Date(factura.fecha_emision).toLocaleDateString('es-PE')}</td>
                                        <td>{factura.cliente_razon_social}</td>
                                        <td>{factura.moneda_nombre} {Number(factura.monto_total_factura).toFixed(2)}</td>
                                        <td>
                                            <span className={`status-badge status-${(factura.estado_factura || '').toLowerCase()}`}>
                                                {factura.estado_factura}
                                            </span>
                                        </td>
                                        <td>
                                            <button onClick={() => handleOpenModal(factura, true)} className="btn-icon" title="Ver">👁️</button>
                                            <button onClick={() => handleOpenModal(factura)} className="btn-icon" title="Editar">✏️</button>
                                            <button onClick={() => handleDelete(factura.factura_venta_id!)} className="btn-icon btn-danger" title="Anular">🗑️</button>
                                            {Number(factura.saldo_pendiente_cobro) > 0 && (
                                                <button 
                                                    onClick={() => handleAplicarSaldo(factura.factura_venta_id!)} 
                                                    className="btn-icon" 
                                                    title="Aplicar Saldo a Favor del Cliente"
                                                >
                                                    💰
                                                </button>
                                            )}
                                            <div className="dropdown-actions" ref={openDropdownId === factura.factura_venta_id ? dropdownRef : null}>
                                                <button onClick={(e) => { e.stopPropagation(); setOpenDropdownId(factura.factura_venta_id === openDropdownId ? null : factura.factura_venta_id!); }} className="btn-icon" title="Descargar">⬇️</button>
                                                <div className={`dropdown-content ${openDropdownId === factura.factura_venta_id ? 'open' : ''}`}>
                                                    <a href="#" onClick={(e) => { e.preventDefault(); handleDownload(factura.factura_venta_id!, 'xml', factura.numero_completo_comprobante!); setOpenDropdownId(null); }}>Descargar XML</a>
                                                    <a href="#" onClick={(e) => { e.preventDefault(); handleDownload(factura.factura_venta_id!, 'cdr', factura.numero_completo_comprobante!); setOpenDropdownId(null); }}>Descargar CDR</a>
                                                    <a href="#" onClick={(e) => { e.preventDefault(); handleDownload(factura.factura_venta_id!, 'pdf', factura.numero_completo_comprobante!); setOpenDropdownId(null); }}>Descargar PDF</a>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )})
                            ) : (
                                <tr><td colSpan={6} className="no-data">No se encontraron facturas de venta.</td></tr>
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
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={isViewMode ? 'Detalle de Factura de Venta' : (selectedFactura ? 'Editar Factura de Venta' : 'Crear Factura de Venta')}>
                <form onSubmit={handleSubmit} className="modal-form" noValidate>
                    <div className="form-grid">
                        {/* Datos de Cabecera */}
                        <div className="form-group floating-label">
                            <input id="numero_completo_comprobante" type="text" name="numero_completo_comprobante" value={selectedFactura?.numero_completo_comprobante || 'AUTOGENERADO'} disabled={true} placeholder=" " />
                            <label htmlFor="numero_completo_comprobante">Nro. Comprobante</label>
                        </div>
                        <div className="form-group floating-label">
                            <select id="tipo_comprobante_venta_id" name="tipo_comprobante_venta_id" value={formData.tipo_comprobante_venta_id || ''} onChange={handleChange} disabled={isViewMode}>
                                {tiposComprobanteVenta.map(tipo => (
                                    <option key={tipo.id} value={tipo.id}>{tipo.descripcion}</option>
                                ))}
                            </select>
                            <label htmlFor="tipo_comprobante_venta_id">Tipo Comprobante</label>
                        </div>
                        <div className="form-group floating-label">
                            <input id="serie_comprobante" type="text" name="serie_comprobante" value={formData.serie_comprobante || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " required />
                            <label htmlFor="serie_comprobante">Serie</label>
                        </div>
                        <div className="form-group floating-label">
                            <input id="fecha_emision" type="date" name="fecha_emision" value={formData.fecha_emision || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " required />
                            <label htmlFor="fecha_emision">Fecha Emisión</label>
                            {formErrors.fecha_emision && <span className="error-text">{formErrors.fecha_emision}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <input id="fecha_vencimiento" type="date" name="fecha_vencimiento" value={formData.fecha_vencimiento || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="fecha_vencimiento">Fecha Vencimiento</label>
                        </div>
                        <div className="form-group floating-label">
                            <select id="cliente_id" name="cliente_id" value={formData.cliente_id || ''} onChange={handleChange} disabled={isViewMode} required>
                                <option value="">Seleccione un Cliente</option>
                                {clientes.map(cliente => (
                                    <option key={cliente.cliente_id} value={cliente.cliente_id}>{cliente.razon_social_o_nombres}</option>
                                ))}
                            </select>
                            <label htmlFor="cliente_id">Cliente</label>
                            {formErrors.cliente_id && <span className="error-text">{formErrors.cliente_id}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <select id="moneda_id" name="moneda_id" value={formData.moneda_id || ''} onChange={handleChange} disabled={isViewMode} required>
                                {monedas.map(moneda => (
                                    <option key={moneda.id} value={moneda.id}>{moneda.nombre}</option>
                                ))}
                            </select>
                            <label htmlFor="moneda_id">Moneda</label>
                        </div>
                        <div className="form-group floating-label">
                            <input id="tipo_cambio_aplicado" type="number" step="0.0001" name="tipo_cambio_aplicado" value={formData.tipo_cambio_aplicado ?? ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="tipo_cambio_aplicado">Tipo de Cambio</label>
                        </div>
                        <div className="form-group floating-label">
                            <select id="condicion_pago_id" name="condicion_pago_id" value={formData.condicion_pago_id || ''} onChange={handleChange} disabled={isViewMode}>
                                {condicionesPago.map(condicion => (
                                    <option key={condicion.id} value={condicion.id}>{condicion.descripcion}</option>
                                ))}
                            </select>
                            <label htmlFor="condicion_pago_id">Condición de Pago</label>
                        </div>
                        <div className="form-group floating-label full-width">
                            <textarea id="observaciones_factura" name="observaciones_factura" value={formData.observaciones_factura || ''} onChange={handleChange} rows={2} disabled={isViewMode} placeholder=" "></textarea>
                            <label htmlFor="observaciones_factura">Observaciones</label>
                        </div>

                        {/* Detalles de la Factura */}
                        <h4 className="form-section-title full-width">Detalles de Factura</h4>
                        {formErrors.detalles && <span className="error-text full-width">{formErrors.detalles}</span>}
                        <div className="full-width">
                            {formData.detalles && formData.detalles.length > 0 ? (
                                formData.detalles.map((detalle, index) => (
                                    <div key={index} className="detalle-item-grid">
                                        <div className="form-group floating-label">
                                            <select name="servicio_id" value={detalle.servicio_id || ''} onChange={(e) => handleDetalleChange(index, e)} disabled={isViewMode} required>
                                                <option value="">Seleccione Servicio</option>
                                                {servicios.map(servicio => (
                                                    <option key={servicio.servicio_id} value={servicio.servicio_id}>{servicio.nombre_servicio}</option>
                                                ))}
                                            </select>
                                            <label htmlFor={`servicio_id_${index}`}>Servicio</label>
                                            {formErrors[`detalle_servicio_id_${index}`] && <span className="error-text">{formErrors[`detalle_servicio_id_${index}`]}</span>}
                                        </div>
                                        <div className="form-group floating-label">
                                            <input type="number" name="cantidad" value={detalle.cantidad ?? ''} onChange={(e) => handleDetalleChange(index, e)} disabled={isViewMode} placeholder=" " required />
                                            <label htmlFor={`cantidad_${index}`}>Cantidad</label>
                                            {formErrors[`detalle_cantidad_${index}`] && <span className="error-text">{formErrors[`detalle_cantidad_${index}`]}</span>}
                                        </div>
                                        <div className="form-group floating-label">
                                            <input type="number" step="0.01" name="valor_unitario_sin_impuestos" value={detalle.valor_unitario_sin_impuestos ?? ''} onChange={(e) => handleDetalleChange(index, e)} disabled={isViewMode} placeholder=" " required />
                                            <label htmlFor={`valor_unitario_sin_impuestos_${index}`}>Valor Unitario</label>
                                            {formErrors[`detalle_valor_unitario_${index}`] && <span className="error-text">{formErrors[`detalle_valor_unitario_${index}`]}</span>}
                                        </div>
                                        <div className="form-group floating-label">
                                            <input type="number" step="0.01" name="monto_total_linea_item" value={detalle.monto_total_linea_item ?? ''} disabled={true} placeholder=" " />
                                            <label htmlFor={`monto_total_linea_item_${index}`}>Total Línea</label>
                                        </div>
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

                        {/* Totales de la Factura */}
                        <h4 className="form-section-title full-width">Resumen de Totales</h4>
                        <div className="form-group floating-label">
                            <input type="number" step="0.01" name="subtotal_afecto_impuestos" value={formData.subtotal_afecto_impuestos ?? ''} disabled={true} placeholder=" " />
                            <label htmlFor="subtotal_afecto_impuestos">Subtotal Afecto</label>
                        </div>
                        <div className="form-group floating-label">
                            <input type="number" step="0.01" name="subtotal_inafecto_impuestos" value={formData.subtotal_inafecto_impuestos ?? ''} disabled={true} placeholder=" " />
                            <label htmlFor="subtotal_inafecto_impuestos">Subtotal Inafecto</label>
                        </div>
                        <div className="form-group floating-label">
                            <input type="number" step="0.01" name="subtotal_exonerado_impuestos" value={formData.subtotal_exonerado_impuestos ?? ''} disabled={true} placeholder=" " />
                            <label htmlFor="subtotal_exonerado_impuestos">Subtotal Exonerado</label>
                        </div>
                        <div className="form-group floating-label">
                            <input type="number" step="0.01" name="monto_impuesto_principal" value={formData.monto_impuesto_principal ?? ''} disabled={true} placeholder=" " />
                            <label htmlFor="monto_impuesto_principal">Impuesto (IGV)</label>
                        </div>
                        <div className="form-group floating-label">
                            <input type="number" step="0.01" name="monto_total_factura" value={formData.monto_total_factura ?? ''} disabled={true} placeholder=" " />
                            <label htmlFor="monto_total_factura">Monto Total</label>
                            {formErrors.monto_total_factura && <span className="error-text">{formErrors.monto_total_factura}</span>}
                        </div>
                        {selectedFactura && (
                            <div className="form-group floating-label">
                                <input type="text" name="estado_factura" value={formData.estado_factura || ''} disabled={true} placeholder=" " />
                                <label htmlFor="estado_factura">Estado</label>
                            </div>
                        )}
                    </div>

                    {isViewMode && selectedFactura && (
                        <div className="audit-section">
                            <h4>Información de Auditoría</h4>
                            <p><strong>Creado por:</strong> {selectedFactura.creado_por || 'N/A'}</p>
                            <p><strong>Fecha de Creación:</strong> {formatDate(selectedFactura.fecha_creacion)}</p>
                            <p><strong>Última Modificación por:</strong> {selectedFactura.modificado_por || 'N/A'}</p>
                            <p><strong>Fecha de Modificación:</strong> {formatDate(selectedFactura.fecha_modificacion)}</p>
                        </div>
                    )}

                    <div className="form-actions">
                        <button type="button" className="btn-secondary" onClick={handleCloseModal}>{isViewMode ? 'Cerrar' : 'Cancelar'}</button>
                        {!isViewMode && <button type="submit" className="btn-primary">{selectedFactura ? 'Guardar Cambios' : 'Crear Factura'}</button>}
                    </div>
                </form>
            </Modal>
        </>
    );
};

export default ListaFacturasVentaPage;
