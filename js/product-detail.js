document.addEventListener("DOMContentLoaded", () => {
  const DIRECT_CHECKOUT_KEY = "catchcatch.directCheckoutItem";
  const CART_CHECKOUT_IDS_KEY = "catchcatch.checkoutCartItemIds";
  const params = new URLSearchParams(location.search);
  const productId = Number(params.get("id"));

  const $ = (sel) => document.querySelector(sel);
  const won = (n) => CatchApi.won(n);

  function blockIfSeller() {
    if (!CatchAuth.isLoggedIn()) return false;
    if (CatchAuth.loginType() !== "seller") return false;
    alert("판매자는 해당 기능을 사용할 수 없습니다.");
    return true;
  }

  let product = null;
  let selectedOption = null;
  let qty = 1;
  let liked = false;
  let galleryImages = [];
  let currentImageIndex = 0;

  const mainEl = document.querySelector("main");

  function showError(message) {
    if (mainEl) {
      mainEl.innerHTML =
        '<div class="wrap state-error-page">' +
        '<p class="state-error-msg">' +
        message +
        "</p>" +
        '<a href="product-list.html" class="btn-outline btn-cta">상품 목록으로</a>' +
        "</div>";
    }
  }


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


  function renderProduct() {
    const price = product.price;
    const discountRate = product.discountRate || 0;
    const finalPrice = product.finalPrice != null ? product.finalPrice : price;
    product.finalPrice = finalPrice;


    $('[data-role="brand"]').textContent = product.brandName || product.sellerName || "";
    $('[data-role="seller"]').textContent = product.sellerName || "정보 없음";
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


    let images;
    if (Array.isArray(product.imageUrls) && product.imageUrls.length) {
      images = product.imageUrls;
    } else if (product.thumbnailUrl) {
      images = [SafeUrl(product.thumbnailUrl)];
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
          `<button type="button" class="${i === 0 ? "is-active" : ""}" data-img="${SafeUrl(src)}" data-index="${i}">` +
          `<img src="${SafeUrl(src)}" alt="상품 이미지 ${i + 1}" onerror="this.onerror=null;this.src=CatchApi.PLACEHOLDER"></button>`
      )
      .join("");
    galleryImages = images;
    currentImageIndex = 0;
    syncDownloadButton();


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


  function syncDownloadButton() {
    const wrap = $('[data-role="download-wrap"]');
    if (!wrap) return;
    const src = galleryImages[currentImageIndex];
    wrap.hidden = !src || src === CatchApi.PLACEHOLDER;
  }


  function imageFileName(src, index, mimeType) {
    let name = "";
    try {
      name = decodeURIComponent(new URL(src, location.href).pathname.split("/").pop() || "");
    } catch (_) {

    }
    name = name.replace(/[\\/:*?"<>|]/g, "_").trim();
    if (!/\.[a-z0-9]{2,5}$/i.test(name)) {


      const sub = /^image\/[a-z0-9.+-]+$/i.test(mimeType || "") ? mimeType.split("/")[1].split("+")[0] : "";
      const ext = /^[a-z0-9]{2,5}$/i.test(sub) ? sub : "jpg";
      name = `catchcatch-${productId}-${index + 1}.${ext}`;
    }
    return name;
  }

  function saveBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function downloadCurrentImage(btn) {
    const index = currentImageIndex;
    const src = galleryImages[index];
    if (!src || src === CatchApi.PLACEHOLDER) return;

    const label = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = "저장 중…";
    try {
      const response = await fetch(src, { cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const blob = await response.blob();
      saveBlob(blob, imageFileName(src, index, blob.type));
    } catch (_) {
      const safe = SafeUrl(src);
      if (safe !== "#" && new URL(safe, location.href).origin === location.origin) {
        window.open(safe, "_blank", "noopener");
      } else {
        alert("이미지를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
    } finally {
      btn.disabled = false;
      btn.innerHTML = label;
    }
  }


  function bindInteractions() {

    const thumbs = $('[data-role="thumbs"]');
    const mainImg = $('[data-role="main-image"]');
    thumbs.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-img]");
      if (!btn) return;
      mainImg.src = btn.dataset.img;
      thumbs.querySelectorAll("button").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      currentImageIndex = Number(btn.dataset.index) || 0;
      syncDownloadButton();
    });


    const downloadBtn = $('[data-action="download-image"]');
    if (downloadBtn) {
      downloadBtn.addEventListener("click", () => downloadCurrentImage(downloadBtn));
    }


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


    const likeBtn = $('[data-action="like"]');
    likeBtn.addEventListener("click", async () => {
      const result = await CatchProduct.toggleLike(productId);
      if (result === null) return;
      liked = result;
      likeBtn.classList.toggle("is-liked", liked);
    });


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

    $('[data-action="buy-now"]').addEventListener("click", async (event) => {
      if (blockIfSeller()) return;
      if (!requireOption()) return;
      if (!CatchAuth.requireLogin()) return;
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const draft = await CatchApi.post("/orders/prepare", {
          items: [{
            productId: productId,
            optionId: selectedOption ? selectedOption.optionId : null,
            quantity: qty,
          }],
        });
        sessionStorage.removeItem(DIRECT_CHECKOUT_KEY);
        sessionStorage.removeItem(CART_CHECKOUT_IDS_KEY);
        location.href = "checkout.html?draft=" + encodeURIComponent(draft.draftId);
      } catch (err) {
        button.disabled = false;
        alert(err.message || "주문 진행에 실패했습니다.");
      }
    });


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


    CatchProduct.loadLikedIds().then((set) => {
      if (set.has(productId)) {
        liked = true;
        $('[data-action="like"]').classList.add("is-liked");
      }
    });


    CatchProduct.pushRecentlyViewed({
      productId: productId,
      name: product.name,
      brandName: product.brandName || "",
      finalPrice: product.finalPrice,
      thumbnailUrl:
        Array.isArray(product.imageUrls) && product.imageUrls.length
          ? product.imageUrls[0]
          : (product.thumbnailUrl || ""),
    });

    renderReviews();
    renderQna();
  })();
});
