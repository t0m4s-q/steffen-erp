// Formulas View conforming to DESIGN.md Section 16.4 & BUSINESS_RULES.md Section 2

import React, { useState } from 'react';
import { db } from '../../services/db';
import { domainServices } from '../../services/domainServices';
import { Button, Modal, FormField } from '../components/UIComponents';
import { PlusCircle, Edit3, History, Check } from 'lucide-react';
import { UUID } from '../../types/domain';

export const FormulasView: React.FC = () => {
  const state = db.getState();
  const baseProducts = Object.values(state.baseProducts).filter((p) => p.active);
  const [selectedPbaId, setSelectedPbaId] = useState<UUID>(baseProducts[0]?.id || '');

  const selectedBaseProduct = state.baseProducts[selectedPbaId];
  const formulaCostInfo = selectedPbaId ? domainServices.getCurrentFormulaCost(selectedPbaId) : null;

  // Versions history
  const versions = Object.values(state.formulaVersions)
    .filter((fv) => fv.base_product_id === selectedPbaId)
    .sort((a, b) => b.version_number - a.version_number);

  // New Formula / PBA Modal
  const [newFormulaModalOpen, setNewFormulaModalOpen] = useState(false);
  const [newPbaName, setNewPbaName] = useState('');
  const [newObservations, setNewObservations] = useState('');
  const rawMaterials = Object.values(state.stockItems).filter((it) => it.item_type === 'MPR' && it.active);

  const [newRecipeRows, setNewRecipeRows] = useState<Array<{ rawMaterialId: UUID; quantityKg: number }>>([
    { rawMaterialId: rawMaterials[0]?.id || '', quantityKg: 50 },
  ]);
  const [modalError, setModalError] = useState('');

  // Edit Formula Modal (New Version)
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editRecipeRows, setEditRecipeRows] = useState<Array<{ rawMaterialId: UUID; quantityKg: number }>>([]);
  const [editObservations, setEditObservations] = useState('');

  const openEditFormula = () => {
    if (!formulaCostInfo) return;
    const initialRows = formulaCostInfo.items.map((i) => ({
      rawMaterialId: i.rawMaterialId,
      quantityKg: i.quantityKg,
    }));
    setEditRecipeRows(initialRows);
    setEditObservations(`Revisión de fórmula ${new Date().toLocaleDateString('es-AR')}`);
    setEditModalOpen(true);
  };

  const handleSaveNewFormula = () => {
    setModalError('');
    if (!newPbaName.trim()) {
      setModalError('El nombre del Producto Base es obligatorio');
      return;
    }
    // Verify no duplicates
    const ids = new Set(newRecipeRows.map((r) => r.rawMaterialId));
    if (ids.size !== newRecipeRows.length) {
      setModalError('No puede repetirse la misma Materia Prima en varias filas de la fórmula');
      return;
    }

    try {
      db.transaction((st) => {
        const now = new Date().toISOString();
        const pbaCode = db.nextCode('PBA');
        const pbaId = db.generateUUID();

        st.baseProducts[pbaId] = {
          id: pbaId,
          code: pbaCode,
          name: newPbaName,
          active: true,
          created_date: now.slice(0, 10),
          created_at: now,
          updated_at: now,
        };

        const fvId = db.generateUUID();
        st.formulaVersions[fvId] = {
          id: fvId,
          base_product_id: pbaId,
          version_number: 1,
          business_date: now.slice(0, 10),
          observations: newObservations,
          is_current: true,
          created_at: now,
        };

        newRecipeRows.forEach((r, idx) => {
          if (r.quantityKg <= 0) throw new Error('Las cantidades en kg deben ser mayores a 0');
          const fviId = db.generateUUID();
          st.formulaVersionItems[fviId] = {
            id: fviId,
            formula_version_id: fvId,
            raw_material_id: r.rawMaterialId,
            quantity_kg: r.quantityKg,
            sort_order: idx + 1,
          };
        });

        setSelectedPbaId(pbaId);
      });
      setNewFormulaModalOpen(false);
      setNewPbaName('');
    } catch (err: any) {
      setModalError(err.message || 'Error al guardar fórmula');
    }
  };

  const handleSaveEditVersion = () => {
    setModalError('');
    // Verify no duplicates
    const ids = new Set(editRecipeRows.map((r) => r.rawMaterialId));
    if (ids.size !== editRecipeRows.length) {
      setModalError('No puede repetirse la misma Materia Prima en varias filas de la fórmula');
      return;
    }

    try {
      db.transaction((st) => {
        const now = new Date().toISOString();
        // Deactivate previous active version for this PBA
        Object.values(st.formulaVersions).forEach((v) => {
          if (v.base_product_id === selectedPbaId && v.is_current) {
            v.is_current = false;
          }
        });

        const nextVerNum = (versions[0]?.version_number || 1) + 1;
        const newFvId = db.generateUUID();
        st.formulaVersions[newFvId] = {
          id: newFvId,
          base_product_id: selectedPbaId,
          version_number: nextVerNum,
          business_date: now.slice(0, 10),
          observations: editObservations,
          is_current: true,
          created_at: now,
        };

        editRecipeRows.forEach((r, idx) => {
          if (r.quantityKg <= 0) throw new Error('Las cantidades en kg deben ser mayores a 0');
          const fviId = db.generateUUID();
          st.formulaVersionItems[fviId] = {
            id: fviId,
            formula_version_id: newFvId,
            raw_material_id: r.rawMaterialId,
            quantity_kg: r.quantityKg,
            sort_order: idx + 1,
          };
        });
      });
      setEditModalOpen(false);
    } catch (err: any) {
      setModalError(err.message || 'Error al actualizar versión');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-lg border border-[#D9D9D9]">
        <div>
          <h1 className="text-2xl font-bold text-[#000000]">Fórmulas de Productos Base</h1>
          <p className="text-xs text-gray-500">
            Composición química oficial por lote de Producto Base (PBA). Control de versiones y costos teóricos.
          </p>
        </div>
        <Button variant="principal" onClick={() => setNewFormulaModalOpen(true)} className="flex items-center gap-2">
          <PlusCircle className="w-4 h-4" /> Nueva Fórmula / PBA
        </Button>
      </div>

      {/* Main Grid: Selector & Formula Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* PBA Selector List */}
        <div className="bg-white p-4 rounded-lg border border-[#D9D9D9] shadow-xs space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Productos Base (PBA)</h2>
          <div className="space-y-1">
            {baseProducts.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPbaId(p.id)}
                className={`w-full text-left p-3 rounded text-xs font-semibold flex items-center justify-between border transition-colors cursor-pointer ${
                  selectedPbaId === p.id
                    ? 'bg-[#B99D22] text-white border-[#B99D22]'
                    : 'bg-gray-50 text-[#393939] border-gray-200 hover:bg-gray-100'
                }`}
              >
                <div>
                  <p className="font-bold">{p.name}</p>
                  <span className={`text-[10px] ${selectedPbaId === p.id ? 'text-amber-100' : 'text-gray-400'}`}>
                    {p.code}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Current Formula Detail */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white p-5 rounded-lg border border-[#D9D9D9] shadow-xs space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-[#D9D9D9]">
              <div>
                <h2 className="text-lg font-bold text-[#000000]">{selectedBaseProduct?.name}</h2>
                <span className="text-xs font-bold text-[#B99D22]">{selectedBaseProduct?.code}</span>
                <span className="text-xs text-gray-500 ml-2">
                  (Versión Vigente: v{versions.find((v) => v.is_current)?.version_number || 1})
                </span>
              </div>
              <Button variant="secundario" onClick={openEditFormula} className="flex items-center gap-1.5 text-xs">
                <Edit3 className="w-3.5 h-3.5" /> Editar Fórmula (Nueva Versión)
              </Button>
            </div>

            {/* Formula Items Table */}
            {formulaCostInfo && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-100 text-[#000] border-b border-[#D9D9D9] text-left">
                      <th className="py-2.5 px-3">CÓDIGO MPR</th>
                      <th className="py-2.5 px-3">MATERIA PRIMA</th>
                      <th className="py-2.5 px-3 text-right">CANTIDAD (KG)</th>
                      <th className="py-2.5 px-3 text-right">COSTO BRUTO / KG</th>
                      <th className="py-2.5 px-3 text-right">COSTO FINAL FILA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {formulaCostInfo.items.map((it) => (
                      <tr key={it.rawMaterialId} className="hover:bg-gray-50">
                        <td className="py-2.5 px-3 font-bold text-gray-700">{it.rawMaterialCode}</td>
                        <td className="py-2.5 px-3 font-semibold text-[#393939]">{it.rawMaterialName}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-gray-900">{it.quantityKg.toFixed(3)} kg</td>
                        <td className="py-2.5 px-3 text-right text-gray-600">$ {it.unitCostGrossArs.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-[#000]">
                          $ {Math.round(it.lineCostArs).toLocaleString('es-AR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Totals Box */}
            {formulaCostInfo && (
              <div className="p-4 bg-gray-50 border border-[#D9D9D9] rounded-lg grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Total Kg Granel</span>
                  <p className="text-lg font-bold text-[#000000]">{formulaCostInfo.totalKg.toFixed(3)} kg</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Costo Granel Total</span>
                  <p className="text-lg font-bold text-[#000000]">
                    $ {Math.round(formulaCostInfo.totalCostArs).toLocaleString('es-AR')}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Costo Producto Base / Kg</span>
                  <p className="text-xl font-bold text-[#B99D22]">$ {formulaCostInfo.costPerKgArs.toFixed(2)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Version History Table */}
          <div className="bg-white p-5 rounded-lg border border-[#D9D9D9] shadow-xs">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700 mb-3 flex items-center gap-2">
              <History className="w-4 h-4 text-gray-500" /> Historial de Versiones de Fórmula
            </h3>
            <div className="divide-y divide-gray-100 text-xs">
              {versions.map((v) => (
                <div key={v.id} className="py-2.5 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-sm">Versión {v.version_number}</span>
                    {v.is_current && (
                      <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-[#008102]">
                        VIGENTE
                      </span>
                    )}
                    <p className="text-gray-500">{v.observations || 'Sin observaciones'}</p>
                  </div>
                  <span className="text-gray-400">{new Date(v.created_at).toLocaleDateString('es-AR')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: New Formula / PBA */}
      <Modal title="Crear Nueva Fórmula y Producto Base" isOpen={newFormulaModalOpen} onClose={() => setNewFormulaModalOpen(false)}>
        <div className="space-y-4">
          {modalError && <div className="p-3 bg-red-100 text-[#DD0000] rounded text-sm font-semibold">{modalError}</div>}

          <FormField label="Nombre del Nuevo Producto Base (PBA)">
            <input
              type="text"
              className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full font-bold"
              placeholder="Ej: Acondicionador Argán Intenso"
              value={newPbaName}
              onChange={(e) => setNewPbaName(e.target.value)}
            />
          </FormField>

          <FormField label="Observaciones">
            <input
              type="text"
              className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full"
              placeholder="Ej: Fórmula inicial de laboratorio"
              value={newObservations}
              onChange={(e) => setNewObservations(e.target.value)}
            />
          </FormField>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase">Materias Primas (kg)</h3>
              <button
                type="button"
                onClick={() =>
                  setNewRecipeRows([...newRecipeRows, { rawMaterialId: rawMaterials[0]?.id || '', quantityKg: 10 }])
                }
                className="text-xs font-bold text-[#B99D22] hover:underline"
              >
                + Agregar Materia Prima
              </button>
            </div>

            {newRecipeRows.map((r, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <select
                  className="h-9 px-2 border border-[#D9D9D9] rounded flex-1 bg-white text-xs"
                  value={r.rawMaterialId}
                  onChange={(e) => {
                    const copy = [...newRecipeRows];
                    copy[idx].rawMaterialId = e.target.value;
                    setNewRecipeRows(copy);
                  }}
                >
                  {rawMaterials.map((rm) => (
                    <option key={rm.id} value={rm.id}>
                      {rm.name} ({rm.code})
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  className="w-28 h-9 px-2 border border-[#D9D9D9] rounded text-xs font-bold"
                  value={r.quantityKg}
                  onChange={(e) => {
                    const copy = [...newRecipeRows];
                    copy[idx].quantityKg = parseFloat(e.target.value) || 0;
                    setNewRecipeRows(copy);
                  }}
                />
                <span className="text-xs text-gray-500 font-semibold">kg</span>

                {newRecipeRows.length > 1 && (
                  <button
                    onClick={() => setNewRecipeRows(newRecipeRows.filter((_, i) => i !== idx))}
                    className="text-red-500 font-bold px-1"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[#D9D9D9]">
            <Button variant="secundario" onClick={() => setNewFormulaModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="principal" onClick={handleSaveNewFormula}>
              Guardar Fórmula y Crear PBA
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Edit Formula (New Version) */}
      <Modal title={`Editar Fórmula — ${selectedBaseProduct?.name}`} isOpen={editModalOpen} onClose={() => setEditModalOpen(false)}>
        <div className="space-y-4">
          {modalError && <div className="p-3 bg-red-100 text-[#DD0000] rounded text-sm font-semibold">{modalError}</div>}

          <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900">
            <strong>Regla de negocio:</strong> Modificar una fórmula conserva el mismo código PBA e incrementa el número
            de versión. Los lotes de granel y ventas fabricadas con versiones anteriores permanecen inmutables.
          </div>

          <FormField label="Motivo / Observaciones de la nueva versión">
            <input
              type="text"
              className="h-[40px] px-3 border border-[#D9D9D9] rounded w-full"
              value={editObservations}
              onChange={(e) => setEditObservations(e.target.value)}
            />
          </FormField>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase">Materias Primas (kg)</h3>
              <button
                type="button"
                onClick={() =>
                  setEditRecipeRows([...editRecipeRows, { rawMaterialId: rawMaterials[0]?.id || '', quantityKg: 10 }])
                }
                className="text-xs font-bold text-[#B99D22] hover:underline"
              >
                + Agregar Materia Prima
              </button>
            </div>

            {editRecipeRows.map((r, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <select
                  className="h-9 px-2 border border-[#D9D9D9] rounded flex-1 bg-white text-xs"
                  value={r.rawMaterialId}
                  onChange={(e) => {
                    const copy = [...editRecipeRows];
                    copy[idx].rawMaterialId = e.target.value;
                    setEditRecipeRows(copy);
                  }}
                >
                  {rawMaterials.map((rm) => (
                    <option key={rm.id} value={rm.id}>
                      {rm.name} ({rm.code})
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  className="w-28 h-9 px-2 border border-[#D9D9D9] rounded text-xs font-bold"
                  value={r.quantityKg}
                  onChange={(e) => {
                    const copy = [...editRecipeRows];
                    copy[idx].quantityKg = parseFloat(e.target.value) || 0;
                    setEditRecipeRows(copy);
                  }}
                />
                <span className="text-xs text-gray-500 font-semibold">kg</span>

                {editRecipeRows.length > 1 && (
                  <button
                    onClick={() => setEditRecipeRows(editRecipeRows.filter((_, i) => i !== idx))}
                    className="text-red-500 font-bold px-1"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[#D9D9D9]">
            <Button variant="secundario" onClick={() => setEditModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="principal" onClick={handleSaveEditVersion}>
              Guardar Nueva Versión
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
