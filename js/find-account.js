// find-account.js — 아이디·비밀번호 찾기 mock 스크립트
// ※ 기능정의서 미기재 — 보완 추가
// 아이디 찾기: POST /api/v1/auth/find-username (제안)
// 비밀번호 재설정: POST /api/v1/auth/reset-password (제안)
// 비밀번호 찾기 본인인증: 이메일 또는 휴대폰(SMS) 선택

document.addEventListener("DOMContentLoaded", () => {

  const $ = (sel) => document.querySelector(sel);

  // ===== 상단 탭 (아이디 찾기 / 비밀번호 찾기) =====
  const tabBtns = document.querySelectorAll("[data-tab]");
  const panels = document.querySelectorAll("[data-panel]");

  function showTab(tab) {
    tabBtns.forEach((b) => b.classList.toggle("is-active", b.dataset.tab === tab));
    panels.forEach((p) => (p.hidden = p.dataset.panel !== tab));
  }
  tabBtns.forEach((btn) => btn.addEventListener("click", () => showTab(btn.dataset.tab)));

  $('[data-action="go-pw"]').addEventListener("click", () => showTab("pw"));

  let idVerified = false;
  let pwVerified = false;

  // ================= 아이디 찾기 =================

  // 아이디 찾기용 인증
  const idGroup = $('[data-group="id-code"]');
  const idTimer = $('[data-role="id-timer"]');
  const idMsg = $('[data-role="id-msg"]');
  let idInterval = null;

  $('[data-action="send-id-code"]').addEventListener("click", () => {
    const email = $("#idEmail").value.trim();
    if (!email) {
      idMsg.textContent = "이메일을 입력해 주세요.";
      idMsg.className = "field-msg error";
      return;
    }
    // TODO: 인증코드 발송 API
    idGroup.hidden = false;
    idMsg.textContent = "인증코드를 발송했습니다.";
    idMsg.className = "field-msg ok";

    let sec = 180;
    clearInterval(idInterval);
    idInterval = setInterval(() => {
      sec--;
      const m = String(Math.floor(sec / 60)).padStart(2, "0");
      const s = String(sec % 60).padStart(2, "0");
      idTimer.textContent = `${m}:${s}`;
      if (sec <= 0) {
        clearInterval(idInterval);
        idMsg.textContent = "인증 시간이 만료되었습니다. 다시 요청해 주세요.";
        idMsg.className = "field-msg error";
      }
    }, 1000);
  });

  $('[data-action="confirm-id-code"]').addEventListener("click", () => {
    const code = $("#idCode").value.trim();
    if (!code) {
      idMsg.textContent = "인증코드를 입력해 주세요.";
      idMsg.className = "field-msg error";
      return;
    }
    // TODO: 인증코드 검증 API
    clearInterval(idInterval);
    idMsg.textContent = "인증이 완료되었습니다.";
    idMsg.className = "field-msg ok";
    idVerified = true;
  });

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
    $('[data-role="id-value"]').textContent = "catch****"; // mock
    $("#findIdForm").hidden = true;
    $('[data-role="id-result"]').hidden = false;
  });

  // ================= 비밀번호 찾기 =================

  // 인증 방법 탭 (이메일 / 휴대폰)
  const methodTabs = document.querySelectorAll("[data-method]");
  const methodPanels = document.querySelectorAll("[data-method-panel]");
  let currentMethod = "email";

  methodTabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      currentMethod = btn.dataset.method;
      methodTabs.forEach((b) => b.classList.toggle("is-active", b === btn));
      methodPanels.forEach((p) => (p.hidden = p.dataset.methodPanel !== currentMethod));
      // 방법 바꾸면 인증코드 입력창 초기화
      $('[data-group="pw-code"]').hidden = true;
      pwVerified = false;
    });
  });

  // 인증코드 발송 (이메일/휴대폰 공통 타이머)
  const pwGroup = $('[data-group="pw-code"]');
  const pwTimer = $('[data-role="pw-timer"]');
  const pwMsg = $('[data-role="pw-msg"]');
  let pwInterval = null;

  function startPwTimer() {
    pwGroup.hidden = false;
    pwMsg.textContent = "인증코드를 발송했습니다.";
    pwMsg.className = "field-msg ok";

    let sec = 180;
    clearInterval(pwInterval);
    pwInterval = setInterval(() => {
      sec--;
      const m = String(Math.floor(sec / 60)).padStart(2, "0");
      const s = String(sec % 60).padStart(2, "0");
      pwTimer.textContent = `${m}:${s}`;
      if (sec <= 0) {
        clearInterval(pwInterval);
        pwMsg.textContent = "인증 시간이 만료되었습니다. 다시 요청해 주세요.";
        pwMsg.className = "field-msg error";
      }
    }, 1000);
  }

  // 이메일로 발송
  $('[data-action="send-email-code"]').addEventListener("click", () => {
    const email = $("#pwEmail").value.trim();
    if (!email) {
      pwMsg.textContent = "이메일을 입력해 주세요.";
      pwMsg.className = "field-msg error";
      return;
    }
    // TODO: POST /api/v1/auth/email-verification
    startPwTimer();
  });

  // 휴대폰으로 발송
  $('[data-action="send-phone-code"]').addEventListener("click", () => {
    const telecom = $("#pwTelecom").value;
    const phone = $("#pwPhone").value.trim();
    if (!telecom) {
      pwMsg.textContent = "통신사를 선택해 주세요.";
      pwMsg.className = "field-msg error";
      return;
    }
    if (!phone) {
      pwMsg.textContent = "휴대폰번호를 입력해 주세요.";
      pwMsg.className = "field-msg error";
      return;
    }
    // TODO: POST /api/v1/auth/sms-verification (제안)
    startPwTimer();
  });

  // 인증코드 확인
  $('[data-action="confirm-pw-code"]').addEventListener("click", () => {
    const code = $("#pwCode").value.trim();
    if (!code) {
      pwMsg.textContent = "인증코드를 입력해 주세요.";
      pwMsg.className = "field-msg error";
      return;
    }
    // TODO: 인증코드 검증 API
    clearInterval(pwInterval);
    pwMsg.textContent = "인증이 완료되었습니다.";
    pwMsg.className = "field-msg ok";
    pwVerified = true;
  });

  // 비밀번호 찾기 제출
  $("#findPwForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const userId = $("#pwUserId").value.trim();

    if (!userId) {
      alert("아이디를 입력해 주세요.");
      return;
    }
    if (!pwVerified) {
      alert("본인인증을 완료해 주세요.");
      return;
    }

    // TODO: 인증 확인 후 비밀번호 재설정 단계로
    $("#findPwForm").hidden = true;
    $('[data-role="pw-reset"]').hidden = false;
  });

  // 새 비밀번호 설정
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

    // TODO: POST /api/v1/auth/reset-password  body: { userId, newPassword }
    alert("비밀번호가 변경되었습니다. 다시 로그인해 주세요.");
    location.href = "login.html";
  });

});