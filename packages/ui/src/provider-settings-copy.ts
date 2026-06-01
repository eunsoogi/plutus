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
    credentials: "Credential reference",
    noCredential: "Not connected",
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
    saved: "Provider settings saved locally.",
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
      "승인 기반 실거래 경로 전에 드라이런 거래 공급자를 먼저 설정합니다.",
    connections: "연결",
    decision: "Codex 의사결정 검토",
    composer: "주문 작성",
    payload: "공급자 페이로드",
    safety: "안전 상태",
    mode: "모드",
    dryRun: "드라이런",
    liveApproval: "승인 기반 실거래",
    save: "공급자 설정 저장",
    generate: "의사결정 생성",
    submit: "드라이런 주문 제출",
    selected: "선택된 공급자",
    endpoint: "미리보기 엔드포인트",
    credentials: "자격 증명 참조",
    noCredential: "연결 안 됨",
    market: "시장",
    region: "지역",
    status: "상태",
    permissions: "권한",
    healthSummary: "상태 요약",
    connected: "연결됨",
    degraded: "저하됨",
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
    saved: "공급자 설정을 로컬에 저장했습니다.",
    previewReady: "의사결정이 준비되었습니다.",
    previewLive:
      "실거래 후보는 명시적 사용자 승인이 필요하며 여기서는 계속 차단됩니다.",
    orderReady:
      "드라이런 주문이 준비되었습니다. 실거래 주문은 제출되지 않았습니다.",
    unavailable: "거래 명령 브리지를 사용할 수 없습니다.",
    dryRunReady: "드라이런 미리보기 준비됨",
    liveBlocked: "실거래 차단됨",
    readOnly: "읽기 전용 계좌 가져오기",
    dryRunOnly: "드라이런 주문 미리보기",
    killSwitch: "실거래 주문 킬 스위치 활성",
  },
} satisfies Record<AppLocale, Record<string, string>>;

export function providerEndpoint(providerId: string): string {
  switch (providerId) {
    case "kiwoom":
      return "/api/dostk/ordr";
    case "upbit":
      return "/v1/orders";
    case "coinbase":
      return "/api/v3/brokerage/orders";
    case "binance":
      return "/api/v3/order/test";
    default:
      return "dry-run://provider/order";
  }
}

export function providerDisplayName(
  providerId: string,
  fallback: string,
  locale: AppLocale,
): string {
  if (locale !== "ko") return fallback;
  switch (providerId) {
    case "kiwoom":
      return "키움증권";
    case "upbit":
      return "업비트";
    case "coinbase":
      return "코인베이스";
    case "binance":
      return "바이낸스";
    default:
      return fallback;
  }
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
    case "upbit":
    case "coinbase":
    case "binance":
      return "현물 암호화폐";
    default:
      return fallback;
  }
}
