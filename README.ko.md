<p align="center">
  <img alt="Node 22.13+" src="https://img.shields.io/badge/node-22.13%2B-339933?logo=node.js&amp;logoColor=white" />
  <img alt="pnpm 11.0.0" src="https://img.shields.io/badge/pnpm-11.0.0-F69220?logo=pnpm&amp;logoColor=white" />
  <img alt="TypeScript 5.8" src="https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&amp;logoColor=white" />
  <img alt="Tauri 2" src="https://img.shields.io/badge/Tauri-2-FFC131?logo=tauri&amp;logoColor=111111" />
  <img alt="MVP local-first" src="https://img.shields.io/badge/status-MVP%20local--first-5A67D8" />
</p>

<h1 align="center">Plutus</h1>

<p align="center">
  <a href="./README.md">en</a>
</p>

<p align="center">
  <img alt="Plutus abstract market workspace" src="./assets/readme/plutus-abstract.png" />
</p>

Plutus는 macOS를 중심으로 동작하는 로컬 우선 투자 리서치 워크스페이스입니다. Codex 기반 멀티 에이전트 팀이 시장 데이터 수집, 포트폴리오 점검, 백테스트, 리스크 리뷰, 보고서 작성을 나누어 수행하고, 사용자는 그 결과를 근거와 함께 검토합니다.

> MVP의 경계는 명확합니다. Plutus는 리서치, 시뮬레이션, 의사결정 지원 도구이며 라이브 주문 실행이나 자율 매매를 하지 않습니다.

## 왜 Plutus인가

투자 리서치 도구는 보통 세 가지 중 하나를 포기합니다. 데이터와 판단 근거가 흩어지거나, 자동화가 블랙박스가 되거나, 개인 포트폴리오와 인증 정보가 외부 서비스에 과도하게 의존합니다.

Plutus는 반대로 설계합니다.

- **로컬 우선**: macOS 호스트가 SQLite, 아티팩트, 감사 로그, Codex 런타임의 기준점입니다.
- **에이전트 팀 기반**: 리서처, 데이터 애널리스트, 백테스터, 리스크 리뷰어, 리포터가 역할별로 분리됩니다.
- **근거 중심**: 모든 제안은 데이터 신선도, 가정, 리스크, 출처, 추천 범주를 함께 남깁니다.
- **실행 경계**: MVP는 관찰, 추가 조사, 리밸런싱 후보, 전략 후보, 리스크 경고, 무조치 판단까지만 다룹니다.
- **한국어/영어 UI 고려**: 앱 chrome, 보고서, 메모리, 위키 요약이 locale 계약을 공유합니다.

## 제품 표면

| 영역                  | 설명                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| macOS host app        | Tauri 2 기반 로컬 앱입니다. 포트폴리오 상태, Codex 런타임, 로컬 도구, 감사 로그의 source of truth를 가집니다.                   |
| Web preview           | Codex가 브라우저에서 UI와 반응형 레이아웃을 검증할 수 있는 개발 표면입니다.                                                     |
| Mobile remote control | 모바일은 독립 데이터베이스가 아니라 Mac 호스트를 제어하고 진행 상황을 보는 paired controller입니다.                             |
| Local MCP adapter     | Codex 에이전트가 시장 데이터, 포트폴리오, 백테스트, 리스크, 리포트, 메모리, 위키 도구를 안전하게 호출하는 stdio MCP 표면입니다. |
| Memory and wiki       | Plutus 소유 메모리 어댑터와 로컬 Markdown wiki가 장기 리서치 맥락을 관리합니다.                                                 |

## 프로젝트 문서

- [개발 문서](./docs/development.md)
- [아키텍처](./docs/architecture.md)
- [에이전트 작업 방식](./AGENTS.md)

## 현재 상태

Plutus는 MVP 구현이 진행 중인 저장소입니다. 리서치/시뮬레이션/의사결정 지원 기능을 먼저 완성하고, 라이브 거래 실행은 그 경계가 명시적으로 열리기 전까지 범위 밖으로 둡니다.
