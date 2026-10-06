'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, ConfirmDialog } from '../components/UIComponents';
import { SupplierModal } from '../modals/SupplierModal';
import { toggleSupplierActiveAction, type SupplierDTO } from '@/actions/supplier.actions';
import {
  ChevronLeft,
  ChevronDown,
  Edit3,
  Power,
  RefreshCw,
  Search,
  List,
  Building2,
} from 'lucide-react';

interface SuppliersViewProps {
  initialSuppliers: SupplierDTO[];
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({ initialSuppliers }) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Vista activa: 'ficha' (CUENTAS-PROVEEDORES.png) o 'listado' (ADMINISTRACION.png)
  const [viewMode, setViewMode] = useState<'ficha' | 'listado'>('ficha');

  // Proveedor seleccionado para la Ficha
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(
    initialSuppliers[0]?.id || ''
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [currencyFilter, setCurrencyFilter] = useState<'ALL' | 'ARS' | 'USD'>('ALL');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSupplier, setModalSupplier] = useState<SupplierDTO | null>(null);

  // Confirm Dialog for deactivating
  const [confirmDialogSupplier, setConfirmDialogSupplier] = useState<SupplierDTO | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const selectedSupplier =
    initialSuppliers.find((s) => s.id === selectedSupplierId) || initialSuppliers[0] || null;

  // Filtrado de proveedores para el listado
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
    setModalSupplier(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (supplier: SupplierDTO) => {
    setModalSupplier(supplier);
    setModalOpen(true);
  };

  const handleToggleActiveClick = (supplier: SupplierDTO) => {
    if (supplier.active) {
      setConfirmDialogSupplier(supplier);
    } else {
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
      amount: num,
    };
  };

  return (
    <div className="space-y-4">
      
      {/* Subheader superior exacto a CUENTAS-PROVEEDORES.png de Figma */}
      <div className="flex items-center justify-between text-xs px-1">
        <Link
          href="/"
          className="text-[#0E50A0] font-bold text-sm hover:underline flex items-center gap-1 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Volver</span>
        </Link>
        <span className="font-bold text-sm uppercase tracking-wider text-black">
          CUENTAS PROVEEDORES
        </span>
      </div>

      {/* Tarjeta Principal de Cuentas Proveedores */}
      <div className="bg-white rounded-2xl border border-[#D9D9D9] p-6 shadow-xs space-y-6">
        
        {/* Barra Superior con Selector de Proveedores y Botón Nueva Cuenta */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          
          {/* Selector de Proveedores estilo Figma (Proveedor 1, Proveedor 2... / Dropdown) */}
          <div className="flex flex-wrap items-center gap-2">
            {initialSuppliers.slice(0, 5).map((s) => {
              const isSelected = selectedSupplier?.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSelectedSupplierId(s.id);
                    setViewMode('ficha');
                  }}
                  className={`text-xs uppercase font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors ${
                    isSelected && viewMode === 'ficha'
                      ? 'border-2 border-[#0E50A0] text-[#0E50A0] bg-white'
                      : 'text-[#0E50A0] hover:bg-blue-50'
                  }`}
                >
                  <span className="truncate max-w-[120px]">{s.name}</span>
                  <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                </button>
              );
            })}

            {/* Selector desplegable para ver más proveedores */}
            {initialSuppliers.length > 5 && (
              <select
                value={selectedSupplierId}
                onChange={(e) => {
                  setSelectedSupplierId(e.target.value);
                  setViewMode('ficha');
                }}
                className="text-xs uppercase font-bold text-[#0E50A0] bg-white border border-[#D9D9D9] rounded-lg px-2 py-1.5 focus:outline-none cursor-pointer"
              >
                <option value="" disabled>
                  VER MAS ({initialSuppliers.length - 5})
                </option>
                {initialSuppliers.slice(5).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
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
                  <span>Ver Todos ({initialSuppliers.length})</span>
                </>
              ) : (
                <>
                  <Building2 className="w-3.5 h-3.5" />
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

        {/* MODO 1: FICHA PROVEEDOR INDIVIDUAL (idéntica a CUENTAS-PROVEEDORES.png de Figma) */}
        {viewMode === 'ficha' && selectedSupplier && (
          <div className="space-y-6">
            
            {/* Sección FICHA PROVEEDOR con datos clave y lápiz de edición */}
            <div className="border border-[#D9D9D9] rounded-xl p-5 bg-white space-y-4">
              <div className="flex items-center justify-between border-b border-black pb-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-bold text-black uppercase tracking-wider">
                    FICHA PROVEEDOR
                  </h2>
                  <span className="text-base font-bold text-black">
                    {selectedSupplier.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenEdit(selectedSupplier)}
                  title="Editar Ficha Proveedor"
                  className="p-1 rounded text-gray-600 hover:text-[#0E50A0] transition-colors cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>

              {/* Fila de Datos según Figma */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-black">
                <div className="flex items-center gap-2">
                  <span className="font-bold">Codigo</span>
                  <span className="font-mono">{selectedSupplier.code}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">Vendedor</span>
                  <span>{selectedSupplier.salesperson || '-'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">Telefono</span>
                  <span>{selectedSupplier.phone || '-'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">Moneda</span>
                  <span className="font-bold text-[#0E50A0]">{selectedSupplier.currencyCode}</span>
                </div>
              </div>
            </div>

            {/* Dos Columnas inferiores según Figma CUENTAS-PROVEEDORES.png:
                Col 1: MATERIAS PRIMAS/COMPONENTES
                Col 2: MOVIMIENTOS y SALDO ACTUALIZADO */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Columna Izquierda (4/12): Materias Primas / Componentes asociados */}
              <div className="lg:col-span-5 border border-[#D9D9D9] rounded-xl p-5 bg-white space-y-4">
                <div className="border-b border-black pb-2">
                  <h3 className="text-sm font-bold text-black uppercase tracking-wider">
                    MATERIAS PRIMAS/COMPONENTES
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#D9D9D9] text-black font-bold text-left uppercase">
                        <th className="py-2 px-2">CODIGO</th>
                        <th className="py-2 px-2">MP</th>
                        <th className="py-2 px-2">INCI</th>
                        <th className="py-2 px-2 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E5E5]">
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-gray-400 font-medium">
                          Insumos asociados a este proveedor en el maestro de compras y catálogo.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Columna Derecha (7/12): Movimientos y Saldo Actualizado */}
              <div className="lg:col-span-7 border border-[#D9D9D9] rounded-xl p-5 bg-white space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-black pb-2">
                  <h3 className="text-sm font-bold text-black uppercase tracking-wider">
                    MOVIMIENTOS
                  </h3>

                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Buscar"
                      className="h-8 pl-3 pr-8 text-xs border border-[#D9D9D9] rounded-lg w-44 sm:w-52 focus:outline-none focus:border-[#0E50A0] placeholder-gray-400 text-black"
                    />
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#D9D9D9] text-black font-bold text-left uppercase">
                        <th className="py-2 px-2">FECHA</th>
                        <th className="py-2 px-2">COMPRA</th>
                        <th className="py-2 px-2">REMITO</th>
                        <th className="py-2 px-2">PAGO</th>
                        <th className="py-2 px-2 text-right">TOTAL</th>
                        <th className="py-2 px-2 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E5E5]">
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-gray-400 font-medium">
                          Historial de compras, remitos y órdenes de pago en cuenta corriente.
                        </td>
                      </tr>

                      {/* Fila de SALDO ACTUALIZADO con fondo salmón si tiene deuda según Figma */}
                      {(() => {
                        const bal = formatBalance(selectedSupplier.balance, selectedSupplier.currencyCode);
                        return (
                          <tr
                            className={`font-bold text-sm ${
                              bal.hasDebt
                                ? 'bg-[#FFA8A8] text-black'
                                : 'bg-gray-50 text-black'
                            }`}
                          >
                            <td colSpan={4} className="py-3 px-3 uppercase tracking-wider">
                              SALDO ACTUALIZADO
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-base">
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
                    onClick={() => alert('Módulo de registro de pagos a proveedores se activará en Administración')}
                    className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider"
                  >
                    REGISTRAR PAGO
                  </Button>
                  <Button
                    variant="azul"
                    onClick={() => alert('Generación de PDF disponible en el bloque de Reportes/PDF')}
                    className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider"
                  >
                    PDF ESTADO DE CUENTA
                  </Button>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* MODO 2: LISTADO COMPLETO DE PROVEEDORES (Directorio) */}
        {viewMode === 'listado' && (
          <div className="border border-[#D9D9D9] rounded-xl p-5 bg-white space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-black pb-2">
              <h2 className="text-base font-bold text-black uppercase tracking-wider">
                Directorio de Proveedores
              </h2>

              <div className="flex flex-wrap items-center gap-3">
                {/* Filtro moneda */}
                <select
                  value={currencyFilter}
                  onChange={(e) => setCurrencyFilter(e.target.value as any)}
                  className="h-8 px-2 border border-[#D9D9D9] rounded-md text-xs bg-white text-gray-800"
                >
                  <option value="ALL">Todas las monedas</option>
                  <option value="ARS">Solo ARS ($)</option>
                  <option value="USD">Solo USD (US$)</option>
                </select>

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
                    placeholder="Buscar proveedor..."
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
                    <th className="py-2.5 px-3">PROVEEDOR</th>
                    <th className="py-2.5 px-3">MONEDA</th>
                    <th className="py-2.5 px-3">VENDEDOR / CONTACTO</th>
                    <th className="py-2.5 px-3">TELEFONO</th>
                    <th className="py-2.5 px-3 text-right">DEUDA VIGENTE</th>
                    <th className="py-2.5 px-3 text-center">ESTADO</th>
                    <th className="py-2.5 px-3 text-center">ACCIONES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E5]">
                  {filteredSuppliers.map((s) => {
                    const bal = formatBalance(s.balance, s.currencyCode);
                    return (
                      <tr
                        key={s.id}
                        className={`hover:bg-gray-50 transition-colors ${
                          !s.active ? 'opacity-60 bg-gray-50' : ''
                        }`}
                      >
                        <td className="py-3 px-3 font-mono font-bold text-black">{s.code}</td>
                        <td className="py-3 px-3 font-semibold text-black">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSupplierId(s.id);
                              setViewMode('ficha');
                            }}
                            className="text-left hover:text-[#0E50A0] hover:underline cursor-pointer"
                          >
                            {s.name}
                          </button>
                        </td>
                        <td className="py-3 px-3 font-bold text-[#0E50A0]">{s.currencyCode}</td>
                        <td className="py-3 px-3 text-gray-700">{s.salesperson || '-'}</td>
                        <td className="py-3 px-3 text-gray-700">{s.phone || '-'}</td>
                        <td
                          className={`py-3 px-3 text-right font-mono font-bold ${
                            bal.hasDebt ? 'text-[#DD0000]' : 'text-gray-800'
                          }`}
                        >
                          {bal.text}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              s.active ? 'bg-emerald-50 text-[#008102]' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {s.active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap space-x-1">
                          <button
                            onClick={() => {
                              setSelectedSupplierId(s.id);
                              setViewMode('ficha');
                            }}
                            title="Ver Ficha"
                            className="p-1 rounded hover:bg-black/10 text-[#0E50A0] transition-colors cursor-pointer"
                          >
                            <Building2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(s)}
                            title="Editar Proveedor"
                            className="p-1 rounded hover:bg-black/10 text-gray-700 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleActiveClick(s)}
                            title={s.active ? 'Desactivar proveedor' : 'Activar proveedor'}
                            className={`p-1 rounded hover:bg-black/10 transition-colors cursor-pointer ${
                              s.active ? 'text-gray-500 hover:text-red-700' : 'text-[#008102]'
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

      {/* Modal de Proveedor */}
      <SupplierModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        supplier={modalSupplier}
        onSuccess={() => {
          startTransition(() => {
            router.refresh();
          });
        }}
      />

      {/* ConfirmDialog para Desactivación */}
      {confirmDialogSupplier && (
        <ConfirmDialog
          isOpen={true}
          title="Desactivar Proveedor"
          message={`¿Estás seguro de que deseas desactivar al proveedor "${confirmDialogSupplier.name}" (${confirmDialogSupplier.code})?`}
          onConfirm={() => handleExecuteToggle(confirmDialogSupplier, false)}
          onCancel={() => setConfirmDialogSupplier(null)}
        />
      )}

    </div>
  );
};
