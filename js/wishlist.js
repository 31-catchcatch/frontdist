// wishlist.js — 위시리스트 페이지 mock 스크립트
// U-HEAD-002 / U-WISH-001 / U-PROD-004
// 로그인 필요 페이지

document.addEventListener("DOMContentLoaded", () => {

  // ===== 로그인 안 했으면 로그인 페이지로 (U-HEAD-002) =====
  // if (!CatchAuth.requireLogin()) return;

  // ===== 가짜 위시리스트 데이터 =====
  // TODO: GET /api/v1/users/me/wishlist  (U-WISH-001)
  //   ⚠️ 백엔드 API 추가 필요 — 기능정의서 참고
  let wishItems = [
    {
      productId: 1,
      brand: "캐치베이직",
      name: "오버핏 울 블렌드 싱글 코트",
      price: 128000, discount: 30, finalPrice: 89600,
      soldOut: false, checked: false,
      image: "https://placehold.co/300x400/e8e8e8/999?text=COAT",
    },
    {
      productId: 5,
      brand: "무드로우",
      name: "베이직 크루넥 니트",
      price: 45000, discount: 0, finalPrice: 45000,
      soldOut: false, checked: false,
      image: "https://placehold.co/300x400/f0f0f0/999?text=KNIT",
    },
    {
      productId: 12,
      brand: "온더코너",
      name: "와이드 데님 팬츠",
      price: 59000, discount: 10, finalPrice: 53100,
      soldOut: false, checked: false,
      image: "https://placehold.co/300x400/e0e0e0/999?text=DENIM",
    },
    {
      productId: 18,
      brand: "레이어드",
      name: "레귤러 옥스포드 셔츠",
      price: 39000, discount: 0, finalPrice: 39000,
      soldOut: true, checked: false,
      image: "https://placehold.co/300x400/eaeaea/999?text=SHIRT",
    },
    {
      productId: 23,
      brand: "폴리시",
      name: "미니멀 크로스백",
      price: 78000, discount: 20, finalPrice: 62400,
      soldOut: false, checked: false,
      image: "https://placehold.co/300x400/e5e5e5/999?text=BAG",
    },
    {
      productId: 31,
      brand: "캐치베이직",
      name: "코튼 후드 집업",
      price: 52000, discount: 0, finalPrice: 52000,
      soldOut: false, checked: false,
      image: "https://placehold.co/300x400/ededed/999?text=HOOD",
    },
  ];

  const $ = (sel) => document.querySelector(sel);
  const won = (n) => n.toLocaleString("ko-KR") + "원";

// ===== 카드 하나 HTML =====
  function cardHTML(item) {
    return `
      <div class="wish-card" data-id="${item.productId}">
        <a href="product-detail.html?id=${item.productId}" class="wish-thumb">
          <img src="${item.image}" alt="${item.name}">
          ${item.soldOut ? `<div class="wish-soldout">품절</div>` : ""}
        </a>

        <input type="checkbox" class="wish-check" data-action="check-item" ${item.checked ? "checked" : ""}>

        <button type="button" class="wish-remove" data-action="remove" aria-label="찜 해제">✕</button>

        <p class="wish-brand">${item.brand}</p>
        <a href="product-detail.html?id=${item.productId}" class="wish-name">${item.name}</a>

        <div class="wish-price">
          <span class="wish-final">${won(item.finalPrice)}</span>
        </div>

        <button type="button" class="btn-add-cart" data-action="add-cart" ${item.soldOut ? "disabled" : ""}>
          ${item.soldOut ? "품절" : "장바구니 담기"}
        </button>
      </div>
    `;
  }

  // ===== 화면 그리기 =====
  function render() {
    // 비었으면
    if (wishItems.length === 0) {
      $('[data-role="wish-body"]').hidden = true;
      $('[data-role="wish-empty"]').hidden = false;
      $('[data-role="total"]').textContent = 0;
      return;
    }
    $('[data-role="wish-body"]').hidden = false;
    $('[data-role="wish-empty"]').hidden = true;

    // 카드 그리기
    $('[data-role="wish-grid"]').innerHTML = wishItems.map(cardHTML).join("");

    // 개수
    const checked = wishItems.filter((i) => i.checked);
    $('[data-role="total"]').textContent = wishItems.length;
    $('[data-role="total-count2"]').textContent = wishItems.length;
    $('[data-role="checked-count"]').textContent = checked.length;

    // 전체선택 체크박스
    $('[data-action="check-all"]').checked =
      wishItems.length > 0 && checked.length === wishItems.length;
  }

  // ===== 그리드 클릭 (이벤트 위임) =====
  $('[data-role="wish-grid"]').addEventListener("click", (e) => {
    const card = e.target.closest(".wish-card");
    if (!card) return;

    const id = Number(card.dataset.id);
    const item = wishItems.find((i) => i.productId === id);
    const action = e.target.dataset.action;

    // 찜 해제 (U-PROD-004)
    if (action === "remove") {
      if (!confirm("위시리스트에서 삭제할까요?")) return;
      wishItems = wishItems.filter((i) => i.productId !== id);
      // TODO: POST /api/v1/products/{productId}/like  (해제 = 토글)
      render();
    }

    // 장바구니 담기
    if (action === "add-cart") {
      // TODO: POST /api/v1/carts  body: { productId, quantity: 1 }
      //   ⚠️ 사이즈 옵션이 필요하면 상품상세로 보내는 게 정확함
      if (confirm(`'${item.name}'을(를) 장바구니에 담았습니다.\n장바구니로 이동할까요?`)) {
        location.href = "shoppingcart.html";
      }
    }
  });

  // ===== 체크박스 변경 =====
  $('[data-role="wish-grid"]').addEventListener("change", (e) => {
    if (e.target.dataset.action !== "check-item") return;

    const card = e.target.closest(".wish-card");
    const id = Number(card.dataset.id);
    const item = wishItems.find((i) => i.productId === id);
    item.checked = e.target.checked;
    render();
  });

  // ===== 전체선택 =====
  $('[data-action="check-all"]').addEventListener("change", (e) => {
    const on = e.target.checked;
    wishItems.forEach((i) => (i.checked = on));
    render();
  });

  // ===== 선택삭제 =====
  $('[data-action="delete-checked"]').addEventListener("click", () => {
    const checked = wishItems.filter((i) => i.checked);
    if (checked.length === 0) {
      alert("삭제할 상품을 선택해 주세요.");
      return;
    }
    if (!confirm(`선택한 ${checked.length}개 상품을 위시리스트에서 삭제할까요?`)) return;

    wishItems = wishItems.filter((i) => !i.checked);
    // TODO: POST /api/v1/products/{productId}/like 를 선택 개수만큼 호출
    render();
  });

  // ===== 선택상품 장바구니 담기 =====
  $('[data-action="add-cart-checked"]').addEventListener("click", () => {
    const checked = wishItems.filter((i) => i.checked && !i.soldOut);

    if (checked.length === 0) {
      alert("담을 상품을 선택해 주세요. (품절 상품은 담을 수 없습니다)");
      return;
    }

    // TODO: POST /api/v1/carts 를 선택 개수만큼 호출
    if (confirm(`${checked.length}개 상품을 장바구니에 담았습니다.\n장바구니로 이동할까요?`)) {
      location.href = "shoppingcart.html";
    }
  });

  // ===== 시작 =====
  render();

});