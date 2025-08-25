import React, { useEffect, useState, useCallback } from 'react';
import { 
    fetchCentrosCosto, 
    createCentroCosto, 
    updateCentroCosto, 
    deleteCentroCosto, 
    fetchCentroCostoById,
    type CentroCosto,
    type PagedCentrosCostoResponse
} from '../../services/centroCostoService';
import { showSuccessToast, showErrorAlert, showConfirmDialog, showValidationErrorAlert } from '../../services/notificationService';
import Modal from '../../components/common/Modal';
import { FilterX, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus } from 'lucide-react';
import '../../styles/TablePage.css';

interface FormErrors { [key: string]: string; }

const ListaCentrosCostoPage = () => {
    const [centrosCosto, setCentrosCosto] = useState<CentroCosto[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCentroCosto, setSelectedCentroCosto] = useState<CentroCosto | null>(null);
    const [isViewMode, setIsViewMode] = useState(false);
    const [formErrors, setFormErrors] = useState<FormErrors>({});

    const [filters, setFilters] = useState({ codigo_centro_costo: '', nombre_centro_costo: '' });
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const ROWS_PER_PAGE = 8;

    const initialFormData: Partial<CentroCosto> = {
        codigo_centro_costo: '',
        nombre_centro_costo: '',
        descripcion_centro_costo: '',
        estado: 'Activo',
    };
    const [formData, setFormData] = useState<Partial<CentroCosto>>(initialFormData);

    const loadCentrosCosto = useCallback(async () => {
        try {
            setLoading(true);
            const data: PagedCentrosCostoResponse = await fetchCentrosCosto(currentPage, ROWS_PER_PAGE, filters);
            setCentrosCosto(data.records);
            setTotalPages(data.total_pages);
            setTotalRecords(data.total_records);
        } catch (error) {
            if (error instanceof Error) showErrorAlert(error.message);
        } finally {
            setLoading(false);
        }
    }, [currentPage, filters]);

    useEffect(() => {
        const timer = setTimeout(() => loadCentrosCosto(), 500);
        return () => clearTimeout(timer);
    }, [loadCentrosCosto]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
        setCurrentPage(1);
    };

    const clearFilters = () => {
        setFilters({ codigo_centro_costo: '', nombre_centro_costo: '' });
        setCurrentPage(1);
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) setCurrentPage(newPage);
    };
    
    const handleOpenModal = async (centro: CentroCosto | null = null, viewMode = false) => {
        setIsViewMode(viewMode);
        setFormErrors({});
        if (centro) {
            const fullData = await fetchCentroCostoById(centro.centro_costo_id);
            setSelectedCentroCosto(fullData);
            setFormData(fullData);
        } else {
            setSelectedCentroCosto(null);
            setFormData(initialFormData);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedCentroCosto(null);
    };

    const validateForm = (): FormErrors => {
        const errors: FormErrors = {};
        if (!formData.codigo_centro_costo?.trim()) errors.codigo_centro_costo = "El código es obligatorio.";
        if (!formData.nombre_centro_costo?.trim()) errors.nombre_centro_costo = "El nombre es obligatorio.";
        setFormErrors(errors);
        return errors;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const errors = validateForm();
        if (Object.keys(errors).length > 0) {
            showValidationErrorAlert(errors);
            return;
        }
        try {
            if (selectedCentroCosto) {
                await updateCentroCosto(selectedCentroCosto.centro_costo_id!, formData);
                showSuccessToast('¡Centro de Costo actualizado!');
            } else {
                await createCentroCosto(formData as CentroCosto);
                showSuccessToast('¡Centro de Costo creado!');
            }
            handleCloseModal();
            loadCentrosCosto();
        } catch (error) {
            if (error instanceof Error) showErrorAlert(error.message);
        }
    };

    const handleDelete = async (id: number) => {
        const result = await showConfirmDialog('¿Estás seguro?', 'El centro de costo se desactivará.');
        if (result.isConfirmed) {
            try {
                await deleteCentroCosto(id);
                showSuccessToast('Centro de Costo desactivado.');
                loadCentrosCosto();
            } catch (error) {
                if (error instanceof Error) showErrorAlert(error.message);
            }
        }
    };

    if (loading) return <div className="loading-spinner">Cargando...</div>;

    return (
        <div className="table-page-container">
            <div className="table-page-header">
                <h1>Centros de Costo</h1>
                <div className="header-actions">
                    <button onClick={() => handleOpenModal()} className="btn-primary">
                        <Plus size={18} /> Agregar Centro de Costo
                    </button>
                </div>
            </div>
            
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Nombre</th>
                            <th>Descripción</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                        <tr className="filter-row">
                            <td><input name="codigo_centro_costo" value={filters.codigo_centro_costo} onChange={handleFilterChange} placeholder="Buscar..." /></td>
                            <td><input name="nombre_centro_costo" value={filters.nombre_centro_costo} onChange={handleFilterChange} placeholder="Buscar..." /></td>
                            <td></td>
                            <td></td>
                            <td className="filter-actions">
                                <button onClick={clearFilters} className="btn-icon" title="Limpiar filtros"><FilterX size={18} /></button>
                            </td>
                        </tr>
                    </thead>
                    <tbody>
                        {centrosCosto.map((centro) => (
                            <tr key={centro.centro_costo_id}>
                                <td>{centro.codigo_centro_costo}</td>
                                <td>{centro.nombre_centro_costo}</td>
                                <td>{centro.descripcion_centro_costo || 'N/A'}</td>
                                <td><span className={`status-badge status-${centro.estado?.toLowerCase()}`}>{centro.estado}</span></td>
                                <td>
                                    <button onClick={() => handleOpenModal(centro, true)} className="btn-icon" title="Ver">👁️</button>
                                    <button onClick={() => handleOpenModal(centro)} className="btn-icon" title="Editar">✏️</button>
                                    <button onClick={() => handleDelete(centro.centro_costo_id!)} className="btn-icon btn-danger" title="Desactivar">🗑️</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="pagination-container">
                <span>Mostrando {centrosCosto.length} de {totalRecords} registros</span>
                <div className="pagination-controls">
                    <button onClick={() => handlePageChange(1)} disabled={currentPage === 1}><ChevronsLeft size={16} /></button>
                    <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
                    <span>Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong></span>
                    <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}><ChevronRight size={16} /></button>
                    <button onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages}><ChevronsRight size={16} /></button>
                </div>
            </div>

            {isModalOpen && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={isViewMode ? 'Detalle de Centro de Costo' : (selectedCentroCosto ? 'Editar Centro de Costo' : 'Nuevo Centro de Costo')}>
                    <form onSubmit={handleSubmit} className="modal-form" noValidate>
                        <div className="form-grid">
                            <div className="form-group floating-label">
                                <input id="codigo_centro_costo" type="text" name="codigo_centro_costo" value={formData.codigo_centro_costo || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " required />
                                <label htmlFor="codigo_centro_costo">Código</label>
                                {formErrors.codigo_centro_costo && <span className="error-text">{formErrors.codigo_centro_costo}</span>}
                            </div>
                            <div className="form-group floating-label">
                                <input id="nombre_centro_costo" type="text" name="nombre_centro_costo" value={formData.nombre_centro_costo || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " required />
                                <label htmlFor="nombre_centro_costo">Nombre</label>
                                {formErrors.nombre_centro_costo && <span className="error-text">{formErrors.nombre_centro_costo}</span>}
                            </div>
                            <div className="form-group floating-label full-width">
                                <textarea id="descripcion_centro_costo" name="descripcion_centro_costo" value={formData.descripcion_centro_costo || ''} onChange={handleChange} rows={3} disabled={isViewMode} placeholder=" "></textarea>
                                <label htmlFor="descripcion_centro_costo">Descripción</label>
                            </div>
                        </div>
                        <div className="form-actions">
                            <button type="button" className="btn-secondary" onClick={handleCloseModal}>{isViewMode ? 'Cerrar' : 'Cancelar'}</button>
                            {!isViewMode && <button type="submit" className="btn-primary">{selectedCentroCosto ? 'Guardar Cambios' : 'Crear Centro de Costo'}</button>}
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default ListaCentrosCostoPage;