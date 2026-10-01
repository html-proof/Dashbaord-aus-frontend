"use client";
import ReactGridLayout, { useContainerWidth, verticalCompactor, type LayoutItem } from "react-grid-layout";

export type GridBox = { i: string; x: number; y: number; w: number; h: number };
export type GridItem = { id: string; node: React.ReactNode; w: number; h: number; minW?: number; minH?: number };

const COLS = 12;
const ROW = 40;
const MOBILE = 768;

/**
 * Cards the user can drag (by any `.drag-handle`) and resize (bottom-right
 * corner) on a 12-column grid; neighbours reflow around them. `saved` boxes
 * win over each item's default size; unknown/new items are placed in the
 * first free spot. Below 768px it falls back to a plain stacked list.
 */
export function ResizableGrid({
  items,
  saved,
  onChange,
  gap = 12,
}: {
  items: GridItem[];
  saved?: GridBox[];
  onChange: (boxes: GridBox[]) => void;
  gap?: number;
}) {
  const { width, containerRef, mounted } = useContainerWidth();

  // Default flow: two per row by default widths, left to right.
  const layout: LayoutItem[] = [];
  let x = 0;
  let y = 0;
  let rowH = 0;
  for (const it of items) {
    const box = saved?.find((b) => b.i === it.id);
    const w = Math.min(COLS, Math.max(it.minW ?? 3, box?.w ?? it.w));
    const h = Math.max(it.minH ?? 4, box?.h ?? it.h);
    if (box) {
      layout.push({ i: it.id, x: Math.min(box.x, COLS - w), y: box.y, w, h, minW: it.minW ?? 3, minH: it.minH ?? 4 });
      continue;
    }
    if (x + w > COLS) {
      x = 0;
      y += rowH;
      rowH = 0;
    }
    layout.push({ i: it.id, x, y: saved?.length ? Infinity : y, w, h, minW: it.minW ?? 3, minH: it.minH ?? 4 });
    x += w;
    rowH = Math.max(rowH, h);
  }

  if (mounted && width < MOBILE) {
    return (
      <div ref={containerRef} className="flex flex-col" style={{ gap }}>
        {items.map((it) => (
          <div key={it.id} style={{ height: it.h * ROW + (it.h - 1) * gap }}>
            {it.node}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="-mx-[var(--g)]" style={{ ["--g" as string]: `${gap}px` }}>
      {mounted && (
        <ReactGridLayout
          width={width}
          layout={layout}
          compactor={verticalCompactor}
          gridConfig={{ cols: COLS, rowHeight: ROW, margin: [gap, gap], containerPadding: [gap, 0] }}
          dragConfig={{ enabled: true, handle: ".drag-handle", cancel: "select,button,input,a" }}
          resizeConfig={{ enabled: true, handles: ["se", "e", "s"] }}
          onLayoutChange={(l) => {
            const next = l.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));
            const same =
              saved &&
              next.length === saved.length &&
              next.every((b) => saved.some((s) => s.i === b.i && s.x === b.x && s.y === b.y && s.w === b.w && s.h === b.h));
            if (!same) onChange(next);
          }}
        >
          {items.map((it) => (
            <div key={it.id}>{it.node}</div>
          ))}
        </ReactGridLayout>
      )}
    </div>
  );
}
