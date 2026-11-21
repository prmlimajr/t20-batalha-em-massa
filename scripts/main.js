/**
 * T20 — Batalha em Massa
 *
 * Batalhas em massa de Tormenta20 (Guerra Artoniana, Apêndice B), independentes de cena:
 * o mestre cria e configura batalhas num gerenciador e exibe uma delas para toda a mesa
 * num modal que só o mestre fecha.
 *
 * Spec: SDD/t20-batalha-em-massa/feature/spec.md
 */
import { MODULE_ID, L, log } from "./modulo.js";
import { registrarSocket } from "./socket.js";
import * as armazenamento from "./armazenamento.js";
import { GerenciadorBatalhas, MenuGerenciador } from "./apps/gerenciador.js";
import { ModalBatalha } from "./apps/modal-batalha.js";
import { registrarExibicao, sincronizarExibicao } from "./exibicao.js";

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

/* ---------------- Botão no diretório de Cenas ---------------- */

/** "Batalhas em Massa" no topo do diretório de Cenas (só o mestre). */
function adicionarBotaoCenas(app, html) {
	if (!game.user.isGM) return;
	const raiz = html instanceof HTMLElement ? html : html?.[0];
	if (!raiz || raiz.querySelector(".t20bm-botao-cenas")) return;
	const botao = document.createElement("button");
	botao.type = "button";
	botao.className = "t20bm-botao-cenas";
	botao.innerHTML = `<i class="fa-solid fa-chess-rook"></i> ${L("Gerenciador.Titulo")}`;
	botao.addEventListener("click", (ev) => {
		ev.preventDefault();
		GerenciadorBatalhas.abrir();
	});
	// v13+: ações do cabeçalho em .header-actions; senão, no início do cabeçalho do diretório.
	const destino = raiz.querySelector(".header-actions") ?? raiz.querySelector(".directory-header") ?? raiz;
	destino.append(botao);
}

/* ---------------- Hooks ---------------- */

Hooks.once("init", () => {
	registrarConfiguracoes();
	Hooks.on("renderSceneDirectory", adicionarBotaoCenas);
	Hooks.on(armazenamento.HOOK_BATALHAS, () => GerenciadorBatalhas.atualizar());
	Hooks.on(armazenamento.HOOK_EXIBIDA, (id) => {
		GerenciadorBatalhas.atualizar();
		log("batalha exibida:", id || "(nenhuma)");
	});
	registrarExibicao();
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
		abrirModal: (id, opcoes) => ModalBatalha.abrir(id ?? armazenamento.idExibida(), opcoes),
		...armazenamento
	};
	sincronizarExibicao(); // quem entra no mundo com uma batalha em exibição já recebe o modal
	log("pronto");
});
