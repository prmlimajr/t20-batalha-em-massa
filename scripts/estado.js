/**
 * Estado de uma batalha e operações puras sobre a coleção de batalhas (sem Foundry: testável em Node).
 *
 * As batalhas não dependem de cena. Ficam numa configuração do mundo (ver armazenamento.js):
 *   batalhas = { [id]: estado }   exibida = id | ""
 */
import { caminho } from "./modulo.js";

export const VERSAO_ESTADO = 1;
// Etapas e posições (com modificadores) ficam em constantes.js (T3). Etapa "pre" = antes do Turno 1.

function exercitoPadrao(lado) {
	return {
		nome: lado === 0 ? "Seu exército" : "Exército inimigo",
		pontosIniciais: 0,
		pontos: 0,
		general: { uuid: null, nome: "", img: null, guerra: null },
		substituto: { uuid: null, nome: "", img: null },
		personalidades: [],
		estandartes: [],
		modificadores: []
	};
}

/** Estado inicial de uma batalha nova. */
export function estadoPadrao(nome = "") {
	return {
		v: VERSAO_ESTADO,
		nome,
		local: "",
		tamanho: "media",
		iniciada: false,
		turno: 0,
		etapa: "pre",
		imagens: {
			fundo: caminho("assets/fundo.png"),
			campo: caminho("assets/campodebatalha.png")
		},
		opcionais: {
			acoesAbertas: false,
			posicionamentoAvancado: false,
			lobosSolitarios: false,
			limiarVariado: false,
			danoMedio: false,
			rolandoPelosGenerais: false
		},
		exercitos: [exercitoPadrao(0), exercitoPadrao(1)],
		herois: [],
		grupoArea: 1,
		tabelaInimigos: [],
		areas: [
			// O subtítulo de cada área é fixo: o nome da posição (constantes.POSICOES).
			{ posicao: "acampamento", nome: "Acampamento" },
			{ posicao: "retaguarda", nome: "Retaguarda" },
			{ posicao: "front", nome: "Front" },
			{ posicao: "atras", nome: "Atrás das linhas inimigas" }
		],
		rodada: novaRodada(),
		historico: []
	};
}

export function novaRodada() {
	return { evento: null, danoTotal: 0, bonusEvento: 0, testesPericia: 0, movidos: [], resultadoGenerais: null };
}

/* ---------------- Completar / migrar ---------------- */

/**
 * Junta o estado salvo aos padrões e migra versões antigas (campos novos aparecem sem migração manual).
 * Devolve uma cópia: alterar o retorno não altera o salvo.
 */
export function completarEstado(salvo) {
	const padrao = estadoPadrao();
	if (!salvo || typeof salvo !== "object") return padrao;
	const estado = mesclar(padrao, structuredClone(salvo));
	// Listas com tamanho fixo: garantir 2 exércitos e 4 áreas mesmo se o salvo estiver incompleto.
	estado.exercitos = [0, 1].map((i) => mesclar(padrao.exercitos[i], estado.exercitos?.[i] ?? {}));
	estado.areas = padrao.areas.map((a, i) => ({ nome: estado.areas?.[i]?.nome || a.nome, posicao: a.posicao }));
	delete estado.limiar; // v0 guardava o limiar; agora é sempre calculado (regras.limiarVitoria)
	estado.v = VERSAO_ESTADO;
	return estado;
}

/** Mescla profunda só de objetos simples; arrays e valores do salvo substituem os do padrão. */
function mesclar(padrao, salvo) {
	if (!eObjeto(padrao) || !eObjeto(salvo)) return salvo === undefined ? padrao : salvo;
	const saida = { ...padrao };
	for (const [k, v] of Object.entries(salvo)) saida[k] = k in padrao ? mesclar(padrao[k], v) : v;
	return saida;
}

const eObjeto = (x) => x !== null && typeof x === "object" && !Array.isArray(x);

/* ---------------- Ciclo de vida de uma batalha ---------------- */

/** Mantém toda a configuração e volta a batalha ao início (placar inicial, turno 0, heróis na Retaguarda). */
export function reiniciarBatalha(estado) {
	const e = completarEstado(estado);
	e.iniciada = false;
	e.turno = 0;
	e.etapa = "pre";
	e.grupoArea = 1;
	e.herois = e.herois.map((h) => ({ ...h, area: 1 }));
	for (const ex of e.exercitos) {
		ex.pontos = ex.pontosIniciais;
		ex.estandartes = ex.estandartes.map((s) => ({ ...s, carregadoPor: null }));
	}
	e.rodada = novaRodada();
	e.historico = [];
	return e;
}

/* ---------------- Coleção de batalhas (puro: recebe e devolve cópias) ---------------- */

export function criarNaColecao(colecao, id, nome) {
	return { ...colecao, [id]: estadoPadrao(nome) };
}

/** Cópia com a mesma configuração, do início, com " (cópia)" no nome. */
export function duplicarNaColecao(colecao, idOrigem, idNovo, sufixo = " (cópia)") {
	const origem = colecao[idOrigem];
	if (!origem) return colecao;
	const copia = reiniciarBatalha(origem);
	copia.nome = `${copia.nome}${sufixo}`;
	return { ...colecao, [idNovo]: copia };
}

export function removerDaColecao(colecao, id) {
	const { [id]: _removida, ...resto } = colecao;
	return resto;
}

/** Lista ordenada por nome, para exibir no gerenciador. */
export function listarColecao(colecao) {
	return Object.entries(colecao ?? {})
		.map(([id, salvo]) => ({ id, ...completarEstado(salvo) }))
		.sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
}
