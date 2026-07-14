// cart.js — 장바구니 페이지 mock 스크립트
// U-CART-001 목록 조회 / U-CART-002 수정 / U-CART-003 삭제
// 로그인 필요 페이지

document.addEventListener("DOMContentLoaded", () => {

  // ===== 로그인 안 했으면 로그인 페이지로 =====
  if (!CatchAuth.requireLogin()) return;

  // ===== 가짜 장바구니 데이터 =====
  // TODO: GET /api/v1/carts  (U-CART-001)
  let cartItems = [
    {
      cartItemId: 101,
      productId: 1,
      brand: "캐치베이직",
      name: "오버핏 울 블렌드 싱글 코트",
      size: "M",
      price: 128000,
      discount: 30,
      finalPrice: 89600,
      qty: 2,
      image: "https://placehold.co/300x400/e8e8e8/999?text=COAT",
      checked: true,
    },
    {
      cartItemId: 102,
      productId: 5,
      brand: "무드로우",
      name: "베이직 크루넥 니트",
      size: "L",
      price: 45000,
      discount: 0,
      finalPrice: 45000,
      qty: 1,
      image: "https://placehold.co/300x400/f0f0f0/999?text=KNIT",
      checked: true,
    },
    {
      cartItemId: 103,
      productId: 12,
      brand: "온더코너",
      name: "와이드 데님 팬츠",
      size: "S",
      price: 59000,
      discount: 10,
      finalPrice: 53100,
      qty: 1,
      image: "https://placehold.co/300x400/e0e0e0/999?text=DENIM",
      checked: false,
    },
  ];

  const $ = (sel) => document.querySelector(sel);
  const won = (n) => n.toLocaleString("ko-KR") + "원";

  const SHIPPING_FEE = 3000;
  const FREE_SHIPPING_OVER = 50000;

  // ===== 상품 하나 HTML 만들기 =====
  function itemHTML(item) {
    const lineTotal = item.finalPrice * item.qty;
    const lineOrigin = item.price * item.qty;

    return `
      <li class="cart-item" data-id="${item.cartItemId}">
        <div class="cart-item-check">
          <input type="checkbox" data-action="check-item" ${item.checked ? "checked" : ""}>
        </div>

        <a href="product-detail.html?id=${item.productId}" class="cart-item-thumb">
          <img src="${item.image}" alt="${item.name}">
        </a>

        <div class="cart-item-info">
          <p class="ci-brand">${item.brand}</p>
          <a href="product-detail.html?id=${item.productId}" class="ci-name">${item.name}</a>
          <p class="ci-option">사이즈: ${item.size}</p>

          <div class="ci-qty">
            <button type="button" data-action="qty-minus">−</button>
            <span>${item.qty}</span>
            <button type="button" data-action="qty-plus">+</button>
          </div>
        </div>

        <div class="cart-item-right">
          <span class="ci-price">${won(lineTotal)}</span>
          ${item.discount ? `<span class="ci-origin">${won(lineOrigin)}</span>` : ""}
          <button type="button" class="ci-remove" data-action="remove">삭제</button>
        </div>
      </li>
    `;
  }

  // ===== 화면 그리기 =====
  function render() {
    // 장바구니 비었으면
    if (cartItems.length === 0) {
      $('[data-role="cart-body"]').hidden = true;
      $('[data-role="cart-empty"]').hidden = false;
      return;
    }
    $('[data-role="cart-body"]').hidden = false;
    $('[data-role="cart-empty"]').hidden = true;

    // 상품 목록
    $('[data-role="cart-list"]').innerHTML = cartItems.map(itemHTML).join("");

    // 개수
    const checkedItems = cartItems.filter((i) => i.checked);
    $('[data-role="checked-count"]').textContent = checkedItems.length;
    $('[data-role="total-count"]').textContent = cartItems.length;
    $('[data-role="order-count"]').textContent = checkedItems.length;

    // 전체선택 체크박스
    $('[data-action="check-all"]').checked =
      cartItems.length > 0 && checkedItems.length === cartItems.length;

    // 금액 계산 (체크된 것만)
    const sumOrigin = checkedItems.reduce((sum, i) => sum + i.price * i.qty, 0);
    const sumFinal = checkedItems.reduce((sum, i) => sum + i.finalPrice * i.qty, 0);
    const discount = sumOrigin - sumFinal;
    const shipping = sumFinal === 0 || sumFinal >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FEE;
    const total = sumFinal + shipping;

    $('[data-role="sum-price"]').textContent = won(sumOrigin);
    $('[data-role="sum-discount"]').textContent = "-" + won(discount);
    $('[data-role="sum-shipping"]').textContent = shipping === 0 ? "무료" : won(shipping);
    $('[data-role="sum-total"]').textContent = won(total);

    // 주문 버튼 (선택 없으면 비활성)
    $('[data-action="order"]').disabled = checkedItems.length === 0;
  }

  // ===== 이벤트: 상품 목록 (이벤트 위임) =====
  $('[data-role="cart-list"]').addEventListener("click", (e) => {
    const li = e.target.closest(".cart-item");
    if (!li) return;

    const id = Number(li.dataset.id);
    const item = cartItems.find((i) => i.cartItemId === id);
    const action = e.target.dataset.action;

    // 수량 +
    if (action === "qty-plus") {
      if (item.qty >= 10) {
        alert("최대 10개까지 구매 가능합니다.");
        return;
      }
      item.qty++;
      // TODO: PUT /api/v1/carts/{cartItemId}  body: { quantity }  (U-CART-002)
      render();
    }

    // 수량 −
    if (action === "qty-minus") {
      if (item.qty <= 1) return;
      item.qty--;
      // TODO: PUT /api/v1/carts/{cartItemId}  (U-CART-002)
      render();
    }

    // 삭제
    if (action === "remove") {
      if (!confirm("이 상품을 장바구니에서 삭제할까요?")) return;
      cartItems = cartItems.filter((i) => i.cartItemId !== id);
      // TODO: DELETE /api/v1/carts/{cartItemId}  (U-CART-003)
      render();
    }
  });

  // ===== 이벤트: 체크박스 변경 =====
  $('[data-role="cart-list"]').addEventListener("change", (e) => {
    if (e.target.dataset.action !== "check-item") return;

    const li = e.target.closest(".cart-item");
    const id = Number(li.dataset.id);
    const item = cartItems.find((i) => i.cartItemId === id);
    item.checked = e.target.checked;
    render();
  });

  // ===== 전체선택 =====
  $('[data-action="check-all"]').addEventListener("change", (e) => {
    const on = e.target.checked;
    cartItems.forEach((i) => (i.checked = on));
    render();
  });

  // ===== 선택삭제 =====
  $('[data-action="delete-checked"]').addEventListener("click", () => {
    const checked = cartItems.filter((i) => i.checked);
    if (checked.length === 0) {
      alert("삭제할 상품을 선택해 주세요.");
      return;
    }
    if (!confirm(`선택한 ${checked.length}개 상품을 삭제할까요?`)) return;

    cartItems = cartItems.filter((i) => !i.checked);
    // TODO: DELETE /api/v1/carts/{cartItemId} 를 선택 개수만큼 호출  (U-CART-003)
    render();
  });

  // ===== 주문하기 =====
  $('[data-action="order"]').addEventListener("click", () => {
    const checked = cartItems.filter((i) => i.checked);
    if (checked.length === 0) {
      alert("주문할 상품을 선택해 주세요.");
      return;
    }
    // TODO: GET /api/v1/orders/checkout 으로 이동 (U-ORDER-001)
    const ids = checked.map((i) => i.cartItemId).join(",");
    location.href = `checkout.html?cartItems=${ids}`;
  });

  // ===== 시작 =====
  render();

});