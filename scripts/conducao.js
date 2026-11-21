/**
 * T8 — Condução das etapas (puro, testável em Node): pré-batalha (terreno, motivação), iniciar, avançar e voltar.
 * Recebe e devolve estados completos (cópias); quem grava é o mestre (armazenamento.gravarBatalha).
 */
import { MODIFICADORES_GUERRA, ETAPA_PRE, ETAPAS } from "./constantes.js";
import { completarEstado, novaRodada } from "./estado.js";
import { proximaEtapa, etapaAnterior, motivacao } from "./regras.js";

const modificadorB2 = (chave, valor) => {
	const m = MODIFICADORES_GUERRA.find((x) => x.chave === chave);
	return { chave, nome: m.nome, detalhe: m.detalhe, valor: valor ?? m.valor, automatico: true };
};

/** Tira de um exército os modificadores com estas chaves (para refazer terreno/motivação sem duplicar). */
const semChaves = (lista, chaves) => lista.filter((m) => !chaves.includes(m.chave));

/* ---------------- Pré-batalha ---------------- */

/** Terreno: o vencedor do teste oposto de Sobrevivência recebe Terreno favorável (+2); refazer substitui. */
export function aplicarTerreno(salvo, vencedor) {
	const e = completarEstado(salvo);
	e.exercitos.forEach((ex, i) => {
		ex.modificadores = semChaves(ex.modificadores, ["terreno"]);
		if (i === vencedor) ex.modificadores.push(modificadorB2("terreno"));
	});
	return e;
}

/** Motivação de um exército pelo total do teste de Atuação: motivadas (+1, +1 a cada 5) ou desmotivadas (−2). */
export function aplicarMotivacao(salvo, lado, total) {
	const e = completarEstado(salvo);
	const ex = e.exercitos[lado];
	ex.modificadores = semChaves(ex.modificadores, ["motivadas", "desmotivadas"]);
	const valor = motivacao(total);
	if (valor > 0) ex.modificadores.push(modificadorB2("motivadas", valor));
	else if (valor < 0) ex.modificadores.push(modificadorB2("desmotivadas", valor));
	return { estado: e, valor };
}

/* ---------------- Etapas ---------------- */

export const etapaAtual = (salvo) => completarEstado(salvo).etapa;

/**
 * Avança uma etapa. Da pré-batalha, inicia a batalha (Turno 1, Preparação) e trava Lobos solitários.
 * Depois do Teste dos Generais, começa o turno seguinte com uma rodada nova.
 * @returns {{ estado: object, entrou: string, novoTurno: boolean }}
 */
export function avancarEtapa(salvo) {
	const e = completarEstado(salvo);
	const prox = proximaEtapa(e.etapa, e.turno);
	if (e.etapa === ETAPA_PRE) e.iniciada = true;
	e.etapa = prox.etapa;
	e.turno = prox.turno;
	if (prox.novaRodada) e.rodada = novaRodada();
	return { estado: e, entrou: e.etapa, novoTurno: prox.novaRodada };
}

/** Volta uma etapa dentro do turno (não volta para antes da Preparação nem para a pré-batalha). */
export function voltarEtapa(salvo) {
	const e = completarEstado(salvo);
	const ant = etapaAnterior(e.etapa, e.turno);
	const mudou = ant.etapa !== e.etapa;
	e.etapa = ant.etapa;
	return { estado: e, mudou };
}

export const podeVoltar = (salvo) => {
	const etapa = completarEstado(salvo).etapa;
	return ETAPAS.findIndex((x) => x.chave === etapa) > 0;
};
