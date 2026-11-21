/**
 * T4/T5/T6 — Configurador da batalha (só o mestre).
 * Abas: Geral, Exércitos, Heróis, Inimigos, Campo, Regras opcionais.
 *
 * Edita um rascunho em memória; "Salvar" aplica só os campos de configuração sobre a batalha salva
 * (configuracao.js → aplicarConfiguracao), sem desfazer o andamento de uma batalha em curso.
 */
import { L, caminho, log } from "../modulo.js";
import { TAMANHOS, MODIFICADORES_GUERRA, POSICOES, LIMIAR_PADRAO } from "../constantes.js";
import { limiarVitoria, formulaInimigos } from "../regras.js";
import { dadosInimigo, rolarInimigo } from "../rolagens.js";
import { retratoVivo } from "../retratos.js";
import { lerBatalha, gravarBatalha } from "../armazenamento.js";
import {
	retratoDeAtor, adicionarModificador, removerIndice, adicionarRetrato, adicionarHerois, moverIndice, duplicarIndice,
	aplicarConfiguracao, pendencias, listaOpcionais
} from "../configuracao.js";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

const ABAS = ["geral", "exercitos", "herois", "inimigos", "campo", "opcionais"];

export class ConfiguradorBatalha extends HandlebarsApplicationMixin(ApplicationV2) {
	static #abertos = new Map();

	/** Abre o configurador de uma batalha (um por batalha). */
	static abrir(id) {
		if (!game.user.isGM) return ui.notifications.warn(L("SoMestre"));
		if (!lerBatalha(id)) return ui.notifications.warn(L("Configurador.NaoEncontrada"));
		let app = this.#abertos.get(id);
		if (!app) {
			app = new ConfiguradorBatalha(id);
			this.#abertos.set(id, app);
		}
		return app.render({ force: true });
	}

	constructor(idBatalha) {
		super({ id: `t20bm-configurador-${idBatalha}` });
		this.idBatalha = idBatalha;
		this.rascunho = lerBatalha(idBatalha);
		this.aba = "geral";
		this.alterado = false;
		this.pontosEditados = [false, false];
		this.comandoEditado = [false, false];
	}

	static DEFAULT_OPTIONS = {
		classes: ["t20-batalha", "t20bm-configurador"],
		tag: "div",
		window: { icon: "fa-solid fa-chess-rook", resizable: true },
		position: { width: 760, height: 720 },
		actions: {
			aba: ConfiguradorBatalha.#trocarAba,
			salvar: ConfiguradorBatalha.#salvar,
			escolherImagem: ConfiguradorBatalha.#escolherImagem,
			limparSlot: ConfiguradorBatalha.#limparSlot,
			removerDaLista: ConfiguradorBatalha.#removerDaLista,
			adicionarModificador: ConfiguradorBatalha.#adicionarModificador,
			adicionarPersonalizado: ConfiguradorBatalha.#adicionarPersonalizado,
			adicionarEstandarte: ConfiguradorBatalha.#adicionarEstandarte,
			adicionarJogadores: ConfiguradorBatalha.#adicionarJogadores,
			moverNaLista: ConfiguradorBatalha.#moverNaLista,
			duplicarNaLista: ConfiguradorBatalha.#duplicarNaLista,
			testarSorteio: ConfiguradorBatalha.#testarSorteio,
			abrirFicha: ConfiguradorBatalha.#abrirFicha
		}
	};

	static PARTS = {
		corpo: { template: caminho("templates/configurador.hbs"), scrollable: [".t20bm-aba"] }
	};

	get title() {
		const nome = this.rascunho?.nome || L("Gerenciador.SemNome");
		return `${L("Configurador.Titulo")}: ${nome}${this.alterado ? " •" : ""}`;
	}

	/* ---------------- Dados para o template ---------------- */

	async _prepareContext() {
		const e = this.rascunho;
		const modificadoresB2 = MODIFICADORES_GUERRA.map((m) => ({
			chave: m.chave,
			rotulo: `${m.nome} (${m.detalhe}) ${m.valor >= 0 ? "+" : ""}${m.valor}`
		}));
		return {
			abas: ABAS.map((chave) => ({ chave, rotulo: L(`Configurador.Abas.${chave}`), ativa: chave === this.aba })),
			aba: this.aba,
			e,
			iniciada: e.iniciada,
			tamanhos: Object.entries(TAMANHOS).map(([chave, t]) => ({
				chave, selecionado: chave === e.tamanho,
				rotulo: `${t.nome} (${t.combatentes}) · CD ${t.cd} · +1 a cada ${t.dano} de dano`
			})),
			limiar: limiarVitoria(e.tamanho, e.opcionais.limiarVariado),
			limiarVariado: e.opcionais.limiarVariado,
			limiarPadrao: LIMIAR_PADRAO,
			exercitos: e.exercitos.map((ex, i) => ({
				i,
				lado: i === 0 ? "aliado" : "inimigo",
				rotuloLado: L(i === 0 ? "Configurador.SeuExercito" : "Configurador.ExercitoInimigo"),
				nome: ex.nome,
				pontosIniciais: ex.pontosIniciais,
				pontos: ex.pontos,
				general: retratoVivo(ex.general, { comGuerra: true }),
				substituto: retratoVivo(ex.substituto),
				personalidades: ex.personalidades.map((r) => retratoVivo(r)),
				estandartes: ex.estandartes.map((r) => retratoVivo(r)),
				modificadores: ex.modificadores.map((m) => ({ ...m, sinal: m.valor >= 0 ? "+" : "" })),
				totalModificadores: ex.modificadores.reduce((s, m) => s + (Number(m.valor) || 0), 0)
			})),
			modificadoresB2,
			herois: e.herois.map((h) => retratoVivo(h)),
			formulaInimigos: formulaInimigos(e.tabelaInimigos),
			inimigos: this.aba === "inimigos"
				? await Promise.all(e.tabelaInimigos.map((entrada, i) => dadosInimigo(entrada, i + 1)))
				: [],
			opcionais: listaOpcionais(e),
			areas: e.areas.map((a, i) => ({ ...a, i, posicaoNome: POSICOES[i].nome, mod: POSICOES[i].mod })),
			avisos: pendencias(e).map((k) => L(`Configurador.Avisos.${k}`)),
			alterado: this.alterado
		};
	}

	/* ---------------- Eventos do DOM ---------------- */

	_onFirstRender(context, options) {
		super._onFirstRender?.(context, options);
		// O elemento da janela persiste entre re-renders: o listener de "change" é ligado uma vez só.
		// Campos com name="caminho.no.rascunho" atualizam o rascunho sem redesenhar (não perde o foco).
		this.element.addEventListener("change", (ev) => {
			const campo = ev.target.closest("[name]");
			if (!campo) return;
			this.#definir(campo.name, valorDoCampo(campo), { redesenhar: campo.dataset.redesenhar !== undefined });
		});
	}

	_onRender(context, options) {
		super._onRender(context, options);
		const raiz = this.element;
		this.#atualizarTitulo();

		// Soltar atores do diretório ou de compêndios.
		for (const alvo of raiz.querySelectorAll("[data-soltar]")) {
			alvo.addEventListener("dragover", (ev) => { ev.preventDefault(); alvo.classList.add("sobre"); });
			alvo.addEventListener("dragleave", () => alvo.classList.remove("sobre"));
			alvo.addEventListener("drop", (ev) => {
				ev.preventDefault();
				alvo.classList.remove("sobre");
				this.#aoSoltar(ev, alvo.dataset.soltar, alvo.dataset.modo ?? "slot");
			});
		}
	}

	async #aoSoltar(evento, caminhoCampo, modo) {
		const TE = foundry.applications.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
		const dados = TE.getDragEventData(evento);
		if (dados?.type !== "Actor" || !dados.uuid) return ui.notifications.warn(L("Configurador.SoAtores"));
		const ator = await fromUuid(dados.uuid);
		if (!ator) return;
		const retrato = retratoDeAtor(ator);

		if (modo === "slot") {
			const atual = foundry.utils.getProperty(this.rascunho, caminhoCampo) ?? {};
			const novo = { ...atual, ...retrato };
			// General: o bônus de Guerra do configurador é o que vale na rolagem; vem preenchido com o da ficha.
			const guerraFicha = Number(ator.system?.pericias?.guer?.value);
			if (caminhoCampo.endsWith(".general") && Number.isFinite(guerraFicha) && (atual.guerra === null || atual.guerra === undefined || atual.guerra === "")) {
				novo.guerra = guerraFicha;
			}
			return this.#definir(caminhoCampo, novo);
		}
		if (modo === "inimigos") {
			// Sem deduplicar: o mesmo inimigo em mais de uma face pesa o sorteio.
			return this.#definir("tabelaInimigos", [...this.rascunho.tabelaInimigos, retrato]);
		}
		if (modo === "herois") {
			return this.#definir("herois", adicionarHerois(this.rascunho.herois, [retrato]));
		}
		const lista = foundry.utils.getProperty(this.rascunho, caminhoCampo) ?? [];
		this.#definir(caminhoCampo, adicionarRetrato(lista, retrato));
	}

	#definir(caminhoCampo, valor, { redesenhar = true } = {}) {
		foundry.utils.setProperty(this.rascunho, caminhoCampo, valor);
		const ponto = caminhoCampo.match(/^exercitos\.(\d)\.pontos$/);
		if (ponto) this.pontosEditados[Number(ponto[1])] = true;
		const comando = caminhoCampo.match(/^exercitos\.(\d)\.(general|substituto)/);
		if (comando) this.comandoEditado[Number(comando[1])] = true;
		this.alterado = true;
		if (redesenhar) this.render();
		else this.#atualizarTitulo();
	}

	#atualizarTitulo() {
		const el = this.window?.title;
		if (el) el.textContent = this.title;
	}

	/* ---------------- Fechar com alterações ---------------- */

	async close(options = {}) {
		if (this.alterado && !options.descartar) {
			const descartar = await DialogV2.confirm({
				window: { title: L("Configurador.Titulo") },
				content: `<p>${L("Configurador.Descartar")}</p>`,
				rejectClose: false
			});
			if (!descartar) return this;
		}
		ConfiguradorBatalha.#abertos.delete(this.idBatalha);
		return super.close(options);
	}

	/* ---------------- Ações ---------------- */

	static #trocarAba(_ev, alvo) {
		this.aba = alvo.dataset.aba;
		this.render();
	}

	static async #salvar() {
		const atual = lerBatalha(this.idBatalha);
		if (!atual) return ui.notifications.error(L("Configurador.NaoEncontrada"));
		const novo = aplicarConfiguracao(atual, this.rascunho, { pontosEditados: this.pontosEditados, comandoEditado: this.comandoEditado });
		await gravarBatalha(this.idBatalha, novo);
		this.rascunho = lerBatalha(this.idBatalha);
		this.alterado = false;
		this.pontosEditados = [false, false];
		this.comandoEditado = [false, false];
		log("batalha salva", this.idBatalha);
		ui.notifications.info(L("Configurador.Salvo"));
		this.render();
	}

	static async #escolherImagem(_ev, alvo) {
		const campo = alvo.dataset.campo;
		const atual = foundry.utils.getProperty(this.rascunho, campo) ?? "";
		const FP = foundry.applications.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
		if (!FP) return ui.notifications.warn(L("Configurador.SemFilePicker"));
		await new FP({ type: "image", current: atual, callback: (c) => this.#definir(campo, c) }).browse(atual);
	}

	static #limparSlot(_ev, alvo) {
		const campo = alvo.dataset.campo;
		const atual = foundry.utils.getProperty(this.rascunho, campo) ?? {};
		this.#definir(campo, { ...atual, uuid: null, nome: "", img: null });
	}

	static #removerDaLista(_ev, alvo) {
		const campo = alvo.dataset.campo;
		const lista = foundry.utils.getProperty(this.rascunho, campo) ?? [];
		this.#definir(campo, removerIndice(lista, Number(alvo.dataset.indice)));
	}

	static #adicionarModificador(_ev, alvo) {
		const lado = Number(alvo.dataset.lado);
		const chave = this.element.querySelector(`select[data-modificador="${lado}"]`)?.value;
		if (!chave) return;
		const campo = `exercitos.${lado}.modificadores`;
		this.#definir(campo, adicionarModificador(foundry.utils.getProperty(this.rascunho, campo), chave));
	}

	static #adicionarPersonalizado(_ev, alvo) {
		const lado = Number(alvo.dataset.lado);
		const campo = `exercitos.${lado}.modificadores`;
		const lista = foundry.utils.getProperty(this.rascunho, campo);
		this.#definir(campo, adicionarModificador(lista, { nome: L("Configurador.NovoModificador"), valor: 1 }));
	}

	static #adicionarEstandarte(_ev, alvo) {
		const campo = `exercitos.${Number(alvo.dataset.lado)}.estandartes`;
		const lista = foundry.utils.getProperty(this.rascunho, campo) ?? [];
		this.#definir(campo, [...lista, { uuid: null, nome: L("Configurador.NovoEstandarte"), img: null, carregadoPor: null }]);
	}

	static #adicionarJogadores() {
		const atores = game.actors.filter((a) => a.type === "character" && a.hasPlayerOwner);
		if (!atores.length) return ui.notifications.info(L("Configurador.SemJogadores"));
		this.#definir("herois", adicionarHerois(this.rascunho.herois, atores.map(retratoDeAtor)));
	}

	static #moverNaLista(_ev, alvo) {
		const campo = alvo.dataset.campo;
		const i = Number(alvo.dataset.indice);
		const lista = foundry.utils.getProperty(this.rascunho, campo) ?? [];
		this.#definir(campo, moverIndice(lista, i, i + Number(alvo.dataset.direcao)));
	}

	static #duplicarNaLista(_ev, alvo) {
		const campo = alvo.dataset.campo;
		const lista = foundry.utils.getProperty(this.rascunho, campo) ?? [];
		this.#definir(campo, duplicarIndice(lista, Number(alvo.dataset.indice)));
	}

	/** Sorteia na tabela do rascunho (mesmo sem salvar) e manda o cartão só para o mestre. */
	static async #testarSorteio() {
		await rolarInimigo(this.rascunho.tabelaInimigos, { sussurrarMestre: true, danoMedio: this.rascunho.opcionais.danoMedio });
	}

	static async #abrirFicha(_ev, alvo) {
		const ator = await fromUuid(alvo.dataset.uuid);
		ator?.sheet?.render(true);
	}
}

/* ---------------- Auxiliares ---------------- */

function valorDoCampo(campo) {
	if (campo.type === "checkbox") return campo.checked;
	if (campo.type === "number") return campo.value === "" ? null : Number(campo.value);
	return campo.value;
}
