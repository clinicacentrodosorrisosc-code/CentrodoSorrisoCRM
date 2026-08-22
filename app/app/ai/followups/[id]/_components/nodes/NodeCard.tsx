"use client";
import { Handle, Position, useReactFlow } from "@xyflow/react";

import type { FlowBranch } from "@/lib/followup/graph-schema";
import { rotuloDoRamo } from "@/lib/followup/rotulo-do-ramo";
import { Trash } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";
import type { NodeVisual } from "./nodeVisuals";

interface Props {
  id: string;
  visual: NodeVisual;
  label: string;
  subtitle: string;
  selected?: boolean;
  errors?: string[];
  showTarget?: boolean;
  showSource?: boolean;
  branches?: FlowBranch[];
}

export function NodeCard({
  id,
  visual,
  label,
  subtitle,
  selected,
  errors,
  showTarget = true,
  showSource = true,
  branches,
}: Props) {
  const { deleteElements } = useReactFlow();
  const Icon = visual.icon;
  const hasError = (errors?.length ?? 0) > 0;
  const branchRows = branches !== undefined && branches.length > 1 ? branches : null;

  return (
    <div
      className={cn(
        "group relative w-56 rounded-md border border-l-4 border-border bg-surface shadow-sm transition-shadow",
        visual.borderClassName,
        selected && "ring-2 ring-accent-500 ring-offset-1 ring-offset-bg",
        hasError && "border-error ring-2 ring-error ring-offset-1 ring-offset-bg",
      )}
      data-testid={`node-card-${id}`}
      title={hasError ? errors!.join("; ") : undefined}
    >
      {showTarget && <Handle type="target" position={Position.Top} />}
      <div className="flex items-center gap-2 px-3 py-2">
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
            visual.chipClassName,
          )}
        >
          <Icon size={14} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text">{label}</p>
          <p className="truncate text-xs text-text-muted">{subtitle}</p>
        </div>
        {visual.type !== "trigger" && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              deleteElements({ nodes: [{ id }] });
            }}
            className="opacity-0 group-hover:opacity-100 hover:text-destructive text-muted-foreground p-1 transition-opacity rounded hover:bg-destructive/10"
            title="Excluir este nó"
            aria-label="Excluir este nó"
          >
            <Trash size={13} />
          </button>
        )}
      </div>
      {hasError && (
        <p
          className="border-t border-error/30 px-3 py-1.5 text-xs leading-snug text-error-fg"
          data-testid={`node-error-${id}`}
        >
          {errors![0]}
        </p>
      )}
      {branchRows !== null && (
        <ul className="border-t border-border" data-testid={`node-branches-${id}`}>
          {branchRows.map((branch) => (
            <li
              key={branch.id}
              className={cn(
                "relative flex items-center gap-1.5 border-t border-border/60 px-3 py-1 first:border-t-0",
                // A saída de escape é a única que não veio de uma regra do usuário:
                // fica em itálico e apagada para se ler como "o resto cai aqui".
                branch.kind === "fallback" && "italic text-text-muted",
              )}
              data-testid={`node-branch-${id}-${branch.id}`}
              title={rotuloDoRamo(branch)}
            >
              <span
                aria-hidden
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  branch.kind === "fallback" ? "bg-text-muted/50" : "bg-accent-500",
                )}
              />
              <span className="truncate text-xs leading-tight">{rotuloDoRamo(branch)}</span>
              <Handle
                type="source"
                id={branch.id}
                position={Position.Right}
                // Uma bolinha por LINHA: a saída sai ao lado do seu próprio rótulo,
                // que é o que torna "qual aresta sai de qual regra" visível. No
                // rodapé elas ficariam lado a lado, sem espaço para nome nenhum.
                style={{ top: "50%" }}
              />
            </li>
          ))}
        </ul>
      )}
      {showSource && branchRows === null && <Handle type="source" position={Position.Bottom} />}
    </div>
  );
}
