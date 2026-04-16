# WDS (Wanted Design System) Prototype 가이드

**[필수]** 이 가이드가 포함된 경우, Prototype HTML의 모든 CSS 변수와 스타일은 아래 WDS 토큰을 사용해야 합니다.
- `:root`에 아래 섹션 1의 CSS 변수를 **그대로** 정의합니다.
- `--color-primary`, `--color-gray-*` 등 자체 변수를 만들지 말고, `--wds-primary`, `--wds-label` 등 WDS 변수만 사용합니다.
- 컴포넌트 스타일은 섹션 4의 클래스명(`wds-btn`, `wds-field` 등)을 사용합니다.
- 기존 Prototype을 수정할 때는 기존 스타일을 유지하고, 새 요소에만 WDS를 적용합니다.

## 1. CSS 변수 (`:root`에 정의)

```css
:root {
  /* Primary */
  --wds-primary: #0066FF;
  --wds-primary-strong: #005EEB;
  --wds-primary-heavy: #0054D1;

  /* Label (텍스트) */
  --wds-label: #171719;
  --wds-label-strong: #000000;
  --wds-label-neutral: rgba(46,47,51,0.88);
  --wds-label-alt: rgba(55,56,60,0.61);
  --wds-label-assistive: rgba(55,56,60,0.28);
  --wds-label-disable: rgba(55,56,60,0.16);

  /* Background */
  --wds-bg: #ffffff;
  --wds-bg-alt: #F7F7F8;
  --wds-bg-elevated: #ffffff;
  --wds-bg-elevated-alt: #F7F7F8;

  /* Line (border, divider) */
  --wds-line: rgba(112,115,124,0.22);
  --wds-line-neutral: rgba(112,115,124,0.16);
  --wds-line-alt: rgba(112,115,124,0.08);
  --wds-line-solid: #E1E2E4;
  --wds-line-solid-neutral: #EAEBEC;
  --wds-line-solid-alt: #F4F4F5;

  /* Fill (배경 채우기) */
  --wds-fill: rgba(112,115,124,0.08);
  --wds-fill-strong: rgba(112,115,124,0.16);
  --wds-fill-alt: rgba(112,115,124,0.05);

  /* Status */
  --wds-positive: #00BF40;
  --wds-cautionary: #FF9200;
  --wds-negative: #FF4242;

  /* Interaction */
  --wds-inactive: #989BA2;
  --wds-disable-bg: #F4F4F5;

  /* Inverse (tooltip 등) */
  --wds-inverse-bg: #1B1C1E;
  --wds-inverse-label: #F7F7F8;
  --wds-inverse-primary: #3385FF;

  /* Static */
  --wds-static-white: #ffffff;
  --wds-static-black: #000000;

  /* Accent */
  --wds-accent-red: #E52222;
  --wds-accent-orange: #D17600;
  --wds-accent-lime: #429E00;
  --wds-accent-green: #009632;
  --wds-accent-blue: #005EEB;
  --wds-accent-violet: #5B37ED;
  --wds-accent-purple: #AD36E3;
  --wds-accent-pink: #E846CD;

  /* Dimmer */
  --wds-dimmer: rgba(23,23,25,0.52);

  /* Shadow */
  --wds-shadow-xs: 0px 1px 2px -1px rgba(23,23,23,0.10);
  --wds-shadow-sm: 0px 2px 4px -2px rgba(23,23,23,0.06), 0px 4px 6px -1px rgba(23,23,23,0.06);
  --wds-shadow-md: 0px 4px 6px -2px rgba(23,23,23,0.07), 0px 10px 15px -3px rgba(23,23,23,0.07);
  --wds-shadow-lg: 0px 6px 10px -4px rgba(23,23,23,0.08), 0px 16px 24px -6px rgba(23,23,23,0.08);

  /* Radius */
  --wds-radius-sm: 6px;
  --wds-radius-md: 8px;
  --wds-radius-lg: 12px;
  --wds-radius-xl: 16px;
  --wds-radius-full: 9999px;

  /* Font */
  --wds-font: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
}
```

## 2. 색상 사용 규칙

| 용도 | 변수 |
|------|------|
| 주요 버튼, 강조 텍스트 | `--wds-primary` |
| 본문 텍스트 | `--wds-label` |
| 보조 텍스트, 캡션 | `--wds-label-alt` |
| 힌트, 플레이스홀더 | `--wds-label-assistive` |
| 비활성 텍스트 | `--wds-label-disable` |
| 페이지 배경 | `--wds-bg` |
| 카드/패널 배경 (구분) | `--wds-bg-alt` |
| 모달 배경 | `--wds-bg-elevated` |
| 구분선, 테두리 | `--wds-line` 또는 `--wds-line-solid` |
| 입력 필드 배경 | `--wds-fill` |
| 성공 상태 | `--wds-positive` |
| 경고 상태 | `--wds-cautionary` |
| 에러 상태 | `--wds-negative` |
| 딤 처리 (모달 뒤) | `--wds-dimmer` |
| 툴팁 배경 | `--wds-inverse-bg` |
| 툴팁 텍스트 | `--wds-inverse-label` |

## 3. 타이포그래피

```css
body { font-family: var(--wds-font); color: var(--wds-label); }

/* Display */
.text-display-1 { font-size: 56px; line-height: 72px; font-weight: 700; }
.text-display-2 { font-size: 40px; line-height: 52px; font-weight: 700; }

/* Heading */
.text-heading-1 { font-size: 26px; line-height: 34px; font-weight: 700; }
.text-heading-2 { font-size: 22px; line-height: 30px; font-weight: 700; }
.text-heading-3 { font-size: 18px; line-height: 26px; font-weight: 700; }

/* Body */
.text-body-1 { font-size: 16px; line-height: 24px; font-weight: 500; }
.text-body-2 { font-size: 14px; line-height: 22px; font-weight: 500; }
.text-body-3 { font-size: 13px; line-height: 20px; font-weight: 500; }

/* Caption */
.text-caption-1 { font-size: 12px; line-height: 18px; font-weight: 500; }
.text-caption-2 { font-size: 11px; line-height: 16px; font-weight: 500; }
```

## 4. 컴포넌트 스타일 (Vanilla CSS)

### Button
```css
.wds-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  border: none; cursor: pointer; font-family: var(--wds-font);
  font-size: 14px; font-weight: 600; line-height: 22px;
  border-radius: var(--wds-radius-md); transition: background 0.15s, opacity 0.15s;
}
.wds-btn-md { padding: 10px 20px; }
.wds-btn-sm { padding: 8px 16px; font-size: 13px; }
.wds-btn-lg { padding: 14px 24px; font-size: 16px; }
.wds-btn-solid { background: var(--wds-primary); color: var(--wds-static-white); }
.wds-btn-solid:hover { background: var(--wds-primary-strong); }
.wds-btn-assistive { background: var(--wds-fill-strong); color: var(--wds-label); }
.wds-btn-outlined { background: transparent; border: 1px solid var(--wds-line-solid); color: var(--wds-label); }
.wds-btn:disabled { opacity: 0.38; cursor: not-allowed; }
```

### TextField
```css
.wds-field {
  width: 100%; padding: 12px 16px; font-size: 16px; line-height: 24px;
  border: 1px solid var(--wds-line-solid); border-radius: var(--wds-radius-md);
  background: var(--wds-bg); color: var(--wds-label); font-family: var(--wds-font);
  transition: border-color 0.15s;
}
.wds-field::placeholder { color: var(--wds-label-assistive); }
.wds-field:focus { outline: none; border-color: var(--wds-primary); }
.wds-field-error { border-color: var(--wds-negative); }
```

### Card
```css
.wds-card {
  background: var(--wds-bg); border: 1px solid var(--wds-line-solid-neutral);
  border-radius: var(--wds-radius-lg); overflow: hidden;
  box-shadow: var(--wds-shadow-sm); transition: box-shadow 0.15s;
}
.wds-card:hover { box-shadow: var(--wds-shadow-md); }
.wds-card-content { padding: 16px; }
.wds-card-title { font-size: 16px; font-weight: 700; line-height: 24px; color: var(--wds-label); }
.wds-card-caption { font-size: 13px; line-height: 20px; color: var(--wds-label-alt); margin-top: 4px; }
```

### Chip
```css
.wds-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 6px 12px; border-radius: var(--wds-radius-full);
  font-size: 13px; font-weight: 500; line-height: 20px;
  background: var(--wds-fill); color: var(--wds-label); cursor: pointer;
}
.wds-chip-selected { background: var(--wds-primary); color: var(--wds-static-white); }
```

### Modal
```css
.wds-modal-dimmer {
  position: fixed; inset: 0; background: var(--wds-dimmer); z-index: 1300;
  display: flex; align-items: center; justify-content: center;
}
.wds-modal {
  background: var(--wds-bg-elevated); border-radius: var(--wds-radius-xl);
  box-shadow: var(--wds-shadow-lg); padding: 24px; min-width: 320px; max-width: 480px;
}
.wds-modal-title { font-size: 18px; font-weight: 700; line-height: 26px; margin-bottom: 8px; }
.wds-modal-desc { font-size: 14px; line-height: 22px; color: var(--wds-label-alt); }
.wds-modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 24px; }
```

### Checkbox / Radio / Switch
```css
.wds-checkbox, .wds-radio {
  width: 20px; height: 20px; accent-color: var(--wds-primary); cursor: pointer;
}
.wds-switch {
  width: 48px; height: 28px; border-radius: 14px;
  background: var(--wds-fill-strong); position: relative; cursor: pointer;
  transition: background 0.2s;
}
.wds-switch.active { background: var(--wds-primary); }
```

### Divider
```css
.wds-divider { border: none; border-top: 1px solid var(--wds-line-solid); margin: 0; }
```

### Avatar
```css
.wds-avatar {
  width: 40px; height: 40px; border-radius: 50%; object-fit: cover;
  background: var(--wds-fill-strong);
}
.wds-avatar-sm { width: 32px; height: 32px; }
.wds-avatar-lg { width: 56px; height: 56px; }
```

### Tab
```css
.wds-tabs { display: flex; border-bottom: 1px solid var(--wds-line-solid); }
.wds-tab {
  padding: 12px 16px; font-size: 14px; font-weight: 600;
  color: var(--wds-label-alt); cursor: pointer; border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
}
.wds-tab.active { color: var(--wds-primary); border-bottom-color: var(--wds-primary); }
```

### Table
```css
.wds-table { width: 100%; border-collapse: collapse; }
.wds-table th {
  text-align: left; padding: 12px 16px; font-size: 13px; font-weight: 600;
  color: var(--wds-label-alt); border-bottom: 1px solid var(--wds-line-solid);
}
.wds-table td {
  padding: 12px 16px; font-size: 14px; color: var(--wds-label);
  border-bottom: 1px solid var(--wds-line-solid-neutral);
}
```

### Snackbar / Toast
```css
.wds-snackbar {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  background: var(--wds-inverse-bg); color: var(--wds-inverse-label);
  padding: 12px 20px; border-radius: var(--wds-radius-md);
  box-shadow: var(--wds-shadow-lg); font-size: 14px;
}
```

### SectionMessage (Alert)
```css
.wds-alert {
  padding: 16px; border-radius: var(--wds-radius-md); font-size: 14px; line-height: 22px;
}
.wds-alert-info { background: #EAF2FE; color: var(--wds-accent-blue); }
.wds-alert-success { background: #D9FFE6; color: var(--wds-accent-green); }
.wds-alert-warning { background: #FEF4E6; color: var(--wds-accent-orange); }
.wds-alert-error { background: #FEECEC; color: var(--wds-accent-red); }
```

## 5. 반응형 Breakpoint

| 이름 | 값 | 용도 |
|------|-----|------|
| xs | 0px | 모바일 |
| sm | 768px | 태블릿 |
| md | 992px | 작은 데스크탑 |
| lg | 1200px | 데스크탑 |
| xl | 1600px | 와이드 |

## 6. 사용 가능한 컴포넌트 목록

Accordion, ActionArea, Alert, Avatar, AvatarButton, AvatarGroup, BottomNavigation, Button, Card, CardList, Category, Checkbox, Chip, ContentBadge, DateCalendar, DatePicker, Divider, FallbackView, FilterButton, FormControl, IconButton, Label, List, Loading, Menu, Modal, PageCounter, Pagination, PaginationDots, PlayBadge, Popover, ProgressIndicator, ProgressStepIndicator, ProgressTracker, PushBadge, Radio, RadioGroup, ScrollArea, SearchField, SectionHeader, SectionMessage, SegmentedControl, Select, Skeleton, Slider, Snackbar, Stepper, Switch, Tab, Table, TextArea, TextButton, TextField, Thumbnail, TimePicker, Toast, ToggleIcon, Tooltip, TopNavigation, Typography
