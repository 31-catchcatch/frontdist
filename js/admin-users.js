/* 관리자 - 사용자 목록/정지 (GET /admin/users, PATCH /admin/users/{id}/status) */
(function () {
  "use strict";

  const ROLE = { USER: "일반", SELLER: "판매자", ADMIN: "관리자" };
  const STATUS = { ok: "정상", stop: "정지" };

  const rowsEl = document.getElementById("rows");
  const countEl = document.getElementById("count");
  const qEl = document.getElementById("q");
  const roleEl = document.getElementById("roleFilter");
  const statusEl = document.getElementById("statusFilter");

  let USERS = [];

  // 백엔드 AdminUserResponse → 화면에서 쓰는 형태로 변환
  function mapUser(u) {
    return {
      id: u.userId,
      username: u.username,
      name: u.name,
      email: u.email,
      role: u.role,
      point: u.point,
      deleted: u.deleted,
      status: u.suspended ? "stop" : "ok",
      joined: (u.createdAt || "").slice(0, 10),
      createdAt: u.createdAt,
    };
  }

  // 상세 모달 — 목록 API가 이미 준 정보만 표시 (백엔드 추가 호출 없음)
  function showDetail(user) {
    AdminUI.detail("사용자 상세", [
      ["사용자 ID", user.id],
      ["아이디", user.username],
      ["이름", user.name],
      ["이메일", user.email],
      ["권한", ROLE[user.role] || user.role],
      ["보유 포인트", `${AdminUI.num(user.point || 0)} P`],
      ["계정 상태", user.deleted ? "탈퇴" : STATUS[user.status]],
      ["가입일시", (user.createdAt || "-").replace("T", " ").slice(0, 19)],
    ]);
  }

  function render(list, total = list.length) {
    if (!list.length) {
      rowsEl.innerHTML = '<tr class="empty-row"><td colspan="8">조건에 맞는 사용자가 없습니다.</td></tr>';
      countEl.textContent = 0;
      return;
    }
    rowsEl.innerHTML = list.map((u) => `
      <tr data-id="${AdminUI.escape(u.id)}">
        <td class="chk"><input type="checkbox" aria-label="${AdminUI.escape(u.name)} 선택"></td>
        <td class="strong">${AdminUI.escape(u.username)}</td>
        <td class="strong">${AdminUI.escape(u.name)}</td>
        <td class="muted">${AdminUI.escape(u.email)}</td>
        <td><span class="tag role">${ROLE[u.role] || u.role}</span></td>
        <td><span class="tag ${u.status}">${STATUS[u.status]}</span></td>
        <td class="muted">${AdminUI.escape(u.joined)}</td>
        <td>
          <div class="row-actions">
            <button class="btn sm" data-act="detail">상세</button>
            ${u.status === "ok"
              ? '<button class="btn sm danger" data-act="suspend">정지</button>'
              : '<button class="btn sm ok" data-act="restore">정지해제</button>'}
          </div>
        </td>
      </tr>`).join("");
    countEl.textContent = total;
  }

  const listController = AdminUI.createListController({ pager: document.querySelector(".pager"), render });

  function applyFilter() {
    const q = qEl.value.trim().toLowerCase();
    const role = roleEl.value;
    const status = statusEl.value;
    listController.setItems(USERS.filter((u) =>
      (!role || u.role === role) &&
      (!status || u.status === status) &&
      (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.username || "").toLowerCase().includes(q))
    ));
  }

  qEl.addEventListener("input", applyFilter);
  roleEl.addEventListener("change", applyFilter);
  statusEl.addEventListener("change", applyFilter);

  document.getElementById("checkAll").addEventListener("change", (e) => {
    rowsEl.querySelectorAll('input[type="checkbox"]').forEach((c) => (c.checked = e.target.checked));
  });

  rowsEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const id = btn.closest("tr").dataset.id;
    const user = USERS.find((u) => String(u.id) === String(id));
    if (!user) return;

    if (btn.dataset.act === "detail") {
      showDetail(user);
      return;
    }

    const suspend = btn.dataset.act === "suspend";
    const ok = await AdminUI.confirm({
      title: suspend ? "사용자 정지" : "정지 해제",
      message: `${user.name}(${user.username}) 계정을 ${suspend ? "정지" : "정상 복구"}하시겠습니까?`,
      okText: suspend ? "정지" : "해제",
      danger: suspend,
    });
    if (!ok) return;

    try {
      await AdminApi.patch(`/users/${user.id}/status`, { suspended: suspend });
      user.status = suspend ? "stop" : "ok";
      applyFilter();
      AdminUI.toast(suspend ? "정지 처리되었습니다." : "정지 해제되었습니다.");
    } catch (err) {
      AdminUI.toast(err.message || "처리에 실패했습니다.");
    }
  });

  async function load() {
    try {
      const data = await AdminApi.list("/users?size=200");
      // 관리자(ADMIN) 계정은 사용자 관리 목록에서 제외한다.
      USERS = data.filter((u) => u.role !== "ADMIN").map(mapUser);
      applyFilter();
    } catch (err) {
      rowsEl.innerHTML = `<tr class="empty-row"><td colspan="8">${AdminUI.escape(err.message || "목록을 불러오지 못했습니다.")}</td></tr>`;
      countEl.textContent = 0;
    }
  }

  load();
})();
