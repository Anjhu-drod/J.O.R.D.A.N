export class VisualEffectsService {
  constructor() {
    this.root = document.documentElement;
    this.particleField = null;
    this.running = false;
    this.lastTouch = null;
    this.frame = null;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.particleField = document.querySelector(".fx-particles");
    this.buildParticles();

    window.addEventListener("pointermove", this.onPointerMove, { passive: true });
    window.addEventListener("touchmove", this.onTouchMove, { passive: true });
    window.addEventListener("resize", this.onResize, { passive: true });
    document.addEventListener("pointerdown", this.onPointerDown, { passive: true });
    document.addEventListener("click", this.onClick, { passive: true });

    this.setPointer(window.innerWidth * 0.58, window.innerHeight * 0.36);
    document.body.classList.add("visual-core-ready");
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("touchmove", this.onTouchMove);
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("pointerdown", this.onPointerDown);
    document.removeEventListener("click", this.onClick);
    cancelAnimationFrame(this.frame);
  }

  onPointerMove = (event) => {
    if (event.pointerType === "touch") return;
    this.queuePointer(event.clientX, event.clientY);
  };

  onTouchMove = (event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    this.queuePointer(touch.clientX, touch.clientY);
  };

  onResize = () => this.buildParticles(true);

  onPointerDown = (event) => {
    const target = event.target?.closest?.("button, a, [data-command], .month-day, .event-item");
    if (!target || target.matches(":disabled")) return;
    this.spawnRipple(target, event.clientX, event.clientY);
    target.classList.remove("jordan-press");
    void target.offsetWidth;
    target.classList.add("jordan-press");
    setTimeout(() => target.classList.remove("jordan-press"), 360);
  };

  onClick = (event) => {
    const target = event.target?.closest?.("[data-view-target]");
    if (!target) return;
    document.body.classList.remove("nav-flash");
    void document.body.offsetWidth;
    document.body.classList.add("nav-flash");
    setTimeout(() => document.body.classList.remove("nav-flash"), 520);
  };

  spawnRipple(target, clientX, clientY) {
    try {
      const rect = target.getBoundingClientRect();
      const ripple = document.createElement("span");
      ripple.className = "jordan-ripple";
      const size = Math.max(rect.width, rect.height) * 1.35;
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${clientX - rect.left - size / 2}px`;
      ripple.style.top = `${clientY - rect.top - size / 2}px`;
      target.appendChild(ripple);
      setTimeout(() => ripple.remove(), 650);
    } catch {}
  }

  queuePointer(x, y) {
    this.lastTouch = { x, y };
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      if (this.lastTouch) this.setPointer(this.lastTouch.x, this.lastTouch.y);
    });
  }

  setPointer(x, y) {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const px = Math.max(0, Math.min(1, x / width));
    const py = Math.max(0, Math.min(1, y / height));
    this.root.style.setProperty("--jordan-pointer-x", `${(px * 100).toFixed(2)}%`);
    this.root.style.setProperty("--jordan-pointer-y", `${(py * 100).toFixed(2)}%`);
    this.root.style.setProperty("--jordan-tilt-x", `${((py - .5) * -4).toFixed(2)}deg`);
    this.root.style.setProperty("--jordan-tilt-y", `${((px - .5) * 5).toFixed(2)}deg`);
  }

  buildParticles(force = false) {
    if (!this.particleField) return;
    const compact = window.innerWidth < 700;
    const target = compact ? 22 : 46;
    if (!force && this.particleField.children.length === target) return;

    this.particleField.textContent = "";
    for (let index = 0; index < target; index += 1) {
      const node = document.createElement("i");
      const left = (index * 37.71 + 11) % 100;
      const top = (index * 61.37 + 7) % 100;
      const size = 1 + (index % 3);
      const duration = 7 + (index % 9) * 1.15;
      const delay = -(index % 11) * .83;
      node.style.setProperty("--p-left", `${left}%`);
      node.style.setProperty("--p-top", `${top}%`);
      node.style.setProperty("--p-size", `${size}px`);
      node.style.setProperty("--p-duration", `${duration}s`);
      node.style.setProperty("--p-delay", `${delay}s`);
      this.particleField.appendChild(node);
    }
  }
}

export const visualEffects = new VisualEffectsService();
