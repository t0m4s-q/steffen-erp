/**
 * Excepciones y errores de dominio Steffen ERP
 * Fuente: BUSINESS_RULES.md y DATA_MODEL.md
 */

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export class InsufficientStockError extends DomainError {
  constructor(itemCode: string, requested: number, available: number) {
    super(`Stock insuficiente para el ítem ${itemCode}: solicitado ${requested}, disponible ${available}`);
    this.name = 'InsufficientStockError';
  }
}

export class ImmutableSupplierCurrencyError extends DomainError {
  constructor(supplierCode: string) {
    super(`La moneda del proveedor ${supplierCode} es inmutable y no puede modificarse.`);
    this.name = 'ImmutableSupplierCurrencyError';
  }
}

export class PendingRtmExistsError extends DomainError {
  constructor(pendingRtoCode: string) {
    super(`No se puede confirmar un nuevo RTO mientras exista un RTM pendiente (RTO actual: ${pendingRtoCode}).`);
    this.name = 'PendingRtmExistsError';
  }
}

export class InvalidExchangeRateError extends DomainError {
  constructor(message = 'No existe una cotización vigente para la conversión de USD a ARS.') {
    super(message);
    this.name = 'InvalidExchangeRateError';
  }
}

export class BulkLotUnavailableError extends DomainError {
  constructor(lotCode: string, requestedKg: number, availableKg: number) {
    super(`El lote ${lotCode} no tiene suficientes kg disponibles: solicitado ${requestedKg} kg, disponible ${availableKg} kg.`);
    this.name = 'BulkLotUnavailableError';
  }
}

export class InactiveEntityOperationError extends DomainError {
  constructor(entityType: string, code: string) {
    super(`La entidad ${entityType} [${code}] se encuentra inactiva y no puede iniciar nuevas operaciones.`);
    this.name = 'InactiveEntityOperationError';
  }
}

export class NoActiveSupplierItemCostError extends DomainError {
  constructor(stockItemId: string) {
    super(`No existe una relación activa Proveedor <-> Ítem con precio cargado para el ítem ID: ${stockItemId}`);
    this.name = 'NoActiveSupplierItemCostError';
  }
}

export class NoCurrentFormulaError extends DomainError {
  constructor(baseProductId: string) {
    super(`No existe una versión de fórmula vigente para el Producto Base ID: ${baseProductId}`);
    this.name = 'NoCurrentFormulaError';
  }
}

export class ProductNotFoundError extends DomainError {
  constructor(productId: string) {
    super(`Producto Terminado no encontrado con ID: ${productId}`);
    this.name = 'ProductNotFoundError';
  }
}

export class InvalidStockUnitPrecisionError extends DomainError {
  constructor(message = 'Los ítems por unidad (COM/PRO) deben ser cantidades enteras. MPR admite hasta 3 decimales (kg).') {
    super(message);
    this.name = 'InvalidStockUnitPrecisionError';
  }
}

export class NoPriceSnapshotFoundError extends DomainError {
  constructor(productId: string, priceListId: string, snapshotAt: string) {
    super(`No existe una versión de precio válida para el producto ${productId} en la lista ${priceListId} al momento del snapshot (${snapshotAt}).`);
    this.name = 'NoPriceSnapshotFoundError';
  }
}

export class InvalidCodePrefixError extends DomainError {
  constructor(prefix: string) {
    super(`Prefijo de secuencia de código inválido: "${prefix}". Debe ser un prefijo de 3 caracteres en mayúsculas.`);
    this.name = 'InvalidCodePrefixError';
  }
}
