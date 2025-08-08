// Archivo: frontend/src/pages/dashboard/DashboardPage.tsx
import React, { useEffect, useState } from 'react';
import Chart from 'react-apexcharts';
import { type ApexOptions } from 'apexcharts';
import { 
    fetchKpis, type KpiData,
    fetchFlujoCajaData, type FlujoCajaData,
    fetchResumenAnualData, type ResumenAnualData,
    fetchResumenPrestamos, type ResumenPrestamo,
    fetchTopDeudas, type TopDeuda,
    fetchTopClientes, type TopCliente,
    fetchTopProveedores, type TopProveedor,
    fetchProyectosPorEstado, type ProyectoPorEstado,
    fetchVentasPorServicio, type VentaPorServicio,
    fetchEstadoResultadosData, type EstadoResultadosData
} from '../../services/dashboardService';
import { showErrorAlert } from '../../services/notificationService';
import { TrendingDown, TrendingUp, DollarSign, Users, AlertTriangle, Landmark, List, PieChart, Star, ShoppingCart, Briefcase } from 'lucide-react';
import './DashboardPage.css';

// Componente para las tarjetas de KPI
const KpiCard = ({ title, value, icon, currency = '' }: { title: string, value: string | number, icon: React.ReactNode, currency?: string }) => (
    <div className="kpi-card">
        <div className="kpi-icon">{icon}</div>
        <div className="kpi-content">
            <span className="kpi-title">{title}</span>
            <span className="kpi-value">{currency}{typeof value === 'number' ? value.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}</span>
        </div>
    </div>
);

// --- ¡NUEVA FUNCIÓN AUXILIAR PARA PARSEAR FECHAS DE FORMA SEGURA! ---
const parseLocalDate = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number);
    // Creamos la fecha usando números, lo que la interpreta en la zona horaria local.
    return new Date(year, month - 1, day);
};

const DashboardPage = () => {
    // Estados para todos los datos del dashboard
    const [kpis, setKpis] = useState<KpiData | null>(null);
    const [flujoCajaData, setFlujoCajaData] = useState<FlujoCajaData[]>([]);
    const [resumenAnualData, setResumenAnualData] = useState<ResumenAnualData[]>([]);
    const [resumenPrestamos, setResumenPrestamos] = useState<ResumenPrestamo[]>([]);
    const [topDeudas, setTopDeudas] = useState<TopDeuda[]>([]);
    const [topClientes, setTopClientes] = useState<TopCliente[]>([]);
    const [topProveedores, setTopProveedores] = useState<TopProveedor[]>([]);
    const [proyectosPorEstado, setProyectosPorEstado] = useState<ProyectoPorEstado[]>([]);
    const [ventasPorServicio, setVentasPorServicio] = useState<VentaPorServicio[]>([]);
    const [estadoResultadosData, setEstadoResultadosData] = useState<EstadoResultadosData | null>(null);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadDashboardData = async () => {
            try {
                setLoading(true);
                const [
                    kpisData, flujoData, resumenAnual, prestamosData, deudasData,
                    clientesData, proveedoresData, proyectosData, ventasServicioData,estadoResultadosData
                ] = await Promise.all([
                    fetchKpis(),
                    fetchFlujoCajaData(),
                    fetchResumenAnualData(),
                    fetchResumenPrestamos(),
                    fetchTopDeudas(),
                    fetchTopClientes(),
                    fetchTopProveedores(),
                    fetchProyectosPorEstado(),
                    fetchVentasPorServicio(),
                    fetchEstadoResultadosData()
                ]);
                setKpis(kpisData);
                setFlujoCajaData(flujoData);
                setResumenAnualData(resumenAnual);
                setResumenPrestamos(prestamosData);
                setTopDeudas(deudasData);
                setTopClientes(clientesData);
                setTopProveedores(proveedoresData);
                setProyectosPorEstado(proyectosData);
                 setVentasPorServicio(ventasServicioData);
                setEstadoResultadosData(estadoResultadosData);
            } catch (error) {
                if (error instanceof Error) showErrorAlert(error.message);
            } finally {
                setLoading(false);
            }
        };
        loadDashboardData();
    }, []);

    // --- Configuración para el gráfico de Flujo de Caja ---
    const flujoCajaBarOptions: ApexOptions = {
        chart: { type: 'bar', height: 350, toolbar: { show: false } },
        plotOptions: { bar: { horizontal: false, columnWidth: '80%', borderRadius: 4 } },
        dataLabels: { enabled: false },
        stroke: { show: true, width: 2, colors: ['transparent'] },
        xaxis: {
            // ¡AQUÍ USAMOS LA NUEVA FUNCIÓN!
            categories: flujoCajaData.map(d => 
                parseLocalDate(d.fecha).toLocaleDateString('es-PE', {day:'2-digit', month: 'short'})
            ),
        },
        yaxis: { title: { text: 'Monto (S/)' } },
        fill: { opacity: 1 },
        legend: { position: 'top', horizontalAlign: 'right' },
        colors: ['#28a745', '#dc3545'],
        tooltip: { 
            // También la usamos aquí para el tooltip
            x: { 
                formatter: function(_value, { dataPointIndex }) {
                    const originalDate = flujoCajaData[dataPointIndex]?.fecha;
                    if (originalDate) {
                        return parseLocalDate(originalDate).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
                    }
                    return '';
                }
            },
            y: { 
                formatter: (val) => `S/ ${val.toLocaleString('es-PE')}` 
            } 
        }
    };

    const flujoCajaBarSeries = [
        { name: 'Ingresos', data: flujoCajaData.map(d => d.ingresos) },
        { name: 'Egresos', data: flujoCajaData.map(d => d.egresos) },
    ];
    // --- Configuración para el gráfico de Resumen Anual ---
    const mesesDelAno = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const resumenAnualOptions: ApexOptions = {
        chart: { type: 'line', height: 350, toolbar: { show: false } },
        colors: ['#3b82f6', '#6c757d'],
        stroke: { curve: 'smooth', width: 3 },
        markers: { size: 4 },
        xaxis: { categories: mesesDelAno, labels: { style: { colors: '#6c757d' } } },
        yaxis: { title: { text: 'Monto (S/)', style: { color: '#6c757d' } }, labels: { style: { colors: '#6c757d' } } },
        tooltip: { y: { formatter: (val) => `S/ ${val.toLocaleString('es-PE')}` } },
        legend: { position: 'top', horizontalAlign: 'right', offsetY: -10 }
    };
    const resumenAnualSeries = [
        { name: 'Ventas', data: resumenAnualData.map(d => d.ventas) },
        { name: 'Compras', data: resumenAnualData.map(d => d.compras) },
    ];

    // --- Configuración para el gráfico de Top 5 Clientes ---
    const topClientesOptions: ApexOptions = {
        chart: { type: 'bar', height: 350, toolbar: { show: false } },
        plotOptions: { bar: { borderRadius: 4, horizontal: true, barHeight: '50%' } },
        dataLabels: { enabled: false },
        xaxis: { categories: topClientes.map(c => c.cliente), title: { text: "Total Facturado (S/)"} },
        tooltip: { x: { formatter: (val) => val.toString() } }
    };
    const topClientesSeries = [{ name: 'Facturación', data: topClientes.map(c => parseFloat(c.total_facturado)) }];

    // --- Configuración para el gráfico de Top 5 Proveedores ---
    const topProveedoresOptions: ApexOptions = {
        ...topClientesOptions,
        colors: ['#ff9f43'],
        xaxis: { ...topClientesOptions.xaxis, categories: topProveedores.map(p => p.proveedor), title: { text: "Total Comprado (S/)"} }
    };
    const topProveedoresSeries = [{ name: 'Compras', data: topProveedores.map(p => parseFloat(p.total_comprado)) }];

    // --- Configuración para el gráfico de Proyectos por Estado ---
    const proyectosEstadoOptions: ApexOptions = {
        chart: { type: 'donut', height: 250 },
        labels: proyectosPorEstado.map(p => p.estado),
        legend: { show: false },
        dataLabels: { enabled: true, formatter: (val: string) => `${Number(val).toFixed(1)}%` }
    };
    const proyectosEstadoSeries = proyectosPorEstado.map(p => parseInt(p.cantidad, 10));

    // --- Configuración para el gráfico de Ventas por Servicio ---
    const ventasServicioOptions: ApexOptions = {
        chart: { type: 'donut', height: 250 },
        labels: ventasPorServicio.map(s => s.servicio),
        legend: { show: false },
        dataLabels: { enabled: true, formatter: (val: string) => `${Number(val).toFixed(1)}%` }
    };
    const ventasServicioSeries = ventasPorServicio.map(s => parseFloat(s.total_vendido));

     const estadoResultadosOptions: ApexOptions = {
        chart: { type: 'bar', height: 350, stacked: true, toolbar: { show: false } },
        plotOptions: { bar: { horizontal: false, } },
         dataLabels: {
            enabled: true,
            // --- ¡AQUÍ ESTÁ LA CORRECCIÓN PRINCIPAL! ---
            // Usamos toLocaleString para forzar siempre 2 decimales.
            formatter: (val) => `S/ ${Number(val).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            style: {
                colors: ['#344767'] // Un solo color para las etiquetas
            }
        },
        xaxis: { categories: ['Ingresos', 'Gastos', 'Utilidad Neta'] },
        yaxis: { 
            title: { text: 'Monto (S/)' },
            labels: {
                // Le decimos al eje Y que formatee los números como enteros, sin decimales.
                formatter: (val) => {
                    return Number(val).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                }
            }
        },
        colors: ['#28a745', '#dc3545', '#007bff', '#E0E0E0'], // Verde, Rojo, Azul, Gris (para la base invisible)
        tooltip: { y: { formatter: (val) => `S/ ${val.toLocaleString('es-PE')}` } },
    };

    const estadoResultadosSeries = estadoResultadosData ? [
        { name: 'Ingresos', data: [estadoResultadosData.totalIngresos, 0, 0] },
        { name: 'Gastos', data: [0, estadoResultadosData.totalGastos, 0] },
        { name: 'Utilidad Neta', data: [0, 0, estadoResultadosData.utilidadNeta] },
        // Serie "invisible" para levantar la barra de Gastos
        { name: 'Base', data: [0, estadoResultadosData.utilidadNeta, 0], color: '#FFFFFF' }
    ] : [];

    if (loading) {
        return <div className="loading-spinner">Cargando dashboard...</div>;
    }
    
    return (
        <div className="dashboard-container">
            <h1 className="dashboard-title">Dashboard Principal</h1>
            
            <div className="kpi-grid">
                {kpis && (
                    <>
                        <KpiCard title="Ventas del Día" value={kpis.ventasHoy} currency="S/ " icon={<DollarSign />} />
                        <KpiCard title="Ventas de la Semana" value={kpis.ventasSemana} currency="S/ " icon={<TrendingUp />} />
                        <KpiCard title="Ventas del Mes" value={kpis.ventasMes} currency="S/ " icon={<TrendingUp />} />
                        <KpiCard title="Cuentas por Cobrar" value={kpis.cuentasPorCobrar} currency="S/ " icon={<AlertTriangle color="#ff9f43" />} />
                        <KpiCard title="Cuentas por Pagar" value={kpis.cuentasPorPagar} currency="S/ " icon={<AlertTriangle color="#ea5455" />} />
                        <KpiCard title="Nuevos Clientes (Mes)" value={kpis.nuevosClientesMes} icon={<Users />} />
                    </>
                )}
            </div>

            <div className="charts-grid">
                <div className="chart-container">
                    <h3>Flujo de Ingresos vs. Egresos (Últimos 30 días)</h3>
                    <Chart 
                        options={flujoCajaBarOptions} 
                        series={flujoCajaBarSeries} 
                        type="bar" 
                        height={350} 
                    />
                </div>
                <div className="chart-container">
                    <h3>Resumen Anual: Ventas vs. Compras</h3>
                    <Chart options={resumenAnualOptions} series={resumenAnualSeries} type="line" height={350} />
                </div>
            </div>

            <div className="additional-charts-grid">
                <div className="chart-container">
                    <h3><Star size={20} /> Top 5 Clientes (Año Actual)</h3>
                    {topClientes.length > 0 ? (
                        <Chart options={topClientesOptions} series={topClientesSeries} type="bar" height={350} />
                    ) : <div className="chart-placeholder">No hay datos de ventas para mostrar.</div>}
                </div>
                <div className="chart-container">
                    <h3><ShoppingCart size={20} /> Top 5 Proveedores (Año Actual)</h3>
                     {topProveedores.length > 0 ? (
                        <Chart options={topProveedoresOptions} series={topProveedoresSeries} type="bar" height={350} />
                    ) : <div className="chart-placeholder">No hay datos de compras para mostrar.</div>}
                </div>
                <div className="chart-container">
                    <h3><PieChart size={20} /> Proyectos por Estado</h3>
                     {proyectosPorEstado.length > 0 ? (
                        <div className="donut-chart-with-summary">
                            <Chart options={proyectosEstadoOptions} series={proyectosEstadoSeries} type="donut" height={250} />
                            <div className="chart-summary">
                                <h4>Total de Proyectos: {proyectosPorEstado.reduce((acc, p) => acc + parseInt(p.cantidad, 10), 0)}</h4>
                                <ul>
                                    {proyectosPorEstado.map((p, index) => (
                                        <li key={p.estado}>
                                            <span className="summary-dot" style={{ backgroundColor: proyectosEstadoOptions.colors?.[index] }}></span>
                                            <span className="summary-label">{p.estado}</span>
                                            <span className="summary-value">{p.cantidad}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ) : <div className="chart-placeholder">No hay proyectos registrados.</div>}
                </div>
                <div className="chart-container">
                    <h3><Briefcase size={20} /> Ventas por Servicio (Año Actual)</h3>
                    {ventasPorServicio.length > 0 ? (
                         <div className="donut-chart-with-summary">
                            <Chart options={ventasServicioOptions} series={ventasServicioSeries} type="donut" height={250} />
                            <div className="chart-summary">
                                <h4>Total Facturado: S/ {ventasPorServicio.reduce((acc, s) => acc + parseFloat(s.total_vendido), 0).toLocaleString('es-PE', {minimumFractionDigits: 2})}</h4>
                                <ul>
                                    {ventasPorServicio.map((s, index) => (
                                        <li key={s.servicio}>
                                            <span className="summary-dot" style={{ backgroundColor: ventasServicioOptions.colors?.[index] }}></span>
                                            <span className="summary-label">{s.servicio}</span>
                                            <span className="summary-value">S/ {parseFloat(s.total_vendido).toLocaleString('es-PE', {minimumFractionDigits: 2})}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ) : <div className="chart-placeholder">No hay ventas por servicio para mostrar.</div>}
                </div>
                 <div className="chart-container full-width">
                    <h3><TrendingDown size={20} /> Estado de Resultados (Mes Actual)</h3>
                    {estadoResultadosData ? (
                        <Chart 
                            options={estadoResultadosOptions} 
                            series={estadoResultadosSeries} 
                            type="bar" 
                            height={350} 
                        />
                    ) : <div className="chart-placeholder">No hay datos contables para mostrar.</div>}
                </div>
            </div>

            <div className="summaries-grid">
                <div className="summary-container">
                    <h3><Landmark size={20} /> Resumen de Préstamos</h3>
                    <div className="summary-table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Tipo de Préstamo</th>
                                    <th>Total Principal</th>
                                    <th>Saldo Pendiente</th>
                                </tr>
                            </thead>
                            <tbody>
                                {resumenPrestamos.length > 0 ? resumenPrestamos.map((p, i) => (
                                    <tr key={i}>
                                        <td>{p.tipo_prestamo}</td>
                                        <td>S/ {parseFloat(p.total_principal).toLocaleString('es-PE', {minimumFractionDigits: 2})}</td>
                                        <td className={p.tipo_prestamo === 'Recibido' ? 'saldo-por-pagar' : 'saldo-por-cobrar'}>
                                            {p.tipo_prestamo === 'Recibido' ? 'Por Pagar' : 'Por Cobrar'}: S/ {parseFloat(p.saldo_pendiente).toLocaleString('es-PE', {minimumFractionDigits: 2})}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={3} className="no-data-small">No hay préstamos vigentes.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                 <div className="summary-container">
                    <h3><List size={20} /> Top 5 Deudas Pendientes</h3>
                    <div className="summary-table-container">
                        <table>
                             <thead>
                                <tr>
                                    <th>Proveedor</th>
                                    <th>Total Deuda</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topDeudas.length > 0 ? topDeudas.map((d, i) => (
                                    <tr key={i}>
                                        <td>{d.proveedor}</td>
                                        <td>S/ {parseFloat(d.total_deuda).toLocaleString('es-PE', {minimumFractionDigits: 2})}</td>
                                    </tr>
                                )) : (
                                     <tr><td colSpan={2} className="no-data-small">No hay deudas pendientes.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;