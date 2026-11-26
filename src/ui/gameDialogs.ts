export interface DialogCard {
  id: string;
  name: string;
  color?: string;
  description?: string;
}

export interface DialogOption {
  value: string;
  label: string;
  description?: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character] ?? character);
}

/** Select one option in an in-game modal. */
export function chooseOptionDialog(
  title: string,
  description: string,
  options: DialogOption[]
): Promise<string | undefined> {
  if (!options.length) return Promise.resolve(undefined);
  return new Promise(resolve => {
    const dialog = document.createElement("dialog");
    dialog.className = "game-choice-dialog";
    dialog.innerHTML = `
      <form method="dialog" class="game-choice-dialog__content">
        <p class="eyebrow">GAME ACTION</p>
        <h2>${escapeHtml(title)}</h2>
        <p class="game-choice-dialog__description">${escapeHtml(description)}</p>
        <div class="game-choice-dialog__options">
          ${options.map(option => `
            <button type="button" class="game-choice-dialog__option" data-value="${escapeHtml(option.value)}">
              <strong>${escapeHtml(option.label)}</strong>
              ${option.description ? `<small>${escapeHtml(option.description)}</small>` : ""}
            </button>
          `).join("")}
        </div>
        <div class="game-choice-dialog__actions">
          <button type="button" class="secondary" data-cancel>ยกเลิก</button>
        </div>
      </form>`;
    document.body.append(dialog);
    let settled = false;
    const finish = (value: string | undefined) => {
      if (settled) return;
      settled = true;
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    dialog.querySelectorAll<HTMLButtonElement>("[data-value]").forEach(button => {
      button.addEventListener("click", () => finish(button.dataset.value));
    });
    dialog.querySelector<HTMLButtonElement>("[data-cancel]")!.addEventListener("click", () => finish(undefined));
    dialog.addEventListener("cancel", event => { event.preventDefault(); finish(undefined); });
    dialog.showModal();
  });
}

/** Select one or more cards; requiredCount enforces an exact payment. */
export function selectCardsDialog(
  title: string,
  description: string,
  cards: DialogCard[],
  requiredCount?: number
): Promise<string[] | undefined> {
  if (!cards.length) return Promise.resolve(undefined);
  if (requiredCount !== undefined && new Set(cards.map(card => card.id)).size < requiredCount) {
    return Promise.reject(new Error(`ต้องมีไพ่ที่เลือกได้อย่างน้อย ${requiredCount} ใบ`));
  }
  return new Promise(resolve => {
    const dialog = document.createElement("dialog");
    dialog.className = "game-choice-dialog";
    dialog.innerHTML = `
      <form method="dialog" class="game-choice-dialog__content">
        <p class="eyebrow">CARD SELECTION</p>
        <h2>${escapeHtml(title)}</h2>
        <p class="game-choice-dialog__description">${escapeHtml(description)}</p>
        <p class="game-choice-dialog__count" aria-live="polite">เลือกแล้ว 0${requiredCount === undefined ? "" : ` / ${requiredCount}`} ใบ</p>
        <div class="game-choice-dialog__cards">
          ${cards.map(card => `
            <label class="game-choice-dialog__card">
              <input type="checkbox" data-card-id="${escapeHtml(card.id)}" />
              <span><strong>${escapeHtml(card.name)}</strong><small>${escapeHtml(card.color ?? "ไพ่")} · ${escapeHtml(card.id)}${card.description ? ` · ${escapeHtml(card.description)}` : ""}</small></span>
            </label>
          `).join("")}
        </div>
        <div class="game-choice-dialog__actions">
          <button type="button" class="secondary" data-cancel>ยกเลิก</button>
          <button type="submit" data-confirm disabled>ยืนยันการเลือก</button>
        </div>
      </form>`;
    document.body.append(dialog);
    const checkboxes = [...dialog.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    const count = dialog.querySelector<HTMLElement>(".game-choice-dialog__count")!;
    const confirm = dialog.querySelector<HTMLButtonElement>("[data-confirm]")!;
    let settled = false;
    const finish = (value: string[] | undefined) => {
      if (settled) return;
      settled = true;
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    const refresh = () => {
      const selected = checkboxes.filter(input => input.checked);
      const ids = new Set(selected.map(input => input.dataset.cardId));
      checkboxes.forEach(input => { input.disabled = !input.checked && ids.has(input.dataset.cardId); });
      count.textContent = `เลือกแล้ว ${selected.length}${requiredCount === undefined ? " ใบ" : ` / ${requiredCount} ใบ`}`;
      confirm.disabled = requiredCount === undefined ? selected.length === 0 : selected.length !== requiredCount;
    };
    checkboxes.forEach(input => input.addEventListener("change", refresh));
    dialog.querySelector<HTMLButtonElement>("[data-cancel]")!.addEventListener("click", () => finish(undefined));
    dialog.addEventListener("cancel", event => { event.preventDefault(); finish(undefined); });
    dialog.querySelector<HTMLFormElement>("form")!.addEventListener("submit", event => {
      event.preventDefault();
      const selected = checkboxes.filter(input => input.checked).map(input => input.dataset.cardId!);
      if (requiredCount !== undefined && selected.length !== requiredCount) return;
      if (new Set(selected).size !== selected.length) return;
      finish(selected);
    });
    dialog.showModal();
  });
}

/** Confirm or cancel an optional action in an in-game modal. */
export function confirmActionDialog(title: string, description: string): Promise<boolean> {
  return new Promise(resolve => {
    const dialog = document.createElement("dialog");
    dialog.className = "game-choice-dialog";
    dialog.innerHTML = `
      <form method="dialog" class="game-choice-dialog__content">
        <p class="eyebrow">CONFIRM ACTION</p>
        <h2>${escapeHtml(title)}</h2>
        <p class="game-choice-dialog__description">${escapeHtml(description)}</p>
        <div class="game-choice-dialog__actions">
          <button type="button" class="secondary" data-cancel>ไม่ใช้กับมอนสเตอร์</button>
          <button type="submit">ยืนยัน</button>
        </div>
      </form>`;
    document.body.append(dialog);
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    dialog.querySelector<HTMLButtonElement>("[data-cancel]")!.addEventListener("click", () => finish(false));
    dialog.querySelector<HTMLFormElement>("form")!.addEventListener("submit", event => { event.preventDefault(); finish(true); });
    dialog.addEventListener("cancel", event => { event.preventDefault(); finish(false); });
    dialog.showModal();
  });
}

/** Collect a short text value without using the browser prompt. */
export function textInputDialog(
  title: string,
  description: string,
  initialValue = ""
): Promise<string | undefined> {
  return new Promise(resolve => {
    const dialog = document.createElement("dialog");
    dialog.className = "game-choice-dialog";
    dialog.innerHTML = `
      <form method="dialog" class="game-choice-dialog__content">
        <p class="eyebrow">GAME INPUT</p>
        <h2>${escapeHtml(title)}</h2>
        <p class="game-choice-dialog__description">${escapeHtml(description)}</p>
        <input class="game-choice-dialog__input" name="value" value="${escapeHtml(initialValue)}" autocomplete="off" />
        <div class="game-choice-dialog__actions">
          <button type="button" class="secondary" data-cancel>ยกเลิก</button>
          <button type="submit">ยืนยัน</button>
        </div>
      </form>`;
    document.body.append(dialog);
    const form = dialog.querySelector<HTMLFormElement>("form")!;
    const input = form.querySelector<HTMLInputElement>("input")!;
    let settled = false;
    const finish = (value: string | undefined) => {
      if (settled) return;
      settled = true;
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    form.addEventListener("submit", event => { event.preventDefault(); finish(input.value.trim() || undefined); });
    dialog.querySelector<HTMLButtonElement>("[data-cancel]")!.addEventListener("click", () => finish(undefined));
    dialog.addEventListener("cancel", event => { event.preventDefault(); finish(undefined); });
    dialog.showModal();
    input.focus();
    input.select();
  });
}
