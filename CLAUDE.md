# SpecFlow Editor

## 프로젝트 위치
- 실제 앱: /specflow-editor/ (Vite + React)
- 루트의 Next.js 프로젝트는 무시할 것

## 실행
cd specflow-editor
npm install
npm run dev

## 기술 스택
- Vite 5 + React 18 + TypeScript + Tailwind 3 + shadcn/ui
- 배포: Vercel (Serverless Functions for API proxy)

## 핵심 구조
src/
├── pages/Index.tsx          # 메인 페이지 (3패널 레이아웃)
├── components/
│   ├── ChatPanel.tsx        # 좌측 채팅
│   ├── PrototypePanel.tsx   # 중앙 Prototype 미리보기
│   ├── SpecPanel.tsx        # 우측 사이드 Spec 문서
│   └── HistoryPanel.tsx     # 우측 사이드 히스토리
├── hooks/useSessionManager.ts  # 세션 관리 + localStorage
├── lib/
│   ├── api.ts               # API 호출 유틸 (/api/chat → 파싱)
│   ├── parser.ts            # AI 응답 파싱 (HTML/Spec 분리)
│   ├── dummyResponse.ts     # (레거시) 더미 응답 — 미사용
│   ├── types.ts             # 타입 정의
│   └── utils.ts
api/
└── chat.ts                  # Ennoia API 프록시 (Vercel Serverless)

## Ennoia API
POST https://api-ennoia.wanted.co.kr/api/preset/v2/chat/completions
Headers: project, apiKey, Content-Type
Body: { hash, params: { user_message: "..." } }
응답: response.data.choices[0].message.content[0].text

## 디자인 원본
Lovable에서 생성. UI 변경은 가급적 Lovable에서, 로직은 여기서.
GitHub: https://github.com/hyeongkeunpark-bit/specflow-editor
