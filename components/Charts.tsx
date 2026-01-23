
import React from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Area 
} from 'recharts';
import { Download, ZoomIn, TrendingUp } from 'lucide-react';
import { getHistogramData } from '../utils/dataUtils';
import { MetricConfig, QualityStandardsConfig } from '../types';

interface DashboardChartProps {
    title: string;
    data: any[];
    dataKey: string;
    color: string;
    chartId: string;
    onDownload: (id: string, name: string) => void;
    scriptsReady: boolean;
    onZoom: () => void;
    type?: 'line' | 'histogram';
    unit?: string;
    metricConfig: MetricConfig;
}

const AreaChartWithGradient = ({ data, dataKey, color, unit, name }: { data: any[], dataKey: string, color: string, unit: string, name: string }) => (
    <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
            <linearGradient id={`color${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.2}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
            </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="date" stroke="#94a3b8" tick={{fontSize: 10}} tickFormatter={(val) => val.split('-').slice(1).join('/')} tickLine={false} axisLine={false} dy={10} />
        <YAxis stroke="#94a3b8" tick={{fontSize: 10}} domain={['auto', 'auto']} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} itemStyle={{ color: color }} />
        <Area type="monotone" dataKey={dataKey} stroke={color} fillOpacity={1} fill={`url(#color${dataKey})`} strokeWidth={2} name={name} unit={unit} />
    </ComposedChart>
);

export const DashboardChart: React.FC<DashboardChartProps> = ({ 
    title, data, dataKey, color, chartId, onDownload, scriptsReady, onZoom, type = 'line', unit, metricConfig 
}) => {
    return (
        <div id={chartId} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-bold text-slate-800">{title}</h3>
                    <p className="text-xs text-slate-400">Últimos datos registrados</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={onZoom} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <ZoomIn size={18} />
                    </button>
                    <button 
                        onClick={() => onDownload(chartId, `${title.replace(/\s+/g, '-')}.pdf`)} 
                        disabled={!scriptsReady}
                        className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-30"
                    >
                        <Download size={18} />
                    </button>
                </div>
            </div>
            <div className="flex-grow min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                    {type === 'line' ? (
                         <AreaChartWithGradient data={data} dataKey={dataKey} color={color} unit={unit || ''} name={metricConfig[dataKey]?.name} />
                    ) : (
                        <BarChart data={getHistogramData(data, dataKey)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="range" stroke="#94a3b8" tick={{fontSize: 10}} tickLine={false} axisLine={false} dy={10} />
                            <YAxis stroke="#94a3b8" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                            <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} name="Frecuencia" />
                        </BarChart>
                    )}
                </ResponsiveContainer>
            </div>
        </div>
    );
};

// --- Gauge Chart for Report ---
const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 180) * Math.PI) / 180.0;
    return {
        x: centerX + radius * Math.cos(angleInRadians),
        y: centerY + radius * Math.sin(angleInRadians),
    };
};

const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return ['M', start.x, start.y, 'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(' ');
};

const getAngle = (value: number, min: number, max: number) => {
    const clampedValue = Math.max(min, Math.min(value, max));
    const percentage = (clampedValue - min) / (max - min);
    return percentage * 180; // 0 to 180 degrees
};

interface GaugeChartProps {
    metricKey: string;
    value: number;
    standards: QualityStandardsConfig;
    metricConfig: MetricConfig;
}

export const GaugeChart: React.FC<GaugeChartProps> = ({ metricKey, value, standards, metricConfig }) => {
    const standard = standards[metricKey];
    if (!standard) return null;

    const { min, max, ranges } = standard;
    const { name, unit } = metricConfig[metricKey];

    const angle = getAngle(value, min, max);
    
    const poorAngle = getAngle(ranges.poor[1], min, max);
    const acceptableAngle = getAngle(ranges.acceptable[1], min, max);

    const valueStatus = value < ranges.poor[1] ? 'Pobre' : value < ranges.acceptable[1] ? 'Aceptable' : 'Óptimo';
    const statusColor = valueStatus === 'Pobre' ? '#ef4444' : valueStatus === 'Aceptable' ? '#eab308' : '#22c55e';

    return (
        <div className="flex flex-col items-center p-4 border border-slate-200 rounded-xl bg-slate-50/50">
            <h4 className="text-sm font-bold text-slate-700 mb-2">{name}</h4>
            <div className="w-full max-w-[200px]">
                <svg viewBox="0 0 100 65" className="w-full">
                    {/* Arcs */}
                    <path d={describeArc(50, 50, 40, 0, poorAngle)} fill="none" stroke="#ef4444" strokeWidth="12" />
                    <path d={describeArc(50, 50, 40, poorAngle, acceptableAngle)} fill="none" stroke="#eab308" strokeWidth="12" />
                    <path d={describeArc(50, 50, 40, acceptableAngle, 180)} fill="none" stroke="#22c55e" strokeWidth="12" />
                    
                    {/* Needle - Corrected rotation to start at 9 o'clock (angle-90) */}
                    <g transform={`rotate(${angle - 90}, 50, 50)`}>
                        <path d="M 50 50 L 50 12" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" />
                        <circle cx="50" cy="50" r="4" fill="#1e293b" />
                    </g>
                    
                    {/* Text */}
                    <text x="50" y="40" textAnchor="middle" className="text-xl font-bold fill-slate-800">
                        {value.toFixed(2)}
                    </text>
                    <text x="50" y="52" textAnchor="middle" className="text-xs font-medium fill-slate-500">{unit}</text>
                    
                    <text x="10" y="60" textAnchor="start" className="text-[8px] font-medium fill-slate-400">{min}</text>
                    <text x="90" y="60" textAnchor="end" className="text-[8px] font-medium fill-slate-400">{max}</text>
                </svg>
            </div>
            <div className="mt-2 text-center">
                <span className="text-xs text-slate-500">Diagnóstico:</span>
                <span className="font-bold text-sm ml-1.5" style={{ color: statusColor }}>{valueStatus}</span>
            </div>
        </div>
    );
};
