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
      className="mx-auto mt-8 mb-24 w-full max-w-[960px] overflow-hidden rounded-[28px] border border-pink-400/14 bg-[#140717] shadow-[0_20px_42px_rgba(10,3,17,0.28)]"
    >
      <div className="border-b border-pink-400/12 bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,.18),transparent_32%),rgba(255,255,255,.03)] px-4 py-3 md:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/8 text-pink-100 shadow-sm">
            <i className="fas fa-circle-info text-sm"></i>
          </div>

          <div className="min-w-0">
            <p className="text-[15px] font-black leading-tight text-white">
              Antes de compartir tu evento
            </p>
            <p className="text-[12px] leading-tight text-pink-100/62">
              Lo esencial para usar Mi Fiesta sin fricción
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 px-4 py-4 md:grid-cols-2 md:px-5 md:py-5">
        {footerItems.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-pink-400/10 bg-white/[0.04] px-4 py-3.5 text-[14px] leading-6 text-pink-100/72"
          >
            <p className="mb-1 text-[14px] font-black text-white">{item.title}</p>
            <p>{item.description}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-pink-400/10 px-4 py-3 md:px-5">
        <p className="text-[12px] leading-5 text-pink-100/52">
          Mi Fiesta está pensado para que crear, compartir y organizar un evento sea simple
          tanto para vos como para tus invitados.
        </p>
      </div>
    </motion.footer>
  );
}