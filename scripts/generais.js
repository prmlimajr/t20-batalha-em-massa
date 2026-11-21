/**
 * T11 — Teste dos Generais (puro, testável em Node).
 *
 * Rolagem de cada general = 1d20 + bônus, e o bônus é discriminado item a item (decisão 19):
 *   Guerra do general (configurador) + modificadores de Guerra do exército
 *   + (só o exército dos heróis) bônus dos eventos da rodada e dos estandartes carregados.
 * O general aliado é rolado por um jogador sorteado (rodada.rolaGeneral) ou pelo mestre; o inimigo, pelo mestre.
 * Com as duas rolagens: vencedor (empate → maior bônus → rola de novo), pontos, placar, fuga e fim.
 */
import { completarEstado } from "./estado.js";
import { bonusPorDano, resultadoGenerais, verificarFimRodada, limiarVitoria } from "./regras.js";
import { BONUS_TESTE_PERICIA, BONUS_ESTANDARTE } from "./constantes.js";
import { eventoPorChave } from "./evento.js";
import { nomeDaArea, AREA_CEU, BONUS_RESOLVER_CEU } from "./areas.js";

const DEFESA = ["defender", "defenderContraDois"];

/* ---------------- Composição do bônus ---------------- */

/** Itens do bônus de um evento (o mesmo cálculo de evento.bonusDaArea, discriminado). */
function itensDoEvento(e, area) {
	const ev = e.rodada.eventos?.[area];
	if (!ev) return [];
	const nomeArea = nomeDaArea(e, area);
	const onde = `${ev.nome}${nomeArea ? `, ${nomeArea}` : ""}`;
	if (e.opcionais.acoesAbertas && ev.bonusManual !== undefined && ev.bonusManual !== null) {
		const v = Math.trunc(Number(ev.bonusManual) || 0);
		return v ? [{ valor: v, texto: `por ações abertas (${onde})` }] : [];
	}
	const def = eventoPorChave(ev.chave);
	const itens = [];
	const dano = Number(ev.dano) || 0;
	const lider = Number(ev.danoLider) || 0;
	const oficial = Number(ev.danoOficial) || 0;
	const efetivo = Math.max(0, dano + 2 * lider - oficial);
	const porDano = bonusPorDano(efetivo, e.tamanho);
	if (porDano > 0) {
		const detalhes = [];
		if (lider) detalhes.push(`${lider} no líder, em dobro`);
		if (oficial) detalhes.push(`menos ${oficial} do oficial`);
		const extra = detalhes.length ? `; ${detalhes.join(", ")}` : "";
		const acao = DEFESA.includes(def?.mecanica) ? `por defender ${efetivo} de dano` : `por ter causado ${efetivo} de dano no exército inimigo`;
		itens.push({ valor: porDano, texto: `${acao} (${onde}${extra})` });
	}
	if (def?.capitao && porDano >= 2) itens.push({ valor: 2, texto: `por vencer o capitão inimigo (${onde})` });
	if (ev.teste) itens.push({ valor: BONUS_TESTE_PERICIA, texto: `por sucesso em teste de perícia no evento (${onde})` });
	if (area === AREA_CEU && itens.length) itens.push({ valor: BONUS_RESOLVER_CEU, texto: `por resolver o evento sob os céus (${onde})` });
	return itens;
}

/**
 * Itens que compõem o bônus do general de um exército nesta rodada, e o total.
 * @returns {{ itens: { valor: number, texto: string }[], total: number }}
 */
export function composicaoBonus(salvo, lado) {
	const e = completarEstado(salvo);
	const ex = e.exercitos[lado];
	const itens = [];
	const guerra = Number(ex.general?.guerra);
	itens.push({ valor: Number.isFinite(guerra) ? guerra : 0, texto: `Guerra do general${ex.general?.nome ? ` (${ex.general.nome})` : ""}` });
	for (const m of ex.modificadores) {
		const v = Number(m.valor) || 0;
		if (v) itens.push({ valor: v, texto: m.nome + (m.detalhe ? ` (${m.detalhe})` : "") });
	}
	if (lado === 0) {
		for (const area of Object.keys(e.rodada.eventos ?? {})) itens.push(...itensDoEvento(e, Number(area)));
		for (const h of e.herois.filter((x) => x.estandarte && !x.morto)) {
			itens.push({ valor: BONUS_ESTANDARTE, texto: `por ${h.nome || "um herói"} segurar o estandarte do exército` });
		}
	}
	return { itens, total: itens.reduce((s, i) => s + i.valor, 0) };
}

/* ---------------- Quem rola ---------------- */

/** Sorteia quem rola pelo general aliado entre os jogadores (ids). `aleatorio` ∈ [0, 1). */
export function sortearJogador(ids, aleatorio = Math.random()) {
	if (!ids.length) return null;
	return ids[Math.min(ids.length - 1, Math.floor(aleatorio * ids.length))];
}

export function definirQuemRola(salvo, userId) {
	const e = completarEstado(salvo);
	e.rodada.rolaGeneral = userId;
	return e;
}

/** Pode rolar pelo general deste lado? Mestre: os dois; jogador sorteado: só o aliado; e cada lado uma vez. */
export function podeRolar(salvo, lado, { ehGM, userId }) {
	const e = completarEstado(salvo);
	if (e.etapa !== "generais" || e.fim) return false;
	if (e.rodada.generais?.[lado]) return false;
	if (ehGM) return true;
	return lado === 0 && !!userId && e.rodada.rolaGeneral === userId;
}

/* ---------------- Rolagens e resultado ---------------- */

/**
 * Registra a rolagem de um general (o d20; o bônus é recalculado aqui) e, com as duas, resolve a rodada:
 * vencedor, pontos de vitória no placar, histórico, fuga e fim da batalha.
 * @returns {{ estado: object, resolvido: boolean, resultado: object|null }}
 */
export function registrarRolagem(salvo, lado, { d20, por = null }) {
	const e = completarEstado(salvo);
	const { total: bonus } = composicaoBonus(e, lado);
	e.rodada.generais = { ...e.rodada.generais, [lado]: { d20, bonus, total: d20 + bonus, por } };
	const [a, b] = [e.rodada.generais[0], e.rodada.generais[1]];
	if (!a || !b) return { estado: e, resolvido: false, resultado: null };

	const r = resultadoGenerais(a.total, b.total, a.bonus, b.bonus);
	if (r.rolarDeNovo) {
		// Empate no total e no bônus: os dois rolam de novo.
		e.rodada.generais = {};
		e.rodada.resultadoGenerais = { empate: true, totais: [a.total, b.total], vez: (e.rodada.resultadoGenerais?.vez ?? 0) + 1 };
		return { estado: e, resolvido: false, resultado: e.rodada.resultadoGenerais };
	}
	const fugindoAntes = e.fugindo;
	e.exercitos[r.vencedor].pontos = (Number(e.exercitos[r.vencedor].pontos) || 0) + r.pontos;
	const pontos = [Number(e.exercitos[0].pontos) || 0, Number(e.exercitos[1].pontos) || 0];
	const fim = verificarFimRodada({ pontos, limiar: limiarVitoria(e.tamanho, e.opcionais.limiarVariado), fugindo: e.fugindo });
	e.fugindo = fim.fugindo;
	if (fim.fim) e.fim = { tipo: fim.fim, vencedor: fim.vencedor, turno: e.turno };
	const resultado = {
		vencedor: r.vencedor, pontos: r.pontos, diferenca: r.diferenca, totais: [a.total, b.total],
		desempateBonus: a.total === b.total, fugindo: fim.fugindo, fugaInterrompida: fim.fugaInterrompida, fim: fim.fim,
		fugindoAntes // para refazer o teste
	};
	e.rodada.resultadoGenerais = resultado;
	e.historico = [...e.historico, { turno: e.turno, rolagens: [a, b], ...resultado, placar: pontos }];
	return { estado: e, resolvido: true, resultado };
}

/**
 * Refaz o Teste dos Generais da rodada (mestre): apaga as rolagens e desfaz o resultado
 * (pontos, histórico do turno, fuga e fim causados por ele). Quem rola pelo general aliado continua o mesmo.
 */
export function resetarGenerais(salvo) {
	const e = completarEstado(salvo);
	const r = e.rodada.resultadoGenerais;
	if (r && !r.empate && r.vencedor !== undefined) {
		const ex = e.exercitos[r.vencedor];
		ex.pontos = (Number(ex.pontos) || 0) - (Number(r.pontos) || 0);
		const i = e.historico.findLastIndex((h) => h.turno === e.turno);
		if (i >= 0) e.historico = e.historico.filter((_, j) => j !== i);
		e.fugindo = r.fugindoAntes ?? null;
		if (e.fim && e.fim.tipo !== "desistencia" && e.fim.turno === e.turno) e.fim = null;
	}
	e.rodada.generais = {};
	e.rodada.resultadoGenerais = null;
	return e;
}
