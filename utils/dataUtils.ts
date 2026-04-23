
import { EggData } from '../types';

export const calculateAllStats = (data: EggData[], key: string) => {
    // Treat 0 and negatives as invalid/missing for these quality parameters
    const values = data.map(d => d[key]).filter((v): v is number => typeof v === 'number' && !isNaN(v) && v > 0);
    if (values.length === 0) return { mean: 0, std: 0, min: 0, max: 0 };
    const sum = values.reduce((acc, val) => acc + val, 0);
    const mean = sum / values.length;
    const sqDiffs = values.map(val => Math.pow(val - mean, 2));
    const avgSqDiff = sqDiffs.reduce((acc, val) => acc + val, 0) / values.length;
    const std = Math.sqrt(avgSqDiff);
    return { mean, std, min: Math.min(...values), max: Math.max(...values) };
};

export const getHistogramData = (data: EggData[], key: string, bins = 12) => {
    const values = data.map(d => d[key]).filter((v): v is number => typeof v === 'number' && !isNaN(v) && v > 0);
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
    
    // Grouped structure: { monthKey: { metric: { sum, count } } }
    const grouped: { [key: string]: any } = {};
    
    data.forEach(d => {
        const monthKey = d.date.substring(0, 7); // YYYY-MM
        if (!grouped[monthKey]) {
            grouped[monthKey] = { dateLabel: monthKey.replace('-', '/') };
            metricKeys.forEach(key => { grouped[monthKey][key] = { sum: 0, count: 0 }; });
        }
        
        metricKeys.forEach(key => {
            const val = d[key];
            // Filter out 0 or invalid values
            if (typeof val === 'number' && !isNaN(val) && val > 0) {
                grouped[monthKey][key].sum += val;
                grouped[monthKey][key].count++;
            }
        });
    });
    
    const averages = Object.keys(grouped).map(monthKey => {
        const item = grouped[monthKey];
        const avg: any = { 
            date: monthKey, 
            dateLabel: item.dateLabel 
        };
        metricKeys.forEach(key => {
            const metric = item[key];
            avg[key] = metric.count > 0 ? parseFloat((metric.sum / metric.count).toFixed(2)) : 0;
        });
        return avg;
    });

    return averages.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
};
