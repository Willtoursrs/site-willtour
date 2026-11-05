// API do Agendor (CRM) - https://api.agendor.com.br/v3
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Token fica FORA do repositorio (nunca commitar).
export const AGENDOR_TOKEN_PATH = join(homedir(), '.willtour', 'agendor_token');

export const hasAgendorToken = () => existsSync(AGENDOR_TOKEN_PATH);

export async function agendorGet(path, params) {
  const token = readFileSync(AGENDOR_TOKEN_PATH, 'utf8').trim();
  const qs = params ? '?' + new URLSearchParams(params) : '';
  const res = await fetch(`https://api.agendor.com.br/v3/${path}${qs}`, {
    headers: { Authorization: `Token ${token}` },
  });
  if (!res.ok) throw new Error(`Agendor ${path}: HTTP ${res.status}`);
  return res.json();
}

export async function agendorPaginate(path) {
  const results = [];
  for (let page = 1; ; page++) {
    const d = await agendorGet(path, { per_page: 100, page });
    const data = d.data || [];
    results.push(...data);
    const total = d.meta?.totalCount ?? results.length;
    if (results.length >= total || !data.length) return results;
  }
}

// Rotas usadas pelo dashboard
export const getPessoas = () => agendorPaginate('people');
export const getNegocios = () => agendorPaginate('deals');
