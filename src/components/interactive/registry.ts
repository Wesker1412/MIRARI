import React from 'react';
import { TransitSimulator } from '../article/TransitSimulator';
import { DoublePendulumSimulator } from '../article/DoublePendulumSimulator';
import { ActionPotentialSimulator } from '../article/ActionPotentialSimulator';
import { MaxwellDemonSimulator } from '../article/MaxwellDemonSimulator';
import { AmygdalaMemorySimulator } from '../article/AmygdalaMemorySimulator';
import { PhotovoltaicRecombinationSimulator } from '../article/PhotovoltaicRecombinationSimulator';
import { NuclearClockSimulator } from '../article/NuclearClockSimulator';

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
  AmygdalaMemorySimulator: {
    id: 'AmygdalaMemorySimulator',
    nameZh: '杏仁核單神經元發火與記憶編碼模擬器',
    descriptionZh:
      '模擬人類杏仁核神經元對特定刺激類別的發火率變化、情緒喚醒增益，以及後續記憶成功率 (SME) 的羅吉斯對應。',
    parameters: [
      {
        name: 'arousal',
        labelZh: '情緒喚醒度 (Arousal)',
        description: '調節神經元群體的響應增益與信噪比',
        defaultValue: 1.2,
        min: 0.6,
        max: 2.2,
        step: 0.1,
      },
      {
        name: 'noiseLevel',
        labelZh: '背景噪聲水準',
        description: '神經系統自發隨機放電強度',
        defaultValue: 0.2,
        min: 0.05,
        max: 0.45,
        step: 0.05,
      },
    ],
    keyConcepts: [
      '後續記憶效應 (Subsequent Memory Effect, SME)',
      '杏仁核 (Amygdala)',
      '單神經元電生理 (Single-Unit Recording)',
      '刺激選擇性 (Stimulus Specificity)',
      '情節記憶編碼 (Episodic Memory Encoding)',
    ],
    component: AmygdalaMemorySimulator,
  },
  PhotovoltaicRecombinationSimulator: {
    id: 'PhotovoltaicRecombinationSimulator',
    nameZh: '硫化鉍擬直接能隙與載子復合動力學模擬器',
    descriptionZh:
      '探索硫化鉍獨特的擬直接能隙 (Pseudo-direct) 能帶結構，展示強光吸收與弛豫動量屏障如何有效延緩電子-電洞復合損失。',
    parameters: [
      {
        name: 'lightIntensity',
        labelZh: '入射光強 (Suns)',
        description: '太陽輻照度等效倍率 (AM1.5G)',
        defaultValue: 1.0,
        unit: 'Suns',
        min: 0.2,
        max: 2.5,
        step: 0.1,
      },
      {
        name: 'defectDensityLog',
        labelZh: '晶格陷阱濃度 (log10)',
        description: '深能階 Shockley-Read-Hall 缺陷復合中心密度',
        defaultValue: 15.0,
        unit: 'cm⁻³',
        min: 14.0,
        max: 17.0,
        step: 0.2,
      },
    ],
    keyConcepts: [
      '擬直接能隙 (Pseudo-direct Bandgap)',
      '硫化鉍 (Bi₂S₃)',
      '雙分子輻射復合 (Bimolecular Recombination)',
      '少數載子壽命 (Carrier Lifetime)',
      '載子擴散長度 (Diffusion Length)',
    ],
    component: PhotovoltaicRecombinationSimulator,
  },
  NuclearClockSimulator: {
    id: 'NuclearClockSimulator',
    nameZh: '釷-229 光學核時鐘與鑑頻閉環鎖定實驗',
    descriptionZh:
      '展示固態晶體中釷-229 核同質異能躍遷的窄線寬特性、雷射色散誤差信號與閉環反饋控制，並對比原子鐘之環境抗噪尺度。',
    parameters: [
      {
        name: 'feedbackGain',
        labelZh: '回饋增益 (Loop Gain)',
        description: '伺服鑑頻器對雷射漂移的校正強度',
        defaultValue: 1.2,
        min: 0.2,
        max: 2.5,
        step: 0.1,
      },
      {
        name: 'laserDriftRate',
        labelZh: '雷射熱漂移速率',
        description: '未鎖定前自由運行的頻率擾動強度',
        defaultValue: 0.8,
        min: 0.1,
        max: 2.5,
        step: 0.1,
      },
    ],
    keyConcepts: [
      '釷-229 (Thorium-229)',
      '光學核時鐘 (Nuclear Optical Clock)',
      '同質異能態 (Isomeric State)',
      '真空紫外光 (VUV)',
      '伺服回饋鎖定閉環 (Feedback Loop)',
      '艾倫方差 (Allan Deviation)',
    ],
    component: NuclearClockSimulator,
  },
};

export function getInteractiveComponent(id: string): InteractiveComponentMeta | undefined {
  return INTERACTIVE_COMPONENTS[id];
}
