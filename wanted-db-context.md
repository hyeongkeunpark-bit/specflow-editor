# 원티드 DB 운영 맥락

Confluence 문서에서 테이블별 운영 규칙·정책·특이사항을 자동 추출한 문서.

- 생성: 2026-04-21
- 소스: `scripts/harvest-output.json` (Confluence 검색 + 수동 seed)
- 재생성: `node scripts/harvest-context.mjs && node scripts/synthesize-context.mjs`

## 활용 가이드

- 각 테이블 섹션은 해당 테이블을 다루는 Spec 작성·검토 시 **선행 결정/제약/예외** 참고용.
- 스키마(컬럼 목록)는 `wanted-db-catalog.md` 참조.
- `⏰ 확인 필요` 마커 = 3년 이상 된 문서 기반. DRI 확인 후 현행 여부 판단.
- 각 항목 끝 `(출처: ...)` 링크로 근거 검증 가능.

---

# 📂 apply

## 🔑 핵심 규칙

**상태값(status) 정의 — 지원서 생명주기**
apply.status는 지원서의 처리 단계를 나타내며, 주요 값은: 1(작성중), 2(검수중), 3(거절), 5(접수), 6(서류통과), 8(채용), 10(기간만료)이다. 상태 전이는 일반적으로 단방향이며, 마감(포지션 종료) 또는 취소 이벤트에 의해 같은 숫자에 접미사가 붙는다(예: 접수→접수(마감)). _(출처: [유저웹/백도어] 지원서 상태값 정의, 2023-03-10)_

**작성중(status=1) 상태의 의미**
"제출하기"를 누르기 전 상태이며, 미노출(작성중 영역에만 노출)이다. 포지션이 마감되면 "작성중(마감)"으로 변경되고, 지원자 대시보드에는 여전히 미노출된다. _(출처: [유저웹/백도어] 지원서 상태값 정의, 2023-03-10)_

**검수중(status=2) 상태 및 자동 전송**
지원자가 제출한 지원서는 status=2(검수중)로 일시 저장되며, 정기적으로(매 5분마다 최대 20개) 자동 검수 및 전송이 이루어진다. 자동 전송 제외 조건(JP 이력서, 크로스보더, KA기업 중 서류통과율 10% 미만 등)에 해당하지 않으면 status=5(접수)로 자동 변경된다. _(출처: [유저웹/백도어] 지원서 상태값 정의, 2023-03-10; 지원자 자동 전송 규칙(이전 변경 히스토리), 2020-03-26)_

**접수(status=5) 상태 — 두 가지 진입 경로**
Case 1: 유저가 제출한 후 백도어로 접수 처리되었으나 기업에 아직 전달되지 않은 경우(대시보드 비표시). Case 2: 자동심사/수동심사를 거쳐 기업에 전달 완료된 경우(대시보드 표시). 둘 다 status=5이지만 기업 대시보드 노출 여부가 다르다. _(출처: [유저웹/백도어] 지원서 상태값 정의, 2023-03-10)_

**기간만료(status=10) — 자동 상태 변경**
접수 상태의 지원서가 응답 없이 30일 경과하면 자동으로 status=10으로 변경되며, 대시보드에서도 "기간만료" 탭으로 이동한다. auto_reject_time이 기록된다. _(출처: [유저웹/백도어] 지원서 상태값 정의, 2023-03-10; apply table datetime column 정의, 2019-02-14)_

**채용(status=8) — 합격 처리**
최종 합격을 의미하며, hire_time이 기록된다. 매칭 채용(status=109)도 동일한 합격 취급을 받는다. _(출처: [유저웹/백도어] 지원서 상태값 정의, 2023-03-10)_

**서류통과(status=6) — 서류 심사 결과**
기업이 서류 심사를 통과시킨 상태를 나타내며, pass_time이 기록된다. 이 상태에서 기업이 추가로 면접 등을 진행하거나 불합격 처리를 한다. _(출처: [유저웹/백도어] 지원서 상태값 정의, 2023-03-10)_

**거절(status=3) — 다양한 거절 사유**
status=3은 서류탈락, 면접탈락, 기간만료 후 자동탈락 등 여러 거절 이유를 포함하며, reject_time이 기록된다. 접미사(취소, 마감)가 붙는 경우에도 내부적으로는 status=3이다. _(출처: [유저웹/백도어] 지원서 상태값 정의, 2023-03-10)_

**매칭 관련 상태값 — 기업 추천형 지원**
매칭열람(status=100), 매칭제안(status=101), 매칭 제안 유저 확인(status=103), 매칭 제안 유저 수락(status=104), 매칭 유저 거절(status=106), 매칭 기간만료(status=107), 매칭 면접 탈락(status=108), 매칭 채용(status=109)이 있으며, 모두 "제안받기 현황"에 노출되고 서류 지원 수로 집계된다. _(출처: [유저웹/백도어] 지원서 상태값 정의, 2023-03-10)_

**apply_time 컬럼 — 지원서 제출 시간**
"지원 시작 시간"에서 "지원서 제출 시간"으로 재정의되었다. 지원자가 실제로 "제출하기"를 완료한 시점을 나타내며, 기업 대시보드의 "지원 수신" 기준이 된다. _(출처: apply table datetime column 정의, 2019-02-14)_

**create_time vs apply_time 구분**
create_time: 지원서 생성 시점(작성 시작), apply_time: 지원서 제출 시점(제출 완료). 같은 지원서라도 작성 중 수정되면 create_time은 초기값, apply_time은 제출 시점으로 기록된다. _(출처: apply table datetime column 정의, 2019-02-14)_

**resume_time 컬럼 — 최종 이력서 업로드 시간**
"지원서 제출 시간"에서 "최종 이력서 업로드 시간"으로 재정의되었다. 이력서가 수정될 때마다 업데이트되며, 지원 당시 첨부한 이력서의 버전을 추적하는 데 사용된다. _(출처: apply table datetime column 정의, 2019-02-14)_

**chk_time 컬럼 — 지원서 접수 시간**
기업에 지원서가 실제로 전달된 시점을 나타낸다. 백도어 수동 접수 또는 자동 전송 시 기록되며, 기업의 "지원서 수신" 기준이 된다. _(출처: apply table datetime column 정의, 2019-02-14)_

**open_time 컬럼 — 지원서 최초 조회 시간**
기업 관리자(recruiter)가 지원서를 처음 열어본 시점이다. 지원서가 기업에 전달된 후 실제로 검토되기까지의 리드타임을 측정할 때 사용된다. _(출처: apply table datetime column 정의, 2019-02-14)_

**pass_time, reject_time, hire_time 컬럼**
pass_time: 서류 통과 처리 시점, reject_time: 거절(서류/면접 탈락) 처리 시점, hire_time: 최종 합격 처리 시점. 모두 기업 관리자의 의사 결정 시점을 나타낸다. _(출처: apply table datetime column 정의, 2019-02-14)_

**auto_reject_time 컬럼 — 기간 만료 자동 거절**
기간만료(30일 응답 없음) 후 자동으로 거절 처리될 때 기록된다. 자동 거절은 지원자에게 별도 알림이 없거나 제한적일 수 있다. _(출처: apply table datetime column 정의, 2019-02-14)_

**cancel_time 컬럼 — 지원 취소 시각**
지원자가 지원을 취소한 시점이 기록된다. 취소된 지원서는 대시보드에서 "취소" 상태로 표시되지만, 상태 값(status)으로는 사용하지 않고 cancel_time 존재 여부로 구분한다. _(출처: [대시보드] 지원서 상태 정의, 2020-05-21)_

**다운로드 엑셀의 상태값 — 기업용 요약 분류**
대시보드 > 지원자 다운로드 엑셀의 "현재 상태" 컬럼에는 접수, 서류 통과, 최종 합격, 서류 탈락, 면접 탈락, 기간 만료 6가지만 노출되며, 지원 취소는 상태값으로 사용하지 않고 취소 일시만 기록한다. _(출처: [대시보드] 지원서 상태 정의, 2020-05-21)_

**자동 전송 제외 조건 — 1단계: 관리자 계정**
지원자가 원티드 백도어 접근 가능자(관리자, 서버 관리자)이면 자동 전송 제외이다. _(출처: 지원자 자동 전송 규칙(이전 변경 히스토리), 2020-03-26)_

**자동 전송 제외 조건 — 2단계: 일본(JP) 이력서**
지원자의 이력서 언어가 JP인 경우 자동 전송 제외이다. _(출처: 지원자 자동 전송 규칙(이전 변경 히스토리), 2020-03-26)_

**자동 전송 제외 조건 — 3단계: 크로스보더**
지원자의 거주 국가와 포지션 근무 국가가 일치하지 않으면 자동 전송 제외이다. _(출처: 지원자 자동 전송 규칙(이전 변경 히스토리), 2020-03-26)_

**자동 전송 제외 조건 — 4단계: KA 기업 서류통과율**
중요 기업고객(KA)에 지원한 이력서 중 서류통과율이 10% 미만인 지원자는 자동 전송 제외이다. 단, 서류통과율 10% 이상 + 과거 지원 10건 이상이면 자동 전송 대상이다. _(출처: 지원자 자동 전송 규칙(이전 변경 히스토리), 2020-03-26)_

**자동 전송 제외 조건 — 5단계: KA2(자사 양식 요구 기업)**
자사 서류 양식을 요구하는 기업고객(KA2)에 지원한 이력서는 자동 전송 제외이다. _(출처: 지원자 자동 전송 규칙(이전 변경 히스토리), 2020-03-26)_

**자동 전송 대상 조건 — 한국 기업(400자 이상)**
한국 기업에 지원한 경우, 이력서 글자수가 400자 이상이면 자동 전송 대상이다. _(출처: 지원자 자동 전송 규칙(이전 변경 히스토리), 2020-03-26)_

**자동 전송 대상 조건 — 홍콩/싱가폴/대만(800자 이상)**
홍콩, 싱가폴, 대만 기업에 지원한 경우, 이력서 글자수가 800자 이상이면 자동 전송 대상이다. _(출처: 지원자 자동 전송 규칙(이전 변경 히스토리), 2020-03-26)_

**자동 전송 추가 대상 — 보강요청(한국만)**
이력서가 400자 미만, 읽을 수 없는 파일, 또는 동영상만 있는 경우 "접수 + 보강요청"으로 자동 전송되며(한국만 적용), 3일 이내 업데이트되면 즉시 재검토된다. _(출처: 지원자 자동 전송 규칙(이전 변경 히스토리), 2020-03-26)_

**자동 전송 추가 대상 — 동영상만 있는 경우**
이력서가 동영상 파일(avi, mp4)만 있는 경우 "접수 + 보강요청"으로 자동 전송되며, 대시보드에 "이력서부족" 딱지가 노출된다. _(출처: 지원자 자동 전송 규칙(이전 변경 히스토리), 2020-03-26)_

**자동 전송 추가 대상 — 신입 포지션**
포지션이 신입(newbie) 옵션으로 등록된 경우, 글자수 제한 없이 자동 전송된다. _(출처: 지원자 자동 전송 규칙(이전 변경 히스토리), 2020-03-26)_

## ⚠️ 특이사항 / 주의

**status=2(검수) 상태의 운영 이슈 — 2024년 2월 장애**
2024-02-23부터 모든 지원서가 status=2에서 status=5로 자동 전환되지 않는 장애가 발생했다. 원인은 celery_beat의 periodic_auto_send 함수가 Redis 락 키 부재로 영구 실패 상태에 빠진 것이었다. 약 10,864건의 지원서가 검수 상태에 정체되었고, 수동 스크립트로 복구 후 이메일 발송 시 local.wanted.co.kr 오류로 1,400건의 잘못된 메일이 발송되었다. _(출처: 지원서 검토 > 접수 대응 히스토리, 2024-02-27)_

**status=2 필요성 재검토**
대부분의 지원서가 status=5로 이동하므로 처음부터 status=5로 지원하는 방식의 개선이 논의 중이다. _(출처: 지원서 검토 > 접수 대응 히스토리, 2024-02-27)_

**기간만료 후 재기간만료(자동탈락) 규칙**
기간만료(status=10) 상태의 지원서가 추가로 30일 경과하면 자동 거절(status=3)되어 "기간만료 불합격"으로 처리된다. _(출처: [유저웹/백도어] 지원서 상태값 정의, 2023-03-10)_

**마감 포지션의 지원서 상태 변경**
포지션이 마감(종료)되면, 진행 중인 지원서는 해당 상태에 "(마감)" 접미사가 붙으며(예: 접수→접수(마감)), 기업 대시보드 노출 여부가 달라질 수 있다. _(출처: [유저웹/백도어] 지원서 상태값 정의, 2023-03-10)_

**지원 취소 표기 — cancel_time 사용**
지원 취소는 status 값으로 별도 상태를 가지지 않으며, cancel_time이 null이 아닌지로 구분한다. 다운로드 엑셀에는 취소 일시가 기록되지만 "현재 상태"에는 표시되지 않는다. _(출처: [대시보드] 지원서 상태 정의, 2020-05-21)_

**기간만료 상태의 대시보드 노출**
기간만료(status=10)로 변경된 지원서는 기업 대시보드의 "기간만료" 탭으로 이동하며, 그 이전의 접수·서류통과 진행 상태를 보여준다. _(출처: [유저웹/백도어] 지원서 상태값 정의, 2023-03-10)_

**매칭 제안 유저 수락(104) → 서류통과(6) 동급 처리**
매칭 제안 유저 수락(status=104)은 서류 통과와 동등한 처리이며, "서류 통과" "최종합격 수" 등으로 집계된다. _(출처: [유저웹/백도어] 지원서 상태값 정의, 2023-03-10)_

**매칭 기간만료(107)의 집계**
매칭 기간만료(status=107)는 "접수"로 집계되며, 매칭 제안이 응답 없이 기간 경과한 경우를 나타낸다. _(출처: [유저웹/백도어] 지원서 상태값 정의, 2023-03-10)_

**거절 상태의 세분화**
거절(status=3)은 서류탈락, 면접탈락, 기간만료 자동탈락 등을 모두 포함하며, 기업 대시보드의 "불합격" 탭에 통합되어 노출된다. _(출처: [유저웹/백도어] 지원서 상태값 정의, 2023-03-10)_

**자동 전송 처리 시점 — 정기적 배치**
자동 전송은 매 5분마다 최대 20개씩 처리되므로, 지원 직후 바로 기업에 도착하지 않을 수 있다. _(출처: 지원자 자동 전송 규칙(이전 변경 히스토리), 2020-03-26)_

**KA 기업 서류통과율 계산 방식**
서류통과율 = 서류통과수(서류통과 + 서류통과 후 합격 + 서류통과 후 불합격) / 전체 지원수. 분모는 모든 지원수를 포함하고, 분자는 서류 심사 이후 상태만 카운트한다. _(출처: 지원자 자동 전송 규칙(이전 변경 히스토리), 2020-03-26)_

**핵심 중요 기업고객(6사) 수동 전송**
회사 ID 670, 370, 816, 680, 115, 154는 핵심 중요 기업고객으로 분류되어 자동 전송이 제외될 수 있으며, 수동 검수를 거친다. _(출처: 지원자 자동 전송 규칙(이전 변경 히스토리), 2020-03-26)_

**CDC(Change Data Capture) 이후 지원 플로우 추적**
CDC 출범일(2020-10-14) 이후 지원한 지원서(apply_time > 2020-10-14)부터 wanted_cdc.apply_status에서 상태 변경 이력이 기록된다. _(출처: 지원 플로우 점검, 2021-02-26)_

## 🗃️ Deprecated / Legacy

**status=-2 (심사중 마감, 취소)**
2016-10-24 이후 해당 status 값을 가진 지원기록 없음. _(출처: [유저웹/백도어] 지원서 상태값 정의, 2023-03-10)_

**status=-3 (매칭요청 마감)**
2018-06-26 이후 해당 status 값을 가진 지원기록 없음. _(출처: [유저웹/백도어] 지원서 상태값 정의, 2023-03-10)_

**status=-4 (N/A 마감)**
2018-07-03 이후 해당 status 값을 가진 지원기록 없음. _(출처: [유저웹/백도어] 지원서 상태값 정의, 2023-03-10)_

**status=-5 (status_values.matching_user_reject)**
2018-06-27 이후 해당 status 값을 가진 지원기록 없음. _(출처: [유저웹/백도어] 지원서 상태값 정의, 2023-03-10)_

**status=4 (DING)**
2019-10-31 이후 해당 status 값을 가진 지원기록 없음. _(출처: [유저웹/백도어] 지원서 상태값 정의, 2023-03-10)_

**status=102 (매칭 제안 취소)**
2018-08-23 일 건 외 정보 없음(해당 지원건의 유저 탈퇴한 듯하여 확인 불가). _(출처: [유저웹/백도어] 지원서 상태값 정의, 2023-03-10)_

**status=110 (매칭 제안 수락 후 기업 응답 없음)**
2018-10-05 이후 해당 status 값을 가진 지원기록 없음. _(출처: [유저웹/백도어] 지원서 상태값 정의, 2023-03-10)_

**progress_time 컬럼**
현재 사용처 없음. 향후 용도 미정. _(출처: apply table datetime column 정의, 2019-02-14)_

**자동 전송 제외 기업 리스트(2019년 11월 이전)**
2019년 11월 자동 전송 제외 정책 변경 시 기존 리스트가 삭제되었으나, 코드는 유지되다가 2019년 7월 이후 제외 목록이 다시 정리되었다. _(출처: 지원자 자동 전송 규칙(이전 변경 히스토리), 2020-03-26)_

---

# 📂 user

# user 테이블 운영 규칙

## 🔑 핵심 규칙

**사용자 상태(Status) 전이 흐름**: profileRequired 환경변수에 따라 초기 상태가 결정된다. profileRequired=true이면 D(Draft) → submitUserRegister() → P(Pending) 또는 A(Active); profileRequired=false이면 초기 상태가 P 또는 A로 결정된다. _(출처: [회원가입 - 프로필 입력과 약관동의 옵션](https://wantedlab.atlassian.net/wiki/spaces/NBD/pages/4740677735/-), 2026-04-15)_

**프로필 레벨(Profile Level) 정의**: 사용자는 입력된 정보에 따라 LEVEL0~LEVEL4로 분류된다. LEVEL0은 이름 또는 이메일 부재, LEVEL1은 직군/직무/경력 중 하나 부재, LEVEL2는 직군/직무/경력 모두 입력, LEVEL3은 직장명/학교명/간단자기소개 입력, LEVEL4는 LEVEL3 충족 후 매치업 이력서 글자 기준(한글/영어 400, 중국어/일본어 300) 초과. _(출처: [공통 프로필 단계 정의 Profile Level Requirements](https://wantedlab.atlassian.net/wiki/spaces/WAN/pages/85131300/Profile+Level+Requirements), 2024-11-21)_

**약관 동의 상태 저장**: TB_USER_REGISTER 테이블의 TERMS_AGREED_YN, PRIVACY_AGREED_YN, MARKETING_AGREED_YN 컬럼에 Y/N/null 값으로 저장한다. Y는 동의, N은 동의하지 않음, null은 약관을 묻지 않은 상태(profileRequired=false)를 의미한다. _(출처: [회원가입 - 프로필 입력과 약관동의 옵션](https://wantedlab.atlassian.net/wiki/spaces/NBD/pages/4740677735/-), 2026-04-15)_

**필수 약관 동의 검증**: submitUserRegister() 호출 시 termsAgreed와 privacyAgreed가 모두 true여야 하며, false일 경우 400 에러가 발생한다. marketingAgreed는 선택 사항이다. _(출처: [회원가입 - 프로필 입력과 약관동의 옵션](https://wantedlab.atlassian.net/wiki/spaces/NBD/pages/4740677735/-), 2026-04-15)_

**초대 링크 수락 시 상태 즉시 전환**: POST /auth/users/me/register/invite 호출 시 D/P 상태 유저는 환경변수에 관계없이 즉시 A(Active) 상태로 전환된다. _(출처: [회원가입 - 프로필 입력과 약관동의 옵션](https://wantedlab.atlassian.net/wiki/spaces/NBD/pages/4740677735/-), 2026-04-15)_

**SSO 회원가입 통합 플로우**: Email 먼저 가입(Active) 후 동일 이메일로 SSO 로그인 시도 시 기존 계정에 SSO provider를 추가로 연결한다. 반대로 SSO 먼저 가입 후 동일 이메일로 Email 회원가입 시도 시 "이미 {provider} 계정으로 가입됨" 안내를 표시한다. _(출처: [Ennoia] Email 회원가입 및 로그인 (통합)](https://wantedlab.atlassian.net/wiki/spaces/laas/pages/4745232582/Product+Spec+Ennoia+Email), 2026-04-09)_

**프로필 레벨 3 임시저장 버그**: Lv3 이상의 이력서를 "임시저장" 상태로 만들 시 Lv3으로 변경되며 매치업에 계속 노출되는 문제가 있으며, 장기적/구조적인 개선이 필요하다. _(출처: [공통 프로필 단계 정의 Profile Level Requirements](https://wantedlab.atlassian.net/wiki/spaces/WAN/pages/85131300/Profile+Level+Requirements), 2024-11-21)_

**휴면 상태 유저 개인정보 이동**: 휴면 계정으로 전환 시 user 테이블의 '개인정보'에 포함되는 컬럼을 dormant_user 테이블로 이동하고, user 테이블 내 해당 데이터를 지운다. _(출처: [(2020-03) LOGIN: 애플/구글 로그인](https://wantedlab.atlassian.net/wiki/spaces/servercircle/pages/261325079/2020-03+LOGIN), 2020-03-25)_

**휴면 상태값 지정**: 휴면 계정 상태로 전환되면 user 테이블 status = 2로 변경한다. _(출처: [(2020-03) LOGIN: 애플/구글 로그인](https://wantedlab.atlassian.net/wiki/spaces/servercircle/pages/261325079/2020-03+LOGIN), 2020-03-25)_

**연봉 입력 조건**: 자연수만 입력 가능하며, 숫자 이외의 문자/특수문자, 콤마, 온점, 마이너스 등의 기호는 입력 불가다. 0으로 시작 시 0은 무시되며, 6자리까지만 입력 가능하다(앱의 경우 본 조건 제외). _(출처: [[정의] 프로필/연봉수집 정의](https://wantedlab.atlassian.net/wiki/spaces/WAN/pages/96567375), 2019-07-12)_

**연봉 저장 및 노출 원칙**: 월봉으로 제출되어도 서버에는 연봉(연간)으로 저장되며, 클라이언트에서 계산하여 노출한다. 월봉 조회 시에는 연봉으로 저장된 데이터를 12등분하여 노출한다. _(출처: [[정의] 프로필/연봉수집 정의](https://wantedlab.atlassian.net/wiki/spaces/WAN/pages/96567375), 2019-07-12)_

## ⚠️ 특이사항 / 주의

**이메일 중복 제약**: user 테이블의 email이 unique=true로 설정되어 있어, 휴면 회원 활성화 시 이메일 중복으로 인해 활성화되지 않는 케이스가 발생할 수 있다. _(출처: [(2023-12) 휴면회원 복귀 및 관련 대응](https://wantedlab.atlassian.net/wiki/spaces/servercircle/pages/2961539198/2023-12), 2023-11-29)_

**Pending 상태 로그인 차단**: 상태가 P(Pending, 관리자 승인 대기)인 사용자가 로그인을 시도하면 "승인 대기 중입니다" 안내를 표시하고 접근을 차단한다. _(출처: [[Ennoia] Email 회원가입 및 로그인 (통합)](https://wantedlab.atlassian.net/wiki/spaces/laas/pages/4745232582/Product+Spec+Ennoia+Email), 2026-04-09)_

**Draft 상태 이메일 중복 처리**: Step 1에서 이미 Draft 상태로 가입한 이메일로 다시 가입 시도 시 "가입이 완료되지 않았습니다. 이어서 진행하시겠습니까?" 안내를 표시하고 남은 단계부터 이어서 진행하도록 유도한다. _(출처: [[Ennoia] Email 회원가입 및 로그인 (통합)](https://wantedlab.atlassian.net/wiki/spaces/laas/pages/4745232582/Product+Spec+Ennoia+Email), 2026-04-09)_

**SSO 비밀번호 미설정 유저 처리**: SSO로만 가입한 계정(비밀번호 미설정)에 대해 Email/Password 로그인 시도 시 "이 계정은 {provider} 로그인으로 가입되었습니다. {provider}로 로그인해주세요." 안내를 표시한다. _(출처: [[Ennoia] Email 회원가입 및 로그인 (통합)](https://wantedlab.atlassian.net/wiki/spaces/laas/pages/4745232582/Product+Spec+Ennoia+Email), 2026-04-09)_

**비밀번호 변경 시 세션 무효화**: 비밀번호 재설정 완료 후 모든 기존 세션이 무효화되며, 사용자는 재로그인이 필요하다. _(출처: [[Ennoia] Email 회원가입 및 로그인 (통합)](https://wantedlab.atlassian.net/wiki/spaces/laas/pages/4745232582/Product+Spec+Ennoia+Email), 2026-04-09)_

**마이그레이션 중 약관 동의 우선순위**: oneid db 업데이트보다 wanted db의 업데이트가 선행되어야 하며, 두 db 간 정합성을 맞추어야 한다. _(출처: [(2023-12) 휴면회원 복귀 및 관련 대응](https://wantedlab.atlassian.net/wiki/spaces/servercircle/pages/2961539198/2023-12), 2023-11-29)_

**환경변수 profileRequired 우선성**: profileRequired=true이면 approvalRequired 값에 관계없이 D(Draft) 상태로 시작된다. profileRequired가 approvalRequired보다 우선한다. _(출처: [회원가입 - 프로필 입력과 약관동의 옵션](https://wantedlab.atlassian.net/wiki/spaces/NBD/pages/4740677735/-), 2026-04-15)_

**Step 진행 중 이메일 변경 감지**: Step 1에서 이메일을 변경한 후 다음 스텝으로 진행하려 하면, 기존 인증 세션을 무효화하고 Step 2(인증)부터 재시작한다. _(출처: [[Ennoia] Email 회원가입 및 로그인 (통합)](https://wantedlab.atlassian.net/wiki/spaces/laas/pages/4745232582/Product+Spec+Ennoia+Email), 2026-04-09)_

**회원가입 폼 데이터 초기화 필수**: 회원가입 완료(Pending 상태 진입) 또는 플로우 이탈(로그인 페이지 복귀, 브라우저 종료) 시 폼 데이터를 반드시 초기화해야 한다. 미초기화 시 다음 가입 시도에서 이전 개인정보가 노출될 수 있다. _(출처: [[Ennoia] Email 회원가입 및 로그인 (통합)](https://wantedlab.atlassian.net/wiki/spaces/laas/pages/4745232582/Product+Spec+Ennoia+Email), 2026-04-09)_

**크레딧잡 레벨 정의 차이**: 크레딧잡의 프로필 레벨은 원티드와 유사하나 LEVEL1에서 스크랩 기록을 추가 요구하며, 현재 연봉은 LEVEL3에서만 요구된다. _(출처: [[크레딧잡] 유저 프로필 단계 정의](https://wantedlab.atlassian.net/wiki/spaces/WAN/pages/2616655905), 2022-09-28)_

## 🗃️ Deprecated / Legacy

**Facebook ID 필드**: 페이스북으로 가입한 사용자는 user 테이블 fb_id 컬럼에 저장되며, 다른 소셜로 가입한 사용자는 fb_id=NULL이다. _(출처: [(2020-03) LOGIN: 애플/구글 로그인](https://wantedlab.atlassian.net/wiki/spaces/servercircle/pages/261325079/2020-03+LOGIN), 2020-03-25)_ ⏰ 확인 필요

**2016-05-10 이전 데이터**: 과거 특정 시점 이전에 등록된 데이터에서 연봉 입력 방식이 구간값(range) 형태로 저장되어 있을 수 있다. 현재는 숫자 입력 방식으로 변경되었다. _(출처: [[정의] 프로필/연봉수집 정의](https://wantedlab.atlassian.net/wiki/spaces/WAN/pages/96567375), 2019-07-12)_ ⏰ 확인 필요

---

# 📂 resume

# resume 테이블 운영 규칙

## 🔑 핵심 규칙

- **기본 이력서(매치업 이력서) 식별**: `wanted_resume.is_matching=True`인 이력서와 대응되는 `resume` 레코드의 조합으로 이해. 단순 `resume.id`만으로는 부족하며, `wanted_resume_id` 연결을 반드시 확인. _(출처: [07-이력서](https://wantedlab.atlassian.net/wiki/spaces/~740533987/pages/4764368904/07-), 2026-04-10)_

- **파일 이력서 조회 필터링**: `delete_time is null and wanted_resume_id is null and is_profile=1` 조건으로만 비원티드 이력서(파일 업로드) 추출. 원티드 구조화 이력서와 섞이지 않도록 주의. _(출처: [RDB 데이터 추출 시 주의사항](https://wantedlab.atlassian.net/wiki/spaces/DATA/pages/73564218/RDB), 2020-11-26)_

- **이력서 완성도 판단**: 단순히 `wanted_resume`의 메타데이터만으로는 부족하며, **대응하는 `resume.character_count` 값을 함께 검토**하여 글자 수 기준 충족 여부 확인 필수. _(출처: [07-이력서](https://wantedlab.atlassian.net/wiki/spaces/~740533987/pages/4764368904/07-), 2026-04-10)_

- **character_count 계산 범위**: `resume.character_count`는 워드, PDF 파일의 글자 수를 모두 카운팅하는 컬럼. 원티드 구조화 이력서의 소개글, 경력, 학력, 스킬 등 모든 섹션의 글자 수가 합산됨. _(출처: [RDB 데이터 추출 시 주의사항](https://wantedlab.atlassian.net/wiki/spaces/DATA/pages/73564218/RDB), 2020-11-26)_

- **글자 수 기준 (언어별, 매치업 프로필 기준)**:
  - 한글: 400자
  - 영어: 400자
  - 중국어(번체): 300자
  - 일본어: 300자
  
  _(출처: [공통 프로필 단계 정의](https://wantedlab.atlassian.net/wiki/spaces/WAN/pages/85131300/Profile+Level+Requirements), 2024-11-21)_

- **글자 수와 지원/매칭 기준**: 400자 미만 이력서는 Level 4 달성 불가. 합격률은 600자(5.3%) → 2,400자(8.8%) 구간에서 단계적 상승. _(출처: [이력서 글자 수에 따른 채용 전환율 분석](https://wantedlab.atlassian.net/wiki/spaces/marketing/pages/4614848528), 2026-01-23)_

- **경력 인증 이력서 수정 정책**: 경력 인증(NHIS) 이력서는 회사명·연차 수정 불가. 신규 경력만 추가 가능하며, 재인증 시 기존 이력은 비활성화 후 신규만 추가. _(출처: [SCRAPING 프로젝트 - 이력서 정책](https://wantedlab.atlassian.net/wiki/spaces/WAN/pages/2459271177/SCRAPING+-), 2022-06-03)_

- **온보딩 파일 업로드 시 자동 변환**: Treatment 그룹에서 Step 2 파일 업로드 시 체크박스(디폴트 체크)로 "기본 이력서로 설정" 옵션 제공. 온보딩 완료 시 백그라운드에서 파일 → 원티드 이력서 자동 변환 + 기본 설정 처리. _(출처: [온보딩 Step 2 체크박스 실험](https://wantedlab.atlassian.net/wiki/spaces/WAN/pages/4728029278/2026-03-31+Step+2), 2026-04-15)_

## ⚠️ 특이사항 / 주의

- **delete_time과 이력서 상태 복잡성**: 원티드 구조화 이력서 수정 중 '임시저장' 상태로 돌아가면 `delete_time`이 기록되는 이슈 있음. 조회 시 `where delete_time is null`만으로는 부족하며, `wanted_resume` 테이블과 JOIN하여 현재 활성 상태 이력서만 추출해야 함. _(출처: [RDB 데이터 추출 시 주의사항](https://wantedlab.atlassian.net/wiki/spaces/DATA/pages/73564218/RDB), 2020-11-26)_

- **Level 3 임시저장 시 Lv3 강등 이슈**: Lv3 이상 이력서를 "임시저장" 상태로 만들 시, 자동으로 Lv3으로 변경됨. 사용자 인지 없이 매치업 노출이 유지되는 문제 있음. _(출처: [공통 프로필 단계 정의](https://wantedlab.atlassian.net/wiki/spaces/WAN/pages/85131300/Profile+Level+Requirements), 2024-11-21)_

- **AI 리뷰 일일 제한**: 동일 이력서에 대해 사용자 1일 최대 3회까지만 AI 리뷰 가능. 제한 초과 시 `dailyLimitExceeded` 상태 반환. _(출처: [설계 이력서 코칭 에이전트](https://wantedlab.atlassian.net/wiki/spaces/coreteam/pages/3888611329), 2025-12-02)_

- **AI 리뷰 대상 이력서 조건**: 간단 자기소개글 작성 + 전체 글자 수 800자 이상 + is_complete=true 또는 is_complete=false이면서 글자 수 400자 이상. 학력 없어도 가능하지만 경력 인증 여부는 무관. _(출처: [설계 이력서 코칭 에이전트](https://wantedlab.atlassian.net/wiki/spaces/coreteam/pages/3888611329), 2025-12-02)_

- **필수 필드 완화 실험**: 2026년 4월부터 경력-직무·직책, 학력-졸업상태·전공이 선택 항목으로 변환. 그러나 `is_complete` 판단 기준은 Control과 동일하게 유지되어 실제 완성 기준은 변하지 않음. _(출처: [기본 이력서 필수 항목 완화](https://wantedlab.atlassian.net/wiki/spaces/WAN/pages/4773675018), 2026-04-20)_

- **파일 복사 시 제목 규칙 변경**: Copy API에 `copy_type` 파라미터 추가. `duplicate`(기존)는 제목을 "{원본} 사본"으로, `original`은 "{원본} 원본"으로 저장. _(출처: [설계 이력서 코칭 에이전트](https://wantedlab.atlassian.net/wiki/spaces/coreteam/pages/3888611329), 2025-12-02)_

## 🗃️ Deprecated / Legacy

- **자동 전송 글자 수 기준 통일**: 2020년 5월 기준, 자동 전송/백도어 기준이 통일됨. 중국어 자동전송 800자 → 300자, 백도어 800자 → 300자로 하향. _(출처: [이력서 글자수 정책](https://wantedlab.atlassian.net/wiki/spaces/WAN/pages/401211430), 2020-06-15)_ ⏰ 확인 필요

- **2016년 5월 10일 이전 이력서 데이터 예외**: `confirm_time` 컬럼 도입 이전 약 150개 기업의 이력서는 `confirm_time`이 NULL. 기업 승인 일자 조회 시 `case when company_confirm=1 and date(create_time) <= '2016-05-10' and confirm_time is null then date(create_time) else date(confirm_time) end` 로직 적용. _(출처: [RDB 데이터 추출 시 주의사항](https://wantedlab.atlassian.net/wiki/spaces/DATA/pages/73564218/RDB), 2020-11-26)_ ⏰ 확인 필요

---

# 📂 wanted_des

# wanted_des 테이블 운영 규칙

## 🔑 핵심 규칙

**포지션 명(position) 필드**: `wanted_des` 테이블의 position 컬럼에는 공란이 많으므로, 데이터 추출 시 `wanted_job_detail` 테이블의 position 컬럼을 사용할 것을 권장한다. _(출처: [RDB 데이터 추출 시 주의사항](https://wantedlab.atlassian.net/wiki/spaces/DATA/pages/73564218/RDB), 2020-11-26)_

**승인 포지션 판단**: `confirm_time is not null` 조건으로 승인된 포지션을 식별한다. 마지막 승인 시간이 update되므로 confirm_time은 최신 승인 시점을 나타낸다. _(출처: [RDB 데이터 추출 시 주의사항](https://wantedlab.atlassian.net/wiki/spaces/DATA/pages/73564218/RDB), 2020-11-26)_

**라이브 포지션 조건**: `confirm_time is not null AND status='active'` 조건을 만족하는 포지션만 라이브 상태이다. 숨김 처리한 공고는 `hidden=1`로 표시된다. _(출처: [RDB 데이터 추출 시 주의사항](https://wantedlab.atlassian.net/wiki/spaces/DATA/pages/73564218/RDB), 2020-11-26)_

**is_active 판단 (Map Server)**: `is_active = status='active' AND confirm AND NOT hidden AND NOT is_private`의 4가지 조건을 모두 만족해야만 포지션이 활성 상태이다. _(출처: [Step 3-1. Kafka Data Pipeline 아키텍처](https://wantedlab.atlassian.net/wiki/spaces/AXCP/pages/4731666743/Step+3-1.+Kafka+Data+Pipeline), 2026-03-20)_

**포지션 상태 전이 흐름**: 포지션은 create_job → draft → request → active → closed/expired 또는 active → draft(수정) 상태 전이가 가능하다. _(출처: [RDB 데이터 추출 시 주의사항](https://wantedlab.atlassian.net/wiki/spaces/DATA/pages/73564218/RDB), 2020-11-26)_

**히든 포지션 (is_private) 운영**: `is_private=true`로 설정된 포지션은 특정 유저 그룹에게만 공개되며, `hidden=true`가 강제된다. 또한 `is_private=true`일 때는 status 값과 무관하게 팔로우 기업 및 신규 포지션 메일 발송이 금지된다. _(출처: [(2024.02) 슈퍼탤런트: 활용 예시 및 API 설계](https://wantedlab.atlassian.net/wiki/spaces/servercircle/pages/3011969456/2024.02+API), 2024-02-19)_

**공고 근무지 조회**: 포지션의 근무지는 company_address 테이블과 address_id로 연결된다(`wanted_des.address_id = company_address.id`). 국가(i18n_country), 지역(i18n_location), 전체주소(full_location)로 구성되며, `company_address.is_default=1`이 본사(HQ), 0이 지사를 의미한다. _(출처: [RDB 데이터 추출 시 주의사항](https://wantedlab.atlassian.net/wiki/spaces/DATA/pages/73564218/RDB), 2020-11-26)_

**포지션 카테고리 추론 (Map Server)**: `position.tags` 키워드 매칭을 통해 6개 카테고리(개발, 디자인, 데이터, 기획, 마케팅, HR) + 기타로 분류된다. 이는 고정 로직이며, 포지션 이벤트 처리 후 회사의 primary_category가 자동 갱신된다. _(출처: [Step 3-1. Kafka Data Pipeline 아키텍처](https://wantedlab.atlassian.net/wiki/spaces/AXCP/pages/4731666743/Step+3-1.+Kafka+Data+Pipeline), 2026-03-20)_

**Kafka 이벤트 멱등성**: position 관련 모든 INSERT 작업은 `ON CONFLICT (id) DO UPDATE` 패턴을 사용하여, 동일 이벤트 중복 수신 시에도 안전하게 처리된다. _(출처: [Step 3-1. Kafka Data Pipeline 아키텍처](https://wantedlab.atlassian.net/wiki/spaces/AXCP/pages/4731666743/Step+3-1.+Kafka+Data+Pipeline), 2026-03-20)_

**강제 종료 자동화**: 모든 지원서가 45일 이상 미열람 상태인 채용 중 공고는 공고 강제 종료 상태로 자동 전환된다('채용절차의 공정화에 관한 법률' 제10조 준수). _(출처: [채용 솔루션 : 공고, 인재, 지원자 열람/종료 정책](https://wantedlab.atlassian.net/wiki/spaces/PO/pages/4000055392), 2025-09-17)_

## ⚠️ 특이사항 / 주의

**Kafka 이벤트 처리 순서 보장**: Kafka 토픽의 파티션 키가 `company_id`로 설정되어 있어, 같은 기업의 포지션 이벤트들은 순서가 보장된다. _(출처: [Step 3-1. Kafka Data Pipeline 아키텍처](https://wantedlab.atlassian.net/wiki/spaces/AXCP/pages/4731666743/Step+3-1.+Kafka+Data+Pipeline), 2026-03-20)_

**공고 상세 정보 분리**: `wanted_des` 테이블에는 메타 정보만 포함되고, 상세 설명(position, intro, main_tasks, requirements 등)은 `wanted_job_detail` 테이블에 언어별(ko, ja, en 등)으로 저장된다. 따라서 공고의 전체 정보 조회 시 반드시 두 테이블을 조인해야 한다. _(출처: [RDB 데이터 추출 시 주의사항](https://wantedlab.atlassian.net/wiki/spaces/DATA/pages/73564218/RDB), 2020-11-26)_

**status='active'만으로는 라이브 상태 판단 불가**: `status='active'`이더라도 `hidden=1` 또는 `confirm_time is null`이면 실제로는 유저에게 노출되지 않는다. 라이브 상태 검증 시 모든 조건을 함께 확인할 것. _(출처: [RDB 데이터 추출 시 주의사항](https://wantedlab.atlassian.net/wiki/spaces/DATA/pages/73564218/RDB), 2020-11-26)_

**히든 포지션 접근 제어**: `is_private=true` 포지션은 특정 short link 또는 query string을 통해서만 조회/지원 가능하도록 구현되어야 한다. 일반 조회 경로(domain/wd/{job_id})로는 접근 불가능해야 한다. _(출처: [(2024.02) 슈퍼탤런트: 활용 예시 및 API 설계](https://wantedlab.atlassian.net/wiki/spaces/servercircle/pages/3011969456/2024.02+API), 2024-02-19)_

**Map Server DB 동기화**: position-map-server의 PostgreSQL에 저장되는 position 데이터는 원티드 메인 소스 DB(`wanted_des` + `wanted_job_detail`)에서 Kafka 이벤트를 통해 incremental sync되며, Full Load 재구축 시 `scripts/import_companies.py`를 사용한다. 기존 메인 DB의 구조 변화 시 동기화 로직 영향도 검토 필수. _(출처: [Step 3-1. Kafka Data Pipeline 아키텍처](https://wantedlab.atlassian.net/wiki/spaces/AXCP/pages/4731666743/Step+3-1.+Kafka+Data+Pipeline), 2026-03-20)_

## 🗃️ Deprecated / Legacy

**position.category 직접 저장 (Map Server만 해당)**: position-map-server에서는 tags 키워드 매칭으로 추론된 category 값(개발, 디자인 등)을 별도 컬럼으로 저장하나, 원티드 메인 DB의 `wanted_des` 테이블에는 category 컬럼이 없다. _(출처: [Step 3-1. Kafka Data Pipeline 아키텍처](https://wantedlab.atlassian.net/wiki/spaces/AXCP/pages/4731666743/Step+3-1.+Kafka+Data+Pipeline), 2026-03-20)_

**기술태그 공고별 관리 미완성**: 현재 포지션 상세 페이지의 기술태그/툴 영역은 제거된 상태이다(VOC 해결 목적). 공고별 기술태그를 관리하는 기능은 추후 단계([0306) 공고 별 기술태그 관리] 2차~3차에서 구현 예정이며, 현재는 상위 직군 기반 관리만 가능하다. _(출처: [(0306) 공고 별 기술태그 관리 (feat. 기업/포지션 탐색)](https://wantedlab.atlassian.net/wiki/spaces/PO/pages/3023929563/0306+feat.), 2024-03-06)_

**공고 승인 자동화 진행 중**: 평일 18시~익일 9시 내 등록 공고에 대한 자동 승인 기능은 구현 예정 중이다(현재는 영업시간 내 수동 승인만 가능). _(출처: [공고 승인 자동화](https://wantedlab.atlassian.net/wiki/spaces/ops/pages/3183542273), 2024-08-06) ⏰ 확인 필요_

**포지션 데이터 모델 테이블 안정성**: 문서 작성 당시([2020-07-17](https://wantedlab.atlassian.net/wiki/spaces/servercircle/pages/638189722/model)) `wanted_des_history`는 AS-IS 상태였으며, TO-BE 변경안이 2019-06-13, 2019-08-01 논의되었으나 최종 적용 여부 미확인 상태이다. 스키마 변경 이력 확인 필수. _(출처: [RDB 데이터 추출 시 주의사항](https://wantedlab.atlassian.net/wiki/spaces/DATA/pages/73564218/RDB), 2020-11-26) ⏰ 확인 필요_

---

# 📂 company_des

# 테이블: company_des 운영 맥락

## 🔑 핵심 규칙

- **기업 승인 상태 판단**: `company_confirm=1` 또는 `confirm_time is not null`로 승인 기업 구분. 블랙기업이 되어 미승인 처리되면 `confirm_time`이 삭제됨. _(출처: [RDB 데이터 추출 시 주의사항](https://wantedlab.atlassian.net/wiki/spaces/DATA/pages/73564218/RDB), 2020-11-26)_

- **confirm_time 사용 시 레거시 처리**: 2016년 5월 10일 이전 생성된 약 150개 기업은 `confirm_time`이 없으므로, `confirm_time`으로 승인일을 기준삼을 때는 `case when company_confirm=1 and date(create_time) <= '2016-05-10' and (confirm_time is null or date(confirm_time)='0000-00-00') then date(create_time) else date(confirm_time) end`로 처리. _(출처: [RDB 데이터 추출 시 주의사항](https://wantedlab.atlassian.net/wiki/spaces/DATA/pages/73564218/RDB), 2020-11-26)_

- **기업 승인 워크플로우**: 기업 승인 요청 상태에서 (1) 기업명 및 사업자등록번호 확인 (2) 기업 데이터 연결 확인 (3) 승인하기 또는 승인거절 처리. 일치하지 않거나 사증 미첨부 시에도 단계별로 다르게 처리. _(출처: [기업 승인](https://wantedlab.atlassian.net/wiki/spaces/1inwa4mCJn4C/pages/3068952823), 2024-08-08)_

- **기업 상태 값(승인 관련)**: `REQUESTING`(가입요청), `COMPLETION`(승인완료), `REJECT`(가입거절 또는 이용정지). 운영담당자는 승인하기 또는 거절하기 중 선택 가능. _(출처: [비즈센터&원티드 통합 작업 정리](https://wantedlab.atlassian.net/wiki/spaces/CDT/pages/4302897209), 2026-02-06)_

- **기업 거절 시 사유**: 아웃소싱/헤드헌팅 운영, 지점 가입(본사 아님), 회사 정보 불일치, 이전 히스토리 서비스 이용 제한, 합격자 정보입력 지연, 수수료 입금 지연, 기타. 기타 선택 시 변경 사유를 100자 이내로 입력해야 함. _(출처: [비즈센터&원티드 통합 작업 정리](https://wantedlab.atlassian.net/wiki/spaces/CDT/pages/4302897209), 2026-02-06)_

- **기업 승인 승인 사유**: 기업 가입(기본), 재가입 요청, 미납 수수료 결제완료 기업, 기타. 기타 선택 시 사유를 100자 이내로 입력 필수. _(출처: [비즈센터&원티드 통합 작업 정리](https://wantedlab.atlassian.net/wiki/spaces/CDT/pages/4302897209), 2026-02-06)_

- **5인 미만 기업 승인 제한 검토**: 5인 미만 기업은 합격자 발생 미미하고 입금 미지급 사례가 다수이므로, 기업 승인 제한을 고려 중. _(출처: [251020 기업 회원 사기 방지 대책 및 승인 시스템 개선 검토 보고](https://wantedlab.atlassian.net/wiki/spaces/ops/pages/4150395013/251020), 2025-10-20)_

- **기업 가입 전 이용동의**: 채용당금에 대한 계약서를 모두싸인을 통해 진행. 신규 기업 온보딩 시 이용동의서 작성 유도가 핵심 업무. _(출처: [기업 가입 및 온보딩](https://wantedlab.atlassian.net/wiki/spaces/CDT/pages/3518759756), 2025-05-30)_

## ⚠️ 특이사항 / 주의

- **confirm_time 삭제 시나리오**: 블랙기업이 된 경우 기존 `confirm_time`이 삭제되므로, 데이터 정합성 검증 시 주의 필요. confirm_time 재등장 가능. _(출처: [RDB 데이터 추출 시 주의사항](https://wantedlab.atlassian.net/wiki/spaces/DATA/pages/73564218/RDB), 2020-11-26)_

- **2016년 5월 10일 이전 데이터 예외**: 약 150개 기업이 `confirm_time` 없이 `company_confirm=1`로만 승인 구분되므로, 과거 데이터 추출 시 반드시 이 기준일 고려. _(출처: [RDB 데이터 추출 시 주의사항](https://wantedlab.atlassian.net/wiki/spaces/DATA/pages/73564218/RDB), 2020-11-26)_

- **기업명 관리 주의**: `company_des` 테이블의 `name` 컬럼이 공란 많음. 기업명 조회 시 `company_detail` 테이블의 `max(name)` 사용 권장. _(출처: [RDB 데이터 추출 시 주의사항](https://wantedlab.atlassian.net/wiki/spaces/DATA/pages/73564218/RDB), 2020-11-26)_

- **기업 정보 불일치 거절**: 회사명, 사업자등록번호 등이 모두 일치해야만 승인 재검토 가능. 불일치 시 거절 메일에 재검토 조건 명시 필수. _(출처: [비즈센터&원티드 통합 작업 정리](https://wantedlab.atlassian.net/wiki/spaces/CDT/pages/4302897209), 2026-02-06)_

- **취업 사기 발생 시 4단계 대응**: (1) 공고 모두 즉시 마감 (2) 기업 승인 취소/이용 정지 (3) 지원자 명단 파악 및 안내 (4) 기업 관리자 이메일 탈퇴 처리. _(출처: [251020 기업 회원 사기 방지 대책 및 승인 시스템 개선 검토 보고](https://wantedlab.atlassian.net/wiki/spaces/ops/pages/4150395013/251020), 2025-10-20)_

- **어뷰징 관리**: 기업 이용 정지 후 회원 탈퇴하더라도 다른 기업 정보로 재가입 가능한 문제 존재. 특정 휴대폰 번호 및 이메일 가입 제한 기능 개발을 통한 원천 차단 진행 중. _(출처: [251020 기업 회원 사기 방지 대책 및 승인 시스템 개선 검토 보고](https://wantedlab.atlassian.net/wiki/spaces/ops/pages/4150395013/251020), 2025-10-20)_

- **비즈센터/채용솔루션 통합**: 기업담당자는 채용솔루션에서 기업 정보/로고 관리 가능. 비즈센터의 '회사 정보 관리' 메뉴는 숨김처리되고 채용솔루션으로 이동. _(출처: [비즈센터&원티드 통합 작업 정리](https://wantedlab.atlassian.net/wiki/spaces/CDT/pages/4302897209), 2026-02-06)_

## 🗃️ Deprecated / Legacy

- **산업군 분류 진행 중**: 현재 원티드에서 임의로 분류한 산업군을 사용 중이나, 한국 표준 산업군으로 대체하는 방안 진행 중 (DATARQ-149, DATARQ-170). _(출처: [RDB 데이터 추출 시 주의사항](https://wantedlab.atlassian.net/wiki/spaces/DATA/pages/73564218/RDB), 2020-11-26)_

---

# 📂 bookmark

# bookmark 테이블 운영 규칙 및 주의사항

## 🔑 핵심 규칙

- **북마크 → 지원 전환율 기준선**: 북마크한 공고의 12%가 실제 지원으로 이어짐. 북마크 사용자는 본인의 총 지원건 중 20%를 북마크한 공고에 지원함. _(출처: [북마크 이용 현황 및 지원과의 관계 분석 (2020.05)](https://wantedlab.atlassian.net/wiki/spaces/DATA/pages/548045091/2020.05), 2020-05-28)_

- **Tier 2 (Explorer) 분류의 필수 신호**: 관심 저장(bookmark, seeMore) 행위는 '이직 후보군(Shortlist)'을 작성하는 단계이며, 마음에 드는 공고를 저장하거나 기업의 다른 포지션을 더 보는 것은 본인에게 맞는 특정 조건이 충족되면 즉시 지원할 준비가 된 유저의 표현임. _(출처: [[MKT] 이직 의향 티어링 모델](https://wantedlab.atlassian.net/wiki/spaces/marketing/pages/4533452807/MKT), 2026-01-08)_

- **프로필 레벨별 북마크 → 지원 전환율 격차**: Lv3 북마크 유저 지원 전환율 19.5% vs Lv4 37.8% (격차 18.3%p). Lv4로 전환하면 지원율이 거의 2배 수준이며, 북마크까지 한 유저이므로 구직 의지는 높은 상태임. _(출처: [[실험 후보] 북마크 후 미지원 유저 넛지 A — Lv3 이력서 완성 유도 스낵바](https://wantedlab.atlassian.net/wiki/spaces/WAN/pages/4764926117/A+Lv3), 2026-04-17)_

- **Lv3 북마크 유저의 1시간 내 행동 패턴**: 북마크 직후 83.3%가 1시간 내 다른 포지션 상세를 조회(탐색만 반복)하고, 15.7%(2,000명)만 이력서 화면에 진입함. 북마크 직후가 이력서 완성 동기가 가장 높은 순간이나 현재 스낵바는 이 기회를 활용하지 않음. _(출처: [[실험 후보] 북마크 후 미지원 유저 넛지 A — Lv3 이력서 완성 유도 스낵바](https://wantedlab.atlassian.net/wiki/spaces/WAN/pages/4764926117/A+Lv3), 2026-04-17)_

- **포지션 상세 화면에서의 북마크 비중**: 포지션 상세에서 Lv3 유저 북마크의 97.7%(4,258건)이 발생하며, 채용홈 섹션 전체 합산은 2.3%에 불과함. _(출처: [[실험 후보] 북마크 직후 강화 토스트 넇지](https://wantedlab.atlassian.net/wiki/spaces/WAN/pages/4750803319), 2026-04-08)_

- **월 대상 유저 규모 (Lv3 + 30일 미지원 세그먼트)**: 월간 약 9,929명의 Lv3 미지원 유저가 포지션을 북마크함. _(출처: [[실험 후보] 북마크 후 미지원 유저 넛지 A — Lv3 이력서 완성 유도 스낵바](https://wantedlab.atlassian.net/wiki/spaces/WAN/pages/4764926117/A+Lv3), 2026-04-17)_

- **Lv4 북마크 유저의 미지원 규모**: Lv4 북마크 유저 중 62.2%(27,871명/월)가 지원하지 않으며, 이들은 이미 이력서가 완성된 상태이므로 이력서 미완성이 블로커가 아님. _(출처: [[실험 후보] 북마크 후 미지원 유저 넛지 B — Lv4 포지션 맞춤 이력서 코칭](https://wantedlab.atlassian.net/wiki/spaces/WAN/pages/4764500093/B+Lv4), 2026-04-17)_

## ⚠️ 특이사항 / 주의

- **북마크 ON/OFF 반복 시 스낵바 동작 규칙 (포인트 적립)**: 당일 첫 북마크는 포인트 적립 스낵바("포지션 북마크 완료! 오늘까지 100P를 적립할 수 있어요") 노출, 동일 날짜 2회 이상 북마크부터는 "북마크에 저장되었습니다" 스낵바로 전환됨. _(출처: [[실험 후보] 북마크 직후 강화 토스트 넇지](https://wantedlab.atlassian.net/wiki/spaces/WAN/pages/4750803319), 2026-04-08)_

- **북마크 해제 시 UI 동작 (Web)**: 현재 동작은 북마크 리스트에서 항목이 바로 삭제되는 방식이나, 개선된 동작은 아이콘만 Uncheck 상태로 변경하고 포지션은 리스트에 그대로 남아있다가 새로고침 또는 재진입 시 제거됨. 현재 앱은 개선 동작으로 작동함. _(출처: [Web -> 내 활동 -> 북마크 리스트 개선](https://wantedlab.atlassian.net/wiki/spaces/CX/pages/3948412938/Web+-+-), 2025-09-05)_

- **AI 이력서 코칭 퍼널의 저효율**: 코칭 시작(5,421명)에서 코칭 적용(964명)까지의 전환율이 17.8%로 매우 낮음. 코칭 시작까지의 유입은 있으나 코칭 결과를 실제 이력서에 반영하는 단계에서 82% 이탈. _(출처: [[실험 후보] 북마크 후 미지원 유저 넛지 B — Lv4 포지션 맞춤 이력서 코칭](https://wantedlab.atlassian.net/wiki/spaces/WAN/pages/4764500093/B+Lv4), 2026-04-17)_

- **기존 북마크 에이전트 스낵바의 저효율**: 월 1,162명 노출에 불과 27명만 클릭(CTR 2.3%)으로, "북마크에 저장되었습니다" 메시지는 이력서 완성이라는 다음 행동을 전혀 제안하지 않음. _(출처: [[실험 후보] 북마크 후 미지원 유저 넛지 A — Lv3 이력서 완성 유도 스낵바](https://wantedlab.atlassian.net/wiki/spaces/WAN/pages/4764926117/A+Lv3), 2026-04-17)_

- **안드로이드 앱 북마크 기능 이슈 (2025-09)**: 북마크 API 호출 시 OneId 모듈의 쿠키 정보와 로컬 캐시의 불일치로 인해 기능이 작동하지 않는 경우 발생. 로그인이 필요한 기능이므로 세션 만료 또는 쿠키 유실 상황에서 예외 처리 부재. _(출처: [[Andriod] 안드로이드 앱에서 북마크 기능 제대로 작동하지 않는 이슈 (P3)](https://wantedlab.atlassian.net/wiki/spaces/~634e1199c97f5473af6dc126/pages/3916693535/Andriod+P3), 2025-09-09)_

- **모바일 세션 만료 시나리오 미설정**: 모바일에서는 쿠키 만료 시나리오를 설정하지 않았으나, 특정 케이스에서 쿠키 만료가 발생함. 쿠키가 만료되었을 때 재로그인 로직이 없으며, API 호출 실패 시 명확한 에러 처리가 없음. _(출처: [[Andriod] 안드로이드 앱에서 북마크 기능 제대로 작동하지 않는 이슈 (P3)](https://wantedlab.atlassian.net/wiki/spaces/~634e1199c97f5473af6dc126/pages/3916693535/Andriod+P3), 2025-09-09)_

- **데이터 추출 시 시차 주의**: 북마크와 실제 지원 간의 시차가 존재할 수 있으므로, 단순 비율 해석에 주의. 2020년 분석에서 북마크 사용자 중 지원자 비중은 23%(4,264/18,396)였으나, 최근 데이터(2026-04)에서는 Lv3 전환율 19.5%, Lv4 37.8%로 변동. _(출처: [북마크 이용 현황 및 지원과의 관계 분석 (2020.05)](https://wantedlab.atlassian.net/wiki/spaces/DATA/pages/548045091/2020.05), 2020-05-28) / [[실험 후보] 북마크 후 미지원 유저 넛지 A — Lv3 이력서 완성 유도 스낵바](https://wantedlab.atlassian.net/wiki/spaces/WAN/pages/4764926117/A+Lv3), 2026-04-17)_

- **북마크 횟수와 지원 수의 양적 선형관계**: 북마크 횟수(1~30회)와 평균 지원수 간의 상관계수 0.45로 뚜렷한 양적 관계를 보임. 북마크를 활용하는 유저일수록 지원 활동이 활발함. _(출처: [북마크 이용 현황 및 지원과의 관계 분석 (2020.05)](https://wantedlab.atlassian.net/wiki/spaces/DATA/pages/548045091/2020.05), 2020-05-28) ⏰ 확인 필요_

## 🗃️ Deprecated / Legacy

_(해당 내용 없음)_

---

# 📂 matching_score

# 🔑 핵심 규칙

**AI 점수 계산 대상 조건 (unable 상태 판정)**: 다음 5가지 모두 충족하지 않으면 `score_status = unable`으로 반환된다. (1) 프로필 레벨 존재 (2) 프로필 레벨 >= 3 (3) AI 점수 판별 가능한 이력서 존재 (4) 이력서 글자수 > 0 (5) 이력서 글자수 >= 200자. _(출처: [원티드 AI 합격 예측 점수 — 동작 방식 정리](https://wantedlab.atlassian.net/wiki/spaces/~761091357/pages/4740513896/AI), 2026-04-03)_

**점수 구간 등급 기준 (프론트 렌더링)**: 점수 0~1을 퍼센트로 변환하며, 등급은 (매우높음: 86~99%, 초록색) / (높음: 71~85%, 파란색) / (평균이상: 51~70%, 보라색) / (평균미만: ~50%, 미표시)로 구분한다. score가 0이거나 null이면 등급 판정 전에 "분석실패"로 처리. _(출처: [원티드 AI 합격 예측 점수 — 동작 방식 정리](https://wantedlab.atlassian.net/wiki/spaces/~761091357/pages/4740513896/AI), 2026-04-03)_

**추천 포지션 필터링 기준**: AI 점수 조회 시 `pass_score >= 0.5`인 점수만 우선 후보로 사용한다. _(출처: [14-합격률-AI점수](https://wantedlab.atlassian.net/wiki/spaces/~740533987/pages/4764925991/14-+-AI), 2026-04-10)_

**연차 적합성 판정 범위**: annual_difference(유저 연차 - 공고 요구 연차 범위의 중점)가 -1년 이상 ~ +2년 이하이면 "비교적 적합" 판정. -2년 초과 또는 +3년 이상이면 부적합. _(출처: [원티드 AI 합격 예측 점수 — 동작 방식 정리](https://wantedlab.atlassian.net/wiki/spaces/~761091357/pages/4740513896/AI), 2026-04-03)_

**매칭 점수 재계산 트리거**: (1) 이력서 업데이트 (2) 로그인 (matching_score.expire_time 이후 JD 업데이트 가능성) (3) 동기 호출: 합격예측 포지션 찾기, 지원 후 동시지원, 포지션 진입 시 점수 없음 (4) 비동기 호출: 그 외 (예: 채용 탭 AI 추천). 같은 포지션에 점수 row가 이미 있으면 재계산하지 않음. 48시간 경과한 score는 재계산. _(출처: [서류 통과 예측 모델 개선](https://wantedlab.atlassian.net/wiki/spaces/ML/pages/2572910694), 2024-05-10)_

**점수 캐싱 정책**: 모델 업데이트 이후 원티드 서비스에서 최대 48시간동안 캐싱된 데이터가 유지되어, 그 기간 유저에게 노출되는 score가 기존/신규 모델이 섞일 수 있음. _(출처: [서류 통과 예측 모델 개선](https://wantedlab.atlassian.net/wiki/spaces/ML/pages/2572910694), 2024-05-10)_

**매칭 요청 계산 대상 필터**: 한국 유저이면서 프로필 레벨 >= 3인 경우만 대상. 기존 계산이 있으면 3시간 이내 재계산 제외 (테스트 환경: 3분). _(출처: [/api/chaos/users/v1/matching-request](https://wantedlab.atlassian.net/wiki/spaces/platform/pages/3014885419/api+chaos+users+v1+matching-request), 2024-02-15)_

**dirty 플래그 처리**: matching_request_status.dirty = true인 경우 이전 계산에 문제 발생을 의미하며, 강제로 dirty를 false로 수정하고 matching_score를 초기화. _(출처: [/api/chaos/users/v1/matching-request](https://wantedlab.atlassian.net/wiki/spaces/platform/pages/3014885419/api+chaos+users+v1+matching-request), 2024-02-15)_

**레거시 API 호환성**: matching_score API는 실제로는 ai_score 테이블을 읽으며, MatchingScoreService는 이름만 유지한 호환 계층. _(출처: [14-합격률-AI점수](https://wantedlab.atlassian.net/wiki/spaces/~740533987/pages/4764925991/14-+-AI), 2026-04-10)_

**직무 적합성 판정**: 공고의 category_tag(직군/직무)와 유저 프로필/이력서의 직무 태그를 서버에서 비교해 is_user_fit_job (true/false)를 반환. _(출처: [원티드 AI 합격 예측 점수 — 동작 방식 정리](https://wantedlab.atlassian.net/wiki/spaces/~761091357/pages/4740513896/AI), 2026-04-03)_

# ⚠️ 특이사항 / 주의

**AI 점수 미보유 현황**: 전체 지원의 45%에서 ai_score가 없음. 점수 있는 지원 816,326건 / 전체 1,520,479건 (53.69% 비율). _(출처: [AI 매칭 점수(ai_score)와 실제 합격률의 관계](https://wantedlab.atlassian.net/wiki/spaces/DATA/pages/4776460442/2026-03-23+AI+ai_score), 2026-03-23)_

**프로필 레벨별 건당 합격률 역설**: lv3 유저의 건당 서류합격률(4.92%)이 lv4(4.48%)보다 오히려 높다. lv4의 가치는 "이력서 품질 향상"이 아닌 "지원 활성화(양)의 확대" — 5.2배 더 많은 채용은 4.9배 많은 유저 + 35% 더 많은 지원 때문. _(출처: [2026-04-14] 프로필 lv3 vs lv4 — 합격률은 lv3이 높고, lv4의 무기는 양이다](https://wantedlab.atlassian.net/wiki/spaces/DATA/pages/4767809608/2026-04-14+lv3+vs+lv4+lv3+lv4), 2026-04-14)_

**원티드 이력서 vs 비원티드 이력서 역전**: 2023년 상반기까지는 원티드 이력서 사용자의 서류 통과율이 높았으나, 2023년 하반기부터 비원티드 이력서 사용자의 서류 통과율이 높아짐. 원티드 이력서 사용이 모델 추천 관리 효과에 대해 마이너스 효과를 내고 있는 것으로 보임. _(출처: [서류 통과 예측 모델 추천 효과 분석](https://wantedlab.atlassian.net/wiki/spaces/ML/pages/3174302470), 2024-07-22)_

**모델 성능 평가 기간 지연**: 모델 업데이트 이후 서류 통과 결과가 뒤늦게 기록되기 때문에 실제 성능 변화를 측정할 수 없음. 최대 3개월까지 서류 통과 데이터가 변동될 수 있음. _(출처: [서류 통과 예측 모델 개선](https://wantedlab.atlassian.net/wiki/spaces/ML/pages/2572910694), 2024-05-10)_

**AI 점수 노출 대상 제약**: 비원티드 이력서 사용자에게는 AI 점수가 제공되지 않음. 원티드 이력서 사용자라도 프로필 레벨이 낮으면(이력서 200자 이하 등) 점수 계산이 되지 않음. _(출처: [서류 통과 예측 모델 추천 효과 분석](https://wantedlab.atlassian.net/wiki/spaces/ML/pages/3174302470), 2024-07-22)_

**점수 미보유 사유 파악 미흡**: ai_score 유무(45% 없음)의 원인(어떤 지원에 점수가 없는가?)이 명확히 정의되지 않음. _(출처: [AI 매칭 점수(ai_score)와 실제 합격률의 관계](https://wantedlab.atlassian.net/wiki/spaces/DATA/pages/4776460442/2026-03-23+AI+ai_score), 2026-03-23)_

**프로필 레벨 스냅샷 편향**: 프로필 레벨은 현재 시점 스냅샷이므로, 지원 시점의 레벨과 다를 수 있음(생존자 편향 가능). _(출처: [2026-04-14] 프로필 lv3 vs lv4 — 합격률은 lv3이 높고, lv4의 무기는 양이다](https://wantedlab.atlassian.net/wiki/spaces/DATA/pages/4767809608/2026-04-14+lv3+vs+lv4+lv3+lv4), 2026-04-14)_

**AI 점수 노출 효과 측정 한계**: 합격 예측 점수를 본 유저 vs 보지 않은 유저의 구분이 어려움. 편의상 AI 점수 노출 대상을 AI 점수를 사용한 유저로 간주하는 프록시 사용 중. _(출처: [서류 통과 예측 모델 개선](https://wantedlab.atlassian.net/wiki/spaces/ML/pages/2572910694), 2024-05-10)_

# 🗃️ Deprecated / Legacy

**matching_score 테이블 명칭**: 레거시 명칭 유지용. 실제 데이터는 ai_score 테이블에 적재되며, MatchingScoreService는 호환 계층만 담당. _(출처: [14-합격률-AI점수](https://wantedlab.atlassian.net/wiki/spaces/~740533987/pages/4764925991/14-+-AI), 2026-04-10)_

**VDCNN 모델**: 2020년 12월 ~ 2022년 5월 사용. F1-score 0.7로 공시되었으나 훈련 및 검증 데이터에 문제 발견. 모델이 "치팅"할 수 있는 피처가 있어 성능 수치 과대 측정됨. 2022년 5월부터 Transformer 기반 모델(AUC 0.65)로 업데이트. _(출처: [서류 통과 모델 성능 오류 히스토리](https://wantedlab.atlassian.net/wiki/spaces/ML/pages/3473801390), 2025-04-23)_

**ALBERT 모델**: 2022년 5월 ~ 2023년 6월 사용. 2022년 10월 ACC(정확도) 기준 모델로 변경 (AUC 기반에서 AI Pass Precision 기준으로 전환). 2023년 6월 RoBERTa small으로 교체. _(출처: [서류 통과 예측 모델 개선](https://wantedlab.atlassian.net/wiki/spaces/ML/pages/2572910694), 2024-05-10)_

**F1-Score 성능 지표**: 2022년 10월까지 사용, 2023년 7월 이후 AUC로 원복. 서류 통과가 90~95%의 편향적 불합격 분포를 가져 정확도(Accuracy) 지표는 부적절하며, AI Pass Precision(서류 통과 예측 정확도)이 매출과 더 연관성 높음으로 판단. _(출처: [서류 통과 예측 모델 개선](https://wantedlab.atlassian.net/wiki/spaces/ML/pages/2572910694), 2024-05-10)_

---
