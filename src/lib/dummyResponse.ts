export const DUMMY_SPEC = `# 로그인 페이지 Spec

## 개요
사용자가 이메일과 비밀번호로 로그인할 수 있는 페이지입니다.

## 기능 요구사항

### 필수 기능
- 이메일 입력 필드 (유효성 검사 포함)
- 비밀번호 입력 필드
- "로그인" 버튼
- "비밀번호 찾기" 링크

### 선택 기능
- 소셜 로그인 (Google, GitHub)
- "로그인 상태 유지" 체크박스

## UI 스펙

| 요소 | 스타일 |
|------|--------|
| 배경 | \`#0d1117\` |
| 카드 | 중앙 정렬, 최대 400px |
| 버튼 | Primary 컬러, full-width |

## 에러 처리
- 빈 필드 제출 시 인라인 에러 메시지 표시
- 잘못된 인증 정보 시 토스트 알림
`;

export const DUMMY_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login Page</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0d1117;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      color: #c9d1d9;
    }
    .card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 12px;
      padding: 40px;
      width: 100%;
      max-width: 400px;
    }
    h1 { font-size: 24px; margin-bottom: 8px; color: #f0f6fc; }
    p.subtitle { color: #8b949e; margin-bottom: 24px; font-size: 14px; }
    label { display: block; font-size: 13px; color: #8b949e; margin-bottom: 6px; }
    input {
      width: 100%;
      padding: 10px 12px;
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      color: #c9d1d9;
      font-size: 14px;
      margin-bottom: 16px;
      outline: none;
      transition: border-color 0.2s;
    }
    input:focus { border-color: #388bfd; }
    .btn {
      width: 100%;
      padding: 10px;
      background: #238636;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn:hover { background: #2ea043; }
    .forgot { text-align: center; margin-top: 16px; }
    .forgot a { color: #388bfd; text-decoration: none; font-size: 13px; }
    .divider {
      display: flex; align-items: center; margin: 20px 0;
      color: #484f58; font-size: 12px;
    }
    .divider::before, .divider::after {
      content: ''; flex: 1; height: 1px; background: #30363d;
    }
    .divider span { padding: 0 12px; }
    .social { display: flex; gap: 8px; }
    .social button {
      flex: 1; padding: 8px; background: #21262d; border: 1px solid #30363d;
      border-radius: 6px; color: #c9d1d9; cursor: pointer; font-size: 13px;
      transition: background 0.2s;
    }
    .social button:hover { background: #30363d; }
  </style>
</head>
<body>
  <div class="card">
    <h1>로그인</h1>
    <p class="subtitle">계정에 로그인하세요</p>
    <label>이메일</label>
    <input type="email" placeholder="you@example.com" />
    <label>비밀번호</label>
    <input type="password" placeholder="••••••••" />
    <button class="btn">로그인</button>
    <div class="forgot"><a href="#">비밀번호를 잊으셨나요?</a></div>
    <div class="divider"><span>또는</span></div>
    <div class="social">
      <button>Google</button>
      <button>GitHub</button>
    </div>
  </div>
</body>
</html>`;

export function generateDummyResponse(userMessage: string): { text: string; spec: string; html: string } {
  return {
    text: `"${userMessage}"에 대한 Spec 문서와 Prototype을 생성했습니다. 우측 패널에서 확인해보세요!`,
    spec: DUMMY_SPEC,
    html: DUMMY_HTML,
  };
}
