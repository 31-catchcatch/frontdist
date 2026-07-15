(() => {
  "use strict";

  const API_URL = "/api/v1/seller/products";
  const PAGE_SIZE = 10;
  const FILE_PREVIEW_MODE = location.protocol === "file:";

  const tableBody = document.getElementById("productTableBody");
  const mobileList = document.getElementById("mobileProductList");
  const pagination = document.getElementById("pagination");
  const searchForm = document.getElementById("productSearchForm");
  const keywordInput = document.getElementById("productKeyword");
  const statusFilter = document.getElementById("statusFilter");
  const pageMessage = document.getElementById("pageMessage");

  const deleteModal = document.getElementById("deleteModal");
  const deleteProductName = document.getElementById("deleteProductName");
  const deleteCancelButton = document.getElementById("deleteCancelButton");
  const deleteConfirmButton = document.getElementById("deleteConfirmButton");

  const totalCount = document.getElementById("totalCount");
  const sellingCount = document.getElementById("sellingCount");
  const soldOutCount = document.getElementById("soldOutCount");
  const stoppedCount = document.getElementById("stoppedCount");

  let currentPage = 0;
  let totalPages = 1;
  let selectedProduct = null;

  let previewProducts = [
    {
      productId: 1001,
      productName: "릴렉스 핏 쿨 코튼 반팔 티셔츠",
      brandName: "STANDARD",
      imageUrl: "",
      price: 19900,
      stock: 28,
      status: "SELLING",
      createdAt: "2026-07-12"
    },
    {
      productId: 1002,
      productName: "와이드 원턱 코튼 팬츠",
      brandName: "STANDARD",
      imageUrl: "",
      price: 39900,
      stock: 0,
      status: "SOLD_OUT",
      createdAt: "2026-07-11"
    },
    {
      productId: 1003,
      productName: "린넨 블렌드 셔츠 자켓",
      brandName: "STANDARD",
      imageUrl: "",
      price: 69900,
      stock: 15,
      status: "STOPPED",
      createdAt: "2026-07-10"
    }
  ];

  function isSellerLoggedIn() {
    const loggedIn =
      sessionStorage.getItem("catchcatch.loggedIn") === "true" ||
      Boolean(sessionStorage.getItem("catchcatch.accessToken")) ||
      Boolean(localStorage.getItem("catchcatch.accessToken"));

    return (
      loggedIn &&
      sessionStorage.getItem("catchcatch.loginType") === "seller"
    );
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

  if (!FILE_PREVIEW_MODE && !isSellerLoggedIn()) {
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
    return Number.isFinite(price)
      ? `${price.toLocaleString("ko-KR")}원`
      : "-";
  }

  function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  }

  function normalizeStatus(rawStatus, stock) {
    const status = String(rawStatus || "").toUpperCase();

    if (["SELLING", "ON_SALE", "ACTIVE"].includes(status)) {
      return {
        code: "SELLING",
        label: "판매 중",
        className: "status-selling"
      };
    }

    if (status === "SOLD_OUT" || Number(stock) === 0) {
      return {
        code: "SOLD_OUT",
        label: "품절",
        className: "status-sold-out"
      };
    }

    return {
      code: "STOPPED",
      label: "판매 중지",
      className: "status-stopped"
    };
  }

  function normalizeProduct(raw) {
    const productId =
      raw.productId ??
      raw.id ??
      raw.productNo ??
      "";

    const stock =
      raw.stock ??
      raw.stockQuantity ??
      raw.quantity ??
      0;

    return {
      productId,
      productName:
        raw.productName ??
        raw.name ??
        "상품명 없음",
      brandName:
        raw.brandName ??
        raw.brand?.name ??
        "",
      imageUrl:
        raw.thumbnailUrl ??
        raw.imageUrl ??
        raw.mainImageUrl ??
        raw.images?.[0]?.url ??
        "",
      price:
        raw.salePrice ??
        raw.discountPrice ??
        raw.price ??
        0,
      stock,
      status: normalizeStatus(
        raw.status ?? raw.salesStatus,
        stock
      ),
      createdAt:
        raw.createdAt ??
        raw.registeredAt ??
        raw.createdDate ??
        ""
    };
  }

  function extractPageData(data) {
    const body = data?.data ?? data ?? {};

    const rawItems =
      body.content ??
      body.items ??
      body.products ??
      body.list ??
      (Array.isArray(body) ? body : []);

    const products = Array.isArray(rawItems)
      ? rawItems.map(normalizeProduct)
      : [];

    return {
      products,
      totalElements:
        Number(body.totalElements ?? body.totalCount ?? products.length),
      totalPages:
        Number(body.totalPages ?? 1),
      page:
        Number(body.number ?? body.page ?? currentPage)
    };
  }

  function statusBadge(status) {
    return `
      <span class="status-badge ${status.className}">
        ${escapeHtml(status.label)}
      </span>
    `;
  }

  function renderDesktop(products) {
    if (!products.length) {
      tableBody.innerHTML = `
        <tr>
          <td class="state-cell" colspan="7">
            조건에 맞는 상품이 없습니다.
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = products.map((product) => `
      <tr>
        <td>
          <div class="product-info">
            ${
              product.imageUrl
                ? `<img class="product-thumb" src="${escapeHtml(product.imageUrl)}" alt="">`
                : `<div class="product-thumb" aria-hidden="true"></div>`
            }
            <div class="product-copy">
              <strong title="${escapeHtml(product.productName)}">
                ${escapeHtml(product.productName)}
              </strong>
              <span>${escapeHtml(product.brandName || "브랜드 정보 없음")}</span>
            </div>
          </div>
        </td>
        <td>${escapeHtml(product.productId)}</td>
        <td>${formatPrice(product.price)}</td>
        <td>${Number(product.stock).toLocaleString("ko-KR")}</td>
        <td>${statusBadge(product.status)}</td>
        <td>${escapeHtml(formatDate(product.createdAt))}</td>
        <td>
          <div class="manage-buttons">
            <a href="seller-product-form.html?id=${encodeURIComponent(product.productId)}">
              수정
            </a>
            <button
              class="delete-button"
              type="button"
              data-delete-id="${escapeHtml(product.productId)}"
              data-delete-name="${escapeHtml(product.productName)}"
            >
              삭제
            </button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  function renderMobile(products) {
    if (!products.length) {
      mobileList.innerHTML =
        '<p class="mobile-state">조건에 맞는 상품이 없습니다.</p>';
      return;
    }

    mobileList.innerHTML = products.map((product) => `
      <article class="mobile-product-card">
        ${
          product.imageUrl
            ? `<img class="product-thumb" src="${escapeHtml(product.imageUrl)}" alt="">`
            : `<div class="product-thumb" aria-hidden="true"></div>`
        }

        <div class="mobile-card-body">
          <div class="mobile-card-head">
            <strong>${escapeHtml(product.productName)}</strong>
            ${statusBadge(product.status)}
          </div>

          <div class="mobile-meta">
            <span>상품번호</span>
            <b>${escapeHtml(product.productId)}</b>
            <span>판매가</span>
            <b>${formatPrice(product.price)}</b>
            <span>재고</span>
            <b>${Number(product.stock).toLocaleString("ko-KR")}</b>
          </div>

          <div class="manage-buttons">
            <a href="seller-product-form.html?id=${encodeURIComponent(product.productId)}">
              수정
            </a>
            <button
              class="delete-button"
              type="button"
              data-delete-id="${escapeHtml(product.productId)}"
              data-delete-name="${escapeHtml(product.productName)}"
            >
              삭제
            </button>
          </div>
        </div>
      </article>
    `).join("");
  }

  function renderSummary(products, serverTotal) {
    const counts = {
      SELLING: 0,
      SOLD_OUT: 0,
      STOPPED: 0
    };

    products.forEach((product) => {
      counts[product.status.code] += 1;
    });

    totalCount.textContent =
      Number(serverTotal || products.length).toLocaleString("ko-KR");
    sellingCount.textContent =
      counts.SELLING.toLocaleString("ko-KR");
    soldOutCount.textContent =
      counts.SOLD_OUT.toLocaleString("ko-KR");
    stoppedCount.textContent =
      counts.STOPPED.toLocaleString("ko-KR");
  }

  function renderPagination() {
    pagination.innerHTML = "";

    if (totalPages <= 1) return;

    const previous = document.createElement("button");
    previous.type = "button";
    previous.textContent = "‹";
    previous.disabled = currentPage === 0;
    previous.addEventListener("click", () => loadProducts(currentPage - 1));
    pagination.appendChild(previous);

    const start = Math.max(0, currentPage - 2);
    const end = Math.min(totalPages, start + 5);

    for (let page = start; page < end; page += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = String(page + 1);
      button.classList.toggle("on", page === currentPage);
      button.addEventListener("click", () => loadProducts(page));
      pagination.appendChild(button);
    }

    const next = document.createElement("button");
    next.type = "button";
    next.textContent = "›";
    next.disabled = currentPage >= totalPages - 1;
    next.addEventListener("click", () => loadProducts(currentPage + 1));
    pagination.appendChild(next);
  }

  function getFilteredPreviewProducts() {
    const keyword = keywordInput.value.trim().toLowerCase();
    const status = statusFilter.value;

    return previewProducts
      .map(normalizeProduct)
      .filter((product) => {
        const matchesKeyword =
          !keyword ||
          String(product.productId).toLowerCase().includes(keyword) ||
          product.productName.toLowerCase().includes(keyword);

        const matchesStatus =
          !status ||
          product.status.code === status;

        return matchesKeyword && matchesStatus;
      });
  }

  async function loadProducts(page = 0) {
    clearMessage();

    tableBody.innerHTML = `
      <tr>
        <td class="state-cell" colspan="7">
          상품 목록을 불러오는 중입니다.
        </td>
      </tr>
    `;
    mobileList.innerHTML =
      '<p class="mobile-state">상품 목록을 불러오는 중입니다.</p>';

    if (FILE_PREVIEW_MODE) {
      const products = getFilteredPreviewProducts();

      currentPage = 0;
      totalPages = 1;

      renderDesktop(products);
      renderMobile(products);
      renderSummary(products, products.length);
      renderPagination();
      return;
    }

    const params = new URLSearchParams({
      page: String(page),
      size: String(PAGE_SIZE)
    });

    const keyword = keywordInput.value.trim();
    const status = statusFilter.value;

    if (keyword) params.set("keyword", keyword);
    if (status) params.set("status", status);

    try {
      const response = await fetch(
        `${API_URL}?${params.toString()}`,
        {
          method: "GET",
          credentials: "include"
        }
      );

      if (handleUnauthorized(response)) return;

      let data = {};
      try {
        data = await response.json();
      } catch (_) {}

      if (!response.ok) {
        throw new Error(
          data.message || "상품 목록을 불러오지 못했습니다."
        );
      }

      const pageData = extractPageData(data);

      currentPage = pageData.page;
      totalPages = Math.max(1, pageData.totalPages);

      renderDesktop(pageData.products);
      renderMobile(pageData.products);
      renderSummary(pageData.products, pageData.totalElements);
      renderPagination();
    } catch (error) {
      tableBody.innerHTML = `
        <tr>
          <td class="state-cell" colspan="7">
            상품 목록을 불러오지 못했습니다.
          </td>
        </tr>
      `;
      mobileList.innerHTML =
        '<p class="mobile-state">상품 목록을 불러오지 못했습니다.</p>';

      showMessage(
        error instanceof TypeError
          ? "서버에 연결할 수 없습니다. WEB/WAS 서버 상태를 확인해 주세요."
          : error.message
      );
    }
  }

  function openDeleteModal(productId, productName) {
    selectedProduct = {
      productId,
      productName
    };

    deleteProductName.textContent =
      productName || "선택한 상품";
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
      if (FILE_PREVIEW_MODE) {
        previewProducts = previewProducts.filter(
          (product) =>
            String(product.productId) !==
            String(selectedProduct.productId)
        );

        closeDeleteModal();
        showMessage("미리보기 목록에서 상품이 삭제되었습니다.", "success");
        loadProducts(0);
        return;
      }

      const response = await fetch(
        `${API_URL}/${encodeURIComponent(selectedProduct.productId)}`,
        {
          method: "DELETE",
          credentials: "include"
        }
      );

      if (handleUnauthorized(response)) return;

      let data = {};
      try {
        data = await response.json();
      } catch (_) {}

      if (!response.ok) {
        throw new Error(
          data.message || "상품 삭제에 실패했습니다."
        );
      }

      closeDeleteModal();
      await loadProducts(currentPage);
      showMessage("상품이 삭제되었습니다.", "success");
    } catch (error) {
      closeDeleteModal();
      showMessage(
        error instanceof TypeError
          ? "서버에 연결할 수 없습니다. WEB/WAS 서버 상태를 확인해 주세요."
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

    openDeleteModal(
      button.dataset.deleteId,
      button.dataset.deleteName
    );
  });

  deleteCancelButton.addEventListener("click", closeDeleteModal);
  deleteConfirmButton.addEventListener("click", deleteProduct);

  deleteModal.addEventListener("click", (event) => {
    if (event.target === deleteModal) {
      closeDeleteModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !deleteModal.hidden) {
      closeDeleteModal();
    }
  });

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    loadProducts(0);
  });

  statusFilter.addEventListener("change", () => {
    loadProducts(0);
  });

  loadProducts();
})();
