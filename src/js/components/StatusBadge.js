const statusConfig = {
  Livre: { className: "status-free", icon: "○" },
  "Pré-reserva": { className: "status-pre", icon: "!" },
  Reservada: { className: "status-reserved", icon: "▣" },
  Confirmada: { className: "status-confirmed", icon: "✓" },
  Cancelada: { className: "status-canceled", icon: "×" },
  Pendente: { className: "status-pending", icon: "!" },
  pendente: { className: "status-pending", icon: "!" },
  "Sinal pago": { className: "status-paid", icon: "✓" },
  "Pago completo": { className: "status-paid", icon: "✓" },
  recebido: { className: "status-paid", icon: "✓" },
  pago: { className: "status-paid", icon: "✓" },
  Gerado: { className: "status-generated", icon: "▣" },
  gerado: { className: "status-generated", icon: "▣" },
  Enviado: { className: "status-sent", icon: "↗" },
  enviado: { className: "status-sent", icon: "↗" },
  Assinado: { className: "status-signed", icon: "✓" },
  assinado: { className: "status-signed", icon: "✓" },
  Rascunho: { className: "status-pending", icon: "!" },
  rascunho: { className: "status-pending", icon: "!" },
};

export function createStatusBadge(label, status = label, extraClass = "") {
  const config = statusConfig[status] ?? statusConfig[label] ?? statusConfig.Pendente;
  const badge = document.createElement("span");
  const dot = document.createElement("span");
  const icon = document.createElement("span");
  const text = document.createElement("span");

  badge.className = ["status-badge", config.className, extraClass].filter(Boolean).join(" ");
  dot.className = "status-dot";
  icon.className = "status-icon";
  icon.textContent = config.icon;
  text.className = "status-text";
  text.textContent = label || "Pendente";

  badge.append(dot, icon, text);

  return badge;
}

export function getStatusClass(status) {
  return statusConfig[status]?.className ?? "";
}
