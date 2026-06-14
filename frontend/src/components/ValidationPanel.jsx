import React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";

export function ValidationPanel({ result, onJump }) {
  if (!result) {
    return (
      <div className="p-4 text-xs text-muted-foreground">Validating...</div>
    );
  }
  const { errors = [], warnings = [], valid } = result;
  const total = errors.length + warnings.length;

  return (
    <div className="h-full flex flex-col" data-testid="validation-panel">
      <div className="border-b border-border px-3 py-2 flex items-center justify-between bg-card shrink-0">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Validation</div>
        {valid ? (
          <span className="flex items-center gap-1 text-xs validation-ok" data-testid="validation-status-ok">
            <CheckCircle2 className="h-3.5 w-3.5" /> Ready
          </span>
        ) : (
          <span className="text-xs validation-error" data-testid="validation-status-error">{errors.length} errors</span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {total === 0 ? (
          <div className="p-4 text-xs text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>All checks pass. Ready to export.</span>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {errors.map((err, i) => (
              <li
                key={`e-${i}`}
                onClick={() => onJump && onJump(err.field)}
                data-testid={`validation-error-${i}`}
                className="px-3 py-2.5 text-xs hover:bg-secondary/50 cursor-pointer flex items-start gap-2"
              >
                <AlertCircle className="h-3.5 w-3.5 validation-error mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="validation-error font-medium">{err.message}</div>
                  <div className="text-muted-foreground font-mono text-[10px] mt-0.5 truncate">{err.field}</div>
                </div>
              </li>
            ))}
            {warnings.map((w, i) => (
              <li
                key={`w-${i}`}
                onClick={() => onJump && onJump(w.field)}
                data-testid={`validation-warning-${i}`}
                className="px-3 py-2.5 text-xs hover:bg-secondary/50 cursor-pointer flex items-start gap-2"
              >
                <AlertTriangle className="h-3.5 w-3.5 validation-warning mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="validation-warning font-medium">{w.message}</div>
                  <div className="text-muted-foreground font-mono text-[10px] mt-0.5 truncate">{w.field}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="border-t border-border px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground bg-card shrink-0 flex justify-between">
        <span>{errors.length} errors</span>
        <span>{warnings.length} warnings</span>
      </div>
    </div>
  );
}
