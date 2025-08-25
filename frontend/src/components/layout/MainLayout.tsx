// Archivo: frontend/src/components/layout/MainLayout.tsx (VERSIÓN CON MENÚ DE PROYECTOS ACTUALIZADO)
import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { showConfirmDialog } from '../../services/notificationService';
import logoImagen from '../../assets/gruposp.jpeg';
import './MainLayout.css';

// --- Iconos SVG (sin cambios) ---
const IconDashboard = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>;
const IconProject = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>;
const IconSales = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>;
const IconShopping = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>;
const IconTreasury = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>;
const IconAccounting = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>;
const IconMasters = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>;
const IconSettings = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>;
const IconChevron = ({ isOpen }: { isOpen: boolean }) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`chevron-icon ${isOpen ? 'open' : ''}`}><polyline points="6 9 12 15 18 9"></polyline></svg>;
const IconLoans = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>;
const IconReports = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 11.5A2.5 2.5 0 0 1 4.5 9H6v10h1.5a2.5 2.5 0 0 1 0 5H3a2 2 0 0 1-2-2V12a2 2 0 0 1 1-1.73"></path><path d="M22 11.5A2.5 2.5 0 0 0 19.5 9H18v10h-1.5a2.5 2.5 0 0 0 0 5H21a2 2 0 0 0 2-2V12a2 2 0 0 0-1-1.73"></path><path d="M12.23 4.23a2 2 0 0 0-2.46 0l-1 1a2 2 0 0 0 0 2.82l3.18 3.18a2 2 0 0 0 2.82 0l1-1a2 2 0 0 0 0-2.46L12.23 4.23z"></path></svg>;

// --- Tipos para el componente MenuItem (sin cambios) ---
type BaseMenuItemProps = { children: React.ReactNode; isActive?: boolean; };
type NavLinkMenuItemProps = BaseMenuItemProps & { isHeader?: false; to: string; end?: boolean; onClick?: () => void; };
type HeaderMenuItemProps = BaseMenuItemProps & { isHeader: true; onClick: () => void; to?: never; };
type MenuItemProps = NavLinkMenuItemProps | HeaderMenuItemProps;

// --- Componente MenuItem (sin cambios) ---
const MenuItem: React.FC<MenuItemProps> = (props) => {
    const handleRipple = (event: React.MouseEvent<HTMLElement>) => {
        const link = event.currentTarget;
        const circle = document.createElement("span");
        const diameter = Math.max(link.clientWidth, link.clientHeight);
        const radius = diameter / 2;
        circle.style.width = circle.style.height = `${diameter}px`;
        circle.style.left = `${event.clientX - link.getBoundingClientRect().left - radius}px`;
        circle.style.top = `${event.clientY - link.getBoundingClientRect().top - radius}px`;
        circle.classList.add("ripple");
        const existingRipple = link.querySelector(".ripple");
        if (existingRipple) {
            existingRipple.remove();
        }
        link.appendChild(circle);
        setTimeout(() => {
            if (circle.parentElement) {
                circle.remove();
            }
        }, 600);
    };
    if (props.isHeader) {
        return <button className={`menu-header-button ${props.isActive ? 'parent-active' : ''}`} onClick={props.onClick} onMouseDown={handleRipple}>{props.children}</button>
    }
    return (
        <NavLink to={props.to} className="nav-link" end={props.end} onMouseDown={handleRipple}>
            {props.children}
        </NavLink>
    );
};

// --- Configuración del menú (ACTUALIZADO PARA TESORERÍA) ---
const menuConfig = [
    { id: 'proyectos', icon: <IconProject />, title: 'Proyectos', children: [
        { to: '/proyectos/nuevo', title: 'Nuevo Proyecto' },
        { to: '/proyectos', title: 'Lista de Proyectos' }
    ]},

    { id: 'ventas', icon: <IconSales />, title: 'Ventas', children: [
        { to: '/ventas/nueva', title: 'Nueva Factura' },
        { to: '/ventas', title: 'Lista de Facturas' }
    ]},

    { id: 'compras', icon: <IconShopping />, title: 'Compras', children: [
        { to: '/compras/nueva', title: 'Registrar Nueva Compra' },
        { to: '/compras', title: 'Lista de Compras' }
    ]},

    { id: 'tesoreria', icon: <IconTreasury />, title: 'Tesoría', children: [
        { to: '/tesoreria/cuentas', title: 'Cuentas Bancarias' },
        { to: '/tesoreria/pagos-realizados', title: 'Pagos Realizados' },
        { to: '/tesoreria/pagos-recibidos', title: 'Pagos Recibidos' }
    ]},

    { id: 'contabilidad', icon: <IconAccounting />, title: 'Contabilidad', children: [
        { to: '/contabilidad/plan-cuentas', title: 'Plan de Cuentas' },
        { to: '/contabilidad/asientos', title: 'Asientos Contables' }
    ]},

    { id: 'prestamos', icon: <IconLoans />, title: 'Préstamos', children: [
        { to: '/prestamos/nuevo', title: 'Nuevo Préstamo' },
        { to: '/prestamos', title: 'Lista de Préstamos' }
    ]},

    { id: 'maestros', icon: <IconMasters />, title: 'Maestros', children: [
        { to: '/clientes', title: 'Clientes' },
        { to: '/proveedores', title: 'Proveedores' },
        { to: '/servicios', title: 'Servicios' },
        { to: '/centros-costo', title: 'Centros de Costo' } 
    ]},

    { id: 'reportes', icon: <IconReports />, title: 'Reportes', children: [
        { to: '/reportes/libros-electronicos', title: 'Libros Electrónicos' },
        { to: '/reportes/estado-resultados', title: 'Estado de Resultados' },
        { to: '/reportes/balance-general', title: 'Balance General' }
    ]},

    { id: 'configuracion', icon: <IconSettings />, title: 'Configuración', children: [
        { to: '/configuracion/usuarios', title: 'Usuarios' },
        { to: '/configuracion/empresas', title: 'Empresas' }
    ]},
    
];


interface MainLayoutProps {
    children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [openMenus, setOpenMenus] = useState<{ [key: string]: boolean }>({});

    useEffect(() => {
        const currentParent = menuConfig.find(menu => menu.children.some(child => location.pathname.startsWith(child.to)));
        if (currentParent) {
            setOpenMenus(prev => ({ ...prev, [currentParent.id]: true }));
        }
    }, [location.pathname]);


    const handleLogout = async () => {
        const result = await showConfirmDialog(
            '¿Estás seguro?',
            'Tu sesión actual se cerrará.'
        );

        if (result.isConfirmed) {
            logout();
            navigate('/login');
        }
    };

    const toggleMenu = (menu: string) => {
        setOpenMenus(prev => ({ ...prev, [menu]: !prev[menu] }));
    };

    return (
        <div className="main-layout">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <img src={logoImagen} alt="Logo" className="sidebar-logo" />
                    <h3>SPEAS</h3>
                </div>
                <nav className="sidebar-nav">
                    <MenuItem to="/dashboard" end><IconDashboard /><span>Dashboard</span></MenuItem>
                    
                    {menuConfig.map(menu => (
                        <div className="menu-section" key={menu.id}>
                            <MenuItem isHeader onClick={() => toggleMenu(menu.id)} isActive={menu.children.some(c => location.pathname.startsWith(c.to))}>
                                {menu.icon}<span>{menu.title}</span><IconChevron isOpen={!!openMenus[menu.id]} />
                            </MenuItem>
                            <div className={`submenu ${openMenus[menu.id] ? 'open' : ''}`}>
                                {menu.children.map(child => (
                                    <MenuItem key={child.to} to={child.to}><span>{child.title}</span></MenuItem>
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>
                <div className="sidebar-footer">
                    <button onClick={handleLogout} className="logout-button">
                        Cerrar Sesión
                    </button>
                </div>
            </aside>
            <main className="main-content">
                {children}
            </main>
        </div>
    );
};

export default MainLayout;
