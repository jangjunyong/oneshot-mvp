---
type: research
status: draft
owner: research-team:web-researcher
lens: docs
question: 이동통신(KT 등) 기반 시군구 일별 체류인구(현지인·외지인·외국인) 자료만으로 "특정 기간에 축제(행사) 효과가 실제로 있었는가"를 판별·표시하는 기준과 방법론은 무엇이며, 이를 실제로 제공하는 비슷한 웹 서비스·공공 지침은 어떻게 하는가? 조사 대상 (1) 한국관광공사 한국관광데이터랩 '지역축제 방문자 분석'·'축제 방문객' 산출 방식, 문화체육관광부 문화관광축제 방문객 통계 산출 가이드라인(이동통신 데이터 기준 평소 대비 증가분·비교 기간 정의), 통계청·지자체 생활인구 축제 분석 사례 (2) 학술: 이동통신/휴대폰 데이터 기반 이벤트·축제 방문객 추정, 계절성 보정, 이상치·이벤트 탐지, 오탐·미탐 기준 설정 방법 (3) 해외 상용: Placer.ai·Near·Unacast·SafeGraph 류 이벤트 영향 분석(베이스라인 정의, 유의성 표시). 산출물 우리 서비스가 "이력 연도마다 축제 신호가 뚜렷한지"를 표시·경고할 때 쓸 수 있는 구체 지표 후보와 각 출처의 신뢰도
inputs: []
searched:
  - "한국관광데이터랩 지역축제 방문자 분석 방법론"
  - "문화체육관광부 문화관광축제 방문객 통계 산출 가이드라인 이동통신 데이터"
  - "문화체육관광부 문화관광축제 개최지침 방문객 산정 기준 공고"
  - "행정안전부 생활인구 산정 방법 통계 이동통신 정의"
  - "국가데이터처 나우캐스트 생활인구 빅데이터 매뉴얼"
  - "\"문화관광축제\" 육성지침 OR 선정계획 방문객 수 산정 \"이동통신\""
  - "경기데이터드림 OR 서울시 빅데이터 생활인구 축제 효과 분석 보고서"
  - "KT 통신 빅데이터 유동인구 축제 방문객 산출 방법론 신뢰구간"
  - "\"인구감소지역 지원 특별법 시행령\" 생활인구 정의 체류인구 월1회 3시간"
  - "SafeGraph event impact analysis baseline documentation"
  - "SafeGraph docs visits normalization \"raw_visit_counts\" baseline weekly patterns"
  - "Placer.ai foot traffic event benchmark methodology official"
  - "Unacast official documentation methodology foot traffic index baseline"
  - "Near Platform official documentation event insights baseline methodology"
  - "mobile phone data event visitor estimation seasonality z-score anomaly detection paper government report"
sources_count: 7
created: 2026-09-14
---

# 조사 노트 — 이동통신 체류인구 기반 축제 효과 판별 (docs 렌즈)

## 발견 사항

**F1.** [1차] 한국관광공사 한국관광데이터랩의 문화관광축제 현황 페이지는 축제 효과 비교를 "각 연도별 축제기간과 비축제기간(축제 전후 4주간)의 지표 차이"로 정의한다고 명시한다.
URL: https://datalab.visitkorea.or.kr/datalab/portal/fes/getFesDataForm.do
게시일: ? (상시 갱신 포털 페이지, 게시일 표기 없음) · 접속일: 2026-09-14
메모: "주요 5개 지표"의 축제기간 대비 비교 기준을 "축제 전후 4주"로 정의한 것은 확인했으나, 그 안에서 쓰는 통계적 유의성 판정식(z-score, 문턱값 등)이나 요일 보정 방식은 이 페이지 본문에 없음. 데이터 출처는 KT(내국인)·SKT(외국인) 이동통신 데이터로 확인(같은 데이터랩 관련 페이지 검색 스니펫 기준, 이 페이지 자체 본문에서 재확인은 못 함).

**F2.** [1차] 같은 데이터랩의 인터뷰 페이지는 "예산 대비 방문객과 일평균 방문객을 기준으로 성공 축제 군집과 실패 축제 군집을 구분"한다고 설명한다.
URL: https://datalab.visitkorea.or.kr/html/interview3/interview05.jsp
게시일: ? (인터뷰 콘텐츠, 게시일 표기 없음) · 접속일: 2026-09-14
메모: 방법론은 변수 중요도 산출 → 군집분석 → 성공/실패 축제 프로파일링 순. "일평균 방문객"과 "예산 대비 방문객"을 축으로 군집을 나누는 방식이며, 특정 연도·특정 축제의 '신호 유무'를 이상탐지(z-score, CUSUM 등) 방식으로 판정하는 설명은 없음. 전국 축제 간 상대 비교(군집분석) 방식이라 개별 축제·개별 연도의 "효과 있었는가"를 이진 판정하는 기준과는 성격이 다름.

**F3.** [1차] 행정안전부 공식 페이지는 인구감소지역 지원 특별법 제2조(정의)에서 "생활인구"를 주민등록인구 + 체류인구(대통령령으로 정하는 요건을 충족하는 자) + 외국인으로 규정한다고 설명한다.
URL: https://www.mois.go.kr/frt/sub/a06/b06/populationDeclineLaw/screen.do
게시일: ? · 접속일: 2026-09-14
메모: 체류인구의 구체적 요건(체류 시간·횟수, 이동통신데이터 처리 방식)은 법률 본문이 아니라 시행령·고시(생활인구의 세부요건 등에 관한 규정, 행정안전부고시 제2023-33호)에 위임되어 있음. 해당 고시 원문은 hwpx/pdf 첨부파일로만 제공되어 이번 조사에서 WebFetch로 본문을 열지 못함(아래 "찾지 못한 것" 참조). "월 1회, 하루 3시간 이상 체류"라는 구체 수치는 검색 스니펫에서만 보였고 원문 확인은 못 했으므로 이 노트에서는 인용하지 않음.

**F4.** [1차] SafeGraph 공식 문서(Weekly Patterns 스키마)는 방문(visit) 집계 최소 기준을 "체류 시간이 최소 4분 이상이어야 방문으로 집계된다"고 정의하고, `visits_by_day`를 요일별(월~일) 방문 수 배열로 정의한다.
URL: https://docs.safegraph.com/docs/weekly-patterns
게시일: ? · 접속일: 2026-09-14
메모: `normalized_visits_by_state_scaling`, `normalized_visits_by_region_naics_visits` 등 정규화 컬럼명은 존재하나, 이 페이지 자체에는 "baseline"이라는 용어나 이벤트/이상 탐지 임계값에 대한 설명이 없음. 요일별 배열은 있지만 요일 보정(day-of-week adjustment)을 어떻게 계산하는지 공식 설명은 이 페이지에 없음.

**F5.** [1차] Unacast 공식 문서(Foot Traffic 지표 정의)는 "Visits estimates the amount of unique people with a stay at a location in a day"라고 정의하고 "We estimate the visits to a location by using a machine learning model"이라고 명시한다.
URL: https://docs.unacast.com/datasets/metrics/foot_traffic/
게시일: ? · 접속일: 2026-09-14
메모: `visits_sum`(집계기간 일일 방문 합), `visits_p50`(집계기간 중앙값 일일 방문) 등 지표명은 확인했으나, 베이스라인 정의·정규화 방식·이벤트 탐지(유의성 표시) 방법에 대한 명시적 설명은 이 페이지에 없음. 같은 도메인의 `unacast.com/methodology` 페이지도 확인했으나 데이터 검증(중복/오류 제거 최대 65%) 설명뿐, 베이스라인·이벤트 영향 분석 방법론은 없음.

**F6.** [1차] KT Enterprise 공식 제품 브로슈어(관광분석솔루션 TrIP, PDF)는 축제 관련 산출물로 "24시간 이후 유출(축제에 방문한 관광객의 24시간 이후 분포, 시군구 단위)", "내국인 관광객 통계(축제에 방문한 현지인/외지인 관광객 통계)", "외국인 관광객 통계(국적별)"를 제공한다고 명시하고, "한국관광공사 '관광 데이터랩' 단독 공급"이라고 밝힌다.
URL: https://enterprise.kt.com/entpf/images/techissue/thumbnail/2023090110104100450560.PDF
게시일: ? (파일명에 20230901 포함, 2023년 배포 자료로 추정) · 접속일: 2026-09-14
메모: 요금제(BASIC 2,000만원~PREMIUM+2 5,000만원)까지 표기된 영업용 브로슈어. "현지인/외지인" 구분 방식, "50세 단위" GIS 시각화 등 산출물 목록은 있으나, 축제 신호의 통계적 유의성 판정식(z-score·문턱값 등)이나 베이스라인 산출 공식은 이 문서에 없음. 데이터랩과의 관계(KT가 관광데이터랩에 내국인 통계를 단독 공급한다는 설명)는 F1의 배경을 뒷받침.

**F7.** [1차] 서울시 공식 보도(뉴스레터)는 "지역축제·골목상권 '빅데이터 분석' 서비스"를 소개하며, "50m×50m 격자 단위"로 통신사 데이터와 카드사 매출데이터를 활용해 "축제 기간과 영역을 설정하면 자동으로 데이터를 비교 분석"한다고 설명한다.
URL: https://news.seoul.go.kr/gov/archives/565412
게시일: ? · 접속일: 2026-09-14
메모: 방문객 행동패턴·소비 매출 변화·교통수단 이용 현황·SNS 키워드 분석을 축으로 "축제·행사 성과분석 모델"을 자동 산출한다고 되어 있으나, 이 보도자료 자체에는 비교 기준 기간(전년 동기/직전 N주 등)이나 통계적 판정 기준(임계값, 유의수준)이 명시돼 있지 않음.

## 이 렌즈에서 찾지 못한 것

- 문화체육관광부가 발행한 "문화관광축제 방문객 통계 산출 가이드라인" 원문(이동통신 데이터 기준 '평소 대비 증가분' 정의, 비교 기간 정의, 오탐/미탐 기준). 검색어: "문화체육관광부 문화관광축제 방문객 통계 산출 가이드라인 이동통신 데이터", "문화체육관광부 문화관광축제 개최지침 방문객 산정 기준 공고", "\"문화관광축제\" 육성지침 OR 선정계획 방문객 수 산정 \"이동통신\"". "2024년 문화관광축제 평가 및 지정 편람"이라는 문서명은 검색됐으나 문체부 공식 도메인이 아닌 scribd(제3자 업로드)에서만 발견되어 렌즈 밖으로 분류(검색 한계 참조), 문체부 공식 원문 링크는 찾지 못함.
- 행정안전부고시 제2023-33호 "생활인구의 세부요건 등에 관한 규정" 원문의 체류인구 구체 기준(체류 시간·횟수, 이동통신데이터 처리 산식). hwpx/pdf 첨부파일로만 제공되어 이번 조사 도구(WebFetch)로 본문을 열지 못함. 검색어: "행정안전부 생활인구 산정 방법 통계 이동통신 정의", "\"인구감소지역 지원 특별법 시행령\" 생활인구 정의 체류인구 월1회 3시간".
- 통계청/국가데이터처 나우캐스트의 이동통신 위치정보 기반 지표 계절조정·산출 알고리즘 상세. "국가데이터처 나우캐스트 - 속보성 경제사회 지표"(data.kostat.go.kr) 매뉴얼 페이지를 열었으나 "모바일 통신 위치 정보(SK텔레콤)"를 쓴다는 사실만 확인, 계절조정 방법이나 지표 정의 상세는 본문에 없었음.
- Placer.ai·Near의 이벤트(축제) 전용 베이스라인 정의·유의성 표시 공식 문서. Placer.ai는 일반 소개 페이지(placer.ai/foot-traffic-analytics 등)만 확인됐고 이벤트 분석 전용 방법론 문서는 검색되지 않음. Near는 event insights 관련 공식 문서 자체를 찾지 못함. 검색어: "Placer.ai foot traffic event benchmark methodology official", "Near Platform official documentation event insights baseline methodology".
- z-score, robust MAD, CUSUM, synthetic control/DID를 이동통신 데이터 이벤트 탐지에 적용한 공식 문서(docs 렌즈 자격이 있는 표준·정부 지침·제작사 공식 자료). 검색되는 자료는 전부 학술논문이거나 개인/기업 블로그였고 docs 렌즈 기준을 충족하는 출처는 찾지 못함. 검색어: "mobile phone data event visitor estimation seasonality z-score anomaly detection paper government report".

## 검색 한계 (렌즈 밖 출처 — 다른 렌즈용, 발견 사항에는 미포함)

- https://www.scribd.com/document/898843655/ (2024년 문화관광축제 평가 및 지정 편람 PDF, 제3자 업로드 플랫폼)
- https://dev.to/vf-insights/anomaly-detection-in-seasonal-data-why-z-score-still-wins-but-you-need-to-use-it-right-4ec1 (개인/기업 블로그)
- https://mcpanalytics.ai/articles/z-score-anomaly-detection-practical-guide-for-data-driven-decisions (블로그성 아티클)
- https://link.springer.com/article/10.1007/s42081-021-00109-z (학술논문 — academic 렌즈용)
- https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0309093 / https://pmc.ncbi.nlm.nih.gov/articles/PMC11340987/ (학술논문 — academic 렌즈용)
- https://www.growthfactor.ai/resources/blog/foot-traffic-provider-comparison (비교 블로그 기사)
- https://www.ajunews.com/view/20260520141238719 , https://www.100ssd.co.kr/news/articleView.html?idxno=99299 , https://www.greenpostkorea.co.kr/news/articleView.html?idxno=208435 , https://m.news2day.co.kr/article/20230602500046 , http://www.consumerwide.com/news/articleView.html?idxno=50765 (KT 축제 빅데이터 서비스 관련 언론기사 — community/기사 렌즈용)
- https://lbox.kr/v2/statute/... (민간 법률DB의 법령 미러, 접속 시 403 — 법령 자체는 docs 렌즈 대상이나 이 미러 사이트 본문은 열람 실패)
- https://eiec.kdi.re.kr/policy/materialView.do?num=241461 (KDI 경제교육정보센터의 생활인구 정책 해설 — 정부 원문이 아닌 해설 자료)
