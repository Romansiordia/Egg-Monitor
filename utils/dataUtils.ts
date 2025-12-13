import { EggData } from '../types';

export const generateMockData = (): EggData[] => {
    const farms = ['Granja Sol', 'Granja Luna', 'Granja Estrella'];
    const sheds = ['A1', 'A2', 'B1', 'B2'];
    const ages = ['30', '45', '60', '75'];
    const breeds = ['Hy-Line', 'Lohmann', 'Shaver']; 
    const data: EggData[] = [];
    const endDate = new Date();

    for (let i = 180; i >= 0; i--) { 
        for (const farm of farms) {
            const date = new Date();
            date.setDate(endDate.getDate() - i);
            data.push({
                date: date.toISOString().split('T')[0],
                farm: farm, 
                shed: sheds[Math.floor(Math.random() * sheds.length)], 
                age: ages[Math.floor(Math.random() * ages.length)],
                breed: breeds[Math.floor(Math.random() * breeds.length)],
                weight: 58 + Math.random() * 10 - 5, 
                breakingStrength: 3.5 + Math.random() * 1.5 - 0.75,
                shellThickness: 0.35 + Math.random() * 0.1 - 0.05, 
                yolkColor: 9 + Math.random() * 4 - 2,
                haughUnits: 75 + Math.random() * 20 - 10,
            });
        }
    }
    return data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

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