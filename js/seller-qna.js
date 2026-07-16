// seller-qna.js — 판매자 상품 Q&A 목록 조회 및 답변 등록/수정

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = (
    window.CATCHCATCH_API_BASE_URL || "/api/v1"
  ).replace(/\/$/, "");

  const QNA_API = `${API_BASE}/seller/qna`;

  const tbody = document.querySelector(".qna-table tbody");
  const filterButtons = [
    ...document.querySelectorAll(".summary-btn")
  ];

  const answerBox = document.getElementById("answerBox");
  const answerProduct =
    document.getElementById("answerProduct");
  const answerQuestion =
    document.getElementById("answerQuestion");
  const answerText =
    document.getElementById("answerText");
  const saveButton =
    document.getElementById("saveAnswerBtn");
  // S-QA-003: 부적절한 고객 질문 삭제 (없으면 삭제 기능만 비활성)
  const deleteButton =
    document.getElementById("deleteQnaBtn");

  let currentFilter = "all";
  let currentQnaList = [];
  let selectedQnaId = null;

  // 판매자 로그인 확인
  if (
    window.CatchAuth &&
    typeof CatchAuth.requireLogin === "function" &&
    !CatchAuth.requireLogin()
  ) {
    return;
  }

  if (
    !tbody ||
    !answerBox ||
    !answerProduct ||
    !answerQuestion ||
    !answerText ||
    !saveButton
  ) {
    console.error("판매자 Q&A 화면 요소를 찾지 못했습니다.");
    return;
  }

  /**
   * 백엔드 요청 공통 함수
   */
  async function requestApi(url, options = {}) {
    const response = await fetch(url, {
      credentials: "include",
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body
          ? { "Content-Type": "application/json" }
          : {}),
        ...(options.headers || {})
      }
    });

    let result = {};

    try {
      result = await response.json();
    } catch (_) {
      result = {};
    }

    if (response.status === 401 || response.status === 403) {
      alert("판매자 로그인이 필요합니다.");
      location.href = "seller-login.html";
      throw new Error("UNAUTHORIZED");
    }

    if (!response.ok) {
      throw new Error(
        result.message ||
        `요청 처리에 실패했습니다. (${response.status})`
      );
    }

    return result;
  }

  /**
   * 날짜 표시
   * 2026-07-16T12:30:00 → 2026.07.16
   */
  function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value).slice(0, 10).replaceAll("-", ".");
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}.${month}.${day}`;
  }

  /**
   * HTML 특수문자 처리
   */
  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  /**
   * 필터에 해당하는 answered 값
   */
  function getAnsweredValue(filter) {
    if (filter === "wait") return false;
    if (filter === "complete") return true;
    return null;
  }

  /**
   * Q&A API 주소 생성
   */
  function createListUrl({
    filter = "all",
    page = 0,
    size = 20
  } = {}) {
    const params = new URLSearchParams();

    const answered = getAnsweredValue(filter);

    if (answered !== null) {
      params.set("answered", String(answered));
    }

    params.set("page", String(page));
    params.set("size", String(size));

    return `${QNA_API}?${params.toString()}`;
  }

  /**
   * Q&A 페이지 데이터 요청
   */
  async function fetchQnaPage({
    filter = "all",
    page = 0,
    size = 20
  } = {}) {
    const result = await requestApi(
      createListUrl({ filter, page, size })
    );

    const pageData = result.data ?? {};

    return {
      content: Array.isArray(pageData.content)
        ? pageData.content
        : [],
      totalElements: Number(pageData.totalElements ?? 0),
      totalPages: Number(pageData.totalPages ?? 0),
      number: Number(pageData.number ?? page),
      size: Number(pageData.size ?? size)
    };
  }

  /**
   * 표에 Q&A 목록 출력
   */
  function renderQnaList(items) {
    currentQnaList = items;

    if (items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding:50px 20px;">
            등록된 문의가 없습니다.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = items
      .map((qna, index) => {
        const statusClass = qna.answered
          ? "complete"
          : "waiting";

        const statusText = qna.answered
          ? "답변 완료"
          : "답변대기";

        /*
         * 백엔드 응답에는 작성자 이름이 없고 userId만 있으므로
         * 현재는 "회원 #ID"로 표시
         */
        const writer = `회원 #${qna.userId}`;

        return `
          <tr
            class="qna-row"
            data-qna-id="${qna.qnaId}"
            data-status="${qna.answered ? "complete" : "wait"}"
          >
            <td>
              ${String(index + 1).padStart(3, "0")}
            </td>

            <td>
              ${escapeHTML(qna.productName)}
            </td>

            <td>
              <button
                type="button"
                class="qna-item"
                data-qna-id="${qna.qnaId}"
                style="
                  border:0;
                  padding:0;
                  background:none;
                  font:inherit;
                  color:inherit;
                  cursor:pointer;
                  text-align:left;
                "
              >
                ${escapeHTML(
                  qna.questionTitle ||
                  qna.questionContent
                )}
              </button>
            </td>

            <td>
              ${escapeHTML(writer)}
            </td>

            <td>
              ${formatDate(qna.createdAt)}
            </td>

            <td>
              <span class="${statusClass}">
                ${statusText}
              </span>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  /**
   * 상단 전체·대기·완료 개수 조회
   */
  async function loadCounts() {
    const [allPage, waitPage, completePage] =
      await Promise.all([
        fetchQnaPage({ filter: "all", size: 1 }),
        fetchQnaPage({ filter: "wait", size: 1 }),
        fetchQnaPage({ filter: "complete", size: 1 })
      ]);

    const counts = {
      all: allPage.totalElements,
      wait: waitPage.totalElements,
      complete: completePage.totalElements
    };

    filterButtons.forEach((button) => {
      const countElement = button.querySelector("b");
      const filter = button.dataset.filter;

      if (countElement && filter in counts) {
        countElement.textContent = counts[filter];
      }
    });
  }

  /**
   * 선택한 필터의 목록 조회
   */
  async function loadQnaList(filter = currentFilter) {
    currentFilter = filter;

    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:50px 20px;">
          문의 목록을 불러오는 중입니다.
        </td>
      </tr>
    `;

    const pageData = await fetchQnaPage({
      filter,
      page: 0,
      size: 20
    });

    renderQnaList(pageData.content);
  }

  /**
   * 필터 버튼 활성화
   */
  function setActiveFilter(activeButton) {
    filterButtons.forEach((button) => {
      button.classList.toggle(
        "active",
        button === activeButton
      );
    });
  }

  /**
   * 문의 선택 → 답변 입력 영역 표시
   */
  tbody.addEventListener("click", (event) => {
    const item = event.target.closest(".qna-item");
    if (!item) return;

    const qnaId = Number(item.dataset.qnaId);

    const qna = currentQnaList.find(
      (value) => Number(value.qnaId) === qnaId
    );

    if (!qna) return;

    selectedQnaId = qna.qnaId;

    answerProduct.textContent =
      `상품 : ${qna.productName}`;

    answerQuestion.textContent =
      `문의 : ${qna.questionTitle}\n${qna.questionContent}`;

    /*
     * 이미 답변이 있으면 수정할 수 있도록 기존 답변 표시
     */
    answerText.value = qna.answer?.content ?? "";

    saveButton.textContent = qna.answered
      ? "답변 수정"
      : "답변 등록";

    answerBox.style.display = "block";

    answerBox.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    answerText.focus();
  });

  /**
   * 답변 등록 또는 수정
   */
  async function saveAnswer(qnaId, content) {
    const result = await requestApi(
      `${QNA_API}/${qnaId}/answers`,
      {
        method: "POST",
        body: JSON.stringify({
          content
        })
      }
    );

    return result.data;
  }

  saveButton.addEventListener("click", async () => {
    const content = answerText.value.trim();

    if (!selectedQnaId) {
      alert("답변을 등록할 문의를 선택해주세요.");
      return;
    }

    if (!content) {
      alert("답변 내용을 입력해주세요.");
      answerText.focus();
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "저장 중...";

    try {
      await saveAnswer(selectedQnaId, content);

      alert("답변이 저장되었습니다.");

      answerBox.style.display = "none";
      answerText.value = "";
      selectedQnaId = null;

      /*
       * DB에 저장된 최신 상태를 다시 조회
       */
      await Promise.all([
        loadCounts(),
        loadQnaList(currentFilter)
      ]);
    } catch (error) {
      console.error("Q&A 답변 저장 실패:", error);

      if (error.message !== "UNAUTHORIZED") {
        alert(error.message);
      }
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "답변 등록";
    }
  });

  /**
   * 문의 삭제 (S-QA-003)
   * DELETE /api/v1/seller/qna/{qnaId}
   * 백엔드는 소프트 삭제(is_deleted=true) 처리하며, 이후 목록에서 제외된다.
   */
  if (deleteButton) {
    deleteButton.addEventListener("click", async () => {
      if (!selectedQnaId) {
        alert("삭제할 문의를 선택해주세요.");
        return;
      }

      if (!confirm("이 문의를 삭제할까요?\n삭제된 문의는 상품 페이지와 목록에서 더 이상 노출되지 않습니다.")) {
        return;
      }

      deleteButton.disabled = true;

      try {
        await requestApi(
          `${QNA_API}/${selectedQnaId}`,
          { method: "DELETE" }
        );

        alert("문의가 삭제되었습니다.");

        answerBox.style.display = "none";
        answerText.value = "";
        selectedQnaId = null;

        await Promise.all([
          loadCounts(),
          loadQnaList(currentFilter)
        ]);
      } catch (error) {
        console.error("Q&A 삭제 실패:", error);

        if (error.message !== "UNAUTHORIZED") {
          alert(error.message);
        }
      } finally {
        deleteButton.disabled = false;
      }
    });
  }

  /**
   * 필터 버튼
   */
  filterButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const filter = button.dataset.filter || "all";

      setActiveFilter(button);
      answerBox.style.display = "none";
      selectedQnaId = null;

      try {
        await loadQnaList(filter);
      } catch (error) {
        console.error("Q&A 목록 조회 실패:", error);

        tbody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align:center; padding:50px 20px;">
              문의 목록을 불러오지 못했습니다.
            </td>
          </tr>
        `;

        if (error.message !== "UNAUTHORIZED") {
          alert(error.message);
        }
      }
    });
  });

  /**
   * 페이지 최초 실행
   */
  async function initialize() {
    const requestedStatus =
      new URLSearchParams(location.search).get("status");

    const initialFilter =
      ["all", "wait", "complete"].includes(requestedStatus)
        ? requestedStatus
        : "all";

    const initialButton =
      filterButtons.find(
        (button) =>
          button.dataset.filter === initialFilter
      ) || filterButtons[0];

    if (initialButton) {
      setActiveFilter(initialButton);
    }

    answerBox.style.display = "none";

    try {
      await Promise.all([
        loadCounts(),
        loadQnaList(initialFilter)
      ]);
    } catch (error) {
      console.error("판매자 Q&A 초기화 실패:", error);

      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding:50px 20px;">
            문의 목록을 불러오지 못했습니다.
          </td>
        </tr>
      `;

      if (error.message !== "UNAUTHORIZED") {
        alert(error.message);
      }
    }
  }

  initialize();
});