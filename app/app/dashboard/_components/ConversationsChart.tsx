"use client";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { DailyPoint } from "@/app/api/v1/dashboard/overview/route";

interface Props {
  data: DailyPoint[];
  days: number;
}

const tooltipStyle = {
  borderRadius: "8px",
  fontSize: "12px",
  border: "1px solid hsl(var(--border))",
  backgroundColor: "hsl(var(--popover))",
  color: "hsl(var(--popover-foreground))",
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
};

export function ConversationsChart({ data, days }: Props) {
  const totalConversations = data.reduce((acc, d) => acc + d.conversations, 0);
  const totalSent = data.reduce((acc, d) => acc + d.messages_sent, 0);
  const totalReceived = data.reduce((acc, d) => acc + d.messages_received, 0);

  const hasData = totalConversations > 0 || totalSent > 0 || totalReceived > 0;

  return (
    <Card className="col-span-full xl:col-span-8 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="text-base font-semibold">Volume de Conversas & Mensagens</CardTitle>
          <CardDescription className="text-xs">
            Atividade diária nos últimos {days} dias ({totalConversations} conversas iniciadas, {totalSent} enviadas)
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:px-6 pb-4">
        {!hasData ? (
          <div className="flex h-[280px] flex-col items-center justify-center rounded-lg border border-dashed text-center p-6">
            <p className="text-sm font-medium text-muted-foreground">
              Nenhuma conversa ou mensagem registrada no período selecionado.
            </p>
            <p className="text-xs text-muted-foreground/80 mt-1">
              Conforme novas mensagens forem trocadas no WhatsApp, o gráfico será atualizado automaticamente.
            </p>
          </div>
        ) : (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="conversationsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.6} />
                <XAxis
                  dataKey="label"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: any, name: any) => {
                    const num = typeof value === "number" ? value : 0;
                    if (name === "conversations") return [num, "Conversas"];
                    if (name === "messages_sent") return [num, "Mensagens Enviadas"];
                    if (name === "messages_received") return [num, "Mensagens Recebidas"];
                    return [num, String(name ?? "")];
                  }}
                  labelFormatter={(label) => `Data: ${label}`}
                />
                <Legend
                  verticalAlign="top"
                  height={36}
                  formatter={(value) => {
                    if (value === "conversations") return "Conversas";
                    if (value === "messages_sent") return "Envios";
                    if (value === "messages_received") return "Recebimentos";
                    return value;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="conversations"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#conversationsGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="messages_sent"
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  fillOpacity={1}
                  fill="url(#sentGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
