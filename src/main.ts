import Phaser from "phaser";
import { BoardScene } from "./scenes/BoardScene";
import "./style.css";
const game = new Phaser.Game({
  type: Phaser.AUTO, parent: "game-container", backgroundColor: "#202735",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 900, height: 560 },
  render: { antialias: false, pixelArt: true, roundPixels: true }, scene: [BoardScene]
});
const rollButton = document.querySelector<HTMLButtonElement>("#roll-button");
const message = document.querySelector<HTMLElement>("#game-message");
rollButton?.addEventListener("click", () => {
  const scene = game.scene.getScene("BoardScene") as BoardScene;
  const result = scene.rollAndMove();
  if (message) message.textContent = result.message;
});
window.addEventListener("resize", () => game.scale.refresh());