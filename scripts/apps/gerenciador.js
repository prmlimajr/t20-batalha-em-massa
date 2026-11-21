/**
 * T2 — Gerenciador de batalhas (só o mestre).
 * Lista as batalhas do mundo; criar, duplicar, renomear, reiniciar, apagar, configurar e exibir para todos.
 * Acesso: botão nos controles de token, menu nas configurações do módulo, ou
 *   game.modules.get("t20-batalha-em-massa").api.abrirGerenciador()
 */
import { L, caminho } from "../modulo.js";
import { TAMANHOS } from "../constantes.js";
import { ConfiguradorBatalha } from "./configurador.js";
import { ModalBatalha } from "./modal-batalha.js";
import {
	listarBatalhas, idExibida, lerBatalha, criarBatalha, duplicarBatalha, atualizarBatalha, reiniciar,
	apagarBatalha, exibirParaTodos, encerrarExibicao
} from "../armazenamento.js";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

export class GerenciadorBatalhas extends HandlebarsApplicationMixin(ApplicationV2) {
	static #instancia = null;

	/** Abre (ou traz para a frente) a janela única do gerenciador. */
	static abrir() {
		if (!game.user.isGM) return ui.notifications.warn(L("SoMestre"));
		this.#instancia ??= new GerenciadorBatalhas();
		return this.#instancia.render({ force: true });
	}

	/** Redesenha se estiver aberto (chamado pelos hooks de armazenamento). */
	static atualizar() {
		if (this.#instancia?.rendered) this.#instancia.render();
	}

	static DEFAULT_OPTIONS = {
		classes: ["t20-batalha", "t20bm-gerenciador"],
		tag: "div",
		window: { title: "T20BM.Gerenciador.Titulo", icon: "fa-solid fa-chess-rook", resizable: true },
		position: { width: 620, height: "auto" },
		actions: {
			criar: GerenciadorBatalhas.#criar,
			configurar: GerenciadorBatalhas.#configurar,
			renomear: GerenciadorBatalhas.#renomear,
			duplicar: GerenciadorBatalhas.#duplicar,
			reiniciar: GerenciadorBatalhas.#reiniciar,
			apagar: GerenciadorBatalhas.#apagar,
			exibir: GerenciadorBatalhas.#exibir,
			encerrar: GerenciadorBatalhas.#encerrar,
			visualizar: GerenciadorBatalhas.#visualizar
		}
	};

	static PARTS = {
		lista: { template: caminho("templates/gerenciador.hbs") }
	};

	async _prepareContext() {
		const exibida = idExibida();
		const batalhas = listarBatalhas().map((b) => ({
			id: b.id,
			nome: b.nome || L("Gerenciador.SemNome"),
			local: b.local,
			tamanho: TAMANHOS[b.tamanho]?.nome ?? b.tamanho,
			exercitos: `${b.exercitos[0].nome} × ${b.exercitos[1].nome}`,
			placar: `${b.exercitos[0].pontos} × ${b.exercitos[1].pontos}`,
			andamento: b.iniciada ? L("Gerenciador.Turno", { n: b.turno }) : L("Gerenciador.NaoIniciada"),
			exibida: b.id === exibida
		}));
		return { batalhas, vazia: batalhas.length === 0, algumaExibida: !!exibida };
	}

	/* ---------------- Ações ---------------- */

	static async #criar() {
		const nome = await pedirNome(L("Gerenciador.Nova"), "");
		if (nome === null) return;
		await criarBatalha(nome);
	}

	static #configurar(_evento, alvo) {
		ConfiguradorBatalha.abrir(idDe(alvo));
	}

	static async #renomear(_evento, alvo) {
		const id = idDe(alvo);
		const nome = await pedirNome(L("Gerenciador.Renomear"), lerBatalha(id)?.nome ?? "");
		if (nome !== null) await atualizarBatalha(id, { nome });
	}

	static async #duplicar(_evento, alvo) {
		await duplicarBatalha(idDe(alvo), ` ${L("Gerenciador.SufixoCopia")}`);
	}

	static async #reiniciar(_evento, alvo) {
		const id = idDe(alvo);
		if (await confirmar(L("Gerenciador.Reiniciar"), L("Gerenciador.ReiniciarConfirma"), lerBatalha(id)?.nome)) {
			await reiniciar(id);
		}
	}

	static async #apagar(_evento, alvo) {
		const id = idDe(alvo);
		if (await confirmar(L("Gerenciador.Apagar"), L("Gerenciador.ApagarConfirma"), lerBatalha(id)?.nome)) {
			await apagarBatalha(id);
		}
	}

	static async #exibir(_evento, alvo) {
		await exibirParaTodos(idDe(alvo));
	}

	static async #encerrar() {
		await encerrarExibicao();
	}

	/** Abre o tabuleiro só para o mestre: pré-visualização, ou reabrir a batalha exibida depois de fechar para si. */
	static #visualizar(_evento, alvo) {
		const id = idDe(alvo);
		ModalBatalha.abrir(id, { local: idExibida() !== id });
	}
}

/** Entrada do menu de configurações: o Foundry instancia a classe; delega para a janela única. */
export class MenuGerenciador extends GerenciadorBatalhas {
	render() { return GerenciadorBatalhas.abrir(); }
}

/* ---------------- Auxiliares ---------------- */

const idDe = (alvo) => alvo.closest("[data-id]")?.dataset.id;

const escapar = (texto) => foundry.utils.escapeHTML?.(texto ?? "")
	?? String(texto ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

async function pedirNome(titulo, atual) {
	try {
		const nome = await DialogV2.prompt({
			window: { title: titulo },
			content: `<div class="form-group"><label>${L("Gerenciador.Nome")}</label>
				<div class="form-fields"><input type="text" name="nome" value="${escapar(atual)}" autofocus></div></div>`,
			ok: { label: L("Gerenciador.Salvar"), callback: (_e, botao) => botao.form.elements.nome.value.trim() },
			rejectClose: false
		});
		return nome ?? null;
	} catch {
		return null;
	}
}

async function confirmar(titulo, texto, nome) {
	return DialogV2.confirm({
		window: { title: titulo },
		content: `<p>${texto.replace("{nome}", `<strong>${escapar(nome || L("Gerenciador.SemNome"))}</strong>`)}</p>`,
		rejectClose: false
	});
}
