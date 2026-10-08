import { Decimal, toNumericString } from '@/domain/decimal';
import type {
  PriceListRecord,
  ProductPriceVersionRecord,
  BulkPriceIncreaseResult,
} from '@/repositories/price-list.repository';

export interface PriceListDTO {
  id: string;
  name: string;
  systemRole: 'SALON_DEFAULT' | 'PUBLIC_DEFAULT' | 'ECOMMERCE_DEFAULT' | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  isSystem: boolean;
  systemRoleLabel: string;
}

export interface ProductPriceRowDTO {
  productId: string;
  productCode: string;
  productName: string;
  presentation: string;
  productActive: boolean;
  currentPriceArs: string | null;
  currentPriceVersionId: string | null;
  validFrom: string | null;
  hasPrice: boolean;
}

export interface PriceHistoryRecordDTO {
  id: string;
  priceListId: string;
  productId: string;
  productCode?: string;
  productName?: string;
  priceArs: string;
  previousPriceArs?: string | null;
  validFrom: string;
  validTo: string | null;
  isActive: boolean;
  createdAt?: string;
}

export interface BulkIncreaseItemResultDTO {
  productId: string;
  productCode: string;
  productName: string;
  previousPriceArs: string;
  newPriceArs: string;
}

export interface BulkIncreaseResultDTO {
  priceListId: string;
  percentage: string;
  updatedCount: number;
  validFrom: string;
  items: BulkIncreaseItemResultDTO[];
}

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function serializePriceList(record: PriceListRecord): PriceListDTO {
  let roleLabel = 'Adicional';
  if (record.systemRole === 'SALON_DEFAULT') roleLabel = 'Salón (Sistema)';
  else if (record.systemRole === 'PUBLIC_DEFAULT') roleLabel = 'Público (Sistema)';
  else if (record.systemRole === 'ECOMMERCE_DEFAULT') roleLabel = 'Ecommerce (Sistema)';

  return {
    id: record.id,
    name: record.name,
    systemRole: record.systemRole,
    active: record.active,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    isSystem: record.systemRole !== null,
    systemRoleLabel: roleLabel,
  };
}

export function serializePriceHistoryRecord(record: ProductPriceVersionRecord): PriceHistoryRecordDTO {
  return {
    id: record.id,
    priceListId: record.priceListId,
    productId: record.productId,
    productCode: record.productCode,
    productName: record.productName,
    priceArs: toNumericString(record.priceArs),
    previousPriceArs: record.previousPriceArs ? toNumericString(record.previousPriceArs) : null,
    validFrom: record.validFrom,
    validTo: record.validTo,
    isActive: record.validTo === null,
    createdAt: record.createdAt,
  };
}

export function serializeBulkIncreaseResult(result: BulkPriceIncreaseResult): BulkIncreaseResultDTO {
  return {
    priceListId: result.priceListId,
    percentage: toNumericString(result.percentage),
    updatedCount: result.updatedCount,
    validFrom: result.validFrom,
    items: result.items.map((i) => ({
      productId: i.productId,
      productCode: i.productCode,
      productName: i.productName,
      previousPriceArs: toNumericString(i.previousPriceArs),
      newPriceArs: toNumericString(i.newPriceArs),
    })),
  };
}

/**
 * Formatea un importe monetario entero en pesos ARS preservando el string exacto.
 * No convierte a JS Number (evitando pérdida de precisión o IEEE 754 float).
 * Aplica separador de miles con punto '.' (es-AR) mediante expresión regular sobre caracteres.
 */
export function formatExactIntegerArs(raw: string | null | undefined): string {
  if (!raw) return '$ 0';
  const trimmed = raw.trim();
  if (!trimmed) return '$ 0';

  const isNegative = trimmed.startsWith('-');
  const unsigned = isNegative ? trimmed.slice(1) : trimmed;

  // Si contiene parte decimal por representación SQL (ej. "15000.00"), descartar decimales nulos
  const intPart = unsigned.split('.')[0] || '0';

  // Aplicar separador de miles con punto '.' (es-AR)
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `${isNegative ? '-$ ' : '$ '}${formattedInt}`;
}

