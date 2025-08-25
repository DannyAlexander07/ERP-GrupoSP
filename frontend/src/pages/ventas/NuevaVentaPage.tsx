// Archivo: frontend/src/pages/ventas/NuevaVentaPage.tsx
import React, { useEffect, useState, useMemo } from 'react'; // <-- Se añade useMemo aquí
import { useNavigate } from 'react-router-dom';
import { 
    createFacturaVenta, 
    type FacturaVenta, 
    type DetalleFacturaVenta
} from '../../services/ventaService';
import { fetchClientes, type Cliente } from '../../services/clienteService';
import { fetchServicios, type Servicio } from '../../services/servicioService'; // Asegúrate de importar 'type Servicio'
import { showSuccessToast, showErrorAlert, showValidationErrorAlert } from '../../services/notificationService';
import { Plus } from 'lucide-react';
import '../../styles/TablePage.css'; // Reutilizamos estilos de formularios y tablas

interface FormErrors { [key: string]: string; }

const NuevaVentaPage = () => {
    const navigate = useNavigate();

    // Datos para selects
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [servicios, setServicios] = useState<Servicio[]>([]);
    const tiposComprobanteVenta = useMemo(() => [
        { id: 1, codigo: '01', descripcion: 'Factura', abreviatura: 'F' },
        { id: 2, codigo: '03', descripcion: 'Boleta', abreviatura: 'B' },
        { id: 3, codigo: '07', descripcion: 'Nota de Crédito', abreviatura: 'NC' },
        { id: 4, codigo: '08', descripcion: 'Nota de Débito', abreviatura: 'ND' },
    ], []);

    const monedas = [
        { id: 1, codigo: 'PEN', nombre: 'Soles Peruanos', simbolo: 'S/' },
        { id: 2, codigo: 'USD', nombre: 'Dólares Americanos', simbolo: '$' },
    ];
    const condicionesPago = [
        { id: 1, descripcion: 'Contado' },
        { id: 2, descripcion: 'Crédito 15 días' },
        { id: 3, descripcion: 'Crédito 30 días' },
    ];

    const initialFormData: Partial<FacturaVenta> = {
        cliente_id: undefined,
        tipo_comprobante_venta_id: tiposComprobanteVenta[0].id,
        serie_comprobante: 'F001', // Valor inicial de serie
        fecha_emision: new Date().toISOString().split('T')[0], // Fecha actual
        moneda_id: monedas[0].id,
        monto_total_factura: 0,
        detalles: [], // Inicializar detalles como un array vacío
        estado_factura: 'Emitida', // Estado inicial
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
    const [formErrors, setFormErrors] = useState<FormErrors>({});
    const [loading, setLoading] = useState(true); // Para cargar clientes y servicios

    // Cargar datos iniciales (clientes, servicios)
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const clientesData = await fetchClientes(1, 1000, {});
                setClientes(clientesData.records);
                // ¡CAMBIO AQUÍ! Pasar isActive: true para filtrar servicios activos
                const serviciosData = await fetchServicios(1, 1000, {}, true); 
                setServicios(serviciosData.records);
            } catch (error) {
                if (error instanceof Error) showErrorAlert(`Error al cargar datos iniciales: ${error.message}`);
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, []);

    const validateForm = (): FormErrors => {
        const errors: FormErrors = {};
        if (!formData.cliente_id) errors.cliente_id = "El cliente es obligatorio.";
        if (!formData.fecha_emision) errors.fecha_emision = "La fecha de emisión es obligatoria.";
        if (!formData.moneda_id) errors.moneda_id = "La moneda es obligatoria.";
        if (formData.monto_total_factura === undefined || formData.monto_total_factura <= 0) errors.monto_total_factura = "El monto total debe ser mayor a 0.";
        if (!formData.detalles || formData.detalles.length === 0) errors.detalles = "Debe añadir al menos un detalle a la factura.";
        if (!formData.serie_comprobante?.trim()) errors.serie_comprobante = "La serie es obligatoria.";
        if (formData.numero_correlativo_comprobante === undefined || formData.numero_correlativo_comprobante <= 0) {
            errors.numero_correlativo_comprobante = "El número debe ser mayor a 0.";
        }
        // Validar detalles
        (formData.detalles as DetalleFacturaVenta[] || []).forEach((detalle, index) => {
            if (!detalle.servicio_id) errors[`detalle_servicio_id_${index}`] = `El servicio en la línea ${index + 1} es obligatorio.`;
            if (detalle.cantidad === undefined || detalle.cantidad <= 0) errors[`detalle_cantidad_${index}`] = `La cantidad en la línea ${index + 1} debe ser mayor a 0.`;
            if (detalle.valor_unitario_sin_impuestos === undefined || detalle.valor_unitario_sin_impuestos < 0) errors[`detalle_valor_unitario_${index}`] = `El valor unitario en la línea ${index + 1} debe ser positivo.`;
        });

        setFormErrors(errors);
        return errors;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        let finalValue: string | number | boolean | undefined | null = value;

        if (type === 'checkbox') {
         finalValue = (e.target as HTMLInputElement).checked;
        } else if (
        // Unificamos todas las comprobaciones de campos numéricos en una sola condición
            name.includes('_id') || 
            name.includes('monto') || 
            name.includes('subtotal') || 
            name.includes('porcentaje') || 
            name.includes('tipo_cambio') || 
            name.includes('cantidad') ||    
            name.includes('valor_unitario')
        ) {
         // Si el campo está vacío, lo tratamos como nulo/indefinido, si no, lo convertimos a número.
        finalValue = value === '' ? null : Number(value);
        }
        setFormData(prev => ({ ...prev, [name]: finalValue }));
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
        const tipoSeleccionado = tiposComprobanteVenta.find(t => t.id === formData.tipo_comprobante_venta_id);
        if (tipoSeleccionado) {
            let nuevaSerie = '';
            if (tipoSeleccionado.abreviatura === 'F') nuevaSerie = 'F001';
            if (tipoSeleccionado.abreviatura === 'B') nuevaSerie = 'B001';
            if (tipoSeleccionado.abreviatura === 'NC') nuevaSerie = 'NC01';
            if (tipoSeleccionado.abreviatura === 'ND') nuevaSerie = 'ND01';
            setFormData(prev => ({ ...prev, serie_comprobante: nuevaSerie }));
        }
    }, [formData.tipo_comprobante_venta_id, tiposComprobanteVenta]);

    useEffect(() => {
        recalculateTotals(formData.detalles || []);
    }, [formData.detalles]);


    // Reemplaza esta función completa en NuevaVentaPage.tsx
const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
        showValidationErrorAlert(errors);
        return;
    }

    try {
        // --- LÓGICA DE SEPARACIÓN (SE MANTIENE IGUAL) ---
        const [serie, correlativoStr] = (formData.numero_completo_comprobante || '').split('-');
        const correlativo = parseInt(correlativoStr, 10);

        if (!serie || isNaN(correlativo)) {
            showErrorAlert('El formato del Nro. de Comprobante es inválido. Debe ser SERIE-NUMERO, por ejemplo: F001-12345.');
            return; 
        }
        
        // --- ¡CORRECCIÓN CLAVE AQUÍ! ---
        // Construimos el objeto final para la API
        const dataToSend = {
            ...formData, // Copiamos todos los datos del formulario
            serie_comprobante: serie.trim(), // Añadimos la serie
            numero_correlativo_comprobante: correlativo, // Añadimos el correlativo numérico
        };
        // Opcional pero recomendado: eliminamos el campo combinado que ya no se usa en el backend
        delete (dataToSend as Partial<FacturaVenta>).numero_completo_comprobante;

        console.log("Datos que se enviarán a la API:", dataToSend); 

        // ¡Enviamos 'dataToSend' en lugar de 'formData'!
        await createFacturaVenta(dataToSend as FacturaVenta);

        showSuccessToast('¡Factura de venta creada con éxito!');
        navigate('/ventas');

    } catch (error) {
        if (error instanceof Error) showErrorAlert(error.message);
    }
};

    if (loading) return <div className="loading-spinner">Cargando...</div>;

    return (
        <div className="table-page-container"> {/* Reutilizamos el contenedor principal de la tabla para el padding y la animación */}
            <div className="table-page-header">
                <h1>Nueva Factura de Venta</h1>
            </div>
            <form onSubmit={handleSubmit} className="modal-form" noValidate> {/* Reutilizamos modal-form para estilos */}
                <div className="form-grid">
                    {/* Datos de Cabecera */}
                    <div className="form-group floating-label">
                        <input id="serie_comprobante" type="text" name="serie_comprobante" value={formData.serie_comprobante || ''} onChange={handleChange} placeholder=" " required />
                        <label htmlFor="serie_comprobante">Serie</label>
                        {formErrors.serie_comprobante && <span className="error-text">{formErrors.serie_comprobante}</span>}
                    </div>
                    <div className="form-group floating-label">
                        <input id="numero_correlativo_comprobante" type="number" name="numero_correlativo_comprobante" value={formData.numero_correlativo_comprobante ?? ''} onChange={handleChange} placeholder=" " required />
                        <label htmlFor="numero_correlativo_comprobante">Número</label>
                        {formErrors.numero_correlativo_comprobante && <span className="error-text">{formErrors.numero_correlativo_comprobante}</span>}
                    </div>
                    <div className="form-group floating-label">
                        <select id="tipo_comprobante_venta_id" name="tipo_comprobante_venta_id" value={formData.tipo_comprobante_venta_id || ''} onChange={handleChange}>
                            {tiposComprobanteVenta.map(tipo => (
                                <option key={tipo.id} value={tipo.id}>{tipo.descripcion}</option>
                            ))}
                        </select>
                        <label htmlFor="tipo_comprobante_venta_id">Tipo Comprobante</label>
                    </div>
                    <div className="form-group floating-label">
                        <input id="serie_comprobante" type="text" name="serie_comprobante" value={formData.serie_comprobante || ''} onChange={handleChange} placeholder=" " required />
                        <label htmlFor="serie_comprobante">Serie</label>
                    </div>
                    <div className="form-group floating-label">
                        <input id="fecha_emision" type="date" name="fecha_emision" value={formData.fecha_emision || ''} onChange={handleChange} placeholder=" " required />
                        <label htmlFor="fecha_emision">Fecha Emisión</label>
                        {formErrors.fecha_emision && <span className="error-text">{formErrors.fecha_emision}</span>}
                    </div>
                    <div className="form-group floating-label">
                        <input id="fecha_vencimiento" type="date" name="fecha_vencimiento" value={formData.fecha_vencimiento || ''} onChange={handleChange} placeholder=" " />
                        <label htmlFor="fecha_vencimiento">Fecha Vencimiento</label>
                    </div>
                    <div className="form-group floating-label">
                        <select id="cliente_id" name="cliente_id" value={formData.cliente_id || ''} onChange={handleChange} required>
                            <option value="">Seleccione un Cliente</option>
                            {clientes.map(cliente => (
                                <option key={cliente.cliente_id} value={cliente.cliente_id}>{cliente.razon_social_o_nombres}</option>
                            ))}
                        </select>
                        <label htmlFor="cliente_id">Cliente</label>
                        {formErrors.cliente_id && <span className="error-text">{formErrors.cliente_id}</span>}
                    </div>
                    <div className="form-group floating-label">
                        <select id="moneda_id" name="moneda_id" value={formData.moneda_id || ''} onChange={handleChange} required>
                            {monedas.map(moneda => (
                                <option key={moneda.id} value={moneda.id}>{moneda.nombre}</option>
                            ))}
                        </select>
                        <label htmlFor="moneda_id">Moneda</label>
                    </div>
                    <div className="form-group floating-label">
                        <input id="tipo_cambio_aplicado" type="number" step="0.0001" name="tipo_cambio_aplicado" value={formData.tipo_cambio_aplicado ?? ''} onChange={handleChange} placeholder=" " />
                        <label htmlFor="tipo_cambio_aplicado">Tipo de Cambio</label>
                    </div>
                    <div className="form-group floating-label">
                        <select id="condicion_pago_id" name="condicion_pago_id" value={formData.condicion_pago_id || ''} onChange={handleChange}>
                            {condicionesPago.map(condicion => (
                                <option key={condicion.id} value={condicion.id}>{condicion.descripcion}</option>
                            ))}
                        </select>
                        <label htmlFor="condicion_pago_id">Condición de Pago</label>
                    </div>
                    <div className="form-group floating-label full-width">
                        <textarea id="observaciones_factura" name="observaciones_factura" value={formData.observaciones_factura || ''} onChange={handleChange} rows={2} placeholder=" "></textarea>
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
                                        <select name="servicio_id" value={detalle.servicio_id || ''} onChange={(e) => handleDetalleChange(index, e)} required>
                                            <option value="">Seleccione Servicio</option>
                                            {servicios.map(servicio => (
                                                <option key={servicio.servicio_id} value={servicio.servicio_id}>{servicio.nombre_servicio}</option>
                                            ))}
                                        </select>
                                        <label htmlFor={`servicio_id_${index}`}>Servicio</label>
                                        {formErrors[`detalle_servicio_id_${index}`] && <span className="error-text">{formErrors[`detalle_servicio_id_${index}`]}</span>}
                                    </div>
                                    <div className="form-group floating-label">
                                        <input type="number" name="cantidad" value={detalle.cantidad ?? ''} onChange={(e) => handleDetalleChange(index, e)} placeholder=" " required />
                                        <label htmlFor={`cantidad_${index}`}>Cantidad</label>
                                        {formErrors[`detalle_cantidad_${index}`] && <span className="error-text">{formErrors[`detalle_cantidad_${index}`]}</span>}
                                    </div>
                                    <div className="form-group floating-label">
                                        <input type="number" step="0.01" name="valor_unitario_sin_impuestos" value={detalle.valor_unitario_sin_impuestos ?? ''} onChange={(e) => handleDetalleChange(index, e)} disabled={true} placeholder=" " required />
                                        <label htmlFor={`valor_unitario_sin_impuestos_${index}`}>Valor Unitario</label>
                                        {formErrors[`detalle_valor_unitario_${index}`] && <span className="error-text">{formErrors[`detalle_valor_unitario_${index}`]}</span>}
                                    </div>
                                    <div className="form-group floating-label">
                                        <input type="number" step="0.01" name="monto_total_linea_item" value={detalle.monto_total_linea_item ?? ''} disabled={true} placeholder=" " />
                                        <label htmlFor={`monto_total_linea_item_${index}`}>Total Línea</label>
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
                </div>

                <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={() => navigate('/ventas')}>Cancelar</button>
                    <button type="submit" className="btn-primary">Crear Factura</button>
                </div>
            </form>
        </div>
    );
};

export default NuevaVentaPage;
