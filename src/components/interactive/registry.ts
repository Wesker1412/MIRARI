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
import { MuonPrecessionSimulator } from '../article/MuonPrecessionSimulator';
import { PrimeEditingSimulator } from '../article/PrimeEditingSimulator';
import { PercolationGridSimulator } from '../article/PercolationGridSimulator';
import { MagicAngleMoireSimulator } from '../article/MagicAngleMoireSimulator';
import { BlackHolePolarizationSimulator } from '../article/BlackHolePolarizationSimulator';
import { ProteinFoldingFunnelSimulator } from '../article/ProteinFoldingFunnelSimulator';
import { SurfaceCodeSimulator } from '../article/SurfaceCodeSimulator';
import { ChemicalOscillatorSimulator } from '../article/ChemicalOscillatorSimulator';
import { GridCellNavigationSimulator } from '../article/GridCellNavigationSimulator';
import { OrbitalResonanceSimulator } from '../article/OrbitalResonanceSimulator';
import { OpticalTweezersSimulator } from '../article/OpticalTweezersSimulator';
import { FaultRuptureSimulator } from '../article/FaultRuptureSimulator';
import { StmTunnelingSimulator } from '../article/StmTunnelingSimulator';
import { MofAdsorptionSimulator } from '../article/MofAdsorptionSimulator';
import { KuramotoSyncSimulator } from '../article/KuramotoSyncSimulator';
import { TopologicalEdgeSimulator } from '../article/TopologicalEdgeSimulator';
import { MolecularDiffusionSimulator } from '../article/MolecularDiffusionSimulator';
import { CircadianClockSimulator } from '../article/CircadianClockSimulator';
import { VicsekFlockingSimulator } from '../article/VicsekFlockingSimulator';
import { PhaseSeparationSimulator } from '../article/PhaseSeparationSimulator';
import { PulsarTimingSimulator } from '../article/PulsarTimingSimulator';
import { AltermagnetSpinSimulator } from '../article/AltermagnetSpinSimulator';
import { ChromoglassHiCSimulator } from '../article/ChromoglassHiCSimulator';
import { InsectFlappingLevSimulator } from '../article/InsectFlappingLevSimulator';
import { ConnectomeWiringSimulator } from '../article/ConnectomeWiringSimulator';
import { CompressedSensingSimulator } from '../article/CompressedSensingSimulator';
import { StochasticResonanceSimulator } from '../article/StochasticResonanceSimulator';
import { BridgeRnaRecombinaseSimulator } from '../article/BridgeRnaRecombinaseSimulator';
import { SonoluminescenceBubbleSimulator } from '../article/SonoluminescenceBubbleSimulator';
import { BacterialChemotaxisSimulator } from '../article/BacterialChemotaxisSimulator';
import { GenCastEnsembleSimulator } from '../article/GenCastEnsembleSimulator';
import { QuasicrystalDiffractionSimulator } from '../article/QuasicrystalDiffractionSimulator';
import { MarcusElectronTransferSimulator } from '../article/MarcusElectronTransferSimulator';

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
  MuonPrecessionSimulator: {
    id: 'MuonPrecessionSimulator',
    nameZh: 'Muon g-2 反常進動與量子真空虛粒子模擬器',
    descriptionZh: '狄拉克磁偶極矩異常 a_mu = (g-2)/2、進動差頻 omega_a 與格點 QCD/色散理論對照。',
    parameters: [],
    keyConcepts: ['渺子異常磁矩 (Muon g-2)', '量子電動力學 (QED)', '反常進動 (Anomalous Precession)', '強子真空極化 (HVP)', '格點量子色動力學 (Lattice QCD)'],
    component: MuonPrecessionSimulator,
  },
  PrimeEditingSimulator: {
    id: 'PrimeEditingSimulator',
    nameZh: 'Prime Editing（引導編輯）分子搜索替換反應模擬器',
    descriptionZh: 'nCas9 缺口酶與工程化逆轉錄酶原位合成、pegRNA 引物退火與無 DSB 錯配修復旁路。',
    parameters: [],
    keyConcepts: ['引導編輯 (Prime Editing)', 'pegRNA (Prime Editing Guide RNA)', '逆轉錄酶 (Reverse Transcriptase)', '缺口內切酶 (Nickase)', '錯配修復 (Mismatch Repair)'],
    component: PrimeEditingSimulator,
  },
  PercolationGridSimulator: {
    id: 'PercolationGridSimulator',
    nameZh: 'Percolation（滲流理論）晶格幾何相變與臨界連通模擬器',
    descriptionZh: '隨機佔據晶格、並查集連通團簇識別、無限團簇強度 P_inf 與臨界機率 pc 普適性相變。',
    parameters: [],
    keyConcepts: ['滲流理論 (Percolation Theory)', '臨界點 (Critical Probability)', '幾何相變 (Geometric Phase Transition)', '無限團簇 (Infinite Cluster)', '普適性 (Universality)'],
    component: PercolationGridSimulator,
  },
  MagicAngleMoireSimulator: {
    id: 'MagicAngleMoireSimulator',
    nameZh: '魔角雙層石墨烯（MATBG）莫爾平帶與強關聯物態模擬器',
    descriptionZh: 'Bistritzer-MacDonald 連續介質模型、莫爾超週期 lambda_M、平帶帶寬 W 壓縮與莫特絕緣/超導相圖。',
    parameters: [],
    keyConcepts: ['魔角雙層石墨烯 (Magic-Angle Graphene)', '莫爾超晶格 (Moiré Superlattice)', '平帶 (Flat Band)', '莫特絕緣體 (Mott Insulator)', '非常規超導 (Unconventional Superconductivity)'],
    component: MagicAngleMoireSimulator,
  },
  BlackHolePolarizationSimulator: {
    id: 'BlackHolePolarizationSimulator',
    nameZh: '事件視界望遠鏡（EHT）黑洞偏振成像與相對論噴流模擬器',
    descriptionZh: '同步輻射線性偏振電向量角（EVPA）、磁阻滯吸積盤（MAD）與布蘭福德-茲納傑克磁能抽取。',
    parameters: [],
    keyConcepts: ['事件視界望遠鏡 (EHT)', '線性偏振 (Linear Polarization)', '電向量位置角 (EVPA)', '磁阻滯盤 (MAD)', '布蘭福德-茲納傑克機制 (Blandford-Znajek Process)'],
    component: BlackHolePolarizationSimulator,
  },
  ProteinFoldingFunnelSimulator: {
    id: 'ProteinFoldingFunnelSimulator',
    nameZh: '蛋白質折疊自由能漏斗與萊文索爾佯謬模擬器',
    descriptionZh: '粗糙高維自由能漏斗、天然接觸序參量 Q、最小受挫原理與熔球態動力學中間體。',
    parameters: [],
    keyConcepts: ['萊文索爾佯謬 (Levinthal\'s Paradox)', '自由能漏斗 (Energy Funnel)', '最小受挫原理 (Minimal Frustration)', '天然接觸分數 (Native Contacts Q)', '熔球態 (Molten Globule)'],
    component: ProteinFoldingFunnelSimulator,
  },
  SurfaceCodeSimulator: {
    id: 'SurfaceCodeSimulator',
    nameZh: '量子糾錯表面碼（Surface Code）閾值與穩定子解碼模擬器',
    descriptionZh: '互動式資料與輔助量子位元格點陣列，觀察碼距 d=3/5/7 在低於容錯閾值時的 Λ 指數錯誤壓制效應。',
    parameters: [],
    keyConcepts: ['表面碼 (Surface Code)', '穩定子測量 (Stabilizer Measurements)', '容錯閾值 (Error Threshold)', '錯誤壓制因子 Λ', '症候群解碼 (Syndrome Decoding)'],
    component: SurfaceCodeSimulator,
  },
  ChemicalOscillatorSimulator: {
    id: 'ChemicalOscillatorSimulator',
    nameZh: 'BZ 化學振盪與 Oregonator 可激發螺旋波模擬器',
    descriptionZh: '基於 FKN 機制與反應擴散模型之二維螺旋波培養皿及極限環相平面動態模擬器。',
    parameters: [],
    keyConcepts: ['BZ 反應 (Belousov-Zhabotinsky Reaction)', 'FKN 機制與 Oregonator', '極限環 (Limit Cycle)', '耗散結構 (Dissipative Structure)', '螺旋波 (Spiral Waves)'],
    component: ChemicalOscillatorSimulator,
  },
  GridCellNavigationSimulator: {
    id: 'GridCellNavigationSimulator',
    nameZh: '內嗅皮層網格細胞六角晶格與路徑積分模擬器',
    descriptionZh: '呈現大腦 MEC 層 II 網格細胞在空間探索中的六角週期性放電場、連續吸引子環面拓撲與路徑積分漂移校正。',
    parameters: [],
    keyConcepts: ['網格細胞 (Grid Cells)', '路徑積分 (Path Integration)', '連續吸引子網路 (CAN)', '六角晶格放電場', '多尺度空間模組'],
    component: GridCellNavigationSimulator,
  },
  OrbitalResonanceSimulator: {
    id: 'OrbitalResonanceSimulator',
    nameZh: '拉普拉斯 4:2:1 軌道共振與木衛一潮汐加熱模擬器',
    descriptionZh: '可視化伽利略衛星 4:2:1 平均運動共振、受迫軌道偏心率泵浦、黏彈潮汐隆起與百兆瓦耗散功率變化。',
    parameters: [],
    keyConcepts: ['拉普拉斯共振 (Laplace Resonance)', '潮汐加熱 (Tidal Heating)', '強迫偏心率 (Forced Eccentricity)', '黏彈品質因子 Q', '軌道圓化 (Orbital Circularization)'],
    component: OrbitalResonanceSimulator,
  },
  OpticalTweezersSimulator: {
    id: 'OpticalTweezersSimulator',
    nameZh: '光鑷梯度力陷阱與單分子 DNA 過拉伸力譜模擬器',
    descriptionZh: '結合高斯光學陷阱微球捕獲與蠕蟲鏈 (WLC) 熵彈性模型，即時繪製 65 pN 過拉伸相變力-伸長曲線。',
    parameters: [],
    keyConcepts: ['光鑷 (Optical Tweezers)', '光學梯度力 (Gradient Force)', '熵彈性 (Entropic Elasticity)', '蠕蟲鏈模型 (WLC)', 'DNA 過拉伸轉變 (65 pN Overstretching)'],
    component: OpticalTweezersSimulator,
  },
  FaultRuptureSimulator: {
    id: 'FaultRuptureSimulator',
    nameZh: '超剪切地震斷層破裂與剪力馬赫錐動力學模擬器',
    descriptionZh: '可視化 P 波、S 波與破裂前緣傳播，調節無因次應力比 S 觸發子裂紋躍遷至超剪切狀態與 V 形馬赫錐衝擊波。',
    parameters: [],
    keyConcepts: ['超剪切破裂 (Supershear Rupture)', 'Burridge-Andrews 機制', '埃舍爾比速度 (√2 c_s)', '剪力馬赫錐 (Shear Mach Cone)', '速率與狀態摩擦定律'],
    component: FaultRuptureSimulator,
  },
  StmTunnelingSimulator: {
    id: 'StmTunnelingSimulator',
    nameZh: '掃描穿隧顯微鏡 (STM) 量子穿隧與量子圍欄模擬器',
    descriptionZh: '呈現真空位壘電子波函數指數衰減 I ∝ exp(-2κd)、定高/定電流掃描模式及量子圍欄電子駐波 LDOS 成像。',
    parameters: [],
    keyConcepts: ['量子穿隧 (Quantum Tunneling)', '掃描穿隧顯微鏡 (STM)', '局部電子態密度 (LDOS)', '衰減常數 κ', '量子圍欄 (Quantum Corral)'],
    component: StmTunnelingSimulator,
  },
  MofAdsorptionSimulator: {
    id: 'MofAdsorptionSimulator',
    nameZh: 'COF-999 開放空氣碳捕捉與水氣協同吸附動力學模擬器',
    descriptionZh: '模擬 400 ppm 微量 CO₂ 與水氣在網格化學孔道中的競爭吸附、50% 濕度翻倍效應與 60°C 低溫再生循環。',
    parameters: [],
    keyConcepts: ['直接空氣捕獲 (DAC)', '共價有機骨架 (COF-999)', '朗繆爾競爭吸附', '水氣協同胺基甲酸酯機制', '低溫再生循環'],
    component: MofAdsorptionSimulator,
  },
  KuramotoSyncSimulator: {
    id: 'KuramotoSyncSimulator',
    nameZh: '倉本模型 (Kuramoto Model) 非線性集體同步相變模擬器',
    descriptionZh: '即時 RK4 積分 60 個異質振盪子在單位圓上的相位鎖定演化，展示越過臨界耦合 Kc 後複序參量 r(t) 的超臨界分岔湧現。',
    parameters: [],
    keyConcepts: ['倉本模型 (Kuramoto Model)', '集體同步 (Collective Synchronization)', '複序參量 (Order Parameter)', '臨界耦合閾值 Kc', '二階超臨界分岔'],
    component: KuramotoSyncSimulator,
  },
  TopologicalEdgeSimulator: {
    id: 'TopologicalEdgeSimulator',
    nameZh: '拓撲絕緣體與單向手性邊界態無散射繞行模擬器',
    descriptionZh: '比較平庸絕緣體 (C=0) 遇晶格缺陷劇烈背散射與陳絕緣體 (C=1) 受體邊對應保護之單向無反射繞行波包傳輸。',
    parameters: [],
    keyConcepts: ['拓撲絕緣體 (Topological Insulator)', '陳數 (Chern Number)', '體邊對應 (Bulk-Boundary Correspondence)', '貝里曲率 (Berry Curvature)', '無背向散射邊界態'],
    component: TopologicalEdgeSimulator,
  },
  MolecularDiffusionSimulator: {
    id: 'MolecularDiffusionSimulator',
    nameZh: 'AlphaFold 3 全原子逆向擴散去噪與結合口袋模擬器',
    descriptionZh: '展示 Pairformer 條件表徵引導下的高斯座標噪聲雲逆向去噪軌跡，配合蛋白-配體成對誤差矩陣 PAE/PDE 與 pLDDT 置信度動態。',
    parameters: [],
    keyConcepts: ['AlphaFold 3', 'Pairformer 主幹架構', '全原子擴散模組 (Diffusion Module)', 'pLDDT / PAE / PDE 置信度', '靜態構象 vs 分子動力學邊界'],
    component: MolecularDiffusionSimulator,
  },
  CircadianClockSimulator: {
    id: 'CircadianClockSimulator',
    nameZh: '生理時鐘延遲負回饋與 KaiABC 離體磷酸化振盪模擬器',
    descriptionZh: '實時耦合 ODE 求解 Goodwin 轉錄負回饋與藍綠菌 KaiC 秩序化磷酸化極限環，並支援光脈衝相位反應 (PRC) 與溫度補償 (Q10 ≈ 1) 驗證。',
    parameters: [],
    keyConcepts: ['晝夜節律 (Circadian Rhythm)', '轉錄-轉譯負回饋迴路 (TTFL)', 'KaiABC 離體振盪器', '溫度補償 (Temperature Compensation)', '相位反應曲線 (PRC)'],
    component: CircadianClockSimulator,
  },
  VicsekFlockingSimulator: {
    id: 'VicsekFlockingSimulator',
    nameZh: 'Vicsek 主動物質群集運動與移動密集團帶相變模擬器',
    descriptionZh: '即時求解二維週期邊界自驅動粒子 Vicsek 動力學（含胞格近鄰檢索與極性序參量 Φ(t) 時間演化），呈現非平衡極性對稱破缺與高密度移動團帶。',
    parameters: [],
    keyConcepts: ['主動物質 (Active Matter)', 'Vicsek 群集相變', '極性序參量 Φ', 'Toner-Tu 流體力學', '無尺度關聯 (Scale-Free Correlations)'],
    component: VicsekFlockingSimulator,
  },
  PhaseSeparationSimulator: {
    id: 'PhaseSeparationSimulator',
    nameZh: 'Flory-Huggins 熱力學與 2D 液－液相分離（LLPS）模擬器',
    descriptionZh: '即時求解二維週期網格守恆 Cahn-Hilliard／Flory-Huggins 相場偏微分方程，並同步繪製公切線雙節線與旋節線相圖，展示成核生長與旋節分解。',
    parameters: [],
    keyConcepts: ['液－液相分離 (LLPS)', 'Flory-Huggins 混合自由能', '雙節線與成核生長 (Binodal)', '旋節線與旋節分解 (Spinodal)', '奧斯瓦爾德熟化 (Ostwald Ripening)'],
    component: PhaseSeparationSimulator,
  },
  PulsarTimingSimulator: {
    id: 'PulsarTimingSimulator',
    nameZh: '脈衝星計時陣列 (PTA) 與 Hellings-Downs 四極空間關聯模擬器',
    descriptionZh: '互動展示銀河脈衝星夾角變化下的四極時空拉伸、地球項同調到達時間殘差與 Hellings-Downs 角關聯理論曲線及蒙地卡羅散佈。',
    parameters: [],
    keyConcepts: ['脈衝星計時陣列 (PTA)', 'Hellings-Downs 曲線', '地球項與脈衝星項', '奈赫茲重力波背景', '超大質量雙黑洞'],
    component: PulsarTimingSimulator,
  },
  AltermagnetSpinSimulator: {
    id: 'AltermagnetSpinSimulator',
    nameZh: '交錯磁性 (Altermagnetism) 自旋群對稱與動量空間劈裂模擬器',
    descriptionZh: '對照鐵磁體、傳統反鐵磁體與交錯磁體之實空間晶格旋轉反演對稱、動量空間 d/g-wave 等能面自旋劈裂及 ARPES 色散切片，驗證跨過 Néel 溫度時的克萊默斯簡併恢復。',
    parameters: [],
    keyConcepts: ['交錯磁性 (Altermagnetism)', '克萊默斯簡併 (Kramers Degeneracy)', '自旋群對稱 (Spin Groups)', 'd-wave 與 g-wave 劈裂', 'α-MnTe SARPES 觀測'],
    component: AltermagnetSpinSimulator,
  },
  ChromoglassHiCSimulator: {
    id: 'ChromoglassHiCSimulator',
    nameZh: '染色質玻璃態 (Chromoglass) 籠鎖擴散與 PaleoHi-C 接觸矩陣模擬器',
    descriptionZh: '互動對照活細胞水合擴散、極寒凍乾玻璃態籠鎖與反覆凍融情境下之 DNA 斷裂高分子演化、即時 64×64 PaleoHi-C 熱圖及 P(s) 標度律曲線。',
    parameters: [],
    keyConcepts: ['染色質玻璃態 (Chromoglass)', 'PaleoHi-C 三維基因組', '分形球體 (Fractal Globule)', 'A/B 染色質區室', 'Stokes–Einstein 籠鎖擴散'],
    component: ChromoglassHiCSimulator,
  },
  InsectFlappingLevSimulator: {
    id: 'InsectFlappingLevSimulator',
    nameZh: '昆蟲振翅非定常空氣動力學、前緣渦流 (LEV) 與旋轉環流模擬器',
    descriptionZh: '對照定常固定翼失速、非定常振翅 LEV 附著與 Weis-Fogh 拍合甩開，即時可視化前緣渦核流線、翻轉相位脈衝及羅斯貝數 Ro 穩定邊界與瞬時 C_L(t) 分解曲線。',
    parameters: [],
    keyConcepts: ['前緣渦流 (Leading-Edge Vortex)', '延遲失速 (Delayed Stall)', '旋轉環流 (Rotational Circulation)', '尾流捕獲 (Wake Capture)', '羅斯貝數 (Rossby Number)'],
    component: InsectFlappingLevSimulator,
  },
  ConnectomeWiringSimulator: {
    id: 'ConnectomeWiringSimulator',
    nameZh: '果蠅全腦有向連結體 (Connectome)、豐富俱樂部與神經調質狀態模擬器',
    descriptionZh: '於 24 節點有向帶符號漏積分激發網路中點選虛擬雷射燒灼任意節點或切換多巴胺／GABA 調質增益，即時觀測發火率傳播與 24×24 路徑轉移矩陣重塑。',
    parameters: [],
    keyConcepts: ['全腦連結體 (Connectome)', '豐富俱樂部 (Rich-Club Hubs)', '有向帶符號突觸圖譜', '神經調質 (Neuromodulation)', '結構與動態邊界'],
    component: ConnectomeWiringSimulator,
  },
  CompressedSensingSimulator: {
    id: 'CompressedSensingSimulator',
    nameZh: '壓縮感知 (Compressed Sensing) 凸幾何與 ISTA 稀疏重建模擬器',
    descriptionZh: '同步展示二維 ℓ₂ 圓盤 vs ℓ₁ 菱形氣球膨脹切點，並在瀏覽器內實時執行 N=64 正交 DCT-II 稀疏訊號 ISTA 凸優化，對比均勻欠採樣混疊與不相干隨機重建。',
    parameters: [],
    keyConcepts: ['壓縮感知 (Compressed Sensing)', 'ℓ₁ 範數凸鬆弛', '限制等距性質 (RIP)', '不相干隨機欠採樣', 'Donoho–Tanner 相變'],
    component: CompressedSensingSimulator,
  },
  StochasticResonanceSimulator: {
    id: 'StochasticResonanceSimulator',
    nameZh: '雙穩態隨機共振 (Stochastic Resonance) 克拉默斯逃逸與 SNR 鐘形共振模擬器',
    descriptionZh: '以 Euler–Maruyama 即時求解過阻尼雙穩態朗之萬方程，聯動傾斜勢能阱粒子跳躍、軌跡同步與非單調鐘形信雜比曲線及奇半週期停留時間共振峰。',
    parameters: [],
    keyConcepts: ['隨機共振 (Stochastic Resonance)', '雙穩態勢阱 (Bistable Potential)', '克拉默斯逃逸速率', '時間尺度匹配條件', '非單調鐘形 SNR'],
    component: StochasticResonanceSimulator,
  },
  BridgeRnaRecombinaseSimulator: {
    id: 'BridgeRnaRecombinaseSimulator',
    nameZh: 'IS110 橋接核糖核酸 (Bridge RNA) 雙環重組突觸複合體模擬器',
    descriptionZh: '呈現四體重組酶透過目標結合環 (TBL) 與供體結合環 (DBL) 同時夾緊兩條 DNA，經 5′-磷酸絲胺酸共價中間體與霍利迪交叉完成插入、切除與倒位之無 DSB 重組。',
    parameters: [],
    keyConcepts: ['橋接核糖核酸 (Bridge RNA)', 'TBL / DBL 雙特異性環', '5′-磷酸絲胺酸共價中間體', '霍利迪交叉 (Holliday Junction)', '無雙股斷裂基因重排'],
    component: BridgeRnaRecombinaseSimulator,
  },
  SonoluminescenceBubbleSimulator: {
    id: 'SonoluminescenceBubbleSimulator',
    nameZh: '單氣泡聲致發光 (SBSL) 瑞利－普萊塞特空化塌縮與絕熱壓縮模擬器',
    descriptionZh: '以自適應步長四階龍格－庫塔法求解修正瑞利－普萊塞特方程，對比 (Pa, R0) 穩定操作島、凡得瓦硬核反彈與皮秒熱致弱電漿閃光峰值。',
    parameters: [],
    keyConcepts: ['單氣泡聲致發光 (SBSL)', '瑞利－普萊塞特方程', '凡得瓦硬核排除體積', '氬氣整流假說', '穩定操作島相圖'],
    component: SonoluminescenceBubbleSimulator,
  },
  BacterialChemotaxisSimulator: {
    id: 'BacterialChemotaxisSimulator',
    nameZh: '大腸桿菌趨化性 Run-and-Tumble 雙葉時間微分與積分回饋適應模擬器',
    descriptionZh: '同場模擬記憶偏置漫步、無記憶擴散與失去 CheB/CheR 適應飽和之大腸桿菌群體，結合雙極性脈衝響應卷積核心與轉動布朗擴散極限實驗。',
    parameters: [],
    keyConcepts: ['趨化性 (Chemotaxis)', 'Run-and-Tumble 偏置漫步', 'Berg–Purcell 計數雜訊極限', '雙極性脈衝響應核', '積分回饋精確適應'],
    component: BacterialChemotaxisSimulator,
  },
  GenCastEnsembleSimulator: {
    id: 'GenCastEnsembleSimulator',
    nameZh: 'GenCast 條件擴散氣象集合與決定論模糊效應對照模擬器',
    descriptionZh: '以二維雙路徑氣旋分岔流場對比 MSE 決定論模糊平均、傳統物理集合微擾與條件擴散反覆去噪步驟 (k: 20 → 0)，同步追蹤 Day 1–15 CRPS 與離散度校準曲線。',
    parameters: [],
    keyConcepts: ['GenCast 條件擴散模型', '二十面體球面網格', 'MSE 雙重懲罰模糊效應', 'CRPS 機率評分', '集合離散度－誤差校準'],
    component: GenCastEnsembleSimulator,
  },
  QuasicrystalDiffractionSimulator: {
    id: 'QuasicrystalDiffractionSimulator',
    nameZh: '準晶 (Quasicrystals)、高維切分投影與實時布拉格繞射結構因子模擬器',
    descriptionZh: '於瀏覽器內即時計算四方／六方週期晶體、Penrose 十重與 Ammann–Beenker 八重準晶及非晶態玻璃的二維結構因子 |S(q)|²，並支援 2D→1D 投影斜率連續調諧。',
    parameters: [],
    keyConcepts: ['準晶 (Quasicrystals)', '晶體學限制定理', '高維切分投影 (Cut-and-Project)', '布拉格繞射結構因子', '非週期單磚 (Einstein Monotile)'],
    component: QuasicrystalDiffractionSimulator,
  },
  MarcusElectronTransferSimulator: {
    id: 'MarcusElectronTransferSimulator',
    nameZh: '馬庫斯電子轉移理論、雙自由能拋物線交點與倒置區鐘形速率模擬器',
    descriptionZh: '聯動繪製反應物與產物簡諧自由能拋物線交點 ΔG‡ = (λ + ΔG°)²/(4λ) 與對數速率鐘形倒置曲線，展示驅動力超越重組能後的反常減速與光合反應中心單向抑制。',
    parameters: [],
    keyConcepts: ['馬庫斯電子轉移理論', '法蘭克－康登原理', '重組能 λ', '馬庫斯倒置區 (Inverted Region)', '光合反應中心電荷分離'],
    component: MarcusElectronTransferSimulator,
  },
};

export function getInteractiveComponent(id: string): InteractiveComponentMeta | undefined {
  return INTERACTIVE_COMPONENTS[id];
}
