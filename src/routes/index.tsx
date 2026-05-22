import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Binary Rain Decoder" },
      { name: "description", content: "Decode the hidden ASCII message from the binary rain." },
    ],
  }),
});

const SECRET = "Janta";

function toBinary(str: string) {
  return str
    .split("")
    .map((c) => c.charCodeAt(0).toString(2).padStart(8, "0"))
    .join("");
}

const SECRET_BITS = toBinary(SECRET); // 40 bits, no spaces

function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;

    let width = 0;
    let height = 0;
    const fontSize = 16;
    let columns = 0;
    const REVEAL_RADIUS = 60; // px around cursor where secret bits turn red

    type Drop = {
      y: number;
      speed: number;
      currentBit: string;
      history: string[]; // newest first
    };
    let drops: Drop[] = [];

    // Secret rows: each ASCII char (8 bits) gets its own horizontal row,
    // bits placed left -> right across the screen.
    type SecretCell = { x: number; y: number; bit: string; idx: number; globalIdx: number };
    let secretCells: SecretCell[] = [];

    const mouse = { x: -9999, y: -9999 };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      columns = Math.floor(width / fontSize);

      drops = Array.from({ length: columns }, () => ({
        y: Math.random() * -height,
        speed: 0.5 + Math.random() * 1.1,
        currentBit: Math.random() > 0.5 ? "1" : "0",
        history: [],
      }));

      // Lay out 5 chars × 8 bits across 5 rows.
      secretCells = [];
      const charCount = SECRET.length; // 5
      const bitsPerChar = 8;
      const topPct = 0.15;
      const bottomPct = 0.85;
      const usableH = height * (bottomPct - topPct);
      const rowStep = usableH / (charCount - 1 || 1);
      const sideMargin = Math.min(width * 0.1, 80);
      const usableW = width - sideMargin * 2;
      const colStep = usableW / (bitsPerChar - 1);

      for (let c = 0; c < charCount; c++) {
        const yPx = height * topPct + rowStep * c;
        const ySnap = Math.round(yPx / fontSize) * fontSize;
        for (let b = 0; b < bitsPerChar; b++) {
          const xPx = sideMargin + colStep * b;
          const xSnap = Math.round(xPx / fontSize) * fontSize;
          secretCells.push({
            x: xSnap,
            y: ySnap,
            bit: SECRET_BITS[c * bitsPerChar + b],
            idx: b,
            globalIdx: c * bitsPerChar + b,
          });
        }
      }
    };

    resize();
    window.addEventListener("resize", resize);

    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };
    const onTouch = (e: TouchEvent) => {
      if (e.touches.length) {
        mouse.x = e.touches[0].clientX;
        mouse.y = e.touches[0].clientY;
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    window.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("touchend", onLeave);

    const draw = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
      ctx.fillRect(0, 0, width, height);
      ctx.font = `${fontSize}px ui-monospace, "JetBrains Mono", monospace`;

      // ---- Falling rain (pure noise now) ----
      for (let i = 0; i < columns; i++) {
        const d = drops[i];
        const x = i * fontSize;

        const prevRow = Math.floor((d.y - d.speed * fontSize * 0.6) / fontSize);
        const row = Math.floor(d.y / fontSize);
        if (row !== prevRow) {
          d.currentBit = Math.random() > 0.5 ? "1" : "0";
          d.history.unshift(d.currentBit);
          if (d.history.length > 18) d.history.length = 18;
        }

        for (let t = 0; t < d.history.length; t++) {
          const ch = d.history[t];
          const ty = d.y - t * fontSize;
          if (ty < -fontSize || ty > height) continue;
          if (t === 0) {
            ctx.fillStyle = "rgba(220, 255, 220, 0.9)";
            ctx.fillText(ch, x, ty);
          }
          const alpha = t === 0 ? 0.95 : Math.max(0, 0.55 - t * 0.04);
          ctx.fillStyle = `rgba(74, 222, 128, ${alpha})`;
          ctx.fillText(ch, x, ty);
        }

        d.y += d.speed * fontSize * 0.6;
        if (d.y > height + Math.random() * 200) {
          d.y = -fontSize * (5 + Math.random() * 20);
          d.speed = 0.5 + Math.random() * 1.1;
          d.history.length = 0;
        }
      }

      // ---- Hidden secret bits on fixed rows ----
      for (const cell of secretCells) {
        const dx = cell.x - mouse.x;
        const dy = cell.y - mouse.y;
        const dist = Math.hypot(dx, dy);
        const hovered = dist < REVEAL_RADIUS;

        if (hovered) {
          // Clear the cell area so the rain underneath doesn't muddy it
          ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
          ctx.fillRect(cell.x - 2, cell.y - fontSize + 2, fontSize + 2, fontSize);

          // Glow halo for manual hover (Red)
          ctx.fillStyle = "rgba(255, 60, 60, 0.25)";
          ctx.fillText(cell.bit, cell.x - 1, cell.y);
          ctx.fillText(cell.bit, cell.x + 1, cell.y);
          ctx.fillStyle = "rgba(255, 80, 80, 1)";
          ctx.fillText(cell.bit, cell.x, cell.y);
        }
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("touchend", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 h-full w-full"
      style={{ background: "#000" }}
    />
  );
}

function Index() {
  return (
    <main className="relative min-h-screen overflow-hidden text-[#4ADE80]" style={{ background: "#000" }}>
      <MatrixRain />

      {/* vignette */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 0%, rgba(0,0,0,0.7) 70%, rgba(0,0,0,0.95) 100%)",
        }}
      />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-between px-4 py-10 font-mono">
        <header className="w-full max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 border border-[#4ADE80]/30 bg-black/60 px-3 py-1 text-xs uppercase tracking-[0.3em] text-[#4ADE80]/80 backdrop-blur">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#4ADE80] shadow-[0_0_8px_#4ADE80]" />
            secure_channel // live
          </div>
          <h1
            className="mt-6 text-3xl font-bold uppercase tracking-[0.4em] sm:text-5xl"
            style={{ textShadow: "0 0 12px rgba(74,222,128,0.7), 0 0 32px rgba(74,222,128,0.35)" }}
          >
            Binary Rain Decoder
          </h1>
        </header>

        <footer className="text-[10px] uppercase tracking-[0.4em] text-[#4ADE80]/40">
          // end of transmission
        </footer>
      </div>
    </main>
  );
}
