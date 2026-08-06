// find-account.js — 아이디 찾기 및 임시 비밀번호 발급 API 연동
//
// 일반 회원:
//   POST /api/v1/auth/user/find-account
//
// 판매자:
//   POST /api/v1/auth/seller/find-account
//
// 아이디 찾기 요청:
//   { type: "ID", name, username: null, email }
//
// 비밀번호 찾기 요청:
//   { type: "PASSWORD", name: null, username, email }

document.addEventListener("DOMContentLoaded", () => {
  const $ = (selector) => document.querySelector(selector);

  const API_BASE = (
    window.CATCHCATCH_API_BASE_URL || "/api/v1"
  ).replace(/\/$/, "");

  const tabButtons = [...document.querySelectorAll("[data-tab]")];
  const panels = [...document.querySelectorAll("[data-panel]")];

  const findIdForm = $("#findIdForm");
  const findPwForm = $("#findPwForm");

  const idResult = $('[data-role="id-result"]');
  const idValue = $('[data-role="id-value"]');
  const idMessage = $('[data-role="id-message"]');
  const idSubmit = $('[data-role="id-submit"]');

  const pwResult = $('[data-role="pw-result"]');
  const pwResultMessage = $('[data-role="pw-result-message"]');
  const pwMessage = $('[data-role="pw-message"]');
  const pwSubmit = $('[data-role="pw-submit"]');

  let idAccountType = "user";
  let pwAccountType = "user";

  function showTab(tab) {
    tabButtons.forEach((button) => {
      button.classList.toggle(
        "is-active",
        button.dataset.tab === tab
      );
    });

    panels.forEach((panel) => {
      panel.hidden = panel.dataset.panel !== tab;
    });
  }

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      showTab(button.dataset.tab);
    });
  });

  const goPwButton = $('[data-action="go-pw"]');
  if (goPwButton) {
    goPwButton.addEventListener("click", () => showTab("pw"));
  }

  function bindAccountTypeTabs(role, onChange) {
    const container = document.querySelector(
      `[data-role="${role}-account-type"]`
    );

    if (!container) return;

    const buttons = [
      ...container.querySelectorAll("[data-account-type]")
    ];

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        buttons.forEach((item) => {
          item.classList.toggle("is-active", item === button);
        });

        onChange(button.dataset.accountType);
      });
    });
  }

  bindAccountTypeTabs("id", (type) => {
    idAccountType = type;
  });

  bindAccountTypeTabs("pw", (type) => {
    pwAccountType = type;
  });

  function getFindAccountUrl(accountType) {
    const type = accountType === "seller" ? "seller" : "user";
    return `${API_BASE}/auth/${type}/find-account`;
  }

  function setMessage(element, text = "", type = "") {
    if (!element) return;

    element.textContent = text;
    element.className = "form-message";

    if (type) {
      element.classList.add(type);
    }
  }

  function setLoading(button, loading, originalText) {
    if (!button) return;

    button.disabled = loading;
    button.textContent = loading ? "처리 중..." : originalText;
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async function requestFindAccount(accountType, payload) {
    const response = await fetch(getFindAccountUrl(accountType), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(payload)
    });

    let result = {};

    try {
      result = await response.json();
    } catch (_) {
      result = {};
    }

    if (!response.ok) {
      const message =
        result.message ||
        result.error ||
        result.data?.message ||
        `요청 처리에 실패했습니다. (${response.status})`;

      throw new Error(message);
    }

    return result.data ?? result;
  }

  findIdForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = $("#idName").value.trim();
    const email = $("#idEmail").value.trim();

    setMessage(idMessage);

    if (!name) {
      setMessage(idMessage, "이름을 입력해 주세요.", "error");
      $("#idName").focus();
      return;
    }

    if (!email) {
      setMessage(idMessage, "이메일을 입력해 주세요.", "error");
      $("#idEmail").focus();
      return;
    }

    if (!isValidEmail(email)) {
      setMessage(
        idMessage,
        "이메일 형식을 확인해 주세요.",
        "error"
      );
      $("#idEmail").focus();
      return;
    }

    setLoading(idSubmit, true, "아이디 찾기");

    try {
      const data = await requestFindAccount(idAccountType, {
        type: "ID",
        name,
        username: null,
        email
      });

      const maskedUsername =
        data.maskedUsername ??
        data.username ??
        data.maskedId;

      if (!maskedUsername) {
        throw new Error(
          data.message ||
          "아이디 조회 결과를 확인하지 못했습니다."
        );
      }

      idValue.textContent = maskedUsername;
      findIdForm.hidden = true;
      idResult.hidden = false;
    } catch (error) {
      console.error("아이디 찾기 실패:", error);
      setMessage(idMessage, error.message, "error");
    } finally {
      setLoading(idSubmit, false, "아이디 찾기");
    }
  });

  findPwForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = $("#pwUsername").value.trim();
    const email = $("#pwEmail").value.trim();

    setMessage(pwMessage);

    if (!username) {
      setMessage(pwMessage, "아이디를 입력해 주세요.", "error");
      $("#pwUsername").focus();
      return;
    }

    if (!email) {
      setMessage(pwMessage, "이메일을 입력해 주세요.", "error");
      $("#pwEmail").focus();
      return;
    }

    if (!isValidEmail(email)) {
      setMessage(
        pwMessage,
        "이메일 형식을 확인해 주세요.",
        "error"
      );
      $("#pwEmail").focus();
      return;
    }

    setLoading(pwSubmit, true, "임시 비밀번호 받기");

    try {
      const data = await requestFindAccount(pwAccountType, {
        type: "PASSWORD",
        name: null,
        username,
        email
      });

      pwResultMessage.textContent =
        data.message ||
        "가입 이메일로 임시 비밀번호를 발송했습니다.";

      findPwForm.hidden = true;
      pwResult.hidden = false;
    } catch (error) {
      console.error("비밀번호 찾기 실패:", error);
      setMessage(pwMessage, error.message, "error");
    } finally {
      setLoading(
        pwSubmit,
        false,
        "임시 비밀번호 받기"
      );
    }
  });

  const requestedTab = new URLSearchParams(
    location.search
  ).get("tab");

  if (requestedTab === "pw") {
    showTab("pw");
  }
});
