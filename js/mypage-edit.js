(() => {
  "use strict";

  const PROFILE_API = "/api/v1/users/me";
  const FILE_PREVIEW_MODE = location.protocol === "file:";

  const form = document.getElementById("profileForm");
  const submitButton = document.getElementById("submitButton");
  const formMessage = document.getElementById("formMessage");

  const username = document.getElementById("username");
  const nameInput = document.getElementById("name");
  const email = document.getElementById("email");
  const phone = document.getElementById("phone");

  const currentPassword = document.getElementById("currentPassword");
  const newPassword = document.getElementById("newPassword");
  const newPasswordConfirm = document.getElementById("newPasswordConfirm");
  const passwordMatchMessage =
    document.getElementById("passwordMatchMessage");

  const previewProfile = {
    username: "catchuser01",
    name: "김캐치",
    email: "catch@example.com",
    phone: "010-1234-5678"
  };

  function isLoggedIn() {
    // [5-1 조치] 토큰 저장 키를 직접 읽지 않고 공용 인증 모듈에 위임한다.
    return Boolean(window.CatchAuth && CatchAuth.isLoggedIn());
  }

  function moveToLogin() {
    location.replace(
      `login.html?redirect=${encodeURIComponent("mypage-edit.html")}`
    );
  }

  function clearLoginState() {
    // [5-1 조치] 저장 키 직접 접근 제거. 화면 이동은 기존처럼 각 호출부가 담당한다.
    if (window.CatchAuth) CatchAuth.clearSession();
  }

  if (!FILE_PREVIEW_MODE && !isLoggedIn()) {
    moveToLogin();
    return;
  }
  if (!FILE_PREVIEW_MODE && window.CatchAuth) { CatchAuth.requireRole(); }

  function handleUnauthorized(response) {
    if (response.status !== 401 && response.status !== 403) {
      return false;
    }

    clearLoginState();
    moveToLogin();
    return true;
  }

  function showMessage(message, type = "error") {
    formMessage.textContent = message;
    formMessage.classList.add("show");
    formMessage.classList.toggle("success", type === "success");
    formMessage.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }

  function clearMessage() {
    formMessage.textContent = "";
    formMessage.classList.remove("show", "success");
  }

  function normalizeProfile(raw) {
    const body = raw?.data ?? raw ?? {};

    return {
      username:
        body.username ??
        body.userId ??
        body.loginId ??
        "",
      name:
        body.name ??
        body.userName ??
        body.memberName ??
        "",
      email:
        body.email ??
        body.emailAddress ??
        "",
      phone:
        body.phone ??
        body.phoneNumber ??
        body.mobile ??
        ""
    };
  }

  function fillProfile(profile) {
    username.value = profile.username;
    nameInput.value = profile.name;
    email.value = profile.email;
    // 저장된 번호에 하이픈이 없을 수 있으므로 로드 시에도 전화번호 양식을 적용한다.
    phone.value = formatPhoneNumber(profile.phone);
  }

  async function loadProfile() {
    if (FILE_PREVIEW_MODE) {
      fillProfile(previewProfile);
      return;
    }

    try {
      const response = await fetch(PROFILE_API, {
        method: "GET",
        credentials: "include"
      });

      if (handleUnauthorized(response)) return;

      let data = {};
      try {
        data = await response.json();
      } catch (_) {}

      if (!response.ok) {
        throw new Error(
          data.message || "회원정보를 불러오지 못했습니다."
        );
      }

      fillProfile(normalizeProfile(data));
    } catch (error) {
      showMessage(
        error instanceof TypeError
          ? "회원정보 조회 서버에 연결할 수 없습니다."
          : error.message
      );
    }
  }

  function formatPhoneNumber(value) {
    const numbers = value.replace(/\D/g, "").slice(0, 11);

    if (numbers.length < 4) return numbers;
    if (numbers.length < 8) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    }

    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
  }

  phone.addEventListener("input", () => {
    phone.value = formatPhoneNumber(phone.value);
  });

  document.querySelectorAll("[data-password-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(
        button.dataset.passwordToggle
      );

      const visible = input.type === "text";
      input.type = visible ? "password" : "text";
      button.textContent = visible ? "보기" : "숨기기";
    });
  });

  function validatePasswordFields() {
    const passwordChangeRequested =
      currentPassword.value ||
      newPassword.value ||
      newPasswordConfirm.value;

    passwordMatchMessage.textContent = "";
    passwordMatchMessage.classList.remove("valid", "invalid");

    if (!passwordChangeRequested) {
      return true;
    }

    if (!currentPassword.value) {
      passwordMatchMessage.textContent =
        "비밀번호 변경 시 현재 비밀번호를 입력해 주세요.";
      passwordMatchMessage.classList.add("invalid");
      return false;
    }

    if (newPassword.value.length < 8) {
      passwordMatchMessage.textContent =
        "새 비밀번호는 8자 이상 입력해 주세요.";
      passwordMatchMessage.classList.add("invalid");
      return false;
    }

    if (newPassword.value !== newPasswordConfirm.value) {
      passwordMatchMessage.textContent =
        "새 비밀번호가 일치하지 않습니다.";
      passwordMatchMessage.classList.add("invalid");
      return false;
    }

    if (currentPassword.value === newPassword.value) {
      passwordMatchMessage.textContent =
        "새 비밀번호는 현재 비밀번호와 다르게 입력해 주세요.";
      passwordMatchMessage.classList.add("invalid");
      return false;
    }

    passwordMatchMessage.textContent =
      "새 비밀번호가 일치합니다.";
    passwordMatchMessage.classList.add("valid");
    return true;
  }

  [
    currentPassword,
    newPassword,
    newPasswordConfirm
  ].forEach((input) => {
    input.addEventListener("input", validatePasswordFields);
  });

  function createPayload() {
    const payload = {
      name: nameInput.value.trim(),
      email: email.value.trim(),
      phoneNumber: phone.value.trim()
    };

    if (newPassword.value) {
      payload.currentPassword = currentPassword.value;
      payload.newPassword = newPassword.value;
    }

    return payload;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage();

    if (!FILE_PREVIEW_MODE && !isLoggedIn()) {
      moveToLogin();
      return;
    }

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (!validatePasswordFields()) {
      newPasswordConfirm.focus();
      return;
    }

    const payload = createPayload();

    if (FILE_PREVIEW_MODE) {
      Object.assign(previewProfile, payload);
      fillProfile(previewProfile);

      currentPassword.value = "";
      newPassword.value = "";
      newPasswordConfirm.value = "";
      validatePasswordFields();

      showMessage(
        "미리보기 모드에서 회원정보가 저장되었습니다.",
        "success"
      );
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "저장 중...";

    try {
      const response = await fetch(PROFILE_API, {
        method: "PUT",
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
          data.message || "회원정보 수정에 실패했습니다."
        );
      }

      currentPassword.value = "";
      newPassword.value = "";
      newPasswordConfirm.value = "";
      validatePasswordFields();

      showMessage(
        "회원정보가 수정되었습니다.",
        "success"
      );
    } catch (error) {
      showMessage(
        error instanceof TypeError
          ? "회원정보 수정 서버에 연결할 수 없습니다."
          : error.message
      );
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "회원정보 저장";
    }
  });

  loadProfile();
})();
