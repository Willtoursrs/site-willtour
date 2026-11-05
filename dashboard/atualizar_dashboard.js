// Gera atendimento.js a partir da API do Agendor, que nao libera CORS e por
// isso nao pode ser chamada do navegador. O Pax Pro e chamado ao vivo pelo painel.
// Uso: node atualizar_dashboard.js (roda sozinho as 10h e 18h pelo launchd)
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as agendor from './api/agendor.js';
import { buildNegocios } from './api/transform.js';

const OUT_DIR = dirname(fileURLToPath(import.meta.url));

function writeJs(file, header, constName, data) {
  const comment = header.map((l) => `// ${l}\n`).join('');
  const geradoEm = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  writeFileSync(join(OUT_DIR, file), `${comment}const ${constName} = ${JSON.stringify(data)};\nconst ${constName}_GERADO_EM = ${JSON.stringify(geradoEm)};\n`, 'utf8');
}

async function buildAtendimento() {
  if (!agendor.hasAgendorToken()) {
    console.log('Sem token do Agendor - atendimento.js mantido como esta');
    return;
  }
  let people, deals;
  try {
    [people, deals] = await Promise.all([agendor.getPessoas(), agendor.getNegocios()]);
  } catch (e) {
    console.log(`Aviso: falha ao buscar dados do Agendor via API (${e.message}) - atendimento.js mantido como esta`);
    return;
  }
  const negocios = buildNegocios(people, deals);
  writeJs('atendimento.js', ['Dados extraidos DIRETO da API do Agendor.',
    'Funis Leads+Orcamentos unificados, Barbearia excluida. Regenerado automaticamente - nao editar a mao.'],
    'NEGOCIOS', negocios);
  console.log(`Atendimento (Agendor via API): ${negocios.length} negócios (${deals.length} na conta, ${people.length} pessoas)`);
}

await buildAtendimento();
