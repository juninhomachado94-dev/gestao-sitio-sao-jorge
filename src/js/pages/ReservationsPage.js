import { createStatusBadge } from "../components/StatusBadge.js";
import { removeReservationRevenues, syncReservationRevenues } from "./financeStore.js";
import { getClients, getReservations, saveReservations } from "../../services/dataService.js";
import { formatCurrency } from "../../services/privacyService.js";
import { getCurrentAuthUser } from "../../services/authService.js";
import {
  buildReservationCheckoutSummary,
  checkoutItems,
  getCheckoutChecklists,
  getCheckoutOccurrences,
  occurrenceTypes,
  removeCheckoutPhoto,
  saveCheckoutChecklist,
  saveCheckoutOccurrence,
  uploadCheckoutPhoto,
} from "../../services/checkoutService.js";

const emptyReservation = {
  clientId: "",
  dataEntrada: "",
  horaEntrada: "",
  dataSaida: "",
  horaSaida: "",
  eventType: "",
  totalValue: "",
  depositValue: "",
  paymentMethod: "",
  paymentStatus: "Pendente",
  reservationStatus: "Pré-reserva",
  notes: "",
};

const eventTypeOptions = [
  "Aniversário infantil",
  "Aniversário adulto",
  "Confraternização de empresa",
  "Casamento",
  "Lazer",
  "Outro",
];

const paymentMethodOptions = ["Pix", "Dinheiro", "Cartão", "Transferência", "Outro"];
const paymentStatusOptions = ["Pendente", "Sinal pago", "Pago completo"];
const reservationStatusOptions = ["Pré-reserva", "Reservada", "Confirmada", "Cancelada"];

export function createReservationsPage() {
  const clients = getStoredClients();
  let reservations = getStoredReservations();
  let checklists = getCheckoutChecklists();
  let occurrences = getCheckoutOccurrences();
  let editingReservationId = null;

  const page = document.createElement("section");
  const header = createHeader();
  const tableHost = document.createElement("div");
  const modal = createReservationModal({
    clients,
    onSubmit: saveReservation,
    onClose: closeModal,
  });
  const checkoutModal = createCheckoutModal({
    onClose: closeCheckoutModal,
    onSaveChecklist: saveChecklist,
    onSaveOccurrence: saveOccurrence,
  });

  page.className = "reservations-page";
  page.setAttribute("aria-labelledby", "reservations-title");
  tableHost.className = "reservations-page__table-host";

  page.append(header.element, tableHost, modal.element, checkoutModal.element);

  renderReservations();

  return page;

  function renderReservations() {
    tableHost.replaceChildren(createReservationsTable({
      reservations,
      clients,
      checklists,
      occurrences,
      onEdit: openEditModal,
      onDelete: deleteReservation,
      onCheckout: openCheckoutModal,
    }));
  }

  function openCreateModal() {
    editingReservationId = null;
    modal.open({
      title: "Nova reserva",
      reservation: emptyReservation,
    });
  }

  function openEditModal(reservationId) {
    const reservation = reservations.find((item) => item.id === reservationId);

    if (!reservation) {
      return;
    }

    editingReservationId = reservationId;
    modal.open({
      title: "Editar reserva",
      reservation,
    });
  }

  function closeModal() {
    editingReservationId = null;
    modal.close();
  }

  function openCheckoutModal(reservationId) {
    const reservation = reservations.find((item) => item.id === reservationId);

    if (!reservation) {
      return;
    }

    const client = clients.find((item) => item.id === reservation.clientId);
    const checklist = checklists.find((item) => item.reservationId === reservation.id);
    const reservationOccurrences = occurrences.filter((item) => item.reservationId === reservation.id);
    const clientOccurrences = occurrences.filter((item) => item.clientId === reservation.clientId && item.reservationId !== reservation.id);

    checkoutModal.open({
      reservation,
      client,
      checklist,
      reservationOccurrences,
      clientOccurrences,
    });
  }

  function closeCheckoutModal() {
    checkoutModal.close();
  }

  function saveReservation(formData) {
    const validationMessage = validateReservation(formData, reservations, editingReservationId);

    if (validationMessage) {
      modal.showError(validationMessage);
      return;
    }

    const reservationData = {
      ...formData,
      totalValue: Number(formData.totalValue),
      depositValue: Number(formData.depositValue || 0),
    };
    let savedReservation = null;

    if (editingReservationId) {
      reservations = reservations.map((reservation) => {
        if (reservation.id !== editingReservationId) {
          return reservation;
        }

        savedReservation = { ...reservation, ...reservationData };

        return savedReservation;
      });
    } else {
      savedReservation = {
        id: `reserva-${Date.now()}`,
        ...reservationData,
      };
      reservations = [
        savedReservation,
        ...reservations,
      ];
    }

    syncReservationFinance(savedReservation);
    saveStoredReservations(reservations);
    closeModal();
    renderReservations();
  }

  async function saveChecklist({ reservation, items }) {
    const user = await getCurrentAuthUser();
    const checkedCount = Object.values(items).filter(Boolean).length;
    const checklist = checklists.find((item) => item.reservationId === reservation.id);
    const status = checkedCount === checkoutItems.length
      ? "concluído"
      : checkedCount > 0
        ? "em andamento"
        : "pendente";
    const nextChecklist = {
      id: checklist?.id || `checkout-${Date.now()}`,
      reservationId: reservation.id,
      clientId: reservation.clientId,
      items,
      status,
      finalizedAt: new Date().toISOString(),
      responsibleUser: getUserDisplayName(user),
    };

    const result = await saveCheckoutChecklist(nextChecklist);
    checklists = upsertById(checklists, result.checklist || nextChecklist);
    openCheckoutModal(reservation.id);
    renderReservations();
  }

  async function saveOccurrence({ reservation, occurrence }) {
    const user = await getCurrentAuthUser();
    const nextOccurrence = {
      id: `ocorrencia-${Date.now()}`,
      reservationId: reservation.id,
      clientId: reservation.clientId,
      responsibleUser: getUserDisplayName(user),
      ...occurrence,
    };
    const result = await saveCheckoutOccurrence(nextOccurrence);
    occurrences = upsertById(occurrences, result.occurrence || nextOccurrence);
    openCheckoutModal(reservation.id);
    renderReservations();
  }

  function deleteReservation(reservationId) {
    const shouldDelete = window.confirm("Tem certeza que deseja excluir esta reserva?");

    if (!shouldDelete) {
      return;
    }

    reservations = reservations.filter((reservation) => reservation.id !== reservationId);
    removeReservationRevenues(reservationId);
    saveStoredReservations(reservations);
    renderReservations();
  }

  function syncReservationFinance(reservation) {
    const client = clients.find((item) => item.id === reservation?.clientId);

    if (!reservation || !client) {
      return;
    }

    syncReservationRevenues(reservation, client);
  }

  function createHeader() {
    const wrapper = document.createElement("div");
    const textGroup = document.createElement("div");
    const kicker = document.createElement("p");
    const title = document.createElement("h2");
    const intro = document.createElement("p");
    const button = document.createElement("button");

    wrapper.className = "reservations-page__header";
    textGroup.className = "reservations-page__header-text";

    kicker.className = "page-panel__kicker";
    kicker.textContent = "Sítio São Jorge";

    title.className = "reservations-page__title";
    title.id = "reservations-title";
    title.textContent = "Reservas";

    intro.className = "reservations-page__intro";
    intro.textContent = "Controle de reservas, datas e pagamentos.";

    button.className = "button button--primary";
    button.type = "button";
    button.textContent = "Nova reserva";
    button.addEventListener("click", openCreateModal);

    textGroup.append(kicker, title, intro);
    wrapper.append(textGroup, button);

    return { element: wrapper };
  }
}

function getStoredReservations() {
  return getReservations();
}

function saveStoredReservations(reservations) {
  saveReservations(reservations);
}

function getStoredClients() {
  return getClients();
}

function createReservationsTable({ reservations, clients, checklists, occurrences, onEdit, onDelete, onCheckout }) {
  const section = document.createElement("section");
  const wrapper = document.createElement("div");
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");
  const headers = [
    "Entrada",
    "Saída",
    "Cliente",
    "Tipo de evento",
    "Valor total",
    "Sinal",
    "Restante",
    "Status do pagamento",
    "Status da reserva",
    "Checkout",
    "Ações",
  ];

  section.className = "reservations-table";
  wrapper.className = "reservations-table__wrapper";

  const headerRow = document.createElement("tr");
  headers.forEach((label) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = label;
    headerRow.append(th);
  });
  thead.append(headerRow);

  if (!reservations.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = headers.length;
    cell.textContent = "Nenhuma reserva cadastrada";
    row.append(cell);
    tbody.append(row);
  }

  reservations.forEach((reservation) => {
    const row = document.createElement("tr");
    const remainingValue = calculateRemaining(reservation.totalValue, reservation.depositValue);
    const checkoutSummary = buildReservationCheckoutSummary(reservation, checklists, occurrences);
    const values = [
      formatDateTime(reservation.dataEntrada, reservation.horaEntrada),
      formatDateTime(reservation.dataSaida, reservation.horaSaida),
      getClientName(clients, reservation.clientId),
      reservation.eventType || "Não informado",
      formatCurrency(reservation.totalValue),
      formatCurrency(reservation.depositValue),
      formatCurrency(remainingValue),
      reservation.paymentStatus,
      reservation.reservationStatus,
      checkoutSummary.status,
    ];

    values.forEach((value, index) => {
      const td = document.createElement("td");

      if (index === 8) {
        td.append(createReservationStatusBadge(value));
        row.append(td);
        return;
      }

      if (index === 9) {
        td.append(createCheckoutSummary(checkoutSummary));
        row.append(td);
        return;
      }

      td.textContent = value;
      row.append(td);
    });

    const actions = document.createElement("td");
    const actionsGroup = document.createElement("div");
    const checkoutButton = document.createElement("button");
    const editButton = document.createElement("button");
    const deleteButton = document.createElement("button");

    actionsGroup.className = "reservations-table__actions";

    checkoutButton.className = "button button--secondary";
    checkoutButton.type = "button";
    checkoutButton.textContent = "Checkout";
    checkoutButton.addEventListener("click", () => onCheckout(reservation.id));

    editButton.className = "button button--secondary";
    editButton.type = "button";
    editButton.textContent = "Editar";
    editButton.addEventListener("click", () => onEdit(reservation.id));

    deleteButton.className = "button button--danger";
    deleteButton.type = "button";
    deleteButton.textContent = "Excluir";
    deleteButton.addEventListener("click", () => onDelete(reservation.id));

    actionsGroup.append(checkoutButton, editButton, deleteButton);
    actions.append(actionsGroup);
    row.append(actions);
    tbody.append(row);
  });

  table.append(thead, tbody);
  wrapper.append(table);
  section.append(wrapper);

  return section;
}

function createCheckoutSummary(summary) {
  const wrapper = document.createElement("div");
  const status = document.createElement("span");
  const meta = document.createElement("small");
  const progress = calculateChecklistProgress(summary.checklist?.items);

  wrapper.className = "checkout-summary";
  status.className = `checkout-summary__status checkout-summary__status--${slugifyStatus(summary.status)}`;
  status.textContent = `Checklist ${summary.status}`;
  meta.textContent = `${progress.completed}/${progress.total} itens · ${summary.occurrencesCount} ocorrência(s) · ${formatCurrency(summary.totalDamage)}`;

  wrapper.append(status, meta);
  return wrapper;
}

function createCheckoutModal({ onClose, onSaveChecklist, onSaveOccurrence }) {
  const overlay = document.createElement("div");
  const dialog = document.createElement("div");
  const header = document.createElement("div");
  const title = document.createElement("h3");
  const closeButton = document.createElement("button");
  const body = document.createElement("div");
  let currentReservation = null;

  overlay.className = "checkout-modal";
  overlay.hidden = true;
  dialog.className = "checkout-modal__dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  header.className = "checkout-modal__header";
  title.className = "checkout-modal__title";
  closeButton.className = "checkout-modal__close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Fechar checkout");
  closeButton.textContent = "×";
  closeButton.addEventListener("click", onClose);
  body.className = "checkout-modal__body";

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      onClose();
    }
  });

  header.append(title, closeButton);
  dialog.append(header, body);
  overlay.append(dialog);

  return {
    element: overlay,
    open({ reservation, client, checklist, reservationOccurrences, clientOccurrences }) {
      currentReservation = reservation;
      title.textContent = `Checklist de saída - ${client?.name || reservation.clientName || "Cliente"}`;
      body.replaceChildren(createCheckoutContent({
        reservation,
        client,
        checklist,
        reservationOccurrences,
        clientOccurrences,
        onSaveChecklist,
        onSaveOccurrence,
      }));
      overlay.hidden = false;
    },
    close() {
      currentReservation = null;
      overlay.hidden = true;
      body.replaceChildren();
    },
    getCurrentReservation() {
      return currentReservation;
    },
  };
}

function createCheckoutContent({
  reservation,
  client,
  checklist,
  reservationOccurrences,
  clientOccurrences,
  onSaveChecklist,
  onSaveOccurrence,
}) {
  const fragment = document.createDocumentFragment();
  const summaryHost = document.createElement("div");
  const finalHost = document.createElement("div");
  const draftItems = { ...(checklist?.items || {}) };
  const previousWarning = createPreviousOccurrencesWarning(clientOccurrences);
  const checklistSection = createChecklistSection({
    checklist,
    draftItems,
    onItemsChange: renderDynamicSections,
  });
  const occurrencesSection = createOccurrencesSection({
    reservation,
    reservationOccurrences,
    onSaveOccurrence,
  });

  function renderDynamicSections() {
    summaryHost.replaceChildren(createCheckoutSummaryPanel({
      reservation,
      checklist,
      reservationOccurrences,
      draftItems,
    }));
    finalHost.replaceChildren(createFinalInspectionSection({
      reservation,
      client,
      checklist,
      reservationOccurrences,
      draftItems,
      onSaveChecklist,
    }));
  }

  renderDynamicSections();

  fragment.append(summaryHost);

  if (previousWarning) {
    fragment.append(previousWarning);
  }

  fragment.append(checklistSection, occurrencesSection, finalHost);
  return fragment;
}

function createCheckoutSummaryPanel({ reservation, checklist, reservationOccurrences, draftItems }) {
  const section = document.createElement("section");
  const grid = document.createElement("div");
  const history = document.createElement("div");
  const historyTitle = document.createElement("h4");
  const historyList = document.createElement("dl");
  const summary = buildReservationCheckoutSummary(reservation, checklist ? [checklist] : [], reservationOccurrences);
  const progress = calculateChecklistProgress(draftItems || checklist?.items);
  const autoStatus = getProgressStatus(progress);
  const totalDamageTone = summary.totalDamage > 0 ? "danger" : "success";

  section.className = "checkout-overview";
  grid.className = "checkout-overview__grid";
  grid.append(
    createCheckoutMetric("Checklist", `${progress.completed}/${progress.total} concluídos`, {
      tone: autoStatus === "concluído" ? "success" : autoStatus === "pendente" ? "neutral" : "warning",
    }),
    createCheckoutMetric("Status", autoStatus, {
      tone: autoStatus === "concluído" ? "success" : autoStatus === "pendente" ? "neutral" : "warning",
    }),
    createCheckoutMetric("Ocorrências", String(summary.occurrencesCount), {
      tone: summary.occurrencesCount ? "danger" : "success",
    }),
    createCheckoutMetric("Prejuízo total", formatCurrency(summary.totalDamage), {
      tone: totalDamageTone,
    }),
  );
  section.append(grid, createChecklistProgress(progress));

  history.className = "checkout-history";
  historyTitle.textContent = "Histórico da vistoria";
  historyList.append(
    createHistoryItem("Checkout", checklist?.finalizedAt ? formatDateTimeFromIso(checklist.finalizedAt) : "Ainda não finalizado"),
    createHistoryItem("Responsável", checklist?.responsibleUser || "Não informado"),
    createHistoryItem("Status da vistoria", summary.inspectionStatus),
    createHistoryItem("Ocorrências", String(summary.occurrencesCount)),
    createHistoryItem("Prejuízo total", formatCurrency(summary.totalDamage)),
  );
  history.append(historyTitle, historyList);
  section.append(history);

  return section;
}

function createFinalInspectionSection({
  reservation,
  client,
  checklist,
  reservationOccurrences,
  draftItems,
  onSaveChecklist,
}) {
  const section = document.createElement("section");
  const header = document.createElement("div");
  const title = document.createElement("h4");
  const intro = document.createElement("p");
  const actions = document.createElement("div");
  const generateButton = document.createElement("button");
  const copyButton = document.createElement("button");
  const finalizeButton = document.createElement("button");
  const output = document.createElement("textarea");
  const summary = buildReservationCheckoutSummary(reservation, checklist ? [checklist] : [], reservationOccurrences);
  const progress = calculateChecklistProgress(draftItems);
  const summaryText = buildInspectionSummaryText({
    checklist,
    progress,
    summary,
    client,
  });

  section.className = "checkout-section checkout-final-summary";
  header.className = "checkout-section__header";
  title.textContent = "Resumo final";
  intro.className = "checkout-final-summary__intro";
  intro.textContent = "Gere um resumo copiável da vistoria e finalize o checkout quando a conferência estiver registrada.";

  actions.className = "checkout-summary-actions";
  generateButton.className = "button button--secondary";
  generateButton.type = "button";
  generateButton.textContent = "Gerar resumo da vistoria";
  copyButton.className = "button button--secondary";
  copyButton.type = "button";
  copyButton.textContent = "Copiar resumo";
  finalizeButton.className = "button button--primary";
  finalizeButton.type = "button";
  finalizeButton.textContent = "Finalizar Checkout";
  output.className = "checkout-summary-output";
  output.rows = 5;
  output.readOnly = true;
  output.placeholder = "Clique em Gerar resumo da vistoria para criar o texto copiável.";

  generateButton.addEventListener("click", () => {
    output.value = summaryText;
    output.focus();
    output.select();
  });

  copyButton.addEventListener("click", async () => {
    const text = output.value || summaryText;
    output.value = text;

    try {
      await navigator.clipboard.writeText(text);
      copyButton.textContent = "Resumo copiado";
      window.setTimeout(() => {
        copyButton.textContent = "Copiar resumo";
      }, 1800);
    } catch {
      output.focus();
      output.select();
    }
  });

  finalizeButton.addEventListener("click", () => {
    if (progress.percent < 100) {
      const shouldContinue = window.confirm("O checklist ainda não foi concluído. Deseja finalizar mesmo assim?");

      if (!shouldContinue) {
        return;
      }
    }

    onSaveChecklist({ reservation, items: draftItems });
  });

  header.append(title);
  actions.append(generateButton, copyButton, finalizeButton);
  section.append(header, intro, output);

  if (summary.totalDamage > 0) {
    section.append(createFutureChargeNotice());
  }

  section.append(actions);
  return section;
}

function createFutureChargeNotice() {
  const notice = document.createElement("div");
  notice.className = "checkout-charge-notice";
  notice.textContent = "Cobrança de prejuízo poderá ser lançada no financeiro em uma próxima atualização.";
  return notice;
}

function createCheckoutMetric(label, value, options = {}) {
  const card = document.createElement("article");
  const labelElement = document.createElement("span");
  const valueElement = document.createElement("strong");
  const detailElement = document.createElement("small");

  card.className = `checkout-metric checkout-metric--${options.tone || "neutral"}`;
  labelElement.textContent = label;
  valueElement.textContent = value;

  card.append(labelElement, valueElement);

  if (options.detail) {
    detailElement.textContent = options.detail;
    card.append(detailElement);
  }

  return card;
}

function createChecklistProgress(progress) {
  const wrapper = document.createElement("div");
  const header = document.createElement("div");
  const label = document.createElement("strong");
  const count = document.createElement("span");
  const track = document.createElement("div");
  const fill = document.createElement("i");
  const progressState = progress.completed === 0
    ? "is-empty"
    : progress.percent === 100
      ? "is-complete"
      : "is-partial";

  wrapper.className = `checkout-progress ${progressState}`;
  header.className = "checkout-progress__header";
  label.textContent = "Progresso do checklist";
  count.textContent = `${progress.completed}/${progress.total} concluídos`;
  track.className = "checkout-progress__track";
  fill.className = "checkout-progress__fill";
  fill.style.width = `${progress.percent}%`;

  header.append(label, count);
  track.append(fill);
  wrapper.append(header, track);
  return wrapper;
}

function createHistoryItem(label, value) {
  const fragment = document.createDocumentFragment();
  const term = document.createElement("dt");
  const description = document.createElement("dd");

  term.textContent = label;
  description.textContent = value;
  fragment.append(term, description);

  return fragment;
}

function createPreviousOccurrencesWarning(clientOccurrences) {
  if (!clientOccurrences.length) {
    return null;
  }

  const warning = document.createElement("div");
  warning.className = "checkout-warning";
  warning.textContent = "Cliente possui ocorrências anteriores";
  return warning;
}

function createChecklistSection({ draftItems, onItemsChange }) {
  const section = document.createElement("section");
  const header = document.createElement("div");
  const title = document.createElement("h4");
  const form = document.createElement("form");
  const grid = document.createElement("div");
  const progressHost = document.createElement("div");

  section.className = "checkout-section";
  header.className = "checkout-section__header";
  title.textContent = "Checklist de saída";
  form.className = "checkout-checklist";
  grid.className = "checkout-checklist__grid";

  function updateProgressPreview() {
    const formData = new FormData(form);
    const items = checkoutItems.reduce((acc, item) => {
      acc[item.key] = formData.get(item.key) === "on";
      return acc;
    }, {});
    Object.assign(draftItems, items);
    progressHost.replaceChildren(createChecklistProgress(calculateChecklistProgress(items)));
    onItemsChange?.();
  }

  checkoutItems.forEach((item) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    const text = document.createElement("span");

    label.className = "checkout-checklist__item";
    input.type = "checkbox";
    input.name = item.key;
    input.checked = Boolean(draftItems[item.key]);
    input.addEventListener("change", updateProgressPreview);
    text.textContent = item.label;
    label.append(input, text);
    grid.append(label);
  });

  header.append(title);
  updateProgressPreview();
  form.append(progressHost, grid);
  section.append(header, form);
  return section;
}

function createOccurrencesSection({ reservation, reservationOccurrences, onSaveOccurrence }) {
  const section = document.createElement("section");
  const header = document.createElement("div");
  const title = document.createElement("h4");
  const form = document.createElement("form");
  const list = document.createElement("div");
  const photoUpload = document.createElement("div");
  const photoActions = document.createElement("div");
  const photoInput = document.createElement("input");
  const photoButton = document.createElement("button");
  const photoHint = document.createElement("p");
  const photoError = document.createElement("p");
  const photoPreview = document.createElement("div");
  const occurrenceDraftId = `ocorrencia-${Date.now()}`;
  const uploadedPhotos = [];
  const fields = {
    type: createCheckoutField("Tipo", "type", "select", occurrenceTypes),
    title: createCheckoutField("Título", "title", "text"),
    description: createCheckoutField("Descrição", "description", "textarea"),
    damageValue: createCheckoutField("Valor do prejuízo", "damageValue", "number"),
    photoUrls: createCheckoutField("Links das fotos da vistoria", "photoUrls", "textarea", [], "Uma URL por linha. Use links de fotos salvas no celular, Google Drive ou outro armazenamento."),
    occurrenceDate: createCheckoutField("Data", "occurrenceDate", "date"),
  };
  const actions = document.createElement("div");
  const saveButton = document.createElement("button");

  section.className = "checkout-section";
  header.className = "checkout-section__header";
  title.textContent = "Ocorrências";
  form.className = "checkout-occurrence-form";
  list.className = "checkout-occurrence-list";
  photoUpload.className = "checkout-photo-upload";
  photoActions.className = "checkout-photo-upload__actions";
  photoInput.type = "file";
  photoInput.accept = "image/*";
  photoInput.multiple = true;
  photoInput.className = "checkout-photo-upload__input";
  photoButton.className = "button button--secondary";
  photoButton.type = "button";
  photoButton.textContent = "Adicionar foto";
  photoHint.className = "checkout-photo-upload__hint";
  photoHint.textContent = "Você pode escolher da galeria ou tirar uma foto pelo celular. Máximo de 8 MB por imagem.";
  photoError.className = "checkout-photo-upload__error";
  photoError.hidden = true;
  photoPreview.className = "checkout-photo-preview";
  actions.className = "checkout-actions";
  saveButton.className = "button button--primary";
  saveButton.type = "submit";
  saveButton.textContent = "Registrar ocorrência";
  fields.damageValue.input.min = "0";
  fields.damageValue.input.step = "0.01";
  fields.occurrenceDate.input.value = toDateInputValue(new Date());

  Object.values(fields).forEach((field) => form.append(field.wrapper));
  photoButton.addEventListener("click", () => photoInput.click());
  photoInput.addEventListener("change", async () => {
    const files = Array.from(photoInput.files || []);

    if (!files.length) {
      return;
    }

    photoError.hidden = true;
    photoButton.disabled = true;
    photoButton.textContent = "Enviando...";

    for (const file of files) {
      const result = await uploadCheckoutPhoto({
        reservationId: reservation.id,
        occurrenceId: occurrenceDraftId,
        file,
      });

      if (!result.ok) {
        photoError.textContent = "Não foi possível enviar a foto. Tente novamente.";
        photoError.hidden = false;
        continue;
      }

      uploadedPhotos.push(result.photo);
    }

    photoButton.disabled = false;
    photoButton.textContent = "Adicionar foto";
    photoInput.value = "";
    renderPhotoPreview();
  });

  function renderPhotoPreview() {
    photoPreview.replaceChildren();

    uploadedPhotos.forEach((photo, index) => {
      photoPreview.append(createPhotoPreviewItem(photo, async () => {
        uploadedPhotos.splice(index, 1);
        await removeCheckoutPhoto(photo.path);
        renderPhotoPreview();
      }));
    });
  }

  photoActions.append(photoButton, photoInput);
  photoUpload.append(photoActions, photoHint, photoError, photoPreview);
  form.append(photoUpload);
  actions.append(saveButton);
  form.append(actions);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const occurrence = {
      type: fields.type.input.value,
      title: fields.title.input.value.trim(),
      description: fields.description.input.value.trim(),
      damageValue: Number(fields.damageValue.input.value || 0),
      photoUrls: [
        ...uploadedPhotos.map((photo) => photo.url),
        ...parsePhotoUrlText(fields.photoUrls.input.value),
      ],
      occurrenceDate: fields.occurrenceDate.input.value,
    };

    if (!occurrence.title) {
      window.alert("Informe um título para a ocorrência.");
      return;
    }

    onSaveOccurrence({ reservation, occurrence });
    form.reset();
    uploadedPhotos.splice(0, uploadedPhotos.length);
    renderPhotoPreview();
    fields.occurrenceDate.input.value = toDateInputValue(new Date());
  });

  if (!reservationOccurrences.length) {
    const empty = document.createElement("p");
    empty.className = "checkout-empty";
    empty.textContent = "Nenhuma ocorrência registrada nesta reserva.";
    list.append(empty);
  }

  reservationOccurrences.forEach((occurrence) => {
    const item = document.createElement("article");
    const itemTitle = document.createElement("strong");
    const meta = document.createElement("span");
    const description = document.createElement("p");

    item.className = "checkout-occurrence";
    itemTitle.textContent = occurrence.title;
    meta.textContent = `${formatOccurrenceType(occurrence.type)} · ${formatDate(occurrence.occurrenceDate)} · ${formatCurrency(occurrence.damageValue)}`;
    description.textContent = occurrence.description || "Sem descrição.";
    item.append(itemTitle, meta, description, createOccurrencePhotoList(occurrence.photoUrls));
    list.append(item);
  });

  header.append(title);
  section.append(header, form, list);
  return section;
}

function createPhotoPreviewItem(photo, onRemove) {
  const item = document.createElement("article");
  const link = document.createElement("a");
  const image = document.createElement("img");
  const removeButton = document.createElement("button");

  item.className = "checkout-photo-preview__item";
  link.href = photo.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  image.src = photo.url;
  image.alt = photo.name || "Foto da vistoria";
  removeButton.className = "checkout-photo-preview__remove";
  removeButton.type = "button";
  removeButton.textContent = "Remover";
  removeButton.addEventListener("click", onRemove);

  link.append(image);
  item.append(link, removeButton);
  return item;
}

function createOccurrencePhotoList(photoUrls = []) {
  const list = document.createElement("div");
  const urls = Array.isArray(photoUrls) ? photoUrls.filter(Boolean) : [];

  list.className = "checkout-occurrence__photos";

  if (!urls.length) {
    return list;
  }

  urls.forEach((url, index) => {
    const link = document.createElement("a");
    const image = document.createElement("img");

    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.title = `Abrir foto ${index + 1}`;
    image.src = url;
    image.alt = `Foto da vistoria ${index + 1}`;
    link.append(image);
    list.append(link);
  });

  return list;
}

function parsePhotoUrlText(value) {
  return String(value || "")
    .split("\n")
    .map((url) => url.trim())
    .filter(Boolean);
}

function createCheckoutField(label, name, type, options = [], hint = "") {
  const wrapper = document.createElement("label");
  const text = document.createElement("span");
  const hintElement = document.createElement("small");
  const input = type === "textarea"
    ? document.createElement("textarea")
    : type === "select"
      ? document.createElement("select")
      : document.createElement("input");

  wrapper.className = "checkout-field";
  text.textContent = label;
  input.name = name;

  if (type === "select") {
    options.forEach((option) => {
      const optionElement = document.createElement("option");
      optionElement.value = option;
      optionElement.textContent = formatOccurrenceType(option);
      input.append(optionElement);
    });
  } else if (type === "textarea") {
    input.rows = 3;
  } else {
    input.type = type;
  }

  wrapper.append(text);

  if (hint) {
    hintElement.textContent = hint;
    wrapper.append(hintElement);
  }

  wrapper.append(input);
  return { wrapper, input };
}

function createReservationModal({ clients, onSubmit, onClose }) {
  const overlay = document.createElement("div");
  const dialog = document.createElement("div");
  const header = document.createElement("div");
  const title = document.createElement("h3");
  const closeButton = document.createElement("button");
  const form = document.createElement("form");
  const error = document.createElement("p");
  const fields = {
    clientId: createField("Cliente", "clientId", "select", clients.map((client) => ({
      label: client.name,
      value: client.id,
    }))),
    dataEntrada: createField("Data de entrada", "dataEntrada", "date"),
    horaEntrada: createField("Horário de entrada", "horaEntrada", "time"),
    dataSaida: createField("Data de saída", "dataSaida", "date"),
    horaSaida: createField("Horário de saída", "horaSaida", "time"),
    eventType: createField("Tipo de evento/festa", "eventType", "select", eventTypeOptions),
    totalValue: createField("Valor total", "totalValue", "number"),
    depositValue: createField("Valor de sinal/entrada", "depositValue", "number"),
    remainingValue: createField("Valor restante", "remainingValue", "number"),
    paymentMethod: createField("Forma de pagamento", "paymentMethod", "select", paymentMethodOptions),
    paymentStatus: createField("Status do pagamento", "paymentStatus", "select", paymentStatusOptions),
    reservationStatus: createField("Status da reserva", "reservationStatus", "select", reservationStatusOptions),
    notes: createField("Observações", "notes", "textarea"),
  };
  const actions = document.createElement("div");
  const cancelButton = document.createElement("button");
  const submitButton = document.createElement("button");

  overlay.className = "reservation-modal";
  overlay.hidden = true;

  dialog.className = "reservation-modal__dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "reservation-modal-title");

  header.className = "reservation-modal__header";
  title.className = "reservation-modal__title";
  title.id = "reservation-modal-title";

  closeButton.className = "reservation-modal__close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Fechar formulário");
  closeButton.textContent = "×";
  closeButton.addEventListener("click", onClose);

  form.className = "reservation-form";
  form.noValidate = true;

  fields.totalValue.input.min = "0";
  fields.totalValue.input.step = "0.01";
  fields.depositValue.input.min = "0";
  fields.depositValue.input.step = "0.01";
  fields.remainingValue.input.readOnly = true;
  fields.remainingValue.input.tabIndex = -1;

  fields.totalValue.input.addEventListener("input", updateRemainingValue);
  fields.depositValue.input.addEventListener("input", updateRemainingValue);

  error.className = "reservation-form__error";
  error.hidden = true;

  Object.values(fields).forEach((field) => form.append(field.wrapper));

  actions.className = "reservation-form__actions";

  cancelButton.className = "button button--secondary";
  cancelButton.type = "button";
  cancelButton.textContent = "Cancelar";
  cancelButton.addEventListener("click", onClose);

  submitButton.className = "button button--primary";
  submitButton.type = "submit";
  submitButton.textContent = "Salvar reserva";

  actions.append(cancelButton, submitButton);
  form.append(error, actions);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    error.hidden = true;
    onSubmit(readReservationFormData(fields));
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      onClose();
    }
  });

  header.append(title, closeButton);
  dialog.append(header, form);
  overlay.append(dialog);

  return {
    element: overlay,
    open({ title: nextTitle, reservation }) {
      title.textContent = nextTitle;
      error.hidden = true;
      fillReservationForm(fields, reservation);
      updateRemainingValue();
      overlay.hidden = false;
      fields.clientId.input.focus();
    },
    close() {
      overlay.hidden = true;
      form.reset();
    },
    showError(message) {
      error.textContent = message;
      error.hidden = false;
    },
  };

  function updateRemainingValue() {
    const totalValue = Number(fields.totalValue.input.value || 0);
    const depositValue = Number(fields.depositValue.input.value || 0);
    fields.remainingValue.input.value = calculateRemaining(totalValue, depositValue).toFixed(2);
  }
}

function createField(label, name, type, options = []) {
  const wrapper = document.createElement("label");
  const labelText = document.createElement("span");
  const input = createFieldControl(type, options);

  wrapper.className = "reservation-form__field";
  labelText.textContent = label;
  input.name = name;

  if (type === "textarea") {
    input.rows = 4;
  } else if (type !== "select") {
    input.type = type;
  }

  wrapper.append(labelText, input);

  return { wrapper, input };
}

function createFieldControl(type, options) {
  if (type === "textarea") {
    return document.createElement("textarea");
  }

  if (type === "select") {
    const select = document.createElement("select");
    const emptyOption = document.createElement("option");

    emptyOption.value = "";
    emptyOption.textContent = options.length ? "Selecione uma opção" : "Nenhum cliente cadastrado";
    select.append(emptyOption);

    options.forEach((option) => {
      const optionElement = document.createElement("option");
      const optionConfig = typeof option === "string"
        ? { label: option, value: option }
        : option;

      optionElement.value = optionConfig.value;
      optionElement.textContent = optionConfig.label;
      select.append(optionElement);
    });

    return select;
  }

  return document.createElement("input");
}

function fillReservationForm(fields, reservation) {
  Object.entries(fields).forEach(([key, field]) => {
    if (key === "remainingValue") {
      return;
    }

    field.input.value = reservation[key] ?? "";
  });
}

function readReservationFormData(fields) {
  return {
    clientId: fields.clientId.input.value,
    dataEntrada: fields.dataEntrada.input.value,
    horaEntrada: fields.horaEntrada.input.value,
    dataSaida: fields.dataSaida.input.value,
    horaSaida: fields.horaSaida.input.value,
    eventType: fields.eventType.input.value,
    totalValue: fields.totalValue.input.value,
    depositValue: fields.depositValue.input.value,
    paymentMethod: fields.paymentMethod.input.value,
    paymentStatus: fields.paymentStatus.input.value,
    reservationStatus: fields.reservationStatus.input.value,
    notes: fields.notes.input.value.trim(),
  };
}

function validateReservation(reservation, reservations, editingReservationId) {
  if (!reservation.clientId) {
    return "Cliente é obrigatório.";
  }

  if (!reservation.dataEntrada) {
    return "Data de entrada é obrigatória.";
  }

  if (!reservation.dataSaida) {
    return "Data de saída é obrigatória.";
  }

  if (!reservation.horaEntrada) {
    return "Horário de entrada é obrigatório.";
  }

  if (!reservation.horaSaida) {
    return "Horário de saída é obrigatório.";
  }

  if (!reservation.totalValue || Number(reservation.totalValue) <= 0) {
    return "Valor total é obrigatório.";
  }

  const newStart = buildDateTime(reservation.dataEntrada, reservation.horaEntrada);
  const newEnd = buildDateTime(reservation.dataSaida, reservation.horaSaida);

  if (newEnd < newStart) {
    return "Data de saída não pode ser anterior à data de entrada.";
  }

  if (newEnd.getTime() === newStart.getTime()) {
    return "Horário de saída deve ser maior que o horário de entrada.";
  }

  const hasPeriodConflict = reservations.some((item) => {
    if (item.id === editingReservationId || item.reservationStatus === "Cancelada") {
      return false;
    }

    if (reservation.reservationStatus === "Cancelada") {
      return false;
    }

    const existingStart = buildDateTime(item.dataEntrada, item.horaEntrada);
    const existingEnd = buildDateTime(item.dataSaida, item.horaSaida);

    return newStart < existingEnd && newEnd > existingStart;
  });

  if (hasPeriodConflict) {
    return "Já existe uma reserva ativa para este período.";
  }

  return "";
}

function buildDateTime(date, time) {
  return new Date(`${date}T${time}`);
}

function calculateRemaining(totalValue, depositValue) {
  return Math.max(Number(totalValue || 0) - Number(depositValue || 0), 0);
}

function getClientName(clients, clientId) {
  return clients.find((client) => client.id === clientId)?.name ?? "Cliente não encontrado";
}

function getUserDisplayName(user) {
  const metadataName = user?.user_metadata?.name?.trim();

  if (metadataName) {
    return metadataName;
  }

  return user?.email || "Usuário não identificado";
}

function upsertById(items, item) {
  const exists = items.some((current) => current.id === item.id);

  return exists
    ? items.map((current) => (current.id === item.id ? item : current))
    : [item, ...items];
}

function calculateChecklistProgress(items = {}) {
  const total = checkoutItems.length;
  const completed = checkoutItems.filter((item) => Boolean(items?.[item.key])).length;
  const percent = total ? Math.round((completed / total) * 100) : 0;

  return { completed, total, percent };
}

function getProgressStatus(progress) {
  if (progress.completed === 0) {
    return "pendente";
  }

  if (progress.completed >= progress.total) {
    return "concluído";
  }

  return "em andamento";
}

function buildInspectionSummaryText({ checklist, progress, summary, client }) {
  const status = getProgressStatus(progress);

  return [
    `Checkout realizado em ${checklist?.finalizedAt ? formatDateTimeFromIso(checklist.finalizedAt) : "não finalizado"}.`,
    `Cliente: ${client?.name || "Não informado"}.`,
    `Checklist: ${progress.completed}/${progress.total} itens concluídos.`,
    `Status: ${status}.`,
    `Ocorrências registradas: ${summary.occurrencesCount}.`,
    `Prejuízo estimado: ${formatCurrency(summary.totalDamage)}.`,
    `Responsável: ${checklist?.responsibleUser || "Não informado"}.`,
  ].join("\n");
}

function createReservationStatusBadge(status) {
  return createStatusBadge(status, status, "reservation-status-badge");
}

function slugifyStatus(status) {
  return String(status || "pendente")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function formatOccurrenceType(type) {
  return String(type || "outros").replace(/^./, (char) => char.toUpperCase());
}

function formatDateTime(date, time) {
  if (!date || !time) {
    return "Não informado";
  }

  return `${formatDate(date)} ${time}`;
}

function formatDateTimeFromIso(value) {
  if (!value) {
    return "Não informado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDate(value) {
  if (!value) {
    return "Não informado";
  }

  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
