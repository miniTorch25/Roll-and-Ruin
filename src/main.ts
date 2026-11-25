import Phaser from "phaser";
import { BoardScene } from "./scenes/BoardScene";
import type { PlayerAction } from "./game/turnEngine";
import "./style.css";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-container",
  backgroundColor: "#202735",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 900,
    height: 560
  },
  render: { antialias: false, pixelArt: true, roundPixels: true },
  scene: [BoardScene]
});

function sendAction(action: PlayerAction): void {
  const scene = game.scene.getScene("BoardScene") as BoardScene;
  scene.chooseAction(action);
}

document.querySelector<HTMLButtonElement>("#roll-button")
  ?.addEventListener("click", () => sendAction("roll_two_dice"));
document.querySelector<HTMLButtonElement>("#draw-button")
  ?.addEventListener("click", () => sendAction("draw_two_roll_one"));
document.querySelector<HTMLButtonElement>("#use-card-button")
  ?.addEventListener("click", () => sendAction("use_cards"));
window.addEventListener("resize", () => game.scale.refresh());
