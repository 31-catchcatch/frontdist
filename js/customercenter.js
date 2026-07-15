(() => {
  "use strict";

  // 현재 API 명세에 고객센터 전용 API가 없어 제안 URI를 사용합니다.
  const INQUIRY_API = "/api/v1/customer-center/inquiries";
  const FILE_PREVIEW_MODE = location.protocol === "file:";

  const faqData = [
    {category:"order",question:"주문이 정상적으로 접수되었는지 어떻게 확인하나요?",answer:"로그인 후 마이페이지의 주문내역에서 주문번호와 결제 상태를 확인할 수 있습니다. 결제 완료 상태라면 주문이 정상 접수된 것입니다."},
    {category:"order",question:"주문 후 결제수단을 변경할 수 있나요?",answer:"결제가 완료된 주문의 결제수단은 변경할 수 없습니다. 주문을 취소한 뒤 원하는 결제수단으로 다시 주문해 주세요."},
    {category:"delivery",question:"배송 조회는 어디에서 하나요?",answer:"마이페이지 주문내역에서 배송 상태와 운송장 번호를 확인할 수 있습니다. 출고 후 택배사 시스템 반영까지 시간이 걸릴 수 있습니다."},
    {category:"delivery",question:"배송지는 주문 후 변경할 수 있나요?",answer:"상품이 배송 준비 단계로 넘어가기 전에는 고객센터를 통해 변경 가능 여부를 확인할 수 있습니다. 이미 출고된 경우에는 변경이 어렵습니다."},
    {category:"claim",question:"교환이나 반품은 언제까지 신청해야 하나요?",answer:"상품 수령일로부터 7일 이내에 마이페이지 주문내역에서 신청해야 합니다. 착용 흔적, 오염, 택 제거 등이 있는 경우 처리가 제한될 수 있습니다."},
    {category:"claim",question:"단순 변심 반품 배송비는 누가 부담하나요?",answer:"상품 불량이나 오배송이 아닌 단순 변심의 경우 왕복 배송비는 고객 부담입니다."},
    {category:"member",question:"쿠폰과 포인트를 함께 사용할 수 있나요?",answer:"쿠폰의 사용 조건에 따라 포인트와 함께 사용할 수 있습니다. 결제 페이지에서 적용 가능한 쿠폰과 포인트를 확인해 주세요."},
    {category:"member",question:"회원 탈퇴 후 다시 가입할 수 있나요?",answer:"탈퇴 처리와 개인정보 보관 정책에 따라 일정 기간 재가입이 제한될 수 있습니다. 정확한 재가입 가능 시점은 고객센터에 문의해 주세요."}
  ];

  const faqList = document.getElementById("faqList");
  const faqEmpty = document.getElementById("faqEmpty");
  const faqFilters = document.getElementById("faqFilters");
  const helpSearchForm = document.getElementById("helpSearchForm");
  const helpKeyword = document.getElementById("helpKeyword");
  const inquiryForm = document.getElementById("inquiryForm");
  const inquiryContent = document.getElementById("inquiryContent");
  const inquiryContentCount = document.getElementById("inquiryContentCount");
  const resetButton = document.getElementById("resetButton");
  const submitButton = document.getElementById("submitButton");
  const formMessage = document.getElementById("formMessage");

  let selectedCategory = "all";
  let searchKeyword = "";

  function isLoggedIn() {
    return sessionStorage.getItem("catchcatch.loggedIn") === "true" ||
      Boolean(sessionStorage.getItem("catchcatch.accessToken")) ||
      Boolean(localStorage.getItem("catchcatch.accessToken"));
  }

  function moveToLogin() {
    location.href = `login.html?redirect=${encodeURIComponent("customercenter.html#inquirySection")}`;
  }

  function clearLoginState() {
    sessionStorage.removeItem("catchcatch.loggedIn");
    sessionStorage.removeItem("catchcatch.loginType");
    sessionStorage.removeItem("catchcatch.accessToken");
    localStorage.removeItem("catchcatch.accessToken");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderFaqs() {
    const filtered = faqData.filter((faq) => {
      const categoryMatch = selectedCategory === "all" || faq.category === selectedCategory;
      const keywordMatch = !searchKeyword || faq.question.toLowerCase().includes(searchKeyword) || faq.answer.toLowerCase().includes(searchKeyword);
      return categoryMatch && keywordMatch;
    });

    faqEmpty.hidden = filtered.length !== 0;
    faqList.innerHTML = filtered.map((faq, index) => `
      <article class="faq-item">
        <button class="faq-question" type="button" aria-expanded="false" aria-controls="faqAnswer${index}">
          <span class="question-mark">Q</span>
          <strong>${escapeHtml(faq.question)}</strong>
          <span class="toggle-mark" aria-hidden="true">＋</span>
        </button>
        <div class="faq-answer" id="faqAnswer${index}" hidden>${escapeHtml(faq.answer)}</div>
      </article>
    `).join("");
  }

  faqFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    selectedCategory = button.dataset.category;
    faqFilters.querySelectorAll("[data-category]").forEach((item) => item.classList.toggle("on", item === button));
    renderFaqs();
  });

  helpSearchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    searchKeyword = helpKeyword.value.trim().toLowerCase();
    selectedCategory = "all";
    faqFilters.querySelectorAll("[data-category]").forEach((button) => button.classList.toggle("on", button.dataset.category === "all"));
    renderFaqs();
    document.getElementById("faqSection").scrollIntoView({behavior:"smooth",block:"start"});
  });

  faqList.addEventListener("click", (event) => {
    const button = event.target.closest(".faq-question");
    if (!button) return;
    const answer = document.getElementById(button.getAttribute("aria-controls"));
    const open = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!open));
    button.querySelector(".toggle-mark").textContent = open ? "＋" : "−";
    answer.hidden = open;
  });

  document.querySelectorAll("[data-target-section]").forEach((button) => {
    button.addEventListener("click", () => document.getElementById(button.dataset.targetSection)?.scrollIntoView({behavior:"smooth",block:"start"}));
  });

  inquiryContent.addEventListener("input", () => {
    inquiryContentCount.textContent = String(inquiryContent.value.length);
  });

  function showMessage(message, type = "error") {
    formMessage.textContent = message;
    formMessage.classList.add("show");
    formMessage.classList.toggle("success", type === "success");
  }

  function resetForm() {
    inquiryForm.reset();
    inquiryContentCount.textContent = "0";
    formMessage.textContent = "";
    formMessage.classList.remove("show", "success");
  }

  resetButton.addEventListener("click", resetForm);

  inquiryForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!isLoggedIn() && !FILE_PREVIEW_MODE) {
      moveToLogin();
      return;
    }

    if (!inquiryForm.checkValidity()) {
      inquiryForm.reportValidity();
      return;
    }

    if (FILE_PREVIEW_MODE) {
      showMessage("미리보기 모드입니다. 실제 서버에서는 로그인 후 1:1 문의 API가 호출됩니다.", "success");
      return;
    }

    const payload = {
      category: document.getElementById("inquiryCategory").value,
      orderNumber: document.getElementById("orderNumber").value.trim() || null,
      title: document.getElementById("inquiryTitle").value.trim(),
      content: inquiryContent.value.trim(),
      privacyAgreement: document.getElementById("privacyAgreement").checked
    };

    submitButton.disabled = true;
    submitButton.textContent = "등록 중...";

    try {
      const response = await fetch(INQUIRY_API, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        credentials: "include",
        body: JSON.stringify(payload)
      });

      if (response.status === 401 || response.status === 403) {
        clearLoginState();
        moveToLogin();
        return;
      }

      let data = {};
      try { data = await response.json(); } catch (_) {}
      if (!response.ok) throw new Error(data.message || "문의 등록에 실패했습니다.");

      resetForm();
      showMessage("문의가 등록되었습니다. 답변은 마이페이지에서 확인해 주세요.", "success");
    } catch (error) {
      showMessage(error instanceof TypeError ? "고객센터 서버에 연결할 수 없습니다." : error.message);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "문의 등록";
    }
  });

  renderFaqs();
})();
