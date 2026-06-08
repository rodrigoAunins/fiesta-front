import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import InvitationRenderer from '../components/invitation-editor/InvitationRenderer';
import type { InvitationDesign } from '../components/invitation-editor/types';
import { getPublicInvitation, submitPublicInvitationRsvp } from '../services/invitation.service';

export default function PublicInvitation() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const [design, setDesign] = useState<InvitationDesign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [width, setWidth] = useState(() => Math.min(typeof window === 'undefined' ? 420 : window.innerWidth, 1080));
  const [rsvpConfirmed, setRsvpConfirmed] = useState(false);
  const [rsvpForm, setRsvpForm] = useState({ name: '', email: '', phone: '' });

  const confirmGuestAttendance = async (nextDesign: InvitationDesign | null) => {
    const guestToken = searchParams.get('guest');
    const workspaceId = nextDesign?.metadata?.workspaceId;
    const normalizedName = rsvpForm.name.trim();
    const normalizedEmail = rsvpForm.email.trim().toLowerCase();
    const normalizedPhone = rsvpForm.phone.trim();

    if (!workspaceId) {
      void Swal.fire('No se pudo confirmar', 'Esta invitacion publica no esta vinculada correctamente al evento.', 'error');
      return false;
    }

    if (!normalizedEmail) {
      void Swal.fire('Falta el email', 'Completá el email del invitado para confirmar la asistencia.', 'warning');
      return false;
    }

    try {
      const guest = await submitPublicInvitationRsvp(slug || '', {
        guestToken: guestToken || undefined,
        name: normalizedName,
        email: normalizedEmail,
        phone: normalizedPhone,
      });

      setRsvpForm({
        name: guest?.name || normalizedName,
        email: guest?.email || normalizedEmail,
        phone: guest?.phone === '-' ? '' : guest?.phone || normalizedPhone,
      });
      setRsvpConfirmed(true);
      void Swal.fire('Asistencia confirmada', 'El invitado ya quedó marcado como confirmado.', 'success');
      return true;
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'No pudimos registrar la asistencia en este momento.';

      void Swal.fire('No se pudo confirmar', Array.isArray(message) ? message.join('\n') : String(message), 'error');
      return false;
    }
  };

  useEffect(() => {
    const onResize = () => setWidth(Math.min(window.innerWidth, 1080));
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(false);
    getPublicInvitation(slug)
      .then((nextDesign) => {
        if (nextDesign) setDesign(nextDesign);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-pink-500 font-bold">Cargando invitacion...</div>
      </div>
    );
  }

  if (error || !design) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-5 text-center">
        <i className="fas fa-link-slash mb-4 text-6xl text-slate-300" />
        <h1 className="text-2xl font-bold text-slate-700">Invitacion no encontrada</h1>
        <p className="mt-2 max-w-md text-slate-500">El enlace no existe, no esta publicado o el backend no devolvio la invitacion.</p>
      </div>
    );
  }

  return (
    <InvitationRenderer
      design={design}
      width={width}
      rsvpConfirmed={rsvpConfirmed}
      onConfirmRsvp={() => confirmGuestAttendance(design)}
      rsvpForm={rsvpForm}
      onRsvpFormChange={(patch) => setRsvpForm((current) => ({ ...current, ...patch }))}
    />
  );
}
