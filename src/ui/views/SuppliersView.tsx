'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, ConfirmDialog } from '../components/UIComponents';
import { SupplierModal } from '../modals/SupplierModal';
import { toggleSupplierActiveAction, type SupplierDTO } from '@/actions/supplier.actions';
import { Truck, PlusCircle, Search, Edit3, Power, RefreshCw } from 'lucide-react';

interface SuppliersViewProps {
  initialSuppliers: SupplierDTO[];
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({ initialSuppliers }) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [currencyFilter, setCurrencyFilter] = useState<'ALL' | 'ARS' | 'USD'>('ALL');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierDTO | null>(null);

  // Confirm Dialog for deactivating
  const [confirmDialogSupplier, setConfirmDialogSupplier] = useState<SupplierDTO | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Filter suppliers
  const filteredSuppliers = initialSuppliers.filter((s) => {
    if (!showInactive && !s.active) return false;
    if (currencyFilter !== 'ALL' && s.currencyCode !== currencyFilter) return false;
    if (!searchTerm.trim()) return true;

    const term = searchTerm.toLowerCase();
    return (
      s.code.toLowerCase().includes(term) ||
      s.name.toLowerCase().includes(term) ||
      (s.salesperson && s.salesperson.toLowerCase().includes(term)) ||
      (s.phone && s.phone.toLowerCase().includes(term)) ||
      s.currencyCode.toLowerCase().includes(term)
    );
  });

  const handleOpenCreate = () => {
    setSelectedSupplier(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (supplier: SupplierDTO) => {
    setSelectedSupplier(supplier);
    setModalOpen(true);
  };

  const handleToggleActiveClick = (supplier: SupplierDTO) => {
    if (supplier.active) {
      // Si está activo, requiere confirmación explícita para desactivar
      setConfirmDialogSupplier(supplier);
    } else {
      // Si está inactivo, reactiva directamente
      handleExecuteToggle(supplier, true);
    }
  };

  const handleExecuteToggle = async (supplier: SupplierDTO, targetActive: boolean) => {
    setActionError(null);
    startTransition(async () => {
      const res = await toggleSupplierActiveAction(supplier.id, targetActive);
      if (!res.success) {
        setActionError(res.error || 'Error al cambiar estado del proveedor');
      } else {
        router.refresh();
      }
      setConfirmDialogSupplier(null);
    });
  };

  const formatBalance = (balanceStr: string, currency: 'ARS' | 'USD') => {
    const num = parseFloat(balanceStr) || 0;
    const isUsd = currency === 'USD';
    const formatted = isUsd
      ? num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : Math.round(num).toLocaleString('es-AR');

    return {
      text: isUsd ? `US$ ${formatted}` : `$ ${formatted}`,
      hasDebt: num > 0,
      hasCredit: num < 0,
    };
  };

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="w-6 h-6 text-[#B99D22]" />
            <h1 className="text-2xl font-bold text-slate-900">Maestro de Proveedores</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gestión comercial y operativa de proveedores de materias primas y componentes, monedas de liquidación y saldos en cuenta corriente.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secundario"
            onClick={() => {
              startTransition(() => {
                router.refresh();
              });
            }}
            disabled={isPending}
            className="flex items-center gap-1.5 text-xs"
            title="Refrescar lista desde el servidor"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
            <span>Refrescar</span>
          </Button>

          <Button
            variant="principal"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 text-xs"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Nuevo Proveedor</span>
          </Button>
        </div>
      </div>

      {actionError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-[#DD0000] flex justify-between items-center">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-slate-400 hover:text-slate-600 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por código, nombre, contacto o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 pl-9 pr-3 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#B99D22] focus:ring-1 focus:ring-[#B99D22]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600">
          {/* Filtro por moneda */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Moneda:</span>
            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value as 'ALL' | 'ARS' | 'USD')}
              className="h-8 px-2 border border-slate-200 rounded text-xs bg-white focus:outline-none focus:border-[#B99D22]"
            >
              <option value="ALL">Todas</option>
              <option value="ARS">ARS ($)</option>
              <option value="USD">USD (US$)</option>
            </select>
          </div>

          <span className="text-slate-300">|</span>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-slate-300 text-[#B99D22] focus:ring-[#B99D22] h-4 w-4"
            />
            <span>Mostrar inactivos</span>
          </label>

          <span className="text-slate-300">|</span>
          <span className="text-slate-500">
            Total: <strong>{filteredSuppliers.length}</strong> de {initialSuppliers.length}
          </span>
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredSuppliers.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            {searchTerm || currencyFilter !== 'ALL'
              ? 'No se encontraron proveedores que coincidan con los filtros aplicados.'
              : 'No hay proveedores registrados en el sistema.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-left">
                  <th className="py-3 px-4">CÓDIGO</th>
                  <th className="py-3 px-4">NOMBRE / RAZÓN SOCIAL</th>
                  <th className="py-3 px-4 text-center">MONEDA</th>
                  <th className="py-3 px-4">VENDEDOR / CONTACTO</th>
                  <th className="py-3 px-4">TELÉFONO</th>
                  <th className="py-3 px-4 text-right">SALDO CTA. CTE.</th>
                  <th className="py-3 px-4 text-center">ESTADO</th>
                  <th className="py-3 px-4 text-center">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSuppliers.map((s) => {
                  const balance = formatBalance(s.balance, s.currencyCode);

                  return (
                    <tr
                      key={s.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        !s.active ? 'opacity-60 bg-slate-50/50' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-[#B99D22]">
                        {s.code}
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <div>{s.name}</div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded font-mono font-bold text-[11px] border ${
                            s.currencyCode === 'USD'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {s.currencyCode}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-700">
                        {s.salesperson ? (
                          <span className="font-medium">{s.salesperson}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-600 font-mono">
                        {s.phone ? (
                          <span>{s.phone}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <span
                          className={`font-mono font-bold ${
                            balance.hasDebt
                              ? 'text-[#DD0000]'
                              : balance.hasCredit
                              ? 'text-[#008102]'
                              : 'text-slate-500'
                          }`}
                        >
                          {balance.text}
                        </span>
                        {balance.hasDebt && (
                          <p className="text-[10px] text-red-500 uppercase font-semibold">Deuda</p>
                        )}
                        {balance.hasCredit && (
                          <p className="text-[10px] text-emerald-600 uppercase font-semibold">A Favor</p>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {s.active ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            Inactivo
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenEdit(s)}
                          title="Editar Proveedor"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3 text-[#B99D22]" />
                          <span>Editar</span>
                        </button>

                        <button
                          onClick={() => handleToggleActiveClick(s)}
                          title={s.active ? 'Desactivar proveedor' : 'Activar proveedor'}
                          className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded transition-colors cursor-pointer ${
                            s.active
                              ? 'text-slate-400 hover:text-red-700 hover:bg-red-50'
                              : 'text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          <Power className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Alta / Edición */}
      <SupplierModal
        isOpen={modalOpen}
        supplier={selectedSupplier}
        onClose={() => setModalOpen(false)}
        onSuccess={() => {
          startTransition(() => {
            router.refresh();
          });
        }}
      />

      {/* Dialog de confirmación para desactivar */}
      {confirmDialogSupplier && (
        <ConfirmDialog
          isOpen={true}
          title="Desactivar Proveedor"
          message={`¿Estás seguro de que deseas desactivar al proveedor "${confirmDialogSupplier.name}" (${confirmDialogSupplier.code})? Ya no estará disponible para nuevas compras o cotizaciones.`}
          onConfirm={() => handleExecuteToggle(confirmDialogSupplier, false)}
          onCancel={() => setConfirmDialogSupplier(null)}
        />
      )}
    </div>
  );
};
