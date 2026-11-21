/**
 * Estado da batalha, guardado na própria cena:
 *   scene.flags["t20-batalha-em-massa"].ativa   → a cena é uma cena de batalha (checkbox da configuração da cena)
 *   scene.flags["t20-batalha-em-massa"].estado  → tudo o resto (objeto versionado, schema abaixo)
 *
 * Desmarcar a cena só muda `ativa`: o estado fica guardado e volta se a cena for marcada de novo.
 * Só o mestre grava; jogadores pedem por socket (T9/T10).
 */
import { MODULE_ID, caminho } from "./modulo.js";

export const VERSAO_ESTADO = 1;
// Etapas e posições (com modificadores) ficam em constantes.js (T3). Aqui: etapa "pre" = antes do Turno 1.

function exercitoPadrao(lado) {
	return {
		nome: lado === 0 ? "Seu exército" : "Exército inimigo",
		pontos: 0,
		general: { uuid: null, nome: "", img: null, guerra: null },
		substituto: { uuid: null, nome: "", img: null },
		personalidades: [],
		estandartes: [],
		modificadores: []
	};
}

/** Estado inicial de uma cena recém-marcada como batalha. */
export function estadoPadrao() {
	return {
		v: VERSAO_ESTADO,
		aberto: false,
		iniciada: false,
		nome: "",
		local: "",
		tamanho: "media",
		turno: 0,
		etapa: "pre",
		limiar: 10,
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
			{ posicao: "acampamento", nome: "Acampamento", subtitulo: "Acampamento" },
			{ posicao: "retaguarda", nome: "Retaguarda", subtitulo: "Retaguarda" },
			{ posicao: "front", nome: "Front", subtitulo: "Front" },
			{ posicao: "atras", nome: "Atrás das linhas inimigas", subtitulo: "Atrás das linhas inimigas" }
		],
		rodada: novaRodada(),
		historico: []
	};
}

export function novaRodada() {
	return { evento: null, danoTotal: 0, bonusEvento: 0, testesPericia: 0, movidos: [], resultadoGenerais: null };
}

/* ---------------- Leitura ---------------- */

export function ehCenaBatalha(scene) {
	return !!scene?.getFlag(MODULE_ID, "ativa");
}

/**
 * Estado da cena, completado com os padrões (campos novos de versões futuras aparecem sem migração manual).
 * Devolve uma cópia: alterar o retorno não altera a cena.
 */
export function lerEstado(scene) {
	const salvo = scene?.getFlag(MODULE_ID, "estado");
	return completarEstado(salvo);
}

/** Puro (sem Foundry): junta o estado salvo aos padrões e migra versões antigas. */
export function completarEstado(salvo) {
	const padrao = estadoPadrao();
	if (!salvo || typeof salvo !== "object") return padrao;
	const estado = mesclar(padrao, structuredClone(salvo));
	// Listas com tamanho fixo: garantir 2 exércitos e 4 áreas mesmo se o salvo estiver incompleto.
	estado.exercitos = [0, 1].map((i) => mesclar(padrao.exercitos[i], estado.exercitos?.[i] ?? {}));
	estado.areas = padrao.areas.map((a, i) => ({ ...a, ...(estado.areas?.[i] ?? {}), posicao: a.posicao }));
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

/* ---------------- Escrita (só GM) ---------------- */

export async function gravarEstado(scene, estado) {
	if (!game.user.isGM) throw new Error(`${MODULE_ID} | só o mestre grava o estado da batalha`);
	return scene.update({ [`flags.${MODULE_ID}.estado`]: estado });
}

/**
 * Usado em preCreateScene/preUpdateScene: quando a cena passa a ser de batalha e ainda não tem estado,
 * acrescenta o estado padrão às mesmas alterações (uma única gravação).
 * Puro: recebe o valor de `ativa` pedido e se já existe estado; devolve o estado a gravar ou null.
 */
export function estadoAoMarcar(ativaPedida, jaTemEstado) {
	return ativaPedida === true && !jaTemEstado ? estadoPadrao() : null;
}
