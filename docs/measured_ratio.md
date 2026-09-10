# 공사 유래 실측 셀 비율 — M0 (2026-09-09)

기획 08 §4 #2 의 자 그대로: 키 있는 로컬 개발 서버에서 **비픽스처 축제 1건**으로 `/check` 를 열어
`[data-num][data-origin="measured"]` 가운데 `data-source-api` 가 공사 API(`DataLabService/locgoRegnVisitrDDList` 또는 `KorService2`)인 셀의 비율을 쟀다.
`data-origin="input"`(담당자 기획안 값, `data-source-api="기획안"`) 셀은 분모에서 뺐다. CI 에는 걸지 않는다(외부 API 가용성에 CI 를 걸지 않는다는 08 §4 #2 단서).

| 항목 | 값 |
|---|---|
| 축제 | 실향민문화축제(강원 속초시), 기획 2027-06-11~12, 예상 30,000명(일 최다·연인원), 이력 2025-06-13~14 · 2026-06-12~13 |
| 조회일 | 2026-09-09 (개발 서버, KT 적재본 builtAt 2026-09-09) |
| 전체 `data-num` 셀 | 9 |
| `origin="input"` (분모 제외) | 4 |
| `origin="measured"` (분모) | 5 |
| 그중 공사 API 유래 (분자) | 5 (`DataLabService/locgoRegnVisitrDDList` 5) |
| **비율** | **1.00** |
| 최종 라벨 | 과소 |

읽는 법: `/check` 의 실측 셀은 전부 공사 KT 일별 방문자에서 온다. 다만 KT 값은 저장소에 정적으로 적재한 파일(`data/kto/visitors/*.json.gz`)을 읽은 것이고
런타임 공사 API 호출은 TourAPI(`KorService2`, 귀속 경고·이름 검색)뿐이다. 그 구분은 M8(런타임 호출 셀 / 정적 적재 셀 분리 표기)이 화면에 낸다.
이 표의 1.00 은 "실측 셀의 출처가 공사"라는 뜻이지 "실시간 호출"이라는 뜻이 아니다. 08 §4 #2 의 0.70 은 넘는다.
