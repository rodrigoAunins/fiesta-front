export function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function getUnlockPriceByTotalNumbers(totalNumbers: number) {
  const normalizedTotal = Math.max(1, Number(totalNumbers || 0));

  if (normalizedTotal <= 100) return 1000;
  if (normalizedTotal <= 500) return 2000;
  return 5000;
}

export function buildRafflePricing(params: {
  desiredNetGoal: number;
  totalNumbers: number;
}) {
  const desiredNetGoal = Math.max(0, Number(params.desiredNetGoal || 0));
  const totalNumbers = Math.max(1, Number(params.totalNumbers || 1));

  const rawTicketPrice = desiredNetGoal / totalNumbers;
  const suggestedTicketPrice = Math.ceil(rawTicketPrice);

  const estimatedGrossGoal = round2(suggestedTicketPrice * totalNumbers);
  const unlockPrice = getUnlockPriceByTotalNumbers(totalNumbers);

  const estimatedNetBeforeUnlock = estimatedGrossGoal;
  const estimatedNetAfterUnlock = round2(
    Math.max(0, estimatedGrossGoal - unlockPrice),
  );

  return {
    suggestedTicketPrice,
    rawTicketPrice: round2(rawTicketPrice),
    estimatedGrossGoal,
    unlockPrice,
    estimatedNetBeforeUnlock,
    estimatedNetAfterUnlock,
  };
}