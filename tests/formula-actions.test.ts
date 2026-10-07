import test from 'node:test';
import assert from 'node:assert';
import { Decimal } from '../src/domain/decimal';
import {
  serializeFormulaBreakdown,
  serializeBaseProduct,
  serializeFormulaVersion,
  getInitialFormulaRows,
  type BaseProductDTO,
} from '../src/actions/formula.dto';
import type {
  BaseProductWithCurrentCost,
  FormulaCostBreakdown,
} from '../src/services/formula.service';
import type { FormulaVersionFullRecord } from '../src/repositories/formula.repository';

test('DTO Serializers — Fórmulas y Productos Base (PBA)', async (t) => {
  await t.test('serializeFormulaBreakdown serializa cantidades y costos a strings JSON-safe exactos', () => {
    const mockBreakdown: FormulaCostBreakdown = {
      lines: [
        {
          rawMaterialId: 'mpr-1',
          rawMaterialCode: 'MPR0001',
          rawMaterialName: 'Agua Desmineralizada',
          quantityKg: new Decimal('20.500'),
          unitCostGrossArs: new Decimal('150.25'),
          lineCostArs: new Decimal('3080.125'),
          sortOrder: 1,
        },
      ],
      totalKgBulk: new Decimal('20.500'),
      totalCostBulkArs: new Decimal('3080.125'),
      costPerKgPbaArs: new Decimal('150.25'),
    };

    const dto = serializeFormulaBreakdown(mockBreakdown);

    assert.strictEqual(dto.totalKgBulk, '20.5');
    assert.strictEqual(dto.totalCostBulkArs, '3080.125');
    assert.strictEqual(dto.costPerKgPbaArs, '150.25');
    assert.strictEqual(dto.lines.length, 1);
    assert.strictEqual(dto.lines[0].quantityKg, '20.5');
    assert.strictEqual(dto.lines[0].currentUnitCost, '150.25');
    assert.strictEqual(dto.lines[0].partialCost, '3080.125');
    assert.strictEqual(typeof dto.lines[0].quantityKg, 'string');
    assert.strictEqual(typeof dto.lines[0].currentUnitCost, 'string');
  });

  await t.test('serializeBaseProduct maneja productos base sin desglose previo', () => {
    const mockPba: BaseProductWithCurrentCost = {
      id: 'pba-1',
      code: 'PBA0001',
      name: 'Shampoo Neutro',
      active: true,
      createdDate: '2026-10-01',
      createdAt: '2026-10-01T12:00:00Z',
      updatedAt: '2026-10-01T12:00:00Z',
      currentVersionNumber: null,
      currentFormulaBreakdown: null,
    };

    const dto = serializeBaseProduct(mockPba);

    assert.strictEqual(dto.id, 'pba-1');
    assert.strictEqual(dto.code, 'PBA0001');
    assert.strictEqual(dto.currentVersion, null);
    assert.strictEqual(dto.currentCostPerKg, null);
    assert.strictEqual(dto.currentFormulaBreakdown, null);
  });

  await t.test('serializeFormulaVersion preserva metadatos y versionado inmutable', () => {
    const mockVersion: FormulaVersionFullRecord = {
      id: 'ver-2',
      baseProductId: 'pba-1',
      versionNumber: 2,
      businessDate: '2026-10-05',
      observations: 'Revisión v2 de fórmula',
      isCurrent: true,
      createdAt: '2026-10-05T15:00:00Z',
      items: [
        {
          id: 'item-1',
          rawMaterialId: 'mpr-1',
          rawMaterialCode: 'MPR0001',
          rawMaterialName: 'Materia 1',
          quantityKg: new Decimal('10.000'),
          sortOrder: 1,
        },
      ],
    };

    const mockBreakdown: FormulaCostBreakdown = {
      lines: [
        {
          rawMaterialId: 'mpr-1',
          rawMaterialCode: 'MPR0001',
          rawMaterialName: 'Materia 1',
          quantityKg: new Decimal('10.000'),
          unitCostGrossArs: new Decimal('2000'),
          lineCostArs: new Decimal('20000'),
          sortOrder: 1,
        },
      ],
      totalKgBulk: new Decimal('10.000'),
      totalCostBulkArs: new Decimal('20000'),
      costPerKgPbaArs: new Decimal('2000'),
    };

    const dto = serializeFormulaVersion(mockVersion, mockBreakdown);

    assert.strictEqual(dto.id, 'ver-2');
    assert.strictEqual(dto.versionNumber, 2);
    assert.strictEqual(dto.isCurrent, true);
    assert.strictEqual(dto.observations, 'Revisión v2 de fórmula');
    assert.strictEqual(dto.costBreakdown.costPerKgPbaArs, '2000');
  });
});

test('Regresión UI-5 — Aislamiento estricto de fórmula al precargar nueva versión entre PBAs distintos', async (t) => {
  // Configuración del escenario del bug:
  // PBA A (Crema Base Nutritiva): MPR1 (2.500 kg), MPR2 (7.500 kg)
  const pbaA: BaseProductDTO = {
    id: 'pba-0001-aaaa-aaaa-aaaaaaaaaaaa',
    code: 'PBA0100',
    name: 'Crema Base Nutritiva',
    active: true,
    createdDate: '2026-10-01',
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-10-01T10:00:00Z',
    currentFormulaId: 'form-a-v1',
    currentVersion: 1,
    currentCostPerKg: '1500.00',
    currentFormulaBreakdown: {
      totalKgBulk: '10.000',
      totalCostBulkArs: '15000.00',
      costPerKgPbaArs: '1500.00',
      lines: [
        {
          rawMaterialId: 'mpr-0001-uuid',
          rawMaterialCode: 'MPR0002',
          rawMaterialName: 'Materia Prima 1',
          quantityKg: '2.500',
          currentUnitCost: '1000.00',
          partialCost: '2500.00',
          sortOrder: 1,
        },
        {
          rawMaterialId: 'mpr-0002-uuid',
          rawMaterialCode: 'MPR0003',
          rawMaterialName: 'Materia Prima 2',
          quantityKg: '7.500',
          currentUnitCost: '1666.67',
          partialCost: '12500.00',
          sortOrder: 2,
        },
      ],
    },
  };

  // PBA B (Shampoo Semi de Lino Test): MPR3 (1.000 kg), MPR4 (4.000 kg)
  const pbaB: BaseProductDTO = {
    id: 'pba-0259-bbbb-bbbb-bbbbbbbbbbbb',
    code: 'PBA0259',
    name: 'Shampoo Semi de Lino Test',
    active: true,
    createdDate: '2026-10-02',
    createdAt: '2026-10-02T10:00:00Z',
    updatedAt: '2026-10-02T10:00:00Z',
    currentFormulaId: 'form-b-v1',
    currentVersion: 1,
    currentCostPerKg: '2200.00',
    currentFormulaBreakdown: {
      totalKgBulk: '5.000',
      totalCostBulkArs: '11000.00',
      costPerKgPbaArs: '2200.00',
      lines: [
        {
          rawMaterialId: 'mpr-0003-uuid',
          rawMaterialCode: 'MPR0004',
          rawMaterialName: 'Materia Prima 3',
          quantityKg: '1.000',
          currentUnitCost: '2000.00',
          partialCost: '2000.00',
          sortOrder: 1,
        },
        {
          rawMaterialId: 'mpr-0004-uuid',
          rawMaterialCode: 'MPR0005',
          rawMaterialName: 'Materia Prima 4',
          quantityKg: '4.000',
          currentUnitCost: '2250.00',
          partialCost: '9000.00',
          sortOrder: 2,
        },
      ],
    },
  };

  await t.test('Abrir/crear nueva versión para PBA B carga exclusivamente MPR3 y MPR4 y nunca items de PBA A', () => {
    // 1. Cargar items para PBA B
    const itemsB = getInitialFormulaRows(pbaB);

    // Debe contener exactamente los 2 items de PBA B
    assert.strictEqual(itemsB.length, 2);
    assert.strictEqual(itemsB[0].rawMaterialId, 'mpr-0003-uuid');
    assert.strictEqual(itemsB[0].quantityKg, '1.000');
    assert.notStrictEqual(itemsB[0].quantityKg, '2.500');
    assert.strictEqual(itemsB[1].rawMaterialId, 'mpr-0004-uuid');
    assert.strictEqual(itemsB[1].quantityKg, '4.000');

    // NUNCA debe contener los items de PBA A
    const rawMaterialIds = itemsB.map((i) => i.rawMaterialId);
    assert.strictEqual(rawMaterialIds.includes('mpr-0001-uuid'), false, 'No debe contener MPR1 de PBA A');
    assert.strictEqual(rawMaterialIds.includes('mpr-0002-uuid'), false, 'No debe contener MPR2 de PBA A');
  });

  await t.test('Simulación de ciclo de vida UI: Transición de selección de PBA A a PBA B reinicia items limpiamente', () => {
    // Estado inicial en vista (PBA A montado primero)
    let activePba = pbaA;
    let loadedRows = getInitialFormulaRows(activePba);
    assert.strictEqual(loadedRows[0].rawMaterialId, 'mpr-0001-uuid');

    // Usuario selecciona PBA B y abre modal de nueva versión
    activePba = pbaB;
    // La regla de sincronización al detectar cambio de id (activePba.id !== prevId) re-ejecuta getInitialFormulaRows
    loadedRows = getInitialFormulaRows(activePba);

    assert.strictEqual(loadedRows.length, 2);
    assert.strictEqual(loadedRows[0].rawMaterialId, 'mpr-0003-uuid');
    assert.strictEqual(loadedRows[0].quantityKg, '1.000');
    assert.strictEqual(loadedRows[1].rawMaterialId, 'mpr-0004-uuid');
    assert.strictEqual(loadedRows[1].quantityKg, '4.000');
    assert.ok(!loadedRows.some((r) => r.rawMaterialId === 'mpr-0001-uuid'));
    assert.ok(!loadedRows.some((r) => r.rawMaterialId === 'mpr-0002-uuid'));
  });

  await t.test('Cierre y reapertura del modal no preserva stale state ni filas modificadas', () => {
    // Usuario abre PBA B
    let rows = getInitialFormulaRows(pbaB);
    // Usuario modifica temporalmente una fila en el formulario
    rows = [...rows, { rawMaterialId: 'mpr-temp-uuid', quantityKg: '99.000' }];
    assert.strictEqual(rows.length, 3);

    // Usuario cierra el modal sin guardar y lo vuelve a abrir:
    // El modal o contenedor reinicializa desde la fórmula vigente del PBA objetivo
    const refreshedRows = getInitialFormulaRows(pbaB);
    assert.strictEqual(refreshedRows.length, 2);
    assert.strictEqual(refreshedRows[0].rawMaterialId, 'mpr-0003-uuid');
    assert.strictEqual(refreshedRows[1].rawMaterialId, 'mpr-0004-uuid');
    assert.ok(!refreshedRows.some((r) => r.rawMaterialId === 'mpr-temp-uuid'));
  });

  await t.test('PBA sin fórmula vigente retorna fila vacía por defecto', () => {
    const emptyPba: BaseProductDTO = {
      ...pbaB,
      id: 'pba-empty-uuid',
      currentFormulaBreakdown: null,
    };
    const emptyRows = getInitialFormulaRows(emptyPba);
    assert.strictEqual(emptyRows.length, 1);
    assert.strictEqual(emptyRows[0].rawMaterialId, '');
    assert.strictEqual(emptyRows[0].quantityKg, '');
  });
});

