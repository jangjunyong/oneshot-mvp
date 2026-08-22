export default function Home() {
  return (
    <main style={{ padding: 32, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>
        공시 근거로 보유 종목 관계를 캐는 에이전트
      </h1>
      <p style={{ marginTop: 8 }}>
        섹터를 나눠 담아도, 어느 회사를 경유해 한 덩어리로 이어지는지는 알 수 없다.
      </p>
      <p style={{ marginTop: 4 }}>
        에이전트가 공시를 직접 뒤져 경로를 찾아오고, 그 결과로 그래프가 자란다.
      </p>
      <p style={{ marginTop: 16, color: "#666" }}>
        숭실대 ONE SHOT 개별 프로젝트 · 2주 MVP · Day 1
      </p>
    </main>
  );
}
