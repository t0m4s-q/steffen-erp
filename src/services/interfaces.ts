/**
 * Contratos de servicios de dominio (preparados para Fase 3)
 * No implementan lógica de negocio en esta etapa de preparación.
 */

export interface ICodeSequenceService {
  generateVisibleCode(prefix: string): Promise<string>;
}

export interface ICostEngineService {
  getCurrentStockItemCost(stockItemId: string): Promise<number>;
  getCurrentFormulaCost(baseProductId: string): Promise<{ totalKg: number; totalBulkCost: number; costPerKg: number }>;
  getCurrentProductCost(productId: string): Promise<{ baseCost: number; componentsCost: number; extraVariable: number; totalCost: number }>;
}

export interface IStockDomainService {
  getStockBalance(stockItemId: string): Promise<number>;
  applyStockMovement(params: {
    operationId: string;
    stockItemId: string;
    movementType: string;
    quantityDelta: number;
    description: string;
  }): Promise<void>;
}

export interface IPatrimonyDomainService {
  postPatrimonialMovement(params: {
    operationId: string;
    movementType: string;
    description: string;
    amountArs: number;
    entries: Array<{ financialAccountId: string; deltaArs: number }>;
  }): Promise<void>;
  getFinancialAccountBalance(accountId: string): Promise<number>;
}
