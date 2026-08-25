(function () {
  "use strict";

  function set(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  async function count(path) {
    const data = await AdminApi.get(path);
    if (data && typeof data.totalElements === "number") return data.totalElements;
    if (Array.isArray(data)) return data.length;
    if (data && Array.isArray(data.content)) return data.content.length;
    return 0;
  }

  async function load() {
    try {
      const [users, products, pendingApps, pendingCoupons, qnaList] = await Promise.all([
        count("/users?size=1"),
        count("/products?size=1"),
        count("/sellers/applications?status=PENDING"),
        count("/coupons/requests?size=1"),
        AdminApi.list("/qna?size=200"),
      ]);

      set("mUsers", AdminUI.num(users));
      set("mProducts", AdminUI.num(products));
      set("mRequests", AdminUI.num(pendingApps + pendingCoupons));
      set("mQna", AdminUI.num(qnaList.filter((q) => q && q.answered === false).length));
    } catch (err) {
      console.warn("대시보드 요약 로드 실패:", err.message);

    }
  }

  load();
})();
