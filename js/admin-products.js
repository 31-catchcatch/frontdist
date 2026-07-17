/* 관리자 - 상품 목록/삭제
   GET    /api/v1/admin/products
   DELETE /api/v1/admin/products/{productId}

   삭제 성공 후 서버에서 상품 목록을 다시 조회하여 화면을 갱신한다.
*/
(function () {
  "use strict";

  const rowsEl = document.getElementById("rows");
  const countEl = document.getElementById("count");
  const qEl = document.getElementById("q");
  const statusEl = document.getElementById("statusFilter");
  const checkAll = document.getElementById("checkAll");

  let PRODUCTS = [];

  /**
   * 백엔드 상품 응답을 화면에서 사용하는 형태로 변환
   */
  function mapRow(product) {
    return {
      // 백엔드 필드가 productId 또는 id인 경우 모두 처리
      id: product.productId ?? product.id,

      name: product.name ?? product.productName ?? "-",

      price:
        product.finalPrice ??
        product.price ??
        0,

      basePrice:
        product.price ??
        product.originalPrice ??
        0,

      discountRate:
        product.discountRate ??
        0,

      finalPrice:
        product.finalPrice ??
        product.price ??
        0,

      thumbnailUrl:
        product.thumbnailUrl ??
        product.imageUrl ??
        ""
    };
  }

  /**
   * 상품 목록 화면 출력
   */
  function render(list, total = list.length) {
    if (!list.length) {
      rowsEl.innerHTML = `
        <tr class="empty-row">
          <td colspan="9">
            조건에 맞는 상품이 없습니다.
          </td>
        </tr>
      `;

      countEl.textContent = "0";
      return;
    }

    rowsEl.innerHTML = list
      .map(
        (product) => `
          <tr data-id="${AdminUI.escape(product.id)}">
            <td class="chk">
              <input
                type="checkbox"
                aria-label="${AdminUI.escape(product.name)} 선택"
              >
            </td>

            <td class="num">
              ${AdminUI.escape(product.id)}
            </td>

            <td class="strong">
              ${AdminUI.escape(product.name)}
            </td>

            <td class="muted">-</td>

            <td class="num">
              ${AdminUI.won(product.price)}
            </td>

            <td>
              <span class="tag ok">판매중</span>
            </td>

            <td class="num muted">-</td>

            <td class="muted">-</td>

            <td>
              <div class="row-actions">
                <button
                  type="button"
                  class="btn sm"
                  data-act="detail"
                >
                  상세
                </button>

                <button
                  type="button"
                  class="btn sm danger"
                  data-act="delete"
                >
                  삭제
                </button>
              </div>
            </td>
          </tr>
        `
      )
      .join("");

    countEl.textContent = String(total);
  }

  /**
   * 관리자 공통 페이징 기능
   */
  const listController = AdminUI.createListController({
    pager: document.querySelector(".pager"),
    render,
    pageSize: 5
  });

  /**
   * 검색 조건 적용
   */
  function applyFilter() {
    const keyword = qEl.value.trim().toLowerCase();

    const filteredProducts = PRODUCTS.filter((product) => {
      if (!keyword) return true;

      const productName = String(product.name ?? "").toLowerCase();
      const productId = String(product.id ?? "").toLowerCase();

      return (
        productName.includes(keyword) ||
        productId.includes(keyword)
      );
    });

    listController.setItems(filteredProducts);
  }

  qEl.addEventListener("input", applyFilter);

  if (statusEl) {
    statusEl.addEventListener("change", applyFilter);
  }

  /**
   * 전체 체크박스
   */
  if (checkAll) {
    checkAll.addEventListener("change", (event) => {
      rowsEl
        .querySelectorAll('input[type="checkbox"]')
        .forEach((checkbox) => {
          checkbox.checked = event.target.checked;
        });
    });
  }

  /**
   * 상품 상세 및 삭제 버튼 처리
   */
  rowsEl.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-act]");

    if (!button) return;

    const row = button.closest("tr");
    if (!row) return;

    const productId = row.dataset.id;

    const product = PRODUCTS.find(
      (item) => String(item.id) === String(productId)
    );

    if (!product) {
      AdminUI.toast("상품 정보를 찾지 못했습니다.");
      return;
    }

    const action = button.dataset.act;

    /**
     * 상품 상세
     */
    if (action === "detail") {
      AdminUI.detail("상품 상세", [
        ["상품 ID", product.id],
        ["상품명", product.name],
        ["정상가", AdminUI.won(product.basePrice)],
        ["할인율", `${product.discountRate}%`],
        ["판매가", AdminUI.won(product.finalPrice)],
        ["썸네일", product.thumbnailUrl || "(없음)"]
      ]);

      return;
    }

    /**
     * 상품 삭제
     */
    if (action === "delete") {
      const confirmed = await AdminUI.confirm({
        title: "상품 강제 삭제",
        message:
          `[${product.name}] 상품을 삭제합니다. ` +
          "진행하시겠습니까?",
        okText: "삭제",
        danger: true
      });

      if (!confirmed) return;

      const originalText = button.textContent;

      try {
        button.disabled = true;
        button.textContent = "삭제 중...";

        console.log("삭제 요청 상품 ID:", product.id);

        /*
         * 실제 요청:
         * DELETE /api/v1/admin/products/{productId}
         */
        await AdminApi.del(`/products/${product.id}`);

        console.log("상품 삭제 API 성공:", product.id);

        /*
         * 삭제 성공 후 브라우저 배열만 수정하지 않고
         * 백엔드에서 최신 목록을 다시 조회한다.
         */
        await load();

        AdminUI.toast("상품이 삭제되었습니다.");
      } catch (error) {
        console.error("상품 삭제 실패:", error);

        AdminUI.toast(
          error.message || "삭제에 실패했습니다."
        );
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  });

  /**
   * 백엔드 상품 목록 조회
   */
  async function load() {
    try {
      rowsEl.innerHTML = `
        <tr class="empty-row">
          <td colspan="9">
            상품 목록을 불러오는 중입니다.
          </td>
        </tr>
      `;

      /*
       * 삭제 직후 이전 GET 응답이 캐시되는 것을 막기 위해
       * 현재 시간을 쿼리 파라미터로 추가한다.
       */
      const cacheKey = Date.now();

      const data = await AdminApi.list(
        `/products?size=200&_=${cacheKey}`
      );

      PRODUCTS = data
        .map(mapRow)
        .filter((product) => {
          return (
            product.id !== null &&
            product.id !== undefined
          );
        });

      if (checkAll) {
        checkAll.checked = false;
      }

      applyFilter();

      console.log(
        "관리자 상품 목록 조회 완료:",
        PRODUCTS
      );

      return PRODUCTS;
    } catch (error) {
      console.error(
        "관리자 상품 목록 조회 실패:",
        error
      );

      rowsEl.innerHTML = `
        <tr class="empty-row">
          <td colspan="9">
            ${AdminUI.escape(
              error.message ||
              "목록을 불러오지 못했습니다."
            )}
          </td>
        </tr>
      `;

      countEl.textContent = "0";

      throw error;
    }
  }

  /**
   * 페이지 최초 실행
   */
  load().catch(() => {
    // 오류 화면은 load() 내부에서 출력
  });
})();