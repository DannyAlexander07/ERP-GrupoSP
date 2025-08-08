// Archivo: frontend/src/pages/prestamos/NuevoPrestamoPage.tsx (NUEVA PÁGINA - COMPLETA)
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { createPrestamo, type Prestamo } from '../../services/prestamoService';
import { fetchAllMonedas, type Moneda } from '../../services/monedaService';
import { fetchEmpresas, type Empresa } from '../../services/empresaService';
import { showSuccessToast, showErrorAlert, showValidationErrorAlert } from '../../services/notificationService';
import '../../styles/TablePage.css';

// --- Interfaces ---
interface FormErrors {
    [key: string]: string | undefined;
}

// --- Listas Constantes ---
const tiposPrestamo = ['Recibido', 'Otorgado'];
const tiposTasaInteres = ['TEA', 'TNA'];
const periodicidadesCuotas = ['Mensual']; // Simplificado a solo Mensual según la lógica del backend

const NuevoPrestamoPage = () => {
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();

    // --- Estados del Componente ---
    const [monedasDisponibles, setMonedasDisponibles] = useState<Moneda[]>([]);
    const [empresasDisponibles, setEmpresasDisponibles] = useState<Empresa[]>([]);
    const [loading, setLoading] = useState(true);
    const [formErrors, setFormErrors] = useState<FormErrors>({});

    const initialFormData: Partial<Prestamo> = {
        empresa_id_titular: currentUser?.empresa_id,
        tipo_prestamo: tiposPrestamo[0],
        codigo_contrato_prestamo: '',
        descripcion_prestamo: '',
        entidad_financiera_o_contraparte: '',
        moneda_id_prestamo: undefined,
        monto_principal_original: 0,
        tasa_interes_anual_pactada: 0,
        tipo_tasa_interes: tiposTasaInteres[0], // Valor inicial por defecto
        fecha_desembolso_o_inicio: new Date().toISOString().split('T')[0],
        numero_total_cuotas_pactadas: 12,
        periodicidad_cuotas: periodicidadesCuotas[0],
        dia_pago_mes: 1,
    };
    const [formData, setFormData] = useState<Partial<Prestamo>>(initialFormData);

    // --- Carga de Datos para los Selects ---
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                setLoading(true);
                const [monedasData, empresasData] = await Promise.all([
                    fetchAllMonedas(),
                    fetchEmpresas(1, 9999, {})
                ]);
                setMonedasDisponibles(monedasData);
                setEmpresasDisponibles(empresasData.records);

                // Establecer valores por defecto una vez que los datos están cargados
                setFormData(prev => ({
                    ...prev,
                    moneda_id_prestamo: prev.moneda_id_prestamo || (monedasData.length > 0 ? monedasData[0].moneda_id : undefined),
                    empresa_id_titular: prev.empresa_id_titular || (currentUser?.empresa_id || (empresasData.records.length > 0 ? empresasData.records[0].empresa_id : undefined)),
                }));

            } catch (error) {
                if (error instanceof Error) showErrorAlert(`Error al cargar datos iniciales: ${error.message}`);
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, [currentUser?.empresa_id]);

    // --- Manejadores y Validaciones ---
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
        if (formData.periodicidad_cuotas !== 'Mensual') {
            errors.periodicidad_cuotas = "Actualmente solo se soporta la periodicidad Mensual para el cálculo de cuotas.";
        }
        setFormErrors(errors);
        return errors;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        const isNumericField = [
            'empresa_id_titular', 'moneda_id_prestamo', 'monto_principal_original',
            'tasa_interes_anual_pactada', 'numero_total_cuotas_pactadas', 'dia_pago_mes'
        ].includes(name);

        setFormData(prev => ({
            ...prev,
            [name]: isNumericField && value !== '' ? Number(value) : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const errors = validateForm();
        if (Object.keys(errors).length > 0) {
            showValidationErrorAlert(errors);
            return;
        }
        try {
            await createPrestamo(formData as Prestamo);
            showSuccessToast('¡Préstamo creado y plan de pagos generado con éxito!');
            navigate('/prestamos');
        } catch (error) {
            if (error instanceof Error) showErrorAlert(error.message);
        }
    };

    if (loading) return <div className="loading-spinner">Cargando...</div>;

    return (
        <div className="table-page-container">
            <div className="table-page-header">
                <h1>Registrar Nuevo Préstamo</h1>
            </div>
            <form onSubmit={handleSubmit} className="modal-form" noValidate>
                <div className="form-grid">
                    <div className="form-group floating-label">
                        <select id="empresa_id_titular" name="empresa_id_titular" value={formData.empresa_id_titular || ''} onChange={handleChange} disabled={true} required>
                            <option value="">Seleccione Empresa</option>
                            {empresasDisponibles.map(empresa => (
                                <option key={empresa.empresa_id} value={empresa.empresa_id}>{empresa.nombre_empresa}</option>
                            ))}
                        </select>
                        <label htmlFor="empresa_id_titular">Empresa Titular</label>
                        {formErrors.empresa_id_titular && <span className="error-text">{formErrors.empresa_id_titular}</span>}
                    </div>
                    <div className="form-group floating-label">
                        <select id="tipo_prestamo" name="tipo_prestamo" value={formData.tipo_prestamo || ''} onChange={handleChange} required>
                            <option value="">Seleccione Tipo</option>
                            {tiposPrestamo.map(tipo => (<option key={tipo} value={tipo}>{tipo}</option>))}
                        </select>
                        <label htmlFor="tipo_prestamo">Tipo de Préstamo</label>
                        {formErrors.tipo_prestamo && <span className="error-text">{formErrors.tipo_prestamo}</span>}
                    </div>
                    <div className="form-group floating-label">
                        <input id="codigo_contrato_prestamo" type="text" name="codigo_contrato_prestamo" value={formData.codigo_contrato_prestamo || ''} onChange={handleChange} placeholder=" " />
                        <label htmlFor="codigo_contrato_prestamo">Código de Contrato</label>
                    </div>
                    <div className="form-group floating-label full-width">
                        <textarea id="descripcion_prestamo" name="descripcion_prestamo" value={formData.descripcion_prestamo || ''} onChange={handleChange} rows={2} placeholder=" "></textarea>
                        <label htmlFor="descripcion_prestamo">Descripción del Préstamo</label>
                    </div>
                    <div className="form-group floating-label">
                        <input id="entidad_financiera_o_contraparte" type="text" name="entidad_financiera_o_contraparte" value={formData.entidad_financiera_o_contraparte || ''} onChange={handleChange} placeholder=" " required />
                        <label htmlFor="entidad_financiera_o_contraparte">Entidad Financiera / Contraparte</label>
                        {formErrors.entidad_financiera_o_contraparte && <span className="error-text">{formErrors.entidad_financiera_o_contraparte}</span>}
                    </div>
                    <div className="form-group floating-label">
                        <select id="moneda_id_prestamo" name="moneda_id_prestamo" value={formData.moneda_id_prestamo || ''} onChange={handleChange} required>
                            <option value="">Seleccione Moneda</option>
                            {monedasDisponibles.map(moneda => (
                                <option key={moneda.moneda_id} value={moneda.moneda_id}>{moneda.nombre_moneda}</option>
                            ))}
                        </select>
                        <label htmlFor="moneda_id_prestamo">Moneda</label>
                        {formErrors.moneda_id_prestamo && <span className="error-text">{formErrors.moneda_id_prestamo}</span>}
                    </div>
                    <div className="form-group floating-label">
                        <input id="monto_principal_original" type="number" step="0.01" name="monto_principal_original" value={formData.monto_principal_original ?? ''} onChange={handleChange} placeholder=" " required />
                        <label htmlFor="monto_principal_original">Monto Principal Original</label>
                        {formErrors.monto_principal_original && <span className="error-text">{formErrors.monto_principal_original}</span>}
                    </div>
                    <div className="form-group floating-label">
                        <input id="tasa_interes_anual_pactada" type="number" step="0.0001" name="tasa_interes_anual_pactada" value={formData.tasa_interes_anual_pactada ?? ''} onChange={handleChange} placeholder=" " required />
                        <label htmlFor="tasa_interes_anual_pactada">Tasa Interés Anual (Ej: 0.05 para 5%)</label>
                        {formErrors.tasa_interes_anual_pactada && <span className="error-text">{formErrors.tasa_interes_anual_pactada}</span>}
                    </div>
                    <div className="form-group floating-label">
                        <select id="tipo_tasa_interes" name="tipo_tasa_interes" value={formData.tipo_tasa_interes || ''} onChange={handleChange}>
                            <option value="">Seleccione Tipo Tasa</option>
                            {tiposTasaInteres.map(tipo => (<option key={tipo} value={tipo}>{tipo}</option>))}
                        </select>
                        <label htmlFor="tipo_tasa_interes">Tipo de Tasa</label>
                    </div>
                    <div className="form-group floating-label">
                        <input id="fecha_desembolso_o_inicio" type="date" name="fecha_desembolso_o_inicio" value={formData.fecha_desembolso_o_inicio || ''} onChange={handleChange} placeholder=" " required />
                        <label htmlFor="fecha_desembolso_o_inicio">Fecha Desembolso / Inicio</label>
                        {formErrors.fecha_desembolso_o_inicio && <span className="error-text">{formErrors.fecha_desembolso_o_inicio}</span>}
                    </div>
                    <div className="form-group floating-label">
                        <input id="numero_total_cuotas_pactadas" type="number" name="numero_total_cuotas_pactadas" value={formData.numero_total_cuotas_pactadas ?? ''} onChange={handleChange} placeholder=" " required />
                        <label htmlFor="numero_total_cuotas_pactadas">Número Total de Cuotas</label>
                        {formErrors.numero_total_cuotas_pactadas && <span className="error-text">{formErrors.numero_total_cuotas_pactadas}</span>}
                    </div>
                    <div className="form-group floating-label">
                        <select id="periodicidad_cuotas" name="periodicidad_cuotas" value={formData.periodicidad_cuotas || ''} onChange={handleChange} required>
                            <option value="">Seleccione Periodicidad</option>
                            {periodicidadesCuotas.map(per => (<option key={per} value={per}>{per}</option>))}
                        </select>
                        <label htmlFor="periodicidad_cuotas">Periodicidad Cuotas</label>
                        {formErrors.periodicidad_cuotas && <span className="error-text">{formErrors.periodicidad_cuotas}</span>}
                    </div>
                    <div className="form-group floating-label">
                        <input id="dia_pago_mes" type="number" name="dia_pago_mes" value={formData.dia_pago_mes ?? ''} onChange={handleChange} placeholder=" " min="1" max="31" />
                        <label htmlFor="dia_pago_mes">Día de Pago (1-31)</label>
                    </div>
                </div>
                <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={() => navigate('/prestamos')}>Cancelar</button>
                    <button type="submit" className="btn-primary">Crear Préstamo</button>
                </div>
            </form>
        </div>
    );
};

export default NuevoPrestamoPage;