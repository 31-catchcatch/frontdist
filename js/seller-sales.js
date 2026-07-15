document.addEventListener("DOMContentLoaded", () => {
  const tabs = [...document.querySelectorAll(".tab-btn")];
  const contents = [...document.querySelectorAll(".tab-content")];
  const currency = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });

  const activateTab = (tabId) => {
    tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === tabId));
    contents.forEach((content) => content.classList.toggle("active", content.id === tabId));
  };

  tabs.forEach((tab) => tab.addEventListener("click", () => activateTab(tab.dataset.tab)));

  const validatePeriod = (start, end, message) => {
    if (!start.value || !end.value) {
      message.textContent = "조회 시작일과 종료일을 모두 선택해주세요.";
      return false;
    }
    if (start.value > end.value) {
      message.textContent = "조회 시작일은 종료일보다 늦을 수 없습니다.";
      return false;
    }
    return true;
  };

  const updateSalesSummary = () => {
    const visibleRows = [...document.querySelectorAll("#sales tbody tr:not([hidden])")];
    const total = visibleRows.reduce((sum, row) => sum + Number(row.dataset.amount), 0);
    const quantity = visibleRows.reduce((sum, row) => sum + Number(row.dataset.quantity), 0);
    document.getElementById("salesTotal").textContent = currency.format(total);
    document.getElementById("salesQuantity").textContent = `${quantity.toLocaleString("ko-KR")}건`;
    document.getElementById("salesAverage").textContent = currency.format(quantity ? Math.round(total / quantity) : 0);
  };

  const search = (target) => {
    const isSales = target === "sales";
    const start = document.getElementById(`${target}StartDate`);
    const end = document.getElementById(`${target}EndDate`);
    const message = document.getElementById(`${target}FilterMessage`);
    const period = document.getElementById(`${target}Period`);
    if (!validatePeriod(start, end, message)) return;

    const rows = document.querySelectorAll(`#${target} tbody tr`);
    let count = 0;
    rows.forEach((row) => {
      const isInRange = row.dataset.date >= start.value && row.dataset.date <= end.value;
      row.hidden = !isInRange;
      if (isInRange) count += 1;
    });
    if (isSales) updateSalesSummary();
    period.hidden = false;
    period.textContent = `조회 기간: ${start.value} ~ ${end.value}`;
    message.textContent = `${start.value} ~ ${end.value} 기간의 ${count}건을 조회했습니다.`;
  };

  document.querySelectorAll("[data-search-target]").forEach((button) => {
    button.addEventListener("click", () => search(button.dataset.searchTarget));
  });

  const requestedTab = new URLSearchParams(window.location.search).get("tab");
  if (["sales", "settlement"].includes(requestedTab)) activateTab(requestedTab);
});
