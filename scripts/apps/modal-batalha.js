/**
 * T7 — Modal da batalha: o tabuleiro do layout, o mesmo para jogadores e mestre.
 *
 * - Abre para todos quando o mestre exibe uma batalha (configuração "exibida"; ver exibicao.js).
 * - Jogadores não fecham: sem moldura nem botão de fechar, e close() recusa (cobre Esc e closeAll).
 * - O mestre fecha só a própria visão ("Fechar para mim") ou encerra para todos ("Encerrar exibição").
 * - O mestre também pode pré-visualizar uma batalha só para ele (modo local), sem exibir para a mesa.
 * - É um modal: uma camada escura cobre a tela até a barra lateral (bloqueia o mapa), com o tabuleiro
 *   centralizado (altura máxima de 80% da tela). A barra lateral fica livre e qualquer janela do Foundry
 *   (fichas, chat destacado, diálogos) aparece por cima do modal: os jogadores sempre veem o chat e a ficha.
 */
import { L, caminho } from "../modulo.js";
import { lerBatalha, gravarBatalha, idExibida, exibirParaTodos, encerrarExibicao } from "../armazenamento.js";
import { aplicarTerreno, aplicarMotivacao, avancarEtapa, voltarEtapa, podeVoltar } from "../conducao.js";
import { rolarTesteOposto, rolarMotivacao, lembretePreparacao } from "../rolagens.js";
import { validarMovimento, moverHeroi, opcoesDeMovimento, jaMoveu } from "../posicionamento.js";
import { pedirAoMestre, registrarTratador } from "../socket.js";
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
		this.ocupado = false;
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
			abrirFicha: ModalBatalha.#abrirFicha,
			terreno: ModalBatalha.#terreno,
			motivacao: ModalBatalha.#motivacao,
			avancar: ModalBatalha.#avancar,
			voltar: ModalBatalha.#voltar,
			mover: ModalBatalha.#moverPorBotao
		}
	};

	static PARTS = {
		tabuleiro: { template: caminho("templates/modal.hbs"), scrollable: [""] }
	};

	/* ---------------- Dados ---------------- */

	async _prepareContext() {
		const salvo = lerBatalha(this.idBatalha);
		const v = visaoBatalha(salvo, { resolver: (r) => retratoVivo(r) });
		const gm = game.user.isGM;
		const ehDono = (uuid) => !!fromUuidSync(uuid, { strict: false })?.isOwner;
		const opcoes = opcoesDeMovimento(salvo, { ehGM: gm, ehDono });
		const destinosDe = new Map(opcoes.map((o) => [o.uuid, o.destinos]));
		for (const area of v.areas) {
			for (const h of area.herois) {
				// Com o grupo junto, o mestre arrasta qualquer herói (move o grupo); o jogador, o próprio.
				const destinos = destinosDe.get(h.uuid) ?? (gm || ehDono(h.uuid) ? opcoes[0]?.destinos : null);
				h.arrastavel = !!destinos?.length;
				h.destinos = destinos?.join(",") ?? "";
			}
		}
		const posicionando = v.etapa === "posicionamento";
		const temHeroiProprio = salvo.herois.some((h) => ehDono(h.uuid));
		const movimento = {
			mostrar: posicionando && (gm || temHeroiProprio),
			opcoes: opcoes.map((o) => ({
				...o,
				rotulo: v.lobosSolitarios ? o.nome : L("Posicionamento.Grupo"),
				paraRecuar: o.de - 1,
				paraAvancar: o.de + 1
			})),
			jaMoveu: posicionando && !gm && !v.lobosSolitarios && jaMoveu(salvo, salvo.herois[0]?.uuid),
			lobos: v.lobosSolitarios
		};
		const dadosMensagem = { area: v.mensagem.area };
		const chaveMensagem = v.mensagem.etapa === "posicionamento" && v.lobosSolitarios ? "posicionamentoLobos" : v.mensagem.etapa;
		const exibida = idExibida() === this.idBatalha;
		return {
			...v,
			gm: game.user.isGM,
			previa: this.local && !exibida,
			exibida,
			rotuloTurno: v.pre ? L("Modal.PreBatalha") : L("Modal.Turno", { n: v.turno }),
			mensagemTitulo: L(`Modal.Mensagens.${chaveMensagem}.Titulo`, dadosMensagem),
			mensagemTexto: L(`Modal.Mensagens.${chaveMensagem}.Texto`, dadosMensagem),
			podeVoltar: podeVoltar(salvo),
			movimento,
			ocupado: this.ocupado,
			estiloFundo: v.imagens.fundo ? `background-image: url('${v.imagens.fundo}')` : "",
			estiloCampo: v.imagens.campo ? `background-image: url('${v.imagens.campo}')` : ""
		};
	}

	/* ---------------- Render ---------------- */

	_onFirstRender(context, options) {
		super._onFirstRender?.(context, options);
		window.addEventListener("resize", this.aoRedimensionar);
		// Recolher/expandir a barra lateral muda a área livre.
		this.ganchoBarra = Hooks.on("collapseSidebar", () => this.aoRedimensionar());
	}

	_onRender(context, options) {
		super._onRender(context, options);
		this.#ajustarAreaLivre();
		this.#ligarArrastar();
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

	/** A camada vai da borda esquerda até a barra lateral, que fica livre. */
	#ajustarAreaLivre() {
		this.element?.style.setProperty("--t20bm-livre-direita", `${larguraDaBarraLateral()}px`);
	}

	/** Aviso no próprio tabuleiro por alguns segundos (e nas notificações do Foundry). */
	avisar(texto) {
		ui.notifications.warn(texto);
		const el = this.element?.querySelector(".t20bm-aviso-modal");
		if (!el) return;
		el.textContent = texto;
		el.classList.add("visivel");
		clearTimeout(this.timerAviso);
		this.timerAviso = setTimeout(() => el.classList.remove("visivel"), 4000);
	}

	/* ---------------- Posicionamento (arrastar entre áreas) ---------------- */

	#ligarArrastar() {
		const raiz = this.element;
		const areas = [...raiz.querySelectorAll(".t20bm-area-campo")];
		const limpar = () => areas.forEach((a) => a.classList.remove("pode-receber", "sobre"));
		for (const token of raiz.querySelectorAll(".t20bm-token.heroi[draggable='true']")) {
			token.addEventListener("dragstart", (ev) => {
				const destinos = token.dataset.destinos.split(",").filter(Boolean).map(Number);
				this.arrastando = { uuid: token.dataset.heroi, destinos };
				ev.dataTransfer.setData("text/plain", `t20bm-heroi:${token.dataset.heroi}`);
				ev.dataTransfer.effectAllowed = "move";
				for (const a of areas) if (destinos.includes(Number(a.dataset.area))) a.classList.add("pode-receber");
			});
			token.addEventListener("dragend", () => { this.arrastando = null; limpar(); });
		}
		for (const area of areas) {
			const indice = Number(area.dataset.area);
			const aceita = () => this.arrastando?.destinos.includes(indice);
			area.addEventListener("dragover", (ev) => { if (aceita()) { ev.preventDefault(); area.classList.add("sobre"); } });
			area.addEventListener("dragleave", () => area.classList.remove("sobre"));
			area.addEventListener("drop", (ev) => {
				if (!aceita()) return;
				ev.preventDefault();
				const { uuid } = this.arrastando;
				this.arrastando = null;
				limpar();
				this.#mover(uuid, indice);
			});
		}
	}

	static #moverPorBotao(_ev, alvo) {
		return this.#mover(alvo.dataset.heroi, Number(alvo.dataset.para));
	}

	/** Mestre grava direto; jogador valida aqui (para avisar) e pede ao mestre, que valida de novo e grava. */
	async #mover(uuid, para) {
		const estado = lerBatalha(this.idBatalha);
		if (!estado) return;
		if (game.user.isGM) {
			if (!validarMovimento(estado, uuid, para, { ehGM: true }).ok) return;
			return gravarBatalha(this.idBatalha, moverHeroi(estado, uuid, para, { ehGM: true }));
		}
		const dono = !!fromUuidSync(uuid, { strict: false })?.isOwner;
		const v = validarMovimento(estado, uuid, para, { ehGM: false, dono });
		if (!v.ok) return this.avisar(L(`Posicionamento.Motivos.${v.motivo}`));
		if (!game.users.activeGM) return this.avisar(L("Socket.SemMestre"));
		await pedirAoMestre("moverHeroi", { idBatalha: this.idBatalha, heroi: uuid, para });
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
		if (this.ganchoBarra) Hooks.off("collapseSidebar", this.ganchoBarra);
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

	/* ---------------- Condução (só o mestre) ---------------- */

	/** Executa uma ação do mestre uma de cada vez (evita cliques duplos durante as rolagens). */
	async #conduzir(fn) {
		if (!game.user.isGM || this.ocupado) return;
		this.ocupado = true;
		this.render();
		try {
			await fn(lerBatalha(this.idBatalha));
		} catch (erro) {
			console.error("t20-batalha-em-massa |", erro);
			ui.notifications.error(L("Modal.Falha"));
		} finally {
			this.ocupado = false;
			if (this.rendered) this.render();
		}
	}

	static #terreno() {
		return this.#conduzir(async (estado) => {
			const { vencedor } = await rolarTesteOposto(estado, "sobr", { titulo: L("Teste.Terreno"), tipo: "terreno" });
			await gravarBatalha(this.idBatalha, aplicarTerreno(lerBatalha(this.idBatalha), vencedor));
		});
	}

	static #motivacao() {
		return this.#conduzir(async (estado) => {
			const totais = await rolarMotivacao(estado);
			let novo = lerBatalha(this.idBatalha);
			totais.forEach((total, lado) => { novo = aplicarMotivacao(novo, lado, total).estado; });
			await gravarBatalha(this.idBatalha, novo);
		});
	}

	static #avancar() {
		return this.#conduzir(async (estado) => {
			const { estado: novo, entrou } = avancarEtapa(estado);
			await gravarBatalha(this.idBatalha, novo);
			if (entrou === "preparacao") await lembretePreparacao(novo.turno);
		});
	}

	static #voltar() {
		return this.#conduzir(async (estado) => {
			const { estado: novo, mudou } = voltarEtapa(estado);
			if (mudou) await gravarBatalha(this.idBatalha, novo);
		});
	}

	static async #abrirFicha(_ev, alvo) {
		const uuid = alvo.dataset.uuid;
		if (!uuid) return;
		const ator = await fromUuid(uuid);
		if (ator?.testUserPermission(game.user, "OBSERVER")) ator.sheet.render(true);
	}
}

/**
 * Largura ocupada pela barra lateral à direita, medida pelas partes visíveis dela (abas e conteúdo).
 * Não usa #ui-right: no v14 ele inclui uma coluna transparente (notificações) mais larga que a barra.
 * Sem barra visível, 0: a camada cobre a tela toda.
 */
const SELETORES_BARRA = ["#sidebar-tabs", "#sidebar-content", "#sidebar > nav", "#sidebar .sidebar-tab.active", "#sidebar"];

function larguraDaBarraLateral() {
	let esquerda = window.innerWidth;
	for (const el of document.querySelectorAll(SELETORES_BARRA.join(","))) {
		const r = el.getBoundingClientRect();
		const visivel = r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
		// Só o que está do lado direito da tela (as abas ficam à esquerda do conteúdo, sem encostar na borda).
		if (visivel && r.left > window.innerWidth / 2 && r.right > window.innerWidth * 0.8) {
			esquerda = Math.min(esquerda, r.left);
		}
	}
	return Math.max(0, Math.ceil(window.innerWidth - esquerda));
}

/* ---------------- Pedido de movimento (executado pelo mestre ativo) ---------------- */

registrarTratador("moverHeroi", async ({ idBatalha, heroi, para }, usuario) => {
	const estado = lerBatalha(idBatalha);
	if (!estado) return;
	const ator = await fromUuid(heroi).catch(() => null);
	const dono = !!ator?.testUserPermission(usuario, "OWNER");
	const v = validarMovimento(estado, heroi, para, { ehGM: usuario.isGM, dono });
	if (!v.ok) return console.warn(`t20-batalha-em-massa | movimento recusado (${v.motivo})`, usuario.name, heroi, para);
	await gravarBatalha(idBatalha, moverHeroi(estado, heroi, para, { ehGM: usuario.isGM }));
});
