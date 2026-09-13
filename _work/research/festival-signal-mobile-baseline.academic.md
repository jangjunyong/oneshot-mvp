---
type: research
status: draft
owner: research-team:web-researcher
lens: academic
question: >
  이동통신(KT 등) 기반 시군구 일별 체류인구(현지인·외지인·외국인) 자료만으로
  "특정 기간에 축제(행사) 효과가 실제로 있었는가"를 판별·표시하는 기준과 방법론은
  무엇이며, 이를 실제로 제공하는 비슷한 웹 서비스·공공 지침은 어떻게 하는가?
  조사 대상: (1) 한국관광공사 한국관광데이터랩 '지역축제 방문자 분석'·'축제 방문객'
  산출 방식, 문화체육관광부 문화관광축제 방문객 통계 산출 가이드라인(이동통신 데이터
  기준 평소 대비 증가분·비교 기간 정의), 통계청·지자체 생활인구 축제 분석 사례
  (2) 학술: 이동통신/휴대폰 데이터 기반 이벤트·축제 방문객 추정, 계절성 보정(전년
  동기 대비, 요일 보정, STL), 이상치·이벤트 탐지(z-score, robust MAD, CUSUM,
  synthetic control/difference-in-differences), 오탐·미탐 기준 설정 방법
  (3) 해외 상용: Placer.ai·Near·Unacast·SafeGraph 류 이벤트 영향 분석(베이스라인
  정의, 유의성 표시). 산출물: 우리 서비스가 "이력 연도마다 축제 신호가 뚜렷한지"를
  표시·경고할 때 쓸 수 있는 구체 지표 후보(분모 정의, 요일·계절 보정, 문턱값과 그
  근거)와 각 출처의 신뢰도
inputs: []
searched:
  - "이동통신 빅데이터 축제 방문객 추정 논문"
  - "생활인구 축제 효과 분석 통계청 보고서"
  - "이동통신 빅데이터 지역축제 경제적 파급효과 KOREASCIENCE 논문"
  - "문화체육관광부 문화관광축제 방문객 통계 산출 가이드라인 이동통신 데이터"
  - "\"문화관광축제 빅데이터 분석\" 최종보고서 filetype:pdf"
  - "한국관광 데이터랩 지역축제 방문자 분석 비교기간 정의 4주 방법론"
  - "한국관광 데이터랩 문화관광축제 5대 지표 축제기간 비축제기간 4주"
  - "행정안전부 생활인구 산정 방법론 가이드라인 이동통신 표준화 보고서 PDF"
  - "robust MAD z-score anomaly detection event tourism time series Korean"
  - "mobile phone data festival visitor estimation baseline seasonal adjustment paper"
  - "synthetic control difference-in-differences event footfall mobile location data"
  - "SafeGraph event impact analysis foot traffic anomaly detection paper"
  - "Placer.ai Near Unacast white paper event impact analysis methodology baseline visitation"
  - "CUSUM change point detection tourist arrivals event mobile positioning data academic"
sources_count: 8
created: 2026-09-14
---

# 조사 노트 — 이동통신 체류인구 기반 축제 효과 판별 방법론 (academic 렌즈)

## 발견 사항

**F1.** [1차] 통신사/이커머스 실시간 KPI 모니터링용 이상탐지 알고리즘 MEDIFF는 시계열을 중앙값(median) 기반으로 추세·주간 계절성·DST/공휴일 성분으로 분해한 뒤, 잔차에 일반화 ESD(Extreme Studentized Deviate) 검정을 적용해 이상치를 판별하며, ESD 통계량 계산 시 평균·표준편차 대신 중앙값·MAD(중위절대편차)를 써서 이상치 자체가 임계값을 오염시키는 문제를 줄인다(유의수준 α=0.05, 의심 이상치 비율 약 2% 가정).
URL: https://arxiv.org/pdf/2008.09245 (arXiv:2008.09245, Li·Geng·Jiang, Rutgers Univ./eBay Inc.) — 게시일 2020-08-21, 접속일 2026-09-14.
메모: 관광/축제 도메인 논문은 아니고 IT 서비스 비즈니스 지표(1분 샘플링, 8주 배치) 대상. 요일·DST·공휴일 성분을 별도로 분해해 "이벤트 효과"를 구조적으로 분리하는 접근이 축제 신호 판별에 참고할 만한 일반 방법론으로 제시됨. 직접 PDF 원문(5페이지)을 읽어 확인.

**F2.** [1차](보고서 자체) / [2차](인용된 한국관광공사 2013 원자료) 2013년 한국관광공사가 이동통신사 위치기반 분석데이터·카드사 매출정보·SNS 버즈 데이터를 결합해 문화관광축제(2013년 선정 20개 중 조사범위 초과 2개 제외, 3년 연속 최우수축제 2개 추가) 성과를 분석했으며, 보령머드축제 사례에서 "관광가능인구=해당 지자체 인구를 제외한 축제기간 전체 외부 유입인구의 일별 합"으로 정의하고 평상시(일평균 11만2천명) 대비 축제기간(일평균 14만5천명) 유입인구 증가율 29.4%(축제지점 반경 1.5km 이내는 100.1%)로 산출했다.
URL: https://clik.nanet.go.kr/clikr-collection/policyinfo/50/217/1900/CLIKC404914243791907_attach_6.pdf (울산발전연구원 Issue Report Vol.102, 유영준, 「관광마케팅 전략 수립을 위한 '빅데이터' 활용 방안」) — 게시일 2015-10-16, 접속일 2026-09-14.
메모: 이 문서 자체는 국내 지방연구원의 이슈리포트로, 본문에 인용된 "한국관광공사(2013), 빅데이터 활용 문화관광축제 성과분석보고서"의 페이지(17쪽, 57쪽)까지 명시하나 그 원자료 PDF는 직접 확보하지 못함. SKT 유동인구 데이터(전국 1일 평균 9TB 원천 DB)와 VAN 카드 매출 데이터를 결합했다고 기술.

**F3.** [1차] 파리 모바일 네트워크 트래픽 데이터로 도시 이벤트를 조기 탐지하는 연구에서, 베이스라인을 두 방식(① Signature: 셀·서비스별 주간 활동의 중앙값 기반 시그니처 + Butterworth 평활화, ② Adaptive: Facebook Prophet 기반 예측모델 + 주간주기성/학교방학 회귀변수)으로 정의하고, 편차 분포에 감마분포를 적합해 Signature 방식은 μ+2.32σ(상위 1% 목표, 실제 재현율 약 3%), Adaptive 방식은 Shewhart 관리도 기반 μ+3σ(지수가중 이동평균·분산 갱신)를 이상치 문턱값으로 삼았으며, 4시간·1일·1주 단위 초과 빈도(재현주기 개념 차용)로 3단계 심각도를 정의했다.
URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC11340987/ (Lemaire, Furno 외, "Early detection of critical urban events using mobile phone network data") — 게시일 2024-08(PMC 등재), 데이터 기간 2019-03-15~2019-06-15(파리, 3개월), 접속일 2026-09-14.
메모: 축제 전용 연구는 아니고 도시 이벤트(집회·사고 등 포함) 조기탐지가 목적. 요일 보정이 시그니처/Prophet 양쪽 모두에 내장돼 있고 공휴일·학교방학을 별도 변수로 처리.

**F4.** [1차] 이동통신 위치데이터(MPD)로 관광통계를 생산할 때 '방문객'을 직접 식별하지 못하므로, 우선 거주자·통근자 등 다른 이동 유형을 식별해 제외한 뒤 잔여 집단을 방문객으로 도출하는 잔차(residual) 방식을 쓴다는 점과, EU Regulation 692/2011의 방문객 정의(숙박일수·목적 등)가 MPD에는 거의 그대로 적용되지 않는다는 한계를 논의한다.
URL: https://www.aimspress.com/article/doi/10.3934/NAR.2021002?viewType=HTML (Grassini & Dugheri, "Mobile phone data and tourism statistics: a broken promise?", National Accounting Review) — 게시연도 2021년, 피렌체 광역시 2016년 MPD 사례, 접속일 2026-09-14.
메모: "야간 숙박 비율"의 월별 추이로 계절성을 잡는 방식만 언급되고, 축제 등 단기 이벤트 판별에 특화된 통계 검정(z-score 등)은 제시되지 않음(구버전 가능: 2016년 데이터, 5년 이상 경과).

**F5.** [1차] 2018년 한 해 개최된 축제 593개를 대상으로 지역 특성(인구·행정구역·접근성 등 6개 변수)과 축제 특성(홍보도·초청가수·날씨·예산 등 15개 변수)으로 방문객 수를 예측하는 머신러닝 모형을 제시하며, 방문객 수 자체를 축제 성과 평가 기준으로 삼는다.
URL: https://koreascience.kr/article/JAKO202029660099770.page (이인지·윤현식, 「머신러닝을 활용한 지역축제 방문객 수 예측모형 개발」, 한국정보시스템학회지, 2020년 Vol.29 No.3) — 접속일 2026-09-14.
메모: 데이터 출처(이동통신/카드 등)가 페이지 요약에 명시되지 않았고, 계절성 보정이나 "평소 대비 증가분" 같은 베이스라인 비교 방법론은 기술되지 않음 — 방문객 예측(사전) 모형이지 실측 이벤트 탐지(사후) 모형이 아님.

**F6.** [1차](초록 확인) SafeGraph 모바일 위치데이터로 2018~2022년 미국 내 총격사건 42건 인근 15만 개 이상 POI의 방문 패턴을 분석한 결과, 사건 인접 POI 방문은 감소하고 더 먼 POI 방문은 증가하는 "경제활동의 공간적 재배치" 패턴을 확인했다.
URL: https://arxiv.org/abs/2502.19640 (Cuellar & Jung, "Mass Shootings, Community Mobility, and the Relocation of Economic Activity") — 제출일 2025-02-27(v1)/2026-01-14(v2), 접속일 2026-09-14.
메모: 초록에서 difference-in-differences/synthetic control이라는 방법론 명칭 자체는 확인하지 못함(본문 PDF는 바이너리 압축으로 텍스트 추출 실패, 이 부분은 [추정]+스니펫만 확인 수준). 유의성 표시 기준(p-value 등)도 본문 확보 실패로 미확인.

**F7.** [1차] SKT(시장점유율 약 50%) 모바일 데이터로 제주도 방문자의 시공간 분포를 분석하면서, 실거주지가 제주도 외부인 이용자를 방문자로 정의하고, 계절별(2022년 1·5·7·10월 각 1주일)로 평일 대표일(수요일)과 주말 대표일(토요일)을 뽑아 비교하는 방식으로 요일 패턴을 반영했으나, 이상치나 특이일(이벤트)을 통계적으로 판별하는 기준은 논문에 제시되지 않았다.
URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC12036935/ (Lee & Eom, "Spatiotemporal dynamics of visitors to Jeju Island: Hotspot and spatial autocorrelation analyses using mobile phone data", PLoS One 20(4):e0321694) — 게시일 2025-04-28, 접속일 2026-09-14.
메모: 국내(제주) 사례이자 이 조사 질문의 "시군구 단위 이동통신 체류인구" 상황과 데이터 성격이 가장 가깝지만, 정작 "이벤트 효과가 있었는가"를 판별하는 통계 기준은 이 논문의 범위 밖이라는 점 자체가 의미 있는 발견(미탐 확인).

**F8.** [추정] (스니펫만 확인) 한국관광 데이터랩 문화관광축제 분석에서 "5대 지표"를 두고 매년 축제기간과 비축제기간(축제 전후 4주)의 차이로 축제 특성을 분석한다는 서술이 검색 결과 요약에 나타났으나, 이를 명시한 1차 페이지(데이터랩 방법론 문서·PDF)를 직접 열어 확인하지 못했다.
URL: 확인 못함(WebSearch 집계 요약에서만 확인, 원문 링크 없음) — 접속일 2026-09-14.
메모: "비교기간=전후 4주"라는 구체적 수치가 실제 산출 로직에서 왔는지, 기사·해설 재인용인지 원문 대조가 필요. 이후 2024 보고서 PDF(F 참고: 발간 2025-05-09, "2024 문화관광축제 빅데이터 분석 용역 최종보고서.pdf") 본문을 확보하면 검증 가능.

## 이 렌즈에서 찾지 못한 것

- 문화체육관광부의 공식 "문화관광축제 방문객 통계 산출 가이드라인" 원문(이동통신 데이터 기준 '평소 대비 증가분' 계산식·비교 기간을 명문화한 지침 문서)을 원문으로 찾지 못함. 검색어: "문화체육관광부 문화관광축제 방문객 통계 산출 가이드라인 이동통신 데이터", "\"문화관광축제 빅데이터 분석\" 최종보고서 filetype:pdf". 대신 찾은 「2022 문화관광축제 빅데이터 분석 사업」(knto.or.kr, HWP 파일)은 인코딩 문제로 본문을 열지 못함.
- CUSUM(누적합 관리도)을 관광객/축제 방문자 이벤트 탐지에 직접 적용한 학술 논문을 찾지 못함. 검색어: "CUSUM change point detection tourist arrivals event mobile positioning data academic" — 반환된 논문들은 산업 공정·신경데이터·패널데이터 등 타 도메인.
- Placer.ai·Near·Unacast의 이벤트 영향 분석 방법론을 담은 공식 백서(원문 PDF)를 찾지 못함. 검색어: "Placer.ai Near Unacast white paper event impact analysis methodology baseline visitation" — 일반 소개 블로그·비교 사이트만 검색됨(이 렌즈의 출처 아님, 인용하지 않음).
- 통계청/행정안전부의 생활인구 "축제 효과" 산정에 관한 공식 방법론 가이드라인(보도자료 아닌 산정 기준 원문 문서)을 찾지 못함. 검색어: "행정안전부 생활인구 산정 방법론 가이드라인 이동통신 표준화 보고서 PDF" — 보도자료·시범산정 결과 공표문만 검색됨.
- 한국관광 데이터랩 "지역축제 방문자 분석" 화면이 실제로 쓰는 산출식·5대 지표 정의를 1차 문서로 확인하지 못함(F8 참고).

## 검색 한계

- HWP(한글) 형식 문서(knto.or.kr 「2022 문화관광축제 빅데이터 분석 사업」)는 WebFetch로 바이너리 추출이 안 돼 본문 확인 불가.
- 일부 PDF(예: arXiv 2502.19640 총격사건 논문, 관광마케팅 빅데이터 이슈리포트 원본 PDF의 세부 방법론 표)는 WebFetch가 압축 스트림을 텍스트로 파싱하지 못해, Read 도구로 페이지 이미지를 직접 열람하는 방식으로 우회했다(F2 일부는 이 방식으로 확인). arXiv 2502.19640은 본문 파싱이 끝내 실패해 초록(abstract 페이지)만 [1차]로 확인했다.
- KOREASCIENCE·DBpia 등 국내 학술DB는 초록·목차 수준 페이지만 열람 가능했고, 원문 PDF 전체(계산식·표)까지는 접근하지 못한 경우가 있었다(F5).
- Google Scholar 자체를 직접 열람하지는 않았고(WebFetch가 검색엔진 결과 페이지를 안정적으로 파싱하지 못함), 대신 WebSearch(일반 검색)로 논문·보고서 링크를 찾은 뒤 원문 URL만 개별적으로 WebFetch/Read했다 — 따라서 Scholar 자체 색인 범위의 누락 가능성이 있다.
- 렌즈 밖(문서 렌즈·커뮤니티 렌즈에 해당할 수 있는) 발견: 한국관광 데이터랩 포털 https://datalab.visitkorea.or.kr/datalab/portal/fes/getFesDataForm.do (공식 서비스 화면, docs 렌즈용), 국토연구원/조선일보 수도권 유동인구 기사 인용(UDI 리포트 3쪽, community/기사 성격) — 발견 사항에는 넣지 않음.
