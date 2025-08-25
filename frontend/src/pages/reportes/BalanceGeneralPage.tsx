//Archivo: frontend/src/pages/reportes/BalanceGeneralPage.tsx
import { useState } from 'react';
import { fetchBalanceGeneral, type BalanceGeneral } from '../../services/reporteContableService';
import { showErrorAlert } from '../../services/notificationService';
import { FileText } from 'lucide-react';
import '../../styles/TablePage.css';
import './ReportesPage.css';

// Función para formatear números como moneda
const formatCurrency = (value: number) => {
    return `S/ ${value.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const BalanceGeneralPage = () => {
    // Establece la fecha actual en formato YYYY-MM-DD como valor inicial
    const [fechaCorte, setFechaCorte] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState<BalanceGeneral | null>(null);

    const handleGenerateReport = async () => {
        setLoading(true);
        setReportData(null); // Limpia los datos anteriores antes de una nueva consulta
        try {
            const data = await fetchBalanceGeneral(fechaCorte);
            setReportData(data);
        } catch (error) {
            if (error instanceof Error) showErrorAlert(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="table-page-container">
            <div className="table-page-header">
                <h1>Balance General (Estado de Situación Financiera)</h1>
            </div>

            <div className="report-form-container">
                <p className="report-description">
                    Seleccione la fecha de corte para generar el Balance General. El reporte mostrará los saldos acumulados de las cuentas de Activo, Pasivo y Patrimonio hasta esa fecha.
                </p>
                <div className="form-grid-report single-item">
                    <div className="form-group floating-label">
                        <input 
                            type="date" 
                            id="fechaCorte" 
                            value={fechaCorte} 
                            onChange={(e) => setFechaCorte(e.target.value)}
                        />
                        <label htmlFor="fechaCorte">Fecha de Corte</label>
                    </div>
                </div>
                
                <div className="form-actions-report">
                    <button onClick={handleGenerateReport} className="btn-primary" disabled={loading}>
                        <FileText size={18} />
                        {loading ? 'Generando...' : 'Generar Reporte'}
                    </button>
                </div>
            </div>

            {loading && <div className="loading-spinner">Calculando...</div>}

            {reportData && (
                <div className="report-results-container">
                    <h3>Resultados al {new Date(fechaCorte + 'T00:00:00').toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' })}</h3>
                    
                    <div className="balance-grid">
                        {/* COLUMNA DE ACTIVOS */}
                        <div className="balance-column">
                            <table className="report-table">
                                <thead>
                                    <tr><th className="report-header-activo" colSpan={2}>Activos</th></tr>
                                    <tr><th>Descripción</th><th className="text-right">Monto</th></tr>
                                </thead>
                                <tbody>
                                    {reportData.activos.map((item, index) => (
                                        <tr key={`activo-${index}`}>
                                            <td>{item.codigo} - {item.descripcion}</td>
                                            <td className="text-right">{formatCurrency(item.total)}</td>
                                        </tr>
                                    ))}
                                    <tr className="report-total-row">
                                        <td>TOTAL ACTIVOS</td>
                                        <td className="text-right">{formatCurrency(reportData.totalActivos)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* COLUMNA DE PASIVOS Y PATRIMONIO */}
                        <div className="balance-column">
                            <table className="report-table">
                                <thead>
                                    <tr><th className="report-header-pasivo" colSpan={2}>Pasivos</th></tr>
                                    <tr><th>Descripción</th><th className="text-right">Monto</th></tr>
                                </thead>
                                <tbody>
                                    {reportData.pasivos.map((item, index) => (
                                        <tr key={`pasivo-${index}`}>
                                            <td>{item.codigo} - {item.descripcion}</td>
                                            <td className="text-right">{formatCurrency(item.total)}</td>
                                        </tr>
                                    ))}
                                    <tr className="report-total-row">
                                        <td>TOTAL PASIVOS</td>
                                        <td className="text-right">{formatCurrency(reportData.totalPasivos)}</td>
                                    </tr>
                                </tbody>
                            </table>
                            <table className="report-table">
                                <thead>
                                    <tr><th className="report-header-patrimonio" colSpan={2}>Patrimonio</th></tr>
                                    <tr><th>Descripción</th><th className="text-right">Monto</th></tr>
                                </thead>
                                <tbody>
                                    {reportData.patrimonio.map((item, index) => (
                                        <tr key={`patrimonio-${index}`}>
                                            <td>{item.codigo} - {item.descripcion}</td>
                                            <td className="text-right">{formatCurrency(item.total)}</td>
                                        </tr>
                                    ))}
                                    <tr className="report-total-row">
                                        <td>TOTAL PATRIMONIO</td>
                                        <td className="text-right">{formatCurrency(reportData.totalPatrimonio)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        
                        {/* VERIFICACIÓN FINAL */}
                        <div className="balance-verification full-width">
                            <div className={`summary-box ${reportData.totalActivos.toFixed(2) === reportData.verificacion.toFixed(2) ? 'success' : 'error'}`}>
                                <span>TOTAL PASIVO + PATRIMONIO</span>
                                <strong>{formatCurrency(reportData.verificacion)}</strong>
                            </div>
                            <div className={`summary-box ${reportData.totalActivos.toFixed(2) === reportData.verificacion.toFixed(2) ? 'success' : 'error'}`}>
                                <span>TOTAL ACTIVO</span>
                                <strong>{formatCurrency(reportData.totalActivos)}</strong>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BalanceGeneralPage;