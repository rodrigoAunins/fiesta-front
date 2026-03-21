import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from './context/AuthContext';
import Landing from './pages/Landing';
import Home from './pages/Home';
import CreateRaffle from './pages/CreateRaffle';
import DashboardCreator from './pages/DashboardCreator';
import DashboardSeller from './pages/DashboardSeller';
import DashboardDoor from './pages/DashboardDoor';
import Buyer from './pages/Buyer';
import ResetPassword from './pages/ResetPassword';
import GoogleAuthSuccess from './components/GoogleAuthSuccess';
import LoggedTopBar from './components/LoggedTopBar';
import ScrollRestorationManager from './components/ScrollRestorationManager';
import AdminDashboard from './pages/AdminDashboard';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);

  if (!user) return null;

  return (
    <LoggedTopBar
      user={user}
      showCreate={user.role === 'creator'}
      onLogout={logout}
    />
  );
};

const HomeOrLanding = () => {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const rifaId = queryParams.get('rifa');

  if (rifaId) return <Buyer raffleIdFromUrl={rifaId} />;

  return user ? <Home /> : <Landing />;
};

const AppRoutes = () => {
  return (
    <>
      <ScrollRestorationManager />
      <Navbar />

      <Routes>
        <Route path="/" element={<HomeOrLanding />} />
        <Route path="/create" element={<CreateRaffle />} />
        <Route path="/dashboard/:id" element={<DashboardCreator />} />
        <Route path="/seller-dashboard/:id" element={<DashboardSeller />} />
        <Route path="/door-dashboard/:id" element={<DashboardDoor />} />
        <Route path="/dashboard/:id/door" element={<DashboardDoor />} />
        <Route path="/raffle/:id" element={<Buyer />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/success" element={<GoogleAuthSuccess />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </>
  );
};

function AppShell() {
  const { user } = useContext(AuthContext);
  const location = useLocation();

  const queryParams = new URLSearchParams(location.search);
  const rifaId = queryParams.get('rifa');

  // 1. Vistas Públicas
  const isPublicLanding = location.pathname === '/' && !user && !rifaId;
  
  // 2. Vistas Privadas que NECESITAN expandirse en PC
  const isHomeLoggedIn = location.pathname === '/' && !!user && !rifaId;
  const isCreateRoute = location.pathname === '/create';
  const isDashboardRoute = location.pathname.includes('dashboard');
  const isbuyerRoute = location.pathname.includes('/raffle/');
  const isAdminRoute = location.pathname === '/admin';
  
  // 3. Agrupamos las rutas que rompen la caja de celular para usar toda la pantalla
  const isFullScreenRoute = isPublicLanding || isHomeLoggedIn || isCreateRoute || isDashboardRoute || isbuyerRoute || isAdminRoute;

  return (
    <div
      className={
        isFullScreenRoute
          ? 'min-h-screen w-full bg-[#f8f9fa] selection:bg-[#3483fa] selection:text-white'
          : 'min-h-screen bg-gray-900 flex justify-center selection:bg-emerald-500 selection:text-white'
      }
    >
      <div
        className={
          isFullScreenRoute
            ? 'w-full min-h-screen flex flex-col'
            : 'app-container relative w-full max-w-[480px] overflow-x-hidden bg-[#0f172a] pb-28 shadow-[0_0_30px_rgba(0,0,0,0.8)]'
        }
      >
        <AppRoutes />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}