import React, { useEffect } from 'react';
import { 
    X, CheckCircle, ZoomIn, ArrowUpRight, ArrowDownRight, Egg, LucideIcon, Upload 
} from 'lucide-react';
import { 
    ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid 
} from 'recharts';
import { ChartConfig, MetricConfig } from '../types';

// --- Logo Component ---
export const EggMonitorLogo: React.FC<{ size?: number }> = ({ size = 40 }) => (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Connector Lines (Nodos) */}
        <line x1="8" y1="52" x2="22" y2="52" stroke="#0F172A" strokeWidth="5" strokeLinecap="round" />
        <line x1="78" y1="52" x2="92" y2="52" stroke="#0F172A" strokeWidth="5" strokeLinecap="round" />
        <line x1="50" y1="86" x2="50" y2="96" stroke="#0F172A" strokeWidth="5" strokeLinecap="round" />

        {/* Node Dots (Puntos extremos) */}
        <circle cx="8" cy="52" r="5" fill="#0F172A" />
        <circle cx="92" cy="52" r="5" fill="#0F172A" />
        <circle cx="50" cy="96" r="5" fill="#0F172A" />

        {/* Egg Outline (Contorno del Huevo) */}
        <path d="M50 12 C72 12 78 34 78 52 C78 74 68 88 50 88 C32 88 22 74 22 52 C22 34 28 12 50 12 Z" stroke="#0F172A" strokeWidth="5" fill="white" />

        {/* Yolk (Yema) */}
        <path d="M50 28 C62 28 64 40 64 52 C64 68 58 74 50 74 C42 74 36 68 36 52 C36 40 38 28 50 28 Z" fill="#F59E0B" />
        
        {/* Shine (Brillo) */}
        <ellipse cx="44" cy="40" rx="3" ry="5" transform="rotate(-30 44 40)" fill="white" fillOpacity="0.9" />
    </svg>
);

// --- Modal ---
interface ModalProps {
    message: string;
    onClose: () => void;
    type?: 'info' | 'error';
}

export const Modal: React.FC<ModalProps> = ({ message, onClose, type = 'info' }) => { 
    if (!message) return null; 
    const Icon = type === 'error' ? X : CheckCircle;
    const colorClass = type === 'error' ? 'text-red-600' : 'text-green-600';
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-[60]">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 transform transition-all scale-100">
                <div className="flex justify-between items-center mb-4">
                    <h3 className={`text-lg font-bold flex items-center gap-2 ${colorClass}`}>
                        <Icon size={20}/>
                        {type === 'error' ? 'Error de Carga' : 'Notificación'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-800 transition-colors"><X size={20} /></button>
                </div>
                <p className="text-gray-600 mb-6">{message}</p>
                <div className="text-right">
                    <button onClick={onClose} className="bg-slate-900 text-white rounded-lg py-2 px-6 hover:bg-slate-800 transition-colors font-medium text-sm">
                        Aceptar
                    </button>
                </div>
            </div>
        </div>
    ); 
};

// --- ChartModal ---
interface ChartModalProps {
    chartConfig: ChartConfig | null;
    onClose: () => void;
    metricConfig: MetricConfig;
}

export const ChartModal: React.FC<ChartModalProps> = ({ chartConfig, onClose, metricConfig }) => {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    if (!chartConfig) return null;
    const { type, title, data, dataKey, color, xAxisKey } = chartConfig; 

    const renderChart = () => {
        const currentXAxisKey = xAxisKey || 'date'; 
        const commonProps = { data, margin: { top: 20, right: 30, left: 20, bottom: 20 } };
        
        // Componente de Gráfico: BarChart para histograma/barras, LineChart para series de tiempo
        const ChartComponent = type === 'histogram' || type === 'bar' ? BarChart : LineChart;
        const DataComponent = type === 'histogram' || type === 'bar' ? Bar : Line;

        // Determinar la clave de la métrica (si es histograma, la dataKey es 'count')
        const chartDataKey = type === 'histogram' ? 'count' : dataKey;
        
        // Determinar el título para el tooltip/leyenda
        const chartDataName = type === 'histogram' ? 'Conteo de Frecuencia' : (metricConfig[dataKey]?.name || title);
        const chartDataUnit = type === 'histogram' ? 'piezas' : (metricConfig[dataKey]?.unit || '');

        return (
            // @ts-ignore - Recharts types can be tricky with dynamic components
            <ChartComponent {...commonProps}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                    dataKey={currentXAxisKey} 
                    stroke="#64748b" 
                    tick={{fontSize: 12}} 
                    tickFormatter={currentXAxisKey === 'date' ? (val: string) => val.split('-').slice(1).join('/') : undefined}
                    angle={currentXAxisKey !== 'date' ? -45 : 0} 
                    textAnchor={currentXAxisKey !== 'date' ? 'end' : 'middle'}
                    height={currentXAxisKey !== 'date' ? 60 : 30}
                />
                <YAxis 
                    stroke="#64748b" 
                    domain={['auto', 'auto']} 
                    tickFormatter={(t: number) => t.toFixed(type === 'line' ? 1 : 0)} 
                />
                <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                    formatter={(value: number) => [`${value.toFixed(type === 'line' ? 2 : 0)} ${chartDataUnit}`, chartDataName]}
                    labelFormatter={(label: string) => currentXAxisKey === 'rangeLabel' ? `Rango: ${label}` : label}
                />
                <Legend />
                <DataComponent 
                    type={type === 'line' ? 'monotone' : undefined} 
                    dataKey={chartDataKey}
                    stroke={type === 'line' ? color : undefined} 
                    fill={type !== 'line' ? color : undefined}
                    strokeWidth={type === 'line' ? 3 : 0} 
                    dot={type === 'line' ? false : undefined} 
                    activeDot={type === 'line' ? { r: 8 } : undefined} 
                    name={chartDataName}
                    radius={type !== 'line' ? [4, 4, 0, 0] as any : undefined}
                />
            </ChartComponent>
        );
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-5xl h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <div>
                        <h3 className="text-2xl font-bold text-gray-800">{title}</h3>
                        <p className="text-sm text-gray-500">Vista detallada y ampliada</p>
                    </div>
                    <button onClick={onClose} className="bg-gray-100 p-2 rounded-full hover:bg-gray-200 transition-colors"><X size={24} /></button>
                </div>
                <div className="flex-grow w-full h-full">
                     <ResponsiveContainer width="100%" height="100%">
                        {renderChart()}
                     </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

// --- Metric Card ---
interface MetricCardProps {
    title: string;
    value: string;
    data: any[];
    dataKey: string;
    color: string;
    unit: string;
    icon: LucideIcon;
    onZoom: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({ title, value, data, dataKey, color, unit, icon: Icon, onZoom }) => {
    const trend = data.length >= 2 ? (data[data.length - 1][dataKey] as number) - (data[data.length - 2][dataKey] as number) : 0;
    const isPositive = trend >= 0;

    return (
        <div 
            className="p-5 rounded-xl shadow-lg flex flex-col justify-between hover:shadow-xl transition-shadow relative overflow-hidden group text-white"
            style={{ backgroundColor: color }}
        >
            <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button onClick={onZoom} className="p-1.5 bg-white/20 text-white rounded-md hover:bg-white/40 backdrop-blur-sm">
                    <ZoomIn size={16} />
                </button>
            </div>
            
            <div className="flex justify-between items-start mb-4">
                <div className="p-3 rounded-lg bg-white/20 backdrop-blur-sm">
                    <Icon size={24} className="text-white" />
                </div>
                <div className={`flex items-center text-xs font-semibold px-2 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white`}>
                    {isPositive ? <ArrowUpRight size={14} className="mr-1"/> : <ArrowDownRight size={14} className="mr-1"/>}
                    {Math.abs(trend).toFixed(2)}%
                </div>
            </div>

            <div>
                <h3 className="text-sm font-medium text-blue-50/90">{title}</h3>
                <p className="text-3xl font-bold mt-1">
                    {value} <span className="text-sm font-normal text-blue-50/80">{unit}</span>
                </p>
            </div>

            <div className="h-16 mt-4 -mx-2">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <Line type="monotone" dataKey={dataKey} stroke="#ffffff" strokeWidth={3} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

// --- Count Card ---
export const CountCard: React.FC<{ title: string; value: number; icon: LucideIcon; color: string }> = ({ title, value, icon: Icon, color }) => (
    <div 
        className="p-5 rounded-xl shadow-lg flex flex-col justify-center relative overflow-hidden group text-white"
        style={{ backgroundColor: color }}
    >
        <div className="flex justify-between items-center mb-4">
            <div className="p-3 rounded-lg bg-white/20 backdrop-blur-sm">
                <Icon size={24} className="text-white" />
            </div>
        </div>
        <div>
            <h3 className="text-sm font-medium text-blue-50/90">{title}</h3>
            <p className="text-3xl font-bold mt-1">
                {value.toLocaleString()} 
            </p>
            <p className="text-xs text-blue-50/80 mt-1">Total de registros</p>
        </div>
    </div>
);

// --- Sidebar Item ---
export const SidebarItem: React.FC<{ icon: LucideIcon; label: string; active: boolean; onClick: () => void }> = ({ icon: Icon, label, active, onClick }) => (
    <button 
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 mb-1 ${
            active 
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
        }`}
    >
        <Icon size={20} />
        <span>{label}</span>
    </button>
);