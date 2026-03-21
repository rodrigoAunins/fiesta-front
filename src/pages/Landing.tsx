import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import PasswordStrength from '../components/PasswordStrength';
import { getPasswordChecks } from '../utils/passwordRules';
import { promptAppShare } from '../utils/ux';

type Tone = 'blue' | 'amber' | 'emerald';
type PreviewVariant =
  | 'organizer'
  | 'team'
  | 'door'
  | 'setup'
  | 'share'
  | 'guest';

const heroBullets = [
  'Creá tu evento y compartilo en minutos',
  'Un solo link con fecha, lugar, horario y contacto',
  'Confirmaciones, reservas y cobros en piloto automático',
  'Tus invitados acceden al instante, sin bajar ninguna app',
];

const useCases = [
  '15 años',
  'Casamientos',
  'Cumpleaños',
  'Salones',
  'Eventos sociales',
  'Egresados',
];

const roleCards = [
  {
    eyebrow: 'Organizador',
    title: 'El control total, sin el estrés',
    text: 'Armá el evento, enviá el link y monitoreá respuestas, reservas o pagos en tiempo real. Despedite de las planillas desactualizadas.',
    icon: 'fa-calendar-check',
    tone: 'blue' as Tone,
    preview: 'organizer' as PreviewVariant,
  },
  {
    eyebrow: 'Equipo / Ventas',
    title: 'Colaboración sin desorden',
    text: 'Otorgá accesos específicos a tu equipo para vender, validar o asistir. Cada uno ve exactamente lo que necesita para hacer su trabajo.',
    icon: 'fa-share-nodes',
    tone: 'amber' as Tone,
    preview: 'team' as PreviewVariant,
  },
  {
    eyebrow: 'Recepción / Acceso',
    title: 'Ingresos ágiles y sin filas',
    text: 'Buscá por nombre o escaneá el QR en milisegundos. Sin listas de papel, sin capturas de pantalla dudosas y sin demoras en la puerta.',
    icon: 'fa-qrcode',
    tone: 'emerald' as Tone,
    preview: 'door' as PreviewVariant,
  },
] as const;

const guestFlowCards = [
  {
    title: 'Experiencia sin fricción',
    text: 'Tus invitados entran al link y entienden todo al instante. Sin registrarse ni descargar apps, ven cuándo es y qué tienen que hacer.',
    preview: 'guest' as PreviewVariant,
  },
  {
    title: 'Viralidad natural',
    text: 'Un formato optimizado para circular. Lo reenviás por WhatsApp o Instagram en un clic y la información llega impecable.',
    preview: 'share' as PreviewVariant,
  },
  {
    title: 'Lanzamiento inmediato',
    text: 'Completás los datos clave y en cuestión de minutos tenés una página profesional lista para empezar a recibir a tu gente.',
    preview: 'setup' as PreviewVariant,
  },
];

const quickSteps = [
  {
    number: '01',
    title: 'Creás tu evento',
    text: 'Definís lugar, fecha y si necesitás cobrar entrada o recibir confirmación.',
    preview: 'setup' as PreviewVariant,
  },
  {
    number: '02',
    title: 'Lo compartís',
    text: 'Pegás el link en tus redes o grupos. Tus invitados acceden desde cualquier dispositivo.',
    preview: 'share' as PreviewVariant,
  },
  {
    number: '03',
    title: 'Monitoreás todo',
    text: 'Ves quién va, quién pagó y administrás el acceso, todo desde un único panel central.',
    preview: 'guest' as PreviewVariant,
  },
] as const;

const impactSlides = [
  {
    badge: 'Menos idas y vueltas',
    title: 'Chau a las dudas por WhatsApp',
    text: 'Toda la información de tu evento, siempre a mano. Centralizá ubicación y horarios para que tus invitados no tengan que preguntarte "¿dónde era?" tres veces.',
    bullets: [
      'Ubicación y cronograma claros',
      'Información siempre actualizada',
      'Contacto directo integrado',
    ],
  },
  {
    badge: 'Más ingresos, menos cobros',
    title: 'Confirmaciones y pagos automáticos',
    text: 'Olvidate de perseguir a la gente. Recibí señas, vendé entradas y llevá la lista de invitados en tiempo real sin salir de la plataforma.',
    bullets: [
      'Cobros simples e integrados',
      'RSVP en un solo clic',
      'Lista de invitados en vivo',
    ],
  },
  {
    badge: 'La mejor primera impresión',
    title: 'Tus invitados lo aman',
    text: 'Ofrecé una experiencia premium desde el primer clic. Un diseño intuitivo que se adapta al celular y hace que confirmar asistencia sea un placer.',
    bullets: [
      'No hay que bajar una app',
      'No exige registro para mirar',
      '100% optimizado para móviles',
    ],
  },
];

const faqs = [
  {
    q: '¿Sirve para 15, casamientos, cumpleaños y eventos sociales?',
    a: 'Sí. Pase Libre está pensado para eventos donde necesitás compartir información clara, recibir respuestas, organizar accesos o cobrar una reserva o entrada.',
  },
  {
    q: '¿Mis invitados tienen que bajar una app?',
    a: 'No. Entran directo desde el link, ven todo desde el celular o la compu y responden sin instalar absolutamente nada.',
  },
  {
    q: '¿Mis invitados tienen que crearse una cuenta?',
    a: 'No para ver el evento ni confirmar. La idea es justamente que entrar sea simple y rápido, sin barreras.',
  },
  {
    q: '¿Puedo usarlo solo para mostrar la info del evento?',
    a: 'Por supuesto. Podés usar Pase Libre como una invitación digital interactiva, sin necesidad de activar módulos de cobro o reserva.',
  },
  {
    q: '¿También sirve para confirmar asistencia?',
    a: 'Sí. Podés usarlo para recibir respuestas (RSVP) y tener todo tu conteo actualizado de manera automática en un solo lugar.',
  },
  {
    q: '¿Puedo cobrar una seña o una entrada?',
    a: 'Sí, podés activar cobros para que tus invitados aseguren su lugar pagando directamente desde el mismo flujo del evento.',
  },
  {
    q: '¿Se puede compartir por WhatsApp?',
    a: 'Sí. El link de Pase Libre genera una vista previa espectacular para que lo mandes por WhatsApp, Instagram y cualquier red social.',
  },
  {
    q: '¿Sirve para salones, planners o gente que organiza seguido?',
    a: 'Totalmente. Si organizás múltiples eventos, te permite escalar tu trabajo, tener un historial y no depender de mensajes dispersos.',
  },
  {
    q: '¿Puedo sumar gente para que me ayude?',
    a: 'Sí. Podés dar accesos específicos a personas de tu equipo para que te ayuden con las ventas, la recepción en puerta o tareas administrativas.',
  },
  {
    q: '¿Funciona bien desde el celular?',
    a: 'Sí. Pase Libre es "mobile-first", asegurando que tanto vos como tus invitados tengan la mejor experiencia usándolo desde el teléfono.',
  },
];

async function showRecoveryCodeModal(recoveryCode: string, isDark: boolean) {
  const copyButtonId = 'copyRecoveryCodeBtn';
  const bgColor = isDark ? '#18181b' : '#ffffff';
  const textColor = isDark ? '#f4f4f5' : '#1e293b';

  await Swal.fire({
    icon: 'success',
    title: '¡Tu cuenta ya está lista!',
    background: bgColor,
    color: textColor,
    html: `
      <div style="text-align:left">
        <p style="margin-bottom:10px;">Ya podés empezar a crear y compartir tu evento.</p>
        <p style="margin-bottom:10px;">Antes de seguir, guardá este <b>código de recuperación</b>. Te va a servir si alguna vez necesitás recuperar tu cuenta.</p>
        <div style="
          padding:14px;
          border-radius:12px;
          background:${isDark ? '#27272a' : '#f3f4f6'};
          border:1px solid ${isDark ? '#3f3f46' : '#e5e7eb'};
          color:${textColor};
          font-weight:800;
          font-size:20px;
          letter-spacing:2px;
          text-align:center;
          margin-top:8px;
          margin-bottom:12px;
          word-break:break-word;
        ">
          ${recoveryCode || 'NO-GENERADO'}
        </div>

        <button
          id="${copyButtonId}"
          type="button"
          style="
            width:100%;
            border:none;
            border-radius:12px;
            padding:12px 14px;
            background:#3483fa;
            color:#fff;
            font-weight:bold;
            cursor:pointer;
            margin-bottom:8px;
            transition: background 0.2s;
          "
        >
          Copiar código
        </button>

        <p style="font-size:13px;color:#64748b;">Guardalo en un lugar seguro, como tus notas o tu WhatsApp.</p>
      </div>
    `,
    confirmButtonText: 'Listo, continuar',
    confirmButtonColor: '#3483fa',
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => {
      const copyBtn = document.getElementById(copyButtonId);
      copyBtn?.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(recoveryCode);
          copyBtn.textContent = '¡Código copiado!';
          (copyBtn as HTMLButtonElement).style.background = '#00a650';
        } catch (err) {
          console.error(err);
          copyBtn.textContent = 'No se pudo copiar';
          (copyBtn as HTMLButtonElement).style.background = '#dc2626';
        }
      });
    },
  });
}

function resolveGoogleAuthUrl() {
  const explicitUrl = String(import.meta.env.VITE_GOOGLE_AUTH_URL || '').trim();
  if (explicitUrl) return explicitUrl;

  const axiosBase = String(api.defaults.baseURL || '').trim();
  if (!axiosBase) return '';

  if (axiosBase.startsWith('http://') || axiosBase.startsWith('https://')) {
    return `${axiosBase.replace(/\/+$/, '')}/auth/google`;
  }

  return `${window.location.origin}${axiosBase.replace(/\/+$/, '')}/auth/google`;
}

function toneClasses(tone: Tone) {
  if (tone === 'amber') {
    return {
      pill: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20',
      icon: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
      soft: 'from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10',
    };
  }

  if (tone === 'emerald') {
    return {
      pill: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
      icon: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
      soft: 'from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/10',
    };
  }

  return {
    pill: 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20',
    icon: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300',
    soft: 'from-blue-50 to-indigo-50 dark:from-blue-500/10 dark:to-indigo-500/10',
  };
}

function MiniPreview({ variant }: { variant: PreviewVariant }) {
  const shell =
    'rounded-[22px] border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-3 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950';

  if (variant === 'organizer') {
    return (
      <div className={shell}>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black text-gray-900 dark:text-white">
              Fiesta de Agus
            </p>
            <p className="text-[10px] text-gray-500 dark:text-zinc-400">
              Sábado 21 · 22:00 hs
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            Activo
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-white p-2 dark:bg-zinc-900">
            <p className="text-[9px] uppercase tracking-wide text-gray-400">Confirmados</p>
            <p className="mt-1 text-sm font-black text-gray-900 dark:text-white">42</p>
          </div>
          <div className="rounded-xl bg-white p-2 dark:bg-zinc-900">
            <p className="text-[9px] uppercase tracking-wide text-gray-400">Pendientes</p>
            <p className="mt-1 text-sm font-black text-gray-900 dark:text-white">18</p>
          </div>
          <div className="rounded-xl bg-white p-2 dark:bg-zinc-900">
            <p className="text-[9px] uppercase tracking-wide text-gray-400">Pagos</p>
            <p className="mt-1 text-sm font-black text-gray-900 dark:text-white">25</p>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'team') {
    return (
      <div className={shell}>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black text-gray-900 dark:text-white">
              Mi link para compartir
            </p>
            <p className="text-[10px] text-gray-500 dark:text-zinc-400">
              pase.libre/evento/agus
            </p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
            <i className="fas fa-share-nodes text-[11px]"></i>
          </div>
        </div>

        <div className="space-y-2">
          <div className="rounded-xl bg-white px-3 py-2 dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-500 dark:text-zinc-400">Invitados contactados</span>
              <span className="text-[11px] font-black text-gray-900 dark:text-white">57</span>
            </div>
          </div>

          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#3483fa] px-3 py-2 text-[11px] font-black text-white"
          >
            <i className="fab fa-whatsapp text-[12px]"></i>
            Compartir ahora
          </button>
        </div>
      </div>
    );
  }

  if (variant === 'door') {
    return (
      <div className={shell}>
        <div className="mb-3 rounded-xl bg-white px-3 py-2 dark:bg-zinc-900">
          <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-zinc-400">
            <i className="fas fa-magnifying-glass text-[10px]"></i>
            Buscar nombre o escanear
          </div>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black text-emerald-800 dark:text-emerald-300">
                Ingreso validado
              </p>
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                Agustina Pérez · 2 personas
              </p>
            </div>
            <i className="fas fa-circle-check text-emerald-600 dark:text-emerald-300"></i>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'setup') {
    return (
      <div className={shell}>
        <div className="mb-2 rounded-xl bg-white px-3 py-2 dark:bg-zinc-900">
          <p className="text-[10px] text-gray-400">Nombre del evento</p>
          <p className="text-[11px] font-black text-gray-900 dark:text-white">Cumple de Agus</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white px-3 py-2 dark:bg-zinc-900">
            <p className="text-[10px] text-gray-400">Fecha</p>
            <p className="text-[11px] font-bold text-gray-900 dark:text-white">21 Sep</p>
          </div>
          <div className="rounded-xl bg-white px-3 py-2 dark:bg-zinc-900">
            <p className="text-[10px] text-gray-400">Hora</p>
            <p className="text-[11px] font-bold text-gray-900 dark:text-white">22:00</p>
          </div>
        </div>

        <button
          type="button"
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#3483fa] px-3 py-2 text-[11px] font-black text-white"
        >
          <i className="fas fa-arrow-right text-[10px]"></i>
          Seguir
        </button>
      </div>
    );
  }

  if (variant === 'share') {
    return (
      <div className={shell}>
        <div className="mb-2 rounded-xl bg-white px-3 py-2 dark:bg-zinc-900">
          <p className="truncate text-[10px] text-gray-500 dark:text-zinc-400">
            pase.libre/fiesta-de-agus
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-[11px] font-black text-white"
          >
            <i className="fab fa-whatsapp text-[12px]"></i>
            WhatsApp
          </button>
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-[11px] font-black text-gray-900 dark:bg-zinc-900 dark:text-white"
          >
            <i className="fas fa-copy text-[11px]"></i>
            Copiar
          </button>
        </div>

        <div className="mt-2 rounded-xl border border-dashed border-gray-200 px-3 py-2 text-[10px] text-gray-500 dark:border-zinc-700 dark:text-zinc-400">
          Listo para compartir
        </div>
      </div>
    );
  }

  return (
    <div className={shell}>
      <div className="rounded-xl bg-white p-3 dark:bg-zinc-900">
        <div className="mb-3">
          <p className="text-[11px] font-black text-gray-900 dark:text-white">
            Fiesta de Agus
          </p>
          <p className="text-[10px] text-gray-500 dark:text-zinc-400">
            Sábado 21 · 22:00 hs · Salón Roma
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="rounded-xl bg-[#3483fa] px-3 py-2 text-[11px] font-black text-white"
          >
            Sí, voy
          </button>
          <button
            type="button"
            className="rounded-xl bg-gray-100 px-3 py-2 text-[11px] font-black text-gray-700 dark:bg-zinc-800 dark:text-zinc-200"
          >
            No puedo
          </button>
        </div>
      </div>
    </div>
  );
}

function RoleCard({
  eyebrow,
  title,
  text,
  icon,
  tone,
  preview,
}: {
  eyebrow: string;
  title: string;
  text: string;
  icon: string;
  tone: Tone;
  preview: PreviewVariant;
}) {
  const styles = toneClasses(tone);

  return (
    <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4">
        <MiniPreview variant={preview} />
      </div>

      <div
        className={`mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${styles.pill}`}
      >
        {eyebrow}
      </div>

      <div
        className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${styles.icon}`}
      >
        <i className={`fas ${icon} text-[16px]`}></i>
      </div>

      <h3 className="text-lg font-black text-gray-900 dark:text-white">{title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-gray-600 dark:text-zinc-400">
        {text}
      </p>
    </div>
  );
}

function StepCard({
  number,
  title,
  text,
  preview,
}: {
  number: string;
  title: string;
  text: string;
  preview: PreviewVariant;
}) {
  return (
    <div className="rounded-[24px] border border-gray-100 bg-gray-50 p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-black text-gray-700 shadow-sm dark:bg-zinc-900 dark:text-zinc-200">
        {number}
      </div>

      <div className="mb-4">
        <MiniPreview variant={preview} />
      </div>

      <h3 className="text-lg font-black text-gray-900 dark:text-white">{title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-gray-600 dark:text-zinc-400">
        {text}
      </p>
    </div>
  );
}

function GuestFlowCard({
  title,
  text,
  preview,
}: {
  title: string;
  text: string;
  preview: PreviewVariant;
}) {
  return (
    <div className="rounded-[24px] border border-gray-100 bg-gray-50 p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-4">
        <MiniPreview variant={preview} />
      </div>
      <h3 className="text-lg font-black text-gray-900 dark:text-white">{title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-gray-600 dark:text-zinc-400">
        {text}
      </p>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const authRef = useRef<HTMLDivElement | null>(null);

  const [isDark, setIsDark] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [activeImpact, setActiveImpact] = useState(0);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
  });

  const [registerForm, setRegisterForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] =
    useState(false);

  const googleAuthUrl = useMemo(() => resolveGoogleAuthUrl(), []);
  const passwordChecks = getPasswordChecks(registerForm.password);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      document.body.style.backgroundColor = '#09090b';
    } else {
      root.classList.remove('dark');
      document.body.style.backgroundColor = '#ebebeb';
    }

    return () => {
      document.body.style.backgroundColor = '';
    };
  }, [isDark]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      promptAppShare('landing', window.location.origin);
    }, 26000);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveImpact((prev) => (prev + 1) % impactSlides.length);
    }, 4800);

    return () => window.clearInterval(interval);
  }, []);

  const scrollToAuth = (mode: 'login' | 'register') => {
    setIsLogin(mode === 'login');
    setTimeout(() => {
      authRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true);

      if (!googleAuthUrl) {
        await Swal.fire({
          icon: 'info',
          title: 'Google no está disponible por ahora',
          background: isDark ? '#18181b' : '#ffffff',
          color: isDark ? '#f4f4f5' : '#1e293b',
          html: `
            <p>Podés entrar usando tu correo y contraseña sin problema.</p>
            <p style="margin-top:10px;">Después vas a poder crear, compartir y organizar todo desde tu cuenta.</p>
          `,
          confirmButtonText: 'Entendido',
          confirmButtonColor: '#3483fa',
        });
        return;
      }

      window.location.href = googleAuthUrl;
    } catch (error) {
      console.error(error);
      await Swal.fire({
        title: 'Algo salió mal',
        text: 'No pudimos conectar con Google. Probá de nuevo en unos segundos.',
        icon: 'error',
        background: isDark ? '#18181b' : '#ffffff',
        color: isDark ? '#f4f4f5' : '#1e293b',
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);

      const { data } = await api.post('/auth/login', {
        email: loginForm.email.trim().toLowerCase(),
        password: loginForm.password,
      });

      login(data.user, data.access_token ?? data.token);

      await Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: '¡Ya estás adentro!',
        showConfirmButton: false,
        timer: 1800,
        background: isDark ? '#18181b' : '#ffffff',
        color: isDark ? '#f4f4f5' : '#1e293b',
      });

      navigate('/');
    } catch (err: any) {
      await Swal.fire({
        title: 'No pudimos ingresar',
        text:
          err?.response?.data?.message ||
          'Revisá tu correo y contraseña e intentá de nuevo.',
        icon: 'error',
        background: isDark ? '#18181b' : '#ffffff',
        color: isDark ? '#f4f4f5' : '#1e293b',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (
      !registerForm.firstName.trim() ||
      !registerForm.lastName.trim() ||
      !registerForm.email.trim()
    ) {
      await Swal.fire({
        icon: 'warning',
        title: 'Faltan datos',
        text: 'Completá nombre, apellido y correo para continuar.',
        background: isDark ? '#18181b' : '#ffffff',
        color: isDark ? '#f4f4f5' : '#1e293b',
      });
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      await Swal.fire({
        icon: 'warning',
        title: 'Las contraseñas no coinciden',
        text: 'Revisalas y volvé a intentarlo.',
        background: isDark ? '#18181b' : '#ffffff',
        color: isDark ? '#f4f4f5' : '#1e293b',
      });
      return;
    }

    if (!passwordChecks.isSafe) {
      await Swal.fire({
        icon: 'warning',
        title: 'Contraseña muy débil',
        text: 'Usá al menos 8 caracteres, una mayúscula y un número para mayor seguridad.',
        background: isDark ? '#18181b' : '#ffffff',
        color: isDark ? '#f4f4f5' : '#1e293b',
      });
      return;
    }

    try {
      setLoading(true);

      const { data } = await api.post('/auth/register', {
        firstName: registerForm.firstName.trim(),
        lastName: registerForm.lastName.trim(),
        email: registerForm.email.trim().toLowerCase(),
        password: registerForm.password,
      });

      await showRecoveryCodeModal(data.recoveryCode ?? '', isDark);

      login(data.user, data.access_token ?? data.token);
      navigate('/');
    } catch (err: any) {
      await Swal.fire({
        icon: 'error',
        title: 'No pudimos crear tu cuenta',
        text:
          err?.response?.data?.message ||
          'Intentá de nuevo en unos segundos.',
        background: isDark ? '#18181b' : '#ffffff',
        color: isDark ? '#f4f4f5' : '#1e293b',
      });
    } finally {
      setLoading(false);
    }
  };

  const currentImpact = impactSlides[activeImpact];

  return (
    <>
      <main className="min-h-screen bg-[#ebebeb] text-gray-800 transition-colors duration-300 dark:bg-zinc-950 dark:text-zinc-100">
        <header className="sticky top-0 z-50 border-b border-gray-200 bg-[#fff159]/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center gap-3 text-left"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 text-[#fff159] dark:bg-white dark:text-zinc-900">
                <i className="fas fa-calendar-check text-lg"></i>
              </div>
              <div>
                <p className="text-lg font-black leading-none text-gray-900 dark:text-white">
                  Pase Libre
                </p>
                <p className="hidden text-[12px] font-medium text-gray-600 sm:block dark:text-zinc-400">
                  Tu evento listo para compartir
                </p>
              </div>
            </button>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setIsDark((prev) => !prev)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-gray-700 transition hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"
                title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              >
                <i
                  className={`fas ${
                    isDark ? 'fa-sun text-amber-400' : 'fa-moon text-indigo-600'
                  } text-lg`}
                ></i>
              </button>

              <button
                type="button"
                onClick={() => scrollToAuth('login')}
                className="px-3 py-2 text-[13px] font-bold text-gray-700 transition hover:text-blue-600 dark:text-zinc-300 dark:hover:text-blue-400 sm:text-sm"
              >
                Ingresar
              </button>

              <button
                type="button"
                onClick={() => scrollToAuth('register')}
                className="rounded-xl bg-[#3483fa] px-4 py-2.5 text-[13px] font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#2968c8] sm:px-5 sm:text-sm"
              >
                Empezar gratis
              </button>
            </div>
          </div>
        </header>

        <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-7">
              <motion.section
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                className="overflow-hidden rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8 lg:p-10"
              >
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                  <span className="h-2 w-2 rounded-full bg-[#3483fa]"></span>
                  Hecho para circular
                </div>

                <h1 className="mt-5 max-w-3xl text-[2.3rem] font-black leading-[1.02] tracking-tight text-gray-900 dark:text-white sm:text-5xl lg:text-6xl">
                  Creá tu evento y compartilo en un solo link.
                </h1>

                <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-gray-600 dark:text-zinc-400 sm:text-xl">
                  Fecha, lugar, horario, contacto, confirmación, reserva o pago:
                  todo claro para tus invitados, sin explicar lo mismo por chat una y otra vez.
                </p>

                <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {heroBullets.map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                        <i className="fas fa-check text-[10px]"></i>
                      </div>
                      <p className="text-[15px] font-medium text-gray-700 dark:text-zinc-300">
                        {item}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  {useCases.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-[12px] font-bold text-gray-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
                    >
                      {item}
                    </span>
                  ))}
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => scrollToAuth('register')}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#3483fa] px-5 py-4 text-[15px] font-black text-white shadow-[0_10px_24px_rgba(52,131,250,0.24)] transition-all hover:-translate-y-0.5 hover:bg-blue-600"
                  >
                    Empezar gratis
                    <i className="fas fa-arrow-right text-[12px]"></i>
                  </button>

                  <button
                    type="button"
                    onClick={() => authRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 text-[15px] font-black text-gray-800 transition hover:border-gray-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                  >
                    Ver cómo funciona
                  </button>
                </div>

                <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-gray-500 dark:text-zinc-500">
                      Sin instalar nada
                    </p>
                    <p className="mt-2 text-[15px] font-bold text-gray-900 dark:text-white">
                      Tus invitados entran directo desde el link
                    </p>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-gray-500 dark:text-zinc-500">
                      Fácil de compartir
                    </p>
                    <p className="mt-2 text-[15px] font-bold text-gray-900 dark:text-white">
                      WhatsApp, Instagram o redes
                    </p>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-gray-500 dark:text-zinc-500">
                      Claro desde el inicio
                    </p>
                    <p className="mt-2 text-[15px] font-bold text-gray-900 dark:text-white">
                      Menos dudas, más conversiones
                    </p>
                  </div>
                </div>
              </motion.section>
            </div>

            <aside ref={authRef} className="lg:col-span-5">
              <div className="lg:sticky lg:top-24">
                <motion.div
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-7"
                >
                  <div className="mb-5 rounded-2xl bg-[#ebebeb] p-1 dark:bg-zinc-950">
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() => setIsLogin(false)}
                        className={`rounded-xl py-3 text-[14px] font-black transition ${
                          !isLogin
                            ? 'bg-white text-gray-900 shadow-sm dark:bg-zinc-800 dark:text-white'
                            : 'text-gray-500 hover:text-gray-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                        }`}
                      >
                        Crear cuenta
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsLogin(true)}
                        className={`rounded-xl py-3 text-[14px] font-black transition ${
                          isLogin
                            ? 'bg-white text-gray-900 shadow-sm dark:bg-zinc-800 dark:text-white'
                            : 'text-gray-500 hover:text-gray-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                        }`}
                      >
                        Ingresar
                      </button>
                    </div>
                  </div>

                  <div className="mb-5">
                    <h2 className="text-[28px] font-black leading-[1.02] text-gray-900 dark:text-white">
                      {isLogin ? 'Entrá a tu cuenta' : 'Creá tu cuenta gratis'}
                    </h2>
                    <p className="mt-2 text-[15px] leading-relaxed text-gray-600 dark:text-zinc-400">
                      {isLogin
                        ? 'Volvé a tus eventos, links y respuestas en un solo lugar.'
                        : 'Empezá ahora y dejá tu primer evento listo para compartir.'}
                    </p>
                  </div>

                  <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-500/20 dark:bg-blue-500/10">
                    <div className="flex items-start gap-3">
                      <i className="fas fa-info-circle mt-0.5 text-blue-600 dark:text-blue-300"></i>
                      <p className="text-[13px] leading-relaxed text-blue-900 dark:text-blue-200">
                        <b>¿Te sumaron a un evento?</b> Si vas a ayudar con ventas, recepción
                        o acceso, no hace falta que crees una cuenta nueva. Entrá con el correo
                        y la contraseña que te compartieron.
                      </p>
                    </div>
                  </div>

                  {isLogin ? (
                    <form onSubmit={handleLoginSubmit} className="space-y-4">
                      <div>
                        <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                          Correo electrónico
                        </label>
                        <input
                          type="email"
                          placeholder="tu@correo.com"
                          value={loginForm.email}
                          onChange={(e) =>
                            setLoginForm({ ...loginForm, email: e.target.value })
                          }
                          className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3.5 text-[15px] font-medium text-gray-900 outline-none transition-all focus:border-[#3483fa] focus:ring-4 focus:ring-[#3483fa]/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                          required
                        />
                      </div>

                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <label className="block text-xs font-black uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                            Contraseña
                          </label>

                          <button
                            type="button"
                            onClick={() => navigate('/reset-password')}
                            className="text-[13px] font-bold text-blue-600 hover:underline dark:text-blue-400"
                          >
                            ¿Olvidaste tu clave?
                          </button>
                        </div>

                        <div className="relative">
                          <input
                            type={showLoginPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={loginForm.password}
                            onChange={(e) =>
                              setLoginForm({
                                ...loginForm,
                                password: e.target.value,
                              })
                            }
                            className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3.5 pr-12 text-[15px] font-medium text-gray-900 outline-none transition-all focus:border-[#3483fa] focus:ring-4 focus:ring-[#3483fa]/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                            required
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShowLoginPassword(!showLoginPassword)
                            }
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600 dark:hover:text-zinc-300"
                          >
                            <i
                              className={`fas ${
                                showLoginPassword ? 'fa-eye-slash' : 'fa-eye'
                              } text-lg`}
                            ></i>
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading || googleLoading}
                        className="w-full rounded-2xl bg-[#3483fa] py-3.5 text-[15px] font-black text-white transition-all hover:bg-[#2968c8] disabled:opacity-60 active:scale-[0.98]"
                      >
                        {loading ? 'Ingresando...' : 'Entrar'}
                      </button>

                      <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-200 dark:border-zinc-800"></div>
                        </div>
                        <div className="relative flex justify-center">
                          <span className="bg-white px-4 text-[11px] font-black uppercase tracking-[0.16em] text-gray-400 dark:bg-zinc-900 dark:text-zinc-500">
                            o seguí con
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={loading || googleLoading}
                        className="flex w-full items-center justify-center gap-3 rounded-2xl border border-gray-300 bg-white py-3.5 text-[15px] font-black text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        <svg viewBox="0 0 24 24" width="20" height="20">
                          <path
                            fill="#EA4335"
                            d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.3 14.7 2.4 12 2.4 6.8 2.4 2.6 6.6 2.6 11.8S6.8 21.2 12 21.2c6.9 0 9.1-4.8 9.1-7.3 0-.5-.1-.9-.1-1.3H12z"
                          />
                          <path
                            fill="#34A853"
                            d="M3.7 7.2l3.2 2.3C7.7 7.6 9.7 6 12 6c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.3 14.7 2.4 12 2.4c-3.6 0-6.7 2.1-8.3 4.8z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M12 21.2c2.6 0 4.8-.9 6.5-2.5l-3-2.5c-.8.6-1.9 1-3.5 1-3.9 0-5.2-2.6-5.5-3.9l-3.2 2.5c1.6 3 4.7 5.4 8.7 5.4z"
                          />
                          <path
                            fill="#4285F4"
                            d="M21.1 13.9c0-.5-.1-.9-.1-1.3H12v3.9h5.5c-.3 1.3-1.5 3.1-3.5 3.7l3 2.5c1.8-1.7 4.1-4.8 4.1-8.8z"
                          />
                        </svg>
                        Continuar con Google
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleRegisterSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                            Nombre
                          </label>
                          <input
                            type="text"
                            value={registerForm.firstName}
                            onChange={(e) =>
                              setRegisterForm({
                                ...registerForm,
                                firstName: e.target.value,
                              })
                            }
                            className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3.5 text-[15px] font-medium text-gray-900 outline-none transition-all focus:border-[#3483fa] focus:ring-4 focus:ring-[#3483fa]/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                            required
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                            Apellido
                          </label>
                          <input
                            type="text"
                            value={registerForm.lastName}
                            onChange={(e) =>
                              setRegisterForm({
                                ...registerForm,
                                lastName: e.target.value,
                              })
                            }
                            className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3.5 text-[15px] font-medium text-gray-900 outline-none transition-all focus:border-[#3483fa] focus:ring-4 focus:ring-[#3483fa]/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                          Correo electrónico
                        </label>
                        <input
                          type="email"
                          placeholder="tu@correo.com"
                          value={registerForm.email}
                          onChange={(e) =>
                            setRegisterForm({
                              ...registerForm,
                              email: e.target.value,
                            })
                          }
                          className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3.5 text-[15px] font-medium text-gray-900 outline-none transition-all focus:border-[#3483fa] focus:ring-4 focus:ring-[#3483fa]/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                          required
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                          Contraseña
                        </label>
                        <div className="relative">
                          <input
                            type={showRegisterPassword ? 'text' : 'password'}
                            value={registerForm.password}
                            onChange={(e) =>
                              setRegisterForm({
                                ...registerForm,
                                password: e.target.value,
                              })
                            }
                            className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3.5 pr-12 text-[15px] font-medium text-gray-900 outline-none transition-all focus:border-[#3483fa] focus:ring-4 focus:ring-[#3483fa]/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                            required
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShowRegisterPassword(!showRegisterPassword)
                            }
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600 dark:hover:text-zinc-300"
                          >
                            <i
                              className={`fas ${
                                showRegisterPassword ? 'fa-eye-slash' : 'fa-eye'
                              } text-lg`}
                            ></i>
                          </button>
                        </div>

                        <div className="mt-2">
                          <PasswordStrength password={registerForm.password} />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                          Repetir contraseña
                        </label>
                        <div className="relative">
                          <input
                            type={
                              showRegisterConfirmPassword ? 'text' : 'password'
                            }
                            value={registerForm.confirmPassword}
                            onChange={(e) =>
                              setRegisterForm({
                                ...registerForm,
                                confirmPassword: e.target.value,
                              })
                            }
                            className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3.5 pr-12 text-[15px] font-medium text-gray-900 outline-none transition-all focus:border-[#3483fa] focus:ring-4 focus:ring-[#3483fa]/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                            required
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShowRegisterConfirmPassword(
                                !showRegisterConfirmPassword,
                              )
                            }
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600 dark:hover:text-zinc-300"
                          >
                            <i
                              className={`fas ${
                                showRegisterConfirmPassword
                                  ? 'fa-eye-slash'
                                  : 'fa-eye'
                              } text-lg`}
                            ></i>
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading || googleLoading}
                        className="w-full rounded-2xl bg-[#3483fa] py-3.5 text-[15px] font-black text-white transition-all hover:bg-[#2968c8] disabled:opacity-60 active:scale-[0.98]"
                      >
                        {loading ? 'Preparando todo...' : 'Crear mi cuenta gratis'}
                      </button>
                    </form>
                  )}
                </motion.div>
              </div>
            </aside>
          </div>

          <section className="mt-8 rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-black text-gray-900 dark:text-white sm:text-3xl">
                Así se ve en la práctica
              </h2>
              <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-gray-600 dark:text-zinc-400">
                Diseñamos una experiencia en la que nadie tiene que preguntar cómo se usa. Mientras más claro se ve, más rápido confirman tus invitados.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {guestFlowCards.map((item) => (
                <GuestFlowCard key={item.title} {...item} />
              ))}
            </div>
          </section>

          <section className="mt-8 rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-black text-gray-900 dark:text-white sm:text-3xl">
                Hecho para que todos sepan qué hacer
              </h2>
              <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-gray-600 dark:text-zinc-400">
                Vos organizás mejor, tu equipo vende más rápido y la recepción en puerta fluye sin problemas.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {roleCards.map((item) => (
                <RoleCard key={item.title} {...item} />
              ))}
            </div>
          </section>

          <section className="mt-8 rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
            <div className="mb-6 flex items-center gap-4">
              <h2 className="text-2xl font-black text-gray-900 dark:text-white sm:text-3xl">
                Así de simple
              </h2>
              <div className="h-px flex-1 rounded-full bg-gray-200 dark:bg-zinc-800"></div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {quickSteps.map((item) => (
                <StepCard key={item.number} {...item} />
              ))}
            </div>
          </section>

          <section className="mt-8 overflow-hidden rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white sm:text-3xl">
                  Lo que cambia cuando usás Pase Libre
                </h2>
                <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-gray-600 dark:text-zinc-400">
                  Olvidate del caos de los mensajes perdidos y las capturas de pantalla. Centralizá todo y dedícate a disfrutar del evento.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setActiveImpact((prev) =>
                      prev === 0 ? impactSlides.length - 1 : prev - 1,
                    )
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                  aria-label="Slide anterior"
                >
                  <i className="fas fa-arrow-left text-sm"></i>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setActiveImpact((prev) => (prev + 1) % impactSlides.length)
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                  aria-label="Slide siguiente"
                >
                  <i className="fas fa-arrow-right text-sm"></i>
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeImpact}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.25 }}
                className="grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr_0.8fr]"
              >
                <div className="rounded-[24px] border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 dark:border-blue-500/20 dark:from-blue-500/10 dark:to-indigo-500/10">
                  <div className="inline-flex rounded-full border border-blue-100 bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-blue-700 dark:border-blue-500/20 dark:bg-zinc-900 dark:text-blue-300">
                    {currentImpact.badge}
                  </div>

                  <h3 className="mt-4 text-2xl font-black leading-tight text-gray-900 dark:text-white">
                    {currentImpact.title}
                  </h3>

                  <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-gray-700 dark:text-zinc-300">
                    {currentImpact.text}
                  </p>

                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {currentImpact.bullets.map((bullet) => (
                      <div
                        key={bullet}
                        className="rounded-2xl bg-white px-4 py-3 text-[14px] font-bold text-gray-700 shadow-sm dark:bg-zinc-900 dark:text-zinc-200"
                      >
                        {bullet}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-gray-100 bg-gray-50 p-5 dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3483fa] text-white">
                      <i className="fas fa-link text-sm"></i>
                    </div>
                    <div>
                      <p className="text-[13px] font-black text-gray-900 dark:text-white">
                        Un producto que se entiende solo
                      </p>
                      <p className="text-[12px] text-gray-500 dark:text-zinc-400">
                        Más claro = mayores conversiones
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-2xl bg-white p-4 dark:bg-zinc-900">
                      <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">
                        Antes
                      </p>
                      <p className="mt-1 text-[14px] leading-relaxed text-gray-700 dark:text-zinc-300">
                        Flyers confusos, capturas de transferencias y respuestas sueltas por todos lados.
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white p-4 dark:bg-zinc-900">
                      <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">
                        Después
                      </p>
                      <p className="mt-1 text-[14px] leading-relaxed text-gray-700 dark:text-zinc-300">
                        Un solo link profesional, rápido de reenviar y con todo integrado.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-3 text-[13px] leading-relaxed text-gray-500 dark:border-zinc-700 dark:text-zinc-400">
                      <strong>"Pase Libre nos ahorró horas de trabajo administrativo y logístico. Todo el evento estuvo unificado y fluyó perfecto."</strong><br/>
                      — Organizador frecuente.
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="mt-5 flex items-center justify-center gap-2">
              {impactSlides.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  aria-label={`Ir al slide ${index + 1}`}
                  onClick={() => setActiveImpact(index)}
                  className={`h-2.5 rounded-full transition-all ${
                    activeImpact === index
                      ? 'w-8 bg-[#3483fa]'
                      : 'w-2.5 bg-gray-300 dark:bg-zinc-700'
                  }`}
                />
              ))}
            </div>
          </section>

          <section className="mt-8 rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
            <h2 className="text-2xl font-black text-gray-900 dark:text-white sm:text-3xl">
              Preguntas frecuentes
            </h2>

            <div className="mt-6 space-y-3">
              {faqs.map((item, index) => {
                const isOpen = openFaq === index;

                return (
                  <div
                    key={item.q}
                    className="overflow-hidden rounded-2xl border border-gray-200 dark:border-zinc-800"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : index)}
                      className="flex w-full items-center justify-between bg-white p-5 text-left dark:bg-zinc-900"
                    >
                      <span className="pr-4 text-[15px] font-black text-gray-900 dark:text-white sm:text-base">
                        {item.q}
                      </span>

                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${
                          isOpen
                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'
                            : 'bg-gray-100 text-gray-400 dark:bg-zinc-800 dark:text-zinc-500'
                        }`}
                      >
                        <i
                          className={`fas fa-chevron-down text-sm transition-transform ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        ></i>
                      </div>
                    </button>

                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                        >
                          <div className="bg-white px-5 pb-5 text-[15px] leading-relaxed text-gray-600 dark:bg-zinc-900 dark:text-zinc-400">
                            {item.a}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </section>
        </section>

        <footer className="mt-10 border-t border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-md">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 text-white dark:bg-white dark:text-gray-900">
                    <i className="fas fa-calendar-check text-lg"></i>
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 dark:text-white">
                    Pase Libre
                  </h3>
                </div>

                <p className="mt-4 text-[15px] leading-relaxed text-gray-600 dark:text-zinc-400">
                  Un link claro para compartir tu evento, ordenar respuestas y potenciar tus ingresos con una experiencia superior.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                <div>
                  <p className="mb-4 text-sm font-black uppercase tracking-[0.14em] text-gray-900 dark:text-white">
                    Plataforma
                  </p>
                  <div className="space-y-3 text-[15px]">
                    <button
                      onClick={() => scrollToAuth('register')}
                      className="block text-left text-gray-600 transition hover:text-[#3483fa] dark:text-zinc-400"
                    >
                      Empezar gratis
                    </button>
                    <button
                      onClick={() => scrollToAuth('login')}
                      className="block text-left text-gray-600 transition hover:text-[#3483fa] dark:text-zinc-400"
                    >
                      Ingresar
                    </button>
                  </div>
                </div>

                <div>
                  <p className="mb-4 text-sm font-black uppercase tracking-[0.14em] text-gray-900 dark:text-white">
                    Legales
                  </p>
                  <div className="space-y-3 text-[15px]">
                    <a
                      href="#"
                      className="block text-gray-600 transition hover:text-[#3483fa] dark:text-zinc-400"
                    >
                      Términos y condiciones
                    </a>
                    <a
                      href="#"
                      className="block text-gray-600 transition hover:text-[#3483fa] dark:text-zinc-400"
                    >
                      Política de privacidad
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-10 border-t border-gray-200 pt-6 text-sm text-gray-500 dark:border-zinc-800 dark:text-zinc-500">
              © {new Date().getFullYear()} Pase Libre. Todos los derechos reservados.
            </div>
          </div>
        </footer>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95 lg:hidden">
          <button
            type="button"
            onClick={() => scrollToAuth('register')}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#3483fa] py-3.5 text-[15px] font-black text-white shadow-[0_8px_20px_rgba(52,131,250,0.25)]"
          >
            Empezar gratis
            <i className="fas fa-arrow-right text-[12px]"></i>
          </button>
        </div>
      </main>
    </>
  );
}