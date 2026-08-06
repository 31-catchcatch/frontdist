// seller-claims.js — 판매자 교환/환불 관리
// GET  /api/v1/seller/claims              (목록 조회, status 필터)
// PUT  /api/v1/seller/claims/{id}/status  (상태 변경: 승인/반려/처리중, 교환 완료)
// POST /api/v1/seller/refunds             (환불(RETURN) 승인·완료 — S-CLAIM-003)
// 판매자 로그인 필요
//
// [개편 내역]
// - 클레임 상세에 "고객 아이디(buyerUsername)"와 "구매일시(orderedAt)"를 표시
//   (백엔드 SellerClaimResponse 에 두 필드가 추가됨)
// - 상태 변경 드롭다운을 없애고, 현재 상태에서 가능한 처리만 버튼으로 노출
//   (승인/반려/처리시작/교환완료 + 환불 승인이 "처리하기" 한곳에 모임)
// - 상태/유형을 색상 배지로 표시해 한눈에 구분

document.addEventListener("DOMContentLoaded", () => {

  const API = (
    window.CATCHCATCH_API_BASE_URL || "/api/v1"
  ).replace(/\/$/, "");

  // ===== 영어 ↔ 한글 변환표 =====
  const STATUS_KO = {
    REQUESTED: "신청",
    ACCEPTED: "접수",
    REJECTED: "반려",
    PROCESSING: "처리중",
    COMPLETED: "완료",
  };
  // 백엔드 ClaimType enum: RETURN(환불/반품), EXCHANGE(교환)
  const TYPE_KO = {
    EXCHANGE: "교환",
    RETURN: "환불",
  };
  // 화면 → 백엔드 (조회 필터 보낼 때)
  const STATUS_EN = {
    "신청": "REQUESTED",
    "접수": "ACCEPTED",
    "반려": "REJECTED",
    "처리중": "PROCESSING",
    "완료": "COMPLETED",
  };

  // 각 상태 전이 버튼의 친화적 라벨/스타일
  const ACTION_LABEL = {
    ACCEPTED: "요청 승인",
    REJECTED: "요청 반려",
    PROCESSING: "처리 시작",
    COMPLETED: "교환 완료",
  };
  const ACTION_CLASS = {
    ACCEPTED: "act-primary",
    REJECTED: "act-reject",
    PROCESSING: "act-primary",
    COMPLETED: "act-success",
  };

  // 백엔드가 PUT /seller/claims/{id}/status 로 허용하는 전이가 이게 전부다.
  // (SellerClaimService.validateStatusChange 기준 — 상태뿐 아니라 "유형"까지 본다)
  //   신청  → 접수 / 반려      (교환·환불 공통)
  //   접수  → 처리중           (교환·환불 공통)
  //   처리중 → 완료            (교환 전용!)
  //
  // 환불(RETURN)의 완료는 이 API로 못 간다. 결제 취소·포인트 복원이 얽혀 있어
  // POST /seller/refunds 로만 처리된다.
  function nextStatuses(claim) {
    switch (claim.status) {
      case "REQUESTED":
        return ["ACCEPTED", "REJECTED"];
      case "ACCEPTED":
        return ["PROCESSING"];
      case "PROCESSING":
        // 교환만 여기서 완료된다. 환불은 아래 canRefund 경로로.
        return claim.claimType === "EXCHANGE" ? ["COMPLETED"] : [];
      default:
        return []; // 반려·완료는 종료 상태
    }
  }

  // 환불 승인(최종 완료) 가능 조건 (SellerRefundService.validateRefundableClaim 기준)
  const canRefund = (claim) =>
    claim.claimType === "RETURN" &&
    ["ACCEPTED", "PROCESSING"].includes(claim.status);

  const $ = (id) => document.getElementById(id);
  const won = (n) => (n == null ? "-" : n.toLocaleString("ko-KR") + "원");

  // 구매일시/요청일시 표기 (연-월-일 시:분)
  function fmtDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    }).format(date);
  }

  const filterMessage = $("claimFilterMessage");
  const statusFilter = $("claimStatusFilter");
  const listView = $("claimList");
  const detailView = $("claimDetail");
  const filterBox = $("claimFilterBox");
  const actionHint = $("claimActionHint");
  const actionButtons = $("claimActionButtons");
  const refundNote = $("claimRefundNote");

  let claims = [];         // 전체 클레임
  let selected = null;     // 지금 선택된 클레임

  // ===== 화면 전환 (목록 ↔ 상세) =====
  function showList() {
    selected = null;
    listView.hidden = false;
    detailView.hidden = true;
    filterBox.hidden = false;
  }

  function showDetail() {
    listView.hidden = true;
    detailView.hidden = false;
    filterBox.hidden = true;   // 조회 필터는 목록 전용
    window.scrollTo({ top: 0 });
  }

  // 상태 enum → 배지 색 클래스
  const statusBadgeClass = (en) => "badge-" + String(en || "").toLowerCase();

  // ===== 토큰 꺼내기 =====
  function getToken() {
    return localStorage.getItem("catchcatch.accessToken");
  }

  function authHeaders(withBody) {
    return {
      ...(withBody ? { "Content-Type": "application/json" } : {}),
      "Authorization": "Bearer " + getToken(),
    };
  }

  // ===== 목록 조회 (GET) =====
  async function loadClaims(statusEn) {
    try {
      const url = statusEn
        ? `${API}/seller/claims?status=${statusEn}`
        : `${API}/seller/claims`;

      const res = await fetch(url, {
        method: "GET",
        headers: authHeaders(false),
      });

      if (!res.ok) throw new Error("클레임 조회 실패: " + res.status);

      const json = await res.json();
      claims = json.data.content;   // 페이지 응답의 content

      renderList();
      showList();

      return claims.length;
    } catch (err) {
      console.error(err);
      filterMessage.textContent = "클레임을 불러오지 못했습니다: " + err.message;
      return null;
    }
  }

  // ===== 목록 표 그리기 =====
  function renderList() {
    const tbody = $("claimListBody");

    if (claims.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:30px;color:#999;">조회된 클레임이 없습니다.</td></tr>`;
      return;
    }

    tbody.innerHTML = claims.map((c) => {
      const statusKo = STATUS_KO[c.status] || c.status;
      const typeKo = TYPE_KO[c.claimType] || c.claimType;
      const typeClass = "type-" + String(c.claimType || "").toLowerCase();
      return `
        <tr class="claim-item" data-id="${c.claimId}">
          <td>${c.claimId}</td>
          <td class="col-product">${c.productName}</td>
          <td><span class="claim-type-badge ${typeClass}">${typeKo}</span></td>
          <td><span class="claim-status-badge ${statusBadgeClass(c.status)}">${statusKo}</span></td>
        </tr>
      `;
    }).join("");

    // 행 클릭 이벤트
    tbody.querySelectorAll(".claim-item").forEach((row) => {
      row.addEventListener("click", () => {
        selectClaim(Number(row.dataset.id));
      });
    });
  }

  // ===== 클레임 선택 → 상세 표시 =====
  function selectClaim(claimId) {
    selected = claims.find((c) => c.claimId === claimId);
    if (!selected) return;

    // 목록에서 active 표시
    document.querySelectorAll(".claim-item").forEach((row) => {
      row.classList.toggle("active", Number(row.dataset.id) === claimId);
    });

    const statusKo = STATUS_KO[selected.status] || selected.status;
    const typeKo = TYPE_KO[selected.claimType] || selected.claimType;

    // 요약: 유형 배지 + 상품 + 상태 배지
    const typeBadge = $("claimTypeBadge");
    typeBadge.textContent = typeKo;
    typeBadge.className =
      "claim-type-badge type-" + String(selected.claimType || "").toLowerCase();

    $("claimProduct").textContent = selected.productName;

    const statusBadge = $("claimStatusBadge");
    statusBadge.textContent = statusKo;
    statusBadge.className =
      "claim-status-badge " + statusBadgeClass(selected.status);

    // 고객 · 주문 정보 (환불 요청 고객 아이디 / 구매 시점)
    $("claimBuyer").textContent = selected.buyerUsername || "-";
    $("claimOrderedAt").textContent = fmtDateTime(selected.orderedAt);
    $("claimId").textContent = selected.claimId;
    $("claimRequestedAt").textContent = fmtDateTime(selected.requestedAt);

    // 요청 내용
    $("claimType").textContent = typeKo;
    $("claimAmount").textContent = won(selected.claimAmount);
    $("claimReason").textContent = selected.reason || "-";

    // 판매자 처리 사유는 있을 때만 노출
    const processReasonCell = $("processReasonCell");
    if (selected.processReason) {
      $("claimProcessReason").textContent = selected.processReason;
      processReasonCell.hidden = false;
    } else {
      processReasonCell.hidden = true;
    }

    renderActions(selected);
    showDetail();
  }

  // ===== 현재 상태에서 실제로 가능한 처리만 버튼으로 노출 =====
  function renderActions(claim) {
    const next = nextStatuses(claim);
    const refundable = canRefund(claim);

    actionButtons.innerHTML = "";

    // 상태 전이 버튼
    next.forEach((en) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "action-btn " + (ACTION_CLASS[en] || "act-primary");
      btn.textContent = ACTION_LABEL[en] || STATUS_KO[en] || en;
      btn.addEventListener("click", () => doStatusChange(en));
      actionButtons.appendChild(btn);
    });

    // 환불 승인(최종 완료) 버튼
    if (refundable) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "action-btn act-refund";
      btn.textContent = `환불 승인 · 완료 (${won(claim.claimAmount)})`;
      btn.addEventListener("click", doRefund);
      actionButtons.appendChild(btn);
    }

    refundNote.hidden = !refundable;

    // 안내 문구
    if (next.length === 0 && !refundable) {
      actionHint.textContent =
        `이미 ${STATUS_KO[claim.status] || claim.status}된 클레임이라 추가로 진행할 처리가 없습니다.`;
    } else if (claim.status === "REQUESTED") {
      actionHint.textContent = "고객 요청을 검토한 뒤 승인 또는 반려하세요.";
    } else if (refundable) {
      actionHint.textContent =
        "환불(반품) 요청입니다. ‘환불 승인 · 완료’를 누르면 최종 환불 처리됩니다.";
    } else {
      actionHint.textContent = "다음 단계로 상태를 변경할 수 있습니다.";
    }
  }

  // ===== 상태 변경 (PUT) =====
  async function doStatusChange(statusEn) {
    if (!selected) return;

    const statusKo = STATUS_KO[statusEn] || statusEn;

    const reason = prompt(`처리 사유를 입력해 주세요. (${statusKo})`, "판매자 처리");
    if (reason === null) return; // 취소

    try {
      const res = await fetch(`${API}/seller/claims/${selected.claimId}/status`, {
        method: "PUT",
        headers: authHeaders(true),
        body: JSON.stringify({
          status: statusEn,
          reason: reason || "판매자 처리",
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "상태 변경 실패: " + res.status);
      }

      filterMessage.textContent =
        `${selected.claimId}번 클레임을 ${statusKo}(으)로 변경했습니다.`;
      loadClaims();
    } catch (err) {
      console.error(err);
      alert("상태 변경 실패: " + err.message);
    }
  }

  // ===== 환불(RETURN) 승인·완료 처리 =====
  // POST /api/v1/seller/refunds  { claimId, memo }
  // 백엔드가 클레임 완료, 배송상태 REFUNDED 전환, 포인트·쿠폰 복원(주문 전체 환불 시)을 수행한다.
  async function doRefund() {
    if (!selected) return;

    if (selected.claimType !== "RETURN") {
      alert("환불(반품) 요청 건에서만 환불 승인이 가능합니다.\n교환 건은 ‘교환 완료’로 처리해 주세요.");
      return;
    }
    // 백엔드는 ACCEPTED 또는 PROCESSING 상태에서만 환불을 허용한다.
    if (!["ACCEPTED", "PROCESSING"].includes(selected.status)) {
      alert("접수 또는 처리중 상태의 환불 건만 승인할 수 있습니다.");
      return;
    }

    const memo = prompt("환불 처리 메모를 입력해 주세요. (선택)", "");
    if (memo === null) return; // 취소

    if (!confirm(`${selected.claimId}번 클레임을 환불 승인 · 완료할까요?\n환불 금액: ${won(selected.claimAmount)}`)) {
      return;
    }

    try {
      const res = await fetch(`${API}/seller/refunds`, {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({
          claimId: selected.claimId,
          memo: memo || null,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "환불 처리 실패: " + res.status);
      }

      filterMessage.textContent =
        `${selected.claimId}번 클레임의 환불이 승인 · 완료되었습니다.`;
      loadClaims();
    } catch (err) {
      console.error(err);
      alert("환불 처리 실패: " + err.message);
    }
  }

  // ===== 필터 (조회 버튼) =====
  async function searchClaims() {
    const statusKo = statusFilter.value;
    const statusEn = statusKo === "all" ? "" : STATUS_EN[statusKo] || "";

    const count = await loadClaims(statusEn);
    if (count !== null) {
      filterMessage.textContent = `${count}건의 클레임을 조회했습니다.`;
    }
  }

  // ===== 버튼 연결 =====
  $("claimSearchButton").addEventListener("click", searchClaims);
  $("claimBackButton").addEventListener("click", showList);

  // ===== 시작 =====
  loadClaims();

});
