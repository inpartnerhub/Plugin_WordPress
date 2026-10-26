/**
 * Tokenisation for lexical retrieval. The knowledge base is English; small
 * curated Indonesian, Korean, Japanese and Simplified Chinese -> English term
 * maps let questions in those languages reach the same chunks. This is a pragmatic MVP
 * measure, not general translation.
 */

const STOPWORDS = new Set(
  (
    // English
    'a an and are as at be been but by can could do does did for from had has have how i if in into is it its ' +
    'me my of on or our please should so tell than that the their them then there these they this those to ' +
    'us was we what when where which will with would you your yours also any some more most ' +
    // Indonesian
    'yang dan di ke dari apa apakah bagaimana gimana saya aku kami kita anda kamu untuk dengan ini itu ada bisa ' +
    'dapat adalah ya tidak atau juga akan sudah pada oleh mana berapa kapan tolong mohon sebutkan ' +
    'seperti para tersebut lebih sangat punya memiliki'
  ).split(/\s+/),
);

/** Indonesian (and colloquial English) terms mapped to English stems present in the corpus. */
const QUERY_EXPANSIONS: Record<string, string[]> = {
  // Indonesian
  halo: ['about', 'service'],
  hai: ['about', 'service'],
  hello: ['about', 'service'],
  hi: ['about', 'service'],
  permisi: ['about', 'service'],
  kabar: ['about', 'service'],
  terima: ['about', 'service'],
  kasih: ['about', 'service'],
  makasih: ['about', 'service'],
  oke: ['about', 'service'],
  siap: ['about', 'service'],
  kabari: ['contact', 'service'],
  selamat: ['about', 'service'],
  pagi: ['about', 'service'],
  siang: ['about', 'service'],
  sore: ['about', 'service'],
  malam: ['about', 'service'],
  jelaskan: ['about', 'service', 'supporting', 'capabilities'],
  jelasin: ['about', 'service', 'supporting', 'capabilities'],
  penjelasan: ['about', 'service', 'supporting', 'capabilities'],
  soal: ['about', 'service'],
  info: ['about', 'service', 'contact'],
  informasi: ['about', 'service', 'contact'],
  menawarkan: ['service', 'advisory', 'portfolio', 'supporting', 'capabilities'],
  ditawarkan: ['service', 'advisory', 'portfolio', 'supporting', 'capabilities'],
  tawarkan: ['service', 'advisory', 'portfolio', 'supporting', 'capabilities'],
  tersedia: ['service', 'advisory', 'portfolio', 'supporting'],
  bantu: ['service', 'advisory'],
  bantuan: ['service', 'advisory'],
  dibantu: ['service', 'advisory'],
  membantu: ['service', 'advisory'],
  mendampingi: ['entry', 'market', 'advisory', 'partner', 'support'],
  pendampingan: ['entry', 'market', 'advisory', 'partner', 'support'],
  dampingi: ['entry', 'market', 'advisory', 'partner', 'support'],
  tolong: ['service', 'advisory'],
  help: ['service', 'advisory'],
  kamu: ['about', 'company'],
  anda: ['about', 'company'],
  layanan: ['service', 'advisory', 'supporting', 'capabilities'],
  jasa: ['service', 'advisory'],
  servis: ['service', 'advisory'],
  mitra: ['partner'],
  kemitraan: ['partner', 'partnership'],
  distribusi: ['distribution', 'distributor'],
  pasar: ['market'],
  masuk: ['entry', 'enter'],
  memasuki: ['entry', 'enter'],
  ekspansi: ['expansion', 'expand'],
  perluasan: ['expansion', 'expand'],
  cabang: ['entry', 'market', 'expansion', 'indonesia'],
  pma: ['foreign', 'entry', 'market', 'indonesia', 'investment'],
  korea: ['foreign', 'international', 'cross', 'border', 'entry'],
  berkembang: ['growth', 'expand'],
  pertumbuhan: ['growth'],
  kontak: ['contact'],
  hubungi: ['contact'],
  menghubungi: ['contact'],
  tercepat: ['contact', 'phone', 'email', 'office'],
  cepat: ['contact', 'phone', 'email'],
  ketemu: ['contact', 'office', 'tower', 'jakarta'],
  bertemu: ['contact', 'office', 'tower', 'jakarta'],
  pertemuan: ['contact', 'office', 'tower', 'jakarta'],
  meeting: ['contact', 'office', 'tower', 'jakarta'],
  tatap: ['contact', 'office', 'jakarta'],
  muka: ['contact', 'office', 'jakarta'],
  alamat: ['address', 'tower', 'jakarta'],
  kantor: ['office', 'tower', 'jakarta'],
  lokasi: ['location', 'office', 'tower', 'jakarta'],
  telepon: ['call', 'phone', 'contact'],
  telpon: ['call', 'phone', 'contact'],
  telp: ['call', 'phone', 'contact'],
  nomor: ['call', 'phone', 'contact'],
  nomer: ['call', 'phone', 'contact'],
  wa: ['call', 'phone', 'contact'],
  whatsapp: ['call', 'phone', 'contact'],
  surel: ['email'],
  tentang: ['about', 'supporting', 'capabilities'],
  profil: ['about', 'supporting', 'capabilities'],
  perusahaan: ['company'],
  skala: ['company', 'middle', 'sized', 'corporations'],
  menengah: ['middle', 'sized', 'corporations', 'companies'],
  klien: ['client', 'company', 'corporate', 'portfolio'],
  portofolio: ['portfolio', 'project', 'client'],
  kerjasama: ['approach', 'process', 'partnership', 'engagement', 'stage'],
  tahap: ['approach', 'process', 'step', 'stage'],
  tahapan: ['approach', 'process', 'step', 'stage'],
  awal: ['approach', 'step', 'stage', 'understand'],
  ditangani: ['expertise', 'industry', 'sector', 'portfolio'],
  menangani: ['expertise', 'industry', 'sector', 'portfolio'],
  tes: ['about', 'service'],
  test: ['about', 'service'],
  ping: ['about', 'service'],
  min: ['about', 'service'],
  admin: ['about', 'service'],
  ngapain: ['about', 'service'],
  bangkrut: ['restructuring', 'transformation', 'corporate', 'strategy'],
  boncos: ['restructuring', 'transformation', 'corporate', 'financial', 'analysis'],
  rugi: ['restructuring', 'commercial', 'financial', 'analysis', 'feasibility'],
  untung: ['commercial', 'financial', 'analysis', 'feasibility', 'investment'],
  hitung: ['commercial', 'financial', 'analysis', 'feasibility', 'study'],
  hitungin: ['commercial', 'financial', 'analysis', 'feasibility', 'study'],
  pabrik: ['manufacturing', 'feasibility', 'study', 'project', 'investment'],
  proyek: ['project', 'investment', 'feasibility', 'advisory'],
  berantakan: ['restructuring', 'organization', 'development', 'transformation'],
  kacau: ['restructuring', 'organization', 'development', 'transformation'],
  masalah: ['understand', 'challenges', 'corporate', 'strategy', 'restructuring'],
  benerin: ['restructuring', 'transformation', 'organization', 'development'],
  perbaiki: ['restructuring', 'transformation', 'organization', 'development'],
  manajemen: ['organization', 'development', 'corporate', 'strategy', 'restructuring', 'management'],
  selamatin: ['restructuring', 'transformation', 'corporate'],
  selamatkan: ['restructuring', 'transformation', 'corporate'],
  ekspor: ['cross', 'border', 'market', 'entry', 'international', 'distribution'],
  impor: ['cross', 'border', 'market', 'entry', 'distribution', 'partner'],
  produk: ['distribution', 'partner', 'market', 'entry', 'expansion'],
  jualan: ['market', 'expansion', 'distribution', 'partner'],
  dagang: ['market', 'expansion', 'distribution', 'partner'],
  bingung: ['understand', 'strategy', 'advisory', 'approach'],
  mulai: ['understand', 'stage', 'approach', 'entry'],
  calo: ['about', 'optima', 'integra', 'integrity', 'consulting'],
  broker: ['about', 'optima', 'integra', 'integrity', 'consulting'],
  beneran: ['about', 'optima', 'integra', 'integrity', 'proven'],
  bedanya: ['competitive', 'advantages', 'about', 'values'],
  direktur: ['executive', 'search', 'head', 'hunting', 'leadership', 'talent'],
  ceo: ['executive', 'search', 'head', 'hunting', 'leadership', 'talent'],
  pimpinan: ['executive', 'search', 'leadership', 'talent'],
  rekrut: ['executive', 'search', 'head', 'hunting', 'human', 'capital'],
  cariin: ['partner', 'sourcing', 'identification', 'executive', 'search'],
  carikan: ['partner', 'sourcing', 'identification', 'executive', 'search'],
  akuisisi: ['acquisition', 'cross', 'border', 'deal', 'transaction'],
  penggabungan: ['merger', 'cross', 'border', 'deal', 'transaction'],
  merger: ['merger', 'cross', 'border', 'deal', 'transaction'],
  investasi: ['investment', 'investor'],
  strategi: ['strategy', 'strategic'],
  operasional: ['operation', 'operational'],
  operasi: ['operation', 'operational'],
  konsultasi: ['advisory', 'consultation'],
  konsultan: ['advisory', 'advisor'],
  penasihat: ['advisory', 'advisor'],
  lintas: ['cross', 'border'],
  internasional: ['international', 'cross', 'border'],
  negosiasi: ['negotiation'],
  tenggara: ['southeast'],
  asing: ['foreign'],
  pendekatan: ['approach'],
  proses: ['approach', 'process'],
  langkah: ['approach', 'step'],
  siapa: ['who', 'about', 'company'],
  eksekutif: ['executive', 'search', 'talent'],
  rekrutmen: ['executive', 'search', 'talent'],
  talenta: ['talent', 'leadership'],
  sdm: ['human', 'capital', 'talent'],
  organisasi: ['organization', 'development'],
  pelatihan: ['training', 'capacity'],
  kapasitas: ['capacity', 'building'],
  kelayakan: ['feasibility', 'study'],
  studi: ['feasibility', 'study'],
  modal: ['capital', 'market', 'ipo'],
  ipo: ['ipo', 'capital', 'market'],
  restrukturisasi: ['restructuring', 'corporate'],
  transformasi: ['transformation'],
  riset: ['research', 'intelligence'],
  inteligensi: ['intelligence', 'research'],
  teknologi: ['technology', 'transfer'],
  sejarah: ['history', 'established', 'originated', '2009', '2019'],
  berdiri: ['established', 'originated', 'history', '2009', '2019'],
  keunggulan: ['competitive', 'advantage'],
  nilai: ['values', 'integrity'],
  sektor: ['sector', 'industry', 'expertise'],
  industri: ['industry', 'expertise'],
  negara: ['geographic', 'coverage', 'global'],
  global: ['global', 'coverage'],
  // English paraphrases
  service: ['service', 'advisory'],
  offer: ['service', 'advisory'],
  provide: ['service', 'advisory'],
  do: ['advisory'],
  step: ['approach'],
  email: ['email', 'contact'],
  consult: ['advisory'],
  consulting: ['advisory'],
  consultant: ['advisory', 'advisor'],
  consultancy: ['advisory'],
  reach: ['contact'],
  office: ['tower', 'jakarta', 'address'],
  located: ['tower', 'jakarta', 'address'],
  location: ['tower', 'jakarta', 'address'],
  based: ['office', 'tower', 'jakarta', 'address', 'location'],
  phone: ['call', 'phone', 'contact'],
  telephone: ['call', 'phone', 'contact'],
  number: ['call', 'phone', 'contact'],
  call: ['call', 'phone', 'contact'],
  mail: ['email'],
  acquisition: ['acquisition', 'cross', 'border', 'deal', 'transaction'],
  acquire: ['acquisition', 'cross', 'border', 'deal', 'transaction'],
  distributor: ['distributor', 'distribution'],
  distribution: ['distributor', 'distribution'],
  reseller: ['distributor', 'reseller'],
  expand: ['expansion', 'expand', 'market'],
  expansion: ['expansion', 'expand', 'market'],
  enter: ['entry', 'enter', 'market'],
  entering: ['entry', 'enter', 'market'],
  process: ['approach'],
  methodology: ['approach'],
  method: ['approach'],
  who: ['about'],
  team: ['about'],
  firm: ['about', 'advisory'],
  indonesian: ['indonesia'],
  executive: ['executive', 'search', 'talent'],
  headhunting: ['executive', 'search', 'talent'],
  recruitment: ['executive', 'search', 'talent'],
  talent: ['talent', 'leadership'],
  training: ['training', 'capacity'],
  feasibility: ['feasibility', 'study'],
  restructuring: ['restructuring', 'corporate'],
  transformation: ['transformation'],
  venture: ['joint', 'venture'],
  history: ['history', 'established', 'originated', '2009', '2019'],
  founded: ['established', 'originated', 'history', '2009', '2019'],
  countries: ['geographic', 'coverage'],
  coverage: ['geographic', 'coverage'],
  region: ['regional', 'geographic', 'coverage', 'southeast', 'asia'],
  regions: ['regional', 'geographic', 'coverage', 'southeast', 'asia'],
  sectors: ['sector', 'industry', 'expertise'],
  industries: ['industry', 'expertise'],
};

/**
 * Korean terms mapped to English stems present in the corpus. Korean attaches
 * particles to words (서비스는, 시장에), so keys are matched as substrings of
 * the NFC-normalised question rather than as whole tokens.
 */
const KOREAN_EXPANSIONS: [string, string[]][] = [
  ['안녕', ['about', 'service']],
  ['도와', ['service', 'advisory']],
  ['도움', ['service', 'advisory']],
  ['인파트너', ['inpartner']],
  ['서비스', ['service', 'advisory']],
  ['제공', ['service', 'advisory']],
  ['자문', ['advisory', 'advisor']],
  ['컨설팅', ['advisory', 'consultation']],
  ['컨설턴트', ['advisory', 'advisor']],
  ['상담', ['advisory', 'consultation']],
  ['파트너십', ['partner', 'partnership']],
  ['파트너', ['partner']],
  ['협력사', ['partner']],
  ['제휴', ['partner', 'partnership']],
  ['유통', ['distribution', 'distributor']],
  ['총판', ['distribution', 'distributor']],
  ['대리점', ['distributor', 'reseller']],
  ['리셀러', ['reseller', 'distributor']],
  ['시장', ['market']],
  ['진출', ['entry', 'enter', 'market']],
  ['진입', ['entry', 'enter', 'market']],
  ['확장', ['expansion', 'expand']],
  ['확대', ['expansion', 'expand']],
  ['성장', ['growth']],
  ['연락', ['contact']],
  ['문의', ['contact']],
  ['주소', ['address', 'tower', 'jakarta']],
  ['사무실', ['office', 'tower', 'jakarta']],
  ['사무소', ['office', 'tower', 'jakarta']],
  ['위치', ['location', 'tower', 'jakarta']],
  ['이메일', ['email']],
  ['메일', ['email']],
  ['전화', ['call', 'phone', 'contact']],
  ['연락처', ['call', 'phone', 'contact']],
  ['왓츠앱', ['call', 'phone', 'contact']],
  ['카톡', ['call', 'phone', 'contact']],
  ['회사', ['about', 'company']],
  ['기업', ['company']],
  ['소개', ['about']],
  ['누구', ['who', 'about']],
  ['인수', ['acquisition', 'cross', 'border', 'deal', 'transaction']],
  ['합병', ['merger', 'cross', 'border', 'deal', 'transaction']],
  ['투자', ['investment', 'investor']],
  ['전략', ['strategy', 'strategic']],
  ['운영', ['operation', 'operational']],
  ['실사', ['due', 'diligence']],
  ['협상', ['negotiation']],
  ['평가', ['assessment', 'assess', 'evaluation', 'evaluate']],
  ['동남아', ['southeast', 'asia']],
  ['해외', ['international', 'cross', 'border', 'foreign']],
  ['국경', ['cross', 'border']],
  ['국제', ['international', 'cross', 'border']],
  ['외국', ['foreign']],
  ['인도네시아', ['indonesia']],
  ['접근', ['approach']],
  ['절차', ['approach', 'process']],
  ['과정', ['approach', 'process']],
  ['단계', ['approach', 'step']],
];

/**
 * Japanese terms mapped to English stems. Japanese has no spaces and attaches
 * particles (サービスは, 市場に), so keys are matched as substrings like Korean.
 */
const JAPANESE_EXPANSIONS: [string, string[]][] = [
  ['こんにちは', ['about', 'service']],
  ['手伝', ['service', 'advisory']],
  ['サポート', ['service', 'advisory']],
  ['支援', ['service', 'advisory']],
  ['インパートナー', ['inpartner']],
  ['サービス', ['service', 'advisory']],
  ['提供', ['service', 'advisory']],
  ['アドバイザリー', ['advisory', 'advisor']],
  ['助言', ['advisory', 'advisor']],
  ['コンサル', ['advisory', 'consultation']],
  ['相談', ['advisory', 'consultation']],
  ['パートナーシップ', ['partner', 'partnership']],
  ['パートナー', ['partner']],
  ['提携', ['partner', 'partnership']],
  ['協力', ['partner', 'partnership']],
  ['販売代理店', ['distributor', 'distribution']],
  ['代理店', ['distributor', 'reseller']],
  ['流通', ['distribution', 'distributor']],
  ['販売網', ['distribution', 'distributor']],
  ['ディストリビューター', ['distributor', 'distribution']],
  ['リセラー', ['reseller', 'distributor']],
  ['市場', ['market']],
  ['マーケット', ['market']],
  ['進出', ['entry', 'enter', 'market']],
  ['参入', ['entry', 'enter', 'market']],
  ['拡大', ['expansion', 'expand']],
  ['展開', ['expansion', 'expand']],
  ['成長', ['growth']],
  ['連絡', ['contact']],
  ['問い合わせ', ['contact']],
  ['問合せ', ['contact']],
  ['住所', ['address', 'tower', 'jakarta']],
  ['所在地', ['address', 'tower', 'jakarta']],
  ['オフィス', ['office', 'tower', 'jakarta']],
  ['事務所', ['office', 'tower', 'jakarta']],
  ['拠点', ['office', 'location']],
  ['場所', ['location', 'tower', 'jakarta']],
  ['メール', ['email']],
  ['電話', ['call', 'phone', 'contact']],
  ['ワッツアップ', ['call', 'phone', 'contact']],
  ['会社', ['about', 'company']],
  ['企業', ['company']],
  ['紹介', ['about']],
  ['どんな', ['about']],
  ['誰', ['who', 'about']],
  ['買収', ['acquisition', 'cross', 'border', 'deal', 'transaction']],
  ['合併', ['merger', 'cross', 'border', 'deal', 'transaction']],
  ['投資', ['investment', 'investor']],
  ['戦略', ['strategy', 'strategic']],
  ['運営', ['operation', 'operational']],
  ['オペレーション', ['operation', 'operational']],
  ['デューデリジェンス', ['due', 'diligence']],
  ['交渉', ['negotiation']],
  ['評価', ['assessment', 'assess', 'evaluation', 'evaluate']],
  ['調査', ['assessment', 'research']],
  ['東南アジア', ['southeast', 'asia']],
  ['海外', ['international', 'cross', 'border', 'foreign']],
  ['国境', ['cross', 'border']],
  ['クロスボーダー', ['cross', 'border']],
  ['国際', ['international', 'cross', 'border']],
  ['外国', ['foreign']],
  ['インドネシア', ['indonesia']],
  ['アプローチ', ['approach']],
  ['手順', ['approach', 'process']],
  ['プロセス', ['approach', 'process']],
  ['流れ', ['approach', 'process']],
  ['段階', ['approach', 'step']],
  ['ステップ', ['approach', 'step']],
];

/**
 * Simplified Chinese terms mapped to English stems, matched as substrings
 * (Chinese has no spaces between words).
 */
const CHINESE_EXPANSIONS: [string, string[]][] = [
  ['你好', ['about', 'service']],
  ['您好', ['about', 'service']],
  ['帮助', ['service', 'advisory']],
  ['帮', ['service', 'advisory']],
  ['支持', ['service', 'advisory']],
  ['服务', ['service', 'advisory']],
  ['提供', ['service', 'advisory']],
  ['咨询', ['advisory', 'consultation']],
  ['顾问', ['advisory', 'advisor']],
  ['建议', ['advisory']],
  ['合作伙伴', ['partner', 'partnership']],
  ['伙伴', ['partner']],
  ['合作', ['partner', 'partnership']],
  ['经销商', ['distributor', 'distribution']],
  ['分销', ['distribution', 'distributor']],
  ['代理商', ['distributor', 'reseller']],
  ['渠道', ['distribution', 'distributor']],
  ['经销', ['distribution', 'distributor']],
  ['市场', ['market']],
  ['进入', ['entry', 'enter', 'market']],
  ['进军', ['entry', 'enter', 'market']],
  ['开拓', ['entry', 'expansion', 'market']],
  ['拓展', ['expansion', 'expand']],
  ['扩张', ['expansion', 'expand']],
  ['扩大', ['expansion', 'expand']],
  ['增长', ['growth']],
  ['发展', ['growth']],
  ['联系', ['contact']],
  ['联络', ['contact']],
  ['地址', ['address', 'tower', 'jakarta']],
  ['办公室', ['office', 'tower', 'jakarta']],
  ['办事处', ['office', 'tower', 'jakarta']],
  ['位置', ['location', 'tower', 'jakarta']],
  ['在哪', ['location', 'tower', 'jakarta']],
  ['邮箱', ['email']],
  ['邮件', ['email']],
  ['电话', ['call', 'phone', 'contact']],
  ['微信', ['call', 'phone', 'contact']],
  ['公司', ['about', 'company']],
  ['企业', ['company']],
  ['介绍', ['about']],
  ['是谁', ['who', 'about']],
  ['什么样', ['about']],
  ['收购', ['acquisition', 'cross', 'border', 'deal', 'transaction']],
  ['并购', ['merger', 'acquisition', 'cross', 'border', 'deal', 'transaction']],
  ['合并', ['merger', 'cross', 'border', 'deal', 'transaction']],
  ['投资', ['investment', 'investor']],
  ['战略', ['strategy', 'strategic']],
  ['运营', ['operation', 'operational']],
  ['尽职调查', ['due', 'diligence']],
  ['尽调', ['due', 'diligence']],
  ['谈判', ['negotiation']],
  ['评估', ['assessment', 'assess', 'evaluation', 'evaluate']],
  ['调研', ['assessment', 'research']],
  ['东南亚', ['southeast', 'asia']],
  ['海外', ['international', 'cross', 'border', 'foreign']],
  ['跨境', ['cross', 'border']],
  ['国际', ['international', 'cross', 'border']],
  ['外国', ['foreign']],
  ['外资', ['foreign']],
  ['印度尼西亚', ['indonesia']],
  ['印尼', ['indonesia']],
  ['方法', ['approach']],
  ['流程', ['approach', 'process']],
  ['过程', ['approach', 'process']],
  ['步骤', ['approach', 'step']],
  ['阶段', ['approach', 'step']],
];

const SUBSTRING_EXPANSIONS: readonly [string, string[]][] = [...KOREAN_EXPANSIONS, ...JAPANESE_EXPANSIONS, ...CHINESE_EXPANSIONS];

/** Very light English stemmer: plural/verb suffixes only, enough to merge common variants. */
export function stem(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'y';
  if (/(ss|us|is)$/.test(word)) return word;
  if (/(ches|shes|xes|sses)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s')) return word.slice(0, -1);
  if (word.endsWith('ing') && word.length > 5) return word.slice(0, -3);
  if (word.endsWith('ed') && word.length > 4) return word.slice(0, -2);
  return word;
}

export function normalizeText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\bm\s*&\s*a\b/g, ' merger acquisition ')
    .replace(/&amp;/g, ' and ');
}

export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  for (const raw of normalizeText(text).split(/[^a-z0-9]+/)) {
    if (raw.length < 2 || STOPWORDS.has(raw)) continue;
    tokens.push(stem(raw));
  }
  return tokens;
}

function stripIdClitic(word: string): string {
  if (word.length > 5 && (word.endsWith('nya') || word.endsWith('lah') || word.endsWith('kah') || word.endsWith('pun'))) {
    return word.slice(0, -3);
  }
  return word;
}

/**
 * Tokenises a query and adds mapped expansion terms (deduplicated). Markup
 * is removed first so tag and attribute names in a pasted payload (for
 * example `<source id="S9">`) are not treated as search terms.
 */
export function tokenizeQuery(text: string): string[] {
  const out = new Set<string>();
  const plain = text.replace(/<[^>]*>/g, ' ');
  // Before normalizeText(): NFKD splits Hangul syllables into jamo and kana into base + dakuten.
  // NFKC also folds half-width katakana (ｻｰﾋﾞｽ) and full-width Latin onto the keys below.
  const nfc = plain.normalize('NFKC');
  for (const [term, expansions] of SUBSTRING_EXPANSIONS) {
    if (nfc.includes(term)) for (const e of expansions) out.add(stem(e));
  }
  if (/\bwhat do you do\b/i.test(plain)) {
    out.add('about');
    out.add('firm');
  }
  for (const raw of normalizeText(plain).split(/[^a-z0-9]+/)) {
    if (raw.length < 2) continue;
    const base = stripIdClitic(raw);
    const expansions = QUERY_EXPANSIONS[raw] ?? QUERY_EXPANSIONS[base] ?? QUERY_EXPANSIONS[stem(raw)];
    if (expansions) for (const e of expansions) out.add(stem(e));
    if (!STOPWORDS.has(raw)) out.add(stem(raw));
    if (base !== raw && !STOPWORDS.has(base)) out.add(stem(base));
  }
  return [...out];
}
