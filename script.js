const pdfInput = document.getElementById('pdfInput');
const dropZone = document.getElementById('dropZone');
const pdfTextArea = document.getElementById('pdfText');
const jsonOutput = document.getElementById('jsonOutput');
const log = document.getElementById('logOutput');
const statusSelect = document.getElementById('status');
const enviarBtn = document.getElementById('enviarBtn');

let paciente = null; // vai armazenar o JSON

const logMsg = (msg) => {
  log.textContent += "\n" + msg;
};

const extract = (text, regex, label = "") => {
  const match = text.match(regex);
  if (match && match[1]) {
    logMsg(`✅ ${label} encontrado: ${match[1].trim()}`);
    return match[1].trim();
  } else {
    logMsg(`⚠️ ${label} não encontrado.`);
    return '';
  }
};

const processPDF = async (file) => {
  log.textContent = "📂 Lendo PDF...";
  const reader = new FileReader();

  reader.onload = async function () {
    const typedArray = new Uint8Array(this.result);
    const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;

    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(' ');
      text += pageText + '\n';
    }

    pdfTextArea.value = text;
    logMsg("📄 Texto extraído com sucesso!");

    const nome_paciente = extract(text, /Paciente:\s*([A-ZÀ-Ú\s]+[A-ZÀ-Ú])(?=\s+Endereço)/i, "Nome do Paciente");
    const data_nascimento = extract(text, /Nascimento:\s*(\d{2}\/\d{2}\/\d{4})/, "Data de Nascimento").split('/').reverse().join('-');
    const cartao_sus = extract(text, /Cartão SUS:\s*(\d{15})/, "Cartão SUS");
    const endereco = extract(text, /Endereço:\s*(.*?)(?=\s*Contato)/, "Endereço");

    const telefoneMatch = text.match(/Contato\(s\):\s*\(?(\d{2})\)?[-\s]?(\d{4,5}-?\d{4})/);
    let telefone = '';
    if (telefoneMatch) {
      telefone = telefoneMatch[1] + telefoneMatch[2].replace(/[^0-9]/g, '');
      logMsg(`✅ Telefone encontrado: ${telefone}`);
    } else {
      logMsg(`⚠️ Telefone não encontrado.`);
    }

    const protocolo = extract(text, /PROTOCOLO DE ATENDIMENTO\s*Nº:\s*(\d+)/, "Protocolo");
    const unidade_solicitante = extract(text, /UNIDADE SOLICITANTE:\s*(.+?)\s*PROFISIONAL/, "Unidade Solicitante");
    const profissional_solicitante = extract(text, /PROFISIONAL SOLICITANTE:\s*([A-Z\s]+)/, "Profissional Solicitante");

    const examesEncontrados = [];
    const exameRegex = /(\d{10})\s+([A-ZÇÃÁÉÍÓÚÜ\/0-9\s\-]+?)\s+1/g;
    let match;
    while ((match = exameRegex.exec(text)) !== null) {
      examesEncontrados.push({
        codigo: match[1],
        nome: match[2].trim(),
        quantidade: 1
      });
      logMsg(`🧪 Exame extraído: ${match[2].trim()} (${match[1]})`);
    }

    paciente = {
      nome_paciente,
      data_nascimento,
      cartao_sus,
      endereco,
      telefone,
      protocolo,
      unidade_solicitante,
      profissional_solicitante,
      exames_solicitados: examesEncontrados,
      status: statusSelect.value, // definido pelo usuário
      data_agendamento: "2023-11-15"
    };

    jsonOutput.value = JSON.stringify(paciente, null, 2);
    logMsg("✅ JSON montado com sucesso! Pronto para enviar.");
  };

  reader.readAsArrayBuffer(file);
};

enviarBtn.addEventListener('click', async () => {
  if (!paciente) {
    logMsg("⚠️ Nenhum JSON montado para enviar.");
    return;
  }

  paciente.status = statusSelect.value; // atualiza com o status selecionado

  try {
    const response = await fetch('http://localhost:3000/api/exames', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paciente)
    });

    if (response.ok) {
      logMsg("🚀 Dados enviados com sucesso para API.");
    } else {
      const erro = await response.json();
      logMsg(`❌ Erro da API: ${erro.error || 'Erro desconhecido'}`);
    }
  } catch (error) {
    logMsg(`❌ Erro de conexão com a API: ${error.message}`);
  }
});

// Drag & Drop
dropZone.addEventListener('click', () => pdfInput.click());
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('hover');
});
dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('hover');
});
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('hover');
  const file = e.dataTransfer.files[0];
  if (file && file.type === "application/pdf") {
    processPDF(file);
  } else {
    logMsg("❌ Arquivo inválido. Envie um PDF.");
  }
});

pdfInput.addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (file) {
    processPDF(file);
  }
});