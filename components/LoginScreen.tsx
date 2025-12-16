import React, { useState } from 'react';
import { EggMonitorLogo } from './UI';
import { Lock, ArrowRight, AlertCircle } from 'lucide-react';

interface LoginScreenProps {
    onLogin: (password: string) => boolean;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(false);

        // Simulamos un pequeño delay para sensación de seguridad
        setTimeout(() => {
            const success = onLogin(password);
            if (!success) {
                setError(true);
                setIsLoading(false);
            }
            // Si es success, el componente se desmontará, no necesitamos setear loading a false
        }, 600);
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
                <div className="bg-slate-900 p-8 text-center relative overflow-hidden">
                    {/* Elementos decorativos de fondo */}
                    <div className="absolute top-0 left-0 w-full h-full opacity-10">
                        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <path d="M0 100 C 20 0 50 0 100 100 Z" fill="white" />
                        </svg>
                    </div>
                    
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="bg-white p-3 rounded-full shadow-lg mb-4">
                            <EggMonitorLogo size={48} />
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-1">EggMonitor AI</h1>
                        <p className="text-slate-400 text-sm">Dashboard de Calidad Avícola</p>
                    </div>
                </div>

                <div className="p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Código de Acceso
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-slate-400" />
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className={`block w-full pl-10 pr-3 py-3 border ${error ? 'border-red-300 ring-red-200' : 'border-slate-300 focus:ring-blue-500 focus:border-blue-500'} rounded-xl focus:outline-none focus:ring-2 transition-all placeholder-slate-400`}
                                    placeholder="Ingrese su contraseña"
                                    autoFocus
                                />
                            </div>
                            {error && (
                                <div className="flex items-center gap-2 mt-2 text-red-600 text-sm animate-pulse">
                                    <AlertCircle size={14} />
                                    <span>Código incorrecto. Intente nuevamente.</span>
                                </div>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] ${isLoading ? 'opacity-70 cursor-wait' : ''}`}
                        >
                            {isLoading ? (
                                'Verificando...'
                            ) : (
                                <>
                                    Ingresar al Dashboard <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-xs text-slate-400">
                            Acceso restringido a personal autorizado.
                        </p>
                    </div>
                </div>
            </div>
            
            <p className="mt-8 text-slate-400 text-xs font-medium">
                v1.0.0 • Powered by Gemini AI
            </p>
        </div>
    );
};