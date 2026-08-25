document.addEventListener("DOMContentLoaded", () => {

  const $ = (sel) => document.querySelector(sel);
  const won = (n) => n.toLocaleString("ko-KR");


  function renderHistory(list) {
    if (list.length === 0) {
      $('[data-role="point-history"]').innerHTML =
        `<tr><td colspan="5" class="state-empty">포인트 내역이 없습니다.</td></tr>`;
      return;
    }

    $('[data-role="point-history"]').innerHTML = list.map((h) => {

      const isPlus = h.amount >= 0;
      const cls = isPlus ? "plus" : "minus";
      const sign = isPlus ? "+" : "";
      const type = isPlus ? "적립" : "사용";


      const date = h.createdAt ? h.createdAt.substring(0, 10) : "";

      return `
        <tr>
          <td>${date}</td>
          <td>${esc(h.reason)}</td>
          <td>${type}</td>
          <td class="${cls}">${sign}${won(h.amount)} P</td>
          <td>${won(h.balanceAfter)} P</td>
        </tr>
      `;
    }).join("");
  }


  function renderSummary(list) {

    const balance = list.length > 0 ? list[0].balanceAfter : 0;


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
      </tr>
    `;
  }


  async function loadPoints() {
    try {
      const res = await fetch("/api/v1/users/me/points", {
        method: "GET",
      });

      if (!res.ok) {
        throw new Error("포인트 조회 실패: " + res.status);
      }

      const json = await res.json();

      const list = json.data.content;

      renderSummary(list);
      renderHistory(list);

    } catch (err) {
      console.error(err);
      $('[data-role="point-history"]').innerHTML =
        `<tr><td colspan="5" class="state-error">포인트 정보를 불러오지 못했습니다.<br>${esc(err.message)}</td></tr>`;
    }
  }


  loadPoints();

});
