import React from 'react';
import { TransitSimulator } from '../article/TransitSimulator';
import { DoublePendulumSimulator } from '../article/DoublePendulumSimulator';
import { ActionPotentialSimulator } from '../article/ActionPotentialSimulator';
import { MaxwellDemonSimulator } from '../article/MaxwellDemonSimulator';
import { AmygdalaMemorySimulator } from '../article/AmygdalaMemorySimulator';
import { PhotovoltaicRecombinationSimulator } from '../article/PhotovoltaicRecombinationSimulator';
import { NuclearClockSimulator } from '../article/NuclearClockSimulator';
import { BrownianRatchetSimulator } from '../article/BrownianRatchetSimulator';
import { TurbulenceCascadeSimulator } from '../article/TurbulenceCascadeSimulator';
import { WeakLensingShearSimulator } from '../article/WeakLensingShearSimulator';
import { AnyonBraidingSimulator } from '../article/AnyonBraidingSimulator';
import { NeutralDriftSimulator } from '../article/NeutralDriftSimulator';
import { SpikingNeuronSimulator } from '../article/SpikingNeuronSimulator';
import { ElmPedestalSimulator } from '../article/ElmPedestalSimulator';
import { HawkDoveReplicatorSimulator } from '../article/HawkDoveReplicatorSimulator';
import { TuringPatternSimulator } from '../article/TuringPatternSimulator';
import { CoriolisAtmosphereSimulator } from '../article/CoriolisAtmosphereSimulator';
import { AtpSynthaseSimulator } from '../article/AtpSynthaseSimulator';
import { BlackHoleRingdownSimulator } from '../article/BlackHoleRingdownSimulator';
import { BellInequalitySimulator } from '../article/BellInequalitySimulator';
import { CarTCellKineticsSimulator } from '../article/CarTCellKineticsSimulator';
import { SuperconductivityBcsSimulator } from '../article/SuperconductivityBcsSimulator';
import { BosonSamplingSimulator } from '../article/BosonSamplingSimulator';
import { ChandrasekharLimitSimulator } from '../article/ChandrasekharLimitSimulator';
import { RibozymeKineticsSimulator } from '../article/RibozymeKineticsSimulator';

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
  BrownianRatchetSimulator: {
    id: 'BrownianRatchetSimulator',
    nameZh: '布朗棘輪與微觀非平衡態步進模擬器',
    descriptionZh:
      '展示費曼布朗棘輪在等溫熱平衡下的細緻平衡（淨功為零），以及 ATP 水解化學能注入如何打破時間反演對稱性，將熱噪聲整流為微觀定向做功。',
    parameters: [
      {
        name: 'temperature',
        labelZh: '環境溫度 (K)',
        description: '熱噪聲碰撞劇烈程度，正比於擴散係數 D',
        defaultValue: 300,
        unit: 'K',
        min: 100,
        max: 450,
        step: 10,
      },
      {
        name: 'atpRate',
        labelZh: 'ATP 水解頻率 (Hz)',
        description: '非平衡勢阱週期切換頻率',
        defaultValue: 4.0,
        unit: 'Hz',
        min: 0.5,
        max: 8.0,
        step: 0.5,
      },
      {
        name: 'loadForce',
        labelZh: '逆向負載拉力 (pN)',
        description: '外加機械阻力，對抗分子馬達前進',
        defaultValue: 1.5,
        unit: 'pN',
        min: 0.0,
        max: 8.0,
        step: 0.2,
      },
    ],
    keyConcepts: [
      '費曼布朗棘輪 (Feynman Brownian Ratchet)',
      '熱力學第二定律 (Second Law of Thermodynamics)',
      '細緻平衡 (Detailed Balance)',
      '非平衡態統計物理 (Non-equilibrium Statistical Mechanics)',
      '驅動蛋白 (Kinesin)',
      '失速力 (Stall Force)',
    ],
    component: BrownianRatchetSimulator,
  },
  TurbulenceCascadeSimulator: {
    id: 'TurbulenceCascadeSimulator',
    nameZh: '柯爾莫哥洛夫湍流能量串級模擬器',
    descriptionZh:
      '展示大尺度渦旋在非線性慣性子區無黏性耗散地逐級破裂傳遞，驗證 -5/3 冪律能譜與微觀柯爾莫哥洛夫黏滯耗散尺度。',
    parameters: [
      {
        name: 'reynoldsNumber',
        labelZh: '雷諾數 (Re)',
        description: '慣性力與黏滯力之比，決定慣性子區跨越數量級',
        defaultValue: 15000,
        min: 300,
        max: 50000,
        step: 500,
      },
      {
        name: 'energyInjectionRate',
        labelZh: '能量注入率 ε',
        description: '每單位質量流體的大尺度機械攪拌能量傳遞率',
        defaultValue: 3.0,
        unit: 'm²/s³',
        min: 0.5,
        max: 10.0,
        step: 0.5,
      },
    ],
    keyConcepts: [
      '理查森能量串級 (Richardson Energy Cascade)',
      '柯爾莫哥洛夫能譜 (K41 Theory)',
      '-5/3 冪律 (Minus Five-Thirds Law)',
      '慣性子區 (Inertial Subrange)',
      '柯爾莫哥洛夫微尺度 (Kolmogorov Microscale)',
      '渦度 (Vorticity)',
    ],
    component: TurbulenceCascadeSimulator,
  },
  WeakLensingShearSimulator: {
    id: 'WeakLensingShearSimulator',
    nameZh: '韋伯望遠鏡微弱重力透鏡與宇宙剪切模擬器',
    descriptionZh:
      '展示大尺度暗物質暈如何藉由微弱引力透鏡對數十萬個背景星系施加切向剪切變形，並透過凱瑟-斯奎爾斯反演重建宇宙無形骨架。',
    parameters: [
      {
        name: 'darkMatterMass',
        labelZh: '暗物質暈總質量',
        description: '透鏡面密度深度，決定切向剪切強度',
        defaultValue: 8.5,
        unit: '10¹⁴ M☉',
        min: 1.0,
        max: 25.0,
        step: 0.5,
      },
      {
        name: 'sourceRedshift',
        labelZh: '背景星系紅移 z_s',
        description: '幾何距離比，影響透鏡臨界有效面密度',
        defaultValue: 2.2,
        min: 1.0,
        max: 3.5,
        step: 0.1,
      },
    ],
    keyConcepts: [
      '微弱重力透鏡 (Weak Gravitational Lensing)',
      '宇宙剪切 (Cosmic Shear)',
      '會聚度 (Convergence κ)',
      '凱瑟-斯奎爾斯反演 (Kaiser-Squires Inversion)',
      '暗物質暈 (Dark Matter Halo)',
      '宇宙網絲狀結構 (Cosmic Web Filaments)',
    ],
    component: WeakLensingShearSimulator,
  },
  AnyonBraidingSimulator: {
    id: 'AnyonBraidingSimulator',
    nameZh: '拓撲編織與任意子量子態模擬器',
    descriptionZh:
      '展示二維凝聚態系統中阿貝爾與非阿貝爾任意子的空間交換軌跡、(2+1)維時空世界線編織結，以及相角積累與拓撲量子位元子空間旋轉。',
    parameters: [
      {
        name: 'anyonType',
        labelZh: '任意子類型',
        description: '阿貝爾 Laughlin 態 (ν=1/3) 或非阿貝爾 Ising / Majorana 態 (ν=5/2)',
        defaultValue: 'abelian_laughlin',
      },
      {
        name: 'noiseLevel',
        labelZh: '局域熱擾動噪聲',
        description: '微觀幾何路徑擾動強度，展示拓撲不變性對局域噪聲的絕對免疫',
        defaultValue: 0.0,
        min: 0.0,
        max: 1.0,
        step: 0.1,
      },
    ],
    keyConcepts: [
      '任意子 (Anyons)',
      '拓撲編織 (Topological Braiding)',
      '分數統計 (Fractional Statistics)',
      '非阿貝爾幾何 (Non-Abelian Berry Phase)',
      '世界線 (Space-Time Worldlines)',
      '拓撲量子計算 (Topological Quantum Computing)',
    ],
    component: AnyonBraidingSimulator,
  },
  NeutralDriftSimulator: {
    id: 'NeutralDriftSimulator',
    nameZh: '賴特-費雪隨機漂變與木村中性演化模擬器',
    descriptionZh:
      '基於 Wright-Fisher 族群遺傳二項抽樣馬可夫鏈，展示有限族群中等位基因純隨機漂變、固著機率以及獨立於族群規模的分子演化時鐘速率。',
    parameters: [
      {
        name: 'popSize',
        labelZh: '有效族群大小 (Ne)',
        description: '二倍體有效繁殖個體數量，決定隨機抽樣方差',
        defaultValue: 50,
        min: 20,
        max: 300,
        step: 10,
      },
      {
        name: 'initFreq',
        labelZh: '初始等位基因頻率 (p0)',
        description: '等位基因在世代起始時的頻率或新突變極限 1/(2Ne)',
        defaultValue: 0.2,
        min: 0.05,
        max: 0.8,
        step: 0.05,
      },
      {
        name: 'selectionS',
        labelZh: '天擇選擇係數 (s)',
        description: '達爾文適應度優勢或劣勢；為 0 時為純粹中性突變',
        defaultValue: 0.0,
        min: -0.04,
        max: 0.04,
        step: 0.01,
      },
    ],
    keyConcepts: [
      '隨機基因漂變 (Random Genetic Drift)',
      '木村資生中性理論 (Kimura Neutral Theory)',
      '賴特-費雪模型 (Wright-Fisher Model)',
      '固著機率 (Fixation Probability)',
      '分子時鐘 (Molecular Clock)',
      '有效族群大小 (Effective Population Size)',
    ],
    component: NeutralDriftSimulator,
  },
  SpikingNeuronSimulator: {
    id: 'SpikingNeuronSimulator',
    nameZh: '類腦神經元洩漏整合放電 (LIF) 與事件驅動能耗模擬器',
    descriptionZh:
      '即時示波器動態展示生物神經元與類腦晶片的 Leaky Integrate-and-Fire 膜電位動力學、脈衝點陣與事件驅動架構相較於馮紐曼架構的千倍極致節能。',
    parameters: [
      {
        name: 'inputRateHz',
        labelZh: '輸入突觸脈衝率 (Hz)',
        description: '輸入泊松脈衝流頻率',
        defaultValue: 35,
        unit: 'Hz',
        min: 5,
        max: 90,
        step: 5,
      },
      {
        name: 'synapticWeight',
        labelZh: '突觸權重 (mV)',
        description: '單個輸入脈衝引發的興奮性突觸後電位 (EPSP)',
        defaultValue: 4.5,
        unit: 'mV',
        min: 1.0,
        max: 9.0,
        step: 0.5,
      },
      {
        name: 'membraneTau',
        labelZh: '膜時間常數 (τ_m)',
        description: '決定胞膜電荷漏電速度與時域整合記憶窗口',
        defaultValue: 20,
        unit: 'ms',
        min: 10,
        max: 45,
        step: 5,
      },
      {
        name: 'thresholdV',
        labelZh: '發火閾值 (V_th)',
        description: '膜電位觸發全或無動作電位的去極化臨界電位',
        defaultValue: -50,
        unit: 'mV',
        min: -55,
        max: -42,
        step: 1,
      },
    ],
    keyConcepts: [
      '洩漏整合放電 (Leaky Integrate-and-Fire)',
      '脈衝神經網絡 (Spiking Neural Networks)',
      '神經形態晶片 (Neuromorphic Chips)',
      '事件驅動計算 (Event-driven Computing)',
      '馮紐曼瓶頸 (von Neumann Bottleneck)',
      '突觸操作能耗 (Synaptic Operations SOP)',
    ],
    component: SpikingNeuronSimulator,
  },
  ElmPedestalSimulator: {
    id: 'ElmPedestalSimulator',
    nameZh: '托卡馬克台基與邊界局部模模擬器',
    descriptionZh: '以歸一化兩變數模型呈現壓力梯度與邊緣電流的累積、撞上剝離-氣球穩定邊界後的崩塌循環，以及共振磁擾動如何讓循環停止。',
    parameters: [],
    keyConcepts: ['H 模 (H-mode)', '台基 (Pedestal)', '邊界局部模 (ELM)', '剝離-氣球模 (Peeling-Ballooning)', '共振磁擾動 (RMP)'],
    component: ElmPedestalSimulator,
  },
  HawkDoveReplicatorSimulator: {
    id: 'HawkDoveReplicatorSimulator',
    nameZh: '鷹鴿博弈複製者動態模擬器',
    descriptionZh: '調整資源價值 V 與受傷代價 C，觀察鷹派比例在複製者動態下收斂到演化穩定比例 V/C。',
    parameters: [],
    keyConcepts: ['演化穩定策略 (ESS)', '鷹鴿博弈 (Hawk-Dove Game)', '複製者動態 (Replicator Dynamics)', '混合策略平衡'],
    component: HawkDoveReplicatorSimulator,
  },
  TuringPatternSimulator: {
    id: 'TuringPatternSimulator',
    nameZh: '圖靈斑圖反應擴散模擬器',
    descriptionZh: '以 Gray-Scott 反應擴散模型即時生成斑點、條紋與迷宮紋理，調整進料率與移除率觀察斑圖轉變。',
    parameters: [],
    keyConcepts: ['圖靈不穩定性 (Turing Instability)', '反應擴散 (Reaction-Diffusion)', '活化-抑制 (Activator-Inhibitor)', 'Gray-Scott 模型'],
    component: TuringPatternSimulator,
  },
  CoriolisAtmosphereSimulator: {
    id: 'CoriolisAtmosphereSimulator',
    nameZh: '科氏力與大氣地轉平衡模擬器',
    descriptionZh: '旋轉參考系科氏加速度 -2Ω×v、氣壓梯度力與科氏力平衡，展示地轉風如何沿等壓線平行吹拂。',
    parameters: [],
    keyConcepts: ['科氏力 (Coriolis Force)', '地轉平衡 (Geostrophic Balance)', '氣壓梯度力 (Pressure Gradient Force)', '氣旋與反氣旋 (Cyclones & Anticyclones)'],
    component: CoriolisAtmosphereSimulator,
  },
  AtpSynthaseSimulator: {
    id: 'AtpSynthaseSimulator',
    nameZh: 'ATP 合成酶化學滲透與旋轉催化模擬器',
    descriptionZh: '粒線體內膜跨膜質子動力勢 Δp、F0 質子渦輪旋轉與 F1 催化頭三態構象交替合成 ATP。',
    parameters: [],
    keyConcepts: ['化學滲透學說 (Chemiosmosis)', '質子動力勢 (Proton Motive Force)', '旋轉催化 (Rotary Catalysis)', 'ATP 合成酶 (ATP Synthase)'],
    component: AtpSynthaseSimulator,
  },
  BlackHoleRingdownSimulator: {
    id: 'BlackHoleRingdownSimulator',
    nameZh: '克爾黑洞無毛定理與重力波鈴宕譜學模擬器',
    descriptionZh: '雙黑洞合併後克爾殘餘黑洞之準簡正模複數頻率 (ω220, τ220) 與無毛定理獨立光譜檢驗。',
    parameters: [],
    keyConcepts: ['重力波 (Gravitational Waves)', '黑洞鈴宕 (Black Hole Ringdown)', '準簡正模 (Quasi-Normal Modes)', '無毛定理 (No-Hair Theorem)'],
    component: BlackHoleRingdownSimulator,
  },
  BellInequalitySimulator: {
    id: 'BellInequalitySimulator',
    nameZh: '貝爾不等式與 CHSH 量子糾纏檢驗模擬器',
    descriptionZh: '偏振糾纏光子對雙通道檢偏角關聯度 E(a,b)，實測 CHSH 參數 S 突破古典極限 2.0 達到 2.828。',
    parameters: [],
    keyConcepts: ['量子糾纏 (Quantum Entanglement)', '貝爾不等式 (Bell Inequality)', 'CHSH 關聯 (CHSH Correlation)', '局域實在論 (Local Realism)'],
    component: BellInequalitySimulator,
  },
  CarTCellKineticsSimulator: {
    id: 'CarTCellKineticsSimulator',
    nameZh: 'CAR-T 合成免疫受體動力學與抗原逃逸模擬器',
    descriptionZh: 'scFv 靶抗原識別、CD28/4-1BB 共刺激訊號對決、動態殺傷動力學與抗原逃逸門檻。',
    parameters: [],
    keyConcepts: ['CAR-T 細胞療法 (CAR T-Cell Therapy)', '合成免疫學 (Synthetic Immunology)', '共刺激受體 (Co-stimulatory Domains)', '抗原逃逸 (Antigen Escape)'],
    component: CarTCellKineticsSimulator,
  },
  SuperconductivityBcsSimulator: {
    id: 'SuperconductivityBcsSimulator',
    nameZh: 'BCS 超導能隙與邁斯納完美抗磁模擬器',
    descriptionZh: '電子-聲子吸引力形成庫柏對、費米面超導能隙 Δ(T) 開閉與邁斯納磁通排斥。',
    parameters: [],
    keyConcepts: ['BCS 理論 (BCS Theory)', '庫柏對 (Cooper Pairs)', '超導能隙 (Superconducting Gap)', '邁斯納效應 (Meissner Effect)', '倫敦穿透深度 (London Penetration Depth)'],
    component: SuperconductivityBcsSimulator,
  },
  BosonSamplingSimulator: {
    id: 'BosonSamplingSimulator',
    nameZh: '玻色子取樣與多光子量子干涉模擬器',
    descriptionZh: '全同光子在多端口分束器網絡之干涉散射幾率、HOM 聚束效應與 #P-hard 積和式分佈。',
    parameters: [],
    keyConcepts: ['玻色子取樣 (Boson Sampling)', '全同粒子 (Identical Particles)', 'HOM 干涉 (HOM Interference)', '矩陣積和式 (Permanent)', '量子優越性 (Quantum Advantage)'],
    component: BosonSamplingSimulator,
  },
  ChandrasekharLimitSimulator: {
    id: 'ChandrasekharLimitSimulator',
    nameZh: '錢德拉塞卡極限與白矮星質量-半徑演化模擬器',
    descriptionZh: '電子簡併壓從非相對論 (5/3) 到極端相對論 (4/3) 軟化、質量反比半徑與 1.44 太陽質量崩塌邊界。',
    parameters: [],
    keyConcepts: ['錢德拉塞卡極限 (Chandrasekhar Limit)', '白矮星 (White Dwarf)', '電子簡併壓 (Degeneracy Pressure)', '費米動量 (Fermi Momentum)', '多方球模型 (Polytrope)'],
    component: ChandrasekharLimitSimulator,
  },
  RibozymeKineticsSimulator: {
    id: 'RibozymeKineticsSimulator',
    nameZh: '核酶自催化剪切動力學與 Mg²⁺ 輔因子微調模擬器',
    descriptionZh: '錘頭狀核酶活性口袋立體折疊、Mg²⁺ 輔因子二價金屬活化與自剪切米氏轉化反應。',
    parameters: [],
    keyConcepts: ['核酶 (Ribozyme)', 'RNA 世界假說 (RNA World Hypothesis)', '自催化 (Autocatalysis)', '米氏動力學 (Michaelis-Menten Kinetics)', '磷酸二酯鍵轉酯反應 (Transesterification)'],
    component: RibozymeKineticsSimulator,
  },
};

export function getInteractiveComponent(id: string): InteractiveComponentMeta | undefined {
  return INTERACTIVE_COMPONENTS[id];
}
