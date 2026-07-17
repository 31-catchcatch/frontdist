// seller-claims.js — 판매자 교환/환불 관리
// GET  /api/v1/seller/claims              (목록 조회, status/claimType 필터)
// PUT  /api/v1/seller/claims/{id}/status  (상태 변경: 접수/처리중/반려, 교환 완료)
// POST /api/v1/seller/refunds             (환불(RETURN) 최종 완료 처리 — S-CLAIM-003)
// 판매자 로그인 필요
//
// [수정 내역]
// 1) 백엔드 ClaimType 은 RETURN/EXCHANGE 인데 기존 TYPE_KO 가 REFUND 로 되어 있어
//    환불 건이 "RETURN" 으로 날것 표시되던 문제 수정
// 2) HTML 드롭다운(검토중/승인)과 JS 매핑(신청/처리중)이 어긋나
//    검토중·승인 선택 시 status=undefined 로 전송되어 400 나던 문제 수정
// 3) "완료"는 유형별로 분기: 환불(RETURN) → POST /seller/refunds,
//    교환(EXCHANGE) → PUT status=COMPLETED (백엔드도 함께 수정됨)
// 4) 현재 상태가 드롭다운에 없어 항상 "접수"로 보이던 문제 → 상세에 현재 상태 표시

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

  // 백엔드가 PUT /seller/claims/{id}/status 로 허용하는 전이가 이게 전부다.
  // (SellerClaimService.validateStatusChange 기준 — 상태뿐 아니라 "유형"까지 본다)
  //   신청  → 접수 / 반려      (교환·환불 공통)
  //   접수  → 처리중           (교환·환불 공통)
  //   처리중 → 완료            (교환 전용!)
  //
  // 환불(RETURN)의 완료는 이 API로 못 간다. 결제 취소·포인트 복원이 얽혀 있어
  // POST /seller/refunds 로만 처리된다. (switch 의 default 가 INVALID_CLAIM_STATUS)
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

  // 환불 완료 가능 조건 (SellerRefundService.validateRefundableClaim 기준)
  const canRefund = (claim) =>
    claim.claimType === "RETURN" &&
    ["ACCEPTED", "PROCESSING"].includes(claim.status);

  const $ = (id) => document.getElementById(id);
  const won = (n) => (n == null ? "-" : n.toLocaleString("ko-KR") + "원");

  const filterMessage = $("claimFilterMessage");
  const statusFilter = $("claimStatusFilter");
  const statusSelect = $("claimStatusSelect");
  const listView = $("claimList");
  const detailView = $("claimDetail");
  const filterBox = $("claimFilterBox");
  const statusSection = $("claimStatusSection");
  const refundSection = $("claimRefundSection");
  const noAction = $("claimNoAction");

  let claims = [];         // 전체 클레임
  let selected = null;     // 지금 선택된 클레임

  // ===== 화면 전환 (목록 ↔ 상세) =====
  // 목록에서 처리할 클레임을 골라 들어가면 상세 처리 화면으로 바뀐다.
  // 둘을 동시에 띄우지 않으므로 레이아웃은 1단(css .claim-dashboard-layout)이다.
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

  // 상태에 따른 뱃지 색 클래스
  const statusClass = (ko) =>
    ko === "완료" ? "done" : ko === "처리중" ? "wait" : "";

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

      // 목록을 새로 불러오면(최초 진입·조회·처리 후) 항상 목록 화면으로 돌아온다.
      // 예전에는 여기서 첫 건을 자동 선택해 상세가 곧바로 떴다.
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
      return `
        <tr class="claim-item" data-id="${c.claimId}">
          <td>${c.claimId}</td>
          <td>${c.productName}</td>
          <td>${typeKo}</td>
          <td><span class="status ${statusClass(statusKo)}">${statusKo}</span></td>
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

    // 상세 채우기
    $("claimId").textContent = selected.claimId;
    $("claimProduct").textContent = selected.productName;
    $("claimType").textContent = TYPE_KO[selected.claimType] || selected.claimType;
    $("claimReason").textContent = selected.reason || "-";
    $("claimAmount").textContent = won(selected.claimAmount);

    // 현재 상태 표시 (HTML에 claimStatus 요소가 있을 때)
    const statusEl = $("claimStatus");
    if (statusEl) statusEl.textContent = statusKo;

    // 최종 환불 안내의 금액도 선택된 건에 맞춘다 (예전에는 45,000원이 하드코딩돼 있었다)
    const refundEl = $("refundAmount");
    if (refundEl) refundEl.textContent = won(selected.claimAmount);

    renderActions(selected);

    showDetail();
  }

  // ===== 현재 상태에서 실제로 가능한 처리만 노출 =====
  // 예전에는 접수/처리중/반려/완료를 항상 띄우고 현재 상태를 그대로 선택해 뒀다.
  // 그래서 아무것도 안 바꾸고 [상태 변경]을 누르면 접수→접수 처럼 백엔드가 막는 전이가
  // 그대로 나가 "현재 상태에서는 클레임을 변경할 수 없습니다" 가 떴다.
  function renderActions(claim) {
    const next = nextStatuses(claim);
    const refundable = canRefund(claim);

    statusSelect.innerHTML = next
      .map((en) => `<option value="${en}">${STATUS_KO[en]}</option>`)
      .join("");

    statusSection.hidden = next.length === 0;
    refundSection.hidden = !refundable;

    // 상태 변경도 환불도 불가능한 경우엔 이유를 알려준다.
    // (지금은 반려·완료 같은 종료 상태에서만 여기 걸린다)
    if (next.length === 0 && !refundable) {
      noAction.hidden = false;
      noAction.textContent = `이미 ${STATUS_KO[claim.status] || claim.status}된 클레임이라 더 진행할 처리가 없습니다.`;
    } else {
      noAction.hidden = true;
    }
  }

  // ===== 상태 변경 (PUT) =====
  async function updateStatus() {
    if (!selected) {
      alert("클레임을 먼저 선택해 주세요.");
      return;
    }

    // 드롭다운 option 의 value 가 곧 백엔드 enum 이다. (renderActions 가 채운다)
    const statusEn = (statusSelect.value || "").trim();
    const statusKo = STATUS_KO[statusEn] || statusEn;

    if (!statusEn) {
      alert("변경할 상태를 선택해 주세요.");
      return;
    }

    const reason = prompt("처리 사유를 입력해 주세요.", "판매자 처리");
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

      filterMessage.textContent = `${selected.claimId}번 클레임 상태를 ${statusKo}(으)로 변경했습니다.`;

      // 목록 새로고침
      loadClaims();
    } catch (err) {
      console.error(err);
      alert("상태 변경 실패: " + err.message);
    }
  }

  // ===== 필터 (조회 버튼) =====
  // ※ 백엔드가 status/claimType 파라미터를 받으므로 서버 조회로 처리
  async function searchClaims() {
    const statusKo = statusFilter.value;
    const statusEn = statusKo === "all" ? "" : STATUS_EN[statusKo] || "";

    const count = await loadClaims(statusEn);
    if (count !== null) {
      filterMessage.textContent = `${count}건의 클레임을 조회했습니다.`;
    }
  }

  // ===== 환불(RETURN) 최종 완료 처리 =====
  // POST /api/v1/seller/refunds  { claimId, memo }
  // 백엔드가 PG 취소·포인트 회수(추후)와 클레임 완료, 배송상태 REFUNDED 전환을 수행한다.
  async function completeRefund() {
    if (!selected) {
      alert("클레임을 먼저 선택해 주세요.");
      return;
    }
    if (selected.claimType !== "RETURN") {
      alert("환불(반품) 요청 건에서만 최종 환불 처리를 할 수 있습니다.\n교환 건은 상태를 '완료'로 변경해 주세요.");
      return;
    }
    // 백엔드는 ACCEPTED 또는 PROCESSING 상태에서만 환불을 허용한다.
    if (!["ACCEPTED", "PROCESSING"].includes(selected.status)) {
      alert("접수 또는 처리중 상태의 환불 건만 완료 처리할 수 있습니다.");
      return;
    }

    const memo = prompt("환불 처리 메모를 입력해 주세요. (선택)", "");
    if (memo === null) return; // 취소

    if (!confirm(`${selected.claimId}번 클레임을 최종 환불 처리할까요?\n환불 금액: ${won(selected.claimAmount)}`)) {
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

      filterMessage.textContent = `${selected.claimId}번 클레임의 환불이 완료 처리되었습니다.`;
      loadClaims();
    } catch (err) {
      console.error(err);
      alert("환불 처리 실패: " + err.message);
    }
  }

  // ===== 버튼 연결 =====
  $("claimSearchButton").addEventListener("click", searchClaims);
  $("updateClaimStatusButton").addEventListener("click", updateStatus);
  $("completeRefundButton").addEventListener("click", completeRefund);
  $("claimBackButton").addEventListener("click", showList);

  // ===== 시작 =====
  loadClaims();

});
