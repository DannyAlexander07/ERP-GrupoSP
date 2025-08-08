// Archivo: frontend/src/pages/servicios/ListaServiciosPage.tsx (VERSIÓN FINAL CON CORRECCIÓN DE CUENTA CONTABLE)
import React, { useEffect, useState, useCallback } from 'react';
import { 
    fetchServicios, 
    createServicio, 
    updateServicio, 
    deleteServicio, 
    type Servicio, 
    fetchServicioById,
    fetchNextServicioCode,
    exportServicios,
    type PagedServiciosResponse
} from '../../services/servicioService';
import { fetchPlanContable, type CuentaContable } from '../../services/planContableService'; // ¡IMPORTADO! Para obtener cuentas contables
import { showSuccessToast, showErrorAlert, showConfirmDialog, showValidationErrorAlert } from '../../services/notificationService';
import Modal from '../../components/common/Modal';
import { FileDown, FilterX, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus } from 'lucide-react';
import '../../styles/TablePage.css'; // Reutilizamos los mismos estilos

interface FormErrors { [key: string]: string; }

// Listas de opciones para los selects (mantener si no vienen de BD)
const tiposDeServicio = ["Diseño Gráfico", "Consultoría SEO", "Redes Sociales", "Publicidad Digital", "Desarrollo Web", "Otro"];
const unidadesDeMedida = ["Unidad", "Hora", "Proyecto", "Mes", "Campaña"];
const monedas = [ // Asumiendo que Monedas ya está poblada en la BD con IDs 1 y 2
    { id: 1, nombre: 'Soles Peruanos', simbolo: 'S/' },
    { id: 2, nombre: 'Dólares Americanos', simbolo: '$' },
];

const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('es-PE', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

const ListaServiciosPage = () => {
    const [servicios, setServicios] = useState<Servicio[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedServicio, setSelectedServicio] = useState<Servicio | null>(null);
    const [isViewMode, setIsViewMode] = useState(false);
    const [formErrors, setFormErrors] = useState<FormErrors>({});
    
    // --- NUEVOS ESTADOS PARA SELECTORES ---
    const [cuentasContables, setCuentasContables] = useState<CuentaContable[]>([]);
    // --- FIN NUEVOS ESTADOS ---

    const [filters, setFilters] = useState({
        codigo_servicio_interno: '',
        nombre_servicio: '',
        tipo_servicio: ''
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const ROWS_PER_PAGE = 8;

    const initialFormData: Partial<Servicio> = {
        codigo_servicio_interno: '',
        nombre_servicio: '',
        tipo_servicio: tiposDeServicio[0],
        unidad_medida: unidadesDeMedida[0],
        moneda_id_precio_base: monedas[0]?.id || 1, // Usar ID de la primera moneda
        precio_base_unitario: 0, // Valor inicial numérico
        afecto_impuesto_principal: true,
        activo_para_venta: true,
        descripcion_detallada_servicio: '',
        porcentaje_impuesto_aplicable: 18,
        // ¡CAMBIO CLAVE AQUÍ! Ahora es ID numérico
        cuenta_contable_ingreso_predeterminada_id: undefined, 
    };

    const [formData, setFormData] = useState<Partial<Servicio>>(initialFormData);

    // Cargar servicios y también las cuentas contables
    const loadServicios = useCallback(async () => {
        try {
            setLoading(true);
            const data: PagedServiciosResponse = await fetchServicios(currentPage, ROWS_PER_PAGE, filters);
            setServicios(data.records);
            setTotalPages(data.total_pages);
            setTotalRecords(data.total_records);

            // Cargar TODAS las cuentas contables (para el selector en el modal)
            const cuentasData = await fetchPlanContable(1, 9999, {}); 
            setCuentasContables(cuentasData.records);

            // Si es un nuevo servicio, inicializar cuenta contable si hay alguna disponible
            if (!selectedServicio && cuentasData.records.length > 0) {
                setFormData(prev => ({
                    ...prev,
                    cuenta_contable_ingreso_predeterminada_id: prev.cuenta_contable_ingreso_predeterminada_id || cuentasData.records[0].cuenta_contable_id
                }));
            }

        } catch (error) {
            if (error instanceof Error) showErrorAlert(error.message);
        } finally {
            setLoading(false);
        }
    }, [currentPage, filters, selectedServicio]); // Añadir selectedServicio a las dependencias

    useEffect(() => {
        const timer = setTimeout(() => {
            loadServicios();
        }, 500);
        return () => clearTimeout(timer);
    }, [loadServicios]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
        setCurrentPage(1);
    };

    const clearFilters = () => {
        setFilters({ codigo_servicio_interno: '', nombre_servicio: '', tipo_servicio: '' });
        setCurrentPage(1);
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };
    
    const handleExport = async () => {
        try {
            await exportServicios(filters);
        } catch (error) {
            console.error(error);
        }
    };

    const handleOpenModal = async (servicio: Servicio | null = null, viewMode = false) => {
        setIsViewMode(viewMode);
        setFormErrors({});
        if (servicio && servicio.servicio_id) {
            try {
                const fullServicioData = await fetchServicioById(servicio.servicio_id);
                if (!fullServicioData) { 
                    showErrorAlert('No se encontró el servicio o hubo un problema al cargarlo.');
                    return;
                }
                // Asegurarse de que los campos numéricos sean Number
                const processedServicioData: Servicio = {
                    ...fullServicioData,
                    precio_base_unitario: Number(fullServicioData.precio_base_unitario),
                    porcentaje_impuesto_aplicable: Number(fullServicioData.porcentaje_impuesto_aplicable),
                    // Asegurar que los booleanos sean boolean (si vienen como strings o 0/1)
                    afecto_impuesto_principal: !!fullServicioData.afecto_impuesto_principal,
                    activo_para_venta: !!fullServicioData.activo_para_venta,
                };
                setSelectedServicio(processedServicioData);
                setFormData(processedServicioData);
            } catch (error) {
                if (error instanceof Error) showErrorAlert(error.message);
                return;
            }
        } else {
            setSelectedServicio(null);
            // Al crear, obtener el siguiente código y establecer la primera cuenta contable si existe
            try {
                const nextCode = await fetchNextServicioCode();
                setFormData({ 
                    ...initialFormData, 
                    codigo_servicio_interno: nextCode,
                    cuenta_contable_ingreso_predeterminada_id: cuentasContables.length > 0 ? cuentasContables[0].cuenta_contable_id : undefined
                });
            } catch {
                setFormData(initialFormData);
            }
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedServicio(null);
        setFormData(initialFormData); // Resetear a valores iniciales
    };

    const validateForm = (): FormErrors => {
        const errors: FormErrors = {};
        if (!formData.codigo_servicio_interno?.trim()) errors.codigo_servicio_interno = "El código es obligatorio.";
        if (!formData.nombre_servicio?.trim()) errors.nombre_servicio = "El nombre es obligatorio.";
        if (formData.precio_base_unitario === undefined || formData.precio_base_unitario < 0) errors.precio_base_unitario = "El precio debe ser un número positivo.";
        if (!formData.tipo_servicio?.trim()) errors.tipo_servicio = "El tipo de servicio es obligatorio.";
        if (!formData.unidad_medida?.trim()) errors.unidad_medida = "La unidad de medida es obligatoria.";
        if (!formData.moneda_id_precio_base) errors.moneda_id_precio_base = "La moneda es obligatoria.";
        
        // Validación específica para la cuenta contable
        if (formData.cuenta_contable_ingreso_predeterminada_id === undefined || formData.cuenta_contable_ingreso_predeterminada_id === null) {
            errors.cuenta_contable_ingreso_predeterminada_id = "La cuenta contable es obligatoria.";
        }

        setFormErrors(errors);
        return errors;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const isCheckbox = type === 'checkbox';
        
        let inputValue: string | boolean | number | undefined = isCheckbox ? (e.target as HTMLInputElement).checked : value;

        if (name === 'precio_base_unitario' || name === 'porcentaje_impuesto_aplicable' || name === 'moneda_id_precio_base' || name === 'cuenta_contable_ingreso_predeterminada_id') {
             inputValue = value === '' ? undefined : Number(value); // Convertir a número si es un campo numérico/ID
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

        // Asegurarse de que los valores numéricos sean 0 si son undefined/null
        const dataToSend = {
            ...formData,
            precio_base_unitario: formData.precio_base_unitario || 0,
            porcentaje_impuesto_aplicable: formData.porcentaje_impuesto_aplicable || 0,
            afecto_impuesto_principal: formData.afecto_impuesto_principal ?? true,
            activo_para_venta: formData.activo_para_venta ?? true,
            // Asegurarse de que el ID de la cuenta contable sea un número o null
            cuenta_contable_ingreso_predeterminada_id: formData.cuenta_contable_ingreso_predeterminada_id || null, 
        };

        try {
            if (selectedServicio) {
                await updateServicio(selectedServicio.servicio_id!, dataToSend);
                showSuccessToast('¡Servicio actualizado con éxito!');
            } else {
                await createServicio(dataToSend as Servicio);
                showSuccessToast('¡Servicio creado con éxito!');
            }
            handleCloseModal();
            loadServicios();
        } catch (error) {
            if (error instanceof Error) showErrorAlert(error.message);
        }
    };

    const handleDelete = async (servicioId: number) => {
        const result = await showConfirmDialog('¿Estás seguro?', 'El servicio pasará a estado "Inactivo".');
        if (result.isConfirmed) {
            try {
                await deleteServicio(servicioId);
                showSuccessToast('Servicio desactivado con éxito.');
                loadServicios();
            } catch (error) {
                if (error instanceof Error) showErrorAlert(error.message);
            }
        }
    };

    if (loading && servicios.length === 0 && cuentasContables.length === 0) return <div className="loading-spinner">Cargando...</div>;

    return (
        <>
            <div className="table-page-container">
                <div className="table-page-header">
                    <h1>Lista de Servicios</h1>
                    <div className="header-actions">
                        <button onClick={handleExport} className="btn-secondary">
                            <FileDown size={18} /> Exportar Excel
                        </button>
                        <button onClick={() => handleOpenModal()} className="btn-primary">
                            <Plus size={18} /> Agregar Servicio
                        </button>
                    </div>
                </div>
                <div className="table-container">
                    <table>
                        <thead>
                        <tr>
                            <th>Código</th>
                            <th>Nombre del Servicio</th>
                            <th>Tipo</th>
                            <th>Precio Base</th>
                            <th>Cuenta Contable Ingreso</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                        <tr className="filter-row">
                            <td>
                                <input
                                    type="text"
                                    name="codigo_servicio_interno"
                                    value={filters.codigo_servicio_interno}
                                    onChange={handleFilterChange}
                                    placeholder="Buscar..."
                                />
                            </td>
                            <td>
                                <input
                                    type="text"
                                    name="nombre_servicio"
                                    value={filters.nombre_servicio}
                                    onChange={handleFilterChange}
                                    placeholder="Buscar..."
                                />
                            </td>
                            <td>
                                <input
                                    type="text"
                                    name="tipo_servicio"
                                    value={filters.tipo_servicio}
                                    onChange={handleFilterChange}
                                    placeholder="Buscar..."
                                />
                            </td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td className="filter-actions">
                                <button onClick={clearFilters} className="btn-icon" title="Limpiar filtros">
                                    <FilterX size={18} />
                                </button>
                            </td>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7}><div className="loading-spinner">Cargando...</div></td></tr>
                        ) : servicios.length > 0 ? (
                            servicios.map((servicio) => (
                                <tr key={servicio.servicio_id}>
                                    <td>{servicio.codigo_servicio_interno}</td>
                                    <td>{servicio.nombre_servicio}</td>
                                    <td>{servicio.tipo_servicio}</td>
                                    <td>{monedas.find(m => m.id === servicio.moneda_id_precio_base)?.simbolo || 'S/'} {Number(servicio.precio_base_unitario).toFixed(2)}</td>
                                    <td>{servicio.cuenta_contable_codigo || 'N/A'}</td>
                                    <td>
                                        <span className={`status-badge ${servicio.activo_para_venta ? 'status-activo' : 'status-inactivo'}`}>
                                            {servicio.activo_para_venta ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td>
                                        <button onClick={() => handleOpenModal(servicio, true)} className="btn-icon" title="Ver">👁️</button>
                                        <button onClick={() => handleOpenModal(servicio)} className="btn-icon" title="Editar">✏️</button>
                                        <button onClick={() => handleDelete(servicio.servicio_id!)} className="btn-icon btn-danger" title="Desactivar">🗑️</button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={7} className="no-data">No se encontraron servicios.</td></tr>
                        )}
                    </tbody>
                    </table>
                </div>
                <div className="pagination-container">
                    <span>Mostrando {servicios.length} de {totalRecords} registros</span>
                    <div className="pagination-controls">
                        <button onClick={() => handlePageChange(1)} disabled={currentPage === 1}><ChevronsLeft size={16} /></button>
                        <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
                        <span>Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong></span>
                        <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}><ChevronRight size={16} /></button>
                        <button onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages}><ChevronsRight size={16} /></button>
                    </div>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={isViewMode ? 'Detalle del Servicio' : (selectedServicio ? 'Editar Servicio' : 'Agregar Servicio')}>
                <form onSubmit={handleSubmit} className="modal-form" noValidate>
                    <div className="form-grid">
                        <div className="form-group floating-label">
                            <input id="codigo_servicio_interno" type="text" name="codigo_servicio_interno" value={formData.codigo_servicio_interno || ''} onChange={handleChange} disabled={true} placeholder=" " />
                            <label htmlFor="codigo_servicio_interno">Código Interno</label>
                        </div>
                        <div className="form-group floating-label">
                            <input id="nombre_servicio" type="text" name="nombre_servicio" value={formData.nombre_servicio || ''} onChange={handleChange} disabled={isViewMode} className={formErrors.nombre_servicio ? 'error' : ''} placeholder=" " required />
                            <label htmlFor="nombre_servicio">Nombre del Servicio</label>
                            {formErrors.nombre_servicio && <span className="error-text">{formErrors.nombre_servicio}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <select id="tipo_servicio" name="tipo_servicio" value={formData.tipo_servicio || ''} onChange={handleChange} disabled={isViewMode}>
                                {tiposDeServicio.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
                            </select>
                            <label htmlFor="tipo_servicio">Tipo de Servicio</label>
                        </div>
                        <div className="form-group floating-label">
                            <select id="unidad_medida" name="unidad_medida" value={formData.unidad_medida || ''} onChange={handleChange} disabled={isViewMode}>
                                {unidadesDeMedida.map(unidad => <option key={unidad} value={unidad}>{unidad}</option>)}
                            </select>
                            <label htmlFor="unidad_medida">Unidad de Medida</label>
                        </div>
                        <div className="form-group floating-label">
                            <input id="precio_base_unitario" type="number" name="precio_base_unitario" value={formData.precio_base_unitario ?? ''} onChange={handleChange} disabled={isViewMode} className={formErrors.precio_base_unitario ? 'error' : ''} placeholder=" " required />
                            <label htmlFor="precio_base_unitario">Precio Base (S/)</label>
                            {formErrors.precio_base_unitario && <span className="error-text">{formErrors.precio_base_unitario}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <select id="moneda_id_precio_base" name="moneda_id_precio_base" value={formData.moneda_id_precio_base || ''} onChange={handleChange} disabled={isViewMode}>
                                {monedas.map(moneda => (
                                    <option key={moneda.id} value={moneda.id}>{moneda.nombre}</option>
                                ))}
                            </select>
                            <label htmlFor="moneda_id_precio_base">Moneda</label>
                        </div>
                        <div className="form-group floating-label full-width">
                            <textarea id="descripcion_detallada_servicio" name="descripcion_detallada_servicio" value={formData.descripcion_detallada_servicio || ''} onChange={handleChange} rows={3} disabled={isViewMode} placeholder=" "></textarea>
                            <label htmlFor="descripcion_detallada_servicio">Descripción Detallada</label>
                        </div>
                        <div className="form-group checkbox-group">
                            <input id="afecto_impuesto_principal" type="checkbox" name="afecto_impuesto_principal" checked={formData.afecto_impuesto_principal ?? true} onChange={handleChange} disabled={isViewMode} />
                            <label htmlFor="afecto_impuesto_principal">Afecto a Impuesto (IGV)</label>
                        </div>
                        <div className="form-group floating-label">
                            <input id="porcentaje_impuesto_aplicable" type="number" name="porcentaje_impuesto_aplicable" value={formData.porcentaje_impuesto_aplicable ?? ''} onChange={handleChange} disabled={isViewMode || !formData.afecto_impuesto_principal} placeholder=" " />
                            <label htmlFor="porcentaje_impuesto_aplicable">% Impuesto</label>
                        </div>
                        {/* ¡CAMBIO CLAVE AQUÍ! Selector para la cuenta contable */}
                        <div className="form-group floating-label">
                            <select 
                                id="cuenta_contable_ingreso_predeterminada_id" 
                                name="cuenta_contable_ingreso_predeterminada_id" 
                                value={formData.cuenta_contable_ingreso_predeterminada_id || ''} 
                                onChange={handleChange} 
                                disabled={isViewMode}
                                className={formErrors.cuenta_contable_ingreso_predeterminada_id ? 'error' : ''}
                                required
                            >
                                <option value="">Seleccione Cuenta Contable</option>
                                {cuentasContables.map(cuenta => (
                                    <option key={cuenta.cuenta_contable_id} value={cuenta.cuenta_contable_id}>
                                        {cuenta.codigo_cuenta} - {cuenta.nombre_cuenta_contable}
                                    </option>
                                ))}
                            </select>
                            <label htmlFor="cuenta_contable_ingreso_predeterminada_id">Cuenta Contable Ingreso</label>
                            {formErrors.cuenta_contable_ingreso_predeterminada_id && <span className="error-text">{formErrors.cuenta_contable_ingreso_predeterminada_id}</span>}
                        </div>
                        {/* FIN CAMBIO CLAVE */}
                        {selectedServicio && (
                            <div className="form-group checkbox-group full-width">
                                <input id="activo_para_venta" type="checkbox" name="activo_para_venta" checked={formData.activo_para_venta ?? true} onChange={handleChange} disabled={isViewMode} />
                                <label htmlFor="activo_para_venta">Activo para la Venta</label>
                            </div>
                        )}
                    </div>

                    {isViewMode && selectedServicio && (
                        <div className="audit-section">
                            <h4>Información de Auditoría</h4>
                            <p><strong>Creado por:</strong> {selectedServicio.creado_por || 'N/A'}</p>
                            <p><strong>Fecha de Creación:</strong> {formatDate(selectedServicio.fecha_creacion)}</p>
                            <p><strong>Última Modificación por:</strong> {selectedServicio.modificado_por || 'N/A'}</p>
                            <p><strong>Fecha de Modificación:</strong> {formatDate(selectedServicio.fecha_modificacion)}</p>
                        </div>
                    )}

                    <div className="form-actions">
                        <button type="button" className="btn-secondary" onClick={handleCloseModal}>{isViewMode ? 'Cerrar' : 'Cancelar'}</button>
                        {!isViewMode && <button type="submit" className="btn-primary">{selectedServicio ? 'Guardar Cambios' : 'Crear Servicio'}</button>}
                    </div>
                </form>
            </Modal>
        </>
    );
};

export default ListaServiciosPage;