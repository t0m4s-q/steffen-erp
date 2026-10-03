import Decimal from 'decimal.js';

// Configuración global de Decimal.js para el dominio Steffen ERP
// 28 dígitos de precisión (ampliamente suficiente para NUMERIC(20,6))
Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -9,
  toExpPos: 28,
});

export { Decimal };

export const VAT_RATE_DECIMAL = new Decimal('0.21');
export const VAT_MULTIPLIER_DECIMAL = new Decimal('1.21');
export const PRODUCT_EXTRA_VARIABLE_PCT_DECIMAL = new Decimal('2.0');
export const PRODUCT_EXTRA_VARIABLE_FACTOR_DECIMAL = new Decimal('0.02');

/**
 * Convierte un valor a string exacto para persistencia en columnas PostgreSQL NUMERIC.
 */
export function toNumericString(val: Decimal.Value): string {
  return new Decimal(val).toString();
}

/**
 * Redondea cantidades en kg a un máximo de 3 decimales (0.001 kg).
 */
export function toKgPrecision(val: Decimal.Value): Decimal {
  return new Decimal(val).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
}

/**
 * Precios de listas de precios terminan en pesos enteros según las reglas de negocio.
 */
export function toWholePesos(val: Decimal.Value): Decimal {
  return new Decimal(val).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
}
