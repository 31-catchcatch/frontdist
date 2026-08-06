(() => {
  "use strict";

  // BASE 는 auth.js(이 페이지에서 먼저 로드됨)가 전역에 넣어둔 단일 값을 사용. 안전망으로 /api/v1.
  const API_BASE = (window.CATCHCATCH_API_BASE_URL || "/api/v1").replace(/\/$/, "");
  const API_URL = `${API_BASE}/seller/products`;
  const PAGE_SIZE = 10;   // 화면에 한 번에 보여줄 개수 (페이징은 클라이언트에서)
  const API_PAGE_SIZE = 100; // 새 백엔드 SellerProductService의 최대 허용 크기
  const MAX_API_PAGES = 50; // 한 번의 화면 로드에서 최대 5,000개까지 조회
  const FILE_PREVIEW_MODE = location.protocol === "file:";

  const STATUS_META = Object.freeze({
    all: { label: "전체 상품", apiFilter: "ALL" },
    selling: { label: "판매중", badgeClass: "status-selling", apiFilter: "ON_SALE" },
    stopped: { label: "판매정지", badgeClass: "status-stopped", apiFilter: "SUSPENDED" },
    soldout: { label: "품절", badgeClass: "status-sold-out", apiFilter: "SOLD_OUT" },
    unknown: { label: "상태 미확인", badgeClass: "status-unknown" }
  });

  // 정규화된 상태 토큰 → 백엔드 ProductStatus 토큰 (수정 폼에 현재 상태를 전달하기 위함).
  // 상세 조회 API가 status 를 돌려주지 않으므로 목록에서 알고 있는 상태를 URL 로 넘긴다.
  const STATUS_TO_BACKEND = Object.freeze({
    selling: "ON_SALE",
    stopped: "SUSPENDED",
    soldout: "SOLD_OUT"
  });

  function editHref(product) {
    const backendStatus = STATUS_TO_BACKEND[product.status];
    const statusQuery = backendStatus ? `&status=${backendStatus}` : "";
    return `seller-product-form.html?id=${encodeURIComponent(product.productId)}${statusQuery}`;
  }

  const tableBody = document.getElementById("productTableBody");
  const mobileList = document.getElementById("mobileProductList");
  const pagination = document.getElementById("pagination");
  const searchForm = document.getElementById("productSearchForm");
  const keywordInput = document.getElementById("productKeyword");
  const pageMessage = document.getElementById("pageMessage");
  const statusButtons = Array.from(document.querySelectorAll("[data-status-filter]"));
  const statusApiNote = document.getElementById("statusApiNote");
  const statusListTitle = document.getElementById("statusListTitle");
  const statusResultCount = document.getElementById("statusResultCount");

  const deleteModal = document.getElementById("deleteModal");
  const deleteProductName = document.getElementById("deleteProductName");
  const deleteCancelButton = document.getElementById("deleteCancelButton");
  const deleteConfirmButton = document.getElementById("deleteConfirmButton");

  const totalCount = document.getElementById("totalCount");
  const sellingCount = document.getElementById("sellingCount");
  const stoppedCount = document.getElementById("stoppedCount");
  const soldOutCount = document.getElementById("soldOutCount");

  let currentPage = 0;
  let totalPages = 1;
  let loadRequestId = 0;
  let selectedProduct = null;
  let allProducts = [];      // 현재 선택한 서버 상태 필터의 전체 결과
  let filteredProducts = []; // 상태와 검색어로 거른 결과
  const requestedStatus = new URLSearchParams(location.search).get("status");
  let activeStatus = STATUS_META[requestedStatus] && requestedStatus !== "unknown"
    ? requestedStatus
    : "all";

  // 🔧 토큰 꺼내기
  function getToken() {
    return window.CatchAuth?.getToken?.() ||
      sessionStorage.getItem("catchcatch.accessToken") ||
      localStorage.getItem("catchcatch.accessToken");
  }

  // 🔧 로그인 체크: 토큰만 있으면 통과 (loginType 요구 안 함)
  function isLoggedIn() {
    return Boolean(getToken());
  }

  function moveToSellerLogin() {
    location.replace(
      `login.html?type=seller&redirect=${encodeURIComponent("seller-products.html")}`
    );
  }

  function clearLoginState() {
    sessionStorage.removeItem("catchcatch.loggedIn");
    sessionStorage.removeItem("catchcatch.loginType");
    sessionStorage.removeItem("catchcatch.accessToken");
    localStorage.removeItem("catchcatch.accessToken");
  }

  if (!FILE_PREVIEW_MODE && !isLoggedIn()) {
    moveToSellerLogin();
    return;
  }

  function handleUnauthorized(response) {
    if (response.status !== 401 && response.status !== 403) {
      return false;
    }
    clearLoginState();
    moveToSellerLogin();
    return true;
  }

  function showMessage(message, type = "error") {
    pageMessage.textContent = message;
    pageMessage.classList.add("show");
    pageMessage.classList.toggle("success", type === "success");
  }

  function clearMessage() {
    pageMessage.textContent = "";
    pageMessage.classList.remove("show", "success");
  }

  function formatPrice(value) {
    const price = Number(value);
    return Number.isFinite(price) ? `${price.toLocaleString("ko-KR")}원` : "-";
  }

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric", month: "2-digit", day: "2-digit"
    }).format(date);
  }

  function normalizeStatusToken(value) {
    return String(value ?? "")
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, "_");
  }

  function normalizeProductStatus(raw) {
    const token = normalizeStatusToken(
      raw.salesStatus ?? raw.saleStatus ?? raw.productStatus ?? raw.status
    );

    // 백엔드 SOLD_OUT 필터는 ON_SALE 상품에만 적용되므로 판매정지가 우선한다.
    if (["STOPPED", "STOP", "SUSPENDED", "PAUSED", "INACTIVE", "SALE_STOPPED", "SALES_STOPPED", "판매정지", "판매_정지", "판매중지"].includes(token)) {
      return "stopped";
    }
    if (raw.soldOut === true) return "soldout";
    if (["SOLD_OUT", "SOLDOUT", "OUT_OF_STOCK", "품절"].includes(token)) {
      return "soldout";
    }
    if (["SELLING", "ON_SALE", "ONSALE", "ACTIVE", "AVAILABLE", "SALE", "판매중", "판매_중"].includes(token)) {
      return "selling";
    }

    // soldOut 필드가 없는 구형 응답에만 재고 기반 추론을 적용한다.
    const stock = raw.totalStock ?? raw.availableStock ?? raw.stockQuantity ?? raw.stock;
    if (raw.soldOut === undefined && stock !== null && stock !== undefined && stock !== "" && Number(stock) === 0) {
      return "soldout";
    }
    return "unknown";
  }

  function normalizeProduct(raw) {
    return {
      productId: raw.productId ?? raw.id ?? raw.productNo ?? "",
      productName: raw.productName ?? raw.name ?? "상품명 없음",
      brandName: raw.brandName ?? raw.categoryName ?? raw.brand?.name ?? "",
      imageUrl: raw.thumbnailUrl ?? raw.imageUrl ?? raw.mainImageUrl ?? raw.images?.[0]?.url ?? "",
      price: raw.finalPrice ?? raw.salePrice ?? raw.discountPrice ?? raw.price ?? 0,
      status: normalizeProductStatus(raw),
      createdAt: raw.createdAt ?? raw.registeredAt ?? raw.createdDate ?? ""
    };
  }

  function statusBadge(product) {
    const meta = STATUS_META[product.status] ?? STATUS_META.unknown;
    return `<span class="status-badge ${meta.badgeClass}">${meta.label}</span>`;
  }

  function extractPageData(data) {
    const body = data?.data ?? data ?? {};
    const rawItems =
      body.products ?? body.content ?? body.items ?? body.list ??
      (Array.isArray(body) ? body : []);
    const products = Array.isArray(rawItems) ? rawItems.map(normalizeProduct) : [];
    return {
      products,
      totalElements: Number(body.totalElements ?? body.totalCount ?? products.length),
      totalPages: Number(body.totalPages ?? 1),
      page: Number(body.number ?? body.page ?? currentPage),
      counts: body.counts ? {
        total: Number(body.counts.total ?? 0),
        selling: Number(body.counts.onSale ?? 0),
        stopped: Number(body.counts.suspended ?? 0),
        soldout: Number(body.counts.soldOut ?? 0)
      } : null
    };
  }


  function renderDesktop(products) {
    if (!products.length) {
      const label = STATUS_META[activeStatus]?.label ?? STATUS_META.all.label;
      tableBody.innerHTML = `<tr><td class="state-cell" colspan="6">${label}에 해당하는 상품이 없습니다.</td></tr>`;
      return;
    }
    tableBody.innerHTML = products.map((product) => `
      <tr>
        <td>
          <div class="product-info">
            <a class="product-thumb-link" href="product-detail.html?id=${encodeURIComponent(product.productId)}">
              ${product.imageUrl
                ? `<img class="product-thumb" src="${product.imageUrl}" alt="">`
                : `<div class="product-thumb" aria-hidden="true"></div>`}
            </a>
            <div class="product-copy">
              <a class="product-name-link" href="product-detail.html?id=${encodeURIComponent(product.productId)}">
                <strong title="${product.productName}">${product.productName}</strong>
              </a>
              <span>${product.brandName || "정보 없음"}</span>
            </div>
          </div>
        </td>
        <td>${product.productId}</td>
        <td>${formatPrice(product.price)}</td>
        <td>${statusBadge(product)}</td>
        <td>${formatDate(product.createdAt)}</td>
        <td>
          <div class="manage-buttons">
            <a href="${editHref(product)}">수정</a>
            <button class="delete-button" type="button"
              data-delete-id="${product.productId}"
              data-delete-name="${product.productName}">삭제</button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  function renderMobile(products) {
    if (!products.length) {
      const label = STATUS_META[activeStatus]?.label ?? STATUS_META.all.label;
      mobileList.innerHTML = `<p class="mobile-state">${label}에 해당하는 상품이 없습니다.</p>`;
      return;
    }
    mobileList.innerHTML = products.map((product) => `
      <article class="mobile-product-card">
        <a class="product-thumb-link" href="product-detail.html?id=${encodeURIComponent(product.productId)}">
          ${product.imageUrl
            ? `<img class="product-thumb" src="${product.imageUrl}" alt="">`
            : `<div class="product-thumb" aria-hidden="true"></div>`}
        </a>
        <div class="mobile-card-body">
          <div class="mobile-card-head">
            <a class="product-name-link" href="product-detail.html?id=${encodeURIComponent(product.productId)}">
              <strong>${product.productName}</strong>
            </a>
            ${statusBadge(product)}
          </div>
          <div class="mobile-meta">
            <span>상품번호</span><b>${product.productId}</b>
            <span>판매가</span><b>${formatPrice(product.price)}</b>
            <span>등록일</span><b>${formatDate(product.createdAt)}</b>
          </div>
          <div class="manage-buttons">
            <a href="${editHref(product)}">수정</a>
            <button class="delete-button" type="button"
              data-delete-id="${product.productId}"
              data-delete-name="${product.productName}">삭제</button>
          </div>
        </div>
      </article>
    `).join("");
  }

  function renderSummary(serverCounts, products) {
    const localCounts = products.reduce((result, product) => {
      result[product.status] = (result[product.status] || 0) + 1;
      return result;
    }, { selling: 0, stopped: 0, soldout: 0, unknown: 0 });

    const counts = serverCounts || {
      total: products.length,
      selling: localCounts.selling,
      stopped: localCounts.stopped,
      soldout: localCounts.soldout
    };

    totalCount.textContent = Number(counts.total || 0).toLocaleString("ko-KR");
    sellingCount.textContent = counts.selling.toLocaleString("ko-KR");
    stoppedCount.textContent = counts.stopped.toLocaleString("ko-KR");
    soldOutCount.textContent = counts.soldout.toLocaleString("ko-KR");

    statusApiNote.hidden = localCounts.unknown === 0;
    if (localCounts.unknown > 0) {
      statusApiNote.textContent =
        `판매상태를 확인할 수 없는 상품 ${localCounts.unknown.toLocaleString("ko-KR")}개가 있습니다.`;
    }
  }

  function renderPagination() {
    pagination.innerHTML = "";
    if (totalPages <= 1) return;
    const previous = document.createElement("button");
    previous.type = "button";
    previous.textContent = "‹";
    previous.disabled = currentPage === 0;
    previous.addEventListener("click", () => applyFilter(currentPage - 1));
    pagination.appendChild(previous);
    const start = Math.max(0, currentPage - 2);
    const end = Math.min(totalPages, start + 5);
    for (let page = start; page < end; page += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = String(page + 1);
      button.classList.toggle("on", page === currentPage);
      button.addEventListener("click", () => applyFilter(page));
      pagination.appendChild(button);
    }
    const next = document.createElement("button");
    next.type = "button";
    next.textContent = "›";
    next.disabled = currentPage >= totalPages - 1;
    next.addEventListener("click", () => applyFilter(currentPage + 1));
    pagination.appendChild(next);
  }

  async function fetchProductPage(status, page) {
    const params = new URLSearchParams({
      filter: STATUS_META[status]?.apiFilter || STATUS_META.all.apiFilter,
      page: String(page),
      size: String(API_PAGE_SIZE)
    });
    const response = await fetch(`${API_URL}?${params.toString()}`, {
      method: "GET",
      headers: { "Authorization": "Bearer " + getToken() }
    });

    if (handleUnauthorized(response)) return null;

    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) {
      throw new Error(data.message || "상품 목록을 불러오지 못했습니다.");
    }
    return extractPageData(data);
  }

  // 서버 상태 필터를 사용하되 검색은 전체 결과에 적용할 수 있도록 API 페이지를 합친다.
  async function fetchAllProducts(status) {
    const firstPage = await fetchProductPage(status, 0);
    if (!firstPage) return null;

    const apiPageCount = Math.min(Math.max(firstPage.totalPages, 1), MAX_API_PAGES);
    const products = firstPage.products.slice();

    for (let page = 1; page < apiPageCount; page += 1) {
      const nextPage = await fetchProductPage(status, page);
      if (!nextPage) return null;
      products.push(...nextPage.products);
    }

    return {
      ...firstPage,
      products,
      truncated: firstPage.totalPages > MAX_API_PAGES
    };
  }

  function renderActiveStatus() {
    const meta = STATUS_META[activeStatus] ?? STATUS_META.all;
    statusListTitle.textContent = meta.label;
    statusResultCount.textContent = `${filteredProducts.length.toLocaleString("ko-KR")}개`;
    statusButtons.forEach((button) => {
      const active = button.dataset.statusFilter === activeStatus;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  // API가 이미 상태별 결과를 주므로 여기서는 검색어와 화면 페이지네이션만 처리한다.
  function applyFilter(page = 0) {
    const keyword = keywordInput.value.trim().toLowerCase();
    filteredProducts = keyword
      ? allProducts.filter((p) =>
          String(p.productName).toLowerCase().includes(keyword) ||
          String(p.productId).toLowerCase().includes(keyword))
      : allProducts.slice();

    totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
    currentPage = Math.min(Math.max(0, page), totalPages - 1);

    const start = currentPage * PAGE_SIZE;
    const pageItems = filteredProducts.slice(start, start + PAGE_SIZE);

    renderDesktop(pageItems);
    renderMobile(pageItems);
    renderPagination();
    renderActiveStatus();

    if (keyword && filteredProducts.length === 0) {
      showMessage(`'${keywordInput.value.trim()}' 에 해당하는 상품이 없습니다.`, "info");
    } else {
      clearMessage();
    }
  }

  async function loadProducts(requestedPage = 0) {
    const requestId = ++loadRequestId;
    clearMessage();
    tableBody.innerHTML = `<tr><td class="state-cell" colspan="6">상품 목록을 불러오는 중입니다.</td></tr>`;
    mobileList.innerHTML = '<p class="mobile-state">상품 목록을 불러오는 중입니다.</p>';

    try {
      const pageData = await fetchAllProducts(activeStatus);
      if (!pageData) return; // 인증 실패로 리다이렉트됨
      if (requestId !== loadRequestId) return;

      allProducts = pageData.products;
      renderSummary(pageData.counts, allProducts);
      applyFilter(requestedPage);

      if (pageData.truncated) {
        showMessage(
          `상품이 많아 ${allProducts.length.toLocaleString("ko-KR")}개까지만 표시합니다.`,
          "info"
        );
      }
    } catch (error) {
      if (requestId !== loadRequestId) return;
      tableBody.innerHTML = `<tr><td class="state-cell" colspan="6">상품 목록을 불러오지 못했습니다.</td></tr>`;
      mobileList.innerHTML = '<p class="mobile-state">상품 목록을 불러오지 못했습니다.</p>';
      showMessage(
        error instanceof TypeError
          ? "서버에 연결할 수 없습니다. 백엔드 서버 상태를 확인해 주세요."
          : error.message
      );
    }
  }

  function openDeleteModal(productId, productName) {
    selectedProduct = { productId, productName };
    deleteProductName.textContent = productName || "선택한 상품";
    deleteModal.hidden = false;
    deleteConfirmButton.focus();
  }

  function closeDeleteModal() {
    selectedProduct = null;
    deleteModal.hidden = true;
  }

  async function deleteProduct() {
    if (!selectedProduct) return;
    deleteConfirmButton.disabled = true;
    deleteConfirmButton.textContent = "삭제 중...";

    try {
      // 🔧 토큰 방식으로 삭제
      const response = await fetch(
        `${API_URL}/${encodeURIComponent(selectedProduct.productId)}`,
        {
          method: "DELETE",
          headers: { "Authorization": "Bearer " + getToken() }
        }
      );

      if (handleUnauthorized(response)) return;

      let data = {};
      try { data = await response.json(); } catch (_) {}

      if (!response.ok) {
        throw new Error(data.message || "상품 삭제에 실패했습니다.");
      }

      closeDeleteModal();
      await loadProducts(currentPage);
      showMessage("상품이 삭제되었습니다.", "success");
    } catch (error) {
      closeDeleteModal();
      showMessage(
        error instanceof TypeError
          ? "서버에 연결할 수 없습니다. 백엔드 서버 상태를 확인해 주세요."
          : error.message
      );
    } finally {
      deleteConfirmButton.disabled = false;
      deleteConfirmButton.textContent = "삭제";
    }
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-id]");
    if (!button) return;
    openDeleteModal(button.dataset.deleteId, button.dataset.deleteName);
  });

  deleteCancelButton.addEventListener("click", closeDeleteModal);
  deleteConfirmButton.addEventListener("click", deleteProduct);
  deleteModal.addEventListener("click", (event) => {
    if (event.target === deleteModal) closeDeleteModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !deleteModal.hidden) closeDeleteModal();
  });

  statusButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const nextStatus = button.dataset.statusFilter;
      if (!STATUS_META[nextStatus] || nextStatus === "unknown") return;
      activeStatus = nextStatus;

      const url = new URL(location.href);
      if (activeStatus === "all") url.searchParams.delete("status");
      else url.searchParams.set("status", activeStatus);
      history.replaceState(null, "", url);
      keywordInput.value = "";
      filteredProducts = [];
      renderActiveStatus();
      await loadProducts(0);
    });
  });

  // 검색은 서버를 다시 부르지 않는다. 받아둔 전체에서 거른다.
  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    applyFilter(0);
  });

  // 검색어를 지우면 바로 전체로 되돌린다.
  keywordInput.addEventListener("search", () => applyFilter(0));

  renderActiveStatus();
  loadProducts();
})();
