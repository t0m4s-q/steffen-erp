// Core UI Components conforming to COMPONENTS.md & DESIGN.md

import React, { ReactNode } from 'react';
import { X, AlertCircle } from 'lucide-react';

// Buttons
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'principal' | 'secundario' | 'verde' | 'rojo' | 'azul';
  size?: 'small' | 'large';
  children: ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'principal',
  size = 'small',
  className = '',
  disabled,
  children,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-semibold rounded-[2px] transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

  const sizeClasses = size === 'large' ? 'h-[70px] px-6 text-base font-bold' : 'h-[38px] px-4 text-xs font-bold uppercase';

  let variantClasses = '';
  switch (variant) {
    case 'principal':
      variantClasses = 'bg-[#D2AB68] hover:bg-[#c29b58] text-white border border-[#D2AB68]';
      break;
    case 'secundario':
      variantClasses = 'bg-white hover:bg-gray-100 text-[#000000] border border-[#D9D9D9]';
      break;
    case 'verde':
      variantClasses = 'bg-[#008102] hover:bg-[#015C02] text-white border border-[#008102]';
      break;
    case 'rojo':
      variantClasses = 'bg-[#DD0000] hover:bg-[#B10000] text-white border border-[#DD0000]';
      break;
    case 'azul':
      variantClasses = 'bg-[#0E50A0] hover:bg-[#0c4386] text-white border border-[#0E50A0]';
      break;
  }

  return (
    <button className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`} disabled={disabled} {...props}>
      {children}
    </button>
  );
};

// Badges
export const StatusBadge: React.FC<{ type: 'URG' | 'POCO_STOCK' | 'OPEN' | 'CLOSED' | 'PENDING' | 'READY'; label?: string }> = ({
  type,
  label,
}) => {
  if (type === 'URG') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-[#DD0000] text-white animate-pulse">
        URG PARA PEDIDOS
      </span>
    );
  }
  if (type === 'POCO_STOCK') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
        POCO STOCK
      </span>
    );
  }
  if (type === 'OPEN') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-[#008102] border border-green-300">
        ABIERTO
      </span>
    );
  }
  if (type === 'CLOSED') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">
        CERRADO
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
      {label || type}
    </span>
  );
};

// Form Field Wrapper
export const FormField: React.FC<{
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}> = ({ label, error, hint, children, className = '' }) => (
  <div className={`flex flex-col gap-1 ${className}`}>
    <label className="text-xs font-semibold uppercase tracking-wider text-[#393939]">{label}</label>
    {children}
    {hint && <span className="text-xs text-gray-500">{hint}</span>}
    {error && <span className="text-xs text-[#DD0000] font-medium">{error}</span>}
  </div>
);

// Read-only Field
export const ReadOnlyField: React.FC<{
  label: string;
  value: string | number;
  highlight?: boolean;
}> = ({ label, value, highlight }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs font-semibold uppercase tracking-wider text-[#393939]">{label}</label>
    <div
      className={`h-[40px] px-3 flex items-center rounded border border-[#D9D9D9] bg-gray-50 text-sm font-medium ${
        highlight ? 'text-[#D2AB68] font-bold' : 'text-[#393939]'
      }`}
    >
      {value}
    </div>
  </div>
);

// Money Display
export const MoneyDisplay: React.FC<{
  amount: number;
  currency?: string;
  className?: string;
  isGain?: boolean;
}> = ({ amount, currency = 'ARS', className = '', isGain }) => {
  const formatted = Math.round(amount).toLocaleString('es-AR');
  const isNeg = amount < 0;

  return (
    <span
      className={`font-semibold ${
        isGain
          ? amount > 0
            ? 'text-[#008102]'
            : amount < 0
            ? 'text-[#DD0000]'
            : 'text-gray-600'
          : isNeg
          ? 'text-[#DD0000]'
          : 'text-[#393939]'
      } ${className}`}
    >
      $ {formatted} {currency !== 'ARS' ? `(${currency})` : ''}
    </span>
  );
};

// Modal / Operation Window
export const Modal: React.FC<{
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
}> = ({ title, isOpen, onClose, children, maxWidth = 'max-w-3xl' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
      <div className={`bg-white rounded-xl shadow-2xl border border-[#D9D9D9] w-full ${maxWidth} my-6 max-h-[92vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D9D9D9]">
          <h2 className="text-lg font-bold text-[#000000] uppercase tracking-wide">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-black hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
};

// Confirm Dialog
export const ConfirmDialog: React.FC<{
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl border border-[#D9D9D9]">
        <div className="flex items-center gap-3 text-[#DD0000] mb-3">
          <AlertCircle className="w-6 h-6" />
          <h3 className="text-base font-bold uppercase tracking-wide text-black">{title}</h3>
        </div>
        <p className="text-xs text-gray-600 mb-6 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-3">
          <Button variant="secundario" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="rojo" onClick={onConfirm}>
            Confirmar
          </Button>
        </div>
      </div>
    </div>
  );
};
