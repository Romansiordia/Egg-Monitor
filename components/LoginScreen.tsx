
import React, { useState } from 'react';
import { EggMonitorLogo } from './UI';
import { Lock, ArrowRight, AlertCircle, User, Link2 } from 'lucide-react';

interface LoginScreenProps {
    onLogin: (user: string, pass: string) => Promise<{ success: boolean; message?: string }>;
    hasUrl: boolean;
    onSetUrl: (url: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, hasUrl, onSetUrl }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [urlInput, setUrlInput] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showUrlConfig, setShowUrlConfig] = useState(!hasUrl);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const result = await onLogin(username, password);
            if (!result.success) {
                setError(result.message || "Credenciales incorrectas.");
            }
        } catch (err) {
            setError("Error de conexión al verificar credenciales.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleUrlSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (urlInput.trim()) {
            onSetUrl(urlInput.trim());
            setShowUrlConfig(false);
        }
    };

    if (showUrlConfig) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                 <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
                    <div className="mx-auto w-16 h-16 flex items-center justify-center bg-blue-100 rounded-full mb-6">
                        <Link2 className="text-blue-600" size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">Conectar Sistema</h2>
                    <p className="text-slate-500 mt-2 mb-6">Ingresa la URL del Google Script para conectar la base de datos.</p>
                    <form onSubmit={handleUrlSubmit}>
                        <input
                            type="url"
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            className="w-full p-3 border border-slate-300 rounded-xl mb-4 focus:ring-2 focus:ring-blue-500"
                            placeholder="https://script.google.com/macros/s/..."
                            required
                        />
                        <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700">
                            Guardar Conexión
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
                <div className="bg-slate-900 p-8 text-center relative overflow-hidden">
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
                                Usuario
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <User className="h-5 w-5 text-slate-400" />
                                </div>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder-slate-400"
                                    placeholder="usuario_empresa"
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Contraseña
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
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                            {error && (
                                <div className="flex items-start gap-2 mt-2 text-red-600 text-sm animate-pulse">
                                    <AlertCircle size={16} className="mt-0.5 min-w-[16px]" />
                                    <span>{error}</span>
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
                        <button onClick={() => setShowUrlConfig(true)} className="text-xs text-slate-400 hover:text-blue-500 underline">
                            Configurar Conexión
                        </button>
                    </div>
                </div>
            </div>
            
            <p className="mt-8 text-slate-400 text-xs font-medium">
                v2.0.0 • Powered by Gemini AI
            </p>
        </div>
    );
};
