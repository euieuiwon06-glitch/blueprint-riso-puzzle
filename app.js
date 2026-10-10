(() => {
  "use strict";

  const SOURCE = { w: 1536, h: 1024 };
  const SNAP_TIME = 220;
  const MIN_VISIBLE = 44;

  // Source rectangles in the 1536 × 1024 master. `pile` is the piece's top-left
  // in the starting clump, measured from the board origin in the same units,
  // and `z` its stacking order (1 = bottom). The clump sits over the centre of
  // the board but every piece starts well away from its own slot.
  const PIECES = [
    { id: "a", src: "assets/riso-piece-a-deep.png",      x: 0,    y: 0,   w: 553, h: 369, pile: [750, 490], z: 4 },
    { id: "b", src: "assets/riso-piece-b-pale.png",      x: 0,    y: 369, w: 230, h: 655, pile: [650, 207], z: 7 },
    { id: "c", src: "assets/riso-piece-c-coarse.png",    x: 230,  y: 369, w: 323, h: 655, pile: [964, 117], z: 2 },
    { id: "d", src: "assets/riso-piece-d-cobalt.png",    x: 553,  y: 0,   w: 983, h: 297, pile: [354, 646], z: 3 },
    { id: "e", src: "assets/riso-piece-e-classic.png",   x: 553,  y: 297, w: 614, h: 727, pile: [248, 131], z: 1 },
    { id: "f", src: "assets/riso-piece-f-cyanotype.png", x: 1167, y: 297, w: 369, h: 338, pile: [321, 105], z: 5 },
    { id: "g", src: "assets/riso-piece-g-faded.png",     x: 1167, y: 635, w: 369, h: 389, pile: [641, 80], z: 6 },
  ];
  const desk = document.getElementById("desk");
  const boardEl = document.getElementById("board");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let mode = null;
  let vw = 0, vh = 0;
  const board = { x: 0, y: 0, w: 0, h: 0, sx: 1, sy: 1 };
  let topZ = 10;
  let completeTimer = 0;

  const pieces = PIECES.map((def) => {
    const el = document.createElement("div");
    el.className = "piece";
    const img = new Image();
    img.src = def.src;
    img.alt = "";
    img.draggable = false;
    img.decoding = "async";
    el.appendChild(img);
    el.style.zIndex = topZ + def.z;
    desk.appendChild(el);
    return { def, el, u: 0, v: 0, w: 0, h: 0, cx: 0, cy: 0, placed: false };
  });

  /* ---------------- layout ---------------- */

  function layoutBoard() {
    if (mode === "tall") {
      board.w = vw * 0.88;
      board.h = board.w * (2 / 3);
      board.x = (vw - board.w) / 2;
      board.y = (vh - board.h) / 2;
    } else {
      board.w = Math.min(vw * 0.52, 820, vh * 0.64 * 1.5);
      board.h = board.w * (2 / 3);
      board.x = (vw - board.w) / 2;
      board.y = (vh - board.h) / 2;
    }
    board.sx = board.w / SOURCE.w;
    board.sy = board.h / SOURCE.h;
    Object.assign(boardEl.style, {
      left: `${board.x}px`, top: `${board.y}px`,
      width: `${board.w}px`, height: `${board.h}px`,
    });
  }

  function target(p) {
    const d = p.def;
    return {
      left: board.x + d.x * board.sx,
      top: board.y + d.y * board.sy,
      cx: board.x + (d.x + d.w / 2) * board.sx,
      cy: board.y + (d.y + d.h / 2) * board.sy,
    };
  }

  function clampCentre(p) {
    p.cx = Math.min(vw - MIN_VISIBLE + p.w / 2, Math.max(MIN_VISIBLE - p.w / 2, p.cx));
    p.cy = Math.min(vh - MIN_VISIBLE + p.h / 2, Math.max(MIN_VISIBLE - p.h / 2, p.cy));
  }

  function render(p) {
    let left, top;
    if (p.placed) {
      const t = target(p);
      left = t.left;
      top = t.top;
    } else {
      left = p.cx - p.w / 2;
      top = p.cy - p.h / 2;
    }
    p.el.style.transform = `translate3d(${left}px, ${top}px, 0)`;
  }

  function layout() {
    vw = window.innerWidth;
    vh = window.innerHeight;
    const nextMode = vw / vh < 0.8 || vw < 640 ? "tall" : "wide";
    const modeChanged = nextMode !== mode;
    mode = nextMode;
    layoutBoard();

    pieces.forEach((p) => {
      // Every piece uses the same scale, so neighbouring edges meet exactly.
      p.w = p.def.w * board.sx;
      p.h = p.def.h * board.sy;
      p.el.style.width = `${p.w}px`;
      p.el.style.height = `${p.h}px`;
      if (modeChanged && !p.placed) {
        p.u = (board.x + (p.def.pile[0] + p.def.w / 2) * board.sx) / vw;
        p.v = (board.y + (p.def.pile[1] + p.def.h / 2) * board.sy) / vh;
      }
      p.cx = p.u * vw;
      p.cy = p.v * vh;
      clampCentre(p);
      render(p);
    });
  }

  /* ---------------- dragging ---------------- */

  let drag = null;

  function onDown(e, p) {
    if (p.placed || drag || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    p.el.classList.remove("is-snapping");
    p.el.setPointerCapture(e.pointerId);
    p.el.style.zIndex = ++topZ;
    p.el.classList.add("is-held");
    document.body.classList.add("is-dragging");
    drag = { p, id: e.pointerId, type: e.pointerType, ox: e.clientX - p.cx, oy: e.clientY - p.cy };
  }

  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const { p } = drag;
    p.cx = e.clientX - drag.ox;
    p.cy = e.clientY - drag.oy;
    clampCentre(p);
    render(p);
  }

  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const { p, type } = drag;
    drag = null;
    p.el.classList.remove("is-held");
    document.body.classList.remove("is-dragging");

    const t = target(p);
    const threshold = type === "touch" ? 64 : 48;
    if (e.type !== "pointercancel" && Math.hypot(p.cx - t.cx, p.cy - t.cy) <= threshold) {
      place(p);
    } else {
      p.u = p.cx / vw;
      p.v = p.cy / vh;
    }
  }

  function place(p) {
    p.placed = true;
    p.el.classList.add("is-placed");
    // Placed pieces sit under anything still loose.
    p.el.style.zIndex = 1;
    if (!reduceMotion.matches) {
      p.el.classList.add("is-snapping");
      p.el.addEventListener("transitionend", function done(ev) {
        if (ev.target !== p.el) return;
        p.el.classList.remove("is-snapping");
        p.el.removeEventListener("transitionend", done);
      });
    }
    render(p);

    if (pieces.every((q) => q.placed)) {
      clearTimeout(completeTimer);
      completeTimer = setTimeout(
        () => boardEl.classList.add("is-complete"),
        reduceMotion.matches ? 0 : SNAP_TIME,
      );
    }
  }

  pieces.forEach((p) => {
    p.el.addEventListener("pointerdown", (e) => onDown(e, p));
    p.el.addEventListener("pointermove", onMove);
    p.el.addEventListener("pointerup", onUp);
    p.el.addEventListener("pointercancel", onUp);
    p.el.addEventListener("lostpointercapture", onUp);
    p.el.addEventListener("dragstart", (e) => e.preventDefault());
  });

  let resizeRaf = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(layout);
  });

  layout();
})();
