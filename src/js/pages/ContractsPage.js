import { createStatusBadge } from "../components/StatusBadge.js";
import { PUBLIC_APP_URL } from "../config/appConfig.js";
import { defaultContractContent } from "./contractTemplates.js";
import { formatCurrency } from "../../services/privacyService.js";
import {
  deleteContractTemplate as deleteContractTemplateFromStore,
  getContractTemplates,
  getStoredContractTemplates,
  saveContractTemplate,
  setDefaultContractTemplate as setDefaultContractTemplateInStore,
  subscribeToContractTemplates,
} from "./contractTemplatesStore.js";
import { createContractToken, getGeneratedContracts, saveGeneratedContracts } from "./generatedContractsStore.js";
import {
  getClients,
  getOwnerSignature as getOwnerSignatureFromService,
  getReservations,
  removeOwnerSignature as removeOwnerSignatureFromService,
  saveOwnerSignature as saveOwnerSignatureToService,
} from "../../services/dataService.js";

const tabs = [
  { id: "templates", label: "Modelos de contrato" },
  { id: "generated", label: "Contratos gerados" },
  { id: "signature", label: "Minha assinatura" },
];

const contractVariables = [
  "{{nome_cliente}}",
  "{{cpf_cliente}}",
  "{{telefone_cliente}}",
  "{{data_entrada}}",
  "{{hora_entrada}}",
  "{{data_saida}}",
  "{{hora_saida}}",
  "{{tipo_evento}}",
  "{{valor_total}}",
  "{{valor_sinal}}",
  "{{valor_restante}}",
  "{{forma_pagamento}}",
  "{{status_pagamento}}",
  "{{nome_sitio}}",
  "{{assinatura_proprietario}}",
  "{{assinatura_cliente}}",
  "{{data_assinatura}}",
];
export function createContractsPage() {
  let activeTab = "templates";
  let templates = getStoredContractTemplates();
  let generatedContracts = getGeneratedContracts();
  const clients = getStoredClients();
  const reservations = getStoredReservations();
  let ownerSignature = getStoredOwnerSignature();
  let editingTemplateId = null;

  const page = document.createElement("section");
  const tabsHost = document.createElement("div");
  const contentHost = document.createElement("div");
  const editorModal = createTemplateEditorModal({
    onSubmit: saveTemplate,
    onClose: closeEditor,
  });
  const viewerModal = createContractViewerModal({ onClose: closeViewer });
  const generatorModal = createContractGeneratorModal({
    clients,
    reservations,
    getDefaultTemplate,
    onSubmit: generateContract,
    onClose: closeGenerator,
  });
  const generatedEditorModal = createGeneratedContractEditorModal({
    onSubmit: saveGeneratedContract,
    onClose: closeGeneratedEditor,
  });
  const signatureModal = createClientSignatureModal({
    onSubmit: saveClientSignature,
    onClose: closeSignatureModal,
  });
  const ownerSignatureModal = createOwnerSignatureModal({
    onSubmit: saveOwnerSignature,
    onClose: closeOwnerSignatureModal,
  });

  page.className = "contracts-page";
  page.setAttribute("aria-labelledby", "contracts-title");
  page.append(
    createHeader(),
    tabsHost,
    contentHost,
    editorModal.element,
    viewerModal.element,
    generatorModal.element,
    generatedEditorModal.element,
    signatureModal.element,
    ownerSignatureModal.element,
  );

  render();
  loadContractTemplates();
  subscribeToContractTemplates((nextTemplates) => {
    templates = nextTemplates;
    render();
  });

  return page;

  async function loadContractTemplates() {
    templates = await getContractTemplates();
    render();
  }

  function render() {
    tabsHost.replaceChildren(createTabs(activeTab, (nextTab) => {
      activeTab = nextTab;
      render();
    }));
    contentHost.replaceChildren(createActiveTab(activeTab));
  }

  function createActiveTab(tabId) {
    if (tabId === "generated") {
      return createGeneratedContractsTab({
        contracts: generatedContracts,
        onCreate: openGenerator,
        onView: openGeneratedViewer,
        onEdit: openGeneratedEditor,
        onDownloadPdf: downloadGeneratedContractPdf,
        onSendWhatsApp: sendGeneratedContractWhatsApp,
        onSign: openSignatureModal,
        onDelete: deleteGeneratedContract,
      });
    }

    if (tabId === "signature") {
      return createSignatureTab({
        ownerSignature,
        onRegister: openOwnerSignatureModal,
        onDelete: deleteOwnerSignature,
      });
    }

    return createTemplatesTab({
      templates,
      onCreate: openCreateEditor,
      onView: openTemplateViewer,
      onEdit: openEditEditor,
      onDelete: deleteTemplate,
      onSetDefault: setDefaultTemplate,
    });
  }

  function openCreateEditor() {
    editingTemplateId = null;
    editorModal.open({
      title: "Novo modelo",
      template: {
        name: "",
        content: defaultContractContent,
      },
    });
  }

  function openEditEditor(templateId) {
    const template = templates.find((item) => item.id === templateId);

    if (!template) {
      return;
    }

    editingTemplateId = templateId;
    editorModal.open({
      title: "Editar modelo",
      template,
    });
  }

  function openTemplateViewer(templateId) {
    const template = templates.find((item) => item.id === templateId);

    if (!template) {
      return;
    }

    viewerModal.open({
      title: template.name,
      content: template.content,
    });
  }

  function openGeneratedViewer(contractId) {
    const contract = generatedContracts.find((item) => item.id === contractId);

    if (!contract) {
      return;
    }

    viewerModal.open({
      title: `Contrato - ${contract.client}`,
      content: getContractDisplayContent(contract),
      ownerSignature: getContractOwnerSignature(contract),
      clientSignature: contract.clientSignature,
      signedAt: contract.signedAt,
    });
  }

  function openGenerator() {
    generatorModal.open();
  }

  function openGeneratedEditor(contractId) {
    const contract = generatedContracts.find((item) => item.id === contractId);

    if (!contract) {
      return;
    }

    if (contract.status === "assinado") {
      window.alert("Contrato assinado não pode ser editado.");
      return;
    }

    generatedEditorModal.open(contract);
  }

  function openSignatureModal(contractId) {
    const contract = generatedContracts.find((item) => item.id === contractId);

    if (!contract?.content?.trim()) {
      window.alert("Não é possível assinar um contrato vazio.");
      return;
    }

    signatureModal.open(contract);
  }

  function openOwnerSignatureModal() {
    ownerSignatureModal.open(ownerSignature);
  }

  function closeEditor() {
    editingTemplateId = null;
    editorModal.close();
  }

  function closeViewer() {
    viewerModal.close();
  }

  function closeGenerator() {
    generatorModal.close();
  }

  function closeGeneratedEditor() {
    generatedEditorModal.close();
  }

  function closeSignatureModal() {
    signatureModal.close();
  }

  function closeOwnerSignatureModal() {
    ownerSignatureModal.close();
  }

  async function saveTemplate(formData) {
    if (!formData.name || !formData.content) {
      editorModal.showError("Nome do modelo e conteúdo do contrato são obrigatórios.");
      return;
    }

    let savedTemplate = null;

    if (editingTemplateId) {
      templates = templates.map((template) => (
        template.id === editingTemplateId
          ? (savedTemplate = {
              ...template,
              name: formData.name,
              content: formData.content,
              updatedAt: getTodayKey(),
            })
          : template
      ));
    } else {
      savedTemplate = {
        id: `modelo-${Date.now()}`,
        name: formData.name,
        status: "inativo",
        updatedAt: getTodayKey(),
        content: formData.content,
      };
      templates = [
        savedTemplate,
        ...templates,
      ];
    }

    await saveContractTemplate(savedTemplate);
    closeEditor();
    render();
  }

  function generateContract({ reservationId }) {
    if (!reservationId) {
      generatorModal.showError("Selecione uma reserva para gerar o contrato.");
      return;
    }

    const reservation = reservations.find((item) => item.id === reservationId);
    const template = getDefaultTemplate();
    const client = findClientForReservation(reservation, clients);

    if (!reservation) {
      generatorModal.showError("Reserva não encontrada. Atualize a página e tente novamente.");
      return;
    }

    if (!client) {
      generatorModal.showError("Cliente não encontrado para esta reserva. Verifique o cadastro do cliente antes de gerar o contrato.");
      return;
    }

    if (!template) {
      generatorModal.showError("Modelo de contrato padrão não encontrado.");
      return;
    }

    const validation = validateContractGenerationData({ reservation, client });

    if (validation.required.length) {
      generatorModal.showError(`Não é possível gerar o contrato. Dados obrigatórios faltando: ${validation.required.join(", ")}.`);
      return;
    }

    if (validation.optional.length) {
      const shouldContinue = window.confirm(
        `Alguns dados estão faltando: ${validation.optional.join(", ")}.\n\nDeseja gerar o contrato mesmo assim?`,
      );

      if (!shouldContinue) {
        return;
      }
    }

    const currentOwnerSignature = getStoredOwnerSignature() ?? ownerSignature;

    if (!currentOwnerSignature) {
      window.alert("Você ainda não cadastrou sua assinatura de proprietário.");
    }

    const content = fillContractTemplate(template.content, buildVariableMap({
      reservation,
      client,
      hasOwnerSignature: Boolean(currentOwnerSignature),
    }));
    const contract = {
      id: `contrato-${Date.now()}`,
      token: createContractToken(generatedContracts),
      clientId: reservation.clientId,
      clientName: client.name,
      reservationId: reservation.id,
      contractModelId: template.id,
      templateId: template.id,
      client: client.name,
      reservation: formatReservationPeriod(reservation),
      status: "gerado",
      generatedAt: getTodayKey(),
      content,
      contractText: content,
      ownerSignature: currentOwnerSignature,
      clientPhone: client.phone,
    };

    setGeneratedContracts([contract, ...generatedContracts]);
    closeGenerator();
    render();
  }

  function saveGeneratedContract({ contractId, content }) {
    if (!content.trim()) {
      generatedEditorModal.showError("O conteúdo do contrato não pode ficar vazio.");
      return;
    }

    setGeneratedContracts(generatedContracts.map((contract) => (
      contract.id === contractId
        ? { ...contract, content: content.trim(), contractText: content.trim() }
        : contract
    )));

    closeGeneratedEditor();
    render();
  }

  async function saveClientSignature({ contractId, signatureImage }) {
    const signedAt = new Date().toISOString();
    const contract = generatedContracts.find((item) => item.id === contractId);
    const evidence = await captureSignatureEvidence(contract?.token ?? "", signedAt);

    setGeneratedContracts(generatedContracts.map((contract) => (
      contract.id === contractId
        ? buildSignedContract(contract, signatureImage, signedAt, evidence)
        : contract
    )));

    closeSignatureModal();
    render();
  }

  function saveOwnerSignature({ signatureImage }) {
    ownerSignature = {
      image: signatureImage,
      signedAt: new Date().toISOString(),
    };

    saveStoredOwnerSignature(ownerSignature);
    closeOwnerSignatureModal();
    render();
  }

  function deleteOwnerSignature() {
    const shouldDelete = window.confirm("Tem certeza que deseja excluir sua assinatura de proprietário?");

    if (!shouldDelete) {
      return;
    }

    ownerSignature = null;
    removeStoredOwnerSignature();
    render();
  }

  async function downloadGeneratedContractPdf(contractId) {
    const contract = generatedContracts.find((item) => item.id === contractId);

    if (!contract?.content?.trim()) {
      window.alert("Não é possível gerar PDF de um contrato vazio.");
      return;
    }

    const pdfBytes = await createContractPdf({
      title: "Contrato - Sítio São Jorge",
      content: getContractDisplayContent(contract),
      ownerSignature: getContractOwnerSignature(contract),
      clientSignature: contract.clientSignature,
      signedAt: contract.signedAt,
      signatureEvidence: getContractSignatureEvidence(contract),
    });
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `contrato-sitio-sao-jorge-${slugifyFileName(contract.client)}.pdf`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function sendGeneratedContractWhatsApp(contractId) {
    let contract = generatedContracts.find((item) => item.id === contractId);

    if (!contract?.content?.trim()) {
      window.alert("Contrato ainda não foi gerado.");
      return;
    }

    const client = findClientForContract(contract);
    const rawPhone = contract.clientPhone || client?.phone || "";
    const whatsappPhone = formatWhatsAppPhone(rawPhone);

    if (!whatsappPhone) {
      window.alert("Telefone do cliente não encontrado.");
      return;
    }

    const token = contract.token ?? createContractToken(generatedContracts);
    const signingLink = `${PUBLIC_APP_URL}/assinar-contrato/${token}`;
    const message = [
      `Olá ${client?.name ?? contract.client ?? "cliente"}, tudo bem?`,
      "",
      "Segue o contrato de locação do Sítio São Jorge referente à sua reserva.",
      "",
      "Acesse o link abaixo, leia o contrato e assine digitalmente:",
      "",
      signingLink,
      "",
      "Obrigado.",
    ].join("\n");
    const finalWaUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;

    console.log("WHATSAPP CLIENTE:", {
      clientName: client?.name ?? contract.client ?? contract.clientName ?? "Cliente não informado",
      rawPhone,
      sanitizedPhone: whatsappPhone,
      finalWaUrl,
    });

    setGeneratedContracts(generatedContracts.map((item) => {
      if (item.id !== contractId) {
        return item;
      }

      contract = {
        ...item,
        token,
        status: "enviado",
      };

      return contract;
    }));

    window.open(
      finalWaUrl,
      "_blank",
      "noopener,noreferrer",
    );

    render();
  }

  async function deleteTemplate(templateId) {
    if (templates.length === 1) {
      window.alert("Não é possível excluir o único modelo existente.");
      return;
    }

    const shouldDelete = window.confirm("Tem certeza que deseja excluir este modelo?");

    if (!shouldDelete) {
      return;
    }

    const deletedTemplate = templates.find((template) => template.id === templateId);
    templates = templates.filter((template) => template.id !== templateId);

    if (deletedTemplate?.status === "padrão") {
      templates = templates.map((template, index) => ({
        ...template,
        status: index === 0 ? "padrão" : "inativo",
      }));
      await setDefaultContractTemplateInStore(templates[0].id, templates);
    }

    await deleteContractTemplateFromStore(templateId);
    render();
  }

  function deleteGeneratedContract(contractId) {
    const shouldDelete = window.confirm("Tem certeza que deseja excluir este contrato gerado?");

    if (!shouldDelete) {
      return;
    }

    setGeneratedContracts(generatedContracts.filter((contract) => contract.id !== contractId));
    render();
  }

  async function setDefaultTemplate(templateId) {
    const result = await setDefaultContractTemplateInStore(templateId, templates);
    templates = result.templates;
    render();
  }

  function getDefaultTemplate() {
    return templates.find((template) => template.status === "padrão") ?? templates[0];
  }

  function setGeneratedContracts(nextContracts) {
    generatedContracts = nextContracts;
    saveGeneratedContracts(generatedContracts);
  }
}

function buildSignedContract(contract, signatureImage, signedAt, evidence) {
  const signedContract = {
    ...contract,
    clientSignature: signatureImage,
    signedAt,
    signerIp: evidence.signerIp,
    signerUserAgent: evidence.signerUserAgent,
    signerTimezone: evidence.signerTimezone,
    signerLanguage: evidence.signerLanguage,
    signerPlatform: evidence.signerPlatform,
    signatureToken: evidence.signatureToken,
    status: "assinado",
  };

  return {
    ...signedContract,
    content: getContractDisplayContent(signedContract),
    contractText: getContractDisplayContent(signedContract),
  };
}

function createHeader() {
  const header = document.createElement("div");
  const kicker = document.createElement("p");
  const title = document.createElement("h2");
  const intro = document.createElement("p");

  header.className = "contracts-page__header";
  kicker.className = "page-panel__kicker";
  kicker.textContent = "SÍTIO SÃO JORGE";

  title.className = "contracts-page__title";
  title.id = "contracts-title";
  title.textContent = "Contratos";

  intro.className = "contracts-page__intro";
  intro.textContent = "Gestão de contratos, modelos e assinaturas digitais.";

  header.append(kicker, title, intro);

  return header;
}

function createTabs(activeTab, onChange) {
  const wrapper = document.createElement("div");

  wrapper.className = "contracts-tabs";

  tabs.forEach((tab) => {
    const button = document.createElement("button");

    button.className = `contracts-tabs__button${tab.id === activeTab ? " is-active" : ""}`;
    button.type = "button";
    button.textContent = tab.label;
    button.addEventListener("click", () => onChange(tab.id));
    wrapper.append(button);
  });

  return wrapper;
}

function createTemplatesTab({ templates, onCreate, onView, onEdit, onDelete, onSetDefault }) {
  const section = document.createElement("section");
  const header = document.createElement("div");
  const heading = document.createElement("h3");
  const button = document.createElement("button");
  const tableWrapper = document.createElement("div");
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");
  const columns = ["Nome do modelo", "Status", "ÚLTIMA ATUALIZAÇÃO", "AÇÕES"];

  section.className = "contracts-section";
  header.className = "contracts-section__header";
  heading.className = "contracts-section__title";
  heading.textContent = "Modelos de contrato";

  button.className = "button button--primary";
  button.type = "button";
  button.textContent = "Novo modelo";
  button.addEventListener("click", onCreate);

  tableWrapper.className = "contracts-table__wrapper";

  const headerRow = document.createElement("tr");
  columns.forEach((column) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = column;
    headerRow.append(th);
  });
  thead.append(headerRow);

  templates.forEach((template) => {
    const row = document.createElement("tr");
    const values = [template.name, formatStatus(template.status), formatDate(template.updatedAt)];

    values.forEach((value, index) => {
      const td = document.createElement("td");

      if (index === 1) {
        td.append(createStatusBadge(value, template.status));
      } else {
        td.textContent = value;
      }

      row.append(td);
    });

    const actions = document.createElement("td");
    actions.append(createTemplateActions({
      template,
      onView,
      onEdit,
      onDelete,
      onSetDefault,
    }));
    row.append(actions);
    tbody.append(row);
  });

  table.append(thead, tbody);
  tableWrapper.append(table);
  header.append(heading, button);
  section.append(header, tableWrapper);

  return section;
}

function createTemplateActions({ template, onView, onEdit, onDelete, onSetDefault }) {
  const wrapper = document.createElement("div");
  const viewButton = document.createElement("button");
  const editButton = document.createElement("button");
  const deleteButton = document.createElement("button");
  const defaultButton = document.createElement("button");

  wrapper.className = "contracts-table__actions";

  viewButton.className = "button button--secondary";
  viewButton.type = "button";
  viewButton.textContent = "Visualizar";
  viewButton.addEventListener("click", () => onView(template.id));

  editButton.className = "button button--secondary";
  editButton.type = "button";
  editButton.textContent = "Editar";
  editButton.addEventListener("click", () => onEdit(template.id));

  deleteButton.className = "button button--danger";
  deleteButton.type = "button";
  deleteButton.textContent = "Excluir";
  deleteButton.addEventListener("click", () => onDelete(template.id));

  defaultButton.className = "button button--secondary";
  defaultButton.type = "button";
  defaultButton.textContent = "Definir como padrão";
  defaultButton.disabled = template.status === "padrão";
  defaultButton.addEventListener("click", () => onSetDefault(template.id));

  wrapper.append(viewButton, editButton, deleteButton, defaultButton);

  return wrapper;
}

function createGeneratedContractsTab({
  contracts,
  onCreate,
  onView,
  onEdit,
  onDownloadPdf,
  onSendWhatsApp,
  onSign,
  onDelete,
}) {
  const section = document.createElement("section");
  const header = document.createElement("div");
  const heading = document.createElement("h3");
  const button = document.createElement("button");
  const tableWrapper = document.createElement("div");
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");
  const columns = ["Cliente", "Reserva/período", "Status", "Data de geração", "Assinatura", "AÇÕES"];

  section.className = "contracts-section";
  header.className = "contracts-section__header";
  heading.className = "contracts-section__title";
  heading.textContent = "Contratos gerados";

  button.className = "button button--primary";
  button.type = "button";
  button.textContent = "Gerar contrato";
  button.addEventListener("click", onCreate);

  tableWrapper.className = "contracts-table__wrapper";

  const headerRow = document.createElement("tr");
  columns.forEach((column) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = column;
    headerRow.append(th);
  });
  thead.append(headerRow);

  if (!contracts.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = columns.length;
    cell.textContent = "Nenhum contrato gerado";
    row.append(cell);
    tbody.append(row);
  }

  contracts.forEach((contract) => {
    const row = document.createElement("tr");
    const values = [
      contract.client || contract.clientName || "Cliente não informado",
      getGeneratedContractReservationLabel(contract),
      formatStatus(contract.status),
      formatDate(contract.generatedAt),
      getSignatureStatus(contract),
    ];

    values.forEach((value, index) => {
      const td = document.createElement("td");

      if (index === 2 || index === 4) {
        td.append(createStatusBadge(value, value));
      } else {
        td.textContent = value;
      }

      row.append(td);
    });

    const actions = document.createElement("td");
    actions.append(createGeneratedActions({
      contract,
      onView,
      onEdit,
      onDownloadPdf,
      onSendWhatsApp,
      onSign,
      onDelete,
    }));
    row.append(actions);
    tbody.append(row);
  });

  table.append(thead, tbody);
  tableWrapper.append(table);
  header.append(heading, button);
  section.append(header, tableWrapper);

  return section;
}

function createGeneratedActions({ contract, onView, onEdit, onDownloadPdf, onSendWhatsApp, onSign, onDelete }) {
  const wrapper = document.createElement("div");
  const viewButton = document.createElement("button");
  const editButton = document.createElement("button");
  const pdfButton = document.createElement("button");
  const whatsappButton = document.createElement("button");
  const signButton = document.createElement("button");
  const deleteButton = document.createElement("button");

  wrapper.className = "contracts-table__actions";

  viewButton.className = "button button--secondary";
  viewButton.type = "button";
  viewButton.textContent = "Visualizar";
  viewButton.addEventListener("click", () => onView(contract.id));

  editButton.className = "button button--secondary";
  editButton.type = "button";
  editButton.textContent = "Editar";
  editButton.disabled = contract.status === "assinado";
  editButton.addEventListener("click", () => onEdit(contract.id));

  pdfButton.className = "button button--secondary";
  pdfButton.type = "button";
  pdfButton.textContent = "Baixar PDF";
  pdfButton.addEventListener("click", () => onDownloadPdf(contract.id));

  whatsappButton.className = "button button--secondary";
  whatsappButton.type = "button";
  whatsappButton.textContent = "Enviar WhatsApp";
  whatsappButton.addEventListener("click", () => onSendWhatsApp(contract.id));

  signButton.className = "button button--secondary";
  signButton.type = "button";
  signButton.textContent = "Assinar cliente";
  signButton.disabled = contract.status === "assinado";
  signButton.addEventListener("click", () => onSign(contract.id));

  deleteButton.className = "button button--danger";
  deleteButton.type = "button";
  deleteButton.textContent = "Excluir";
  deleteButton.addEventListener("click", () => onDelete(contract.id));

  wrapper.append(viewButton, editButton, pdfButton, whatsappButton, signButton, deleteButton);

  return wrapper;
}

function createSignatureTab({ ownerSignature, onRegister, onDelete }) {
  const section = document.createElement("section");
  const title = document.createElement("h3");
  const card = document.createElement("div");
  const text = document.createElement("p");
  const preview = document.createElement("img");
  const actions = document.createElement("div");
  const button = document.createElement("button");
  const deleteButton = document.createElement("button");

  section.className = "contracts-section";
  title.className = "contracts-section__title";
  title.textContent = "Minha assinatura";

  card.className = "contracts-signature";
  text.className = "contracts-signature__text";
  text.textContent = ownerSignature
    ? "Assinatura do proprietário cadastrada"
    : "Nenhuma assinatura cadastrada ainda";

  preview.className = "contracts-signature__preview";
  preview.alt = "Assinatura do proprietário";
  preview.hidden = !ownerSignature;

  if (ownerSignature) {
    preview.src = ownerSignature.image;
  }

  actions.className = "contracts-signature__actions";

  button.className = "button button--primary";
  button.type = "button";
  button.textContent = ownerSignature ? "Atualizar assinatura" : "Cadastrar assinatura";
  button.addEventListener("click", onRegister);

  actions.append(button);

  if (ownerSignature) {
    deleteButton.className = "button button--danger";
    deleteButton.type = "button";
    deleteButton.textContent = "Excluir assinatura";
    deleteButton.addEventListener("click", onDelete);
    actions.append(deleteButton);
  }

  card.append(text, preview, actions);
  section.append(title, card);

  return section;
}

function createTemplateEditorModal({ onSubmit, onClose }) {
  const overlay = document.createElement("div");
  const dialog = document.createElement("div");
  const header = document.createElement("div");
  const title = document.createElement("h3");
  const closeButton = document.createElement("button");
  const form = document.createElement("form");
  const nameField = createEditorField("Nome do modelo", "input");
  const contentField = createEditorField("Contrato", "textarea");
  const variables = createVariablesPanel();
  const error = document.createElement("p");
  const actions = document.createElement("div");
  const cancelButton = document.createElement("button");
  const saveButton = document.createElement("button");

  overlay.className = "contract-modal";
  overlay.hidden = true;
  dialog.className = "contract-modal__dialog contract-modal__dialog--wide";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "contract-editor-title");

  header.className = "contract-modal__header";
  title.className = "contract-modal__title";
  title.id = "contract-editor-title";

  closeButton.className = "contract-modal__close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Fechar editor");
  closeButton.textContent = "×";
  closeButton.addEventListener("click", onClose);

  form.className = "contract-editor";
  nameField.input.name = "name";
  contentField.input.name = "content";
  contentField.input.rows = 16;

  error.className = "contract-editor__error";
  error.hidden = true;

  actions.className = "contract-editor__actions";
  cancelButton.className = "button button--secondary";
  cancelButton.type = "button";
  cancelButton.textContent = "Cancelar";
  cancelButton.addEventListener("click", onClose);

  saveButton.className = "button button--primary";
  saveButton.type = "submit";
  saveButton.textContent = "Salvar";

  actions.append(cancelButton, saveButton);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    error.hidden = true;
    onSubmit({
      name: nameField.input.value.trim(),
      content: contentField.input.value.trim(),
    });
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      onClose();
    }
  });

  header.append(title, closeButton);
  form.append(nameField.wrapper, contentField.wrapper, variables, error, actions);
  dialog.append(header, form);
  overlay.append(dialog);

  return {
    element: overlay,
    open({ title: nextTitle, template }) {
      title.textContent = nextTitle;
      error.hidden = true;
      nameField.input.value = template.name ?? "";
      contentField.input.value = template.content ?? "";
      overlay.hidden = false;
      nameField.input.focus();
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
}

function createContractGeneratorModal({ clients, reservations, getDefaultTemplate, onSubmit, onClose }) {
  const overlay = document.createElement("div");
  const dialog = document.createElement("div");
  const header = document.createElement("div");
  const title = document.createElement("h3");
  const closeButton = document.createElement("button");
  const form = document.createElement("form");
  const reservationField = createGeneratorSelect("Selecionar reserva", "reservationId");
  const templateField = createGeneratorSelect("Modelo de contrato", "templateId");
  const summary = document.createElement("div");
  const error = document.createElement("p");
  const actions = document.createElement("div");
  const cancelButton = document.createElement("button");
  const submitButton = document.createElement("button");

  overlay.className = "contract-modal";
  overlay.hidden = true;
  dialog.className = "contract-modal__dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "contract-generator-title");

  header.className = "contract-modal__header";
  title.className = "contract-modal__title";
  title.id = "contract-generator-title";
  title.textContent = "Gerar contrato";

  closeButton.className = "contract-modal__close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Fechar geração de contrato");
  closeButton.textContent = "×";
  closeButton.addEventListener("click", onClose);

  form.className = "contract-generator";
  summary.className = "contract-generator__summary";
  error.className = "contract-editor__error";
  error.hidden = true;

  if (!reservations.length) {
    appendOption(reservationField.input, "", "Nenhuma reserva cadastrada");
  }

  reservations.forEach((reservation) => {
    const client = clients.find((item) => item.id === reservation.clientId);
    appendOption(
      reservationField.input,
      reservation.id,
      `${formatDate(reservation.dataEntrada)} - ${client?.name ?? reservation.clientName ?? "Cliente não encontrado"} - ${reservation.eventType || "Evento não informado"}`,
    );
  });

  actions.className = "contract-editor__actions";
  cancelButton.className = "button button--secondary";
  cancelButton.type = "button";
  cancelButton.textContent = "Cancelar";
  cancelButton.addEventListener("click", onClose);

  submitButton.className = "button button--primary";
  submitButton.type = "submit";
  submitButton.textContent = "Gerar contrato";

  actions.append(cancelButton, submitButton);

  reservationField.input.addEventListener("change", () => {
    summary.replaceChildren(createReservationPreview({
      reservation: reservations.find((item) => item.id === reservationField.input.value),
      clients,
    }));
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    error.hidden = true;
    onSubmit({
      reservationId: reservationField.input.value,
      templateId: templateField.input.value,
    });
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      onClose();
    }
  });

  header.append(title, closeButton);
  form.append(reservationField.wrapper, templateField.wrapper, summary, error, actions);
  dialog.append(header, form);
  overlay.append(dialog);

  return {
    element: overlay,
    open() {
      const template = getDefaultTemplate();
      templateField.input.replaceChildren();
      appendOption(templateField.input, template.id, template.name);
      templateField.input.value = template.id;
      summary.replaceChildren(createReservationPreview({
        reservation: reservations.find((item) => item.id === reservationField.input.value),
        clients,
      }));
      error.hidden = true;
      overlay.hidden = false;
      reservationField.input.focus();
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
}

function createGeneratedContractEditorModal({ onSubmit, onClose }) {
  const overlay = document.createElement("div");
  const dialog = document.createElement("div");
  const header = document.createElement("div");
  const title = document.createElement("h3");
  const closeButton = document.createElement("button");
  const form = document.createElement("form");
  const reference = document.createElement("p");
  const field = createEditorField("Conteúdo do contrato", "textarea");
  const error = document.createElement("p");
  const actions = document.createElement("div");
  const cancelButton = document.createElement("button");
  const saveButton = document.createElement("button");
  let currentContractId = null;

  overlay.className = "contract-modal";
  overlay.hidden = true;
  dialog.className = "contract-modal__dialog contract-modal__dialog--wide";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "generated-contract-editor-title");

  header.className = "contract-modal__header";
  title.className = "contract-modal__title";
  title.id = "generated-contract-editor-title";
  title.textContent = "Editar contrato gerado";

  closeButton.className = "contract-modal__close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Fechar editor");
  closeButton.textContent = "×";
  closeButton.addEventListener("click", onClose);

  form.className = "generated-contract-editor";
  reference.className = "generated-contract-editor__reference";
  field.input.name = "content";
  field.input.rows = 18;

  error.className = "contract-editor__error";
  error.hidden = true;

  actions.className = "contract-editor__actions";

  cancelButton.className = "button button--secondary";
  cancelButton.type = "button";
  cancelButton.textContent = "Cancelar";
  cancelButton.addEventListener("click", onClose);

  saveButton.className = "button button--primary";
  saveButton.type = "submit";
  saveButton.textContent = "Salvar alterações";

  actions.append(cancelButton, saveButton);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    error.hidden = true;
    onSubmit({
      contractId: currentContractId,
      content: field.input.value,
    });
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      onClose();
    }
  });

  header.append(title, closeButton);
  form.append(reference, field.wrapper, error, actions);
  dialog.append(header, form);
  overlay.append(dialog);

  return {
    element: overlay,
    open(contract) {
      currentContractId = contract.id;
      reference.textContent = `${contract.client} - ${contract.reservation}`;
      field.input.value = contract.content;
      error.hidden = true;
      overlay.hidden = false;
      field.input.focus();
    },
    close() {
      currentContractId = null;
      overlay.hidden = true;
      form.reset();
    },
    showError(message) {
      error.textContent = message;
      error.hidden = false;
    },
  };
}

function createClientSignatureModal({ onSubmit, onClose }) {
  const overlay = document.createElement("div");
  const dialog = document.createElement("div");
  const header = document.createElement("div");
  const title = document.createElement("h3");
  const closeButton = document.createElement("button");
  const body = document.createElement("div");
  const summary = document.createElement("p");
  const canvas = document.createElement("canvas");
  const checkboxLabel = document.createElement("label");
  const checkbox = document.createElement("input");
  const checkboxText = document.createElement("span");
  const error = document.createElement("p");
  const actions = document.createElement("div");
  const clearButton = document.createElement("button");
  const cancelButton = document.createElement("button");
  const confirmButton = document.createElement("button");
  let currentContract = null;
  let isDrawing = false;
  let hasSignature = false;

  overlay.className = "contract-modal";
  overlay.hidden = true;
  dialog.className = "contract-modal__dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "client-signature-title");

  header.className = "contract-modal__header";
  title.className = "contract-modal__title";
  title.id = "client-signature-title";
  title.textContent = "Assinar cliente";

  closeButton.className = "contract-modal__close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Fechar assinatura");
  closeButton.textContent = "×";
  closeButton.addEventListener("click", onClose);

  body.className = "client-signature";
  summary.className = "client-signature__summary";

  canvas.className = "client-signature__canvas";
  canvas.width = 720;
  canvas.height = 260;

  checkboxLabel.className = "client-signature__checkbox";
  checkbox.type = "checkbox";
  checkboxText.textContent = "Confirmo que li e concordo com os termos deste contrato.";
  checkboxLabel.append(checkbox, checkboxText);

  error.className = "contract-editor__error";
  error.hidden = true;

  actions.className = "client-signature__actions";

  clearButton.className = "button button--secondary";
  clearButton.type = "button";
  clearButton.textContent = "Limpar assinatura";
  clearButton.addEventListener("click", clearCanvas);

  cancelButton.className = "button button--secondary";
  cancelButton.type = "button";
  cancelButton.textContent = "Cancelar";
  cancelButton.addEventListener("click", onClose);

  confirmButton.className = "button button--primary";
  confirmButton.type = "button";
  confirmButton.textContent = "Confirmar assinatura";
  confirmButton.addEventListener("click", () => {
    if (!hasSignature) {
      showError("Faça a assinatura antes de confirmar.");
      return;
    }

    if (!checkbox.checked) {
      showError("Confirme que leu e concorda com os termos do contrato.");
      return;
    }

    onSubmit({
      contractId: currentContract.id,
      signatureImage: canvas.toDataURL("image/png"),
    });
  });

  canvas.addEventListener("pointerdown", (event) => {
    isDrawing = true;
    hasSignature = true;
    canvas.setPointerCapture(event.pointerId);
    drawPoint(event);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!isDrawing) {
      return;
    }

    drawPoint(event);
  });

  canvas.addEventListener("pointerup", () => {
    isDrawing = false;
    getCanvasContext().beginPath();
  });

  canvas.addEventListener("pointerleave", () => {
    isDrawing = false;
    getCanvasContext().beginPath();
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      onClose();
    }
  });

  header.append(title, closeButton);
  actions.append(clearButton, cancelButton, confirmButton);
  body.append(summary, canvas, checkboxLabel, error, actions);
  dialog.append(header, body);
  overlay.append(dialog);

  return {
    element: overlay,
    open(contract) {
      currentContract = contract;
      summary.textContent = `${contract.client} - ${contract.reservation}`;
      checkbox.checked = false;
      error.hidden = true;
      clearCanvas();
      overlay.hidden = false;
    },
    close() {
      currentContract = null;
      overlay.hidden = true;
      checkbox.checked = false;
      clearCanvas();
    },
  };

  function drawPoint(event) {
    const context = getCanvasContext();
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    context.lineWidth = 3;
    context.lineCap = "round";
    context.strokeStyle = "#142019";
    context.lineTo(x, y);
    context.stroke();
    context.beginPath();
    context.moveTo(x, y);
  }

  function clearCanvas() {
    const context = getCanvasContext();
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.beginPath();
    hasSignature = false;
  }

  function getCanvasContext() {
    return canvas.getContext("2d");
  }

  function showError(message) {
    error.textContent = message;
    error.hidden = false;
  }
}

function createOwnerSignatureModal({ onSubmit, onClose }) {
  const overlay = document.createElement("div");
  const dialog = document.createElement("div");
  const header = document.createElement("div");
  const title = document.createElement("h3");
  const closeButton = document.createElement("button");
  const body = document.createElement("div");
  const summary = document.createElement("p");
  const canvas = document.createElement("canvas");
  const error = document.createElement("p");
  const actions = document.createElement("div");
  const clearButton = document.createElement("button");
  const cancelButton = document.createElement("button");
  const confirmButton = document.createElement("button");
  let isDrawing = false;
  let hasSignature = false;

  overlay.className = "contract-modal";
  overlay.hidden = true;
  dialog.className = "contract-modal__dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "owner-signature-title");

  header.className = "contract-modal__header";
  title.className = "contract-modal__title";
  title.id = "owner-signature-title";
  title.textContent = "Minha assinatura";

  closeButton.className = "contract-modal__close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Fechar assinatura");
  closeButton.textContent = "×";
  closeButton.addEventListener("click", onClose);

  body.className = "client-signature";
  summary.className = "client-signature__summary";
  summary.textContent = "Assinatura do proprietário/locador";

  canvas.className = "client-signature__canvas";
  canvas.width = 720;
  canvas.height = 260;

  error.className = "contract-editor__error";
  error.hidden = true;

  actions.className = "client-signature__actions";

  clearButton.className = "button button--secondary";
  clearButton.type = "button";
  clearButton.textContent = "Limpar assinatura";
  clearButton.addEventListener("click", clearCanvas);

  cancelButton.className = "button button--secondary";
  cancelButton.type = "button";
  cancelButton.textContent = "Cancelar";
  cancelButton.addEventListener("click", onClose);

  confirmButton.className = "button button--primary";
  confirmButton.type = "button";
  confirmButton.textContent = "Salvar assinatura";
  confirmButton.addEventListener("click", () => {
    if (!hasSignature) {
      error.textContent = "Faça a assinatura antes de salvar.";
      error.hidden = false;
      return;
    }

    onSubmit({
      signatureImage: canvas.toDataURL("image/png"),
    });
  });

  canvas.addEventListener("pointerdown", (event) => {
    isDrawing = true;
    hasSignature = true;
    canvas.setPointerCapture(event.pointerId);
    drawPoint(event);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (isDrawing) {
      drawPoint(event);
    }
  });

  canvas.addEventListener("pointerup", () => {
    isDrawing = false;
    getCanvasContext().beginPath();
  });

  canvas.addEventListener("pointerleave", () => {
    isDrawing = false;
    getCanvasContext().beginPath();
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      onClose();
    }
  });

  header.append(title, closeButton);
  actions.append(clearButton, cancelButton, confirmButton);
  body.append(summary, canvas, error, actions);
  dialog.append(header, body);
  overlay.append(dialog);

  return {
    element: overlay,
    open(signature) {
      error.hidden = true;
      clearCanvas();
      overlay.hidden = false;

      if (signature?.image) {
        drawExistingSignature(signature.image);
      }
    },
    close() {
      overlay.hidden = true;
      clearCanvas();
    },
  };

  function drawPoint(event) {
    const context = getCanvasContext();
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    context.lineWidth = 3;
    context.lineCap = "round";
    context.strokeStyle = "#142019";
    context.lineTo(x, y);
    context.stroke();
    context.beginPath();
    context.moveTo(x, y);
  }

  function drawExistingSignature(imageSrc) {
    const image = new Image();

    image.onload = () => {
      getCanvasContext().drawImage(image, 0, 0, canvas.width, canvas.height);
      hasSignature = true;
    };

    image.src = imageSrc;
  }

  function clearCanvas() {
    const context = getCanvasContext();
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.beginPath();
    hasSignature = false;
  }

  function getCanvasContext() {
    return canvas.getContext("2d");
  }
}

function createContractViewerModal({ onClose }) {
  const overlay = document.createElement("div");
  const dialog = document.createElement("div");
  const header = document.createElement("div");
  const title = document.createElement("h3");
  const closeButton = document.createElement("button");
  const body = document.createElement("div");
  const content = document.createElement("pre");
  const ownerSignatureBlock = createViewerSignatureBlock("Assinatura do proprietário");
  const clientSignatureBlock = createViewerSignatureBlock("Assinatura do cliente");

  overlay.className = "contract-modal";
  overlay.hidden = true;
  dialog.className = "contract-modal__dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "contract-viewer-title");

  header.className = "contract-modal__header";
  title.className = "contract-modal__title";
  title.id = "contract-viewer-title";

  closeButton.className = "contract-modal__close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Fechar visualização");
  closeButton.textContent = "×";
  closeButton.addEventListener("click", onClose);

  content.className = "contract-viewer__content";
  body.className = "contract-viewer";

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      onClose();
    }
  });

  header.append(title, closeButton);
  body.append(content, ownerSignatureBlock.element, clientSignatureBlock.element);
  dialog.append(header, body);
  overlay.append(dialog);

  return {
    element: overlay,
    open({ title: nextTitle, content: nextContent, ownerSignature, clientSignature, signedAt }) {
      title.textContent = nextTitle;
      content.textContent = nextContent;
      ownerSignatureBlock.update({
        image: ownerSignature?.image,
        dateText: ownerSignature?.signedAt
          ? `Assinatura cadastrada em ${formatDateTime(ownerSignature.signedAt)}`
          : "Assinatura do locador pendente",
      });
      clientSignatureBlock.update({
        image: clientSignature,
        dateText: signedAt ? `Assinado em ${formatDateTime(signedAt)}` : "Assinatura do cliente pendente",
      });

      overlay.hidden = false;
    },
    close() {
      overlay.hidden = true;
    },
  };
}

function createViewerSignatureBlock(titleText) {
  const element = document.createElement("div");
  const title = document.createElement("h4");
  const image = document.createElement("img");
  const date = document.createElement("p");

  element.className = "contract-viewer__signature";
  title.textContent = titleText;
  image.alt = titleText;
  date.className = "contract-viewer__signature-date";
  element.append(title, image, date);

  return {
    element,
    update({ image: imageSrc, dateText }) {
      image.hidden = !imageSrc;
      image.src = imageSrc || "";
      date.textContent = dateText;
    },
  };
}

function createEditorField(label, control) {
  const wrapper = document.createElement("label");
  const labelElement = document.createElement("span");
  const input = control === "textarea"
    ? document.createElement("textarea")
    : document.createElement("input");

  wrapper.className = "contract-editor__field";
  labelElement.textContent = label;

  if (control !== "textarea") {
    input.type = "text";
  }

  wrapper.append(labelElement, input);

  return { wrapper, input };
}

function createGeneratorSelect(label, name) {
  const wrapper = document.createElement("label");
  const labelElement = document.createElement("span");
  const input = document.createElement("select");

  wrapper.className = "contract-generator__field";
  labelElement.textContent = label;
  input.name = name;

  if (name === "reservationId") {
    appendOption(input, "", "Selecione uma reserva");
  }

  wrapper.append(labelElement, input);

  return { wrapper, input };
}

function createReservationPreview({ reservation, clients }) {
  const wrapper = document.createElement("section");

  wrapper.className = "contract-generator__preview";

  if (!reservation) {
    const empty = document.createElement("p");

    empty.textContent = "Selecione uma reserva para conferir os dados que serão usados no contrato.";
    wrapper.append(empty);
    return wrapper;
  }

  const client = clients.find((item) => item.id === reservation.clientId);
  const title = document.createElement("h4");
  const grid = document.createElement("dl");
  const remainingValue = calculateRemainingValue(reservation);
  const rows = [
    ["Cliente", client?.name ?? reservation.clientName ?? "Cliente não encontrado"],
    ["Telefone", client?.phone || "Não informado"],
    ["CPF/CNPJ", getClientDocument(client) || "Não informado"],
    ["Entrada", `${formatDate(reservation.dataEntrada)} ${reservation.horaEntrada || ""}`.trim()],
    ["Saída", `${formatDate(reservation.dataSaida)} ${reservation.horaSaida || ""}`.trim()],
    ["Tipo de evento", reservation.eventType || "Não informado"],
    ["Valor total", formatCurrency(reservation.totalValue)],
    ["Sinal", formatCurrency(reservation.depositValue)],
    ["Restante", formatCurrency(remainingValue)],
    ["Forma de pagamento", reservation.paymentMethod || "Não informado"],
    ["Status do pagamento", reservation.paymentStatus || "Pendente"],
  ];

  title.textContent = "Dados que serão usados no contrato";
  grid.className = "contract-generator__preview-grid";

  rows.forEach(([label, value]) => {
    const term = document.createElement("dt");
    const description = document.createElement("dd");

    term.textContent = label;
    description.textContent = value || "Não informado";
    grid.append(term, description);
  });

  wrapper.append(title, grid);

  return wrapper;
}

function getStoredClients() {
  return getClients();
}

function getStoredReservations() {
  return getReservations();
}

function appendOption(select, value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  select.append(option);
}

function createVariablesPanel() {
  const panel = document.createElement("aside");
  const title = document.createElement("p");
  const list = document.createElement("div");

  panel.className = "contract-variables";
  title.className = "contract-variables__title";
  title.textContent = "Variáveis disponíveis";
  list.className = "contract-variables__list";

  contractVariables.forEach((variable) => {
    const item = document.createElement("code");
    item.textContent = variable;
    list.append(item);
  });

  panel.append(title, list);

  return panel;
}

function fillContractTemplate(templateContent, variables) {
  return Object.entries(variables).reduce((content, [key, value]) => (
    content.replaceAll(key, value)
  ), templateContent);
}

function validateContractGenerationData({ reservation, client }) {
  const required = [];
  const optional = [];

  [
    ["nome do cliente", client?.name],
    ["CPF/CNPJ do cliente", getClientDocument(client)],
    ["telefone do cliente", client?.phone],
    ["data de entrada", reservation?.dataEntrada],
    ["hora de entrada", reservation?.horaEntrada],
    ["data de saída", reservation?.dataSaida],
    ["hora de saída", reservation?.horaSaida],
    ["valor total", Number(reservation?.totalValue || 0) > 0 ? reservation.totalValue : ""],
  ].forEach(([label, value]) => {
    if (!value) {
      required.push(label);
    }
  });

  [
    ["valor do sinal", reservation?.depositValue],
    ["valor restante", calculateRemainingValue(reservation)],
    ["forma de pagamento", reservation?.paymentMethod],
    ["status do pagamento", reservation?.paymentStatus],
    ["tipo de evento", reservation?.eventType],
  ].forEach(([label, value]) => {
    if (value === "" || value === null || value === undefined) {
      optional.push(label);
    }
  });

  return { required, optional };
}

function buildVariableMap({ reservation, client, hasOwnerSignature }) {
  const remainingValue = calculateRemainingValue(reservation);

  return {
    "{{nome_cliente}}": client.name,
    "{{cpf_cliente}}": getClientDocument(client) || "Não informado",
    "{{telefone_cliente}}": client.phone || "Não informado",
    "{{data_entrada}}": formatDate(reservation.dataEntrada),
    "{{hora_entrada}}": reservation.horaEntrada,
    "{{data_saida}}": formatDate(reservation.dataSaida),
    "{{hora_saida}}": reservation.horaSaida,
    "{{tipo_evento}}": reservation.eventType || "Não informado",
    "{{valor_total}}": formatMoneyValue(reservation.totalValue),
    "{{valor_sinal}}": formatMoneyValue(reservation.depositValue),
    "{{valor_restante}}": formatMoneyValue(remainingValue),
    "{{forma_pagamento}}": reservation.paymentMethod || "Não informado",
    "{{status_pagamento}}": reservation.paymentStatus || "Pendente",
    "{{nome_sitio}}": "Sítio São Jorge",
    "{{assinatura_proprietario}}": hasOwnerSignature
      ? "Assinatura do locador anexada"
      : "Assinatura do locador pendente",
    "{{assinatura_cliente}}": "Assinatura do locatário pendente",
    "{{data_assinatura}}": "Data da assinatura pendente",
  };
}

function getContractDisplayContent(contract) {
  return applySignaturePlaceholders(contract.content ?? "", contract);
}

function applySignaturePlaceholders(content, contract) {
  const hasClientSignature = Boolean(contract.clientSignature);
  const signedDate = contract.signedAt ? formatDateTime(contract.signedAt) : "";

  return content
    .replaceAll("{{assinatura_cliente}}", hasClientSignature
      ? "Assinatura do locatário anexada"
      : "Assinatura do locatário pendente")
    .replaceAll("{{data_assinatura}}", signedDate || "Data da assinatura pendente")
    .replaceAll("Assinatura do locatário pendente", hasClientSignature
      ? "Assinatura do locatário anexada"
      : "Assinatura do locatário pendente")
    .replaceAll("Data da assinatura pendente", signedDate || "Data da assinatura pendente");
}

function getContractSignatureEvidence(contract) {
  return {
    signedAt: contract.signedAt,
    signerIp: contract.signerIp || "IP não capturado",
    signerUserAgent: contract.signerUserAgent || "Não informado",
    signerTimezone: contract.signerTimezone || "Não informado",
    signerLanguage: contract.signerLanguage || "Não informado",
    signerPlatform: contract.signerPlatform || "Não informado",
    signatureToken: contract.signatureToken || contract.token || "Não informado",
  };
}

async function captureSignatureEvidence(token, signedAt) {
  return {
    signedAt,
    signerIp: await captureSignerIp(),
    signerUserAgent: navigator.userAgent || "Não informado",
    signerTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Não informado",
    signerLanguage: navigator.language || "Não informado",
    signerPlatform: navigator.platform || "Não informado",
    signatureToken: token || "Não informado",
  };
}

async function captureSignerIp() {
  try {
    const response = await fetch("https://api.ipify.org?format=json", {
      cache: "no-store",
    });

    if (!response.ok) {
      return "IP não capturado";
    }

    const data = await response.json();
    return data.ip || "IP não capturado";
  } catch {
    return "IP não capturado";
  }
}

function findClientForReservation(reservation, storedClients = getStoredClients()) {
  if (!reservation?.clientId) {
    return null;
  }

  return storedClients.find((client) => client.id === reservation.clientId) ?? null;
}

function findClientForContract(contract) {
  const storedClients = getStoredClients();
  const storedReservations = getStoredReservations();

  if (contract.reservationId) {
    const reservation = storedReservations.find((item) => item.id === contract.reservationId);
    const clientByReservation = findClientForReservation(reservation, storedClients);

    if (clientByReservation) {
      return clientByReservation;
    }
  }

  if (contract.clientId) {
    const clientById = storedClients.find((client) => client.id === contract.clientId);

    if (clientById) {
      return clientById;
    }
  }

  return storedClients.find((client) => client.name === contract.client);
}

function cleanPhone(value) {
  return value.replace(/\D/g, "");
}

function formatWhatsAppPhone(value) {
  const digits = cleanPhone(value || "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith("55")) {
    return digits;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return digits;
}

function getGeneratedContractReservationLabel(contract) {
  const reservation = getStoredReservations().find((item) => item.id === contract.reservationId);

  if (reservation) {
    return formatReservationPeriod(reservation);
  }

  return contract.reservation || "Reserva não informada";
}

function getSignatureStatus(contract) {
  return contract.status === "assinado" || contract.clientSignature || contract.signedAt
    ? "Assinado"
    : "Pendente";
}

function formatReservationPeriod(reservation) {
  if (!reservation) {
    return "Reserva não informada";
  }

  const entrada = `${formatDate(reservation.dataEntrada)} ${reservation.horaEntrada || ""}`.trim();
  const saida = `${formatDate(reservation.dataSaida)} ${reservation.horaSaida || ""}`.trim();

  return `${entrada} até ${saida}`;
}

function calculateRemainingValue(reservation) {
  return Math.max(
    Number(reservation?.remainingValue ?? reservation?.remaining_value ?? 0)
    || (Number(reservation?.totalValue || 0) - Number(reservation?.depositValue || 0)),
    0,
  );
}

function getClientDocument(client) {
  return client?.document || client?.cpfCnpj || client?.cpf_cnpj || client?.cpf || client?.cnpj || "";
}

function getContractOwnerSignature(contract) {
  return contract.ownerSignature ?? getStoredOwnerSignature();
}

function getStoredOwnerSignature() {
  return getOwnerSignatureFromService();
}

function saveStoredOwnerSignature(signature) {
  try {
    saveOwnerSignatureToService(signature);
  } catch {
    window.alert("Não foi possível salvar a assinatura no armazenamento local.");
  }
}

function removeStoredOwnerSignature() {
  try {
    removeOwnerSignatureFromService();
  } catch {
    window.alert("Não foi possível remover a assinatura do armazenamento local.");
  }
}

async function createContractPdf({ title, content, ownerSignature, clientSignature, signedAt, signatureEvidence }) {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginX = 54;
  const marginTop = 62;
  const marginBottom = 54;
  const bodyFontSize = 10.5;
  const lineHeight = 15;
  const maxLineLength = 92;
  const pages = paginatePdfLines(wrapPdfText(content, maxLineLength), {
    pageHeight,
    marginTop,
    marginBottom,
    lineHeight,
  });
  const objects = [];
  const pageObjectIds = [];
  const imageObjects = [];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");

  pages.forEach((lines) => {
    const pageObjectId = objects.length + 1;
    const contentObjectId = pageObjectId + 1;
    const stream = createPdfPageStream({
      title,
      lines,
      pageWidth,
      pageHeight,
      marginX,
      marginTop,
      bodyFontSize,
      lineHeight,
    });

    pageObjectIds.push(pageObjectId);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >>`);
    objects.push(`<< /Length ${toWinAnsiBinary(stream).length} >>\nstream\n${stream}\nendstream`);
  });

  const ownerImage = ownerSignature?.image ? await dataUrlToJpeg(ownerSignature.image) : null;
  const clientImage = clientSignature ? await dataUrlToJpeg(clientSignature) : null;

  if (ownerImage) {
    imageObjects.push({
      id: objects.length + 1,
      name: "OwnerSignature",
      image: ownerImage,
    });
    objects.push(createImageObject(ownerImage));
  }

  if (clientImage) {
    imageObjects.push({
      id: objects.length + 1,
      name: "ClientSignature",
      image: clientImage,
    });
    objects.push(createImageObject(clientImage));
  }

  const signaturePageObjectId = objects.length + 1;
  const signatureContentObjectId = signaturePageObjectId + 1;
  const signatureStream = createPdfSignaturePageStream({
    pageWidth,
    pageHeight,
    marginX,
    marginTop,
    ownerImage,
    clientImage,
    signedAt,
    signatureEvidence,
  });
  const xObjects = imageObjects.length
    ? `/XObject << ${imageObjects.map((image) => `/${image.name} ${image.id} 0 R`).join(" ")} >>`
    : "";

  pageObjectIds.push(signaturePageObjectId);
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R >> ${xObjects} >> /Contents ${signatureContentObjectId} 0 R >>`);
  objects.push(`<< /Length ${toWinAnsiBinary(signatureStream).length} >>\nstream\n${signatureStream}\nendstream`);

  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`;

  return buildPdfBytes(objects);
}

function createPdfPageStream({ title, lines, pageWidth, pageHeight, marginX, marginTop, bodyFontSize, lineHeight }) {
  const commands = [];
  const titleFontSize = 16;
  let y = pageHeight - marginTop;

  commands.push("BT");
  commands.push(`/F1 ${titleFontSize} Tf`);
  commands.push(`${(pageWidth / 2 - estimatePdfTextWidth(title, titleFontSize) / 2).toFixed(2)} ${y.toFixed(2)} Td`);
  commands.push(`(${escapePdfText(title)}) Tj`);
  commands.push("ET");

  y -= 34;

  lines.forEach((line) => {
    commands.push("BT");
    commands.push(`/F1 ${bodyFontSize} Tf`);
    commands.push(`${marginX} ${y.toFixed(2)} Td`);
    commands.push(`(${escapePdfText(line)}) Tj`);
    commands.push("ET");
    y -= lineHeight;
  });

  return commands.join("\n");
}

function createPdfSignaturePageStream({ pageWidth, pageHeight, marginX, marginTop, ownerImage, clientImage, signedAt, signatureEvidence }) {
  const commands = [];
  let y = pageHeight - marginTop;

  addPdfText(commands, "Assinaturas", marginX, y, 16);
  y -= 42;

  y = addPdfSignatureSection({
    commands,
    title: "Assinatura do proprietário",
    imageName: "OwnerSignature",
    hasImage: Boolean(ownerImage),
    x: marginX,
    y,
  });

  y -= 28;

  y = addPdfSignatureSection({
    commands,
    title: "Assinatura do cliente",
    imageName: "ClientSignature",
    hasImage: Boolean(clientImage),
    x: marginX,
    y,
  });

  y -= 18;
  addPdfText(
    commands,
    signedAt ? `Data e hora da assinatura: ${formatDateTime(signedAt)}` : "Data e hora da assinatura: Assinatura pendente",
    marginX,
    y,
    10.5,
  );
  y -= 34;

  addPdfText(commands, "Registro técnico da assinatura", marginX, y, 12);
  y -= 20;

  [
    `Data e hora da assinatura: ${signatureEvidence?.signedAt ? formatDateTime(signatureEvidence.signedAt) : "Assinatura pendente"}`,
    `IP registrado: ${signatureEvidence?.signerIp || "IP não capturado"}`,
    `Dispositivo/Navegador: ${signatureEvidence?.signerUserAgent || "Não informado"}`,
    `Fuso horário: ${signatureEvidence?.signerTimezone || "Não informado"}`,
    `Idioma do navegador: ${signatureEvidence?.signerLanguage || "Não informado"}`,
    `Token do contrato: ${signatureEvidence?.signatureToken || "Não informado"}`,
  ].forEach((line) => {
    addPdfText(commands, line, marginX, y, 9.5);
    y -= 14;
  });

  return commands.join("\n");
}

function addPdfSignatureSection({ commands, title, imageName, hasImage, x, y }) {
  addPdfText(commands, title, x, y, 12);
  y -= 20;

  if (hasImage) {
    commands.push("q");
    commands.push(`220 0 0 80 ${x} ${y - 80} cm`);
    commands.push(`/${imageName} Do`);
    commands.push("Q");
    return y - 100;
  }

  addPdfText(commands, "Assinatura pendente", x, y, 10.5);
  return y - 24;
}

function addPdfText(commands, text, x, y, fontSize) {
  commands.push("BT");
  commands.push(`/F1 ${fontSize} Tf`);
  commands.push(`${x} ${y.toFixed(2)} Td`);
  commands.push(`(${escapePdfText(text)}) Tj`);
  commands.push("ET");
}

function wrapPdfText(content, maxLineLength) {
  const wrapped = [];

  content.split(/\r?\n/).forEach((line) => {
    if (!line.trim()) {
      wrapped.push("");
      return;
    }

    let current = "";
    line.split(/\s+/).forEach((word) => {
      const next = current ? `${current} ${word}` : word;

      if (next.length > maxLineLength && current) {
        wrapped.push(current);
        current = word;
      } else {
        current = next;
      }
    });

    wrapped.push(current);
  });

  return wrapped;
}

function paginatePdfLines(lines, { pageHeight, marginTop, marginBottom, lineHeight }) {
  const firstPageBodyTopOffset = 34;
  const maxFirstPageLines = Math.floor((pageHeight - marginTop - marginBottom - firstPageBodyTopOffset) / lineHeight);
  const maxOtherPageLines = Math.floor((pageHeight - marginTop - marginBottom - firstPageBodyTopOffset) / lineHeight);
  const pages = [];
  let currentPage = [];
  let maxLines = maxFirstPageLines;

  lines.forEach((line) => {
    if (currentPage.length >= maxLines) {
      pages.push(currentPage);
      currentPage = [];
      maxLines = maxOtherPageLines;
    }

    currentPage.push(line);
  });

  pages.push(currentPage);

  return pages;
}

function buildPdfBytes(objects) {
  const chunks = ["%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"];
  const offsets = [0];
  let byteLength = toWinAnsiBinary(chunks[0]).length;

  objects.forEach((object, index) => {
    offsets.push(byteLength);
    const chunk = `${index + 1} 0 obj\n${object}\nendobj\n`;
    chunks.push(chunk);
    byteLength += toWinAnsiBinary(chunk).length;
  });

  const xrefOffset = byteLength;
  const xref = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF",
  ].join("\n");

  chunks.push(xref);

  return binaryStringToBytes(chunks.map(toWinAnsiBinary).join(""));
}

function createImageObject(image) {
  return `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.binary.length} >>\nstream\n${image.binary}\nendstream`;
}

async function dataUrlToJpeg(dataUrl) {
  const image = new Image();
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = dataUrl;
  });

  canvas.width = image.naturalWidth || image.width || 720;
  canvas.height = image.naturalHeight || image.height || 260;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return {
    width: canvas.width,
    height: canvas.height,
    binary: base64ToBinary(canvas.toDataURL("image/jpeg", 0.92).split(",")[1]),
  };
}

function base64ToBinary(base64) {
  return atob(base64);
}

function escapePdfText(value) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function estimatePdfTextWidth(value, fontSize) {
  return value.length * fontSize * 0.5;
}

function toWinAnsiBinary(value) {
  const map = {
    "â‚¬": 128,
    "â€š": 130,
    "Æ’": 131,
    "â€ž": 132,
    "â€¦": 133,
    "â€ ": 134,
    "â€¡": 135,
    "Ë†": 136,
    "â€°": 137,
    "Å ": 138,
    "â€¹": 139,
    "Å’": 140,
    "Å½": 142,
    "â€˜": 145,
    "â€™": 146,
    "â€œ": 147,
    "â€": 148,
    "â€¢": 149,
    "â€“": 150,
    "â€”": 151,
    "Ëœ": 152,
    "â„¢": 153,
    "Å¡": 154,
    "â€º": 155,
    "Å“": 156,
    "Å¾": 158,
    "Å¸": 159,
  };

  return Array.from(value).map((char) => {
    const code = char.charCodeAt(0);

    if (code <= 255) {
      return String.fromCharCode(code);
    }

    return String.fromCharCode(map[char] ?? 63);
  }).join("");
}

function binaryStringToBytes(value) {
  const bytes = new Uint8Array(value.length);

  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index) & 0xff;
  }

  return bytes;
}

function showVisualOnlyAlert() {
  window.alert("Funcionalidade disponível em breve.");
}

function getTodayKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatStatus(status) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDate(value) {
  if (!value) {
    return "Não informado";
  }

  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatDateTime(value) {
  if (!value) {
    return "Não informado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMoneyValue(value) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function slugifyFileName(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}



