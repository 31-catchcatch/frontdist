/* =========================================================
   입점 신청 페이지 스텝 전환 (정보 입력 → 서류 제출)
   - 스텝1: 사업자/담당자 정보  · 스텝2: 필수 서류 + 동의
   - 상단 단계 표시(.entry-steps)와 연동
   실제 제출/검증은 seller-entry.js가 담당합니다.
   ========================================================= */
(() => {
  "use strict";

  const steps = Array.from(document.querySelectorAll(".entry-step"));
  if (steps.length < 2) return;

  const stepItems = Array.from(document.querySelectorAll(".entry-steps li"));
  const toStep2 = document.getElementById("toStep2");
  const toStep1 = document.getElementById("toStep1");
  const formMessage = document.getElementById("formMessage");

  function showStep(n) {
    steps.forEach((section) => {
      section.hidden = Number(section.dataset.step) !== n;
    });
    // 상단 단계 표시: 현재 단계까지 활성화
    stepItems.forEach((li, index) => li.classList.toggle("on", index <= n - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // 스텝1의 필수 항목이 모두 채워졌는지 확인 후 다음 단계로
  function validateStep1() {
    const step1 = document.querySelector('.entry-step[data-step="1"]');
    const required = Array.from(step1.querySelectorAll("[required]"));

    for (const field of required) {
      if (!field.value.trim()) {
        if (formMessage) {
          formMessage.textContent = "필수 항목을 모두 입력해 주세요.";
          formMessage.classList.add("show");
          formMessage.classList.remove("success");
        }
        field.focus();
        return false;
      }
    }
    if (formMessage) {
      formMessage.textContent = "";
      formMessage.classList.remove("show");
    }
    return true;
  }

  if (toStep2) {
    toStep2.addEventListener("click", () => {
      if (validateStep1()) showStep(2);
    });
  }
  if (toStep1) {
    toStep1.addEventListener("click", () => showStep(1));
  }

  showStep(1);
})();
