// product-detail.js — 상품상세 (U-PROD-001~007)  URL: ?id=상품번호 [&brand=브랜드명]
//
// ⚠️ auth.js → api.js → product.js 다음에 로드된다.

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(location.search);
  const productId = Number(params.get("id"));
  const brandFromQuery = params.get("brand"); // 목록에서 넘어온 브랜드명(폴백용)
  const thumbFromQuery = params.get("thumb"); // 목록에서 넘어온 썸네일(상세 이미지 없을 때 폴백)

  const $ = (sel) => document.querySelector(sel);
  const esc = (v) => CatchApi.escape(v);
  const won = (n) => CatchApi.won(n);

  // 판매자 계정은 구매 기능(장바구니/바로구매)을 쓸 수 없다.
  // 백엔드 SecurityConfig는 /carts, /orders 를 authenticated 로만 막고 역할은 보지 않으므로
  // 서버는 판매자 요청도 그대로 처리한다. 즉 이 차단은 프론트 전용이다.
  // 역할 판별은 login.js가 심어두는 loginType 을 읽는 기존 관례를 따른다.
  //
  // isLoggedIn() 을 먼저 보는 이유: CatchAuth.logout() 이 loginType 을 지우지 않아
  // 판매자가 로그아웃해도 값이 "seller" 로 남는다. 이때 비로그인 방문자가 이 버튼을 누르면
  // 로그인 유도 대신 판매자 안내가 떠버리므로, 로그인 상태일 때만 역할을 따진다.
  function blockIfSeller() {
    if (!CatchAuth.isLoggedIn()) return false;
    if (sessionStorage.getItem("catchcatch.loginType") !== "seller") return false;
    alert("판매자는 해당 기능을 사용할 수 없습니다.");
    return true;
  }

  let product = null; // fetchDetail 결과
  let selectedOption = null; // { optionId, additionalPrice }
  let qty = 1;
  let liked = false;

  const mainEl = document.querySelector("main");

  function showError(message) {
    if (mainEl) {
      mainEl.innerHTML =
        '<div class="wrap" style="padding:80px 0;text-align:center;color:#666">' +
        '<p style="font-size:18px;margin-bottom:16px">' +
        esc(message) +
        "</p>" +
        '<a href="product-list.html" class="btn-outline" style="display:inline-block;padding:12px 28px">상품 목록으로</a>' +
        "</div>";
    }
  }

  // ===== 가격/합계 =====
  function unitPrice() {
    const add = selectedOption ? selectedOption.additionalPrice : 0;
    return product.finalPrice + add;
  }
  function updateTotal() {
    const qtyInput = $('[data-role="qty"]');
    const totalEl = $('[data-role="total-price"]');
    if (qtyInput) qtyInput.value = qty;
    if (totalEl) totalEl.textContent = won(unitPrice() * qty);
  }

  // ===== 렌더 =====
  function renderProduct() {
    // finalPrice 정규화 (상세 응답엔 finalPrice 있음)
    const price = product.price;
    const discountRate = product.discountRate || 0;
    const finalPrice = product.finalPrice != null ? product.finalPrice : price;
    product.finalPrice = finalPrice;

    // 브랜드 라벨: 목록에서 넘어온 brand 우선, 없으면 판매자명
    $('[data-role="brand"]').textContent = brandFromQuery || product.sellerName || "";
    $('[data-role="name"]').textContent = product.name;
    $('[data-role="description"]').textContent = product.description || "";
    $('[data-role="point"]').textContent = Math.floor(finalPrice * 0.01).toLocaleString("ko-KR");

    $('[data-role="final-price"]').textContent = won(finalPrice);

    const discountEl = $('[data-role="discount"]');
    const originEl = $('[data-role="origin-price"]');
    if (discountRate > 0) {
      if (discountEl) {
        discountEl.textContent = discountRate + "%";
        discountEl.hidden = false;
      }
      if (originEl) {
        originEl.innerHTML = "<s>" + won(price) + "</s>";
        originEl.hidden = false;
      }
    }

    // 이미지 갤러리
    //  1순위: 상세 이미지(product_images) → 2순위: 목록에서 넘어온 썸네일 → 3순위: 플레이스홀더
    //  (판매자 등록 상품처럼 상세 이미지가 없어도 목록 썸네일로 대표 이미지를 채운다)
    let images;
    if (Array.isArray(product.imageUrls) && product.imageUrls.length) {
      images = product.imageUrls;
    } else if (thumbFromQuery) {
      images = [thumbFromQuery];
    } else {
      images = [CatchApi.PLACEHOLDER];
    }
    const mainImg = $('[data-role="main-image"]');
    const thumbs = $('[data-role="thumbs"]');
    mainImg.src = images[0];
    mainImg.onerror = function () {
      this.onerror = null;
      this.src = CatchApi.PLACEHOLDER;
    };
    thumbs.innerHTML = images
      .map(
        (src, i) =>
          `<button type="button" class="${i === 0 ? "is-active" : ""}" data-img="${esc(src)}">` +
          `<img src="${esc(src)}" alt="상품 이미지 ${i + 1}" onerror="this.onerror=null;this.src=CatchApi.PLACEHOLDER"></button>`
      )
      .join("");

    // 옵션 → 사이즈 칩 (품절 disabled)
    const sizeChips = $('[data-role="size-chips"]');
    const options = Array.isArray(product.options) ? product.options : [];
    if (options.length === 0) {
      sizeChips.innerHTML = '<p class="pd-no-option">옵션 정보가 없습니다.</p>';
    } else {
      sizeChips.innerHTML = options
        .map((o) => {
          const soldOut = o.soldOut || o.stockQuantity === 0;
          const addTxt = o.additionalPrice ? ` (+${o.additionalPrice.toLocaleString("ko-KR")})` : "";
          return (
            `<button type="button" data-option-id="${o.optionId}" data-add="${o.additionalPrice || 0}" ${soldOut ? "disabled" : ""}>` +
            `${esc(o.optionName)}${addTxt}${soldOut ? " (품절)" : ""}</button>`
          );
        })
        .join("");

      // 옵션이 1개뿐이면 굳이 클릭 안 해도 되게 자동 선택한다.
      if (options.length === 1 && !options[0].soldOut && options[0].stockQuantity !== 0) {
        const onlyOption = options[0];
        selectedOption = {
          optionId: onlyOption.optionId,
          additionalPrice: onlyOption.additionalPrice || 0,
        };
        const onlyChip = sizeChips.querySelector("button[data-option-id]");
        if (onlyChip) onlyChip.classList.add("is-selected");
      }
    }

    updateTotal();
  }

  function stars(n) {
    const full = Math.round(n);
    return "★".repeat(full) + "☆".repeat(5 - full);
  }
  function fmtDate(iso) {
    if (!iso) return "";
    return String(iso).slice(0, 10).replace(/-/g, ".");
  }

  async function renderReviews() {
    let result;
    try {
      result = await CatchApi.page("/products/" + productId + "/reviews", { page: 0, size: 100 });
    } catch (_) {
      result = { content: [], totalElements: 0 };
    }
    const count = result.totalElements;
    document.querySelectorAll('[data-role="review-count"]').forEach((el) => {
      el.textContent = count;
    });
    const ratings = result.content.map((r) => Number(r.rating)).filter(Number.isFinite);
    const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
    $('[data-role="rating"]').textContent = avg.toFixed(1);

    const listEl = $('[data-role="review-list"]');
    if (result.content.length === 0) {
      listEl.innerHTML = '<li class="empty-row">아직 작성된 리뷰가 없습니다.</li>';
      return;
    }
    listEl.innerHTML = result.content
      .map(
        (r) =>
          "<li><div class=\"review-head\">" +
          `<span class="stars">${stars(r.rating)}</span>` +
          `<span>${esc(r.reviewerName)}</span>` +
          `<span>${fmtDate(r.createdAt)}</span></div>` +
          `<p class="review-body">${esc(r.content)}</p></li>`
      )
      .join("");
  }

  async function renderQna() {
    let result;
    try {
      result = await CatchApi.page("/products/" + productId + "/qna", { page: 0, size: 20 });
    } catch (_) {
      result = { content: [], totalElements: 0 };
    }
    document.querySelectorAll('[data-role="qna-count"]').forEach((el) => {
      el.textContent = result.totalElements;
    });
    const listEl = $('[data-role="qna-list"]');
    if (result.content.length === 0) {
      listEl.innerHTML = '<li class="empty-row">등록된 문의가 없습니다.</li>';
      return;
    }
    listEl.innerHTML = result.content
      .map((q) => {
        const answered = q.answered;
        const answer =
          answered && (q.answerContent || q.answer)
            ? `<div class="qna-a"><b>판매자 답변</b><br>${esc(q.answerContent || q.answer)}</div>`
            : "";
        return (
          "<li><div class=\"qna-q\">" +
          `<span class="badge${answered ? " is-answered" : ""}">${answered ? "답변완료" : "답변대기"}</span>` +
          `<div class="qna-q-body"><p class="qna-title">${esc(q.title)}</p>` +
          `<span class="qna-date">${fmtDate(q.createdAt)}</span></div></div>${answer}</li>`
        );
      })
      .join("");
  }

  // ===== 이벤트 바인딩 (product 로드 후) =====
  function bindInteractions() {
    // 썸네일 전환
    const thumbs = $('[data-role="thumbs"]');
    const mainImg = $('[data-role="main-image"]');
    thumbs.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-img]");
      if (!btn) return;
      mainImg.src = btn.dataset.img;
      thumbs.querySelectorAll("button").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
    });

    // 옵션 선택
    const sizeChips = $('[data-role="size-chips"]');
    sizeChips.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-option-id]");
      if (!btn || btn.disabled) return;
      selectedOption = {
        optionId: Number(btn.dataset.optionId),
        additionalPrice: Number(btn.dataset.add) || 0,
      };
      sizeChips.querySelectorAll("button").forEach((b) => b.classList.remove("is-selected"));
      btn.classList.add("is-selected");
      updateTotal();
    });

    // 수량
    $('[data-action="qty-minus"]').addEventListener("click", () => {
      if (qty > 1) {
        qty--;
        updateTotal();
      }
    });
    $('[data-action="qty-plus"]').addEventListener("click", () => {
      if (qty < 10) {
        qty++;
        updateTotal();
      } else {
        alert("최대 10개까지 구매 가능합니다.");
      }
    });

    // 찜
    const likeBtn = $('[data-action="like"]');
    likeBtn.addEventListener("click", async () => {
      const result = await CatchProduct.toggleLike(productId); // 비로그인 시 로그인 이동 + null
      if (result === null) return;
      liked = result;
      likeBtn.classList.toggle("is-liked", liked);
    });

    // 장바구니 담기
    $('[data-action="add-cart"]').addEventListener("click", async () => {
      if (blockIfSeller()) return;
      if (!requireOption()) return;
      if (!CatchAuth.requireLogin()) return;
      try {
        await CatchApi.post("/carts", {
          productId: productId,
          productOptionId: selectedOption.optionId,
          quantity: qty,
        });
        if (confirm("장바구니에 담았습니다.\n장바구니로 이동할까요?")) {
          location.href = "shoppingcart.html";
        }
      } catch (err) {
        alert(err.message || "장바구니 담기에 실패했습니다.");
      }
    });

    // 바로구매 → 장바구니 담고 주문서로
    $('[data-action="buy-now"]').addEventListener("click", async () => {
      if (blockIfSeller()) return;
      if (!requireOption()) return;
      if (!CatchAuth.requireLogin()) return;
      try {
        await CatchApi.post("/carts", {
          productId: productId,
          productOptionId: selectedOption.optionId,
          quantity: qty,
        });
        location.href = "checkout.html";
      } catch (err) {
        alert(err.message || "주문 진행에 실패했습니다.");
      }
    });

    // 탭 전환
    const tabBtns = document.querySelectorAll("[data-tab]");
    const tabPanels = document.querySelectorAll("[data-panel]");
    tabBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.tab;
        tabBtns.forEach((b) => b.classList.toggle("is-active", b === btn));
        tabPanels.forEach((p) => (p.hidden = p.dataset.panel !== target));
      });
    });
    const reviewLink = document.querySelector(".review-link");
    if (reviewLink) {
      reviewLink.addEventListener("click", (e) => {
        e.preventDefault();
        document.querySelector('[data-tab="review"]').click();
        document.querySelector(".pdetail-tabs").scrollIntoView({ behavior: "smooth" });
      });
    }

    // Q&A 등록 폼 (열기/닫기)
    const qnaForm = $('[data-role="qna-form"]');
    $('[data-action="open-qna"]').addEventListener("click", () => {
      if (!CatchAuth.requireLogin()) return;
      qnaForm.hidden = false;
    });
    $('[data-action="cancel-qna"]').addEventListener("click", () => {
      qnaForm.hidden = true;
      qnaForm.reset();
    });
    qnaForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = $("#qnaTitle").value.trim();
      const content = $("#qnaBody").value.trim();
      const secret = $("#qnaSecret") ? $("#qnaSecret").checked : false;
      if (!title || !content) {
        alert("제목과 내용을 모두 입력해 주세요.");
        return;
      }
      try {
        await CatchApi.post("/products/" + productId + "/qna", { title, content, secret });
        alert("문의가 등록되었습니다.");
        qnaForm.hidden = true;
        qnaForm.reset();
        renderQna();
      } catch (err) {
        alert(err.message || "문의 등록에 실패했습니다.");
      }
    });
  }

  function requireOption() {
    const options = Array.isArray(product.options) ? product.options : [];
    if (options.length > 0 && !selectedOption) {
      alert("옵션을 선택해 주세요.");
      return false;
    }
    return true;
  }

  // ===== 시작 =====
  (async function start() {
    if (!productId) {
      showError("잘못된 접근입니다. 상품을 찾을 수 없습니다.");
      return;
    }
    try {
      product = await CatchProduct.fetchDetail(productId);
    } catch (err) {
      showError(
        err.status === 404
          ? "존재하지 않는 상품입니다."
          : "상품 정보를 불러오지 못했습니다."
      );
      return;
    }
    renderProduct();
    bindInteractions();

    // 찜 초기 상태 (로그인 시 위시리스트 대조)
    CatchProduct.loadLikedIds().then((set) => {
      if (set.has(productId)) {
        liked = true;
        $('[data-action="like"]').classList.add("is-liked");
      }
    });

    // 최근 본 상품 기록 (latest-list.html 데이터 소스)
    CatchProduct.pushRecentlyViewed({
      productId: productId,
      name: product.name,
      brandName: brandFromQuery || "",
      finalPrice: product.finalPrice,
      thumbnailUrl:
        Array.isArray(product.imageUrls) && product.imageUrls.length
          ? product.imageUrls[0]
          : (thumbFromQuery || ""),
    });

    renderReviews();
    renderQna();
  })();
});
