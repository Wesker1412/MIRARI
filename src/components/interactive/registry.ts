import React from 'react';
import { TransitSimulator } from '../article/TransitSimulator';
import { DoublePendulumSimulator } from '../article/DoublePendulumSimulator';
import { ActionPotentialSimulator } from '../article/ActionPotentialSimulator';
import { MaxwellDemonSimulator } from '../article/MaxwellDemonSimulator';

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
  DoublePendulumSimulator: {
    id: 'DoublePendulumSimulator',
    nameZh: '雙擺非線性混沌與李雅普諾夫發散模擬器',
    descriptionZh:
      '基於歐拉-拉格朗日運動方程式與四階龍格-庫塔 (RK4) 數值求解器，展示相鄰軌道指數量級指數發散的確定性隨機現象。',
    parameters: [
      {
        name: 'initialAngle1',
        labelZh: '初始角度 1',
        description: '第一擺臂角度',
        defaultValue: 90,
        unit: '°',
        min: -180,
        max: 180,
      },
      {
        name: 'initialAngle2',
        labelZh: '初始角度 2',
        description: '第二擺臂角度',
        defaultValue: 90,
        unit: '°',
        min: -180,
        max: 180,
      },
      {
        name: 'perturbation',
        labelZh: '初值微擾 (Δθ₀)',
        description: '對比軌道的初始微小差異',
        defaultValue: 0.001,
        unit: 'rad',
      },
    ],
    keyConcepts: [
      '確定性渾沌 (Deterministic Chaos)',
      '初值敏感性 (Butterfly Effect)',
      '李雅普諾夫指數 (Lyapunov Exponent)',
      '相空間軌跡 (Phase Space)',
      'RK4 數值積分',
    ],
    component: DoublePendulumSimulator,
  },
  ActionPotentialSimulator: {
    id: 'ActionPotentialSimulator',
    nameZh: '霍奇金-赫胥黎動作電位示波器模擬器',
    descriptionZh:
      '即時求解非線性四元 Hodgkin-Huxley 微分方程，探索神經膜電位、全或無定律、離子通道電導率與藥理學通道阻斷。',
    parameters: [
      {
        name: 'stimulusCurrent',
        labelZh: '刺激電流強度 (I_ext)',
        description: '注入軸突之去極化電流',
        defaultValue: 10.0,
        unit: 'μA/cm²',
        min: 0,
        max: 30,
      },
      {
        name: 'stimulusDuration',
        labelZh: '刺激持續時間',
        description: '電流脈衝寬度',
        defaultValue: 2.0,
        unit: 'ms',
      },
    ],
    keyConcepts: [
      '動作電位 (Action Potential)',
      '全或無定律 (All-or-None Law)',
      '電壓門控離子通道 (Voltage-gated Channels)',
      '不反應期 (Refractory Period)',
      '霍奇金-赫胥黎方程 (Hodgkin-Huxley)',
    ],
    component: ActionPotentialSimulator,
  },
  MaxwellDemonSimulator: {
    id: 'MaxwellDemonSimulator',
    nameZh: '麥克斯韋妖與資訊熵熱力學極限模擬器',
    descriptionZh:
      '微觀分子碰撞運動與測量排序模擬器，展示速度篩選降熵、妖之記憶庫佔用，以及抹除資訊時蘭道爾原理對熱力學第二定律的捍衛。',
    parameters: [
      {
        name: 'measurementError',
        labelZh: '測量誤差率',
        description: '妖對分子速度之測量雜訊',
        defaultValue: 0.05,
        min: 0,
        max: 0.3,
      },
      {
        name: 'thresholdVelocity',
        labelZh: '篩選速度門檻',
        description: '允許通過微觀閘門之快慢速度分界',
        defaultValue: 2.2,
      },
    ],
    keyConcepts: [
      '麥克斯韋妖 (Maxwell\'s Demon)',
      '資訊熵 (Information Entropy)',
      '蘭道爾原理 (Landauer\'s Principle)',
      '熱力學第二定律 (Second Law of Thermodynamics)',
      '不可逆計算與散熱極限',
    ],
    component: MaxwellDemonSimulator,
  },
};

export function getInteractiveComponent(id: string): InteractiveComponentMeta | undefined {
  return INTERACTIVE_COMPONENTS[id];
}
