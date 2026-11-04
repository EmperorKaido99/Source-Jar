import { createKnife, drawKnife, type KnifeModel } from "./knife";
import type { Jar, Tool } from "./types";

const DISPLAY_FONT = '"Bagel Fat One", "Arial Rounded MT Bold", "Trebuchet MS", sans-serif';
const SLICE_SIZE = 12;

export interface BreadBoardOptions {
  canvas: HTMLCanvasElement;
  container?: HTMLElement;
  onReveal?: (tool: Tool) => void;
  onSliceChange?: (jar: Jar, tools: readonly Tool[], sliceIndex: number) => void;
  reducedMotion?: boolean;
}

export interface BreadBoard {
  setSlice(jar: Jar, tools: readonly Tool[], sliceIndex: number): void;
  spreadAll(): void;
  clear(): void;
  destroy(): void;
}

interface Point {
  x: number;
  y: number;
  lift?: boolean;
}

interface Geometry {
  width: number;
  height: number;
  centerX: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  inset: number;
  radius: number;
  outer: Path2D;
  inner: Path2D;
  left: number;
  right: number;
  rowsY: number[];
}

interface Slot {
  x: number;
  y: number;
  rotation: number;
  size: number;
  textWidth: number;
  label: string;
}

interface AutoSpread {
  points: Point[];
  index: number;
  position: Point;
  speed: number;
}

export function sliceTools(tools: readonly Tool[], sliceIndex: number): Tool[] {
  const start = Math.max(0, sliceIndex) * SLICE_SIZE;
  return tools.slice(start, start + SLICE_SIZE);
}

function createCanvas(): HTMLCanvasElement {
  return document.createElement("canvas");
}

function seededRandom(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function breadPath(x0: number, x1: number, y0: number, y1: number, width: number, height: number, radius: number): Path2D {
  const path = new Path2D();
  const centerX = (x0 + x1) / 2;
  const shoulderY = y0 + height * 0.36;
  path.moveTo(x0 + radius, y1);
  path.lineTo(x1 - radius, y1);
  path.quadraticCurveTo(x1, y1, x1, y1 - radius);
  path.lineTo(x1, shoulderY);
  path.bezierCurveTo(x1 + width * 0.1, shoulderY - height * 0.06, x1 + width * 0.07, y0, centerX, y0);
  path.bezierCurveTo(x0 - width * 0.07, y0, x0 - width * 0.1, shoulderY - height * 0.06, x0, shoulderY);
  path.lineTo(x0, y1 - radius);
  path.quadraticCurveTo(x0, y1, x0 + radius, y1);
  path.closePath();
  return path;
}

export function createBreadBoard(options: BreadBoardOptions): BreadBoard {
  const { canvas, onReveal, onSliceChange } = options;
  const container = options.container ?? canvas.parentElement ?? canvas;
  const context = canvas.getContext("2d")!;
  if (!context) throw new Error("The bread board requires a 2D canvas context.");

  const maskCanvas = createCanvas();
  const streakCanvas = createCanvas();
  const sauceCanvas = createCanvas();
  const breadCanvas = createCanvas();
  const maskContext = maskCanvas.getContext("2d", { willReadFrequently: true })!;
  const streakContext = streakCanvas.getContext("2d")!;
  const sauceContext = sauceCanvas.getContext("2d")!;
  const breadContext = breadCanvas.getContext("2d")!;
  if (!maskContext || !streakContext || !sauceContext || !breadContext) {
    throw new Error("The bread board could not create its drawing layers.");
  }

  const stampCanvas = createCanvas();
  stampCanvas.width = stampCanvas.height = 64;
  const stampContext = stampCanvas.getContext("2d")!;
  if (!stampContext) throw new Error("The bread board could not create its stamp.");
  const stampGradient = stampContext.createRadialGradient(32, 32, 0, 32, 32, 32);
  stampGradient.addColorStop(0, "rgba(255,255,255,1)");
  stampGradient.addColorStop(0.8, "rgba(255,255,255,1)");
  stampGradient.addColorStop(1, "rgba(255,255,255,0)");
  stampContext.fillStyle = stampGradient;
  stampContext.fillRect(0, 0, 64, 64);

  const mediaQuery = typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : undefined;
  let reducedMotion = options.reducedMotion ?? mediaQuery?.matches ?? false;
  let size = 0;
  let pixelRatio = 1;
  let geometry: Geometry | undefined;
  let jar: Jar | undefined;
  let currentTools: Tool[] = [];
  let currentSlice = 0;
  let slots: Slot[] = [];
  let revealed = new Set<number>();
  const popTimes = new Map<number, number>();
  const knife = createKnife();
  let auto: AutoSpread | undefined;
  let lastPoint: Point | undefined;
  let drawing = false;
  let dirty = true;
  let spreadPending = false;
  let lastCheck = 0;
  let previousTime = performance.now();
  let frame = 0;
  let destroyed = false;

  const parkPosition = (): Point => ({ x: size * 0.17, y: size * 0.935 });

  function parkKnife(instant: boolean): void {
    const point = parkPosition();
    knife.active = false;
    knife.targetAngle = 1.5;
    if (instant || reducedMotion) {
      knife.x = point.x;
      knife.y = point.y;
      knife.angle = 1.5;
      knife.parking = false;
    } else {
      knife.parking = true;
    }
    dirty = true;
  }

  function setKnife(point: Point): void {
    const horizontalDistance = point.x - knife.x;
    knife.x = point.x;
    knife.y = point.y;
    knife.active = true;
    knife.parking = false;
    knife.targetAngle = 0.62 + Math.max(-0.3, Math.min(0.3, horizontalDistance * 0.02));
    dirty = true;
  }

  function computeGeometry(): Geometry {
    const width = size * 0.72;
    const height = size * 0.76;
    const centerX = size / 2;
    const x0 = centerX - width / 2;
    const x1 = centerX + width / 2;
    const y0 = size * 0.09;
    const y1 = y0 + height;
    const inset = size * 0.038;
    return {
      width, height, centerX, x0, x1, y0, y1, inset,
      radius: size * 0.075,
      outer: breadPath(x0, x1, y0, y1, width, height, size * 0.05),
      inner: breadPath(x0 + inset, x1 - inset, y0 + inset, y1 - inset, width - 2 * inset, height - 2 * inset, size * 0.03),
      left: x0 + inset,
      right: x1 - inset,
      rowsY: [],
    };
  }

  function drawBread(): void {
    if (!geometry) return;
    const geo = geometry;
    breadContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    breadContext.clearRect(0, 0, size, size);
    breadContext.save();
    breadContext.shadowColor = "rgba(40, 25, 10, 0.30)";
    breadContext.shadowBlur = size * 0.035;
    breadContext.shadowOffsetY = size * 0.014;
    const crust = breadContext.createLinearGradient(0, geo.y0, 0, geo.y1);
    crust.addColorStop(0, "#9C5A22");
    crust.addColorStop(0.5, "#B87436");
    crust.addColorStop(1, "#C98D4A");
    breadContext.fillStyle = crust;
    breadContext.fill(geo.outer);
    breadContext.restore();

    breadContext.save();
    breadContext.clip(geo.outer);
    const crustRandom = seededRandom(11);
    for (let index = 0; index < 500; index += 1) {
      breadContext.fillStyle = `rgba(${crustRandom() < 0.5 ? "90,45,10" : "230,170,100"},${0.08 + crustRandom() * 0.12})`;
      breadContext.fillRect(geo.x0 - geo.width * 0.1 + crustRandom() * geo.width * 1.2, geo.y0 + crustRandom() * geo.height, 1 + crustRandom() * 2, 1 + crustRandom() * 2);
    }
    breadContext.restore();

    breadContext.save();
    breadContext.clip(geo.inner);
    const crumb = breadContext.createRadialGradient(geo.centerX, geo.y0 + geo.height * 0.5, size * 0.05, geo.centerX, geo.y0 + geo.height * 0.5, size * 0.48);
    crumb.addColorStop(0, "#FAEDCF");
    crumb.addColorStop(1, "#EBD19E");
    breadContext.fillStyle = crumb;
    breadContext.fillRect(0, 0, size, size);
    const random = seededRandom(7);
    const scale = size / 500;
    for (let index = 0; index < 1500; index += 1) {
      const x = geo.x0 - geo.width * 0.06 + random() * geo.width * 1.12;
      const y = geo.y0 + random() * geo.height;
      const radius = (0.5 + random() * random() * 3.4) * scale;
      breadContext.fillStyle = `rgba(150, 102, 48, ${0.08 + random() * 0.18})`;
      breadContext.beginPath();
      breadContext.ellipse(x, y, radius * 1.5, radius, random() * Math.PI, 0, Math.PI * 2);
      breadContext.fill();
    }
    for (let index = 0; index < 700; index += 1) {
      breadContext.fillStyle = `rgba(255, 251, 238, ${0.3 + random() * 0.4})`;
      breadContext.fillRect(geo.x0 + random() * geo.width, geo.y0 + random() * geo.height, 1.2 * scale, 1.2 * scale);
    }
    breadContext.lineWidth = size * 0.026;
    breadContext.strokeStyle = "rgba(196, 136, 64, 0.30)";
    breadContext.stroke(geo.inner);
    breadContext.restore();
  }

  function layoutSlots(): void {
    if (!geometry) return;
    const geo = geometry;
    const columns = 3;
    const left = geo.x0 + geo.inset + size * 0.02;
    const right = geo.x1 - geo.inset - size * 0.02;
    const top = geo.y0 + geo.height * 0.19;
    const bottom = geo.y1 - geo.inset - size * 0.035;
    const rows = Math.max(1, Math.ceil(currentTools.length / columns));
    const cellWidth = (right - left) / columns;
    const cellHeight = (bottom - top) / rows;
    const random = seededRandom((currentSlice + 1) * 31 + 3);
    slots = currentTools.map((tool, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = left + cellWidth * (column + 0.5) + (random() - 0.5) * cellWidth * 0.12;
      const y = top + cellHeight * (row + 0.5) + (random() - 0.5) * cellHeight * 0.16;
      const label = tool.shortLabel ?? tool.name;
      let labelSize = size * 0.042;
      context.font = `${labelSize}px ${DISPLAY_FONT}`;
      let textWidth = context.measureText(label).width;
      const maxWidth = cellWidth * 0.9;
      if (textWidth > maxWidth) {
        labelSize *= maxWidth / textWidth;
        textWidth = maxWidth;
      }
      return { x, y, rotation: (random() - 0.5) * 0.18, size: labelSize, textWidth, label };
    });
    geo.rowsY = Array.from({ length: rows }, (_, row) => top + cellHeight * (row + 0.5));
  }

  function resize(): void {
    const newSize = Math.round(container.clientWidth);
    const newPixelRatio = Math.min(2, window.devicePixelRatio || 1);
    if (!newSize || (newSize === size && newPixelRatio === pixelRatio)) return;
    const retainedMask = size ? (() => {
      const retained = createCanvas();
      retained.width = maskCanvas.width;
      retained.height = maskCanvas.height;
      retained.getContext("2d")?.drawImage(maskCanvas, 0, 0);
      return retained;
    })() : undefined;
    const retainedStreaks = size ? (() => {
      const retained = createCanvas();
      retained.width = streakCanvas.width;
      retained.height = streakCanvas.height;
      retained.getContext("2d")?.drawImage(streakCanvas, 0, 0);
      return retained;
    })() : undefined;
    const ratio = size ? newSize / size : 1;
    size = newSize;
    pixelRatio = newPixelRatio;
    for (const layer of [canvas, maskCanvas, streakCanvas, sauceCanvas, breadCanvas]) {
      layer.width = Math.round(size * pixelRatio);
      layer.height = Math.round(size * pixelRatio);
    }
    geometry = computeGeometry();
    drawBread();
    layoutSlots();
    if (retainedMask && retainedStreaks) {
      maskContext.drawImage(retainedMask, 0, 0, maskCanvas.width, maskCanvas.height);
      streakContext.drawImage(retainedStreaks, 0, 0, streakCanvas.width, streakCanvas.height);
    }
    knife.x *= ratio;
    knife.y *= ratio;
    if (!knife.active) parkKnife(true);
    dirty = true;
  }

  function spreadSegment(start: Point, end: Point): void {
    if (!geometry) return;
    const distanceX = end.x - start.x;
    const distanceY = end.y - start.y;
    const distance = Math.hypot(distanceX, distanceY);
    const angle = distance > 0.5 ? Math.atan2(distanceY, distanceX) : knife.moveAngle;
    if (distance > 0.5) knife.moveAngle = angle;
    const steps = Math.max(1, Math.ceil(distance / (geometry.radius * 0.22)));
    maskContext.save();
    maskContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    maskContext.clip(geometry.inner);
    maskContext.globalAlpha = 0.42;
    for (let index = 1; index <= steps; index += 1) {
      const progress = index / steps;
      const x = start.x + distanceX * progress;
      const y = start.y + distanceY * progress;
      maskContext.save();
      maskContext.translate(x, y);
      maskContext.rotate(angle);
      maskContext.drawImage(stampCanvas, -geometry.radius * 0.6, -geometry.radius, geometry.radius * 1.2, geometry.radius * 2);
      maskContext.restore();
    }
    maskContext.restore();

    if (distance > 0.5 && jar) {
      const normalX = -distanceY / distance;
      const normalY = distanceX / distance;
      streakContext.save();
      streakContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      streakContext.lineCap = "round";
      for (let index = -3; index <= 3; index += 1) {
        const offset = index * geometry.radius * 0.27 + Math.sin(index * 7.3) * 2;
        streakContext.strokeStyle = index % 2 ? jar.light : jar.dark;
        streakContext.globalAlpha = index % 2 ? 0.3 : 0.14;
        streakContext.lineWidth = (index % 2 ? 1.6 : 1.1) * size / 500;
        streakContext.beginPath();
        streakContext.moveTo(start.x + normalX * offset, start.y + normalY * offset);
        streakContext.lineTo(end.x + normalX * offset, end.y + normalY * offset);
        streakContext.stroke();
      }
      streakContext.restore();
    }
    spreadPending = true;
    dirty = true;
  }

  function reveal(index: number): void {
    if (revealed.has(index)) return;
    revealed.add(index);
    popTimes.set(index, reducedMotion ? -Infinity : performance.now());
    const tool = currentTools[index];
    if (tool) onReveal?.(tool);
    dirty = true;
  }

  function checkReveals(): void {
    spreadPending = false;
    for (const [index, slot] of slots.entries()) {
      if (revealed.has(index)) continue;
      const halfWidth = slot.textWidth / 2;
      const halfHeight = slot.size * 0.42;
      const x0 = Math.max(0, Math.floor((slot.x - halfWidth) * pixelRatio));
      const y0 = Math.max(0, Math.floor((slot.y - halfHeight) * pixelRatio));
      const width = Math.max(1, Math.min(maskCanvas.width - x0, Math.ceil(halfWidth * 2 * pixelRatio)));
      const height = Math.max(1, Math.min(maskCanvas.height - y0, Math.ceil(halfHeight * 2 * pixelRatio)));
      const pixels = maskContext.getImageData(x0, y0, width, height).data;
      let covered = 0;
      for (let y = 0; y < 3; y += 1) {
        for (let x = 0; x < 7; x += 1) {
          const sampleX = Math.floor(((x + 0.5) / 7) * width);
          const sampleY = Math.floor(((y + 0.5) / 3) * height);
          if (pixels[(sampleY * width + sampleX) * 4 + 3] > 110) covered += 1;
        }
      }
      if (covered / 21 >= 0.62) reveal(index);
    }
  }

  function render(now: number): boolean {
    if (!geometry || !jar) return false;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(breadCanvas, 0, 0);

    sauceContext.setTransform(1, 0, 0, 1, 0, 0);
    sauceContext.globalCompositeOperation = "source-over";
    sauceContext.globalAlpha = 1;
    sauceContext.clearRect(0, 0, sauceCanvas.width, sauceCanvas.height);
    sauceContext.drawImage(maskCanvas, 0, 0);
    sauceContext.globalCompositeOperation = "source-in";
    sauceContext.fillStyle = jar.color;
    sauceContext.fillRect(0, 0, sauceCanvas.width, sauceCanvas.height);
    sauceContext.globalCompositeOperation = "source-atop";
    sauceContext.drawImage(streakCanvas, 0, 0);
    sauceContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    const shine = sauceContext.createRadialGradient(geometry.x0 + geometry.width * 0.3, geometry.y0 + geometry.height * 0.25, 0, geometry.x0 + geometry.width * 0.3, geometry.y0 + geometry.height * 0.25, size * 0.6);
    shine.addColorStop(0, "rgba(255,255,255,0.24)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    sauceContext.fillStyle = shine;
    sauceContext.fillRect(0, 0, size, size);

    let animating = false;
    sauceContext.textAlign = "center";
    sauceContext.textBaseline = "middle";
    for (const index of revealed) {
      const slot = slots[index];
      if (!slot) continue;
      const progress = Math.min(1, (now - (popTimes.get(index) ?? now)) / 380);
      if (progress < 1) animating = true;
      const scale = 0.55 + 0.45 * (1 + 2.9 * Math.pow(progress - 1, 3) + 1.9 * Math.pow(progress - 1, 2));
      sauceContext.save();
      sauceContext.translate(slot.x, slot.y);
      sauceContext.rotate(slot.rotation);
      sauceContext.scale(scale, scale);
      sauceContext.font = `${slot.size}px ${DISPLAY_FONT}`;
      sauceContext.globalAlpha = Math.min(1, progress * 2.5);
      sauceContext.fillStyle = jar.light;
      sauceContext.fillText(slot.label, 0, slot.size * 0.05);
      sauceContext.fillStyle = jar.dark;
      sauceContext.fillText(slot.label, 0, -slot.size * 0.02);
      sauceContext.restore();
    }
    sauceContext.globalCompositeOperation = "source-over";
    context.save();
    context.shadowColor = "rgba(60, 30, 10, 0.35)";
    context.shadowBlur = 3 * pixelRatio;
    context.shadowOffsetY = 1.5 * pixelRatio;
    context.drawImage(sauceCanvas, 0, 0);
    context.restore();
    drawKnife(context, knife, jar, size, pixelRatio, reducedMotion);
    return animating;
  }

  function rowPass(y: number, fromLeft: boolean, points: Point[]): void {
    if (!geometry) return;
    const left = geometry.left + size * 0.01;
    const right = geometry.right - size * 0.01;
    for (let index = 0; index <= 16; index += 1) {
      const progress = fromLeft ? index / 16 : 1 - index / 16;
      points.push({ x: left + (right - left) * progress, y: y + Math.sin(progress * 9 + y) * size * 0.012 });
    }
  }

  function startPath(points: Point[]): void {
    if (!points.length) return;
    auto = undefined;
    const parked = parkPosition();
    const path = [{ ...points[0], lift: true }, ...points, { ...parked, lift: true }];
    if (reducedMotion) {
      let previous: Point | undefined;
      for (const point of path) {
        if (previous && !point.lift) spreadSegment(previous, point);
        previous = point;
      }
      checkReveals();
      parkKnife(true);
      return;
    }
    auto = { points: path, index: 0, position: { x: knife.x, y: knife.y }, speed: 1.3 * size / 500 };
    knife.active = true;
    knife.parking = false;
  }

  function stepAuto(delta: number): void {
    if (!auto) return;
    let remaining = auto.speed * delta;
    while (remaining > 0 && auto && auto.index < auto.points.length) {
      const target = auto.points[auto.index];
      const distanceX = target.x - auto.position.x;
      const distanceY = target.y - auto.position.y;
      const distance = Math.hypot(distanceX, distanceY);
      let next: Point;
      if (distance <= remaining) {
        next = { x: target.x, y: target.y };
        auto.index += 1;
        remaining -= distance;
      } else {
        next = { x: auto.position.x + distanceX / distance * remaining, y: auto.position.y + distanceY / distance * remaining };
        remaining = 0;
      }
      if (!target.lift) spreadSegment(auto.position, next);
      auto.position = next;
      setKnife(next);
      if (target.lift) knife.targetAngle = auto.index >= auto.points.length ? 1.5 : 0.62;
    }
    if (auto && auto.index >= auto.points.length) {
      auto = undefined;
      checkReveals();
      parkKnife(false);
    }
  }

  function clear(): void {
    auto = undefined;
    maskContext.setTransform(1, 0, 0, 1, 0, 0);
    maskContext.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    streakContext.setTransform(1, 0, 0, 1, 0, 0);
    streakContext.clearRect(0, 0, streakCanvas.width, streakCanvas.height);
    revealed = new Set();
    popTimes.clear();
    dirty = true;
  }

  function pointFor(event: PointerEvent): Point {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * size / bounds.width,
      y: (event.clientY - bounds.top) * size / bounds.height,
    };
  }

  function onPointerDown(event: PointerEvent): void {
    event.preventDefault();
    auto = undefined;
    drawing = true;
    try { canvas.setPointerCapture(event.pointerId); } catch { /* Browser may not support pointer capture. */ }
    const point = pointFor(event);
    setKnife(point);
    lastPoint = point;
    spreadSegment(point, { x: point.x + 0.6, y: point.y });
  }

  function onPointerMove(event: PointerEvent): void {
    if (auto) return;
    const point = pointFor(event);
    if (event.pointerType === "mouse" || drawing) setKnife(point);
    if (drawing && lastPoint) {
      spreadSegment(lastPoint, point);
      lastPoint = point;
    }
  }

  function endDrawing(event: PointerEvent): void {
    if (!drawing) return;
    drawing = false;
    lastPoint = undefined;
    checkReveals();
    if (event.pointerType !== "mouse") parkKnife(false);
  }

  function onPointerLeave(): void {
    if (!drawing && !auto) parkKnife(false);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      board.spreadAll();
    }
  }

  function onMotionChange(event: MediaQueryListEvent): void {
    if (options.reducedMotion === undefined) reducedMotion = event.matches;
  }

  function loop(now: number): void {
    if (destroyed) return;
    const delta = Math.min(40, now - previousTime);
    previousTime = now;
    stepAuto(delta);
    if (knife.parking) {
      const point = parkPosition();
      const factor = 1 - Math.pow(0.0001, delta / 1000 * 2.2);
      knife.x += (point.x - knife.x) * factor;
      knife.y += (point.y - knife.y) * factor;
      if (Math.hypot(point.x - knife.x, point.y - knife.y) < 0.5) {
        knife.x = point.x;
        knife.y = point.y;
        knife.parking = false;
      }
      dirty = true;
    }
    const angleDifference = knife.targetAngle - knife.angle;
    if (Math.abs(angleDifference) > 0.002) {
      knife.angle += angleDifference * Math.min(1, delta / 90);
      dirty = true;
    }
    if (spreadPending && now - lastCheck > 110) {
      lastCheck = now;
      checkReveals();
    }
    if (dirty && geometry) dirty = render(now);
    frame = requestAnimationFrame(loop);
  }

  const resizeObserver = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(resize);
  resizeObserver?.observe(container);
  window.addEventListener("resize", resize);
  mediaQuery?.addEventListener("change", onMotionChange);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", endDrawing);
  canvas.addEventListener("pointercancel", endDrawing);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("keydown", onKeyDown);

  const board: BreadBoard = {
    setSlice(nextJar, tools, sliceIndex) {
      jar = nextJar;
      currentSlice = Math.max(0, Math.floor(sliceIndex));
      currentTools = sliceTools(tools, currentSlice);
      clear();
      layoutSlots();
      parkKnife(true);
      onSliceChange?.(jar, currentTools, currentSlice);
    },
    spreadAll() {
      if (!geometry) return;
      const points: Point[] = [];
      rowPass(geometry.y0 + geometry.height * 0.12, true, points);
      geometry.rowsY.forEach((y, index) => rowPass(y, index % 2 === 1, points));
      rowPass(geometry.y1 - geometry.inset - size * 0.02, geometry.rowsY.length % 2 === 1, points);
      startPath(points);
    },
    clear,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", resize);
      mediaQuery?.removeEventListener("change", onMotionChange);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", endDrawing);
      canvas.removeEventListener("pointercancel", endDrawing);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("keydown", onKeyDown);
    },
  };

  resize();
  frame = requestAnimationFrame(loop);
  return board;
}
