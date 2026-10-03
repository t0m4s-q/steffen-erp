// Main Application Layout conforming to DESIGN.md Section 9, 3.5 & 3.6

import React, { useState, useEffect } from 'react';
import { db } from './services/db';
import { initializeDatabaseIfNeeded } from './services/seed';
import { domainServices } from './services/domainServices';
import { DashboardView } from './ui/views/DashboardView';
import { FactoryView } from './ui/views/FactoryView';
import { OrdersView } from './ui/views/OrdersView';
import { StockView } from './ui/views/StockView';
import { FormulasView } from './ui/views/FormulasView';
import { AdminView } from './ui/views/AdminView';
import { ReportsView } from './ui/views/ReportsView';
import {
  ManufactureModal,
  PackagingModal,
  PurchaseModal,
  NewOrderModal,
  CompleteRtmModal,
} from './ui/modals/OperationalModals';
import {
  PaymentModal,
  ExpenseModal,
  WithdrawalModal,
  SettlementModal,
  StockAdjustmentModal,
  PdfViewerModal,
} from './ui/modals/AdminAndPdfModals';
import { NewItemModal } from './ui/modals/NewItemModal';
import { Menu, X, DollarSign, Wallet } from 'lucide-react';
import { UUID } from './types/domain';

type NavigationModule =
  | 'dashboard'
  | 'fabrica'
  | 'pedidos'
  | 'stock'
  | 'formulas'
  | 'administracion'
  | 'reportes';

export const App: React.FC = () => {
  // Ensure database is initialized with Fase 2 seed data
  useEffect(() => {
    initializeDatabaseIfNeeded();
  }, []);

  // Subscribe to DB state changes for automatic re-renders across all views
  const [, setTick] = useState(0);
  useEffect(() => {
    return db.subscribe(() => setTick((t) => t + 1));
  }, []);

  const [activeModule, setActiveModule] = useState<NavigationModule>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Modal manager
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [modalProps, setModalProps] = useState<any>({});

  const handleOpenModal = (modalName: string, props: any = {}) => {
    setActiveModal(modalName);
    setModalProps(props);
  };

  const handleCloseModal = () => {
    setActiveModal(null);
    setModalProps({});
  };

  const navItems: Array<{ id: NavigationModule; label: string }> = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'fabrica', label: 'Mi Fábrica' },
    { id: 'pedidos', label: 'Pedidos' },
    { id: 'stock', label: 'Stock' },
    { id: 'formulas', label: 'Fórmulas' },
    { id: 'administracion', label: 'Administración' },
    { id: 'reportes', label: 'Reportes' },
  ];

  const currentFx = domainServices.getCurrentExchangeRate();
  const cashSteffen =
    Object.values(db.getState().financialAccounts).find((a) => a.account_type === 'CASH_STEFFEN')
      ?.current_balance || 0;

  return (
    <div className="min-h-screen bg-[#FBFBFB] flex flex-col">
      {/* Navigation Header */}
      <header className="bg-white border-b border-[#D9D9D9] sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Brand Logo */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded bg-[#B99D22] flex items-center justify-center text-white font-bold text-lg shadow-xs">
                S
              </div>
              <div>
                <span className="font-black text-lg tracking-wider text-[#000000]">STEFFEN</span>
                <span className="hidden sm:inline text-[11px] text-gray-500 block leading-none font-medium">
                  Cosmética Capilar • ERP
                </span>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-1">
              {navItems.map((item) => {
                const isActive = activeModule === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveModule(item.id)}
                    className={`px-3 py-2 text-xs uppercase font-bold rounded transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#B99D22] text-white'
                        : 'text-[#393939] hover:bg-gray-100'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {/* Quick Status Pill (FX & Cash) */}
            <div className="hidden sm:flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1 text-gray-600 bg-gray-50 px-2.5 py-1 rounded border border-gray-200">
                <DollarSign className="w-3.5 h-3.5 text-[#B99D22]" />
                <span>USD: ${currentFx.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-1 text-gray-700 bg-gray-50 px-2.5 py-1 rounded border border-gray-200 font-semibold">
                <Wallet className="w-3.5 h-3.5 text-[#008102]" />
                <span>Caja: ${Math.round(cashSteffen).toLocaleString('es-AR')}</span>
              </div>
            </div>

            {/* Mobile Menu Button */}
            <div className="lg:hidden flex items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-md text-gray-700 hover:text-black hover:bg-gray-100"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer conforming to DESIGN.md Section 3.5 */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[#D9D9D9] bg-white px-4 pt-2 pb-4 space-y-1 shadow-md">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveModule(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3 py-2.5 rounded font-bold text-sm uppercase ${
                  activeModule === item.id ? 'bg-[#B99D22] text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {item.label}
              </button>
            ))}

            <div className="pt-2 border-t border-gray-200 flex justify-between text-xs text-gray-600 px-2">
              <span>USD: ${currentFx.toFixed(2)}</span>
              <span>Caja: ${Math.round(cashSteffen).toLocaleString('es-AR')}</span>
            </div>
          </div>
        )}
      </header>

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeModule === 'dashboard' && (
          <DashboardView onNavigate={(m) => setActiveModule(m as any)} onOpenModal={handleOpenModal} />
        )}
        {activeModule === 'fabrica' && <FactoryView onOpenModal={handleOpenModal} />}
        {activeModule === 'pedidos' && <OrdersView onOpenModal={handleOpenModal} />}
        {activeModule === 'stock' && <StockView onOpenModal={handleOpenModal} />}
        {activeModule === 'formulas' && <FormulasView />}
        {activeModule === 'administracion' && <AdminView onOpenModal={handleOpenModal} />}
        {activeModule === 'reportes' && <ReportsView />}
      </main>

      {/* Modals Container */}
      <ManufactureModal isOpen={activeModal === 'MANUFACTURE'} onClose={handleCloseModal} />
      <PackagingModal isOpen={activeModal === 'PACKAGING'} onClose={handleCloseModal} />
      <PurchaseModal isOpen={activeModal === 'PURCHASE'} onClose={handleCloseModal} />
      <NewOrderModal isOpen={activeModal === 'NEW_ORDER'} onClose={handleCloseModal} />
      {activeModal === 'COMPLETE_RTM' && (
        <CompleteRtmModal
          isOpen={true}
          remittanceId={modalProps.remittanceId}
          onClose={handleCloseModal}
        />
      )}
      <PaymentModal
        isOpen={activeModal === 'PAYMENT_CUSTOMER' || activeModal === 'PAYMENT_SUPPLIER'}
        type={activeModal === 'PAYMENT_CUSTOMER' ? 'CUSTOMER' : 'SUPPLIER'}
        onClose={handleCloseModal}
      />
      <ExpenseModal isOpen={activeModal === 'EXPENSE'} onClose={handleCloseModal} />
      <WithdrawalModal isOpen={activeModal === 'WITHDRAWAL'} onClose={handleCloseModal} />
      <SettlementModal isOpen={activeModal === 'SETTLEMENT'} onClose={handleCloseModal} />
      <StockAdjustmentModal isOpen={activeModal === 'STOCK_ADJUSTMENT'} onClose={handleCloseModal} />
      <NewItemModal isOpen={activeModal === 'NEW_ITEM'} onClose={handleCloseModal} />
      {activeModal === 'VIEW_PDF' && (
        <PdfViewerModal
          isOpen={true}
          docType={modalProps.docType}
          docId={modalProps.docId}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};
