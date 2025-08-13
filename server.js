import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8787;

/**
 * 어댑터 1: 행안부 공유플랫폼 ‘시군저수지 저수’ OpenAPI (일 1회 갱신)
 * 문서: data.go.kr (데이터ID: 15139723)  ※ 서비스키 필요
 * 쿼리 파라미터(예시): targetDt=YYYYMMDD, pageNo, numOfRows 등
 * 반환 필드(예): sido, sigungu, reservoirCnt, effctvRsvrQty, nowRsvrQty, nowRsvrRt ...
 */
async function fetchSafetyData({ ymd, ggPrefix = "41" }) {
  const serviceKey = process.env.SAFETYDATA_SERVICE_KEY;
  if (!serviceKey) throw new Error("SAFETYDATA_SERVICE_KEY 미설정");

  // API 엔드포인트(문서 페이지에서 상세 확인 후 필요시 경로/파라미터 수정)
  // 보편적으로 공공데이터포털 OpenAPI는 serviceKey(=인증키), pageNo, numOfRows, type=json 등 사용
  const base = "https://apis.data.go.kr/1741000/Reservoir/getReservoir";
  const qs = new URLSearchParams({
    serviceKey: serviceKey,
    targetDt: ymd,          // YYYYMMDD
    pageNo: "1",
    numOfRows: "10000",
    type: "json"
  });

  const url = `${base}?${qs.toString()}`;
  const r = await fetch(url, { timeout: 10000 });
  if (!r.ok) throw new Error("SafetyData API 오류: " + r.status);
  const json = await r.json();

  // 응답 스키마에 맞게 파싱 (아래는 전형적인 data.go.kr JSON 구조 예시)
  const items =
    json?.response?.body?.items?.item ||
    json?.response?.body?.items ||
    json?.items ||
    [];

  // 경기도만 필터: 시군구코드 앞 2자리(41) 기준 또는 sido == '경기도'
  const filtered = items.filter(it => {
    const code = String(it?.sigunguCd || it?.signguCode || "");
    const sido = (it?.sido || it?.ctprvnNm || "").trim();
    return code.startsWith(ggPrefix) || sido.includes("경기도");
  });

  // 행 단위(시군 레벨) → 저수지 레벨까지 세분화된 필드가 있는 경우 매핑
  // 문서상 제공 필드: 대상일자, 시군구코드/명, 저수지수, 수해면적, 유효저수량, 현재저수량, 현재저수율 등 (일 1회)  :contentReference[oaicite:4]{index=4}
  return filtered.map(it => ({
    date: it?.targetDt || ymd,
    sido: it?.sido || it?.ctprvnNm,
    sigungu: it?.sigungu || it?.signguNm,
    reservoirCnt: it?.reservoirCnt,
    effRsvrQty: it?.effctvRsvrQty,   // 유효저수량
    nowRsvrQty: it?.nowRsvrQty,      // 현재저수량
    nowRsvrRate: it?.nowRsvrRt       // 현재저수율(%)
  }));
}

/**
 * API: /api/reservoirs
 * 쿼리: ?date=YYYY-MM-DD
 * 응답: 경기도 시군 단위 저수 현황 배열
 */
app.get("/api/reservoirs", async (req, res) => {
  try {
    const date = req.query.date || process.env.TARGET_DATE || new Date().toISOString().slice(0, 10);
    const ymd = date.replaceAll("-", "");
    const ggPrefix = process.env.GG_PREFIX || "41";
    const rows = await fetchSafetyData({ ymd, ggPrefix });

    res.json({
      source: "MOIS SafetyData OpenAPI (daily)",
      date,
      count: rows.length,
      rows
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// 정적 파일 서빙
app.use(express.static("src"));

app.listen(PORT, () => {
  console.log(`Reservoir server running at http://localhost:${PORT}`);
});

