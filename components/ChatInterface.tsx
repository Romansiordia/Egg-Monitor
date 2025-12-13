import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MessageSquare, Send, Loader, Egg } from 'lucide-react';
import { ChatMessageData, FilterState, MetricConfig } from '../types';

interface ChatMessageProps {
    role: 'user' | 'model';
    text: string;
    sources?: { uri?: string; title?: string }[];
}

const ChatMessage: React.FC<ChatMessageProps> = ({ role, text, sources = [] }) => {
    const isModel = role === 'model';
    return (
        <div className={`flex mb-4 ${isModel ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-3xl px-4 py-3 rounded-xl shadow-md ${
                isModel ? 'bg-slate-100 text-slate-800 rounded-tl-none' : 'bg-blue-600 text-white rounded-tr-none'
            }`}>
                <p className="whitespace-pre-wrap">{text}</p>
                {isModel && sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-300 text-xs text-slate-500">
                        <p className="font-semibold mb-1">Fuentes (Grounding):</p>
                        <ul className="list-disc pl-4 space-y-0.5">
                            {sources.map((s, index) => (
                                <li key={index}><a href={s.uri} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 underline truncate block">{s.title || s.uri}</a></li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};

interface ChatBoxProps {
    chatHistory: ChatMessageData[];
    onSubmit: (input: string, context: string) => void;
    isThinking: boolean;
    filters: FilterState;
    averages: {[key: string]: string};
    metricConfig: MetricConfig;
}

export const ChatBox: React.FC<ChatBoxProps> = ({ chatHistory, onSubmit, isThinking, filters, averages, metricConfig }) => {
    const [input, setInput] = useState('');
    const endOfMessagesRef = useRef<HTMLDivElement>(null);
    const contextRef = useRef<HTMLDetailsElement>(null);

    useEffect(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatHistory]);

    const dataContext = useMemo(() => {
        const avg = Object.keys(averages).map(key => 
            `${metricConfig[key].name}: ${averages[key]} ${metricConfig[key].unit}`
        ).join(', ');

        const filterContext = `Filtros Aplicados: Granja: ${filters.selectedFarm}, Caseta: ${filters.selectedShed}, Edad: ${filters.selectedAge}, Estirpe: ${filters.selectedBreed}. Rango de Fechas: ${new Date(filters.startDate).toLocaleDateString()} a ${new Date(filters.endDate).toLocaleDateString()}.`;
        const totalRecords = `Total de Piezas (Registros) en el contexto actual: ${filters.recordCount}.`;

        return `Contexto de Datos Actual:\n${filterContext}\n${totalRecords}\nPromedios Clave: ${avg}.`;
    }, [filters, averages, metricConfig]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() === '' || isThinking) return;
        onSubmit(input, dataContext);
        setInput('');
    };

    return (
        <div className="bg-white rounded-xl shadow-lg border border-slate-100 flex flex-col h-[calc(100vh-200px)] min-h-[500px]">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                    <MessageSquare size={20} className="text-blue-600"/> 
                    Asistente Avícola (Gemini)
                </h3>
            </div>
            
            <div className="text-xs p-3 bg-slate-50 border-b border-slate-200">
                <details ref={contextRef}>
                    <summary className="cursor-pointer font-medium text-slate-500 hover:text-slate-800 transition-colors">
                        Ver Contexto de Datos (Enviado al Experto)
                    </summary>
                    <pre className="mt-2 p-2 bg-white rounded-lg overflow-auto text-[10px] text-slate-600 border border-slate-300">
                        {dataContext}
                    </pre>
                </details>
            </div>

            <div className="flex-grow p-4 overflow-y-auto space-y-4">
                {chatHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center">
                        <Egg size={40} className="mb-2"/>
                        <p className="text-sm">Pregúntale al experto sobre los promedios y tendencias.</p>
                        <p className="text-xs">(Ej: "¿Qué significa una Resistencia baja para esta estirpe?")</p>
                    </div>
                ) : (
                    chatHistory.map((msg, index) => (
                        <ChatMessage key={index} role={msg.role} text={msg.text} sources={msg.sources} />
                    ))
                )}
                {isThinking && (
                    <div className="flex justify-start mb-4">
                        <div className="bg-slate-100 px-4 py-3 rounded-xl rounded-tl-none shadow-md text-slate-500 flex items-center text-sm">
                            <Loader size={16} className="animate-spin mr-2"/>
                            Pensando...
                        </div>
                    </div>
                )}
                <div ref={endOfMessagesRef} />
            </div>

            <form onSubmit={handleSubmit} className="p-4 border-t border-slate-200">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={isThinking ? "Esperando respuesta..." : "Escribe tu pregunta al experto..."}
                        className="flex-1 p-3 border border-slate-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50"
                        disabled={isThinking}
                    />
                    <button
                        type="submit"
                        disabled={isThinking || input.trim() === ''}
                        className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition-colors disabled:bg-blue-300"
                    >
                        <Send size={20} />
                    </button>
                </div>
            </form>
        </div>
    );
};