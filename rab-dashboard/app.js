const DATA_URL = window.location.pathname.endsWith('/rab-dashboard.html') ? './rab-dashboard/data/rab_owners_snapshot.json' : './data/rab_owners_snapshot.json';

const normalizeText = (value = '') =>
  value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const normalizeDigits = (value = '') => value.toString().replace(/\D/g, '');

const formatDoc = (digits) => {
  if (!digits) return '';
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (digits.length === 14) return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return digits;
};

let records = [];

const render = () => {
  const prefixoQ = normalizeText(document.getElementById('prefixo').value);
  const nomeQ = normalizeText(document.getElementById('nome').value);
  const docQ = normalizeDigits(document.getElementById('doc').value);

  const filtered = records.filter((r) => {
    if (prefixoQ && !r.prefixo_norm.includes(prefixoQ)) return false;
    if (nomeQ && !r.nome_norm.includes(nomeQ)) return false;
    if (docQ && !r.doc_digits.includes(docQ)) return false;
    return true;
  });

  const tbody = document.getElementById('rows');
  tbody.innerHTML = filtered
    .slice(0, 1000)
    .map((r) => `
      <tr>
        <td>${r.prefixo || '-'}</td>
        <td>${r.proprietario || '-'}</td>
        <td>${formatDoc(r.doc_digits)}</td>
        <td>${r.modelo || '-'}</td>
        <td>${r.uf || '-'}</td>
      </tr>
    `)
    .join('');

  document.getElementById('count').textContent = `${filtered.length.toLocaleString('pt-BR')} registro(s) encontrado(s). ${filtered.length > 1000 ? 'Mostrando os 1.000 primeiros.' : ''}`;
};

const boot = async () => {
  const response = await fetch(DATA_URL);
  const payload = await response.json();

  records = payload.records.map((r) => ({
    ...r,
    prefixo_norm: normalizeText(r.prefixo),
    nome_norm: normalizeText(r.proprietario),
    doc_digits: normalizeDigits(r.cpf_cnpj)
  }));

  document.getElementById('meta').textContent = `Fonte base: ${payload.metadata.selected_file}. Atualização: ${payload.metadata.updated_at}.`;
  document.getElementById('footer').textContent = `Metodologia: avaliação das tabelas abertas do RAB para identificar onde havia simultaneamente prefixo, nome e documento do proprietário. A base escolhida foi '${payload.metadata.selected_file}' por concentrar os campos necessários para pesquisa de titularidade. Limites: pode haver defasagem entre cadastro e atualização pública, homônimos e documentos ausentes/em branco em parte dos registros. Data de atualização usada nesta dashboard: ${payload.metadata.updated_at}.`;

  ['prefixo', 'nome', 'doc'].forEach((id) => document.getElementById(id).addEventListener('input', render));
  render();
};

boot();
