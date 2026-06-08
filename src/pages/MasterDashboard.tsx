import { useContext, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import {
  createGlobalCatalogItem,
  deleteGlobalCatalogItem,
  listGlobalCatalog,
  updateGlobalCatalogItem,
  type GlobalCatalogItem,
} from '../services/globalCatalog.service';

const roleOptions = [
  { value: 'organizer', label: 'Organizador' },
  { value: 'guest', label: 'Usuario final' },
  { value: 'seller', label: 'RRPP / ventas' },
  { value: 'door', label: 'Puerta / control' },
];

function getRoleLabel(role?: string | null) {
  const normalized = String(role || '').toLowerCase();
  if (normalized === 'master') return 'Master';
  if (normalized === 'organizer' || normalized === 'creator') return 'Organizador';
  if (normalized === 'guest') return 'Usuario final';
  if (normalized === 'seller') return 'Ventas';
  if (normalized === 'door') return 'Acceso';
  return 'Usuario';
}

function getRoleTone(role?: string | null) {
  const normalized = String(role || '').toLowerCase();
  if (normalized === 'organizer' || normalized === 'creator') return 'text-violet-200 bg-violet-500/10 border-violet-400/18';
  if (normalized === 'guest') return 'text-emerald-200 bg-emerald-500/10 border-emerald-400/18';
  if (normalized === 'seller') return 'text-amber-200 bg-amber-500/10 border-amber-400/18';
  if (normalized === 'door') return 'text-sky-200 bg-sky-500/10 border-sky-400/18';
  return 'text-pink-100 bg-white/5 border-pink-400/12';
}

type CatalogFormState = {
  kind: GlobalCatalogItem['kind'];
  name: string;
  category: string;
  description: string;
  phone: string;
  whatsapp: string;
  imageUrl: string;
  isActive: boolean;
  orderIndex: string;
};

const emptyCatalogForm: CatalogFormState = {
  kind: 'provider' as const,
  name: '',
  category: '',
  description: '',
  phone: '',
  whatsapp: '',
  imageUrl: '',
  isActive: true,
  orderIndex: '0',
};

export default function MasterDashboard() {
  const navigate = useNavigate();
  const { logout, user } = useContext(AuthContext);
  const normalizedUserRole = String(user?.role || '').toLowerCase();
  const defaultManagedRole = normalizedUserRole === 'organizer' ? 'guest' : 'organizer';
  const [users, setUsers] = useState<any[]>([]);
  const [raffles, setRaffles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRaffles, setLoadingRaffles] = useState(false);
  const [message, setMessage] = useState('');
  const [eventMessage, setEventMessage] = useState('');
  const [catalogItems, setCatalogItems] = useState<GlobalCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [catalogMessage, setCatalogMessage] = useState('');
  const [editingCatalogId, setEditingCatalogId] = useState<string | null>(null);
  const [catalogForm, setCatalogForm] = useState<CatalogFormState>(emptyCatalogForm);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: defaultManagedRole,
  });

  const organizerUsers = useMemo(
    () => users.filter((item) => ['organizer', 'creator'].includes(String(item?.role || '').toLowerCase())),
    [users],
  );

  const finalUsers = useMemo(
    () => users.filter((item) => String(item?.role || '').toLowerCase() === 'guest'),
    [users],
  );

  const eventOwners = useMemo(
    () => users.filter((item) => String(item?.role || '').toLowerCase() === 'guest'),
    [users],
  );

  const availableRoleOptions = useMemo(() => {
    if (normalizedUserRole === 'organizer') {
      return roleOptions.filter((item) => item.value !== 'organizer');
    }

    return roleOptions;
  }, [normalizedUserRole]);

  const activeRaffles = useMemo(
    () => raffles.filter((item) => String(item?.status || '').toLowerCase() !== 'finished'),
    [raffles],
  );
  const canManageGlobalCatalog = normalizedUserRole === 'master';
  const providerCatalog = useMemo(
    () => catalogItems.filter((item) => item.kind === 'provider'),
    [catalogItems],
  );
  const serviceCatalog = useMemo(
    () => catalogItems.filter((item) => item.kind === 'service'),
    [catalogItems],
  );

  const loadUsers = async () => {
    try {
      const { data } = await api.get('/admin/users');
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setUsers([]);
    }
  };

  const loadRaffles = async () => {
    try {
      setLoadingRaffles(true);
      const { data } = await api.get('/raffles/my-raffles');
      setRaffles(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setRaffles([]);
    } finally {
      setLoadingRaffles(false);
    }
  };

  const loadCatalog = async () => {
    try {
      setCatalogLoading(true);
      const data = await listGlobalCatalog();
      setCatalogItems(data);
    } catch (err) {
      console.error(err);
      setCatalogItems([]);
    } finally {
      setCatalogLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    loadRaffles();
    loadCatalog();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);

    try {
      await api.post('/admin/users', form);
      setMessage('Usuario creado correctamente.');
      setForm({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        role: defaultManagedRole,
      });
      await loadUsers();
    } catch (err: any) {
      setMessage(err?.response?.data?.message || 'No se pudo crear el usuario.');
    } finally {
      setLoading(false);
    }
  };

  const openCreateForUser = (targetUser?: any | null) => {
    const targetUserId = typeof targetUser === 'string' ? targetUser : targetUser?.id;
    const targetRole = String(typeof targetUser === 'string' ? '' : targetUser?.role || '').toLowerCase();
    const query =
      targetUserId && targetRole === 'guest'
        ? `?finalUserId=${encodeURIComponent(targetUserId)}`
        : targetUserId && ['organizer', 'creator'].includes(targetRole)
          ? `?organizerId=${encodeURIComponent(targetUserId)}`
          : '';
    navigate(`/create${query}`);
  };

  const formatOwnerLabel = (raffle: any) => {
    const creator = raffle?.creator;
    if (!creator) return 'Sin responsable visible';

    return (
      creator.fullName ||
      `${creator.firstName || ''} ${creator.lastName || ''}`.trim() ||
      creator.email ||
      'Sin responsable visible'
    );
  };

  const resetCatalogEditor = () => {
    setEditingCatalogId(null);
    setCatalogForm(emptyCatalogForm);
  };

  const handleCatalogSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setCatalogMessage('');
    setCatalogSaving(true);

    const payload = {
      kind: catalogForm.kind,
      name: catalogForm.name,
      category: catalogForm.category,
      description: catalogForm.description,
      phone: catalogForm.phone,
      whatsapp: catalogForm.whatsapp,
      imageUrl: catalogForm.imageUrl,
      isActive: catalogForm.isActive,
      orderIndex: Number(catalogForm.orderIndex || 0),
    };

    try {
      if (editingCatalogId) {
        await updateGlobalCatalogItem(editingCatalogId, payload);
        setCatalogMessage('Item actualizado correctamente.');
      } else {
        await createGlobalCatalogItem(payload);
        setCatalogMessage('Item creado correctamente.');
      }
      resetCatalogEditor();
      await loadCatalog();
    } catch (err: any) {
      setCatalogMessage(err?.response?.data?.message || 'No se pudo guardar el item del catálogo.');
    } finally {
      setCatalogSaving(false);
    }
  };

  const handleCatalogEdit = (item: GlobalCatalogItem) => {
    setEditingCatalogId(item.id);
    setCatalogForm({
      kind: item.kind,
      name: item.name || '',
      category: item.category || '',
      description: item.description || '',
      phone: item.phone || '',
      whatsapp: item.whatsapp || '',
      imageUrl: item.imageUrl || '',
      isActive: item.isActive,
      orderIndex: String(item.orderIndex || 0),
    });
  };

  const handleCatalogDelete = async (id: string) => {
    setCatalogMessage('');
    try {
      await deleteGlobalCatalogItem(id);
      if (editingCatalogId === id) {
        resetCatalogEditor();
      }
      setCatalogMessage('Item eliminado correctamente.');
      await loadCatalog();
    } catch (err: any) {
      setCatalogMessage(err?.response?.data?.message || 'No se pudo eliminar el item del catálogo.');
    }
  };

  return (
    <main className="min-h-screen bg-[#140717] px-5 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-pink-300">
              {user?.role === 'organizer' ? 'Panel organizador' : 'Usuario master'}
            </p>
            <h1 className="mt-2 text-4xl font-black">Usuarios, eventos y asignacion</h1>
            <p className="mt-2 max-w-2xl text-pink-100/70">
              Desde aca podes dar de alta usuarios, asignar eventos a organizadores o usuarios finales y mantener un esquema realmente multi-tenant.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => openCreateForUser(eventOwners[0] || null)}
              className="rounded-[18px] bg-white px-5 py-3 text-center text-sm font-black text-[#1d0b20]"
            >
              Crear evento
            </button>
            <button
              type="button"
              onClick={logout}
              className="rounded-[18px] border border-pink-400/22 px-5 py-3 text-center text-sm font-black text-pink-50"
            >
              Cerrar sesion
            </button>
          </div>
        </header>

        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-pink-400/18 bg-[#1d0b20] p-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-pink-100/55">Organizadores</p>
            <p className="mt-3 text-4xl font-black text-white">{organizerUsers.length}</p>
            <p className="mt-2 text-sm text-pink-100/68">Usuarios que pueden gestionar eventos completos.</p>
          </div>
          <div className="rounded-[24px] border border-pink-400/18 bg-[#1d0b20] p-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-pink-100/55">Usuarios finales</p>
            <p className="mt-3 text-4xl font-black text-white">{finalUsers.length}</p>
            <p className="mt-2 text-sm text-pink-100/68">Clientes dueños del evento, visibles para master y organizador.</p>
          </div>
          <div className="rounded-[24px] border border-pink-400/18 bg-[#1d0b20] p-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-pink-100/55">Eventos activos</p>
            <p className="mt-3 text-4xl font-black text-white">{activeRaffles.length}</p>
            <p className="mt-2 text-sm text-pink-100/68">Eventos que siguen operativos y necesitan seguimiento.</p>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <form onSubmit={submit} className="rounded-[28px] border border-pink-400/18 bg-[#1d0b20] p-5">
            <h2 className="text-2xl font-black">Crear usuario</h2>
            <p className="mt-2 text-sm leading-6 text-pink-100/68">
              {normalizedUserRole === 'organizer'
                ? 'Desde aca das de alta usuarios finales, RRPP o puerta para tus propios eventos.'
                : 'Podés crear organizadores, usuarios finales y equipo. Después les asignás un evento desde este mismo panel.'}
            </p>
            <div className="mt-5 grid gap-3">
              <input
                value={form.firstName}
                onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
                className="rounded-2xl border border-pink-400/18 bg-black/20 px-4 py-3 outline-none focus:border-pink-300"
                placeholder="Nombre"
              />
              <input
                value={form.lastName}
                onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
                className="rounded-2xl border border-pink-400/18 bg-black/20 px-4 py-3 outline-none focus:border-pink-300"
                placeholder="Apellido"
              />
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                className="rounded-2xl border border-pink-400/18 bg-black/20 px-4 py-3 outline-none focus:border-pink-300"
                placeholder="email@dominio.com"
              />
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                className="rounded-2xl border border-pink-400/18 bg-black/20 px-4 py-3 outline-none focus:border-pink-300"
                placeholder="ContraseÃ±a inicial"
              />
              <select
                value={form.role}
                onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                className="rounded-2xl border border-pink-400/18 bg-black/20 px-4 py-3 outline-none focus:border-pink-300"
              >
                {availableRoleOptions.map((role) => (
                  <option key={role.value} value={role.value} className="bg-[#1d0b20]">
                    {role.label}
                  </option>
                ))}
              </select>
              <button
                disabled={loading}
                className="rounded-2xl bg-gradient-to-r from-pink-500 to-violet-500 py-3 text-sm font-black disabled:opacity-60"
              >
                {loading ? 'Creando...' : 'Crear usuario'}
              </button>
            </div>
            {message ? <p className="mt-4 rounded-2xl border border-pink-400/18 bg-white/[0.04] p-3 text-sm font-bold">{message}</p> : null}
          </form>

          <div className="space-y-6">
            <section className="rounded-[28px] border border-pink-400/18 bg-[#1d0b20] p-5">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-black">Crear y asociar eventos</h2>
                  <p className="mt-2 text-sm leading-6 text-pink-100/68">
                    Elegí el responsable visible del evento. Puede ser un organizador o un usuario final, y el master u organizador asignador lo siguen pudiendo gestionar.
                  </p>
                </div>
                <button onClick={loadRaffles} className="rounded-2xl border border-pink-400/18 px-4 py-2 text-sm font-black">
                  {loadingRaffles ? 'Actualizando...' : 'Actualizar eventos'}
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {eventOwners.length === 0 ? (
                  <p className="rounded-[20px] border border-pink-400/14 bg-black/20 p-4 text-sm text-pink-100/70">
                    {normalizedUserRole === 'organizer'
                      ? 'Primero crea un usuario final para poder asociarle eventos.'
                      : 'Primero crea un organizador o un usuario final para poder asociarle eventos.'}
                  </p>
                ) : (
                  eventOwners.map((managedUser) => {
                    const label =
                      managedUser.fullName ||
                      `${managedUser.firstName || ''} ${managedUser.lastName || ''}`.trim() ||
                      managedUser.email;

                    return (
                      <div key={managedUser.id} className="rounded-[22px] border border-pink-400/14 bg-black/20 p-4">
                        <p className="text-lg font-black text-white">{label}</p>
                        <p className="mt-1 text-sm text-pink-100/68">{managedUser.email}</p>
                        <p className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${getRoleTone(managedUser.role)}`}>
                          {getRoleLabel(managedUser.role)}
                        </p>
                        <button
                          type="button"
                          onClick={() => openCreateForUser(managedUser)}
                          className="mt-4 w-full rounded-[16px] bg-white px-4 py-3 text-sm font-black text-[#1d0b20]"
                        >
                          Crear evento para este usuario
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
              {eventMessage ? <p className="mt-4 rounded-2xl border border-pink-400/18 bg-white/[0.04] p-3 text-sm font-bold">{eventMessage}</p> : null}
            </section>

            {canManageGlobalCatalog ? (
              <section className="rounded-[28px] border border-pink-400/18 bg-[#1d0b20] p-5">
                <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-2xl font-black">Catálogo global de proveedores y servicios</h2>
                    <p className="mt-2 text-sm leading-6 text-pink-100/68">
                      Lo que cargues acá aparece igual en todos los eventos. Desde este panel definís nombre, categoría, WhatsApp, imagen y orden.
                    </p>
                  </div>
                  <button onClick={loadCatalog} className="rounded-2xl border border-pink-400/18 px-4 py-2 text-sm font-black">
                    {catalogLoading ? 'Actualizando...' : 'Actualizar catálogo'}
                  </button>
                </div>

                <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
                  <form onSubmit={handleCatalogSubmit} className="rounded-[24px] border border-pink-400/14 bg-black/20 p-4">
                    <h3 className="text-xl font-black text-white">
                      {editingCatalogId ? 'Editar item global' : 'Nuevo item global'}
                    </h3>
                    <div className="mt-4 grid gap-3">
                      <select
                        value={catalogForm.kind}
                        onChange={(e) => setCatalogForm((prev) => ({ ...prev, kind: e.target.value as 'provider' | 'service' }))}
                        className="rounded-2xl border border-pink-400/18 bg-black/20 px-4 py-3 outline-none focus:border-pink-300"
                      >
                        <option value="provider" className="bg-[#1d0b20]">Proveedor</option>
                        <option value="service" className="bg-[#1d0b20]">Servicio adicional</option>
                      </select>
                      <input
                        value={catalogForm.name}
                        onChange={(e) => setCatalogForm((prev) => ({ ...prev, name: e.target.value }))}
                        className="rounded-2xl border border-pink-400/18 bg-black/20 px-4 py-3 outline-none focus:border-pink-300"
                        placeholder="Nombre visible"
                      />
                      <input
                        value={catalogForm.category}
                        onChange={(e) => setCatalogForm((prev) => ({ ...prev, category: e.target.value }))}
                        className="rounded-2xl border border-pink-400/18 bg-black/20 px-4 py-3 outline-none focus:border-pink-300"
                        placeholder="Categoría"
                      />
                      <textarea
                        value={catalogForm.description}
                        onChange={(e) => setCatalogForm((prev) => ({ ...prev, description: e.target.value }))}
                        className="min-h-[96px] rounded-2xl border border-pink-400/18 bg-black/20 px-4 py-3 outline-none focus:border-pink-300"
                        placeholder="Descripción breve"
                      />
                      <input
                        value={catalogForm.phone}
                        onChange={(e) => setCatalogForm((prev) => ({ ...prev, phone: e.target.value }))}
                        className="rounded-2xl border border-pink-400/18 bg-black/20 px-4 py-3 outline-none focus:border-pink-300"
                        placeholder="Teléfono"
                      />
                      <input
                        value={catalogForm.whatsapp}
                        onChange={(e) => setCatalogForm((prev) => ({ ...prev, whatsapp: e.target.value }))}
                        className="rounded-2xl border border-pink-400/18 bg-black/20 px-4 py-3 outline-none focus:border-pink-300"
                        placeholder="WhatsApp"
                      />
                      <input
                        value={catalogForm.imageUrl}
                        onChange={(e) => setCatalogForm((prev) => ({ ...prev, imageUrl: e.target.value }))}
                        className="rounded-2xl border border-pink-400/18 bg-black/20 px-4 py-3 outline-none focus:border-pink-300"
                        placeholder="URL de imagen"
                      />
                      <input
                        type="number"
                        value={catalogForm.orderIndex}
                        onChange={(e) => setCatalogForm((prev) => ({ ...prev, orderIndex: e.target.value }))}
                        className="rounded-2xl border border-pink-400/18 bg-black/20 px-4 py-3 outline-none focus:border-pink-300"
                        placeholder="Orden"
                      />
                      <label className="flex items-center gap-3 rounded-2xl border border-pink-400/18 bg-black/20 px-4 py-3 text-sm font-bold text-pink-50">
                        <input
                          type="checkbox"
                          checked={catalogForm.isActive}
                          onChange={(e) => setCatalogForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                        />
                        Visible en eventos
                      </label>
                      <div className="flex gap-3">
                        <button disabled={catalogSaving} className="flex-1 rounded-2xl bg-white py-3 text-sm font-black text-[#1d0b20] disabled:opacity-60">
                          {catalogSaving ? 'Guardando...' : editingCatalogId ? 'Guardar cambios' : 'Crear item'}
                        </button>
                        {editingCatalogId ? (
                          <button type="button" onClick={resetCatalogEditor} className="rounded-2xl border border-pink-400/18 px-4 py-3 text-sm font-black text-pink-50">
                            Cancelar
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {catalogMessage ? <p className="mt-4 rounded-2xl border border-pink-400/18 bg-white/[0.04] p-3 text-sm font-bold">{catalogMessage}</p> : null}
                  </form>

                  <div className="grid gap-5 lg:grid-cols-2">
                    {([
                      { title: 'Proveedores', items: providerCatalog },
                      { title: 'Servicios', items: serviceCatalog },
                    ]).map(({ title, items }) => (
                      <div key={title} className="rounded-[24px] border border-pink-400/14 bg-black/20 p-4">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <h3 className="text-xl font-black text-white">{title}</h3>
                          <span className="rounded-full border border-pink-400/18 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-pink-200">
                            {Array.isArray(items) ? items.length : 0}
                          </span>
                        </div>
                        <div className="grid gap-3">
                          {Array.isArray(items) && items.length > 0 ? (
                            items.map((item) => (
                              <article key={item.id} className="rounded-[18px] border border-pink-400/14 bg-[#140717] p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <h4 className="text-lg font-black text-white">{item.name}</h4>
                                    <p className="mt-1 text-sm text-pink-100/68">{item.category || 'Sin categoría'}</p>
                                  </div>
                                  <span className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${item.isActive ? 'border-emerald-400/18 text-emerald-200' : 'border-pink-400/18 text-pink-200'}`}>
                                    {item.isActive ? 'Activo' : 'Oculto'}
                                  </span>
                                </div>
                                {item.description ? <p className="mt-3 text-sm leading-6 text-pink-100/68">{item.description}</p> : null}
                                {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="mt-4 h-28 w-full rounded-2xl object-cover" /> : null}
                                <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold text-pink-100/70">
                                  {item.phone ? <span>Tel: {item.phone}</span> : null}
                                  {item.whatsapp ? <span>WSP: {item.whatsapp}</span> : null}
                                  <span>Orden: {item.orderIndex}</span>
                                </div>
                                <div className="mt-4 flex gap-2">
                                  <button type="button" onClick={() => handleCatalogEdit(item)} className="rounded-[14px] bg-white px-4 py-2 text-sm font-black text-[#1d0b20]">
                                    Editar
                                  </button>
                                  <button type="button" onClick={() => handleCatalogDelete(item.id)} className="rounded-[14px] border border-rose-400/18 px-4 py-2 text-sm font-black text-rose-100">
                                    Borrar
                                  </button>
                                </div>
                              </article>
                            ))
                          ) : (
                            <p className="rounded-[18px] border border-pink-400/14 bg-[#140717] p-4 text-sm text-pink-100/70">
                              Todavía no hay items cargados en esta sección.
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ) : null}

            <section className="rounded-[28px] border border-pink-400/18 bg-[#1d0b20] p-5">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-2xl font-black">Usuarios dados de alta</h2>
                <button onClick={loadUsers} className="rounded-2xl border border-pink-400/18 px-4 py-2 text-sm font-black">
                  Actualizar
                </button>
              </div>
              <div className="overflow-hidden rounded-[22px] border border-pink-400/14">
                {users.length === 0 ? (
                  <p className="p-5 text-pink-100/70">Todavia no hay usuarios para mostrar.</p>
                ) : (
                  users.map((listedUser) => (
                    <div key={listedUser.id} className="grid gap-3 border-b border-pink-400/10 p-4 last:border-b-0 md:grid-cols-[1fr_1fr_160px_180px] md:items-center">
                      <b>{listedUser.fullName || `${listedUser.firstName || ''} ${listedUser.lastName || ''}`.trim()}</b>
                      <span className="text-pink-100/70">{listedUser.email}</span>
                      <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-black ${getRoleTone(listedUser.role)}`}>{getRoleLabel(listedUser.role)}</span>
                      {['organizer', 'creator', 'guest'].includes(String(listedUser.role || '').toLowerCase()) ? (
                        <button
                          type="button"
                          onClick={() => openCreateForUser(listedUser)}
                          className="rounded-[14px] border border-pink-400/18 px-4 py-2 text-sm font-black text-pink-50"
                        >
                          Crear evento
                        </button>
                      ) : (
                        <span className="text-xs text-pink-100/45">Sin alta de evento</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-pink-400/18 bg-[#1d0b20] p-5">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black">Eventos creados</h2>
                  <p className="mt-2 text-sm text-pink-100/68">Cada tarjeta muestra el responsable actual y acceso directo a su panel.</p>
                </div>
                <span className="rounded-full border border-pink-400/18 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-pink-200">
                  {raffles.length} total
                </span>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {raffles.length === 0 ? (
                  <p className="rounded-[20px] border border-pink-400/14 bg-black/20 p-5 text-pink-100/70">
                    Todavia no hay eventos creados. Usa el bloque de arriba para crear el primero y dejarlo asociado al responsable correcto.
                  </p>
                ) : (
                  raffles.map((raffle) => (
                    <article key={raffle.id} className="rounded-[22px] border border-pink-400/14 bg-black/20 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-black text-white">{raffle.title}</h3>
                          <p className="mt-1 text-sm text-pink-100/68">Responsable: {formatOwnerLabel(raffle)}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-pink-300">{raffle.status === 'finished' ? 'Finalizado' : 'Activo'}</p>
                        </div>
                        <span className="rounded-full border border-pink-400/18 px-3 py-1 text-xs font-black text-pink-100/80">
                          {raffle.totalNumbers || raffle.maxCapacity || 0} cupos
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/workspace/${raffle.id}`)}
                          className="rounded-[14px] bg-white px-4 py-2 text-sm font-black text-[#1d0b20]"
                        >
                          Abrir panel
                        </button>
                        {raffle?.creator?.id ? (
                          <button
                            type="button"
                            onClick={() => openCreateForUser(raffle.creator)}
                            className="rounded-[14px] border border-pink-400/18 px-4 py-2 text-sm font-black text-pink-50"
                          >
                            Crear otro para este responsable
                          </button>
                        ) : null}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
