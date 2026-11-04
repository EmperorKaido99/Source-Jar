import type { Jar } from "./types";

export interface KnifeModel {
  x: number;
  y: number;
  angle: number;
  targetAngle: number;
  moveAngle: number;
  active: boolean;
  parking: boolean;
}

export function createKnife(): KnifeModel {
  return {
    x: 0,
    y: 0,
    angle: 1.45,
    targetAngle: 1.45,
    moveAngle: 0,
    active: false,
    parking: false,
  };
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

export function drawKnife(
  context: CanvasRenderingContext2D,
  knife: KnifeModel,
  jar: Pick<Jar, "color">,
  size: number,
  pixelRatio: number,
  _reducedMotion: boolean,
): void {
  const length = size * 0.21;
  const width = size * 0.052;
  const handleHeight = size * 0.16;

  context.save();
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.translate(knife.x, knife.y);
  context.rotate(knife.angle);
  context.shadowColor = "rgba(20, 15, 10, 0.35)";
  context.shadowBlur = size * 0.02;
  context.shadowOffsetX = size * 0.01;
  context.shadowOffsetY = size * 0.012;

  const blade = new Path2D();
  blade.moveTo(-width / 2, -width / 2);
  blade.arc(0, -width / 2, width / 2, Math.PI, 0, true);
  blade.lineTo(width * 0.36, -length);
  blade.lineTo(-width * 0.36, -length);
  blade.closePath();
  const bladeGradient = context.createLinearGradient(-width / 2, 0, width / 2, 0);
  bladeGradient.addColorStop(0, "#8E98A3");
  bladeGradient.addColorStop(0.45, "#F3F6F9");
  bladeGradient.addColorStop(1, "#AEB7C1");
  context.fillStyle = bladeGradient;
  context.fill(blade);

  context.shadowColor = "transparent";
  context.save();
  context.clip(blade);
  context.fillStyle = jar.color;
  context.beginPath();
  context.moveTo(-width, 0);
  context.lineTo(width, 0);
  context.lineTo(width, -length * 0.34);
  context.quadraticCurveTo(width * 0.2, -length * 0.42, 0, -length * 0.33);
  context.quadraticCurveTo(-width * 0.4, -length * 0.25, -width, -length * 0.3);
  context.closePath();
  context.fill();
  context.fillStyle = "rgba(255,255,255,0.25)";
  context.fillRect(-width * 0.25, -length * 0.3, width * 0.12, length * 0.24);
  context.restore();

  context.fillStyle = "#C3CBD3";
  roundRect(context, -width * 0.42, -length - size * 0.012, width * 0.84, size * 0.014, 2);
  context.fill();
  context.shadowColor = "rgba(20, 15, 10, 0.35)";
  context.shadowBlur = size * 0.02;
  context.shadowOffsetX = size * 0.01;
  context.shadowOffsetY = size * 0.012;
  const handleGradient = context.createLinearGradient(-width / 2, 0, width / 2, 0);
  handleGradient.addColorStop(0, "#1D1F25");
  handleGradient.addColorStop(0.4, "#3A3D46");
  handleGradient.addColorStop(1, "#16171C");
  context.fillStyle = handleGradient;
  roundRect(
    context,
    -width * 0.45,
    -length - size * 0.012 - handleHeight,
    width * 0.9,
    handleHeight,
    width * 0.4,
  );
  context.fill();
  context.shadowColor = "transparent";
  context.fillStyle = "#C3CBD3";
  for (const fraction of [0.3, 0.7]) {
    context.beginPath();
    context.arc(0, -length - size * 0.012 - handleHeight * fraction, width * 0.1, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}
