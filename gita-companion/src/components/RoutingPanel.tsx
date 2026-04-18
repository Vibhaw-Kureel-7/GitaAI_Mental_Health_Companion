import { useEffect, useState } from "react";
import type { RoutingResult } from "@/types";
import { findLlmMeta } from "@/types";

interface Props {
  routing: RoutingResult;
}

// ─────────────────────────────────────────────────────────────
//  RoutingPanel — shows which wisdom tradition was used
//
//  Removed: technical LLM identifiers, confidence %, vote counts.
//  Shows:   human-readable tradition names, animated score bars.
// ─────────────────────────────────────────────────────────────

export function RoutingPanel({ routing }: Props) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 60);
    return () => clearTimeout(t);
  }, []);

  // Sort highest score first
  const sorted = [...routing.scores].sort((a, b) => b.score - a.score);

  // Get the selected tradition name for the header
  const selectedMeta = findLlmMeta(routing.selectedKey);
  const selectedTradition = selectedMeta
    ? selectedMeta.tradition
    : routing.selectedKey;

  return (
    <div className="routing-panel">
      {/* Header: "Guided by  ·  Mindfulness" — no numbers, no jargon */}
      <div className="routing-panel-head">
        <span className="routing-panel-label">Guided by</span>
        <span
          className="routing-confidence-text"
          style={{ color: selectedMeta?.color ?? "var(--fog)" }}
        >
          {selectedTradition}
        </span>
      </div>

      <div className="routing-rows">
        {sorted.map((row, i) => {
          const meta = findLlmMeta(row.llmKey);
          const fillScale = animated ? row.pct / 100 : 0;

          // Human-readable name: e.g. "Dhyana" and "Mindfulness"
          const shortName = meta ? meta.shortName : row.llmKey;
          const tradition = meta ? meta.tradition : "";

          return (
            <div
              key={row.llmKey}
              className={`routing-row${row.selected ? " selected" : ""}`}
            >
              <div className="routing-row-top">
                <span className="routing-row-name">
                  {shortName}
                  {tradition && (
                    <span
                      style={{ color: "var(--fog)", fontWeight: 300 }}
                    >
                      {" "}&mdash; {tradition}
                    </span>
                  )}
                </span>

                {row.selected && (
                  <div className="routing-row-right">
                    <span className="routing-selected-tag">chosen</span>
                  </div>
                )}
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