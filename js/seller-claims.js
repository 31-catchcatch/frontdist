document.addEventListener("DOMContentLoaded", () => {
  const rows = [...document.querySelectorAll(".claim-item")];
  const startDate = document.getElementById("claimStartDate");
  const endDate = document.getElementById("claimEndDate");
  const statusFilter = document.getElementById("claimStatusFilter");
  const filterMessage = document.getElementById("claimFilterMessage");
  const statusSelect = document.getElementById("claimStatusSelect");
  let selectedRow = document.querySelector(".claim-item.active");

  const statusClass = (status) => (status === "완료" ? "done" : status === "검토중" ? "wait" : "");

  const renderSelectedClaim = () => {
    const data = selectedRow.dataset;
    document.getElementById("claimId").textContent = data.id;
    document.getElementById("claimProduct").textContent = data.product;
    document.getElementById("claimType").textContent = data.type;
    document.getElementById("claimReason").textContent = data.reason;
    document.getElementById("claimAmount").textContent = data.amount;
    statusSelect.value = data.status;
  };

  const validateDates = () => {
    if (!startDate.value && !endDate.value) return true;
    if (!startDate.value || !endDate.value) {
      filterMessage.textContent = "조회 시작일과 종료일을 모두 선택해주세요.";
      return false;
    }
    if (startDate.value > endDate.value) {
      filterMessage.textContent = "조회 시작일은 종료일보다 늦을 수 없습니다.";
      return false;
    }
    return true;
  };

  const filterClaims = () => {
    if (!validateDates()) return;
    let visibleCount = 0;
    rows.forEach((row) => {
      const matchesDate = (!startDate.value || row.dataset.date >= startDate.value) && (!endDate.value || row.dataset.date <= endDate.value);
      const matchesStatus = statusFilter.value === "all" || row.dataset.status === statusFilter.value;
      row.hidden = !(matchesDate && matchesStatus);
      if (!row.hidden) visibleCount += 1;
    });
    filterMessage.textContent = `${visibleCount}건의 클레임을 조회했습니다.`;
  };

  rows.forEach((row) => row.addEventListener("click", () => {
    selectedRow.classList.remove("active");
    selectedRow = row;
    selectedRow.classList.add("active");
    renderSelectedClaim();
  }));

  document.getElementById("claimSearchButton").addEventListener("click", filterClaims);
  document.getElementById("updateClaimStatusButton").addEventListener("click", () => {
    const status = statusSelect.value;
    selectedRow.dataset.status = status;
    const badge = selectedRow.querySelector(".status");
    badge.className = `status ${statusClass(status)}`.trim();
    badge.textContent = status;
    filterMessage.textContent = `${selectedRow.dataset.id} 상태를 ${status}(으)로 변경했습니다.`;
  });

  document.getElementById("completeRefundButton").addEventListener("click", () => {
    if (selectedRow.dataset.type !== "환불") {
      alert("환불 요청 건에서만 최종 환불 처리를 할 수 있습니다.");
      return;
    }
    selectedRow.dataset.status = "완료";
    const badge = selectedRow.querySelector(".status");
    badge.className = "status done";
    badge.textContent = "완료";
    filterMessage.textContent = `${selectedRow.dataset.id} 환불 처리가 완료되었습니다.`;
  });

  const requestedStatus = new URLSearchParams(window.location.search).get("status");
  if (requestedStatus && [...statusFilter.options].some((option) => option.value === requestedStatus)) {
    statusFilter.value = requestedStatus;
    filterClaims();
  }
  renderSelectedClaim();
});
