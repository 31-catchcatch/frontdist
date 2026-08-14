(function (global) {
  "use strict";

  const RECENT_KEY = "catchcatch.recentViews";
  const RECENT_MAX = 20;

  function normalize(raw) {
    if (!raw) return null;
    const productId = raw.productId != null ? raw.productId : raw.id;
    const price = raw.price != null ? raw.price : 0;
    const discountRate = raw.discountRate != null ? raw.discountRate : 0;
    const finalPrice =
      raw.finalPrice != null ? raw.finalPrice : Math.round(price * (1 - discountRate / 100));
    return {
      productId,
      name: raw.name || "",
      brandName: raw.brandName || "",
      price,
      discountRate,
      finalPrice,
      thumbnailUrl: raw.thumbnailUrl || "",
      detailUrl:
        "product-detail.html?id=" +
        productId +
        (raw.brandName ? "&brand=" + encodeURIComponent(raw.brandName) : "") +
        (raw.thumbnailUrl ? "&thumb=" + encodeURIComponent(raw.thumbnailUrl) : ""),
    };
  }

  const CatchProduct = {
    normalize,

    // 상품 목록 조회 (정규화 + 페이징 정보)
    async fetchList({ categoryId, brandId, keyword, page = 0, size = 12, sort = "createdAt,desc" } = {}) {
      const result = await CatchApi.page("/products", {
        categoryId,
        brandId,
        keyword,
        page,
        size,
        sort,
      });
      return {
        items: result.content.map(normalize).filter(Boolean),
        page: result.page,
        size: result.size,
        totalElements: result.totalElements,
        totalPages: result.totalPages,
        last: result.last,
      };
    },

    // 상품 상세 (원본 그대로 반환 — 상세는 필드가 많아 페이지가 직접 다룸)
    fetchDetail(productId) {
      return CatchApi.get("/products/" + productId);
    },

    // 상품별 리뷰 요약 { count, avg }. 실패 시 { count:0, avg:0 }.
    async fetchReviewMeta(productId) {
      try {
        const result = await CatchApi.page("/products/" + productId + "/reviews", {
          page: 0,
          size: 100,
        });
        const count = result.totalElements;
        const ratings = result.content
          .map((r) => Number(r.rating))
          .filter((n) => Number.isFinite(n));
        const avg = ratings.length
          ? ratings.reduce((a, b) => a + b, 0) / ratings.length
          : 0;
        return { count, avg };
      } catch (_) {
        return { count: 0, avg: 0 };
      }
    },

    // 로그인 상태면 위시리스트를 한 번 받아 Set<productId>. 비로그인/실패 시 빈 Set.
    async loadLikedIds() {
      if (!global.CatchAuth || !CatchAuth.isLoggedIn()) return new Set();
      try {
        const result = await CatchApi.page("/users/me/wishlist", { page: 0, size: 200 });
        return new Set(result.content.map((w) => w.productId));
      } catch (_) {
        return new Set();
      }
    },

    // 찜 토글. 로그인 안 됐으면 로그인 페이지로 보내고 null 반환.
    async toggleLike(productId) {
      if (!global.CatchAuth || !CatchAuth.isLoggedIn()) {
        CatchAuth.requireLogin();
        return null;
      }
      const data = await CatchApi.post("/products/" + productId + "/like");
      return data && typeof data.liked === "boolean" ? data.liked : null;
    },

    // ----- 최근 본 상품 (localStorage) -----
    pushRecentlyViewed(product) {
      if (!product || product.productId == null) return;
      let list = this.getRecentlyViewed();
      list = list.filter((p) => p.productId !== product.productId);
      list.unshift({
        productId: product.productId,
        name: product.name,
        brandName: product.brandName || "",
        finalPrice: product.finalPrice,
        thumbnailUrl: product.thumbnailUrl || "",
        viewedAt: Date.now(),
      });
      if (list.length > RECENT_MAX) list = list.slice(0, RECENT_MAX);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(list));
      } catch (_) {
        /* 용량 초과 등은 무시 */
      }
    },

    getRecentlyViewed() {
      try {
        const raw = localStorage.getItem(RECENT_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (_) {
        return [];
      }
    },

    clearRecentlyViewed() {
      try {
        localStorage.removeItem(RECENT_KEY);
      } catch (_) {
        /* noop */
      }
    },
  };

  global.CatchProduct = CatchProduct;
})(window);
