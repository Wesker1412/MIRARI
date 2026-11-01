import React from 'react';
import { TransitSimulator } from '../article/TransitSimulator';

export interface InteractiveParameterMeta {
  name: string;
  labelZh: string;
  description: string;
  defaultValue: number | string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
}

export interface InteractiveComponentMeta {
  id: string;
  nameZh: string;
  descriptionZh: string;
  parameters: InteractiveParameterMeta[];
  keyConcepts: string[];
  component: React.ComponentType;
}

export const INTERACTIVE_COMPONENTS: Record<string, InteractiveComponentMeta> = {
  TransitSimulator: {
    id: 'TransitSimulator',
    nameZh: '系外行星凌日與光度曲線模擬器',
    descriptionZh:
      '即時雙維度幾何投影與光通量時間序列曲線模擬器，展示行星半徑比、軌道傾角對光變深度與形狀的嚴密幾何對應。',
    parameters: [
      {
        name: 'planetRadiusRatio',
        labelZh: '行星／恆星半徑比 (Rp/R*)',
        description: '決定遮蔽截面面積，正比於凌日深度平方比',
        defaultValue: 0.1,
        min: 0.03,
        max: 0.25,
        step: 0.01,
      },
      {
        name: 'orbitalInclination',
        labelZh: '軌道傾角 (度)',
        description: '決定行星是否掠過星盤中央或邊緣，影響幾何衝擊參數 b',
        defaultValue: 90.0,
        unit: '°',
        min: 80.0,
        max: 90.0,
        step: 0.5,
      },
      {
        name: 'starLimbDarkening',
        labelZh: '周邊昏暗係數 (u)',
        description: '控制恆星盤面中心至邊緣之輻射強度梯度',
        defaultValue: 0.6,
        min: 0.0,
        max: 1.0,
        step: 0.1,
      },
    ],
    keyConcepts: [
      '凌日現象 (Transit)',
      '光度曲線 (Light Curve)',
      '凌日深度 (Transit Depth)',
      '周邊昏暗 (Limb Darkening)',
      '幾何衝擊參數 (Impact Parameter)',
    ],
    component: TransitSimulator,
  },
};

export function getInteractiveComponent(id: string): InteractiveComponentMeta | undefined {
  return INTERACTIVE_COMPONENTS[id];
}
