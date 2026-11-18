import type { Coord, MazeEdit } from "../types/simulation";

export interface EdgeWall {
  a: Coord;
  b: Coord;
  key: string;
}

function isCoord(val: unknown): val is Coord {
  return (
    Array.isArray(val) &&
    val.length === 2 &&
    typeof val[0] === "number" &&
    typeof val[1] === "number"
  );
}

export function normalizeEdge(a: Coord, b: Coord): EdgeWall | null {
  const dr = Math.abs(a[0] - b[0]);
  const dc = Math.abs(a[1] - b[1]);
  if (dr + dc !== 1) return null;
  const firstFirst = a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]);
  const p1: Coord = firstFirst ? [a[0], a[1]] : [b[0], b[1]];
  const p2: Coord = firstFirst ? [b[0], b[1]] : [a[0], a[1]];
  return {
    a: p1,
    b: p2,
    key: `${p1[0]},${p1[1]}-${p2[0]},${p2[1]}`,
  };
}

/**
 * 코어-API 경계선 벽 데이터 포맷이 확정되기 전/후 모두 대응하도록
 * 다양한 벽 표현(좌표쌍 배열, 객체 배열, horizontal/vertical 행렬, 4튜플 배열)을
 * 표준 EdgeWall 목록으로 파싱한다.
 */
export function parseEdgeWalls(rawWalls: unknown): EdgeWall[] | null {
  if (rawWalls === null || rawWalls === undefined) return null;

  const map = new Map<string, EdgeWall>();
  const addEdge = (a: Coord, b: Coord) => {
    const edge = normalizeEdge(a, b);
    if (edge) map.set(edge.key, edge);
  };

  if (Array.isArray(rawWalls)) {
    for (const item of rawWalls) {
      if (Array.isArray(item) && item.length === 2 && isCoord(item[0]) && isCoord(item[1])) {
        addEdge(item[0], item[1]);
      } else if (
        Array.isArray(item) &&
        item.length === 4 &&
        item.every((n) => typeof n === "number")
      ) {
        addEdge([item[0], item[1]], [item[2], item[3]]);
      } else if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const pairA = obj.a ?? obj.from ?? obj.u ?? obj.cell1 ?? obj.start;
        const pairB = obj.b ?? obj.to ?? obj.v ?? obj.cell2 ?? obj.end;
        if (isCoord(pairA) && isCoord(pairB)) {
          addEdge(pairA, pairB);
        } else if (Array.isArray(obj.cells) && obj.cells.length === 2 && isCoord(obj.cells[0]) && isCoord(obj.cells[1])) {
          addEdge(obj.cells[0], obj.cells[1]);
        }
      }
    }
    return Array.from(map.values());
  }

  if (typeof rawWalls === "object") {
    const obj = rawWalls as Record<string, unknown>;
    const hMat = (obj.horizontal ?? obj.h ?? obj.h_walls) as unknown;
    const vMat = (obj.vertical ?? obj.v ?? obj.v_walls) as unknown;
    let parsedAnyMatrix = false;

    if (Array.isArray(hMat)) {
      parsedAnyMatrix = true;
      hMat.forEach((row, r) => {
        if (!Array.isArray(row)) return;
        row.forEach((val, c) => {
          if (val) addEdge([r, c], [r + 1, c]);
        });
      });
    }
    if (Array.isArray(vMat)) {
      parsedAnyMatrix = true;
      vMat.forEach((row, r) => {
        if (!Array.isArray(row)) return;
        row.forEach((val, c) => {
          if (val) addEdge([r, c], [r, c + 1]);
        });
      });
    }
    if (parsedAnyMatrix) {
      return Array.from(map.values());
    }
  }

  return null;
}

/**
 * 두 인접 칸 사이의 SVG 경계선 세그먼트 좌표를 계산한다.
 */
export function edgeToSegment(
  edge: EdgeWall,
  cellSize: number,
  originOffset: number,
): { x1: number; y1: number; x2: number; y2: number; midX: number; midY: number } {
  const [r1, c1] = edge.a;
  const [r2, c2] = edge.b;
  if (r1 === r2) {
    // 가로로 인접 -> 세로 경계선
    const x = originOffset + Math.max(c1, c2) * cellSize;
    const y1 = originOffset + r1 * cellSize;
    const y2 = y1 + cellSize;
    return { x1: x, y1, x2: x, y2, midX: x, midY: (y1 + y2) / 2 };
  }
  // 세로로 인접 -> 가로 경계선
  const y = originOffset + Math.max(r1, r2) * cellSize;
  const x1 = originOffset + c1 * cellSize;
  const x2 = x1 + cellSize;
  return { x1, y1: y, x2, y2: y, midX: (x1 + x2) / 2, midY: y };
}

export function extractEditEdges(edit: MazeEdit | null): {
  targetEdge: EdgeWall | null;
  fromEdge: EdgeWall | null;
  targetCell: Coord | null;
  fromCell: Coord | null;
} {
  if (!edit) {
    return { targetEdge: null, fromEdge: null, targetCell: null, fromCell: null };
  }
  const parseRef = (ref: unknown): { edge: EdgeWall | null; cell: Coord | null } => {
    if (isCoord(ref)) return { edge: null, cell: ref };
    if (Array.isArray(ref) && ref.length === 2 && isCoord(ref[0]) && isCoord(ref[1])) {
      return { edge: normalizeEdge(ref[0], ref[1]), cell: null };
    }
    if (ref && typeof ref === "object") {
      const obj = ref as Record<string, unknown>;
      const a = obj.a ?? obj.from ?? obj.u;
      const b = obj.b ?? obj.to ?? obj.v;
      if (isCoord(a) && isCoord(b)) {
        return { edge: normalizeEdge(a, b), cell: null };
      }
    }
    return { edge: null, cell: null };
  };

  const rawTarget = edit.pos ?? edit.wall ?? edit.edge ?? edit.to;
  const target = parseRef(rawTarget);
  const source = parseRef(edit.from);

  return {
    targetEdge: target.edge,
    fromEdge: source.edge,
    targetCell: target.cell,
    fromCell: source.cell,
  };
}

export function formatEditTarget(edit: MazeEdit | null, editType?: string | null): string {
  if (!edit) {
    if (editType === "add_wall") return "벽 추가";
    if (editType === "remove_wall") return "벽 제거";
    if (editType === "move_wall") return "벽 이동";
    return editType ?? "수정 없음";
  }

  const tag =
    edit.type === "add_wall"
      ? "벽 추가"
      : edit.type === "remove_wall"
        ? "벽 제거"
        : edit.type === "move_wall"
          ? "벽 이동"
          : edit.type === "add_trap"
            ? "함정 추가"
            : "함정 제거";

  const { targetEdge, fromEdge, targetCell, fromCell } = extractEditEdges(edit);
  if (targetEdge) {
    const tStr = `(${targetEdge.a[0]},${targetEdge.a[1]})↔(${targetEdge.b[0]},${targetEdge.b[1]})`;
    if (fromEdge) {
      const fStr = `(${fromEdge.a[0]},${fromEdge.a[1]})↔(${fromEdge.b[0]},${fromEdge.b[1]})`;
      return `${tag} ${fStr} → ${tStr}`;
    }
    return `${tag} ${tStr}`;
  }
  if (targetCell) {
    const tStr = `(${targetCell[0]},${targetCell[1]})`;
    if (fromCell) {
      return `${tag} (${fromCell[0]},${fromCell[1]}) → ${tStr}`;
    }
    return `${tag} ${tStr}`;
  }
  return tag;
}
