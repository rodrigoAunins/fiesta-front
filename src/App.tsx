import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  Navigate,
  useSearchParams,
} from 'react-router-dom';
import { useContext, useMemo, useState } from 'react';
import { AuthContext } from './context/AuthContext';
import Landing from './pages/Landing';
import DashboardCreator from './pages/DashboardCreator';
import DashboardSeller from './pages/DashboardSeller';
import DashboardDoor from './pages/DashboardDoor';
import Buyer from './pages/Buyer';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import LoggedTopBar from './components/LoggedTopBar';
import ScrollRestorationManager from './components/ScrollRestorationManager';
import AdminDashboard from './pages/AdminDashboard';
import EventOnboarding from './pages/EventOnboarding';
import EventWorkspace, { EventInvitationPage } from './pages/EventWorkspace';
import MasterDashboard from './pages/MasterDashboard';
import Home from './pages/Home';
import PublicInvitation from './pages/PublicInvitation';

function canAccessEventWorkspace(role?: string | null) {
  return role === 'master' || role === 'creator' || role === 'organizer' || role === 'guest';
}

const ProtectedCreateRaffle = () => {
  const { user } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const [draftSeed] = useState(() => Date.now().toString(36));
  const finalUserId = searchParams.get('finalUserId') || searchParams.get('assignedToId') || '';
  const organizerId = searchParams.get('organizerId') || '';
  const draftId = useMemo(() => {
    const ownerSeed = finalUserId || organizerId || String(user?.id || 'event');
    return `draft-${ownerSeed}-${draftSeed}`;
  }, [draftSeed, finalUserId, organizerId, user?.id]);

  if (!user) return <Landing />;
  if (!['master', 'creator', 'organizer'].includes(String(user.role))) return <Landing />;

  const nextParams = new URLSearchParams();
  if (finalUserId) nextParams.set('finalUserId', finalUserId);
  if (organizerId) nextParams.set('organizerId', organizerId);
  const query = nextParams.toString();

  return <Navigate to={`/workspace/${draftId}${query ? `?${query}` : ''}`} replace />;
};

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();

  if (!user) return null;
  if (
    location.pathname === '/master' ||
    location.pathname === '/onboarding' ||
    location.pathname.startsWith('/workspace/') ||
    location.pathname.startsWith('/invitation/')
  ) {
    return null;
  }

  return (
    <LoggedTopBar
      user={user}
      showCreate={user.role === 'creator' || user.role === 'organizer'}
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
  if (user?.role === 'master') return <MasterDashboard />;
  if (user) return <Home />;

  return <Landing />;
};

const ProtectedWorkspace = () => {
  const { user } = useContext(AuthContext);

  if (!user) return <Landing />;
  if (!canAccessEventWorkspace(user.role)) return <Landing />;

  return <EventWorkspace />;
};

const ProtectedOnboarding = () => {
  const { user } = useContext(AuthContext);

  if (!user) return <Landing />;
  if (!canAccessEventWorkspace(user.role)) return <Landing />;

  return <EventOnboarding />;
};

const ProtectedMaster = () => {
  const { user } = useContext(AuthContext);

  if (!user) return <Landing />;
  if (user.role === 'creator') return <Home />;
  if (user.role !== 'master' && user.role !== 'organizer') return <Landing />;

  return <MasterDashboard />;
};

const AppRoutes = () => {
  return (
    <>
      <ScrollRestorationManager />
      <Navbar />

      <Routes>
        <Route path="/" element={<HomeOrLanding />} />
        <Route path="/create" element={<ProtectedCreateRaffle />} />
        <Route path="/dashboard/:id" element={<DashboardCreator />} />
        <Route path="/seller-dashboard/:id" element={<DashboardSeller />} />
        <Route path="/door-dashboard/:id" element={<DashboardDoor />} />
        <Route path="/dashboard/:id/door" element={<DashboardDoor />} />
        <Route path="/raffle/:id" element={<Buyer />} />
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/master" element={<ProtectedMaster />} />
        <Route path="/onboarding" element={<ProtectedOnboarding />} />
        <Route path="/workspace/:id" element={<ProtectedWorkspace />} />
        <Route path="/invitation/:id" element={<EventInvitationPage />} />
        <Route path="/i/:slug" element={<PublicInvitation />} />
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
  const isMasterRoute = location.pathname === '/master';
  const isEventWorkspaceRoute = location.pathname === '/onboarding' || location.pathname.startsWith('/workspace/');
  const isInvitationRoute = location.pathname.startsWith('/invitation/') || location.pathname.startsWith('/i/');
  
  // 3. Agrupamos las rutas que rompen la caja de celular para usar toda la pantalla
  const isFullScreenRoute = isPublicLanding || isHomeLoggedIn || isCreateRoute || isDashboardRoute || isbuyerRoute || isAdminRoute || isMasterRoute || isEventWorkspaceRoute || isInvitationRoute;

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
    <Router basename={import.meta.env.BASE_URL}>
      <AppShell />
    </Router>
  );
}
