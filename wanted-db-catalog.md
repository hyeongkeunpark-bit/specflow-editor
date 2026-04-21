# 원티드 데이터 카탈로그 (자동 생성)

출처: `첨부/데이터 카탈로그 - 테이블.csv` + `첨부/데이터 카탈로그 - 컬럼.csv`
생성 방식: `node scripts/build-db-catalog.mjs`

- 전체 테이블 수: **301**
- 전체 컬럼 수: **2082**
- 특이사항 있는 테이블: **26** (핵심 운영 맥락)

## 데이터셋 개요

| 데이터셋 | 테이블 수 | 주요 분류 |
|---|---|---|
| `wanteddb` | 46 | - |
| `query_results_privacy` | 43 | 채용, 커리어, 교육, 긱스 |
| `wanted_gigs` | 40 | - |
| `analytics_mart` | 33 | 채용, 커리어 |
| `query_results` | 32 | 채용 |
| `wanted_stats` | 29 | 채용, 교육 |
| `kj_new` | 19 | 채용 |
| `audit` | 12 | - |
| `oneid` | 10 | - |
| `wantedspace_mart` | 7 | 원스 |
| `amplitude` | 5 | - |
| `bi_dashboard` | 5 | - |
| `wanted_cdc` | 5 | - |
| `appsflyer` | 3 | - |
| `kreditjob_mart` | 2 | 채용 |
| `wanted_ml` | 2 | - |
| `wanted_mongo` | 2 | - |
| `weaver` | 2 | - |
| `external` | 1 | - |
| `kjdb` | 1 | - |
| `wanted_logs` | 1 | - |
| `wanteddb_sns` | 1 | - |

---

## 📦 `wanteddb` (46개 테이블)

### `ai_score_feedback` 

**설명:** 포지션 상세페이지에 있는 ai 서류합격점수에 대한 구직자의 피드백 (i버튼 누르면 피드백 주는 팝업 뜸)

_owner: 성여운(Yeouhn Sung)_

### `application_memo` 

**설명:** 기업 대시보드에서 지원서에 작성된 댓글 (검토의견, 메모)

_owner: 유지윤 (Jiyoon You)_

### `apply` 

**설명:** 지원 로그. apply_id가 distinct하다.

_owner: 성여운(Yeouhn Sung)_

<details><summary>컬럼 42개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `email` | 지원자 email | email |
| `recommender_email` | 지원자의 추천인 이메일. | email |
| `name` | 지원 당시 지원자 이름. | name |
| `mobile` | 지원자 번호 | phone number |
| `type` | 0: 일반지원, 400: 매치업 선과금, 600: 매치업 무제한, 800: 외부지원 (컨플: https://wantedlab.atlassian.net/wiki/spaces/servercircle/pages/2530279468/apply+status) |  |
| `wd_id` | 공고 ID; wanted_des.id |  |
| `company_id` | 기업 ID; company_des.id |  |
| `open_time` | 기업관리자 > 지원서 최초 조회시간 |  |
| `company_name` | 기업명 |  |
| `chk_time` | 기업에 지원서 전달 접수시간 |  |
| `dinger_id` | 딩 버튼 누른 담당자 ID; user.id |  |
| `status_reward` | 보상금 신청상태 |  |
| `reject_message` | 불합격 메세지 |  |
| `rejector_id` | 불합격 통보 담당자 ID; user.id |  |
| `reject_time` | 서류 / 면접 탈락시간 |  |
| `passer_id` | 서류통과 담당자 ID; user.id |  |
| `pass_time` | 서류통과시간. 숨합, 외부ATS 합격건(나인하이어, 그리팅)은 pass_time이 null이다. |  |
| `rating` | 원티드 내부 평가 |  |
| `resume_ok` | 이력서 첨부 여부;        NULL, 0, 1 존재 / 1이 가장 많음 |  |
| `auto_reject_time` | 자동거절시간; 기간만료 후 최종 탈락처리 시 |  |
| `is_auto` | 자동전송여부 |  |
| `sender_id` | 전송 버튼 누른 담당자 ID; user.id |  |
| `created_time` | 지원 생성시간 |  |
| `position` | 지원 포지션 |  |
| `status` | 지원서 상태; 유저발 apply값: status < 100, 매치업(기업이 유저에게 제안하는거) 상태값: status >= 100. 이 컬럼의 값은 덮어쓰기되며, 보통 작은숫자에서 큰 숫자로 간다. 기업이 유저를 열람했을 경우엔 100이었다가, 제안을 하면 101이 된다. 고로 열람된 건 중 제안받은 건의 비율을 구하고 싶으면 (status=101인것)/(status=100인것)이 아니라 (status >=101인것)/(status>=100인것)와 같이 계산해야 한다. 값 설명 컨플: https://wantedlab.atlassian.net/wiki/spaces/servercircle/pages/2530279468/apply+status 1: WRITE(지원서 작성 시작) 2: COMPLETE(지원서 제출 완료 상태) 5: SEND (원티드에서 회사쪽에 보낸 이후) 3: REJECT (회사에서 서류 거른 경우)  6: PASS (서류통과하고 면접 단계로 간 경우)  10: OVERDUE (원티드에서 회사쪽에 보낸 이후 한달동안 응답이 없는 경우 기간만료)  9: PASS_REJECT (서류통과하고 면접 봤는데 떨어진 경우 (pass_time이 NULL인지 아닌지로 판단하자)  8: HIRE (최종합격)  100: PROPOSAL_OPEN (열람)  101: PROPOSAL_OFFER (제안)  103: PROPOSAL_USER_CHECK (유저 제안 확인)  104: PROPOSAL_USER_ACCEPT (유저 제안 수락)  106: PROPOSAL_USER_REJECT (유저 제안 거절 (현재 없음)) 107: PROPOSAL_USER_EXPIRED_REJECT (유저 기간 만료 거절)  108: PROPOSAL_INTERVIEW_REJECT (면접 후 거절)  109: PROPOSAL_HIRE (채용) |  |
| `apply_time` | 지원서 제출시간; 처음 '지원하기'를 누를 때 apply_time이 기록되고 실제 지원을 하였을 때 지원시점의 apply_time으로 업데이트, 또는 매치업에서 기업이 이력서를 'OPEN'한 시간 |  |
| `user_id` | 지원자 ID; user.id |  |
| `cancel_reason` | 지원취소사유 |  |
| `cancel_time` | 지원취소시간 |  |
| `edited_time` | 최종 수정시간 |  |
| `resume_time` | 최종 이력서 업로드 시간 |  |
| `hirer_id` | 최종채용 담당자 ID; user.id |  |
| `recommendation` | 추천사 내용 |  |
| `recommendation_ok` | 추천사 여부 |  |
| `recommendation_time` | 추천사 작성시간 |  |
| `recommender_id` | 추천인 ID; user.id |  |
| `feedback_time` | 피드백 요청시간 |  |
| `hire_time` | 합격시간, wanteddb.hiring 테이블에 delete_time is null인 건의 create_time 이 더 정확함 |  |
| `score` | AI점수. apply.score =matching_score.score |  |
| `ding_mail_scheduled_time` | ding 메일 발송 예정 시간 |  |
| `id` | PK; 지원서 ID |  |
| `source` | openAPI를 통해서 지원(ex. 혁신의 숲) 한 경우, 난수값으로 추가됨 |  |

</details>

### `apply_source` 

**설명:** 지원시, 어디에서 포지션을 보고 지원했는지 입력하는 값 테이블(에이전트발 지원도 포함)
source 컬럼으로 구분, /dashboard/recruitment페이지에서 '지원경로' 선택박스 데이터

_owner: 최자연 (Jayeon Choi)_

### `attraction_tag_company_relation` 

**설명:** 매력 태그와 기업 간의 관계를 정의한 테이블
https://wantedlab.atlassian.net/wiki/spaces/servercircle/pages/3060957455/2024-04+HQ+1+2-1#attraction_tag_company_relation

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 3개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `company_id` | 해당 매력테그를 연결할 기업의 ID |  |
| `source` | 매력태그와 기업을 매핑 하게 된 소스 - HQ (수동매핑, HQ 관리자가 수동으로 매핑) - company_des (자동 매핑/ 기업 상세에서 키워드 추출) - wanted_des (자동 매핑 / 포지션 상세에서 키워드 추출) - insight(인사이트 정보 업데이트로 생성되는 맵핑) |  |
| `source_id` | 소스를 기반으로 연결 주체/대상의 ID - HQ <--- 기업과 매력태그를 매핑시킨 User의 ID - company_des <--- 매력태그명이나 키워드가 들어있던 company 상세의 ID - wanted_des <--- 매력태그명이나 키워드가 들어있던wanted_des의 ID |  |

</details>

### `attraction_tag_detail` 

**설명:** 매력 태그의 상세 정보를 담은 테이블 (인기 태그 여부 정보가 seq로 표현됨)
https://wantedlab.atlassian.net/wiki/spaces/servercircle/pages/3060957455/2024-04+HQ+1+2-1#attraction_tag_detail

_owner: 최자연 (Jayeon Choi)_

### `attraction_tag_keyword_mapping` 

**설명:** 기업/포지션에서 키워드를 추출해 자동으로 특정 매력 태그에 매핑할 키워드를 정의한 테이블
https://wantedlab.atlassian.net/wiki/spaces/servercircle/pages/3060957455/2024-04+HQ+1+2-1#attraction_tag_keyword_mapping

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 1개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `keyword` | 해당 매력 태그에 매핑할 키워드 ex. 재택, 탄력근무제, 자율근무제, 시차출퇴근제 |  |

</details>

### `auto_proposal_position_setting` 

**설명:** 포지션별 자동면접제안 기능 세팅 status

_owner: 이상인 (Lee Sangin)_

### `blocking_attraction_tag_mapping` 

**설명:** 특정 기업의 포지션과 특정 매력태그가 매핑되지 않도록 블로킹 리스트를 기록하는 테이블
https://wantedlab.atlassian.net/wiki/spaces/servercircle/pages/3060957455/2024-04+HQ+1+2-1#blocking_attraction_tag_mapping

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 2개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `keyword` | 블로킹 대상 키워드(편의를 위해 candidate값 추가) |  |
| `position_id` | 블로킹 한 포지션 ID |  |

</details>

### `bookmark` 

**설명:** 유저가 포지션 북마크한 로그

_owner: 성여운(Yeouhn Sung)_

### `certificated_user_career` 

**설명:** 경력인증 시 certificated_user_caereer 테이블에 인증한 이력들이 무조건 쌓입니다. 이 중 유저가 이력서에 이력을 선택하여 추가한 경우에만 user_career 테이블에 certificated_user_career_id 값이 추가됩니다.

_owner: 성여운(Yeouhn Sung)_

### `company_contract` 

**설명:** 기업 계약서

<details><summary>컬럼 3개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `status` | 계약서 상태값 (SIGNED, CONFIRM, INITIATE, IN_REVIEW, SIGN_REJECT, ADMIN_REJECT, SIGN_REQUEST 존재) |  |
| `company_id` | 기업ID |  |
| `id` | PK |  |

</details>

### `company_role` 

**설명:** 기업 관리자, 인사담당자(인담자)

_owner: 성여운(Yeouhn Sung)_

<details><summary>컬럼 2개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `create_time` | wanteddb.user.create_time과 다른 경우가 있는 걸로 보아 권한이 부여된 시점인듯 |  |
| `email` | 기업관리자로 초대받은 이메일. 현재 관리자인 email과는 다를 수 있다. 현재 관리자의 email은 company_role.user_id = user.id로 join해서 user.email을 볼 것. |  |

</details>

### `dormant_user` 

**설명:** 유저 휴면로그

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 9개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `password` | 휴면 사용자 계정 비밀번호/인증정보. | account |
| `custom_password` | 휴면 사용자 계정의 커스텀 비밀번호/인증정보. | account |
| `email` | 휴면 사용자 이메일. | email |
| `fb_name` | 휴면 사용자의 Facebook 이름 계열 값. | name |
| `mobile` | 휴면 사용자 휴대전화 번호. | phone number |
| `status` | 활성유저 유무; 0: 활성유저 (또는 dormant_user에 값없음, user.status = 1), 1: 휴면유저(user.status = 2) |  |
| `create_time` | 휴면전환된 시간; 2018년 8월 - 2019년 9월까지 버그이슈로 휴면전환된 유저 거의 없음 (버그 수정시 2019-11-14에 두번 휴면전환된 유저가 45명 존재) |  |
| `rollback_time` | 휴면해제된 시간 |  |
| `id` | PK |  |

</details>

### `event` 

**설명:** 이벤트 정보

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 20개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `payment_type` | 결제타입; regular: 정기결제, wanted: 유료, free: 유료 |  |
| `visible` | 노출여부 |  |
| `closed` | 닫힘 여부; 0: 닫힘, 1: 열림 |  |
| `create_time` | 생성 일시 |  |
| `detail_profile` | 신청 시 Lv3+ 프로필 필수 여부 |  |
| `is_online` | 온라인 여부 |  |
| `resume_option` | 이력서 첨부 필수 여부 |  |
| `product_new_id` | 이벤트 가격 조회시 product_new.id와 join |  |
| `country` | 이벤트 국가 |  |
| `end_time` | 이벤트 마감 일시 |  |
| `kind` | 이벤트 상세 페이지 양식; full_image: 통이미지, editor: 데이터형 |  |
| `description` | 이벤트 설명 |  |
| `start_time` | 이벤트 시작 일시;  ⁕ start_time IS NULL && end_time IS NULL → '상시' ⁕ end_time IS NULL ( && start_time IS NOT NULL) → start_time 이 이벤트 닫히는 날짜 ⁕ start_time IS NOT NULL && end_time IS NOT NULL → start_time ~ end_time 사이에 열려있는 이벤트 |  |
| `where` | 이벤트 위치 |  |
| `label` | 이벤트 유형 |  |
| `title` | 이벤트 제목 |  |
| `key` | 이벤트 key; /events/{} |  |
| `limit` | 참여제한 인원 수 |  |
| `id` | PK; 이벤트 ID |  |
| `product_id` | product_new_id가 더 정확함 |  |

</details>

### `event_registration` 

**설명:** 이벤트 신청정보

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 7개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `email` | 이벤트 신청자 이메일. | email |
| `status` | 결제완료 상태; pre_paid: 결제 프로세스는 시작했으나 결제 완료 정보를 받지 못한 경우 (KR외, PayPal 사용하는 경우에만 해당), complete: 결제 완료 = 신청 완료 |  |
| `create_time` | 생성시간 |  |
| `user_id` | 유저 ID |  |
| `event_id` | 이벤트 ID |  |
| `order_id` | order.id |  |
| `id` | PK; 이벤트 신청 ID |  |

</details>

### `external_job` 

**설명:** 외부공고(채용공고 상세 하단에 있는 크롤링해 온 공고) 리스트. 외부공고 하나당 id 하나.

_owner: 성여운(Yeouhn Sung)_

<details><summary>컬럼 1개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `id` | 외부채용공고 하나당 id 하나 부여됨. external_job.id = external_job_tag_type_relation.external_job_id |  |

</details>

### `external_job_tag_type_relation` 

**설명:** 외부공고의 직군, 직무 정보. external_job.id = external_job_tag_type_relation.external_job_id

_owner: 성여운(Yeouhn Sung)_

<details><summary>컬럼 1개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `id` | 외부채용공고의 직군, 직무 구할때 쓰세요. external_job.id = external_job_tag_type_relation.external_job_id |  |

</details>

### `hiring` 

**설명:** 유저 합격 히스토리 테이블

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 6개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `create_time` | 백도어 합격처리 등록시간 |  |
| `delete_time` | 백도어 합격처리 삭제시간 |  |
| `apply_id` | 지원 ID; apply.id |  |
| `hiring_product_type` | 채용 유형; |  |
| `hiring_date` | not null값이 백도어에 나타남; apply.hire_time |  |
| `id` | PK; 합격 히스토리 ID |  |

</details>

### `hiring_processing` 

**설명:** 채용 후 진행사항

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 17개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `is_taxation` | 1: 과세, 0: 면세 |  |
| `hiring_fee_billing` | 계산서 발행; 1: 발행완료 |  |
| `company_response` | 기업응답 |  |
| `salary` | 연봉 |  |
| `user_response` | 유저응답 |  |
| `hiring_fee` | 의뢰액 |  |
| `invoice_publish` | 인보이스 발행; 1: 발행완료 |  |
| `hiring_fee_deposit_check` | 입금 확인; 1: 확인완료 |  |
| `processing_state` | 진행상태; |  |
| `is_resigned_hiring` | 채용 후 환불처리 유무; 1: HQ에서 '퇴사확인' |  |
| `hiring_report_type` | 채용신고유형 |  |
| `discount_amount` | 할인 |  |
| `final_fee` | 할인 반영된 최종 청구액 |  |
| `refund_billing` | 환불계산서 발행; 1: 발행완료 |  |
| `refund_state` | 환불상태 |  |
| `refund_price` | 환불액 |  |
| `id` | PK; 채용 절차 ID |  |

</details>

### `hiring_processing_dates` 

**설명:** 채용 프로세스 로그

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 7개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `update_time` | 로그 업데이트 시간 |  |
| `create_time` | 로그시간 |  |
| `type` | 채사팀이 입사일을 수정했다면 type = company_join. 수정후 입사일은 date_time_value 보세요 |  |
| `delete_time` | 합격자 삭제하면 요 컬럼에 값 존재. |  |
| `datetime_value` | 해당 type의 datetime value |  |
| `hiring_id` | hiring.id |  |
| `id` | PK; hire_processing.id |  |

</details>

### `i18n` 

**설명:** i18n.key = translation.i18n_key 와 같이 각 테이블의 i18n_key와 조인해서 사용

_owner: 성여운(Yeouhn Sung)_

### `interview` 

**설명:** 인터뷰 관련 테이블 (2019-11까지 사용)

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 3개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `start_time` | 수락한 인터뷰 시작시간. NULL : 인터뷰 수락전 |  |
| `end_time` | 수락한 인터뷰 종료시간 |  |
| `id` | PK; interview_request.interviewer_id |  |

</details>

### `interview_request` 

**설명:** 기업의 인터뷰 요청 관련 테이블 (2019-11까지 사용)

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 3개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `start` | 요청한 인터뷰 시작시간 |  |
| `end` | 요청한 인터뷰 종료시간 |  |
| `interview_id` | interview.id |  |

</details>

### `matching_history` 

**설명:** 매치업 회사 & 유저 액션 히스토리 테이블

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 8개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `type` | 액션 타입 (LIKE: 찜하기, OPEN: 열람, OFFER: 제안, USER_ACCEPT: 제안 수락) |  |
| `actor_id` | 액션 행위자 ID; user.id; type ='USER_BLOCK' 일 경우 회사를 BLOCK한 user ID, 그 외에는 기업 담당자 ID |  |
| `updated_time` | 업데이트 시간 |  |
| `target_apply_id` | 지원 ID; apply.id, 동일한 열람~제안~제안수락 건인지 보려면 이 컬럼을 키로 조인하면 됨 |  |
| `created_time` | 최초생성시간 |  |
| `company_id` | 회사 ID; company_des.id |  |
| `target_user_id` | action target 유저 ID; user.id |  |
| `id` | PK; 매치업 회사&유저 action history ID |  |

</details>

### `proposal` 

**설명:** 매치업 제안

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 1개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `id` | PK; 매치업 제안 ID |  |

</details>

### `proposal_response` 

**설명:** 매치업 제안 응답

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 4개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `proposal_id` | 매치업 제안 ID; proposal.id |  |
| `id` | PK; 매치업 제안 응답 ID |  |
| `response_type` | 제안 응답 타입 (HIRE_ANOTHER_COMPANY, NOT_INTEREST_CATEGORY, NOT_INTEREST_WORKING_CONDITIONS, NO_JOB_SEARCH_INTENTION, REJECT_CUSTOM_MESSAGE, USER_DIRECTLY_APPLIED) 참고: https://wantedlab.atlassian.net/wiki/spaces/WAN/pages/3406430282/-#%EB%A9%B4%EC%A0%91-%EC%A0%9C%EC%95%88-%EA%B1%B0%EC%A0%88-%EC%82%AC%EC%9C%A0-%3A-%EC%84%A0%ED%83%9D%ED%95%9C-%EC%82%AC%EC%9C%A0-(2024%EB%85%84%EB%8F%84-%EC%A0%84%EC%B2%B4) |  |
| `message` | 제안 응답 메시지 (REJECT_CUSTOM_MESSAGE 일 경우에만 전달) |  |

</details>

### `recommendation_click` 

**설명:** where action = 'like' 하면 유저가 공고를 좋아요 한 로그가 나옴

_owner: 성여운(Yeouhn Sung)_

### `resume` 

**설명:** 이력서 (원티드 + 비원티드). where is_matching=1 and delete_time is null로 해도 user_id당 다수개가 나온다. 이럴 땐 제일 마지막에 생성된 이력서를 매치업에서 노출하고 있다.

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 6개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `character_count` | 글자수 (wanted_resume, docx, pdf); 공백, 개행, 템플릿 글자 수 포함 |  |
| `is_matching` | 매치업을 사용하는 인담자에게 보이는 이력서 여부. 유저1인당 1개만 있음. |  |
| `is_default` | 안 쓰는 컬럼. 예전엔 '기본이력서'라는 게 있었는데, 이젠 'is_matching'컬러밍 대신함. |  |
| `content_type` | 용량 (단위: byte) |  |
| `is_profile` | 이력서 GNB 클릭하면 보이는 모든 이력서 여부 |  |
| `id` | PK; 이력서 ID |  |

</details>

### `resume_score` 

**설명:** AI 합격 예측에 업로드한 이력서 & 점수

_owner: 최자연 (Jayeon Choi)_

### `sms` 

**설명:** sms 전송 내역 테이블

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 1개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `to_mobile` | 수신번호 | phone number |

</details>

### `tag` 

**설명:** 포지션, 기업 유저, 스킬등과 연결된 모든 태그

_owner: 최종원 Jongwon Choi_

<details><summary>컬럼 7개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `create_time` | 생성 시간 |  |
| `id` | 태그 고유 아이디 태그 성격을 나타내지는 않아서 조인에 거의 쓰이지 않음 |  |
| `taggable_id` | 태그를 받는 대상(스킬, 포지션, 유저 등)에 대한 아이디 |  |
| `taggable_type` | 태그를 받는 대상(스킬, 포지션, 유저 등)에 대한 이름 |  |
| `tag_type_id` | tag_type.id 와 조인되는 키 |  |
| `kind` | tag_type.kind 복제 데이터 |  |
| `candidate` | tag_type.title 복제 데이터 데이터가 다를 수 있어서 tag_type.title 사용 권장 |  |

</details>

### `tag_category` 

**설명:** 태그를 위한 카테고리 정보를 저장하는 테이블
https://wantedlab.atlassian.net/wiki/spaces/servercircle/pages/3060957455/2024-04+HQ+1+2-1#tag_category

_owner: 최자연 (Jayeon Choi)_

### `tag_category_tag_type_relation` 

**설명:** 태그의 카테고리와 그에 속한 매력 태그와의 관계를 정의하는 테이블
https://wantedlab.atlassian.net/wiki/spaces/servercircle/pages/3060957455/2024-04+HQ+1+2-1#tag_category_tag_type_relation

_owner: 최자연 (Jayeon Choi)_

### `tag_type` 

**설명:** 원티드 내에서 사용하는 모든 태그에 대한 정보(매력태그 포함)

_owner: 최종원 Jongwon Choi_

<details><summary>컬럼 7개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `is_visible` | 노출여부 |  |
| `slug` | 타 언어를 영어로 수월하게 변경하기 위해 자동 생성된 slug 보통 발음 그대로를 옮김 |  |
| `id` | 태그 성격을 나타내는 아이디 태그를 사용한다면 반드시 조인해야 하는 데이터 |  |
| `title` | 태그 성격을 나타내는 이름 대표 언어만 나타나기 때문에 같은 태그를 다른 국가의 언어로 보려면 translation 테이블과 조인해야 한다 |  |
| `parent_id` | 해당 태그의 상위 카테고리를 나타내는 태그 아이디 (개발이라면 상위 카테고리인 IT 산업군을 나타냄) |  |
| `kind` | skill = 0 category = 1 industry = 2 district = 3 language = 4 eduction = 5 company_management = 6 new_industry = 7 user_universal = 8 event = 9 event_keyword = 11 onboarding= = 12 curation = 13 매력태그 = 19 personality = 401 manual_send_reason = 402 |  |
| `i18n_key` | translation 테이블과 조인하기 위한 번역 키 |  |

</details>

### `translation` 

**설명:** 원티드에서 사용하는 모든 백엔드 번역 데이터
프론트 번역 데이터의 경우 Lokalise 사용

_owner: 최종원 Jongwon Choi_

<details><summary>컬럼 4개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `id` | 번역 관련 고유 아이디 조인에 쓰이는 경우 거의 없음 |  |
| `lang` | 번역 대상 언어 |  |
| `text` | 번역 된 텍스트 |  |
| `i18n_key` | 주로 tag 테이블 등의 조인에 쓰이는 고유 번역 키 |  |

</details>

### `user` 

**설명:** 채용서비스 가입 유저 (구직자, 인담자 둘 다) 에 대한 정보. id 가 user_id다.

_owner: 성여운(Yeouhn Sung)_

<details><summary>컬럼 21개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `email` | 유저 e-mail | email |
| `last_ip` | 최종 접속 ip | ip |
| `fb_name` | 유저 성명 | name |
| `mobile` | 국제지역번호 포함 (ex. +821012345678) ,번호 체계가 정형화 되어 있지 않음(하이픈, 띄어쓰기 유무) | phone number |
| `annual` | 경력 년수(년); 시간경과에 따라 자동 업데이트 되는 정보 아님 |  |
| `country_number` | 국제지역번호 |  |
| `last_login_time` | 마지막 로그인 시간; 수동로그인이던, 자동로그인(자동 로그인 설정 후 웹/앱 접속)이던 서버에 로그인 절차가 있기 때문에 무조건 갱신됨 |  |
| `accept_terms_of_service` | 서비스 이용 약관 동의; 개인회원, 기업회원, 개인정보 취급방침 구분 X, 다른 변수에 종속되어 있는 변수인지 확인 필요 |  |
| `password` | 암호화된 패스워드 |  |
| `fb_id` | 유저 계정 ID; 숫자형태의 ID / 일반 계정 및 페이스북 계정 모두 포함 |  |
| `lang` | 유저 설정 언어; 22/11/24 SPOTLIGHT 배포로 원티드 글로벌 (wanted.jobs)에 접속한 유저는 SPOTLIGHT DB로 이동 |  |
| `create_time` | 유저 ID 생성 시간 |  |
| `last_access_time` | 유저가 마지막으로 액션을 취한 API request 시간 기록 컬럼 |  |
| `country` | 유저가 접속하는 국가; 22/11/24 SPOTLIGHT 배포로 원티드 글로벌 (wanted.jobs)에 접속한 유저는 SPOTLIGHT DB로 이동 앱: 기기 설정대로 언어, 지역 설정 (ex. 한국어, 덴마크로 설정되어있으면 lang = 'ko', country = 'DK') 웹: 아래 1~5 우선순위대로 없으면 다음번호 기반으로 국가정보 수집. ('KR','JP','HK','SG','TW') 중 없으면 'WW'로 전달 1. 쿠키핸들러 2. 도메인정보 3. country_code의 query(wanted.job의 홍콩, 싱가포르, WW) 4. 쿠키(wanted.jobs) 5. IP |  |
| `accept_event_email` | 이벤트 메일 수신 동의 |  |
| `leave_time` | 탈퇴 시간 |  |
| `failed_password_count` | 패스워드 입력 실패 횟수 |  |
| `accept_event_push` | 푸시 알람 동의; 이 컬럼보다는 user_notification_approval.is_approved로 푸시수신동의여부 판별할것 |  |
| `company` | 현재 다니고 있는 직장/학교; 직장 또는 (현재 학생인 경우) 학교를 선택 가능, but 직장이 학교인 경우 유저가 일반인인지 학생인지 구분 필요 |  |
| `status` | [240829 업데이트] 탈퇴하면 0, 탈퇴 안했으면 1. 예전엔 1년 접속 안하면 status값이 바뀌고 휴면전환됐으나, 법이 바뀌어서 이젠 아니다 (2024년 기준). 유저의 마지막 접속 시기는 last_access_time컬럼을 보라. [240829 이전] 활성유저 유무; 0: 탈퇴유저, 1: 활성유저(dormant_user.status = 0 or 값 없음), 2: 휴면(last_login_time 기준 1년이상 접속X)유저 (dormant_user.status = 1) |  |
| `id` | PK; 유저 ID |  |

</details>

### `user_career` 

**설명:** 원티드 이력서에 기입된 경력정보. 경력당 1행이 생성되기 때문에 한 user_id에 여러 행이 있을 수 있다. 경력인증시 certificated_user_career테이블에 인증한 이력이 쌓이고, 그 중 유저가 이력서에서 선택해서 추가한 경우에만 user_career테이블에 certificated_user_career_id가 쌓인다.

_owner: 성여운(Yeouhn Sung)_

<details><summary>컬럼 5개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `end_time` | iOS의 경우, 경력 종료일을 입력하지 않으면 2024.01.01, 1950.01.01과 같은 임의의 값이 들어가던 시절이 있다. (2024.06월에 발견.) 사용시 정제 필요. |  |
| `employment_type` | FULLTIME: 풀타임 혹은 정규직, PARTIME: 파트타임, INTERN: 인턴. 이력서 작성시 회사명 기입하려면 반드시 employment_type 값을 정해야 한다. 단, 이벤트신청, 경력인증으로 경력이 생성됐거나 기업회원이 개인회원활동을 시작할 땐 경력에 회사명은 있지만 employment_type이 null일 수 있다. |  |
| `company_key` | company_type = 'CUSTOM'이면 company_key가 회사명이며, 다른 테이블의 값과 매핑되지 않을 수 있으니 그대로 갖다 쓸 것. company_type='KREDITJOB'면 company_key가 다른 테이블의 PK_NM_HASH 와 매핑된다. company_type= 'WANTED'면 다른테이블의 company_id와 매핑된다. |  |
| `company_type` | company_type = 'CUSTOM'이면 company_key컬럼의 값이 회사명이며, 다른 테이블의 값과 매핑되지 않을 수 있으니 그대로 갖다 쓸 것. company_type='KREDITJOB'면 company_key컬럼의 값이 다른 테이블의 PK_NM_HASH 와 매핑된다. company_type= 'WANTED'면 company_key컬럼의 값이 다른테이블의 company_id와 매핑된다. |  |
| `certificated_user_career_id` | 경력인증시 certificated_user_career테이블에 인증한 이력이 쌓이고, 그 중 유저가 이력서에서 선택해서 추가한 경우에만 user_career테이블에 certificated_user_career_id가 쌓인다. |  |

</details>

### `user_leave_history` 

**설명:** 회원탈퇴 로그

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 1개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `reason_key` | 탈퇴사유 |  |

</details>

### `user_point_history` 

**설명:** 원티드 포인트 적립 히스토리

_owner: 성여운(Yeouhn Sung)_

<details><summary>컬럼 7개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `create_time` | 로그가 찍힌 시점 (not 포인트가 생긴 시점) |  |
| `user_id` | 유저 ID; user.id |  |
| `action` | event_use: 이벤트에 사용 / refund: 포인트 환불받음 / earn: 포인트 적립 / expire: 포인트 소멸 / use: 포인트 사용(이벤트 외?) |  |
| `information` | 포인트 받거나 소진한 목적. 커리어 성장 컨텐츠에 소진한 경우, 유니코드->한글 변환기를 사용하면 한글 제목 확인 가능 |  |
| `expire_time` | 포인트 생성로그일 경우, 해당 포인트가 만료되는 시점 (1년 후) |  |
| `balance` | 포인트 잔고 |  |
| `id` | PK; |  |

</details>

### `user_profile_level_history` 


_owner: 성여운(Yeouhn Sung)_

### `user_recommendation` 

**설명:** 프로필 레벨이 바뀔 때마다 로그가 찍힘. 이 테이블은 곧 없어질 예정이다. (서버팀이 지우고 싶어함)

_owner: 성여운(Yeouhn Sung)_

### `wanted_des` 

**설명:** 채용공고 테이블

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 29개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `annual_to` | 경력 최대 년수(추정) |  |
| `annual_from` | 경력 최소 년수(추정) |  |
| `confirm_time` | 공고 마지막 승인 시간 |  |
| `status` | 공고 상태; request : 공고 올림 허가 요청, active : 공고 올림(활성화), draft : 공고 내림(or 비활성화), archived : 공고 삭제 |  |
| `create_time` | 공고 생성 시간 |  |
| `owner_id` | 관리자 ID; user.id |  |
| `company_id` | 기업 ID |  |
| `company` | 기업명; company_des.name |  |
| `company_info` | 기업소개; company_des.info |  |
| `logo_thumb_img` | 로고대표이미지 |  |
| `logo_img` | 로고이미지 |  |
| `due` | 마감 체크 일자 |  |
| `due_time` | 마감일자 |  |
| `memo` | 메모 |  |
| `is_manual_send` | 수동전송여부; 1: 수동전송, 0:자동전송 |  |
| `hidden` | 숨김여부 |  |
| `confirm` | 승인여부 |  |
| `salary_max` | 연봉 최대 |  |
| `salary_min` | 연봉 최소 |  |
| `years` | 연차레벨 |  |
| `request_time` | 요청일자 |  |
| `email` | 채용 문의 담당 이메일 |  |
| `reward` | 채용 보상금 |  |
| `jd` | 채용 포지션 설명 |  |
| `tags` | 채용 포지션 태그; tag.tag_type_id에 종속, ID 형태로 종속 X |  |
| `edit_time` | 최종 수정 시간 |  |
| `internal_comment` | 추가 코멘트 |  |
| `id` | PK; 채용공고 ID |  |
| `address_id` | 채용공고 근무지 주소 ID wanteddb.company_address.id와 조인 |  |

</details>

### `wanted_des_history` 

**설명:** 채용공고 히스토리 테이블. 모든 액션에 대한 로그가 찍혀있음. 라이브 상태인 공고의 공고 설정 변경할 때도 status='active'가 남음. 
따라서, 조건을 걸거나 활성 <-> 비활성 로그만 남는 analytics_mart.live_position_history에서 확인하는걸 추천

_owner: 유지윤_

<details><summary>컬럼 6개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `id` | PK |  |
| `wd_id` | 채용공고 ID |  |
| `user_id` | 액션한 유저 ID |  |
| `action` | 일어난 액션 |  |
| `create_time` | 생성 일시 (액션 일시) |  |
| `ai_screening_status` | AI 검토 상태 |  |

</details>

### `wanted_job_detail` 

**설명:** 채용공고 상세

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 5개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `country` | 개제된 원티드사이트 국가 |  |
| `company_id` | 기업 ID |  |
| `lang` | 언어 |  |
| `wd_id` | 포지션 ID |  |
| `position` | 포지션명; wd의 제목으로 사용됨 |  |

</details>

### `wanted_resume` 

**설명:** 원티드 이력서

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 9개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `email` | 원티드 이력서에 저장된 이메일. | email |
| `mobile` | 원티드 이력서에 저장된 휴대전화 번호. | phone number |
| `about` | 원티드 이력서의 자기소개/소개글 본문. | resume |
| `is_matching` | 매치업 > 기업담당자에게 노출여부; 1: 노출 |  |
| `is_complete` | 매치업 > 기업담당자에게 버튼 노출 여부; 1: [이력서 요청하기] 노출, 0: [이력서 미리보기] 노출 |  |
| `is_dirty` | 수정된 적 있는지 여부 확인; 서버팀 사용용 |  |
| `id` | PK |  |
| `name` | 이력서 최상단에 박히는 이름. 지원자들 목록에 뜨는 이름. | name |
| `resume_title` | 이력서 파일명. 이력서 최상단 이름은 아니다. 매치업 인재검색할 때 뜨는 이름도 아니다. | name |

</details>

---

## 📦 `query_results_privacy` (43개 테이블)

### `커_IDX_채용연계교육_1` — 교육/공통

**설명:** 프리온보딩 코스 수료자의 구직 활동 현황 (코스시작일~코스수료일로부터 6개월)

⚠️ **특이사항:** BI 대시보드 '채용연계교육 종합'의 raw data

_owner: 이상인 (Lee Sangin)_

<details><summary>컬럼 24개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `completion_date` | 교육 수료일자 |  |
| `start_date` | 교육 시작일자 |  |
| `course_name` | 교육명 |  |
| `pass_date` | 서류합격 시점 |  |
| `pass_yn` | 서류합격 여부 |  |
| `user_jobcategory` | 유저 직군 |  |
| `name` | 이름 |  |
| `mobile` | 전화번호 |  |
| `apply_type` | 지원 유형 (apply_normal / matchup) |  |
| `apply_time` | 지원/제안받은/제안수락 시점 |  |
| `focus_yn` | 집중육성 전형 대상자 여부 |  |
| `reward_date` | 채용보상금 지급 시점 |  |
| `reward` | 채용보상금(원) |  |
| `hiring_yn` | 최종합격 여부 |  |
| `position` | 포지션명 |  |
| `hiring_date` | 합격 확정 시점 |  |
| `salary` | 합격자 연봉 |  |
| `hiring_fee` | 합격자 채용수수료 |  |
| `company_name` | 회사명 |  |
| `apply_id` | apply_id |  |
| `email` | email |  |
| `position_id` | position_id |  |
| `sba_yn` | SBA 전형자 여부 |  |
| `user_id` | user_id |  |

</details>

### `커_IDX_채용연계교육_2` — 교육/공통

**설명:** 챌린지 코스 수료자의 구직 활동 현황 (코스시작일~코스수료일로부터 6개월)

⚠️ **특이사항:** BI 대시보드 '채용연계교육 종합'의 raw data

_owner: 이상인 (Lee Sangin)_

<details><summary>컬럼 22개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `completion_date` | (챌린지) 교육 수료일자 |  |
| `start_date` | (챌린지) 교육 시작일자 |  |
| `course_name` | (챌린지) 교육명 |  |
| `pass_date` | 서류합격 시점 |  |
| `pass_yn` | 서류합격 여부 |  |
| `user_jobcategory` | 유저 직군 |  |
| `name` | 이름 |  |
| `mobile` | 전화번호 |  |
| `apply_type` | 지원 유형 (apply_normal / matchup) |  |
| `apply_time` | 지원/제안받은/제안수락 시점 |  |
| `reward_date` | 채용보상금 지급 시점 |  |
| `reward` | 채용보상금(원) |  |
| `hiring_yn` | 최종합격 여부 |  |
| `position` | 포지션명 |  |
| `hiring_date` | 합격 확정 시점 |  |
| `salary` | 합격자 연봉 |  |
| `hiring_fee` | 합격자 채용수수료 |  |
| `company_name` | 회사명 |  |
| `apply_id` | apply_id |  |
| `email` | email |  |
| `position_id` | position_id |  |
| `user_id` | user_id |  |

</details>

### `커_IDX참고_채용연계교육_합격` — 교육/공통

**설명:** 프리온보딩 코스+챌린지 코스 수료자의 구직 활동 현황(코스시작일~코스수료일로부터 6개월)

⚠️ **특이사항:** 커_IDX_채용연계교육_1 + 커_IDX_채용연계교육_2

_owner: 이상인 (Lee Sangin)_

<details><summary>컬럼 24개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `completion_date` | 교육 수료일자 |  |
| `start_date` | 교육 시작일자 |  |
| `course_name` | 교육명 |  |
| `pass_date` | 서류합격 시점 |  |
| `pass_yn` | 서류합격 여부 |  |
| `user_jobcategory` | 유저 직군 |  |
| `name` | 이름 |  |
| `mobile` | 전화번호 |  |
| `apply_time` | 지원/제안받은/제안수락 시점 |  |
| `focus_yn` | 집중육성 전형 대상자 여부(챌린지 코스일 경우 null) |  |
| `reward_date` | 채용보상금 지급 시점 |  |
| `reward` | 채용보상금(원) |  |
| `hiring_yn` | 최종합격 여부 |  |
| `course_group` | 코스 종류(프리온보딩 코스, 챌린지 코스) |  |
| `position` | 포지션명 |  |
| `hiring_date` | 합격 확정 시점 |  |
| `salary` | 합격자 연봉 |  |
| `hiring_fee` | 합격자 채용수수료 |  |
| `company_name` | 회사명 |  |
| `apply_id` | apply_id |  |
| `email` | email |  |
| `position_id` | position_id |  |
| `sba_yn` | SBA 전형자 여부(챌린지 코스일 경우 null) |  |
| `user_id` | user_id |  |

</details>

### `커_RAW_승인공고연차직무정보` — 교육/공통

**설명:** 승인 공고의 요구 연차, 직군/직무 정보

⚠️ **특이사항:** 교육 프로그램 기획, 프로모션 진행 시 근거자료로 활용

_owner: hweejin@wantedlab.com_

<details><summary>컬럼 8개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `annual_to` | 요구연차_최대 |  |
| `annual_from` | 요구연차_최소 |  |
| `confirm_time` | 포지션 승인 시점 |  |
| `job_ctg` | 포지션 직군 |  |
| `job` | 포지션 직무 (복수) |  |
| `position_id` | 포지션 id |  |
| `position` | 포지션명 |  |
| `company` | 회사명 |  |

</details>

### `커리어_콘텐츠조회_education` — 교육/공통

**설명:** 콘텐츠조회_education : 채용연계교육 관련 이벤트 페이지 조회 현황

⚠️ **특이사항:** BI 대시보드 '커리어 콘텐츠 조회'의 raw data

_owner: hweejin@wantedlab.com_

<details><summary>컬럼 10개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `country` | 국가 (유저 ip 기반) |  |
| `event_time` | 조회 시점 |  |
| `content_title` | 콘텐츠 제목 |  |
| `content_kind` | 콘텐츠 종류 (VOD/vod_event/article/network/education/community/exContent/wVideo) |  |
| `amplitude_id` | amplitude_id (unique users 기준) |  |
| `event_key` | event 고유 식별자 (event_id 와 다름) |  |
| `prov_country` | event 페이지 제공 국가 |  |
| `content_id` | media_content_key 혹은 event_id |  |
| `user_id` | user_id |  |
| `platform` | WEB/Android/iOS |  |

</details>

### `gigs_expert_jikmu_longlist` — 긱스/공통

**설명:** 긱스 프리랜서 등록한 유저의 세부 직무 등록 현황

_owner: taeeun@wantedlab.com_

### `gigs_experts` — 긱스/공통

**설명:** 긱스 프리랜서 등록한 유저 리스트

_owner: taeeun@wantedlab.com_

### `gigs_match` — 긱스/공통

**설명:** 긱스 등록된 프로젝트의 매칭 상태 정보

_owner: taeeun@wantedlab.com_

### `gigs_project` — 긱스/공통

**설명:** 긱스 등록된 프로젝트 리스트

_owner: taeeun@wantedlab.com_

### `gigs_project_jikgun_longlist` — 긱스/공통

**설명:** 긱스 등록된 프로젝트의 직군 정보

_owner: taeeun@wantedlab.com_

### `gigs_project_jikmu_longlist` — 긱스/공통

**설명:** 긱스 등록된 프로젝트의 직무 정보

_owner: taeeun@wantedlab.com_

### `gigs_project_skill_longlist` — 긱스/공통

**설명:** 긱스 등록된 프로젝트의 스킬 정보

_owner: taeeun@wantedlab.com_

### `00_companyEmailList_KR` 

**설명:** 기업 이메일 리스트 테이블

_owner: 유지윤 (Jiyoon You)_

### `peopleanalytics_hires` 

**설명:** 원티드 합격자 기준 처우 분석용 테이블

_owner: 성여운(Yeouhn Sung)_

<details><summary>컬럼 15개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `company_id` | 원티드 기업고객 id. company_des.id와 같다. |  |
| `company_name` | 회사명 |  |
| `c_employee` | 국민연금 기준 직원수. nps_update_date기준의 정보임. |  |
| `nps_update_date` | 국민연금 업데이트날짜. |  |
| `nps_avg_salary` | 국민연금 기준 처우수준. nps_update_date기준의 정보임. |  |
| `industry_1` | 산업분류 (대분류) |  |
| `industry_2` | 산업분류 |  |
| `industry_3` | 산업분류 |  |
| `industry_4` | 산업분류 (소분류) |  |
| `hiring_date` | 채용일 |  |
| `jikgun_id` | 직군id |  |
| `jikgun` | 직군 |  |
| `annual_then` | 채용당시 구직자의 연차 (100% 정확한건 아님.) |  |
| `salary` | 채용당시 제안받은 연봉 |  |
| `final_fee` | 채용당시 수취한 채용수수료. salary컬럼이 null인 경우, 이걸로 역산한다. |  |

</details>

### `사개팀_원티드긱스프리랜서` 

**설명:** https://wantedlab.atlassian.net/browse/DATARQ-1696
2020.12.02 (지윤): 생성 
2020.12.08 (지윤): 직무, 근무 가능 장소, 포트폴리오, 자기소개, 연차, 스킬 열 추가 
2020.12.15 (지윤): UNNEST 쿼리 수정 
2021.10.25 (지윤): DB 컬럼 ARRAY > STRING 타입 변경으로 인한 쿼리 에러 수정

_owner: 유지윤 (Jiyoon You)_

<details><summary>컬럼 6개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `work_place` | 근무 가능 장소 |  |
| `work_type` | 선호 업무 방식 fulltime: 전업, parttime: 비전업,  both: 둘다 |  |
| `skills` | 스킬 |  |
| `experience` | 연차 |  |
| `portfolio_url` | 포트폴리오 (링크) |  |
| `portfolio_upload_url` | 포트폴리오 (파일) |  |

</details>

### `채사팀_합격자재무정보` 

**설명:** https://wantedlab.atlassian.net/browse/DATARQ-2181
2022.03.08 (지윤): internal_comment 컬럼 추가 (서연님 요청)
2022.07.06 (지윤): is_first_hire 추가

_owner: 유지윤 (Jiyoon You)_

<details><summary>컬럼 16개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `resigned` | 3개월 미만 퇴사 여부 (퇴사없음 :1 , 퇴사함 (환불처리): 2) |  |
| `hiring_fee_billing` | 계산서발행일 |  |
| `registration_id` | 기업 사업자번호 |  |
| `company_name` | 기업명 |  |
| `company_id` | 기업ID |  |
| `jikgun` | 등록된 포지션 직군명 |  |
| `jikgun_id` | 등록된 포지션 직군ID |  |
| `internal_comment` | 비밀일기 (220308 추가) |  |
| `user_annual` | 유저 연차 |  |
| `user_name` | 유저명 |  |
| `user_id` | 유저ID |  |
| `apply_id` | 지원번호ID |  |
| `hiring_product_type` | 채용형태 (포지션: 0, 매치업: 1, 매무요: 2) |  |
| `is_first_hire` | 첫채용여부, (첫채용 :1, 첫채용 아님: 0, 220706 추가) |  |
| `final_fee` | 청구금액 |  |
| `hiring_date` | 합격처리일시 (220602 추가, https://wantedx.slack.com/archives/C8QFV04EQ/p1654156111526879) |  |

</details>

### `커_RAW_KJ기업리스트` 

**설명:** KreditJob에서 유저에게 노출되는 전체 기업리스트. 원티드 company_id 정보 포함

_owner: hweejin@wantedlab.com_

<details><summary>컬럼 4개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `service_name` | 서비스명 |  |
| `PK_NM_HASH` | 크레딧잡에서 사용하는 company_id 개념 |  |
| `company_name` | 회사명 |  |
| `wanted_company_id` | wanted도 가입한 기업들의 company_id |  |

</details>

### `커_RAW_이벤트신청폼진입유저` 

**설명:** DATARQ-2051

_owner: hweejin@wantedlab.com_

<details><summary>컬럼 6개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `event_time` | 신청폼 진입 시점 |  |
| `event_id` | 신청폼 진입한 event_id |  |
| `fb_name` | 이름 |  |
| `email` | 이메일 |  |
| `mobile` | 전화번호 |  |
| `user_id` | user_id |  |

</details>

### `00_userEmailList_KR` — 채용/유저

**설명:** 유저 이메일 리스트 (KR) - 마케팅 이메일 수신동의O, 휴면유저 제외, 기업 회원 제외, 최근 3개월 내 합격 제외

<details><summary>컬럼 11개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `jikgun_for_mkt` | 524.미디어' 직군을 '523.마케팅, 광고' 직군으로 변경한 직군 데이터 |  |
| `create_time` | 가입 일자 |  |
| `last_login_time` | 마지막 접속일자 |  |
| `company` | 마지막 직장 |  |
| `annual` | 연차 |  |
| `user_id` | 유저 id (원티드 user_id) |  |
| `name` | 유저명 |  |
| `email` | 이메일 |  |
| `jikmu_name` | 직군명 |  |
| `jikgun` | 직군id.직군명 |  |
| `profile_level` | 프로필 레벨 |  |

</details>

### `00_userEmailList_KRall` — 채용/유저

**설명:** 유저 이메일 리스트 (KR)

<details><summary>컬럼 9개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `create_time` | 가입 일자 |  |
| `mobile` | 연락처 |  |
| `annual` | 연차 |  |
| `user_id` | 유저 id (원티드 user_id) |  |
| `name` | 유저명 |  |
| `email` | 이메일 |  |
| `jikmu_name` | 직군명 |  |
| `jikgun` | 직군id.직군명 |  |
| `profile_level` | 프로필 레벨 |  |

</details>

### `사개팀_이력서변환리스트` — 채용/유저

**설명:** 이력서 변환 대상 유저의 지원정보 및 이력서 개수 정보

<details><summary>컬럼 10개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `job_search_intention` | 구직여부설정 |  |
| `country` | 국가 |  |
| `id` | 매칭번호 |  |
| `wr_count` | 원티드이력서 개수 |  |
| `user_id` | 유저id (원티드 user_id) |  |
| `email` | 이메일 |  |
| `apply_time` | 지원 시점 |  |
| `apply_id` | 지원번호 |  |
| `r_count` | 총 이력서 개수 |  |
| `profile_level` | 프로필 레벨 |  |

</details>

### `커_OKR_커뮤니티_글` — 커리어/커뮤니티

**설명:** 커뮤니티 글 작성 현황 - 작성한 글의 조회수/댓글수/좋아요수, 작성자 정보

_owner: hweejin@wantedlab.com_

<details><summary>컬럼 20개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `user_id` | (글 작성자) user_id |  |
| `new_create_time` | (유저의) 최초 글 작성 시점 |  |
| `new_yn` | (유저의) 최초 글 작성 여부 (최초:1, 재:0) |  |
| `user_create_time` | 가입 시점 |  |
| `board_name` | 게시판 이름 |  |
| `board_id` | 게시판 id |  |
| `plus_yn` | 구독 신청 경험 여부 (1:y, 0:n) |  |
| `post_content` | 글 내용 |  |
| `post_comment` | 글 댓글수 |  |
| `create_time` | 글 작성 시점 |  |
| `post_title` | 글 제목 |  |
| `post_view` | 글 조회수 |  |
| `post_like` | 글 좋아요수 |  |
| `post_id` | 글 id |  |
| `wanted_member_yn` | 원티드 직원 여부 (y,n) |  |
| `user_name` | 이름 |  |
| `img_yn` | 이미지 첨부 여부 (y:1, n:0) |  |
| `profile_level` | 프로필레벨 |  |
| `user_company` | 회사 |  |
| `email` | email |  |

</details>

### `커_OKR_커뮤니티_글보기` — 커리어/커뮤니티

**설명:** 커뮤니티 글 조회 현황 - 조회한 글/게시판 정보

_owner: hweejin@wantedlab.com_

<details><summary>컬럼 13개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `user_name` | (글 조회한 유저의) 이름 |  |
| `user_company` | (글 조회한 유저의) 회사 |  |
| `email` | (글 조회한 유저의) email |  |
| `user_id` | (글 조회한) user_id |  |
| `new_event_time` | (유저의) 최초 글 조회 시점 (글 클릭 시점) |  |
| `new_yn` | (유저의) 최초 글 조회 여부 (최초:1, 재:0) |  |
| `board_id` | (조회한 글의) 게시판 id |  |
| `post_id` | (조회한) 글 id |  |
| `board_name` | 게시판 이름 |  |
| `plus_yn` | 구독 신청 경험 여부 (1:y, 0:n) |  |
| `post_title` | 글 제목 |  |
| `event_time` | 글 조회 시점 (글 클릭 시점) |  |
| `wanted_member_yn` | 원티드 직원 여부 (y,n) |  |

</details>

### `커_OKR_커뮤니티_댓글` — 커리어/커뮤니티

**설명:** 커뮤니티 댓글 작성 현황 - 작성한 댓글 좋아요수, 작성자 정보

_owner: hweejin@wantedlab.com_

<details><summary>컬럼 16개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `user_id` | (댓글 작성자) user_id |  |
| `user_create_time` | 가입 시점 |  |
| `board_name` | 게시판 이름 |  |
| `board_id` | 게시판 id |  |
| `plus_yn` | 구독 신청 경험 여부 (1:y, 0:n) |  |
| `post_title` | 글 제목 |  |
| `post_id` | 글 id |  |
| `comment_content` | 댓글 내용 |  |
| `create_time` | 댓글 작성 시점 |  |
| `comment_like` | 댓글 좋아요수 |  |
| `comment_id` | 댓글 id |  |
| `wanted_member_yn` | 원티드 직원 여부 (y,n) |  |
| `user_name` | 이름 |  |
| `profile_level` | 프로필레벨 |  |
| `user_company` | 회사 |  |
| `email` | email |  |

</details>

### `커_OKR_커뮤니티_유입` — 커리어/커뮤니티

**설명:** 커뮤니티 유저 유입 현황 - user_id, 유입 시간 정보

_owner: hweejin@wantedlab.com_

<details><summary>컬럼 7개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `user_id` | (커뮤니티 화면 진입한) user_id |  |
| `plus_yn` | 구독 신청 경험 여부 (1:y, 0:n) |  |
| `wanted_member_yn` | 원티드 직원 여부 (y,n) |  |
| `user_name` | 이름 |  |
| `event_time` | 커뮤니티 화면 진입 시점 |  |
| `user_company` | 회사 |  |
| `email` | email |  |

</details>

### `커_OKR_커뮤니티_좋아요` — 커리어/커뮤니티

**설명:** 커뮤니티 좋아요 현황 - 좋아요 대상 글/댓글 정보, 좋아요 유저 정보

_owner: hweejin@wantedlab.com_

<details><summary>컬럼 12개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `user_id` | (좋아요 누른) user_id |  |
| `plus_yn` | 구독 신청 경험 여부 (1:y, 0:n) |  |
| `post_title` | 글 제목 (좋아요 대상이 글인 경우, 값 있음) |  |
| `post_id` | 글 id (좋아요 대상이 글인 경우, 값 있음) |  |
| `comment_content` | 댓글 내용 (좋아요 대상이 댓글인 경우, 값 있음) |  |
| `comment_id` | 댓글 id (좋아요 대상이 댓글인 경우, 값 있음) |  |
| `wanted_member_yn` | 원티드 직원 여부 (y,n) |  |
| `user_name` | 이름 |  |
| `create_time` | 좋아요 시점 |  |
| `like_id` | 좋아요 id |  |
| `user_company` | 회사 |  |
| `email` | email |  |

</details>

### `커리어_UGC_등록현황` — 커리어/커뮤니티

**설명:** 커뮤니티 글 등록 현황 및 콘텐츠 정보 (ex. 태그)

⚠️ **특이사항:** BI 대시보드 '커뮤니티 글 등록 현황' 의 raw data

_owner: hweejin@wantedlab.com_

<details><summary>컬럼 7개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `tag` | 관심태그 |  |
| `tag_id` | 관심태그 ID |  |
| `create_time` | 글 등록 시점 |  |
| `user_id` | 글 작성자 user_id |  |
| `newUser_yn` | 글 작성자의 최초 글 작성 여부 (1:y, 0 :n) |  |
| `post_title` | 글 제목 |  |
| `postId` | 커뮤니티 글 고유 ID (주의 unique 값 아님) |  |

</details>

### `커리어_UGC_조회현황` — 커리어/커뮤니티

**설명:** 커뮤니티 글 조회 현황 및 기타 정보 (ex. user_id, 글 제목, 태그)

⚠️ **특이사항:** BI 대시보드 '커뮤니티 글 조회 현황 / 인기순' 의 raw data

_owner: hweejin@wantedlab.com_

<details><summary>컬럼 11개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `newUser_yn` | 글 조회자의 최초 글 조회 여부 (1:y, 0 :n) |  |
| `tag` | 조회한 글에 설정된 관심태그 |  |
| `tag_id` | 조회한 글에 설정된 관심태그 ID |  |
| `create_time` | 조회한 커뮤니티 글 등록 시점 |  |
| `post_user_id` | 조회한 커뮤니티 글 작성자 user_id |  |
| `post_title` | 조회한 커뮤니티 글 제목 |  |
| `postId` | 조회한 커뮤니티 글 ID |  |
| `temp_id` | 커뮤니티 글 조회 건 고유 id (주의 unique 값 아님) |  |
| `event_time` | 커뮤니티 글 조회 시점 |  |
| `amplitude_id` | 커뮤니티 글 조회 유저 amplitude_id |  |
| `user_id` | 커뮤니티 글 조회 유저 user_id |  |

</details>

### `커리어_콘텐츠조회_UGC` — 커리어/커뮤니티

**설명:** 콘텐츠조회_UGC : 커뮤니티 게시글 조회

⚠️ **특이사항:** BI 대시보드 '커리어 콘텐츠 조회'의 raw data

_owner: hweejin@wantedlab.com_

<details><summary>컬럼 10개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `menu_title` | 게시판 이름 |  |
| `menu_id` | 게시판 id |  |
| `country` | 국가 (유저 ip 기반) |  |
| `event_time` | 조회 시점 |  |
| `content_title` | 콘텐츠 제목 |  |
| `content_kind` | 콘텐츠 종류 (VOD/vod_event/article/network/education/community/exContent/wVideo) |  |
| `amplitude_id` | amplitude_id (unique users 기준) |  |
| `content_id` | media_content_key 혹은 event_id |  |
| `user_id` | user_id |  |
| `platform` | WEB/Android/iOS |  |

</details>

### `커_IDX_아티클` — 커리어/콘텐츠

**설명:** 아티클 제작 현황, 유저 이용 현황

_owner: hweejin@wantedlab.com_

<details><summary>컬럼 16개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `apply_number` | (누적)지원횟수 |  |
| `annual` | 경력 |  |
| `plus_yn` | 구독 신청 경험 여부 |  |
| `event_job_ctg` | 아티클 대상 직군 |  |
| `create_time` | 아티클 생성 시점 |  |
| `country` | 아티클 제공 국가 |  |
| `title` | 아티클 제목 |  |
| `event_time` | 아티클 조회 시점 |  |
| `user_id` | 아티클 조회한 user_id |  |
| `visible` | 아티클 직접 노출 여부 (y:1,n:0) |  |
| `user_name` | 유저 이름 |  |
| `email` | 이메일 |  |
| `job_ctg` | 직군 |  |
| `profile_level` | 프로필 레벨 |  |
| `event_id` | event_id |  |
| `event_key` | event_key |  |

</details>

### `커_IDX_영상시청기록` — 커리어/콘텐츠

**설명:** 한국+글로벌 유저의 영상 시청 현황 (구독 신청자 + 비신청자 모두 포함)

_owner: hweejin@wantedlab.com_

<details><summary>컬럼 15개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `annual` | 경력 년수 |  |
| `lang` | 언어 |  |
| `video_duration` | 영상 길이 (초) |  |
| `play_time` | 영상 시청 시간 (초) |  |
| `play_date` | 영상 시청 연월일 |  |
| `media_content_key` | 영상 컨텐츠 고유값 |  |
| `video_author` | 영상 컨텐츠 연사 |  |
| `video_title` | 영상 컨텐츠 제목 |  |
| `video_id` | 영상 컨텐츠 id |  |
| `job_ctg` | 직군 |  |
| `profile_level` | 프로필 레벨 |  |
| `status` | 활성유저 유무; 0: 탈퇴유저, 1: 활성유저, 2: 휴면(last_login_time 기준 1년이상 접속X)유저 |  |
| `country` | country |  |
| `email` | email |  |
| `user_id` | user_id |  |

</details>

### `커_IDX_이벤트신청` — 커리어/콘텐츠

**설명:** 이벤트(구독포함) 신청자 개인 정보

_owner: hweejin@wantedlab.com_

<details><summary>컬럼 18개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `country` | 국가 |  |
| `annual` | 연차 |  |
| `payment_type` | 유료/무료/정기결제 |  |
| `name` | 이름 |  |
| `email` | 이메일 |  |
| `event_registration_id` | 이벤트 신청 고유번호 (event_id 와 다름) |  |
| `evt_register_time` | 이벤트 신청 시점 |  |
| `profile_level_before` | 이전 프로필 레벨 |  |
| `company` | 재직 회사 |  |
| `mobile` | 전화번호 |  |
| `jikgun` | 직군 |  |
| `jikmu` | 직무 |  |
| `profile_level_present` | 현재 프로필 레벨 |  |
| `signup_time` | 회원가입 시점 |  |
| `regist_minus_signup` | 회원가입으로부터 이벤트 신청까지 걸린 시간(일) |  |
| `event_title` | event 이름 |  |
| `event_id` | event_id |  |
| `user_id` | user_id |  |

</details>

### `커_RAW_이벤트별LV3달성` — 커리어/콘텐츠

**설명:** DATARQ-1948 , 이벤트 신청한 신규/기존 유저의 Lv3 달성 여부

_owner: hweejin@wantedlab.com_

<details><summary>컬럼 12개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `is_existing` | 기존 유저 여부 |  |
| `Level3_under_existing` | 기존 유저 이벤트 신청 전 lv3 미만 여부 |  |
| `Level3_acquired_existing` | 기존 유저 이벤트 신청 후 lv3 달성 여부 |  |
| `is_new` | 신규 유저 여부 (10분내 회원가입) |  |
| `Level3_acquired_new` | 신규 유저 이벤트 신청 후 lv3 달성 여부 |  |
| `event_country` | 이벤트 국가 |  |
| `register_time` | 이벤트 신청 시점 |  |
| `event_title` | 이벤트 제목 |  |
| `event_key` | 이벤트 키 (events/{event_key}) |  |
| `user_id` | 이벤트를 신청한 유저 ID |  |
| `event_id` | event_id |  |
| `detail_profile` | lv3 필수 여부 |  |

</details>

### `커_RAW_이벤트조회신청매출` — 커리어/콘텐츠

**설명:** 이벤트별 페이지뷰, 등록, 매출 현황

⚠️ **특이사항:** BI 대시보드 Event Conversion 의 raw data

_owner: hweejin@wantedlab.com_

<details><summary>컬럼 22개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `recurrent_revenue` | (최초 결제를 제외한) 정기 결제를 통해 결제된 금액 |  |
| `registration_w_point` | 결제 시 포인트 사용 여부 (1:사용) |  |
| `currency` | 결제 통화 |  |
| `payment_type` | 결제 형태 (wanted,free,paid) |  |
| `Level3_acquired_existing` | 기존 유저 이벤트 신청 후 lv3 달성 여부 |  |
| `used_point` | 사용한 포인트 |  |
| `is_new` | 신규 유저 여부 (10분내 회원가입) |  |
| `Level3_acquired_new` | 신규 유저 이벤트 신청 후 lv3 달성 여부 |  |
| `registration` | 신청자수 |  |
| `revenue` | 실제 (최초) 결제 금액 |  |
| `date` | 연월일 |  |
| `country` | 이벤트 국가 |  |
| `create_time` | 이벤트 생성(공개) 시점 |  |
| `title` | 이벤트 이름 |  |
| `label` | 이벤트 종류 |  |
| `event_time` | 이벤트 진행(개최) 시점 |  |
| `event_key` | 이벤트 키 (events/{event_key}) |  |
| `users` | 이벤트 페이지 본 유저수 |  |
| `pageviews` | 이벤트 페이지 조회수 |  |
| `visible` | 현재 이벤트 공개 여부 (1:공개, 0:미공개) |  |
| `event_id` | event_id |  |
| `detail_profile` | lv3 필수 여부 |  |

</details>

### `커리어_exContent_등록현황` — 커리어/콘텐츠

**설명:** 외부 콘텐츠 등록 현황 및 콘텐츠 상세 정보 (ex. 태그)

⚠️ **특이사항:** BI 대시보드 '외부 콘텐츠 등록 현황' 의 raw data

_owner: hweejin@wantedlab.com_

<details><summary>컬럼 15개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `tag` | 관심태그 |  |
| `tag_id` | 관심태그 ID |  |
| `is_visible` | 노출 여부 (1:y, 0:n) |  |
| `is_approve` | 승인 여부 (1:y, 0:n) |  |
| `exContentId` | 외부 콘텐츠 고유 ID (주의 unique 값 아님) |  |
| `content_des` | 콘텐츠 내용 |  |
| `platform` | 콘텐츠 노출 플랫폼 |  |
| `create_time` | 콘텐츠 등록 시점 (크롤링한 시점) |  |
| `publish_time` | 콘텐츠 작성 시점 (크리에이터가 콘텐츠 작성한 시점) |  |
| `country` | 콘텐츠 제공 국가 |  |
| `content_title` | 콘텐츠 제목 |  |
| `content_url` | 콘텐츠 url 링크 |  |
| `creator_status` | 크리에이터 상태 |  |
| `creator_name` | 크리에이터 이름 |  |
| `creator_id` | 크리에이터 ID |  |

</details>

### `커리어_exContent_조회현황` — 커리어/콘텐츠

**설명:** 외부 콘텐츠 조회 현황 및 기타 정보 (ex. user_id, 콘텐츠 제목, 태그)

⚠️ **특이사항:** BI 대시보드 '외부 콘텐츠 조회 현황 / 인기순' 의 raw data

_owner: hweejin@wantedlab.com_

<details><summary>컬럼 10개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `temp_id` | 외부 콘텐츠 조회 건 고유 id (주의 unique 값 아님) |  |
| `event_time` | 외부 콘텐츠 조회 시점 |  |
| `amplitude_id` | 외부 콘텐츠 조회 유저 amplitude_id |  |
| `user_id` | 외부 콘텐츠 조회 유저 user_id |  |
| `exContentId` | 외부 콘텐츠 ID |  |
| `platform` | 콘텐츠 노출 플랫폼 |  |
| `create_time` | 콘텐츠 등록 시점 |  |
| `tag` | 콘텐츠 등록 태그 |  |
| `content_title` | 콘텐츠 제목 |  |
| `creator_name` | 크리에이터 이름 |  |

</details>

### `커리어_wVideo_조회현황` — 커리어/콘텐츠

**설명:** 개별 영상 '카드 클릭' 현황 및 기타 정보 (ex. user_id, 글 제목, 태그)

_owner: hweejin@wantedlab.com_

<details><summary>컬럼 9개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `temp_id` | 개별 영상 카드 클릭 건 고유 id (주의 unique 값 아님) |  |
| `event_time` | 개별 영상 카드 클릭 시점 |  |
| `amplitude_id` | 개별 영상 카드 클릭 유저 amplitude_id |  |
| `user_id` | 개별 영상 카드 클릭 유저 user_id |  |
| `tag` | 관심 태그 |  |
| `tag_id` | 관심 태그 ID |  |
| `video_author` | 영상 연사 |  |
| `video_title` | 영상 제목 |  |
| `wVideoId` | 클릭한 개별 영상 ID (=media_content_key) |  |

</details>

### `커리어_콘텐츠조회_article` — 커리어/콘텐츠

**설명:** 콘텐츠조회_article : 아티클 조회

⚠️ **특이사항:** BI 대시보드 '커리어 콘텐츠 조회'의 raw data

_owner: hweejin@wantedlab.com_

<details><summary>컬럼 10개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `country` | 국가 (유저 ip 기반) |  |
| `event_time` | 조회 시점 |  |
| `content_title` | 콘텐츠 제목 |  |
| `content_kind` | 콘텐츠 종류 (VOD/vod_event/article/network/education/community/exContent/wVideo) |  |
| `amplitude_id` | amplitude_id (unique users 기준) |  |
| `event_key` | event 고유 식별자 (event_id 와 다름) |  |
| `prov_country` | event 페이지 제공 국가 |  |
| `content_id` | media_content_key 혹은 event_id |  |
| `user_id` | user_id |  |
| `platform` | WEB/Android/iOS |  |

</details>

### `커리어_콘텐츠조회_exContent` — 커리어/콘텐츠

**설명:** 콘텐츠조회_exContent : 외부(크롤링) 콘텐츠 조회

⚠️ **특이사항:** BI 대시보드 '커리어 콘텐츠 조회'의 raw data

_owner: hweejin@wantedlab.com_

<details><summary>컬럼 10개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `country` | 국가 (유저 ip 기반) |  |
| `event_time` | 조회 시점 |  |
| `prov_country` | 콘텐츠 제공 국가 |  |
| `content_title` | 콘텐츠 제목 |  |
| `content_kind` | 콘텐츠 종류 (VOD/vod_event/article/network/education/community/exContent/wVideo) |  |
| `service` | 콘텐츠 플랫폼 |  |
| `amplitude_id` | amplitude_id (unique users 기준) |  |
| `content_id` | media_content_key 혹은 event_id |  |
| `user_id` | user_id |  |
| `platform` | WEB/Android/iOS |  |

</details>

### `커리어_콘텐츠조회_network` — 커리어/콘텐츠

**설명:** 콘텐츠조회_network : 스터디살롱, 워크샵 등

⚠️ **특이사항:** BI 대시보드 '커리어 콘텐츠 조회'의 raw data

_owner: hweejin@wantedlab.com_

<details><summary>컬럼 10개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `country` | 국가 (유저 ip 기반) |  |
| `event_time` | 조회 시점 |  |
| `content_title` | 콘텐츠 제목 |  |
| `content_kind` | 콘텐츠 종류 (VOD/vod_event/article/network/education/community/exContent/wVideo) |  |
| `amplitude_id` | amplitude_id (unique users 기준) |  |
| `event_key` | event 고유 식별자 (event_id 와 다름) |  |
| `prov_country` | event 페이지 제공 국가 |  |
| `content_id` | media_content_key 혹은 event_id |  |
| `user_id` | user_id |  |
| `platform` | WEB/Android/iOS |  |

</details>

### `커리어_콘텐츠조회_VOD` — 커리어/콘텐츠

**설명:** 콘텐츠조회_VOD : 원티드 제작 영상 소개 페이지 클릭

⚠️ **특이사항:** BI 대시보드 '커리어 콘텐츠 조회'의 raw data

_owner: hweejin@wantedlab.com_

<details><summary>컬럼 8개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `country` | 국가 (유저 ip 기반) |  |
| `event_time` | 조회 시점 |  |
| `content_title` | 콘텐츠 제목 |  |
| `content_kind` | 콘텐츠 종류 (VOD/vod_event/article/network/education/community/exContent/wVideo) |  |
| `amplitude_id` | amplitude_id (unique users 기준) |  |
| `content_id` | media_content_key 혹은 event_id |  |
| `user_id` | user_id |  |
| `platform` | WEB/Android/iOS |  |

</details>

### `커리어_콘텐츠조회_vod_event` — 커리어/콘텐츠

**설명:** 콘텐츠조회_vod_event : VOD 무료 제공, 추천 관련 이벤트 페이지 조회

⚠️ **특이사항:** BI 대시보드 '커리어 콘텐츠 조회'의 raw data

_owner: hweejin@wantedlab.com_

<details><summary>컬럼 10개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `country` | 국가 (유저 ip 기반) |  |
| `event_time` | 조회 시점 |  |
| `content_title` | 콘텐츠 제목 |  |
| `content_kind` | 콘텐츠 종류 (VOD/vod_event/article/network/education/community/exContent/wVideo) |  |
| `amplitude_id` | amplitude_id (unique users 기준) |  |
| `event_key` | event 고유 식별자 (event_id 와 다름) |  |
| `prov_country` | event 페이지 제공 국가 |  |
| `content_id` | media_content_key 혹은 event_id |  |
| `user_id` | user_id |  |
| `platform` | WEB/Android/iOS |  |

</details>

### `커리어_콘텐츠조회_wVideo` — 커리어/콘텐츠

**설명:** 콘텐츠조회_wVideo : 개별 영상 카드 클릭

⚠️ **특이사항:** BI 대시보드 '커리어 콘텐츠 조회'의 raw data

_owner: hweejin@wantedlab.com_

<details><summary>컬럼 9개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `wVideoId` | 개별 영상 고유 ID (=media_content_key) |  |
| `country` | 국가 (유저 ip 기반) |  |
| `video_author` | 영상 연사 |  |
| `video_title` | 영상 제목 |  |
| `event_time` | 조회 시점 |  |
| `content_kind` | 콘텐츠 종류 (VOD/vod_event/article/network/education/community/exContent/wVideo) |  |
| `amplitude_id` | amplitude_id (unique users 기준) |  |
| `user_id` | user_id |  |
| `platform` | WEB/Android/iOS |  |

</details>

---

## 📦 `wanted_gigs` (40개 테이블)

### `admin_tags` 

**설명:** 어드민 태그 정보

_owner: 김선호 (SeonHo Kim)_

### `AdminTag` 

**설명:** 긱스 어드민 태그

_owner: 김선호 (SeonHo Kim)_

### `AdminUser` 

**설명:** 긱스 어드민 유저

_owner: 김선호 (SeonHo Kim)_

### `change_histories` 

**설명:** 변경 이력 정보

_owner: 김선호 (SeonHo Kim)_

### `ChangeHistory` 

**설명:** 긱스 변경 이력

_owner: 김선호 (SeonHo Kim)_

### `Client` 

**설명:** 긱스 클라이언트

_owner: 김선호 (SeonHo Kim)_

### `ClientReview` 

**설명:** 긱스 클라이언트 리뷰

_owner: 김선호 (SeonHo Kim)_

### `ContractClient` 

**설명:** 긱스 클라이언트 계약 요약

_owner: 김선호 (SeonHo Kim)_

### `ContractClientDetail` 

**설명:** 긱스 클라이언트 계약 상세

_owner: 김선호 (SeonHo Kim)_

### `ContractExpert` 

**설명:** 긱스 프리랜서 계약 요약

_owner: 김선호 (SeonHo Kim)_

### `ContractExpertDetail` 

**설명:** 긱스 프리랜서 계약 상세

_owner: 김선호 (SeonHo Kim)_

### `Estimate` 

**설명:** 긱스 프로젝트 예산

_owner: 김선호 (SeonHo Kim)_

### `Expert` 

**설명:** 긱스 프리랜서 (전문가)

_owner: 김선호 (SeonHo Kim)_

### `expert_level_histories` 

**설명:** 전문가 등급 히스토리

_owner: 김선호 (SeonHo Kim)_

### `ExpertAdminTag` 

**설명:** 긱스 프리랜서 어드민 태그

_owner: 김선호 (SeonHo Kim)_

### `ExpertGroup` 

**설명:** 긱스 프리랜서 그룹

_owner: 김선호 (SeonHo Kim)_

### `ExpertLevelHistory` 

**설명:** 긱스 프리랜서 등급 이력

_owner: 김선호 (SeonHo Kim)_

### `ExpertReview` 

**설명:** 긱스 프리랜서 리뷰

_owner: 김선호 (SeonHo Kim)_

### `experts` 

**설명:** 전문가 정보

_owner: 김선호 (SeonHo Kim)_

### `ExpertTag` 

**설명:** 긱스 프리랜서 태그 (스킬, 직군/직무)

_owner: 김선호 (SeonHo Kim)_

### `File` 

**설명:** 긱스 파일

_owner: 김선호 (SeonHo Kim)_

### `Match` 

**설명:** 긱스 지원서

_owner: 김선호 (SeonHo Kim)_

### `matches` 

**설명:** 매치 정보

_owner: 김선호 (SeonHo Kim)_

### `MatchTag` 

**설명:** 긱스 지원서 태그 (스킬, 직군/직무)

_owner: 김선호 (SeonHo Kim)_

### `Message` 

**설명:** 긱스 메세지 (메일, 문자)

_owner: 김선호 (SeonHo Kim)_

### `messages` 

**설명:** 메시지 정보 (메일, 문자, 메모 등)

_owner: 김선호 (SeonHo Kim)_

### `Notification` 

**설명:** 긱스 알림

_owner: 김선호 (SeonHo Kim)_

### `PartnerProduct` 

**설명:** 긱스 파트너 상품 요약

_owner: 김선호 (SeonHo Kim)_

### `PartnerProductRequest` 

**설명:** 긱스 파트너 상품 요청

_owner: 김선호 (SeonHo Kim)_

### `PrivacyHistory` 

**설명:** 긱스 개인정보 조회 이력

_owner: 김선호 (SeonHo Kim)_

### `Project` 

**설명:** 긱스 프로젝트

_owner: 김선호 (SeonHo Kim)_

### `ProjectAdvertising` 

**설명:** 긱스 프로젝트 광고

_owner: 김선호 (SeonHo Kim)_

### `ProjectBookmark` 

**설명:** 긱스 프로젝트 북마크

_owner: 김선호 (SeonHo Kim)_

### `projects` 

**설명:** 프로젝트 정보

_owner: 김선호 (SeonHo Kim)_

### `ProjectTag` 

**설명:** 긱스 프로젝트 태그 (스킬, 직군/직무)

_owner: 김선호 (SeonHo Kim)_

### `ResumeProject` 

**설명:** 긱스 프리랜서 프로젝트 경력 정보

_owner: 김선호 (SeonHo Kim)_

### `ResumeWork` 

**설명:** 긱스 프리랜서 근무 경력 정보

_owner: 김선호 (SeonHo Kim)_

### `Tag` 

**설명:** 긱스 태그 (스킬, 직군/직무)

_owner: 김선호 (SeonHo Kim)_

### `User` 

**설명:** 긱스 유저 기본 정보

_owner: 김선호 (SeonHo Kim)_

### `WorkScope` 

**설명:** 긱스 세부 업무 범위서

_owner: 김선호 (SeonHo Kim)_

---

## 📦 `analytics_mart` (33개 테이블)

### `company_en` 

**설명:** (언어값=영어) 원티드 기업사 기본 정보

_owner: 최자연 (Jayeon Choi)_

### `company_first_hire` 

**설명:** 기업 별 최초 합격 지원건 데이터

_owner: 최자연 (Jayeon Choi)_

### `company_ja` 

**설명:** (언어값=일본어) 원티드 기업사 기본 정보

_owner: 최자연 (Jayeon Choi)_

### `company_ko` 

**설명:** (언어값=한국어) 원티드 기업사 기본 정보

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 19개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `company_id` | PK; |  |
| `country` | 국가 |  |
| `owner_id` | 대표 유저 ID |  |
| `create_time` | 생성일자 (UTC기준) |  |
| `founded_year` | 설립연도 |  |
| `investment_number` | 매출액/투자금액 |  |
| `company_confirm` | 승인여부 |  |
| `company_size` | 원티드 기업규모; wanteddb.company_des.company_size |  |
| `is_black` | 블랙기업 여부 |  |
| `is_visible` | 노출여부 |  |
| `confirm_time` | 기업 승인 일시 (UTC기준), 과거 승인 이력이 있더라도 마지막 승인일시로 덮어써짐. |  |
| `kj_id` | 크레딧잡 id. 이 컬럼과 매핑되는 key 정보: https://wantedlab.atlassian.net/wiki/spaces/DATA/pages/3274113311/kj_new |  |
| `priority` | 언어우선순위; wanteddb.company_detail.priority |  |
| `lang` | 언어 |  |
| `company_name` | 기업명 |  |
| `description` | 기업 설명 |  |
| `first_active_external_position_create_time` | 기업의 외부 포지션이 처음 생성된 일자 |  |
| `first_position_active_time` | 기업의 포지션이 처음 active된 일자 |  |
| `first_position_request_time` | 기업의 포지션이 처음 request된 일자 |  |

</details>

### `company_salary_history` 

**설명:** 기업의 소스별 결산월별 평균 연봉 데이터

_owner: 이상인 (Lee Sangin)_

<details><summary>컬럼 7개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `company_salary_history_id` | 테이블 id |  |
| `regNoHash` | 원티드인사이트 기업id |  |
| `company_id` | 원티드 기업id |  |
| `logical_date` | 결산일자(YYYY-MM-01) |  |
| `salary` | 평균 연봉 |  |
| `currency` | 화폐단위 |  |
| `source` | 데이터 출처(금감원, 국민연금) |  |

</details>

### `company_tw` 

**설명:** (언어값=대만어) 원티드 기업사 기본 정보

_owner: 최자연 (Jayeon Choi)_

### `concurrent_apply` 

**설명:** 동시지원 정보

_owner: 최자연 (Jayeon Choi)_

### `hidden_hires` 

**설명:** 숨은합격건의 apply_id들. 자동업데이트 되는 테이블은 아니고, 가끔 성여운이 업데이트한다. privacy 권한 필요.

_owner: 성여운(Yeouhn Sung)_

### `job_category` 

**설명:** 직군 목록

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 6개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `EN` | 직군 영문번역값 |  |
| `JP` | 직군 일어번역값 |  |
| `CN` | 직군 중어번역값 |  |
| `TW` | 직군 중어번역값(대만) |  |
| `KR` | 직군 한글번역값 |  |
| `job_category_id` | 직군 ID |  |

</details>

### `job_role` 

**설명:** 직무 목록

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 7개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `EN` | 직군 영문번역값 |  |
| `JP` | 직군 일어번역값 |  |
| `CN` | 직군 중어번역값 |  |
| `TW` | 직군 중어번역값(대만) |  |
| `KR` | 직군 한글번역값 |  |
| `job_category_id` | 직군 ID |  |
| `job_role_id` | 직무 ID |  |

</details>

### `live_position_history` 

**설명:** cdc 에서 추출한 포지션의 라이브 여부 모든 히스토리
wanted_mart.live_position_history를 대체함

_owner: 유지윤 (Jiyoon You)_

<details><summary>컬럼 3개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `owner_id` | 담당자 유저 ID |  |
| `position_id` | 상태 변경 포지션 ID |  |
| `timestamp` | 포지션 상태 변경 시점(timestamp), KST기준 |  |

</details>

### `position_en` 

**설명:** (언어값=영어)포지션 정보

_owner: 최자연 (Jayeon Choi)_

### `position_ja` 

**설명:** (언어값=일본어)포지션 정보

_owner: 최자연 (Jayeon Choi)_

### `position_tw` 

**설명:** (언어값=대만어)포지션 정보

_owner: 최자연 (Jayeon Choi)_

### `resume_history` 

**설명:** 이력서(원티드이력서 + 지원자 PDF)
이력서 히스토리성 테이블(이력서를 수정하면 PDF가 새로생성됨)
지원기록에 지원 당시의 이력서를 join할 땐 resume말고 이 테이블을 사용할 것.

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 12개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `resume_id` | PK |  |
| `wanted_resume_id` | 이 이력서가 원티드 이력서인 경우, 원티드 이력서의 id (wanted_resume.id와 join하는 컬럼) |  |
| `user_id` | user ID |  |
| `content_type` | 이력서 타입 |  |
| `character_count` | 이력서의 문자 길이 글자수 (원티드 레주메, docx, pdf) ※ 공백, 개행, 템플릿 글자 수가 포함된 값. |  |
| `wanted_resume_title` | 원티드 이력서 제목 |  |
| `wanted_resume_lang` | 원티드 이력서 언어 |  |
| `is_complete` | 작성완료 여부 |  |
| `is_matching` | 기본 이력서 (기본 이력서 ✅ 뱃지) |  |
| `create_time` | 이력서 생성 시간 (UTC기준) |  |
| `delete_time` | 이력서 수정/삭제 시간 (UTC기준); null일 경우 최신 이력서 |  |
| `wanted_resume_create_time` | 원티드 이력서 생성 시간 (UTC기준) |  |

</details>

### `resume_relations` 

**설명:** resume <> apply 간 join 용 테이블

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 2개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `apply_id` | apply ID |  |
| `resume_id` | resume ID |  |

</details>

### `tag_position_category` 

**설명:** 채용공고(포지션) 직군 정보

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 8개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `position_id` | FK; position ID |  |
| `tag_position_category_id` | PK; wanteddb.tag.id와 동일 |  |
| `tag_type_id` | 채용공고(포지션) 직군ID; wanteddb.tag_type.id와 동일 |  |
| `CN` | 채용공고(포지션) 직군명 CN |  |
| `EN` | 채용공고(포지션) 직군명 EN |  |
| `JP` | 채용공고(포지션) 직군명 JP |  |
| `KR` | 채용공고(포지션) 직군명 KR |  |
| `TW` | 채용공고(포지션) 직군명 TW |  |

</details>

### `tag_position_role` 

**설명:** 채용공고(포지션) 직무 정보

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 8개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `position_id` | FK; position ID |  |
| `tag_position_role_id` | PK; wanteddb.tag.id와 동일 |  |
| `tag_type_id` | 채용공고(포지션) 직무ID; wanteddb.tag_type.id와 동일 |  |
| `CN` | 채용공고(포지션) 직무명 CN |  |
| `EN` | 채용공고(포지션) 직무명 EN |  |
| `JP` | 채용공고(포지션) 직무명 JP |  |
| `KR` | 채용공고(포지션) 직무명 KR |  |
| `TW` | 채용공고(포지션) 직무명 TW |  |

</details>

### `tag_type` 

**설명:** 원티드 내 각종 분류항목 목록(직군, 직무, 스킬, 산업군, 이벤트태그 등)
wanted_mart.tag_type을 대체함

_owner: 이상인 (Lee Sangin)_

<details><summary>컬럼 7개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `tag_type_id` | tag_type id |  |
| `KR` | tag_type 한글번역값 |  |
| `EN` | tag_type 영문번역값 |  |
| `JP` | tag_type 일어번역값 |  |
| `TW` | tag_type 대만번역값 |  |
| `CN` | tag_type 중문번역값 |  |
| `type_name` | 태그 종류(스킬:skill, 직군:job_category, 직무:job_role, (구)산업군:industry(old), 지역:region, 문화/복지:culture, 산업군:industry, 이벤트메뉴:event_menu, 이벤트태그:event_tag, 관심분야:interest, 큐레이션태그:curation, 그 외:others) |  |

</details>

### `tag_user_role` 

**설명:** 유저 직무 정보

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 8개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `user_id` | FK; user ID |  |
| `tag_user_role_id` | PK; wanteddb.tag.id와 동일 |  |
| `tag_type_id` | 유저 직무ID; wanteddb.tag_type.id와 동일 |  |
| `CN` | 유저 직무명 CN |  |
| `EN` | 유저 직무명 EN |  |
| `JP` | 유저 직무명 JP |  |
| `KR` | 유저 직무명 KR |  |
| `TW` | 유저 직무명 TW |  |

</details>

### `user_id_relations` 

**설명:** 서비스별 유저 아이디 모음 테이블

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 2개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `oneid_user_id` | oneid.user.oneId와 동일 |  |
| `wanted_user_id` | wanteddb.user.id와 동일 |  |

</details>

### `user_marketing_notification` 

**설명:** 유저 마케팅 수신 동의 데이터

_owner: 최자연 (Jayeon Choi)_

### `user_salary_history` 

**설명:** 유저의 출처(건강보험, 원티드합격자, 원티드프로필) 별 연봉 데이터

_owner: 이상인 (Lee Sangin)_

<details><summary>컬럼 7개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `user_salary_history_id` | id |  |
| `user_id` | 유저id |  |
| `logical_date` | nhis: 고지날짜, 합격자: 입사날짜, 프로필: 입력날짜 |  |
| `salary_min` | 연봉 범위 최소값 |  |
| `salary_max` | 연봉 범위 최대값. union_salary.salary를 100만원 단위로 올림해 산출. 원천은 external.nhis_salary, wanteddb.hiring_processing, wanteddb.user_pref. |  |
| `currency` | 화폐단위 |  |
| `source` | 데이터 출처(건강보험(경력인증), 합격정보, 프로필) |  |

</details>

### `apply` — 채용/공통

**설명:** 지원내역

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 39개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `status` | 지원서 상태(apply.status). 유저발 apply는 status < 100, 매치업/지원제안 등 기업 제안 흐름은 status >= 100. 이 값은 진행 상황에 따라 덮어쓰기되며, 보통 작은 숫자에서 큰 숫자로 이동한다. 예: 기업 열람은 100(PROPOSAL_OPEN), 제안 발송은 101(PROPOSAL_OFFER)이므로 열람 건 중 제안받은 비율은 status = 101 / status = 100이 아니라 status >= 101 / status >= 100 기준으로 계산해야 한다. status enum: - -1 NONE: 데이터 없음 - 1 WRITE: 지원서 작성 시작(현재는 미입력일 수도 있음) - 2 COMPLETE: 지원서 제출 완료 - -2 BLACK_WAIT: 블랙 지원서 제출 완료, 승인 대기(16년 이후 없음) - -3 MATCHING_WAIT: 매칭 완료, 승인 대기(18년 이후 없음) - -4 MATCHING_REJECT: 기업 매칭 거절, 관심없음/불만족(18년 이후 없음) - -5 MATCHING_USER_REJECT: 기업에서 면접제의 후 유저 매칭 거절(18년 이후 없음) - 4 DING: 원티드에서 딩 시키는 경우(19년 이후 없음) - 5 SEND: 원티드에서 회사쪽에 보낸 이후 - 3 REJECT: 회사에서 서류에서 거른 경우 - 6 PASS: 서류통과하고 면접 단계로 간 경우 - 10 OVERDUE: 원티드에서 회사쪽에 보낸 이후 한달동안 응답이 없어 기간만료 - 9 PASS_REJECT: 서류통과하고 면접 봤는데 떨어진 경우(pass_time NULL 여부로 판단) - 8 HIRE: 최종합격 - 100 PROPOSAL_OPEN: 열람 - 101 PROPOSAL_OFFER: 제안 - 102 PROPOSAL_OFFER_CANCEL: 제안 취소(데이터 없음) - 103 PROPOSAL_USER_CHECK: 유저 제안 확인 - 104 PROPOSAL_USER_ACCEPT: 유저 제안 수락 = 서류 통과 - 105 PROPOSAL_USER_ACCEPT_CANCEL: 유저 제안 수락 취소(데이터 없음) - 106 PROPOSAL_USER_REJECT: 유저 제안 거절 - 107 PROPOSAL_USER_EXPIRED_REJECT: 유저 기간 만료 거절 - 108 PROPOSAL_INTERVIEW_REJECT: 면접 후 거절 - 109 PROPOSAL_HIRE: 채용 - 110 PROPOSAL_OVERDUE: 회사 응답 기간 만료(18년 이후 없음) - 111 PROPOSAL_USER_APPLY: 유저 지원 제안 수락 = 지원서 접수(지원제안에서만 사용) - 112 PROPOSAL_RESUME_PASS: 유저 지원 제안 수락 후 서류 통과(지원제안에서만 사용) 값 설명 컨플: https://wantedlab.atlassian.net/wiki/spaces/servercircle/pages/2530279468/apply+status |  |
| `recommender_email` | 추천인 email | email |
| `user_name` | 지원 시점의 이름 | name |
| `rejector_id` | 거절 버튼 누른 사용자 id |  |
| `chk_time` | 기업 전송 시간 (UTC기준) |  |
| `is_concurrent` | 동시지원여부,  0: 일반지원 1: 동시지원 |  |
| `dinger_id` | 딩 버튼 누른 사용자 id |  |
| `status_reward` | 보상금 신청 상태 |  |
| `created_time` | DB에 row 생성시간, 실제 지원한 시간 아님 (UTC기준) |  |
| `pass_time` | 서류통과 시간, 서류합격시간 (UTC기준). 보통 "서류통과수", "서류합격수"를 구할 땐 where pass_time is not null 조건으로 구한다. 숨합, ATS(그리팅, 나인하이어) 합격건은 pass_time이 남지 않음 |  |
| `passer_id` | 서류합격 버튼 누른 사용자 id |  |
| `edited_time` | 수정시간 (UTC기준) |  |
| `user_country` | - 원천: `wanteddb.user.country` 값을 별도 정규화 없이 그대로 적재한 컬럼입니다. - 실제 값 규칙: 대문자 국가코드 계열 값이 들어오며, `NULL`, `WW` 같은 값도 존재합니다. - 실제 확인된 대표 값: `KR`, `SG`, `TW`, `HK`, `WW`, `JP`, `US` - 한국 사용자 필터가 필요하면 기본적으로 `user_country = 'KR'`를 사용하세요. |  |
| `user_annual` | 유저의 연차; user.annual, null일 경우 탈퇴, 휴면, 미입력. 0일 경우 신입. 유저가 입력한 값 + (연중 수정 안했을 시) 해가 넘어갈 때 +1됨 |  |
| `resume_time` | 이력서 업로드 시간 (UTC기준) |  |
| `resume_ok` | 이력서 업로드 완료 여부 |  |
| `auto_reject_time` | 자동 불합격된 시간 (UTC기준) |  |
| `sender_id` | 전송 버튼 누른 사용자 id |  |
| `position` | 지원 당시의 포지션명 |  |
| `company_name` | 지원 당시의 회사명 |  |
| `cancel_reason` | 지원 취소 사유 |  |
| `country` | 지원당시 유저 국가정보 |  |
| `apply_type` | 지원서 상태. 일반지원(일반적으로 말하는 '지원'은 해당 타입을 의미함)  / 매치업 선과금 / 매치업 무제한 / 외부지원 |  |
| `open_time` | 지원서를 최초에 열어본 시간 (UTC기준) |  |
| `apply_time` | 지원시간. 지원완료시간; 지원하기 버튼을 눌렀을 때 기록되는 시간, 제출하기 버튼을 눌렀을 때(덮어써짐) (UTC기준) |  |
| `cancel_time` | 지원취소시간 (UTC기준) |  |
| `apply_device` | 지원한 디바이스 (모바일? 컴퓨터?) |  |
| `platform` | 지원한 플랫폼 (안드? ios? 웹?) |  |
| `hire_time` | 채용시간 (UTC기준).보통 "합격수", "최종합격수", "채용수"를 구할 땐 where hire_time is not null 조건으로 구한다. |  |
| `is_recommendation` | 추천사 내용 |  |
| `recommendation_time` | 추천한 시간 (UTC기준) |  |
| `reject_message` | 탈락 메시지 |  |
| `reject_time` | 탈락시간 (UTC기준) |  |
| `hirer_id` | 합격을 시킨 user id |  |
| `recommender_id` | FK; 지원자의 추천인 ID; user 테이블의 ID |  |
| `company_id` | FK; company 테이블의 ID |  |
| `position_id` | FK; position 테이블의 ID |  |
| `user_id` | FK; user 테이블의 ID |  |
| `apply_id` | PK |  |

</details>

### `position_ko` — 채용/기업

**설명:** (언어값=한국어)포지션 정보

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 15개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `job_category_id` | 직군 ID |  |
| `job_role_id` | 직무ID (복수개 설정 가능 & ,로 구분) |  |
| `company_country` | - 원천: `wanteddb.company_address.country` 값을 별도 정규화 없이 그대로 적재한 컬럼입니다. - 실제 값 규칙: 대문자 국가코드가 아니라 소문자 계열 값이 들어오며, `others` 값도 존재합니다. - 실제 확인된 대표 값: `kr`, `jp`, `sg`, `tw`, `hk`, `others` - 따라서 이 컬럼에는 `company_country != 'KR'` 같은 대문자 비교식을 사용하면 안 됩니다. - 한국 포지션 필터가 필요하면 `company_country = 'kr'` 또는 `LOWER(company_country) = 'kr'` 형태를 사용하세요. - 이 컬럼을 `analytics_mart.apply.user_country`와 함께 쓸 때는 casing convention이 다르므로 그대로 비교하지 말고 먼저 정규화해서 비교해야 합니다. - `others`는 실제로 존재하는 별도 값입니다. 기본적으로 자동으로 “해외”로 간주하지 말고, 분석 목적상 포함 여부를 명시적으로 결정해야 합니다. |  |
| `status` | 포지션 상태. 'active'인 것들만 라이브(live) 상태인 포지션이다. |  |
| `create_time` | 포지션 생성일자 (UTC기준) |  |
| `position_skills` | 포지션 스킬 (,로 구분) |  |
| `confirm` | 포지션 승인여부 |  |
| `confirm_time` | 포지션 승인일자 (UTC기준) |  |
| `company_id` | FK; company ID |  |
| `company_name` | 기업명 |  |
| `position_id` | PK |  |
| `position_name` | 포지션명 |  |
| `jd` | 포지션 내용 |  |
| `annual_from` | 포지션 최소요구연차 |  |
| `annual_to` | 포지션 최대요구연차 |  |

</details>

### `position_openclose_history` — 채용/기업

**설명:** 포지션 첫 승인, 채용 종료 후 승인, 채용 종료 history
wanted_mart.position_openclose_history, query_results.position_openclose_history를 대체한다

_owner: 이상인 (Lee Sangin)_

<details><summary>컬럼 6개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `timestamp` | 포지션 상태 변경 시점(timestamp) |  |
| `position_id` | 상태 변경 포지션 ID |  |
| `owner_id` | 담당자 유저 ID |  |
| `before_status` | 변경 전 상태값 |  |
| `after_status` | 변경 후 상태값 |  |
| `status` | 변경 후 포지션 노출 여부 |  |

</details>

### `resume` — 채용/유저

**설명:** 이력서(원티드이력서 + 지원자 PDF)
resume_history테이블과의 차이: wanted_resume_id기준 최신 이력서만 확인되는 테이블

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 13개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `is_matching` | 기본 이력서 (기본 이력서 ✅ 뱃지) |  |
| `wanted_resume_create_time` | 원티드 이력서 생성 시간 (UTC기준) |  |
| `wanted_resume_lang` | 원티드 이력서 언어 |  |
| `resume_title` | 원티드 이력서 제목 |  |
| `wanted_resume_id` | 이 이력서가 원티드 이력서인 경우, 원티드 이력서의 id (wanted_resume.id와 join하는 컬럼) |  |
| `delete_time` | 이력서 수정/삭제 시간 (UTC기준) |  |
| `create_time` | 이력서 생성 시간 (UTC기준) |  |
| `content_type` | 이력서 타입 |  |
| `character_count` | 이력서의 문자 길이 글자수 (원티드 레주메, docx, pdf) ※ 공백, 개행, 템플릿 글자 수가 포함된 값. |  |
| `is_complete` | 작성완료 여부 |  |
| `resume_id` | PK |  |
| `user_id` | user ID |  |
| `is_certificated` | 경력인증여부컬럼; 해당 이력서에 경력인증이 한 건이라도 있으면 1, 아니면 0 wanteddb.user_career.certificated_user_career_id 컬럼의 null 또는 id값과 동일함 |  |

</details>

### `resume_detail` — 채용/유저

**설명:** 이력서 상세; 이력서 글자 수 + 앰플리튜드 정보

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 5개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `amp_resume__complete__click_date` | 앰플리튜드에서 "resume__complete__click" 이벤트를 클릭한 일자 |  |
| `amp_platform` | 앰플리튜드에서 "resume__complete__click" 이벤트를 클릭한 플랫폼 |  |
| `wanted_resume_text_length` | 원티드 이력서 문자 길이 |  |
| `wanted_resume_id` | FK; wanted_resume ID |  |
| `resume_detail_id` | PK |  |

</details>

### `tag_user_category` — 채용/유저

**설명:** 유저 직군 정보

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 8개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `user_id` | FK; user ID, analytics_mart.user 과 조인하여 유저의 직군 추출 가능 |  |
| `tag_user_category_id` | PK; wanteddb.tag.id와 동일 |  |
| `tag_type_id` | 유저 직군ID; wanteddb.tag_type.id와 동일 |  |
| `CN` | 유저 직군명 CN |  |
| `EN` | 유저 직군명 EN |  |
| `JP` | 유저 직군명 JP |  |
| `KR` | 유저 직군명 KR |  |
| `TW` | 유저 직군명 TW |  |

</details>

### `user` — 채용/유저

**설명:** 원티드 유저 (이름, 이메일, 번호, 연차, 국가, 상태, 프로필 레벨, 접속시간 등)

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 25개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `email` | 유저 이메일; null값의 경우 휴면/탈퇴유저 | email |
| `name` | 유저이름; null값의 경우 휴면/탈퇴유저 | name |
| `mobile` | 핸드폰번호; null값의 경우 휴면/탈퇴유저 | phone number |
| `create_time` | 가입일자 (UTC기준) |  |
| `annual` | 경력 년수; null값의 경우 휴면/탈퇴유저. 유저가 입력한 값 + (연중 수정 안했을 시) 해가 넘어갈 때 +1됨 |  |
| `job_search_intention` | 구직 관심여부. (INTERST, NOW, NO) |  |
| `is_corporate` | 기업 연결 여부 (기업회원인 경우) |  |
| `amp_last_event_time` | 마지막 이벤트 시간. 유저가 서비스에서 마지막으로 액션 한 시간(=amplitude.www의 max(event_time), UTC기준) |  |
| `last_ip` | 마지막 접속 ip; null값의 경우 탈퇴유저 |  |
| `amp_country` | 앰플리튜드 국가 |  |
| `amp_city` | 앰플리튜드 도시 |  |
| `lang` | 언어; null값의 경우 탈퇴유저 22/11/24 SPOTLIGHT 배포로 원티드 글로벌 (wanted.jobs)에 접속한 유저는 SPOTLIGHT DB로 이동 |  |
| `corporate_name` | 연결 기업 이름 (기업회원인 경우. like 인담자) |  |
| `corporate_id` | 연결된 기업 ID (기업회원인 경우. like 인담자) |  |
| `oneid_id` | 원아이디 |  |
| `is_tester` | 원티드유저&테스터 여부 |  |
| `profile_id` | 유저 프로필 ID; hq 내 매치업 번호 값; null값의 경우 탈퇴유저 |  |
| `is_accept_event_email` | 이벤트 메일 수신 동의 |  |
| `country` | 접속 국가; null값의 경우 휴면/탈퇴유저 22/11/24 SPOTLIGHT 배포로 원티드 글로벌 (wanted.jobs)에 접속한 유저는 SPOTLIGHT DB로 이동 |  |
| `c_apply` | 지원 횟수 |  |
| `leave_time` | 탈퇴일자 (UTC기준) |  |
| `is_accept_event_push` | 푸쉬 알람 동의 |  |
| `profile_level` | 프로필 레벨 |  |
| `status` | 활성유저 유무; 0: 탈퇴유저, 1: 활성유저, 2: 휴면(last_login_time 기준 1년이상 접속X)유저 |  |
| `user_id` | PK |  |

</details>

### `event` — 커리어/콘텐츠

**설명:** 이벤트 정보 - 이름, 진행 국가, 결제타입, 노출여부, 시작일시 등

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 19개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `is_privacy_required` | 개인정보 동의 필수 여부 |  |
| `payment_type` | 결제타입; regular: 정기결제, wanted: 유료, free: 유료 |  |
| `is_count_visible` | 남은 인원 노출 여부 |  |
| `is_visible` | 노출여부 |  |
| `is_closed` | 닫힘 여부; 0: 닫힘, 1: 열림 |  |
| `is_sms` | 문자 발송 여부 |  |
| `detail_profile` | 신청 시 Lv3+ 프로필 필수 여부 |  |
| `is_online` | 온라인 여부 |  |
| `end_date` | 이벤트 마감 일시 (UTC기준) |  |
| `create_date` | 이벤트 생성 일시 (UTC기준) |  |
| `update_date` | 이벤트 수정 일시 (UTC기준) |  |
| `start_date` | 이벤트 시작 일시 (UTC기준) |  |
| `event_country` | 이벤트 진행 국가 |  |
| `event_title` | 이벤트명 |  |
| `organizer` | 주최자 |  |
| `is_resume_option_required` | 첨부파일 필수 여부 |  |
| `key` | 커리어 성장 컨텐츠의 url 'event/key' 형식으로 붙음 |  |
| `is_home_visible` | 홈 노출여부 |  |
| `event_id` | PK |  |

</details>

### `event_registration` — 커리어/콘텐츠

**설명:** 이벤트 신청자, 신청 상태, 결제 정보

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 5개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `status` | 결제 상태 |  |
| `event_id` | event ID |  |
| `order_id` | order ID |  |
| `event_registration_id` | PK |  |
| `user_id` | user ID |  |

</details>

### `order` — 커리어/콘텐츠

**설명:** 이벤트 결제 관련 정보

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 11개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `status` | 결재상태 |  |
| `pay_time` | 결재시간 (UTC기준) |  |
| `total_amount` | 전체 결제금액 |  |
| `canceled_time` | 취소시간 (UTC기준) |  |
| `point_amount` | 포인트 사용금액 |  |
| `total_discount_amount` | 할인 금액 |  |
| `currency` | 화폐단위 |  |
| `total_refund_amount` | 환불 금액 |  |
| `company_id` | company ID |  |
| `order_id` | PK |  |
| `user_id` | user ID |  |

</details>

---

## 📦 `query_results` (32개 테이블)

### `applications_per_position` 

**설명:** 포지션 당 평균 지원 수

_owner: 이상인 (Lee Sangin)_

<details><summary>컬럼 5개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `week` | 주차 |  |
| `apply_avg` | 포지션 당 지원 수 |  |
| `apply_std` | 포지션 당 지원 수 표준편차 |  |
| `avg_plus_1std` | 지원 평균 상위 15% 기업이 받는 포지션 당 지원 수 |  |
| `avg_plus_2std` | 지원 평균 상위 2% 기업이 받는 포지션 당 지원 수 |  |

</details>

### `apply_threshold_by_companysize` 

**설명:** 반기, 기업 규모 별 공고 적정지원 수, AI0.5이상 적정지원 수 데이터

_owner: 이상인 (Lee Sangin)_

<details><summary>컬럼 9개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `standard_date` | yyyy-hh (년-반기) |  |
| `company_size` | 기업 규모 |  |
| `company_cnt` | 기업 수 |  |
| `hire_cnt` | 합격 수 |  |
| `applycnt_til_hire` | 포지션 별 적정 지워 수 |  |
| `applyai5cnt_til_hire` | 포지션 별 적정 AI 0.5 이상 지원 수 |  |
| `days_to_hire` | 공고 승인 후 첫 합격까지 걸린 시간 |  |
| `days_to_meet_hiredapplications` | 공고 승인 후 (첫 합격을 발생시킨) 지원건을 만난 시간 |  |
| `days_hiredapplications_apply_to_hire` | (첫 합격을 발생시킨) 지원건이 지원 이후 합격까지 걸린 시간 |  |

</details>

### `company_attraction_tag` 

**설명:** 기업 매력태그

_owner: 성여운(Yeouhn Sung)_

<details><summary>컬럼 2개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `tag_type_id` | 매력태그id |  |
| `tag_name` | 매력태그 |  |

</details>

### `company_growth` 

**설명:** IR용 - 기업 종사자,입사자의 증감 수/증감률 (마지막 국민연금 데이터 업데이트 월 기준)

_owner: 이상인 (Lee Sangin)_

<details><summary>컬럼 12개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `date` | 국민연금 데이터 최신 업데이트 날짜(년월) |  |
| `industry` | 산업군 |  |
| `company_id` | 기업 id (크레딧잡 companyId) |  |
| `company_name` | 기업명 |  |
| `c_employee` | 종사자 수 |  |
| `c_employee_b1m` | 전월 종사자 수 |  |
| `c_employee_mom` | 전월 대비 증감 수 |  |
| `employee_mom` | 전월 대비 증감률(MoM) |  |
| `c_hired` | 입사자 수 |  |
| `c_hired_b1m` | 전월 입사자 수 |  |
| `c_hired_mom` | 전월 대비 증감 수 |  |
| `hired_mom` | 전월 대비 증감률(MoM) |  |

</details>

### `industry_stats` 

**설명:** IR용 - 산업군 별 산업장 수, 입사자 수, 퇴사자 수 (& MoM, YoY)

_owner: 이상인 (Lee Sangin)_

<details><summary>컬럼 9개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `industry` | 산업군 |  |
| `date` | 국민연금 데이터 업데이트 날짜(년월) |  |
| `c_company` | 산업장 수 |  |
| `c_hired` | 입사자 수 |  |
| `c_left` | 퇴사자 수 |  |
| `hired_mom` | 입사자 MoM (전월 대비 증감률) |  |
| `left_mom` | 퇴사자 MoM (전월 대비 증감률) |  |
| `hired_yoy` | 입사자 YoY (전년 동월 대비 증감률) |  |
| `left_yoy` | 퇴사자 YoY (전년 동월 대비 증감률) |  |

</details>

### `insight_user_review_apply` 

**설명:** [인사이트] 다녀본리뷰, 면접리뷰를 작성한 유저의 (원티드에서의) 지원 이력 데이터

_owner: 이상인 (Lee Sangin)_

<details><summary>컬럼 10개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `user_id` | 인사이트 유저아이디 |  |
| `isexist_companyreview` | 다녀본리뷰(워라벨, 기업문화, 스킬툴) 중 1개 이상 작성 여부 |  |
| `companyreview_date` | 다녀본리뷰 최초 작성 일자 |  |
| `isexist_interviewreview` | 면접리뷰 1개 이상 작성 여부 |  |
| `interviewreview_date` | 면접리뷰 최초 작성 일자 |  |
| `isexist_allreview` | 다녀본리뷰 and 면접리뷰 작성 여부 |  |
| `isexist_board` | 잡담 작성 여부 |  |
| `board_date` | 잡담 작성 일자 |  |
| `apply_cnt` | (리뷰 작성 이후) 지원 횟수 |  |
| `apply_company_cnt` | (리뷰 작성 이후) 지원한 회사 수 |  |

</details>

### `jira_crt_report` 

**설명:** 크리에이티브팀 (CRT) 지라 리포트 테이블

_owner: 최종원 Jongwon Choi_

<details><summary>컬럼 13개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `assignee` | 담당자 |  |
| `design_enddate` | 디자인 완료일 |  |
| `reporter` | 보고자 |  |
| `status` | 상태 |  |
| `creator` | 생성자 |  |
| `description` | 설명 |  |
| `summary` | 요약 |  |
| `image_resource_link` | 이미지 리소스 링크 |  |
| `created` | 이슈 생성시간 |  |
| `resolution` | 이슈 해결 시간 |  |
| `datetime` | 이슈가 생성될 때, 칸반사이를 이동할 때 발생하는 한국시간 |  |
| `text_resource_link` | 텍스트 리소스 링크 |  |
| `publish_date` | 행사 공개일 |  |

</details>

### `jira_desc` 

**설명:** 지라 성과 보고서용 테이블

_owner: 최종원 Jongwon Choi_

### `jumpit` 

**설명:** DATARQ-2225

_owner: 최종원 Jongwon Choi_

### `kj_pv_uniq` 

**설명:** 크레딧잡 유니크 유저 페이지 뷰

_owner: 최종원 Jongwon Choi_

<details><summary>컬럼 3개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `counts` | 앰플리튜드 기준 유니크 페이지 뷰 |  |
| `event_date` | 이벤트 일자 |  |
| `kj_company_name` | 크레딧잡 기업명 |  |

</details>

### `live_position_w_data` 

**설명:** 현 라이브 포지션의 지원 수, AI0.5이상 지원 수, 승인 일자 (query_results.live_position_w_standard의 재료)

_owner: 이상인 (Lee Sangin)_

<details><summary>컬럼 5개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `date` | 라이브 일자 |  |
| `position_id` | 포지션 id |  |
| `open_date` | 포지션 승인 일자 |  |
| `apply_cnt` | 포지션 승인 후 지원 수 |  |
| `apply_aiover_cnt` | 포지션 승인 후 AI 0.5 이상 지원 수 |  |

</details>

### `live_position_w_standard` 

**설명:** 현 라이브 포지션의 적정지원 수/AI0.5이상 적정지워 수/최신성 충족 여부

_owner: 이상인 (Lee Sangin)_

<details><summary>컬럼 8개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `date` | 라이브 일자 |  |
| `position_id` | 포지션 id |  |
| `is_over_apply_threshold` | 적정지원 수 충족여부 (적정지원 수 기준 : query_results.apply_threshold_by_companysize) |  |
| `is_over_aiapply_threshold` | 적정 AI 0.5 이상 지원 수 충족 여부 |  |
| `is_recent` | 3개월 내 승인(첫 승인, 채용 종료 후 재승인) 여부 |  |
| `apply_cnt` | 포지션 승인 후 지원 수 |  |
| `apply_aiover_cnt` | 포지션 승인 후 AI 0.5 이상 지원 수 |  |
| `open_date` | 포지션 승인 일자 |  |

</details>

### `MKT_remarketing_feed` 

**설명:** DATARQ-2732

_owner: 최종원 Jongwon Choi_

<details><summary>컬럼 7개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `description` | 임의의 문구 입력 |  |
| `Image_URL` | Recommended \| Format: JPG, JPEG, GIF, or PNG \| if JPG, JPEG, or GIF must be used, image must be saved in RGB color code with an ICC profile attached to it. Recommended image size: 300 pixels x 300 pixels. Resolution: 72 dpi. Max file size: 12MB \| Image used in ad |  |
| `Subtitle` | Recommended \| String. Any sequence of letters and digits. \| Can be displayed in ad. Recommended maximum length is 25 characters (12 for double-width languages) |  |
| `Category` | Recommended \| String. Any sequence of letters and digits. \| Used to group like items together for recommendation engine |  |
| `Final_URL` | Recommended; Required if not using Destination URL \| Same domain as your website, begins with ""http://"" or ""https://"" \| The URL of the page in your website that people reach when they click your ad |  |
| `Job_ID` | Required (Primary Key) \| String. Any sequence of letters and digits. |  |
| `Title` | Required \| String. Any sequence of letters and digits. \| Can be displayed in ad. Recommended maximum length is 25 characters (12 for double-width languages) |  |

</details>

### `my_query_history` 

**설명:** 나(=사용자)가 빅쿼리에서 실행한 쿼리들의 감사로그.

_owner: 성여운(Yeouhn Sung)_

<details><summary>컬럼 4개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `timestamp` | 내가 빅쿼리에서 쿼리를 실행한 시간 |  |
| `principalEmail` | 쿼리를 실행한 사람의 이메일주소 (=회사 g suite 계정) |  |
| `query` | 내가 실행한 쿼리 |  |
| `totalBilled_dollar` | 내가 실행한 쿼리(query컬럼에 들어있는 것)를 실행하는 데 든 돈. (빅쿼리 비용) 이게 너무 크면 슬랙 #bigquery-monitoring 채널에 알림이 뜨고, 쿼리 실행한 사람에게 DM이 갑니다. |  |

</details>

### `PF_0_company_ctrl` 

**설명:** 2022년 5월 31일까지 가입한 기업, 플랫폼 조직 분석 전용

_owner: 이상인 (Lee Sangin)_

<details><summary>컬럼 3개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `company_id` | 기업id |  |
| `create_time` | 기업 가입일 (=analytics_mart.company_ko.create_time), KST |  |
| `is_new` | 2022년 5월 가입 기업(신규기업)이면 1, 나머지는 0 |  |

</details>

### `PF_0_company_test` 

**설명:** 2023년 12월 31일까지 가입한 기업, 플랫폼 조직 분석 전용

_owner: 이상인 (Lee Sangin)_

<details><summary>컬럼 3개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `company_id` | 기업id |  |
| `create_time` | 기업 가입일 (=analytics_mart.company_ko.create_time), KST |  |
| `is_new` | 2023년 12월 가입 기업(신규기업)이면 1, 나머지는 0 |  |

</details>

### `position_openclose_history` 

**설명:** (deprecated) 포지션 첫 승인, 채용 종료 후 승인, 채용 종료 history
analytics_mart.position_openclose_history로 대체되었습니다.

_owner: 이상인 (Lee Sangin)_

<details><summary>컬럼 6개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `timestamp` | (deprecated) 포지션 상태 변경 시점(timestamp) |  |
| `position_id` | (deprecated) 상태 변경 포지션 ID |  |
| `owner_id` | (deprecated) 담당자 유저 ID |  |
| `before_status` | (deprecated) 변경 전 상태값 |  |
| `after_status` | (deprecated) 변경 후 상태값 |  |
| `status` | (deprecated) 변경 후 포지션 노출 여부 |  |

</details>

### `query_results` 

**설명:** 크레딧잡 페이지 뷰

_owner: 최종원 Jongwon Choi_

### `user_language_info` 

**설명:** 유저의 이력서 내 언어 수준. 그 외 직군/직무/국가/연차/마케팅 이메일 수신 동의 여부 포함

_owner: 이상인 (Lee Sangin)_

<details><summary>컬럼 12개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `user_id` | 유저 id |  |
| `language` | 유저가 이력서에서 선택한 언어 |  |
| `level` | 선택한 언어의 수준 |  |
| `job_category_id` | 직군id |  |
| `job_category_ko` | 직군명(KR) |  |
| `job_category_jp` | 직군명(JP) |  |
| `job_role_id` | 직무id |  |
| `job_role_ko` | 직무명(KR) |  |
| `job_role_jp` | 직무명(JP) |  |
| `country` | 국가(앰플리튜드 country. IP기반) |  |
| `annual` | 연차 |  |
| `is_mkt` | 마케팅 이메일 수신 동의 여부 (1 : 동의 , 0 : 미동의) |  |

</details>

### `user_notification_approval_history_pivot` 

**설명:** DATARQ-2321 -> DATARQ-3953 으로 강화
날짜별 알림항목별유저 추이를 보기위한 user_notification_approval_history 를 피벗팅한 테이블
첫 user_notification_approval 테이블의 create_time 부터 오늘 날짜까지 일별로 동의 / 거절이 찍혀있다.
user_id 도 찍혀있지만 휴면 / 탈퇴여부나 국가정보를 필터링할 경우 user 테이블을 따로 조인하여야 한다.

_owner: 최종원 Jongwon Choi_

### `zendesk_report` 

**설명:** DATARQ-2424

_owner: 최종원 Jongwon Choi_

<details><summary>컬럼 5개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `organization_id` | 문의한 사람 조직 분류 원티드 기업ID랑 연동 |  |
| `external_id` | 문의한 사람의 고유 ID (원티드 유저ID랑 연동) |  |
| `assignee_id` | 상담원 분류 아이디 |  |
| `id` | 티켓 고유 아이디 |  |
| `field` | ad / help 등 분류 있음 |  |

</details>

### `채사팀_CS관리자이메일기업승인현황` 

**설명:** CS, 관리자 이메일 추출 + 기업 승인 현황 (미승인, 승인 여부)

### `채사팀_기업날짜별서류통과율및평균응답일` 

**설명:** 서류통과율 (서류통과자/총지원자), 평균응답일 (지원~응답)

### `채용사업KR_7일30일내신규기업이용전환` 

**설명:** DATARQ-1913

### `탈퇴유저추이` 

**설명:** DATARQ-2321

_owner: 최종원 Jongwon Choi_

### `휴면유저추이` 

**설명:** 누적휴면유저

_owner: 최종원 Jongwon Choi_

<details><summary>컬럼 2개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `dormant` | 날짜 |  |
| `total` | 누적휴면유저 |  |

</details>

### `CRM_apply_log` — 채용/유저

**설명:** 지원자들의 utm source/medium, channel 정보

<details><summary>컬럼 12개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `event_name` | 앰플리튜드 내 '지원' 이벤트 명(apply__done__net) |  |
| `amplitude_id` | 앰플리튜드 id |  |
| `user_id` | 유저id (원티드 user_id) |  |
| `event_time` | 이벤트 발생 시간 |  |
| `device` | 지원 시점 디바이스 타입 (pc, mobile) |  |
| `platform` | 지원 시점 플랫폼 |  |
| `w_channel` | 지원 시점 channel |  |
| `w_media_source` | 지원 시점 media source |  |
| `utm_medium` | 지원 시점 medium |  |
| `utm_source` | 지원 시점 utm source |  |
| `position_id` | 지원한 포지션id |  |
| `signup_date` | 회원가입 일자 |  |

</details>

### `CRM_signup_log` — 채용/유저

**설명:** 회원가입 유저들의 utm source/medium, channel 정보

<details><summary>컬럼 10개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `event_name` | 앰플리튜드 내 '회원가입' 이벤트 명(signup__done) |  |
| `amplitude_id` | 앰플리튜드 id |  |
| `user_id` | 유저id (원티드 user_id) |  |
| `event_time` | 이벤트 발생 시간 |  |
| `device` | 회원가입 시점 디바이스 타입 (pc, mobile) |  |
| `platform` | 회원가입 시점 플랫폼 |  |
| `w_channel` | 회원가입 시점 channel |  |
| `w_media_source` | 회원가입 시점 media source |  |
| `utm_medium` | 회원가입 시점 medium |  |
| `utm_source` | 회원가입 시점 utm source |  |

</details>

### `MKT_user_device_id` — 채용/유저

**설명:** 페이스북 타겟 유저의 디바이스 정보(idfa, adid)

_owner: 성여운(Yeouhn Sung)_

<details><summary>컬럼 5개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `event_date` | 방문한 적이 있는 일자 |  |
| `user_id` | 유저 id (원티드 유저id) |  |
| `device_id` | Amplitude 가 사용하는 device_id |  |
| `os_name` | 기기정보, 모바일 웹의 경우 앱으로 표시됨 |  |
| `platform` | 플랫폼정보, 모바일 웹의 경우 웹으로 표시됨 |  |

</details>

### `users_with_consent_date` — 채용/유저

**설명:** 이메일/푸시 둘 중 하나 동의 + 수신동의 날짜 모두 확인 가능한 유저

_owner: taeeun@wantedlab.com_

<details><summary>컬럼 5개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `email_marketing_yn` | 마케팅 이메일 수신 여부 |  |
| `email_marketing_agree_date` | 마케팅 이메일 수신 여부 설정 날짜 |  |
| `push_marketing_yn` | 마케팅 푸시 수신 여부 |  |
| `push_marketing_agree_date` | 마케팅 푸시 수신 여부 날짜 |  |
| `user_id` | 유저 id (원티드 user_id) |  |

</details>

### `users_without_consent_date` — 채용/유저

**설명:** 이메일/푸시 둘 중 하나 동의 + 수신동의 날짜 1개 이상 확인 불가한 유저

_owner: taeeun@wantedlab.com_

<details><summary>컬럼 4개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `signup_date` | 가입 날짜 |  |
| `email_marketing_yn` | 마케팅 이메일 수신 여부 |  |
| `push_marketing_yn` | 마케팅 푸시 수신 여부 |  |
| `user_id` | 유저 id (원티드 user_id) |  |

</details>

### `industry_employee__stats` — 채용/인사이트

**설명:** 산업군 별 인원 수

_owner: 이상인 (Lee Sangin)_

---

## 📦 `wanted_stats` (29개 테이블)

### `free_onboarding` — 교육/공통

**설명:** 채용연계교육 - 프리온보딩 코스 수료생 리스트

_owner: hweejin@wantedlab.com_

<details><summary>컬럼 9개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `email` | 수강생 email | email |
| `name` | 수강생 이름 | name |
| `focus_yn` | 집중 관리 대상 수료생 여부 |  |
| `end_date` | 채용 연계 실적(지원 전환) 집계 종료 시점 |  |
| `completion_date` | 코스 수료일 |  |
| `start_date` | 코스 시작일 |  |
| `course_name` | 코스명 |  |
| `user_id` | challenge 테이블을 위한 유저아이디인듯 이 테이블에는 없음 |  |
| `sba_yn` | SBA 전형자 여부 |  |

</details>

### `free_onboarding_challenge` — 교육/공통

**설명:** 채용연계교육 - 챌린지 코스 수료생 리스트

_owner: hweejin@wantedlab.com_

<details><summary>컬럼 7개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `email` | 수강생 email | email |
| `name` | 수강생 이름 | name |
| `user_id` | 원티드 유저 아이디 |  |
| `end_date` | 채용 연계 실적(지원 전환) 집계 종료 시점 |  |
| `completion_date` | 코스 수료일 |  |
| `start_date` | 코스 시작일 |  |
| `course_name` | 코스명 |  |

</details>

### `carrying_capacity` 

**설명:** 원티드 서비스 carrying capacity

_owner: 이상인 (Lee Sangin)_

<details><summary>컬럼 12개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `date` | 날짜. (YYYY-MM) |  |
| `mau` | 원티드 MAU |  |
| `organic_mau` | 원티드 오가닉 MAU |  |
| `new_user` | 신규 오가닉 유저 |  |
| `resurrected_user` | 회귀 오가닉 유저 |  |
| `dormant_user` | 이탈 오가닉 유저 |  |
| `weight` | 가중치(직전 2개월~해당월 오가닉MAU평균(단, 최대값제외) / 현 MAU) |  |
| `weighted_organic` | 가중치 적용 원티드 오가닉 MAU |  |
| `weighted_inflow` | 가중치 적용 원티드 신규+회귀 오가닉 유저 |  |
| `weighted_dormant` | 가중치 적용 원티드 이탈 오가닉 유저 |  |
| `weighted_churn_rate` | 가중치 적용 이탈률 |  |
| `CC` | carrying_capacity, weighted_inflow/weighted_churn_rate |  |

</details>

### `company_activeness` 

**설명:** Company Activeness BI를 위한 테이블 
Airflow로 매일 RDB 미러링 작업 이후에 업데이트 됨 DATARQ-2642

_owner: 유지윤 (Jiyoon You)_

<details><summary>컬럼 6개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `country` | 기업 국가 |  |
| `date` | 기준 날짜 |  |
| `confirmed_positions` | 승인된 공고가 있는 기업 수 |  |
| `confirmed_companies` | 승인된 기업 수 |  |
| `live_jobs` | 채용 중인 공고가 있는 기업 수 |  |
| `logged_in` | 최근에 로그인한 기록이 있는 기업 수 |  |

</details>

### `company_classification` 

**설명:** 기업 별 스타트업, 급성장 여부, 투자 여부, 인원증감률

_owner: 이상인 (Lee Sangin)_

<details><summary>컬럼 15개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `increase_rate_6m` | (지난 1년) 반기 인원증감률 평균 |  |
| `increase_rate_3m` | (지난 1년) 분기 인원증감률 평균 |  |
| `increase_rate_1y` | (지난 1년) 연간 인원증감률 평균 |  |
| `company_id` | 기업 id |  |
| `company_name` | 기업명 |  |
| `foundation_date` | 법인설립일 |  |
| `is_fastgrowing` | 빠른 성장 중 - 원티드 자체 기준 (2022.09.07 고정데이터) |  |
| `is_startup` | 스타트업 여부 - 원티드 자체 기준 (2022.09.07 고정데이터) |  |
| `is_preunicorn` | 원티드 기준 - 예비유니콘(is_fastgrowing=1 & M&A,프리IPO, IPO 제외 & 스타트업(2022.09.07 고정데이터)인 기업) |  |
| `first_investment_phase` | 첫 투자 단계 (2022.09.07 고정데이터) |  |
| `first_investment_date` | 첫 투자 일자 (2022.09.07 고정데이터) |  |
| `scrap_y` | 투자 데이터 스크랩 여부(0일 시 투자관련 컬럼 NULL) (2022.09.07 고정데이터) |  |
| `investment_y` | 투자 여부 (2022.09.07 고정데이터) |  |
| `is_usingwanted` | 활성 기업 고객 여부 (포지션 1개 이상 노출 or 매치업 유료플랜 이용) |  |
| `out_y` | M&A, 프리IPO, IPO 여부 (2022.09.07 고정데이터) |  |

</details>

### `company_growthrate` 

**설명:** 기업의 분기/반기/연간 인원증감률

_owner: 이상인 (Lee Sangin)_

<details><summary>컬럼 12개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `company_name` | 기업명 |  |
| `upload_date` | 기준날짜 |  |
| `increase_rate_6m` | 반기 인원증감률 |  |
| `founded_year` | 법인설립일 |  |
| `increase_rate_3m` | 분기 인원증감률 |  |
| `increase_rate_1y` | 연간 인원증감률 |  |
| `company_id` | 원티드 기업id |  |
| `company_size` | 인원 수 |  |
| `company_size_bf_1y` | 인원 수 - 12개월(1년) 전 |  |
| `company_size_bf_3m` | 인원 수 - 3개월 전 |  |
| `company_size_bf_6m` | 인원 수 - 6개월 전 |  |
| `kj_id` | 크레딧잡 기업id (legacy_pk_nm_hash) |  |

</details>

### `injepool_stats` 

**설명:** 인재풀탐색 통계

_owner: 이상인 (Lee Sangin)_

### `live_position` 

**설명:** 라이브 포지션 리스트

_owner: 유지윤 (Jiyoon You)_

### `matchup_companies` 

**설명:** deprecated #data-alarm 채널에서 인재풀탐색(매치업)알람 발생하던 시절에 daily 수치를 적재함. 25년 11월 이후 중단

_owner: 이상인 (Lee Sangin)_

<details><summary>컬럼 12개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `date` | deprecated |  |
| `company_total` | deprecated |  |
| `used_total` | deprecated |  |
| `paid` | deprecated |  |
| `paid_twice_or_more` | deprecated |  |
| `used_matchup_used_total_over_company_total` | deprecated |  |
| `paid_conversion_paid_over_used_total` | deprecated |  |
| `repurchase_paid_twice_or_more_over_paid` | deprecated |  |
| `matchup` | deprecated |  |
| `matchup_twice_or_more` | deprecated |  |
| `matchup_conversion_matchup_over_used_total` | deprecated |  |
| `matchup_repurchase_matchup_twice_or_more_over_matchup` | deprecated |  |

</details>

### `matchup_key_metrics` 

**설명:** wanted_stats.matchup_use 와 matchup_hire을 활용한 #data_alarm, #data_alarm_global 용 뷰 테이블

_owner: 유지윤 (Jiyoon You)_

<details><summary>컬럼 5개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `country` | 국가 |  |
| `metric` | 데이터 알람에 쓰일 지표명 |  |
| `total` | 매치업 상품 전체 (무료 포함) |  |
| `prepaid` | 매치업 선과금 (basic, lite) |  |
| `unlimited` | 매치업 후과금 (매무요) |  |

</details>

### `monthly_company_activity_log` 

**설명:** 기업의 월별 라이브 포지션 수, 인재풀 열람 수, 인재풀 제안 수  (에어플로우 DAG로 매달 1일 업데이트)

_owner: 유지윤 (Jiyoon You)_

<details><summary>컬럼 5개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `ym` | 날짜 연-월-일 (월 단위로만 쌓임) |  |
| `company_id` | 기업ID |  |
| `c_live_position` | 라이브 포지션 수 |  |
| `c_open` | 인재풀 열람 수 |  |
| `c_offer` | 인재풀 제안 수 |  |

</details>

### `monthly_company_activity_log_w_status` 

**설명:** monthly_company_activity_log에 기업의 활성/비활성 여부 (status)를 추가한 테이블
활성(active)의 기준은 해당 월에 라이브 포지션 있었거나 인재풀 열람을 한 경우

_owner: 유지윤 (Jiyoon You)_

<details><summary>컬럼 6개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `ym` | 날짜 연-월-일 (월 단위로만 쌓임) |  |
| `company_id` | 기업ID |  |
| `c_live_position` | 라이브 포지션 수 |  |
| `c_open` | 인재풀 열람 수 |  |
| `c_offer` | 인재풀 제안 수 |  |
| `status` | 기업의 활성/비활성 여부 상태값. 활성(active)의 기준은 해당 월에 라이브 포지션 있었거나 인재풀 열람을 한 경우 |  |

</details>

### `ops_marketing_simulation` 

**설명:** 채용사업팀 market simulation 쿼리용 테이블

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 2개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `Table_update_time` | KST 기준; 테이블 데이터 적재된 일자; 스케줄러 실패한 경우, 재실행 했을 때 데이터 확인/구분을 하기 위해 별도 컬럼 추가 |  |
| `Airflow_run_time` | KST 기준; airflow ops_marketing_simulation_task run time |  |

</details>

### `position_lifecycle_log` 

**설명:** live 여부를 position_id 기준으로 피벗팅한 테이블 언제 열리고 닫혔는지 알 수 있고, 마지막이 null 일 경우는 현재 라이브되고 있다는 뜻

_owner: 유지윤 (Jiyoon You)_

<details><summary>컬럼 3개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `position_id` | 포지션 ID |  |
| `hidden_time` | 포지션이 닫힌 시간 |  |
| `live_time` | 포지션이 활성화된 시간 |  |

</details>

### `positions_approved` 

**설명:** #data_alarm, #data_alarm_global의 승인 공고 수를 적재하는 테이블

_owner: 유지윤 (Jiyoon You)_

<details><summary>컬럼 7개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `date` | 공고 승인 날짜 |  |
| `KR` | 국가별 공고 승인 수 |  |
| `JP` | 국가별 공고 승인 수 |  |
| `HK` | 국가별 공고 승인 수 |  |
| `TW` | 국가별 공고 승인 수 |  |
| `SG` | 국가별 공고 승인 수 |  |
| `TOTAL` | 공고 승인 수 합계 |  |

</details>

### `resume` 

**설명:** 이력서 페이지(wanted.co.kr/resume)에 있는 이력서 데이터입니다.(원본 : wanteddb.resume)
[21.02.15] 
[수정] is_matching > is_matchup : 매치업에 등록된 이력서 유무(원본 테이블 업데이트 이슈로 타 테이블에서 데이터 가져옴, 컬럼명 조금 더 직관적으로)
[추가] is_complete : (원티드 이력서 중) '작성 완료' 여부
[삭제] is_written, is_matching, is_dirty

_owner: 이상인 (Lee Sangin)_

### `signup_user` 

**설명:** 일 별, 국가 별 회원가입 수(회원가입 시점)

_owner: 이상인 (Lee Sangin)_

<details><summary>컬럼 3개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `create_date` | 가입일자 |  |
| `country` | 국가 |  |
| `user_cnt` | 유저 수 |  |

</details>

### `user_job_category` 

**설명:** 유저 별 직군id, 프로필 레벨 테이블입니다.
[2020.12.01.] 직군 번역값(KR,EN,JP,TW,CN) 추가

_owner: 이상인 (Lee Sangin)_

### `user_job_role` 

**설명:** 유저 별 직군id, 직무id 프로필 레벨 테이블입니다.

_owner: 이상인 (Lee Sangin)_

### `user_notification_day` 

**설명:** 푸시 알림 동의 여부 (일별, 유저별)

_owner: 성여운(Yeouhn Sung)_

<details><summary>컬럼 5개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `user_id` | 유저 id |  |
| `category` | 어떤 알림인가? (푸시...) |  |
| `send_type` | 유저가 수신동의/거부한 알림의 종류 (채용, 마케팅..) |  |
| `is_approved` | 수신동의는 1, 거부는 0 |  |
| `logical_date` | 어느날 상태값인지 |  |

</details>

### `user_stats` 

**설명:** 분기/국가/연차/직군 별 전체, 활성유저수
wanted_mart.user_stats를 대체한다

_owner: 이상인 (Lee Sangin)_

<details><summary>컬럼 6개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `date` | 연-분기 |  |
| `country` | 국가 |  |
| `annual` | 연차 |  |
| `job_category` | 직군명 |  |
| `user_total` | 전체 유저 수(해당 분기까지 유저 수) |  |
| `user_active` | 활성 유저 수(해당 분기에 활성이라고 측정되었던 유저 수) |  |

</details>

### `user_stats_YM` 

**설명:** 월/국가/연차/직군 별 전체, 활성유저수
wanted_mart..user_stats_YM을 대체한다

_owner: 이상인 (Lee Sangin)_

<details><summary>컬럼 6개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `date` | 연-월 |  |
| `country` | 국가 |  |
| `annual` | 연차 |  |
| `job_category` | 직군명 |  |
| `user_total` | 전체 유저 수(해당 분기까지 유저 수) |  |
| `user_active` | 활성 유저 수(해당 분기에 활성이라고 측정되었던 유저 수) |  |

</details>

### `company_response_rate` — 채용/기업

**설명:** 날짜별 기업별 서류응답률

⚠️ **특이사항:** BI 대시보드 'Response ratio 56days'의 raw data, 2023.2Q 중 새로고침 중단 예정

_owner: 유지윤 (Jiyoon You)_

### `company_response_rate_new` — 채용/기업

**설명:** 날짜별 기업별 서류응답률 (2022.9 NEWTOWN 배포 이후 응답률 정의)

⚠️ **특이사항:** BI 대시보드 'Response ratio 56days (new)'의 raw data, 
바뀐 정의: 컨플

_owner: 유지윤 (Jiyoon You)_

<details><summary>컬럼 6개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `company_id` | 기업id |  |
| `country` | 기업의 국가 |  |
| `c_pass` | 응답한 지원 건 수 |  |
| `c_total` | 접수된 지원 건 수 |  |
| `response_rate` | 기업 서류응답률, c_pass/c_total 한 값 |  |
| `created_time` | 해당 열 생성일자 |  |

</details>

### `interview_response_rate` — 채용/기업

**설명:** 날짜별 기업별 면접응답률

⚠️ **특이사항:** BI 대시보드 'Response ratio 56days'의 raw data, 2023.2Q 중 새로고침 중단 예정

_owner: 유지윤 (Jiyoon You)_

### `interview_response_rate_new` — 채용/기업

**설명:** 날짜별 기업별 최종응답률 (2022.9 NEWTOWN 배포 이후 응답률 정의)

⚠️ **특이사항:** BI 대시보드 'Response ratio 56days (new)'의 raw data, 
바뀐 정의: 컨플

_owner: 유지윤 (Jiyoon You)_

### `live_position_daily` — 채용/기업

**설명:** 일자별 (스냅샷 형태) 라이브 포지션
wanted_mart.live_position_daily를 대체한다

_owner: 최종원 Jongwon Choi_

<details><summary>컬럼 2개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `date` | 날짜 |  |
| `position_id` | 해당 날짜에 활성상태(열려있던) 포지션 |  |

</details>

### `matchup_key_actions` — 채용/기업

**설명:** 날짜별 매치업 키액션 (LIKE, OPEN, OFFER, USER_ACCEPT) 수

⚠️ **특이사항:** #data_alarm '어제자 키액션 수 (7일 전 대비 증감률)'의 raw data

_owner: 유지윤 (Jiyoon You)_

<details><summary>컬럼 5개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `seven_d_before` | 7일 전 키액션 수 (증감률 계산용) |  |
| `country` | 기업 국가 |  |
| `date` | 액션 날짜 |  |
| `count` | 키액션 수 |  |
| `type` | 키액션 타입 (LIKE, OPEN, OFFER, USER_ACCEPT) |  |

</details>

### `matchup_use` — 채용/기업

**설명:** 매치업 이용 내역 (기업별, 키액션 횟수, 결제 금액 등)

⚠️ **특이사항:** BI 대시보드 'Matchup Company Use '의 raw data

_owner: 유지윤 (Jiyoon You)_

<details><summary>컬럼 28개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `subscription_type` | 구독타입 (일반, 장기구독, 연간계약) |  |
| `product_name` | 구매/적용된 매치업 상품명 (unlimited, lite, trial, basic, others) |  |
| `product_id` | 구매/적용된 매치업 상품ID |  |
| `price` | 구매금액 |  |
| `paid_time` | 구매일자 |  |
| `currency` | 구매통화 |  |
| `user_expire_reject` | 기간만료 거절 횟수 |  |
| `country` | 기업국가 (KR, JP, HK, TW, SG, others) |  |
| `company_name` | 기업명 |  |
| `company_id` | 기업ID |  |
| `expired_time` | 만료일자 |  |
| `paid_n` | 매치업 구매횟수 |  |
| `interview_reject` | 면접탈락 횟수 |  |
| `total_count` | 부여된 열람 횟수 |  |
| `use_count` | 사용한 열람 횟수 |  |
| `created_time` | 생성일자 |  |
| `open` | 열람 횟수 |  |
| `user_accept` | 유저(제안)수락 횟수 |  |
| `user_check` | 유저(제안)확인 횟수 |  |
| `user_reject` | 유저거절 횟수 |  |
| `remain_count` | 잔여 열람 횟수 |  |
| `disabled_time` | 적용 후 적용취소 날짜 |  |
| `is_disabled` | 적용취소 여부 (1=적용취소) |  |
| `offer` | 제안 횟수 |  |
| `like` | 좋아요 횟수 |  |
| `repurchase` | 첫구매, 재구매 구분자 |  |
| `hire` | 합격 횟수 |  |
| `id` | PK (matching_count.id) |  |

</details>

---

## 📦 `kj_new` (19개 테이블)

### `bjd` 

**설명:** https://www.code.go.kr/stdcode/regCodeL.do
행정표준코드관리시스템 > 법정동 코드 전체자료

_owner: 최종원 Jongwon Choi_

<details><summary>컬럼 6개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `name` | 법정동명 |  |
| `code` | 법정동코드 |  |
| `sgg` | 시, 군, 구 코드 |  |
| `sido` | 시, 도 코드 |  |
| `umd` | 읍, 면, 동 코드 |  |
| `open` | 폐지여부 |  |

</details>

### `Company` 

**설명:** wanteddb.company_des같은 것. kj의 company테이블이다. 여기에 wantedCompanyId라는 컬럼이 있는데, 이거랑 wanteddb.company_des.id가 join된다!

_owner: 성여운(Yeouhn Sung)_

<details><summary>컬럼 1개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `regNoHash` | 이 컬럼과 매핑되는 key 정보: https://wantedlab.atlassian.net/wiki/spaces/DATA/pages/3274113311/kj_new |  |

</details>

### `CompanyEmployee` 


### `CompanySales` 


### `fss_info` 

**설명:** 금감원 크롤링: 기업 정보; http://newdart.fss.or.kr/ 사이트 보고서 직원 현황에 대한 데이터

_owner: 최종원 Jongwon Choi_

### `fss_report` 

**설명:** 금감원 크롤링: 사업보고서

_owner: 최종원 Jongwon Choi_

### `fss_sales` 

**설명:** DATARQ-3496 금감원 매출액 / 영업이익 / 당기순이익 파이프라인

_owner: 최종원 Jongwon Choi_

<details><summary>컬럼 23개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `ADPT_DT` | 검증용: 국민연금 가입 일자 |  |
| `name` | 검증용: 국민연금 기업명으로부터 파싱된 기업명 |  |
| `WKPL_NM` | 검증용: 국민연금 원본 기업명 |  |
| `settlement` | 결산일자 |  |
| `disclosure` | 금감원 원본 공식 기업명 |  |
| `kr_name` | 금감원 원본 기업명 |  |
| `unit_norm` | 단위를 숫자로 변환 |  |
| `net_income_norm` | 당기순이익 (단위가 계산됨) |  |
| `net_income` | 당기순이익 원본 |  |
| `revenue_norm` | 매출액 (단위가 계산됨) |  |
| `revenue` | 매출액 원본 |  |
| `corp_no` | 법인번호 |  |
| `corp_class` | 법인종류(상장 시장) |  |
| `recept_date` | 사업보고서 등록일 |  |
| `unit` | 사업보고서 원본 단위 |  |
| `_id` | 사업보고서 id |  |
| `biz_no` | 사업자등록번호 |  |
| `founded` | 설립일 |  |
| `operating_profit_norm` | 영업이익 (단위가 계산됨) |  |
| `operating_profit` | 영업이익 원본 |  |
| `financial_type` | 재무제표 종류: 연결재무제표 \| 별도재무제표 |  |
| `ticker` | 주식코드 |  |
| `legacy_pk_nm_hash` | 크레딧잡에 사용되는 pk hash |  |

</details>

### `fss_schema` 

**설명:** 금감원 크롤링: 사업보고서 리스트

_owner: 최종원 Jongwon Choi_

### `industry_stat` 

**설명:** 리뉴얼된 크레딧잡으로 보내는 기업현황 처리가 모두 끝난 데이터

_owner: 최종원 Jongwon Choi_

<details><summary>컬럼 41개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `locationCode` | 시군구가 정제된 법정동(크레딧잡에서 사용하며 국민연금이 주는 데이터와 다름 분당구, 부천시가 예시, location_code 와 동일하지만, 00은 전국을 나타냄) |  |
| `industryCode` | 업종코드에 매핑된 표준산업분류코드(section_code 와 동일하지만 - 가 ETC로 매핑 기타를 나타내고 TOTAL은 전체를 나타냄) |  |
| `avgEmployeeCount_lastY` | 작년 기준 연간 총 종사자 수 |  |
| `avgSales_lastY` | 작년 기준 연간 평균 매출액 |  |
| `avgFoundedTimestamp_lastY` | 작년 기준 연간 평균 설립일 |  |
| `avgSalary_lastY` | 작년 기준 연간 평균 연봉 |  |
| `avgHiredCount_lastY` | 작년 기준 연간 평균 입사자 수 |  |
| `avgLeftCount_lastY` | 작년 기준 연간 평균 퇴사자 수 |  |
| `companyRate` | 작년 대비 기업 증감율 |  |
| `employeeRate` | 작년 대비 종사자 수 증감율 |  |
| `hiringGoodCompanyRate` | 작년 대비 좋은일자리 수 증감율 |  |
| `hiredEmployeeCount_lastY` | 작년 자료생성년월  기준 총 입사자 수 |  |
| `companyCount_lastY` | 작년 자료생성년월 기준 총 기업 수 |  |
| `employeeCount_lastY` | 작년 자료생성년월 기준 총 종사자 수 |  |
| `hiringGoodAvgEmployeeCount_lastY` | 좋은 일자리를 가진 작년 기준 연간 총 종사자 수 |  |
| `hiringGoodAvgSales_lastY` | 좋은 일자리를 가진 작년 기준 연간 총 종사자 수 |  |
| `hiringGoodAvgFoundedTimestamp_lastY` | 좋은 일자리를 가진 작년 기준 연간 평균 설립일 |  |
| `hiringGoodAvgSalary_lastY` | 좋은 일자리를 가진 작년 기준 연간 평균 연봉 |  |
| `hiringGoodAvgHiredCount_lastY` | 좋은 일자리를 가진 작년 기준 연간 평균 입사자 수 |  |
| `hiringGoodAvgLeftCount_lastY` | 좋은 일자리를 가진 작년 기준 연간 평균 퇴사자 수 |  |
| `hiringGoodHiredEmployeeCount_lastY` | 좋은 일자리를 가진 작년 자료생성년월  기준 총 입사자 수 |  |
| `hiringGoodCompanyCount_lastY` | 좋은 일자리를 가진 작년 자료생성년월 기준 총 기업 수 |  |
| `hiringGoodEmployeeCount_lastY` | 좋은 일자리를 가진 작년 자료생성년월 기준 총 종사자 수 |  |
| `hiringGoodAvgSales` | 좋은 일자리를 가진 최근 1년간 평균 매출액 |  |
| `hiringGoodAvgFoundedTimestamp` | 좋은 일자리를 가진 최근 1년간 평균 설립일 |  |
| `hiringGoodAvgSalary` | 좋은 일자리를 가진 최근 1년간 평균 연봉 |  |
| `hiringGoodAvgHiredCount` | 좋은 일자리를 가진 최근 1년간 평균 입사자 수 |  |
| `hiringGoodAvgEmployeeCount` | 좋은 일자리를 가진 최근 1년간 평균 종사자 수 |  |
| `hiringGoodAvgLeftCount` | 좋은 일자리를 가진 최근 1년간 평균 퇴사자 수 |  |
| `hiringGoodCompanyCount` | 좋은 일자리를 가진 최신 자료생성년월 기준 총 기업 수 |  |
| `hiringGoodHiredEmployeeCount` | 좋은 일자리를 가진 최신 자료생성년월 기준 총 입사자 수 |  |
| `hiredGoodCompanyEmployee` | 좋은 일자리를 가진 최신 자료생성년월 기준 총 종사자 수 |  |
| `avgSales` | 최근 1년간 평균 매출액 |  |
| `avgFoundedTimestamp` | 최근 1년간 평균 설립일 |  |
| `avgSalary` | 최근 1년간 평균 연봉 |  |
| `avgHiredCount` | 최근 1년간 평균 입사자 수 |  |
| `avgEmployeeCount` | 최근 1년간 평균 종사자 수 |  |
| `avgLeftCount` | 최근 1년간 평균 퇴사자 수 |  |
| `companyCount` | 최신 자료생성년월 기준 총 기업 수 |  |
| `hiredEmployeeCount` | 최신 자료생성년월 기준 총 입사자 수 |  |
| `employeeCount` | 최신 자료생성년월 기준 총 종사자 수 |  |

</details>

### `insight` 

**설명:** kj_new.kreditjob에 고용보험 기반 ei기업데이터가 매칭된 테이블(매주 월요일 새벽 업데이트)

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 1개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `biz_no_hash` | 이 컬럼과 매핑되는 key 정보: https://wantedlab.atlassian.net/wiki/spaces/DATA/pages/3274113311/kj_new |  |

</details>

### `kreditjob` 

**설명:** 리뉴얼된 크레딧잡 파이프라인의 전처리가 모두 끝난 데이터

_owner: 최종원 Jongwon Choi_

<details><summary>컬럼 57개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `salesPerPerson` | 1인당 매출액 |  |
| `JNNGP_CNT` | 가입자수 |  |
| `settlement_user` | 결산일자와 조인된 자료생성년월의 인원수 |  |
| `settlement_average_salary` | 결산일자와 조인된 자료생성년월의 평균연봉 |  |
| `CUST_LDONG_ADDR_CD` | 고객법정동주소코드 |  |
| `CUST_PADONG_ADDR_CD` | 고객행정동주소코드 |  |
| `average_salary` | 국민연금요율로 역산된 평균연봉 |  |
| `nts_code` | 국세청 기준 2019년 업종분류코드 |  |
| `score` | 기업현황에 나오는 각 기업 점수 |  |
| `CRRMM_NTC_AMT` | 당월고지금액 |  |
| `settlement` | 매출 결산일자 |  |
| `sales` | NICE 기준 매출 (기준날짜: settlement 컬럼. 이게 NICE 결산일. 2019년이 마지막임. 이후 매출은 금감원꺼밖에 없는데 그건 상장사꺼만 있음) |  |
| `salesSalaryRate` | 매출액 대비 임금 비율 |  |
| `bjd_open` | 법정동 존폐여부 |  |
| `bjd_name` | 법정동명 |  |
| `LDONG_ADDR_MGPL_DG_CD` | 법정동주소광역시도코드 |  |
| `LDONG_ADDR_MGPL_SGGU_EMD_CD` | 법정동주소광역시시군구읍면동코드 |  |
| `LDONG_ADDR_MGPL_SGGU_CD` | 법정동주소광역시시군구코드 |  |
| `bjd_code` | 법정동코드 |  |
| `PRSN_RATIO` | 분모가 현재 인원인 유사 인원 증감율(기업 점수 계산에 쓰임) |  |
| `biz_no` | 사업자등록번호 |  |
| `BZOWR_RGST_NO` | 사업자등록번호 |  |
| `WKPL_JNNG_STCD` | 사업장가입상태코드 |  |
| `WKPL_ROAD_NM_DTL_ADDR` | 사업장도로명상세주소 |  |
| `WKPL_NM` | 사업장명 |  |
| `WKPL_INTP_CD` | 사업장업종코드 |  |
| `VLDT_VL_KRN_NM` | 사업장업종코드명 |  |
| `WKPL_LTNO_DTL_ADDR` | 사업장지번상세주소 |  |
| `WKPL_STYL_DVCD` | 사업장형태구분코드 |  |
| `LSS_JNNGP_CNT` | 상실가입자수 |  |
| `foundedTimestamp` | 설립일의 서버용 타임스탬프 |  |
| `sgg` | 시, 군, 구 코드 |  |
| `sido` | 시, 도 코드 |  |
| `location_code` | 시군구가 정제된 법정동(크레딧잡에서 사용하며 국민연금이 주는 데이터와 다름 분당구, 부천시가 예시) |  |
| `hiredSalary` | 신규입사자 평균 연봉(국민연금 기준) |  |
| `NW_ACQZR_CNT` | 신규취득자수 |  |
| `section_code` | 업종코드에 매핑된 표준산업분류코드 |  |
| `ZIP` | 우편번호 |  |
| `stdrDe` | 원본 CSV 파일이 등록된 날짜 |  |
| `umd` | 읍, 면, 동 코드 |  |
| `DATA_CRT_YM` | 자료생성년월 |  |
| `JNNGP_RATIO` | 작년 대비 인원 증감율(크레딧잡 기업 페이지 인원 증감율) |  |
| `acquire_ratio` | 작년 대비 입사율(크레딧잡 기업 페이지 입사율) |  |
| `loss_ratio` | 작년 대비 퇴사율(크레딧잡 기업 페이지 퇴사율) |  |
| `AVG_SALARY_RATIO` | 작년 대비 평균 연봉 증감율 |  |
| `YEARLY_NW_ACQZR_CNT` | 작년 부터 총 입사자 수 |  |
| `YEARLY_LSS_JNNGP_CNT` | 작년 부터 총 퇴사자 수 |  |
| `PAST_DATA_CRT_YM` | 작년자료생성년월 |  |
| `SCSN_DT` | 재등록일자 |  |
| `ADPT_DT` | 적용일자 |  |
| `goodCompany` | 좋은일자리인지 여부 |  |
| `corp_category` | 주식회사, 합자회사, 유한회사 등의 기업분류 |  |
| `legacy_pk_nm_hash` | 크레딧잡에 사용되는 pk hash |  |
| `PK_NM_HASH` | 크레딧잡에 사용되는 pk hash |  |
| `RRG_DT` | 탈퇴일자 |  |
| `legacy_pk_nm` | pk hash 원본 |  |
| `name` | Python 전처리가 적용된 기업명 PK 만들 때 쓰임 |  |

</details>

### `master_company_name` 

**설명:** 마스터 사업장명 선택 로직
https://wantedlab.atlassian.net/wiki/spaces/WAN/pages/2813396500#%EB%A7%88%EC%8A%A4%ED%84%B0-%EC%82%AC%EC%97%85%EC%9E%A5%EB%AA%85-%EC%84%A0%ED%83%9D-%EB%A1%9C%EC%A7%81

_owner: 최종원 Jongwon Choi_

<details><summary>컬럼 7개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `biz_no` | 사업자등록번호 |  |
| `company_name` | 마스터 사업장명 선택 로직 https://wantedlab.atlassian.net/wiki/spaces/WAN/pages/2813396500#%EB%A7%88%EC%8A%A4%ED%84%B0-%EC%82%AC%EC%97%85%EC%9E%A5%EB%AA%85-%EC%84%A0%ED%83%9D-%EB%A1%9C%EC%A7%81 문서에 따른 기업명 |  |
| `PK_NM` | 사업자 6자리와 마스터 사업장명을 정제해 만든 인사이트 PK_NM |  |
| `PK_NM_HASH` | 인사이트에 사용할 PK_NM_HASH |  |
| `fss_match` | 마스터 사업장명 선택 로직 중 금감원에 매칭 되는 경우 |  |
| `mb_match` | 마스터 사업장명 선택 로직 중 통신판매사업장에 매칭되는 경우 |  |
| `b_stt_cd` | 납세자상태(코드): 01: 계속사업자, 02: 휴업자, 03: 폐업자 |  |

</details>

### `pk_unique_overall` 

**설명:** 국민연금히스토리. financials는 없다.

<details><summary>컬럼 35개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `data_crt_idx` | legacy_pk_nm_hash별 최신 국민연금 row를 고르기 위해 DATA_CRT_YM 내림차순으로 부여한 row_number. 값이 1이면 해당 hash의 최신 row. |  |
| `DATA_CRT_YM` | 자료생성년월(일별로 파티셔닝 되어 있음) |  |
| `WKPL_NM` | 사업장명 |  |
| `BZOWR_RGST_NO` | 사업자등록번호 |  |
| `WKPL_JNNG_STCD` | 사업장가입상태코드 |  |
| `ZIP` | 우편번호 |  |
| `WKPL_LTNO_DTL_ADDR` | 사업장지번상세주소 |  |
| `WKPL_ROAD_NM_DTL_ADDR` | 사업장도로명상세주소 |  |
| `CUST_LDONG_ADDR_CD` | 고객법정동주소코드 |  |
| `CUST_PADONG_ADDR_CD` | 고객행정동주소코드 |  |
| `LDONG_ADDR_MGPL_DG_CD` | 법정동주소광역시도코드 |  |
| `LDONG_ADDR_MGPL_SGGU_CD` | 법정동주소광역시시군구코드 |  |
| `LDONG_ADDR_MGPL_SGGU_EMD_CD` | 법정동주소광역시시군구읍면동코드 |  |
| `WKPL_STYL_DVCD` | 사업장형태구분코드 |  |
| `WKPL_INTP_CD` | 사업장업종코드 |  |
| `VLDT_VL_KRN_NM` | 사업장업종코드명 |  |
| `ADPT_DT` | 적용일자 |  |
| `SCSN_DT` | 재등록일자 |  |
| `RRG_DT` | 탈퇴일자 |  |
| `JNNGP_CNT` | 가입자수 |  |
| `CRRMM_NTC_AMT` | 당월고지금액 |  |
| `NW_ACQZR_CNT` | 신규취득자수 |  |
| `LSS_JNNGP_CNT` | 상실가입자수 |  |
| `nts_code` | 국세청 기준 2019년 업종분류코드 |  |
| `section_code` | 표준산업분류코드 |  |
| `bjd_code` | 법정동코드 |  |
| `bjd_name` | 법정동명 |  |
| `bjd_open` | 법정동 존폐여부 |  |
| `sido` | 시, 도 코드 |  |
| `sgg` | 시, 군, 구 코드 |  |
| `umd` | 읍, 면, 동 코드 |  |
| `corp_category` | 주식회사, 합자회사, 유한회사 등의 기업분류 |  |
| `average_salary` | 국민연금요율로 역산된 평균연봉 |  |
| `legacy_pk_nm` | 크레딧잡에 사용되는 pk |  |
| `legacy_pk_nm_hash` | 크레딧잡에 사용되는 pk hash |  |

</details>

### `raw` 

**설명:** 국민연금 가입 사업장 내역 원본 데이터

_owner: 최종원 Jongwon Choi_

<details><summary>컬럼 22개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `JNNGP_CNT` | 가입자수 |  |
| `CUST_LDONG_ADDR_CD` | 고객법정동주소코드 |  |
| `CUST_PADONG_ADDR_CD` | 고객행정동주소코드 |  |
| `CRRMM_NTC_AMT` | 당월고지금액 |  |
| `LDONG_ADDR_MGPL_DG_CD` | 법정동주소광역시도코드 |  |
| `LDONG_ADDR_MGPL_SGGU_EMD_CD` | 법정동주소광역시시군구읍면동코드 |  |
| `LDONG_ADDR_MGPL_SGGU_CD` | 법정동주소광역시시군구코드 |  |
| `BZOWR_RGST_NO` | 사업자등록번호 |  |
| `WKPL_JNNG_STCD` | 사업장가입상태코드 |  |
| `WKPL_ROAD_NM_DTL_ADDR` | 사업장도로명상세주소 |  |
| `WKPL_NM` | 사업장명 |  |
| `WKPL_INTP_CD` | 사업장업종코드 |  |
| `VLDT_VL_KRN_NM` | 사업장업종코드명 |  |
| `WKPL_LTNO_DTL_ADDR` | 사업장지번상세주소 |  |
| `WKPL_STYL_DVCD` | 사업장형태구분코드 |  |
| `LSS_JNNGP_CNT` | 상실가입자수 |  |
| `NW_ACQZR_CNT` | 신규취득자수 |  |
| `ZIP` | 우편번호 |  |
| `DATA_CRT_YM` | 자료생성년월 |  |
| `RRG_DT` | 재등록일자 |  |
| `ADPT_DT` | 적용일자 |  |
| `SCSN_DT` | 탈퇴일자 |  |

</details>

### `sales` 

**설명:** 크레딧잡의 kjdb.KJ_2_SALES(2013년부터 NICE로부터 수집된 매출액)
kj_new.nice_sales  (NICE raw 데이터) 를 병합

_owner: 최종원 Jongwon Choi_

<details><summary>컬럼 5개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `settlement` | 결산일자 (연도별로 파티셔닝 되어 있음) |  |
| `value` | 매출액(천원) |  |
| `biz_no` | 사업자등록번호 |  |
| `profit` | 영업이익(천원) |  |
| `PK_NM_HASH` | PK |  |

</details>

### `CompanySalaryWiki` — 채용/인사이트

**설명:** 연봉제보, 연봉랭킹을 통해 유저에게 받은 연봉정보

_owner: taeeun@wantedlab.com_

<details><summary>컬럼 13개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `salary` | 연봉 제보/연봉랭킹 금액. 단위는 만원. | salary |
| `companyId` | 기업 id |  |
| `deletedAt` | 삭제시간 |  |
| `bonus` | 상여금 |  |
| `createdAt` | 생성시간 |  |
| `id` | 연봉 id |  |
| `career` | 연차 |  |
| `jobGroupId` | 직군 id |  |
| `jobGroupName` | 직군명 |  |
| `jobId` | 직무 id |  |
| `jobName` | 직무명 |  |
| `education` | 최종학력 |  |
| `ip` | ip 주소 |  |

</details>

### `kj_top_ranking_pv` — 채용/인사이트

**설명:** 일간 기업별 조회 수 순위 200

⚠️ **특이사항:** 2022년 9월 2일 이전에는 주간단위 였으나 이후로는 일간 단위

_owner: taeeun@wantedlab.com_

<details><summary>컬럼 7개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `bjd_name` | 법정동명 |  |
| `category` | 산업 카테고리 |  |
| `rank` | 순위 |  |
| `version` | 업데이트 날짜 |  |
| `counts` | 조회 수 |  |
| `pk_nm_hash` | 크레딧잡에 사용되는 pk hash |  |
| `company_name` | 회사명 |  |

</details>

### `nts_code` — 채용/인사이트

**설명:** 2019년 국세청 산업 분류표

⚠️ **특이사항:** raw_pk 테이블의 nts_code와 연결 가능

_owner: 최종원 Jongwon Choi_

<details><summary>컬럼 10개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `groups` | 산업 그룹 (3분류) |  |
| `groups_code` | 산업 그룹 코드 |  |
| `division` | 산업 디비전 (2분류) |  |
| `division_code` | 산업 디비젼 코드 |  |
| `section` | 산업 명칭 (1분류) |  |
| `sub_class` | 산업 부 클래스 분류 (5분류) |  |
| `section_code` | 산업 섹션 코드 |  |
| `class` | 산업 클래스 분류 (4분류) |  |
| `class_code` | 산업 클래스 코드 |  |
| `code` | 산업분류 코드 |  |

</details>

### `raw_pk` — 채용/인사이트

**설명:** kjdb.raw 에 크레딧잡 PK 를 연결한 테이블

⚠️ **특이사항:** 원티드 기업과 연결할 때 legacy_pk_nm_hash 사용, 쿼리 조회 시 WHERE DATA_CRT_YM >= '날짜' 필 수

_owner: 최종원 Jongwon Choi_

<details><summary>컬럼 38개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `JNNGP_CNT` | 가입자수 |  |
| `CUST_LDONG_ADDR_CD` | 고객법정동주소코드 |  |
| `CUST_PADONG_ADDR_CD` | 고객행정동주소코드 |  |
| `average_salary` | 국민연금요율로 역산된 평균연봉 |  |
| `nts_code` | 국세청 기준 2019년 업종분류코드 |  |
| `CRRMM_NTC_AMT` | 당월고지금액 |  |
| `bjd_open` | 법정동 존폐여부 |  |
| `bjd_name` | 법정동명 |  |
| `LDONG_ADDR_MGPL_DG_CD` | 법정동주소광역시도코드 |  |
| `LDONG_ADDR_MGPL_SGGU_EMD_CD` | 법정동주소광역시시군구읍면동코드 |  |
| `LDONG_ADDR_MGPL_SGGU_CD` | 법정동주소광역시시군구코드 |  |
| `bjd_code` | 법정동코드 |  |
| `BZOWR_RGST_NO` | 사업자등록번호 |  |
| `WKPL_JNNG_STCD` | 사업장가입상태코드 |  |
| `WKPL_ROAD_NM_DTL_ADDR` | 사업장도로명상세주소 |  |
| `WKPL_NM` | 사업장명 |  |
| `WKPL_INTP_CD` | 사업장업종코드 |  |
| `VLDT_VL_KRN_NM` | 사업장업종코드명 |  |
| `WKPL_LTNO_DTL_ADDR` | 사업장지번상세주소 |  |
| `WKPL_STYL_DVCD` | 사업장형태구분코드 |  |
| `LSS_JNNGP_CNT` | 상실가입자수 |  |
| `sgg` | 시, 군, 구 코드 |  |
| `sido` | 시, 도 코드 |  |
| `NW_ACQZR_CNT` | 신규취득자수 |  |
| `ZIP` | 우편번호 |  |
| `stdrDe` | 원본 CSV 파일이 등록된 날짜 |  |
| `umd` | 읍, 면, 동 코드 |  |
| `DATA_CRT_YM` | 자료생성년월(일별로 파티셔닝 되어 있음) |  |
| `SCSN_DT` | 재등록일자 |  |
| `ADPT_DT` | 적용일자 |  |
| `filter_workers` | 정규, 상용, 일용 구분 |  |
| `corp_category` | 주식회사, 합자회사, 유한회사 등의 기업분류 |  |
| `legacy_pk_nm` | 크레딧잡에 사용되는 pk |  |
| `legacy_pk_nm_hash` | 크레딧잡에 사용되는 pk hash |  |
| `RRG_DT` | 탈퇴일자 |  |
| `section_code` | 표준산업분류코드 |  |
| `pk_nm` | pk (크레딧잡에 사용되지 않음) |  |
| `pk_nm_hash` | pk hash (크레딧잡에 사용되지 않음) |  |

</details>

---

## 📦 `audit` (12개 테이블)

### `cloudaudit_googleapis_com_activity` 

**설명:** 감사로그 소스 테이블

### `cloudaudit_googleapis_com_data_access` 

**설명:** 감사로그 소스 테이블

### `iam_grant_trace` 

**설명:** 빅쿼리 권한 부여 내역

_owner: 최종원 Jongwon Choi_

<details><summary>컬럼 3개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `role` | 권한을 부여한 롤 |  |
| `members` | 권한을 부여한 멤버 리스트 |  |
| `principalEmail` | 권한을 행사한 계정 |  |

</details>

### `jira` 

**설명:** 지라 데이터

_owner: 최종원 Jongwon Choi_

<details><summary>컬럼 2개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `fields` | 이슈 데이터 |  |
| `key` | 이슈 키 |  |

</details>

### `metadata_query_results` 

**설명:** query_results 에서 wanteddb 를 사용한 뷰 테이블들

_owner: 최종원 Jongwon Choi_

### `table_vcs` 

**설명:** 빅쿼리 테이블 생성 이력

_owner: 최종원 Jongwon Choi_

### `wanted_audit` 

**설명:** 빅쿼리 쿼리 이력

_owner: 최종원 Jongwon Choi_

<details><summary>컬럼 2개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `callerSuppliedUserAgent` | jobId가 'job'이면서 callerSuppliedUserAgent가 'Tableau'로 시작하면 태블로로 실행한 쿼리임 |  |
| `jobId` | jobId가 난수이면서 callerSulliedUserAgent(이하 CSUA)가 'gl-python' 이면 gbq로 실행한 쿼리임. 동일하게 난순데 CSUA가 'Google-Apps-Script'이면 신봉훈님이 뭔가 자동화해서 실행한 쿼리임. 'job'혹은 'script'인 경우도 봉훈님 작품. 'bquxjob'는 빅쿼리에서 직접 실행한 쿼리. |  |

</details>

### `wanted_audit_totalBilled_drilldown` 

**설명:** 누가(principalEmail) 어떤 쿼리(query)를 얼마나(billedDollar) 몇번(queryCount) 조회했는지 확인하는 테이블

_owner: 최자연 (Jayeon Choi)_

### `wanted_group_email` 

**설명:** https://admin.google.com/ac/groups/{id}

_owner: 최종원 Jongwon Choi_

### `wanted_groups` 

**설명:** 원티드 구글 워크스페이스 구성원 그룹 이메일과 그룹에 속한 멤버 이메일

_owner: 최종원 Jongwon Choi_

### `wanted_gsuite_users` 

**설명:** 신규입사자가 자동 추가되는 원티드 직원 테이블

_owner: 최종원 Jongwon Choi_

### `wanteddb_vcs` 

**설명:** wanteddb 데이터베이스 버전관리

_owner: 최종원 Jongwon Choi_

---

## 📦 `oneid` (10개 테이블)

### `admin_role` 

**설명:** 원아이디 어드민 권한

_owner: 최자연 (Jayeon Choi)_

### `alembic_version` 

**설명:** DB스키마 버전

_owner: 최자연 (Jayeon Choi)_

### `client_custom_message` 

**설명:** 클라이언트 경로별 '시작하기' 페이지 커스텀 메시지

_owner: 최자연 (Jayeon Choi)_

### `dormant_user` 

**설명:** 휴면 유저

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 3개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `password` | 휴면 사용자 계정 비밀번호/인증정보. | account |
| `email` | 휴면 사용자 이메일. | email |
| `username` | 휴면 사용자 이름/username. | name |

</details>

### `leave_user` 

**설명:** 탈퇴 유저

_owner: 최자연 (Jayeon Choi)_

### `mobile` 

**설명:** 전화번호

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 2개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `unique_number` | 전화번호 계열 고유값. | phone number |
| `number` | 전화번호. | phone number |

</details>

### `service_client` 

**설명:** 원아이디를 사용하는 서비스/클라이언트

_owner: 최자연 (Jayeon Choi)_

### `user` 

**설명:** 유저

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 3개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `password` | 사용자 계정 비밀번호/인증정보. | account |
| `email` | 사용자 이메일. | email |
| `username` | 사용자 이름/username. | name |

</details>

### `user_client_relation` 

**설명:** 유저-클라이언트 연결 데이터 (service_client테이블과 연결)

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 1개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `client_id` | 1:oneid, 2:wanted, 3:dashboard, 5:spotlight, 6:kreditjob, 9:test |  |

</details>

### `user_provider` 

**설명:** 3rd-party가 제공한 데이터

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 3개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `email` | 외부 로그인/provider 연결 이메일. | email |
| `name` | 외부 로그인/provider 연결 이름. | name |
| `mobile` | 외부 로그인/provider 연결 휴대전화 번호. | phone number |

</details>

---

## 📦 `wantedspace_mart` (7개 테이블)

### `company_inactive` 

**설명:** 테스트와 퇴사한 유저에 의해 (자동으로)생긴 기업 정보
(주로 company와 left outer join하여 비활성화 기업을 제거하고자 할 때 사용)

_owner: 최자연 (Jayeon Choi)_

### `company_payplan` 

**설명:** 기업이 사용중인 플랜 정보 (company_purchaselog와 join 불가능)

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 5개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `plan_opt_price` | plan_main_price + plan_opt_price + payroll_price >0 이면 유료유저입니다 |  |
| `plan_start_date` | 플랜 사용 시작일 |  |
| `pp_id` | 플랜 id |  |
| `plan_opt` | FREE : 무료(5인미만), ALL	: 사용, NONE : 미사용 |  |
| `plan_main` | FREE_LT5 : 5인미만무료, STANDARD : 스탠다드, PREMIUM : 프리미엄, "LEFT"는 "해지"라는 뜻. plan_main 이 LEFT 인 컬럼의 plan_start_date 가 해지한 날짜입니다. |  |

</details>

### `company_purchaselog` 

**설명:** 기업의 결제이력 (현금결제내역 없음 / 2021.07기준) 
전 월 사용액을 매월 5일에 결제 (company_payplan과 join 불가능)

_owner: 최자연 (Jayeon Choi)_

### `user_request` 

**설명:** 유저 휴가/외근/재택 신청에 대한 뷰 테이블 (간혹 한 user_id 가 다른 company_id 에 속할수 있으므로 user와 join시 user_id, company_id 를 모두 사용)

_owner: 최자연 (Jayeon Choi)_

### `company` — 원스/공통

**설명:** 기업 정보

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 3개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `work_week_default` | 주별 근무일; ex)TTTTTFF는 T: 근무, F: 휴일 |  |
| `cmap_id` | 회사가 커먼스페이스 가입시 원티드랩이나 크레딧잡에 기존 가입한 아이디가 있다면 매칭되는 id값 |  |
| `company_type` | WANTED 또는 KREDITJOB |  |

</details>

### `user` — 원스/공통

**설명:** 유저 정보

<details><summary>컬럼 8개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `user_id` | 유저id |  |
| `company_id` | 기업id |  |
| `manage_type` | 0:최고관리자, 1:중간관리자, 8:기타관리자(회사전체), 9:기타관리자(부서) (기타 : 출퇴근, 휴가, 재택근무 등등), -1:관리권한 없음 |  |
| `eid_num` | 사번 |  |
| `joined_date` | 입사일 |  |
| `invite_code` | 초대 코드 |  |
| `contract_type` | FULL_TIME_1 : 정규직, PART_TIME_1 : 단기계약직, IRREGULAR_1 : 계약직, INTERN_1 : 인턴, NOT_ASSIGNED : 지정안됨 |  |
| `cmem_status` | INVITED : 초대중, READY : 입사전, WORKING : 직원, RETIRED : 퇴사, ABSENCE : 일시정지 |  |

</details>

### `user_worktime` — 원스/공통

**설명:** 유저 출퇴근 이력에 대한 뷰 테이블

_owner: 최자연 (Jayeon Choi)_

---

## 📦 `amplitude` (5개 테이블)

### `event_activity` 

**설명:** 앰플리튜드 wanted-www 프로젝트 > Govern페이지 이벤트 리스트 추출 테이블; 이벤트 Activity 확인용(수동업데이트)

_owner: 최자연 (Jayeon Choi)_

### `kreditjob` 

**설명:** Amplitude insight (kreditjob-www프로젝트의 로그가 여기에 쌓인다.)

_owner: 성여운(Yeouhn Sung)_

### `round_up` 

**설명:** Amplitude Round up

_owner: 최종원 Jongwon Choi_

<details><summary>컬럼 19개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `user_creation_time` | 고유 ID 가 처음 생성된 시점? |  |
| `country` | 국가 |  |
| `device_model` | 기기 모델명 |  |
| `device_brand` | 기기 브랜드 |  |
| `library` | 데이터 카테고리 및 버전 |  |
| `session_id` | 세션 |  |
| `ip_address` | 아이피 |  |
| `server_upload_time` | 앰플리튜드 서버에 업로드된 시간 Attribute 데이터와 연관됨 |  |
| `amplitude_id` | 앰플리튜드가 측정하는 고유 ID |  |
| `language` | 언어? 번역과 연관되어있나? |  |
| `user_id` | 유저 아이디 |  |
| `user_properties` | 유저 프로퍼티 |  |
| `region` | 유저 프로퍼티 |  |
| `event_properties` | 이벤트 프로퍼티 |  |
| `unknown_user_id` | 이벤트로 발생하는 user_id 가 정수가 아니고 문자열일 경우 여기로 옮김 주로 해시된 유저 아이디인듯 |  |
| `event_type` | 직접 설정한 이벤트 또는 대괄호가 있는 경우 연동된 이벤트 |  |
| `os_name` | ios / android / 어느 웹브라우저인지 |  |
| `device_id` | R 이 마지막에 붙으면 Android 기기 ID 그렇지 않은경우 IDFV |  |
| `city` | region 보다 하위 개념 |  |

</details>

### `www` 

**설명:** Amplitude wanted (wanted-all프로젝트의 로그가 여기에 쌓인다. 이름이 www여서 오해하면 안된다. insight 등 다른 서비스 로그는 없고 원티드꺼만 있다!)

_owner: 최종원 Jongwon Choi_

<details><summary>컬럼 20개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `event_time` | UTC |  |
| `user_creation_time` | 고유 ID 가 처음 생성된 시점? |  |
| `country` | 국가 |  |
| `device_model` | 기기 모델명 |  |
| `device_brand` | 기기 브랜드 |  |
| `library` | 데이터 카테고리 및 버전 |  |
| `session_id` | 세션 |  |
| `ip_address` | 아이피 |  |
| `server_upload_time` | 앰플리튜드 서버에 업로드된 시간 Attribute 데이터와 연관됨 |  |
| `amplitude_id` | 앰플리튜드가 측정하는 고유 ID |  |
| `language` | 언어? 번역과 연관되어있나? |  |
| `user_id` | 유저 아이디 |  |
| `user_properties` | 유저 프로퍼티 |  |
| `region` | 이벤트 발생 지역 |  |
| `event_properties` | 이벤트 프로퍼티 |  |
| `unknown_user_id` | 이벤트로 발생하는 user_id 가 정수가 아니고 문자열일 경우 여기로 옮김 주로 해시된 유저 아이디인듯 |  |
| `event_type` | 직접 설정한 이벤트 또는 대괄호가 있는 경우 연동된 이벤트 |  |
| `os_name` | ios / android / 어느 웹브라우저인지 |  |
| `device_id` | R 이 마지막에 붙으면 Android 기기 ID 그렇지 않은경우 IDFV |  |
| `city` | region 보다 하위 개념 |  |

</details>

### `www_amp_id` 

**설명:** 모든 비로그인 상태의 device 를 amplitude_id 로 연결한 테이블

_owner: 최종원 Jongwon Choi_

<details><summary>컬럼 3개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `merged_amplitude_id` | amplitude.www.amplitude_id 와 연결하여 key값처럼 사용. 만약 amplitude_id 에 대응되는 merged_amplitude_id가 없는 상태면 해당 amplitude_id를 key값처럼 사용하면 됨 |  |
| `scope` | export_id |  |
| `merge_server_time` | server_upload_time 과 비교해서 보라고 문서에 적혀있습니다 |  |

</details>

---

## 📦 `bi_dashboard` (5개 테이블)

### `looker__carrying_capacity` 

**설명:** 루커용 carrying capacity 데이터

_owner: 이상인 (Lee Sangin)_

<details><summary>컬럼 12개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `date` | 날짜. (YYYY-MM) |  |
| `mau` | 원티드 MAU |  |
| `organic_mau` | 원티드 오가닉 MAU |  |
| `new_user` | 신규 오가닉 유저 |  |
| `resurrected_user` | 회귀 오가닉 유저 |  |
| `dormant_user` | 이탈 오가닉 유저 |  |
| `weight` | 가중치(직전 2개월~해당월 오가닉MAU평균(단, 최대값제외) / 현 MAU) |  |
| `weighted_organic` | 가중치 적용 원티드 오가닉 MAU |  |
| `weighted_inflow` | 가중치 적용 원티드 신규+회귀 오가닉 유저 |  |
| `weighted_dormant` | 가중치 적용 원티드 이탈 오가닉 유저 |  |
| `weighted_churn_rate` | 가중치 적용 이탈률 |  |
| `CC` | carrying_capacity, weighted_inflow/weighted_churn_rate |  |

</details>

### `looker__Hire_Board` 

**설명:** 합격자 정보 테이블. 기존 태블로 Hire Board용 데이터. 현재 Looker에 대시보드는 따로 없음.

_owner: 유지윤 (Jiyoon You)_

<details><summary>컬럼 21개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `apply_id` | 지원서 ID |  |
| `country` | 합격이 일어난 공고를 올린 기업의 국가 |  |
| `company_id` | 기업ID |  |
| `company_name` | 기업명 |  |
| `position_name` | 포지션명 |  |
| `company_size` | 기업규모 |  |
| `industry` | 기업 산업군 |  |
| `job_category` | 포지션 직군 |  |
| `user_id` | 유저ID |  |
| `user_name` | 유저 이름 |  |
| `annual` | 유저 연차 |  |
| `email` | 유저 이메일 |  |
| `mobile` | 유저 휴대폰번호 |  |
| `resume_time` | 지원서 이력서 업로드/첨부 시각. 원천은 wanteddb.apply.resume_time. |  |
| `pass_time` | 서류통과 일시 |  |
| `hire_time` | 최종합격 일시 |  |
| `hirer_id` | 최종합격시킨 기업담당자 ID |  |
| `hirer` | 최종합격 처리자 이름으로 보이지만 현재 뷰 SQL은 a.hirer_id가 아니라 지원자 user_id로 analytics_mart.user.name을 조인하고 있어 사용 시 주의. |  |
| `hirer_email` | 최종합격 처리자 이메일로 보이지만 현재 뷰 SQL은 a.hirer_id가 아니라 지원자 user_id로 analytics_mart.user.email을 조인하고 있어 사용 시 주의. |  |
| `hiring_product_type` | 지원유형 (normal: 일반지원, matchup: 매치업 선과금, matchup_unlimited: 매무요, recruit:외부지원) |  |
| `is_first_hire` | 첫 채용 여부 (1: 첫 채용, 0: 첫 채용 아님) |  |

</details>

### `OPS__Backdoor_Companies` 

**설명:** https://wantedx.slack.com/archives/C8QFV04EQ/p1627442096308300

_owner: 유지윤 (Jiyoon You)_

### `OPS__Backdoor_Positions` 

**설명:** https://wantedx.slack.com/archives/C8QFV04EQ/p1627442096308300

_owner: 유지윤 (Jiyoon You)_

### `OPS__Marketing_Simulation` 

**설명:** https://wantedx.slack.com/archives/C8QFV04EQ/p1627442096308300

_owner: 유지윤 (Jiyoon You)_

<details><summary>컬럼 20개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `Contract_status` | 계약서 상태 (DATARQ-3111) |  |
| `Contract_confirm_time` | 계약서 승인일시 (DATARQ-3111) |  |
| `Uploaded_contract` | 계약서 파일 업로드 유무 N, Y (DATARQ-2569) |  |
| `Upload_time` | 계약서 파일이 업로드 된 시각 (DATARQ-2569) |  |
| `Expired_CV` | 기간 만료 수 (한 달 동안 응답하지 않음) |  |
| `Secret_Diary` | 비밀일기 |  |
| `Respond_Ratio` | 유효 응답률 (딩/기간만료 제외) |  |
| `All_responded_CV` | 전체 응답 수 |  |
| `All_sent_CV` | 전체 전송 수 (원티드 -> 기업, DING 제외) |  |
| `All_registered_position` | 전체 포지션 (한 번이라도 등록 완료된 포지션) |  |
| `Hiring_ratio` | 전체채용률 |  |
| `Hired` | 채용 수 (일반채용만) |  |
| `Passible_ratio` | 채용적합률 |  |
| `Responded_CV` | 최근 1개월 응답 수 |  |
| `Sent_CV` | 최근 1개월 전송 수 (원티드 -> 기업) |  |
| `Final_access_date` | 최종 접속일 |  |
| `Control_reason` | 포지션 승인불가 사유 (DATARQ-3111) |  |
| `Control_last_update_date` | 포지션 승인여부, 사유 마지막 변경일 (DATARQ-3111) |  |
| `Now_hiring_position` | 현재 채용 중인 포지션 |  |
| `D_plus` | D+ |  |

</details>

---

## 📦 `wanted_cdc` (5개 테이블)

### `_wanted_www` 

**설명:** 2021-01-27 10:48:23

_owner: 최종원 Jongwon Choi_

### `apply_status` 

**설명:** DATARQ-1690

_owner: 최종원 Jongwon Choi_

### `binlog_meta` 

**설명:** CDC 멱등성 관리 테이블

_owner: 최종원 Jongwon Choi_

### `profile_level_history` 

**설명:** wanteddb.user_profile_level_history 테이블이 더이상 업데이트가 되지 않는다는 소식을 접하고 생성한 테이블

_owner: 최종원 Jongwon Choi_

### `user_last_access` 

**설명:** 유저 마지막 접속 히스토리

_owner: 최종원 Jongwon Choi_

---

## 📦 `appsflyer` (3개 테이블)

### `installs` 

**설명:** 앱 설치 데이터 종합

_owner: 최종원 Jongwon Choi_

<details><summary>컬럼 5개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `platform` | 웹 ios android |  |
| `campaign` | 유입된 켐페인이 있을 경우 |  |
| `media_source` | digitalfirst, Facebook Ads 등 광고 미디어 소스 또는 organic |  |
| `device_id` | IDFV or ADID; Amplitude 의 device_id 와 다름 |  |
| `channel` | Instagram, Messenger, ACI_Search 등 채널 |  |

</details>

### `installs_report` 

**설명:** 논오가닉 앱 설치 데이터 AppsFlyer Installs - Raw Data Export

_owner: 최종원 Jongwon Choi_

### `organic_installs_report` 

**설명:** 오가닉 앱 설치 데이터 AppsFlyer Installs - Raw Data Export

_owner: 최종원 Jongwon Choi_

---

## 📦 `kreditjob_mart` (2개 테이블)

### `company` 

**설명:** 크레딧잡 기업 스냅샷

_owner: 성여운(Yeouhn Sung)_

<details><summary>컬럼 26개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `pk_nm_hash` | pk 해시값 |  |
| `company_name` | 기업명 |  |
| `founded_date` | 설립날짜 |  |
| `address` | 주소 |  |
| `nts_code` | 국세청 코드 |  |
| `industry_1` | 산업 대분류 |  |
| `industry_2` | 산업 중분류 |  |
| `industry_3` | 산업 소분류 |  |
| `industry_4` | 산업 최소분류 |  |
| `c_employee` | 직원수 (국민연금 기준 최신값) |  |
| `hired_rate` | 입사율 (국민연금 기준, 최근 1년 데이터로 계산) |  |
| `left_rate` | 퇴사율 (국민연금 기준, 최근 1년 데이터로 계산) |  |
| `c_hired` | 고용인원 |  |
| `c_left` | 퇴사인원 |  |
| `nps_avg_salary` | 국민연금 기준 평균연봉 값 |  |
| `nps_update_date` | 국민연금 기준 직원 수 마지막 업데이트 날짜 |  |
| `fss_avg_salary` | 금감원 기준 평균연봉 값 |  |
| `fss_revenue` | 금감원 기준 매출값 |  |
| `fss_operating_profit` | 금감원 기준 영업이익 |  |
| `fss_net_income` | 금감원 기준 순이익 |  |
| `fss_settlement_date` | 금감원 결제일 |  |
| `alio_avg_salary` | 알리오 기준 평균 연봉 |  |
| `alio_update_date` | 알리오 최근 업데이트 날짜 |  |
| `clean_avg_salary` | 클린아이 기준 평균 연봉 |  |
| `clean_update_date` | 클린아이 최근 업데이트 날짜 |  |
| `company_id` | 인사이트 서버에서 부여한 company_id. wanteddb.company_des.id와는 다르다. 인사이트 제품에선 장차 이게 key로 쓰일 수도 있기 때문에 카트 테이블에 남김. |  |

</details>

### `user_connect` — 채용/인사이트

**설명:** 크레딧잡 유저 아이디를 기준으로 원아이디, 원티드 유저 아이디를 확인할 수 있는 테이블

_owner: 이상인 (Lee Sangin)_

<details><summary>컬럼 3개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `insight_user_id` | 인사이트(크레딧잡) 유저 아이디 |  |
| `oneid_user_id` | 원아이디 유저 아이디 |  |
| `wanted_user_id` | 원티드 유저 아이디 |  |

</details>

---

## 📦 `wanted_ml` (2개 테이블)

### `user_test_group` 

**설명:** 유저ID별 A/B 테스트 그룹에 따라 할당된 model_type

### `zendesk_voc_classified` 

**설명:** 젠데스크 VOC를 LaaS를 활용해 인바운드만 필터링 & 카테고리별 분류, 감정 분석, 키워드, 메인주제를 추출한 테이블. 루커로 확인 가능

_owner: 유지윤_

<details><summary>컬럼 11개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `event_create_time` | 젠데스크 티켓 생성 시간 |  |
| `id` | 젠데스크 티켓 ID |  |
| `title` | 티켓 제목 |  |
| `detail` | 티켓 내용 | phone number |
| `inbound_outbound` | 인바운드/아웃바운드 분류 via LaaS |  |
| `category1` | 대분류 (기업/유저) via LaaS |  |
| `category2` | 중분류 (카테고리) via LaaS |  |
| `category3` | 소분류 (문의태그) via LaaS |  |
| `overall_emotion` | 감정 분석 (긍정, 부정, 중립) via LaaS |  |
| `keywords` | 주요 키워드 via LaaS |  |
| `main_topic` | 메인 주제 via LaaS |  |

</details>

---

## 📦 `wanted_mongo` (2개 테이블)

### `admin_action_history` 

**설명:** 운영HQ 개인정보취급자 접속기록

_owner: 정민호 (Minho Jeong)_

<details><summary>컬럼 9개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `admin_user_id` | 개인정보취급자 ID |  |
| `target_user_ids` | 정보주체 ID |  |
| `type` | 개인정보 취급업무 |  |
| `action` | 개인정보 취급형태 |  |
| `client_ip_address` | 개인정보취급자 접속 IP |  |
| `reason` | 개인정보 다운로드 사유 |  |
| `create_time` | 개인정보 접속기록 생성 시간 |  |
| `description` | 기타 메모 |  |
| `url` | 개인정보 취급업무가 발생한 경로 |  |

</details>

### `event_video_play_history` 

**설명:** wanted+ 영상 시청 기록(시간) 정보

_owner: hweejin@wantedlab.com_

<details><summary>컬럼 12개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `create_time` | 시청 이력 생성 시점 |  |
| `playtime_percent` | 영상 (실제) 시청 비율 |  |
| `total_play_time` | 영상 (실제) 시청 시간(초) |  |
| `start_at` | 영상 시청 시작 시점 |  |
| `update_time` | 영상 시청 종료 시점 |  |
| `last_play_percent` | 유저가 해당 영상을 마지막으로 얼마나 시청했는지(%) |  |
| `last_play_at` | 유저가 해당 영상을 마지막으로 얼마나 시청했는지(초) |  |
| `country` | 유저의 국가 (wanteddb.user 기준) |  |
| `_id` | id (고유식별값) |  |
| `user_id` | user_id |  |
| `is_wantedplus` | wanted+ 구독자만 볼 수 있는 영상인지 여부 (1:y,0:n) |  |
| `media_content_key` | wanted+ 영상 고유 식별값 |  |

</details>

---

## 📦 `weaver` (2개 테이블)

### `wanted-cdc-www` 

**설명:** 원티드 데이터베이스 서버 변경 이력: 해당 서버의 (권한이 있는)모든 database에서 변경 이력을 받아온다.

_owner: 박찬민 (Chanmin Park)_

<details><summary>컬럼 15개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `database` | 데이터베이스 명 |  |
| `diff_keys` | 수정 이벤트의 경우, 변경된 column 값 리스트 |  |
| `event_type` | 생성: WRITE_ROWS_EVENT_V2, 수정: UPDATE_ROWS_EVENT_V2, 삭제: DELETE_ROWS_EVENT_V2 |  |
| `log_file` | binlog 파일명 |  |
| `log_pos` | binlog 포지션 |  |
| `pk` | primary key |  |
| `rows` | raw row data: 생성, 삭제의 경우 values / 수정의 경우 before_values, after_values 안에 값이 있음 |  |
| `server_id` | cdc 머신이 데이터베이스 서버에 붙을 때 unique 서버 명 |  |
| `table` | 테이블 명 |  |
| `timestamp` | db row 생성/수정 시점 |  |
| `group_id` | kafka 컨슈머 그룹 |  |
| `offset` | kafka 오프셋 |  |
| `partition` | kafka 파티션 |  |
| `key` | kafka 키: database.table.pk |  |
| `event_create_time` | 메세지가 kafka에 들어온 시점 |  |

</details>

### `weaver-event-www` 

**설명:** 위버로 들어오는 track 이벤트

_owner: 박찬민 (Chanmin Park)_

<details><summary>컬럼 5개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `partition` | kafka 파티션 |  |
| `offset` | kafka 오프셋 |  |
| `key` | kafka 키 |  |
| `value` | raw event data |  |
| `event_create_time` | 이벤트가 kafka에 들어온 시점 |  |

</details>

---

## 📦 `external` (1개 테이블)

### `jumpit_raw` 

**설명:** 점핏 크롤링

_owner: 최종원 Jongwon Choi_

---

## 📦 `kjdb` (1개 테이블)

### `kbi` 

**설명:** https://wantedx.slack.com/archives/CPDFVT4MT/p1597391792004900

_owner: 최종원 Jongwon Choi_

---

## 📦 `wanted_logs` (1개 테이블)

### `was` 

**설명:** api를 통해 유입되는 데이터 전체 로그성 테이블 (airflow DAG api_log_mirror_backfill로 업로드됨)

_owner: 최자연 (Jayeon Choi)_

<details><summary>컬럼 1개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `timestamp` | 한국시간 (UTC +9) |  |

</details>

---

## 📦 `wanteddb_sns` (1개 테이블)

### `KafkaUser` 

**설명:** 소셜 유저 정보

_owner: 유지윤 (Jiyoon You)_

<details><summary>컬럼 1개</summary>

| 컬럼 | 설명 | 정책 태그 |
|---|---|---|
| `preferences` | 경력,학력 공개 여부 {'career': true or false, 'education': true or false} 형태 |  |

</details>
