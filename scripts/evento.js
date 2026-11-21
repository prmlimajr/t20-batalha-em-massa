/**
 * T10 — Resolução dos eventos (puro, testável em Node).
 *
 * Cada área com evento sorteado guarda em rodada.eventos[área]:
 *   { total, d20, chave, nome,                    ← sorteio (rolagens.rolarEvento)
 *     dano, danoLider, danoOficial, teste,         ← informados pelo mestre
 *     bonusManual,                                 ← regra opcional Ações abertas
 *     generalDerrotado: { pontos, penalidade } }   ← evento Enfrentar general
 * O bônus de Guerra da rodada (para o general dos heróis) é a soma dos bônus das áreas.
 */
import { EVENTOS, MECANICAS, BONUS_ESTANDARTE } from "./constantes.js";
import { completarEstado } from "./estado.js";
import { bonusEvento } from "./regras.js";

const CAMPOS_NUMERICOS = ["dano", "danoLider", "danoOficial", "bonusManual"];

export const eventoPorChave = (chave) => EVENTOS.find((e) => e.chave === chave) ?? null;

/** O que o mestre informa num evento (para montar os campos da resolução). */
export function camposDoEvento(chave, { acoesAbertas = false } = {}) {
	const ev = eventoPorChave(chave);
	const mec = MECANICAS[ev?.mecanica] ?? {};
	return {
		dano: !!mec.combate && !ev?.general,
		danoLider: !!ev?.ataqueLivre,
		danoOficial: !!ev?.capitao,
		teste: ev?.mecanica === "testePericia" || !!mec.testePericia,
		estandarte: ev?.estandarte ?? null,
		general: !!ev?.general,
		bonusManual: acoesAbertas
	};
}

/** Grava o que o mestre informou numa área (números inteiros ≥ 0; bônus manual pode ser negativo). */
export function atualizarResolucao(salvo, area, campos) {
	const e = completarEstado(salvo);
	const atual = e.rodada.eventos?.[area];
	if (!atual) return e;
	const novo = { ...atual };
	for (const [k, v] of Object.entries(campos)) {
		if (CAMPOS_NUMERICOS.includes(k)) {
			const n = Math.trunc(Number(v) || 0);
			novo[k] = k === "bonusManual" ? n : Math.max(0, n);
		} else if (k === "teste") novo.teste = !!v;
	}
	e.rodada.eventos = { ...e.rodada.eventos, [area]: novo };
	return e;
}

/** Bônus de Guerra que o evento de uma área dá ao general dos heróis. */
export function bonusDaArea(salvo, area) {
	const e = completarEstado(salvo);
	const ev = e.rodada.eventos?.[area];
	if (!ev) return 0;
	if (e.opcionais.acoesAbertas && ev.bonusManual !== undefined && ev.bonusManual !== null) {
		return Math.trunc(Number(ev.bonusManual) || 0);
	}
	const def = eventoPorChave(ev.chave);
	return bonusEvento({
		tamanho: e.tamanho,
		dano: Number(ev.dano) || 0,
		danoLider: Number(ev.danoLider) || 0,
		danoOficial: Number(ev.danoOficial) || 0,
		capitao: !!def?.capitao,
		testePericia: !!ev.teste
	});
}

/** Bônus de todas as áreas da rodada e o total. */
export function bonusDaRodada(salvo) {
	const e = completarEstado(salvo);
	const porArea = {};
	let total = 0;
	for (const area of Object.keys(e.rodada.eventos ?? {})) {
		porArea[area] = bonusDaArea(e, Number(area));
		total += porArea[area];
	}
	return { porArea, total };
}

/* ---------------- Posicionamento avançado ---------------- */

/** Ajuste de −2, 0 ou +2 na rolagem de evento de uma área (quem passou no teste de Guerra escolhe). */
export function definirAjuste(salvo, area, ajuste) {
	const e = completarEstado(salvo);
	const valor = [-2, 0, 2].includes(Number(ajuste)) ? Number(ajuste) : 0;
	e.rodada.ajustes = { ...e.rodada.ajustes, [area]: valor };
	return e;
}

/* ---------------- Estandartes ---------------- */

/** Liga/desliga "segura um estandarte" num herói (+2 no teste do general, e vira alvo). */
export function alternarEstandarte(salvo, uuid) {
	const e = completarEstado(salvo);
	e.herois = e.herois.map((h) => (h.uuid === uuid ? { ...h, estandarte: !h.estandarte } : h));
	return e;
}

/** Bônus dos estandartes no teste de Guerra do general dos heróis. */
export function bonusEstandartes(salvo) {
	return completarEstado(salvo).herois.filter((h) => h.estandarte && !h.morto).length * BONUS_ESTANDARTE;
}

/* ---------------- Enfrentar general ---------------- */

export const temSubstituto = (ex) => !!(ex?.substituto?.uuid || ex?.substituto?.nome);

/**
 * O general de um exército sai de cena (removido pelo mestre ou derrotado): o substituto assume, com o
 * bônus de Guerra informado, e passa a rolar nos próximos Testes dos Generais. Sem substituto, um oficial
 * sem nome assume. O exército fica sem substituto.
 */
export function substituirGeneral(salvo, lado, guerra) {
	const e = completarEstado(salvo);
	const ex = e.exercitos[lado];
	const valor = Math.trunc(Number(guerra) || 0);
	ex.general = temSubstituto(ex)
		? { ...ex.substituto, guerra: valor }
		: { uuid: null, nome: "", img: null, guerra: valor };
	ex.substituto = { uuid: null, nome: "", img: null };
	return e;
}

/**
 * O grupo derrotou o general inimigo: o exército dos heróis ganha `pontos` (1d4+1) e o substituto
 * assume com Guerra = Guerra do anterior − `penalidade` (1d6+1).
 */
export function derrotarGeneralInimigo(salvo, area, { pontos, penalidade }) {
	const guerraAnterior = Number(completarEstado(salvo).exercitos[1].general?.guerra) || 0;
	const e = substituirGeneral(salvo, 1, guerraAnterior - penalidade);
	e.exercitos[0].pontos = (Number(e.exercitos[0].pontos) || 0) + pontos;
	const ev = e.rodada.eventos?.[area];
	if (ev) e.rodada.eventos = { ...e.rodada.eventos, [area]: { ...ev, generalDerrotado: { pontos, penalidade, anterior: guerraAnterior } } };
	return e;
}
