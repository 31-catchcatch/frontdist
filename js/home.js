// home.js — 메인 페이지 (index.html)
//   - 활성 배너: GET /api/v1/banners (DB의 노출 기간/순서 적용)
//   - 현재 상품 12개: GET /api/v1/products?sort=createdAt,desc
//
// ⚠️ auth.js → api.js → product.js 다음에 로드된다.

document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("grid");
  const slider = document.getElementById("adSlider");
  const track = document.getElementById("adTrack");
  const dotsWrap = document.getElementById("sliderDots");
  const previousButton = document.getElementById("sliderPrev");
  const nextButton = document.getElementById("sliderNext");
  const bannerState = document.getElementById("bannerState");

  const tiles = ["var(--tile-1)", "var(--tile-2)", "var(--tile-3)", "var(--tile-4)"];
  const garments = ["g-tee", "g-hoodie", "g-pants", "g-jacket", "g-cap", "g-bag"];
  let likedIds = new Set();

  function resolveAssetUrl(value) {
    if (!value) return CatchApi.PLACEHOLDER;
    try {
      const apiOrigin = new URL(CatchApi.BASE, location.href).origin;
      const resolved = new URL(value, apiOrigin + "/");
      return ["http:", "https:", "data:", "blob:"].includes(resolved.protocol)
        ? resolved.href
        : CatchApi.PLACEHOLDER;
    } catch (_) {
      return CatchApi.PLACEHOLDER;
    }
  }

  function resolveBannerLink(value) {
    if (!value) return "product-list.html";
    try {
      const resolved = new URL(value, location.href);
      return ["http:", "https:"].includes(resolved.protocol)
        ? resolved.href
        : "product-list.html";
    } catch (_) {
      return "product-list.html";
    }
  }

  function thumbHTML(product, index) {
    if (product.thumbnailUrl) {
      return (
        `<img class="thumb-img" src="${CatchApi.escape(resolveAssetUrl(product.thumbnailUrl))}" alt="${CatchApi.escape(product.name)}"` +
        ` onerror="this.onerror=null;this.src=CatchApi.PLACEHOLDER">`
      );
    }
    const garment = garments[index % garments.length];
    return (
      `<div class="art" style="background:${tiles[index % tiles.length]}"></div>` +
      `<svg class="garment" viewBox="0 0 130 110" aria-hidden="true"><use href="#${garment}"/></svg>`
    );
  }

  function card(product, index) {
    const liked = likedIds.has(product.productId) ? " is-liked" : "";
    const brand = product.brandName
      ? `<span class="brand-nm">${CatchApi.escape(product.brandName)}</span>`
      : `<span class="brand-nm">&nbsp;</span>`;
    const price = product.discountRate > 0
      ? `<span class="disc">${product.discountRate}%</span><span class="price tnum">${CatchApi.won(product.finalPrice)}</span><span class="was tnum">${CatchApi.won(product.price)}</span>`
      : `<span class="price tnum">${CatchApi.won(product.finalPrice)}</span>`;

    return `<article class="card" tabindex="0" data-id="${product.productId}" data-href="${CatchApi.escape(product.detailUrl)}" aria-label="${CatchApi.escape(product.name)} 상세 보기">
      <div class="thumb">
        ${thumbHTML(product, index)}
        <button class="like${liked}" data-like-id="${product.productId}" aria-label="찜하기"><svg viewBox="0 0 24 24"><path d="M12 20s-7-4.6-7-9.3A3.7 3.7 0 0 1 12 8a3.7 3.7 0 0 1 7 2.7C19 15.4 12 20 12 20Z"/></svg></button>
      </div>
      <div class="meta">
        ${brand}
        <span class="prod-nm">${CatchApi.escape(product.name)}</span>
        <div class="price-row">${price}</div>
      </div>
    </article>`;
  }

  function showProductSkeletons() {
    grid.innerHTML = Array.from({ length: 8 }, () =>
      '<div class="product-skeleton" aria-hidden="true"><span></span><i></i><i></i></div>'
    ).join("");
  }

  async function loadProducts() {
    try {
      const result = await CatchProduct.fetchList({ page: 0, size: 12, sort: "createdAt,desc" });
      if (result.items.length === 0) {
        grid.innerHTML = '<p class="home-empty">현재 판매 중인 상품이 없습니다.</p>';
        return;
      }
      grid.innerHTML = result.items.map(card).join("");
    } catch (_) {
      grid.innerHTML = '<p class="home-empty">상품을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>';
    } finally {
      grid.setAttribute("aria-busy", "false");
    }
  }

  grid.addEventListener("click", async (event) => {
    const likeButton = event.target.closest(".like");
    if (likeButton) {
      event.stopPropagation();
      const id = Number(likeButton.dataset.likeId);
      const liked = await CatchProduct.toggleLike(id);
      if (liked === null) return;
      likeButton.classList.toggle("is-liked", liked);
      if (liked) likedIds.add(id);
      else likedIds.delete(id);
      return;
    }
    const productCard = event.target.closest(".card[data-href]");
    if (productCard) location.href = productCard.dataset.href;
  });

  grid.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.target.closest("button")) return;
    const productCard = event.target.closest(".card[data-href]");
    if (productCard) location.href = productCard.dataset.href;
  });

  function initSlider(dots) {
    if (dots.length === 0) return;
    const slideCount = dots.length;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let index = 0;
    let timer = null;

    function moveTo(nextIndex) {
      index = (nextIndex + slideCount) % slideCount;
      track.style.transform = `translateX(-${index * 100}%)`;
      dots.forEach((dot, dotIndex) => {
        const active = dotIndex === index;
        dot.classList.toggle("on", active);
        dot.setAttribute("aria-current", active ? "true" : "false");
      });
    }

    function stopAutoSlide() {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    }

    function startAutoSlide() {
      stopAutoSlide();
      if (slideCount > 1 && !reduceMotion && !document.hidden) {
        timer = window.setInterval(() => moveTo(index + 1), 5000);
      }
    }

    dots.forEach((dot, dotIndex) => {
      dot.addEventListener("click", () => {
        moveTo(dotIndex);
        startAutoSlide();
      });
    });
    previousButton.addEventListener("click", () => {
      moveTo(index - 1);
      startAutoSlide();
    });
    nextButton.addEventListener("click", () => {
      moveTo(index + 1);
      startAutoSlide();
    });
    slider.addEventListener("mouseenter", stopAutoSlide);
    slider.addEventListener("mouseleave", startAutoSlide);
    slider.addEventListener("focusin", stopAutoSlide);
    slider.addEventListener("focusout", startAutoSlide);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopAutoSlide();
      else startAutoSlide();
    });
    moveTo(0);
    startAutoSlide();
  }

  async function loadBanners() {
    try {
      const data = await CatchApi.get("/banners");
      const banners = Array.isArray(data) ? data : [];
      if (banners.length === 0) {
        bannerState.textContent = "현재 진행 중인 프로모션이 없습니다.";
        return;
      }

      const dots = [];
      banners.forEach((banner, index) => {
        const title = banner.title || "프로모션 배너";
        const slide = document.createElement("a");
        slide.className = "ad-slide";
        slide.href = resolveBannerLink(banner.linkUrl);
        slide.setAttribute("aria-label", title);

        const image = document.createElement("img");
        image.className = "ad-image";
        image.src = resolveAssetUrl(banner.imageUrl);
        image.alt = title;
        image.loading = index === 0 ? "eager" : "lazy";
        if (index === 0) image.fetchPriority = "high";
        image.addEventListener("error", () => {
          image.remove();
          slide.classList.add("image-error");
        }, { once: true });

        const caption = document.createElement("span");
        caption.className = "ad-caption";
        const label = document.createElement("small");
        label.textContent = "PROMOTION";
        const heading = document.createElement("strong");
        heading.textContent = title;
        caption.append(label, heading);
        slide.append(image, caption);
        track.append(slide);

        const dot = document.createElement("button");
        dot.className = "slider-dot";
        dot.type = "button";
        dot.setAttribute("aria-label", `${index + 1}번째 배너: ${title}`);
        dotsWrap.append(dot);
        dots.push(dot);
      });

      bannerState.hidden = true;
      dotsWrap.hidden = banners.length <= 1;
      previousButton.hidden = banners.length <= 1;
      nextButton.hidden = banners.length <= 1;
      initSlider(dots);
    } catch (_) {
      bannerState.textContent = "배너를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.";
    } finally {
      slider.setAttribute("aria-busy", "false");
    }
  }

  showProductSkeletons();
  loadBanners();
  (async function startProducts() {
    likedIds = await CatchProduct.loadLikedIds();
    loadProducts();
  })();
});
