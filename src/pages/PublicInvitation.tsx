import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import InvitationRenderer from '../components/invitation-editor/InvitationRenderer';
import type { InvitationDesign } from '../components/invitation-editor/types';
import { getPublicInvitation, submitPublicInvitationRsvp } from '../services/invitation.service';
import type { WorkspaceCompanion } from '../services/invitation.service';

type RsvpFormState = {
  name: string;
  email: string;
  phone: string;
  gender: 'female' | 'male' | 'other';
  food: string;
  age: string;
  ageGroup: 'child' | 'adult' | 'senior';
  confirmCompanions: boolean;
  companionsData: WorkspaceCompanion[];
};

const initialRsvpForm: RsvpFormState = {
  name: '',
  email: '',
  phone: '',
  gender: 'other',
  food: 'Sin restriccion',
  age: '',
  ageGroup: 'adult',
  confirmCompanions: false,
  companionsData: [],
};

export default function PublicInvitation() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const [design, setDesign] = useState<InvitationDesign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [width, setWidth] = useState(() => Math.min(typeof window === 'undefined' ? 420 : window.innerWidth, 1080));
  const [rsvpConfirmed, setRsvpConfirmed] = useState(false);
  const [rsvpForm, setRsvpForm] = useState<RsvpFormState>(initialRsvpForm);

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
      void Swal.fire('Falta el email', 'Completa el email del invitado para confirmar la asistencia.', 'warning');
      return false;
    }

    try {
      const guest = await submitPublicInvitationRsvp(slug || '', {
        guestToken: guestToken || undefined,
        name: normalizedName,
        email: normalizedEmail,
        phone: normalizedPhone,
        gender: rsvpForm.gender,
        food: rsvpForm.food,
        age: rsvpForm.age ? Number(rsvpForm.age) : null,
        ageGroup: rsvpForm.ageGroup,
        confirmCompanions: rsvpForm.confirmCompanions,
        companionsData: rsvpForm.confirmCompanions ? rsvpForm.companionsData : [],
      });

      setRsvpForm({
        ...rsvpForm,
        name: guest?.name || normalizedName,
        email: guest?.email || normalizedEmail,
        phone: guest?.phone === '-' ? '' : guest?.phone || normalizedPhone,
        gender: guest?.gender || rsvpForm.gender,
        food: guest?.food || rsvpForm.food,
        age: guest?.age ? String(guest.age) : rsvpForm.age,
        ageGroup: guest?.ageGroup || rsvpForm.ageGroup,
        companionsData: guest?.companionsData || rsvpForm.companionsData,
      });

      setRsvpConfirmed(true);
      const pendingReview = guest?.reviewStatus === 'pending_review';
      void Swal.fire(
        pendingReview ? 'Solicitud enviada' : 'Asistencia confirmada',
        pendingReview
          ? 'Te agregaste a la lista y tu asistencia queda pendiente de aprobacion del organizador.'
          : 'El invitado ya quedo marcado como confirmado.',
        pendingReview ? 'info' : 'success',
      );
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

  const updateCompanion = (id: string, patch: Partial<WorkspaceCompanion>) => {
    setRsvpForm((current) => ({
      ...current,
      companionsData: current.companionsData.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const addCompanion = () => {
    setRsvpForm((current) => ({
      ...current,
      confirmCompanions: true,
      companionsData: [
        ...current.companionsData,
        {
          id: `comp-${Date.now()}-${current.companionsData.length}`,
          name: '',
          gender: 'other',
          food: 'Sin restriccion',
          age: null,
          ageGroup: 'adult',
        },
      ],
    }));
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <InvitationRenderer
        design={design}
        width={width}
        rsvpConfirmed={rsvpConfirmed}
        onConfirmRsvp={() => confirmGuestAttendance(design)}
        rsvpForm={rsvpForm}
        onRsvpFormChange={(patch) => setRsvpForm((current) => ({ ...current, ...patch }))}
      />
      {!rsvpConfirmed ? (
        <section className="mx-auto my-6 max-w-2xl rounded-3xl border border-slate-200 bg-white p-5 shadow-xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Preferencias para confirmar</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <select value={rsvpForm.gender} onChange={(event) => setRsvpForm((current) => ({ ...current, gender: event.target.value as RsvpFormState['gender'] }))} className="rounded-2xl border border-slate-200 px-4 py-3 font-bold text-slate-700">
              <option value="female">Mujer</option>
              <option value="male">Hombre</option>
              <option value="other">Otro</option>
            </select>
            <select value={rsvpForm.ageGroup} onChange={(event) => setRsvpForm((current) => ({ ...current, ageGroup: event.target.value as RsvpFormState['ageGroup'] }))} className="rounded-2xl border border-slate-200 px-4 py-3 font-bold text-slate-700">
              <option value="child">Niño</option>
              <option value="adult">Adulto</option>
              <option value="senior">Mayor</option>
            </select>
            <input value={rsvpForm.age} onChange={(event) => setRsvpForm((current) => ({ ...current, age: event.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Edad opcional" />
            <input value={rsvpForm.food} onChange={(event) => setRsvpForm((current) => ({ ...current, food: event.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Preferencia de comida" />
          </div>

          <label className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-700">
            <input type="checkbox" checked={rsvpForm.confirmCompanions} onChange={(event) => setRsvpForm((current) => ({ ...current, confirmCompanions: event.target.checked }))} />
            Confirmo tambien a mis acompañantes
          </label>

          {rsvpForm.confirmCompanions ? (
            <div className="mt-4 grid gap-3">
              {rsvpForm.companionsData.map((companion, index) => (
                <div key={companion.id} className="grid gap-2 rounded-2xl border border-slate-200 p-3 md:grid-cols-2">
                  <input value={companion.name} onChange={(event) => updateCompanion(companion.id, { name: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2" placeholder={`Acompañante ${index + 1}`} />
                  <input value={companion.food} onChange={(event) => updateCompanion(companion.id, { food: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2" placeholder="Comida / restriccion" />
                  <select value={companion.gender} onChange={(event) => updateCompanion(companion.id, { gender: event.target.value as WorkspaceCompanion['gender'] })} className="rounded-xl border border-slate-200 px-3 py-2">
                    <option value="female">Mujer</option>
                    <option value="male">Hombre</option>
                    <option value="other">Otro</option>
                  </select>
                  <select value={companion.ageGroup} onChange={(event) => updateCompanion(companion.id, { ageGroup: event.target.value as WorkspaceCompanion['ageGroup'] })} className="rounded-xl border border-slate-200 px-3 py-2">
                    <option value="child">Niño</option>
                    <option value="adult">Adulto</option>
                    <option value="senior">Mayor</option>
                  </select>
                </div>
              ))}
              <button type="button" onClick={addCompanion} className="rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm font-black text-slate-700">
                Agregar acompañante
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
