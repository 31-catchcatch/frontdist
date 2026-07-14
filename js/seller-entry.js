(() => {
  "use strict";

  const FILE_PREVIEW_MODE = location.protocol === "file:";
  const FILE_UPLOAD_API = "/api/v1/files/upload";
  const SELLER_APPLICATION_API = "/api/v1/seller/applications";

  function isLoggedIn() {
    return (
      sessionStorage.getItem("catchcatch.loggedIn") === "true" ||
      Boolean(sessionStorage.getItem("catchcatch.accessToken")) ||
      Boolean(localStorage.getItem("catchcatch.accessToken"))
    );
  }

  function moveToLogin() {
    location.replace(
      `login.html?redirect=${encodeURIComponent("seller-entry.html")}`
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

  const form = document.getElementById("sellerEntryForm");
  const submitButton = document.getElementById("submitButton");
  const formMessage = document.getElementById("formMessage");
  const businessLicense = document.getElementById("businessLicense");
  const mailOrderLicense = document.getElementById("mailOrderLicense");
  const businessLicenseName = document.getElementById("businessLicenseName");
  const mailOrderLicenseName = document.getElementById("mailOrderLicenseName");

  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const ALLOWED_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png"
  ];

  function showFileName(input, output) {
    output.textContent =
      input.files && input.files[0]
        ? input.files[0].name
        : "선택된 파일 없음";
  }

  businessLicense.addEventListener("change", () => {
    showFileName(businessLicense, businessLicenseName);
  });

  mailOrderLicense.addEventListener("change", () => {
    showFileName(mailOrderLicense, mailOrderLicenseName);
  });

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

  function validateFile(file, label) {
    if (!file) {
      throw new Error(`${label} 파일을 선택해 주세요.`);
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error(`${label}은 PDF, JPG, PNG 파일만 등록할 수 있습니다.`);
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`${label}의 파일 크기는 10MB 이하여야 합니다.`);
    }
  }

  function handleUnauthorized(response) {
    if (response.status !== 401 && response.status !== 403) {
      return false;
    }

    clearLoginState();
    moveToLogin();
    return true;
  }

  async function uploadFile(file, documentType) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentType", documentType);

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
      throw new Error(data.message || "서류 업로드에 실패했습니다.");
    }

    const fileUrl =
      data.url ??
      data.fileUrl ??
      data.data?.url ??
      data.data?.fileUrl;

    if (!fileUrl) {
      throw new Error("업로드 응답에서 파일 URL을 확인할 수 없습니다.");
    }

    return fileUrl;
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

    const businessLicenseFile = businessLicense.files[0];
    const mailOrderLicenseFile = mailOrderLicense.files[0];

    try {
      validateFile(businessLicenseFile, "사업자등록증");
      validateFile(mailOrderLicenseFile, "통신판매업 신고증");

      if (FILE_PREVIEW_MODE) {
        showMessage(
          "미리보기 모드입니다. 실제 서버에서는 서류 업로드 후 입점 신청 API가 호출됩니다.",
          "success"
        );
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = "서류 업로드 중...";

      const [businessRegistrationUrl, mailOrderRegistrationUrl] =
        await Promise.all([
          uploadFile(businessLicenseFile, "BUSINESS_REGISTRATION"),
          uploadFile(mailOrderLicenseFile, "MAIL_ORDER_REGISTRATION")
        ]);

      submitButton.textContent = "신청서 제출 중...";

      const payload = {
        businessName: document.getElementById("businessName").value.trim(),
        brandName: document.getElementById("brandName").value.trim(),
        businessNumber: document.getElementById("businessNumber").value.trim(),
        representativeName: document.getElementById("representativeName").value.trim(),
        businessType: document.getElementById("businessType").value.trim(),
        businessCategory: document.getElementById("businessCategory").value.trim(),
        businessAddress: document.getElementById("businessAddress").value.trim(),
        managerName: document.getElementById("managerName").value.trim(),
        managerPhone: document.getElementById("managerPhone").value.trim(),
        managerEmail: document.getElementById("managerEmail").value.trim(),
        businessRegistrationUrl,
        mailOrderRegistrationUrl
      };

      const response = await fetch(SELLER_APPLICATION_API, {
        method: "POST",
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
        throw new Error(data.message || "입점 신청서 제출에 실패했습니다.");
      }

      showMessage(
        "입점 신청이 접수되었습니다. 담당자 검토 후 결과를 안내해 드립니다.",
        "success"
      );

      form.reset();
      businessLicenseName.textContent = "선택된 파일 없음";
      mailOrderLicenseName.textContent = "선택된 파일 없음";
    } catch (error) {
      showMessage(
        error instanceof TypeError
          ? "서버에 연결할 수 없습니다. WEB/WAS 서버 상태를 확인해 주세요."
          : error.message
      );
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "입점 신청하기";
    }
  });
})();
