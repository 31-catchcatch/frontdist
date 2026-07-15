document.addEventListener("DOMContentLoaded", () => {
  const unreadCount = document.getElementById("unreadCount");
  const readAllButton = document.getElementById("readAllBtn");

  const updateUnreadCount = () => {
    unreadCount.textContent = document.querySelectorAll(".notification-card.unread").length;
  };

  const markAsRead = (card) => {
    card.classList.remove("unread");

    const status = card.querySelector(".status");
    status.textContent = "읽음";
    status.classList.remove("unread-status");
    status.classList.add("read-status");

    card.querySelector(".read-btn")?.remove();
    updateUnreadCount();
  };

  document.querySelectorAll(".read-btn").forEach((button) => {
    button.addEventListener("click", () => markAsRead(button.closest(".notification-card")));
  });

  readAllButton.addEventListener("click", () => {
    document.querySelectorAll(".notification-card.unread").forEach(markAsRead);
  });

  updateUnreadCount();
});
