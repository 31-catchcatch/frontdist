/* 관리자 - 운영 대시보드 요약
   ※ 백엔드 /admin/dashboard 요약 엔드포인트가 없어졌으므로,
     정상 작동하는 개별 목록 API를 조합해 4개 카드를 실시간 집계한다. (프론트 전용) */
(function () {
  "use strict";

  function set(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  // Page 응답이면 totalElements, List 응답이면 배열 길이로 개수 반환
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
