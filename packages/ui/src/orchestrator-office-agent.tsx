import type { OfficeAgent } from "./orchestrator-office-scene-data";

export function PixelPerson({ agent }: { readonly agent: OfficeAgent }) {
  const className = [
    "pixel-person-agent",
    agent.slotClass,
    agent.routeClass,
    agent.toneClass,
    agent.isLead ? "pixel-person-agent--lead" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <g
      className="pixel-person-agent__anchor"
      transform={`translate(${agent.x} ${agent.y})`}
    >
      <g className={className} data-testid="pixel-person-agent">
        <g
          aria-label={`${agent.label}, ${agent.station}`}
          data-testid={agent.testId}
        >
          <ellipse
            className="pixel-person-agent__shadow"
            cx="0"
            cy="2"
            rx="26"
            ry="8"
          />
          <path
            className="pixel-person-agent__desk-shadow"
            d="M-20 -2 0 -8 22 -2 0 4Z"
          />
          <rect
            className="pixel-person-agent__leg pixel-person-agent__leg--left"
            height="18"
            rx="3"
            width="8"
            x="-11"
            y="-16"
          />
          <rect
            className="pixel-person-agent__leg pixel-person-agent__leg--right"
            height="18"
            rx="3"
            width="8"
            x="3"
            y="-16"
          />
          <rect
            className="pixel-person-agent__body"
            height="32"
            rx="9"
            width="34"
            x="-17"
            y="-44"
          />
          <rect
            className="pixel-person-agent__arm pixel-person-agent__arm--left"
            height="18"
            rx="5"
            width="10"
            x="-26"
            y="-38"
          />
          <rect
            className="pixel-person-agent__arm pixel-person-agent__arm--right"
            height="18"
            rx="5"
            width="10"
            x="16"
            y="-38"
          />
          <circle className="pixel-person-agent__head" cx="0" cy="-60" r="16" />
          <path
            className="pixel-person-agent__hair"
            d="M-14 -62 Q-2 -80 15 -66 L15 -56 L-14 -56 Z"
          />
          <circle
            className="pixel-person-agent__eye pixel-person-agent__eye--left"
            cx="-6"
            cy="-60"
            r="2"
          />
          <circle
            className="pixel-person-agent__eye pixel-person-agent__eye--right"
            cx="7"
            cy="-60"
            r="2"
          />
          <text
            className="pixel-person-agent__initial"
            textAnchor="middle"
            x="0"
            y="-24"
          >
            {agent.shortLabel}
          </text>
          <text
            className="pixel-person-agent__label"
            textAnchor="middle"
            x="0"
            y="-92"
          >
            {agent.label}
          </text>
          <text
            className="pixel-person-agent__station"
            textAnchor="middle"
            x="0"
            y="-78"
          >
            {agent.isLead ? agent.role : agent.station}
          </text>
        </g>
      </g>
    </g>
  );
}
