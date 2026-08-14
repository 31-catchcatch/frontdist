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
        count("/users?size=1"),                              // 전체 사용자 수
        count("/products?size=1"),                           // 전체 상품 수
        count("/sellers/applications?status=PENDING"),       // 대기 입점신청 수
        count("/coupons/requests?size=1"),                   // 대기 쿠폰요청 수
        AdminApi.list("/qna?size=200"),                      // 전체 문의(미답변 집계용)
      ]);

      set("mUsers", AdminUI.num(users));
      set("mProducts", AdminUI.num(products));
      set("mRequests", AdminUI.num(pendingApps + pendingCoupons)); // 입점 + 쿠폰 요청 대기
      set("mQna", AdminUI.num(qnaList.filter((q) => q && q.answered === false).length)); // 미답변 문의
    } catch (err) {
      console.warn("대시보드 요약 로드 실패:", err.message);
      // 실패 시 카드는 — 로 유지
    }
  }

  load();
})();
