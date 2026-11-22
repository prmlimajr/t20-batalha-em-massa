/**
 * T9 — Posicionamento (puro, testável em Node): quem pode mover qual herói, e o estado depois do movimento.
 *
 * Regras (spec, decisões 1, 17 e 21):
 * - Ao entrar no Posicionamento, a área de cada token é registrada (rodada.inicio).
 * - Enquanto a etapa durar, cada jogador move livremente o próprio herói, desde que termine a no máximo
 *   uma área da posição em que começou a rodada (pode avançar, voltar, mudar de ideia).
 * - Grupo junto (padrão): qualquer jogador com herói na batalha move o grupo inteiro.
 * - Lobos solitários: cada herói se move sozinho.
 * - Heróis mortos ficam onde caíram: não se movem com o grupo e só o mestre os move.
 * - Mestre: move qualquer herói para qualquer área, a qualquer momento.
 */
import { completarEstado } from "./estado.js";
import { areaExiste, areasDisponiveis, umPasso, AREA_CEU } from "./areas.js";

const vivo = (h) => !h.morto;

/** Pode ir para "Sob os céus"? Só quem voa; com o grupo junto, todos os heróis vivos precisam voar. */
export function podeSubir(estado, uuid) {
	if (estado.opcionais.lobosSolitarios) return !!estado.herois.find((h) => h.uuid === uuid)?.voa;
	const vivos = estado.herois.filter(vivo);
	return vivos.length > 0 && vivos.every((h) => h.voa);
}

/** Área atual de um herói (com o grupo junto, a área do grupo; morto, onde caiu). */
export function areaAtual(estado, uuid) {
	const h = estado.herois.find((x) => x.uuid === uuid);
	if (!h) return null;
	if (h.morto || estado.opcionais.lobosSolitarios) return h.area ?? estado.grupoArea;
	return estado.grupoArea;
}

/** Fotografia das posições no início do Posicionamento (rodada.inicio). */
export function registrarInicio(salvo) {
	const e = completarEstado(salvo);
	e.rodada.inicio = {
		grupo: e.grupoArea,
		herois: Object.fromEntries(e.herois.map((h) => [h.uuid, areaAtual(e, h.uuid)]))
	};
	return e;
}

/** Área em que o herói começou a rodada (sem registro, a atual). */
export function areaInicial(estado, uuid) {
	const inicio = estado.rodada?.inicio;
	if (!inicio) return areaAtual(estado, uuid);
	if (!estado.opcionais.lobosSolitarios) return inicio.grupo ?? areaAtual(estado, uuid);
	return inicio.herois?.[uuid] ?? areaAtual(estado, uuid);
}

/**
 * Valida um pedido de movimento.
 * @returns {{ ok: boolean, motivo?: string }}  motivo = chave de i18n em Posicionamento.Motivos
 */
export function validarMovimento(salvo, uuid, para, { ehGM, dono = false }) {
	const e = completarEstado(salvo);
	const heroi = e.herois.find((x) => x.uuid === uuid);
	const de = areaAtual(e, uuid);
	if (de === null) return { ok: false, motivo: "NaoEsta" };
	if (!Number.isInteger(para) || !areaExiste(e, para)) return { ok: false, motivo: "AreaInvalida" };
	if (para === de) return { ok: false, motivo: "MesmaArea" };
	if (e.fim) return { ok: false, motivo: "Encerrada" };
	if (ehGM) return { ok: true };
	if (!dono) return { ok: false, motivo: "NaoDono" };
	if (heroi.morto) return { ok: false, motivo: "Morto" };
	if (e.etapa !== "posicionamento") return { ok: false, motivo: "ForaDaEtapa" };
	if (!umPasso(e, areaInicial(e, uuid), para)) return { ok: false, motivo: "UmaArea" };
	if (para === AREA_CEU && !podeSubir(e, uuid)) return { ok: false, motivo: e.opcionais.lobosSolitarios ? "NaoVoa" : "GrupoNaoVoa" };
	return { ok: true };
}

/** Aplica um movimento já validado. Com o grupo junto, move todos os heróis vivos. */
export function moverHeroi(salvo, uuid, para) {
	const e = completarEstado(salvo);
	const alvo = e.herois.find((h) => h.uuid === uuid);
	if (e.opcionais.lobosSolitarios || alvo?.morto) {
		e.herois = e.herois.map((h) => (h.uuid === uuid ? { ...h, area: para } : h));
	} else {
		e.grupoArea = para;
		e.herois = e.herois.map((h) => (vivo(h) ? { ...h, area: para } : h));
	}
	return e;
}

/**
 * Opções de movimento para a interface: para cada herói que o usuário pode mover agora, as áreas possíveis.
 * O mestre recebe todos os heróis (com o grupo junto, um representante vivo + os mortos).
 */
export function opcoesDeMovimento(salvo, { ehGM, ehDono }) {
	const e = completarEstado(salvo);
	const lobos = e.opcionais.lobosSolitarios;
	let herois = e.herois.filter((h) => h.uuid && (ehGM || (ehDono(h.uuid) && vivo(h))));
	if (!lobos) {
		const vivos = herois.filter(vivo);
		herois = [...vivos.slice(0, 1), ...(ehGM ? herois.filter((h) => h.morto) : [])];
	}
	return herois
		.map((h) => {
			const de = areaAtual(e, h.uuid);
			const destinos = areasDisponiveis(e).filter((para) =>
				validarMovimento(e, h.uuid, para, { ehGM, dono: true }).ok);
			return {
				uuid: h.uuid, nome: h.nome, de, inicio: areaInicial(e, h.uuid), morto: !!h.morto,
				destinos, recuar: destinos.includes(de - 1), avancar: destinos.includes(de + 1)
			};
		})
		.filter((o) => o.destinos.length);
}

/* ---------------- Heróis: remover, marcar como morto, voo (mestre) ---------------- */

/** Marca (ou desmarca) que o herói voa (pode ir para "Sob os céus"). */
export function alternarVoo(salvo, uuid) {
	const e = completarEstado(salvo);
	e.herois = e.herois.map((h) => (h.uuid === uuid ? { ...h, voa: !h.voa } : h));
	return e;
}

export function removerHeroi(salvo, uuid) {
	const e = completarEstado(salvo);
	e.herois = e.herois.filter((h) => h.uuid !== uuid);
	return e;
}

/** Marca (ou desfaz) um herói como morto. Morto, ele fica na área onde caiu e solta o estandarte. */
export function alternarMorto(salvo, uuid) {
	const e = completarEstado(salvo);
	e.herois = e.herois.map((h) => {
		if (h.uuid !== uuid) return h;
		if (h.morto) return { ...h, morto: false, area: e.opcionais.lobosSolitarios ? h.area : e.grupoArea };
		return { ...h, morto: true, estandarte: false, area: areaAtual(e, uuid) };
	});
	return e;
}
