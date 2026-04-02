# SpecFlow Editor

## 프로젝트 위치
- 실제 앱: /specflow-editor/ (Vite + React)
- 루트의 Next.js 프로젝트는 무시할 것

## 실행
cd specflow-editor
npm install
npm run dev  # Vite (8080) + Express API 프록시 (3001) 동시 실행

## 기술 스택
- Vite 5 + React 18 + TypeScript + Tailwind 3 + shadcn/ui
- API 프록시: Express (server.ts)
- 배포: 미정

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
│   ├── api.ts               # API 호출 유틸 (/api/chat → 파싱, 대화이력 포함)
│   ├── parser.ts            # AI 응답 파싱 (HTML/Spec 분리)
│   ├── types.ts             # 타입 정의
│   └── utils.ts
server.ts                    # Express API 프록시 (Ennoia)

## Ennoia API
POST https://api-ennoia.wanted.co.kr/api/preset/v2/chat/completions
Headers: project, apiKey, Content-Type
Body: { hash, params: { user_message: "..." } }
응답: response.choices[0].message.content[0].text

## 디자인 원본
Lovable에서 생성. UI 변경은 가급적 Lovable에서, 로직은 여기서.
GitHub: https://github.com/hyeongkeunpark-bit/specflow-editor

## Git 워크플로우
- 작업 시작 전: 항상 git pull origin main
- 작업 완료 후: git commit + git push origin main
- Lovable과 같은 파일을 수정할 때: origin/main의 UI를 기준으로 하고 로직만 합친다
- 절대 Lovable의 UI 변경사항을 덮어쓰지 않는다
