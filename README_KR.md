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

* [Unreal Engine 5.5+](https://www.unrealengine.com/) (5.5 / 5.6 / 5.7 지원)
* [Kiro IDE](https://kiro.dev/docs/getting-started/installation)
* Python 3.12+ 및 [uv](https://docs.astral.sh/uv/getting-started/installation/) (Local MCP용)
* Node.js 18+ (본 Power 개발/테스트용만)
* (선택) [Flopperam API Key](https://flopperam.com/account) — 유료 Hosted MCP만 필요

> **전체 설치 단계는 아래 설치 섹션을 참조하세요**

## 설치

### 단계 1 — Kiro에 Power 설치

Kiro 열기 → 왼쪽 패널에서 Powers 아이콘 클릭 → "+" 클릭 → "Add Custom Power" 선택 → 이 프로젝트의 루트 디렉토리 선택

### 단계 2 — MCP Server 설치

본 Power는 [flopperam/unreal-engine-mcp](https://github.com/flopperam/unreal-engine-mcp)를 사용합니다. UE 5.5 / 5.6 / 5.7 지원.

**방법 1: 오픈소스 로컬 MCP (무료, 권장)**

**2a — 리포지토리를 고정 위치에 클론 (UE 프로젝트 안에 넣지 마세요)**

```cmd
cd %USERPROFILE%\Desktop
git clone https://github.com/flopperam/unreal-engine-mcp.git
```

**2b — UnrealMCP 플러그인을 UE 프로젝트에 복사**

UE 프로젝트 루트 (`.uproject`가 있는 위치)에서 실행:

```cmd
xcopy /E /I "%USERPROFILE%\Desktop\unreal-engine-mcp\UnrealMCP" "Plugins\UnrealMCP"
```

최종 구조:
```
UE프로젝트/
├── Plugins/
│   └── UnrealMCP/
│       ├── Source/
│       └── UnrealMCP.uplugin
├── Content/
└── 프로젝트.uproject
```

**2c — 플러그인 빌드 및 활성화**

1. `.uproject` 우클릭 → "Generate Visual Studio project files"
2. `.sln` 열기, **Development Editor** + **Win64** 로 빌드
3. Unreal Editor → Edit → Plugins → "UnrealMCP" 검색 → 활성화 → 재시작

**2d — Python 환경 설치**

```cmd
pip install uv
```

**2e — Python Server 검증**

```cmd
cd %USERPROFILE%\Desktop\unreal-engine-mcp\Python
uv run unreal_mcp_server_advanced.py
```

오류 없이 시작되면 Ctrl+C로 중지. Kiro가 자동으로 Server를 관리합니다.

**방법 2: Hosted Flop MCP (유료, 50+ 전체 도구)**

완전한 50+ 도구 경험이 필요하고 로컬 설정을 원하지 않는 경우:

1. [flopperam.com/account](https://flopperam.com/account)에서 API Key 획득
2. FlopAI Unreal 플러그인 설치 — [flopperam.com/docs](https://flopperam.com/docs) 참조

### 단계 3 — MCP 연결 설정

`mcp.json` 또는 `.kiro/settings/mcp.json` 편집:

**방법 1: 로컬 MCP (무료)**

Windows:
```json
{
  "mcpServers": {
    "unreal-engine": {
      "command": "uv",
      "args": [
        "--directory",
        "C:\\Users\\<사용자이름>\\Desktop\\unreal-engine-mcp\\Python",
        "run",
        "unreal_mcp_server_advanced.py"
      ]
    }
  },
  "powers": {
    "mcpServers": {}
  }
}
```

macOS / Linux:
```json
{
  "mcpServers": {
    "unreal-engine": {
      "command": "uv",
      "args": [
        "--directory",
        "/Users/<사용자이름>/Desktop/unreal-engine-mcp/Python",
        "run",
        "unreal_mcp_server_advanced.py"
      ]
    }
  },
  "powers": {
    "mcpServers": {}
  }
}
```

> 경로를 실제 클론한 위치로 변경하세요. Windows에서는 JSON 내에서 이중 백슬래시 `\\`를 사용하세요.

**방법 2: Hosted Flop MCP (유료)**

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

### 단계 4 — 자동 가이던스 Hook 설치 (필수)

이 Hook은 AI가 매 프롬프트마다 자동으로 Power를 활성화하고 MCP 도구를 올바르게 사용하도록 합니다:

```bash
mkdir -p .kiro/hooks
cp hooks/pre-unreal-tool.kiro.hook .kiro/hooks/
```

> 이 Hook을 설치하지 않으면 매번 수동으로 AI에게 MCP 도구 사용을 지시해야 합니다.

### 연결 확인

Kiro에서 Unreal 관련 명령을 입력합니다 (예: "현재 레벨의 모든 Actor 목록 표시"). AI가 올바르게 응답하면 연결 성공입니다.

## 사용법

설치 완료 후, 자연어로 Kiro에게 말하기만 하면 됩니다. AI가 자동으로 Power를 활성화하고, 적절한 MCP 도구를 선택하여 Unreal Editor에서 작업을 실행합니다.

### 처음 사용하기

Unreal Editor에서 프로젝트를 열어둔 상태에서 Kiro에서 순서대로 시도하세요:

**1. 프로젝트 상태 확인:**
```
현재 레벨에 뭐가 있는지 보여줘
```

**2. Blueprint 검사:**
```
BP_FirstPersonCharacter를 분석해서 변수, 컴포넌트, 이벤트 그래프를 보여줘
```

**3. 무언가 생성:**
```
BP_PickupItem이라는 새 Actor Blueprint를 만들어, StaticMeshComponent와 SphereCollision 추가
```

**4. 씬 수정:**
```
위치 (0, 0, 300)에 PointLight 생성, 강도 5000
```

### 무엇을 물어볼 수 있나요?

| 카테고리 | 명령 예시 |
|---------|----------|
| 씬 & 레벨 | "레벨의 모든 Actor 목록", "(100, 0, 50)에 큐브 생성", "TempBox라는 Actor 모두 삭제" |
| Blueprint | "Camera와 SpringArm이 있는 캐릭터 Blueprint 생성", "BP_Player에 Health 변수(Float, 기본값 100) 추가", "BP_Door의 이벤트 그래프 표시" |
| 머티리얼 | "프로젝트의 모든 머티리얼 검색", "러프니스 0.2의 빨간 메탈 머티리얼 생성", "M_Gold를 Statue Actor에 적용" |
| 성능 | "씬 성능 분석", "이 레벨의 Draw Call 수는?", "성능 안티패턴 체크" |
| 코드 품질 | "모든 에셋의 네이밍 컨벤션 체크", "순환 의존성이 있나?", "Blueprint/C++ 밸런스가 적절한가?" |
| 플랫폼 | "iOS에서 동작하나?", "Android Shader 호환성 체크", "PS5 메모리 버짓은?" |
| 빌드 | "Windows Shipping으로 빌드", "마지막 빌드 로그에서 에러 파싱" |
| AI & GAS | "적 순찰 비헤이비어 트리 생성", "쿨다운 3초, 마나 코스트 50의 파이어볼 어빌리티 생성" |

### 팁

- 도구 이름이나 API를 기억할 필요 없습니다 — 원하는 것을 설명하기만 하면 됩니다
- 요청이 모호하면 AI가 확인 질문을 합니다
- 요청을 연결할 수 있습니다: "Blueprint 생성, Mesh 컴포넌트 추가, (0,0,0)에 스폰"
- 문제가 생기면 "되돌려"라고 하거나 수정하고 싶은 내용을 설명하세요
- 복잡한 작업은 단계로 나누세요: 먼저 목표를 설명하고 AI가 계획하게 하세요

### 워크플로우 예시: 픽업 아이템 만들기

```
1. "BP_Gem이라는 Actor Blueprint 생성, StaticMeshComponent(구형)와 SphereCollision(오버랩 감지용) 추가"

2. "변수 PointValue(Integer, 기본값 10)와 이벤트 디스패처 OnCollected 추가"

3. "이벤트 그래프에서: 플레이어와 BeginOverlap 시 OnCollected 호출, PointValue를 점수에 추가, 자신 파괴"

4. "레벨 내 랜덤 위치에 BP_Gem 5개 스폰"
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
