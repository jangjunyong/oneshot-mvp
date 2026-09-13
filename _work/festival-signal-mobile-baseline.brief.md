---
type: brief
status: draft
owner: research-team
verified_by: []
question: 이동통신(KT 등) 기반 시군구 일별 체류인구(현지인·외지인·외국인) 자료만으로 "특정 기간에 축제(행사) 효과가 실제로 있었는가"를 판별·표시하는 기준과 방법론은 무엇이며, 이를 실제로 제공하는 비슷한 웹 서비스·공공 지침은 어떻게 하는가? 조사 대상: (1) 한국관광공사 한국관광데이터랩 '지역축제 방문자 분석'·'축제 방문객' 산출 방식, 문화체육관광부 문화관광축제 방문객 통계 산출 가이드라인(이동통신 데이터 기준 평소 대비 증가분·비교 기간 정의), 통계청·지자체 생활인구 축제 분석 사례 (2) 학술: 이동통신/휴대폰 데이터 기반 이벤트·축제 방문객 추정, 계절성 보정(전년 동기 대비, 요일 보정, STL), 이상치·이벤트 탐지(z-score, robust MAD, CUSUM, synthetic control/difference-in-differences), 오탐·미탐 기준 설정 방법 (3) 해외 상용: Placer.ai·Near·Unacast·SafeGraph 류 이벤트 영향 분석(베이스라인 정의, 유의성 표시). 산출물: 우리 서비스가 "이력 연도마다 축제 신호가 뚜렷한지"를 표시·경고할 때 쓸 수 있는 구체 지표 후보(분모 정의, 요일·계절 보정, 문턱값과 그 근거)와 각 출처의 신뢰도
factcheck: REVISE
round: 2
run: 20260914-004148-research-74d6
inputs: [_work/research/festival-signal-mobile-baseline.synthesis.md, _work/research/festival-signal-mobile-baseline.factcheck.md]
created: 2026-09-14
---

# 브리프: 이동통신 시군구 일별 체류인구만으로 축제 효과 유무를 판별·표시하는 기준과 방법론

> 사실확인 2회차 REVISE(보조 주장 PARTIAL 2건: C8·C17). 최대 회차에 도달해 사람에게 넘긴다. 핵심 주장 6건은 전부 CONFIRMED.

## 핵심 답 (3줄)
1. [1차] 한국관광데이터랩은 축제 효과를 "축제기간과 비축제기간(축제 전후 4주간)의 지표 차이"로 정의하지만, 그 비교의 판정식·문턱값·요일 보정은 공개 페이지에 없다 (C1, C2)
2. [1차] 학술 출처의 판정 기준은 이상치에 강한 중앙값·MAD(일반화 ESD, α=0.05)와 관리도식 문턱(μ+2.32σ, μ+3σ)이며, 둘 다 IT 지표·파리 셀 단위 자료에서 나온 것으로 시군구·일 단위 문턱 선례는 종합에 없다 (C11, C12)
3. [1차] 이동통신 관광 연구에서 방문객은 흔히 거주자 등을 뺀 잔여 집단으로 도출되고, 공공 분석 서비스(서울시)도 기간·영역을 설정해 자동 비교할 뿐 비교 기준 기간·판정 기준을 밝히지 않는다 (C10, C9)

## 근거
| 주장 | 신뢰도 | 출처 (URL, 게시일) | 사실확인 |
|---|---|---|---|
| C1 데이터랩: 축제기간 vs 비축제기간(전후 4주) 지표 차이 | 1차 | https://datalab.visitkorea.or.kr/datalab/portal/fes/getFesDataForm.do (게시 ?) | CONFIRMED |
| C2 데이터랩 페이지에 판정식·문턱·요일 보정 없음 | 1차 | https://datalab.visitkorea.or.kr/datalab/portal/fes/getFesDataForm.do ; https://datalab.visitkorea.or.kr/datalab/portal/getMetaInfoList.do (게시 ?) | CONFIRMED |
| C3 데이터랩 인터뷰: 예산 대비·일평균 방문객으로 성공/실패 군집 | 1차 | https://datalab.visitkorea.or.kr/html/interview3/interview05.jsp (게시 ?) | CONFIRMED |
| C4 한국관광공사 2013 보령머드: 외부 유입 일평균 11만2천→14만5천(29.4%), "평상시" 기간 정의 없음 | 2차 | https://clik.nanet.go.kr/clikr-collection/policyinfo/50/217/1900/CLIKC404914243791907_attach_6.pdf (게시 2015-10-16) | CONFIRMED |
| C6 KT TrIP 브로슈어: 현지인/외지인·국적별 통계, 데이터랩 단독 공급, 산식 없음 | 2차 (이해관계) | https://enterprise.kt.com/entpf/images/techissue/thumbnail/2023090110104100450560.PDF (게시 ?) | CONFIRMED |
| C7 2013 분석은 SKT, 브로슈어는 "단독 공급", 2023-03-21 보도는 KT에 더해 SKT 사용 — 선후 미확정 | 2차 / 2차(이해관계) | 위 두 URL ; https://www.discoverynews.kr/news/articleView.html?idxno=973482 (게시 2023-03-21) | CONFIRMED |
| C8 생활인구 = 주민등록+체류+외국인. 체류 요건 고시는 제2023-33호(2023-05-18 제정) → 제2025-66호(2025-11-28 일부개정, 인구감소관심지역 추가) | 1차 | https://www.mois.go.kr/frt/sub/a06/b06/populationDeclineLaw/screen.do ; https://mois.go.kr/frt/bbs/type001/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000016&nttId=122130 (게시 2025-11-28) | PARTIAL(개정 반영) |
| C9 서울시 지역축제 빅데이터 분석: 50m 격자, 기간·영역 설정 시 자동 비교, 판정 기준 기재 없음 | 1차 | https://news.seoul.go.kr/gov/archives/565412 (게시 2025-03-04) | CONFIRMED |
| C10 EU 방문객 정의는 이동통신 자료에 드물게 적용, 방문객은 흔히 잔여 집단 | 1차 | https://www.aimspress.com/article/doi/10.3934/NAR.2021002?viewType=HTML (게시 2021) | CONFIRMED |
| C11 MEDIFF: 중앙값·MAD 일반화 ESD, α=0.05, 이상치 약 2%, 약 60일 자료를 4주 배치로 | 1차 | https://arxiv.org/pdf/2008.09245 (게시 2020) | CONFIRMED |
| C12 파리 이동통신 이벤트 탐지: μ+2.32σ(목표 1%, 실측 약 3%), Shewhart μ+3σ, 4시간·1일·1주 심각도 | 1차 | https://arxiv.org/html/2405.19125 ; https://www.ebi.ac.uk/europepmc/webservices/rest/PMC11340987/fullTextXML (게시 2024) | CONFIRMED |
| C13 제주 SKT 연구: 방문자=거주지 제주 외부, 대표 수·토요일 비교, 이벤트 판별 기준 없음 | 1차 | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12036935/fullTextXML (게시 2025) | CONFIRMED |
| C14 2018년 축제 593개 ML 예측: 방문객 수를 성과 기준, 계절성·베이스라인 서술 없음(초록 기준) | 1차 | https://koreascience.kr/article/JAKO202029660099770.page (게시 2020) | CONFIRMED |
| C17 SafeGraph(앱 위치 데이터) 총격 42건: event study·거리대별 DiD-style, 사건 전 10주·후 20주, 95% 신뢰구간, POI 군집 표준오차 | 1차 | https://arxiv.org/html/2502.19640v2 (게시 2025) | PARTIAL(방법 반영) |

## 반대 증거·충돌
- ⚔ 충돌(정의 층위): 법률상 생활인구는 거주자를 포함하고(C8), 2013 한국관광공사 축제 분석의 관광가능인구는 해당 지자체 인구를 뺀다(C4). 쓰임새가 달라 해소하지 않음
- 공급사 구성: [2차] 2023-03-21 보도에 따르면 KT·SKT 는 외지인 방문자 체류시간 기준(각 30분·2시간)과 모수 추정 방식이 다르고, 데이터랩은 기존 KT 에 SKT 를 더했다 — 연도별 이력 비교에 공급사 변경이 섞일 수 있다(사실확인 C1·C6·C7 반대 증거, https://www.discoverynews.kr/news/articleView.html?idxno=973482)
- ⚔ 충돌(상용 서비스 정확도): Placer.ai 이벤트 방문자 파악 긍정 리뷰(이해관계, n=1)와 "way off" 포럼 글(스니펫만) — 종합 쟁점 5, 이번 사실확인 대상 밖
- 1회차의 "KT 속성 구분 vs 업계 댓글" 충돌(C19)은 원 댓글이 위치 데이터 얘기가 아니어서 삭제됐다
- 문턱 목표치와 실측치 괴리: 파리 연구의 μ+2.32σ 는 상위 1% 목표였으나 약 3% 를 잡았다(C12)

## 모르는 것 (정보 한계)
- 문화체육관광부 문화관광축제 방문객 통계 산출 가이드라인 원문(평소 대비 증가분 산식·비교 기간)
- 데이터랩 "주요 5개 지표"의 이름·산식(페이지에 이름도 없음, C2)
- 체류인구 고시 원문의 세부 요건 — "하루 3시간 이상 머무는 횟수 월 1회 이상"은 정부 정책브리핑 본문(2023-06-16, https://www.korea.kr/news/policyNewsView.do?newsId=148916393)에만 확인됐고 고시 원문은 못 열었다
- 전년 동기 대비·STL·CUSUM·synthetic control 을 이동통신 축제 탐지에 쓴 출처, 시군구·일 단위에서 문턱이나 오탐·미탐률을 정한 사례
- 기지국 기반 현지인/외지인 구분 정확도, 표본 오차·신뢰구간
- Placer.ai·Near 이벤트 분석 방법론 문서
- 이번 사실확인 대상이 아니었던 주장: C5(반경 1.5km 100.1%), C15(SafeGraph 4분 체류 정의), C16(Unacast visits 정의), C18(Placer.ai 충돌), C20(DACON 질의), C21(위치 데이터 60~75% 폐기)

## 다음 질문
1. 한국관광데이터랩의 이동통신 공급사가 KT 단독에서 KT+SKT 로 바뀐 정확한 시점과, 그 전후로 외지인 체류시간 기준(30분·2시간)이 지표 수준에 얼마나 차이를 냈는가
2. 문화체육관광부 「문화관광축제 방문객 통계 산출 가이드라인」 최신판은 평소 대비 증가분을 어떤 비교 기간·요일 보정으로 계산하는가
3. 데이터랩 "주요 5개 지표"의 정의와, 그중 이동통신 지표의 산출식은 무엇인가
4. 명절(설·추석)처럼 해마다 날짜가 바뀌는 연휴가 "전후 4주" 창에 섞일 때 공공 분석은 어떻게 처리하는가

## 출처 목록
- [1차] https://datalab.visitkorea.or.kr/datalab/portal/fes/getFesDataForm.do (게시 ? | 접속 2026-09-14)
- [1차] https://datalab.visitkorea.or.kr/datalab/portal/getMetaInfoList.do (게시 ? | 접속 2026-09-14)
- [1차] https://datalab.visitkorea.or.kr/html/interview3/interview05.jsp (게시 ? | 접속 2026-09-14)
- [2차] https://clik.nanet.go.kr/clikr-collection/policyinfo/50/217/1900/CLIKC404914243791907_attach_6.pdf (게시 2015-10-16 | 접속 2026-09-14)
- [2차] (이해관계) https://enterprise.kt.com/entpf/images/techissue/thumbnail/2023090110104100450560.PDF (게시 ? | 접속 2026-09-14)
- [2차] https://www.discoverynews.kr/news/articleView.html?idxno=973482 (게시 2023-03-21 | 접속 2026-09-14)
- [1차] https://www.mois.go.kr/frt/sub/a06/b06/populationDeclineLaw/screen.do (게시 ? | 접속 2026-09-14)
- [1차] https://www.mois.go.kr/frt/bbs/type001/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000016&nttId=100464 (게시 2023-05-18 | 접속 2026-09-14)
- [1차] https://mois.go.kr/frt/bbs/type001/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000016&nttId=122130 (게시 2025-11-28 | 접속 2026-09-14)
- [1차] https://www.korea.kr/news/policyNewsView.do?newsId=148916393 (게시 2023-06-16 | 접속 2026-09-14)
- [1차] https://news.seoul.go.kr/gov/archives/565412 (게시 2025-03-04 | 접속 2026-09-14)
- [1차] https://www.aimspress.com/article/doi/10.3934/NAR.2021002?viewType=HTML (게시 2021 | 접속 2026-09-14)
- [1차] https://arxiv.org/pdf/2008.09245 (게시 2020 | 접속 2026-09-14)
- [1차] https://arxiv.org/html/2405.19125 (게시 2024 | 접속 2026-09-14)
- [1차] https://www.ebi.ac.uk/europepmc/webservices/rest/PMC11340987/fullTextXML (게시 2024 | 접속 2026-09-14)
- [1차] https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12036935/fullTextXML (게시 2025 | 접속 2026-09-14)
- [1차] https://koreascience.kr/article/JAKO202029660099770.page (게시 2020 | 접속 2026-09-14)
- [1차] https://arxiv.org/html/2502.19640v2 (게시 2025 | 접속 2026-09-14)
