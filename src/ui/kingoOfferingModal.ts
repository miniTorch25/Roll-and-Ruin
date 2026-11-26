export interface KingoOfferingCard {
  id: string;
  name: string;
  color: string;
}

export interface KingoOfferingPlayer {
  id: string;
  label: string;
  cards: KingoOfferingCard[];
}

export interface KingoContribution {
  playerId: string;
  cardIds: string[];
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character] ?? character);
}

/** Opens a shared-screen dialog for Kingo's five-card cooperative offering. */
export function selectKingoOfferingModal(
  players: KingoOfferingPlayer[]
): Promise<KingoContribution[] | undefined> {
  const eligible = players.filter(player => player.cards.length > 0);
  const availableUniqueIds = new Set(eligible.flatMap(player => player.cards.map(card => card.id)));
  if (availableUniqueIds.size < 5) {
    return Promise.reject(new Error("ผู้เล่นที่ยังมีชีวิตมีไพ่ที่เลือกได้ไม่ครบ 5 ใบ"));
  }

  return new Promise(resolve => {
    const dialog = document.createElement("dialog");
    dialog.className = "kingo-dialog";
    dialog.setAttribute("aria-labelledby", "kingo-dialog-title");
    dialog.innerHTML = `
      <form method="dialog" class="kingo-dialog__content">
        <p class="eyebrow">LEGEND OFFERING · L10</p>
        <h2 id="kingo-dialog-title">ถวายเครื่องบูชาให้ Kingo</h2>
        <p class="kingo-dialog__hint">เลือกไพ่จากผู้เล่นที่ยังมีชีวิตรวมกันให้ครบ 5 ใบ ผู้เล่นหลายคนสามารถร่วมถวายได้</p>
        <div class="kingo-dialog__count" aria-live="polite">เลือกแล้ว 0 / 5 ใบ</div>
        <div class="kingo-dialog__players">
          ${eligible.map(player => `
            <section class="kingo-dialog__player">
              <h3>${escapeHtml(player.label)} <span>${player.cards.length} ใบ</span></h3>
              <div class="kingo-dialog__cards">
                ${player.cards.map(card => `
                  <label class="kingo-dialog__card">
                    <input type="checkbox" data-player-id="${escapeHtml(player.id)}" data-card-id="${escapeHtml(card.id)}" />
                    <span><strong>${escapeHtml(card.name)}</strong><small>${escapeHtml(card.color)} · ${escapeHtml(card.id)}</small></span>
                  </label>
                `).join("")}
              </div>
            </section>
          `).join("")}
        </div>
        <p class="kingo-dialog__error" role="status"></p>
        <div class="kingo-dialog__actions">
          <button type="button" class="secondary" data-cancel>ยกเลิก</button>
          <button type="submit" data-confirm disabled>ยืนยันการถวาย 5 ใบ</button>
        </div>
      </form>`;
    document.body.append(dialog);

    const form = dialog.querySelector<HTMLFormElement>("form")!;
    const checkboxes = [...dialog.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    const count = dialog.querySelector<HTMLElement>(".kingo-dialog__count")!;
    const confirm = dialog.querySelector<HTMLButtonElement>("[data-confirm]")!;
    const error = dialog.querySelector<HTMLElement>(".kingo-dialog__error")!;
    let settled = false;

    const finish = (value: KingoContribution[] | undefined) => {
      if (settled) return;
      settled = true;
      dialog.close();
      dialog.remove();
      resolve(value);
    };

    const refresh = () => {
      const selected = checkboxes.filter(input => input.checked);
      const ids = new Set(selected.map(input => input.dataset.cardId));
      checkboxes.forEach(input => {
        input.disabled = !input.checked && ids.has(input.dataset.cardId);
      });
      count.textContent = `เลือกแล้ว ${selected.length} / 5 ใบ`;
      confirm.disabled = selected.length !== 5;
      error.textContent = selected.length > 5 ? "เลือกได้ไม่เกิน 5 ใบ" : "";
    };

    checkboxes.forEach(input => input.addEventListener("change", refresh));
    dialog.querySelector<HTMLButtonElement>("[data-cancel]")!.addEventListener("click", () => finish(undefined));
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      finish(undefined);
    });
    form.addEventListener("submit", event => {
      event.preventDefault();
      const selected = checkboxes.filter(input => input.checked);
      if (selected.length !== 5) {
        error.textContent = "กรุณาเลือกไพ่ให้ครบ 5 ใบ";
        return;
      }
      const grouped = new Map<string, string[]>();
      selected.forEach(input => {
        const playerId = input.dataset.playerId!;
        const cardId = input.dataset.cardId!;
        grouped.set(playerId, [...(grouped.get(playerId) ?? []), cardId]);
      });
      finish([...grouped].map(([playerId, cardIds]) => ({ playerId, cardIds })));
    });
    dialog.showModal();
  });
}
