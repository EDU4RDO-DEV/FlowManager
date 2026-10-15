const LITERS_PER_US_GALLON = 3.785411784;

export function litersToGallons(liters: number): number {
  return Number((liters / LITERS_PER_US_GALLON).toFixed(3));
}

export function gallonsToLiters(gallons: number): number {
  return Number((gallons * LITERS_PER_US_GALLON).toFixed(3));
}
