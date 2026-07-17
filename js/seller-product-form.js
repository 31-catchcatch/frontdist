(() => {
  "use strict";

  const FILE_UPLOAD_API = "/api/v1/files/upload";
  const SELLER_PRODUCT_API = "/api/v1/seller/products";
  const CATEGORY_API = "/api/v1/categories";
  const BRAND_API = "/api/v1/brands";

  const params = new URLSearchParams(location.search);
  const productId = params.get("id");
  const isEditMode = Boolean(productId);

  const form = document.getElementById("productForm");
  const pageTitle = document.getElementById("pageTitle");
  const pageDescription = document.getElementById("pageDescription");
  const submitButton = document.getElementById("submitButton");
  const formMessage = document.getElementById("formMessage");

  const productName = document.getElementById("productName");
  const categoryId = document.getElementById("categoryId");
  const brandId = document.getElementById("brandId");
  const price = document.getElementById("price");
  const discountRate = document.getElementById("discountRate");
  const salesStatus = document.getElementById("salesStatus");
  const description = document.getElementById("description");
  const optionRows = document.getElementById("optionRows");
  const addOptionButton = document.getElementById("addOptionButton");

  const descriptionCount = document.getElementById("descriptionCount");
  const productImages = document.getElementById("productImages");
  const imagePreviewList = document.getElementById("imagePreviewList");
  const existingImageUrls = document.getElementById("existingImageUrls");

  const normalPricePreview = document.getElementById("normalPricePreview");
  const discountRatePreview = document.getElementById("discountRatePreview");
  const finalPricePreview = document.getElementById("finalPricePreview");

  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const ALLOWED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  let selectedFiles = [];
  let savedImageUrls = [];

  function isSellerLoggedIn() {
    const loggedIn =
      sessionStorage.getItem("catchcatch.loggedIn") === "true" ||
      Boolean(sessionStorage.getItem("catchcatch.accessToken")) ||
      Boolean(localStorage.getItem("catchcatch.accessToken"));

    return (
      loggedIn &&
      sessionStorage.getItem("catchcatch.loginType") === "seller"
    );
  }

  function moveToSellerLogin() {
    const currentPage =
      `seller-product-form.html${location.search || ""}`;

    location.replace(
      `login.html?type=seller&redirect=${encodeURIComponent(currentPage)}`
    );
  }

  /*
   * file:// 더블클릭 실행에서는 디자인 확인을 위해 인증 검사를 건너뜁니다.
   * localhost 또는 실제 서버 환경에서는 판매자 로그인을 확인합니다.
   */
  if (location.protocol !== "file:" && !isSellerLoggedIn()) {
    moveToSellerLogin();
    return;
  }

  function clearLoginState() {
    sessionStorage.removeItem("catchcatch.loggedIn");
    sessionStorage.removeItem("catchcatch.loginType");
    sessionStorage.removeItem("catchcatch.accessToken");
    localStorage.removeItem("catchcatch.accessToken");
  }

  function handleUnauthorized(response) {
    if (response.status !== 401 && response.status !== 403) {
      return false;
    }

    clearLoginState();
    moveToSellerLogin();
    return true;
  }

  function showMessage(message, type = "error") {
    formMessage.textContent = message;
    formMessage.classList.add("show");
    formMessage.classList.toggle("success", type === "success");
    formMessage.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function clearMessage() {
    formMessage.textContent = "";
    formMessage.classList.remove("show", "success");
  }

  function formatPrice(value) {
    const number = Number(value);

    return Number.isFinite(number)
      ? `${Math.round(number).toLocaleString("ko-KR")}원`
      : "0원";
  }

  function updatePricePreview() {
    const normalPrice = Math.max(0, Number(price.value) || 0);
    const rate = Math.min(100, Math.max(0, Number(discountRate.value) || 0));
    const finalPrice = normalPrice * (1 - rate / 100);

    normalPricePreview.textContent = formatPrice(normalPrice);
    discountRatePreview.textContent = `${rate}%`;
    finalPricePreview.textContent = formatPrice(finalPrice);
  }

  price.addEventListener("input", updatePricePreview);
  discountRate.addEventListener("input", updatePricePreview);

  description.addEventListener("input", () => {
    descriptionCount.textContent = String(description.value.length);
  });

  function validateFile(file) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error(
        `${file.name}: JPG, PNG, WEBP 파일만 등록할 수 있습니다.`
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error(
        `${file.name}: 파일 크기는 10MB 이하여야 합니다.`
      );
    }
  }

  function renderImagePreviews() {
    const previewItems = [
      ...savedImageUrls.map((url) => ({
        type: "saved",
        url
      })),
      ...selectedFiles.map((file) => ({
        type: "file",
        url: URL.createObjectURL(file),
        file
      }))
    ];

    if (!previewItems.length) {
      imagePreviewList.innerHTML =
        '<p class="empty-preview">선택된 이미지가 없습니다.</p>';
      return;
    }

    imagePreviewList.innerHTML = previewItems.map((item, index) => `
      <div class="preview-item">
        <img src="${item.url}" alt="상품 이미지 미리보기 ${index + 1}">
        ${index === 0 ? '<span class="main-badge">대표</span>' : ""}
        <button
          class="preview-remove"
          type="button"
          data-preview-type="${item.type}"
          data-preview-index="${item.type === "saved"
            ? savedImageUrls.indexOf(item.url)
            : selectedFiles.indexOf(item.file)}"
          aria-label="이미지 삭제"
        >×</button>
      </div>
    `).join("");
  }

  productImages.addEventListener("change", () => {
    try {
      const files = Array.from(productImages.files || []);

      files.forEach(validateFile);
      selectedFiles = [...selectedFiles, ...files];

      renderImagePreviews();
      productImages.value = "";
      clearMessage();
    } catch (error) {
      showMessage(error.message);
      productImages.value = "";
    }
  });

  imagePreviewList.addEventListener("click", (event) => {
    const removeButton = event.target.closest(".preview-remove");
    if (!removeButton) return;

    const index = Number(removeButton.dataset.previewIndex);

    if (removeButton.dataset.previewType === "saved") {
      savedImageUrls.splice(index, 1);
    } else {
      selectedFiles.splice(index, 1);
    }

    renderImagePreviews();
  });

  // ----- 상품 옵션 (사이즈 등) -----
  function addOptionRow(data) {
    const row = document.createElement("div");
    row.className = "option-row";
    row.innerHTML = `
      <input type="text" class="option-name" placeholder="사이즈 등 옵션명 (예: M / 블랙)" maxlength="100" required value="${data?.optionName ?? ""}">
      <input type="number" class="option-price" placeholder="추가 금액" min="0" step="100" value="${data?.additionalPrice ?? 0}">
      <input type="number" class="option-stock" placeholder="재고 수량" min="0" step="1" value="${data?.stockQuantity ?? ""}">
      <button type="button" class="option-remove" aria-label="옵션 삭제">×</button>
    `;
    optionRows.appendChild(row);
  }

  optionRows.addEventListener("click", (event) => {
    const removeButton = event.target.closest(".option-remove");
    if (!removeButton) return;

    if (optionRows.children.length <= 1) {
      showMessage("최소 1개 이상의 옵션이 필요합니다.");
      return;
    }
    removeButton.closest(".option-row").remove();
  });

  addOptionButton.addEventListener("click", () => addOptionRow());

  function collectOptions() {
    return [...optionRows.querySelectorAll(".option-row")].map((row) => ({
      optionName: row.querySelector(".option-name").value.trim(),
      additionalPrice: Number(row.querySelector(".option-price").value || 0),
      stockQuantity: Number(row.querySelector(".option-stock").value || 0)
    }));
  }

  function flattenCategories(categories, depth = 0, output = []) {
    categories.forEach((category) => {
      output.push({
        id: category.categoryId ?? category.id,
        name: `${"　".repeat(depth)}${category.categoryName ?? category.name}`
      });

      const children =
        category.children ??
        category.subCategories ??
        [];

      if (Array.isArray(children) && children.length) {
        flattenCategories(children, depth + 1, output);
      }
    });

    return output;
  }

  async function loadCategories() {
    try {
      const response = await fetch(CATEGORY_API, {
        method: "GET",
        credentials: "include"
      });

      if (handleUnauthorized(response)) return;

      let data = {};
      try {
        data = await response.json();
      } catch (_) {}

      if (!response.ok) {
        throw new Error(data.message || "카테고리를 불러오지 못했습니다.");
      }

      const rawCategories =
        data.data ??
        data.categories ??
        data;

      const categories = Array.isArray(rawCategories)
        ? flattenCategories(rawCategories)
        : [];

      categoryId.innerHTML =
        '<option value="">카테고리 선택</option>' +
        categories.map((category) => `
          <option value="${category.id}">
            ${category.name}
          </option>
        `).join("");
    } catch (error) {
      /*
       * 백엔드 미연결 상태에서도 화면을 확인할 수 있도록
       * 기본 카테고리를 표시합니다.
       */
      categoryId.innerHTML = `
        <option value="">카테고리 선택</option>
        <option value="outer">아우터</option>
        <option value="top">상의</option>
        <option value="shirts">셔츠</option>
        <option value="knit">니트</option>
        <option value="pants">팬츠</option>
        <option value="denim">데님</option>
        <option value="shoes">신발</option>
        <option value="bag">가방</option>
        <option value="acc">액세서리</option>
        <option value="underwear">언더웨어</option>
      `;
    }
  }

  async function loadBrands() {
    try {
      const response = await fetch(BRAND_API, {
        method: "GET",
        credentials: "include"
      });

      let data = {};
      try {
        data = await response.json();
      } catch (_) {}

      if (!response.ok) {
        throw new Error(data.message || "브랜드 목록을 불러오지 못했습니다.");
      }

      const brands = Array.isArray(data.data) ? data.data : [];

      brandId.innerHTML =
        '<option value="">브랜드 선택</option>' +
        brands.map((brand) => `<option value="${brand.id}">${brand.name}</option>`).join("");
    } catch (error) {
      showMessage(error.message || "브랜드 목록을 불러오지 못했습니다.");
    }
  }

  function normalizeProduct(raw) {
    const body = raw?.data ?? raw ?? {};

    return {
      productName:
        body.productName ??
        body.name ??
        "",
      categoryId:
        body.categoryId ??
        body.category?.categoryId ??
        body.category?.id ??
        "",
      brandId:
        body.brandId ??
        body.brand?.brandId ??
        body.brand?.id ??
        "",
      price:
        body.price ??
        body.originalPrice ??
        0,
      discountRate:
        body.discountRate ??
        body.discount ??
        0,
      salesStatus:
        body.salesStatus ??
        body.status ??
        "SELLING",
      description:
        body.description ??
        body.detailDescription ??
        "",
      options: Array.isArray(body.options) ? body.options : [],
      imageUrls:
        body.imageUrls ??
        body.images?.map((image) => image.url ?? image.imageUrl) ??
        []
    };
  }

  function fillProductForm(product) {
    productName.value = product.productName;
    categoryId.value = String(product.categoryId || "");
    brandId.value = String(product.brandId || "");
    price.value = product.price;
    discountRate.value = product.discountRate;
    salesStatus.value = product.salesStatus;
    description.value = product.description;

    optionRows.innerHTML = "";
    if (product.options.length) {
      product.options.forEach((option) => addOptionRow(option));
    } else {
      addOptionRow();
    }

    savedImageUrls = Array.isArray(product.imageUrls)
      ? product.imageUrls.filter(Boolean)
      : [];

    existingImageUrls.value = JSON.stringify(savedImageUrls);
    descriptionCount.textContent = String(description.value.length);

    updatePricePreview();
    renderImagePreviews();
  }

  async function loadProductForEdit() {
    if (!isEditMode) return;

    pageTitle.textContent = "상품 수정";
    pageDescription.textContent =
      "등록된 상품 정보와 이미지를 수정합니다.";
    submitButton.textContent = "상품 수정";

    try {
      const response = await fetch(
        `${SELLER_PRODUCT_API}/${encodeURIComponent(productId)}`,
        {
          method: "GET",
          credentials: "include"
        }
      );

      if (handleUnauthorized(response)) return;

      let data = {};
      try {
        data = await response.json();
      } catch (_) {}

      if (!response.ok) {
        throw new Error(data.message || "상품 정보를 불러오지 못했습니다.");
      }

      fillProductForm(normalizeProduct(data));
    } catch (error) {
      showMessage(
        error instanceof TypeError
          ? "상품 조회 서버에 연결할 수 없습니다."
          : error.message
      );
    }
  }

  async function uploadImage(file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("fileType", "PRODUCT_IMAGE");

    const response = await fetch(FILE_UPLOAD_API, {
      method: "POST",
      credentials: "include",
      body: formData
    });

    if (handleUnauthorized(response)) {
      throw new Error("로그인이 만료되었습니다.");
    }

    let data = {};
    try {
      data = await response.json();
    } catch (_) {}

    if (!response.ok) {
      throw new Error(
        data.message || `${file.name} 업로드에 실패했습니다.`
      );
    }

    const imageUrl =
      data.url ??
      data.fileUrl ??
      data.data?.url ??
      data.data?.fileUrl;

    if (!imageUrl) {
      throw new Error(
        `${file.name} 업로드 응답에서 이미지 URL을 찾지 못했습니다.`
      );
    }

    return imageUrl;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage();

    if (location.protocol !== "file:" && !isSellerLoggedIn()) {
      moveToSellerLogin();
      return;
    }

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (!savedImageUrls.length && !selectedFiles.length) {
      showMessage("상품 이미지를 한 장 이상 등록해 주세요.");
      return;
    }

    const options = collectOptions();
    if (!options.length || options.some((option) => !option.optionName)) {
      showMessage("사이즈 등 옵션명을 반드시 입력해 최소 1개 이상의 옵션을 등록해 주세요.");
      return;
    }

    try {
      submitButton.disabled = true;
      submitButton.textContent = "이미지 업로드 중...";

      const uploadedUrls = await Promise.all(
        selectedFiles.map(uploadImage)
      );

      const imageUrls = [
        ...savedImageUrls,
        ...uploadedUrls
      ];

      const payload = {
        productName: productName.value.trim(),
        categoryId: categoryId.value,
        brandId: brandId.value,
        price: Number(price.value),
        discountRate: Number(discountRate.value || 0),
        salesStatus: salesStatus.value,
        description: description.value.trim(),
        options,
        imageUrls,
        thumbnailUrl: imageUrls[0]
      };

      submitButton.textContent =
        isEditMode ? "상품 수정 중..." : "상품 등록 중...";

      const requestUrl = isEditMode
        ? `${SELLER_PRODUCT_API}/${encodeURIComponent(productId)}`
        : SELLER_PRODUCT_API;

      const response = await fetch(requestUrl, {
        method: isEditMode ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(payload)
      });

      if (handleUnauthorized(response)) return;

      let data = {};
      try {
        data = await response.json();
      } catch (_) {}

      if (!response.ok) {
        throw new Error(
          data.message ||
          (isEditMode
            ? "상품 수정에 실패했습니다."
            : "상품 등록에 실패했습니다.")
        );
      }

      showMessage(
        isEditMode
          ? "상품 정보가 수정되었습니다."
          : "상품이 등록되었습니다.",
        "success"
      );

      window.setTimeout(() => {
        location.href = "seller-products.html";
      }, 700);
    } catch (error) {
      showMessage(
        error instanceof TypeError
          ? "서버에 연결할 수 없습니다. WEB/WAS 서버 상태를 확인해 주세요."
          : error.message
      );
    } finally {
      submitButton.disabled = false;
      submitButton.textContent =
        isEditMode ? "상품 수정" : "상품 등록";
    }
  });

  if (!isEditMode) {
    addOptionRow();
  }

  // 카테고리/브랜드 select 옵션이 채워진 뒤에 상품 값을 채워야
  // 수정 모드에서 select.value 지정이 실제로 선택되어 반영된다.
  Promise.all([
    loadCategories(),
    loadBrands()
  ]).then(loadProductForEdit).then(() => {
    updatePricePreview();
    renderImagePreviews();
  });
})();
