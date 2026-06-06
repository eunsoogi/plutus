import { PixelPerson } from "./orchestrator-office-agent";
import type { AgentSlot, OfficeAgent } from "./orchestrator-office-scene-data";

function DeskTop({ slot }: { readonly slot: AgentSlot }) {
  return (
    <g
      className="pixel-office__desk"
      data-testid="pixel-office-desk"
      transform={`translate(${slot.deskX} ${slot.deskY})`}
    >
      <polygon
        className="pixel-office__desk-top"
        points="0,0 114,-40 188,-3 74,42"
      />
      <polygon
        className="pixel-office__monitor"
        points="88,-16 132,-31 154,-18 108,-4"
      />
      <polygon
        className="pixel-office__monitor-glow"
        points="96,-11 130,-22 146,-13 112,-1"
      />
      <polygon
        className="pixel-office__keyboard"
        points="90,12 136,-2 158,10 112,26"
      />
      <polygon
        className="pixel-office__desk-tray"
        points="14,8 70,-10 94,2 38,24"
      />
      <text className="pixel-office__station-label" x="52" y="34">
        {slot.station}
      </text>
    </g>
  );
}

function DeskFront({ slot }: { readonly slot: AgentSlot }) {
  return (
    <g transform={`translate(${slot.deskX} ${slot.deskY})`}>
      <polygon
        className="pixel-office__desk-front"
        points="0,0 74,42 74,84 0,40"
      />
      <polygon
        className="pixel-office__desk-side"
        points="74,42 188,-3 188,39 74,84"
      />
      <polygon
        className="pixel-office__desk-trim"
        points="0,40 74,84 188,39 112,8"
      />
    </g>
  );
}

function RoomShell() {
  return (
    <g
      className="pixel-office__room-shell"
      data-testid="pixel-office-room-shell"
    >
      <polygon
        className="pixel-office__back-wall"
        points="164,92 832,44 1038,156 370,214"
      />
      <polygon
        className="pixel-office__right-wall"
        points="1038,156 1092,204 1104,508 1014,456"
      />
      <polygon
        className="pixel-office__floor"
        data-testid="orchestrator-office-floor"
        points="164,148 832,96 1038,254 296,646"
      />
      <polygon
        className="pixel-office__front-lip"
        points="296,646 1038,254 1104,508 380,712"
      />
      <path
        className="pixel-office__floor-board"
        d="M264 164 1014 364M220 228 970 410M182 290 922 454M330 608 980 286M410 562 1012 260M492 516 958 210"
      />
      <path
        className="pixel-office__aisle"
        d="M572 176 724 274 646 324 760 394 564 516 452 566"
      />
    </g>
  );
}

function SideRooms() {
  return (
    <>
      <g
        className="pixel-office__side-room pixel-office__side-room--analysis"
        data-testid="pixel-office-side-room"
      >
        <polygon
          className="pixel-office__side-room-floor"
          points="724,282 964,188 1012,322 778,432"
        />
        <polygon
          className="pixel-office__side-room-wall"
          points="964,188 1038,156 1048,262 972,298"
        />
        <polygon
          className="pixel-office__equipment pixel-office__equipment--rack"
          points="866,234 916,216 942,232 890,252"
        />
        <polygon
          className="pixel-office__equipment pixel-office__equipment--tower"
          points="896,224 938,210 940,292 896,314"
        />
        <polygon
          className="pixel-office__equipment pixel-office__equipment--terminal"
          points="760,356 838,324 874,344 794,380"
        />
      </g>
      <g
        className="pixel-office__side-room pixel-office__side-room--lounge"
        data-testid="pixel-office-side-room"
      >
        <polygon
          className="pixel-office__lounge-rug"
          points="346,412 516,350 670,422 494,500"
        />
        <polygon
          className="pixel-office__sofa pixel-office__sofa--blue"
          points="364,402 438,374 470,390 394,422"
        />
        <polygon
          className="pixel-office__sofa pixel-office__sofa--rose"
          points="530,452 612,420 646,438 560,474"
        />
        <polygon
          className="pixel-office__coffee-table"
          points="446,438 528,406 564,424 482,458"
        />
      </g>
    </>
  );
}

function Fixtures() {
  return (
    <>
      <g
        className="pixel-office__whiteboard"
        data-testid="pixel-office-whiteboard"
        transform="translate(232 114)"
      >
        <polygon points="0,0 160,-20 160,56 0,72" />
        <path d="M22 18 112 8M24 38 132 24M24 56 94 44" />
      </g>
      <g className="pixel-office__glass-pod">
        <polygon
          className="pixel-office__glass-pod-floor"
          points="560,184 676,136 786,194 668,244"
        />
        <polygon
          className="pixel-office__glass-pod-wall"
          points="676,136 786,194 786,270 676,214"
        />
        <polygon
          className="pixel-office__glass-pod-wall"
          points="560,184 676,136 676,214 560,260"
        />
      </g>
      <g className="pixel-office__conference">
        <ellipse
          className="pixel-office__conference-table"
          cx="640"
          cy="324"
          rx="102"
          ry="48"
        />
        <ellipse
          className="pixel-office__chair"
          cx="534"
          cy="332"
          rx="22"
          ry="16"
        />
        <ellipse
          className="pixel-office__chair"
          cx="744"
          cy="316"
          rx="22"
          ry="16"
        />
        <ellipse
          className="pixel-office__chair"
          cx="640"
          cy="266"
          rx="20"
          ry="14"
        />
      </g>
    </>
  );
}

function CommandTable() {
  return (
    <g
      className="pixel-office__command-table"
      data-testid="pixel-office-command-table"
      transform="translate(520 392)"
    >
      <polygon
        className="pixel-office__command-rug"
        points="-152,-46 26,-104 188,-20 12,64"
      />
      <polygon
        className="pixel-office__command-top"
        points="-78,-28 38,-68 142,-18 28,30"
      />
      <polygon
        className="pixel-office__command-front"
        points="-78,-28 28,30 28,82 -78,24"
      />
      <polygon
        className="pixel-office__command-side"
        points="28,30 142,-18 142,36 28,82"
      />
      <polygon
        className="pixel-office__command-screen"
        points="52,-46 102,-62 132,-46 80,-30"
      />
    </g>
  );
}

export function OrchestratorOfficeMap({
  agents,
  deskSlots,
}: {
  readonly agents: readonly OfficeAgent[];
  readonly deskSlots: readonly AgentSlot[];
}) {
  const desks = [...deskSlots].sort((left, right) => left.feetY - right.feetY);
  const officeAgents = [...agents].sort((left, right) => left.y - right.y);

  return (
    <svg
      aria-hidden="true"
      className="pixel-office__map"
      data-testid="pixel-agent-office"
      preserveAspectRatio="xMidYMid meet"
      viewBox="0 0 1200 760"
    >
      <defs>
        <linearGradient id="plutus-office-floor" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#f6e7ce" />
          <stop offset="54%" stopColor="#d9c49f" />
          <stop offset="100%" stopColor="#b69067" />
        </linearGradient>
        <linearGradient id="plutus-office-wall" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#b88d7f" />
          <stop offset="100%" stopColor="#715450" />
        </linearGradient>
      </defs>
      <RoomShell />
      <SideRooms />
      <Fixtures />
      {desks.map((slot) => (
        <DeskTop key={`${slot.slotClass}-top`} slot={slot} />
      ))}
      <CommandTable />
      {desks.map((slot) => (
        <path
          className={`pixel-agent-motion-path ${slot.pathClass}`}
          data-testid="pixel-agent-motion-path"
          d={slot.pathD}
          key={`${slot.slotClass}-motion-path`}
        />
      ))}
      {officeAgents.map((agent) => (
        <PixelPerson agent={agent} key={agent.id} />
      ))}
      {desks.map((slot) => (
        <DeskFront key={`${slot.slotClass}-front`} slot={slot} />
      ))}
    </svg>
  );
}
