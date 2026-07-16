// recent-products.js — 최근 본 상품 공용 유틸 (U-MY-008, localStorage 방식)
// ------------------------------------------------------------------
// 저장 위치 : localStorage["catchcatch.recentProducts"]
// 저장 형태 : [{ productId, name, price, discountRate, finalPrice,
//               thumbnailUrl, brandName, viewedAt }, ...]  (최신순, 최대 20개)
//
// 사용법
//   기록 : CatchRecent.add({ productId, name, price, ... })   ← 상품 상세 진입 시
//   조회 : CatchRecent.list()                                  ← latest-list, mypage
//   개수 : CatchRecent.count()
//
// 특징/한계 (localStorage 방식이라 생기는 것)
//   - 백엔드/서버 작업 없음. 브라우저에 저장되므로 기기·브라우저 간 공유는 안 됨.
//   - 같은 브라우저를 여러 계정이 쓰면 목록이 섞임 (로그아웃해도 유지).
//   - 상품이 삭제/수정돼도 저장 시점 스냅샷이 보임 (클릭하면 상세에서 걸러짐).
// ------------------------------------------------------------------

(function () {
  "use strict";

  const KEY = "catchcatch.recentProducts";
  const MAX_SIZE = 20;

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function write(items) {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch (e) {
      // 저장공간 초과 등 — 최근 본 상품은 부가 기능이므로 조용히 무시
      console.warn("최근 본 상품 저장 실패:", e);
    }
  }

  /**
   * 상품 조회 기록. 같은 상품을 다시 보면 맨 앞으로 이동(중복 제거)한다.
   * @param {object} product - productId 필수, 나머지는 카드 표시용 스냅샷
   */
  function add(product) {
    const productId = Number(product?.productId ?? product?.id);
    if (!Number.isFinite(productId)) return;

    const items = read().filter(
      (item) => Number(item.productId) !== productId
    );

    items.unshift({
      productId,
      name: product.name ?? "",
      price: product.price ?? null,
      discountRate: product.discountRate ?? product.discount ?? 0,
      finalPrice: product.finalPrice ?? product.price ?? null,
      thumbnailUrl: product.thumbnailUrl ?? product.image ?? null,
      brandName: product.brandName ?? product.brand ?? "",
      viewedAt: new Date().toISOString(),
    });

    write(items.slice(0, MAX_SIZE));
  }

  /** 최신순 목록 반환 */
  function list() {
    return read();
  }

  /** 저장된 개수 */
  function count() {
    return read().length;
  }

  /** 전체 비우기 (설정/테스트용) */
  function clear() {
    try {
      localStorage.removeItem(KEY);
    } catch (_) { /* 무시 */ }
  }

  window.CatchRecent = { add, list, count, clear, KEY };
})();
