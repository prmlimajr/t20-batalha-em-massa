/**
 * Onde as batalhas ficam: duas configurações do mundo, invisíveis no menu.
 *   batalhas → { [id]: estado }   (todos leem; só o mestre grava)
 *   exibida  → id da batalha aberta para toda a mesa, ou ""
 *
 * Quando o mestre grava, o Foundry avisa todos os clientes (onChange) e o módulo dispara:
 *   Hooks "t20bm.batalhas" (coleção mudou)   e   "t20bm.exibida" (id exibido mudou)
 * O gerenciador (T2) e o modal (T7) escutam esses hooks para se redesenhar.
 */
import { MODULE_ID } from "./modulo.js";
import {
	completarEstado, criarNaColecao, duplicarNaColecao, removerDaColecao, listarColecao, reiniciarBatalha
} from "./estado.js";

export const HOOK_BATALHAS = "t20bm.batalhas";
export const HOOK_EXIBIDA = "t20bm.exibida";

export function registrarArmazenamento() {
	game.settings.register(MODULE_ID, "batalhas", {
		scope: "world",
		config: false,
		type: Object,
		default: {},
		onChange: (valor) => Hooks.callAll(HOOK_BATALHAS, valor)
	});
	game.settings.register(MODULE_ID, "exibida", {
		scope: "world",
		config: false,
		type: String,
		default: "",
		onChange: (id) => Hooks.callAll(HOOK_EXIBIDA, id)
	});
}

/* ---------------- Leitura (qualquer usuário) ---------------- */

const colecao = () => foundry.utils.deepClone(game.settings.get(MODULE_ID, "batalhas") ?? {});

export const listarBatalhas = () => listarColecao(colecao());

export function lerBatalha(id) {
	const salvo = colecao()[id];
	return salvo ? completarEstado(salvo) : null;
}

export function idExibida() {
	const id = game.settings.get(MODULE_ID, "exibida");
	return id && colecao()[id] ? id : "";
}

/* ---------------- Escrita (só mestre) ---------------- */

function exigirMestre() {
	if (!game.user.isGM) throw new Error(`${MODULE_ID} | só o mestre altera as batalhas`);
}

const salvarColecao = (nova) => game.settings.set(MODULE_ID, "batalhas", nova);

export async function criarBatalha(nome) {
	exigirMestre();
	const id = foundry.utils.randomID();
	await salvarColecao(criarNaColecao(colecao(), id, nome));
	return id;
}

export async function duplicarBatalha(id, sufixo) {
	exigirMestre();
	const novo = foundry.utils.randomID();
	await salvarColecao(duplicarNaColecao(colecao(), id, novo, sufixo));
	return novo;
}

export async function gravarBatalha(id, estado) {
	exigirMestre();
	await salvarColecao({ ...colecao(), [id]: completarEstado(estado) });
}

/** Altera só alguns campos: atualizarBatalha(id, { nome: "x", "exercitos.0.pontos": 3 }). */
export async function atualizarBatalha(id, alteracoes) {
	const estado = lerBatalha(id);
	if (!estado) return;
	for (const [caminho, valor] of Object.entries(alteracoes)) foundry.utils.setProperty(estado, caminho, valor);
	await gravarBatalha(id, estado);
}

export async function reiniciar(id) {
	const estado = lerBatalha(id);
	if (estado) await gravarBatalha(id, reiniciarBatalha(estado));
}

export async function apagarBatalha(id) {
	exigirMestre();
	if (idExibida() === id) await encerrarExibicao();
	await salvarColecao(removerDaColecao(colecao(), id));
}

export async function exibirParaTodos(id) {
	exigirMestre();
	await game.settings.set(MODULE_ID, "exibida", id);
}

export async function encerrarExibicao() {
	exigirMestre();
	await game.settings.set(MODULE_ID, "exibida", "");
}
