// product-detail.js — 상품상세 페이지 mock 스크립트
// U-PROD-001~007  /  받는 파라미터: ?id=상품번호
// 로그인 체크는 js/auth.js의 CatchAuth 사용 (리더 제공)

document.addEventListener("DOMContentLoaded", () => {

  const params = new URLSearchParams(location.search);
  const productId = Number(params.get("id")) || 1;

  // ===== 가짜 데이터 (백엔드 나오면 API로 교체) =====
  // TODO: GET /api/v1/products/{productId}  (U-PROD-001)
  const product = {
    id: productId,
    brand: "캐치베이직",
    name: "오버핏 울 블렌드 싱글 코트",
    price: 128000,
    discount: 30,
    finalPrice: 89600,
    rating: 4.8,
    reviewCount: 128,
    liked: false,
    images: [
      "https://placehold.co/600x800/e8e8e8/999?text=IMAGE+1",
      "https://placehold.co/600x800/f0f0f0/999?text=IMAGE+2",
      "https://placehold.co/600x800/e0e0e0/999?text=IMAGE+3",
      "https://placehold.co/600x800/eaeaea/999?text=IMAGE+4",
    ],
    sizes: [
      { label: "S", stock: 5 },
      { label: "M", stock: 12 },
      { label: "L", stock: 0 },
      { label: "XL", stock: 3 },
    ],
    description: `
      <img src="https://placehold.co/800x1000/f5f5f5/999?text=DETAIL+IMAGE">
      <p>부드러운 울 혼방 소재로 제작된 오버핏 코트입니다.<br>
      가볍지만 보온성이 뛰어나 데일리로 착용하기 좋습니다.</p>
      <p>소재: 울 70%, 폴리에스터 30%<br>
      제조국: 대한민국<br>
      세탁방법: 드라이클리닝</p>
    `,
  };

  // TODO: GET /api/v1/products/{productId}/reviews  (U-PROD-005)
  const reviews = [
    { user: "김**", rating: 5, size: "M", date: "2026.07.10", body: "핏이 정말 예뻐요! 어깨가 넉넉해서 안에 니트 입어도 편합니다." },
    { user: "이**", rating: 4, size: "L", date: "2026.07.08", body: "색감 좋고 두께감도 적당해요. 다만 배송이 조금 늦었습니다." },
    { user: "박**", rating: 5, size: "S", date: "2026.07.05", body: "155cm인데 오버핏으로 딱 좋아요. 재구매 의사 있습니다." },
  ];

  // TODO: GET /api/v1/products/{productId}/qna  (U-PROD-006)
  const qnas = [
    { title: "재입고 예정 있나요?", date: "2026.07.11", answered: true, answer: "안녕하세요. L 사이즈는 7월 20일 재입고 예정입니다." },
    { title: "실측 사이즈 알려주세요", date: "2026.07.09", answered: true, answer: "M 기준 총장 105cm, 어깨 52cm, 가슴 60cm입니다." },
    { title: "다른 색상도 나오나요?", date: "2026.07.12", answered: false, answer: null },
  ];

  const $ = (sel) => document.querySelector(sel);
  const won = (n) => n.toLocaleString("ko-KR") + "원";

  let selectedSize = null;
  let qty = 1;

  // ===== 1. 기본 정보 =====
  $('[data-role="brand"]').textContent = product.brand;
  $('[data-role="name"]').textContent = product.name;
  $('[data-role="rating"]').textContent = product.rating.toFixed(1);
  $('[data-role="description"]').innerHTML = product.description;
  $('[data-role="point"]').textContent = Math.floor(product.finalPrice * 0.01).toLocaleString("ko-KR");

  document.querySelectorAll('[data-role="review-count"]').forEach((el) => {
    el.textContent = product.reviewCount;
  });

  $('[data-role="final-price"]').textContent = won(product.finalPrice);
  if (product.discount) {
    const dc = $('[data-role="discount"]');
    dc.textContent = product.discount + "%";
    dc.hidden = false;
    const og = $('[data-role="origin-price"]');
    og.textContent = won(product.price);
    og.hidden = false;
  }

  // ===== 2. 이미지 갤러리 =====
  const mainImg = $('[data-role="main-image"]');
  const thumbs = $('[data-role="thumbs"]');

  mainImg.src = product.images[0];
  thumbs.innerHTML = product.images
    .map((src, i) => `
      <button type="button" class="${i === 0 ? "is-active" : ""}" data-img="${src}">
        <img src="${src}" alt="상품 이미지 ${i + 1}">
      </button>
    `).join("");

  thumbs.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-img]");
    if (!btn) return;
    mainImg.src = btn.dataset.img;
    thumbs.querySelectorAll("button").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
  });

  // ===== 3. 사이즈 선택 =====
  const sizeChips = $('[data-role="size-chips"]');
  sizeChips.innerHTML = product.sizes
    .map((s) => `
      <button type="button" data-size="${s.label}" ${s.stock === 0 ? "disabled" : ""}>
        ${s.label}${s.stock === 0 ? " (품절)" : ""}
      </button>
    `).join("");

  sizeChips.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-size]");
    if (!btn || btn.disabled) return;
    selectedSize = btn.dataset.size;
    sizeChips.querySelectorAll("button").forEach((b) => b.classList.remove("is-selected"));
    btn.classList.add("is-selected");
  });

  // ===== 4. 수량 =====
  const qtyInput = $('[data-role="qty"]');
  const totalEl = $('[data-role="total-price"]');

  function updateTotal() {
    qtyInput.value = qty;
    totalEl.textContent = won(product.finalPrice * qty);
  }

  $('[data-action="qty-minus"]').addEventListener("click", () => {
    if (qty > 1) { qty--; updateTotal(); }
  });
  $('[data-action="qty-plus"]').addEventListener("click", () => {
    if (qty < 10) { qty++; updateTotal(); }
    else alert("최대 10개까지 구매 가능합니다.");
  });
  updateTotal();

  // ===== 5. 찜하기 (U-PROD-004) — 로그인 필요 =====
  const likeBtn = $('[data-action="like"]');
  likeBtn.addEventListener("click", () => {
    if (!CatchAuth.requireLogin()) return;

    product.liked = !product.liked;
    likeBtn.classList.toggle("is-liked", product.liked);
    // TODO: POST /api/v1/products/{productId}/like
  });

  // ===== 6. 장바구니 담기 (U-PROD-002) — 로그인 필요 =====
  $('[data-action="add-cart"]').addEventListener("click", () => {
    if (!selectedSize) {
      alert("사이즈를 선택해 주세요.");
      return;
    }
    if (!CatchAuth.requireLogin()) return;

    // TODO: POST /api/v1/carts  body: { productId, size, quantity }
    if (confirm("장바구니에 담았습니다.\n장바구니로 이동할까요?")) {
      location.href = "cart.html";
    }
  });

  // ===== 7. 바로구매 (U-PROD-003) — 로그인 필요 =====
  $('[data-action="buy-now"]').addEventListener("click", () => {
    if (!selectedSize) {
      alert("사이즈를 선택해 주세요.");
      return;
    }
    if (!CatchAuth.requireLogin()) return;

    // TODO: GET /api/v1/orders/checkout
    location.href = `checkout.html?id=${product.id}&size=${selectedSize}&qty=${qty}`;
  });

  // ===== 8. 탭 전환 =====
  const tabBtns = document.querySelectorAll("[data-tab]");
  const tabPanels = document.querySelectorAll("[data-panel]");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;
      tabBtns.forEach((b) => b.classList.toggle("is-active", b === btn));
      tabPanels.forEach((p) => (p.hidden = p.dataset.panel !== target));
    });
  });

  $(".review-link").addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelector('[data-tab="review"]').click();
    $(".pdetail-tabs").scrollIntoView({ behavior: "smooth" });
  });

  // ===== 9. 리뷰 (U-PROD-005) =====
  const stars = (n) => "★".repeat(n) + "☆".repeat(5 - n);
  $('[data-role="review-list"]').innerHTML = reviews
    .map((r) => `
      <li>
        <div class="review-head">
          <span class="stars">${stars(r.rating)}</span>
          <span>${r.user}</span>
          <span>${r.date}</span>
        </div>
        <p class="review-opt">사이즈: ${r.size}</p>
        <p class="review-body">${r.body}</p>
      </li>
    `).join("");

  // ===== 10. Q&A 목록 (U-PROD-006) =====
  function renderQna() {
    $('[data-role="qna-list"]').innerHTML = qnas
      .map((q) => `
        <li>
          <div class="qna-q">
            <span class="badge${q.answered ? " is-answered" : ""}">${q.answered ? "답변완료" : "답변대기"}</span>
            <div class="qna-q-body">
              <p class="qna-title">${q.title}</p>
              <span class="qna-date">${q.date}</span>
            </div>
          </div>
          ${q.answered ? `<div class="qna-a"><b>판매자 답변</b><br>${q.answer}</div>` : ""}
        </li>
      `).join("");

    document.querySelectorAll('[data-role="qna-count"]').forEach((el) => {
      el.textContent = qnas.length;
    });
  }
  renderQna();

  // ===== 11. Q&A 등록 (U-PROD-007) — 로그인 필요 =====
  const qnaForm = $('[data-role="qna-form"]');

  $('[data-action="open-qna"]').addEventListener("click", () => {
    if (!CatchAuth.requireLogin()) return;
    qnaForm.hidden = false;
  });

  $('[data-action="cancel-qna"]').addEventListener("click", () => {
    qnaForm.hidden = true;
    qnaForm.reset();
  });

  qnaForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = $("#qnaTitle").value.trim();
    const body = $("#qnaBody").value.trim();

    if (!title || !body) {
      alert("제목과 내용을 모두 입력해 주세요.");
      return;
    }

    // TODO: POST /api/v1/products/{productId}/qna
    //   body: { title, content, isSecret }
    qnas.unshift({
      title: title,
      date: new Date().toLocaleDateString("ko-KR").replace(/\. /g, ".").replace(/\.$/, ""),
      answered: false,
      answer: null,
    });

    renderQna();
    qnaForm.hidden = true;
    qnaForm.reset();
    alert("문의가 등록되었습니다.");
  });

});