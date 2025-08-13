const $date = document.getElementById("date");
const $datePicker = document.getElementById("datePicker");
const $tbody = document.querySelector("#tbl tbody");
let currentSort = { key: "nowRsvrRate", asc: false };

function fmt(n) {
  if (n === null || n === undefined || n === "") return "-";
  const num = Number(n);
  return Number.isFinite(num) ? num.toLocaleString("ko-KR") : String(n);
}

async function load(dateStr) {
  const url = dateStr ? `/api/reservoirs?date=${dateStr}` : `/api/reservoirs`;
  const r = await fetch(url);
  const data = await r.json();
  $date.textContent = data.date;
  render(data.rows || []);
}

function render(rows) {
  // 정렬
  const { key, asc } = currentSort;
  rows.sort((a, b) => {
    const va = a[key] ?? 0, vb = b[key] ?? 0;
    return asc ? va - vb : vb - va;
  });

  // 렌더
  $tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${r.sigungu ?? "-"}</td>
      <td>${fmt(r.reservoirCnt)}</td>
      <td>${fmt(r.effRsvrQty)}</td>
      <td>${fmt(r.nowRsvrQty)}</td>
      <td>${fmt(r.nowRsvrRate)}</td>
    </tr>
  `).join("");
}

// 헤더 클릭 정렬
document.querySelectorAll("th[data-key]").forEach(th => {
  th.addEventListener("click", () => {
    const key = th.dataset.key;
    currentSort = { key, asc: (currentSort.key === key ? !currentSort.asc : false) };
    load($datePicker.value || undefined);
  });
});

// 초기값: 오늘
const today = new Date().toISOString().slice(0,10);
$datePicker.value = today;

document.getElementById("reload").addEventListener("click", () => {
  load($datePicker.value || undefined);
});

// 최초 로드
load();

