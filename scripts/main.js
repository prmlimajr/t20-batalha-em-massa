/**
 * T20 — Batalha em Massa
 *
 * Batalhas em massa de Tormenta20 (Guerra Artoniana, Apêndice B) numa cena marcada como
 * "cena de batalha": um modal com o tabuleiro aberto para toda a mesa, que só o mestre fecha.
 *
 * Spec: SDD/t20-batalha-em-massa/feature/spec.md
 */
import { MODULE_ID, SOCKET, log } from "./modulo.js";
import { registrarCena } from "./cena.js";

/* ---------------- Configurações ---------------- */

function registrarConfiguracoes() {
	// As opções de cada batalha ficam no flag da cena (T2/T6); aqui só o que vale para o mundo.
	game.settings.register(MODULE_ID, "abrirAutomaticamente", {
		name: "T20BM.Config.abrirAutomaticamente.Nome",
		hint: "T20BM.Config.abrirAutomaticamente.Dica",
		scope: "world",
		config: true,
		type: Boolean,
		default: true
	});
}

/* ---------------- Socket ---------------- */

/** Tratadores das mensagens de socket, por tipo. Preenchidos nas próximas tasks (T7, T9, T10). */
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
	registrarCena();
	log("inicializado");
});

Hooks.once("ready", () => {
	if (game.system.id !== "tormenta20") {
		ui.notifications.warn(game.i18n.localize("T20BM.SistemaIncompativel"));
		return;
	}
	registrarSocket();
	log("pronto");
});
