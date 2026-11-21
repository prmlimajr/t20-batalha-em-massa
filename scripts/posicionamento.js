/**
 * T9 — Posicionamento (puro, testável em Node): quem pode mover qual herói, e o estado depois do movimento.
 *
 * Regras (spec, decisões 1 e 3):
 * - Jogadores: só na etapa Posicionamento, para a área vizinha (±1), uma vez por rodada, só o próprio herói.
 * - Grupo junto (padrão): qualquer jogador com herói na batalha move; o primeiro movimento leva o grupo inteiro
 *   e encerra o movimento do grupo na rodada.
 * - Lobos solitários: cada herói se move sozinho, uma vez por rodada.
 * - Mestre: move qualquer herói para qualquer área, a qualquer momento; não conta como o movimento da rodada.
 */
import { completarEstado } from "./estado.js";
import { movimentoValido } from "./regras.js";
import { POSICOES } from "./constantes.js";

export const MARCA_GRUPO = "grupo";

/** Área atual de um herói (com o grupo junto, a área do grupo). */
export function areaAtual(estado, uuid) {
	const h = estado.herois.find((x) => x.uuid === uuid);
	if (!h) return null;
	return estado.opcionais.lobosSolitarios ? (h.area ?? estado.grupoArea) : estado.grupoArea;
}

/** O movimento da rodada já foi usado (pelo grupo, ou por este herói com Lobos solitários)? */
export function jaMoveu(estado, uuid) {
	const movidos = estado.rodada?.movidos ?? [];
	return estado.opcionais.lobosSolitarios ? movidos.includes(uuid) : movidos.includes(MARCA_GRUPO);
}

/**
 * Valida um pedido de movimento.
 * @param {object} salvo
 * @param {string} uuid        herói
 * @param {number} para        área de destino (0–3)
 * @param {object} quem
 * @param {boolean} quem.ehGM
 * @param {boolean} [quem.dono]  o usuário é dono do ator do herói
 * @returns {{ ok: boolean, motivo?: string }}  motivo = chave de i18n em Posicionamento.Motivos
 */
export function validarMovimento(salvo, uuid, para, { ehGM, dono = false }) {
	const e = completarEstado(salvo);
	const de = areaAtual(e, uuid);
	if (de === null) return { ok: false, motivo: "NaoEsta" };
	if (!Number.isInteger(para) || para < 0 || para >= POSICOES.length) return { ok: false, motivo: "AreaInvalida" };
	if (para === de) return { ok: false, motivo: "MesmaArea" };
	if (e.fim) return { ok: false, motivo: "Encerrada" };
	if (ehGM) return { ok: true };
	if (!dono) return { ok: false, motivo: "NaoDono" };
	if (e.etapa !== "posicionamento") return { ok: false, motivo: "ForaDaEtapa" };
	if (jaMoveu(e, uuid)) return { ok: false, motivo: "JaMoveu" };
	if (!movimentoValido(de, para)) return { ok: false, motivo: "UmaArea" };
	return { ok: true };
}

/**
 * Aplica um movimento já validado. Devolve o novo estado (cópia).
 * Com o grupo junto, move todos os heróis; o movimento do jogador marca a rodada.
 */
export function moverHeroi(salvo, uuid, para, { ehGM }) {
	const e = completarEstado(salvo);
	if (e.opcionais.lobosSolitarios) {
		e.herois = e.herois.map((h) => (h.uuid === uuid ? { ...h, area: para } : h));
		if (!ehGM) e.rodada.movidos = [...new Set([...e.rodada.movidos, uuid])];
	} else {
		e.grupoArea = para;
		e.herois = e.herois.map((h) => ({ ...h, area: para }));
		if (!ehGM) e.rodada.movidos = [...new Set([...e.rodada.movidos, MARCA_GRUPO])];
	}
	return e;
}

/**
 * Opções de movimento para mostrar a um usuário: para cada herói que ele pode mover agora,
 * as áreas de destino possíveis. O mestre recebe todos os heróis (com o grupo junto, um só representante).
 * @param {object} salvo
 * @param {object} quem
 * @param {boolean} quem.ehGM
 * @param {(uuid: string) => boolean} quem.ehDono
 */
export function opcoesDeMovimento(salvo, { ehGM, ehDono }) {
	const e = completarEstado(salvo);
	const lobos = e.opcionais.lobosSolitarios;
	let herois = e.herois.filter((h) => h.uuid && (ehGM || ehDono(h.uuid)));
	if (!lobos && herois.length) herois = [herois[0]]; // o grupo anda junto: basta um herói para mover todos
	return herois
		.map((h) => {
			const de = areaAtual(e, h.uuid);
			const destinos = POSICOES.map((_, i) => i).filter((para) =>
				validarMovimento(e, h.uuid, para, { ehGM, dono: true }).ok);
			return { uuid: h.uuid, nome: h.nome, de, destinos, recuar: destinos.includes(de - 1), avancar: destinos.includes(de + 1) };
		})
		.filter((o) => o.destinos.length);
}
