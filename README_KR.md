# Kiro Unreal Accelerator

[English](README.md) | [繁體中文](README_TW.md) | [简体中文](README_CN.md) | [日本語](README_JP.md) | [한국어](README_KR.md)

> **언어 안내**: 메인 README는 번체 중국어입니다. Steering 파일(도메인 지식)은 번체 중국어로 작성되어 있으며 영어 요약 섹션이 포함되어 있습니다. Power는 개발자가 선호하는 언어로 응답합니다.

IDE를 Unreal Engine 개발 AI 어시스턴트로 변환합니다. MCP(Model Context Protocol — AI 어시스턴트가 개발 도구와 상호작용하기 위한 표준화된 프로토콜)를 통해 자연어로 Unreal Editor를 제어할 수 있습니다. 이 Power는 Blueprint 로직 생성, 에셋 관리, 머티리얼 워크플로우, 성능 분석, 코드 품질 검사, 크로스 플랫폼 호환성 등을 포함하며, 35개의 MCP 도구와 10개의 도메인 지식 파일을 제공합니다.

> **핵심 개념**:
> * **MCP** (Model Context Protocol): AI 어시스턴트와 개발 도구 간의 표준화된 통신 프로토콜
> * **Blueprint**: Unreal Engine의 비주얼 스크립팅 시스템
> * **Nanite**: UE5의 가상화 지오메트리 시스템 (자동 LOD 및 Draw Call 최적화)
> * **Lumen**: UE5의 동적 글로벌 일루미네이션 및 리플렉션 시스템
> * **GAS** (Gameplay Ability System): Unreal의 어빌리티, 이펙트, 어트리뷰트 프레임워크

## 기능

* **Blueprint 로직 생성** — Blueprint Editor에서 직접 노드 생성, 핀 연결, 완전한 이벤트 그래프 구축
* **에셋 자동화** — 프리셋 일괄 적용, 에셋 타입 자동 감지, Nanite 호환성 검증
* **머티리얼 워크플로우** — 검증된 MCP API 우회 방법이 포함된 머티리얼 검색, 생성, 적용, 교체
* **성능 분석** — Draw Call/메모리/GPU 프로파일링, 안티패턴 감지, 최적화 권장사항
* **코드 품질** — 네이밍 컨벤션 검사, 순환 의존성 감지, Blueprint/C++ 밸런스 분석
* **크로스 플랫폼 호환성** — 8개 플랫폼의 Shader Model 검사 및 메모리 버짓 검증
* **GAS 통합** — 적절한 Tag 설정이 포함된 어빌리티, 이펙트, 어트리뷰트 셋 생성
* **AI 비헤이비어 트리** — 템플릿에서 비헤이비어 트리, 블랙보드, EQS 쿼리 생성
* **레벨 스캐폴딩** — 한 명령으로 레벨 구조 생성 (오픈 월드, 리니어, 아레나, 인테리어)
* **워크플로우 자동화** — 조건 분기 및 실패 전략이 포함된 다단계 워크플로우

## 아키텍처

```
개발자 (자연어)
    → AI 레이어 (의도 이해 & 계획)
        → MCP 프로토콜
            → Unreal Editor (실행 레이어)

Unreal Accelerator (인텔리전스 레이어)
├── POWER.md        → 도구와 워크플로우를 정의하는 메인 문서
├── steering/       → 10개의 도메인 지식 파일
├── templates/      → 45개의 JSON 템플릿 (10개 카테고리)
└── src/            → 35+ TypeScript 도구 모듈
```

## 사전 요구사항

* [Unreal Engine 5.5+](https://www.unrealengine.com/) (5.5 / 5.6 / 5.7 지원) FlopAI 플러그인 설치 필요
* [Kiro IDE](https://kiro.dev/docs/getting-started/installation)
* [Flopperam API Key](https://flopperam.com/account) (Hosted MCP용) 또는 Python 3.12+ (Local MCP용)
* Node.js 18+ (본 Power 개발/테스트용만)

## 설치

### 단계 1 — Kiro에 Power 설치

Kiro 열기 → 왼쪽 패널에서 Powers 아이콘 클릭 → "+" 클릭 → "Add Custom Power" 선택 → 이 프로젝트의 루트 디렉토리 선택

### 단계 2 — MCP Server 설치 (FlopAI 플러그인)

본 Power는 [flopperam/unreal-engine-mcp](https://github.com/flopperam/unreal-engine-mcp)를 사용합니다 — 9개 도메인에 걸쳐 50+ 도구를 제공하는 가장 진보된 UE MCP Server. UE 5.5 / 5.6 / 5.7 지원.

1. [flopperam.com/account](https://flopperam.com/account)에서 API Key 획득
2. FlopAI Unreal 플러그인 설치 — [flopperam.com/docs](https://flopperam.com/docs) (Installation 탭) 참조
3. Unreal Editor에서 플러그인이 정상 작동하는지 확인

### 단계 3 — MCP 연결 설정

`mcp.json` 또는 `.kiro/settings/mcp.json` 편집:

**방법 A: Hosted Flop MCP (권장)**

```json
{
  "mcpServers": {
    "unreal-engine": {
      "url": "https://agent.flopperam.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

**방법 B: 오픈소스 로컬 MCP (대안)**

```json
{
  "mcpServers": {
    "unreal-engine": {
      "command": "uv",
      "args": [
        "--directory",
        "<path/to/unreal-engine-mcp/Python>",
        "run",
        "unreal_mcp_server_advanced.py"
      ]
    }
  }
}
```

> **참고**: 로컬 버전은 기본 도구 세트만 제공합니다. 완전한 50+ 도구 경험을 위해서는 Hosted 버전을 사용하세요.

### 단계 4 — 자동 가이던스 Hook 설치 (권장)

```bash
mkdir -p .kiro/hooks
cp hooks/pre-unreal-tool.kiro.hook .kiro/hooks/
```

### 연결 확인

Kiro에서 Unreal 관련 명령을 입력합니다 (예: "현재 레벨의 모든 Actor 목록 표시"). AI가 올바르게 응답하면 연결 성공입니다.

## 사용법

자연어로 AI에게 원하는 작업을 말하세요. 적절한 MCP 도구가 자동으로 선택되어 실행됩니다.

### 명령 예시

```
"SpringArm과 Camera가 있는 캐릭터 Blueprint 생성"
"Environment 폴더의 모든 메시에 Nanite 적용"
"러프니스 0.3의 PBR 메탈 머티리얼 생성"
"프로젝트의 코드 아키텍처 품질 검사"
"이 프로젝트가 iOS와 호환되나요?"
"BP_MainCharacter의 의존성 분석"
"성능 감사 워크플로우 실행"
```

## 개발

```bash
npm install
npm test                 # 모든 테스트 실행
npm run test:coverage    # 커버리지 포함 테스트
npm run lint             # ESLint 검사
npx tsc --noEmit        # TypeScript 타입 검사
```

## 문제 해결

| 문제 | 해결 방법 |
|------|-----------|
| MCP 연결 실패 | Unreal Editor가 열려 있고 MCP 플러그인이 활성화되어 있는지 확인 |
| Blueprint 컴파일 오류 | `listNodeTypes()`로 노드 타입 이름 확인 |
| 머티리얼 적용 안됨 | Blueprint SCS 방식 사용 (POWER.md의 알려진 문제 참조) |
| 테스트 실패 | `npm install` 후 `npm test` 실행 |
| TypeScript 오류 | `npm install` 후 `npx tsc --noEmit` 실행 |

## 보안

자세한 내용은 [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications)을 참조하세요.

## 라이선스

MIT License. [LICENSE](LICENSE) 파일을 참조하세요.
