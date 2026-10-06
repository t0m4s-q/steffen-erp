'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, StatusBadge, ConfirmDialog } from '../components/UIComponents';
import { CustomerModal } from '../modals/CustomerModal';
import { toggleCustomerActiveAction, type CustomerDTO } from '@/actions/customer.actions';
import { Users, PlusCircle, Search, Edit3, Power, RefreshCw } from 'lucide-react';

interface CustomersViewProps {
  initialCustomers: CustomerDTO[];
}

export const CustomersView: React.FC<CustomersViewProps> = ({ initialCustomers }) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDTO | null>(null);

  // Confirm Dialog for deactivating
  const [confirmDialogCustomer, setConfirmDialogCustomer] = useState<CustomerDTO | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Filter customers
  const filteredCustomers = initialCustomers.filter((c) => {
    if (!showInactive && !c.active) return false;
    if (!searchTerm.trim()) return true;

    const term = searchTerm.toLowerCase();
    return (
      c.code.toLowerCase().includes(term) ||
      c.name.toLowerCase().includes(term) ||
      (c.phone && c.phone.toLowerCase().includes(term)) ||
      (c.locality && c.locality.toLowerCase().includes(term)) ||
      (c.province && c.province.toLowerCase().includes(term)) ||
      (c.transportName && c.transportName.toLowerCase().includes(term))
    );
  });

  const handleOpenCreate = () => {
    setSelectedCustomer(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (customer: CustomerDTO) => {
    setSelectedCustomer(customer);
    setModalOpen(true);
  };

  const handleToggleActiveClick = (customer: CustomerDTO) => {
    if (customer.active) {
      // If active, require confirmation to deactivate
      setConfirmDialogCustomer(customer);
    } else {
      // If inactive, reactivate directly
      handleExecuteToggle(customer, true);
    }
  };

  const handleExecuteToggle = async (customer: CustomerDTO, targetActive: boolean) => {
    setActionError(null);
    startTransition(async () => {
      const res = await toggleCustomerActiveAction(customer.id, targetActive);
      if (!res.success) {
        setActionError(res.error || 'Error al cambiar estado del cliente');
      } else {
        router.refresh();
      }
      setConfirmDialogCustomer(null);
    });
  };

  const formatBalance = (balanceStr: string) => {
    const num = parseFloat(balanceStr) || 0;
    const formatted = Math.round(num).toLocaleString('es-AR');
    return {
      text: `$ ${formatted}`,
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
            <Users className="w-6 h-6 text-[#B99D22]" />
            <h1 className="text-2xl font-bold text-slate-900">Maestro de Clientes</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gestión comercial de clientes, fichas de contacto, descuentos comerciales y saldos de cuentas corrientes.
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
            <span>+ Nuevo Cliente</span>
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
            placeholder="Buscar por código, nombre, teléfono, localidad o transporte..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 pl-9 pr-3 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#B99D22] focus:ring-1 focus:ring-[#B99D22]"
          />
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-slate-300 text-[#B99D22] focus:ring-[#B99D22] h-4 w-4"
            />
            <span>Mostrar inactivos</span>
          </label>

          <span className="text-slate-400">|</span>
          <span className="text-slate-500">
            Total: <strong>{filteredCustomers.length}</strong> de {initialCustomers.length}
          </span>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredCustomers.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            {searchTerm
              ? 'No se encontraron clientes que coincidan con la búsqueda.'
              : 'No hay clientes registrados en el sistema.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-left">
                  <th className="py-3 px-4">CÓDIGO</th>
                  <th className="py-3 px-4">NOMBRE / RAZÓN SOCIAL</th>
                  <th className="py-3 px-4">LOCALIDAD / TELÉFONO</th>
                  <th className="py-3 px-4">TRANSPORTE</th>
                  <th className="py-3 px-4 text-center">DESCUENTOS (%)</th>
                  <th className="py-3 px-4 text-right">SALDO CTA. CTE.</th>
                  <th className="py-3 px-4 text-center">ESTADO</th>
                  <th className="py-3 px-4 text-center">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((c) => {
                  const balance = formatBalance(c.balanceArs);
                  const hasDiscounts =
                    parseFloat(c.discount1Pct) > 0 ||
                    parseFloat(c.discount2Pct) > 0 ||
                    parseFloat(c.discount3Pct) > 0;

                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        !c.active ? 'opacity-60 bg-slate-50/50' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-[#B99D22]">
                        {c.code}
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <div>{c.name}</div>
                        {c.dni && (
                          <span className="text-[10px] text-slate-400 font-normal">
                            DNI/CUIT: {c.dni}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        <div>{c.locality ? `${c.locality}, ${c.province || ''}` : c.province || '-'}</div>
                        {c.phone && (
                          <div className="text-[11px] text-slate-500">{c.phone}</div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        {c.transportName ? (
                          <div>
                            <span className="font-medium text-slate-800">{c.transportName}</span>
                            {c.transportAddress && (
                              <p className="text-[10px] text-slate-400">{c.transportAddress}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {hasDiscounts ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-mono text-[11px] font-semibold">
                            {c.discount1Pct}% / {c.discount2Pct}% / {c.discount3Pct}%
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">0%</span>
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
                      </td>

                      <td className="py-3 px-4 text-center">
                        {c.active ? (
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
                          onClick={() => handleOpenEdit(c)}
                          title="Editar Ficha"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3 text-[#B99D22]" />
                          <span>Editar</span>
                        </button>

                        <button
                          onClick={() => handleToggleActiveClick(c)}
                          title={c.active ? 'Desactivar cliente' : 'Activar cliente'}
                          className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded transition-colors cursor-pointer ${
                            c.active
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
      <CustomerModal
        isOpen={modalOpen}
        customer={selectedCustomer}
        onClose={() => setModalOpen(false)}
        onSuccess={() => {
          startTransition(() => {
            router.refresh();
          });
        }}
      />

      {/* Dialog de confirmación para desactivar */}
      {confirmDialogCustomer && (
        <ConfirmDialog
          isOpen={true}
          title="Desactivar Cliente"
          message={`¿Estás seguro de que deseas desactivar al cliente "${confirmDialogCustomer.name}" (${confirmDialogCustomer.code})? Ya no estará disponible para nuevos pedidos.`}
          onConfirm={() => handleExecuteToggle(confirmDialogCustomer, false)}
          onCancel={() => setConfirmDialogCustomer(null)}
        />
      )}
    </div>
  );
};
