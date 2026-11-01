import type { Article } from '../types';

export const ARTICLES: Article[] = [
  // ─── 封面互動特輯 ──────────────────────────────────────────────
  {
    id: 'art-exoplanet-transit',
    slug: 'when-starlight-dims',
    title: '當星光暗了一點',
    subtitle: '系外行星凌日法：我們如何從萬億公里外的光芒眨眼，量測未知異星的半徑？',
    topicIds: ['topic-astrophysics', 'topic-optics-geometry'],
    format: 'interactive_simulation',
    formatBadgeText: '互動模擬實驗',
    status: 'published',
    publishedDate: '2026.03',
    isEditorialCover: true,
    isEditorialPick: true,
    seriesId: 'series-habitable-worlds',
    seriesOrder: 1,
    summary:
      '當一顆遙遠行星自恆星盤面掠過，星光會產生不到百分之一的微弱暗化。天文學家如何憑藉這條細緻的光度曲線，揭開幾百光年外異星的軌道、大小乃至大氣成分？',
    leadParagraph:
      '在漆黑的宇宙長夜中，恆星通常只是微小的光點。但當一顆圍繞它運行的行星碰巧從地球視線與恆星中央穿過時，會暫時遮蔽一部分的星盤表面——這就是「凌日」（Transit）。這眨眼般的微小光變，成為當代人類發現超過四千顆系外行星的關鍵幾何鑰匙。',
    tags: ['系外行星', '凌日法', '克卜勒望遠鏡', '光度曲線', '幾何光學', '天文物理'],
    knowledgePoints: [
      {
        id: 'transit-concept',
        title: '凌日的幾何條件',
        concept: '行星投影與恆星盤面幾何共面條件',
        summary:
          '只有當行星公轉軌道平面恰好與地球觀測者視線近乎平行時，我們才能觀測到星盤遮蔽。',
        targetElementId: 'sent-transit-definition',
        relatedQuestions: ['什麼是系外行星凌日？', '為什麼不是所有行星都能被凌日法看到？'],
      },
      {
        id: 'transit-depth',
        title: '凌日深度與半徑公式',
        concept: 'ΔF / F₀ = (Rp / R*)²',
        summary:
          '光通量下降比例等於行星圓盤面積與恆星圓盤面積之比。行星半徑擴大 2 倍，光度下降量擴大為 4 倍。',
        targetElementId: 'sent-radius-squared-explanation',
        relatedQuestions: [
          '為什麼行星越大，恆星亮度下降越多？',
          '地球凌日會讓太陽變暗多少？',
        ],
      },
      {
        id: 'limb-darkening',
        title: '周邊昏暗效應',
        concept: '均勻圓盤假設 vs 恆星大氣光學厚度',
        summary:
          '簡化模型假設恆星盤面亮度均勻，產生平底曲線；真實恆星邊緣光學深度較淺，產生 U 型曲線（Limb Darkening）。',
        targetElementId: 'sent-u-shape-curve',
        relatedQuestions: [
          '為什麼真實的光度曲線底部是 U 型而不是完全平的？',
          '這個模擬器做了哪些簡化假設？',
        ],
      },
      {
        id: 'transmission-spectroscopy',
        title: '大氣透射光譜',
        concept: '大氣環濾光效應與水分子吸收譜帶',
        summary:
          '當星光透過行星薄薄的外層大氣，化學分子會吸收特定波長，讓韋伯望遠鏡得以探測異星大氣成分。',
        targetElementId: 'sent-spectroscopy-principle',
        relatedQuestions: [
          '凌日法能知道行星上有沒有水或氧氣嗎？',
          '韋伯望遠鏡如何做大氣分析？',
        ],
      },
    ],
  },

  // ─── 最新研究期刊追蹤（籌備中） ────────────────────────────────
  {
    id: 'art-jwst-supermassive-blackhole',
    slug: 'jwst-early-blackhole-accretion',
    title: '早期宇宙「超重黑洞」異常吸積特徵',
    subtitle: '韋伯太空望遠鏡最新光譜觀測對傳統星系演化模型的衝擊',
    topicIds: ['topic-astrophysics', 'topic-cosmology'],
    format: 'research_brief',
    formatBadgeText: '期刊研究解讀',
    status: 'in_preparation',
    isResearchHighlight: true,
    journalReference: {
      journal: 'Nature Astronomy',
      year: 2024,
      doi: '10.1038/s41550-024-02201-x',
    },
    summary:
      '紅移 z > 10 的早期宇宙中，為何已存在數十億太陽質量的超大質量黑洞？最新研究提出重種子黑洞直接坍縮與超愛丁頓吸積的新論證。',
    leadParagraph:
      '傳統天體物理學認為，黑洞需要經過數億年吸積恆星殘骸才能長成龐然大物。然而韋伯望遠鏡傳回的光譜數據顯示，大爆炸後僅四億年的星系中心，早已矗立著過於巨大的黑洞。',
    tags: ['韋伯望遠鏡', '超重黑洞', '早期宇宙', '愛丁頓極限'],
    knowledgePoints: [],
  },
  {
    id: 'art-hydride-superconductor',
    slug: 'high-pressure-hydride-phase',
    title: '百萬大氣壓下的量子奇景：富氫材料相變機制',
    subtitle: '從金剛石壓砧到電子-聲子耦合強度的高壓物理實驗解讀',
    topicIds: ['topic-condensed-matter', 'topic-quantum-physics'],
    format: 'research_brief',
    formatBadgeText: '期刊研究解讀',
    status: 'in_preparation',
    isResearchHighlight: true,
    journalReference: {
      journal: 'Science',
      year: 2024,
      doi: '10.1126/science.adg8742',
    },
    summary:
      '室溫常壓超導雖仍是聖杯，但兆帕（GPa）高壓下的富氫化合物已在接近 250K 展現零電阻。研究團隊運用同位素效應揭露晶格動態振態。',
    leadParagraph:
      '當我們將物質壓縮到地球地核等級的極致壓力時，電子的軌域排列與費米能面將經歷根本重組。高壓氫化物正為我們開啟理解超導相變臨界溫度的全新理論視窗。',
    tags: ['超導體', '高壓物理', '凝聚態', 'BCS 理論'],
    knowledgePoints: [],
  },
  {
    id: 'art-brain-predictive-coding',
    slug: 'brain-predictive-coding-time',
    title: '大腦如何編織時間的知覺？',
    subtitle: '預測編碼網絡、神經遞質振盪與主觀時間流逝的神經生物學',
    topicIds: ['topic-neuroscience'],
    format: 'research_brief',
    formatBadgeText: '期刊研究解讀',
    status: 'in_preparation',
    isResearchHighlight: true,
    journalReference: {
      journal: 'Neuron',
      year: 2024,
      doi: '10.1016/j.neuron.2024.01.018',
    },
    summary:
      '為什麼驚險瞬間感覺時間變慢？神經科學家以多電極記錄皮層訊號，證實時間感並非恆定鐘錶，而是預測誤差訊號累積的產物。',
    leadParagraph:
      '我們所經歷的「現在」，其實是大腦對過去數百毫秒感知資訊的貝氏推論（Bayesian Inference）。當外界刺激超出內部模型預期時，神經編碼速率劇增，主觀時間便隨之擴張。',
    tags: ['神經科學', '預測編碼', '主觀時間', '認知心理學'],
    knowledgePoints: [],
  },

  // ─── 經典科普與思想實驗（籌備中） ──────────────────────────────
  {
    id: 'art-second-law-entropy',
    slug: 'second-law-arrow-of-time',
    title: '時間之箭為何永不倒流？',
    subtitle: '玻爾茲曼、微觀態機率與宇宙熱力學熵增的終極宿命',
    topicIds: ['topic-thermodynamics', 'topic-cosmology'],
    format: 'longform_essay',
    formatBadgeText: '經典思想實驗',
    status: 'in_preparation',
    isClassicFoundation: true,
    summary:
      '在微觀牛頓力學與量子力學方程式中，時間在正向與反向完全對稱。為什麼宏觀世界卻擁有一條無可逆轉、從有序走向混沌的時間單行道？',
    leadParagraph:
      '破裂的咖啡杯無法自發重聚，點燃的火柴無法吸回灰燼。這項日常真理背後，是熱力學第二定律的巨力在主宰著宇宙萬物的微觀排列機率。',
    tags: ['熱力學', '熵增', '時間之箭', '統計力學'],
    knowledgePoints: [],
  },
  {
    id: 'art-quantum-erasure',
    slug: 'double-slit-quantum-eraser',
    title: '雙狹縫干涉與量子擦除：實在論的終極試煉',
    subtitle: '當我們抹除光子的「路徑」資訊，干涉條紋為何會重現？',
    topicIds: ['topic-quantum-physics'],
    format: 'longform_essay',
    formatBadgeText: '經典思想實驗',
    status: 'in_preparation',
    isClassicFoundation: true,
    summary:
      '觀測者究竟如何影響波函數？惠勒延遲選擇與量子擦除實驗打破了經典物理對因果與客觀實在的樸素想像。',
    leadParagraph:
      '量子力學最令人坐立難安之處，在於它似乎在告訴我們：如果世界上沒有任何物理手段能夠得知光子穿過了哪條狹縫，光子就會表現為同時穿過兩者的波。',
    tags: ['量子力學', '雙狹縫干涉', '量子擦除', '貝爾不等式'],
    knowledgePoints: [],
  },
  {
    id: 'art-epigenetics-dna-memory',
    slug: 'epigenetics-molecular-memory',
    title: '超越雙螺旋：細胞記憶的表觀遺傳密碼',
    subtitle: 'DNA 序列沒有改變，為何同一組基因能雕刻出神經元與心肌細胞？',
    topicIds: ['topic-molecular-biology'],
    format: 'longform_essay',
    formatBadgeText: '生命演化專題',
    status: 'in_preparation',
    isClassicFoundation: true,
    summary:
      '組蛋白修飾、DNA 甲基化與非編碼 RNA：揭開生命的動態開關，如何將環境歷程轉化為可遺傳的生化印記。',
    leadParagraph:
      '如果說 DNA 是生命的樂譜，那麼表觀遺傳學就是交響樂團的演奏指揮。它決定了音符何時高亢演奏、何時歸於靜默，並賦予生命無與倫比的發育可塑性。',
    tags: ['表觀遺傳', 'DNA 甲基化', '組蛋白', '分子生物學'],
    knowledgePoints: [],
  },

  // ─── 系列專題篇章（籌備中） ────────────────────────────────────
  {
    id: 'art-series-habitable-worlds',
    slug: 'series-habitable-worlds-search',
    title: '尋找第二個地球：系外行星巡天三十年記',
    subtitle: '從飛馬座 51b 到宜居帶岩石行星，人類在銀河系尋找生命搖籃的壯麗歷程',
    topicIds: ['topic-astrophysics', 'topic-astrobiology'],
    format: 'visual_story',
    formatBadgeText: '系列專題特輯',
    status: 'in_preparation',
    seriesId: 'series-habitable-worlds',
    seriesOrder: 2,
    summary:
      '1995 年首顆主序星系外行星的發現徹底顛覆了太陽系中心論。三十年間，從地面徑向速度法到太空凌日觀測，人類已揭示出銀河系遍佈行星的宇宙真相。',
    leadParagraph:
      '我們是否孤單？三十年前，人類尚無法確認太陽系之外是否真的存在其他行星系統。今天，巡天望遠鏡證明了：在銀河系夜空中，平均每一顆閃爍的恆星身旁，都至少伴隨著一顆行星。',
    tags: ['系外行星', '宜居帶', '克卜勒', '天文歷史'],
    knowledgePoints: [],
  },
];
