import type { AppLocale } from "./core";

export const providerSettingsCopy = {
  en: {
    title: "Provider Settings",
    subtitle:
      "Configure dry-run trading providers before any approval-gated live path.",
    connections: "Connections",
    decision: "Codex Decision Review",
    composer: "Order Composer",
    payload: "Provider Payload",
    safety: "Safety State",
    mode: "Mode",
    dryRun: "Dry run",
    liveApproval: "Live approval",
    save: "Save provider settings",
    generate: "Generate decision",
    submit: "Submit dry-run order",
    selected: "Selected provider",
    endpoint: "Preview endpoint",
    credentials: "Credential storage",
    noCredential: "Not connected",
    credentialInput: "Credential fields",
    credentialApiKey: "API key",
    credentialAppKey: "App key",
    credentialSecret: "Secret key",
    credentialPassphrase: "Passphrase",
    credentialAccount: "Account ID",
    credentialHelp:
      "Enter credentials here for setup. After saving, raw values are cleared from the screen and the provider keeps only the secure://plutus/... reference.",
    credentialInvalid:
      "Credential references must start with secure://plutus/. Raw API keys are not stored here.",
    setupTitle: "Setup checklist",
    setupExchange: "Choose Kiwoom Securities or any CCXT exchange.",
    setupCredential:
      "Enter the API key, secret, optional passphrase, and account label.",
    setupMode:
      "Save dry-run first; live mode still requires explicit approval.",
    exchangeSearch: "Search exchange",
    exchangeSearchPlaceholder: "kraken, upbit, binance...",
    exchangeSelect: "Exchange",
    ccxtCatalog: "CCXT {count} exchanges + Kiwoom",
    market: "Market",
    region: "Region",
    status: "Status",
    permissions: "Permissions",
    healthSummary: "Health summary",
    connected: "Connected",
    degraded: "Degraded",
    notConfigured: "Not configured",
    blocked: "Blocked",
    evidence: "Evidence refs",
    blockingReasons: "Blocking reasons",
    noBlockingReasons: "None",
    symbol: "Symbol",
    side: "Side",
    buy: "Buy",
    sell: "Sell",
    orderType: "Order type",
    marketOrder: "Market",
    limitOrder: "Limit",
    quantity: "Quantity",
    limitPrice: "Limit price",
    quoteCurrency: "Quote currency",
    rationale: "Rationale",
    rationalePlaceholder: "Why should the agent committee review this order?",
    idle: "No decision generated yet.",
    saved: "Provider settings saved locally and credential fields were cleared.",
    previewReady: "Decision ready.",
    previewLive:
      "Live candidate needs explicit user approval and remains blocked here.",
    orderReady: "Dry-run preview accepted. No order was submitted.",
    unavailable: "Trading command bridge is not available.",
    dryRunReady: "Dry-run preview ready",
    liveBlocked: "Live blocked",
    readOnly: "Read-only account import",
    dryRunOnly: "Dry-run order preview",
    killSwitch: "Live order kill switch active",
  },
  ko: {
    title: "거래 연동 설정",
    subtitle:
      "키움증권은 전용 경로로, 암호화폐 거래소는 CCXT 경로로 드라이런부터 설정합니다.",
    connections: "연결",
    decision: "Codex 의사결정 검토",
    composer: "주문 작성",
    payload: "거래소 페이로드",
    safety: "안전 상태",
    mode: "모드",
    dryRun: "드라이런",
    liveApproval: "승인 기반 실거래",
    save: "거래 연동 저장",
    generate: "의사결정 생성",
    submit: "드라이런 주문 제출",
    selected: "선택된 거래소",
    endpoint: "미리보기 엔드포인트",
    credentials: "자격 증명 저장",
    noCredential: "설정 안 됨",
    credentialInput: "자격 증명 입력",
    credentialApiKey: "API 키",
    credentialAppKey: "앱 키",
    credentialSecret: "시크릿 키",
    credentialPassphrase: "패스프레이즈",
    credentialAccount: "계좌 또는 라벨",
    credentialHelp:
      "설정에 필요한 값을 입력하세요. 저장 후 원문 입력값은 화면에서 지워지고 provider에는 secure://plutus/... 보관 참조가 남습니다.",
    credentialInvalid:
      "자격 증명 참조는 secure://plutus/ 로 시작해야 합니다. API 키 원문은 저장하지 않습니다.",
    setupTitle: "설정 순서",
    setupExchange: "키움증권 또는 CCXT 지원 거래소를 선택합니다.",
    setupCredential:
      "API 키, 시크릿 키, 선택 패스프레이즈, 계좌 또는 라벨을 입력합니다.",
    setupMode: "먼저 드라이런으로 저장합니다. 실거래는 사용자 승인 전까지 차단됩니다.",
    exchangeSearch: "거래소 검색",
    exchangeSearchPlaceholder: "크라켄, 업비트, 바이낸스...",
    exchangeSelect: "거래소",
    ccxtCatalog: "CCXT {count}개 거래소 + 키움증권",
    market: "시장",
    region: "지역",
    status: "상태",
    permissions: "권한",
    healthSummary: "상태 요약",
    connected: "연결됨",
    degraded: "검증 필요",
    notConfigured: "설정 안 됨",
    blocked: "차단됨",
    evidence: "근거 참조",
    blockingReasons: "차단 사유",
    noBlockingReasons: "없음",
    symbol: "심볼",
    side: "방향",
    buy: "매수",
    sell: "매도",
    orderType: "주문 유형",
    marketOrder: "시장가",
    limitOrder: "지정가",
    quantity: "수량",
    limitPrice: "지정가",
    quoteCurrency: "기준 통화",
    rationale: "판단 근거",
    rationalePlaceholder: "에이전트 위원회가 이 주문을 검토해야 하는 이유",
    idle: "아직 생성된 의사결정이 없습니다.",
    saved: "자격 증명 입력값을 지우고 거래 연동 설정을 저장했습니다.",
    previewReady: "의사결정이 준비되었습니다.",
    previewLive:
      "실거래 후보는 명시적 사용자 승인이 필요하며 여기서는 계속 차단됩니다.",
    orderReady:
      "드라이런 주문이 준비되었습니다. 실거래 주문은 제출되지 않았습니다.",
    unavailable: "거래 명령 브리지를 사용할 수 없습니다.",
    dryRunReady: "드라이런 미리보기 준비됨",
    liveBlocked: "실거래 차단됨",
    readOnly: "읽기 전용 계좌 조회",
    dryRunOnly: "드라이런 주문 미리보기",
    killSwitch: "실거래 주문 킬 스위치 활성",
  },
} satisfies Record<AppLocale, Record<string, string>>;

const KOREAN_PROVIDER_NAMES: Readonly<Record<string, string>> = {
  binance: "바이낸스",
  binancecoinm: "바이낸스 COIN-M",
  binanceus: "바이낸스 US",
  binanceusdm: "바이낸스 USD-M",
  bitbank: "비트뱅크",
  bitfinex: "비트파이넥스",
  bitflyer: "비트플라이어",
  bitget: "비트겟",
  bithumb: "빗썸",
  bitmart: "비트마트",
  bitmex: "비트멕스",
  bitstamp: "비트스탬프",
  bybit: "바이비트",
  coinbase: "코인베이스",
  coinbaseadvanced: "코인베이스 어드밴스드",
  coinbaseexchange: "코인베이스 거래소",
  coinbaseinternational: "코인베이스 인터내셔널",
  coincheck: "코인체크",
  coinone: "코인원",
  cryptocom: "크립토닷컴",
  deribit: "데리비트",
  gate: "게이트",
  gateio: "게이트아이오",
  gemini: "제미니",
  htx: "HTX",
  huobi: "후오비",
  kiwoom: "키움증권",
  kraken: "크라켄",
  krakenfutures: "크라켄 선물",
  kucoin: "쿠코인",
  kucoinfutures: "쿠코인 선물",
  mexc: "MEXC",
  okx: "OKX",
  okxus: "OKX US",
  poloniex: "폴로닉스",
  upbit: "업비트",
  whitebit: "화이트비트",
};

export function providerEndpoint(providerId: string): string {
  switch (providerId) {
    case "kiwoom":
      return "/api/dostk/ordr";
    default:
      return `ccxt://${providerId}/createOrder`;
  }
}

export function providerDisplayName(
  providerId: string,
  fallback: string,
  locale: AppLocale,
): string {
  if (locale !== "ko") return fallback;
  return KOREAN_PROVIDER_NAMES[providerId] ?? fallback;
}

export function providerMarketLabel(
  providerId: string,
  fallback: string,
  locale: AppLocale,
): string {
  if (locale !== "ko") return fallback;
  switch (providerId) {
    case "kiwoom":
      return "국내 주식";
    default:
      return "CCXT 암호화폐";
  }
}
