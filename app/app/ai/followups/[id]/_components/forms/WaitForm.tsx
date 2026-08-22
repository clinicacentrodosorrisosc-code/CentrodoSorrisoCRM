"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { waitConfigSchema } from "@/lib/followup/graph-schema";
import { MODOS_DE_ESPERA, opcoes } from "@/lib/followup/vocabulario";

import { msToMin, minToMs, type ConfigOf } from "./shared";

export function WaitForm({
  config,
  onChange,
}: {
  config: ConfigOf<"wait">;
  onChange: (c: ConfigOf<"wait">) => void;
}) {
  const [mode, setMode] = useState<"fixed" | "smart" | "before_appointment">(config.mode);
  const [durationMin, setDurationMin] = useState(
    config.mode === "fixed" ? msToMin(config.duration_ms) : 10,
  );
  const [minMin, setMinMin] = useState(config.mode === "smart" ? msToMin(config.min_ms) : 5);
  const [maxMin, setMaxMin] = useState(config.mode === "smart" ? msToMin(config.max_ms) : 60);
  const [guidance, setGuidance] = useState(config.mode === "smart" ? (config.guidance ?? "") : "");
  const [offsetHours, setOffsetHours] = useState(
    config.mode === "before_appointment" ? config.offset_hours : 24,
  );
  const [error, setError] = useState<string | null>(null);

  const commit = (next: {
    mode: "fixed" | "smart" | "before_appointment";
    durationMin: number;
    minMin: number;
    maxMin: number;
    guidance: string;
    offsetHours: number;
  }) => {
    let candidate: ConfigOf<"wait">;
    if (next.mode === "fixed") {
      candidate = { mode: "fixed" as const, duration_ms: minToMs(next.durationMin) };
    } else if (next.mode === "smart") {
      candidate = {
        mode: "smart" as const,
        min_ms: minToMs(next.minMin),
        max_ms: minToMs(next.maxMin),
        ...(next.guidance.trim() ? { guidance: next.guidance } : {}),
      };
    } else {
      candidate = {
        mode: "before_appointment" as const,
        offset_hours: Number(next.offsetHours) || 24,
      };
    }

    const parsed = waitConfigSchema.safeParse(candidate);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Configuração inválida.");
      return;
    }
    setError(null);
    onChange(parsed.data);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="wait-mode">Como calcular a espera</Label>
        <Select
          value={mode}
          onValueChange={(v) => {
            const next = v as "fixed" | "smart" | "before_appointment";
            setMode(next);
            commit({ mode: next, durationMin, minMin, maxMin, guidance, offsetHours });
          }}
        >
          <SelectTrigger id="wait-mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {opcoes(MODOS_DE_ESPERA).map(({ valor, rotulo }) => (
              <SelectItem key={valor} value={valor}>
                {rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {mode === "before_appointment" ? (
        <div className="space-y-3 rounded-md border border-primary/20 bg-primary/5 p-3">
          <div className="space-y-1.5">
            <Label htmlFor="offset-hours" className="text-xs font-semibold">
              Disparar quantas horas antes da consulta?
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="offset-hours"
                type="number"
                min={0.5}
                max={720}
                step={0.5}
                value={offsetHours}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setOffsetHours(v);
                  commit({ mode, durationMin, minMin, maxMin, guidance, offsetHours: v });
                }}
                className="w-28 text-sm"
              />
              <span className="text-xs text-muted-foreground">horas antes do horário marcado</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => {
                setOffsetHours(24);
                commit({ mode, durationMin, minMin, maxMin, guidance, offsetHours: 24 });
              }}
              className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                offsetHours === 24
                  ? "bg-primary text-primary-foreground font-medium"
                  : "bg-background border hover:bg-accent text-foreground"
              }`}
            >
              📅 24h antes (Véspera)
            </button>
            <button
              type="button"
              onClick={() => {
                setOffsetHours(2);
                commit({ mode, durationMin, minMin, maxMin, guidance, offsetHours: 2 });
              }}
              className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                offsetHours === 2
                  ? "bg-primary text-primary-foreground font-medium"
                  : "bg-background border hover:bg-accent text-foreground"
              }`}
            >
              ⏰ 2h antes (No dia)
            </button>
            <button
              type="button"
              onClick={() => {
                setOffsetHours(48);
                commit({ mode, durationMin, minMin, maxMin, guidance, offsetHours: 48 });
              }}
              className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                offsetHours === 48
                  ? "bg-primary text-primary-foreground font-medium"
                  : "bg-background border hover:bg-accent text-foreground"
              }`}
            >
              2 dias antes (48h)
            </button>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            O sistema lê os campos de <strong>Data e Hora do Agendamento</strong> salvos no Lead e programa o envio para o instante exato. Se o agendamento for cancelado ou reagendado, o envio se ajusta automaticamente.
          </p>
        </div>
      ) : mode === "fixed" ? (
        <div className="space-y-2">
          <Label htmlFor="wait-duration">Duração (minutos)</Label>
          <Input
            id="wait-duration"
            type="number"
            min={5}
            value={durationMin}
            onChange={(e) => {
              const v = Number(e.target.value);
              setDurationMin(v);
              commit({ mode, durationMin: v, minMin, maxMin, guidance, offsetHours });
            }}
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="wait-min">Mínimo (min)</Label>
              <Input
                id="wait-min"
                type="number"
                min={5}
                value={minMin}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setMinMin(v);
                  commit({ mode, durationMin, minMin: v, maxMin, guidance, offsetHours });
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wait-max">Máximo (min)</Label>
              <Input
                id="wait-max"
                type="number"
                min={5}
                value={maxMin}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setMaxMin(v);
                  commit({ mode, durationMin, minMin, maxMin: v, guidance, offsetHours });
                }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="wait-guidance">Orientação (opcional)</Label>
            <Textarea
              id="wait-guidance"
              maxLength={500}
              value={guidance}
              onChange={(e) => {
                setGuidance(e.target.value);
                commit({ mode, durationMin, minMin, maxMin, guidance: e.target.value, offsetHours });
              }}
            />
          </div>
        </>
      )}
      {error && <p className="text-xs text-error-fg">{error}</p>}
    </div>
  );
}
