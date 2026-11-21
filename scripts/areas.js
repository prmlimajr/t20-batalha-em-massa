/**
 * Áreas do campo de batalha (puro, testável em Node).
 *
 * 0–3: as quatro áreas terrestres (Acampamento, Retaguarda, Front, Atrás das linhas inimigas), lado a lado.
 * 4:   área opcional de combate aéreo, "Sob os céus" (decisão 27), uma seção só, acima das terrestres.
 *      Regra do combate aéreo: acessível a partir de qualquer posição exceto o Acampamento, e só para quem
 *      voa; modificador de evento +5; CD dos testes de perícia dos eventos +5; o bônus em Guerra dado pelos
 *      personagens por resolver um evento ali aumenta em +2.
 */
import { POSICOES } from "./constantes.js";

export const AREA_CEU = 4;
export const SUBTITULO_CEU = "Sob os céus";
export const MOD_CEU_PADRAO = 5;
export const CD_EXTRA_CEU = 5;
export const BONUS_RESOLVER_CEU = 2;
/** Áreas terrestres ligadas ao céu (todas menos o Acampamento). */
export const ACESSO_CEU = [1, 2, 3];

export const ceuAtivo = (estado) => !!estado?.ceu?.ativo;

/** Índices das áreas que existem nesta batalha. */
export function areasDisponiveis(estado) {
	const terrestres = POSICOES.map((_, i) => i);
	return ceuAtivo(estado) ? [...terrestres, AREA_CEU] : terrestres;
}

export const areaExiste = (estado, area) => areasDisponiveis(estado).includes(area);

/** Áreas a um passo de `de`: terrestres vizinhas (±1) e, com o céu ativo, a ligação terra ↔ céu. */
export function vizinhas(estado, de) {
	if (de === AREA_CEU) return ceuAtivo(estado) ? [...ACESSO_CEU] : [];
	const lista = [de - 1, de + 1].filter((i) => i >= 0 && i < POSICOES.length);
	if (ceuAtivo(estado) && ACESSO_CEU.includes(de)) lista.push(AREA_CEU);
	return lista.sort((a, b) => a - b);
}

/** Ficar na mesma área ou ir para uma vizinha. */
export const umPasso = (estado, de, para) => para === de || vizinhas(estado, de).includes(para);

/** Modificador da rolagem de evento na área. */
export function modDaArea(estado, area) {
	if (area === AREA_CEU) {
		const mod = Number(estado?.ceu?.mod);
		return Number.isFinite(mod) ? mod : MOD_CEU_PADRAO;
	}
	return POSICOES[area]?.mod ?? 0;
}

export function nomeDaArea(estado, area) {
	if (area === AREA_CEU) return estado?.ceu?.nome || SUBTITULO_CEU;
	return estado?.areas?.[area]?.nome || POSICOES[area]?.nome || "";
}

export const subtituloDaArea = (area) => (area === AREA_CEU ? SUBTITULO_CEU : POSICOES[area]?.nome ?? "");
