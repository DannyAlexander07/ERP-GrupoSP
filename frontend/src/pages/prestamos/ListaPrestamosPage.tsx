// Archivo: frontend/src/pages/prestamos/ListaPrestamosPage.tsx (VERSIÓN FINAL Y CORREGIDA DE ERRORES)
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth'; // Para obtener la empresa del usuario logueado
import { 
    fetchPrestamos, 
    updatePrestamo, // <-- MODIFICADO
    deletePrestamo, // <-- MODIFICADO
    exportarPrestamos,
    fetchPrestamoById, // <-- MODIFICADO
    type Prestamo, 
    //type CuotaPrestamo,
    type PagedPrestamosResponse,
    type PrestamoFilters
} from '../../services/prestamoService';
import { fetchAllMonedas, type Moneda } from '../../services/monedaService'; 
import { fetchEmpresas, type Empresa } from '../../services/empresaService'; 
import { showSuccessToast, showErrorAlert, showConfirmDialog, showValidationErrorAlert } from '../../services/notificationService';
import Modal from '../../components/common/Modal';
import { FileDown, FilterX, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus } from 'lucide-react';
import '../../styles/TablePage.css';

interface FormErrors { 
    [key: string]: string | undefined; 
}

const tiposPrestamo = ['Recibido', 'Otorgado'];
const tiposTasaInteres = ['TEA', 'TNA'];
const periodicidadesCuotas = ['Mensual', 'Trimestral', 'Semestral', 'Anual']; 
const estadosPrestamo = ['Vigente', 'Cancelado', 'Pendiente', 'Atrasado']; 
//const estadosCuota = ['Pendiente', 'Pagada', 'Vencida', 'Anulada']; 

const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'N/A';
        return date.toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
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


const ListaPrestamosPage = () => {
    const navigate = useNavigate();
    const { user: currentUser } = useAuth(); 

    const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedPrestamo, setSelectedPrestamo] = useState<Prestamo | null>(null); 
    const [isViewMode, setIsViewMode] = useState(false);
    const [formErrors, setFormErrors] = useState<FormErrors>({});

    const [monedasDisponibles, setMonedasDisponibles] = useState<Moneda[]>([]);
    const [empresasDisponibles, setEmpresasDisponibles] = useState<Empresa[]>([]); 

    const [filters, setFilters] = useState<PrestamoFilters>({
        tipo_prestamo: '',
        estado_prestamo: '',
        codigo_contrato_prestamo: '',
        entidad_financiera_o_contraparte: ''
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const ROWS_PER_PAGE = 8;

    const initialFormData: Partial<Prestamo> = {
        empresa_id_titular: currentUser?.empresa_id, 
        tipo_prestamo: tiposPrestamo[0], 
        codigo_contrato_prestamo: '',
        descripcion_prestamo: '',
        entidad_financiera_o_contraparte: '',
        moneda_id_prestamo: undefined, 
        monto_principal_original: 0,
        tasa_interes_anual_pactada: 0,
        tipo_tasa_interes: tiposTasaInteres[0],
        fecha_desembolso_o_inicio: '', 
        fecha_primera_cuota: '', 
        numero_total_cuotas_pactadas: 1, 
        periodicidad_cuotas: periodicidadesCuotas[0], 
        dia_pago_mes: 1, 
        estado_prestamo: 'Vigente', 
    };
    const [formData, setFormData] = useState<Partial<Prestamo>>(initialFormData);


    const loadPrestamosAndDependencies = useCallback(async () => {
        try {
            setLoading(true);
            const prestamosData: PagedPrestamosResponse = await fetchPrestamos(currentPage, ROWS_PER_PAGE, filters);
            setPrestamos(prestamosData.records);
            setTotalPages(prestamosData.total_pages);
            setTotalRecords(prestamosData.total_records);

            const monedasData = await fetchAllMonedas();
            setMonedasDisponibles(monedasData);

            const empresasData = await fetchEmpresas(1, 9999, {}); 
            setEmpresasDisponibles(empresasData.records);

            if (monedasData.length === 0) console.warn('Advertencia: No hay monedas registradas para préstamos.');
            if (empresasData.records.length === 0) console.warn('Advertencia: No hay empresas registradas para préstamos.');

        } catch (error) {
            if (error instanceof Error) showErrorAlert(error.message);
        } finally {
            setLoading(false);
        }
    }, [currentPage, filters]);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadPrestamosAndDependencies();
        }, 500);
        return () => clearTimeout(timer);
    }, [loadPrestamosAndDependencies]);


    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const filterValue: string | undefined = value === '' ? undefined : value; 

        setFilters(prev => ({ ...prev, [name]: filterValue }));
        setCurrentPage(1);
    };

    const clearFilters = () => {
        setFilters({ 
            tipo_prestamo: undefined, 
            estado_prestamo: undefined, 
            codigo_contrato_prestamo: '', 
            entidad_financiera_o_contraparte: '' 
        });
        setCurrentPage(1);
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) { 
            setCurrentPage(newPage);
        }
    };
    
    const handleExport = async (currentFilters: PrestamoFilters) => {
        const empresaId = currentUser?.empresa_id;
        if (empresaId === undefined || empresaId === null) {
            showErrorAlert('No se pudo determinar la empresa para la exportación.');
            return;
        }
        await exportarPrestamos(empresaId, currentFilters); 
    };

    const handleOpenModal = async (prestamo: Prestamo | null = null, viewMode = false) => {
        setIsViewMode(viewMode);
        setFormErrors({});

        if (prestamo && prestamo.prestamo_id) {
            try {
                const empresaIdToFetch = prestamo.empresa_id_titular ?? currentUser?.empresa_id; // Preferir del préstamo, si no del usuario
                if (empresaIdToFetch === undefined || empresaIdToFetch === null) {
                    showErrorAlert('No se pudo determinar la empresa del préstamo para cargar los detalles.');
                    return;
                }
                // ¡SOLUCIÓN 3! fetchPrestamoById ahora espera empresaId
                const fullPrestamoData = await fetchPrestamoById(prestamo.prestamo_id, empresaIdToFetch);
                if (!fullPrestamoData) { 
                    showErrorAlert('No se encontró el préstamo o hubo un problema al cargarlo.');
                    return;
                }
                const processedPrestamoData: Prestamo = {
                    ...fullPrestamoData,
                    monto_principal_original: Number(fullPrestamoData.monto_principal_original),
                    tasa_interes_anual_pactada: Number(fullPrestamoData.tasa_interes_anual_pactada),
                    numero_total_cuotas_pactadas: Number(fullPrestamoData.numero_total_cuotas_pactadas),
                    dia_pago_mes: Number(fullPrestamoData.dia_pago_mes),
                    fecha_desembolso_o_inicio: formatToInputDate(fullPrestamoData.fecha_desembolso_o_inicio),
                    fecha_primera_cuota: formatToInputDate(fullPrestamoData.fecha_primera_cuota),
                    fecha_ultima_cuota_proyectada: formatToInputDate(fullPrestamoData.fecha_ultima_cuota_proyectada),
                };
                setSelectedPrestamo(processedPrestamoData);
                setFormData(processedPrestamoData);
            } catch (error) {
                if (error instanceof Error) showErrorAlert(error.message);
                console.error("Error fetching loan data:", error); 
                return;
            }
        } else { // Si es para un nuevo préstamo, redirigir a la página de creación
            handleNavigateToNewLoan();
            return; // No abrir el modal aquí
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedPrestamo(null);
        setFormData(initialFormData); 
    };

    const validateForm = (): FormErrors => {
        const errors: FormErrors = {};
        if (!formData.empresa_id_titular) errors.empresa_id_titular = "La empresa titular es obligatoria.";
        if (!formData.tipo_prestamo?.trim()) errors.tipo_prestamo = "El tipo de préstamo es obligatorio.";
        if (!formData.entidad_financiera_o_contraparte?.trim()) errors.entidad_financiera_o_contraparte = "La entidad/contraparte es obligatoria.";
        if (!formData.moneda_id_prestamo) errors.moneda_id_prestamo = "La moneda es obligatoria.";
        if (formData.monto_principal_original === undefined || formData.monto_principal_original <= 0) errors.monto_principal_original = "El monto principal debe ser mayor a 0.";
        if (formData.tasa_interes_anual_pactada === undefined || formData.tasa_interes_anual_pactada < 0) errors.tasa_interes_anual_pactada = "La tasa de interés debe ser un número positivo o cero.";
        if (!formData.fecha_desembolso_o_inicio) errors.fecha_desembolso_o_inicio = "La fecha de desembolso es obligatoria.";
        if (formData.numero_total_cuotas_pactadas === undefined || formData.numero_total_cuotas_pactadas <= 0) errors.numero_total_cuotas_pactadas = "El número de cuotas debe ser mayor a 0.";
        if (!formData.periodicidad_cuotas?.trim()) errors.periodicidad_cuotas = "La periodicidad es obligatoria.";
        
        if (formData.periodicidad_cuotas !== 'Mensual') {
            errors.periodicidad_cuotas = "Actualmente solo se soporta la periodicidad Mensual para el cálculo de cuotas.";
        }

        setFormErrors(errors);
        return errors;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        let inputValue: string | number | boolean | undefined = value;

        if (type === 'checkbox') {
            inputValue = (e.target as HTMLInputElement).checked;
        } else if (name.includes('monto') || name.includes('tasa') || name.includes('numero_total_cuotas_pactadas') || name.includes('moneda_id') || name.includes('empresa_id') || name.includes('dia_pago_mes')) { 
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
            // ¡CORRECCIÓN CLAVE AQUÍ! Asegurarse de que selectedPrestamo y su ID son válidos.
            if (!selectedPrestamo || selectedPrestamo.prestamo_id === undefined || selectedPrestamo.prestamo_id === null) {
                showErrorAlert('Error interno: No se pudo obtener el ID del préstamo seleccionado para actualizar.');
                return;
            }
            const loanIdToUpdate = selectedPrestamo.prestamo_id; // Ahora garantizado como 'number'

            const empresaTitularId = formData.empresa_id_titular ?? currentUser?.empresa_id ?? empresasDisponibles[0]?.empresa_id;

            if (empresaTitularId === undefined || empresaTitularId === null) {
                showErrorAlert('No se pudo determinar la empresa titular para el préstamo. Por favor, asegúrese de que haya empresas disponibles y que su usuario tenga una empresa asignada.');
                return;
            }
            
            const usuarioId = currentUser?.id;
            const nombreUsuario = currentUser?.nombres + ' ' + currentUser?.apellidos; 
            if (!usuarioId || !nombreUsuario) {
                showErrorAlert('No se pudieron obtener los datos de usuario logueado para la auditoría.');
                return;
            }

            const dataToSend: Partial<Omit<Prestamo, 'prestamo_id' | 'fecha_primera_cuota' | 'fecha_ultima_cuota_proyectada' | 'estado_prestamo' | 'usuario_creacion_id' | 'fecha_creacion' | 'usuario_modificacion_id' | 'fecha_modificacion' | 'empresa_nombre' | 'moneda_nombre' | 'usuario_creador_nombre' | 'usuario_modificador_nombre' | 'cuotas'>> = { 
                ...formData,
                empresa_id_titular: empresaTitularId, 
                
                tipo_prestamo: formData.tipo_prestamo ?? tiposPrestamo[0],
                entidad_financiera_o_contraparte: formData.entidad_financiera_o_contraparte ?? '',
                moneda_id_prestamo: formData.moneda_id_prestamo ?? (monedasDisponibles.length > 0 ? monedasDisponibles[0].moneda_id : 1), 
                monto_principal_original: formData.monto_principal_original ?? 0,
                tasa_interes_anual_pactada: formData.tasa_interes_anual_pactada ?? 0,
                fecha_desembolso_o_inicio: formData.fecha_desembolso_o_inicio ?? formatToInputDate(new Date().toISOString()),
                numero_total_cuotas_pactadas: formData.numero_total_cuotas_pactadas ?? 1,
                periodicidad_cuotas: formData.periodicidad_cuotas ?? periodicidadesCuotas[0],
            }; 

            const prestamoActualizado = await updatePrestamo(loanIdToUpdate, dataToSend, usuarioId, nombreUsuario); 
            showSuccessToast(`¡Préstamo ${prestamoActualizado.codigo_contrato_prestamo || prestamoActualizado.prestamo_id} actualizado con éxito!`);
            handleCloseModal(); 
            loadPrestamosAndDependencies(); 
        } catch (error) {
            if (error instanceof Error) showErrorAlert(error.message);
        }
    };

    const handleDelete = async (prestamoId: number) => {
        const result = await showConfirmDialog('¿Estás seguro?', 'El préstamo pasará a estado "Cancelado" y sus cuotas asociadas también.');
        if (result.isConfirmed) {
            try {
                const empresaId = currentUser?.empresa_id;
                const usuarioId = currentUser?.id;
                const nombreUsuario = currentUser?.nombres + ' ' + currentUser?.apellidos; 
                if (!empresaId || !usuarioId || !nombreUsuario) {
                    showErrorAlert('No se pudieron obtener los datos de empresa/usuario logueado para la auditoría.');
                    return;
                }
                // ¡SOLUCIÓN 1! deletePrestamo ahora espera 4 argumentos
                await deletePrestamo(prestamoId, empresaId, usuarioId, nombreUsuario); 
                showSuccessToast('Préstamo cancelado con éxito.');
                loadPrestamosAndDependencies();
            } catch (error) {
                if (error instanceof Error) showErrorAlert(error.message);
            }
        }
    };

    const handleNavigateToNewLoan = () => {
        navigate('/prestamos/nuevo');
    };

    if (loading && prestamos.length === 0 && monedasDisponibles.length === 0 && empresasDisponibles.length === 0) {
        return <div className="loading-spinner">Cargando...</div>;
    }

    return (
        <>
            <div className="table-page-container">
                <div className="table-page-header">
                    <h1>Lista de Préstamos</h1>
                    <div className="header-actions">
                        <button onClick={() => handleExport(filters)} className="btn-secondary">
                            <FileDown size={18} /> Exportar Excel
                        </button>
                        <button onClick={handleNavigateToNewLoan} className="btn-primary">
                            <Plus size={18} /> Nuevo Préstamo
                        </button>
                    </div>
                </div>
                
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Código Contrato</th>
                                <th>Tipo</th>
                                <th>Entidad/Contraparte</th>
                                <th>Monto Original</th>
                                <th>Tasa Anual</th>
                                <th>Nro. Cuotas</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                            <tr className="filter-row">
                                <td><input type="text" name="codigo_contrato_prestamo" value={filters.codigo_contrato_prestamo || ''} onChange={handleFilterChange} placeholder="Buscar..." /></td>
                                <td>
                                    <select name="tipo_prestamo" value={filters.tipo_prestamo || ''} onChange={handleFilterChange}>
                                        <option value="">Todos</option>
                                        {tiposPrestamo.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
                                    </select>
                                </td>
                                <td><input type="text" name="entidad_financiera_o_contraparte" value={filters.entidad_financiera_o_contraparte || ''} onChange={handleFilterChange} placeholder="Buscar..." /></td>
                                <td></td> 
                                <td></td> 
                                <td></td> 
                                <td>
                                    <select name="estado_prestamo" value={filters.estado_prestamo || ''} onChange={handleFilterChange}>
                                        <option value="">Todos</option>
                                        {estadosPrestamo.map(estado => <option key={estado} value={estado}>{estado}</option>)}
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
                            ) : prestamos.length > 0 ? (
                                prestamos.map((prestamo) => (
                                    <tr key={prestamo.prestamo_id}>
                                        <td>{prestamo.codigo_contrato_prestamo || 'N/A'}</td>
                                        <td>{prestamo.tipo_prestamo}</td>
                                        <td>{prestamo.entidad_financiera_o_contraparte}</td>
                                        <td>{prestamo.moneda_nombre} {Number(prestamo.monto_principal_original).toFixed(2)}</td>
                                        <td>{Number(prestamo.tasa_interes_anual_pactada * 100).toFixed(2)}%</td>
                                        <td>{prestamo.numero_total_cuotas_pactadas}</td>
                                        <td>
                                            <span className={`status-badge status-${prestamo.estado_prestamo?.toLowerCase()}`}>
                                                {prestamo.estado_prestamo}
                                            </span>
                                        </td>
                                        <td>
                                            <button onClick={() => handleOpenModal(prestamo, true)} className="btn-icon" title="Ver">👁️</button>
                                            <button onClick={() => handleOpenModal(prestamo)} className="btn-icon" title="Editar">✏️</button>
                                            <button onClick={() => handleDelete(prestamo.prestamo_id!)} className="btn-icon btn-danger" title="Cancelar">🗑️</button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={8} className="no-data">No se encontraron préstamos.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="pagination-container">
                    <span>Mostrando {prestamos.length} de {totalRecords} registros</span>
                    <div className="pagination-controls">
                        <button onClick={() => handlePageChange(1)} disabled={currentPage === 1}><ChevronsLeft size={16} /></button>
                        <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
                        <span>Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong></span>
                        <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}><ChevronRight size={16} /></button>
                        <button onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages}><ChevronsRight size={16} /></button>
                    </div>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={isViewMode ? 'Detalle del Préstamo' : (selectedPrestamo ? 'Editar Préstamo' : 'Nuevo Préstamo')}>
                <form onSubmit={handleSubmit} className="modal-form" noValidate>
                    <div className="form-grid">
                        {/* Datos del Préstamo (modo edición/vista) */}
                        <div className="form-group floating-label">
                            <input id="codigo_contrato_prestamo" type="text" name="codigo_contrato_prestamo" value={formData.codigo_contrato_prestamo || ''} onChange={handleChange} disabled={isViewMode || !!selectedPrestamo} placeholder=" " />
                            <label htmlFor="codigo_contrato_prestamo">Código de Contrato</label>
                        </div>
                        <div className="form-group floating-label">
                            <select id="empresa_id_titular" name="empresa_id_titular" value={formData.empresa_id_titular || ''} onChange={handleChange} disabled={isViewMode} required>
                                <option value="">Seleccione Empresa</option>
                                {empresasDisponibles.map(empresa => (
                                    <option key={empresa.empresa_id} value={empresa.empresa_id}>{empresa.nombre_empresa}</option>
                                ))}
                            </select>
                            <label htmlFor="empresa_id_titular">Empresa Titular</label>
                            {formErrors.empresa_id_titular && <span className="error-text">{formErrors.empresa_id_titular}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <select id="tipo_prestamo" name="tipo_prestamo" value={formData.tipo_prestamo || ''} onChange={handleChange} disabled={isViewMode} required>
                                <option value="">Seleccione Tipo</option>
                                {tiposPrestamo.map(tipo => (
                                    <option key={tipo} value={tipo}>{tipo}</option>
                                ))}
                            </select>
                            <label htmlFor="tipo_prestamo">Tipo de Préstamo</label>
                            {formErrors.tipo_prestamo && <span className="error-text">{formErrors.tipo_prestamo}</span>}
                        </div>
                        <div className="form-group floating-label full-width">
                            <textarea id="descripcion_prestamo" name="descripcion_prestamo" value={formData.descripcion_prestamo || ''} onChange={handleChange} rows={2} disabled={isViewMode} placeholder=" "></textarea>
                            <label htmlFor="descripcion_prestamo">Descripción del Préstamo</label>
                        </div>
                        <div className="form-group floating-label">
                            <input id="entidad_financiera_o_contraparte" type="text" name="entidad_financiera_o_contraparte" value={formData.entidad_financiera_o_contraparte || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " required />
                            <label htmlFor="entidad_financiera_o_contraparte">Entidad Financiera / Contraparte</label>
                            {formErrors.entidad_financiera_o_contraparte && <span className="error-text">{formErrors.entidad_financiera_o_contraparte}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <select id="moneda_id_prestamo" name="moneda_id_prestamo" value={formData.moneda_id_prestamo || ''} onChange={handleChange} disabled={isViewMode} required>
                                <option value="">Seleccione Moneda</option>
                                {monedasDisponibles.map(moneda => (
                                    <option key={moneda.moneda_id} value={moneda.moneda_id}>{moneda.nombre_moneda}</option>
                                ))}
                            </select>
                            <label htmlFor="moneda_id_prestamo">Moneda</label>
                            {formErrors.moneda_id_prestamo && <span className="error-text">{formErrors.moneda_id_prestamo}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <input id="monto_principal_original" type="number" step="0.01" name="monto_principal_original" value={formData.monto_principal_original ?? ''} onChange={handleChange} disabled={isViewMode} placeholder=" " required />
                            <label htmlFor="monto_principal_original">Monto Principal Original</label>
                            {formErrors.monto_principal_original && <span className="error-text">{formErrors.monto_principal_original}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <input id="tasa_interes_anual_pactada" type="number" step="0.0001" name="tasa_interes_anual_pactada" value={formData.tasa_interes_anual_pactada ?? ''} onChange={handleChange} disabled={isViewMode} placeholder=" " required />
                            <label htmlFor="tasa_interes_anual_pactada">Tasa Interés Anual (Ej: 0.05 para 5%)</label>
                            {formErrors.tasa_interes_anual_pactada && <span className="error-text">{formErrors.tasa_interes_anual_pactada}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <select id="tipo_tasa_interes" name="tipo_tasa_interes" value={formData.tipo_tasa_interes || ''} onChange={handleChange} disabled={isViewMode}>
                                <option value="">Seleccione Tipo Tasa</option>
                                {tiposTasaInteres.map(tipo => (
                                    <option key={tipo} value={tipo}>{tipo}</option>
                                ))}
                            </select>
                            <label htmlFor="tipo_tasa_interes">Tipo de Tasa</label>
                        </div>
                        <div className="form-group floating-label">
                            <input id="fecha_desembolso_o_inicio" type="date" name="fecha_desembolso_o_inicio" value={formData.fecha_desembolso_o_inicio || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " required />
                            <label htmlFor="fecha_desembolso_o_inicio">Fecha Desembolso / Inicio</label>
                            {formErrors.fecha_desembolso_o_inicio && <span className="error-text">{formErrors.fecha_desembolso_o_inicio}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <input id="numero_total_cuotas_pactadas" type="number" name="numero_total_cuotas_pactadas" value={formData.numero_total_cuotas_pactadas ?? ''} onChange={handleChange} disabled={isViewMode} placeholder=" " required />
                            <label htmlFor="numero_total_cuotas_pactadas">Número Total de Cuotas</label>
                            {formErrors.numero_total_cuotas_pactadas && <span className="error-text">{formErrors.numero_total_cuotas_pactadas}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <select id="periodicidad_cuotas" name="periodicidad_cuotas" value={formData.periodicidad_cuotas || ''} onChange={handleChange} disabled={isViewMode} required>
                                <option value="">Seleccione Periodicidad</option>
                                {periodicidadesCuotas.map(per => (
                                    <option key={per} value={per}>{per}</option>
                                ))}
                            </select>
                            <label htmlFor="periodicidad_cuotas">Periodicidad Cuotas</label>
                            {formErrors.periodicidad_cuotas && <span className="error-text">{formErrors.periodicidad_cuotas}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <input id="dia_pago_mes" type="number" name="dia_pago_mes" value={formData.dia_pago_mes ?? ''} onChange={handleChange} disabled={isViewMode} placeholder=" " min="1" max="31" />
                            <label htmlFor="dia_pago_mes">Día de Pago (1-31)</label>
                        </div>

                        {selectedPrestamo && ( 
                            <>
                                <h4 className="form-section-title full-width">Fechas Proyectadas y Estado</h4>
                                <div className="form-group floating-label">
                                    <input id="fecha_primera_cuota" type="text" name="fecha_primera_cuota" value={formatDate(selectedPrestamo.fecha_primera_cuota) || ''} disabled={true} placeholder=" " />
                                    <label htmlFor="fecha_primera_cuota">Fecha Primera Cuota</label>
                                </div>
                                <div className="form-group floating-label">
                                    <input id="fecha_ultima_cuota_proyectada" type="text" name="fecha_ultima_cuota_proyectada" value={formatDate(selectedPrestamo.fecha_ultima_cuota_proyectada) || ''} disabled={true} placeholder=" " />
                                    <label htmlFor="fecha_ultima_cuota_proyectada">Fecha Última Cuota Proyectada</label>
                                </div>
                                <div className="form-group floating-label">
                                    <select id="estado_prestamo" name="estado_prestamo" value={formData.estado_prestamo || ''} onChange={handleChange} disabled={isViewMode} required>
                                        <option value="">Seleccione Estado</option>
                                        {estadosPrestamo.map(estado => (
                                            <option key={estado} value={estado}>{estado}</option>
                                        ))}
                                    </select>
                                    <label htmlFor="estado_prestamo">Estado del Préstamo</label>
                                </div>

                                {/* Cuotas de Amortización */}
                                <h4 className="form-section-title full-width">Cuotas de Amortización</h4>
                                {selectedPrestamo.cuotas && selectedPrestamo.cuotas.length > 0 ? (
                                    <div className="full-width table-container"> 
                                        <table className="cuotas-table"> 
                                            <thead>
                                                <tr>
                                                    <th>Nro.</th>
                                                    <th>Vencimiento</th>
                                                    <th>Capital</th>
                                                    <th>Interés</th>
                                                    <th>Total Cuota</th>
                                                    <th>Estado</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedPrestamo.cuotas.map((cuota) => (
                                                    <tr key={cuota.cuota_prestamo_id}>
                                                        <td>{cuota.numero_cuota}</td>
                                                        <td>{formatDate(cuota.fecha_vencimiento_cuota)}</td>
                                                        <td>{selectedPrestamo.moneda_nombre} {Number(cuota.monto_capital_cuota).toFixed(2)}</td>
                                                        <td>{selectedPrestamo.moneda_nombre} {Number(cuota.monto_interes_cuota).toFixed(2)}</td>
                                                        <td>{selectedPrestamo.moneda_nombre} {Number(cuota.monto_total_cuota_proyectado).toFixed(2)}</td>
                                                        <td>
                                                            <span className={`status-badge status-${cuota.estado_cuota?.toLowerCase()}`}>
                                                                {cuota.estado_cuota}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="no-data-small full-width">No hay cuotas generadas para este préstamo.</p>
                                )}
                            </>
                        )}
                    </div>

                    {selectedPrestamo && (
                        <div className="audit-section">
                            <h4>Información de Auditoría</h4>
                            <p><strong>Creado por:</strong> {selectedPrestamo.creado_por || 'N/A'}</p>
                            <p><strong>Fecha de Creación:</strong> {formatDateTime(selectedPrestamo.fecha_creacion)}</p> 
                            <p><strong>Última Modificación por:</strong> {selectedPrestamo.modificado_por || 'N/A'}</p>
                            <p><strong>Fecha de Modificación:</strong> {formatDateTime(selectedPrestamo.fecha_modificacion)}</p>
                        </div>
                    )}

                    <div className="form-actions">
                        <button type="button" className="btn-secondary" onClick={handleCloseModal}>{isViewMode ? 'Cerrar' : 'Cancelar'}</button>
                        {!isViewMode && <button type="submit" className="btn-primary">Guardar Cambios</button>} 
                    </div>
                </form>
            </Modal>
        </>
    );
};

export default ListaPrestamosPage;