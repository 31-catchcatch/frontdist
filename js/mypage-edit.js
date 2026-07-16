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
  const postalCode = document.getElementById("postalCode");
  const address = document.getElementById("address");
  const addressDetail = document.getElementById("addressDetail");

  const currentPassword = document.getElementById("currentPassword");
  const newPassword = document.getElementById("newPassword");
  const newPasswordConfirm = document.getElementById("newPasswordConfirm");
  const passwordMatchMessage =
    document.getElementById("passwordMatchMessage");

  const addressSearchButton =
    document.getElementById("addressSearchButton");

  const previewProfile = {
    username: "catchuser01",
    name: "김캐치",
    email: "catch@example.com",
    phone: "010-1234-5678",
    postalCode: "04790",
    address: "서울특별시 성동구 연무장길 00",
    addressDetail: "101동 1001호"
  };

  function isLoggedIn() {
    return (
      sessionStorage.getItem("catchcatch.loggedIn") === "true" ||
      Boolean(sessionStorage.getItem("catchcatch.accessToken")) ||
      Boolean(localStorage.getItem("catchcatch.accessToken"))
    );
  }

  function moveToLogin() {
    location.replace(
      `login.html?redirect=${encodeURIComponent("mypage-edit.html")}`
    );
  }

  function clearLoginState() {
    sessionStorage.removeItem("catchcatch.loggedIn");
    sessionStorage.removeItem("catchcatch.loginType");
    sessionStorage.removeItem("catchcatch.accessToken");
    localStorage.removeItem("catchcatch.accessToken");
  }

  if (!FILE_PREVIEW_MODE && !isLoggedIn()) {
    moveToLogin();
    return;
  }

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
    const addressObject =
      body.addressInfo ??
      body.address ??
      {};

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
        "",
      postalCode:
        body.postalCode ??
        body.zipCode ??
        addressObject.postalCode ??
        addressObject.zipCode ??
        "",
      address:
        typeof body.address === "string"
          ? body.address
          : (
              body.baseAddress ??
              body.addressLine1 ??
              addressObject.address ??
              addressObject.baseAddress ??
              addressObject.addressLine1 ??
              ""
            ),
      addressDetail:
        body.addressDetail ??
        body.detailAddress ??
        body.addressLine2 ??
        addressObject.addressDetail ??
        addressObject.detailAddress ??
        addressObject.addressLine2 ??
        ""
    };
  }

  function fillProfile(profile) {
    username.value = profile.username;
    nameInput.value = profile.name;
    email.value = profile.email;
    phone.value = profile.phone;
    postalCode.value = profile.postalCode;
    address.value = profile.address;
    addressDetail.value = profile.addressDetail;
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

  addressSearchButton.addEventListener("click", () => {
    /*
     * 주소 검색 서비스가 연결되면 이 위치에서 Daum 우편번호
     * 또는 팀에서 사용하는 주소 검색 모듈을 호출하면 됩니다.
     */
    showMessage(
      "주소 검색 서비스는 아직 연결되지 않았습니다. 우편번호와 주소를 직접 입력해 주세요."
    );
    postalCode.focus();
  });

  function createPayload() {
    const payload = {
      name: nameInput.value.trim(),
      email: email.value.trim(),
      phone: phone.value.trim(),
      postalCode: postalCode.value.trim(),
      address: address.value.trim(),
      addressDetail: addressDetail.value.trim()
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
      /*
       * 백엔드 Update DTO의 필드명이 다르면 createPayload()의
       * 키 이름만 실제 명세에 맞게 변경하면 됩니다.
       */
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
