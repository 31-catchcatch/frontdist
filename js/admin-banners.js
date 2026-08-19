(function () {
  "use strict";

  const API_BASE = (window.CATCHCATCH_API_BASE_URL || "/api/v1").replace(/\/$/, "");
  const API_ORIGIN = new URL(API_BASE, location.href).origin;
  const PROBE_TIMEOUT_MS = 4000;

  const STATE = {
    ok:   { cls: "ok",   label: "노출중" },
    wait: { cls: "wait", label: "예약" },
    stop: { cls: "stop", label: "중지" },
    done: { cls: "",     label: "종료" }
  };

  const rowsEl = document.getElementById("rows");
  const countEl = document.getElementById("count");
  const qEl = document.getElementById("q");
  const statusEl = document.getElementById("statusFilter");
  const tableEl = document.getElementById("bannerTable");
  const noticeEl = document.getElementById("apiNotice");
  const badgeEl = document.getElementById("apiBadge");
  const createBtn = document.getElementById("createBtn");
  const reloadBtn = document.getElementById("reloadBtn");

  let BANNERS = [];
  let CAN_WRITE = false;      // 관리자 배너 API 사용 가능 여부 (로드 시 1회 결정, 재탐지 안 함)
  let PROBE_STATUS = 0;
  let COLSPAN = 5;   // 읽기전용 기준. applyMode 에서 모드에 맞게 다시 잡는다

  const PLACEHOLDER = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="100" viewBox="0 0 240 100">' +
      '<rect width="240" height="100" fill="#f2f2f2"/>' +
      '<text x="120" y="56" text-anchor="middle" fill="#b0b0b0" font-family="sans-serif" font-size="13">이미지 없음</text>' +
    "</svg>");

  function resolveAssetUrl(value) {
    if (!value) return PLACEHOLDER;
    try {
      const resolved = new URL(value, API_ORIGIN + "/");
      return ["http:", "https:", "data:", "blob:"].includes(resolved.protocol)
        ? resolved.href
        : PLACEHOLDER;
    } catch (_) {
      return PLACEHOLDER;
    }
  }

  function resolveHttpUrl(value) {
    if (!value) return null;
    try {
      const resolved = new URL(value, API_ORIGIN + "/");
      return ["http:", "https:"].includes(resolved.protocol) ? resolved.href : null;
    } catch (_) {
      return null;
    }
  }

  /* 이미지 로드 실패 폴백. error 이벤트는 버블하지 않지만 캡처는 되므로
     리스너 하나로 innerHTML 재렌더를 넘어 계속 동작한다.
     dataset.fallback 은 플레이스홀더까지 실패했을 때의 무한 루프를 막는다. */
  function attachImageFallback(root) {
    root.addEventListener("error", (event) => {
      const img = event.target;
      if (!img || img.tagName !== "IMG" || img.dataset.fallback === "1") return;
      img.dataset.fallback = "1";
      img.src = PLACEHOLDER;
    }, true);
  }
  attachImageFallback(rowsEl);

  function localNowString() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
         + `T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }

  function stateOf(banner) {
    if (banner.active === false) return "stop";
    const now = localNowString();
    if (banner.startAt && String(banner.startAt).slice(0, 16) > now) return "wait";
    if (banner.endAt && String(banner.endAt).slice(0, 16) < now) return "done";
    return "ok";
  }

  function formatDate(value) {
    if (!value) return "";
    return String(value).replace("T", " ").slice(0, 10);
  }

  /* 날짜만 보여준다. 분 단위까지 넣으면 노출기간 열이 250px 을 넘겨
     표가 래퍼를 벗어나고 관리 버튼이 가로 스크롤 뒤로 밀린다.
     정확한 시각이 필요하면 [수정] 모달에서 확인한다. */
  function periodText(banner) {
    const from = formatDate(banner.startAt);
    const to = formatDate(banner.endAt);
    if (!from && !to) return "상시";
    return `${from || ""} ~ ${to || ""}`.trim();
  }

  async function probeAdminApi() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_BASE}/admin/banners?size=200&_=${Date.now()}`, {
        headers: Object.assign({ Accept: "application/json" }, AdminAuth.authorizationHeader()),
        signal: controller.signal
      });

      if (!response.ok) return { write: false, status: response.status };

      const payload = await response.json();              // JSON 이 아니면 catch 로 떨어진다
      const data = payload && payload.data;
      const items = Array.isArray(data)
        ? data
        : (data && Array.isArray(data.content) ? data.content : null);

      // 200 이지만 형태가 다르면(프록시가 가로챈 HTML 등) 없는 것으로 본다
      if (!payload || payload.success === false || items === null) {
        return { write: false, status: response.status };
      }
      return { write: true, status: response.status, items };
    } catch (_) {
      return { write: false, status: 0 };
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchPublicBanners() {
    let response;
    try {
      response = await fetch(`${API_BASE}/banners?_=${Date.now()}`, {
        headers: { Accept: "application/json" }
      });
    } catch (_) {
      // 네트워크 실패는 브라우저가 "Failed to fetch" 를 던진다. 그대로 두면 화면에 영문 원문이 뜬다.
      throw new Error("서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch (_) {
      payload = null;
    }

    if (!response.ok || (payload && payload.success === false)) {
      throw new Error((payload && payload.message) || "배너 목록을 불러오지 못했습니다.");
    }
    return Array.isArray(payload && payload.data) ? payload.data : [];
  }

  function mapRow(b) {
    return {
      id: b.id ?? b.bannerId,
      title: b.title ?? "",
      imageUrl: b.imageUrl ?? "",
      linkUrl: b.linkUrl ?? "",
      sortOrder: Number(b.sortOrder ?? 0),
      active: typeof b.active === "boolean" ? b.active : undefined,
      startAt: b.startAt ?? "",
      endAt: b.endAt ?? ""
    };
  }

  /* ---------------------------------------------------------
     모드 적용
     --------------------------------------------------------- */
  function applyMode() {
    tableEl.classList.toggle("mode-admin", CAN_WRITE);
    // 읽기전용은 관리 열에 [상세] 하나뿐이라 기본 236px(버튼 2~3개용)이 과하다
    tableEl.classList.toggle("act-slim", !CAN_WRITE);
    COLSPAN = CAN_WRITE ? 7 : 5;

    statusEl.hidden = !CAN_WRITE;
    createBtn.disabled = !CAN_WRITE;

    if (CAN_WRITE) {
      createBtn.removeAttribute("aria-disabled");
      createBtn.removeAttribute("title");
      badgeEl.textContent = "실시간 데이터 · /api/v1/admin/banners";
      noticeEl.hidden = true;
      return;
    }

    createBtn.setAttribute("aria-disabled", "true");
    createBtn.title = "지금은 배너를 조회만 할 수 있습니다.";
    badgeEl.textContent = "공개 API · GET /api/v1/banners";

    /* 안내는 두 줄로 끝낸다. 관리자에게 필요한 건 "지금 뭘 할 수 있나"와
       "이 목록이 전부가 아니다" 두 가지뿐이고, 원인별 한 줄만 상황에 따라 덧붙인다.
       엔드포인트 경로 같은 내부 정보는 화면에 노출하지 않는다. */
    const cause =
      (PROBE_STATUS === 401 || PROBE_STATUS === 403)
        ? " 로그아웃 후 다시 로그인해 보세요."
        : (PROBE_STATUS === 0 ? " 서버에 연결하지 못했습니다." : "");

    noticeEl.innerHTML = `
      <strong>지금은 조회만 가능합니다</strong>
      <p>노출 중인 배너만 보이며, 중지·기간만료 배너는 표시되지 않습니다.${esc(cause)}</p>`;
    noticeEl.hidden = false;
  }

  /* ---------------------------------------------------------
     목록 렌더
     --------------------------------------------------------- */
  /* ---------------------------------------------------------
     노출 순서 변경

     정렬 기준은 sortOrder 오름차순 + 동순위는 id 오름차순 — 백엔드 쿼리와 같은 규칙이라
     화면 순서가 쇼핑몰 슬라이더 순서와 항상 일치한다.

     저장은 PATCH /admin/banners/order 하나로 "전체 목록"을 0..n-1 로 정규화해 보낸다.
     - 개별 PUT 두 번으로 자리를 바꾸면 중간에 실패했을 때 두 배너가 같은 sortOrder 를
       갖고 조용히 깨진다. 배치 엔드포인트는 한 트랜잭션이라 부분 반영이 없다.
     - 전체를 다시 매기므로 기존에 중복돼 있던 sortOrder 도 함께 정리된다.
     --------------------------------------------------------- */
  let canReorder = false;   // 관리자 모드 + 필터 없음일 때만 true

  function orderedBanners() {
    return [...BANNERS].sort((a, b) => (a.sortOrder - b.sortOrder) || (a.id - b.id));
  }

  function orderIndexOf(id) {
    return orderedBanners().findIndex((b) => String(b.id) === String(id));
  }

  async function moveBanner(id, delta) {
    const ordered = orderedBanners();
    const from = ordered.findIndex((b) => String(b.id) === String(id));
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ordered.length) return;

    const moved = ordered.slice();
    [moved[from], moved[to]] = [moved[to], moved[from]];

    const items = moved.map((b, index) => ({ id: b.id, sortOrder: index + 1 }));   // 순서는 1부터

    try {
      // 서버가 갱신된 전체 목록을 돌려주므로 그것을 정본으로 삼는다
      const data = await AdminApi.patch("/banners/order", { items });
      BANNERS = (Array.isArray(data) ? data : []).map(mapRow);
      applyFilter();
      AdminUI.toast("노출 순서가 변경되었습니다.");
    } catch (err) {
      AdminUI.toast(err.message || "순서 변경에 실패했습니다.");
    }
  }

  function render(list, total = list.length) {
    if (!list.length) {
      rowsEl.innerHTML = `<tr class="empty-row"><td colspan="${COLSPAN}">조건에 맞는 배너가 없습니다.</td></tr>`;
      countEl.textContent = 0;
      return;
    }

    rowsEl.innerHTML = list.map((b) => {
      const state = STATE[stateOf(b)];
      const imageSrc = resolveAssetUrl(b.imageUrl);
      const imageHref = resolveHttpUrl(b.imageUrl);
      const linkHref = resolveHttpUrl(b.linkUrl);

      // alt 는 비운다 — 바로 옆 배너명 셀이 접근성 이름 역할을 하므로 중복 낭독을 피한다
      const thumb = `<img class="bn-thumb" src="${esc(imageSrc)}" alt="" loading="lazy">`;

      // 순서 변경은 "전체 순서" 기준이라, 검색·상태 필터가 걸려 있으면 화면에 보이는 위/아래 행이
      // 실제 이웃이 아니다. 그때는 버튼을 숨겨 엉뚱한 배너와 자리를 바꾸는 일을 막는다.
      const pos = orderIndexOf(b.id);
      const reorder = canReorder
        ? `<span class="order-btns">
             <button type="button" class="btn sm ghost" data-act="up" aria-label="위로" ${pos <= 0 ? "disabled" : ""}>▲</button>
             <button type="button" class="btn sm ghost" data-act="down" aria-label="아래로" ${pos < 0 || pos >= BANNERS.length - 1 ? "disabled" : ""}>▼</button>
           </span>`
        : "";

      // 노출 순번은 저장된 sort_order 값이 아니라 전체 정렬에서의 자리로 그린다.
      // 과거 데이터에 0 이나 중복이 남아 있어도 화면에는 1..n 으로 보인다.
      const orderLabel = pos >= 0 ? String(pos + 1) : "-";

      return `
      <tr data-id="${b.id}">
        <td class="num order-cell">
          <span class="order-value">${esc(orderLabel)}</span>${reorder}
        </td>
        <td class="bn-thumb-cell">${
          imageHref
            ? `<a class="bn-thumb-link" href="${esc(imageHref)}" target="_blank" rel="noopener">${thumb}</a>`
            : thumb
        }</td>
        <td class="strong">${esc(b.title)}</td>
        <td class="muted bn-link-cell">${
          linkHref
            ? `<a class="product-link" href="${esc(linkHref)}" target="_blank" rel="noopener">${esc(b.linkUrl)}</a>`
            : (b.linkUrl
                ? `<span title="열 수 없는 주소입니다">${esc(b.linkUrl)}</span>`
                : '<span title="빈 값이면 쇼핑몰에서 상품 목록으로 이동합니다">없음</span>')
        }</td>
        <td class="col-admin-only"><span class="tag ${state.cls}">${state.label}</span></td>
        <td class="col-admin-only muted">${esc(periodText(b))}</td>
        <td>
          <div class="row-actions">${CAN_WRITE ? `
            <button type="button" class="btn sm" data-act="edit">수정</button>
            <button type="button" class="btn sm danger" data-act="delete">삭제</button>` : `
            <!-- 폴백(읽기전용) 전용. 관리자 모드에서는 [수정] 모달이 같은 값을 편집 가능한 형태로
                 다 보여주므로 상세는 중복이다. 여기서는 관리 열이 빈 칸이 되지 않게 하는 역할. -->
            <button type="button" class="btn sm" data-act="detail">상세</button>`}
          </div>
        </td>
      </tr>`;
    }).join("");

    countEl.textContent = total;
  }

  const listController = AdminUI.createListController({ pager: document.querySelector(".pager"), render });

  function applyFilter() {
    const q = qEl.value.trim().toLowerCase();
    const status = CAN_WRITE && statusEl ? statusEl.value : "";

    // 필터가 걸리면 화면의 위/아래 행이 전체 순서상의 이웃이 아니게 되므로 순서 버튼을 감춘다
    canReorder = CAN_WRITE && !q && !status;

    listController.setItems(BANNERS.filter((b) => {
      if (status && stateOf(b) !== status) return false;
      if (!q) return true;
      return String(b.title).toLowerCase().includes(q)
          || String(b.linkUrl).toLowerCase().includes(q);
    }));
  }

  qEl.addEventListener("input", applyFilter);
  statusEl.addEventListener("change", applyFilter);

  /* ---------------------------------------------------------
     등록/수정 모달

     AdminUI.form 은 new FormData(form) 을 평범한 객체로 옮겨 담아서 File 을 다룰 수 없고,
     체크박스가 미체크면 키 자체가 사라지며, 필드별 검증 훅도 없다. 그래서 전용 모달을 쓴다.
     (.modal-backdrop / .modal / .field / .modal-actions 는 admin.css 것을 그대로 재사용)
     --------------------------------------------------------- */
  function openBannerModal(banner) {
    const isEdit = Boolean(banner);
    // 신규 배너는 맨 뒤에 붙인다. 순서는 1부터이므로 배너가 없으면 1.
    const nextOrder = BANNERS.length
      ? Math.max(...BANNERS.map((b) => Number(b.sortOrder) || 0)) + 1
      : 1;

    const value = {
      title: isEdit ? banner.title : "",
      imageUrl: isEdit ? banner.imageUrl : "",
      linkUrl: isEdit ? banner.linkUrl : "",
      sortOrder: isEdit ? banner.sortOrder : nextOrder,
      active: isEdit ? banner.active !== false : true,
      startAt: isEdit ? String(banner.startAt || "").slice(0, 16) : "",
      endAt: isEdit ? String(banner.endAt || "").slice(0, 16) : ""
    };

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop open";
    backdrop.innerHTML = `
      <div class="modal banner-modal" role="dialog" aria-modal="true" aria-label="${isEdit ? "배너 수정" : "배너 등록"}">
        <h3>${isEdit ? "배너 수정" : "배너 등록"}</h3>
        <form novalidate>
          <div class="field">
            <label for="bnTitle">배너명 <span aria-hidden="true">*</span></label>
            <input id="bnTitle" name="title" type="text" maxlength="100" value="${esc(value.title)}" placeholder="예) 여름 시즌 프로모션">
            <p class="field-error" data-error-for="title" hidden></p>
          </div>

          <div class="field">
            <label for="bnImageUrl">이미지 <span aria-hidden="true">*</span></label>
            <div class="bn-file-row">
              <input id="bnFile" type="file" accept="image/*">
            </div>
            <input id="bnImageUrl" name="imageUrl" type="text" maxlength="512" value="${esc(value.imageUrl)}" placeholder="/uploads/... 또는 https://...">
            <p class="field-error" data-error-for="imageUrl" hidden></p>
            <div class="bn-preview"><img id="bnPreview" src="${esc(resolveAssetUrl(value.imageUrl))}" alt="배너 이미지 미리보기"></div>
          </div>

          <div class="field">
            <label for="bnLinkUrl">연결 링크</label>
            <input id="bnLinkUrl" name="linkUrl" type="text" maxlength="512" value="${esc(value.linkUrl)}" placeholder="비우면 상품 목록으로 이동합니다">
            <p class="field-error" data-error-for="linkUrl" hidden></p>
          </div>

          <div class="field-row">
            <div class="field">
              <label for="bnSortOrder">노출 순서</label>
              <input id="bnSortOrder" name="sortOrder" type="number" step="1" min="1" value="${esc(String(value.sortOrder))}">
              <p class="field-error" data-error-for="sortOrder" hidden></p>
            </div>
            <div class="check-field">
              <input id="bnActive" type="checkbox"${value.active ? " checked" : ""}>
              <label for="bnActive">노출 사용</label>
            </div>
          </div>

          <div class="field-row">
            <div class="field">
              <label for="bnStartAt">노출 시작</label>
              <input id="bnStartAt" name="startAt" type="datetime-local" value="${esc(value.startAt)}">
            </div>
            <div class="field">
              <label for="bnEndAt">노출 종료</label>
              <input id="bnEndAt" name="endAt" type="datetime-local" value="${esc(value.endAt)}">
              <p class="field-error" data-error-for="endAt" hidden></p>
            </div>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn" data-cancel>취소</button>
            <button type="submit" class="btn primary" data-submit>${isEdit ? "수정 저장" : "등록"}</button>
          </div>
        </form>
      </div>`;

    document.body.appendChild(backdrop);
    attachImageFallback(backdrop);

    const form = backdrop.querySelector("form");
    const fileEl = backdrop.querySelector("#bnFile");
    const previewEl = backdrop.querySelector("#bnPreview");
    const submitBtn = backdrop.querySelector("[data-submit]");
    const field = (name) => backdrop.querySelector(`#bn${name[0].toUpperCase()}${name.slice(1)}`);

    let pendingFile = null;      // 저장할 때 업로드한다 (아래 주석 참고)
    let previewObjectUrl = null;

    function close() {
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
      backdrop.remove();
    }

    function showError(name, message) {
      const el = backdrop.querySelector(`[data-error-for="${name}"]`);
      if (!el) return;
      el.textContent = message;
      el.hidden = false;
    }

    function clearErrors() {
      backdrop.querySelectorAll(".field-error").forEach((el) => { el.hidden = true; });
    }

    fileEl.addEventListener("change", () => {
      clearErrors();
      const file = fileEl.files && fileEl.files[0];
      if (!file) { pendingFile = null; return; }

      if (!String(file.type).startsWith("image/")) {
        showError("imageUrl", "이미지 파일만 올릴 수 있습니다.");
        fileEl.value = "";
        pendingFile = null;
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        showError("imageUrl", "이미지 크기는 20MB 이하만 가능합니다.");
        fileEl.value = "";
        pendingFile = null;
        return;
      }

      pendingFile = file;
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = URL.createObjectURL(file);
      previewEl.dataset.fallback = "";
      previewEl.src = previewObjectUrl;
    });

    field("imageUrl").addEventListener("input", () => {
      if (pendingFile) return;                    // 파일 선택이 우선이다
      previewEl.dataset.fallback = "";
      previewEl.src = resolveAssetUrl(field("imageUrl").value.trim());
    });

    backdrop.querySelector("[data-cancel]").addEventListener("click", close);
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearErrors();

      const title = field("title").value.trim();
      const linkUrl = field("linkUrl").value.trim();
      const sortOrderRaw = field("sortOrder").value.trim();
      const startAt = field("startAt").value;
      const endAt = field("endAt").value;
      const active = backdrop.querySelector("#bnActive").checked;
      let imageUrl = field("imageUrl").value.trim();

      if (!title) { showError("title", "배너명을 입력해 주세요."); field("title").focus(); return; }
      if (title.length > 100) { showError("title", "배너명은 100자 이하여야 합니다."); field("title").focus(); return; }

      if (!pendingFile && !imageUrl) {
        showError("imageUrl", "이미지를 올리거나 이미지 주소를 입력해 주세요.");
        fileEl.focus();
        return;
      }
      if (!pendingFile && imageUrl.length > 512) {
        showError("imageUrl", "이미지 주소는 512자 이하여야 합니다.");
        field("imageUrl").focus();
        return;
      }

      if (linkUrl) {
        if (linkUrl.length > 512) {
          showError("linkUrl", "연결 링크는 512자 이하여야 합니다.");
          field("linkUrl").focus();
          return;
        }
        if (!resolveHttpUrl(linkUrl)) {
          showError("linkUrl", "http:// 또는 https:// 로 열 수 있는 주소만 입력할 수 있습니다.");
          field("linkUrl").focus();
          return;
        }
      }

      const sortOrder = Number(sortOrderRaw);
      if (sortOrderRaw === "" || !Number.isInteger(sortOrder) || sortOrder < 1) {
        showError("sortOrder", "노출 순서는 1 이상의 정수여야 합니다.");
        field("sortOrder").focus();
        return;
      }

      if (startAt && endAt && startAt >= endAt) {
        showError("endAt", "노출 종료는 시작보다 이후여야 합니다.");
        field("endAt").focus();
        return;
      }

      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;

      try {
        if (pendingFile) {
          submitBtn.textContent = "이미지 업로드 중...";
          imageUrl = await uploadImage(pendingFile);
          if (imageUrl.length > 512) {
            throw new Error("업로드된 이미지 주소가 너무 깁니다. (512자 초과)");
          }
        }

        submitBtn.textContent = "저장 중...";
        const body = {
          title,
          imageUrl,
          linkUrl: linkUrl || null,
          sortOrder,
          active,
          startAt: startAt || null,
          endAt: endAt || null
        };

        if (isEdit) await AdminApi.put(`/banners/${banner.id}`, body);
        else await AdminApi.post("/banners", body);

        close();
        AdminUI.toast(isEdit ? "배너가 수정되었습니다." : "배너가 등록되었습니다.");
        await load();
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        AdminUI.toast(err.message || "저장에 실패했습니다.");
      }
    });

    field("title").focus();
  }

  async function uploadImage(file) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE}/files/upload`, {
      method: "POST",
      headers: AdminAuth.authorizationHeader(), // Content-Type 을 직접 넣으면 boundary 가 빠져 서버가 빈 본문을 받는다
      body: formData
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch (_) {
      payload = null;
    }

    const fileUrl = payload && payload.data && payload.data.fileUrl;
    if (!response.ok || !fileUrl) {
      throw new Error((payload && payload.message) || "이미지 업로드에 실패했습니다.");
    }
    return String(fileUrl);
  }

  /* ---------------------------------------------------------
     행 액션
     --------------------------------------------------------- */
  rowsEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;

    const id = btn.closest("tr").dataset.id;
    const banner = BANNERS.find((b) => String(b.id) === String(id));
    if (!banner) return;

    if (btn.dataset.act === "up" || btn.dataset.act === "down") {
      btn.disabled = true;                                   // 연타로 두 번 보내지 않게
      await moveBanner(id, btn.dataset.act === "up" ? -1 : 1);
      return;
    }

    // 폴백(읽기전용)에서만 그려지는 버튼이다. 노출 상태·기간은 넣지 않는다 —
    // 공개 API 가 active/startAt/endAt 을 주지 않아 그 모드에서는 값을 알 수 없다.
    if (btn.dataset.act === "detail") {
      AdminUI.detail("배너 상세", [
        ["배너 ID", banner.id],
        ["배너명", banner.title],
        ["노출 순서", banner.sortOrder],
        ["이미지 주소", banner.imageUrl || "(없음)"],
        ["연결 링크", banner.linkUrl || "(없음 · 상품 목록으로 이동)"]
      ]);
      return;
    }

    if (btn.dataset.act === "edit") {
      openBannerModal(banner);
      return;
    }

    if (btn.dataset.act === "delete") {
      const confirmed = await AdminUI.confirm({
        title: "배너 삭제",
        message: `[${banner.title}] 배너를 삭제합니다. 삭제한 배너는 복구할 수 없습니다.`,
        okText: "삭제",
        danger: true
      });
      if (!confirmed) return;

      try {
        await AdminApi.del(`/banners/${banner.id}`);
        AdminUI.toast("배너가 삭제되었습니다.");
        await load();
      } catch (err) {
        AdminUI.toast(err.message || "배너 삭제에 실패했습니다.");
      }
    }
  });

  createBtn.addEventListener("click", () => {
    if (!CAN_WRITE) return;
    openBannerModal(null);
  });

  reloadBtn.addEventListener("click", () => { load(); });

  async function load() {
    try {
      const data = CAN_WRITE ? await fetchAdminBanners() : await fetchPublicBanners();
      BANNERS = data.map(mapRow).sort((a, b) => a.sortOrder - b.sortOrder);
      applyFilter();
    } catch (err) {
      rowsEl.innerHTML = `<tr class="empty-row"><td colspan="${COLSPAN}">${esc(err.message || "목록을 불러오지 못했습니다.")}</td></tr>`;
      countEl.textContent = 0;
    }
  }

  async function fetchAdminBanners() {
    return AdminApi.list(`/banners?size=200&_=${Date.now()}`);
  }

  async function boot() {
    // HTML 의 정적 페이저 버튼 3개는 첫 setItems 가 덮어쓴다.
    // probe 가 실패로 빠져도 가짜 버튼이 남지 않도록 await 전에 한 번 초기화한다.
    listController.setItems([]);

    const probe = await probeAdminApi();
    CAN_WRITE = probe.write;
    PROBE_STATUS = probe.status;
    applyMode();

    if (CAN_WRITE) {
      // probe 응답을 그대로 목록으로 쓴다 (같은 요청을 두 번 보내지 않는다)
      BANNERS = probe.items.map(mapRow).sort((a, b) => a.sortOrder - b.sortOrder);
      applyFilter();
      return;
    }
    await load();
  }

  boot();
})();
