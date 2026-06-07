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
            rx="24"
            ry="8"
          />
          <rect
            className="pixel-person-agent__leg pixel-person-agent__leg--left"
            height="18"
            width="8"
            x="-10"
            y="-16"
          />
          <rect
            className="pixel-person-agent__leg pixel-person-agent__leg--right"
            height="18"
            width="8"
            x="2"
            y="-16"
          />
          <rect
            className="pixel-person-agent__body"
            height="30"
            width="34"
            x="-17"
            y="-46"
          />
          <rect
            className="pixel-person-agent__arm pixel-person-agent__arm--left"
            height="12"
            width="10"
            x="-25"
            y="-40"
          />
          <rect
            className="pixel-person-agent__arm pixel-person-agent__arm--right"
            height="12"
            width="10"
            x="15"
            y="-40"
          />
          <rect
            className="pixel-person-agent__head"
            height="22"
            width="24"
            x="-12"
            y="-68"
          />
          <path
            className="pixel-person-agent__hair"
            d="M-12 -68 H12 V-60 H8 V-56 H-6 V-60 H-12 Z"
          />
          <circle
            className="pixel-person-agent__eye pixel-person-agent__eye--left"
            cx="-5"
            cy="-58"
            r="1.8"
          />
          <circle
            className="pixel-person-agent__eye pixel-person-agent__eye--right"
            cx="6"
            cy="-58"
            r="1.8"
          />
          <text
            className="pixel-person-agent__initial"
            textAnchor="middle"
            x="0"
            y="-26"
          >
            {agent.shortLabel}
          </text>
          <text
            className="pixel-person-agent__label"
            textAnchor="middle"
            x="0"
            y="-90"
          >
            {agent.label}
          </text>
          <text
            className="pixel-person-agent__station"
            textAnchor="middle"
            x="0"
            y="-76"
          >
            {agent.isLead ? agent.role : agent.station}
          </text>
        </g>
      </g>
    </g>
  );
}
