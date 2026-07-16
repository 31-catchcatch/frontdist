// wishlist.js
// GET  /api/v1/users/me/wishlist
// POST /api/v1/products/{productId}/like

document.addEventListener("DOMContentLoaded", () => {
  if (
    !window.CatchAuth ||
    typeof CatchAuth.requireLogin !== "function"
  ) {
    console.error(
      "CatchAuth.requireLogin()을 찾을 수 없습니다. auth.js를 확인하세요."
    );
    return;
  }

  // 비로그인 상태이면 로그인 페이지로 이동 후 실행 중단
  if (!CatchAuth.requireLogin()) {
    return;
  }

  let wishItems = [];

  const $ = (selector) => document.querySelector(selector);

  const won = (value) =>
    `${Number(value ?? 0).toLocaleString("ko-KR")}원`;

  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const getResponseData = (response) => {
    return response?.data ?? response;
  };

  const getWishlistContent = (result) => {
    const data = getResponseData(result);

    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.content)) {
      return data.content;
    }

    return [];
  };

  const getErrorMessage = async (
    response,
    defaultMessage
  ) => {
    try {
      const result = await response.json();

      return (
        result?.message ||
        result?.data?.message ||
        defaultMessage
      );
    } catch {
      return defaultMessage;
    }
  };

  const handleUnauthorized = () => {
    alert("로그인이 필요한 서비스입니다.");
    location.href = "login.html";
  };

  const cardHTML = (item) => {
    const productId = Number(item.productId);
    const productName =
      item.name ?? "상품명 없음";

    const imageUrl =
      item.thumbnailUrl ||
      "https://placehold.co/300x400?text=NO+IMAGE";

    const price =
      Number(item.price ?? 0);

    const discountRate =
      Number(item.discountRate ?? 0);

    const finalPrice =
      Number(item.finalPrice ?? price);

    return `
      <div
        class="wish-card"
        data-id="${productId}"
      >
        <a
          href="product-detail.html?id=${productId}"
          class="wish-thumb"
        >
          <img
            src="${escapeHtml(imageUrl)}"
            alt="${escapeHtml(productName)}"
            onerror="this.src='https://placehold.co/300x400?text=NO+IMAGE'"
          >
        </a>

        <input
          type="checkbox"
          class="wish-check"
          data-action="check-item"
          aria-label="${escapeHtml(productName)} 선택"
          ${item.checked ? "checked" : ""}
        >

        <button
          type="button"
          class="wish-remove"
          data-action="remove"
          aria-label="${escapeHtml(productName)} 찜 해제"
        >
          ✕
        </button>

        <a
          href="product-detail.html?id=${productId}"
          class="wish-name"
        >
          ${escapeHtml(productName)}
        </a>

        <div class="wish-price">
          ${
            discountRate > 0
              ? `
                <span class="wish-discount">
                  ${discountRate.toLocaleString("ko-KR")}%
                </span>

                <span class="wish-original">
                  ${won(price)}
                </span>
              `
              : ""
          }

          <span class="wish-final">
            ${won(finalPrice)}
          </span>
        </div>

        <button
          type="button"
          class="btn-add-cart"
          data-action="add-cart"
        >
          장바구니 담기
        </button>
      </div>
    `;
  };

  const render = () => {
    const body =
      $('[data-role="wish-body"]');

    const empty =
      $('[data-role="wish-empty"]');

    const grid =
      $('[data-role="wish-grid"]');

    const total =
      $('[data-role="total"]');

    const totalCount2 =
      $('[data-role="total-count2"]');

    const checkedCount =
      $('[data-role="checked-count"]');

    const checkAll =
      $('[data-action="check-all"]');

    if (
      !body ||
      !empty ||
      !grid ||
      !total ||
      !totalCount2 ||
      !checkedCount ||
      !checkAll
    ) {
      console.error(
        "위시리스트 HTML 요소를 찾을 수 없습니다."
      );
      return;
    }

    if (wishItems.length === 0) {
      body.hidden = true;
      empty.hidden = false;

      grid.innerHTML = "";

      total.textContent = "0";
      totalCount2.textContent = "0";
      checkedCount.textContent = "0";

      checkAll.checked = false;
      checkAll.indeterminate = false;

      return;
    }

    body.hidden = false;
    empty.hidden = true;

    grid.innerHTML =
      wishItems.map(cardHTML).join("");

    const selectedItems =
      wishItems.filter(
        (item) => item.checked
      );

    total.textContent =
      wishItems.length.toLocaleString("ko-KR");

    totalCount2.textContent =
      wishItems.length.toLocaleString("ko-KR");

    checkedCount.textContent =
      selectedItems.length.toLocaleString("ko-KR");

    checkAll.checked =
      selectedItems.length === wishItems.length;

    checkAll.indeterminate =
      selectedItems.length > 0 &&
      selectedItems.length < wishItems.length;
  };

  const renderLoading = () => {
    const body =
      $('[data-role="wish-body"]');

    const empty =
      $('[data-role="wish-empty"]');

    const grid =
      $('[data-role="wish-grid"]');

    if (body) {
      body.hidden = false;
    }

    if (empty) {
      empty.hidden = true;
    }

    if (grid) {
      grid.innerHTML = `
        <p class="wish-loading">
          위시리스트를 불러오는 중입니다.
        </p>
      `;
    }
  };

  const loadWishlist = async () => {
    renderLoading();

    try {
      const response = await fetch(
        "/api/v1/users/me/wishlist?page=0&size=100",
        {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json"
          }
        }
      );

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        const errorMessage =
          await getErrorMessage(
            response,
            `위시리스트 조회에 실패했습니다. (${response.status})`
          );

        throw new Error(errorMessage);
      }

      const result =
        await response.json();

      const content =
        getWishlistContent(result);

      wishItems = content.map((item) => ({
        productId:
          Number(item.productId),

        name:
          item.name ?? "",

        price:
          Number(item.price ?? 0),

        discountRate:
          Number(item.discountRate ?? 0),

        finalPrice:
          Number(item.finalPrice ?? 0),

        thumbnailUrl:
          item.thumbnailUrl ?? "",

        likedAt:
          item.likedAt ?? null,

        checked: false
      }));

      render();
    } catch (error) {
      console.error(
        "위시리스트 조회 오류:",
        error
      );

      wishItems = [];
      render();

      alert(
        error.message ||
        "위시리스트를 불러오지 못했습니다."
      );
    }
  };

  const toggleLike = async (productId) => {
    const response = await fetch(
      `/api/v1/products/${productId}/like`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json"
        }
      }
    );

    if (
      response.status === 401 ||
      response.status === 403
    ) {
      handleUnauthorized();
      return null;
    }

    if (!response.ok) {
      const errorMessage =
        await getErrorMessage(
          response,
          `찜 상태 변경에 실패했습니다. (${response.status})`
        );

      throw new Error(errorMessage);
    }

    const result =
      await response.json();

    const data =
      getResponseData(result);

    return Boolean(data?.liked);
  };

  const wishGrid =
    $('[data-role="wish-grid"]');

  if (!wishGrid) {
    console.error(
      'data-role="wish-grid" 요소가 없습니다.'
    );
    return;
  }

  wishGrid.addEventListener(
    "click",
    async (event) => {
      const card =
        event.target.closest(".wish-card");

      if (!card) {
        return;
      }

      const productId =
        Number(card.dataset.id);

      const item =
        wishItems.find(
          (wishItem) =>
            wishItem.productId === productId
        );

      if (!item) {
        return;
      }

      const action =
        event.target.dataset.action;

      if (action === "remove") {
        if (
          !confirm(
            "위시리스트에서 삭제할까요?"
          )
        ) {
          return;
        }

        const button =
          event.target;

        button.disabled = true;

        try {
          const liked =
            await toggleLike(productId);

          if (liked === null) {
            return;
          }

          if (liked === false) {
            wishItems =
              wishItems.filter(
                (wishItem) =>
                  wishItem.productId !==
                  productId
              );

            render();
            return;
          }

          await loadWishlist();
        } catch (error) {
          console.error(
            "찜 해제 오류:",
            error
          );

          alert(
            error.message ||
            "위시리스트에서 삭제하지 못했습니다."
          );

          button.disabled = false;
        }

        return;
      }

      if (action === "add-cart") {
        location.href =
          `product-detail.html?id=${productId}`;
      }
    }
  );

  wishGrid.addEventListener(
    "change",
    (event) => {
      if (
        event.target.dataset.action !==
        "check-item"
      ) {
        return;
      }

      const card =
        event.target.closest(".wish-card");

      if (!card) {
        return;
      }

      const productId =
        Number(card.dataset.id);

      const item =
        wishItems.find(
          (wishItem) =>
            wishItem.productId === productId
        );

      if (!item) {
        return;
      }

      item.checked =
        event.target.checked;

      render();
    }
  );

  const checkAllButton =
    $('[data-action="check-all"]');

  checkAllButton?.addEventListener(
    "change",
    (event) => {
      const checked =
        event.target.checked;

      wishItems.forEach((item) => {
        item.checked = checked;
      });

      render();
    }
  );

  const deleteCheckedButton =
    $('[data-action="delete-checked"]');

  deleteCheckedButton?.addEventListener(
    "click",
    async (event) => {
      const selectedItems =
        wishItems.filter(
          (item) => item.checked
        );

      if (
        selectedItems.length === 0
      ) {
        alert(
          "삭제할 상품을 선택해 주세요."
        );
        return;
      }

      if (
        !confirm(
          `선택한 ${selectedItems.length}개 상품을 위시리스트에서 삭제할까요?`
        )
      ) {
        return;
      }

      const button =
        event.currentTarget;

      button.disabled = true;

      try {
        const results =
          await Promise.allSettled(
            selectedItems.map(
              async (item) => {
                const liked =
                  await toggleLike(
                    item.productId
                  );

                if (liked === null) {
                  throw new Error(
                    "로그인이 필요합니다."
                  );
                }

                if (liked === true) {
                  throw new Error(
                    `${item.name} 상품의 찜 해제에 실패했습니다.`
                  );
                }

                return item.productId;
              }
            )
          );

        const successIds = results
          .filter(
            (result) =>
              result.status ===
              "fulfilled"
          )
          .map(
            (result) =>
              result.value
          );

        wishItems =
          wishItems.filter(
            (item) =>
              !successIds.includes(
                item.productId
              )
          );

        render();

        const failedCount =
          results.length -
          successIds.length;

        if (failedCount > 0) {
          alert(
            `${failedCount}개 상품을 삭제하지 못했습니다.`
          );
        }
      } catch (error) {
        console.error(
          "선택 삭제 오류:",
          error
        );

        alert(
          error.message ||
          "선택한 상품을 삭제하지 못했습니다."
        );
      } finally {
        button.disabled = false;
      }
    }
  );

  const addCartCheckedButton =
    $('[data-action="add-cart-checked"]');

  addCartCheckedButton?.addEventListener(
    "click",
    () => {
      const selectedItems =
        wishItems.filter(
          (item) => item.checked
        );

      if (
        selectedItems.length === 0
      ) {
        alert(
          "담을 상품을 선택해 주세요."
        );
        return;
      }

      if (
        selectedItems.length > 1
      ) {
        alert(
          "상품별 옵션 선택이 필요하여 첫 번째 상품 상세 페이지로 이동합니다."
        );
      }

      location.href =
        `product-detail.html?id=${selectedItems[0].productId}`;
    }
  );

  loadWishlist();
});