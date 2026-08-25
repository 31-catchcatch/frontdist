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
        (raw.brandName ? "&brand=" + encodeURIComponent(raw.brandName) : ""),
    };
  }

  const CatchProduct = {
    normalize,


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


    fetchDetail(productId) {
      return CatchApi.get("/products/" + productId);
    },


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


    async loadLikedIds() {
      if (!global.CatchAuth || !CatchAuth.isLoggedIn()) return new Set();
      try {
        const result = await CatchApi.page("/users/me/wishlist", { page: 0, size: 200 });
        return new Set(result.content.map((w) => w.productId));
      } catch (_) {
        return new Set();
      }
    },


    async toggleLike(productId) {
      if (!global.CatchAuth || !CatchAuth.isLoggedIn()) {
        CatchAuth.requireLogin();
        return null;
      }
      const data = await CatchApi.post("/products/" + productId + "/like");
      return data && typeof data.liked === "boolean" ? data.liked : null;
    },

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

      }
    },
  };

  global.CatchProduct = CatchProduct;
})(window);
