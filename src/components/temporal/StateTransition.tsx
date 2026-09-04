"use client";

interface StateTransitionProps {
  currentState: string;
  velocityPerHour: number;
  momentum: number;
  crossHorizonDivergence: number;
  reversalRisk: number;
}

interface StateNode {
  id: string;
  label: string;
  color: string;
  activeColor: string;
}

const STATES: StateNode[] = [
  {
    id: "neutral",
    label: "Neutral",
    color: "bg-muted text-muted-foreground",
    activeColor: "bg-muted-foreground text-background",
  },
  {
    id: "expansion",
    label: "Expansion",
    color: "bg-blue-500/10 text-blue-500 border-blue-500/30",
    activeColor: "bg-blue-500 text-white",
  },
  {
    id: "trending",
    label: "Trending",
    color: "bg-accent-green/10 text-accent-green border-accent-green/30",
    activeColor: "bg-accent-green text-background",
  },
  {
    id: "deceleration",
    label: "Deceleration",
    color: "bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30",
    activeColor: "bg-accent-yellow text-background",
  },
  {
    id: "reversal",
    label: "Reversal",
    color: "bg-accent-red/10 text-accent-red border-accent-red/30",
    activeColor: "bg-accent-red text-background",
  },
];

function mapMarketStateToTransition(state: string): string {
  if (state === "neutral") return "neutral";
  if (state.includes("acceleration")) return "trending";
  if (state.includes("persistence")) return "expansion";
  if (state.includes("decay")) return "deceleration";
  if (state === "reversal-warning") return "reversal";
  if (state === "cross-horizon-conflict") return "deceleration";
  return "neutral";
}

export function StateTransition({
  currentState,
  velocityPerHour,
  momentum,
  crossHorizonDivergence,
  reversalRisk,
}: StateTransitionProps) {
  const activeId = mapMarketStateToTransition(currentState);
  const activeIndex = STATES.findIndex((s) => s.id === activeId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {STATES.map((state, i) => {
          const isActive = state.id === activeId;
          const isPast = i < activeIndex;

          return (
            <div key={state.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border transition-all ${
                    isActive
                      ? state.activeColor
                      : isPast
                      ? `${state.color} opacity-50`
                      : `${state.color} opacity-30`
                  }`}
                >
                  {i + 1}
                </div>
                <span
                  className={`text-[10px] mt-1 font-medium ${
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {state.label}
                </span>
              </div>
              {i < STATES.length - 1 && (
                <div className="flex items-center mx-1">
                  <div
                    className={`h-0.5 w-8 ${
                      i < activeIndex
                        ? "bg-foreground"
                        : i === activeIndex
                        ? "bg-foreground/50"
                        : "bg-muted/30"
                    }`}
                  />
                  {i < activeIndex && (
                    <div className="w-0 h-0 border-t-[3px] border-t-transparent border-b-[3px] border-b-transparent border-l-[5px] border-l-foreground" />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
        <div className="p-2 rounded bg-muted/20">
          <div className="text-[10px] text-muted-foreground">Velocity</div>
          <div
            className={`text-xs font-mono font-bold ${
              Math.abs(velocityPerHour) > 0.05
                ? "text-accent-yellow"
                : "text-muted-foreground"
            }`}
          >
            {Math.abs(velocityPerHour * 100).toFixed(1)}%/hr
          </div>
        </div>
        <div className="p-2 rounded bg-muted/20">
          <div className="text-[10px] text-muted-foreground">Momentum</div>
          <div
            className={`text-xs font-mono font-bold ${
              Math.abs(momentum) > 0.05
                ? "text-accent-yellow"
                : "text-muted-foreground"
            }`}
          >
            {(momentum * 100).toFixed(1)}pp
          </div>
        </div>
        <div className="p-2 rounded bg-muted/20">
          <div className="text-[10px] text-muted-foreground">Divergence</div>
          <div
            className={`text-xs font-mono font-bold ${
              crossHorizonDivergence > 0.1
                ? "text-orange-500"
                : "text-muted-foreground"
            }`}
          >
            {(crossHorizonDivergence * 100).toFixed(1)}pp
          </div>
        </div>
        <div className="p-2 rounded bg-muted/20">
          <div className="text-[10px] text-muted-foreground">Reversal Risk</div>
          <div
            className={`text-xs font-mono font-bold ${
              reversalRisk > 0.5
                ? "text-accent-red"
                : reversalRisk > 0.3
                ? "text-accent-yellow"
                : "text-muted-foreground"
            }`}
          >
            {(reversalRisk * 100).toFixed(0)}%
          </div>
        </div>
      </div>
    </div>
  );
}
