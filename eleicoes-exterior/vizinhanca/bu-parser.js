function read(bytes) {
  let p = 0;
  const out = [];
  while (p < bytes.length) {
    const tag = bytes[p++];
    if ((tag & 31) === 31 || p >= bytes.length) throw Error("Tag ASN.1 inv\xE1lida");
    let len = bytes[p++];
    if (len & 128) {
      const size = len & 127;
      if (!size || size > 4 || p + size > bytes.length) throw Error("Comprimento ASN.1 inv\xE1lido");
      len = 0;
      for (let i = 0; i < size; i++) len = len * 256 + bytes[p++];
    }
    if (p + len > bytes.length) throw Error("BU truncado");
    const value = bytes.slice(p, p + len);
    p += len;
    out.push({ tag, bytes: value, children: tag & 32 ? read(value) : [] });
  }
  return out;
}
const num = (node) => {
  if (!node || !node.bytes.length || node.bytes.length > 5 || node.bytes[0] & 128) throw Error("Inteiro inv\xE1lido");
  return node.bytes.reduce((a, b) => a * 256 + b, 0);
};
const str = (node) => new TextDecoder().decode(node.bytes);
function parseBu(bytes, code, zone, section) {
  const envelope = read(bytes);
  if (envelope.length !== 1 || envelope[0].tag !== 48) throw Error("Envelope inv\xE1lido");
  const env = envelope[0].children;
  if (num(env[1]) !== 2 || num(env.find((e, i) => i > 1 && e.tag === 10)) !== 1 || env.at(-1)?.tag !== 4) throw Error("BU n\xE3o oficial ou envelope inesperado");
  if (env[0].children[1].tag !== 130 || num(env[0].children[1]) !== 3220) throw Error("Pleito inesperado");
  const roots = read(env.at(-1).bytes);
  if (roots.length !== 1 || roots[0].tag !== 48) throw Error("Conte\xFAdo BU inv\xE1lido");
  const bu = roots[0].children;
  if (num(bu[1]) !== 2) throw Error("BU n\xE3o oficial");
  const id = bu[3].children;
  const mz = id[0].children;
  if (num(mz[0]) !== Number(code) || num(mz[1]) !== Number(zone) || num(id[2]) !== Number(section)) throw Error("Se\xE7\xE3o divergente");
  const generated = str(bu[0].children[0]), emitted = str(bu[4]);
  if (!generated.startsWith("20261004T") || !emitted.startsWith("20261004T")) throw Error("BU de outra data");
  const elections = bu[bu[7]?.tag === 161 ? 8 : 7];
  if (elections.tag !== 48) throw Error("Resultados ausentes");
  const election = elections.children.find((e) => num(e.children[0]) === 6257);
  if (!election) throw Error("Elei\xE7\xE3o inesperada");
  if (election.children[1]?.tag !== 2) throw Error("Eleitorado ausente");
  const eligible = num(election.children[1]);
  const votes = [];
  let blank = 0, nullVotes = 0, turnout = null, found = false;
  for (const result of election.children[4].children) for (const cargo of result.children[2].children) {
    if (cargo.children[0].tag !== 129 || num(cargo.children[0]) !== 1) continue;
    if (found || result.children[1]?.tag !== 2) throw Error("Comparecimento amb\xEDguo");
    found = true;
    turnout = num(result.children[1]);
    for (const v of cargo.children[2].children) {
      const fields = v.children;
      if (fields[0].tag !== 129 || fields[1].tag !== 130) throw Error("Voto inv\xE1lido");
      const kind = num(fields[0]), count = num(fields[1]);
      if (kind === 1) {
        const ident = fields[2];
        if (ident.tag !== 163) throw Error("Candidato ausente");
        votes.push({ number: String(num(ident.children[1])), votes: count });
      } else if (kind === 2) blank += count;
      else if (kind === 3) nullVotes += count;
      else throw Error("Tipo de voto presidencial inesperado");
    }
  }
  if (!found || turnout === null) throw Error("Cargo presidente ausente");
  if (turnout > eligible || votes.reduce((sum, v) => sum + v.votes, blank + nullVotes) > turnout) throw Error("Contagens de eleitores inconsistentes");
  return { code, zone, section, generated, emitted, votes, blank, nullVotes, eligible, turnout, abstention: eligible - turnout };
}
export {
  parseBu
};
