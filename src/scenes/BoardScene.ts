import Phaser from "phaser";
import { rollD6 } from "../game/dice";
import { createInitialTurnState, type LocalTurnState } from "../game/turnState";
const PATH_LENGTH = 18;
export class BoardScene extends Phaser.Scene {
  private state: LocalTurnState = createInitialTurnState();
  private tileCenters: { x: number; y: number }[] = [];
  private playerToken?: Phaser.GameObjects.Container;
  private resultText?: Phaser.GameObjects.Text;
  constructor() { super("BoardScene"); }
  create(): void { this.drawBackdrop(); this.drawBoard(); this.createPlayer(); this.createLabels(); this.updateHud(); }
  private drawBackdrop(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(0x202735, 0x202735, 0x293449, 0x293449, 1); g.fillRect(0, 0, 900, 560);
    for (let i = 0; i < 22; i++) { g.fillStyle(0x71809a, 0.12); g.fillCircle((i * 137) % 900, (i * 83) % 560, 2); }
  }
  private createPath(): { x: number; y: number }[] {
    const steps: [number, number][] = [[0,0],[1,0],[2,0],[3,0],[4,0],[4,1],[4,2],[3,2],[2,2],[1,2],[0,2],[0,3],[0,4],[1,4],[2,4],[3,4],[4,4],[5,4]];
    return steps.slice(0, PATH_LENGTH).map(([col,row]) => ({ x: 150 + col * 105 - row * 42, y: 285 + row * 52 - col * 21 }));
  }
  private drawBoard(): void {
    this.tileCenters = this.createPath();
    this.tileCenters.forEach((p, i) => {
      const color = i === 0 ? 0x3b806b : i === PATH_LENGTH - 1 ? 0x9a654c : i % 4 === 0 ? 0x596b83 : 0x46566d;
      this.add.polygon(p.x, p.y, [0,-19,37,0,0,19,-37,0], color).setStrokeStyle(2,0x9ba9bd,0.8).setDepth(p.y);
      if (i > 0 && i < PATH_LENGTH - 1) this.add.text(p.x,p.y-7,String(i),{fontFamily:"monospace",fontSize:"14px",color:"#dce5f2"}).setOrigin(0.5).setDepth(p.y+1);
    });
    const ruins = this.add.graphics().setDepth(10);
    ruins.fillStyle(0x111722,0.75);
    [[110,110],[755,100],[760,430],[120,440]].forEach(([x,y]) => { ruins.fillRect(x,y,28,42); ruins.fillRect(x+34,y+12,20,30); });
    ruins.lineStyle(2,0x71809a,0.35); ruins.strokeRect(100,95,65,65); ruins.strokeRect(735,415,65,65);
  }
  private createPlayer(): void {
    const p = this.tileCenters[0];
    this.playerToken = this.add.container(p.x,p.y-20);
    const shadow = this.add.ellipse(0,19,30,12,0x080d14,0.45);
    const cape = this.add.triangle(-10,2,0,0,18,0,9,20,0x9c514d).setStrokeStyle(1,0x392d28);
    const body = this.add.rectangle(0,0,19,24,0xe0a85b).setStrokeStyle(2,0x392d28);
    const head = this.add.circle(0,-16,9,0xf0c99b).setStrokeStyle(2,0x392d28);
    this.playerToken.add([shadow,cape,body,head]); this.playerToken.setDepth(p.y+20);
  }
  private createLabels(): void {
    this.add.text(92,245,"START",{fontFamily:"monospace",fontSize:"13px",color:"#a9e0c3",fontStyle:"bold"});
    const end = this.tileCenters[PATH_LENGTH-1];
    this.add.text(end.x+10,end.y-45,"RUIN",{fontFamily:"monospace",fontSize:"13px",color:"#e8b18d",fontStyle:"bold"}).setOrigin(0.5);
    this.resultText = this.add.text(450,510,"ROLL THE DICE TO BEGIN",{fontFamily:"monospace",fontSize:"15px",color:"#d5deec"}).setOrigin(0.5);
  }
  rollAndMove(): { message: string } {
    if (this.state.position >= PATH_LENGTH-1) {
      this.state.position = 0; this.state.turnNumber++; this.updateHud();
      return { message: "จบรอบทดลองแล้ว กลับไปเริ่มต้นใหม่" };
    }
    const roll = rollD6(); const previous = this.state.position;
    this.state.position = Math.min(PATH_LENGTH-1,this.state.position+roll);
    const target = this.tileCenters[this.state.position];
    if (this.playerToken) this.tweens.add({ targets:this.playerToken,x:target.x,y:target.y-20,duration:420,ease:"Sine.easeInOut",onUpdate:()=>this.playerToken?.setDepth(this.playerToken.y+20) });
    const moved = this.state.position-previous;
    const message = "ทอยได้ " + roll + " แต้ม · เดิน " + moved + " ช่อง";
    this.resultText?.setText(message.toUpperCase()); this.updateHud(roll);
    return { message };
  }
  private updateHud(roll?: number): void {
    const position = document.querySelector<HTMLElement>("#position");
    const score = document.querySelector<HTMLElement>("#score");
    const hand = document.querySelector<HTMLElement>("#hand-count");
    const turn = document.querySelector<HTMLElement>("#turn-label");
    const dice = document.querySelector<HTMLElement>("#dice-result");
    if (position) position.textContent = this.state.position === 0 ? "จุดเริ่มต้น" : "ช่อง " + (this.state.position+1);
    if (score) score.textContent = String(this.state.score);
    if (hand) hand.textContent = String(this.state.handCount);
    if (turn) turn.textContent = "เทิร์น " + this.state.turnNumber + " · " + this.state.playerName;
    if (dice && roll !== undefined) dice.textContent = String(roll);
  }
}