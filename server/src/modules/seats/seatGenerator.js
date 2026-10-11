/** 0 -> A, 25 -> Z, 26 -> AA, 27 -> AB ... (spreadsheet-style row labels). */
export function rowLabel(index) {
  let n = index;
  let label = '';
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

/**
 * Pure function: turns a venue layout and the event's pricing tiers into seat documents.
 * A section without an explicit tier uses the first tier.
 */
export function buildSeats({ eventId, sections, pricingTiers }) {
  const priceByTier = new Map(pricingTiers.map((t) => [t.name.toLowerCase(), t]));
  const seats = [];

  for (const section of sections) {
    const tier = priceByTier.get((section.tier ?? pricingTiers[0].name).toLowerCase());
    if (!tier) {
      throw new Error(`Section "${section.name}" uses tier "${section.tier}" which is not in the event's pricing tiers`);
    }
    for (let r = 0; r < section.rows; r += 1) {
      for (let n = 1; n <= section.cols; n += 1) {
        seats.push({
          eventId,
          section: section.name,
          row: rowLabel(r),
          number: n,
          tier: tier.name,
          price: tier.price,
        });
      }
    }
  }
  return seats;
}
