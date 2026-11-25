import Phaser from "phaser";
import {
  createGameState, endPlayerTurn, finishSpecialTileCheck, finishStatusCheck,
  getActivePlayer, moveActivePlayer, resolveMonsterAttackPhase,
  selectPlayerAction, startPlayerTurn, type GameState, type PlayerAction
} from "../game/turnEngine";
import { createCardDeck, drawCards } from "../cards/deck";

const PATH_LENGTH = 32;
const PLAYER_SETUP = [
  { id: "p1", teamId: "red" },
  { id: "p2", teamId: "blue" },
  { id: "p3", teamId: "green" },
  { id: "p4", teamId: "yellow" }
];
const COLORS = [0xe0a85b, 0x75b8d1, 0x9bc47b, 0xc18bd1];

export class BoardScene extends Phaser.Scene {
  private state!: GameState;
  private tileCenters: { x: number; y: number }[] = [];
  private tokens: Phaser.GameObjects.Container[] = [];
  private deck = createCardDeck(
    Array.from({ length: 60 }, (_, index) => `prototype_card_${String(index + 1).padStart(2, "0")}`)
  );
  private logText?: Phaser.GameObjects.Text;
  private actionLocked = false;

  constructor() { super("BoardScene"); }

  create(): void {
    this.state = createGameState("1x4", PLAYER_SETUP, 3, PATH_LENGTH);
    this.state = {
      ...this.state,
      players: this.state.players.map((player) => {
        const drawn = drawCards([], this.deck, 4);
        this.deck = drawn.deck;
        return { ...player, hand: drawn.hand };
      })
    };
    this.state = startPlayerTurn(resolveMonsterAttackPhase(this.state).state);
    this.drawBackdrop();
    this.drawBoard();
    this.createPlayers();
    this.createLabels();
    this.updateHud("เริ่มเกม · ผู้เล่นทุกคนมี HP 20 หัวใจ 3 และไพ่เริ่มต้น 4 ใบ");
  }

  private drawBackdrop(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(0x202735, 0x202735, 0x293449, 0x293449, 1);
    g.fillRect(0, 0, 900, 560);
    for (let i = 0; i < 22; i++) {
      g.fillStyle(0x71809a, 0.12);
      g.fillCircle((i * 137) % 900, (i * 83) % 560, 2);
    }
  }

  private createPath(): { x: number; y: number }[] {
    const perimeter: [number, number][] = [];
    for (let col = 0; col <= 8; col++) perimeter.push([col, 0]);
    for (let row = 1; row <= 8; row++) perimeter.push([8, row]);
    for (let col = 7; col >= 0; col--) perimeter.push([col, 8]);
    for (let row = 7; row >= 1; row--) perimeter.push([0, row]);
    return perimeter.map(([col, row]) => ({
      x: 450 + (col - row) * 35,
      y: 280 + (col + row - 8) * 17
    }));
  }

  private drawBoard(): void {
    this.tileCenters = this.createPath();
    this.tileCenters.forEach((p, i) => {
      const color = i === 0 ? 0x3b806b : i % 8 === 0 ? 0x596b83 : 0x46566d;
      this.add.polygon(p.x, p.y, [0,-14,28,0,0,14,-28,0], color)
        .setStrokeStyle(2, 0x9ba9bd, 0.8).setDepth(p.y);
      if (i % 4 === 0) {
        this.add.text(p.x, p.y - 6, String(i + 1), {
          fontFamily: "monospace", fontSize: "11px", color: "#dce5f2"
        }).setOrigin(0.5).setDepth(p.y + 1);
      }
    });
    const ruins = this.add.graphics().setDepth(10);
    ruins.fillStyle(0x111722, 0.75);
    [[400,210],[500,210],[400,340],[500,340]].forEach(([x,y]) => {
      ruins.fillRect(x,y,22,32); ruins.fillRect(x+27,y+10,16,22);
    });
  }

  private createPlayers(): void {
    this.state.players.forEach((player, index) => {
      const p = this.tileCenters[player.position];
      const token = this.add.container(p.x + (index - 1.5) * 9, p.y - 20);
      const shadow = this.add.ellipse(0, 19, 24, 9, 0x080d14, 0.45);
      const body = this.add.rectangle(0, 0, 15, 21, COLORS[index]).setStrokeStyle(2, 0x252a35);
      const head = this.add.circle(0, -15, 7, 0xf0c99b).setStrokeStyle(2, 0x392d28);
      const marker = this.add.circle(0, -29, 4, COLORS[index]).setStrokeStyle(1, 0xffffff);
      token.add([shadow, body, head, marker]);
      token.setDepth(p.y + 20 + index);
      this.tokens.push(token);
    });
  }

  private createLabels(): void {
    this.add.text(395, 252, "START", {
      fontFamily: "monospace", fontSize: "13px", color: "#a9e0c3", fontStyle: "bold"
    });
    this.add.text(455, 252, "RUIN", {
      fontFamily: "monospace", fontSize: "13px", color: "#e8b18d", fontStyle: "bold"
    }).setOrigin(0.5);
    this.logText = this.add.text(450, 520, "YOUR EXPEDITION BEGINS", {
      fontFamily: "monospace", fontSize: "14px", color: "#d5deec"
    }).setOrigin(0.5);
  }

  chooseAction(action: PlayerAction): { ok: boolean; message: string } {
    if (this.actionLocked || this.state.phase !== "choose_action") {
      return { ok: false, message: "กรุณารอให้เทิร์นปัจจุบันดำเนินการเสร็จ" };
    }
    if (action === "use_cards") {
      return { ok: false, message: "ระบบใช้ไพ่จะเปิดใช้งานเมื่อเชื่อมต่อรายการไพ่และเอฟเฟกต์จริง" };
    }

    this.actionLocked = true;
    try {
      let selected;
      let message = "";
      if (action === "draw_two_roll_one") {
        const drawn = drawCards([], this.deck, 2);
        this.deck = drawn.deck;
        selected = selectPlayerAction(this.state, action, { drawnCardIds: drawn.drawnCardIds });
        message = `จั่วไพ่ ${drawn.drawnCardIds.length} ใบ · ทอยเต๋า 1 ลูกได้ ${selected.diceRolls[0]}`;
      } else {
        selected = selectPlayerAction(this.state, action);
        message = `ทอยเต๋า 2 ลูกได้ ${selected.diceRolls.join(" + ")} = ${selected.diceRolls.reduce((sum, value) => sum + value, 0)}`;
      }

      this.state = selected.state;
      const moved = moveActivePlayer(this.state);
      this.state = finishSpecialTileCheck(moved.state);
      this.state = finishStatusCheck(this.state);
      this.state = endPlayerTurn(this.state);

      this.updateTokenPositions();
      this.state = startPlayerTurn(resolveMonsterAttackPhase(this.state).state);
      this.updateHud(message);
      this.actionLocked = false;
      return { ok: true, message };
    } catch (error) {
      this.actionLocked = false;
      const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
      this.updateHud(message);
      return { ok: false, message };
    }
  }

  private updateTokenPositions(): void {
    this.state.players.forEach((player, index) => {
      const point = this.tileCenters[player.position];
      const token = this.tokens[index];
      this.tweens.add({
        targets: token,
        x: point.x + (index - 1.5) * 9,
        y: point.y - 20,
        duration: 300,
        ease: "Sine.easeInOut",
        onUpdate: () => token.setDepth(token.y + 20 + index)
      });
    });
  }

  private updateHud(message: string): void {
    const active = this.state.players[this.state.activePlayerIndex];
    if (!active) return;
    const position = document.querySelector<HTMLElement>("#position");
    const score = document.querySelector<HTMLElement>("#score");
    const hand = document.querySelector<HTMLElement>("#hand-count");
    const turn = document.querySelector<HTMLElement>("#turn-label");
    const hearts = document.querySelector<HTMLElement>("#hearts");
    const hp = document.querySelector<HTMLElement>("#hp");
    const dice = document.querySelector<HTMLElement>("#dice-result");
    const players = document.querySelector<HTMLElement>("#player-list");
    const phase = document.querySelector<HTMLElement>("#phase-label");

    if (position) position.textContent = `ช่อง ${active.position + 1} / ${this.state.boardLength}`;
    if (score) score.textContent = String(active.score);
    if (hand) hand.textContent = String(active.hand.length);
    if (turn) turn.textContent = `เทิร์น ${this.state.turnNumber} · ผู้เล่น ${this.state.activePlayerIndex + 1}`;
    if (hearts) hearts.textContent = "♥ ".repeat(active.hearts).trim() || "หมด";
    if (hp) hp.textContent = `${active.hp} / ${active.maxHp}`;
    if (dice && message.includes("เต๋า")) dice.textContent = message.match(/ได้ (.*)$/)?.[1] ?? "—";
    if (phase) phase.textContent = this.state.phase === "choose_action" ? "เลือกกิจกรรม" : this.state.phase;
    if (players) {
      players.innerHTML = this.state.players.map((player, index) =>
        `<div class="player-row ${index === this.state.activePlayerIndex ? "active" : ""}">
          <span><i style="background:#${COLORS[index].toString(16)}"></i> ผู้เล่น ${index + 1}</span>
          <strong>♥ ${player.hearts} · HP ${player.hp} · ช่อง ${player.position + 1}</strong>
        </div>`
      ).join("");
    }
    this.logText?.setText(message.toUpperCase());
    const messageNode = document.querySelector<HTMLElement>("#game-message");
    if (messageNode) messageNode.textContent = message;
    const draw = document.querySelector<HTMLButtonElement>("#draw-button");
    const roll = document.querySelector<HTMLButtonElement>("#roll-button");
    const use = document.querySelector<HTMLButtonElement>("#use-card-button");
    if (draw) draw.disabled = this.state.phase !== "choose_action";
    if (roll) roll.disabled = this.state.phase !== "choose_action";
    if (use) use.disabled = true;
  }
}
