import {
  findGeneratedContractByToken,
  findGeneratedContractByTokenAsync,
  updateGeneratedContractByToken,
} from "./generatedContractsStore.js";

export function createPublicContractSigningPage(token) {
  let contract = findGeneratedContractByToken(token);
  let isLoading = !contract;

  const page = document.createElement("main");
  const panel = document.createElement("section");

  page.className = "public-sign-page";
  panel.className = "public-sign-panel";
  page.append(panel);

  render();

  if (!contract) {
    loadContract();
  }

  return page;

  function render() {
    panel.replaceChildren();

    if (isLoading) {
      panel.append(createMessage("Carregando contrato..."));
      return;
    }

    if (!contract) {
      panel.append(createMessage("Contrato não encontrado."));
      return;
    }

    panel.append(createHeader(contract));
    panel.append(createContractContent(contract));

    if (contract.ownerSignature?.image) {
      panel.append(createSignaturePreview("Assinatura do proprietário", contract.ownerSignature.image));
    } else {
      panel.append(createPendingText("Assinatura do proprietário pendente."));
    }

    if (contract.clientSignature) {
      panel.append(createMessage("Este contrato já foi assinado."));
      panel.append(createSignaturePreview("Assinatura do cliente", contract.clientSignature));
      return;
    }

    panel.append(createSigningForm());
  }

  function createSigningForm() {
    const form = document.createElement("div");
    const canvas = document.createElement("canvas");
    const checkboxLabel = document.createElement("label");
    const checkbox = document.createElement("input");
    const checkboxText = document.createElement("span");
    const error = document.createElement("p");
    const actions = document.createElement("div");
    const clearButton = document.createElement("button");
    const confirmButton = document.createElement("button");
    let isDrawing = false;
    let hasSignature = false;

    form.className = "public-sign-form";

    canvas.className = "public-sign-form__canvas";
    canvas.width = 720;
    canvas.height = 260;

    checkboxLabel.className = "public-sign-form__checkbox";
    checkbox.type = "checkbox";
    checkboxText.textContent = "Confirmo que li e concordo com os termos deste contrato.";
    checkboxLabel.append(checkbox, checkboxText);

    error.className = "public-sign-form__error";
    error.hidden = true;

    actions.className = "public-sign-form__actions";

    clearButton.className = "button button--secondary";
    clearButton.type = "button";
    clearButton.textContent = "Limpar assinatura";
    clearButton.addEventListener("click", clearCanvas);

    confirmButton.className = "button button--primary";
    confirmButton.type = "button";
    confirmButton.textContent = "Confirmar assinatura";
    confirmButton.addEventListener("click", async () => {
      if (!hasSignature) {
        showError("Faça a assinatura antes de confirmar.");
        return;
      }

      if (!checkbox.checked) {
        showError("Confirme que leu e concorda com os termos do contrato.");
        return;
      }

      const signedAt = new Date().toISOString();
      const evidence = await captureSignatureEvidence(token, signedAt);

      contract = updateGeneratedContractByToken(token, (currentContract) => {
        const clientSignature = canvas.toDataURL("image/png");
        const signedContract = {
          ...currentContract,
          clientSignature,
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
      });

      panel.replaceChildren(
        createMessage("Contrato assinado com sucesso."),
        createMessage("Registro técnico da assinatura salvo com data, hora e identificação do dispositivo."),
      );
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

    actions.append(clearButton, confirmButton);
    form.append(canvas, checkboxLabel, error, actions);

    return form;

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

  async function loadContract() {
    contract = await findGeneratedContractByTokenAsync(token);
    isLoading = false;
    render();
  }
}

function createHeader(contract) {
  const header = document.createElement("header");
  const kicker = document.createElement("p");
  const title = document.createElement("h1");
  const summary = document.createElement("p");

  header.className = "public-sign-header";
  kicker.className = "page-panel__kicker";
  kicker.textContent = "Sítio São Jorge";
  title.textContent = "Assinatura de contrato";
  summary.textContent = `${contract.client} - ${contract.reservation}`;

  header.append(kicker, title, summary);

  return header;
}

function createContractContent(contract) {
  const content = document.createElement("pre");

  content.className = "public-sign-contract";
  content.textContent = getContractDisplayContent(contract);

  return content;
}

function getContractDisplayContent(contract) {
  const hasClientSignature = Boolean(contract.clientSignature);
  const signedDate = contract.signedAt ? formatDateTime(contract.signedAt) : "";

  return (contract.content ?? "")
    .replaceAll("{{assinatura_cliente}}", hasClientSignature
      ? "Assinatura do locatário anexada"
      : "Assinatura do locatário pendente")
    .replaceAll("{{data_assinatura}}", signedDate || "Data da assinatura pendente")
    .replaceAll("Assinatura do locatário pendente", hasClientSignature
      ? "Assinatura do locatário anexada"
      : "Assinatura do locatário pendente")
    .replaceAll("Data da assinatura pendente", signedDate || "Data da assinatura pendente");
}

async function captureSignatureEvidence(token, signedAt) {
  return {
    signedAt,
    signerIp: await captureSignerIp(),
    signerUserAgent: navigator.userAgent || "Não informado",
    signerTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Não informado",
    signerLanguage: navigator.language || "Não informado",
    signerPlatform: navigator.platform || "Não informado",
    signatureToken: token,
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

function formatDateTime(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function createSignaturePreview(title, imageSrc) {
  const wrapper = document.createElement("div");
  const heading = document.createElement("h2");
  const image = document.createElement("img");

  wrapper.className = "public-sign-signature";
  heading.textContent = title;
  image.src = imageSrc;
  image.alt = title;
  wrapper.append(heading, image);

  return wrapper;
}

function createPendingText(text) {
  const message = document.createElement("p");

  message.className = "public-sign-pending";
  message.textContent = text;

  return message;
}

function createMessage(text) {
  const message = document.createElement("p");

  message.className = "public-sign-message";
  message.textContent = text;

  return message;
}



