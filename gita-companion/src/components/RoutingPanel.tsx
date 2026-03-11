import { useEffect, useState } from "react";
import type { RoutingResult } from "@/types";
import { LLM_META } from "@/types";

interface Props {
  routing: RoutingResult;
}

// ─────────────────────────────────────────────────────────────
//  RoutingPanel — animated confidence score bars
// ─────────────────────────────────────────────────────────────

export function RoutingPanel({ routing }: Props) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 60);
    return () => clearTimeout(t);
  }, []);

  const sorted = [...routing.scores].sort((a, b) => b.score - a.score);

  return (
    <div className="routing-panel">
      <div className="routing-panel-head">
        <span className="routing-panel-label">Routing</span>
        <span className="routing-confidence-text">
          {routing.confidence}% confidence &nbsp;&middot;&nbsp; {routing.votes}/{routing.totalVotes} votes
        </span>
      </div>

      <div className="routing-rows">
        {sorted.map((row, i) => {
          const meta = LLM_META[row.llmKey];
          const fillScale = animated ? row.pct / 100 : 0;

          return (
            <div
              key={row.llmKey}
              className={`routing-row${row.selected ? " selected" : ""}`}
            >
              <div className="routing-row-top">
                <span className="routing-row-name">
                  {meta ? meta.shortName : row.llmKey}
                  {meta && (
                    <span style={{ color: "var(--fog)", fontWeight: 300 }}>
                      {" "}
                      &mdash; {meta.tradition}
                    </span>
                  )}
                </span>

                <div className="routing-row-right">
                  {row.selected && (
                    <span className="routing-selected-tag">selected</span>
                  )}
                  <span className="routing-row-pct">
                    {row.pct.toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{
                    transform: `scaleX(${fillScale})`,
                    transitionDelay: `${i * 55}ms`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
