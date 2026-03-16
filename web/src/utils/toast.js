let toastContainer = null;

const getToastContainer = () => {
  if (toastContainer && document.body.contains(toastContainer)) {
    return toastContainer;
  }

  toastContainer = document.createElement("div");
  toastContainer.className = "toast-container";
  document.body.appendChild(toastContainer);
  return toastContainer;
};

export const showToast = (message, type = "success", optionsArg = null) => {
  let options = {};
  if (typeof type === "object" && type !== null) {
    options = type;
    type = "success";
  } else if (typeof optionsArg === "object" && optionsArg !== null) {
    options = optionsArg;
  }

  if (!message) return;

  const {
    duration = 2400,
    dismissible = false,
    actionLabel = "",
    onAction = null,
  } = options;

  const container = getToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast-item toast-${type}`;

  const messageNode = document.createElement("div");
  messageNode.className = "toast-message";
  messageNode.textContent = message;
  toast.appendChild(messageNode);

  const hasActions = dismissible || actionLabel;
  if (hasActions) {
    const actions = document.createElement("div");
    actions.className = "toast-actions";

    if (actionLabel) {
      const actionBtn = document.createElement("button");
      actionBtn.type = "button";
      actionBtn.className = "toast-action-btn";
      actionBtn.textContent = actionLabel;
      actionBtn.addEventListener("click", () => {
        if (typeof onAction === "function") onAction();
        removeToast();
      });
      actions.appendChild(actionBtn);
    }

    if (dismissible) {
      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "toast-close-btn";
      closeBtn.setAttribute("aria-label", "Cerrar alerta");
      closeBtn.textContent = "X";
      closeBtn.addEventListener("click", () => {
        removeToast();
      });
      actions.appendChild(closeBtn);
    }

    toast.appendChild(actions);
  }

  container.appendChild(toast);

  let removed = false;
  const removeToast = () => {
    if (removed) return;
    removed = true;
    toast.classList.remove("toast-visible");
    setTimeout(() => {
      toast.remove();
    }, 220);
  };

  requestAnimationFrame(() => {
    toast.classList.add("toast-visible");
  });

  if (Number(duration) > 0) {
    setTimeout(() => {
      removeToast();
    }, Number(duration));
  }
};
