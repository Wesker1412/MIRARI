export interface TextEvidence {
  sentenceId: string;
  exactQuote: string;
  sectionId: string;
  contextNote?: string;
}

export interface EvidenceSearchResult {
  query: string;
  answer: string;
  confidence: number;
  evidence: TextEvidence | null;
  secondaryEvidence?: TextEvidence | null;
}

// ─── Article Sentences Text Index for "當星光暗了一點" ──────────────
export const ARTICLE_TRANSIT_SENTENCES: TextEvidence[] = [
  {
    sentenceId: 'sent-transit-definition',
    exactQuote:
      '如果一個系外行星系統的公轉軌道平面，恰好幾乎與我們地球觀測者的視線平行，那麼在公轉的某一特定相位，行星就會直接穿過恆星圓盤與我們之間。這項現象即被稱為「凌日」（Transit）。',
    sectionId: 'sec-transit-concept',
    contextNote: '幾何凌日現象的先決條件',
  },
  {
    sentenceId: 'sent-transit-probability',
    exactQuote:
      '對於緊貼恆星運行的熱木星（軌道半徑僅 0.05 AU），凌日機率可達 10%；但對於距離類太陽恆星 1 AU 的類地行星，凌日機率驟降至僅約 0.5%。',
    sectionId: 'sec-transit-concept',
    contextNote: '熱木星與類地行星的凌日幾何機率對比',
  },
  {
    sentenceId: 'sent-transit-prob-formula',
    exactQuote:
      'P_transit ≈ (R_* + R_p) / a ≈ R_* / a',
    sectionId: 'sec-transit-concept',
    contextNote: '凌日幾何機率近似公式',
  },
  {
    sentenceId: 'sent-depth-area-relation',
    exactQuote:
      '當一個半徑為 Rp 的不透光行星圓盤完全進入恆星盤面內時，它所遮擋的光通量即為自身投影截面積：ΔF ∝ π Rp²。',
    sectionId: 'sec-transit-depth',
    contextNote: '遮蔽光量正比於圓盤截面積',
  },
  {
    sentenceId: 'sent-depth-formula',
    exactQuote:
      'ΔF / F₀ = (R_p / R_*)²',
    sectionId: 'sec-transit-depth',
    contextNote: '凌日深度與半徑比平方關係式',
  },
  {
    sentenceId: 'sent-radius-squared-explanation',
    exactQuote:
      '「行星半徑只是變成 2 倍，星光變暗幅度卻會變成 4 倍」：因為光度下降量取決於二維截面積（平方關係），而非一維長度。',
    sectionId: 'sec-transit-depth',
    contextNote: '半徑倍數與光度降幅的二維平方關係',
  },
  {
    sentenceId: 'sent-earth-depth-val',
    exactQuote:
      '地球半徑僅為太陽的 1/109 (Rp / R* ≈ 0.0091)。代入公式後，凌日深度僅約 0.0084%（84 ppm），唯有在太空無大氣擾動的環境下才能精確鎖定。',
    sectionId: 'sec-transit-depth',
    contextNote: '類地行星微小光變深度數據',
  },
  {
    sentenceId: 'sent-limb-darkening-definition',
    exactQuote:
      '恆星是由高溫電漿構成的球體，並無固態表面。當我們直視恆星中心時，視線垂直切入，能穿透到較深、溫度較高、輻射強度較強的光球深層；而當視線切向恆星邊緣時，由於斜向穿透，光線到達相同光學厚度所對應的物理深度較淺，我們看見的是較高層、溫度較低的氣體層。',
    sectionId: 'sec-limb-darkening',
    contextNote: '光球層光學厚度與視線幾何斜切',
  },
  {
    sentenceId: 'sent-u-shape-curve',
    exactQuote:
      '這種「中心亮、邊緣暗」的現象稱為周邊昏暗效應（Limb Darkening）。因此，當行星穿過恆星正中心時遮擋了最明亮的核心，導致恆星光通量在中央食時刻達到最低點，產生平滑的 U 型曲線。',
    sectionId: 'sec-limb-darkening',
    contextNote: '周邊昏暗效應造成光度曲線呈圓滑 U 型',
  },
  {
    sentenceId: 'sent-spectroscopy-principle',
    exactQuote:
      '如果大氣中含有水蒸氣（H2O）、二氧化碳（CO2）或甲烷（CH4），這些分子會在特定紅外波長產生吸收。在這些波長下，行星大氣顯得不透明，使得行星看起來微幅「變大」，凌日深度加深。',
    sectionId: 'sec-spectroscopy',
    contextNote: '分子光譜吸收帶使表觀半徑產生波長依賴',
  },
];

/**
 * Semantic & Evidence Retrieval Engine
 */
export function searchArticleEvidence(query: string): EvidenceSearchResult {
  const q = query.trim().toLowerCase();

  // Pattern 1: Probability / Geometry (Check first so '多大' is not captured as '行星越大')
  if (
    q.includes('幾率') ||
    q.includes('機率') ||
    q.includes('幾何') ||
    q.includes('機率多大') ||
    q.includes('被觀測到') ||
    q.includes('能看到')
  ) {
    const evidence = ARTICLE_TRANSIT_SENTENCES.find(
      (s) => s.sentenceId === 'sent-transit-probability'
    )!;
    const secondary = ARTICLE_TRANSIT_SENTENCES.find(
      (s) => s.sentenceId === 'sent-transit-prob-formula'
    )!;

    return {
      query,
      answer:
        '凌日幾率取決於恆星半徑與軌道半徑的比值（R*/a）。軌道極靠近恆星的熱木星凌日機率約為 10%；但像地球這樣距離母星 1 AU 的行星，幾率僅約 0.5%。',
      confidence: 0.96,
      evidence,
      secondaryEvidence: secondary,
    };
  }

  // Pattern 2: Radius vs Depth / Area / Squared relation
  if (
    q.includes('行星越大') ||
    q.includes('越大') ||
    q.includes('半徑') ||
    q.includes('截面') ||
    q.includes('深度') ||
    q.includes('平方') ||
    q.includes('公式') ||
    (q.includes('下降') && q.includes('亮度'))
  ) {
    const evidence = ARTICLE_TRANSIT_SENTENCES.find(
      (s) => s.sentenceId === 'sent-radius-squared-explanation'
    )!;
    const secondary = ARTICLE_TRANSIT_SENTENCES.find(
      (s) => s.sentenceId === 'sent-depth-formula'
    )!;

    return {
      query,
      answer:
        '行星遮光量取決於二維投影截面積（π·Rp²）。當半徑擴大為 2 倍時，截面積變為 4 倍，因此光度下降深度 ΔF 也擴大為 4 倍（即 ΔF/F₀ = (Rp/R*)²）。',
      confidence: 0.98,
      evidence,
      secondaryEvidence: secondary,
    };
  }

  // Pattern 3: U-shape vs flat / Limb Darkening
  if (
    q.includes('u型') ||
    q.includes('u 型') ||
    q.includes('平') ||
    q.includes('昏暗') ||
    q.includes('邊緣') ||
    q.includes('曲線')
  ) {
    const evidence = ARTICLE_TRANSIT_SENTENCES.find(
      (s) => s.sentenceId === 'sent-u-shape-curve'
    )!;
    const secondary = ARTICLE_TRANSIT_SENTENCES.find(
      (s) => s.sentenceId === 'sent-limb-darkening-definition'
    )!;

    return {
      query,
      answer:
        '這是恆星大氣的「周邊昏暗效應」。恆星中心視線穿透較深、溫度較高而更亮；邊緣視線穿透較淺而較暗。當行星穿過正中心時遮擋了最明亮的核心，使光變曲線底部呈現平滑的 U 型。',
      confidence: 0.96,
      evidence,
      secondaryEvidence: secondary,
    };
  }

  // Pattern 4: Atmosphere / Spectroscopy / Molecules
  if (
    q.includes('大氣') ||
    q.includes('光譜') ||
    q.includes('水') ||
    q.includes('氧') ||
    q.includes('韋伯') ||
    q.includes('成分')
  ) {
    const evidence = ARTICLE_TRANSIT_SENTENCES.find(
      (s) => s.sentenceId === 'sent-spectroscopy-principle'
    )!;

    return {
      query,
      answer:
        '當星光穿過外層稀薄大氣時，大氣中的水分子或二氧化碳會吸收特定紅外波長，使行星在特定光譜下看起來更大。分析這些微差即可測得大氣組成。',
      confidence: 0.94,
      evidence,
    };
  }

  // Pattern 5: Earth specific
  if (q.includes('地球') || q.includes('太陽') || q.includes('ppm')) {
    const evidence = ARTICLE_TRANSIT_SENTENCES.find(
      (s) => s.sentenceId === 'sent-earth-depth-val'
    )!;

    return {
      query,
      answer:
        '地球半徑僅為太陽的 1/109，凌日深度僅約 0.0084%（84 ppm），需要如克卜勒或太空白晝望遠鏡的高精度測光才能分辨。',
      confidence: 0.92,
      evidence,
    };
  }

  // Fallback: general query
  return {
    query,
    answer:
      '在系外行星凌日法中，光度的微弱變化蘊含著行星幾何截面與大氣厚度的關鍵訊息。',
    confidence: 0.5,
    evidence: null,
  };
}
