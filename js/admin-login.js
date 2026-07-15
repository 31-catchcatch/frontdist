/*
 * 서버 계약: POST /api/v1/auth/admin/login
 * 요청 본문: { password: string }
 * 성공 응답: { accessToken: string } 또는 { data: { accessToken: string } }
 * 해당 API는 서버에서 DB의 관리자 계정과 권한을 검증한 뒤에만 토큰을 발급해야 한다.
 */
(function () {
  "use strict";

  const LOGIN_API = "/api/v1/admin/users";
  const DEFAULT_DESTINATION = "admin-dashboard.html";

  function safeRedirect() {
    const value = new URLSearchParams(location.search).get("redirect");
    return value && /^admin-[a-z0-9-]+\.html(?:\?[^#]*)?$/i.test(value)
      ? value
      : DEFAULT_DESTINATION;
  }

  function tokenFrom(payload) {
    const data = payload && typeof payload === "object" ? payload.data || payload : null;
    return data && (data.accessToken || data.token || data.access_token);
  }

  function errorText(response, payload) {
    if (payload && typeof payload === "object") {
      return payload.message || payload.error || "관리자 로그인에 실패했습니다.";
    }
    if (response.status === 401 || response.status === 403) {
      return "관리자 비밀번호를 다시 확인해 주세요.";
    }
    return "로그인 요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.";
  }

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("adminLoginForm");
    const password = document.getElementById("adminPassword");
    const submit = document.getElementById("loginSubmit");
    const message = document.getElementById("loginMessage");
    const toggle = document.getElementById("passwordToggle");
    const previewAccess = document.getElementById("previewAccess");

    if (AdminAuth.isLoggedIn()) {
      location.replace(safeRedirect());
      return;
    }

    function showMessage(text) {
      message.textContent = text;
      message.hidden = !text;
    }

    toggle.addEventListener("click", () => {
      const visible = password.type === "text";
      password.type = visible ? "password" : "text";
      toggle.textContent = visible ? "보기" : "숨기기";
      toggle.setAttribute("aria-label", visible ? "비밀번호 보기" : "비밀번호 숨기기");
      toggle.setAttribute("aria-pressed", String(!visible));
      password.focus();
    });

    previewAccess.addEventListener("click", () => {
      AdminAuth.setPreviewSession();
      location.replace(safeRedirect());
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const value = password.value;
      showMessage("");

      if (!value) {
        showMessage("관리자 비밀번호를 입력해 주세요.");
        password.focus();
        return;
      }

      submit.disabled = true;
      submit.textContent = "확인 중…";

      try {
        const response = await fetch(LOGIN_API, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ password: value }),
        });
        const payload = await response.json().catch(() => null);
        const token = tokenFrom(payload);

        if (!response.ok || !token) {
          throw new Error(errorText(response, payload));
        }

        AdminAuth.setSession(token);
        password.value = "";
        location.replace(safeRedirect());
      } catch (error) {
        showMessage(error instanceof Error ? error.message : "관리자 로그인에 실패했습니다.");
        password.focus();
      } finally {
        submit.disabled = false;
        submit.textContent = "관리자 화면으로 이동";
      }
    });
  });
})();
