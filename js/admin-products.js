(function () {
  "use strict";

  const rowsEl = document.getElementById("rows");
  const countEl = document.getElementById("count");
  const qEl = document.getElementById("q");
  const statusEl = document.getElementById("statusFilter");
  const checkAll = document.getElementById("checkAll");

  let PRODUCTS = [];

  const API_BASE = (window.CATCHCATCH_API_BASE_URL || "/api/v1").replace(/\/$/, "");
  const SELLER_UNKNOWN = "-";
  const SELLER_LOADING = "…";

  const sellerNameById = new Map();
  const sellerInFlight = new Map();

  const STATUS_BADGE = {
    ok: ["tag ok", "판매중"],
    stop: ["tag stop", "판매중지·삭제"],
    unknown: ["tag", "확인 불가"]
  };

  let onSaleIds = null;

  async function fetchOnSaleIds() {
    try {
      const response = await fetch(`${API_BASE}/products?size=500`, {
        headers: Object.assign({ Accept: "application/json" }, AdminAuth.authorizationHeader())
      });
      if (!response.ok) return null;

      const payload = await response.json();
      const body = payload && payload.data;
      const list = (body && body.content) || [];

      if (body && typeof body.totalElements === "number" && body.totalElements > list.length) {
        return null;
      }

      return new Set(list.map((p) => String(p.productId ?? p.id)));
    } catch (_) {
      return null;
    }
  }

  function statusOf(productId) {
    if (onSaleIds === null) return "unknown";
    return onSaleIds.has(String(productId)) ? "ok" : "stop";
  }

  async function fetchSellerName(productId) {
    const response = await fetch(
      `${API_BASE}/products/${encodeURIComponent(productId)}`,
      { headers: Object.assign({ Accept: "application/json" }, AdminAuth.authorizationHeader()) }
    );

    if (!response.ok) return SELLER_UNKNOWN;

    let payload = null;
    try {
      payload = await response.json();
    } catch (_) {
      return SELLER_UNKNOWN;
    }

    const name = payload && payload.data && payload.data.sellerName;
    return name ? String(name) : SELLER_UNKNOWN;
  }

  function sellerNameOf(productId) {
    const key = String(productId);

    if (sellerNameById.has(key)) return Promise.resolve(sellerNameById.get(key));
    if (sellerInFlight.has(key)) return sellerInFlight.get(key);

    if (statusOf(key) === "stop") {
      sellerNameById.set(key, SELLER_UNKNOWN);
      return Promise.resolve(SELLER_UNKNOWN);
    }

    const pending = fetchSellerName(key)
      .catch(() => SELLER_UNKNOWN)
      .then((name) => {
        sellerNameById.set(key, name);
        sellerInFlight.delete(key);
        return name;
      });

    sellerInFlight.set(key, pending);
    return pending;
  }


  function fillSellerCells() {
    rowsEl.querySelectorAll("tr[data-id]").forEach((row) => {
      const cell = row.querySelector('[data-role="seller"]');
      if (!cell || cell.dataset.filled === "1") return;

      sellerNameOf(row.dataset.id).then((name) => {

        if (!cell.isConnected) return;
        cell.textContent = name;
        cell.dataset.filled = "1";
      });
    });
  }


  function mapRow(product) {
    return {
      id: product.productId ?? product.id,

      name: product.name ?? product.productName ?? "-",

      price:
        product.finalPrice ??
        product.price ??
        0,

      basePrice:
        product.price ??
        product.originalPrice ??
        0,

      discountRate:
        product.discountRate ??
        0,

      finalPrice:
        product.finalPrice ??
        product.price ??
        0,

      thumbnailUrl:
        product.thumbnailUrl ??
        product.imageUrl ??
        "",

      status: statusOf(product.productId ?? product.id)
    };
  }


  function render(list, total = list.length) {
    if (!list.length) {
      rowsEl.innerHTML = `
        <tr class="empty-row">
          <td colspan="8">
            조건에 맞는 상품이 없습니다.
          </td>
        </tr>
      `;

      countEl.textContent = "0";
      return;
    }

    rowsEl.innerHTML = list
      .map(
        (product) => `
          <tr data-id="${product.id}">
            <td class="chk">
              <input
                type="checkbox"
                aria-label="${esc(product.name)} 선택"
              >
            </td>

            <td class="num">
              ${product.id}
            </td>

            <td class="strong">
              <a
                class="product-link${product.status === "stop" ? " is-unavailable" : ""}"
                data-role="product-link"
                href="product-detail.html?id=${encodeURIComponent(product.id)}"
                target="_blank"
                rel="noopener"
                ${product.status === "stop"
                  ? 'title="삭제되었거나 판매중지된 상품입니다. 상품 페이지가 열리지 않을 수 있습니다."'
                  : ""}
              >${esc(product.name)}</a>
            </td>

            <td class="muted" data-role="seller"${sellerNameById.has(String(product.id)) ? ' data-filled="1"' : ""}>${esc(sellerNameById.get(String(product.id)) ?? SELLER_LOADING)}</td>

            <td class="num">
              ${AdminUI.won(product.price)}
            </td>

            <td>
              <span class="${STATUS_BADGE[product.status][0]}">${STATUS_BADGE[product.status][1]}</span>
            </td>

            <td class="muted" data-role="created">-</td>

            <td>
              <div class="row-actions">
                <button
                  type="button"
                  class="btn sm"
                  data-act="detail"
                >
                  상세
                </button>

                <button
                  type="button"
                  class="btn sm danger"
                  data-act="delete"
                >
                  삭제
                </button>
              </div>
            </td>
          </tr>
        `
      )
      .join("");

    countEl.textContent = String(total);

    fillSellerCells();
  }


  const listController = AdminUI.createListController({
    pager: document.querySelector(".pager"),
    render
  });


  function applyFilter() {
    const keyword = qEl.value.trim().toLowerCase();
    const status = statusEl ? statusEl.value : "";

    const filteredProducts = PRODUCTS.filter((product) => {
      if (status && product.status !== status) return false;
      if (!keyword) return true;

      const productName = String(product.name ?? "").toLowerCase();
      const productId = String(product.id ?? "").toLowerCase();

      const sellerName = String(
        sellerNameById.get(String(product.id)) ?? ""
      ).toLowerCase();

      return (
        productName.includes(keyword) ||
        productId.includes(keyword) ||
        (sellerName !== "" && sellerName !== SELLER_UNKNOWN && sellerName.includes(keyword))
      );
    });

    listController.setItems(filteredProducts);
  }

  qEl.addEventListener("input", applyFilter);

  if (statusEl) {
    statusEl.addEventListener("change", applyFilter);
  }


  if (checkAll) {
    checkAll.addEventListener("change", (event) => {
      rowsEl
        .querySelectorAll('input[type="checkbox"]')
        .forEach((checkbox) => {
          checkbox.checked = event.target.checked;
        });
    });
  }


  rowsEl.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-act]");

    if (!button) return;

    const row = button.closest("tr");
    if (!row) return;

    const productId = row.dataset.id;

    const product = PRODUCTS.find(
      (item) => String(item.id) === String(productId)
    );

    if (!product) {
      AdminUI.toast("상품 정보를 찾지 못했습니다.");
      return;
    }

    const action = button.dataset.act;


    if (action === "detail") {
      AdminUI.detail("상품 상세", [
        ["상품 ID", product.id],
        ["상품명", product.name],
        ["판매자", sellerNameById.get(String(product.id)) ?? SELLER_UNKNOWN],
        ["정상가", AdminUI.won(product.basePrice)],
        ["할인율", `${product.discountRate}%`],
        ["판매가", AdminUI.won(product.finalPrice)],
        ["썸네일", product.thumbnailUrl || "(없음)"]
      ]);

      return;
    }


    if (action === "delete") {
      const confirmed = await AdminUI.confirm({
        title: "상품 강제 삭제",
        message:
          `[${product.name}] 상품을 삭제합니다. ` +
          "진행하시겠습니까?",
        okText: "삭제",
        danger: true
      });

      if (!confirmed) return;

      const originalText = button.textContent;

      try {
        button.disabled = true;
        button.textContent = "삭제 중...";

        await AdminApi.del(`/products/${product.id}`);


        await load();

        AdminUI.toast("상품이 삭제되었습니다.");
      } catch (error) {
        console.error("상품 삭제 실패:", error);

        AdminUI.toast(
          error.message || "삭제에 실패했습니다."
        );
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  });


  async function load() {
    try {
      rowsEl.innerHTML = `
        <tr class="empty-row">
          <td colspan="8">
            상품 목록을 불러오는 중입니다.
          </td>
        </tr>
      `;


      const cacheKey = Date.now();

      const [data, onSale] = await Promise.all([
        AdminApi.list(`/products?size=200&_=${cacheKey}`),
        fetchOnSaleIds()
      ]);

      onSaleIds = onSale;

      PRODUCTS = data
        .map(mapRow)
        .filter((product) => {
          return (
            product.id !== null &&
            product.id !== undefined
          );
        });

      if (checkAll) {
        checkAll.checked = false;
      }

      applyFilter();

      return PRODUCTS;
    } catch (error) {
      console.error(
        "관리자 상품 목록 조회 실패:",
        error
      );

      rowsEl.innerHTML = `
        <tr class="empty-row">
          <td colspan="8">
            ${error.message ||
              "목록을 불러오지 못했습니다."}
          </td>
        </tr>
      `;

      countEl.textContent = "0";

      throw error;
    }
  }


  load().catch(() => {

  });
})();
