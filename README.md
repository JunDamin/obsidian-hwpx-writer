# Obsidian HWPX Writer

[Obsidian](https://obsidian.md) 노트를 **HWPX(한글과컴퓨터 한글 문서)** 형식으로 변환하는 플러그인.

![license](https://img.shields.io/badge/license-MIT-green)
![platform](https://img.shields.io/badge/platform-desktop-informational)

## 주요 기능

- **Markdown → HWPX 변환** — 헤딩(#~######), 본문, 리스트, 표(GFM), 인용문, 코드 블록, 인라인 서식(굵게·기울임·취소선·코드) 지원
- **실시간 미리보기** — 사이드바에서 변환 결과를 페이지 단위로 확인 (@rhwp/core WASM)
- **템플릿 시스템** — 한컴에서 다듬은 HWPX 파일을 템플릿으로 등록, 스타일(폰트·헤딩·표 테두리 등)을 내 설정으로 복사
- **사용자 설정 관리** — 프리셋 저장/불러오기, 헤딩 H1~H6 세부 스타일, 표 테두리 디자이너(7구간 × 17종 선)
- **Obsidian 확장 문법** — `[[위키링크]]`, `![[embed]]`, `> [!NOTE]` 콜아웃, `==하이라이트==`
- **수식·플레이스홀더** — `$$LaTeX$$` 블록, `{{H1}}/{{BODY}}/{{CELL_*}}` 템플릿 스타일 견본

## 설치

### Obsidian 커뮤니티 플러그인 (준비 중)

1. `설정 → 커뮤니티 플러그인 → 검색` 에서 **HWPX Writer** 검색
2. 설치 → 활성화

### 수동 설치

1. [Releases](https://github.com/JunDamin/obsidian-hwpx-writer/releases) 에서 최신 `main.js`, `manifest.json`, `styles.css` 다운로드
2. vault 의 `.obsidian/plugins/obsidian-hwpx-writer/` 폴더에 복사
3. Obsidian 재시작 → 설정에서 플러그인 활성화

## 사용법

### 기본 변환

1. 리본 아이콘 또는 명령 팔레트에서 **HWPX Writer 패널 열기**
2. `.md` 파일을 열고 **📄 HWPX로 내보내기** 클릭
3. 같은 폴더에 `<파일명>.hwpx` 생성 (기본 출력 폴더는 설정에서 변경 가능)

### 템플릿 적용

1. 사이드바 → **📋 템플릿** 섹션 펼침
2. `📋 샘플` 로 내장 템플릿 추가 (또는 `📥 가져오기`로 외부 .hwpx 임포트)
3. 원하는 템플릿 옆 **적용** 클릭 → 폰트/헤딩/표 스타일이 설정에 복사됨
4. 내보내기 → 템플릿 스타일 반영된 HWPX 생성

### 현재 설정 저장

설정을 많이 커스터마이즈한 뒤 다른 템플릿 실험 전에:
- 템플릿 섹션의 **💾 현재 설정** 버튼 → 현재 스타일 스냅샷을 템플릿으로 저장
- 나중에 언제든 "적용" 으로 복원

### YAML Frontmatter 오버라이드

문서별로 설정을 덮어쓰려면:

```yaml
---
preset: 학술 논문
font-hangul: 함초롬바탕
body-size: 11
margin-left: 25
---

# 본문 시작
```

지원 키: `preset`, `paper`, `landscape`, `margin-*`, `font-hangul`, `font-latin`, `body-size`, `line-spacing`, `link-color`, `math-mode`, `output-folder`.

## 설정 영역

| 영역 | 내용 |
|---|---|
| **🎨 프리셋** | 설정 스냅샷 저장/복원. 기본/공문 양식/학술 논문/프레젠테이션 내장 |
| **📋 템플릿** | HWPX 파일 기반 스타일 템플릿. md2hwpx 보고양식 번들 포함 |
| **페이지 설정** | 용지 크기(A4/B5/Letter), 가로/세로, 여백 6종 |
| **헤딩 스타일** | H1~H6 각각 폰트 크기·색·굵게·기울임·페이지 나누기·빈 줄 |
| **본문 스타일** | 본문/리스트/표/코드 탭. 표는 7구간 × 17종 선 디자이너 |

## 마크다운 지원 범위

- **블록**: 헤딩(#~######), 문단, 순서/비순서 리스트(중첩 지원), 표(GFM), 인용문, 코드 블록(```), 수평선, 수식 블록(`$$...$$`)
- **인라인**: `**굵게**`, `*기울임*`, `~~취소선~~`, `` `인라인 코드` ``, `[링크](url)`, 이스케이프(`\*`)
- **GFM 확장**: `- [x]` 태스크 리스트, `~~strikethrough~~`
- **Obsidian 확장**: `[[위키링크]]`, `[[a|alias]]`, `[[a#heading]]`, `![[embed]]`, `> [!NOTE] 콜아웃`, `==하이라이트==`

## 알려진 한계

- **desktop only** — Electron 의존(파일 시스템 · 외부 프로그램 실행)
- **이미지 삽입 미구현** — `![alt](url)` 은 `[이미지: alt]` 로 표시
- **각주(`[^1]`) 미구현**

## 개발

```bash
npm install
npm run build          # 프로덕션 빌드 → main.js
npm run dev            # 개발 모드 (watch)
npm test               # 85개 단위/통합 테스트
```

## 라이선스

[MIT](LICENSE)

## 기여·버그 리포트

[GitHub Issues](https://github.com/JunDamin/obsidian-hwpx-writer/issues)
