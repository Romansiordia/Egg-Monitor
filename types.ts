
import { LucideIcon } from 'lucide-react';

export interface EggData {
  date: string;
  farm: string;
  shed: string;
  age: string;
  breed: string;
  client?: string; 
  metaqualixId?: string; // Nuevo campo para No. Metaqualix
  weight: number;
  breakingStrength: number;
  shellThickness: number;
  yolkColor: number;
  haughUnits: number;
  [key: string]: string | number | null | undefined;
}

export interface MetricConfigItem {
  name: string;
  color: string;
  unit: string;
  icon: LucideIcon;
}

export interface MetricConfig {
  [key: string]: MetricConfigItem;
}

export interface ChartConfig {
  type: 'line' | 'bar' | 'histogram';
  title: string;
  data: any[];
  dataKey: string;
  color: string;
  xAxisKey?: string;
}

export interface ChatSource {
  uri?: string;
  title?: string;
}

export interface ChatMessageData {
  role: 'user' | 'model';
  text: string;
  sources?: ChatSource[];
}

export interface FilterState {
  selectedFarm: string;
  selectedShed: string;
  selectedAge: string;
  selectedBreed: string;
  selectedClient: string;
  selectedMetaqualix: string; // Nuevo filtro en el estado
  startDate: string;
  endDate: string;
  recordCount: number;
}

export type TabType = 'dashboard' | 'histograms' | 'monthly-averages' | 'summary' | 'chat' | 'report' | 'datasource';

export interface QualityStandard {
  min: number;
  max: number;
  ranges: {
    poor: [number, number];
    acceptable: [number, number];
    optimal: [number, number];
  };
}

export interface QualityStandardsConfig {
  [key: string]: QualityStandard;
}
