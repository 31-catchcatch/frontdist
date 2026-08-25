(function (global) {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

global.esc = esc;


  if (!global.CatchHttp) {
    console.error("[admin-auth] 초기화 실패 (E-INIT-02)");
  }

  const KEY_FLAG = "catchcatch.adminLoggedIn";

  const KEY_USER_FLAG = "catchcatch.loggedIn";
  const KEY_USER_TYPE = "catchcatch.loginType";

  const LEGACY_ADMIN_TOKEN = "catchcatch.adminToken";

  const LOGIN_PAGE = "admin-login.html";

  function removeStored(key) {
    try { localStorage.removeItem(key); } catch (_) {  }
    try { sessionStorage.removeItem(key); } catch (_) {  }
  }

  removeStored(LEGACY_ADMIN_TOKEN);

  function currentPage() {
    return location.pathname.split("/").pop() + location.search;
  }

  function apiBase() {
    return global.CATCHCATCH_API_BASE_URL || "/api/v1";
  }

  const AdminAuth = {
    isLoggedIn() {
      try { return sessionStorage.getItem(KEY_FLAG) === "true"; } catch (_) { return false; }
    },

    startSession() {
      try { sessionStorage.setItem(KEY_FLAG, "true"); } catch (_) {  }
      try {
        localStorage.setItem(KEY_USER_FLAG, "true");
        localStorage.setItem(KEY_USER_TYPE, "user");
      } catch (_) {  }
    },

    clearSession() {
      removeStored(KEY_FLAG);
      removeStored(KEY_USER_FLAG);
      removeStored(KEY_USER_TYPE);
      removeStored(LEGACY_ADMIN_TOKEN);
    },

    requireLogin() {
      if (!this.isLoggedIn()) { location.replace(LOGIN_PAGE + "?redirect=" + encodeURIComponent(currentPage())); return false; }
      fetch(apiBase() + "/admin/users?page=0&size=1")
        .then((r) => { if (r.status === 401 || r.status === 403) { this.clearSession(); location.replace(LOGIN_PAGE); } })
        .catch(() => {});
      return true;
    },

    async logout() {
      if (this.isLoggedIn()) {
        try {
          await fetch(apiBase() + "/auth/user/logout", {
            method: "POST",
            skipAuthRetry: true,
          });
        } catch (_) {  }
      }
      this.clearSession();
      location.replace(LOGIN_PAGE);
    },

    authorizationHeader() {
      return {};
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
