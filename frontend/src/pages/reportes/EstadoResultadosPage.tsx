//Archivo: frontend/src/pages/reportes/EstadoResultadosPage.tsx
import { useState } from 'react';
import { fetchEstadoResultados, type EstadoResultados } from '../../services/reporteContableService';
import { showErrorAlert } from '../../services/notificationService';
import { FileText } from 'lucide-react';
import '../../styles/TablePage.css';
import './ReportesPage.css';

// Función para formatear números como moneda
const formatCurrency = (value: number) => {
    return `S/ ${value.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const EstadoResultadosPage = () => {
    // Obtenemos el primer y último día del mes actual para los valores por defecto
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
    const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0];

    const [fechaInicio, setFechaInicio] = useState(primerDiaMes);
    const [fechaFin, setFechaFin] = useState(ultimoDiaMes);
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState<EstadoResultados | null>(null);

    const handleGenerateReport = async () => {
        setLoading(true);
        setReportData(null);
        try {
            const data = await fetchEstadoResultados(fechaInicio, fechaFin);
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
                <h1>Estado de Resultados (Ganancias y Pérdidas)</h1>
            </div>

            <div className="report-form-container">
                <p className="report-description">
                    Seleccione un rango de fechas para generar el Estado de Resultados. El reporte mostrará los ingresos y gastos registrados en las cuentas contables correspondientes.
                </p>
                <div className="form-grid-report">
                    <div className="form-group floating-label">
                        <input 
                            type="date" 
                            id="fechaInicio" 
                            value={fechaInicio} 
                            onChange={(e) => setFechaInicio(e.target.value)}
                        />
                        <label htmlFor="fechaInicio">Fecha de Inicio</label>
                    </div>

                    <div className="form-group floating-label">
                        <input 
                            type="date" 
                            id="fechaFin" 
                            value={fechaFin} 
                            onChange={(e) => setFechaFin(e.target.value)}
                        />
                        <label htmlFor="fechaFin">Fecha de Fin</label>
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
                    <h3>Resultados desde {new Date(fechaInicio + 'T00:00:00').toLocaleDateString('es-PE')} hasta {new Date(fechaFin + 'T00:00:00').toLocaleDateString('es-PE')}</h3>
                    
                    <table className="report-table">
                        <thead>
                            <tr>
                                <th className="report-header-ingresos">Ingresos</th>
                                <th className="report-header-ingresos text-right">Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportData.ingresos.length > 0 ? (
                                reportData.ingresos.map((item, index) => (
                                    <tr key={`ingreso-${index}`}>
                                        <td>{item.descripcion}</td>
                                        <td className="text-right">{formatCurrency(item.total)}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={2}>No se registraron ingresos en este período.</td></tr>
                            )}
                            <tr className="report-total-row">
                                <td>TOTAL INGRESOS</td>
                                <td className="text-right">{formatCurrency(reportData.totalIngresos)}</td>
                            </tr>
                        </tbody>
                    </table>

                    <table className="report-table">
                        <thead>
                            <tr>
                                <th className="report-header-gastos">Gastos</th>
                                <th className="report-header-gastos text-right">Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                             {reportData.gastos.length > 0 ? (
                                reportData.gastos.map((item, index) => (
                                    <tr key={`gasto-${index}`}>
                                        <td>{item.descripcion}</td>
                                        <td className="text-right">{formatCurrency(item.total)}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={2}>No se registraron gastos en este período.</td></tr>
                            )}
                            <tr className="report-total-row">
                                <td>TOTAL GASTOS</td>
                                <td className="text-right">{formatCurrency(reportData.totalGastos)}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div className={`report-summary ${reportData.utilidadNeta >= 0 ? 'profit' : 'loss'}`}>
                        <span>UTILIDAD NETA DEL PERÍODO</span>
                        <span>{formatCurrency(reportData.utilidadNeta)}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EstadoResultadosPage;