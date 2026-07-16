// addresses.js — 일반 회원 배송지 관리 API 연동
//
// GET    /api/v1/users/me/addresses
// POST   /api/v1/users/me/addresses
// PUT    /api/v1/users/me/addresses/{addressId}
// DELETE /api/v1/users/me/addresses/{addressId}

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  if (!window.CatchAuth || !CatchAuth.requireLogin()) return;

  const API_URL = (
    window.CATCHCATCH_API_BASE_URL ||
    "/api/v1"
  ).replace(/\/$/, "") + "/users/me/addresses";

  const $ = (selector) => document.querySelector(selector);

  const rowsElement = $("#addressRows");
  const listMessage = $("#listMessage");
  const editArea = $("#edit-area");
  const editForm = $("#editAddressForm");
  const addForm = $("#addAddressForm");
  const editMessage = $("#editMessage");
  const addMessage = $("#addMessage");
  const editSubmitButton = $("#editSubmitButton");
  const addSubmitButton = $("#addSubmitButton");

  let addresses = [];
  let editingAddressId = null;
  let addressInputTarget = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function setMessage(element, message = "", type = "") {
    if (!element) return;
    element.textContent = message;
    element.className = "api-message";
    if (type) element.classList.add(type);
  }

  function setLoading(button, loading, normalText) {
    if (!button) return;
    button.disabled = loading;
    button.textContent = loading ? "처리 중..." : normalText;
  }

  async function apiRequest(path = "", options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
      credentials: "include",
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });

    let payload = null;
    const text = await response.text();

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch (_) {
        payload = null;
      }
    }

    if (response.status === 401 || response.status === 403) {
      CatchAuth.logout();
      throw new Error("로그인이 만료되었습니다. 다시 로그인해 주세요.");
    }

    if (!response.ok || payload?.success === false) {
      throw new Error(
        payload?.message ||
        payload?.data?.message ||
        `요청을 처리하지 못했습니다. (${response.status})`
      );
    }

    return payload?.data ?? payload;
  }

  function normalizeAddress(item) {
    return {
      id: item?.id ?? item?.addressId,
      addressName: item?.addressName ?? "",
      recipientName: item?.recipientName ?? "",
      recipientPhone: item?.recipientPhone ?? "",
      baseAddress: item?.baseAddress ?? "",
      detailAddress: item?.detailAddress ?? "",
      defaultAddress: Boolean(
        item?.defaultAddress ??
        item?.isDefault ??
        item?.isDefaultAddress
      )
    };
  }

  function fullAddress(address) {
    return [address.baseAddress, address.detailAddress]
      .filter(Boolean)
      .join(" ");
  }

  function renderAddresses() {
    if (!addresses.length) {
      rowsElement.innerHTML = `
        <tr>
          <td colspan="6" class="empty-cell">
            등록된 배송지가 없습니다.
          </td>
        </tr>
      `;
      return;
    }

    rowsElement.innerHTML = addresses.map((address) => `
      <tr data-address-id="${escapeHtml(address.id)}">
        <td>${escapeHtml(address.addressName)}</td>
        <td>${escapeHtml(address.recipientName)}</td>
        <td>${escapeHtml(fullAddress(address))}</td>
        <td>${escapeHtml(address.recipientPhone)}</td>
        <td class="default-cell">
          <input
            type="checkbox"
            class="default-address"
            data-action="default"
            aria-label="${escapeHtml(address.addressName)}을 기본 배송지로 설정"
            ${address.defaultAddress ? "checked" : ""}
          >
        </td>
        <td>
          <div class="row-actions">
            <button type="button" class="btn-outline btn-small" data-action="edit">수정</button>
            <button type="button" class="btn-outline btn-small btn-danger" data-action="delete">삭제</button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  async function loadAddresses() {
    setMessage(listMessage, "배송지 목록을 불러오는 중입니다.");

    try {
      const data = await apiRequest("", { method: "GET" });
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.content)
          ? data.content
          : [];

      addresses = list
        .map(normalizeAddress)
        .filter((address) => address.id !== null && address.id !== undefined);

      renderAddresses();
      setMessage(listMessage);
    } catch (error) {
      console.error("배송지 목록 조회 실패:", error);
      addresses = [];
      rowsElement.innerHTML = `
        <tr>
          <td colspan="6" class="empty-cell">
            배송지 목록을 불러오지 못했습니다.
          </td>
        </tr>
      `;
      setMessage(listMessage, error.message, "error");
    }
  }

  function getFormPayload(prefix) {
    return {
      addressName: $(`#${prefix}Name`).value.trim(),
      recipientName: $(`#${prefix}Receiver`).value.trim(),
      recipientPhone: $(`#${prefix}Phone`).value.trim(),
      baseAddress: $(`#${prefix}Addr`).value.trim(),
      detailAddress: $(`#${prefix}Detail`).value.trim(),
      defaultAddress: $(`#${prefix}Default`).checked
    };
  }

  function validatePayload(payload) {
    if (!payload.addressName) return "배송지명을 입력해 주세요.";
    if (!payload.recipientName) return "받는 사람을 입력해 주세요.";
    if (!payload.recipientPhone) return "연락처를 입력해 주세요.";
    if (!payload.baseAddress) return "주소를 입력해 주세요.";
    return "";
  }

  function switchTab(tabName) {
    document.querySelectorAll(".tab-btn").forEach((button) => {
      const active = button.dataset.tab === tabName;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });

    document.querySelectorAll(".tab-content").forEach((content) => {
      content.classList.toggle("active", content.id === tabName);
    });

    if (tabName === "add") {
      closeEditArea();
    }
  }

  document.querySelectorAll(".tab-btn").forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });

  function openEditArea(address) {
    editingAddressId = address.id;

    $("#editName").value = address.addressName;
    $("#editReceiver").value = address.recipientName;
    $("#editPhone").value = address.recipientPhone;
    $("#editAddr").value = address.baseAddress;
    $("#editDetail").value = address.detailAddress;
    $("#editDefault").checked = address.defaultAddress;

    setMessage(editMessage);
    editArea.style.display = "block";

    setTimeout(() => {
      editArea.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 50);
  }

  function closeEditArea() {
    editingAddressId = null;
    editForm.reset();
    editArea.style.display = "none";
    setMessage(editMessage);
  }

  $("#cancelEditButton").addEventListener("click", closeEditArea);

  rowsElement.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const row = button.closest("tr[data-address-id]");
    const id = row?.dataset.addressId;
    const address = addresses.find((item) => String(item.id) === String(id));

    if (!address) {
      setMessage(listMessage, "배송지 정보를 찾지 못했습니다.", "error");
      return;
    }

    if (button.dataset.action === "edit") {
      openEditArea(address);
      return;
    }

    if (button.dataset.action === "delete") {
      const confirmed = window.confirm(
        `[${address.addressName}] 배송지를 삭제하시겠습니까?`
      );
      if (!confirmed) return;

      button.disabled = true;

      try {
        await apiRequest(`/${address.id}`, { method: "DELETE" });
        closeEditArea();
        await loadAddresses();
        setMessage(listMessage, "배송지가 삭제되었습니다.", "ok");
      } catch (error) {
        console.error("배송지 삭제 실패:", error);
        setMessage(listMessage, error.message, "error");
      } finally {
        button.disabled = false;
      }
    }
  });

  rowsElement.addEventListener("change", async (event) => {
    const checkbox = event.target.closest('input[data-action="default"]');
    if (!checkbox) return;

    const row = checkbox.closest("tr[data-address-id]");
    const id = row?.dataset.addressId;
    const address = addresses.find((item) => String(item.id) === String(id));

    if (!address) return;

    // 현재 기본 배송지는 화면에서 단순 해제하지 못하게 한다.
    if (!checkbox.checked) {
      checkbox.checked = true;
      setMessage(
        listMessage,
        "다른 배송지를 선택하면 기본 배송지가 변경됩니다.",
        "error"
      );
      return;
    }

    checkbox.disabled = true;

    try {
      await apiRequest(`/${address.id}`, {
        method: "PUT",
        body: JSON.stringify({
          addressName: address.addressName,
          recipientName: address.recipientName,
          recipientPhone: address.recipientPhone,
          baseAddress: address.baseAddress,
          detailAddress: address.detailAddress,
          defaultAddress: true
        })
      });

      await loadAddresses();
      setMessage(listMessage, "기본 배송지가 변경되었습니다.", "ok");
    } catch (error) {
      console.error("기본 배송지 변경 실패:", error);
      checkbox.checked = false;
      setMessage(listMessage, error.message, "error");
    } finally {
      checkbox.disabled = false;
    }
  });

  addForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = getFormPayload("add");
    const validationMessage = validatePayload(payload);

    if (validationMessage) {
      setMessage(addMessage, validationMessage, "error");
      return;
    }

    setLoading(addSubmitButton, true, "등록하기");
    setMessage(addMessage);

    try {
      await apiRequest("", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      addForm.reset();
      await loadAddresses();
      switchTab("list");
      setMessage(listMessage, "배송지가 등록되었습니다.", "ok");
    } catch (error) {
      console.error("배송지 등록 실패:", error);
      setMessage(addMessage, error.message, "error");
    } finally {
      setLoading(addSubmitButton, false, "등록하기");
    }
  });

  editForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (editingAddressId === null) {
      setMessage(editMessage, "수정할 배송지를 선택해 주세요.", "error");
      return;
    }

    const payload = getFormPayload("edit");
    const validationMessage = validatePayload(payload);

    if (validationMessage) {
      setMessage(editMessage, validationMessage, "error");
      return;
    }

    setLoading(editSubmitButton, true, "수정 완료");
    setMessage(editMessage);

    try {
      await apiRequest(`/${editingAddressId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });

      closeEditArea();
      await loadAddresses();
      setMessage(listMessage, "배송지가 수정되었습니다.", "ok");
    } catch (error) {
      console.error("배송지 수정 실패:", error);
      setMessage(editMessage, error.message, "error");
    } finally {
      setLoading(editSubmitButton, false, "수정 완료");
    }
  });

  const addressModal = $("#address-modal");
  const addressKeyword = $("#address-keyword");

  function openAddressModal(target) {
    addressInputTarget = target;
    addressKeyword.value = target === "edit"
      ? $("#editAddr").value
      : $("#addAddr").value;

    addressModal.style.display = "flex";
    addressModal.setAttribute("aria-hidden", "false");
    setTimeout(() => addressKeyword.focus(), 0);
  }

  function closeAddressModal() {
    addressModal.style.display = "none";
    addressModal.setAttribute("aria-hidden", "true");
    addressInputTarget = null;
  }

  document.querySelectorAll("[data-address-target]").forEach((button) => {
    button.addEventListener("click", () => {
      openAddressModal(button.dataset.addressTarget);
    });
  });

  $("#applyAddressButton").addEventListener("click", () => {
    const address = addressKeyword.value.trim();

    if (!address) {
      window.alert("주소를 입력해 주세요.");
      return;
    }

    const targetElement = addressInputTarget === "edit"
      ? $("#editAddr")
      : $("#addAddr");

    targetElement.value = address;
    closeAddressModal();
    targetElement.focus();
  });

  $("#closeAddressButton").addEventListener("click", closeAddressModal);

  addressModal.addEventListener("click", (event) => {
    if (event.target === addressModal) closeAddressModal();
  });

  addressKeyword.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      $("#applyAddressButton").click();
    }
  });

  loadAddresses();
});
