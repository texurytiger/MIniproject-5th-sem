import { Navigate } from 'react-router-dom';
import CustomerLogin from './auth/CustomerLogin';
import RegisterPage from './auth/RegisterPage';
import SellerLogin from './auth/SellerLogin';
import SellerRegister from './auth/SellerRegister';
import StaffLogin from './auth/StaffLogin';
import AdminLogin from './auth/AdminLogin';
import AccountPage from './pages/AccountPage';
import AccessLabPage from './pages/AccessLabPage';
import UsersPage from './pages/UsersPage';
import RolesPage from './pages/RolesPage';
import MatrixPage from './pages/MatrixPage';
import AuditPage from './pages/AuditPage';
import SelfTestPage from './pages/SelfTestPage';
import DashboardPage from './pages/DashboardPage';
import CategoriesPage from './pages/CategoriesPage';
import ApprovalsPage from './pages/ApprovalsPage';

/**
 * E1 · Access control (FR numbers = the team FR list).
 * layout: bare (sign-in pages) | store (customer site) | console (admin sidebar).
 * permission = the same "resource:action" string the API guard checks. The UI only hides things; the server decides.
 */
export default {
  id: 'E1',
  routes: [
    { path: '/login', element: <CustomerLogin />, layout: 'bare', public: true },             // FR-02
    { path: '/register', element: <RegisterPage />, layout: 'bare', public: true },           // FR-01
    { path: '/seller/login', element: <SellerLogin />, layout: 'bare', public: true },        // FR-02
    { path: '/seller/register', element: <SellerRegister />, layout: 'bare', public: true },
    { path: '/staff/login', element: <StaffLogin />, layout: 'bare', public: true },          // FR-02
    { path: '/admin/login', element: <AdminLogin />, layout: 'bare', public: true },          // FR-02
    { path: '/account', element: <AccountPage />, layout: 'store' },                          // FR-03, 04, 08
    { path: '/lab', element: <div className="store-page"><AccessLabPage /></div>, layout: 'store' }, // FR-08, 09, 10
    { path: '/admin', element: <Navigate to="/admin/dashboard" replace />, layout: 'console', roles: ['ADMIN'] },
    { path: '/admin/dashboard', element: <DashboardPage />, layout: 'console', permission: 'role:manage' },
    { path: '/admin/categories', element: <CategoriesPage />, layout: 'console', permission: 'category:manage' },
    { path: '/admin/approvals', element: <ApprovalsPage />, layout: 'console', permission: 'user:approve' },  // seller shops + listings
    { path: '/admin/users', element: <UsersPage />, layout: 'console', permission: 'user:assign_role' },   // FR-06, 07
    { path: '/admin/roles', element: <RolesPage />, layout: 'console', permission: 'role:manage' },        // FR-07
    { path: '/admin/matrix', element: <MatrixPage />, layout: 'console', permission: 'role:manage' },      // FR-12
    { path: '/admin/audit', element: <AuditPage />, layout: 'console', permission: 'audit:read' },         // FR-11
    { path: '/admin/lab', element: <AccessLabPage />, layout: 'console', permission: 'role:manage' },      // FR-08, 09, 10
    { path: '/admin/selftest', element: <SelfTestPage />, layout: 'console', permission: 'role:manage' },  // all E1 rules
  ],
  nav: [
    { area: 'console', to: '/admin/dashboard', label: 'Overview', icon: 'grid', section: 'Store', permission: 'role:manage', top: true },
    { area: 'console', to: '/admin/approvals', label: 'Approvals', icon: 'check', section: 'Store', permission: 'user:approve', top: true },
    { area: 'console', to: '/admin/categories', label: 'Categories', icon: 'tree', section: 'Store', permission: 'category:manage', top: true },
    { area: 'console', to: '/admin/users', label: 'Users', icon: 'users', section: 'People & access', permission: 'user:assign_role', top: true },
    { area: 'console', to: '/admin/roles', label: 'Roles', icon: 'tree', section: 'People & access', permission: 'role:manage' },
    { area: 'console', to: '/admin/matrix', label: 'Permission report', icon: 'grid', section: 'People & access', permission: 'role:manage' },
    { area: 'console', to: '/admin/audit', label: 'Audit log', icon: 'scroll', section: 'Monitoring', permission: 'audit:read', top: true },
    { area: 'console', to: '/admin/lab', label: 'Access Lab', icon: 'flask', section: 'Testing', permission: 'role:manage' },
    { area: 'console', to: '/admin/selftest', label: 'Self-test', icon: 'play', section: 'Testing', permission: 'role:manage' },
  ],
};
