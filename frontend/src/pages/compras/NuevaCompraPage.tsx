// Archivo: frontend/src/pages/compras/NuevaCompraPage.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    createFacturaCompra, 
    type FacturaCompra, 
    type DetalleFacturaCompra
} from '../../services/compraService';
import { fetchProveedores, type Proveedor } from '../../services/proveedorService';
import { showSuccessToast, showErrorAlert, showValidationErrorAlert } from '../../services/notificationService';
import { Plus } from 'lucide-react';
import '../../styles/TablePage.css'; // Reutilizamos estilos de formularios y tablas

interface FormErrors { [key: string]: string; }

const NuevaCompraPage = () => {
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

    // Inicializar formData de forma segura
    const initialFormData: Partial<FacturaCompra> = {
        proveedor_id: undefined, // Se establecerá con el primer proveedor cargado
        tipo_comprobante_compra_id: tiposComprobanteCompra[0]?.id || undefined, 
        tipo_obligacion_principal: tiposObligacion[0] || '', 
        descripcion_general_compra: '',
        numero_documento_proveedor: '',
        fecha_emision_documento_proveedor: '',
        fecha_recepcion_documento: new Date().toISOString().split('T')[0],
        fecha_vencimiento_original: '',
        moneda_id_obligacion: monedas[0]?.id || undefined, 
        monto_total_original_obligacion: 0,
        detalles: [],
        estado_factura_compra: 'Pendiente',
        monto_detraccion: 0,
        monto_retencion_impuestos: 0,
        observaciones_compra: '',
        prioridad_pago: 3,
    };
    const [formData, setFormData] = useState<Partial<FacturaCompra>>(initialFormData);
    const [formErrors, setFormErrors] = useState<FormErrors>({});
    const [loading, setLoading] = useState(true);

    // Cargar datos iniciales (proveedores)
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const proveedoresData = await fetchProveedores(1, 1000, {}); // Cargar todos los proveedores
                setProveedores(proveedoresData.records);
                
                // Ajustar initialFormData con datos cargados si existen
                setFormData(prev => {
                    const updatedData = { ...prev };
                    if (proveedoresData.records.length > 0 && prev.proveedor_id === undefined) {
                        updatedData.proveedor_id = proveedoresData.records[0].proveedor_id;
                    }
                    if (tiposComprobanteCompra.length > 0 && prev.tipo_comprobante_compra_id === undefined) {
                        updatedData.tipo_comprobante_compra_id = tiposComprobanteCompra[0].id;
                    }
                    if (monedas.length > 0 && prev.moneda_id_obligacion === undefined) {
                        updatedData.moneda_id_obligacion = monedas[0].id;
                    }
                    return updatedData;
                });

                if (proveedoresData.records.length === 0) {
                    showErrorAlert('No hay proveedores registrados. Por favor, registre proveedores primero.');
                }
            } catch (error) {
                if (error instanceof Error) showErrorAlert(`Error al cargar datos iniciales: ${error.message}`);
            } finally {
                setLoading(false); // Siempre establecer loading a false
            }
        };
        loadInitialData();
    }, []); // Dependencias vacías para que se ejecute solo una vez

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
            await createFacturaCompra(formData as FacturaCompra);
            showSuccessToast('¡Factura de compra creada con éxito!');
            navigate('/compras'); // Redirigir a la lista de facturas de compra después de crear
        } catch (error) {
            if (error instanceof Error) showErrorAlert(error.message);
        }
    };

    if (loading) return <div className="loading-spinner">Cargando...</div>;

    return (
        <div className="table-page-container"> {/* Reutilizamos el contenedor principal de la tabla para el padding y la animación */}
            <div className="table-page-header">
                <h1>Nueva Factura de Compra</h1>
            </div>
            <form onSubmit={handleSubmit} className="modal-form" noValidate> {/* Reutilizamos modal-form para estilos */}
                <div className="form-grid">
                    {/* Datos de Cabecera */}
                    <div className="form-group floating-label">
                        <input id="numero_documento_proveedor" type="text" name="numero_documento_proveedor" value={formData.numero_documento_proveedor || ''} onChange={handleChange} placeholder=" " />
                        <label htmlFor="numero_documento_proveedor">Nro. Documento Proveedor</label>
                    </div>
                    <div className="form-group floating-label">
                        <select id="proveedor_id" name="proveedor_id" value={formData.proveedor_id || ''} onChange={handleChange} required>
                            <option value="">Seleccione un Proveedor</option>
                            {proveedores.map(proveedor => (
                                <option key={proveedor.proveedor_id} value={proveedor.proveedor_id}>{proveedor.razon_social_o_nombres}</option>
                            ))}
                        </select>
                        <label htmlFor="proveedor_id">Proveedor</label>
                        {formErrors.proveedor_id && <span className="error-text">{formErrors.proveedor_id}</span>}
                    </div>
                    <div className="form-group floating-label">
                        <select id="tipo_comprobante_compra_id" name="tipo_comprobante_compra_id" value={formData.tipo_comprobante_compra_id || ''} onChange={handleChange} required>
                            <option value="">Seleccione Tipo Comprobante</option>
                            {tiposComprobanteCompra.map(tipo => (
                                <option key={tipo.id} value={tipo.id}>{tipo.descripcion}</option>
                            ))}
                        </select>
                        <label htmlFor="tipo_comprobante_compra_id">Tipo Comprobante</label>
                         {formErrors.tipo_comprobante_compra_id && <span className="error-text">{formErrors.tipo_comprobante_compra_id}</span>}
                    </div>
                    <div className="form-group floating-label">
                        <select id="tipo_obligacion_principal" name="tipo_obligacion_principal" value={formData.tipo_obligacion_principal || ''} onChange={handleChange} required>
                            <option value="">Seleccione Tipo Obligación</option>
                            {tiposObligacion.map(tipo => (
                                <option key={tipo} value={tipo}>{tipo}</option>
                            ))}
                        </select>
                        <label htmlFor="tipo_obligacion_principal">Tipo de Obligación</label>
                        {formErrors.tipo_obligacion_principal && <span className="error-text">{formErrors.tipo_obligacion_principal}</span>}
                    </div>
                    <div className="form-group floating-label full-width">
                        <textarea id="descripcion_general_compra" name="descripcion_general_compra" value={formData.descripcion_general_compra || ''} onChange={handleChange} rows={2} placeholder=" " required></textarea>
                        <label htmlFor="descripcion_general_compra">Descripción General</label>
                        {formErrors.descripcion_general_compra && <span className="error-text">{formErrors.descripcion_general_compra}</span>}
                    </div>
                    <div className="form-group floating-label">
                        <input id="fecha_emision_documento_proveedor" type="date" name="fecha_emision_documento_proveedor" value={formData.fecha_emision_documento_proveedor || ''} onChange={handleChange} placeholder=" " />
                        <label htmlFor="fecha_emision_documento_proveedor">Fecha Emisión Doc.</label>
                    </div>
                    <div className="form-group floating-label">
                        <input id="fecha_recepcion_documento" type="date" name="fecha_recepcion_documento" value={formData.fecha_recepcion_documento || ''} onChange={handleChange} placeholder=" " required />
                        <label htmlFor="fecha_recepcion_documento">Fecha Recepción</label>
                        {formErrors.fecha_recepcion_documento && <span className="error-text">{formErrors.fecha_recepcion_documento}</span>}
                    </div>
                    <div className="form-group floating-label">
                        <input id="fecha_vencimiento_original" type="date" name="fecha_vencimiento_original" value={formData.fecha_vencimiento_original || ''} onChange={handleChange} placeholder=" " required />
                        <label htmlFor="fecha_vencimiento_original">Fecha Vencimiento</label>
                        {formErrors.fecha_vencimiento_original && <span className="error-text">{formErrors.fecha_vencimiento_original}</span>}
                    </div>
                    <div className="form-group floating-label">
                        <input id="fecha_programada_pago" type="date" name="fecha_programada_pago" value={formData.fecha_programada_pago || ''} onChange={handleChange} placeholder=" " />
                        <label htmlFor="fecha_programada_pago">Fecha Programada Pago</label>
                    </div>
                    <div className="form-group floating-label">
                        <select id="moneda_id_obligacion" name="moneda_id_obligacion" value={formData.moneda_id_obligacion || ''} onChange={handleChange} required>
                            <option value="">Seleccione Moneda</option>
                            {monedas.map(moneda => (
                                <option key={moneda.id} value={moneda.id}>{moneda.nombre}</option>
                            ))}
                        </select>
                        <label htmlFor="moneda_id_obligacion">Moneda</label>
                        {formErrors.moneda_id_obligacion && <span className="error-text">{formErrors.moneda_id_obligacion}</span>}
                    </div>
                    <div className="form-group floating-label">
                        <input id="prioridad_pago" type="number" name="prioridad_pago" value={formData.prioridad_pago ?? ''} onChange={handleChange} placeholder=" " />
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
                                        <textarea id={`descripcion_item_gasto_${index}`} name="descripcion_item_gasto" value={detalle.descripcion_item_gasto || ''} onChange={(e) => handleDetalleChange(index, e)} rows={1} placeholder=" " required></textarea>
                                        <label htmlFor={`descripcion_item_gasto_${index}`}>Descripción Item</label>
                                        {formErrors[`detalle_descripcion_item_gasto_${index}`] && <span className="error-text">{formErrors[`detalle_descripcion_item_gasto_${index}`]}</span>}
                                    </div>
                                    <div className="form-group floating-label">
                                        <input type="number" name="cantidad" value={detalle.cantidad ?? ''} onChange={(e) => handleDetalleChange(index, e)} placeholder=" " />
                                        <label htmlFor={`cantidad_${index}`}>Cantidad</label>
                                    </div>
                                    <div className="form-group floating-label">
                                        <input type="number" step="0.01" name="valor_unitario_gasto" value={detalle.valor_unitario_gasto ?? ''} onChange={(e) => handleDetalleChange(index, e)} placeholder=" " />
                                        <label htmlFor={`valor_unitario_gasto_${index}`}>Valor Unitario</label>
                                    </div>
                                    <div className="form-group floating-label">
                                        <input type="number" step="0.01" name="monto_total_item_gasto" value={detalle.monto_total_item_gasto ?? ''} onChange={(e) => handleDetalleChange(index, e)} disabled={true} placeholder=" " required />
                                        <label htmlFor={`monto_total_item_gasto_${index}`}>Monto Total Item</label>
                                        {formErrors[`detalle_monto_total_item_gasto_${index}`] && <span className="error-text">{formErrors[`detalle_monto_total_item_gasto_${index}`]}</span>}
                                    </div>
                                    <button type="button" onClick={() => removeDetalle(index)} className="btn-icon btn-danger" title="Eliminar Detalle">🗑️</button>
                                </div>
                            ))
                        ) : (
                            <p className="no-data-small">No hay detalles añadidos. Añade uno para empezar.</p>
                        )}
                        <button type="button" onClick={addDetalle} className="btn-secondary add-detalle-btn">
                            <Plus size={18} /> Añadir Detalle
                        </button>
                    </div>

                    {/* Totales de la Factura de Compra */}
                    <h4 className="form-section-title full-width">Resumen de Totales</h4>
                    <div className="form-group floating-label">
                        <input type="number" step="0.01" name="monto_total_original_obligacion" value={formData.monto_total_original_obligacion ?? ''} disabled={true} placeholder=" " />
                        <label htmlFor="monto_total_original_obligacion">Monto Total Original</label>
                        {formErrors.monto_total_original_obligacion && <span className="error-text">{formErrors.monto_total_original_obligacion}</span>}
                    </div>
                    <div className="form-group floating-label">
                        <input type="number" step="0.01" name="monto_detraccion" value={formData.monto_detraccion ?? ''} onChange={handleChange} placeholder=" " />
                        <label htmlFor="monto_detraccion">Monto Detracción</label>
                    </div>
                    <div className="form-group floating-label">
                        <input type="number" step="0.01" name="monto_retencion_impuestos" value={formData.monto_retencion_impuestos ?? ''} onChange={handleChange} placeholder=" " />
                        <label htmlFor="monto_retencion_impuestos">Monto Retención</label>
                    </div>
                </div>

                <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={() => navigate('/compras')}>Cancelar</button>
                    <button type="submit" className="btn-primary">Crear Factura de Compra</button>
                </div>
            </form>
        </div>
    );
};

export default NuevaCompraPage;
