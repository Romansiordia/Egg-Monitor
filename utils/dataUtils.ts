
import { EggData } from '../types';

export const calculateAllStats = (data: EggData[], key: string) => {
    const values = data.map(d => d[key]).filter((v): v is number => typeof v === 'number' && !isNaN(v));
    if (values.length === 0) return { mean: 0, std: 0, min: 0, max: 0 };
    const sum = values.reduce((acc, val) => acc + val, 0);
    const mean = sum / values.length;
    const sqDiffs = values.map(val => Math.pow(val - mean, 2));
    const avgSqDiff = sqDiffs.reduce((acc, val) => acc + val, 0) / values.length;
    const std = Math.sqrt(avgSqDiff);
    return { mean, std, min: Math.min(...values), max: Math.max(...values) };
};

export const getHistogramData = (data: EggData[], key: string, bins = 12) => {
    const values = data.map(d => d[key]).filter((v): v is number => typeof v === 'number' && !isNaN(v));
    if (values.length === 0) return [];
    const min = Math.min(...values); 
    const max = Math.max(...values);
    if (min === max) return [{ range: `${min.toFixed(2)}`, rangeLabel: `${min.toFixed(2)}`, count: values.length }];
    const binWidth = (max - min) / bins;
    const histogram = Array.from({ length: bins }, (_, i) => ({ 
        range: `${(min + i * binWidth).toFixed(1)}`,
        rangeLabel: `${(min + i * binWidth).toFixed(2)} - ${(min + (i + 1) * binWidth).toFixed(2)}`,
        count: 0 
    }));
    values.forEach(value => {
        let binIndex = Math.floor((value - min) / binWidth);
        if (binIndex === bins) binIndex--;
        if (histogram[binIndex]) histogram[binIndex].count++;
    });
    return histogram;
};

export const calculateMonthlyAverages = (data: EggData[], metricKeys: string[]) => {
    if (data.length === 0) return [];
    
    const grouped: { [key: string]: any } = {};
    
    data.forEach(d => {
        const monthKey = d.date.substring(0, 7); // YYYY-MM
        if (!grouped[monthKey]) {
            grouped[monthKey] = { count: 0, dateLabel: monthKey.replace('-', '/') };
            metricKeys.forEach(key => { grouped[monthKey][key] = 0; });
        }
        grouped[monthKey].count++;
        metricKeys.forEach(key => {
            if (typeof d[key] === 'number') {
                grouped[monthKey][key] += d[key] as number;
            }
        });
    });
    
    const averages = Object.keys(grouped).map(monthKey => {
        const totalCount = grouped[monthKey].count;
        const avg: any = { 
            date: monthKey, // Usamos 'date' para compatibilidad con DashboardChart
            dateLabel: grouped[monthKey].dateLabel 
        };
        metricKeys.forEach(key => {
            avg[key] = totalCount > 0 ? parseFloat((grouped[monthKey][key] / totalCount).toFixed(2)) : 0;
        });
        return avg;
    });

    return averages.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
};
