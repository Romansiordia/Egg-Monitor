import React from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Area 
} from 'recharts';
import { Download, ZoomIn, TrendingUp } from 'lucide-react';
import { getHistogramData } from '../utils/dataUtils';
import { MetricConfig } from '../types';

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