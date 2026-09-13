---
type: research
status: draft
owner: research-team:web-researcher
lens: community
question: >-
  이동통신(KT 등) 기반 시군구 일별 체류인구(현지인·외지인·외국인) 자료만으로 "특정 기간에 축제(행사) 효과가 실제로 있었는가"를
  판별·표시하는 기준과 방법론은 무엇이며, 이를 실제로 제공하는 비슷한 웹 서비스·공공 지침은 어떻게 하는가? 조사 대상: (1) 한국관광공사
  한국관광데이터랩 '지역축제 방문자 분석'·'축제 방문객' 산출 방식, 문화체육관광부 문화관광축제 방문객 통계 산출 가이드라인(이동통신 데이터
  기준 평소 대비 증가분·비교 기간 정의), 통계청·지자체 생활인구 축제 분석 사례 (2) 학술: 이동통신/휴대폰 데이터 기반 이벤트·축제 방문객
  추정, 계절성 보정(전년 동기 대비, 요일 보정, STL), 이상치·이벤트 탐지(z-score, robust MAD, CUSUM, synthetic
  control/difference-in-differences), 오탐·미탐 기준 설정 방법 (3) 해외 상용: Placer.ai·Near·Unacast·SafeGraph
  류 이벤트 영향 분석(베이스라인 정의, 유의성 표시). 산출물: 우리 서비스가 "이력 연도마다 축제 신호가 뚜렷한지"를 표시·경고할 때 쓸
  수 있는 구체 지표 후보(분모 정의, 요일·계절 보정, 문턱값과 그 근거)와 각 출처의 신뢰도
inputs: []
searched:
  - "Placer.ai review reddit accuracy"
  - "SafeGraph data quality reddit experience"
  - "site:reddit.com SafeGraph OR Placer.ai foot traffic data"
  - "한국관광데이터랩 지역축제 방문자 분석 후기 블로그"
  - "KT 유동인구 데이터 공모전 후기 티스토리"
  - "SK텔레콤 Geovision 유동인구 데이터 분석 프로젝트 후기"
  - "reddit detect event spike time series anomaly experience baseline"
  - "생활인구 데이터 축제 효과 분석 프로젝트 velog"
  - "GitHub issue festival attendance estimation foot traffic anomaly detection"
  - "빅콘테스트 유동인구 축제 방문객 예측 후기"
  - "통계청 생활인구 데이터 API 활용 후기 오류"
  - "\"유동인구\" 축제 \"z-score\" OR \"이상치\" 탐지 티스토리 프로젝트"
  - "site:news.ycombinator.com SafeGraph"
  - "Placer.ai pricing complaint small business reddit"
  - "\"placer.ai\" reddit accuracy overcounts undercounts"
  - "HN \"Confessions of a location data exec\" comments accuracy foot traffic"
  - "브런치 유동인구 데이터 이상탐지 축제 프로젝트 경험"
  - "\"g2.com\" placer.ai review \"pros\" \"cons\" quote"
  - "reddit r/datascience STL decomposition holiday event effect experience"
  - "reddit r/CommercialRealEstate OR r/smallbusiness \"placer.ai\" experience"
  - "OKKY 유동인구 데이터 분석 질문 이상치"
  - "축제 방문객수 부풀리기 이동통신 데이터 디시인사이드 커뮤니티"
  - "Unacast review reddit OR forum data quality complaint"
  - "TrustRadius OR Capterra Placer.ai review event spike accuracy"
  - "\"Near\" location data reddit review accuracy footfall"
  - "\"foot traffic\" festival \"baseline\" reddit r/analytics OR r/geospatial experience"
  - "데이콘 관광 빅데이터 경진대회 후기 이상치 시계열"
  - "nopriorarrests hacker news location data consistency 19256845"
sources_count: 5
created: 2026-09-14
---

## 발견 사항

**F1.** [1차] (n=1) Hacker News 사용자 `PLenz`(위치 데이터 업계 종사자로 추정, "Confessions of a location data exec" 스레드 댓글)는 실무에서 수집되는 원시 위치 데이터의 상당 부분을 분석에 쓰지 못해 버린다고 직접 서술했다: "We throw out 60% to 75% a day as not useful for learning anything from." (GPS 강도·배터리 상태 등 변수로 품질이 갈린다는 설명 포함)
URL: https://news.ycombinator.com/item?id=19257563 (스레드 본문, 해당 댓글 id=19257695)
게시일: 2019-02-26 | 접속일: 2026-09-14
메모: 이동통신사(KT 등) 기지국 기반 체류인구와는 데이터 소스가 다름(광고 SDK/GPS 기반 위치 데이터 업계). 그러나 "원시 위치 신호의 상당수가 노이즈라 필터링 후 남는 표본이 작다"는 문제는 이동통신 기반 데이터에도 유사하게 적용될 수 있는 업계 공통 이슈로 참고할 만함. 단일 댓글(n=1), 회사명·직책 비공개.

**F2.** [1차] (n=1) 같은 HN 스레드의 사용자 `bastawhiz`는 소량의 위치/광고 신호만으로 인구통계(연령·소득 등)를 정확히 추정하는 것은 근본적으로 무리라고 지적했다: "There's no good way to get that data... How do they know who's a 30 year old male making $70,000?" (기기가 하루에도 수십 개 IP를 바꾼다는 점도 근거로 듦)
URL: https://news.ycombinator.com/item?id=19257563
게시일: 2019-02-26 | 접속일: 2026-09-14
메모: 체류인구를 "현지인·외지인·외국인"으로 속성 분류하는 것 자체의 신뢰성에 대한 업계 실무자 수준의 회의적 시각 사례. n=1.

**F3.** [1차] (n=1) DACON "교통·문화·통신 빅데이터 플랫폼 융합 분석 경진대회"(KT 유동인구 데이터 포함) 게시판에서 익명 참가자가 데이터셋의 "외지인 관광객 유입 비율" 변수 정의를 실전에서 이해하지 못해 직접 질문했다: "거주지 기반 유입비율 중 '외지인 관광객 유입 비율'은 해당 날짜에 해당 지역으로 관광을 온 관광객 중 그 지역 사람이 아닌 타지인의 비율을 뜻하는 건가요?"
URL: https://dacon.io/en/competitions/official/235794/talkboard/404355
게시일: 질문 2021-09-06 / 운영진 답변 2021-12-21(약 3개월 후) | 접속일: 2026-09-14
메모: 실제 KT 유동인구 데이터를 다루는 참가자가 현지인/외지인 구분 변수의 정의를 헷갈려한 1차 증거. 답변까지 3개월 걸린 점도 "실무자가 정의를 스스로 확인하기 쉽지 않다"는 방증. 표본 n=1.

**F4.** [1차] (이해관계 가능성, n=1, 긍정) 리뷰 수집 사이트 softwarefinder.com에 게재된 Placer.ai 실사용자 리뷰(리뷰어 `Lori F.`)는 이벤트 방문자 추적 기능을 실제로 쓰고 있다고 밝혔다: "I can see who visited an event, where they came from and what they did afterward."
URL: https://softwarefinder.com/analytics-software/placer-ai/reviews
게시일: 2025-03 | 접속일: 2026-09-14
메모: 리뷰 집계 사이트는 벤더 협찬/큐레이션 가능성이 있어 (이해관계) 태그를 붙임. 이벤트 방문자 존재 여부는 확인해주지만, "베이스라인 대비 통계적으로 유의한 증가인지"를 어떻게 판단하는지에 대한 서술은 없음.

**F5.** [추정] (스니펫만 확인, n=1, 부정) 소매·부동산 업계 포럼 Retail Watchers 스레드("Is PlacerAI accurate?")에서 검색엔진 스니펫에 다음과 같은 취지의 글이 있는 것으로 나타났다: Placer.ai는 "can be accurate and it can be 'way off'"(정확할 때도 있고 완전히 빗나갈 때도 있다)이며 "매장 내부의 진짜 정확한 트래픽 데이터는 카메라·센서 기반(ShopperTrack 등)뿐이고 공개되지 않는다"는 내용.
URL: https://www.retailwatchers.com/viewtopic.php?t=4571
게시일: ? (스니펫에 날짜 미표기) | 접속일: 2026-09-14
메모: WebFetch가 403 Forbidden으로 본문 직접 열람 실패 — 검색엔진 스니펫만 확인했으므로 [1차]가 아니라 [추정]으로 표기. 다른 요원이 로그인/다른 방식으로 열람 가능하면 격상 가능.

## 찾지 못한 것

- 이동통신(KT/SKT) 기반 체류인구 데이터로 "축제 효과가 실제 있었는가"를 판별하는 구체적 방법(요일 보정, STL, z-score/CUSUM 문턱값 등)을 **개인이 직접 실험하고 후기·블로그·포럼에 남긴 사례**는 찾지 못했다. 검색어: "생활인구 데이터 축제 효과 분석 프로젝트 velog", "브런치 유동인구 데이터 이상탐지 축제 프로젝트 경험", "\"유동인구\" 축제 \"z-score\" OR \"이상치\" 탐지 티스토리 프로젝트", "OKKY 유동인구 데이터 분석 질문 이상치", "축제 방문객수 부풀리기 이동통신 데이터 디시인사이드 커뮤니티"
- 한국관광데이터랩('지역축제 방문자 분석')이나 문화체육관광부 가이드라인의 산출 방식에 대한 **실사용자(지자체 담당자·연구자)의 커뮤니티 후기**(써봤더니 이랬다는 글)는 찾지 못했다. 공식 페이지·인터뷰 기사만 검색됐고 이는 docs 렌즈 몫. 검색어: "한국관광데이터랩 지역축제 방문자 분석 후기 블로그", "통계청 생활인구 데이터 API 활용 후기 오류"
- Reddit에서 Placer.ai·SafeGraph·Unacast·Near의 "이벤트/축제 베이스라인 정의"나 "유의성 표시 방식"을 놓고 실사용자가 직접 논쟁한 스레드는 검색 엔진 색인에서 찾지 못했다(`site:reddit.com` 질의가 Reddit 결과를 반환하지 않음 — 검색 도구의 한계일 수 있음). 검색어: "site:reddit.com SafeGraph OR Placer.ai foot traffic data", "Unacast review reddit OR forum data quality complaint", "reddit r/CommercialRealEstate OR r/smallbusiness \"placer.ai\" experience", "\"foot traffic\" festival \"baseline\" reddit r/analytics OR r/geospatial experience"
- G2/Capterra의 Placer.ai·Unacast 리뷰 원문은 WebFetch가 403으로 차단해 직접 열람하지 못했다(검색 스니펫 요약만 확보). 같은 이유로 SafeGraph 관련 "연구자가 데이터가 깨끗하다"는 인용도 벤더 자사 사이트(safegraph.com)의 테스티모니얼 페이지로 보이며 직접 열람해 원문·날짜·이름을 확인하지 못했다. 검색어: "SafeGraph data quality reddit experience", "\"g2.com\" placer.ai review \"pros\" \"cons\" quote", "TrustRadius OR Capterra Placer.ai review event spike accuracy"
- 부정적 후기 쪽은 F1·F2·F5로 확보했으나 모두 "위치 데이터 일반"에 대한 것이고, "축제/이벤트 감지" 자체를 부정적으로 평가한 1차 후기는 찾지 못했다. 긍정 쪽(F4)도 이벤트 방문자 추적 기능 사용 확인 수준이며 정확도·유의성 평가는 없다.

## 검색 한계

렌즈 밖(다른 렌즈 요원이 쓸 수 있는) 출처 — 발견 사항에는 넣지 않음:
- https://www.kfestival.kr/news/457238 (뉴스 칼럼: 빅데이터 기반 방문객 추정치가 우천으로 실제 방문객이 적었는데도 7만 명으로 발표된 사례 언급, 2026-01-06)
- https://digiday.com/media/confessions-location-data-exec/ (뉴스 기사: 위치 데이터 업계 익명 임원 인터뷰)
- https://www.retaildive.com/ex/mobilecommercedaily/cutting-through-the-noise-around-location-accuracy (업계 매체 기사: 위치 정확도 마케팅 주장에 대한 비판)
- https://datalab.visitkorea.or.kr/site/portal/ex/bbs/View.do?bcIdx=307772&cbIdx=1129 (한국관광 데이터랩 공식 자료 — 2023 문화관광축제 빅데이터 분석 보고서)
- https://arxiv.org/pdf/2008.09245 , https://arxiv.org/pdf/2510.24452 (academic 렌즈 몫 — STL 기반 계절 이상치 탐지, ARIMA_PLUS 이상탐지 논문)
- https://www.g2.com/products/placer-ai/reviews , https://www.g2.com/products/unacast/reviews (community 성격이나 WebFetch 403으로 본문 확인 실패 — 재시도 시 유용할 수 있음)
