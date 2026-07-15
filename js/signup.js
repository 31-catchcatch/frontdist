// signup.js — 회원가입 페이지 mock 스크립트

document.addEventListener("DOMContentLoaded", () => {

  // ===== 유형 선택 =====
  const typeSelect = document.getElementById("signupTypeSelect");
  const formBlock = document.getElementById("signupFormBlock");

  typeSelect.querySelector('[data-action="select-user-signup"]').addEventListener("click", () => {
    typeSelect.hidden = true;
    formBlock.hidden = false;
  });

  typeSelect.querySelector('[data-action="go-seller-signup"]').addEventListener("click", () => {
    location.href = "seller-signup.html";
  });

  // ===== STEP 전환 =====
  const form = document.getElementById("signupForm");
  const stepPanels = form.querySelectorAll("[data-step-panel]");
  const stepTabs = document.querySelectorAll("[data-step-tab]");

  function showStep(step) {
    stepPanels.forEach((p) => (p.hidden = p.dataset.stepPanel !== String(step)));
    stepTabs.forEach((t) => t.classList.toggle("is-active", t.dataset.stepTab === String(step)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  form.querySelector('[data-action="go-step2"]').addEventListener("click", () => {
    const step1 = form.querySelector('[data-step-panel="1"]');

    const requiredInputs = step1.querySelectorAll("[required]");
    if (![...requiredInputs].every((el) => el.value.trim() !== "")) {
      alert("필수 항목을 모두 입력해 주세요.");
      return;
    }

    if (document.getElementById("pw").value !== document.getElementById("pwConfirm").value) {
      alert("비밀번호가 일치하지 않습니다.");
      return;
    }

    const requiredAgrees = step1.querySelectorAll("[data-agree-required]");
    if (![...requiredAgrees].every((el) => el.checked)) {
      alert("필수 약관에 동의해 주세요.");
      return;
    }

    showStep(2);
  });

  form.querySelector('[data-action="go-step1"]').addEventListener("click", () => showStep(1));

  // ===== 전체 동의 =====
  const agreeAll = form.querySelector('[data-action="agree-all"]');
  const agreeItems = form.querySelectorAll(".agree-item input[type=checkbox]");
  agreeAll.addEventListener("change", () => {
    agreeItems.forEach((el) => (el.checked = agreeAll.checked));
  });
  agreeItems.forEach((el) =>
    el.addEventListener("change", () => {
      agreeAll.checked = [...agreeItems].every((i) => i.checked);
    })
  );

  // ===== 아이디 중복확인 (mock) =====
  form.querySelector('[data-action="check-username"]').addEventListener("click", () => {
    const val = document.getElementById("userId").value.trim();
    const msg = form.querySelector('[data-role="username-msg"]');
    if (!val) {
      msg.textContent = "아이디를 입력해 주세요.";
      msg.className = "field-msg error";
      return;
    }
    // TODO: POST /api/v1/auth/check-username
    msg.textContent = `'${val}' 사용 가능한 아이디입니다.`;
    msg.className = "field-msg ok";
  });

  // ===== 닉네임 중복확인 (mock) =====
  form.querySelector('[data-action="check-nickname"]').addEventListener("click", () => {
    alert("닉네임 중복확인 (구현 예정)");
  });

  // ===== 인증코드 공통 로직 =====
  function setupCodeVerification(cfg) {
    const sendBtn = form.querySelector(cfg.sendBtn);
    const group = form.querySelector(cfg.group);
    const confirmBtn = form.querySelector(cfg.confirmBtn);
    const timerEl = form.querySelector(cfg.timer);
    const msgEl = form.querySelector(cfg.msg);
    let interval = null;

    sendBtn.addEventListener("click", () => {
      // TODO: 인증코드 발송 API 호출
      group.hidden = false;
      let sec = 180;
      clearInterval(interval);
      interval = setInterval(() => {
        sec -= 1;
        const m = String(Math.floor(sec / 60)).padStart(2, "0");
        const s = String(sec % 60).padStart(2, "0");
        timerEl.textContent = `${m}:${s}`;
        if (sec <= 0) {
          clearInterval(interval);
          msgEl.textContent = "인증 시간이 만료되었습니다. 다시 요청해 주세요.";
          msgEl.className = "field-msg error";
        }
      }, 1000);
    });

    confirmBtn.addEventListener("click", () => {
      const codeInput = document.getElementById(cfg.codeInput);
      if (!codeInput.value.trim()) {
        msgEl.textContent = "인증코드를 입력해 주세요.";
        msgEl.className = "field-msg error";
        return;
      }
      // TODO: 실제 검증 API 응답으로 교체
      clearInterval(interval);
      msgEl.textContent = "인증이 완료되었습니다.";
      msgEl.className = "field-msg ok";
    });
  }

  setupCodeVerification({
    sendBtn: '[data-action="send-email-code"]',
    group: '[data-group="email-code"]',
    confirmBtn: '[data-action="confirm-email-code"]',
    codeInput: "emailCode",
    timer: '[data-role="email-timer"]',
    msg: '[data-role="email-msg"]',
  });

  setupCodeVerification({
    sendBtn: '[data-action="send-auth-code"]',
    group: '[data-group="auth-code"]',
    confirmBtn: '[data-action="confirm-auth-code"]',
    codeInput: "authCode",
    timer: '[data-role="auth-timer"]',
    msg: '[data-role="auth-msg"]',
  });

  // ===== 최종 제출 =====
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    // TODO: POST /api/v1/auth/user/signup
    showStep(3);
  });

});