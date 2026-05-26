// Peso formatting. Manual thousands separator (Hermes' Intl is limited in RN).
export function formatPeso(price: number | null): string {
  if (price == null) return 'Price on request';
  const fixed = price % 1 === 0 ? price.toFixed(0) : price.toFixed(2);
  return '₱' + fixed.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
