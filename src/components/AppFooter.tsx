import { motion } from 'framer-motion';

const footerItems = [
  {
    title: 'Un solo link para compartir',
    description:
      'Mostrá fecha, lugar, horario, confirmación y contacto en un mismo lugar, sin mensajes sueltos.',
  },
  {
    title: 'Listo para usar desde el celu',
    description:
      'Tus invitados entran al link, ven todo claro y responden sin bajar ninguna app.',
  },
  {
    title: 'Cobros simples con Mercado Pago',
    description:
      'Si activás señas o pagos, cada persona puede reservar de forma rápida y segura.',
  },
  {
    title: 'Todo más claro para todos',
    description:
      'Antes de confirmar o pagar, cada invitado puede revisar la información y las condiciones del evento.',
  },
];

export default function AppFooter() {
  return (
    <motion.footer
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="mx-auto mt-8 mb-24 w-full max-w-[960px] overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_8px_22px_rgba(0,0,0,0.05)]"
    >
      <div className="border-b border-[#f2e9a2] bg-[#fff9cc] px-4 py-3 md:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#3483fa] shadow-sm">
            <i className="fas fa-circle-info text-sm"></i>
          </div>

          <div className="min-w-0">
            <p className="text-[15px] font-black leading-tight text-slate-900">
              Antes de compartir tu evento
            </p>
            <p className="text-[12px] leading-tight text-slate-700">
              Lo esencial para usar Pase Libre sin vueltas
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 px-4 py-4 md:grid-cols-2 md:px-5 md:py-5">
        {footerItems.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl bg-slate-50 px-4 py-3.5 text-[14px] leading-6 text-slate-700"
          >
            <p className="mb-1 text-[14px] font-black text-slate-900">{item.title}</p>
            <p>{item.description}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100 px-4 py-3 md:px-5">
        <p className="text-[12px] leading-5 text-slate-500">
          Pase Libre está pensado para que crear, compartir y organizar un evento sea simple
          tanto para vos como para tus invitados.
        </p>
      </div>
    </motion.footer>
  );
}