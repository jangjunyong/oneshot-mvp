---
type: analysis
status: draft
owner: research-team:fact-checker
question: 이동통신(KT 등) 기반 시군구 일별 체류인구(현지인·외지인·외국인) 자료만으로 "특정 기간에 축제(행사) 효과가 실제로 있었는가"를 판별·표시하는 기준과 방법론은 무엇이며, 이를 실제로 제공하는 비슷한 웹 서비스·공공 지침은 어떻게 하는가? 조사 대상: (1) 한국관광공사 한국관광데이터랩 '지역축제 방문자 분석'·'축제 방문객' 산출 방식, 문화체육관광부 문화관광축제 방문객 통계 산출 가이드라인(이동통신 데이터 기준 평소 대비 증가분·비교 기간 정의), 통계청·지자체 생활인구 축제 분석 사례 (2) 학술: 이동통신/휴대폰 데이터 기반 이벤트·축제 방문객 추정, 계절성 보정(전년 동기 대비, 요일 보정, STL), 이상치·이벤트 탐지(z-score, robust MAD, CUSUM, synthetic control/difference-in-differences), 오탐·미탐 기준 설정 방법 (3) 해외 상용: Placer.ai·Near·Unacast·SafeGraph 류 이벤트 영향 분석(베이스라인 정의, 유의성 표시). 산출물: 우리 서비스가 "이력 연도마다 축제 신호가 뚜렷한지"를 표시·경고할 때 쓸 수 있는 구체 지표 후보(분모 정의, 요일·계절 보정, 문턱값과 그 근거)와 각 출처의 신뢰도
inputs: [_work/research/festival-signal-mobile-baseline.synthesis.md]
factcheck_verdict: REVISE
checked: 14
round: 2
created: 2026-09-14
---

# 사실확인: 이동통신 시군구 일별 체류인구만으로 축제 효과 유무를 판별·표시하는 기준과 방법론 — 판정 REVISE

## 판정 근거
- 핵심 주장 6건(C1·C2·C4·C10·C11·C12)은 전부 CONFIRMED 다. WRONG 은 0건, UNSUPPORTED 도 0건(14건 중 0%)이다.
- PARTIAL 은 2건이다. C8 의 고시 번호는 2025-11-28 일부개정 이전 값이다. C17 은 "방법·유의성 미확인" 이라고 적었지만 논문 본문에 event study·DiD 방식과 95% 신뢰구간이 나온다.
- 규칙 "PARTIAL 2개 이상 → REVISE" 에 해당한다.

## 확인 결과
| 주장 ID | 원문 주장 | 결과 | 원출처 확인 URL (접속일) | 메모 |
|---|---|---|---|---|
| C1 | 데이터랩 문화관광축제 현황 페이지는 축제 효과 비교를 "축제기간과 비축제기간(축제 전후 4주간)의 지표 차이"로 정의 | CONFIRMED | https://datalab.visitkorea.or.kr/datalab/portal/fes/getFesDataForm.do (2026-09-14) | 본문 문구: "축제기간과 비축제기간(축제 전후 4주간)의 지표 차이". 데이터 종류는 이동통신·신용카드·내비게이션이고 통신사명은 없음 |
| C2 | 같은 페이지 본문에 유의성 판정식(z-score·문턱값)과 요일 보정 방식이 없다 | CONFIRMED | https://datalab.visitkorea.or.kr/datalab/portal/fes/getFesDataForm.do ; https://datalab.visitkorea.or.kr/datalab/portal/getMetaInfoList.do (2026-09-14) | 판정식·문턱값·요일 보정 기재 없음. "주요 5개 지표" 는 이름도 적혀 있지 않음. 데이터 설명 페이지의 이동통신 항목에도 체류시간 기준·축제 산출식이 없음 |
| C3 | 데이터랩 인터뷰: "예산 대비 방문객"·"일평균 방문객" 기준으로 성공/실패 군집 구분, 변수 중요도 → 군집분석 → 프로파일링 | CONFIRMED | https://datalab.visitkorea.or.kr/html/interview3/interview05.jsp (2026-09-14) | 원문: "예산 대비 방문객과 일평균 방문객을 기준으로 성공 축제 군집과 실패 축제 군집을 구분". 세 단계 순서도 일치함. 게시일 표기 없음("2023 우수상" 표기만 있음) |
| C4 | 한국관광공사(2013) 보령머드축제: 관광가능인구 = 지자체 인구 제외 외부 유입인구 일별 합, 평상시 일평균 11만2천 대비 축제기간 14만5천(29.4%) | CONFIRMED | https://clik.nanet.go.kr/clikr-collection/policyinfo/50/217/1900/CLIKC404914243791907_attach_6.pdf (2026-09-14, 6~7쪽 이미지 판독) | 6쪽 정의: "해당 지자체 인구를 제외한 외부 유입인구의 축제기간 전체 일별 합". 7쪽: "일평균 14만 5,000명, 평상시 11만 2,000명", "29.4%". 축제기간은 2013-07-19~28. "평상시" 기간 정의는 원문에 없음. 이슈리포트(2015)가 인용한 자료이므로 [2차] 표기가 맞음 |
| C6 | KT TrIP 브로슈어: 현지인/외지인·국적별 외국인·시군구 24시간 이후 유출 제공, 관광데이터랩 단독 공급, 판정식·베이스라인 없음 (2차 이해관계) | CONFIRMED | https://enterprise.kt.com/entpf/images/techissue/thumbnail/2023090110104100450560.PDF (2026-09-14, 1~2쪽 이미지 판독) | 1쪽: "한국관광공사 '관광 데이터랩' 단독 공급". 2쪽: "축제에 방문한 현지인/외지인 관광객 통계", "국적별 외국인 관광객 통계", "24시간 이후 분포 (시군구 단위)". 산식·유의성 기재 없음. 요금표가 있어 이해관계 표기가 맞음 |
| C7 | 2013 분석은 SKT 데이터, KT 브로슈어(발행일 미기재)는 "관광 데이터랩 단독 공급"(대상 한정 없음), 2023-03-21 보도는 KT 에 더해 SKT 도 사용 | CONFIRMED | https://clik.nanet.go.kr/clikr-collection/policyinfo/50/217/1900/CLIKC404914243791907_attach_6.pdf (6쪽) ; https://enterprise.kt.com/entpf/images/techissue/thumbnail/2023090110104100450560.PDF ; https://www.discoverynews.kr/news/articleView.html?idxno=973482 (2026-09-14) | 2013 원문: "SKT 고객 데이터를 기반으로". 브로슈어에 대상 한정 문구와 발행일이 없음. 기사 원문: "기존에 이동통신 데이터는 KT 데이터만 활용했었으나". 선후 미확정이라는 서술도 맞음 |
| C8 | 특별법 제2조: 생활인구 = 주민등록인구+체류인구+외국인, 체류인구 요건은 시행령·행정안전부고시 제2023-33호에 위임 | PARTIAL | https://www.mois.go.kr/frt/sub/a06/b06/populationDeclineLaw/screen.do ; https://www.mois.go.kr/frt/bbs/type001/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000016&nttId=100464 ; https://mois.go.kr/frt/bbs/type001/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000016&nttId=122130 (2026-09-14) | 세 구성과 대통령령 위임은 맞음. 제2023-33호는 2023-05-18 제정 고시임. 이후 제2025-66호(2025-11-28)로 일부개정됐고, 산정 대상에 "인구감소관심지역" 이 추가됨. 지금 인용할 현행 번호가 다름 |
| C9 | 서울시 "지역축제·골목상권 빅데이터 분석": 50m×50m 격자, 통신·카드 데이터, 기간·영역 설정 시 자동 비교, 보도자료에 비교 기준 기간·판정 기준 없음 | CONFIRMED | https://news.seoul.go.kr/gov/archives/565412 (2026-09-14) | 게시 2025-03-04. 원문: "축제 기간과 영역을 설정하면 자동으로 데이터를 비교 분석". "50m×50m 격자 단위" 문구도 있음. 평시·전년 동기·임계값 기재 없음 |
| C10 | MPD 관광통계 연구에서 EU 692/2011 방문객 정의는 드물게 적용되고, 방문객은 흔히 거주자·통근자를 뺀 잔여 집단으로 도출된다(관행 서술) | CONFIRMED | https://www.aimspress.com/article/doi/10.3934/NAR.2021002?viewType=HTML (2026-09-14) | 원문: "rarely applied on mobile phone data"; "often derived as a residual group". 1회차에 지적한 과장 표현은 수정됨 |
| C11 | MEDIFF: 중앙값 기반 추세·주간 계절성·DST/공휴일 분해 → 중앙값·MAD 일반화 ESD, α=0.05, 이상치 약 2%, IT·이커머스 KPI | CONFIRMED | https://arxiv.org/pdf/2008.09245 (2026-09-14, 1~5쪽 이미지 판독) | 식 (12)에서 평균·표준편차 자리를 median·MAD 가 대신함. 원문: "m ≈ 600 (i.e., anomaly rate is 0.02) and the significance level α = 0.05". 지표당 약 80,640점(약 60일)을 40,320점(4주) 배치 둘로 나눔 — 종합의 정정값과 일치 |
| C12 | 파리 연구: Signature μ+2.32σ(목표 1%, 실측 약 3%), Adaptive Prophet+주간·학교방학 + Shewhart μ+3σ(지수가중 갱신), 4시간·1일·1주 3단계 | CONFIRMED | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC11340987/fullTextXML ; https://arxiv.org/html/2405.19125 (2026-09-14) | Europe PMC 본문: h=2.32, "captures approximately 3% of the training deviation samples", 학교방학 회귀변수. 이 요약에서는 3단계 심각도가 확인되지 않아 arXiv 본문으로 확인함: "once every 4 hours, 1 day and 1 week", "h has been set equal to 3", 반감기 τ=24시간. PMC 원 페이지는 reCAPTCHA 로 막힘 |
| C13 | 제주 SKT 연구: 실거주지 제주 외부 = 방문자, 계절별 대표 수·토요일 비교, 이벤트 판별 기준 없음 | CONFIRMED | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12036935/fullTextXML (2026-09-14) | 원문: "home location was not on Jeju Island". 표본 기간은 2022년 1·5·7·10월에서 각 1주. 수요일·토요일을 대표일로 둠. SKT 점유율 "about 50%". 이상치·특이일 통계 기준 없음 |
| C14 | 2018년 축제 593개 ML 예측모형은 방문객 수를 성과 기준으로 삼고, 계절성 보정·평소 대비 증가분은 기술하지 않음 | CONFIRMED | https://koreascience.kr/article/JAKO202029660099770.page (2026-09-14) | 593개(2018), 지역 변수 6개·축제 변수 15개. 방문객 수를 "one of the criteria" 로 씀. 초록 페이지에 계절성 보정·베이스라인 서술 없음. 본문 PDF 는 열지 않음 |
| C17 | SafeGraph 로 2018~2022 총격 42건 인근 POI 15만+ 분석, 인접 감소·원거리 증가 (DID/synthetic control 사용 여부와 유의성 기준은 미확인) | PARTIAL | https://arxiv.org/abs/2502.19640 ; https://arxiv.org/html/2502.19640v2 (2026-09-14) | 42건, 2018~2022, 15만+ POI, 효과 방향은 맞음. 초록에는 SafeGraph 이름이 없고 본문에만 나옴("Safegraph's weekly patterns dataset"). 본문은 "event study design" 과 거리대별 "DiD-style estimates" 를 씀. 창은 사건 전 10주·후 20주. 95% 신뢰구간, 표준오차는 POI 단위 군집. "미확인" 은 원문이 답하는 사항임 |

## 반대 증거 탐색
- C1: 검색어 "한국관광데이터랩 문화관광축제 방문객 산정 기준 전년 대비 비축제기간 4주 방법 변경". 다른 비교 기간(전년 동기 등)을 쓴 출처는 못 찾음. 다만 https://www.discoverynews.kr/news/articleView.html?idxno=973482 (2023-03-21)에 따르면 KT·SKT 는 외지인 방문자 체류시간 기준(30분·2시간)과 모수 추정 방식이 다르다. 연도 간 지표를 비교할 때 공급사 구성이 섞일 수 있다는 뜻이다(C1 의 정의 자체는 반박하지 않음).
- C2: https://datalab.visitkorea.or.kr/datalab/portal/getMetaInfoList.do 를 열었다. 이동통신 항목에 판정식·임계값·체류시간 기준이 없음. 반박 못 찾음.
- C3: 검색어 "한국관광 데이터랩 활용 우수사례 지역축제 성공 실패 군집분석 예산 대비 방문객". 다른 기준을 쓴 같은 사례 출처는 못 찾음.
- C4: 검색어 "보령머드축제 2013 빅데이터 성과분석 한국관광공사 유입인구 증가율". 결과는 모두 같은 수치(29.4%, 100.1%, SK텔레콤 데이터)였고 반박 못 찾음. 원보고서(한국관광공사 2013)는 공개본을 못 찾음.
- C6·C7: https://www.discoverynews.kr/news/articleView.html?idxno=973482 는 2023-03 이후 KT·SKT 병행이라고 보도했다. 브로슈어의 "단독 공급" 과 긴장 관계이나, 종합이 이미 "선후 미확정" 으로 적었다. 브로슈어 발행일은 여전히 못 찾음.
- C8: https://mois.go.kr/frt/bbs/type001/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000016&nttId=122130 에 제2025-66호(2025-11-28) 일부개정이 있다. 체류 요건 "하루 3시간 이상 머무는 횟수가 월 1회 이상" 은 정부 정책브리핑 본문에서 확인했다(https://www.korea.kr/news/policyNewsView.do?newsId=148916393, 2023-06-16).
- C9: 검색어 "서울시 지역축제 골목상권 빅데이터 분석 서비스 2025 평시 대비 방문객 증가 비교 기준". 뉴시스·뉴스핌 등 보도에도 비교 기준 기간·판정 기준은 없음. 못 찾음.
- C10: https://unstats.un.org/wiki/spaces/MPDTS/pages/143097885/6.1.+Basic+concepts+and+approximation (갱신 2022-11-07)은 MPD 에서 usual environment 를 행정단위 정밀도로 정해 적용하는 틀을 둔다. 실제 연구에서 정의 적용이 드물다는 2021년 관행 서술을 뒤집지는 않음.
- C11: 검색어 "MEDIFF robust time series decomposition anomaly detection eBay limitations comparison SH-ESD". 수치·방법을 반박하는 출처는 못 찾음. DST/공휴일 구간 precision 저하는 원논문 표 2 에 이미 있음.
- C12: 검색어 "\"Early detection of critical urban events using mobile phone network data\" correction OR erratum OR critique". 정정·비판 출처는 못 찾음.
- C13: 검색어 "Lee Eom Jeju Island visitors mobile phone data PLoS One 2025 hotspot SKT festival event detection". 이벤트 판별 기준을 제시했다는 출처는 못 찾음.
- C14: 검색어 "이인지 윤현식 머신러닝 지역축제 방문객 수 예측모형 2018 축제 데이터 출처". 검색 요약에 데이터가 "문체부 공시 자료와 검색엔진" 에서 왔다는 문구가 있었다. 본문은 열지 않았다. 계절성 보정·베이스라인을 기술했다는 출처는 못 찾음.
- C17: 검색어 "Cuellar Jung \"Mass Shootings, Community Mobility\" SafeGraph event study difference-in-differences". 결과를 뒤집는 출처는 못 찾음. 논문 본문(https://arxiv.org/html/2502.19640v2)이 종합의 "미확인" 을 해소함.

## 수정 요구
1. C17 의 괄호 "DID/synthetic control 사용 여부와 유의성 기준은 미확인" 과 신뢰도 "1차 (초록)" 을 고칠 것. 본문 v2 는 SafeGraph Weekly Patterns 를 쓰고, event study 설계와 거리대별 DiD-style 추정을 쓴다. 창은 사건 전 10주·후 20주, 95% 신뢰구간이고 표준오차는 POI 단위 군집이다. synthetic control 은 확인되지 않았다. 쟁점 4 공백("DID·synthetic control 을 이동통신 이벤트 분석에 썼는지는 확인되지 않았다")과 미해결·공백의 해당 줄도 같이 고칠 것. 단 SafeGraph 는 앱 위치 데이터이지 통신사 기지국 데이터가 아니라는 점을 함께 적을 것 — https://arxiv.org/html/2502.19640v2
2. C8 의 고시 인용을 "제2023-33호(2023-05-18 제정), 제2025-66호(2025-11-28 일부개정: 산정 대상에 인구감소관심지역 추가)" 로 고칠 것. 쟁점 2 공백과 미해결·공백의 "행정안전부고시 제2023-33호" 도 같이 고칠 것 — https://mois.go.kr/frt/bbs/type001/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000016&nttId=122130 , https://www.mois.go.kr/frt/bbs/type001/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000016&nttId=100464
3. 미해결·공백의 "'월 1회, 하루 3시간 이상' 수치는 스니펫에만 있어" 를 고칠 것. 정부 정책브리핑 본문(2023-06-16)에 "하루 3시간 이상 머무는 횟수가 월 1회 이상" 이 있다. 고시 원문은 여전히 열지 못했다고 구분해서 적을 것 — https://www.korea.kr/news/policyNewsView.do?newsId=148916393
4. 쟁점 2 공백("'현지인·외지인' 을 어떤 거주지 판정 규칙으로 가르는지는 KT 쪽 문서에 없고")과 공급사 구성 항목에 [2차] 사실을 보탤 것. 한국관광공사 팀장 발언을 전한 2023-03-21 보도에 따르면 KT·SKT 는 외지인 방문자 체류시간 기준(각 30분, 2시간)과 모수 추정 방식이 서로 다르다. 이는 연도별 이력 비교에서 공급사 변경이 섞일 때 직접 걸리는 사항이다 — https://www.discoverynews.kr/news/articleView.html?idxno=973482
