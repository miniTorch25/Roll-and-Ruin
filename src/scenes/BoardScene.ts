import Phaser from "phaser";
import {
  createGameState, endPlayerTurn, finishSpecialTileCheck, finishStatusCheck,
  getActivePlayer, moveActivePlayer, resolveMonsterAttackPhase,
  selectPlayerAction, startPlayerTurn, type GameState, type PlayerAction
} from "../game/turnEngine";
import { createCardDeck, drawCards } from "../cards/deck";

const PATH_LENGTH = 18;
const PLAYER_SETUP = [
  { id: "p1", teamId: "red" },
  { id: "p2", teamId: "blue" },
  { id: "p3", teamId: "green" },
  { id: "p4", teamId: "gold" }
];
const COLORS = [0xe0a85b, 0x75b8d1, 0x9bc47b, 0xc18bd1];
const PROTOTYPE_HEARTS = 3;

export class BoardScene extends Phaser.Scene {
  private state!: GameState;
  private tileCenters: { x: number; y: number }[] = [];
  private tokens: Phaser.GameObjects.Container[] = [];
  private deck = createCardDeck(
    Array.from({ length: 24 }, (_, index) => `prototype_card_${String(index + 1).padStart(2, "0")}`)
  );
  private logText?: Phaser.GameObjects.Text;
  private actionLocked = false;

  constructor() { super("BoardScene"); }

  create(): void {
    this.state = createGameState("1x4", PLAYER_SETUP, PROTOTYPE_HEARTS, PATH_LENGTH);
    this.state = startPlayerTurn(resolveMonsterAttackPhase(this.state).state);
    this.drawBackdrop();
    this.drawBoard();
    this.createPlayers();
    this.createLabels();
    this.updateHud("เลือกทอยเต๋าหรือจั่วไพ่เพื่อเริ่มเทิร์น");
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
    const steps: [number, number][] = [
      [0,0],[1,0],[2,0],[3,0],[4,0],[4,1],[4,2],[3,2],[2,2],
      [1,2],[0,2],[0,3],[0,4],[1,4],[2,4],[3,4],[4,4],[5,4]
    ];
    return steps.slice(0, PATH_LENGTH).map(([col,row]) => ({
      x: 150 + col * 105 - row * 42,
      y: 285 + row * 52 - col * 21
    }));
  }

  private drawBoard(): void {
    this.tileCenters = this.createPath();
    this.tileCenters.forEach((p, i) => {
      const color = i === 0 ? 0x3b806b : i === PATH_LENGTH - 1 ? 0x9a654c : i % 4 === 0 ? 0x596b83 : 0x46566d;
      this.add.polygon(p.x, p.y, [0,-19,37,0,0,19,-37,0], color)
        .setStrokeStyle(2, 0x9ba9bd, 0.8).setDepth(p.y);
      if (i > 0 && i < PATH_LENGTH - 1) {
        this.add.text(p.x, p.y - 7, String(i), {
          fontFamily: "monospace", fontSize: "14px", color: "#dce5f2"
        }).setOrigin(0.5).setDepth(p.y + 1);
      }
    });
    const ruins = this.add.graphics().setDepth(10);
    ruins.fillStyle(0x111722, 0.75);
    [[110,110],[755,100],[760,430],[120,440]].forEach(([x,y]) => {
      ruins.fillRect(x,y,28,42); ruins.fillRect(x+34,y+12,20,30);
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
    this.add.text(92, 245, "START", {
      fontFamily: "monospace", fontSize: "13px", color: "#a9e0c3", fontStyle: "bold"
    });
    const end = this.tileCenters[PATH_LENGTH - 1];
    this.add.text(end.x + 10, end.y - 45, "RUIN", {
      fontFamily: "monospace", fontSize: "13px", color: "#e8b18d", fontStyle: "bold"
    }).setOrigin(0.5);
    this.logText = this.add.text(450, 510, "YOUR EXPEDITION BEGINS", {
      fontFamily: "monospace", fontSize: "14px", color: "#d5deec"
    }).setOrigin(0.5);
  }

  chooseAction(action: PlayerAction): { ok: boolean; message: string } {
    if (this.actionLocked || this.state.phase !== "choose_action") {
      return { ok: false, message: "กรุณารอให้เทิร์นปัจจุบันดำเนินการเสร็จ" };
    }
    if (action === "use_card") {
      return { ok: false, message: "ระบบไพ่จริงกำลังรอเชื่อมรายการไพ่และเอฟเฟกต์" };
    }

    this.actionLocked = true;
    try {
      const selected = selectPlayerAction(this.state, action);
      this.state = selected.state;
      let message = "";
      if (action === "roll_dice") {
        message = `ทอยเต๋าได้ ${selected.dieRoll} แต้ม`;
      } else {
        const active = getActivePlayer(this.state);
        const drawn = drawCards(active.hand, this.deck, 1);
        this.deck = drawn.deck;
        this.state = {
          ...this.state,
          players: this.state.players.map(player =>
            player.id === active.id ? { ...player, hand: drawn.hand } : player
          )
        };
        message = drawn.drawnCardIds.length
          ? "จั่วไพ่ต้นแบบ 1 ใบ · ยังไม่เปิดใช้เอฟเฟกต์"
          : "กองจั่วหมดแล้ว";
      }

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
    const position = document.querySelector<HTMLElement>("#position");
    const score = document.querySelector<HTMLElement>("#score");
    const hand = document.querySelector<HTMLElement>("#hand-count");
    const turn = document.querySelector<HTMLElement>("#turn-label");
    const hearts = document.querySelector<HTMLElement>("#hearts");
    const dice = document.querySelector<HTMLElement>("#dice-result");
    const players = document.querySelector<HTMLElement>("#player-list");
    const phase = document.querySelector<HTMLElement>("#phase-label");

    if (position) position.textContent = active.position === 0 ? "จุดเริ่มต้น" : `ช่อง ${active.position + 1}`;
    if (score) score.textContent = String(active.score);
    if (hand) hand.textContent = String(active.hand.length);
    if (turn) turn.textContent = `เทิร์น ${this.state.turnNumber} · ผู้เล่น ${this.state.activePlayerIndex + 1}`;
    if (hearts) hearts.textContent = "♥ ".repeat(active.hearts).trim() || "หมด";
    if (dice && message.includes("เต๋าได้")) dice.textContent = message.match(/\d+/)?.[0] ?? "—";
    if (phase) phase.textContent = this.state.phase === "choose_action" ? "เลือกกิจกรรม" : this.state.phase;
    if (players) {
      players.innerHTML = this.state.players.map((player, index) =>
        `<div class="player-row ${index === this.state.activePlayerIndex ? "active" : ""}">
          <span><i style="background:#${COLORS[index].toString(16)}"></i> ผู้เล่น ${index + 1}</span>
          <strong>♥ ${player.hearts} · ช่อง ${player.position + 1}</strong>
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
