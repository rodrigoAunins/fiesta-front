import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

const suggestions = [
  'Casamiento',
  '15 anos',
  'Fiesta de egresados',
  'Baby shower',
  'Cena de fin de ano',
  'Evento corporativo',
];

type Step = 1 | 2 | 3;

function toast(title: string) {
  void Swal.fire({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 1800,
    timerProgressBar: true,
    icon: 'success',
    title,
    background: '#180816',
    color: '#fff',
  });
}

export default function EventOnboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [eventType, setEventType] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [venue, setVenue] = useState('');
  const [guestEstimate, setGuestEstimate] = useState('120');

  const canGoStep2 = useMemo(() => eventType.trim().length > 2, [eventType]);
  const canGoStep3 = useMemo(
    () => eventName.trim().length > 2 && venue.trim().length > 2,
    [eventName, venue],
  );

  const progress = step === 1 ? 33 : step === 2 ? 66 : 100;

  const persistAndContinue = () => {
    const payload = {
      type: eventType.trim(),
      name: eventName.trim() || `${eventType.trim()} especial`,
      date: eventDate,
      venue: venue.trim() || 'Salon a definir',
      guestEstimate: guestEstimate.trim() || '120',
    };

    localStorage.setItem('rt_event_info', JSON.stringify(payload));
    toast('Evento inicial configurado');
    navigate('/workspace/demo');
  };

  return (
    <main className="event-onboarding min-h-screen bg-[#100311] text-white">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,84,163,.16),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,.18),transparent_28%),linear-gradient(180deg,#100311,#180816)]" />

      <header className="relative mx-auto flex h-24 max-w-7xl items-center justify-between px-5 lg:px-8">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-2xl font-black tracking-[0.22em] text-transparent bg-gradient-to-r from-orange-300 via-pink-300 to-violet-300 bg-clip-text"
        >
          MI FIESTA
        </button>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="rounded-[18px] border border-pink-400/25 px-5 py-3 text-sm font-black"
        >
          Volver
        </button>
      </header>

      <section className="relative mx-auto max-w-6xl px-5 py-6 lg:px-8 lg:py-10">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_.9fr] lg:items-start">
          <div>
            <div className="max-w-xl">
              <p className="text-[11px] uppercase tracking-[0.28em] text-pink-100/46">Onboarding guiado</p>
              <h1 className="mt-4 text-4xl font-black leading-tight lg:text-6xl">
                Crea el evento con un flujo que te orienta desde el primer minuto
              </h1>
              <p className="mt-5 text-sm leading-7 text-pink-100/68">
                Este alta ya no queda vacia. Define el tipo, los datos base y una vista previa
                antes de entrar al panel operativo.
              </p>
            </div>

            <div className="mt-8 max-w-2xl rounded-[30px] border border-pink-400/16 bg-white/[0.04] p-5 lg:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-pink-100/55">
                    Paso {step} de 3
                  </p>
                  <p className="mt-1 text-sm text-pink-100/65">
                    {step === 1 ? 'Tipo de evento' : step === 2 ? 'Datos base' : 'Resumen inicial'}
                  </p>
                </div>
                <div className="w-40 rounded-full bg-white/10 p-1">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="mt-6 flex items-start gap-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="flex flex-1 items-center gap-3">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-black ${
                        step >= item
                          ? 'bg-gradient-to-r from-pink-500 to-violet-500 text-white'
                          : 'bg-white/5 text-pink-200'
                      }`}
                    >
                      {item}
                    </span>
                    {item < 3 ? <span className="h-px flex-1 bg-pink-400/18" /> : null}
                  </div>
                ))}
              </div>

              <motion.div
                key={step}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-8"
              >
                {step === 1 ? (
                  <div>
                    <h2 className="text-2xl font-black">Que tipo de evento vas a organizar?</h2>
                    <p className="mt-3 text-sm leading-7 text-pink-100/65">
                      Esto define el tono inicial del workspace y de la invitacion.
                    </p>

                    <textarea
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value)}
                      maxLength={200}
                      className="mt-5 min-h-36 w-full rounded-[24px] border border-pink-400/22 bg-black/22 p-5 text-lg text-white outline-none focus:border-pink-300"
                      placeholder="Ej: Fiesta de egresados, baby shower, 15 anos, evento corporativo..."
                    />

                    <div className="mt-4 flex flex-wrap gap-2">
                      {suggestions.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setEventType(item)}
                          className="rounded-full border border-pink-400/22 bg-white/[0.035] px-4 py-2 text-sm font-black text-pink-100"
                        >
                          {item}
                        </button>
                      ))}
                    </div>

                    <div className="mt-6 flex justify-end">
                      <button
                        type="button"
                        disabled={!canGoStep2}
                        onClick={() => setStep(2)}
                        className="rounded-[18px] bg-gradient-to-r from-pink-500 to-violet-500 px-6 py-3 text-sm font-black text-white disabled:opacity-45"
                      >
                        Continuar
                      </button>
                    </div>
                  </div>
                ) : null}

                {step === 2 ? (
                  <div>
                    <h2 className="text-2xl font-black">Carga los datos base del evento</h2>
                    <p className="mt-3 text-sm leading-7 text-pink-100/65">
                      Con estos datos te armamos un espacio de trabajo mas listo para usar.
                    </p>

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      <input
                        value={eventName}
                        onChange={(e) => setEventName(e.target.value)}
                        className="rounded-[20px] border border-pink-400/22 bg-black/22 px-5 py-4 text-white outline-none focus:border-pink-300"
                        placeholder="Nombre del evento"
                      />
                      <input
                        type="date"
                        value={eventDate}
                        onChange={(e) => setEventDate(e.target.value)}
                        className="rounded-[20px] border border-pink-400/22 bg-black/22 px-5 py-4 text-white outline-none focus:border-pink-300"
                      />
                      <input
                        value={venue}
                        onChange={(e) => setVenue(e.target.value)}
                        className="rounded-[20px] border border-pink-400/22 bg-black/22 px-5 py-4 text-white outline-none focus:border-pink-300 md:col-span-2"
                        placeholder="Salon, quinta, club o lugar del evento"
                      />
                      <input
                        value={guestEstimate}
                        onChange={(e) => setGuestEstimate(e.target.value)}
                        className="rounded-[20px] border border-pink-400/22 bg-black/22 px-5 py-4 text-white outline-none focus:border-pink-300"
                        placeholder="Invitados estimados"
                      />
                    </div>

                    <div className="mt-6 flex justify-between">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="rounded-[18px] border border-pink-400/25 px-6 py-3 text-sm font-black text-pink-50"
                      >
                        Atras
                      </button>
                      <button
                        type="button"
                        disabled={!canGoStep3}
                        onClick={() => setStep(3)}
                        className="rounded-[18px] bg-gradient-to-r from-pink-500 to-violet-500 px-6 py-3 text-sm font-black text-white disabled:opacity-45"
                      >
                        Ver resumen
                      </button>
                    </div>
                  </div>
                ) : null}

                {step === 3 ? (
                  <div>
                    <h2 className="text-2xl font-black">Listo para entrar al workspace</h2>
                    <p className="mt-3 text-sm leading-7 text-pink-100/65">
                      Este resumen te confirma con que base vas a arrancar el panel.
                    </p>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      {[
                        ['Tipo', eventType || '-'],
                        ['Nombre', eventName || '-'],
                        ['Fecha', eventDate || 'Sin definir'],
                        ['Venue', venue || 'Sin definir'],
                        ['Invitados estimados', guestEstimate || '120'],
                        ['Proximo paso', 'Entrar a invitados, web y plano'],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-[22px] border border-pink-400/18 bg-white/[0.04] p-4">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-pink-100/48">{label}</p>
                          <p className="mt-2 text-base font-black text-white">{value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 flex justify-between">
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="rounded-[18px] border border-pink-400/25 px-6 py-3 text-sm font-black text-pink-50"
                      >
                        Atras
                      </button>
                      <button
                        type="button"
                        onClick={persistAndContinue}
                        className="rounded-[20px] bg-gradient-to-r from-pink-500 to-violet-500 px-8 py-4 text-sm font-black text-white shadow-[0_18px_46px_rgba(217,70,239,.25)]"
                      >
                        Crear panel de gestion
                      </button>
                    </div>
                  </div>
                ) : null}
              </motion.div>
            </div>
          </div>

          <aside className="rounded-[34px] border border-pink-400/16 bg-[radial-gradient(circle_at_top,rgba(251,113,133,.2),transparent_36%),rgba(255,255,255,.05)] p-6 lg:p-7">
            <p className="text-[11px] uppercase tracking-[0.24em] text-pink-100/48">Preview</p>
            <div className="mt-4 overflow-hidden rounded-[28px] border border-white/12 bg-white text-slate-900 shadow-[0_24px_50px_rgba(0,0,0,.22)]">
              <div className="border-b border-slate-200 px-4 py-3 text-xs text-slate-500">
                Invitacion inicial sugerida
              </div>
              <div className="bg-[linear-gradient(180deg,#fff7fb,#fff7ed)] p-6 text-center">
                <p className="text-sm uppercase tracking-[0.26em] text-rose-500">{eventType || 'Tu evento'}</p>
                <h3 className="mt-4 text-4xl font-black">{eventName || 'Nombre del evento'}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  {eventDate || 'Fecha a definir'} · {venue || 'Venue a definir'}
                </p>
                <div className="mt-6 rounded-[22px] bg-slate-900 px-5 py-4 text-sm font-black text-white">
                  Confirmar asistencia
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {[
                'El workspace se crea con datos base guardados.',
                'La invitacion ya arranca con estructura editable.',
                'Invitados, cronograma y plano quedan listos para continuar.',
              ].map((item) => (
                <div key={item} className="rounded-[18px] border border-pink-400/14 bg-black/18 px-4 py-3 text-sm leading-6 text-pink-50/80">
                  {item}
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
