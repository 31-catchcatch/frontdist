(() => {
  "use strict";

  // 🔧 API 주소: Live Server(5500)에서 백엔드(8080)로 보내려면 절대경로 필요
  const API_URL = "http://localhost:8080/api/v1/seller/products";
  const PAGE_SIZE = 10;   // 화면에 한 번에 보여줄 개수 (페이징은 클라이언트에서)
  const FETCH_SIZE = 200; // 서버에서 한 번에 받아올 개수 (검색을 전체에 걸기 위함)
  const FILE_PREVIEW_MODE = location.protocol === "file:";

  const tableBody = document.getElementById("productTableBody");
  const mobileList = document.getElementById("mobileProductList");
  const pagination = document.getElementById("pagination");
  const searchForm = document.getElementById("productSearchForm");
  const keywordInput = document.getElementById("productKeyword");
  const pageMessage = document.getElementById("pageMessage");

  const deleteModal = document.getElementById("deleteModal");
  const deleteProductName = document.getElementById("deleteProductName");
  const deleteCancelButton = document.getElementById("deleteCancelButton");
  const deleteConfirmButton = document.getElementById("deleteConfirmButton");

  const totalCount = document.getElementById("totalCount");

  let currentPage = 0;
  let totalPages = 1;
  let selectedProduct = null;
  let allProducts = [];      // 서버에서 받아온 전체
  let filteredProducts = []; // 검색어로 거른 결과

  // 🔧 토큰 꺼내기
  function getToken() {
    return localStorage.getItem("catchcatch.accessToken");
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

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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

  // 재고·판매상태는 다루지 않는다.
  // 백엔드 SellerProductResponse 에 stock·status 가 없고, 목록 쿼리가 deleted=false 만
  // 돌려주므로 모든 상품이 "판매 중"으로만 나왔다. 그래서 관련 UI를 전부 걷어냈다.
  // 백엔드가 필드를 주면 여기서 다시 정규화하면 된다.
  function normalizeProduct(raw) {
    return {
      productId: raw.productId ?? raw.id ?? raw.productNo ?? "",
      productName: raw.productName ?? raw.name ?? "상품명 없음",
      brandName: raw.brandName ?? raw.categoryName ?? raw.brand?.name ?? "",
      imageUrl: raw.thumbnailUrl ?? raw.imageUrl ?? raw.mainImageUrl ?? raw.images?.[0]?.url ?? "",
      price: raw.finalPrice ?? raw.salePrice ?? raw.discountPrice ?? raw.price ?? 0,
      createdAt: raw.createdAt ?? raw.registeredAt ?? raw.createdDate ?? ""
    };
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
      page: Number(body.number ?? body.page ?? currentPage)
    };
  }


  function renderDesktop(products) {
    if (!products.length) {
      tableBody.innerHTML = `<tr><td class="state-cell" colspan="5">조건에 맞는 상품이 없습니다.</td></tr>`;
      return;
    }
    tableBody.innerHTML = products.map((product) => `
      <tr>
        <td>
          <div class="product-info">
            <a class="product-thumb-link" href="product-detail.html?id=${encodeURIComponent(product.productId)}">
              ${product.imageUrl
                ? `<img class="product-thumb" src="${escapeHtml(product.imageUrl)}" alt="">`
                : `<div class="product-thumb" aria-hidden="true"></div>`}
            </a>
            <div class="product-copy">
              <a class="product-name-link" href="product-detail.html?id=${encodeURIComponent(product.productId)}">
                <strong title="${escapeHtml(product.productName)}">${escapeHtml(product.productName)}</strong>
              </a>
              <span>${escapeHtml(product.brandName || "정보 없음")}</span>
            </div>
          </div>
        </td>
        <td>${escapeHtml(product.productId)}</td>
        <td>${formatPrice(product.price)}</td>
        <td>${escapeHtml(formatDate(product.createdAt))}</td>
        <td>
          <div class="manage-buttons">
            <a href="seller-product-form.html?id=${encodeURIComponent(product.productId)}">수정</a>
            <button class="delete-button" type="button"
              data-delete-id="${escapeHtml(product.productId)}"
              data-delete-name="${escapeHtml(product.productName)}">삭제</button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  function renderMobile(products) {
    if (!products.length) {
      mobileList.innerHTML = '<p class="mobile-state">조건에 맞는 상품이 없습니다.</p>';
      return;
    }
    mobileList.innerHTML = products.map((product) => `
      <article class="mobile-product-card">
        <a class="product-thumb-link" href="product-detail.html?id=${encodeURIComponent(product.productId)}">
          ${product.imageUrl
            ? `<img class="product-thumb" src="${escapeHtml(product.imageUrl)}" alt="">`
            : `<div class="product-thumb" aria-hidden="true"></div>`}
        </a>
        <div class="mobile-card-body">
          <div class="mobile-card-head">
            <a class="product-name-link" href="product-detail.html?id=${encodeURIComponent(product.productId)}">
              <strong>${escapeHtml(product.productName)}</strong>
            </a>
          </div>
          <div class="mobile-meta">
            <span>상품번호</span><b>${escapeHtml(product.productId)}</b>
            <span>판매가</span><b>${formatPrice(product.price)}</b>
            <span>등록일</span><b>${escapeHtml(formatDate(product.createdAt))}</b>
          </div>
          <div class="manage-buttons">
            <a href="seller-product-form.html?id=${encodeURIComponent(product.productId)}">수정</a>
            <button class="delete-button" type="button"
              data-delete-id="${escapeHtml(product.productId)}"
              data-delete-name="${escapeHtml(product.productName)}">삭제</button>
          </div>
        </div>
      </article>
    `).join("");
  }

  // 서버가 주는 전체 개수(totalElements)만 쓴다.
  // 판매중/품절/판매중지는 백엔드에 status·stock 이 없어 계산할 수 없어서 카드를 없앴다.
  function renderSummary(serverTotal) {
    totalCount.textContent = Number(serverTotal || 0).toLocaleString("ko-KR");
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

  // 서버는 page·size 만 받고 keyword 를 무시한다. (SellerProductController)
  // 그래서 한 번에 전부 받아 두고 검색·페이징은 여기서 한다.
  // 그렇게 해야 검색이 현재 페이지가 아니라 전체 상품에 걸린다.
  async function fetchAllProducts() {
    const params = new URLSearchParams({ page: "0", size: String(FETCH_SIZE) });
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

  // 검색어로 거른 뒤 화면에 뿌린다. (서버 재요청 없음)
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

    if (keyword && filteredProducts.length === 0) {
      showMessage(`'${keywordInput.value.trim()}' 에 해당하는 상품이 없습니다.`, "info");
    } else {
      clearMessage();
    }
  }

  async function loadProducts() {
    clearMessage();
    tableBody.innerHTML = `<tr><td class="state-cell" colspan="5">상품 목록을 불러오는 중입니다.</td></tr>`;
    mobileList.innerHTML = '<p class="mobile-state">상품 목록을 불러오는 중입니다.</p>';

    try {
      const pageData = await fetchAllProducts();
      if (!pageData) return; // 인증 실패로 리다이렉트됨

      allProducts = pageData.products;
      renderSummary(pageData.totalElements);

      // 전부 못 받아왔으면 검색 결과가 반쪽이 되므로 알린다.
      if (pageData.totalElements > allProducts.length) {
        showMessage(
          `상품이 ${pageData.totalElements}개라 최근 ${allProducts.length}개만 표시합니다.`,
          "info"
        );
      }

      applyFilter(0);
    } catch (error) {
      tableBody.innerHTML = `<tr><td class="state-cell" colspan="5">상품 목록을 불러오지 못했습니다.</td></tr>`;
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
  // 검색은 서버를 다시 부르지 않는다. 받아둔 전체에서 거른다.
  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    applyFilter(0);
  });

  // 검색어를 지우면 바로 전체로 되돌린다.
  keywordInput.addEventListener("search", () => applyFilter(0));

  loadProducts();
})();