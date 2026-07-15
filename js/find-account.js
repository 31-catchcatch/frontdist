// find-account.js — 아이디·비밀번호 찾기 mock 스크립트
// ※ 기능정의서 미기재 — 보완 추가
// 아이디 찾기: POST /api/v1/auth/find-username (제안)
// 비밀번호 재설정: POST /api/v1/auth/reset-password (제안)

document.addEventListener("DOMContentLoaded", () => {

  const $ = (sel) => document.querySelector(sel);

  // ===== 탭 전환 =====
  const tabBtns = document.querySelectorAll("[data-tab]");
  const panels = document.querySelectorAll("[data-panel]");

  function showTab(tab) {
    tabBtns.forEach((b) => b.classList.toggle("is-active", b.dataset.tab === tab));
    panels.forEach((p) => (p.hidden = p.dataset.panel !== tab));
  }
  tabBtns.forEach((btn) => btn.addEventListener("click", () => showTab(btn.dataset.tab)));

  $('[data-action="go-pw"]').addEventListener("click", () => showTab("pw"));

  // ===== 인증코드 공통 로직 =====
  function setupCode(cfg) {
    const sendBtn = $(cfg.sendBtn);
    const group = $(cfg.group);
    const confirmBtn = $(cfg.confirmBtn);
    const timerEl = $(cfg.timer);
    const msgEl = $(cfg.msg);
    let interval = null;

    sendBtn.addEventListener("click", () => {
      const email = $(cfg.emailInput).value.trim();
      if (!email) {
        msgEl.textContent = "이메일을 입력해 주세요.";
        msgEl.className = "field-msg error";
        return;
      }
      // TODO: 인증코드 발송 API 호출
      group.hidden = false;
      msgEl.textContent = "인증코드를 발송했습니다.";
      msgEl.className = "field-msg ok";

      let sec = 180;
      clearInterval(interval);
      interval = setInterval(() => {
        sec--;
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
      const code = $(cfg.codeInput).value.trim();
      if (!code) {
        msgEl.textContent = "인증코드를 입력해 주세요.";
        msgEl.className = "field-msg error";
        return;
      }
      // TODO: 인증코드 검증 API
      clearInterval(interval);
      msgEl.textContent = "인증이 완료되었습니다.";
      msgEl.className = "field-msg ok";
      cfg.onVerified();
    });
  }

  let idVerified = false;
  let pwVerified = false;

  // 아이디 찾기용 인증
  setupCode({
    sendBtn: '[data-action="send-id-code"]',
    group: '[data-group="id-code"]',
    confirmBtn: '[data-action="confirm-id-code"]',
    emailInput: "#idEmail",
    codeInput: "#idCode",
    timer: '[data-role="id-timer"]',
    msg: '[data-role="id-msg"]',
    onVerified: () => (idVerified = true),
  });

  // 비밀번호 찾기용 인증
  setupCode({
    sendBtn: '[data-action="send-pw-code"]',
    group: '[data-group="pw-code"]',
    confirmBtn: '[data-action="confirm-pw-code"]',
    emailInput: "#pwEmail",
    codeInput: "#pwCode",
    timer: '[data-role="pw-timer"]',
    msg: '[data-role="pw-msg"]',
    onVerified: () => (pwVerified = true),
  });

  // ===== 아이디 찾기 제출 =====
  $("#findIdForm").addEventListener("submit", (e) => {
    e.preventDefault();

    const name = $("#idName").value.trim();
    const email = $("#idEmail").value.trim();

    if (!name || !email) {
      alert("이름과 이메일을 입력해 주세요.");
      return;
    }
    if (!idVerified) {
      alert("이메일 인증을 완료해 주세요.");
      return;
    }

    // TODO: POST /api/v1/auth/find-username  body: { name, email }
    //   응답으로 마스킹된 아이디를 받아옴
    const maskedId = "catch****"; // mock
    $('[data-role="id-value"]').textContent = maskedId;

    $("#findIdForm").hidden = true;
    $('[data-role="id-result"]').hidden = false;
  });

  // ===== 비밀번호 찾기 제출 =====
  $("#findPwForm").addEventListener("submit", (e) => {
    e.preventDefault();

    const userId = $("#pwUserId").value.trim();
    const email = $("#pwEmail").value.trim();

    if (!userId || !email) {
      alert("아이디와 이메일을 입력해 주세요.");
      return;
    }
    if (!pwVerified) {
      alert("이메일 인증을 완료해 주세요.");
      return;
    }

    // TODO: 인증 확인 후 비밀번호 재설정 단계로
    $("#findPwForm").hidden = true;
    $('[data-role="pw-reset"]').hidden = false;
  });

  // ===== 새 비밀번호 설정 =====
  $('[data-action="reset-pw"]').addEventListener("click", () => {
    const pw = $("#newPw").value;
    const pwConfirm = $("#newPwConfirm").value;
    const msg = $('[data-role="new-pw-msg"]');

    if (pw.length < 8) {
      msg.textContent = "비밀번호는 8자 이상이어야 합니다.";
      msg.className = "field-msg error";
      return;
    }
    if (pw !== pwConfirm) {
      msg.textContent = "비밀번호가 일치하지 않습니다.";
      msg.className = "field-msg error";
      return;
    }

    // TODO: POST /api/v1/auth/reset-password  body: { userId, email, newPassword }
    alert("비밀번호가 변경되었습니다. 다시 로그인해 주세요.");
    location.href = "login.html";
  });

});