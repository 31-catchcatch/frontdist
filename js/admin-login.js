/*
 * 서버 계약: POST /api/v1/admin/users
 * 요청 본문: { username: string, password: string }  (백엔드 LoginRequest, 둘 다 필수)
 * 성공 응답: { data: { accessToken: string, ... } }
 * 서버가 DB의 관리자 계정(role=ADMIN)과 비밀번호를 검증한 뒤에만 토큰을 발급한다.
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
    const username = document.getElementById("adminUsername");
    const password = document.getElementById("adminPassword");
    const submit = document.getElementById("loginSubmit");
    const message = document.getElementById("loginMessage");
    const toggle = document.getElementById("passwordToggle");

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

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const usernameValue = username.value.trim();
      const value = password.value;
      showMessage("");

      if (!usernameValue) {
        showMessage("관리자 아이디를 입력해 주세요.");
        username.focus();
        return;
      }
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
          body: JSON.stringify({ username: usernameValue, password: value }),
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
