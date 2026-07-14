(() => {
  "use strict";

  const CART_API = "/api/v1/carts";
  const FILE_PREVIEW_MODE = location.protocol === "file:";

  const cartList = document.getElementById("cartList");
  const selectAll = document.getElementById("selectAll");
  const deleteSelectedButton = document.getElementById("deleteSelectedButton");
  const checkoutButton = document.getElementById("checkoutButton");
  const pageMessage = document.getElementById("pageMessage");

  const productAmount = document.getElementById("productAmount");
  const discountAmount = document.getElementById("discountAmount");
  const deliveryAmount = document.getElementById("deliveryAmount");
  const totalAmount = document.getElementById("totalAmount");

  let cartItems = [];

  const previewItems = [
    {
      cartItemId: 1,
      productId: 101,
      brandName: "STANDARD",
      productName: "릴렉스 핏 쿨 코튼 반팔 티셔츠",
      optionText: "화이트 / L",
      quantity: 2,
      price: 19900,
      originalPrice: 29000,
      imageUrl: ""
    },
    {
      cartItemId: 2,
      productId: 205,
      brandName: "STANDARD",
      productName: "와이드 원턱 코튼 팬츠",
      optionText: "블랙 / M",
      quantity: 1,
      price: 39900,
      originalPrice: 49000,
      imageUrl: ""
    }
  ];

  function isLoggedIn() {
    return (
      sessionStorage.getItem("catchcatch.loggedIn") === "true" ||
      Boolean(sessionStorage.getItem("catchcatch.accessToken")) ||
      Boolean(localStorage.getItem("catchcatch.accessToken"))
    );
  }

  function moveToLogin() {
    location.replace(
      "login.html?redirect=shoppingcart.html"
    );
  }

  if (!FILE_PREVIEW_MODE && !isLoggedIn()) {
    moveToLogin();
    return;
  }

  function clearLoginState() {
    sessionStorage.removeItem("catchcatch.loggedIn");
    sessionStorage.removeItem("catchcatch.loginType");
    sessionStorage.removeItem("catchcatch.accessToken");
    localStorage.removeItem("catchcatch.accessToken");
  }

  function handleUnauthorized(response) {
    if (response.status !== 401 && response.status !== 403) return false;

    clearLoginState();
    moveToLogin();
    return true;
  }

  function showMessage(message) {
    pageMessage.textContent = message;
    pageMessage.classList.add("show");
  }

  function clearMessage() {
    pageMessage.textContent = "";
    pageMessage.classList.remove("show");
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
    return `${Number(value || 0).toLocaleString("ko-KR")}원`;
  }

  function normalizeItem(raw) {
    return {
      cartItemId: raw.cartItemId ?? raw.id,
      productId: raw.productId ?? raw.product?.id,
      brandName: raw.brandName ?? raw.product?.brandName ?? "",
      productName: raw.productName ?? raw.product?.name ?? "상품명 없음",
      optionText:
        raw.optionText ??
        raw.optionName ??
        raw.productOption ??
        "",
      quantity: Number(raw.quantity ?? 1),
      price: Number(raw.salePrice ?? raw.price ?? 0),
      originalPrice: Number(raw.originalPrice ?? raw.price ?? 0),
      imageUrl:
        raw.thumbnailUrl ??
        raw.imageUrl ??
        raw.product?.thumbnailUrl ??
        "",
      selected: true
    };
  }

  function extractItems(data) {
    const body = data?.data ?? data ?? {};
    const items =
      body.items ??
      body.cartItems ??
      body.content ??
      (Array.isArray(body) ? body : []);

    return Array.isArray(items)
      ? items.map(normalizeItem)
      : [];
  }

  function renderCart() {
    if (!cartItems.length) {
      cartList.innerHTML =
        '<p class="cart-state">장바구니에 담긴 상품이 없습니다.</p>';
      updateSummary();
      return;
    }

    cartList.innerHTML = cartItems.map((item) => `
      <article class="cart-item">
        <input
          class="cart-select"
          type="checkbox"
          data-select-id="${escapeHtml(item.cartItemId)}"
          ${item.selected ? "checked" : ""}
          aria-label="${escapeHtml(item.productName)} 선택"
        >

        ${
          item.imageUrl
            ? `<img class="cart-thumb" src="${escapeHtml(item.imageUrl)}" alt="">`
            : '<div class="cart-thumb" aria-hidden="true"></div>'
        }

        <div class="cart-info">
          <span class="cart-brand">${escapeHtml(item.brandName)}</span>
          <strong class="cart-name">${escapeHtml(item.productName)}</strong>
          <span class="cart-option">${escapeHtml(item.optionText || "옵션 없음")}</span>

          <div class="cart-controls">
            <div class="quantity-control">
              <button type="button" data-qty-action="minus" data-cart-id="${escapeHtml(item.cartItemId)}" aria-label="수량 감소">−</button>
              <input type="text" value="${item.quantity}" readonly aria-label="수량">
              <button type="button" data-qty-action="plus" data-cart-id="${escapeHtml(item.cartItemId)}" aria-label="수량 증가">＋</button>
            </div>

            <button class="item-delete" type="button" data-delete-id="${escapeHtml(item.cartItemId)}">
              삭제
            </button>
          </div>
        </div>

        <div class="cart-price">
          <strong>${formatPrice(item.price * item.quantity)}</strong>
          ${
            item.originalPrice > item.price
              ? `<del>${formatPrice(item.originalPrice * item.quantity)}</del>`
              : ""
          }
        </div>
      </article>
    `).join("");

    selectAll.checked = cartItems.every((item) => item.selected);
    selectAll.indeterminate =
      cartItems.some((item) => item.selected) &&
      !cartItems.every((item) => item.selected);

    updateSummary();
  }

  function updateSummary() {
    const selectedItems = cartItems.filter((item) => item.selected);

    const normalTotal = selectedItems.reduce(
      (sum, item) => sum + item.originalPrice * item.quantity,
      0
    );

    const saleTotal = selectedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const discount = Math.max(0, normalTotal - saleTotal);
    const delivery = saleTotal === 0 || saleTotal >= 50000 ? 0 : 3000;
    const total = saleTotal + delivery;

    productAmount.textContent = formatPrice(normalTotal);
    discountAmount.textContent = `-${formatPrice(discount)}`;
    deliveryAmount.textContent =
      delivery === 0 && saleTotal > 0 ? "무료" : formatPrice(delivery);
    totalAmount.textContent = formatPrice(total);
    checkoutButton.disabled = selectedItems.length === 0;
  }

  async function loadCart() {
    clearMessage();

    if (FILE_PREVIEW_MODE) {
      cartItems = previewItems.map(normalizeItem);
      renderCart();
      return;
    }

    try {
      const response = await fetch(CART_API, {
        method: "GET",
        credentials: "include"
      });

      if (handleUnauthorized(response)) return;

      let data = {};
      try {
        data = await response.json();
      } catch (_) {}

      if (!response.ok) {
        throw new Error(data.message || "장바구니를 불러오지 못했습니다.");
      }

      cartItems = extractItems(data);
      renderCart();
    } catch (error) {
      cartList.innerHTML =
        '<p class="cart-state">장바구니를 불러오지 못했습니다.</p>';

      showMessage(
        error instanceof TypeError
          ? "서버에 연결할 수 없습니다."
          : error.message
      );
    }
  }

  async function updateQuantity(cartItemId, quantity) {
    const item = cartItems.find(
      (cartItem) => String(cartItem.cartItemId) === String(cartItemId)
    );
    if (!item) return;

    const nextQuantity = Math.max(1, quantity);

    if (FILE_PREVIEW_MODE) {
      item.quantity = nextQuantity;
      renderCart();
      return;
    }

    try {
      const response = await fetch(
        `${CART_API}/${encodeURIComponent(cartItemId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            quantity: nextQuantity
          })
        }
      );

      if (handleUnauthorized(response)) return;

      let data = {};
      try {
        data = await response.json();
      } catch (_) {}

      if (!response.ok) {
        throw new Error(data.message || "수량 변경에 실패했습니다.");
      }

      item.quantity = nextQuantity;
      renderCart();
    } catch (error) {
      showMessage(
        error instanceof TypeError
          ? "서버에 연결할 수 없습니다."
          : error.message
      );
    }
  }

  async function deleteItem(cartItemId) {
    if (FILE_PREVIEW_MODE) {
      cartItems = cartItems.filter(
        (item) => String(item.cartItemId) !== String(cartItemId)
      );
      renderCart();
      return;
    }

    try {
      const response = await fetch(
        `${CART_API}/${encodeURIComponent(cartItemId)}`,
        {
          method: "DELETE",
          credentials: "include"
        }
      );

      if (handleUnauthorized(response)) return;

      if (!response.ok) {
        let data = {};
        try {
          data = await response.json();
        } catch (_) {}
        throw new Error(data.message || "상품 삭제에 실패했습니다.");
      }

      cartItems = cartItems.filter(
        (item) => String(item.cartItemId) !== String(cartItemId)
      );
      renderCart();
    } catch (error) {
      showMessage(
        error instanceof TypeError
          ? "서버에 연결할 수 없습니다."
          : error.message
      );
    }
  }

  cartList.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-select-id]");
    if (!checkbox) return;

    const item = cartItems.find(
      (cartItem) =>
        String(cartItem.cartItemId) === String(checkbox.dataset.selectId)
    );

    if (item) {
      item.selected = checkbox.checked;
      renderCart();
    }
  });

  cartList.addEventListener("click", (event) => {
    const quantityButton = event.target.closest("[data-qty-action]");
    if (quantityButton) {
      const item = cartItems.find(
        (cartItem) =>
          String(cartItem.cartItemId) ===
          String(quantityButton.dataset.cartId)
      );

      if (!item) return;

      const nextQuantity =
        quantityButton.dataset.qtyAction === "plus"
          ? item.quantity + 1
          : item.quantity - 1;

      updateQuantity(item.cartItemId, nextQuantity);
      return;
    }

    const deleteButton = event.target.closest("[data-delete-id]");
    if (deleteButton) {
      deleteItem(deleteButton.dataset.deleteId);
    }
  });

  selectAll.addEventListener("change", () => {
    cartItems.forEach((item) => {
      item.selected = selectAll.checked;
    });
    renderCart();
  });

  deleteSelectedButton.addEventListener("click", async () => {
    const selectedIds = cartItems
      .filter((item) => item.selected)
      .map((item) => item.cartItemId);

    for (const id of selectedIds) {
      await deleteItem(id);
    }
  });

  checkoutButton.addEventListener("click", () => {
    const selectedIds = cartItems
      .filter((item) => item.selected)
      .map((item) => item.cartItemId);

    if (!selectedIds.length) return;

    sessionStorage.setItem(
      "catchcatch.checkoutCartItemIds",
      JSON.stringify(selectedIds)
    );

    location.href = "checkout.html";
  });

  loadCart();
})();
