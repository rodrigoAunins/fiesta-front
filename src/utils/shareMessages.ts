export function getSellerShareText(link: string, raffleTitle?: string) {
  return `¡Hola! Estoy vendiendo números para${
    raffleTitle ? ` la rifa "${raffleTitle}"` : ' una rifa'
  } 🎟️

Podés elegir tu número desde este link:
${link}

Reservás tu número y después podés pagar por transferencia o en efectivo.
El organizador confirma el pago desde la app.`;
}

export function getSellerShareTitle(raffleTitle?: string) {
  return raffleTitle ? `Rifa: ${raffleTitle}` : 'RifaLibre';
}

export function getPublicRaffleShareText(link: string, raffleTitle?: string) {
  return `Te comparto${
    raffleTitle ? ` la rifa "${raffleTitle}"` : ' esta rifa'
  } 🎟️

Entrá, mirá los premios y elegí tu número:
${link}

Podés reservar y pagar por transferencia o en efectivo.
El organizador valida la compra desde la app.`;
}

export function getAppShareText(link: string) {
  return `Mirá esta app para crear y vender rifas de forma simple:
${link}

Ideal para organizar rifas, compartir links, recibir pagos por transferencia o efectivo y validar compradores desde un solo lugar.`;
}

export function getWhatsAppSellerText(link: string, raffleTitle?: string) {
  return `¡Hola! Estoy compartiendo${
    raffleTitle ? ` la rifa "${raffleTitle}"` : ' esta rifa'
  } 🎟️

Elegí tu número desde acá:
${link}

Después podés pagar por transferencia o en efectivo y el organizador confirma la compra.`;
}