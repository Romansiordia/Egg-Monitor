import React, { useState, useMemo, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { 
  Activity, BarChart2, TrendingUp, FileText, MessageSquare, Menu, Calendar, Upload, Download, Loader, Egg, PieChart, ZoomIn, ClipboardList 
} from 'lucide-react';

import { generateMockData, calculateAllStats, getHistogramData, calculateMonthlyAverages } from './utils/dataUtils';
import { sendMessageToGemini } from './services/geminiService';
import { EggData, ChartConfig, MetricConfig, TabType, ChatMessageData, QualityStandardsConfig } from './types';
import { Modal, ChartModal, CountCard, MetricCard, SidebarItem, EggMonitorLogo, SidebarLogout } from './components/UI';
import { DashboardChart, GaugeChart } from './components/Charts';
import { ChatBox } from './components/ChatInterface';
import { LoginScreen } from './components/LoginScreen';

// Hook for external scripts (PDF generation)
const useScript = (url: string) => {
    const [status, setStatus] = useState(url ? 'loading' : 'idle');
    useEffect(() => {
        if (!url) { setStatus('idle'); return; }
        let script = document.querySelector(`script[src="${url}"]`) as HTMLScriptElement;
        if (!script) {
            script = document.createElement('script');
            script.src = url; script.async = true;
            const handleLoad = () => setStatus('ready');
            const handleError = () => setStatus('error');
            script.addEventListener('load', handleLoad);
            script.addEventListener('error', handleError);
            document.body.appendChild(script);
            return () => { 
                script.removeEventListener('load', handleLoad);
                script.removeEventListener('error', handleError);
            };
        } else {
            const libName = url.includes('jspdf') ? 'jspdf' : 'html2canvas';
            // @ts-ignore
            if (window[libName]) { setStatus('ready'); } else {
                const handleLoad = () => setStatus('ready');
                script.addEventListener('load', handleLoad);
                return () => script.removeEventListener('load', handleLoad);
            }
        }
    }, [url]);
    return status;
};

const METRIC_CONFIG: MetricConfig = {
    weight: { name: 'Peso Huevo', color: '#3b82f6', unit: 'g', icon: Egg }, // Azul (Blue 500)
    breakingStrength: { name: 'Resistencia', color: '#f97316', unit: 'kgf', icon: Activity }, // Naranja (Orange 500)
    shellThickness: { name: 'Espesor', color: '#10b981', unit: 'mm', icon:  TrendingUp}, // Verde (Emerald 500)
    yolkColor: { name: 'Color Yema', color: '#eab308', unit: 'Escala', icon: PieChart }, // Amarillo (Yellow 500)
    haughUnits: { name: 'Unid. Haugh', color: '#a855f7', unit: 'HU', icon: BarChart2 }, // Morado (Purple 500)
};

const QUALITY_STANDARDS: QualityStandardsConfig = {
    weight: { min: 50, max: 75, ranges: { poor: [50, 55], acceptable: [55, 65], optimal: [65, 75] } },
    breakingStrength: { min: 2.5, max: 5.5, ranges: { poor: [2.5, 3.2], acceptable: [3.2, 4.5], optimal: [4.5, 5.5] } },
    shellThickness: { min: 0.28, max: 0.45, ranges: { poor: [0.28, 0.33], acceptable: [0.33, 0.40], optimal: [0.40, 0.45] } },
    yolkColor: { min: 6, max: 15, ranges: { poor: [6, 8], acceptable: [8, 12], optimal: [12, 15] } },
    haughUnits: { min: 60, max: 100, ranges: { poor: [60, 72], acceptable: [72, 90], optimal: [90, 100] } }
};

const INITIAL_DATA = generateMockData();
const AUTH_KEY = 'egg_monitor_auth';
const DEFAULT_ACCESS_CODE = 'Tic@8lava$'; // Contraseña por defecto actualizada

export default function App() {
    // --- Auth State ---
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authChecking, setAuthChecking] = useState(true);

    // Check auth on load
    useEffect(() => {
        const storedAuth = localStorage.getItem(AUTH_KEY);
        if (storedAuth === 'true') {
            setIsAuthenticated(true);
        }
        setAuthChecking(false);
    }, []);

    const handleLogin = (password: string) => {
        // En producción en Vercel, puedes usar process.env.VITE_ACCESS_CODE para ocultarlo
        const accessCode = (import.meta as any).env?.VITE_ACCESS_CODE || DEFAULT_ACCESS_CODE;
        if (password === accessCode) {
            localStorage.setItem(AUTH_KEY, 'true');
            setIsAuthenticated(true);
            return true;
        }
        return false;
    };

    const handleLogout = () => {
        localStorage.removeItem(AUTH_KEY);
        setIsAuthenticated(false);
        setChatHistory([]); // Limpiar chat al salir
    };

    // PDF Library Scripts
    const jspdfStatus = useScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    const html2canvasStatus = useScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    const scriptsReady = jspdfStatus === 'ready' && html2canvasStatus === 'ready';

    const [dashboardData, setDashboardData] = useState<EggData[]>(INITIAL_DATA);
    
    // Filters
    const [selectedFarm, setSelectedFarm] = useState('Todos');
    const [selectedShed, setSelectedShed] = useState('Todos');
    const [selectedAge, setSelectedAge] = useState('Todos');
    const [selectedBreed, setSelectedBreed] = useState('Todos');
    
    // Dates (Defaults: Last 30 days)
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().split('T')[0]; });
    
    // UI State
    const [fileName, setFileName] = useState('');
    const [modal, setModal] = useState<{ show: boolean; message: string; type: 'info' | 'error' }>({ show: false, message: '', type: 'info' });
    const [activeTab, setActiveTab] = useState<TabType>('dashboard'); 
    const [isDownloading, setIsDownloading] = useState(false);
    const [zoomedChart, setZoomedChart] = useState<ChartConfig | null>(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Chat State
    const [chatHistory, setChatHistory] = useState<ChatMessageData[]>([]);
    const [isThinking, setIsThinking] = useState(false);

    // Derived Lists
    const FARMS = useMemo(() => ['Todos', ...Array.from(new Set(dashboardData.map(d => d.farm).filter(Boolean)))], [dashboardData]);
    const SHEDS = useMemo(() => ['Todos', ...Array.from(new Set(dashboardData.map(d => d.shed).filter(Boolean)))], [dashboardData]);
    const AGES = useMemo(() => ['Todos', ...Array.from(new Set(dashboardData.map(d => d.age).filter(Boolean)))].sort((a, b) => { 
        if (a === 'Todos') return -1; if (b === 'Todos') return 1; return parseInt(a as string) - parseInt(b as string);
    }), [dashboardData]);
    const BREEDS = useMemo(() => ['Todos', ...Array.from(new Set(dashboardData.map(d => d.breed).filter(Boolean))).sort()], [dashboardData]);
    
    // Filtering Logic
    const filteredData = useMemo(() => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); 

        return dashboardData.filter(d => {
            const dDate = new Date(d.date);
            const dateMatch = dDate >= start && dDate <= end;
            const farmMatch = selectedFarm === 'Todos' || d.farm === selectedFarm;
            const shedMatch = selectedShed === 'Todos' || d.shed === selectedShed;
            const ageMatch = selectedAge === 'Todos' || d.age === selectedAge;
            const breedMatch = selectedBreed === 'Todos' || d.breed === selectedBreed;

            return dateMatch && farmMatch && shedMatch && ageMatch && breedMatch;
        });
    }, [dashboardData, selectedFarm, selectedShed, selectedAge, selectedBreed, startDate, endDate]);

    // Monthly Averages (Global)
    const monthlyAverageData = useMemo(() => {
        return calculateMonthlyAverages(filteredData, Object.keys(METRIC_CONFIG));
    }, [filteredData]);

    // Global Averages
    const globalAverages = useMemo(() => {
        const avg: {[key: string]: string} = {};
        Object.keys(METRIC_CONFIG).forEach(key => {
            const result = calculateAllStats(filteredData, key);
            avg[key] = result.mean.toFixed(2);
        });
        return avg;
    }, [filteredData]);
    
    // Chat Handler
    const handleChatSubmit = async (query: string, dataContext: string) => {
        setIsThinking(true);
        setChatHistory(prev => [...prev, { role: 'user', text: query, sources: [] }]);

        try {
            const result = await sendMessageToGemini(query, dataContext);
            setChatHistory(prev => [...prev, { role: 'model', text: result.text, sources: result.sources }]);
        } catch (error) {
            setChatHistory(prev => [...prev, { role: 'model', text: "Lo siento, hubo un error técnico al contactar al asistente.", sources: [] }]);
        } finally {
            setIsThinking(false);
        }
    };

    // File Upload Handler
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const lines = content.split(/[\r\n]+/).filter(line => line.trim() !== '');
                if (lines.length < 2) throw new Error("Archivo vacío o sin datos.");
                
                const delimiter = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
                const normalize = (str: string) => str.toLowerCase().replace(/[.\s]/g, '');
                const headers = lines[0].split(delimiter).map(h => normalize(h.trim()));
                
                const map: {[key: string]: string} = { 
                    'fecha': 'date', 'granja': 'farm', 'caseta': 'shed', 'edad': 'age',
                    'peso': 'weight', 'resistencia': 'breakingStrength', 'altura': 'height',
                    'unidadeshaugh': 'haughUnits', 'coloryema': 'yolkColor', 
                    'grosorcascaron': 'shellThickness', 'estirpe': 'breed'
                };
                
                const dataIndex: {[key: string]: number} = {};
                headers.forEach((h, i) => {
                    Object.keys(map).forEach(key => { if(h.includes(key)) dataIndex[map[key]] = i; });
                });

                if (dataIndex.date === undefined) throw new Error("Columna 'Fecha' no encontrada.");

                const newData = lines.slice(1).map(line => {
                    const cols = line.split(delimiter);
                    const row: any = {};
                    Object.keys(dataIndex).forEach(key => {
                        let val = cols[dataIndex[key]];
                        if(val) val = val.trim();
                        
                        if (['weight', 'breakingStrength', 'shellThickness', 'yolkColor', 'haughUnits'].includes(key)) {
                            const numValue = parseFloat(val?.replace(',', '.') || 'NaN');
                            row[key] = isNaN(numValue) ? null : numValue;
                        } else if (key === 'date') {
                            if (val && val.includes('/')) {
                                const parts = val.split('/');
                                row[key] = `${parts[2]}-${parts[1]}-${parts[0]}`; 
                            } else {
                                row[key] = val; 
                            }
                        } else {
                            row[key] = val;
                        }
                    });
                    return row;
                }).filter((r: any) => r.date && r.farm && r.shed) as EggData[];

                if (newData.length === 0) throw new Error("No se pudo extraer data válida de las filas.");

                setDashboardData(newData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
                setModal({ show: true, message: `Datos cargados exitosamente. ${newData.length} registros procesados.`, type: 'info' });
            } catch (err: any) {
                setModal({ show: true, message: `Error al procesar el archivo: ${err.message}`, type: 'error' });
            }
        };
        reader.readAsText(file); 
    };

    // Download PDF Handler
    const handleDownload = async (elementId: string, filename: string) => {
        if (!scriptsReady) { setModal({ show: true, message: "Librerías cargando...", type: 'info' }); return; }
        const element = document.getElementById(elementId);
        if (!element) return;
        setIsDownloading(true);
        try {
            // @ts-ignore
            const canvas = await window.html2canvas(element, { backgroundColor: '#ffffff', scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            // @ts-ignore
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'px',
                format: [canvas.width, canvas.height]
            });
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save(filename);
        } catch (error) {
            console.error("Error al generar PDF:", error);
            setModal({ show: true, message: "Error al generar PDF", type: 'error' });
        } finally {
            setIsDownloading(false);
        }
    };
    
    const handleChartZoom = (type: 'line' | 'bar' | 'histogram', key: string, title: string, data: any[] = filteredData, xAxisKey = 'date') => {
        let chartData = data;
        let chartXAxisKey = xAxisKey;

        // Si es histograma, procesar los datos crudos antes de enviarlos al modal
        if (type === 'histogram' && data === filteredData) {
             chartData = getHistogramData(data, key);
             chartXAxisKey = 'rangeLabel';
        }

        setZoomedChart({ 
            type, 
            title: type === 'histogram' ? `Histograma ${title}` : title, 
            data: chartData, 
            dataKey: key, 
            color: METRIC_CONFIG[key].color, 
            xAxisKey: chartXAxisKey
        });
    };

    // --- Report Specific Data ---
    const METRIC_KEYS = useMemo(() => Object.keys(METRIC_CONFIG), []);
    const uniqueShedsInFilter = useMemo(() => [...new Set(filteredData.map(d => d.shed).filter(Boolean))].sort(), [filteredData]);

    const comparativeChartData = useMemo(() => {
        return uniqueShedsInFilter.map(shed => {
            const shedData = filteredData.filter(d => d.shed === shed);
            const averages: { [key: string]: any } = { shed };
            METRIC_KEYS.forEach(key => {
                const stats = calculateAllStats(shedData, key);
                averages[key] = parseFloat(stats.mean.toFixed(2));
            });
            return averages;
        });
    }, [filteredData, uniqueShedsInFilter, METRIC_KEYS]);

    const comparativeStatsData = useMemo(() => {
        return uniqueShedsInFilter.map(shed => {
            const shedData = filteredData.filter(d => d.shed === shed);
            const stats: { [key: string]: any } = { shed };
            METRIC_KEYS.forEach(key => {
                const result = calculateAllStats(shedData, key);
                stats[`${key}_mean`] = result.mean.toFixed(2);
                stats[`${key}_min`] = result.min.toFixed(2);
                stats[`${key}_max`] = result.max.toFixed(2);
                stats[`${key}_std`] = result.std.toFixed(2);
            });
            return stats;
        });
    }, [filteredData, uniqueShedsInFilter, METRIC_KEYS]);

    // Report Highlight State & Logic
    const [highlightMetric, setHighlightMetric] = useState(METRIC_KEYS[0]);
    const [highlightConfig, setHighlightConfig] = useState<{ metricKey: string | null; criteria: 'best' | 'worst' | null; shed: string | null }>({ metricKey: null, criteria: null, shed: null });
    
    const handleHighlight = (key: string, criteria: 'best' | 'worst') => {
        if (!key || comparativeChartData.length === 0) return;
        const targetShed = comparativeChartData.reduce((prev, current) => {
            if (criteria === 'best') return (current[key] > prev[key]) ? current : prev;
            return (current[key] < prev[key]) ? current : prev;
        });
        setHighlightConfig({ metricKey: key, criteria, shed: targetShed.shed });
    };

    const clearHighlight = () => setHighlightConfig({ metricKey: null, criteria: null, shed: null });


    // --- Render Logic ---
    if (authChecking) {
        return <div className="h-screen w-full flex items-center justify-center bg-slate-50"><Loader className="animate-spin text-blue-600" /></div>;
    }

    if (!isAuthenticated) {
        return <LoginScreen onLogin={handleLogin} />;
    }

    return (
        <div className="flex min-h-screen bg-slate-50 font-sans text-slate-800">
            {/* --- Sidebar --- */}
            <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white text-slate-700 transform transition-transform duration-300 ease-in-out ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 border-r border-slate-200 flex flex-col`}>
                <div className="p-6 flex items-center gap-3 border-b border-slate-200">
                    <EggMonitorLogo size={42} />
                    <div>
                        <h1 className="text-xl font-bold leading-none">
                            <span className="text-cyan-600">Egg</span>
                            <span className="text-yellow-600">Monitor</span>
                        </h1>
                        <span className="text-xs text-slate-500">Quality Dashboard</span>
                    </div>
                </div>

                <nav className="p-4 space-y-2 flex-grow overflow-y-auto">
                    <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Vistas</p>
                    <SidebarItem icon={Activity} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
                    <SidebarItem icon={BarChart2} label="Histogramas" active={activeTab === 'histograms'} onClick={() => setActiveTab('histograms')} />
                    <SidebarItem icon={TrendingUp} label="Promedios Mensuales" active={activeTab === 'monthly-averages'} onClick={() => setActiveTab('monthly-averages')} /> 
                    <SidebarItem icon={FileText} label="Resumen Datos" active={activeTab === 'summary'} onClick={() => setActiveTab('summary')} />
                    <SidebarItem icon={MessageSquare} label="Asistente Avícola" active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} />
                    
                    <div className="pt-4 mt-2 border-t border-slate-200">
                         <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Reportes</p>
                         <SidebarItem icon={ClipboardList} label="Generar Reporte" active={activeTab === 'report'} onClick={() => setActiveTab('report')} />
                    </div>
                    
                    <div className="pt-4 mt-2 border-t border-slate-200">
                        <p className="px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider mb-4">Filtros ({filteredData.length})</p>
                        <div className="space-y-4 px-2">
                            <div>
                                <label className="block text-xs mb-1 text-slate-700 flex items-center gap-1"><Calendar size={12}/> Rango de Fechas</label>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-slate-100 border border-slate-300 rounded text-xs text-slate-900 p-2 mb-2 focus:ring-blue-500 focus:border-blue-500" />
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-slate-100 border border-slate-300 rounded text-xs text-slate-900 p-2 focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                            {['Granja', 'Caseta', 'Edad', 'Estirpe'].map((label, idx) => {
                            const val = [selectedFarm, selectedShed, selectedAge, selectedBreed][idx];
                            const setVal = [setSelectedFarm, setSelectedShed, setSelectedAge, setSelectedBreed][idx];
                            const opts = [FARMS, SHEDS, AGES, BREEDS][idx];
                            return (
                                <div key={label}>
                                    <label className="block text-xs mb-1 text-slate-700">{label}</label>
                                    <select value={val} onChange={e => setVal(e.target.value)} className="w-full bg-slate-100 border border-slate-300 rounded text-sm text-slate-900 p-2 focus:ring-blue-500 focus:border-blue-500">
                                        {opts.map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                </div>
                            );
                            })}
                        </div>
                    </div>
                </nav>

                 <div className="p-4 bg-white border-t border-slate-200 flex-shrink-0">
                    <label className="flex items-center gap-2 cursor-pointer bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg justify-center transition-colors mb-2">
                        <Upload size={18} />
                        <span className="text-sm font-medium">Subir CSV</span>
                        <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                    </label>
                    <p className="text-xs text-center mb-2 text-slate-500 truncate">{fileName}</p>
                    <SidebarLogout onClick={handleLogout} />
                </div>
            </aside>

            {/* --- Main Content --- */}
            <main className="flex-1 overflow-y-auto h-screen relative">
                <div className="md:hidden bg-white p-4 shadow-sm flex justify-between items-center sticky top-0 z-30">
                    <div className="flex items-center gap-2">
                         <EggMonitorLogo size={32} />
                         <span className="font-bold">
                            <span className="text-cyan-600">Egg</span>
                            <span className="text-yellow-600">Monitor</span>
                         </span>
                    </div>
                    <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-slate-600">
                        <Menu size={24} />
                    </button>
                </div>

                <div className="p-4 md:p-8 max-w-7xl mx-auto pb-20">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                        <div className="w-full">
                            <h2 className={`font-bold text-slate-800 mb-2 ${activeTab === 'dashboard' ? 'text-4xl text-center' : 'text-2xl'}`}>
                                {activeTab === 'dashboard' && 'Dashboard Principal'}
                                {activeTab === 'histograms' && 'Distribución de Frecuencias'}
                                {activeTab === 'monthly-averages' && 'Análisis de Tendencia Mensual'}
                                {activeTab === 'summary' && 'Resumen Estadístico'}
                                {activeTab === 'chat' && 'Asistente Avícola IA'}
                                {activeTab === 'report' && 'Reporte de Calidad de Huevo'}
                            </h2>
                            <p className={`text-slate-500 text-sm mt-1 ${activeTab === 'dashboard' ? 'text-center' : ''}`}>
                                Mostrando datos del <span className="font-semibold">{new Date(startDate).toLocaleDateString()}</span> al <span className="font-semibold">{new Date(endDate).toLocaleDateString()}</span>
                            </p>
                        </div>
                         {activeTab !== 'report' && isDownloading && <div className="flex items-center text-blue-600 text-sm font-medium"><Loader className="animate-spin mr-2" size={16} /> Generando reporte...</div>}
                    </div>

                    {/* VISTA DASHBOARD */}
                    {activeTab === 'dashboard' && (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                <CountCard title="Piezas" value={filteredData.length} icon={Egg} color="#06b6d4" />
                                {Object.keys(METRIC_CONFIG).map(key => (
                                    <MetricCard 
                                        key={key}
                                        title={METRIC_CONFIG[key].name}
                                        value={globalAverages[key]}
                                        data={filteredData}
                                        dataKey={key}
                                        color={METRIC_CONFIG[key].color}
                                        unit={METRIC_CONFIG[key].unit}
                                        icon={METRIC_CONFIG[key].icon}
                                        onZoom={() => handleChartZoom('line', key, METRIC_CONFIG[key].name)}
                                    />
                                ))}
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {Object.keys(METRIC_CONFIG).map((key) => (
                                    <DashboardChart 
                                        key={key}
                                        chartId={`chart-${key}`}
                                        title={`Evolución: ${METRIC_CONFIG[key].name}`}
                                        data={filteredData}
                                        dataKey={key}
                                        color={METRIC_CONFIG[key].color}
                                        onDownload={handleDownload}
                                        scriptsReady={scriptsReady}
                                        onZoom={() => handleChartZoom('line', key, METRIC_CONFIG[key].name)}
                                        metricConfig={METRIC_CONFIG}
                                        unit={METRIC_CONFIG[key].unit}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* VISTA HISTOGRAMAS */}
                    {activeTab === 'histograms' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                             {Object.keys(METRIC_CONFIG).map((key) => (
                                <DashboardChart 
                                    key={key}
                                    type="histogram"
                                    chartId={`hist-${key}`}
                                    title={`Distribución: ${METRIC_CONFIG[key].name}`}
                                    data={filteredData}
                                    dataKey={key}
                                    color={METRIC_CONFIG[key].color}
                                    onDownload={handleDownload}
                                    scriptsReady={scriptsReady}
                                    onZoom={() => handleChartZoom('histogram', key, METRIC_CONFIG[key].name, filteredData, 'rangeLabel')}
                                    metricConfig={METRIC_CONFIG}
                                />
                             ))}
                        </div>
                    )}
                    
                    {/* VISTA PROMEDIOS MENSUALES */}
                    {activeTab === 'monthly-averages' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
                             {Object.keys(METRIC_CONFIG).map((key) => (
                                <div key={key} id={`monthly-bar-chart-${key}`} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col min-h-[350px] relative group">
                                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                        <button onClick={() => handleChartZoom('bar', key, `${METRIC_CONFIG[key].name} - Promedio Mensual`, monthlyAverageData, 'dateLabel')} className="p-1.5 bg-gray-50 text-gray-500 rounded-md hover:text-blue-600 hover:bg-blue-50">
                                            <ZoomIn size={16} />
                                        </button>
                                    </div>
                                    <div className="flex justify-between items-center mb-4">
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-800">{METRIC_CONFIG[key].name}</h3>
                                            <p className="text-xs text-slate-400">Promedio Mensual ({METRIC_CONFIG[key].unit})</p>
                                        </div>
                                        <button 
                                            onClick={() => handleDownload(`monthly-bar-chart-${key}`, `${METRIC_CONFIG[key].name}-Mensual.pdf`)} 
                                            disabled={!scriptsReady}
                                            className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-30"
                                        >
                                            <Download size={18} />
                                        </button>
                                    </div>
                                    <div className="flex-grow min-h-[250px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={monthlyAverageData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="dateLabel" stroke="#94a3b8" tick={{fontSize: 10}} tickLine={false} axisLine={false} dy={10} />
                                                <YAxis stroke="#94a3b8" tick={{fontSize: 10}} tickLine={false} axisLine={false} tickFormatter={(t) => t.toFixed(1)} domain={['auto', 'auto']} />
                                                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value: number) => [`${value.toFixed(2)} ${METRIC_CONFIG[key].unit}`, METRIC_CONFIG[key].name]} />
                                                <Bar dataKey={key} fill={METRIC_CONFIG[key].color} radius={[4, 4, 0, 0]} name={METRIC_CONFIG[key].name} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                             ))}
                        </div>
                    )}

                    {/* VISTA RESUMEN (TABLA) */}
                    {activeTab === 'summary' && (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-100 animate-in fade-in duration-500" id="summary-table">
                            <div className="p-6 border-b border-slate-100 flex justify-between">
                                <h3 className="font-bold text-lg text-slate-800">Desglose Estadístico Completo</h3>
                                <button onClick={() => handleDownload('summary-table', 'Reporte-Completo.pdf')} className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm font-medium"><Download size={16}/> Exportar PDF</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                                {Object.keys(METRIC_CONFIG).map(key => {
                                    const stats = calculateAllStats(filteredData, key);
                                    return (
                                        <div key={key} className="border rounded-xl p-4 hover:border-blue-300 transition-colors">
                                            <div className="flex items-center gap-2 mb-4">
                                                <div className="w-2 h-8 rounded-full" style={{ backgroundColor: METRIC_CONFIG[key].color }}></div>
                                                <h4 className="font-bold text-slate-700">{METRIC_CONFIG[key].name}</h4>
                                            </div>
                                            <div className="space-y-1 text-sm">
                                                <div className="flex justify-between py-1"><span className="text-gray-500">Promedio</span><span className="font-semibold text-gray-900">{stats.mean.toFixed(2)} {METRIC_CONFIG[key].unit}</span></div>
                                                <div className="flex justify-between py-1"><span className="text-gray-500">Mínimo</span><span className="font-semibold text-gray-900">{stats.min.toFixed(2)}</span></div>
                                                <div className="flex justify-between py-1"><span className="text-gray-500">Máximo</span><span className="font-semibold text-gray-900">{stats.max.toFixed(2)}</span></div>
                                                <div className="flex justify-between py-1"><span className="text-gray-500">Desv. Estándar</span><span className="font-semibold text-gray-900">{stats.std.toFixed(2)}</span></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    
                    {/* VISTA CHAT */}
                    {activeTab === 'chat' && (
                        <div className="animate-in fade-in duration-500">
                            <ChatBox
                                chatHistory={chatHistory}
                                onSubmit={handleChatSubmit}
                                isThinking={isThinking}
                                filters={{
                                    selectedFarm, selectedShed, selectedAge, selectedBreed, 
                                    startDate, endDate, recordCount: filteredData.length
                                }}
                                averages={globalAverages}
                                metricConfig={METRIC_CONFIG}
                            />
                        </div>
                    )}

                    {/* VISTA REPORTE COMPARATIVO POR CASETA */}
                    {activeTab === 'report' && (
                        <div className="animate-in fade-in duration-500">
                             <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 mb-6">
                                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-800">Previsualización del Reporte Comparativo</h3>
                                        <p className="text-sm text-slate-500">El PDF contendrá la tabla y gráficos comparativos de esta página.</p>
                                    </div>
                                    <button 
                                        onClick={() => handleDownload('full-report-content', `Reporte-Calidad-Huevo.pdf`)}
                                        disabled={!scriptsReady || isDownloading}
                                        className="w-full md:w-auto flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl transition-all disabled:bg-green-300"
                                    >
                                        {isDownloading ? <Loader className="animate-spin" size={20}/> : <Download size={20} />}
                                        {isDownloading ? 'Generando PDF...' : 'Descargar Reporte Completo'}
                                    </button>
                                </div>
                                <div className="mt-6 pt-6 border-t border-slate-200 flex flex-col md:flex-row items-center gap-2 md:gap-4">
                                    <h4 className="text-sm font-semibold text-slate-600 mb-2 md:mb-0">Análisis Rápido:</h4>
                                    <select
                                        value={highlightMetric}
                                        onChange={(e) => setHighlightMetric(e.target.value)}
                                        className="w-full md:w-auto bg-slate-100 border border-slate-300 rounded-lg text-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        {METRIC_KEYS.map(key => <option key={key} value={key}>{METRIC_CONFIG[key].name}</option>)}
                                    </select>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleHighlight(highlightMetric, 'best')} className="text-sm font-medium bg-green-100 text-green-800 px-3 py-2 rounded-lg hover:bg-green-200 transition-colors">Mejor Rendimiento</button>
                                        <button onClick={() => handleHighlight(highlightMetric, 'worst')} className="text-sm font-medium bg-red-100 text-red-800 px-3 py-2 rounded-lg hover:bg-red-200 transition-colors">Peor Rendimiento</button>
                                        <button onClick={clearHighlight} className="text-sm text-slate-500 hover:text-slate-800 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors">Limpiar</button>
                                    </div>
                                </div>
                            </div>

                            <div id="full-report-content" className="bg-white p-8 rounded-xl">
                                {/* Report Header */}
                                <div className="relative border-b pb-8 border-slate-200 mb-12">
                                    <div className="absolute top-0 left-0">
                                        <EggMonitorLogo size={72} />
                                    </div>
                                    <div className="text-center">
                                        <h1 className="text-4xl font-extrabold text-slate-800">
                                            <span className="text-cyan-600">Egg</span><span className="text-yellow-600">Monitor</span>
                                        </h1>
                                        <h2 className="text-3xl font-bold text-slate-700 mt-2">Reporte de Calidad de Huevo</h2>
                                        <p className="mt-4 text-slate-500">
                                            Datos desde <span className="font-semibold">{new Date(startDate).toLocaleDateString()}</span> hasta <span className="font-semibold">{new Date(endDate).toLocaleDateString()}</span>
                                        </p>
                                        <div className="mt-4 text-xs text-slate-400">
                                            Filtros Aplicados: Granja ({selectedFarm}), Caseta ({selectedShed}), Edad ({selectedAge}), Estirpe ({selectedBreed})
                                        </div>
                                    </div>
                                </div>


                                {uniqueShedsInFilter.length > 0 ? (
                                    <>
                                        {/* Section 1: Stats Table */}
                                        <div>
                                            <h2 className="text-2xl font-bold text-slate-700 mb-6">1. Tabla Comparativa de Estadísticas</h2>
                                            <div className="overflow-x-auto rounded-lg border border-slate-200">
                                                <table className="min-w-full divide-y divide-slate-200 text-sm">
                                                    <thead className="bg-slate-50">
                                                        <tr>
                                                            <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-600 sticky left-0 bg-slate-50 z-10">Caseta</th>
                                                            {METRIC_KEYS.map(key => (
                                                                <th key={key} colSpan={4} className="px-4 py-3 text-center font-semibold text-slate-600 border-l border-slate-200">
                                                                    {METRIC_CONFIG[key].name}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                        <tr>
                                                            <th scope="col" className="px-4 py-2 text-left font-medium text-slate-500 sticky left-0 bg-slate-50 z-10"></th>
                                                            {METRIC_KEYS.map(key => (
                                                                <React.Fragment key={`${key}-sub`}>
                                                                    <th scope="col" className="px-2 py-2 text-center font-medium text-slate-500 border-l border-slate-200">Prom.</th>
                                                                    <th scope="col" className="px-2 py-2 text-center font-medium text-slate-500">Mín.</th>
                                                                    <th scope="col" className="px-2 py-2 text-center font-medium text-slate-500">Máx.</th>
                                                                    <th scope="col" className="px-2 py-2 text-center font-medium text-slate-500">DE</th>
                                                                </React.Fragment>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-200 bg-white">
                                                        {comparativeStatsData.map(row => (
                                                            <tr key={row.shed} className={`transition-colors ${
                                                                highlightConfig.shed === row.shed ? (highlightConfig.criteria === 'best' ? 'bg-green-50' : 'bg-red-50') : 'hover:bg-slate-50'
                                                            }`}>
                                                                <td className={`px-4 py-3 font-bold text-slate-800 sticky left-0 z-10 ${
                                                                    highlightConfig.shed === row.shed ? (highlightConfig.criteria === 'best' ? 'bg-green-50' : 'bg-red-50') : 'bg-white'
                                                                }`}>{row.shed}</td>
                                                                {METRIC_KEYS.map(key => (
                                                                    <React.Fragment key={`${key}-${row.shed}`}>
                                                                        <td className={`px-2 py-3 text-center text-slate-700 font-semibold border-l border-slate-200 transition-all ${
                                                                            highlightConfig.shed === row.shed && highlightConfig.metricKey === key ? 'ring-2 ring-offset-0 ring-blue-500 rounded' : ''
                                                                        }`}>{row[`${key}_mean`]}</td>
                                                                        <td className="px-2 py-3 text-center text-slate-600">{row[`${key}_min`]}</td>
                                                                        <td className="px-2 py-3 text-center text-slate-600">{row[`${key}_max`]}</td>
                                                                        <td className="px-2 py-3 text-center text-slate-600">{row[`${key}_std`]}</td>
                                                                    </React.Fragment>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* Section 2: Comparative Charts */}
                                        <div className="mt-12 pt-12 border-t-2 border-cyan-600">
                                            <h2 className="text-2xl font-bold text-slate-700 mb-8">2. Gráficos Comparativos de Promedios</h2>
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-12">
                                                {METRIC_KEYS.map(key => (
                                                    <div key={`compare-chart-${key}`} className="min-h-[300px]">
                                                        <h3 className="font-bold text-center text-slate-600 mb-4">{`Promedio de ${METRIC_CONFIG[key].name} por Caseta`}</h3>
                                                        <ResponsiveContainer width="100%" height={300}>
                                                            <BarChart data={comparativeChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                                <XAxis dataKey="shed" stroke="#94a3b8" tick={{fontSize: 12}} />
                                                                <YAxis stroke="#94a3b8" tick={{fontSize: 10}} domain={['auto', 'auto']} tickFormatter={(t) => t.toFixed(1)} />
                                                                <Tooltip
                                                                    cursor={{fill: '#f8fafc'}}
                                                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                                    formatter={(value: number) => [`${value.toFixed(2)} ${METRIC_CONFIG[key].unit}`, METRIC_CONFIG[key].name]}
                                                                />
                                                                <Bar dataKey={key} name={METRIC_CONFIG[key].name} radius={[4, 4, 0, 0]}>
                                                                    {comparativeChartData.map((entry, index) => (
                                                                        <Cell key={`cell-${index}`} fill={
                                                                            highlightConfig.shed === entry.shed && highlightConfig.metricKey === key
                                                                            ? (highlightConfig.criteria === 'best' ? '#10b981' : '#ef4444')
                                                                            : METRIC_CONFIG[key].color
                                                                        } />
                                                                    ))}
                                                                </Bar>
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        
                                        {/* Section 3: Gauge Charts */}
                                        <div className="mt-12 pt-12 border-t-2 border-cyan-600">
                                            <h2 className="text-2xl font-bold text-slate-700 mb-8">3. Diagnóstico de Calidad por Caseta</h2>
                                            <div className="space-y-12">
                                                {comparativeStatsData.map(shedData => (
                                                <div key={shedData.shed}>
                                                    <h3 className="text-xl font-bold text-slate-800 mb-6 pb-2 border-b-2 border-slate-300">Diagnóstico para: <span className="text-blue-600">{shedData.shed}</span></h3>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                                                    {METRIC_KEYS.map(key => (
                                                        <GaugeChart
                                                        key={`${shedData.shed}-${key}`}
                                                        metricKey={key}
                                                        value={parseFloat(shedData[`${key}_mean`])}
                                                        standards={QUALITY_STANDARDS}
                                                        metricConfig={METRIC_CONFIG}
                                                        />
                                                    ))}
                                                    </div>
                                                </div>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center py-20 text-slate-500">
                                        <ClipboardList size={40} className="mx-auto mb-4 text-slate-400"/>
                                        <h3 className="text-xl font-bold">No hay Datos para Reportar</h3>
                                        <p>Por favor, ajuste los filtros para incluir al menos una caseta con registros.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Modales */}
            {modal.show && <Modal message={modal.message} type={modal.type} onClose={() => setModal({ ...modal, show: false })} />}
            {zoomedChart && <ChartModal chartConfig={zoomedChart} onClose={() => setZoomedChart(null)} metricConfig={METRIC_CONFIG} />}
            {mobileMenuOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden" onClick={() => setMobileMenuOpen(false)}></div>}
        </div>
    );
}