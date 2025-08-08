// Archivo: frontend/src/pages/configuracion/ListaUsuariosPage.tsx (VERSIÓN FINAL Y CORREGIDA PARA DELETE DE PROPIEDADES)
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth'; 
import { 
    fetchUsuarios, 
    createUsuario, 
    updateUsuario, 
    deleteUsuario, 
    exportUsuarios,
    fetchUsuarioById, 
    type Usuario, 
    type PagedUsuariosResponse,
    type UsuarioFilters
} from '../../services/usuarioService';
import { fetchRoles, type Role } from '../../services/rolService'; 
import { fetchEmpresas, type Empresa } from '../../services/empresaService'; 
import { showSuccessToast, showErrorAlert, showConfirmDialog, showValidationErrorAlert } from '../../services/notificationService';
import Modal from '../../components/common/Modal';
import { FileDown, FilterX, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus } from 'lucide-react';
import '../../styles/TablePage.css'; 

interface FormErrors { 
    [key: string]: string | undefined; 
    roles?: string; 
    contrasena_raw?: string;
    confirmar_contrasena?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    } catch  {
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


const ListaUsuariosPage = () => {
    const { user: currentUser } = useAuth(); 
    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUsuario, setSelectedUsuario] = useState<Usuario | null>(null);
    const [isViewMode, setIsViewMode] = useState(false);
    const [formErrors, setFormErrors] = useState<FormErrors>({});

    const [empresasDisponibles, setEmpresasDisponibles] = useState<Empresa[]>([]);
    const [rolesDisponibles, setRolesDisponibles] = useState<Role[]>([]); 

    const [filters, setFilters] = useState<UsuarioFilters>({
        nombre_usuario_login: '',
        nombres_completos_persona: '',
        apellidos_completos_persona: '',
        email_corporativo: '',
        activo: undefined 
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const ROWS_PER_PAGE = 8;

    const initialFormData: Partial<Usuario> = {
        nombre_usuario_login: '',
        contrasena_raw: '', 
        nombres_completos_persona: '',
        apellidos_completos_persona: '',
        email_corporativo: '',
        telefono_contacto: '',
        cargo_o_puesto: '',
        empresa_id_predeterminada: currentUser?.empresa_id || undefined, 
        activo: true,
        fecha_expiracion_cuenta: '',
        requiere_cambio_contrasena_en_login: false,
        foto_perfil_url: '',
        rol_ids: [], 
    };
    const [formData, setFormData] = useState<Partial<Usuario>>(initialFormData);
    const [confirmarContrasena, setConfirmarContrasena] = useState(''); 

    const loadUsuariosAndDependencies = useCallback(async () => {
        try {
            setLoading(true);
            const usersData: PagedUsuariosResponse = await fetchUsuarios(currentPage, ROWS_PER_PAGE, filters);
            setUsuarios(usersData.records);
            setTotalPages(usersData.total_pages);
            setTotalRecords(usersData.total_records);

            const allRolesData = await fetchRoles(1, 9999, {}); 
            setRolesDisponibles(allRolesData.records);

            const allEmpresasData = await fetchEmpresas(1, 9999, {});
            setEmpresasDisponibles(allEmpresasData.records);

        } catch (error) {
            if (error instanceof Error) showErrorAlert(error.message);
        } finally {
            setLoading(false);
        }
    }, [currentPage, filters, currentUser?.empresa_id]); 

    useEffect(() => {
        const timer = setTimeout(() => {
            loadUsuariosAndDependencies();
        }, 500);
        return () => clearTimeout(timer);
    }, [loadUsuariosAndDependencies]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        let filterValue: string | boolean | undefined = value;

        if (name === 'activo') {
            filterValue = value === 'true' ? true : value === 'false' ? false : undefined;
        }

        setFilters(prev => ({ ...prev, [name]: filterValue }));
        setCurrentPage(1);
    };

    const clearFilters = () => {
        setFilters({ 
            nombre_usuario_login: '', 
            nombres_completos_persona: '', 
            apellidos_completos_persona: '', 
            email_corporativo: '', 
            activo: undefined 
        });
        setCurrentPage(1);
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) { 
            setCurrentPage(newPage);
        }
    };
    
    const handleExport = async (currentFilters: UsuarioFilters) => { // ¡CAMBIO AQUÍ! Acepta 'currentFilters'
        try {
            await exportUsuarios(currentFilters); // ¡PASAMOS 'currentFilters' AL SERVICIO!
        } catch (error) {
            console.error(error);
            if (error instanceof Error) showErrorAlert(error.message); // Añadido manejo de error para la alerta
        }
    };

    const handleOpenModal = async (usuario: Usuario | null = null, viewMode = false) => {
        setIsViewMode(viewMode);
        setFormErrors({});
        setConfirmarContrasena(''); 

        if (usuario && usuario.usuario_id) {
            try {
                const fullUserData = await fetchUsuarioById(usuario.usuario_id);
                if (!fullUserData) { 
                    showErrorAlert('No se encontró el usuario o hubo un problema al cargarlo.');
                    return;
                }
                const processedUserData: Usuario = {
                    ...fullUserData,
                    fecha_expiracion_cuenta: formatToInputDate(fullUserData.fecha_expiracion_cuenta),
                    contrasena_raw: undefined, 
                    rol_ids: fullUserData.roles?.map(r => r.rol_id!) || [],
                };
                setSelectedUsuario(processedUserData);
                setFormData(processedUserData);
            } catch (error) {
                if (error instanceof Error) showErrorAlert(error.message);
                console.error("Error fetching user data:", error); 
                return;
            }
        } else {
            setSelectedUsuario(null);
            setFormData({ 
                ...initialFormData,
                empresa_id_predeterminada: empresasDisponibles.length > 0 ? empresasDisponibles[0].empresa_id : undefined,
                rol_ids: [], 
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedUsuario(null);
        setFormData(initialFormData); 
        setConfirmarContrasena('');
    };

    const validateForm = (): FormErrors => {
        const errors: FormErrors = {};
        if (!formData.nombre_usuario_login?.trim()) errors.nombre_usuario_login = "El nombre de usuario es obligatorio.";
        if (!formData.nombres_completos_persona?.trim()) errors.nombres_completos_persona = "Los nombres son obligatorios.";
        if (!formData.apellidos_completos_persona?.trim()) errors.apellidos_completos_persona = "Los apellidos son obligatorios.";
        if (!formData.email_corporativo?.trim()) errors.email_corporativo = "El email corporativo es obligatorio.";
        else if (!/\S+@\S+\.\S+/.test(formData.email_corporativo)) errors.email_corporativo = "El formato del email no es válido.";
        if (!formData.empresa_id_predeterminada) errors.empresa_id_predeterminada = "La empresa predeterminada es obligatoria.";

        if (!selectedUsuario || (formData.contrasena_raw !== undefined && formData.contrasena_raw !== null && formData.contrasena_raw.trim() !== '')) {
            if (!formData.contrasena_raw?.trim()) {
                errors.contrasena_raw = "La contraseña es obligatoria.";
            } else if (formData.contrasena_raw.length < 6) {
                errors.contrasena_raw = "La contraseña debe tener al menos 6 caracteres.";
            } else if (formData.contrasena_raw !== confirmarContrasena) {
                errors.confirmar_contrasena = "Las contraseñas no coinciden.";
            }
        }
        
        if (!formData.rol_ids || formData.rol_ids.length === 0) {
            errors.roles = "Debe asignar al menos un rol al usuario.";
        }

        setFormErrors(errors);
        return errors;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        let inputValue: string | number | boolean | undefined = value;

        if (type === 'checkbox') {
            inputValue = (e.target as HTMLInputElement).checked;
        } else if (name === 'empresa_id_predeterminada') { 
            inputValue = Number(value);
        } else if (type === 'date' && value === '') { 
            inputValue = undefined;
        }
        
        setFormData(prev => ({ ...prev, [name]: inputValue }));
    };

    const handleRoleToggle = (roleId: number) => {
        setFormData(prev => {
            const currentRoles = prev.rol_ids || [];
            if (currentRoles.includes(roleId)) {
                return { ...prev, rol_ids: currentRoles.filter(id => id !== roleId) };
            } else {
                return { ...prev, rol_ids: [...currentRoles, roleId] };
            }
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const errors = validateForm();
        if (Object.keys(errors).length > 0) {
            showValidationErrorAlert(errors);
            return;
        }

        try {
            const dataToSend: Partial<Usuario> = { ...formData };
            // ¡ELIMINADAS ESTAS LÍNEAS! Ya no son necesarias y causaban errores de tipado.
            // delete dataToSend.creado_por;
            // delete dataToSend.fecha_creacion; 
            // delete dataToSend.modificado_por;
            // delete dataToSend.fecha_modificacion;
            // delete dataToSend.roles; 
            // delete dataToSend.usuario_creacion_id;
            // delete dataToSend.usuario_modificacion_id;
            // delete dataToSend.fecha_ultimo_login_exitoso;
            // delete dataToSend.numero_intentos_fallidos_login;
            // delete dataToSend.cuenta_bloqueada_hasta;

            dataToSend.empresa_id_predeterminada = dataToSend.empresa_id_predeterminada || undefined;
            dataToSend.fecha_expiracion_cuenta = dataToSend.fecha_expiracion_cuenta || undefined;
            
            // Asegurarse de que `contrasena_raw` se envíe solo si no está vacío
            if (dataToSend.contrasena_raw && dataToSend.contrasena_raw.trim() === '') {
                delete dataToSend.contrasena_raw;
            }

            if (selectedUsuario) {
                await updateUsuario(selectedUsuario.usuario_id!, dataToSend);
                showSuccessToast('¡Usuario actualizado con éxito!');
            } else {
                await createUsuario(dataToSend as Usuario); 
                showSuccessToast('¡Usuario creado con éxito!');
            }
            handleCloseModal(); 
            loadUsuariosAndDependencies(); 
        } catch (error) {
            if (error instanceof Error) showErrorAlert(error.message);
        }
    };

    const handleDelete = async (usuarioId: number) => {
        const result = await showConfirmDialog('¿Estás seguro?', 'El usuario pasará a estado "Inactivo".');
        if (result.isConfirmed) {
            try {
                const modificadorId = currentUser?.id;
                const nombreModificador = currentUser?.nombres + ' ' + currentUser?.apellidos; 
                if (!modificadorId || !nombreModificador) {
                    showErrorAlert('No se pudieron obtener los datos del usuario logueado para la auditoría.');
                    return;
                }
                await deleteUsuario(usuarioId);
                showSuccessToast('Usuario desactivado con éxito.');
                loadUsuariosAndDependencies();
            } catch (error) {
                if (error instanceof Error) showErrorAlert(error.message);
            }
        }
    };

    if (loading && usuarios.length === 0 && empresasDisponibles.length === 0 && rolesDisponibles.length === 0) {
        return <div className="loading-spinner">Cargando...</div>;
    }

    return (
        <>
            <div className="table-page-container">
                <div className="table-page-header">
                    <h1>Gestión de Usuarios</h1>
                    <div className="header-actions">
                        <button onClick={() => handleExport(filters)} className="btn-secondary">
                            <FileDown size={18} /> Exportar Excel
                        </button>
                        <button onClick={() => handleOpenModal()} className="btn-primary">
                            <Plus size={18} /> Nuevo Usuario
                        </button>
                    </div>
                </div>
                
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Usuario Login</th>
                                <th>Nombres Completos</th>
                                <th>Email</th>
                                <th>Empresa Pred.</th>
                                <th>Roles</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                            <tr className="filter-row">
                                <td><input type="text" name="nombre_usuario_login" value={filters.nombre_usuario_login || ''} onChange={handleFilterChange} placeholder="Buscar..." /></td>
                                <td><input type="text" name="nombres_completos_persona" value={filters.nombres_completos_persona || ''} onChange={handleFilterChange} placeholder="Buscar..." /></td>
                                <td><input type="text" name="email_corporativo" value={filters.email_corporativo || ''} onChange={handleFilterChange} placeholder="Buscar..." /></td>
                                <td></td> 
                                <td></td> 
                                <td>
                                    <select name="activo" value={filters.activo === true ? 'true' : filters.activo === false ? 'false' : ''} onChange={handleFilterChange}>
                                        <option value="">Todos</option>
                                        <option value="true">Activo</option>
                                        <option value="false">Inactivo</option>
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
                            ) : usuarios.length > 0 ? (
                                usuarios.map((usuario) => (
                                    <tr key={usuario.usuario_id}>
                                        <td>{usuario.nombre_usuario_login}</td>
                                        <td>{usuario.nombres_completos_persona} {usuario.apellidos_completos_persona}</td>
                                        <td>{usuario.email_corporativo}</td>
                                        <td>{usuario.empresa_nombre || 'N/A'}</td>
                                        <td>
                                            {usuario.roles && usuario.roles.length > 0
                                                ? usuario.roles.map(rol => rol.nombre_rol).join(', ')
                                                : 'Ninguno'}
                                        </td>
                                        <td>
                                            <span className={`status-badge ${usuario.activo ? 'status-activo' : 'status-inactivo'}`}>
                                                {usuario.activo ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td>
                                            <button onClick={() => handleOpenModal(usuario, true)} className="btn-icon" title="Ver">👁️</button>
                                            <button onClick={() => handleOpenModal(usuario)} className="btn-icon" title="Editar">✏️</button>
                                            <button onClick={() => handleDelete(usuario.usuario_id!)} className="btn-icon btn-danger" title="Desactivar">🗑️</button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={7} className="no-data">No se encontraron usuarios.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="pagination-container">
                    <span>Mostrando {usuarios.length} de {totalRecords} registros</span>
                    <div className="pagination-controls">
                        <button onClick={() => handlePageChange(1)} disabled={currentPage === 1}><ChevronsLeft size={16} /></button>
                        <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
                        <span>Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong></span>
                        <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}><ChevronRight size={16} /></button>
                        <button onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages}><ChevronsRight size={16} /></button>
                    </div>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={isViewMode ? 'Detalle del Usuario' : (selectedUsuario ? 'Editar Usuario' : 'Nuevo Usuario')}>
                <form onSubmit={handleSubmit} className="modal-form" noValidate>
                    <div className="form-grid">
                        {/* Datos Básicos del Usuario */}
                        <div className="form-group floating-label">
                            <input id="nombre_usuario_login" type="text" name="nombre_usuario_login" value={formData.nombre_usuario_login || ''} onChange={handleChange} disabled={isViewMode || !!selectedUsuario} placeholder=" " required />
                            <label htmlFor="nombre_usuario_login">Nombre de Usuario Login</label>
                            {formErrors.nombre_usuario_login && <span className="error-text">{formErrors.nombre_usuario_login}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <input id="nombres_completos_persona" type="text" name="nombres_completos_persona" value={formData.nombres_completos_persona || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " required />
                            <label htmlFor="nombres_completos_persona">Nombres Completos</label>
                            {formErrors.nombres_completos_persona && <span className="error-text">{formErrors.nombres_completos_persona}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <input id="apellidos_completos_persona" type="text" name="apellidos_completos_persona" value={formData.apellidos_completos_persona || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " required />
                            <label htmlFor="apellidos_completos_persona">Apellidos Completos</label>
                            {formErrors.apellidos_completos_persona && <span className="error-text">{formErrors.apellidos_completos_persona}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <input id="email_corporativo" type="email" name="email_corporativo" value={formData.email_corporativo || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " required />
                            <label htmlFor="email_corporativo">Email Corporativo</label>
                            {formErrors.email_corporativo && <span className="error-text">{formErrors.email_corporativo}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <input id="telefono_contacto" type="tel" name="telefono_contacto" value={formData.telefono_contacto || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="telefono_contacto">Teléfono de Contacto</label>
                        </div>
                        <div className="form-group floating-label">
                            <input id="cargo_o_puesto" type="text" name="cargo_o_puesto" value={formData.cargo_o_puesto || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="cargo_o_puesto">Cargo / Puesto</label>
                        </div>
                        <div className="form-group floating-label">
                            <select id="empresa_id_predeterminada" name="empresa_id_predeterminada" value={formData.empresa_id_predeterminada || ''} onChange={handleChange} disabled={isViewMode} required>
                                <option value="">Seleccione Empresa</option>
                                {empresasDisponibles.map(empresa => (
                                    <option key={empresa.empresa_id} value={empresa.empresa_id}>{empresa.nombre_empresa}</option>
                                ))}
                            </select>
                            <label htmlFor="empresa_id_predeterminada">Empresa Predeterminada</label>
                            {formErrors.empresa_id_predeterminada && <span className="error-text">{formErrors.empresa_id_predeterminada}</span>}
                        </div>
                        <div className="form-group floating-label">
                            <input id="foto_perfil_url" type="text" name="foto_perfil_url" value={formData.foto_perfil_url || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="foto_perfil_url">URL Foto de Perfil</label>
                        </div>
                        
                        {/* Contraseña (solo si es nuevo usuario o se va a cambiar) */}
                        {(!selectedUsuario || (!isViewMode && (formData.contrasena_raw !== undefined && formData.contrasena_raw !== null))) && (
                            <>
                                <h4 className="form-section-title full-width">{selectedUsuario ? 'Cambiar Contraseña' : 'Contraseña'}</h4>
                                <div className="form-group floating-label">
                                    <input id="contrasena_raw" type="password" name="contrasena_raw" value={formData.contrasena_raw || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " autoComplete="new-password" />
                                    <label htmlFor="contrasena_raw">Contraseña</label>
                                    {formErrors.contrasena_raw && <span className="error-text">{formErrors.contrasena_raw}</span>}
                                </div>
                                <div className="form-group floating-label">
                                    <input id="confirmar_contrasena" type="password" name="confirmar_contrasena" value={confirmarContrasena} onChange={(e) => setConfirmarContrasena(e.target.value)} disabled={isViewMode} placeholder=" " autoComplete="new-password" />
                                    <label htmlFor="confirmar_contrasena">Confirmar Contraseña</label>
                                    {formErrors.confirmar_contrasena && <span className="error-text">{formErrors.confirmar_contrasena}</span>}
                                </div>
                            </>
                        )}

                        {/* Roles del Usuario (multi-select / checkboxes) */}
                        <h4 className="form-section-title full-width">Roles Asignados</h4>
                        <div className="form-group full-width roles-checkbox-group">
                            {rolesDisponibles.length > 0 ? (
                                rolesDisponibles.map(role => (
                                    <div key={role.rol_id} className="checkbox-item">
                                        <input 
                                            type="checkbox" 
                                            id={`role-${role.rol_id}`} 
                                            name="rol_ids"
                                            value={role.rol_id}
                                            checked={formData.rol_ids?.includes(role.rol_id!) || false}
                                            onChange={() => handleRoleToggle(role.rol_id!)}
                                            disabled={isViewMode}
                                        />
                                        <label htmlFor={`role-${role.rol_id}`}>{role.nombre_rol}</label>
                                    </div>
                                ))
                            ) : (
                                <p className="no-data-small">No hay roles disponibles. Cree roles en la configuración.</p>
                            )}
                            {formErrors.roles && <span className="error-text full-width">{formErrors.roles}</span>}
                        </div>

                        {/* Opciones Adicionales de Usuario */}
                        <h4 className="form-section-title full-width">Opciones Avanzadas</h4>
                        <div className="form-group checkbox-group">
                            <input id="activo" type="checkbox" name="activo" checked={formData.activo ?? true} onChange={handleChange} disabled={isViewMode || selectedUsuario?.usuario_id === currentUser?.id} />
                            <label htmlFor="activo">Cuenta Activa</label>
                        </div>
                        <div className="form-group floating-label">
                            <input id="fecha_expiracion_cuenta" type="date" name="fecha_expiracion_cuenta" value={formData.fecha_expiracion_cuenta || ''} onChange={handleChange} disabled={isViewMode} placeholder=" " />
                            <label htmlFor="fecha_expiracion_cuenta">Fecha Expiración Cuenta</label>
                        </div>
                        <div className="form-group checkbox-group">
                            <input id="requiere_cambio_contrasena_en_login" type="checkbox" name="requiere_cambio_contrasena_en_login" checked={formData.requiere_cambio_contrasena_en_login ?? false} onChange={handleChange} disabled={isViewMode} />
                            <label htmlFor="requiere_cambio_contrasena_en_login">Req. Cambio Contraseña en Login</label>
                        </div>
                        {isViewMode && selectedUsuario && (
                            <>
                                <div className="form-group floating-label">
                                    <input id="numero_intentos_fallidos_login" type="number" name="numero_intentos_fallidos_login" value={selectedUsuario.numero_intentos_fallidos_login ?? ''} disabled={true} placeholder=" " />
                                    <label htmlFor="numero_intentos_fallidos_login">Intentos Fallidos Login</label>
                                </div>
                                <div className="form-group floating-label">
                                    <input id="cuenta_bloqueada_hasta" type="text" name="cuenta_bloqueada_hasta" value={formatDateTime(selectedUsuario.cuenta_bloqueada_hasta) || ''} disabled={true} placeholder=" " />
                                    <label htmlFor="cuenta_bloqueada_hasta">Cuenta Bloqueada Hasta</label>
                                </div>
                            </>
                        )}
                    </div>

                    {isViewMode && selectedUsuario && (
                        <div className="audit-section">
                            <h4>Información de Auditoría</h4>
                            <p><strong>Creado por:</strong> {selectedUsuario.creado_por || 'N/A'}</p>
                            <p><strong>Fecha de Creación:</strong> {formatDateTime(selectedUsuario.fecha_creacion_cuenta)}</p> 
                            <p><strong>Última Modificación por:</strong> {selectedUsuario.modificado_por || 'N/A'}</p>
                            <p><strong>Fecha de Modificación:</strong> {formatDateTime(selectedUsuario.fecha_modificacion)}</p>
                        </div>
                    )}

                    <div className="form-actions">
                        <button type="button" className="btn-secondary" onClick={handleCloseModal}>{isViewMode ? 'Cerrar' : 'Cancelar'}</button>
                        {!isViewMode && <button type="submit" className="btn-primary">{selectedUsuario ? 'Guardar Cambios' : 'Crear Usuario'}</button>}
                    </div>
                </form>
            </Modal>
        </>
    );
};

export default ListaUsuariosPage;