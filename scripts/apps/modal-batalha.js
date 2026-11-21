/**
 * T7 — Modal da batalha: o tabuleiro do layout, o mesmo para jogadores e mestre.
 *
 * - Abre para todos quando o mestre exibe uma batalha (configuração "exibida"; ver exibicao.js).
 * - Jogadores não fecham: sem moldura nem botão de fechar, e close() recusa (cobre Esc e closeAll).
 * - O mestre fecha só a própria visão ("Fechar para mim") ou encerra para todos ("Encerrar exibição").
 * - O mestre também pode pré-visualizar uma batalha só para ele (modo local), sem exibir para a mesa.
 * - É um modal: uma camada escura cobre a tela (bloqueia o mapa) com o tabuleiro centralizado;
 *   a barra lateral fica fora da camada, para chat e fichas continuarem acessíveis.
 */
import { L, caminho } from "../modulo.js";
import { lerBatalha, idExibida, exibirParaTodos, encerrarExibicao } from "../armazenamento.js";
import { visaoBatalha } from "../visao.js";
import { retratoVivo } from "../retratos.js";
import { ConfiguradorBatalha } from "./configurador.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const INTERVALO_CARROSSEL = 5000;

export class ModalBatalha extends HandlebarsApplicationMixin(ApplicationV2) {
	static #atual = null;

	/**
	 * Abre o modal de uma batalha.
	 * @param {string} id
	 * @param {object} [opcoes]
	 * @param {boolean} [opcoes.local]  pré-visualização só do mestre (não exibida para a mesa)
	 */
	static async abrir(id, { local = false } = {}) {
		if (!lerBatalha(id)) return null;
		if (this.#atual && this.#atual.idBatalha !== id) await this.#atual.close({ forcar: true });
		this.#atual ??= new ModalBatalha(id);
		this.#atual.local = local && game.user.isGM;
		return this.#atual.render({ force: true });
	}

	/** Fecha o modal exibido (não fecha a pré-visualização local do mestre). */
	static async fecharExibicao() {
		if (this.#atual && !this.#atual.local) await this.#atual.close({ forcar: true });
	}

	/** Redesenha se estiver aberto (batalha alterada pelo mestre). */
	static atualizar() {
		const atual = this.#atual;
		if (!atual?.rendered) return;
		if (!lerBatalha(atual.idBatalha)) return atual.close({ forcar: true }); // batalha apagada
		atual.render();
	}

	static get atual() {
		return this.#atual;
	}

	constructor(idBatalha) {
		super({});
		this.idBatalha = idBatalha;
		this.local = false;
		this.timers = [];
		this.aoRedimensionar = foundry.utils.debounce(() => this.#ajustarAreaLivre(), 100);
	}

	static DEFAULT_OPTIONS = {
		id: "t20bm-modal",
		classes: ["t20-batalha", "t20bm-modal"],
		tag: "div",
		window: { frame: false, positioned: false, minimizable: false, resizable: false },
		actions: {
			fecharLocal: ModalBatalha.#fecharLocal,
			encerrar: ModalBatalha.#encerrar,
			exibir: ModalBatalha.#exibir,
			configurar: ModalBatalha.#configurar,
			abrirFicha: ModalBatalha.#abrirFicha
		}
	};

	static PARTS = {
		tabuleiro: { template: caminho("templates/modal.hbs"), scrollable: [""] }
	};

	/* ---------------- Dados ---------------- */

	async _prepareContext() {
		const salvo = lerBatalha(this.idBatalha);
		const v = visaoBatalha(salvo, { resolver: (r) => retratoVivo(r) });
		const dadosMensagem = { area: v.mensagem.area };
		const exibida = idExibida() === this.idBatalha;
		return {
			...v,
			gm: game.user.isGM,
			previa: this.local && !exibida,
			exibida,
			rotuloTurno: v.pre ? L("Modal.PreBatalha") : L("Modal.Turno", { n: v.turno }),
			mensagemTitulo: L(`Modal.Mensagens.${v.mensagem.etapa}.Titulo`, dadosMensagem),
			mensagemTexto: L(`Modal.Mensagens.${v.mensagem.etapa}.Texto`, dadosMensagem),
			estiloFundo: v.imagens.fundo ? `background-image: url('${v.imagens.fundo}')` : "",
			estiloCampo: v.imagens.campo ? `background-image: url('${v.imagens.campo}')` : ""
		};
	}

	/* ---------------- Render ---------------- */

	_onFirstRender(context, options) {
		super._onFirstRender?.(context, options);
		window.addEventListener("resize", this.aoRedimensionar);
	}

	_onRender(context, options) {
		super._onRender(context, options);
		this.#ajustarAreaLivre();
		this.#pararCarrosseis();
		for (const carrossel of this.element.querySelectorAll(".t20bm-carrossel")) {
			const itens = [...carrossel.querySelectorAll(".t20bm-carrossel-item")];
			if (itens.length < 2) continue;
			let i = 0;
			this.timers.push(setInterval(() => {
				itens[i].classList.remove("ativo");
				i = (i + 1) % itens.length;
				itens[i].classList.add("ativo");
			}, INTERVALO_CARROSSEL));
		}
	}

	/** A camada vai da borda esquerda até a barra lateral (que fica livre). */
	#ajustarAreaLivre() {
		this.element?.style.setProperty("--t20bm-livre-direita", `${larguraDaBarraLateral()}px`);
	}

	#pararCarrosseis() {
		this.timers.forEach(clearInterval);
		this.timers = [];
	}

	/* ---------------- Fechar ---------------- */

	/** Jogadores não fecham o modal; só o mestre, ou o módulo (forcar) ao encerrar a exibição. */
	async close(options = {}) {
		if (!game.user.isGM && !options.forcar) return this;
		this.#pararCarrosseis();
		window.removeEventListener("resize", this.aoRedimensionar);
		if (ModalBatalha.#atual === this) ModalBatalha.#atual = null;
		return super.close(options);
	}

	/* ---------------- Ações ---------------- */

	static #fecharLocal() {
		this.close();
	}

	static async #encerrar() {
		await encerrarExibicao();
	}

	static async #exibir() {
		this.local = false;
		await exibirParaTodos(this.idBatalha);
	}

	static #configurar() {
		ConfiguradorBatalha.abrir(this.idBatalha);
	}

	static async #abrirFicha(_ev, alvo) {
		const uuid = alvo.dataset.uuid;
		if (!uuid) return;
		const ator = await fromUuid(uuid);
		if (ator?.testUserPermission(game.user, "OBSERVER")) ator.sheet.render(true);
	}
}

/**
 * Largura ocupada pela barra lateral à direita (chat, atores...), medida na tela.
 * Sem barra visível, 0: a camada cobre a tela toda.
 */
function larguraDaBarraLateral() {
	let largura = 0;
	for (const el of document.querySelectorAll("#sidebar, #ui-right")) {
		const r = el.getBoundingClientRect();
		if (r.width > 0 && r.height > 0 && r.left > window.innerWidth / 2) {
			largura = Math.max(largura, Math.ceil(window.innerWidth - r.left));
		}
	}
	return largura;
}
