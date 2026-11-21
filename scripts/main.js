/**
 * T20 — Batalha em Massa
 *
 * Batalhas em massa de Tormenta20 (Guerra Artoniana, Apêndice B), independentes de cena:
 * o mestre cria e configura batalhas num gerenciador e exibe uma delas para toda a mesa
 * num modal que só o mestre fecha.
 *
 * Spec: SDD/t20-batalha-em-massa/feature/spec.md
 */
import { MODULE_ID, SOCKET, L, log } from "./modulo.js";
import * as armazenamento from "./armazenamento.js";
import { GerenciadorBatalhas, MenuGerenciador } from "./apps/gerenciador.js";

/* ---------------- Configurações ---------------- */

function registrarConfiguracoes() {
	armazenamento.registrarArmazenamento();
	game.settings.registerMenu(MODULE_ID, "gerenciador", {
		name: "T20BM.Gerenciador.Titulo",
		label: "T20BM.Gerenciador.Abrir",
		hint: "T20BM.Gerenciador.Dica",
		icon: "fa-solid fa-chess-rook",
		type: MenuGerenciador,
		restricted: true
	});
}

/* ---------------- Botão nos controles da cena ---------------- */

function adicionarBotaoControles(controles) {
	if (!game.user.isGM) return;
	try {
		// v13+: controles é um objeto { tokens: { tools: {...} }, ... }
		const tokens = controles.tokens ?? controles.token;
		if (!tokens?.tools) return;
		tokens.tools.t20bmGerenciador = {
			name: "t20bmGerenciador",
			title: L("Gerenciador.Titulo"),
			icon: "fa-solid fa-chess-rook",
			order: Object.keys(tokens.tools).length,
			button: true,
			visible: true,
			onChange: () => GerenciadorBatalhas.abrir()
		};
	} catch (erro) {
		console.warn(`${MODULE_ID} | não foi possível adicionar o botão aos controles`, erro);
	}
}

/* ---------------- Socket ---------------- */

/** Tratadores das mensagens de socket, por tipo. Preenchidos nas próximas tasks (T9, T10). */
const TRATADORES = {};

function registrarSocket() {
	game.socket.on(SOCKET, (mensagem) => {
		const tratador = TRATADORES[mensagem?.tipo];
		if (!tratador) return log("mensagem de socket desconhecida", mensagem);
		tratador(mensagem);
	});
}

/* ---------------- Hooks ---------------- */

Hooks.once("init", () => {
	registrarConfiguracoes();
	Hooks.on("getSceneControlButtons", adicionarBotaoControles);
	Hooks.on(armazenamento.HOOK_BATALHAS, () => GerenciadorBatalhas.atualizar());
	Hooks.on(armazenamento.HOOK_EXIBIDA, (id) => {
		GerenciadorBatalhas.atualizar();
		log("batalha exibida:", id || "(nenhuma)"); // T7: abrir/fechar o modal para todos
	});
	log("inicializado");
});

Hooks.once("ready", () => {
	if (game.system.id !== "tormenta20") {
		ui.notifications.warn(L("SistemaIncompativel"));
		return;
	}
	registrarSocket();
	game.modules.get(MODULE_ID).api = {
		abrirGerenciador: () => GerenciadorBatalhas.abrir(),
		...armazenamento
	};
	log("pronto");
});
