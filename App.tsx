import React, { useState, useMemo, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { 
  Activity, BarChart2, TrendingUp, FileText, MessageSquare, Menu, Calendar, Upload, Download, Loader, Egg, PieChart, ZoomIn 
} from 'lucide-react';

import { generateMockData, calculateAllStats, getHistogramData } from './utils/dataUtils';
import { sendMessageToGemini } from './services/geminiService';
import { EggData, ChartConfig, MetricConfig, TabType, ChatMessageData } from './types';
import { Modal, ChartModal, CountCard, MetricCard, SidebarItem, EggMonitorLogo } from './components/UI';
import { DashboardChart } from './components/Charts';
import { ChatBox } from './components/ChatInterface';

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

const INITIAL_DATA = generateMockData();

export default function App() {
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

    // Monthly Averages
    const monthlyAverageData = useMemo(() => {
        const grouped: any = {};
        filteredData.forEach(d => {
            const monthKey = d.date.substring(0, 7); // YYYY-MM
            if (!grouped[monthKey]) {
                grouped[monthKey] = { count: 0, dateLabel: monthKey.replace('-', '/') };
                Object.keys(METRIC_CONFIG).forEach(key => grouped[monthKey][key] = 0);
            }
            grouped[monthKey].count++;
            Object.keys(METRIC_CONFIG).forEach(key => {
                if (typeof d[key] === 'number') {
                    grouped[monthKey][key] += d[key] as number;
                }
            });
        });
        
        const averages = Object.keys(grouped).map(monthKey => {
            const totalCount = grouped[monthKey].count;
            const avg: any = { month: monthKey, dateLabel: grouped[monthKey].dateLabel };
            Object.keys(METRIC_CONFIG).forEach(key => {
                avg[key] = totalCount > 0 ? parseFloat((grouped[monthKey][key] / totalCount).toFixed(2)) : 0;
            });
            return avg;
        });
        return averages.sort((a: any, b: any) => new Date(a.month).getTime() - new Date(b.month).getTime());
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
            const orientation = canvas.width > canvas.height ? 'landscape' : 'portrait';
            const pdf = new jsPDF(orientation, 'px', [canvas.width, canvas.height]);
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

    return (
        <div className="flex min-h-screen bg-slate-50 font-sans text-slate-800">
            {/* --- Sidebar --- */}
            <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white text-slate-700 transform transition-transform duration-300 ease-in-out ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 border-r border-slate-200`}>
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

                <nav className="p-4 space-y-2">
                    <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Vistas</p>
                    <SidebarItem icon={Activity} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
                    <SidebarItem icon={BarChart2} label="Histogramas" active={activeTab === 'histograms'} onClick={() => setActiveTab('histograms')} />
                    <SidebarItem icon={TrendingUp} label="Promedios Mensuales" active={activeTab === 'monthly-averages'} onClick={() => setActiveTab('monthly-averages')} /> 
                    <SidebarItem icon={FileText} label="Resumen Datos" active={activeTab === 'summary'} onClick={() => setActiveTab('summary')} />
                    <SidebarItem icon={MessageSquare} label="Asistente Avícola" active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} />
                </nav>

                <div className="p-4 border-t border-slate-200">
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
                
                 <div className="absolute bottom-0 w-full p-4 bg-white border-t border-slate-200">
                    <label className="flex items-center gap-2 cursor-pointer bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg justify-center transition-colors">
                        <Upload size={18} />
                        <span className="text-sm font-medium">Subir CSV</span>
                        <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                    </label>
                    <p className="text-xs text-center mt-2 text-slate-500 truncate">{fileName}</p>
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
                                {activeTab === 'dashboard' && (
                                    <>
                                        <span className="text-cyan-600">Egg</span>
                                        <span className="text-yellow-600">Monitor</span>
                                    </>
                                )}
                                {activeTab === 'histograms' && 'Distribución de Frecuencias'}
                                {activeTab === 'monthly-averages' && 'Análisis de Tendencia Mensual'}
                                {activeTab === 'summary' && 'Resumen Estadístico'}
                                {activeTab === 'chat' && 'Asistente Avícola IA'}
                            </h2>
                            <p className={`text-slate-500 text-sm mt-1 ${activeTab === 'dashboard' ? 'text-center' : ''}`}>
                                Mostrando datos del <span className="font-semibold">{new Date(startDate).toLocaleDateString()}</span> al <span className="font-semibold">{new Date(endDate).toLocaleDateString()}</span>
                            </p>
                        </div>
                        {isDownloading && <div className="flex items-center text-blue-600 text-sm font-medium"><Loader className="animate-spin mr-2" size={16} /> Generando reporte...</div>}
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
                </div>
            </main>

            {/* Modales */}
            {modal.show && <Modal message={modal.message} type={modal.type} onClose={() => setModal({ ...modal, show: false })} />}
            {zoomedChart && <ChartModal chartConfig={zoomedChart} onClose={() => setZoomedChart(null)} metricConfig={METRIC_CONFIG} />}
            {mobileMenuOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden" onClick={() => setMobileMenuOpen(false)}></div>}
        </div>
    );
}