// seller-claims.js — 판매자 교환/환불 관리
// GET  /api/v1/seller/claims              (목록 조회)
// PUT  /api/v1/seller/claims/{id}/status  (상태 변경)
// 판매자 로그인 필요

document.addEventListener("DOMContentLoaded", () => {

  const API = "http://localhost:8080/api/v1";

  // ===== 영어 ↔ 한글 변환표 =====
  const STATUS_KO = {
    REQUESTED: "신청",
    ACCEPTED: "접수",
    REJECTED: "반려",
    PROCESSING: "처리중",
    COMPLETED: "완료",
  };
  const TYPE_KO = {
    EXCHANGE: "교환",
    REFUND: "환불",
  };
  // 화면 → 백엔드 (상태 변경 보낼 때)
  const STATUS_EN = {
    "신청": "REQUESTED",
    "접수": "ACCEPTED",
    "반려": "REJECTED",
    "처리중": "PROCESSING",
    "완료": "COMPLETED",
  };

  const $ = (id) => document.getElementById(id);
  const won = (n) => (n == null ? "-" : n.toLocaleString("ko-KR") + "원");

  const filterMessage = $("claimFilterMessage");
  const statusFilter = $("claimStatusFilter");
  const statusSelect = $("claimStatusSelect");

  let claims = [];         // 전체 클레임
  let selected = null;     // 지금 선택된 클레임

  // 상태에 따른 뱃지 색 클래스
  const statusClass = (ko) =>
    ko === "완료" ? "done" : ko === "처리중" ? "wait" : "";

  // ===== 토큰 꺼내기 =====
  function getToken() {
    return localStorage.getItem("catchcatch.accessToken");
  }

  // ===== 목록 조회 (GET) =====
  async function loadClaims() {
    try {
      const res = await fetch(`${API}/seller/claims`, {
        method: "GET",
        headers: { "Authorization": "Bearer " + getToken() },
      });

      if (!res.ok) throw new Error("클레임 조회 실패: " + res.status);

      const json = await res.json();
      claims = json.data.content;   // 페이지 응답의 content

      console.log("받은 클레임:", claims);

      renderList();

      // 첫 번째 자동 선택
      if (claims.length > 0) {
        selectClaim(claims[0].claimId);
      }
    } catch (err) {
      console.error(err);
      filterMessage.textContent = "클레임을 불러오지 못했습니다: " + err.message;
    }
  }

  // ===== 목록 표 그리기 =====
  function renderList() {
    const tbody = document.querySelector(".claim-list tbody");

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

    // 상세 채우기
    $("claimId").textContent = selected.claimId;
    $("claimProduct").textContent = selected.productName;
    $("claimType").textContent = TYPE_KO[selected.claimType] || selected.claimType;
    $("claimReason").textContent = selected.reason || "-";
    $("claimAmount").textContent = won(selected.claimAmount);

    // 상태 드롭다운 맞추기
    const statusKo = STATUS_KO[selected.status] || selected.status;
    statusSelect.value = statusKo;
  }

  // ===== 상태 변경 (PUT) =====
  async function updateStatus() {
    if (!selected) {
      alert("클레임을 먼저 선택해 주세요.");
      return;
    }

    const statusKo = statusSelect.value;
    const statusEn = STATUS_EN[statusKo];

    try {
      const res = await fetch(`${API}/seller/claims/${selected.claimId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + getToken(),
        },
        body: JSON.stringify({
          status: statusEn,
          reason: "판매자 처리",   // 처리 사유 (필요시 입력받게 개선)
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "상태 변경 실패: " + res.status);
      }

      filterMessage.textContent = `${selected.claimId} 상태를 ${statusKo}(으)로 변경했습니다.`;

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

    try {
      const url = statusEn
        ? `${API}/seller/claims?status=${statusEn}`
        : `${API}/seller/claims`;

      const res = await fetch(url, {
        method: "GET",
        headers: { "Authorization": "Bearer " + getToken() },
      });

      if (!res.ok) throw new Error("조회 실패: " + res.status);

      const json = await res.json();
      claims = json.data.content;

      renderList();
      filterMessage.textContent = `${claims.length}건의 클레임을 조회했습니다.`;

      if (claims.length > 0) selectClaim(claims[0].claimId);
    } catch (err) {
      console.error(err);
      filterMessage.textContent = "조회 실패: " + err.message;
    }
  }

  // ===== 최종 환불 처리 =====
  // ※ 별도 API(POST /seller/refunds)가 있으면 그걸로 교체
  async function completeRefund() {
    if (!selected) {
      alert("클레임을 먼저 선택해 주세요.");
      return;
    }
    if (TYPE_KO[selected.claimType] !== "환불") {
      alert("환불 요청 건에서만 최종 환불 처리를 할 수 있습니다.");
      return;
    }

    // TODO: POST /api/v1/seller/refunds 연동 (별도 API)
    //   지금은 상태를 COMPLETED로 변경하는 것으로 대체
    statusSelect.value = "완료";
    updateStatus();
  }

  // ===== 버튼 연결 =====
  $("claimSearchButton").addEventListener("click", searchClaims);
  $("updateClaimStatusButton").addEventListener("click", updateStatus);
  $("completeRefundButton").addEventListener("click", completeRefund);

  // ===== 시작 =====
  loadClaims();

});