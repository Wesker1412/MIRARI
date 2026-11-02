import type { ArticleKnowledgeConfig } from '../types';

/**
 * MIRARI 文章核心知識點庫 (Article Knowledge Base)
 * 輕量資料結構：文章知識點 → 白話解釋 → 原文錨點。
 * 供文章隨文陪讀提問、提問提示生成與原文定位使用。
 * 讀者提問時完全由本機確定性檢索匹配，零外部 LLM 推論費用。
 */
export const ARTICLE_KNOWLEDGE_BASE: ArticleKnowledgeConfig[] = [
  {
    articleId: 'art-neuron-action-potential',
    slug: 'action-potential-hodgkin-huxley',
    title: '神經元的數位之火：動作電位的全或無定律與離子閘門',
    knowledgePoints: [
      {
        id: 'kp-neuron-all-or-none',
        label: '全或無定律',
        suggestedQuestion: '為什麼動作電位要麼完全爆發、要麼完全不產生？',
        keywords: ['全或無', '臨界閾值', '閾值', '數位', '爆發', '全有全無', '觸發', '定律', '55'],
        plainExplanation:
          '神經脈衝遵循全或無定律：外界刺激只要使膜電位跨過約 -55 mV 的臨界閾值，電壓閘控鈉通道就會雪崩式開啟，激發固定振幅的完整電位波形；若未達閾值，擾動會迅速平息，確保信號在長距離傳導中不失真衰減。',
        anchorSentenceId: 'sent-face8a34',
      },
      {
        id: 'kp-neuron-ion-cascade',
        label: '鈉鉀通道交響',
        suggestedQuestion: '鈉離子與鉀離子通道如何毫秒級協同運作？',
        keywords: ['鈉離子', '鉀離子', '通道', '閘門', '去極化', '復極化', '交響', '毫秒'],
        plainExplanation:
          '動作電位是一場離子電導的交響樂：首先電壓閘控鈉通道高速開啟，鈉離子瘋狂湧入胞內引發急速去極化；隨後鈉通道迅速失活關閉，延遲整流鉀通道開啟，鉀離子奔向胞外將膜電位強行拉回負值，完成復極化。',
        anchorSentenceId: 'sent-ce8be08f',
      },
      {
        id: 'kp-neuron-refractory',
        label: '絕對不反應期',
        suggestedQuestion: '神經脈衝為什麼不會倒流逆向傳播？',
        keywords: ['不反應期', '絕對不反應期', '倒流', '逆向', '單向', '失活', '傳導'],
        plainExplanation:
          '脈衝剛通過後的數毫秒內，鈉通道的閘門處於深度的電壓依賴失活狀態，形成絕對不反應期。即使給予再強的刺激也無法引發新脈衝，這強制確保了神經信號只能沿著軸突單向向前傳遞，絕不倒流。',
        anchorSentenceId: 'sent-7dffbfb0',
      },
    ],
  },
  {
    articleId: 'art-amygdala-memory-encoding',
    slug: 'amygdala-memory-encoding-success',
    title: '情緒的刻痕：杏仁核特定神經元活動如何預測長久記憶的誕生？',
    knowledgePoints: [
      {
        id: 'kp-amygdala-predict-memory',
        label: '杏仁核預測記憶',
        suggestedQuestion: '杏仁核的神經活動如何預測經驗能否成為長期記憶？',
        keywords: ['杏仁核', '預測', '記憶', '長期記憶', '長久記憶', '回憶', '放電', '發火'],
        plainExplanation:
          '單一神經元記錄證實，當我們感知特定刺激時，若杏仁核中對該類別具有偏好的神經元放電頻率顯著抬升，該經驗在隔日被成功回憶的機率便顯著增加，說明記憶在被感知的當下就已被打上神經烙印。',
        anchorSentenceId: 'sent-4cb8f1b8',
      },
      {
        id: 'kp-amygdala-category-selectivity',
        label: '語意類別選擇性',
        suggestedQuestion: '杏仁核是粗糙的情緒旋鈕還是具備內容選擇性？',
        keywords: ['音量旋鈕', '選擇性', '語意類別', '神經元偏好', '特異性', '粗糙'],
        plainExplanation:
          '傳統觀點認為杏仁核像粗糙的全身情緒旋鈕，但前沿研究發現，個別杏仁核細胞具備精細的語意類別選擇性，例如專門對動物或人臉強烈發火，並非所有刺激都在情緒激動時被無差別等同對待。',
        anchorSentenceId: 'sent-70430e82',
      },
      {
        id: 'kp-amygdala-hippocampus-sync',
        label: '海馬迴突觸窗口',
        suggestedQuestion: '杏仁核如何與海馬迴協同鞏固長期記憶？',
        keywords: ['海馬迴', '海馬體', '突觸可塑性', '時間窗口', '協同', '鞏固'],
        plainExplanation:
          '杏仁核並非單打獨鬥，而是將其對特定重要內容的微觀激發信號，精準對準海馬迴突觸可塑性最容易開啟的時間窗口，引導海馬迴將重要的特定情境優先轉化為長期記憶。',
        anchorSentenceId: 'sent-ac2790b6',
      },
    ],
  },
  {
    articleId: 'art-bismuth-sulfide-photovoltaics',
    slug: 'bismuth-sulfide-pseudo-direct-recombination',
    title: '光與電荷的漫長告別：硫化鉍如何以「擬直接能隙」改寫太陽能材料法則？',
    knowledgePoints: [
      {
        id: 'kp-bismuth-pseudo-direct',
        label: '擬直接能隙',
        suggestedQuestion: '什麼是硫化鉍獨特的「擬直接能隙」？',
        keywords: ['擬直接能隙', '能隙', '直接能隙', '間接能隙', '硫化鉍', '幾何'],
        plainExplanation:
          '硫化鉍在微觀上雖然是間接能隙材料，但其價帶頂與導帶底存在密集重疊的近簡併態，使它在吸收光子時展現出如同直接能隙般的超強吸光率，同時又保留了間接能隙材料電荷壽命極長的物理優勢。',
        anchorSentenceId: 'sent-05a65f61',
      },
      {
        id: 'kp-bismuth-absorption-dilemma',
        label: '吸光與壽命兩難',
        suggestedQuestion: '太陽能材料為什麼很難兼顧強吸光與長載子壽命？',
        keywords: ['兩難', '吸光', '載子壽命', '輻射復合', '能帶結構', '動量'],
        plainExplanation:
          '傳統半導體面臨物理兩難：直接能隙材料動量匹配極易吸光，但電子與電洞也很容易直接撞擊湮滅；間接能隙材料電荷壽命長，卻需要晶格振動幫忙才能吸光，導致材料必須做得很厚。',
        anchorSentenceId: 'sent-d0f5fd03',
      },
      {
        id: 'kp-bismuth-diffusion-length',
        label: '載子擴散長度',
        suggestedQuestion: '硫化鉍的微觀特性如何革新薄膜太陽能電池？',
        keywords: ['擴散長度', '薄膜', '太陽能電池', '光伏', '無毒', '環保'],
        plainExplanation:
          '擬直接能隙使硫化鉍的電荷載子擴散長度大幅跨越到微米級，遠大於吸收陽光所需的薄膜厚度。這意味著光生電荷能在復合前全數抵達電極，為製造高效、超薄且無毒的綠色太陽能電池開闢了新道路。',
        anchorSentenceId: 'sent-481d11c5',
      },
    ],
  },
  {
    articleId: 'art-brownian-ratchet-motors',
    slug: 'brownian-ratchet-molecular-motors',
    title: '穿透熱混沌的微觀足跡：布朗棘輪與分子馬達如何逆流而行？',
    knowledgePoints: [
      {
        id: 'kp-ratchet-detailed-balance',
        label: '費曼布朗棘輪',
        suggestedQuestion: '費曼布朗棘輪為什麼無法在單一溫度下憑空發電？',
        keywords: ['費曼', '布朗棘輪', '第二定律', '細緻平衡', '棘爪', '永動機', '單一溫度'],
        plainExplanation:
          '在單一溫度熱平衡下，微觀棘爪本身也在承受劇烈的熱擾動。正向跨越與反向滑脫的機率嚴格相等（細緻平衡），整體位移平均為零，因此絕不可能違反熱力學第二定律從單一熱源抽取功。',
        anchorSentenceId: 'sent-e81e7405',
      },
      {
        id: 'kp-ratchet-flashing-potential',
        label: 'ATP 閃爍勢阱',
        suggestedQuestion: '分子馬達如何利用 ATP 水解將無序熱噪聲轉化為前進做功？',
        keywords: ['ATP', '閃爍勢阱', '水解', '非平衡', '整流', '驅動蛋白', '定向行走'],
        plainExplanation:
          '分子馬達並非靠外力硬推，而是消耗 ATP 化學能週期性開啟與關閉微管上的非對稱勢阱。在平坦期粒子向四周隨機擴散，在重啟時被陡峭齒形定向捕獲，巧妙將無序熱晃動整流為定向行走。',
        anchorSentenceId: 'sent-b8c2e7c3',
      },
      {
        id: 'kp-ratchet-stall-force',
        label: '馬達失速極限',
        suggestedQuestion: '單個分子馬達的最大負載力極限是多少？',
        keywords: ['失速力', '負載', 'pN', '力學極限', '阻力', '拖拽'],
        plainExplanation:
          '單個驅動蛋白馬達的失速阻力極限約為 6.5 皮牛頓（pN）。在失速力以內，馬達能穩定輸出奈米級機械功；一旦外界逆向拉力超過失速力，馬達前進便會停滯，甚至被強行拖向反方向逆行。',
        anchorSentenceId: 'sent-7cedeccb',
      },
    ],
  },
  {
    articleId: 'art-chaos-double-pendulum',
    slug: 'chaos-double-pendulum-lyapunov',
    title: '渾沌的邊界：雙擺與確定性系統的不可預測性',
    knowledgePoints: [
      {
        id: 'kp-chaos-divergence',
        label: '初值敏感性',
        suggestedQuestion: '為什麼雙擺在初始角度只有微小差異時會迅速分道揚鑣？',
        keywords: ['初值敏感', '蝴蝶效應', '不可預測', '雙擺', '分道揚鑣', '軌跡', '擾動'],
        plainExplanation:
          '雙擺是一個高度非線性的動力系統。即使初始角度只有千萬分之一度的細微差異，兩條軌跡在相空間中的分離距離也會隨時間呈指數級快速倍增，數秒之內微小差異便被放大為完全不同的姿態。',
        anchorSentenceId: 'sent-5e27fc1a',
      },
      {
        id: 'kp-chaos-lyapunov-time',
        label: '李雅普諾夫時間',
        suggestedQuestion: '什麼是李雅普諾夫時間？它如何定義預測極限？',
        keywords: ['李雅普諾夫', '李雅普諾夫時間', '指數', '預測極限', '時間尺度', '發散'],
        plainExplanation:
          '李雅普諾夫指數衡量了軌道隨時間指數發散的速率，其倒數就是李雅普諾夫時間。這代表系統可被有效預測的時間上限；一旦跨越這個時間尺度，任何數值模擬都將失去對未來具體狀態的預報能力。',
        anchorSentenceId: 'sent-84f1a171',
      },
      {
        id: 'kp-chaos-deterministic',
        label: '確定性與混沌',
        suggestedQuestion: '雙擺看似混亂的擺動是一種隨機雜訊嗎？',
        keywords: ['確定性', '隨機', '牛頓方程', '哈密頓', '保守系統', '雜訊', '守恆'],
        plainExplanation:
          '雙擺的運動不是隨機雜訊，它的每一步都嚴格由確定的牛頓力學方程支配，且總機械能完全守恆。完全確定性的數學規則自發衍生出外觀無法預測的混沌，這正是非線性力學最迷人之處。',
        anchorSentenceId: 'sent-df6a59db',
      },
    ],
  },
  {
    articleId: 'art-jwst-cosmos-web-lensing',
    slug: 'jwst-cosmos-web-dark-matter-lensing',
    title: '宇宙的無形骨骼：韋伯望遠鏡如何以微弱重力透鏡繪製暗物質極限地圖？',
    knowledgePoints: [
      {
        id: 'kp-lensing-principles',
        label: '微弱重力透鏡',
        suggestedQuestion: '天文學家如何利用微弱重力透鏡看到看不見的暗物質？',
        keywords: ['微弱重力透鏡', '暗物質', '重力透鏡', '背景星系', '剪切', '時空扭曲'],
        plainExplanation:
          '暗物質不發光，但其巨大的質量會彎曲時空幾何。當遙遠背景星系發出的星光穿過暗物質結構時，星系影像會產生微弱的切向剪切拉伸，天文學家量測數十萬個星系的微小變形統計即可反演出暗物質。',
        anchorSentenceId: 'sent-c38200f5',
      },
      {
        id: 'kp-lensing-shape-noise',
        label: '形狀噪聲與統計',
        suggestedQuestion: '星系本身的隨機形狀如何不干擾暗物質測量？',
        keywords: ['形狀噪聲', '橢率', '統計平均', '剪切', '抵消', '噪聲'],
        plainExplanation:
          '個別星系本身就有隨機的橢圓盤面（固有形狀噪聲達 20% 以上），遠大於 1% 的透鏡剪切。但由於固有方向是隨機分佈的，只要對成千上萬個星系進行統計平均，噪聲便會相互抵消，浮現出暗物質信號。',
        anchorSentenceId: 'sent-67685c3a',
      },
      {
        id: 'kp-lensing-kaiser-squires',
        label: '凱瑟-斯奎爾斯反演',
        suggestedQuestion: '凱瑟-斯奎爾斯反演如何將形變轉化為暗物質地圖？',
        keywords: ['凱瑟-斯奎爾斯', '反演', '質量圖', '表面質量密度', '傅立葉', 'Kaiser-Squires'],
        plainExplanation:
          '凱瑟與斯奎爾斯演算法在傅立葉頻域中建立了星系剪切場與前景二維表面質量密度之間的直接幾何反演關聯，能將統計觀測到的微小拉伸場直接數學重構成二維暗物質骨架分佈圖。',
        anchorSentenceId: 'sent-18549e4d',
      },
    ],
  },
  {
    articleId: 'art-maxwells-demon-entropy',
    slug: 'maxwells-demon-landauer-entropy',
    title: '穿過微觀閘門的幽靈：麥克斯韋妖與資訊的熱力學代價',
    knowledgePoints: [
      {
        id: 'kp-maxwell-demon-paradox',
        label: '麥克斯韋妖悖論',
        suggestedQuestion: '麥克斯韋妖如何看似打破了時間之箭？',
        keywords: ['麥克斯韋妖', '小妖', '第二定律', '隔板', '時間之箭', '自發降溫', '熵增'],
        plainExplanation:
          '麥克斯韋設想一個看守隔板開孔的微型智能，能精準挑選粒子，只讓快粒子往左、慢粒子往右。這樣無需做功就能在兩側產生溫差，看似違背了熱力學第二定律關於孤立系統熵增的不可逆性。',
        anchorSentenceId: 'sent-84b4853e',
      },
      {
        id: 'kp-landauer-erasure-cost',
        label: '蘭道爾極限',
        suggestedQuestion: '為什麼抹除 1 位元資訊必須耗散熱量？',
        keywords: ['蘭道爾極限', '蘭道爾原理', '抹除資訊', '熱力學代價', 'kT ln 2', '位元', '記憶'],
        plainExplanation:
          '蘭道爾原理揭示了「資訊即物理」：小妖在測量時必須記錄資訊；當記憶體滿了要抹除 1 位元歷史資訊時，在溫度 T 下至少必須向環境釋放 $k_B T \\ln 2$ 的熱量，系統總熵依然嚴格遞增。',
        anchorSentenceId: 'sent-8187c1a0',
      },
      {
        id: 'kp-szilard-single-molecule',
        label: '斯齊拉德引擎',
        suggestedQuestion: '單個氣體分子如何把資訊轉化為機械功？',
        keywords: ['斯齊拉德', '單分子熱機', '做功', '資訊轉能量', '活塞', '等溫膨脹'],
        plainExplanation:
          '在斯齊拉德單分子引擎中，當探測到分子位於箱子某側並插入活塞後，分子熱運動推動活塞膨脹能對外輸出剛好 $k_B T \\ln 2$ 的機械功，直接證實了微觀資訊在物理上等價於自由能。',
        anchorSentenceId: 'sent-77a447c4',
      },
    ],
  },
  {
    articleId: 'art-thorium-nuclear-clock',
    slug: 'thorium-229-nuclear-clock-laser',
    title: '原子核內的宇宙脈搏：釷-229 光學核時鐘如何運作？',
    knowledgePoints: [
      {
        id: 'kp-thorium-nuclear-shielding',
        label: '原子核天然屏蔽',
        suggestedQuestion: '光學核時鐘為什麼比傳統鍶光晶格原子鐘更穩定？',
        keywords: ['核時鐘', '原子鐘', '原子核', '電子雲', '電磁場', '屏蔽', '抗干擾'],
        plainExplanation:
          '傳統原子鐘依賴外層電子躍遷，容易受外界雜散電磁場與黑體輻射干擾；而核時鐘直接鎖定原子核內部的能階躍遷。原子核尺寸比電子雲小五個數量級，外界噪聲被外層電子天然屏蔽，穩定度大幅提升。',
        anchorSentenceId: 'sent-0ad0dc15',
      },
      {
        id: 'kp-thorium-laser-key',
        label: '釷-229 紫外鑰匙',
        suggestedQuestion: '為什麼全宇宙只有釷-229 能用紫外雷射激發？',
        keywords: ['釷-229', '釷', '紫外雷射', '電子伏特', '8.3', '同核異構態'],
        plainExplanation:
          '絕大多數原子核躍遷需要能量極高的伽馬射線，但釷-229 擁有全宇宙極其罕見的低能同核異構態，躍遷能量僅約 8.35 電子伏特，剛好能被人類現有的真空紫外雷射精準相干激發與操控。',
        anchorSentenceId: 'sent-dd53be1e',
      },
      {
        id: 'kp-thorium-solid-crystal',
        label: '固態晶體核時鐘',
        suggestedQuestion: '固態晶體核時鐘比氣態原子鐘有何巨大優勢？',
        keywords: ['固態晶體', '氟化鈣', '氣態原子', '抗振', '便攜', '真空腔'],
        plainExplanation:
          '傳統光鐘需要龐大真空冷卻設備束縛氣體原子；而釷-229 能直接摻入微小的氟化鈣晶體內，單個固態晶片就容納了上百億個核鐘參考源，體積大幅縮小且具備超強抗震能力，適合深空導航。',
        anchorSentenceId: 'sent-52c5aa96',
      },
    ],
  },
  {
    articleId: 'art-turbulence-kolmogorov-cascade',
    slug: 'turbulence-kolmogorov-cascade',
    title: '暴風中的分形旋渦：柯爾莫哥洛夫能譜與湍流的能量串級',
    knowledgePoints: [
      {
        id: 'kp-turbulence-kolmogorov-law',
        label: '-5/3 能譜冪律',
        suggestedQuestion: '為什麼湍流能譜在慣性區會嚴格遵從 -5/3 冪律？',
        keywords: ['-5/3', '冪律', '柯爾莫哥洛夫', '能譜', '慣性區', '因次分析'],
        plainExplanation:
          '在慣性子區中，旋渦破碎時黏性耗散可忽略，幾何方向被遺忘。柯爾莫哥洛夫純粹透過因次分析證明，能譜 $E(k)$ 只能由能量傳遞率 $\\epsilon$ 與波數 $k$ 決定，唯一的物理自洽形式必然是 $E(k) \\propto \\epsilon^{2/3} k^{-5/3}$。',
        anchorSentenceId: 'sent-2e2d731b',
      },
      {
        id: 'kp-turbulence-richardson-cascade',
        label: '理查森能量串級',
        suggestedQuestion: '能量在湍流中是如何像瀑布般自上而下傳遞的？',
        keywords: ['理查森', '能量串級', '旋渦', '大渦旋', '小旋渦', '瀑布'],
        plainExplanation:
          '理查森詩意地描述了能量串級：大尺度注入能量形成大渦旋；大渦旋因不穩定性破裂成較小旋渦，能量在不同尺度間無黏性耗散地逐級向下奔騰，就像瀑布一樣，直至微觀耗散尺度。',
        anchorSentenceId: 'sent-6b254506',
      },
      {
        id: 'kp-turbulence-dissipation-microscale',
        label: '柯爾莫哥洛夫微尺度',
        suggestedQuestion: '湍流的旋渦為什麼不會無限變小？',
        keywords: ['微尺度', '耗散尺度', '黏性力', '終點', '摩擦', '熱運動'],
        plainExplanation:
          '旋渦不會無限變小。當尺度縮小到柯爾莫哥洛夫微尺度時，流體的黏性力重新佔據主導，微小渦流的機械能在此被流體黏滯摩擦直接轉化為分子的熱運動耗散掉，成為能量瀑布的終點。',
        anchorSentenceId: 'sent-c76d063b',
      },
    ],
  },
  {
    articleId: 'art-exoplanet-transit',
    slug: 'when-starlight-dims',
    title: '當星光暗了一點',
    knowledgePoints: [
      {
        id: 'kp-transit-radius-square',
        label: '半徑與深度平方關係',
        suggestedQuestion: '為什麼行星半徑變成 2 倍，星光變暗幅度卻會變成 4 倍？',
        keywords: ['平方', '半徑', '變暗', '截面積', '2 倍', '4 倍', '凌日深度'],
        plainExplanation:
          '凌日深度取決於行星在恆星圓盤上的二維投影截面積（$\\pi R_p^2$），而非一維的半徑。因此當行星半徑擴大為 2 倍時，截面積與變暗深度會呈平方關係擴大為 4 倍。',
        anchorSentenceId: 'sent-771634ca',
      },
      {
        id: 'kp-transit-limb-darkening',
        label: '周邊昏暗與 U 型曲線',
        suggestedQuestion: '為什麼真實的光度曲線底部是圓滑的 U 型而不是平坦的矩形？',
        keywords: ['周邊昏暗', 'U型', '圓滑', '邊緣', '光球', '中心亮'],
        plainExplanation:
          '這是由於恆星大氣的「周邊昏暗效應」：直視恆星中心能穿透到較深、較熱的光球層（更亮），而邊緣較暗。行星自邊緣移入中心時遮蔽了最亮核心，使光度平滑持續下沉，形成圓滑的 U 型。',
        anchorSentenceId: 'sent-4a07305c',
      },
      {
        id: 'kp-transit-transmission-spectroscopy',
        label: '透射光譜探測大氣',
        suggestedQuestion: '天文學家如何利用凌日探測外星大氣的成分？',
        keywords: ['透射光譜', '大氣', '光譜', '波長', '吸收', '水蒸氣'],
        plainExplanation:
          '當行星掠過恆星前方時，邊緣稀薄大氣會過濾穿透的星光。大氣中的特定分子會強烈吸收特定波長，使行星在該波長顯得更大。測量不同波長下的凌日深度微差，便能解析出大氣化學組成。',
        anchorSentenceId: 'sent-f5768fa2',
      },
    ],
  },
];

/**
 * 依據 articleId 或 slug 取得該篇章的知識庫設定
 */
export function getArticleKnowledgeConfig(articleIdOrSlug: string): ArticleKnowledgeConfig | undefined {
  if (!articleIdOrSlug) return undefined;
  return ARTICLE_KNOWLEDGE_BASE.find(
    (cfg) => cfg.articleId === articleIdOrSlug || cfg.slug === articleIdOrSlug
  );
}
