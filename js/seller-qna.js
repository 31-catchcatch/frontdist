document.addEventListener("DOMContentLoaded", () => {
  const rows = [...document.querySelectorAll(".qna-table tbody tr")];
  const filterButtons = [...document.querySelectorAll(".summary-btn")];
  const answerBox = document.getElementById("answerBox");
  const answerProduct = document.getElementById("answerProduct");
  const answerQuestion = document.getElementById("answerQuestion");
  const answerText = document.getElementById("answerText");
  const saveButton = document.getElementById("saveAnswerBtn");
  let selectedRow = null;

  const updateCounts = () => {
    const counts = rows.reduce((result, row) => {
      result.all += 1;
      result[row.dataset.status] += 1;
      return result;
    }, { all: 0, wait: 0, complete: 0 });

    filterButtons.forEach((button) => {
      button.querySelector("b").textContent = counts[button.dataset.filter];
    });
  };

  const filterQna = (status, activeButton) => {
    filterButtons.forEach((button) => button.classList.toggle("active", button === activeButton));
    rows.forEach((row) => {
      row.hidden = status !== "all" && row.dataset.status !== status;
    });
  };

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => filterQna(button.dataset.filter, button));
  });

  document.querySelectorAll(".qna-item").forEach((item) => {
    item.addEventListener("click", (event) => {
      event.preventDefault();
      selectedRow = item.closest("tr");
      answerProduct.textContent = `상품 : ${item.dataset.product}`;
      answerQuestion.textContent = `문의 : ${item.dataset.question}`;
      answerText.value = "";
      answerBox.style.display = "block";
      answerBox.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  saveButton.addEventListener("click", () => {
    const answer = answerText.value.trim();
    if (!selectedRow) {
      alert("답변을 등록할 문의를 선택해주세요.");
      return;
    }
    if (!answer) {
      alert("답변 내용을 입력해주세요.");
      answerText.focus();
      return;
    }

    selectedRow.dataset.status = "complete";
    const status = selectedRow.querySelector("td:last-child span");
    status.className = "complete";
    status.textContent = "답변 완료";
    answerBox.style.display = "none";
    updateCounts();
  });

  const requestedStatus = new URLSearchParams(window.location.search).get("status");
  const initialButton = filterButtons.find((button) => button.dataset.filter === requestedStatus) || filterButtons[0];
  updateCounts();
  filterQna(initialButton.dataset.filter, initialButton);
});
