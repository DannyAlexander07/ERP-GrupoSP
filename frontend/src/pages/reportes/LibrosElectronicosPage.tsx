//Archivo: frontend/src/pages/reportes/LibrosElectronicosPage.tsx
import  { useState } from 'react';
import { descargarPleCompras, descargarPleVentas } from '../../services/reporteService';
import { Download } from 'lucide-react';
import '../../styles/TablePage.css'; // Reutilizamos estilos generales
import './ReportesPage.css'; // Creamos un CSS específico para esta página

const LibrosElectronicosPage = () => {
    const currentYear = new Date().getFullYear();
    const [anio, setAnio] = useState(currentYear);
    const [mes, setMes] = useState(new Date().getMonth() + 1);
    const [tipoLibro, setTipoLibro] = useState<'compras' | 'ventas'>('compras');
    const [loading, setLoading] = useState(false);

    const anios = Array.from({ length: 10 }, (_, i) => currentYear - i);
    const meses = [
        { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' },
        { value: 3, label: 'Marzo' }, { value: 4, label: 'Abril' },
        { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
        { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' },
        { value: 9, label: 'Septiembre' }, { value: 10, label: 'Octubre' },
        { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' },
    ];

    const handleGenerateReport = async () => {
        setLoading(true);
        try {
            if (tipoLibro === 'compras') {
                await descargarPleCompras(anio, mes);
            } else if (tipoLibro === 'ventas') {
                await descargarPleVentas(anio, mes);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="table-page-container">
            <div className="table-page-header">
                <h1>Generación de Libros Electrónicos (PLE)</h1>
            </div>

            <div className="report-form-container">
                <p className="report-description">
                    Seleccione el período y el tipo de libro que desea generar. El sistema creará un archivo .txt con el formato oficial listo para su declaración.
                </p>
                <div className="form-grid-report">
                    <div className="form-group floating-label">
                        <select id="anio" value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
                            {anios.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <label htmlFor="anio">Año</label>
                    </div>

                    <div className="form-group floating-label">
                        <select id="mes" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
                            {meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                        <label htmlFor="mes">Mes</label>
                    </div>

                    <div className="form-group floating-label">
                        <select id="tipoLibro" value={tipoLibro} onChange={(e) => setTipoLibro(e.target.value as 'compras' | 'ventas')}>
                            <option value="compras">Registro de Compras (8.1)</option>
                            <option value="ventas">Registro de Ventas (14.1)</option>
                        </select>
                        <label htmlFor="tipoLibro">Libro a Generar</label>
                    </div>
                </div>
                
                <div className="form-actions-report">
                    <button onClick={handleGenerateReport} className="btn-primary" disabled={loading}>
                        <Download size={18} />
                        {loading ? 'Generando...' : 'Generar y Descargar .TXT'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LibrosElectronicosPage;