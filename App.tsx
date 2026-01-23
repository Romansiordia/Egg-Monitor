
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Activity, BarChart2, TrendingUp, MessageSquare, Loader, Egg, PieChart, ClipboardList, LogOut, FileSpreadsheet, Filter, FileText, Download, LayoutDashboard
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

import { generateMockData, calculateAllStats, calculateMonthlyAverages } from './utils/dataUtils';
import { sendMessageToGemini } from './services/geminiService';
import { EggData, ChartConfig, TabType, ChatMessageData, QualityStandardsConfig, MetricConfig } from './types';
import { ChartModal, MetricCard, SidebarItem, EggMonitorLogo, SidebarLogout } from './components/UI';
import { DashboardChart, GaugeChart } from './components/Charts';
import { ChatBox } from './components/ChatInterface';
import { LoginScreen } from './components/LoginScreen';

const METRIC_CONFIG: MetricConfig = {
    weight: { name: 'Peso Huevo', color: '#3b82f6', unit: 'g', icon: Egg },
    breakingStrength: { name: 'Resistencia', color: '#f97316', unit: 'kgf', icon: Activity },
    shellThickness: { name: 'Espesor', color: '#10b981', unit: 'mm', icon: TrendingUp },
    yolkColor: { name: 'Color Yema', color: '#eab308', unit: 'Escala', icon: PieChart },
    haughUnits: { name: 'Unid. Haugh', color: '#a855f7', unit: 'HU', icon: BarChart2 },
};

const QUALITY_STANDARDS: QualityStandardsConfig = {
    weight: { min: 45, max: 80, ranges: { poor: [45, 52], acceptable: [52, 65], optimal: [65, 80] } },
    breakingStrength: { min: 2.0, max: 5.0, ranges: { poor: [2.0, 2.8], acceptable: [2.8, 3.8], optimal: [3.8, 5.0] } },
    shellThickness: { min: 0.25, max: 0.45, ranges: { poor: [0.25, 0.30], acceptable: [0.30, 0.38], optimal: [0.38, 0.45] } },
    yolkColor: { min: 5, max: 13, ranges: { poor: [5, 7.5], acceptable: [7.5, 10.5], optimal: [10.5, 13] } },
    haughUnits: { min: 40, max: 110, ranges: { poor: [40, 65], acceptable: [65, 90], optimal: [90, 110] } }
};

const INITIAL_DATA = generateMockData();
const AUTH_KEY = 'egg_monitor_auth';
const DEFAULT_ACCESS_CODE = 'Tic@8lava$';

export default function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authChecking, setAuthChecking] = useState(true);
    const [dashboardData, setDashboardData] = useState<EggData[]>(INITIAL_DATA);
    
    // Filtros
    const [selectedFarm, setSelectedFarm] = useState('Todos');
    const [selectedShed, setSelectedShed] = useState('Todos');
    const [selectedAge, setSelectedAge] = useState('Todos');
    const [selectedBreed, setSelectedBreed] = useState('Todos');
    const [selectedClient, setSelectedClient] = useState('Todos');
    const [selectedMetaqualix, setSelectedMetaqualix] = useState('Todos'); 
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().split('T')[0]; });
    
    const [activeTab, setActiveTab] = useState<TabType>('dashboard'); 
    const [zoomedChart, setZoomedChart] = useState<ChartConfig | null>(null);
    const [chatHistory, setChatHistory] = useState<ChatMessageData[]>([]);
    const [isThinking, setIsThinking] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const storedAuth = localStorage.getItem(AUTH_KEY);
        if (storedAuth === 'true') setIsAuthenticated(true);
        setAuthChecking(false);
    }, []);

    const handleLogin = (password: string) => {
        if (password === DEFAULT_ACCESS_CODE) {
            localStorage.setItem(AUTH_KEY, 'true');
            setIsAuthenticated(true);
            return true;
        }
        return false;
    };

    const handleLogout = () => {
        localStorage.removeItem(AUTH_KEY);
        setIsAuthenticated(false);
    };

    const handleDownloadPDF = async () => {
        const reportElement = document.getElementById('report-container');
        if (!reportElement) return;

        setIsExporting(true);
        try {
            const canvas = await html2canvas(reportElement, {
                scale: 1.2, 
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.7); 
            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'mm',
                format: 'a4',
                compress: true 
            });

            const imgWidth = 210; 
            const pageHeight = 297; 
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
                heightLeft -= pageHeight;
            }

            pdf.save(`Reporte_Calidad_Huevo_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error("Error al generar PDF:", error);
            alert("Error al generar el PDF.");
        } finally {
            setIsExporting(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const buffer = evt.target?.result;
                const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(ws);
                
                if (data.length === 0) { alert("Archivo vacío."); return; }

                const findVal = (row: any, ...keys: string[]) => {
                    const rowKeys = Object.keys(row);
                    for (const k of keys) {
                        const found = rowKeys.find(rk => rk.toLowerCase().trim() === k.toLowerCase());
                        if (found) return row[found];
                    }
                    return undefined;
                };

                const parsedData: EggData[] = data.map((row: any) => {
                    const d = new Date(findVal(row, 'Fecha', 'date', 'Date') || new Date());
                    return {
                        date: isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0],
                        farm: String(findVal(row, 'Granja', 'farm', 'Farm') || 'Desconocida'),
                        shed: String(findVal(row, 'Caseta', 'shed', 'Shed') || 'N/A'),
                        age: String(findVal(row, 'Edad', 'age', 'Age') || '0'),
                        breed: String(findVal(row, 'Estirpe', 'breed', 'Breed', 'Raza') || 'Desconocida'),
                        client: String(findVal(row, 'Cliente', 'client', 'Client') || 'General'),
                        metaqualixId: String(findVal(row, 'Metaqualix', 'No. Metaqualix', 'metaqualixId', 'No MQX') || 'N/A'),
                        weight: parseFloat(String(findVal(row, 'Peso', 'weight', 'Weight') || 0)),
                        breakingStrength: parseFloat(String(findVal(row, 'Resistencia', 'breakingStrength', 'Breaking Strength') || 0)),
                        shellThickness: parseFloat(String(findVal(row, 'Espesor', 'shellThickness', 'Shell Thickness') || 0)),
                        yolkColor: parseFloat(String(findVal(row, 'Color', 'yolkColor', 'Yolk Color', 'Color Yema') || 0)),
                        haughUnits: parseFloat(String(findVal(row, 'Haugh', 'haughUnits', 'Haugh Units', 'Unidades Haugh') || 0)),
                    };
                });

                setDashboardData(parsedData);
                alert(`¡Éxito! Se cargaron ${parsedData.length} registros.`);
            } catch (err) {
                console.error(err);
                alert("Error al procesar el archivo Excel.");
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const FARMS = useMemo(() => ['Todos', ...Array.from(new Set(dashboardData.map(d => d.farm).filter(Boolean)))], [dashboardData]);
    const SHEDS = useMemo(() => ['Todos', ...Array.from(new Set(dashboardData.map(d => d.shed).filter(Boolean)))], [dashboardData]);
    const AGES = useMemo(() => ['Todos', ...Array.from(new Set(dashboardData.map(d => d.age).filter(Boolean)))], [dashboardData]);
    const BREEDS = useMemo(() => ['Todos', ...Array.from(new Set(dashboardData.map(d => d.breed).filter(Boolean)))], [dashboardData]);
    const CLIENTS = useMemo(() => ['Todos', ...Array.from(new Set(dashboardData.map(d => d.client).filter(Boolean) as string[]))], [dashboardData]);
    const METAQUALIX = useMemo(() => ['Todos', ...Array.from(new Set(dashboardData.map(d => d.metaqualixId).filter(Boolean)))], [dashboardData]);
    
    const filteredData = useMemo(() => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); 
        return dashboardData.filter(d => {
            const dDate = new Date(d.date);
            return (dDate >= start && dDate <= end) &&
                   (selectedFarm === 'Todos' || d.farm === selectedFarm) &&
                   (selectedShed === 'Todos' || d.shed === selectedShed) &&
                   (selectedAge === 'Todos' || d.age === selectedAge) &&
                   (selectedBreed === 'Todos' || d.breed === selectedBreed) &&
                   (selectedClient === 'Todos' || d.client === selectedClient) &&
                   (selectedMetaqualix === 'Todos' || d.metaqualixId === selectedMetaqualix);
        });
    }, [dashboardData, selectedFarm, selectedShed, selectedAge, selectedBreed, selectedClient, selectedMetaqualix, startDate, endDate]);

    const globalAverages = useMemo(() => {
        const avg: {[key: string]: string} = {};
        Object.keys(METRIC_CONFIG).forEach(key => {
            const result = calculateAllStats(filteredData, key);
            avg[key] = result.mean.toFixed(2);
        });
        return avg;
    }, [filteredData]);

    const monthlyData = useMemo(() => {
        return calculateMonthlyAverages(filteredData, Object.keys(METRIC_CONFIG));
    }, [filteredData]);

    const shedDataSummary = useMemo(() => {
        const sheds = Array.from(new Set(filteredData.map(d => d.shed))).filter(Boolean);
        return sheds.map(shed => {
            const currentShedData = filteredData.filter(d => d.shed === shed);
            const stats: any = { shed };
            Object.keys(METRIC_CONFIG).forEach(key => {
                stats[key] = calculateAllStats(currentShedData, key);
            });
            return stats;
        });
    }, [filteredData]);

    const handleChatSubmit = async (query: string, dataContext: string) => {
        setIsThinking(true);
        setChatHistory(prev => [...prev, { role: 'user', text: query, sources: [] }]);
        try {
            const result = await sendMessageToGemini(query, dataContext);
            setChatHistory(prev => [...prev, { role: 'model', text: result.text, sources: result.sources }]);
        } catch (error) {
            setChatHistory(prev => [...prev, { role: 'model', text: "Error de comunicación con el experto.", sources: [] }]);
        } finally {
            setIsThinking(false);
        }
    };

    if (authChecking) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader className="animate-spin text-blue-600" /></div>;
    if (!isAuthenticated) return <LoginScreen onLogin={handleLogin} />;

    return (
        <div className="flex flex-col md:flex-row min-h-screen bg-slate-50">
            <aside className="w-full md:w-64 bg-white border-r border-slate-200 p-6 flex flex-col">
                <div className="flex items-center gap-3 mb-10 px-2">
                    <EggMonitorLogo size={40} />
                    <h1 className="text-xl font-bold text-slate-900 leading-tight">EggMonitor <span className="text-blue-600 block text-xs">AI ANALYTICS</span></h1>
                </div>
                <nav className="flex-grow space-y-1">
                    <SidebarItem icon={Activity} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
                    <SidebarItem icon={BarChart2} label="Histogramas" active={activeTab === 'histograms'} onClick={() => setActiveTab('histograms')} />
                    <SidebarItem icon={TrendingUp} label="Promedios Mensuales" active={activeTab === 'monthly-averages'} onClick={() => setActiveTab('monthly-averages')} />
                    <SidebarItem icon={FileText} label="Resumen de Datos" active={activeTab === 'summary'} onClick={() => setActiveTab('summary')} />
                    <SidebarItem icon={ClipboardList} label="Reporte de Calidad" active={activeTab === 'report'} onClick={() => setActiveTab('report')} />
                    <SidebarItem icon={MessageSquare} label="Consultas IA" active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} />
                </nav>
                <div className="pt-6 border-t border-slate-100">
                    <SidebarLogout onClick={handleLogout} />
                </div>
            </aside>

            <main className="flex-1 p-6 md:p-10 overflow-auto">
                {activeTab === 'report' && (
                    <div className="space-y-8 max-w-7xl mx-auto">
                        <header className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Reporte de Calidad de Huevo</h2>
                                <p className="text-slate-500 text-sm">Análisis detallado para la gestión de calidad</p>
                            </div>
                            <button 
                                onClick={handleDownloadPDF}
                                disabled={isExporting}
                                className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded-xl text-sm font-bold shadow-xl transition-all disabled:opacity-50"
                            >
                                {isExporting ? <Loader className="animate-spin" size={18} /> : <Download size={18} />}
                                {isExporting ? 'Generando Archivo...' : 'Exportar Reporte Completo'}
                            </button>
                        </header>

                        <div className="bg-white p-10 rounded-3xl shadow-2xl border border-slate-100" id="report-container">
                            {/* Cabecera del Reporte */}
                            <div className="flex justify-between items-start border-b border-slate-200 pb-10 mb-8">
                                <div className="flex items-center gap-6">
                                    <div className="p-4 bg-slate-50 rounded-2xl shadow-inner">
                                        <EggMonitorLogo size={60} />
                                    </div>
                                    <div>
                                        <h1 className="text-4xl font-extrabold text-slate-900">Reporte de Calidad de Huevo</h1>
                                        <div className="flex items-center gap-4 mt-2">
                                            <p className="text-slate-500 font-medium">Emisión: {new Date().toLocaleDateString()}</p>
                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                            <p className="text-blue-600 font-bold uppercase tracking-wider text-xs">Análisis de Producción</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right space-y-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Parámetros de Filtrado</p>
                                    <p className="text-lg font-bold text-slate-800">{selectedFarm}</p>
                                    <p className="text-sm font-medium text-slate-500">{selectedClient} • MQX: {selectedMetaqualix}</p>
                                    <div className="inline-block mt-3 px-3 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-lg border border-green-100">
                                        {filteredData.length} Muestras Verificadas
                                    </div>
                                </div>
                            </div>

                            {/* Branding Central Ajustado (Aumentado 20%) */}
                            <div className="flex justify-center mb-10 border-b border-slate-50 pb-6">
                                <h2 className="text-2xl font-bold tracking-tight select-none pointer-events-none">
                                    <span className="text-cyan-500">Egg</span>
                                    <span className="text-yellow-400">Monitor</span>
                                </h2>
                            </div>

                            {/* Sección 1: Comparativa de Promedios por Caseta */}
                            <div className="mb-16">
                                <div className="flex items-center gap-3 mb-8 border-l-4 border-blue-600 pl-4">
                                    <LayoutDashboard className="text-blue-600" />
                                    <h2 className="text-2xl font-bold text-slate-800">Comparativa Global entre Casetas</h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                    {Object.keys(METRIC_CONFIG).map(key => (
                                        <div key={`comp-${key}`} className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                                            <h3 className="text-sm font-bold text-slate-600 mb-4 flex justify-between items-center">
                                                {METRIC_CONFIG[key].name} ({METRIC_CONFIG[key].unit})
                                                <span className="text-[10px] text-slate-400 font-normal">Comparativo Promedios</span>
                                            </h3>
                                            <div className="h-[200px]">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={shedDataSummary.map(s => ({ name: s.shed, val: s[key].mean }))}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                        <XAxis dataKey="name" tick={{fontSize: 10}} stroke="#94a3b8" />
                                                        <YAxis tick={{fontSize: 10}} stroke="#94a3b8" domain={['auto', 'auto']} />
                                                        <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '12px', border: 'none'}} />
                                                        <Bar dataKey="val" name="Promedio" radius={[6, 6, 0, 0]}>
                                                            {shedDataSummary.map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={METRIC_CONFIG[key].color} />
                                                            ))}
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Sección 2: Desglose Detallado por Caseta */}
                            <div className="space-y-16">
                                {shedDataSummary.map((item, index) => (
                                    <div key={`shed-report-${index}`} className="group">
                                        <div className="flex items-center gap-4 mb-8">
                                            <div className="w-12 h-12 flex items-center justify-center bg-slate-900 text-white rounded-2xl font-black text-xl shadow-lg group-hover:bg-blue-600 transition-colors">
                                                {item.shed}
                                            </div>
                                            <div>
                                                <h3 className="text-2xl font-bold text-slate-900">Análisis Caseta {item.shed}</h3>
                                                <p className="text-sm text-slate-500 font-medium">Evaluación individual de parámetros de calidad</p>
                                            </div>
                                            <div className="ml-auto h-[1px] flex-grow bg-slate-100 max-w-[400px]"></div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
                                            {Object.keys(METRIC_CONFIG).map(key => (
                                                <GaugeChart 
                                                    key={`shed-${item.shed}-${key}`} 
                                                    metricKey={key} 
                                                    value={item[key].mean} 
                                                    standards={QUALITY_STANDARDS} 
                                                    metricConfig={METRIC_CONFIG} 
                                                />
                                            ))}
                                        </div>

                                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                                            <table className="w-full text-sm text-left">
                                                <thead>
                                                    <tr className="bg-slate-50 border-b border-slate-200">
                                                        <th className="px-6 py-4 font-bold text-slate-700">Métrica de Calidad</th>
                                                        <th className="px-6 py-4 font-bold text-slate-700 text-center">Mínimo</th>
                                                        <th className="px-6 py-4 font-bold text-slate-700 text-center">Promedio</th>
                                                        <th className="px-6 py-4 font-bold text-slate-700 text-center">Máximo</th>
                                                        <th className="px-6 py-4 font-bold text-slate-700 text-center">Desv. Est.</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {Object.keys(METRIC_CONFIG).map(key => (
                                                        <tr key={`row-${item.shed}-${key}`} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: METRIC_CONFIG[key].color }}></div>
                                                                    <span className="font-semibold text-slate-800">{METRIC_CONFIG[key].name}</span>
                                                                    <span className="text-[10px] text-slate-400 font-normal uppercase">({METRIC_CONFIG[key].unit})</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-center text-slate-600 font-medium">{item[key].min.toFixed(2)}</td>
                                                            <td className="px-6 py-4 text-center">
                                                                <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-bold">
                                                                    {item[key].mean.toFixed(2)}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-center text-slate-600 font-medium">{item[key].max.toFixed(2)}</td>
                                                            <td className="px-6 py-4 text-center text-slate-400 font-mono text-xs">{item[key].std.toFixed(2)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-20 pt-10 border-t border-slate-100 flex justify-between items-center text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                                <p>© {new Date().getFullYear()} EggMonitor AI System - Confidencial</p>
                                <p>Generado por: Analista de Planta</p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'dashboard' && (
                    <div className="space-y-8">
                        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Panel de Control</h2>
                                <p className="text-slate-500">Gestión de calidad y análisis de tendencias</p>
                            </div>
                            <div className="flex gap-2">
                                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx,.xlsm" className="hidden" />
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all"
                                >
                                    <FileSpreadsheet size={18} />
                                    Cargar Excel
                                </button>
                            </div>
                        </header>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                            {Object.keys(METRIC_CONFIG).map(key => (
                                <MetricCard 
                                    key={key} 
                                    title={METRIC_CONFIG[key].name} 
                                    value={globalAverages[key]} 
                                    unit={METRIC_CONFIG[key].unit} 
                                    icon={METRIC_CONFIG[key].icon} 
                                    color={METRIC_CONFIG[key].color}
                                    data={filteredData}
                                    dataKey={key}
                                    onZoom={() => setZoomedChart({ title: METRIC_CONFIG[key].name, data: filteredData, dataKey: key, color: METRIC_CONFIG[key].color, type: 'line' })}
                                />
                            ))}
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-4 text-slate-800 font-bold">
                                <Activity size={18} className="text-blue-600"/>
                                <h3>Filtros de Análisis</h3>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Granja</label>
                                    <select value={selectedFarm} onChange={(e) => setSelectedFarm(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                                        {FARMS.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Caseta</label>
                                    <select value={selectedShed} onChange={(e) => setSelectedShed(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                                        {SHEDS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Edad</label>
                                    <select value={selectedAge} onChange={(e) => setSelectedAge(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                                        {AGES.map(a => <option key={a} value={a}>{a}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Estirpe</label>
                                    <select value={selectedBreed} onChange={(e) => setSelectedBreed(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                                        {BREEDS.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cliente</label>
                                    <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                                        {CLIENTS.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">No. Metaqualix</label>
                                    <select value={selectedMetaqualix} onChange={(e) => setSelectedMetaqualix(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                                        {METAQUALIX.map(m => <option key={String(m)} value={String(m)}>{String(m)}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Desde</label>
                                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Hasta</label>
                                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'histograms' && (
                    <div className="space-y-8">
                        <header>
                            <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Histogramas de Distribución</h2>
                        </header>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {Object.keys(METRIC_CONFIG).map(key => (
                                <DashboardChart 
                                    key={`hist-${key}`}
                                    title={`Distribución: ${METRIC_CONFIG[key].name}`} 
                                    data={filteredData} 
                                    dataKey={key} 
                                    color={METRIC_CONFIG[key].color} 
                                    chartId={`hist-chart-${key}`} 
                                    onDownload={() => {}} 
                                    scriptsReady={true} 
                                    type="histogram"
                                    onZoom={() => setZoomedChart({ 
                                        title: `Distribución: ${METRIC_CONFIG[key].name}`, 
                                        data: filteredData, 
                                        dataKey: key, 
                                        color: METRIC_CONFIG[key].color, 
                                        type: 'histogram',
                                        xAxisKey: 'rangeLabel'
                                    })} 
                                    metricConfig={METRIC_CONFIG} 
                                />
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'monthly-averages' && (
                    <div className="space-y-8">
                        <header>
                            <h2 className="text-3xl font-bold text-slate-800 text-slate-800 tracking-tight">Promedios Mensuales</h2>
                        </header>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {Object.keys(METRIC_CONFIG).map(key => (
                                <DashboardChart 
                                    key={`monthly-${key}`}
                                    title={`Mensual: ${METRIC_CONFIG[key].name}`} 
                                    data={monthlyData} 
                                    dataKey={key} 
                                    color={METRIC_CONFIG[key].color} 
                                    chartId={`monthly-chart-${key}`} 
                                    onDownload={() => {}} 
                                    scriptsReady={true} 
                                    onZoom={() => setZoomedChart({ 
                                        title: `Promedio Mensual: ${METRIC_CONFIG[key].name}`, 
                                        data: monthlyData, 
                                        dataKey: key, 
                                        color: METRIC_CONFIG[key].color, 
                                        type: 'line' 
                                    })} 
                                    metricConfig={METRIC_CONFIG} 
                                />
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'summary' && (
                    <div className="space-y-8">
                        <header>
                            <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Resumen Estadístico</h2>
                        </header>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {Object.keys(METRIC_CONFIG).map(key => {
                                const stats = calculateAllStats(filteredData, key);
                                return (
                                    <div key={`summary-table-${key}`} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="p-2 rounded-lg" style={{ backgroundColor: `${METRIC_CONFIG[key].color}20` }}>
                                                {React.createElement(METRIC_CONFIG[key].icon, { size: 24, style: { color: METRIC_CONFIG[key].color } })}
                                            </div>
                                            <h3 className="text-xl font-bold text-slate-800">{METRIC_CONFIG[key].name}</h3>
                                        </div>
                                        <table className="w-full text-sm text-left border rounded-xl overflow-hidden">
                                            <thead>
                                                <tr className="bg-slate-50 border-b">
                                                    <th className="px-4 py-3 font-semibold text-slate-500">Estadístico</th>
                                                    <th className="px-4 py-3 font-semibold text-slate-500 text-right">Valor ({METRIC_CONFIG[key].unit})</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                <tr><td className="px-4 py-3 text-slate-700">Promedio (Media)</td><td className="px-4 py-3 font-bold text-blue-600 text-right">{stats.mean.toFixed(2)}</td></tr>
                                                <tr><td className="px-4 py-3 text-slate-700">Máximo</td><td className="px-4 py-3 font-bold text-slate-800 text-right">{stats.max.toFixed(2)}</td></tr>
                                                <tr><td className="px-4 py-3 text-slate-700">Mínimo</td><td className="px-4 py-3 font-bold text-slate-800 text-right">{stats.min.toFixed(2)}</td></tr>
                                                <tr><td className="px-4 py-3 text-slate-700">Desv. Estándar</td><td className="px-4 py-3 font-bold text-slate-400 text-right">{stats.std.toFixed(2)}</td></tr>
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {activeTab === 'chat' && (
                    <ChatBox chatHistory={chatHistory} onSubmit={handleChatSubmit} isThinking={isThinking} filters={{ recordCount: filteredData.length, selectedFarm, selectedShed, selectedAge, selectedBreed, selectedClient, selectedMetaqualix, startDate, endDate }} averages={globalAverages} metricConfig={METRIC_CONFIG} />
                )}
            </main>

            {zoomedChart && <ChartModal chartConfig={zoomedChart} onClose={() => setZoomedChart(null)} metricConfig={METRIC_CONFIG} />}
        </div>
    );
}
