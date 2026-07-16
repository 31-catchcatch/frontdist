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

    if (checkedUsername !== document.getElementById("userId").value.trim()) {
      alert("아이디 중복확인을 해주세요.");
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

  // ===== 아이디 중복확인 =====
  const userIdInput = document.getElementById("userId");
  const checkUsernameBtn = form.querySelector('[data-action="check-username"]');
  let checkedUsername = null; // 중복확인을 통과한 아이디. 값이 바뀌면 초기화된다.

  userIdInput.addEventListener("input", () => {
    if (userIdInput.value.trim() !== checkedUsername) {
      checkedUsername = null;
      const msg = form.querySelector('[data-role="username-msg"]');
      msg.textContent = "";
      msg.className = "field-msg";
    }
  });

  checkUsernameBtn.addEventListener("click", async () => {
    const val = userIdInput.value.trim();
    const msg = form.querySelector('[data-role="username-msg"]');

    if (!val) {
      msg.textContent = "아이디를 입력해 주세요.";
      msg.className = "field-msg error";
      return;
    }

    checkUsernameBtn.disabled = true;
    try {
      // 백엔드가 @RequestParam 이라 body가 아니라 쿼리스트링으로 보내야 한다.
      const res = await fetch(
        `/api/v1/auth/check-username?username=${encodeURIComponent(val)}`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => null);

      if (!res.ok || !data || data.success === false) {
        msg.textContent = (data && data.message) || "중복확인에 실패했습니다.";
        msg.className = "field-msg error";
        return;
      }

      // data.data === true 가 "사용 가능"
      if (data.data) {
        checkedUsername = val;
        msg.textContent = `'${val}' 사용 가능한 아이디입니다.`;
        msg.className = "field-msg ok";
      } else {
        checkedUsername = null;
        msg.textContent = `'${val}' 이미 사용 중인 아이디입니다.`;
        msg.className = "field-msg error";
      }
    } catch (err) {
      msg.textContent = "서버에 연결할 수 없습니다.";
      msg.className = "field-msg error";
    } finally {
      checkUsernameBtn.disabled = false;
    }
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
  form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    username: document.getElementById("userId").value.trim(),
    password: document.getElementById("pw").value,
    name: document.getElementById("name").value.trim(),
    email: document.getElementById("email").value.trim(),
    // 하이픈 등 제거해서 숫자만 (백엔드는 \d{9,11} 요구)
    phoneNumber: document.getElementById("phone").value.replace(/[^0-9]/g, ""),
  };

  try {
    const res = await fetch("/api/v1/auth/user/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);

    if (!res.ok || !data || data.success === false) {
      alert((data && data.message) || "회원가입에 실패했습니다.");
      return;
    }
    showStep(3); // 성공 시에만 완료 화면
  } catch (err) {
    alert("서버에 연결할 수 없습니다. WEB/WAS 상태를 확인해 주세요.");
  }
  });

});