import Phaser from "phaser";
import {
  createGameState, endPlayerTurn, finishCardActivity, finishSpecialTileCheck, finishStatusCheck,
  imprisonPlayer, moveActivePlayer, resolveMonsterAttackPhase,
  selectPlayerAction, startPlayerTurn, type GameState, type PlayerAction
} from "../game/turnEngine";
import { resolveCardEffect, resolveMonsterAttackEvents } from "../cards/effectResolver";
import { playCatalogueCard } from "../cards/play";
import {
  acceptLucyOffer, advanceMythTurn, chooseNyxiaRandomCard, getMythInteractionState,
  notifyLuckCardUsed, offerGranfelTrade, offerHecateCards, offerMythCards
} from "../monsters/myth";
import { resolveLegendOffering } from "../monsters/legend";
import { createCardDeck, drawCards } from "../cards/deck";
import { createBoardState, moveAndRegenerateBoard, regenerateSpecialTiles, type BoardState, type SpecialTileCounts, type SpecialTileType } from "../game/board";
import { summonRandomMonsterFromCatalogue } from "../monsters/engine";
import { CARD_CATALOGUE } from "../cards/catalogue";
import { selectKingoOfferingModal } from "../ui/kingoOfferingModal";
import { chooseOptionDialog, confirmActionDialog, selectCardsDialog, textInputDialog } from "../ui/gameDialogs";
import { formatPlayerStatuses } from "../ui/statusEffects";
import { chooseBotAction, chooseBotCardTargets, chooseBotCards, chooseBotCursePayment } from "../game/bot";

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
  private board!: BoardState;
  private boardLayer?: Phaser.GameObjects.Container;
  private ruinsLayer?: Phaser.GameObjects.Graphics;
  private monsterInstanceCounter = 0;
  private tileCenters: { x: number; y: number }[] = [];
  private tokens: Phaser.GameObjects.Container[] = [];
  private deck = createCardDeck(CARD_CATALOGUE.map((card) => card.id));
  private logText?: Phaser.GameObjects.Text;
  private actionLocked = false;

  constructor() { super("BoardScene"); }

  create(): void {
    this.drawBackdrop();
    void this.initializeGame();
  }

  private async initializeGame(): Promise<void> {
    const chooseCount = async (label: string): Promise<number> => {
      const selected = await chooseOptionDialog(
        "กำหนดจำนวนช่อง " + label,
        "กติกากำหนดจำนวนสูงสุด 4 ช่อง แต่ยังไม่กำหนดจำนวนตายตัว คุณสามารถเลือก 0–4 ได้",
        Array.from({ length: 5 }, (_, count) => ({
          value: String(count),
          label: count + " ช่อง",
          description: count === 0 ? "ไม่วางช่องชนิดนี้" : "สุ่มวาง " + count + " ช่องบนกระดาน"
        }))
      );
      return Number(selected ?? "0");
    };
    const humanCountChoice = await chooseOptionDialog(
      "จำนวนผู้เล่นจริง",
      "เลือกจำนวนผู้เล่นที่ควบคุมเอง ผู้เล่นที่เหลือจะเป็น Bot อัตโนมัติ (รวม 4 คน)",
      Array.from({ length: 4 }, (_, index) => ({
        value: String(index + 1),
        label: `${index + 1} คน`,
        description: `${index + 1} ผู้เล่นจริง · ${3 - index} Bot`
      }))
    );
    const humanCount = Math.max(1, Math.min(4, Number(humanCountChoice ?? "1")));
    const specialTileCounts: SpecialTileCounts = {
      mystery: await chooseCount("Mystery"),
      monster: await chooseCount("Monster"),
      dice: await chooseCount("Dice")
    };
    const startingSetup = PLAYER_SETUP.slice(0, humanCount).map((player) => {
      const drawn = drawCards([], this.deck, 4);
      this.deck = drawn.deck;
      return { ...player, startingHand: drawn.hand };
    });
    const botStartingHands = PLAYER_SETUP.length - humanCount;
    const botHands = Array.from({ length: botStartingHands }, () => {
      const drawn = drawCards([], this.deck, 4);
      this.deck = drawn.deck;
      return drawn.hand;
    });
    this.state = createGameState("1x4", startingSetup, PATH_LENGTH, botHands);
    this.board = createBoardState(specialTileCounts, this.state.players.map(player => player.position));
    this.state = this.prepareNextTurn(this.state);
    this.drawBoard();
    this.createPlayers();
    this.createLabels();
    const botSummary = this.runBotTurns();
    this.updateTokenPositions();
    this.updateHud(`เริ่มเกม · ผู้เล่นจริง ${humanCount} คน · Bot ${4 - humanCount} คน · ทุกคนมี HP 20 หัวใจ 3 และไพ่เริ่มต้น 4 ใบ${botSummary ? ` · ${botSummary}` : ""}`);
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
    this.boardLayer?.destroy(true);
    const boardLayer = this.add.container(0, 0).setDepth(1);
    this.boardLayer = boardLayer;
    this.tileCenters = this.createPath();
    const tileStyle: Record<SpecialTileType, { color: number; label: string; text: string }> = {
      prison: { color: 0x8d4f59, label: "P", text: "#ffe0e2" },
      mystery: { color: 0x715a9b, label: "?", text: "#f0e5ff" },
      monster: { color: 0xa95f3d, label: "!", text: "#ffe4d4" },
      dice: { color: 0x426f9b, label: "D", text: "#e1f2ff" }
    };
    this.tileCenters.forEach((point, index) => {
      const special = this.board.tiles[index].special;
      const color = special
        ? tileStyle[special].color
        : index === 0 ? 0x3b806b : index % 8 === 0 ? 0x596b83 : 0x46566d;
      const polygon = this.add.polygon(point.x, point.y, [0,-14,28,0,0,14,-28,0], color)
        .setStrokeStyle(special ? 3 : 2, special ? 0xf0d4a5 : 0x9ba9bd, 0.9)
        .setDepth(point.y);
      boardLayer.add(polygon);
      if (special || index % 4 === 0) {
        const label = special ? tileStyle[special].label : String(index + 1);
        const textColor = special ? tileStyle[special].text : "#dce5f2";
        const text = this.add.text(point.x, point.y - 6, label, {
          fontFamily: "monospace",
          fontSize: special ? "13px" : "11px",
          fontStyle: "bold",
          color: textColor
        }).setOrigin(0.5).setDepth(point.y + 1);
        boardLayer.add(text);
      }
    });
    if (!this.ruinsLayer) {
      this.ruinsLayer = this.add.graphics().setDepth(10);
      this.ruinsLayer.fillStyle(0x111722, 0.75);
      [[400,210],[500,210],[400,340],[500,340]].forEach(([x,y]) => {
        this.ruinsLayer!.fillRect(x,y,22,32);
        this.ruinsLayer!.fillRect(x+27,y+10,16,22);
      });
    }
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

  private resolveMovementAndSpecialTile(moved: ReturnType<typeof moveActivePlayer>): string {
    this.state = moved.state;
    const previousRegenerationCount = this.board.regenerationCount;
    let message = "";
    if (moved.monsterAttackEvents.length > 0) {
      this.state = resolveMonsterAttackEvents(this.state, moved.monsterAttackEvents).state;
      message += " · มิโนทอร์โจมตีจากช่องมุม";
    }

    const occupied = this.state.players
      .filter(player => player.status === "alive")
      .map(player => player.position);
    const boardResult = moveAndRegenerateBoard(
      this.board,
      moved.from,
      moved.steps,
      occupied,
      Math.random,
      this.state.movementDirection
    );
    this.board = boardResult.board;

    const landedTile = boardResult.movement.landedTile;
    const active = this.state.players[this.state.activePlayerIndex];
    if (landedTile && active?.status === "alive" && active.position === moved.to) {
      if (landedTile === "mystery") {
        const drawn = drawCards(active.hand, this.deck, 1);
        this.deck = drawn.deck;
        this.state = {
          ...this.state,
          players: this.state.players.map(player =>
            player.id === active.id ? { ...player, hand: drawn.hand } : player
          )
        };
        message += drawn.drawnCardIds.length
          ? " · Mystery: จั่วไพ่ 1 ใบ"
          : " · Mystery: ไม่มีไพ่ที่สามารถจั่วได้";
      } else if (landedTile === "monster") {
        try {
          const summoned = summonRandomMonsterFromCatalogue(
            this.state,
            "tile-monster-" + (++this.monsterInstanceCounter),
            this.deck
          );
          this.state = summoned.state;
          if (summoned.deck) this.deck = summoned.deck;
          if (summoned.attack) {
            this.state = resolveMonsterAttackEvents(this.state, [summoned.attack]).state;
          }
          message += " · Monster: อัญเชิญ " + summoned.monster.name + " (" + summoned.monster.rank + ")";
          if (summoned.messages?.length) message += " · " + summoned.messages.join(" · ");
          if (summoned.attack) message += " · โจมตีทันที";
        } catch (error) {
          message += " · Monster: " + (error instanceof Error ? error.message : "อัญเชิญมอนสเตอร์ไม่สำเร็จ");
        }
      } else if (landedTile === "prison") {
        this.state = imprisonPlayer(this.state, active.id, 3);
        message += " · Prison: ถูกจำคุกและจะพลาด 3 เทิร์นถัดไป";
      } else if (landedTile === "dice") {
        this.state = {
          ...this.state,
          players: this.state.players.map(player => {
            if (player.id !== active.id) return player;
            const existing = player.statusEffects.find(effect => effect.type === "bonus_dice");
            const retained = player.statusEffects.filter(effect => effect.type !== "bonus_dice");
            return {
              ...player,
              statusEffects: [
                ...retained,
                { type: "bonus_dice" as const, turnsRemaining: 2, amount: (existing?.amount ?? 0) + 1 }
              ]
            };
          })
        };
        message += " · Dice: ได้รับลูกเต๋าเพิ่ม 1 ลูกในเทิร์นถัดไป";
      }
    }

    this.state = finishSpecialTileCheck(this.state);
    if (this.board.regenerationCount !== previousRegenerationCount) {
      this.drawBoard();
      message += " · ครบรอบกระดาน: สุ่มตำแหน่งช่องพิเศษใหม่";
    }
    return message;
  }

  chooseAction(action: PlayerAction): { ok: boolean; message: string } {
    if (this.actionLocked || this.state.phase !== "choose_action" || this.state.players[this.state.activePlayerIndex]?.isBot) {
      return { ok: false, message: "กรุณารอให้เทิร์นปัจจุบันดำเนินการเสร็จ" };
    }
    if (action === "use_cards") {
      try {
        this.state = selectPlayerAction(this.state, action).state;
        this.updateHud("เลือกไพ่ที่ต้องการใช้ · ใช้ได้สูงสุด 3 ใบ แล้วกดจบช่วงใช้ไพ่");
        return { ok: true, message: "เลือกไพ่ที่ต้องการใช้" };
      } catch (error) {
        const message = error instanceof Error ? error.message : "ไม่สามารถเริ่มใช้ไพ่ได้";
        this.updateHud(message);
        return { ok: false, message };
      }
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
      message += this.resolveMovementAndSpecialTile(moved);
      this.state = finishStatusCheck(this.state);
      const endingPlayerId = this.state.players[this.state.activePlayerIndex]?.id;
      if (endingPlayerId && this.state.monsters.some(monster => monster.active && monster.rank === "Myth")) {
        this.state = advanceMythTurn(this.state, endingPlayerId).state;
      }
      this.state = endPlayerTurn(this.state);
      this.state = this.prepareNextTurn(this.state);
      const botSummary = this.runBotTurns();
      this.updateTokenPositions();
      this.updateHud(`${message}${botSummary ? ` · ${botSummary}` : ""}`);
      this.actionLocked = false;
      return { ok: true, message };
    } catch (error) {
      this.actionLocked = false;
      const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
      this.updateHud(message);
      return { ok: false, message };
    }
  }

  private async askForHandCards(promptTitle: string, requiredCount?: number): Promise<string[] | undefined> {
    const active = this.state.players[this.state.activePlayerIndex];
    if (!active || active.hand.length === 0) throw new Error("ไม่มีไพ่ในมือให้เลือก");
    const cards = active.hand.map(id => {
      const definition = CARD_CATALOGUE.find(card => card.id === id);
      return {
        id,
        name: definition?.name ?? id,
        color: definition?.color ?? "neutral",
        description: definition?.description ?? ""
      };
    });
    const description = requiredCount === undefined
      ? "เลือกไพ่ที่ต้องการได้หนึ่งใบหรือหลายใบ แล้วกดยืนยัน"
      : `เลือกไพ่ให้ครบ ${requiredCount} ใบพอดี`;
    return selectCardsDialog(promptTitle, description, cards, requiredCount);
  }

  private async handleMonsterAction(action: string, monsterId: string): Promise<void> {
    const active = this.state.players[this.state.activePlayerIndex];
    const monster = this.state.monsters.find(item => item.id === monsterId && item.active);
    if (!active || !monster) return;
    try {
      if (action === "hecate-offer") {
        const cards = await this.askForHandCards("เฮคาทีต้องการไพ่เหลือง 3 ใบ", 3);
        if (!cards) return;
        const result = offerHecateCards(this.state, active.id, cards, this.deck);
        this.state = result.state;
        this.deck = result.deck ?? this.deck;
        this.updateHud(result.messages[0]);
        return;
      }
      if (action === "granfel-trade") {
        const result = offerGranfelTrade(this.state, active.id, this.deck);
        this.state = result.state;
        this.deck = result.deck ?? this.deck;
        this.updateHud(result.messages[0]);
        return;
      }
      if (action === "myth-offer") {
        const cards = await this.askForHandCards(monster.catalogueId === "M06" ? "เลือกไพ่สำหรับเครื่องบูชา Ragnar" : "เลือกไพ่ 1 ใบต่อสีสำหรับ Ouro");
        if (!cards) return;
        const result = offerMythCards(this.state, [{ playerId: active.id, cardIds: cards }]);
        this.state = result.state;
        this.deck = { ...this.deck, discardPile: [...this.deck.discardPile, ...cards] };
        this.updateHud(result.messages[0]);
        return;
      }
      if (action === "lucy-offer") {
        const result = acceptLucyOffer(this.state, active.id, this.deck);
        this.state = result.state;
        this.deck = result.deck ?? this.deck;
        this.updateHud(result.messages[0]);
        return;
      }
      if (action === "legend-offer") {
        if (monster.catalogueId === "L10") {
          const contributions = await selectKingoOfferingModal(this.state.players
            .filter(player => player.status === "alive")
            .map(player => ({
              id: player.id,
              label: player.id === active.id ? "ผู้เล่นปัจจุบัน" : player.id,
              cards: player.hand.map(cardId => {
                const definition = CARD_CATALOGUE.find(card => card.id === cardId);
                return { id: cardId, name: definition?.name ?? cardId, color: definition?.color ?? "neutral" };
              })
            })));
          if (!contributions) return;
          const result = resolveLegendOffering(this.state, monsterId, contributions, this.deck);
          this.state = result.state;
          this.deck = result.deck;
          this.updateHud(`Kingo รับเครื่องบูชาจาก ${result.event.contributorIds.length} ผู้เล่น · ${result.event.consumedCardIds.length} ใบ · ${result.event.removed ? "Kingo ออกจากกระดาน" : "ยังเหลือการแลกเปลี่ยน"}`);
          return;
        }
        const counts: Record<string, number> = { L01: 4, L02: 2, L03: 3, L04: 2, L05: 1, L06: 1, L07: 2, L08: 3, L09: 2, L10: 5 };
        const count = counts[monster.catalogueId ?? ""] ?? 1;
        const cards = await this.askForHandCards(`ถวายไพ่ให้ ${monster.name ?? monster.catalogueId}`, count);
        if (!cards) return;
        let selectedDeckCardId: string | undefined;
        if (monster.catalogueId === "L03") {
          const choice = await chooseOptionDialog(
            "เลือกไพ่รางวัลจากกองจั่ว",
            "Gini ให้เลือกไพ่จากกองจั่ว 1 ใบ",
            this.deck.drawPile.map(cardId => {
              const definition = CARD_CATALOGUE.find(card => card.id === cardId);
              return { value: cardId, label: definition?.name ?? cardId, description: cardId };
            })
          );
          if (!choice) return;
          selectedDeckCardId = choice;
        }
        const result = resolveLegendOffering(this.state, monsterId, [{ playerId: active.id, cardIds: cards }], this.deck, { selectedDeckCardId });
        this.state = result.state;
        this.deck = result.deck;
        this.updateHud(`ถวายไพ่สำเร็จ · ${result.event.consumedCardIds.length} ใบ · ${result.event.removed ? "มอนสเตอร์ออกจากกระดาน" : "ยังเหลือการแลกเปลี่ยน"}`);
      }
    } catch (error) {
      this.updateHud(error instanceof Error ? error.message : "ดำเนินการกับมอนสเตอร์ไม่สำเร็จ");
    }
  }

  private renderHandPanel(playerId: string): void {
    const panel = document.querySelector<HTMLElement>("#hand-panel");
    if (!panel) return;
    const active = this.state.players.find(player => player.id === playerId);
    if (!active || this.state.phase !== "play_cards") {
      panel.hidden = true;
      panel.innerHTML = "";
      return;
    }
    panel.hidden = false;
    const myth = getMythInteractionState(this.state);
    const hidden = myth?.hiddenHands === true;
    const limitReached = active.cardsPlayedThisTurn >= 3;
    if (hidden) {
      panel.innerHTML = `<p class="eyebrow">HIDDEN HAND · NYXIA</p><p>ไพ่ในมือถูกซ่อน เลือกใช้ไพ่แบบสุ่มเท่านั้น</p><button id="random-hidden-card" type="button" ${limitReached || active.hand.length === 0 ? "disabled" : ""}>ใช้ไพ่สุ่ม (${active.hand.length} ใบ)</button>`;
      panel.querySelector<HTMLButtonElement>("#random-hidden-card")?.addEventListener("click", () => {
        try {
          const selectedId = chooseNyxiaRandomCard(this.state, playerId);
          void this.playCard(selectedId, true);
        } catch (error) {
          this.updateHud(error instanceof Error ? error.message : "ไม่สามารถใช้ไพ่ได้");
        }
      });
      return;
    }
    const cards = active.hand.map((id, index) => {
      const definition = CARD_CATALOGUE.find(card => card.id === id);
      return { id, index, name: definition?.name ?? id, color: definition?.color ?? "neutral", description: definition?.description ?? "" };
    });
    panel.innerHTML = `<p class="eyebrow">YOUR HAND · ${active.cardsPlayedThisTurn}/3 USED</p><div class="hand-card-list">${cards.map(card =>
      `<button class="hand-card ${card.color}" data-card-id="${card.id}" type="button" ${limitReached ? "disabled" : ""}><strong>${card.name}</strong><small>${card.description} · ${card.id}</small></button>`
    ).join("")}</div>`;
    panel.querySelectorAll<HTMLButtonElement>("[data-card-id]").forEach(button => {
      button.addEventListener("click", () => void this.playCard(button.dataset.cardId ?? ""));
    });
  }

  private async playCard(cardId: string, randomSelection = false): Promise<void> {
    if (this.state.phase !== "play_cards" || !cardId) return;
    const before = this.state;
    const deckBefore = this.deck;
    const active = before.players[before.activePlayerIndex];
    const card = CARD_CATALOGUE.find(item => item.id === cardId);
    if (!active || !card) return;
    try {
      let targetPlayerId: string | undefined;
      let targetMonsterId: string | undefined;
      let selectedCardId: string | undefined;
      let diceValues: number[] | undefined;
      const livingOpponents = before.players.filter(player => player.status === "alive" && player.id !== active.id);
      const teammates = before.players.filter(player => player.status === "alive" && player.id !== active.id && player.teamId === active.teamId);
      const teamTargetEffect = ["team_heal", "gain_team_shield"].includes(card.effectId);
      const needsPlayer = (typeof card.parameters?.target === "string" &&
        ["one_player", "another_player", "one_eliminated_player", "one_teammate"].includes(String(card.parameters.target))) ||
        card.effectId === "damage_with_random_splash" || (teamTargetEffect && teammates.length > 0);
      if (needsPlayer) {
        if (!livingOpponents.length && card.effectId !== "resurrection") throw new Error("ไม่มีผู้เล่นเป้าหมายที่ใช้งานได้");
        const choices = card.effectId === "resurrection"
          ? before.players.filter(player => player.status === "eliminated")
          : teamTargetEffect ? teammates : livingOpponents;
        if (!choices.length) throw new Error("ไม่มีผู้เล่นเป้าหมายที่ใช้งานได้");
        const choice = await chooseOptionDialog(
          "เลือกผู้เล่นเป้าหมาย",
          "เลือกผู้เล่นที่ต้องการให้เอฟเฟกต์ของไพ่ทำงาน",
          choices.map(player => ({
            value: player.id,
            label: player.id,
            description: `HP ${player.hp} · หัวใจ ${player.hearts}`
          }))
        );
        if (!choice) return;
        targetPlayerId = choice;
      }
      if (card.effectId === "damage_monster_only" || (card.effectId === "instant_kill" && before.monsters.some(monster => monster.active && monster.rank === "Myth"))) {
        const targets = before.monsters.filter(monster => monster.active && (card.effectId !== "instant_kill" || monster.rank === "Myth"));
        const shouldTargetMonster = card.effectId === "damage_monster_only" ||
          (targets.length > 0 && await confirmActionDialog("ใช้สังหารทันทีใส่ Myth Monster?", "ยืนยันเพื่อเลือก Myth Monster เป็นเป้าหมาย"));
        if (targets.length && shouldTargetMonster) {
          const choice = await chooseOptionDialog(
            "เลือกมอนสเตอร์เป้าหมาย",
            "เลือกมอนสเตอร์ที่ต้องการโจมตี",
            targets.map(monster => ({
              value: monster.id,
              label: monster.name ?? monster.catalogueId ?? monster.id,
              description: `${monster.id} · HP ${monster.hp === null ? "∞" : monster.hp ?? "?"}`
            }))
          );
          if (!choice) return;
          targetMonsterId = choice;
          targetPlayerId = undefined;
        }
      }
      if (card.effectId === "trade_for_random_card") {
        const choices = [...active.hand];
        choices.splice(choices.indexOf(cardId), 1);
        if (!choices.length) throw new Error("ไม่มีไพ่เหลือสำหรับแลก");
        selectedCardId = await chooseOptionDialog(
          "เลือกไพ่ที่จะมอบให้ผู้เล่นเป้าหมาย",
          "เลือกไพ่หนึ่งใบจากมือของคุณเพื่อแลกเปลี่ยน",
          choices.map(id => {
            const definition = CARD_CATALOGUE.find(item => item.id === id);
            return { value: id, label: definition?.name ?? id, description: id };
          })
        );
        if (!selectedCardId) return;
      } else if (card.effectId === "force_discard_selected_card" && targetPlayerId) {
        const target = before.players.find(player => player.id === targetPlayerId);
        if (!target?.hand.length) throw new Error("ผู้เล่นเป้าหมายไม่มีไพ่");
        selectedCardId = await chooseOptionDialog(
          "เลือกไพ่ที่ผู้เล่นเป้าหมายต้องทิ้ง",
          `เลือกไพ่หนึ่งใบจากมือของ ${targetPlayerId}`,
          target.hand.map(id => {
            const definition = CARD_CATALOGUE.find(item => item.id === id);
            return { value: id, label: definition?.name ?? id, description: id };
          })
        );
        if (!selectedCardId) return;
      }
      if (card.effectId === "control_dice_values") {
        const raw = await textInputDialog("กำหนดค่าลูกเต๋า", "ใส่ค่าลูกเต๋าคั่นด้วยจุลภาค โดยแต่ละค่าต้องอยู่ระหว่าง 1 ถึง 6", "6");
        if (!raw) return;
        diceValues = raw.split(",").map(value => Number(value.trim()));
      }
      let cursePayment;
      if (card.kind === "curse") {
        const paymentHand = [...active.hand];
        paymentHand.splice(paymentHand.indexOf(cardId), 1);
        if (active.hp > 5) cursePayment = { type: "hp" as const, amount: 5 };
        else if (paymentHand.length >= 2) cursePayment = { type: "discard" as const, cardIds: [paymentHand[0], paymentHand[1]] as [string, string] };
        else cursePayment = { type: "cooldown" as const };
      }
      const played = playCatalogueCard(before, cardId);
      const resolved = resolveCardEffect(played.state, played.card, {
        targetPlayerId, targetMonsterId, selectedCardId, diceValues,
        deck: this.deck, cursePayment,
        random: Math.random
      });
      this.state = resolved.state;
      this.deck = resolved.deck ?? this.deck;
      if (resolved.boardRerollRequested) {
        this.board = regenerateSpecialTiles(this.board, this.state.players.filter(player => player.status === "alive").map(player => player.position));
        this.drawBoard();
      }
      if (resolved.monsterSummonEvents.length > 0) {
        this.state = resolveMonsterAttackEvents(this.state, resolved.monsterSummonEvents).state;
      }
      this.deck = { ...this.deck, discardPile: [...this.deck.discardPile, ...resolved.discardedCardIds, cardId] };
      if (cardId === "green_lucky_clover" && this.state.monsters.some(monster => monster.active && monster.catalogueId === "M05")) {
        this.state = notifyLuckCardUsed(this.state).state;
      }
      const warning = resolved.summonWarnings[0];
      const summary = warning
        ? warning.reason === "board_full" ? "อัญเชิญไม่ได้: มอนสเตอร์บนกระดานเต็มแล้ว" : `อัญเชิญไม่ได้: มอนสเตอร์ระดับ ${warning.rank} เต็มจำนวนแล้ว`
        : randomSelection ? "ใช้ไพ่แบบสุ่มสำเร็จ" : `ใช้ไพ่ ${card.name} สำเร็จ`;
      this.updateHud(`${summary} · ใช้แล้ว ${this.state.players[this.state.activePlayerIndex].cardsPlayedThisTurn}/3 ใบ`);
    } catch (error) {
      this.state = before;
      this.deck = deckBefore;
      this.updateHud(error instanceof Error ? error.message : "ใช้ไพ่ไม่สำเร็จ");
    }
  }

  finishCardPlay(): { ok: boolean; message: string } {
    if (this.state.phase !== "play_cards") return { ok: false, message: "ยังไม่อยู่ในช่วงใช้ไพ่" };
    try {
      const finished = finishCardActivity(this.state);
      this.state = finished.state;
      const moved = moveActivePlayer(this.state);
      const tileMessage = this.resolveMovementAndSpecialTile(moved);
      this.state = finishStatusCheck(this.state);
      const endingPlayerId = this.state.players[this.state.activePlayerIndex]?.id;
      if (endingPlayerId && this.state.monsters.some(monster => monster.active && monster.rank === "Myth")) {
        this.state = advanceMythTurn(this.state, endingPlayerId).state;
      }
      this.state = endPlayerTurn(this.state);
      this.state = this.prepareNextTurn(this.state);
      const botSummary = this.runBotTurns();
      this.updateTokenPositions();
      const message = `ใช้ไพ่เสร็จ · ทอยเต๋า ${finished.diceRolls.join(" + ")} · เดิน ${finished.diceRolls.reduce((sum, value) => sum + value, 0)} ช่อง${tileMessage}${botSummary ? ` · ${botSummary}` : ""}`;
      this.updateHud(message);
      return { ok: true, message };
    } catch (error) {
      const message = error instanceof Error ? error.message : "จบช่วงใช้ไพ่ไม่สำเร็จ";
      this.updateHud(message);
      return { ok: false, message };
    }
  }

  private runBotTurns(): string {
    const summaries: string[] = [];
    let processed = 0;
    while (this.state.phase === "choose_action" && this.state.players[this.state.activePlayerIndex]?.isBot && processed < 8) {
      const active = this.state.players[this.state.activePlayerIndex];
      const plannedCards = chooseBotCards(this.state);
      const action: PlayerAction = plannedCards.length ? "use_cards" : chooseBotAction(active);
      let diceRolls: number[];
      let cardSummary = "";

      if (action === "use_cards") {
        this.state = selectPlayerAction(this.state, "use_cards").state;
        const usedCards: string[] = [];
        for (const cardId of plannedCards) {
          try {
            const played = playCatalogueCard(this.state, cardId);
            const targets = chooseBotCardTargets(this.state, cardId);
            const cursePayment = played.card.kind === "curse"
              ? chooseBotCursePayment(played.state, active.id)
              : undefined;
            if (played.card.kind === "curse" && !cursePayment) throw new Error("No legal Curse payment is available.");
            const resolved = resolveCardEffect(played.state, played.card, {
              ...targets,
              deck: this.deck,
              cursePayment,
              random: Math.random
            });
            this.state = resolved.state;
            this.deck = resolved.deck ?? this.deck;
            if (resolved.boardRerollRequested) {
              this.board = regenerateSpecialTiles(this.board, this.state.players.filter(player => player.status === "alive").map(player => player.position));
              this.drawBoard();
            }
            if (resolved.monsterSummonEvents.length > 0) {
              this.state = resolveMonsterAttackEvents(this.state, resolved.monsterSummonEvents).state;
            }
            this.deck = {
              ...this.deck,
              discardPile: [...this.deck.discardPile, ...resolved.discardedCardIds, cardId]
            };
            usedCards.push(played.card.name + (targets.targetPlayerId ? `→${targets.targetPlayerId}` : targets.targetMonsterId ? `→${targets.targetMonsterId}` : ""));
            if (resolved.endsCardPlay) break;
          } catch {
            break;
          }
        }
        const finished = finishCardActivity(this.state);
        this.state = finished.state;
        diceRolls = finished.diceRolls;
        cardSummary = usedCards.length ? `ใช้ไพ่ ${usedCards.join(", ")} · ` : "";
      } else {
        let selected;
        if (action === "draw_two_roll_one") {
          const drawn = drawCards(active.hand, this.deck, 2);
          this.deck = drawn.deck;
          selected = selectPlayerAction(this.state, action, { drawnCardIds: drawn.drawnCardIds });
        } else {
          selected = selectPlayerAction(this.state, action);
        }
        this.state = selected.state;
        diceRolls = selected.diceRolls;
      }

      const moved = moveActivePlayer(this.state);
      const tileMessage = this.resolveMovementAndSpecialTile(moved);
      this.state = finishStatusCheck(this.state);
      const endingPlayerId = this.state.players[this.state.activePlayerIndex]?.id;
      if (endingPlayerId && this.state.monsters.some(monster => monster.active && monster.rank === "Myth")) {
        this.state = advanceMythTurn(this.state, endingPlayerId).state;
      }
      const actionLabel = action === "draw_two_roll_one" ? "จั่วไพ่" : action === "roll_two_dice" ? "ทอยเต๋า" : "ใช้ไพ่";
      summaries.push(`${active.id} ${cardSummary}${actionLabel} (${diceRolls.join("+")})${tileMessage}`);
      this.state = this.prepareNextTurn(endPlayerTurn(this.state));
      processed++;
    }
    return summaries.join(" / ");
  }

  private prepareNextTurn(state: GameState): GameState {
    const resolveOpeningAttacks = (input: GameState): GameState => {
      const phase = resolveMonsterAttackPhase(input);
      return phase.attacks.length > 0
        ? resolveMonsterAttackEvents(phase.state, phase.attacks).state
        : phase.state;
    };
    let next = startPlayerTurn(resolveOpeningAttacks(state));
    while (next.phase === "turn_end") {
      const skippedPlayerId = next.players[next.activePlayerIndex]?.id;
      if (skippedPlayerId && next.monsters.some(monster => monster.active && monster.rank === "Myth")) {
        next = advanceMythTurn(next, skippedPlayerId).state;
      }
      next = startPlayerTurn(resolveOpeningAttacks(endPlayerTurn(next)));
    }
    return next;
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
    const monsterPanel = document.querySelector<HTMLElement>("#monster-panel");
    const phase = document.querySelector<HTMLElement>("#phase-label");
    const statusEffects = document.querySelector<HTMLElement>("#status-effects");
    const tileCounts = document.querySelector<HTMLElement>("#tile-counts");
    if (tileCounts && this.board) {
      const counts = this.board.specialTileCounts;
      tileCounts.textContent = "Prison 2 · Mystery " + counts.mystery + " · Monster " + counts.monster + " · Dice " + counts.dice;
    }

    if (position) position.textContent = `ช่อง ${active.position + 1} / ${this.state.boardLength}`;
    if (score) score.textContent = String(active.score);
    if (hand) hand.textContent = String(active.hand.length);
    if (turn) turn.textContent = `เทิร์น ${this.state.turnNumber} · ${active.isBot ? "BOT" : "ผู้เล่น"} ${this.state.activePlayerIndex + 1}`;
    if (hearts) hearts.textContent = "♥ ".repeat(active.hearts).trim() || "หมด";
    if (hp) hp.textContent = `${active.hp} / ${active.maxHp}`;
    if (dice && message.includes("เต๋า")) dice.textContent = message.match(/ได้ (.*)$/)?.[1] ?? "—";
    if (phase) phase.textContent = this.state.phase === "choose_action" ? "เลือกกิจกรรม" : this.state.phase;
    const activeStatuses = formatPlayerStatuses(active.statusEffects, active.prisonTurnsRemaining);
    if (statusEffects) {
      statusEffects.innerHTML = activeStatuses.length
        ? activeStatuses.map(status => `<span class="status-effect-chip">${status}</span>`).join("")
        : '<span class="empty-note">ไม่มีสถานะพิเศษ</span>';
    }
    if (players) {
      players.innerHTML = this.state.players.map((player, index) => {
        const statuses = formatPlayerStatuses(player.statusEffects, player.prisonTurnsRemaining);
        return `<div class="player-row ${index === this.state.activePlayerIndex ? "active" : ""}">
          <span><i style="background:#${COLORS[index].toString(16)}"></i> ${player.isBot ? "BOT" : "ผู้เล่น"} ${index + 1}</span>
          <strong>♥ ${player.hearts} · HP ${player.hp} · ช่อง ${player.position + 1}</strong>
          ${statuses.length ? `<small class="player-status">${statuses.join(" · ")}</small>` : ""}
        </div>`;
      }).join("");
    }
    if (monsterPanel) {
      const activeMonsters = this.state.monsters.filter(monster => monster.active);
      monsterPanel.innerHTML = activeMonsters.length
        ? activeMonsters.map(monster => {
            const action = monster.rank === "Legend" ? "legend-offer"
              : monster.catalogueId === "M01" ? "hecate-offer"
              : monster.catalogueId === "M02" ? "granfel-trade"
              : monster.catalogueId === "M06" || monster.catalogueId === "M08" ? "myth-offer"
              : monster.catalogueId === "M09" ? "lucy-offer"
              : "";
            const label = action === "legend-offer" ? "ถวายไพ่"
              : action === "hecate-offer" ? "ถวายไพ่ 3 ใบ"
              : action === "granfel-trade" ? "แลกไพ่เหลือง"
              : action === "myth-offer" ? "ถวายเครื่องบูชา"
              : action === "lucy-offer" ? "รับข้อเสนอ"
              : "";
            return `<div class="monster-row"><strong>${monster.name ?? monster.catalogueId ?? monster.id} · ${monster.rank ?? "?"}</strong><small>HP: ${monster.hp === null ? "∞" : monster.hp ?? "?"} · ATK: ${monster.attackDamage ?? 0}</small><small>${(monster.rules ?? []).join(" · ")}</small>${action ? `<button class="monster-action" data-monster-action="${action}" data-monster-id="${monster.id}" type="button">${label}</button>` : ""}</div>`;
          }).join("")
        : '<p class="empty-note">ยังไม่มีมอนสเตอร์</p>';
      monsterPanel.querySelectorAll<HTMLButtonElement>("[data-monster-action]").forEach(button => {
        button.addEventListener("click", () => this.handleMonsterAction(button.dataset.monsterAction ?? "", button.dataset.monsterId ?? ""));
      });
    }
    this.logText?.setText(message.toUpperCase());
    const messageNode = document.querySelector<HTMLElement>("#game-message");
    if (messageNode) messageNode.textContent = message;
    const draw = document.querySelector<HTMLButtonElement>("#draw-button");
    const roll = document.querySelector<HTMLButtonElement>("#roll-button");
    const use = document.querySelector<HTMLButtonElement>("#use-card-button");
    const humanCanAct = this.state.phase === "choose_action" && !active.isBot;
    if (draw) draw.disabled = !humanCanAct;
    if (roll) roll.disabled = !humanCanAct;
    if (use) use.disabled = !humanCanAct;
    this.renderHandPanel(active.id);
    const finishCards = document.querySelector<HTMLButtonElement>("#finish-cards-button");
    if (finishCards) finishCards.disabled = this.state.phase !== "play_cards";
  }
}
