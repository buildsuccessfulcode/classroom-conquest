"use client";

import { useEffect, useRef, useState } from "react";
import { useBoardWalk } from "@/hooks/useBoardWalk";
import { teamAbbreviation } from "@/lib/game";
import type { BoardConfig, BoardLink, Move, Team } from "@/lib/types";
import Avatar from "./Avatar";

type Point = { x: number; y: number };

function boardGeometry(goal: number) {
  const columns = goal <= 30 ? 6 : 10;
  const rows = Math.ceil(goal / columns);
  return { columns, rows, total: columns * rows };
}

function tileToCell(tile: number, columns: number, rows: number) {
  const index = Math.max(0, tile - 1);
  const rowFromBottom = Math.floor(index / columns);
  const posInRow = index % columns;
  const col = rowFromBottom % 2 === 0 ? posInRow : columns - 1 - posInRow;
  return { row: rows - 1 - rowFromBottom, col };
}

function center(tile: number, columns: number, rows: number) {
  const cell = tileToCell(tile, columns, rows);
  return { x: cell.col + 0.5, y: cell.row + 0.5 };
}

function motionPoint(tile: number, columns: number, rows: number) {
  if (tile <= 0) {
    return { x: 0.5, y: rows + 0.35 };
  }
  return center(tile, columns, rows);
}

function direction(from: Point, to: Point) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  return { dx, dy, length, nx: -dy / length, ny: dx / length };
}

function ladderRails(from: Point, to: Point) {
  const { nx, ny, length } = direction(from, to);
  const offset = 0.1;
  return {
    left: {
      from: { x: from.x + nx * offset, y: from.y + ny * offset },
      to: { x: to.x + nx * offset, y: to.y + ny * offset },
    },
    right: {
      from: { x: from.x - nx * offset, y: from.y - ny * offset },
      to: { x: to.x - nx * offset, y: to.y - ny * offset },
    },
    rungs: Math.max(2, Math.round(length / 0.28)),
  };
}

function snakePoints(from: Point, to: Point): Point[] {
  const { dx, dy, length, nx, ny } = direction(from, to);
  const amplitude = Math.min(0.3, Math.max(0.12, length * 0.1));
  const waves = length > 3.5 ? 3 : 2;
  const segments = Math.max(12, Math.round(length * 4));
  const points: Point[] = [];
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const wobble =
      Math.sin(t * Math.PI * waves) * amplitude * Math.sin(Math.PI * t);
    points.push({
      x: from.x + dx * t + nx * wobble,
      y: from.y + dy * t + ny * wobble,
    });
  }
  return points;
}

function smoothPath(points: Point[]): string {
  if (points.length < 2) return "";
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] ?? p2;
    const c1 = {
      x: p1.x + (p2.x - p0.x) / 6,
      y: p1.y + (p2.y - p0.y) / 6,
    };
    const c2 = {
      x: p2.x - (p3.x - p1.x) / 6,
      y: p2.y - (p3.y - p1.y) / 6,
    };
    path += ` C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
  }
  return path;
}

function Pawn({
  team,
  size,
  highlightTeamId,
}: {
  team: Team;
  size: number;
  highlightTeamId?: string;
}) {
  return (
    <span className="group relative z-20 inline-flex">
      <Avatar
        id={team.avatar}
        size={size}
        ringColor={team.color_code}
        className={team.id === highlightTeamId ? "ring-2 ring-ocean" : ""}
      />
      <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-snow opacity-0 shadow-md transition-opacity duration-100 group-hover:opacity-100">
        {teamAbbreviation(team.team_name)}
      </span>
    </span>
  );
}

function TileTeams({
  teams,
  size,
  tile,
  mini,
  placement,
  highlightTeamId,
}: {
  teams: Team[];
  size: number;
  tile: number;
  mini: boolean;
  placement: "above" | "below";
  highlightTeamId?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const maxVisible = mini ? 2 : 3;
  const visible = teams.slice(0, maxVisible);
  const hidden = teams.length - visible.length;
  const preview = teams.slice(0, 4);
  const abbreviations = `${preview
    .map((team) => teamAbbreviation(team.team_name))
    .join(" · ")}${teams.length > preview.length ? ` +${teams.length - preview.length}` : ""}`;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="group relative z-20 inline-flex">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={`${teams.length} tim di petak ${tile}. Ketuk untuk melihat daftar.`}
        className="relative inline-flex cursor-pointer items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-1"
      >
        <span className="flex items-center">
          {visible.map((team, index) => (
            <span
              key={team.id}
              className="relative inline-flex"
              style={{
                marginLeft: index === 0 ? 0 : -Math.round(size * 0.35),
                zIndex: visible.length - index,
              }}
            >
              <Avatar
                id={team.avatar}
                size={size}
                ringColor={team.color_code}
                className={
                  team.id === highlightTeamId ? "ring-2 ring-ocean" : ""
                }
              />
            </span>
          ))}
        </span>
        {hidden > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[9px] font-extrabold text-snow ring-2 ring-white">
            +{hidden}
          </span>
        ) : null}
        {!open ? (
          <span className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-1.5 max-w-[180px] -translate-x-1/2 whitespace-normal rounded-lg bg-ink px-2 py-1 text-center text-[10px] font-extrabold leading-tight tracking-wide text-snow opacity-0 shadow-md transition-opacity duration-100 group-hover:opacity-100">
            {abbreviations}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          className={[
            "absolute left-1/2 z-50 w-max max-w-[200px] -translate-x-1/2 rounded-xl border-2 border-cloud bg-white p-1.5 shadow-xl",
            placement === "below" ? "top-full mt-1.5" : "bottom-full mb-1.5",
          ].join(" ")}
        >
          <p className="mb-1 px-1 text-[9px] font-extrabold uppercase tracking-wide text-ink-soft">
            {teams.length} tim di petak {tile}
          </p>
          <ul className="cc-scrollbar flex max-h-36 flex-col gap-0.5 overflow-y-auto">
            {teams.map((team) => (
              <li
                key={team.id}
                className={[
                  "flex items-center gap-1.5 rounded-lg px-1 py-0.5",
                  team.id === highlightTeamId ? "bg-ocean-soft" : "",
                ].join(" ")}
              >
                <Avatar
                  id={team.avatar}
                  size={18}
                  ringColor={team.color_code}
                />
                <span className="max-w-[130px] truncate text-[11px] font-extrabold text-ink">
                  {team.team_name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function LadderMark({ mini }: { mini: boolean }) {
  return (
    <span
      className={[
        "absolute right-1 top-1 flex items-center justify-center rounded-full border bg-white text-brand-dark shadow-sm",
        mini ? "h-4 w-4" : "h-5 w-5",
      ].join(" ")}
      title="Kaki tangga"
    >
      <svg
        viewBox="0 0 12 12"
        className={mini ? "h-2.5 w-2.5" : "h-3 w-3"}
        aria-hidden="true"
      >
        <path
          d="M3.5 2v8M8.5 2v8M3.5 4h5M3.5 6h5M3.5 8h5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

function SnakeMark({ mini }: { mini: boolean }) {
  return (
    <span
      className={[
        "absolute right-1 top-1 flex items-center justify-center rounded-full border bg-white text-cherry-dark shadow-sm",
        mini ? "h-4 w-4" : "h-5 w-5",
      ].join(" ")}
      title="Kepala ular"
    >
      <svg
        viewBox="0 0 12 12"
        className={mini ? "h-2.5 w-2.5" : "h-3 w-3"}
        aria-hidden="true"
      >
        <path
          d="M3.5 9.5c0-1.8 1.8-1.8 2.5-1.8s2.5 0 2.5-1.8-1.8-1.8-2.5-1.8-2.5 0-2.5-1.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <circle cx="3.5" cy="2.5" r="1.1" fill="currentColor" />
      </svg>
    </span>
  );
}

function Ladder({
  link,
  columns,
  rows,
}: {
  link: BoardLink;
  columns: number;
  rows: number;
}) {
  const from = center(link.from, columns, rows);
  const to = center(link.to, columns, rows);
  const { left, right, rungs } = ladderRails(from, to);
  return (
    <g>
      <line
        x1={left.from.x}
        y1={left.from.y}
        x2={left.to.x}
        y2={left.to.y}
        stroke="url(#ladderStroke)"
        strokeWidth={0.075}
        strokeLinecap="round"
      />
      <line
        x1={right.from.x}
        y1={right.from.y}
        x2={right.to.x}
        y2={right.to.y}
        stroke="url(#ladderStroke)"
        strokeWidth={0.075}
        strokeLinecap="round"
      />
      {Array.from({ length: rungs }, (_, index) => {
        const t = (index + 0.5) / rungs;
        const a = {
          x: left.from.x + (left.to.x - left.from.x) * t,
          y: left.from.y + (left.to.y - left.from.y) * t,
        };
        const b = {
          x: right.from.x + (right.to.x - right.from.x) * t,
          y: right.from.y + (right.to.y - right.from.y) * t,
        };
        return (
          <line
            key={`rung-${index}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="#BBF7D0"
            strokeWidth={0.05}
            strokeLinecap="round"
          />
        );
      })}
    </g>
  );
}

function Snake({
  link,
  columns,
  rows,
}: {
  link: BoardLink;
  columns: number;
  rows: number;
}) {
  const from = center(link.from, columns, rows);
  const to = center(link.to, columns, rows);
  const points = snakePoints(from, to);
  const path = smoothPath(points);
  const head = points[0];
  const neck = points[1];
  const { nx, ny, dx, dy, length } = direction(head, neck);
  const outwardX = -dx / length;
  const outwardY = -dy / length;
  const eyeOffset = 0.055;
  const tongueStart = {
    x: head.x + outwardX * 0.1,
    y: head.y + outwardY * 0.1,
  };
  const tongueEnd = {
    x: head.x + outwardX * 0.24,
    y: head.y + outwardY * 0.24,
  };
  const fork = 0.05;
  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke="url(#snakeStroke)"
        strokeWidth={0.17}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={path}
        fill="none"
        stroke="#FEE2E2"
        strokeWidth={0.06}
        strokeLinecap="round"
        strokeDasharray="0.07 0.09"
        opacity={0.9}
      />
      <path
        d={`M ${tongueStart.x} ${tongueStart.y} L ${tongueEnd.x} ${tongueEnd.y} M ${tongueEnd.x} ${tongueEnd.y} L ${
          tongueEnd.x + nx * fork + outwardX * fork
        } ${tongueEnd.y + ny * fork + outwardY * fork} M ${tongueEnd.x} ${
          tongueEnd.y
        } L ${tongueEnd.x - nx * fork + outwardX * fork} ${
          tongueEnd.y - ny * fork + outwardY * fork
        }`}
        fill="none"
        stroke="#B91C1C"
        strokeWidth={0.028}
        strokeLinecap="round"
      />
      <circle cx={head.x} cy={head.y} r={0.17} fill="url(#snakeStroke)" />
      <circle
        cx={head.x + nx * eyeOffset + outwardX * 0.03}
        cy={head.y + ny * eyeOffset + outwardY * 0.03}
        r={0.05}
        fill="#FFFFFF"
      />
      <circle
        cx={head.x - nx * eyeOffset + outwardX * 0.03}
        cy={head.y - ny * eyeOffset + outwardY * 0.03}
        r={0.05}
        fill="#FFFFFF"
      />
      <circle
        cx={head.x + nx * eyeOffset + outwardX * 0.04}
        cy={head.y + ny * eyeOffset + outwardY * 0.04}
        r={0.022}
        fill="#7F1D1D"
      />
      <circle
        cx={head.x - nx * eyeOffset + outwardX * 0.04}
        cy={head.y - ny * eyeOffset + outwardY * 0.04}
        r={0.022}
        fill="#7F1D1D"
      />
    </g>
  );
}

export default function SnakesBoard({
  config,
  teams,
  moves = [],
  variant = "full",
  highlightTeamId,
  paused = false,
  enabled = true,
  onWalkStart,
  onWalkEnd,
  className = "",
}: {
  config: BoardConfig;
  teams: Team[];
  moves?: Move[];
  variant?: "full" | "mini";
  highlightTeamId?: string;
  paused?: boolean;
  enabled?: boolean;
  onWalkStart?: (teamId: string) => void;
  onWalkEnd?: (teamId: string, move: Move) => void;
  className?: string;
}) {
  const goal = Math.max(1, config.goal);
  const { columns, rows, total } = boardGeometry(goal);
  const mini = variant === "mini";
  const pawnSize = mini ? 18 : columns >= 10 ? 20 : 30;
  const motions = useBoardWalk({
    teams,
    moves,
    config,
    paused,
    enabled,
    onWalkStart,
    onWalkEnd,
  });
  const animatedIds = new Set(Object.keys(motions));

  const cells: (number | null)[] = Array(total).fill(null);
  for (let tile = 1; tile <= goal; tile += 1) {
    const cell = tileToCell(tile, columns, rows);
    cells[cell.row * columns + cell.col] = tile;
  }

  const ladderBases = new Set(config.ladders.map((link) => link.from));
  const snakeHeads = new Set(config.snakes.map((link) => link.from));
  const atStart = teams.filter(
    (team) =>
      !animatedIds.has(team.id) && team.position <= 0 && !team.finished_at,
  );
  const onTile = new Map<number, Team[]>();
  for (const team of teams) {
    if (animatedIds.has(team.id)) continue;
    if (team.position <= 0) continue;
    const list = onTile.get(team.position);
    if (list) list.push(team);
    else onTile.set(team.position, [team]);
  }
  return (
    <div className={`w-full ${className}`}>
      <div className="relative">
        <div
          className="grid w-full"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {cells.map((tile, index) => {
            if (tile === null) {
              return (
                <span key={`empty-${index}`} className="m-0.5 aspect-square" />
              );
            }
            const solvers = onTile.get(tile) ?? [];
            const isFinish = tile === goal;
            const isMine = solvers.some((team) => team.id === highlightTeamId);
            return (
              <div
                key={tile}
                className={[
                  "relative m-0.5 flex aspect-square flex-col items-center justify-between rounded-lg border-2 p-0.5",
                  isFinish
                    ? "border-sun-dark bg-sun-soft"
                    : isMine
                      ? "border-ocean bg-ocean-soft"
                      : "border-cloud bg-white",
                ].join(" ")}
              >
                <span
                  className={[
                    "w-full text-left font-mono font-extrabold leading-none",
                    mini ? "text-[8px]" : "text-[10px]",
                    isFinish ? "text-sun-dark" : "text-ink-soft",
                  ].join(" ")}
                >
                  {tile}
                  {isFinish ? " FIN" : ""}
                </span>
                {ladderBases.has(tile) ? (
                  <LadderMark mini={mini} />
                ) : snakeHeads.has(tile) ? (
                  <SnakeMark mini={mini} />
                ) : null}
                <div className="flex w-full items-center justify-center">
                  {solvers.length > 0 ? (
                    <TileTeams
                      teams={solvers}
                      size={pawnSize}
                      tile={tile}
                      mini={mini}
                      placement={
                        Math.floor(index / columns) < rows / 2
                          ? "below"
                          : "above"
                      }
                      highlightTeamId={highlightTeamId}
                    />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <svg
          viewBox={`0 0 ${columns} ${rows}`}
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id="ladderStroke"
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1={rows}
              x2="0"
              y2="0"
            >
              <stop offset="0%" stopColor="#15803D" />
              <stop offset="100%" stopColor="#4ADE80" />
            </linearGradient>
            <linearGradient
              id="snakeStroke"
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2="0"
              y2={rows}
            >
              <stop offset="0%" stopColor="#B91C1C" />
              <stop offset="100%" stopColor="#F87171" />
            </linearGradient>
          </defs>
          {config.snakes.map((link) => (
            <Snake
              key={`snake-${link.from}`}
              link={link}
              columns={columns}
              rows={rows}
            />
          ))}
          {config.ladders.map((link) => (
            <Ladder
              key={`ladder-${link.from}`}
              link={link}
              columns={columns}
              rows={rows}
            />
          ))}
        </svg>

        <div className="pointer-events-none absolute inset-0 z-30">
          {Object.entries(motions).map(([teamId, motion]) => {
            const team = teams.find((item) => item.id === teamId);
            if (!team) return null;
            const point = motionPoint(motion.tile, columns, rows);
            return (
              <div
                key={teamId}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${(point.x / columns) * 100}%`,
                  top: `${(point.y / rows) * 100}%`,
                  transitionProperty: "left, top",
                  transitionDuration: `${motion.durationMs}ms`,
                  transitionTimingFunction: motion.sliding
                    ? "ease-in-out"
                    : "ease-out",
                }}
              >
                <span
                  className={[
                    "inline-flex",
                    motion.durationMs > 0 && !motion.sliding
                      ? "cc-walk-hop"
                      : "",
                  ].join(" ")}
                >
                  <Avatar
                    id={team.avatar}
                    size={pawnSize}
                    ringColor={team.color_code}
                    className={
                      team.id === highlightTeamId ? "ring-2 ring-ocean" : ""
                    }
                  />
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {atStart.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-2xl border-2 border-dashed border-cloud bg-snow px-2 py-1.5">
          <span className="text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">
            Garis mulai
          </span>
          {atStart.map((team) => (
            <Pawn
              key={team.id}
              team={team}
              size={pawnSize}
              highlightTeamId={highlightTeamId}
            />
          ))}
        </div>
      ) : null}

      {mini ? null : (
        <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] font-bold text-ink-soft">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-5 rounded-full bg-brand" />
            Tangga naik
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-5 rounded-full bg-cherry" />
            Ular turun
          </span>
          <span>Efek aktif hanya jika berhenti tepat di petak.</span>
        </div>
      )}
    </div>
  );
}
