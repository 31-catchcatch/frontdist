(() => {
  "use strict";

  /*
   * 판매자 회원정보 조회·수정 API는 제안값입니다.
   * 실제 백엔드 URI가 다르면 아래 상수만 변경하면 됩니다.
   */
  const SELLER_PROFILE_API = "/api/v1/seller/me";
  const EMAIL_SEND_API = "/api/v1/auth/email-verification";
  const EMAIL_VERIFY_API = "/api/v1/auth/seller/verify";
  const FILE_PREVIEW_MODE = location.protocol === "file:";

  const form = document.getElementById("sellerProfileForm");
  const submitButton = document.getElementById("submitButton");
  const formMessage = document.getElementById("formMessage");

  const username = document.getElementById("username");
  const email = document.getElementById("email");
  const emailVerificationCode =
    document.getElementById("emailVerificationCode");
  const verificationField =
    document.getElementById("verificationField");
  const emailMessage = document.getElementById("emailMessage");
  const verificationMessage =
    document.getElementById("verificationMessage");

  const sendEmailCodeButton =
    document.getElementById("sendEmailCodeButton");
  const verifyEmailCodeButton =
    document.getElementById("verifyEmailCodeButton");

  const currentPassword =
    document.getElementById("currentPassword");
  const newPassword =
    document.getElementById("newPassword");
  const newPasswordConfirm =
    document.getElementById("newPasswordConfirm");
  const passwordMatchMessage =
    document.getElementById("passwordMatchMessage");

  const businessName =
    document.getElementById("businessName");
  const brandName =
    document.getElementById("brandName");
  const businessNumber =
    document.getElementById("businessNumber");
  const representativeName =
    document.getElementById("representativeName");
  const managerName =
    document.getElementById("managerName");
  const managerPhone =
    document.getElementById("managerPhone");

  let originalEmail = "";
  let emailVerified = true;

  const previewProfile = {
    username: "seller01",
    email: "seller@catchcatch.com",
    businessName: "캐치패션",
    brandName: "CATCH STANDARD",
    businessNumber: "123-45-67890",
    representativeName: "김대표",
    managerName: "이담당",
    managerPhone: "010-1234-5678"
  };

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
    location.replace(
      `login.html?type=seller&redirect=${encodeURIComponent(
        "seller-mypage-edit.html"
      )}`
    );
  }

  function clearLoginState() {
    sessionStorage.removeItem("catchcatch.loggedIn");
    sessionStorage.removeItem("catchcatch.loginType");
    sessionStorage.removeItem("catchcatch.accessToken");
    localStorage.removeItem("catchcatch.accessToken");
  }

  if (!FILE_PREVIEW_MODE && !isSellerLoggedIn()) {
    moveToSellerLogin();
    return;
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
    const business =
      body.businessInfo ??
      body.business ??
      {};
    const manager =
      body.managerInfo ??
      body.manager ??
      {};

    return {
      username:
        body.username ??
        body.sellerId ??
        body.loginId ??
        "",
      email:
        body.email ??
        body.emailAddress ??
        "",
      businessName:
        body.businessName ??
        business.businessName ??
        business.companyName ??
        "",
      brandName:
        body.brandName ??
        business.brandName ??
        "",
      businessNumber:
        body.businessNumber ??
        body.businessRegistrationNumber ??
        business.businessNumber ??
        business.registrationNumber ??
        "",
      representativeName:
        body.representativeName ??
        body.ceoName ??
        business.representativeName ??
        business.ceoName ??
        "",
      managerName:
        body.managerName ??
        manager.managerName ??
        manager.name ??
        "",
      managerPhone:
        body.managerPhone ??
        body.managerContact ??
        manager.managerPhone ??
        manager.phone ??
        ""
    };
  }

  function fillProfile(profile) {
    username.value = profile.username;
    email.value = profile.email;
    originalEmail = profile.email;
    emailVerified = true;

    businessName.value = profile.businessName;
    brandName.value = profile.brandName;
    businessNumber.value =
      formatBusinessNumber(profile.businessNumber);
    representativeName.value = profile.representativeName;
    managerName.value = profile.managerName;
    managerPhone.value =
      formatPhoneNumber(profile.managerPhone);
  }

  async function loadProfile() {
    if (FILE_PREVIEW_MODE) {
      fillProfile(previewProfile);
      return;
    }

    try {
      const response = await fetch(SELLER_PROFILE_API, {
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
          data.message ||
          "판매자 회원정보를 불러오지 못했습니다."
        );
      }

      fillProfile(normalizeProfile(data));
    } catch (error) {
      showMessage(
        error instanceof TypeError
          ? "판매자 회원정보 조회 서버에 연결할 수 없습니다."
          : error.message
      );
    }
  }

  function formatBusinessNumber(value) {
    const numbers = String(value || "")
      .replace(/\D/g, "")
      .slice(0, 10);

    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 5) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    }

    return `${numbers.slice(0, 3)}-${numbers.slice(3, 5)}-${numbers.slice(5)}`;
  }

  function formatPhoneNumber(value) {
    const numbers = String(value || "")
      .replace(/\D/g, "")
      .slice(0, 11);

    if (numbers.length < 4) return numbers;
    if (numbers.length < 8) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    }

    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
  }

  businessNumber.addEventListener("input", () => {
    businessNumber.value =
      formatBusinessNumber(businessNumber.value);
  });

  managerPhone.addEventListener("input", () => {
    managerPhone.value =
      formatPhoneNumber(managerPhone.value);
  });

  email.addEventListener("input", () => {
    emailVerified =
      email.value.trim() === originalEmail;

    emailMessage.textContent = emailVerified
      ? "현재 인증된 이메일입니다."
      : "변경한 이메일은 인증코드 확인이 필요합니다.";

    emailMessage.classList.toggle("valid", emailVerified);
    emailMessage.classList.toggle("invalid", !emailVerified);

    if (emailVerified) {
      verificationField.hidden = true;
      emailVerificationCode.value = "";
      verificationMessage.textContent = "";
    }
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
    const changeRequested =
      currentPassword.value ||
      newPassword.value ||
      newPasswordConfirm.value;

    passwordMatchMessage.textContent = "";
    passwordMatchMessage.classList.remove("valid", "invalid");

    if (!changeRequested) {
      return true;
    }

    if (!currentPassword.value) {
      passwordMatchMessage.textContent =
        "현재 비밀번호를 입력해 주세요.";
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

  sendEmailCodeButton.addEventListener("click", async () => {
    clearMessage();

    if (!email.checkValidity()) {
      email.reportValidity();
      return;
    }

    if (email.value.trim() === originalEmail) {
      emailVerified = true;
      emailMessage.textContent =
        "현재 이메일은 이미 인증되어 있습니다.";
      emailMessage.classList.add("valid");
      return;
    }

    verificationField.hidden = false;

    if (FILE_PREVIEW_MODE) {
      verificationMessage.textContent =
        "미리보기 인증코드는 123456입니다.";
      verificationMessage.className =
        "field-help valid";
      emailVerificationCode.focus();
      return;
    }

    sendEmailCodeButton.disabled = true;
    sendEmailCodeButton.textContent = "발송 중...";

    try {
      const response = await fetch(EMAIL_SEND_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          email: email.value.trim(),
          userType: "SELLER"
        })
      });

      if (handleUnauthorized(response)) return;

      let data = {};
      try {
        data = await response.json();
      } catch (_) {}

      if (!response.ok) {
        throw new Error(
          data.message || "인증코드 발송에 실패했습니다."
        );
      }

      verificationMessage.textContent =
        "인증코드를 발송했습니다.";
      verificationMessage.className =
        "field-help valid";
      emailVerificationCode.focus();
    } catch (error) {
      verificationMessage.textContent =
        error instanceof TypeError
          ? "이메일 인증 서버에 연결할 수 없습니다."
          : error.message;
      verificationMessage.className =
        "field-help invalid";
    } finally {
      sendEmailCodeButton.disabled = false;
      sendEmailCodeButton.textContent = "인증코드 발송";
    }
  });

  verifyEmailCodeButton.addEventListener("click", async () => {
    const code = emailVerificationCode.value.trim();

    if (!code) {
      verificationMessage.textContent =
        "인증코드를 입력해 주세요.";
      verificationMessage.className =
        "field-help invalid";
      return;
    }

    if (FILE_PREVIEW_MODE) {
      emailVerified = code === "123456";

      verificationMessage.textContent = emailVerified
        ? "이메일 인증이 완료되었습니다."
        : "인증코드가 올바르지 않습니다.";

      verificationMessage.className = emailVerified
        ? "field-help valid"
        : "field-help invalid";
      return;
    }

    verifyEmailCodeButton.disabled = true;
    verifyEmailCodeButton.textContent = "확인 중...";

    try {
      const response = await fetch(EMAIL_VERIFY_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          email: email.value.trim(),
          verificationCode: code
        })
      });

      if (handleUnauthorized(response)) return;

      let data = {};
      try {
        data = await response.json();
      } catch (_) {}

      if (!response.ok) {
        throw new Error(
          data.message || "이메일 인증에 실패했습니다."
        );
      }

      emailVerified = true;
      verificationMessage.textContent =
        "이메일 인증이 완료되었습니다.";
      verificationMessage.className =
        "field-help valid";
    } catch (error) {
      emailVerified = false;
      verificationMessage.textContent =
        error instanceof TypeError
          ? "이메일 인증 서버에 연결할 수 없습니다."
          : error.message;
      verificationMessage.className =
        "field-help invalid";
    } finally {
      verifyEmailCodeButton.disabled = false;
      verifyEmailCodeButton.textContent = "인증 확인";
    }
  });

  function createPayload() {
    const payload = {
      email: email.value.trim(),
      businessName: businessName.value.trim(),
      brandName: brandName.value.trim(),
      businessNumber:
        businessNumber.value.replace(/\D/g, ""),
      representativeName:
        representativeName.value.trim(),
      managerName: managerName.value.trim(),
      managerPhone:
        managerPhone.value.replace(/\D/g, "")
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

    if (!FILE_PREVIEW_MODE && !isSellerLoggedIn()) {
      moveToSellerLogin();
      return;
    }

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (!emailVerified) {
      showMessage(
        "변경한 이메일의 인증을 완료해 주세요."
      );
      emailVerificationCode.focus();
      return;
    }

    if (!validatePasswordFields()) {
      newPasswordConfirm.focus();
      return;
    }

    const payload = createPayload();

    if (FILE_PREVIEW_MODE) {
      Object.assign(previewProfile, payload, {
        businessNumber: businessNumber.value,
        managerPhone: managerPhone.value
      });

      originalEmail = email.value.trim();
      currentPassword.value = "";
      newPassword.value = "";
      newPasswordConfirm.value = "";
      validatePasswordFields();

      showMessage(
        "미리보기 모드에서 판매자 정보가 저장되었습니다.",
        "success"
      );
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "저장 중...";

    try {
      const response = await fetch(SELLER_PROFILE_API, {
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
          data.message ||
          "판매자 회원정보 수정에 실패했습니다."
        );
      }

      originalEmail = email.value.trim();
      currentPassword.value = "";
      newPassword.value = "";
      newPasswordConfirm.value = "";
      validatePasswordFields();

      showMessage(
        "판매자 회원정보가 수정되었습니다.",
        "success"
      );
    } catch (error) {
      showMessage(
        error instanceof TypeError
          ? "판매자 회원정보 수정 서버에 연결할 수 없습니다."
          : error.message
      );
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "판매자 정보 저장";
    }
  });

  loadProfile();
})();
