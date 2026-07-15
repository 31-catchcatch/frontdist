/* 관리자 인증 상태는 일반 사용자 인증과 분리해서 세션 단위로만 보관한다. */
(function (global) {
  "use strict";

  const KEY_TOKEN = "catchcatch.adminToken";
  const KEY_FLAG = "catchcatch.adminLoggedIn";
  const KEY_PREVIEW = "catchcatch.adminPreview";
  const LOGIN_PAGE = "admin-login.html";

  function isPreviewRequest() {
    return new URLSearchParams(location.search).get("preview") === "1";
  }

  function currentPage() {
    return location.pathname.split("/").pop() + location.search;
  }

  const AdminAuth = {
    isLoggedIn() {
      return Boolean(sessionStorage.getItem(KEY_TOKEN) || sessionStorage.getItem(KEY_PREVIEW));
    },

    getToken() {
      return sessionStorage.getItem(KEY_TOKEN);
    },

    setSession(token) {
      if (typeof token !== "string" || !token.trim()) {
        throw new Error("관리자 인증 토큰이 없습니다.");
      }
      sessionStorage.setItem(KEY_TOKEN, token);
      sessionStorage.setItem(KEY_FLAG, "true");
      sessionStorage.removeItem(KEY_PREVIEW);
    },

    setPreviewSession() {
      sessionStorage.setItem(KEY_PREVIEW, "true");
      sessionStorage.setItem(KEY_FLAG, "preview");
    },

    clearSession() {
      sessionStorage.removeItem(KEY_TOKEN);
      sessionStorage.removeItem(KEY_FLAG);
      sessionStorage.removeItem(KEY_PREVIEW);
    },

    requireLogin() {
      if (isPreviewRequest()) {
        this.setPreviewSession();
      }
      if (!this.isLoggedIn()) {
        location.replace(LOGIN_PAGE + "?redirect=" + encodeURIComponent(currentPage()));
        return false;
      }
      return true;
    },

    logout() {
      this.clearSession();
      location.replace(LOGIN_PAGE);
    },

    authorizationHeader() {
      const token = this.getToken();
      return token ? { Authorization: "Bearer " + token } : {};
    },
  };

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-admin-logout]").forEach((element) => {
      element.addEventListener("click", (event) => {
        event.preventDefault();
        AdminAuth.logout();
      });
    });
  });

  global.AdminAuth = AdminAuth;
})(window);
