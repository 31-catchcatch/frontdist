(function (global) {
  "use strict";


  const SLUG_TO_NAME = {
    outer: "아우터",
    top: "상의",
    shirts: "셔츠",
    knit: "니트",
    pants: "팬츠",
    denim: "데님",
    shoes: "신발",
    bag: "가방",
    acc: "액세서리",
  };


  let categoriesPromise = null;

  function flatten(nodes, out) {
    (nodes || []).forEach((node) => {
      out.push({ categoryId: node.categoryId, name: node.name });
      if (Array.isArray(node.children) && node.children.length) {
        flatten(node.children, out);
      }
    });
    return out;
  }

  const CatchCatalog = {
    SLUG_TO_NAME,


    categories() {
      if (!categoriesPromise) {
        categoriesPromise = CatchApi.get("/categories")
          .then((tree) => flatten(tree, []))
          .catch(() => {
            categoriesPromise = null;
            return [];
          });
      }
      return categoriesPromise;
    },

    async idBySlug(slug) {
      if (!slug) return null;
      const name = SLUG_TO_NAME[slug];
      if (!name) return null;
      const flat = await this.categories();
      const found = flat.find((c) => c.name === name);
      return found ? found.categoryId : null;
    },

    async slugById(categoryId) {
      if (categoryId == null) return null;
      const flat = await this.categories();
      const found = flat.find((c) => String(c.categoryId) === String(categoryId));
      if (!found) return null;
      const entry = Object.keys(SLUG_TO_NAME).find((slug) => SLUG_TO_NAME[slug] === found.name);
      return entry || null;
    },

    async brands() {
      try {
        return (await CatchApi.get("/brands")) || [];
      } catch (_) {
        return [];
      }
    },


    initial(name) {
      if (!name) return "#";
      const CHO = [
        "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
        "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
      ];
      const ch = name.trim().charAt(0);
      const code = ch.charCodeAt(0);

      if (code >= 0xac00 && code <= 0xd7a3) {
        return CHO[Math.floor((code - 0xac00) / 588)];
      }

      if (/[a-zA-Z]/.test(ch)) return ch.toUpperCase();
      return "#";
    },
  };

  global.CatchCatalog = CatchCatalog;
})(window);
