# 원티드(Wanted) DB 지식 파일

BigQuery 프로젝트: `wanted-data`, 데이터셋: `wanteddb`

## 기능 → 테이블 매핑 (빠른 참조)

| 기능 | 조회할 테이블 |
|---|---|
| 채용공고 | `wanted_des`, `wanted_job_detail`, `wanted_job_reward` |
| 지원/합격 | `apply`, `apply_source`, `apply_kanban`, `apply_result_message` |
| 이력서 | `resume`, `resume_keyword`, `wanted_resume`, `user_skill` |
| 유저 프로필 | `user`, `user_career`, `user_education`, `user_skill`, `user_pref` |
| 기업 | `company_des`, `company_detail`, `company_image`, `company_follow` |
| 매칭/추천 | `matching_score`, `matching_history`, `recommendation` |
| 제안 (면접/오퍼) | `proposal`, `proposal_response`, `proposal_template` |
| 북마크/관심 | `bookmark`, `company_follow`, `alarm_keyword` |
| 커뮤니티 | `community_post`, `community_comment`, `community_like` |
| 이벤트 | `event`, `event_registration`, `event_survey` |
| 결제/포인트 | `order`, `payment`, `wpoint`, `mileage_*` |
| AI 기능 | `ai_score`, `ai_agent_*`, `matching_score` |
| 채용 프로세스 | `hiring`, `hiring_processing`, `hire_evidence` |
| 긱스(프리랜서) | `wanted_gigs.*` — experts, clients, projects, matches, Estimate |
| 통계/지표 | `wanted_stats.*` — DAU/MAU, 기업 활성도, 응답률 |
| 분석 마트 | `analytics_mart.*` — 정제된 유저/지원/공고/이력서 |
| AI 에이전트 | `wanted_agent.*` — 대화 이력, 추천, 알림 |

## 상태값/Enum 정의

### apply.status (지원 상태)

| 값 | 의미 | 건수 |
|---|---|---|
| 1 | 지원 완료 | 1,567K |
| 2 | 서류 열람 | 57K |
| 3 | 불합격 | 9,460K |
| 4 | 서류 합격 | 33K |
| 5 | 최종 합격 | 110K |
| 6 | 채용 확정 | 10K |
| 8 | 지원 취소 | 62K |
| 10 | 면접 진행 | 1,573K |
| 100 | 추천 지원 | 1,992K |
| 101~112 | 추천 관련 세부 상태 | 다양 |
| -4 | 특수 상태 | 15K |

### wanted_des.status (채용공고 상태)

| 값 | 의미 | 건수 |
|---|---|---|
| active | 채용 중 | 11K |
| close | 마감 | 254K |
| archived | 보관 | 57K |
| draft | 임시저장 | 17K |
| saved | 저장 | 16K |
| request | 승인 요청 | 467 |

### wanted_des.employment_type (고용 형태)

| 값 | 의미 |
|---|---|
| regular | 정규직 |
| contract | 계약직 |
| intern | 인턴 |

### proposal.type (제안 상태)

| 값 | 의미 | 건수 |
|---|---|---|
| OFFER | 제안 발송 | 39K |
| USER_CHECK | 유저 확인 | 12K |
| USER_ACCEPT | 수락 | 13K |
| USER_REJECT | 거절 | 265K |
| USER_EXPIRE_REJECT | 만료 거절 | 884K |
| INTERVIEW_REJECT | 면접 후 거절 | 100K |
| USER_APPLY | 지원 전환 | 3K |
| HIRE | 채용 | 4K |
| OVERDUE | 기한 초과 | 7K |
| RESUME_PASS | 이력서 합격 | 404 |

### company_des.confirm_status (기업 인증 상태)

| 값 | 의미 |
|---|---|
| COMPLETION | 인증 완료 |
| REJECT | 거절 |
| REQUESTING | 요청 중 |
| NOREQUEST | 미요청 |
| AUTOSAVE | 자동저장 |

## 핵심 테이블 스키마

### user (구직자)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | INT64 | PK |
| email | STRING | 이메일 |
| company | STRING | 현재 회사명 |
| title | STRING | 직함 |
| company_id | INT64 | FK → company_des (기업 회원일 때) |
| mobile | STRING | 전화번호 |
| annual | INT64 | 연차 |
| status | INT64 | 상태 |
| country | STRING | 국가 |
| oneid | STRING | OneID (통합 인증) |
| is_profile_public | STRING | 프로필 공개 여부 |
| create_time | TIMESTAMP | 가입일 |
| last_login_time | TIMESTAMP | 마지막 로그인 |
| leave_time | TIMESTAMP | 탈퇴일 |

### user_career (경력)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | INT64 | PK |
| user_id | INT64 | FK → user |
| title | STRING | 직함 |
| company_name | STRING | 회사명 |
| start_year/month | INT64 | 시작 연/월 |
| end_year/month | INT64 | 종료 연/월 |
| description | STRING | 업무 내용 |
| employment_type | STRING | 고용 형태 |
| job_role | STRING | 직무 |
| wanted_resume_id | INT64 | FK → wanted_resume |

### user_education (학력)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | INT64 | PK |
| user_id | INT64 | FK → user |
| school_name | STRING | 학교명 |
| major | STRING | 전공 |
| degree | INT64 | 학위 |
| status | STRING | 상태 (재학/졸업 등) |
| start_year/month | INT64 | 시작 연/월 |
| end_year/month | INT64 | 종료 연/월 |

### user_skill (스킬 태그)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | INT64 | PK |
| user_id | INT64 | FK → user |
| tag_type_id | INT64 | FK → tag_type |
| wanted_resume_id | INT64 | FK → wanted_resume |

### wanted_des (채용공고)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | INT64 | PK (= wd_id) |
| company_id | INT64 | FK → company_des |
| position | STRING | 포지션명 |
| jd | STRING | Job Description |
| main_tasks | STRING | 주요업무 |
| requirements | STRING | 자격요건 |
| preferred_points | STRING | 우대사항 |
| benefits | STRING | 혜택 및 복지 |
| status | STRING | 공고 상태 (위 enum 참조) |
| employment_type | STRING | 고용 형태 (위 enum 참조) |
| salary_min/max | INT64 | 연봉 범위 |
| annual_from/to | INT64 | 경력 범위 |
| due_time | TIMESTAMP | 마감일 |
| create_time | TIMESTAMP | 작성일 |
| confirm_time | TIMESTAMP | 승인일 |
| country | STRING | 국가 |
| is_private | INT64 | 비공개 여부 |

### wanted_job_detail (채용공고 상세 — 다국어/보상)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | INT64 | PK |
| wd_id | INT64 | FK → wanted_des |
| company_id | INT64 | FK → company_des |
| position | STRING | 포지션명 (다국어) |
| main_tasks | STRING | 주요업무 (다국어) |
| reward_recommendee | INT64 | 합격자 보상금 |
| reward_recommender | INT64 | 추천인 보상금 |
| lang | STRING | 언어 |
| hire_rounds | STRING | 채용 전형 단계 |

### apply (지원)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | INT64 | PK |
| wd_id | INT64 | FK → wanted_des |
| user_id | INT64 | FK → user |
| company_id | INT64 | FK → company_des |
| status | INT64 | 지원 상태 (위 enum 참조) |
| source | STRING | 유입 경로 |
| apply_time | TIMESTAMP | 지원일 |
| open_time | TIMESTAMP | 열람일 |
| pass_time | TIMESTAMP | 합격일 |
| reject_time | TIMESTAMP | 불합격일 |
| hire_time | TIMESTAMP | 채용 확정일 |
| cancel_time | TIMESTAMP | 취소일 |
| cancel_reason | STRING | 취소 사유 |
| reject_reason | STRING | 불합격 사유 |
| score | FLOAT64 | AI 점수 |
| matching_id | INT64 | 매칭 ID |
| recommender_id | INT64 | 추천인 |

### company_des (기업)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | INT64 | PK |
| name | STRING | 기업명 |
| info | STRING | 기업 소개 |
| location | STRING | 위치 |
| website | STRING | 웹사이트 |
| company_size | STRING | 기업 규모 |
| founded_year | INT64 | 설립 연도 |
| confirm_status | STRING | 인증 상태 (위 enum 참조) |
| is_visible | INT64 | 노출 여부 |
| country | STRING | 국가 |

### company_follow (기업 팔로우)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | INT64 | PK |
| user_id | INT64 | FK → user |
| company_id | INT64 | FK → company_des |
| follow | INT64 | 팔로우 상태 |
| follow_time | TIMESTAMP | 팔로우 시각 |
| unfollow_time | TIMESTAMP | 언팔로우 시각 |

### bookmark (공고 북마크)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | INT64 | PK |
| wd_id | INT64 | FK → wanted_des |
| user_id | INT64 | FK → user |
| flag | INT64 | 북마크 상태 |
| create_time | TIMESTAMP | 생성일 |

### resume (이력서)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | INT64 | PK |
| user_id | INT64 | FK → user |
| is_default | INT64 | 기본 이력서 여부 |
| is_written | INT64 | 원티드 이력서 작성 여부 |
| is_matching | INT64 | 매칭용 이력서 여부 |
| wanted_resume_id | INT64 | FK → wanted_resume |
| document_type | STRING | 문서 유형 |

### proposal (기업 제안)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | INT64 | PK |
| company_id | INT64 | FK → company_des |
| target_user_id | INT64 | FK → user |
| job_id | INT64 | FK → wanted_des |
| type | STRING | 제안 상태 (위 enum 참조) |
| offer_type | STRING | 오퍼 유형 |
| min_salary/max_salary | INT64 | 제안 연봉 범위 |
| created_time | TIMESTAMP | 제안일 |
| expired_time | TIMESTAMP | 만료일 |

### matching_score (AI 매칭)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | INT64 | PK |
| user_id | INT64 | FK → user |
| resume_id | INT64 | FK → resume |
| wd_id | INT64 | FK → wanted_des |
| score | FLOAT64 | 매칭 점수 |
| model_version | INT64 | 모델 버전 |

## 주요 관계 (FK)

```
user ──┬── apply.user_id
       ├── resume.user_id
       ├── user_career.user_id
       ├── user_education.user_id
       ├── user_skill.user_id
       ├── proposal.target_user_id
       ├── matching_score.user_id
       ├── bookmark.user_id
       └── company_follow.user_id

company_des ──┬── wanted_des.company_id
              ├── apply.company_id
              ├── proposal.company_id
              └── company_follow.company_id

wanted_des ──┬── apply.wd_id
             ├── wanted_job_detail.wd_id
             ├── matching_score.wd_id
             ├── proposal.job_id
             └── bookmark.wd_id
```

## 자주 쓰는 쿼리 패턴

```sql
-- 테이블 스키마 조회
SELECT column_name, data_type, is_nullable
FROM `wanted-data.wanteddb.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = '테이블명'
ORDER BY ordinal_position;

-- 상태값 분포 확인
SELECT status, COUNT(*) as cnt
FROM `wanted-data.wanteddb.테이블명`
GROUP BY status ORDER BY cnt DESC;

-- 테이블 목록 검색 (키워드)
SELECT table_name FROM `wanted-data.wanteddb.INFORMATION_SCHEMA.TABLES`
WHERE table_name LIKE '%키워드%';

-- 샘플 데이터 (최근 10건)
SELECT * FROM `wanted-data.wanteddb.테이블명`
ORDER BY create_time DESC LIMIT 10;
```

## 다른 데이터셋

### wanted_agent (AI 에이전트)

| 테이블 | 설명 |
|---|---|
| USER_CONVERSATIONS | 에이전트 대화 이력 |
| APPLY_BY_WANTED_AGENT_HISTORY | 에이전트 통한 지원 이력 |
| CONVERSATION_POSITIONS_LOG | 대화 중 추천 포지션 로그 |
| EVALUATION_LOG | 평가 로그 |
| POSITION_RECOMMENDED_WANTED_DES_HISTORY | 추천 공고 이력 |
| RECOMMENDED_WANTED_USER_PER_WANTED_DES_HISTORY | 공고별 추천 유저 이력 |
| USER_ALARM_SCHEDULE / USER_ALARM_SEND_LOG | 알림 스케줄/발송 로그 |
| WANTED_AGENT_DATA_COMPANY | 에이전트 기업 데이터 |

쿼리: `SELECT * FROM \`wanted-data.wanted_agent.테이블명\` LIMIT 10`

### wanted_stats (통계)

| 테이블 | 설명 |
|---|---|
| active_user_Y_M* | 월간 활성 유저 (상태별, 직군별) |
| amp_dau/wau/mau* | DAU/WAU/MAU (전체, 로그인, 비로그인) |
| company_activeness* | 기업 활성도 |
| company_response_rate* | 기업 응답률 |
| company_confirm | 기업 인증 통계 |
| company_KR | 기업 KR |
| live_position / live_position_daily | 라이브 공고 수 |
| position_history | 공고 이력 |
| monthly_position_apply_stats | 월간 공고별 지원 통계 |
| interview_response_rate* | 면접 응답률 |
| matchup_key_metrics / matchup_hire | 매치업 핵심 지표/채용 |
| dormant_rate | 휴면 비율 |
| carrying_capacity | 수용력 |

쿼리: `SELECT * FROM \`wanted-data.wanted_stats.테이블명\` LIMIT 10`

### analytics_mart (분석 마트 — 정제된 분석용 테이블)

| 테이블 | 설명 |
|---|---|
| user | 유저 분석용 (정제) |
| apply | 지원 분석용 (정제) |
| resume / resume_detail / resume_history | 이력서 분석용 |
| position_ko/en/ja/tw | 공고 다국어 분석용 |
| company_ko/en/ja/tw | 기업 다국어 분석용 |
| order | 주문 분석용 |
| event / event_registration | 이벤트 분석용 |
| job_category / job_role | 직군/직무 마스터 |
| tag_type / tag_*_category / tag_*_role | 태그 체계 |
| live_position_history | 라이브 공고 이력 |
| user_salary_history / company_salary_history | 연봉 이력 |
| company_first_hire | 기업 첫 채용 |

쿼리: `SELECT * FROM \`wanted-data.analytics_mart.테이블명\` LIMIT 10`

**참고:** analytics_mart는 wanteddb의 원본 데이터를 분석에 적합하게 정제/가공한 것. Spec 작성 시 현황 데이터가 필요하면 analytics_mart를, DB 구조 파악이 필요하면 wanteddb를 조회.

### wanted_gigs (긱스 — 프리랜서 매칭)

| 테이블 | 설명 |
|---|---|
| experts / Expert | 프리랜서(전문가) |
| clients / Client | 클라이언트(의뢰자) |
| projects / Project | 프로젝트(의뢰) |
| matches / Match | 매칭 |
| Estimate / ContractEstimate | 견적 |
| ContractClient / ContractExpert | 계약 (클라이언트/전문가) |
| ContractClientDetail / ContractExpertDetail | 계약 상세 |
| expert_reviews / client_reviews | 리뷰 (전문가/클라이언트) |
| ExpertGroup / expert_groups | 전문가 그룹 |
| ExpertTag / AdminTag / Tag | 태그 체계 |
| messages / Message | 메시지 |
| notifications / Notification | 알림 |
| ProjectBookmark / project_bookmarks | 프로젝트 북마크 |
| ProjectAdvertising | 프로젝트 광고 |
| resumes / ResumeProject / ResumeWork | 이력서/프로젝트 경력/업무 경력 |
| files / File | 파일 |
| users / User | 유저 |
| expert_level_histories | 전문가 레벨 이력 |
| change_histories / ChangeHistory | 변경 이력 |
| login_histories | 로그인 이력 |
| PartnerProduct / PartnerProductRequest | 파트너 상품/요청 |
| WorkScope | 업무 범위 |
| leave_user / LeaveData | 탈퇴 유저/데이터 |

쿼리: `SELECT * FROM \`wanted-data.wanted_gigs.테이블명\` LIMIT 10`

## 업데이트 이력

- 2026-04-16: 초기 생성 (7개 테이블)
- 2026-04-16: 고도화 — 기능→테이블 매핑, 상태값/Enum 정의, 추가 테이블 5개, 쿼리 패턴
- 2026-04-16: 데이터셋 확장 — wanted_agent, wanted_stats, analytics_mart, wanted_gigs 가이드 추가
