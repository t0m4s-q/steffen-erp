'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, ConfirmDialog } from '../components/UIComponents';
import { CustomerModal } from '../modals/CustomerModal';
import { toggleCustomerActiveAction, type CustomerDTO } from '@/actions/customer.actions';
import {
  ChevronLeft,
  ChevronDown,
  Edit3,
  Power,
  RefreshCw,
  Search,
  List,
  UserCheck,
} from 'lucide-react';

interface CustomersViewProps {
  initialCustomers: CustomerDTO[];
}

export const CustomersView: React.FC<CustomersViewProps> = ({ initialCustomers }) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Vista activa: 'ficha' (CUENTAS-CLIENTES.png) o 'listado' (ADMINISTRACION.png)
  const [viewMode, setViewMode] = useState<'ficha' | 'listado'>('ficha');

  // Cliente seleccionado para la Ficha
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    initialCustomers[0]?.id || ''
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCustomer, setModalCustomer] = useState<CustomerDTO | null>(null);

  // Confirm Dialog for deactivating
  const [confirmDialogCustomer, setConfirmDialogCustomer] = useState<CustomerDTO | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const selectedCustomer =
    initialCustomers.find((c) => c.id === selectedCustomerId) || initialCustomers[0] || null;

  // Filtrado de clientes para listado
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
    setModalCustomer(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (customer: CustomerDTO) => {
    setModalCustomer(customer);
    setModalOpen(true);
  };

  const handleToggleActiveClick = (customer: CustomerDTO) => {
    if (customer.active) {
      setConfirmDialogCustomer(customer);
    } else {
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
      amount: num,
    };
  };

  return (
    <div className="space-y-4">
      
      {/* Subheader superior exacto a CUENTAS-CLIENTES.png de Figma */}
      <div className="flex items-center justify-between text-xs px-1">
        <Link
          href="/"
          className="text-[#0E50A0] font-bold text-sm hover:underline flex items-center gap-1 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Volver</span>
        </Link>
        <span className="font-bold text-sm uppercase tracking-wider text-black">
          CUENTAS CLIENTES
        </span>
      </div>

      {/* Tarjeta Principal de Cuentas Clientes */}
      <div className="bg-white rounded-2xl border border-[#D9D9D9] p-6 shadow-xs space-y-6">
        
        {/* Barra Superior con Selector de Clientes y Botón Nueva Cuenta */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          
          {/* Selector de Clientes estilo Figma (Cliente 1, Cliente 2... / Dropdown) */}
          <div className="flex flex-wrap items-center gap-2">
            {initialCustomers.slice(0, 5).map((c) => {
              const isSelected = selectedCustomer?.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedCustomerId(c.id);
                    setViewMode('ficha');
                  }}
                  className={`text-xs uppercase font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors ${
                    isSelected && viewMode === 'ficha'
                      ? 'border-2 border-[#0E50A0] text-[#0E50A0] bg-white'
                      : 'text-[#0E50A0] hover:bg-blue-50'
                  }`}
                >
                  <span className="truncate max-w-[120px]">{c.name}</span>
                  <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                </button>
              );
            })}

            {/* Selector desplegable para ver más clientes */}
            {initialCustomers.length > 5 && (
              <select
                value={selectedCustomerId}
                onChange={(e) => {
                  setSelectedCustomerId(e.target.value);
                  setViewMode('ficha');
                }}
                className="text-xs uppercase font-bold text-[#0E50A0] bg-white border border-[#D9D9D9] rounded-lg px-2 py-1.5 focus:outline-none cursor-pointer"
              >
                <option value="" disabled>
                  VER MAS ({initialCustomers.length - 5})
                </option>
                {initialCustomers.slice(5).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            )}

            {/* Alternar vista de Directorio completo */}
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'ficha' ? 'listado' : 'ficha')}
              className={`text-xs uppercase font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors ${
                viewMode === 'listado'
                  ? 'border-2 border-[#D2AB68] text-[#D2AB68] bg-white'
                  : 'border-[#D9D9D9] text-gray-700 hover:bg-gray-100'
              }`}
            >
              {viewMode === 'ficha' ? (
                <>
                  <List className="w-3.5 h-3.5" />
                  <span>Ver Todos ({initialCustomers.length})</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Ver Ficha</span>
                </>
              )}
            </button>
          </div>

          {/* Botones a la derecha: Refrescar y Nueva Cuenta (Azul Figma) */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                startTransition(() => {
                  router.refresh();
                });
              }}
              disabled={isPending}
              title="Refrescar datos del servidor"
              className="p-2 border border-[#D9D9D9] rounded-[2px] text-gray-600 hover:text-black hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
            </button>

            <Button
              variant="azul"
              onClick={handleOpenCreate}
              className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider"
            >
              NUEVA CUENTA
            </Button>
          </div>

        </div>

        {actionError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-[#DD0000] flex justify-between items-center">
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} className="text-gray-400 hover:text-black font-bold">
              ✕
            </button>
          </div>
        )}

        {/* MODO 1: FICHA CLIENTE INDIVIDUAL (idéntica a CUENTAS-CLIENTES.png de Figma) */}
        {viewMode === 'ficha' && selectedCustomer && (
          <div className="space-y-6">
            
            {/* Sección FICHA CLIENTE con 3 columnas de datos y lápiz de edición */}
            <div className="border border-[#D9D9D9] rounded-xl p-5 bg-white space-y-4">
              <div className="flex items-center justify-between border-b border-black pb-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-bold text-black uppercase tracking-wider">
                    FICHA CLIENTE
                  </h2>
                  <span className="text-base font-bold text-black">
                    {selectedCustomer.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenEdit(selectedCustomer)}
                  title="Editar Ficha Cliente"
                  className="p-1 rounded text-gray-600 hover:text-[#0E50A0] transition-colors cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>

              {/* Grid de 3 Columnas según Figma */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-black">
                
                {/* Columna 1 */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold w-24">Codigo</span>
                    <span className="font-mono">{selectedCustomer.code}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold w-24">Domicilio</span>
                    <span>{selectedCustomer.address || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold w-24">Localidad</span>
                    <span>{selectedCustomer.locality || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold w-24">Telefono</span>
                    <span>{selectedCustomer.phone || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold w-24">Fecha registro</span>
                    <span>
                      {selectedCustomer.createdAt
                        ? new Date(selectedCustomer.createdAt).toLocaleDateString('es-AR')
                        : '-'}
                    </span>
                  </div>
                </div>

                {/* Columna 2 */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold w-28">Dni / CUIT</span>
                    <span>{selectedCustomer.dni || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold w-28">Provincia</span>
                    <span>{selectedCustomer.province || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold w-28">Transporte</span>
                    <span>{selectedCustomer.transportName || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold w-28">Dir. Transporte</span>
                    <span>{selectedCustomer.transportAddress || '-'}</span>
                  </div>
                </div>

                {/* Columna 3 */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold w-24">Categoria</span>
                    <span>{selectedCustomer.category || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold w-24">Descuento 1</span>
                    <span>{selectedCustomer.discount1Pct}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold w-24">Descuento 2</span>
                    <span>{selectedCustomer.discount2Pct}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold w-24">Descuento 3</span>
                    <span>{selectedCustomer.discount3Pct}%</span>
                  </div>
                </div>

              </div>
            </div>

            {/* Sección MOVIMIENTOS y SALDO ACTUALIZADO */}
            <div className="border border-[#D9D9D9] rounded-xl p-5 bg-white space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-black pb-2">
                <h2 className="text-base font-bold text-black uppercase tracking-wider">
                  MOVIMIENTOS
                </h2>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="Buscar"
                    className="h-8 pl-3 pr-8 text-xs border border-[#D9D9D9] rounded-lg w-52 sm:w-64 focus:outline-none focus:border-[#0E50A0] placeholder-gray-400 text-black"
                  />
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Tabla de Movimientos */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#D9D9D9] text-black font-bold text-left uppercase">
                      <th className="py-2.5 px-3">FECHA</th>
                      <th className="py-2.5 px-3">VENTA</th>
                      <th className="py-2.5 px-3">REMITO</th>
                      <th className="py-2.5 px-3">PAGO</th>
                      <th className="py-2.5 px-3 text-right">TOTAL</th>
                      <th className="py-2.5 px-3 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E5E5]">
                    {/* Fila Informativa sobre movimientos de cuenta corriente */}
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-gray-400 font-medium">
                        El historial de ventas, remitos y cobranzas se integrará con el motor de ventas en Fase 4.
                      </td>
                    </tr>

                    {/* Fila de SALDO ACTUALIZADO con fondo salmón si tiene deuda según Figma */}
                    {(() => {
                      const bal = formatBalance(selectedCustomer.balanceArs);
                      return (
                        <tr
                          className={`font-bold text-sm ${
                            bal.hasDebt
                              ? 'bg-[#FFA8A8] text-black'
                              : 'bg-gray-50 text-black'
                          }`}
                        >
                          <td colSpan={4} className="py-3 px-4 uppercase tracking-wider">
                            SALDO ACTUALIZADO
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-base">
                            {bal.text}
                          </td>
                          <td></td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Botones inferiores derechos: REGISTRAR PAGO (Verde) y PDF ESTADO DE CUENTA (Azul) */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <Button
                  variant="verde"
                  onClick={() => alert('Módulo de registro de pagos se activará en el bloque de Administración')}
                  className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider"
                >
                  REGISTRAR PAGO
                </Button>
                <Button
                  variant="azul"
                  onClick={() => alert('Generación de PDF de estado de cuenta disponible en el bloque de Reportes/PDF')}
                  className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider"
                >
                  PDF ESTADO DE CUENTA
                </Button>
              </div>

            </div>

          </div>
        )}

        {/* MODO 2: LISTADO COMPLETO DE CLIENTES (Directorio) */}
        {viewMode === 'listado' && (
          <div className="border border-[#D9D9D9] rounded-xl p-5 bg-white space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-black pb-2">
              <h2 className="text-base font-bold text-black uppercase tracking-wider">
                Directorio de Clientes
              </h2>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showInactive}
                    onChange={(e) => setShowInactive(e.target.checked)}
                    className="rounded border-gray-300 text-[#0E50A0] focus:ring-[#0E50A0] h-3.5 w-3.5"
                  />
                  <span>Inactivos</span>
                </label>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="Buscar cliente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-8 pl-3 pr-8 text-xs border border-[#D9D9D9] rounded-lg w-52 sm:w-64 focus:outline-none focus:border-[#0E50A0] placeholder-gray-400 text-black"
                  />
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-black text-black font-bold text-left uppercase">
                    <th className="py-2.5 px-3">CODIGO</th>
                    <th className="py-2.5 px-3">CLIENTE</th>
                    <th className="py-2.5 px-3">LOCALIDAD / PROV.</th>
                    <th className="py-2.5 px-3">TELEFONO</th>
                    <th className="py-2.5 px-3 text-right">SALDO CT</th>
                    <th className="py-2.5 px-3 text-center">ESTADO</th>
                    <th className="py-2.5 px-3 text-center">ACCIONES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E5]">
                  {filteredCustomers.map((c) => {
                    const bal = formatBalance(c.balanceArs);
                    return (
                      <tr
                        key={c.id}
                        className={`hover:bg-gray-50 transition-colors ${
                          !c.active ? 'opacity-60 bg-gray-50' : ''
                        }`}
                      >
                        <td className="py-3 px-3 font-mono font-bold text-black">{c.code}</td>
                        <td className="py-3 px-3 font-semibold text-black">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCustomerId(c.id);
                              setViewMode('ficha');
                            }}
                            className="text-left hover:text-[#0E50A0] hover:underline cursor-pointer"
                          >
                            {c.name}
                          </button>
                        </td>
                        <td className="py-3 px-3 text-gray-700">
                          {c.locality ? `${c.locality}, ${c.province || ''}` : '-'}
                        </td>
                        <td className="py-3 px-3 text-gray-700">{c.phone || '-'}</td>
                        <td
                          className={`py-3 px-3 text-right font-mono font-bold ${
                            bal.hasDebt ? 'text-[#DD0000]' : 'text-[#008102]'
                          }`}
                        >
                          {bal.text}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              c.active ? 'bg-emerald-50 text-[#008102]' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {c.active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap space-x-1">
                          <button
                            onClick={() => {
                              setSelectedCustomerId(c.id);
                              setViewMode('ficha');
                            }}
                            title="Ver Ficha"
                            className="p-1 rounded hover:bg-black/10 text-[#0E50A0] transition-colors cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(c)}
                            title="Editar Cliente"
                            className="p-1 rounded hover:bg-black/10 text-gray-700 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleActiveClick(c)}
                            title={c.active ? 'Desactivar cliente' : 'Activar cliente'}
                            className={`p-1 rounded hover:bg-black/10 transition-colors cursor-pointer ${
                              c.active ? 'text-gray-500 hover:text-red-700' : 'text-[#008102]'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* Modal de Cliente */}
      <CustomerModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        customer={modalCustomer}
        onSuccess={() => {
          startTransition(() => {
            router.refresh();
          });
        }}
      />

      {/* ConfirmDialog para Desactivación */}
      {confirmDialogCustomer && (
        <ConfirmDialog
          isOpen={true}
          title="Desactivar Cliente"
          message={`¿Estás seguro de que deseas desactivar al cliente "${confirmDialogCustomer.name}" (${confirmDialogCustomer.code})?`}
          onConfirm={() => handleExecuteToggle(confirmDialogCustomer, false)}
          onCancel={() => setConfirmDialogCustomer(null)}
        />
      )}

    </div>
  );
};
