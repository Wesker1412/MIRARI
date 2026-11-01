import type { Topic } from '../types';

export const TOPICS: Topic[] = [
  {
    id: 'topic-astrophysics',
    slug: 'astrophysics',
    nameZh: '天體物理與深空',
    nameEn: 'ASTROPHYSICS',
    tagline: '系外行星巡天、恆星演化與深空光譜測繪',
    description: '從恆星光度曲線、系外行星幾何凌日到深空望遠鏡光學巡天，探索恆星系統的物理規律。',
    isFeatured: true,
    isActive: true,
    order: 1,
  },
  {
    id: 'topic-cosmology',
    slug: 'cosmology',
    nameZh: '宇宙學與極端天體',
    nameEn: 'COSMOLOGY & RELATIVITY',
    tagline: '早期宇宙膨脹、超重黑洞與廣義相對論檢驗',
    description: '韋伯太空望遠鏡極早期星系觀測、黑洞吸積盤物理與大爆炸後初期種子黑洞形成機制。',
    isFeatured: true,
    isActive: true,
    order: 2,
  },
  {
    id: 'topic-quantum-physics',
    slug: 'quantum-physics',
    nameZh: '量子力學與實在論',
    nameEn: 'QUANTUM PHYSICS',
    tagline: '波粒二象性、量子擦除與物理客觀實在論',
    description: '雙狹縫干涉、量子糾纏、延遲選擇實驗與現代物理學對微觀因果律與實在論的哲學叩問。',
    isFeatured: true,
    isActive: true,
    order: 3,
  },
  {
    id: 'topic-condensed-matter',
    slug: 'condensed-matter',
    nameZh: '凝聚態與高壓物理',
    nameEn: 'CONDENSED MATTER',
    tagline: '百萬大氣壓下之晶格相變與高溫超導態',
    description: '富氫化合物在高壓環境下的電子-聲子耦合、BCS 理論驗證與室溫超導聖杯之探索。',
    isFeatured: true,
    isActive: true,
    order: 4,
  },
  {
    id: 'topic-thermodynamics',
    slug: 'thermodynamics',
    nameZh: '統計物理與時間之箭',
    nameEn: 'STATISTICAL THERMODYNAMICS',
    tagline: '熵增定律、微觀態排列與不可逆時間流',
    description: '從微觀可逆動力學到宏觀不可逆熱力學第二定律，解析宇宙萬物時間方向的統計物理本質。',
    isFeatured: true,
    isActive: true,
    order: 5,
  },
  {
    id: 'topic-neuroscience',
    slug: 'neuroscience',
    nameZh: '神經認知與意識',
    nameEn: 'COGNITIVE NEUROSCIENCE',
    tagline: '大腦預測編碼網絡、主觀時間感知與神經振盪',
    description: '皮層預測誤差信號累積、貝氏感知推論機制，以及人類大腦如何神經編織主觀時間流逝。',
    isFeatured: true,
    isActive: true,
    order: 6,
  },
  {
    id: 'topic-molecular-biology',
    slug: 'molecular-biology',
    nameZh: '分子生物與表觀遺傳',
    nameEn: 'EPIGENETICS & MOLECULAR BIO',
    tagline: 'DNA 甲基化、染色質重塑與細胞分子記憶',
    description: '超越中心法則的動態基因開關，解析細胞如何在不改變 DNA 序列下傳遞發育記憶。',
    isFeatured: true,
    isActive: true,
    order: 7,
  },
  {
    id: 'topic-optics-geometry',
    slug: 'optics-geometry',
    nameZh: '幾何光學與光譜分析',
    nameEn: 'OPTICS & SPECTROSCOPY',
    tagline: '周邊昏暗效應、大氣透射光譜與光通量計算',
    description: '光學厚度穿透幾何、分子光譜吸收譜帶與行星大氣透射特徵之定量解析。',
    isFeatured: false,
    isActive: true,
    order: 8,
  },
  {
    id: 'topic-astrobiology',
    slug: 'astrobiology',
    nameZh: '天體生物學與宜居帶',
    nameEn: 'ASTROBIOLOGY',
    tagline: '銀河系宜居環境、液態水存在幾率與生物印記',
    description: '系外行星大氣生命印記分子、紅矮星軌道宜居帶穩定性與銀河系文明搜尋條件。',
    isFeatured: false,
    isActive: true,
    order: 9,
  },
  {
    id: 'topic-nonlinear-chaos',
    slug: 'nonlinear-chaos',
    nameZh: '非線性動力學與渾沌',
    nameEn: 'NONLINEAR DYNAMICS & CHAOS',
    tagline: '雙擺動力學、李雅普諾夫指數與確定性隨機',
    description: '從牛頓力學第一性原理到相空間非線性發散，探索確定性因果系統中湧現的不可預測性。',
    isFeatured: true,
    isActive: true,
    order: 10,
  },
  {
    id: 'topic-biophysics',
    slug: 'biophysics',
    nameZh: '生物物理與電生理',
    nameEn: 'BIOPHYSICS & ELECTROPHYSIOLOGY',
    tagline: '離子通道動力學、動作電位與細胞膜電位數值積分',
    description: '霍奇金-赫胥黎方程式、電壓門控離子閘門與神經脈衝在微觀生物物理機制下的全或無激發。',
    isFeatured: true,
    isActive: true,
    order: 11,
  },
  {
    id: 'topic-information-theory',
    slug: 'information-theory',
    nameZh: '資訊理論與熱力學極限',
    nameEn: 'INFORMATION THERMODYNAMICS',
    tagline: '麥克斯韋妖、蘭道爾原理與資訊熵之物理實體化',
    description: '微觀資訊獲取、記憶抹除熱耗散與熱力學第二定律在資訊物理系統中的深刻統一。',
    isFeatured: true,
    isActive: true,
    order: 12,
  },
];

/**
 * Dynamically computes actual article count for a given topic.
 * Never uses hardcoded or pre-fabricated static numbers!
 */
export function getTopicArticleCount(
  topicId: string,
  articles: Array<{ topicIds: string[]; status: string }>
): { total: number; published: number; inPreparation: number } {
  const matching = articles.filter((a) => a.topicIds.includes(topicId));
  const published = matching.filter((a) => a.status === 'published').length;
  const inPreparation = matching.filter((a) => a.status === 'in_preparation').length;
  return {
    total: matching.length,
    published,
    inPreparation,
  };
}
