/**
 * T12 — Fim da batalha (puro, testável em Node): resumo do resultado e consequências ("Depois da Batalha", p. 374–375).
 *
 * A batalha termina por destruição (alguém alcança o limiar de pontos), por fuga (vantagem de 5 ou mais
 * mantida por uma rodada) ou por desistência de um general (o mestre declara o vencedor).
 */
import { completarEstado } from "./estado.js";
import { baixas, ndMedio, limiarVitoria } from "./regras.js";

export const TIPOS_FIM = ["destruicao", "fuga", "desistencia"];

/** O mestre encerra a batalha declarando o vencedor (um general desistiu do confronto). */
export function declararVencedor(salvo, vencedor, tipo = "desistencia") {
	const e = completarEstado(salvo);
	if (e.fim || ![0, 1].includes(vencedor)) return e;
	e.fim = { tipo: TIPOS_FIM.includes(tipo) ? tipo : "desistencia", vencedor, turno: e.turno };
	e.fugindo = null;
	return e;
}

/** A batalha acabou? (Trava avanço de etapas, movimentos e rolagens.) */
export const encerrada = (salvo) => !!completarEstado(salvo).fim;

/**
 * Resumo para a tela de resultado e o cartão do chat.
 * @param {object} salvo
 * @param {object} [opcoes]
 * @param {(string|number)[]} [opcoes.nds]  NDs dos inimigos da tabela do exército inimigo
 */
export function resumoFim(salvo, { nds = [] } = {}) {
	const e = completarEstado(salvo);
	if (!e.fim) return null;
	const { vencedor, tipo } = e.fim;
	const pontos = e.exercitos.map((ex) => Number(ex.pontos) || 0);
	const heroisVenceram = vencedor === 0;
	const nd = ndMedio(nds);
	return {
		tipo,
		vencedor,
		vencedorNome: e.exercitos[vencedor].nome,
		perdedorNome: e.exercitos[1 - vencedor].nome,
		heroisVenceram,
		turnos: e.fim.turno ?? e.turno,
		placar: pontos,
		limiar: limiarVitoria(e.tamanho, e.opcionais.limiarVariado),
		// Baixas de cada exército: 5% × pontos de vitória do exército adversário; metade feridos, metade mortos.
		baixas: e.exercitos.map((ex, i) => ({ exercito: ex.nome, ...baixas(pontos[1 - i]) })),
		// Espólios e experiência: só se o exército dos personagens vencer; valem o ND médio do exército inimigo.
		ndMedio: heroisVenceram && nd !== null ? Math.round(nd * 100) / 100 : null,
		semND: heroisVenceram && nd === null,
		historico: e.historico.map((h) => ({
			turno: h.turno,
			totais: h.totais ?? [],
			vencedorNome: e.exercitos[h.vencedor]?.nome ?? "",
			pontos: h.pontos,
			placar: h.placar ?? []
		}))
	};
}
