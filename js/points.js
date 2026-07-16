// points.js — 포인트 페이지
// GET /api/v1/users/me/points (백엔드 작성완료)
// 로그인 필요 페이지

document.addEventListener("DOMContentLoaded", () => {

  const $ = (sel) => document.querySelector(sel);
  const won = (n) => n.toLocaleString("ko-KR");

  // ===== 내역 표 그리기 =====
  function renderHistory(list) {
    if (list.length === 0) {
      $('[data-role="point-history"]').innerHTML =
        `<tr><td colspan="5" style="text-align:center;padding:40px;color:#999;">포인트 내역이 없습니다.</td></tr>`;
      return;
    }

    $('[data-role="point-history"]').innerHTML = list.map((h) => {
      // 적립(양수)이면 초록+, 사용(음수)이면 빨강-
      const isPlus = h.amount >= 0;
      const cls = isPlus ? "plus" : "minus";
      const sign = isPlus ? "+" : "";
      const type = isPlus ? "적립" : "사용";

      // 날짜에서 앞 10글자만 (2026-07-14T10:00 → 2026-07-14)
      const date = h.createdAt ? h.createdAt.substring(0, 10) : "";

      return `
        <tr>
          <td>${date}</td>
          <td>${h.reason}</td>
          <td>${type}</td>
          <td class="${cls}">${sign}${won(h.amount)} P</td>
          <td>${won(h.balanceAfter)} P</td>
        </tr>
      `;
    }).join("");
  }

  // ===== 요약 표 그리기 =====
  // ※ 백엔드 API에 요약 데이터가 없어서, 내역으로 계산
  function renderSummary(list) {
    // 보유 포인트 = 가장 최근 내역의 잔액
    const balance = list.length > 0 ? list[0].balanceAfter : 0;

    // 이번 달 적립/사용 계산
    const now = new Date();
    const thisMonth = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");

    let earned = 0, used = 0;
    list.forEach((h) => {
      if (h.createdAt && h.createdAt.startsWith(thisMonth)) {
        if (h.amount >= 0) earned += h.amount;
        else used += Math.abs(h.amount);
      }
    });

    $('[data-role="point-summary"]').innerHTML = `
      <tr>
        <td><strong>${won(balance)} P</strong></td>
        <td class="plus">+${won(earned)} P</td>
        <td class="minus">-${won(used)} P</td>
        <td>- P<br><small>(소멸 예정 API 준비중)</small></td>
      </tr>
    `;
  }

  // ===== API에서 진짜 데이터 받아오기 =====
  async function loadPoints() {
    try {
      const token = localStorage.getItem("catchcatch.accessToken");

      const res = await fetch("/api/v1/users/me/points", {
        method: "GET",
        headers: {
          "Authorization": "Bearer " + token,
        },
      });

      if (!res.ok) {
        throw new Error("포인트 조회 실패: " + res.status);
      }

      const json = await res.json();

      // 3겹 껍질 벗기기: json.data.content 가 진짜 내역 목록
      const list = json.data.content;

      console.log("받은 데이터:", list);  // 확인용 (나중에 지워도 됨)

      renderSummary(list);
      renderHistory(list);

    } catch (err) {
      console.error(err);
      $('[data-role="point-history"]').innerHTML =
        `<tr><td colspan="5" style="text-align:center;padding:40px;color:#e02020;">포인트 정보를 불러오지 못했습니다.<br>${err.message}</td></tr>`;
    }
  }

  // ===== 실행 =====
  loadPoints();

});