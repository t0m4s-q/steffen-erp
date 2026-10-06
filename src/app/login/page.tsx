'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/database/client';
import { Lock, Mail, AlertCircle, Loader2, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage('Credenciales inválidas o usuario no autorizado.');
        setLoading(false);
        return;
      }

      if (data.session) {
        // Redireccionar al ERP principal
        router.push('/');
        router.refresh();
      }
    } catch {
      setErrorMessage('Ocurrió un error inesperado al intentar iniciar sesión.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FBFBFB] px-4 py-12">
      <div className="w-full max-w-md">
        {/* Cabecera / Marca Steffen */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#D2AB68] text-white shadow-md mb-3">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-wider text-[#393939]">STEFFEN</h1>
          <p className="text-xs uppercase tracking-widest text-[#D2AB68] font-semibold mt-1">
            Cosmética Capilar
          </p>
          <p className="text-sm text-neutral-500 mt-2">
            Gestión Operativa Integral • ERP
          </p>
        </div>

        {/* Tarjeta de Inicio de Sesión */}
        <div className="bg-white rounded-2xl border border-[#D9D9D9] p-8 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-[#393939]">Iniciar Sesión</h2>
            <p className="text-xs text-neutral-500 mt-1">
              Ingrese sus credenciales para acceder al sistema
            </p>
          </div>

          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-[#DD0000]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-[#393939] uppercase tracking-wider mb-1.5"
              >
                Correo Electrónico
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@steffen.com"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-neutral-50 border border-[#D9D9D9] rounded-lg text-sm text-[#393939] placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#D2AB68] focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-[#393939] uppercase tracking-wider mb-1.5"
              >
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-neutral-50 border border-[#D9D9D9] rounded-lg text-sm text-[#393939] placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#D2AB68] focus:border-transparent transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-[2px] bg-[#D2AB68] hover:bg-[#c29b58] text-white text-sm font-semibold tracking-wide shadow-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verificando...</span>
                </>
              ) : (
                <span>Ingresar al Sistema</span>
              )}
            </button>
          </form>

          {/* Aviso de seguridad: Sin registro público */}
          <div className="mt-6 pt-5 border-t border-neutral-100 text-center">
            <p className="text-[11px] text-neutral-400">
              Acceso exclusivo para el operador autorizado del ERP Steffen.
            </p>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              El registro público de usuarios se encuentra deshabilitado.
            </p>
          </div>
        </div>

        {/* Footer discreto */}
        <p className="text-center text-xs text-neutral-400 mt-8">
          Steffen Cosmética Capilar &copy; 2026. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}
