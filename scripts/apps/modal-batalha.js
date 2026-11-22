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
import { lerBatalha, gravarBatalha, idExibida, exibirParaTodos, encerrarExibicao, reiniciar } from "../armazenamento.js";
import { resumoFim, declararVencedor } from "../fim.js";
import {
	aplicarTerreno, aplicarMotivacao, avancarEtapa, voltarEtapa, podeVoltar,
	marcarPronto, todosProntos, registrarEvento, registrarInimigo, prontosDa, ETAPAS_COM_PRONTOS
} from "../conducao.js";
import {
	rolarTesteOposto, rolarMotivacao, lembretePreparacao, rolarEvento, rolarInimigo, rolarDerrotaGeneral, rolarGeneral,
	ndsDaTabela, enviarResumoFim, rolarNovoOficial
} from "../rolagens.js";
import { composicaoBonus, podeRolar, registrarRolagem, sortearJogador, definirQuemRola, resetarGenerais } from "../generais.js";
import { atualizarResolucao, alternarEstandarte, derrotarGeneralInimigo, definirAjuste, substituirGeneral, temSubstituto } from "../evento.js";
import { animarAbertura } from "../abertura.js";
import { validarMovimento, moverHeroi, opcoesDeMovimento, removerHeroi, alternarMorto, alternarVoo } from "../posicionamento.js";
import { pedirAoMestre, registrarTratador } from "../socket.js";
import { visaoBatalha } from "../visao.js";
import { retratoVivo } from "../retratos.js";
import { ConfiguradorBatalha } from "./configurador.js";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

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
		this.abrindo = true; // animação de abertura no primeiro render
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
			pronto: ModalBatalha.#pronto,
			sortearInimigo: ModalBatalha.#sortearInimigo,
			sortearEvento: ModalBatalha.#sortearEvento,
			estandarte: ModalBatalha.#estandarte,
			generalDerrotado: ModalBatalha.#generalDerrotado,
			rolarGeneral: ModalBatalha.#rolarGeneral,
			resetarGenerais: ModalBatalha.#resetarGenerais,
			reiniciarBatalha: ModalBatalha.#reiniciarBatalha,
			declararVencedor: ModalBatalha.#declararVencedor
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
		// Movimento só por arrastar o token (sem botões); no rodapé fica a dica.
		const movimento = { mostrar: posicionando && (gm || temHeroiProprio) };
		const generais = dadosGenerais(salvo, v, gm);
		const transicao = this.#emTransicao(v.etapa);
		const fim = salvo.fim ? formatarFim(resumoFim(salvo, { nds: await ndsDaTabela(salvo) })) : null;
		const dadosMensagem = { area: v.mensagem.area };
		const chaveMensagem = v.mensagem.etapa === "posicionamento" && v.lobosSolitarios ? "posicionamentoLobos"
			: v.mensagem.etapa === "evento" && v.mensagem.ceu ? "eventoCeu" : v.mensagem.etapa;
		const exibida = idExibida() === this.idBatalha;
		return {
			...v,
			gm: game.user.isGM,
			previa: this.local && !exibida,
			exibida,
			rotuloTurno: v.pre ? L("Modal.PreBatalha") : L("Modal.Turno", { n: v.turno }),
			mensagemTitulo: generais?.mensagemTitulo ?? L(`Modal.Mensagens.${chaveMensagem}.Titulo`, dadosMensagem),
			mensagemTexto: generais?.mensagemTexto ?? L(`Modal.Mensagens.${chaveMensagem}.Texto`, dadosMensagem),
			faseGenerais: !!generais,
			resultadoRodada: this.#resultadoRodada(salvo, gm),
			transicaoGenerais: transicao,
			mostrarSecoesTurno: !generais || transicao,
			podeResetarGenerais: gm && !!generais && !salvo.fim && Object.keys(salvo.rodada.generais ?? {}).length + (salvo.rodada.resultadoGenerais ? 1 : 0) > 0,
			fim,
			podeDeclarar: gm && salvo.iniciada && !salvo.fim,
			rolagemDoJogador: this.rolandoLocal,
			podeVoltar: podeVoltar(salvo),
			prontos: dadosProntos(salvo, v.etapa),
			sorteiosDoMestre: gm && v.etapa === "evento",
			editaResolucao: gm && v.etapa === "evento",
			mostrarResolucao: (v.etapa === "evento" || v.etapa === "generais") && v.resolucoes.length > 0,
			bonusEventoTxt: v.bonusEvento > 0 ? `+${v.bonusEvento}` : String(v.bonusEvento),
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
		this.#ligarResolucao();
		this.#ligarMenuDoHeroi();
		this.#anunciarResultado(lerBatalha(this.idBatalha));
		if (this.abrindo) {
			this.abrindo = false;
			const alvo = this.element.querySelector(".t20bm-tabuleiro");
			// Espera o layout assentar (largura/altura finais) antes de medir o tabuleiro.
			requestAnimationFrame(() => animarAbertura({ container: this.element, alvo, texto: L("Modal.Abertura") }));
		}
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

	/* ---------------- Preparação: "concluí" ---------------- */

	static async #pronto(_ev, alvo) {
		const pronto = alvo.dataset.pronto === "true";
		if (!game.users.activeGM) return this.avisar(L("Socket.SemMestre"));
		await pedirAoMestre("pronto", { idBatalha: this.idBatalha, pronto });
	}

	/* ---------------- Evento: sorteios do mestre por área ---------------- */

	static #sortearInimigo(_ev, alvo) {
		const area = Number(alvo.dataset.area);
		return this.#conduzir(async (estado) => {
			const r = await rolarInimigo(estado.tabelaInimigos, {
				area: estado.areas[area]?.nome, danoMedio: estado.opcionais.danoMedio
			});
			if (!r) return;
			const inimigo = { face: r.face, uuid: r.dados.uuid, nome: r.dados.nome, img: r.dados.img };
			await gravarBatalha(this.idBatalha, registrarInimigo(lerBatalha(this.idBatalha), area, inimigo));
		});
	}

	static #sortearEvento(_ev, alvo) {
		const area = Number(alvo.dataset.area);
		return this.#conduzir(async (estado) => {
			const ajuste = estado.opcionais.posicionamentoAvancado ? (estado.rodada.ajustes?.[area] ?? 0) : 0;
			const evento = await rolarEvento(estado, area, { ajuste });
			await gravarBatalha(this.idBatalha, registrarEvento(lerBatalha(this.idBatalha), area, evento));
		});
	}

	/* ---------------- Evento: resolução (mestre) ---------------- */

	/** Campos da resolução (dano, teste, bônus manual) e o ajuste do Posicionamento avançado gravam ao mudar. */
	#ligarResolucao() {
		if (!game.user.isGM) return;
		for (const campo of this.element.querySelectorAll("[data-resolucao]")) {
			campo.addEventListener("change", async () => {
				const area = Number(campo.dataset.area);
				const nome = campo.dataset.resolucao;
				const valor = campo.type === "checkbox" ? campo.checked : campo.value;
				const estado = lerBatalha(this.idBatalha);
				const novo = nome === "ajuste" ? definirAjuste(estado, area, valor) : atualizarResolucao(estado, area, { [nome]: valor });
				await gravarBatalha(this.idBatalha, novo);
			});
		}
	}

	static async #estandarte(_ev, alvo) {
		if (!game.user.isGM) return;
		await gravarBatalha(this.idBatalha, alternarEstandarte(lerBatalha(this.idBatalha), alvo.dataset.heroi));
	}

	static #generalDerrotado(_ev, alvo) {
		const area = Number(alvo.dataset.area);
		return this.#conduzir(async (estado) => {
			const r = await rolarDerrotaGeneral(estado);
			await gravarBatalha(this.idBatalha, derrotarGeneralInimigo(lerBatalha(this.idBatalha), area, r));
		});
	}

	/* ---------------- Teste dos Generais ---------------- */

	/** Mestre rola e grava; o jogador sorteado rola no próprio cliente e manda o d20 ao mestre. */
	static async #rolarGeneral(_ev, alvo) {
		const lado = Number(alvo.dataset.lado);
		const estado = lerBatalha(this.idBatalha);
		if (!podeRolar(estado, lado, { ehGM: game.user.isGM, userId: game.user.id })) return;
		if (game.user.isGM) {
			return this.#conduzir(async (e) => {
				const d20 = await rolarGeneral(e, lado, composicaoBonus(e, lado));
				const anterior = lerBatalha(this.idBatalha);
				const { estado: novo } = registrarRolagem(anterior, lado, { d20, por: game.user.id });
				await gravarComFim(this.idBatalha, anterior, novo);
			});
		}
		if (this.rolandoLocal) return;
		if (!game.users.activeGM) return this.avisar(L("Socket.SemMestre"));
		this.rolandoLocal = true;
		this.render();
		try {
			const d20 = await rolarGeneral(estado, lado, composicaoBonus(estado, lado));
			await pedirAoMestre("rolagemGeneral", { idBatalha: this.idBatalha, lado, d20 });
		} finally {
			this.rolandoLocal = false;
			if (this.rendered) this.render();
		}
	}

	/**
	 * Transição Evento → Teste dos Generais: as seções do turno somem (fade) e os cartões crescem (slide).
	 * Dura ~1,6 s a partir da primeira renderização já na etapa dos generais.
	 */
	#emTransicao(etapa) {
		if (etapa === "generais" && this.etapaRenderizada === "evento") this.transicaoAte = Date.now() + 1600;
		this.etapaRenderizada = etapa;
		return etapa === "generais" && Date.now() < (this.transicaoAte ?? 0);
	}

	/**
	 * Painel do vencedor da rodada: fica sobre o tabuleiro até o mestre encerrar o turno.
	 * A animação de entrada toca uma vez por resultado (não a cada atualização).
	 */
	#resultadoRodada(estado, gm) {
		const r = estado.rodada?.resultadoGenerais;
		if (estado.etapa !== "generais" || !r || r.empate || estado.fim) return null;
		const chave = `${estado.turno}:${r.vencedor}:${r.pontos}:${r.totais?.join("x")}`;
		const animar = this.resultadoVisto !== chave;
		this.resultadoVisto = chave;
		const notas = [];
		if (r.desempateBonus) notas.push(L("Generais.DesempateBonus"));
		if (r.fugindo !== null && r.fugindo !== undefined) notas.push(L("Generais.Fuga", { exercito: estado.exercitos[r.fugindo].nome }));
		else if (r.fugaInterrompida) notas.push(L("Generais.FugaInterrompida"));
		return {
			lado: r.vencedor === 0 ? "aliado" : "inimigo",
			animar,
			titulo: L("Generais.VenceRodada", { exercito: estado.exercitos[r.vencedor].nome }),
			subtitulo: L(r.pontos === 1 ? "Generais.MarcaPonto" : "Generais.MarcaPontos", { pontos: r.pontos }),
			totais: r.totais?.length ? `${r.totais[0]} × ${r.totais[1]}` : "",
			placar: `${estado.exercitos[0].pontos} × ${estado.exercitos[1].pontos}`,
			notas,
			gm
		};
	}

	static async #resetarGenerais() {
		if (!game.user.isGM) return;
		const ok = await DialogV2.confirm({
			window: { title: L("Generais.Resetar") },
			content: `<p>${L("Generais.ResetarConfirma")}</p>`,
			rejectClose: false
		});
		if (!ok) return;
		this.ultimoResultado = ""; // o próximo resultado anima de novo
		await gravarBatalha(this.idBatalha, resetarGenerais(lerBatalha(this.idBatalha)));
	}

	/* ---------------- Heróis: menu do mestre (clique direito no token) ---------------- */

	#ligarMenuDoHeroi() {
		if (!game.user.isGM) return;
		for (const retrato of this.element.querySelectorAll(".t20bm-token.general[data-lado]")) {
			retrato.addEventListener("contextmenu", (ev) => {
				ev.preventDefault();
				this.#removerGeneral(Number(retrato.dataset.lado));
			});
		}
		for (const token of this.element.querySelectorAll(".t20bm-token.heroi")) {
			token.addEventListener("contextmenu", (ev) => {
				ev.preventDefault();
				this.#menuDoHeroi(token.dataset.heroi);
			});
		}
	}

	async #menuDoHeroi(uuid) {
		const estado = lerBatalha(this.idBatalha);
		const heroi = estado?.herois.find((h) => h.uuid === uuid);
		if (!heroi) return;
		const nome = retratoVivo(heroi).nome || heroi.nome;
		const escolha = await DialogV2.wait({
			window: { title: nome },
			content: `<p>${L("Herois.MenuTexto", { nome })}</p>`,
			buttons: [
				{ action: "morto", label: L(heroi.morto ? "Herois.Reviver" : "Herois.MarcarMorto"), icon: heroi.morto ? "fa-solid fa-heart-pulse" : "fa-solid fa-skull" },
				...(estado.ceu?.ativo ? [{ action: "voo", label: L(heroi.voa ? "Herois.NaoVoa" : "Herois.Voa"), icon: "fa-solid fa-feather" }] : []),
				{ action: "remover", label: L("Herois.Remover"), icon: "fa-solid fa-user-minus" },
				{ action: "cancelar", label: L("Fim.Cancelar"), default: true }
			],
			rejectClose: false
		});
		const atual = lerBatalha(this.idBatalha);
		if (escolha === "morto") await gravarBatalha(this.idBatalha, alternarMorto(atual, uuid));
		if (escolha === "remover") await gravarBatalha(this.idBatalha, removerHeroi(atual, uuid));
		if (escolha === "voo") await gravarBatalha(this.idBatalha, alternarVoo(atual, uuid));
	}

	/* ---------------- General: remover da cena (mestre) ---------------- */

	/** O general sai de cena e o substituto assume nos próximos Testes dos Generais. */
	async #removerGeneral(lado) {
		const estado = lerBatalha(this.idBatalha);
		const ex = estado?.exercitos[lado];
		if (!ex) return;
		const atual = retratoVivo(ex.general).nome || L("Generais.SemNome");
		const anterior = Number(ex.general?.guerra) || 0;

		// Sem substituto (ou já usado): um oficial assume pela regra de general derrotado (anterior −1d6−1).
		if (!temSubstituto(ex)) {
			const ok = await DialogV2.confirm({
				window: { title: L("Generais.Remover") },
				content: `<p>${L("Generais.RemoverSemSubstituto", { atual, min: anterior - 7, max: anterior - 2 })}</p>`,
				rejectClose: false
			});
			if (!ok) return;
			return this.#conduzir(async (e) => {
				const guerra = await rolarNovoOficial(e, lado);
				await gravarBatalha(this.idBatalha, substituirGeneral(lerBatalha(this.idBatalha), lado, guerra));
			});
		}

		const sub = retratoVivo(ex.substituto, { comGuerra: true });
		const novo = sub.nome || L("Evento.Oficial");
		const sugestao = sub.guerraFicha ?? anterior;
		const guerra = await DialogV2.prompt({
			window: { title: L("Generais.Remover") },
			content: `<p>${L("Generais.RemoverTexto", { atual, novo })}</p>
				<div class="form-group"><label>${L("Generais.GuerraNovo", { novo })}</label>
				<div class="form-fields"><input type="number" name="guerra" step="1" value="${sugestao}" autofocus></div>
				<p class="hint">${L("Generais.GuerraNovoDica", { ficha: sub.guerraFicha ?? "—" })}</p></div>`,
			ok: { label: L("Generais.Remover"), icon: "fa-solid fa-user-slash", callback: (_e, botao) => botao.form.elements.guerra.value },
			rejectClose: false
		});
		if (guerra === null || guerra === undefined) return;
		await gravarBatalha(this.idBatalha, substituirGeneral(lerBatalha(this.idBatalha), lado, guerra));
	}

	/* ---------------- Fim da batalha (mestre) ---------------- */

	static async #reiniciarBatalha() {
		if (!game.user.isGM) return;
		const ok = await DialogV2.confirm({
			window: { title: L("Gerenciador.Reiniciar") },
			content: `<p>${L("Fim.ReiniciarConfirma")}</p>`,
			rejectClose: false
		});
		if (ok) await reiniciar(this.idBatalha);
	}

	static async #declararVencedor() {
		if (!game.user.isGM) return;
		const estado = lerBatalha(this.idBatalha);
		const escolha = await DialogV2.wait({
			window: { title: L("Fim.Declarar") },
			content: `<p>${L("Fim.DeclararTexto")}</p>`,
			buttons: [
				{ action: "0", label: estado.exercitos[0].nome, icon: "fa-solid fa-flag" },
				{ action: "1", label: estado.exercitos[1].nome, icon: "fa-solid fa-flag" },
				{ action: "cancelar", label: L("Fim.Cancelar"), default: true }
			],
			rejectClose: false
		});
		if (escolha !== "0" && escolha !== "1") return;
		const anterior = lerBatalha(this.idBatalha);
		await gravarComFim(this.idBatalha, anterior, declararVencedor(anterior, Number(escolha)));
	}

	/** Animação quando sai um resultado novo do Teste dos Generais (vencedor ou empate) ou a batalha termina. */
	#anunciarResultado(estado) {
		const r = estado?.rodada?.resultadoGenerais;
		const f = estado?.fim;
		const chave = f ? `fim:${f.vencedor}:${f.tipo}:${f.turno}`
			: r ? `${estado.turno}:${r.empate ? `empate${r.vez}` : `${r.vencedor}:${r.pontos}`}` : "";
		if (this.ultimoResultado === undefined) {
			this.ultimoResultado = chave; // ao abrir o modal, não repete um resultado antigo
			return;
		}
		if (!chave || chave === this.ultimoResultado) return;
		this.ultimoResultado = chave;
		const alvo = this.element.querySelector(".t20bm-tabuleiro");
		if (f) {
			return requestAnimationFrame(() => animarAbertura({
				container: this.element, alvo, classe: f.vencedor === 0 ? "aliado" : "inimigo",
				texto: L("Fim.VenceBatalha", { exercito: estado.exercitos[f.vencedor].nome }),
				subtitulo: L(`Fim.Tipo.${f.tipo}`)
			}));
		}
		if (r.empate) {
			return requestAnimationFrame(() => animarAbertura({
				container: this.element, alvo, imagem: null, classe: "empate",
				texto: L("Generais.Empate"), subtitulo: L("Generais.RolemDeNovo")
			}));
		}
		// O vencedor da rodada é o painel persistente do tabuleiro (resultadoRodada no template).
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
			let { estado: novo, entrou } = avancarEtapa(estado);
			// Teste dos Generais: sorteia o jogador (exceto o mestre) que rola pelo general aliado.
			if (entrou === "generais" && !novo.rodada.rolaGeneral) {
				const jogadores = game.users.filter((u) => u.active && !u.isGM).map((u) => u.id);
				novo = definirQuemRola(novo, sortearJogador(jogadores));
			}
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

/* ---------------- Preparação e Posicionamento: quem precisa marcar "concluí" ---------------- */

/**
 * Jogadores conectados que precisam concluir a etapa: os donos dos heróis vivos da batalha.
 * Se nenhum jogador conectado é dono de herói vivo, todos os jogadores conectados.
 */
function jogadoresObrigatorios(estado) {
	const ativos = game.users.filter((u) => u.active && !u.isGM);
	const ehDono = (u) => estado.herois.some((h) => !h.morto && fromUuidSync(h.uuid, { strict: false })?.testUserPermission?.(u, "OWNER"));
	const comHeroi = ativos.filter(ehDono);
	return comHeroi.length ? comHeroi : ativos;
}

function dadosProntos(estado, etapa) {
	if (!ETAPAS_COM_PRONTOS.includes(etapa) || estado.fim) return { mostrar: false };
	const prontos = new Set(prontosDa(estado, etapa));
	const obrigatorios = jogadoresObrigatorios(estado);
	const jogadores = obrigatorios.map((u) => ({ nome: u.name, pronto: prontos.has(u.id) }));
	return {
		mostrar: jogadores.length > 0,
		jogadores,
		total: jogadores.length,
		quantos: jogadores.filter((j) => j.pronto).length,
		euObrigatorio: obrigatorios.some((u) => u.id === game.user.id),
		euPronto: prontos.has(game.user.id),
		rotuloConcluir: L(`Prontos.Concluir.${etapa}`)
	};
}

registrarTratador("pronto", async ({ idBatalha, pronto }, usuario) => {
	let estado = lerBatalha(idBatalha);
	if (!estado || !ETAPAS_COM_PRONTOS.includes(estado.etapa) || estado.fim || usuario.isGM) return;
	estado = marcarPronto(estado, usuario.id, pronto);
	// Todos prontos: a etapa avança sozinha (Preparação → Posicionamento → Evento).
	if (todosProntos(estado, jogadoresObrigatorios(estado).map((u) => u.id))) estado = avancarEtapa(estado).estado;
	await gravarBatalha(idBatalha, estado);
});

/* ---------------- Teste dos Generais: dados para o tabuleiro ---------------- */

const sinal = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "+0");

/** Na etapa dos generais: composição do bônus, rolagens e botões em cada cartão de exército. */
function dadosGenerais(estado, v, gm) {
	if (v.etapa !== "generais") return null;
	const r = estado.rodada.resultadoGenerais;
	const sorteado = estado.rodada.rolaGeneral ? game.users.get(estado.rodada.rolaGeneral) : null;
	v.exercitos.forEach((ex, i) => {
		const comp = composicaoBonus(estado, i);
		const rolagem = estado.rodada.generais?.[i] ?? null;
		ex.teste = {
			lado: i,
			itens: comp.itens.map((it) => ({ ...it, valorTxt: sinal(it.valor) })),
			totalTxt: sinal(comp.total),
			rolagem: rolagem && { ...rolagem, bonusTxt: sinal(rolagem.bonus) },
			podeRolar: podeRolar(estado, i, { ehGM: gm, userId: game.user.id }),
			quem: i === 0 && sorteado ? sorteado.name : L("Generais.Mestre"),
			venceu: !!r && !r.empate && r.vencedor === i
		};
	});
	if (!r || r.empate) {
		return r?.empate
			? { mensagemTitulo: L("Generais.Empate"), mensagemTexto: L("Generais.RolemDeNovo") }
			: { mensagemTitulo: L("Modal.Mensagens.generais.Titulo"), mensagemTexto: L("Modal.Mensagens.generais.Texto") };
	}
	const nome = estado.exercitos[r.vencedor].nome;
	const notas = [];
	if (r.desempateBonus) notas.push(L("Generais.DesempateBonus"));
	if (estado.fim) notas.push(L(`Generais.Fim.${estado.fim.tipo}`, { exercito: estado.exercitos[estado.fim.vencedor].nome }));
	else if (r.fugindo !== null && r.fugindo !== undefined) notas.push(L("Generais.Fuga", { exercito: estado.exercitos[r.fugindo].nome }));
	else if (r.fugaInterrompida) notas.push(L("Generais.FugaInterrompida"));
	return {
		mensagemTitulo: L("Generais.VenceRodadaFrase", { exercito: nome, pontos: r.pontos }),
		mensagemTexto: notas.join(" ") || L("Generais.Proximo")
	};
}

registrarTratador("rolagemGeneral", async ({ idBatalha, lado, d20 }, usuario) => {
	const estado = lerBatalha(idBatalha);
	const valor = Math.trunc(Number(d20));
	if (!estado || !(valor >= 1 && valor <= 20)) return;
	if (!podeRolar(estado, lado, { ehGM: usuario.isGM, userId: usuario.id })) return;
	await gravarComFim(idBatalha, estado, registrarRolagem(estado, lado, { d20: valor, por: usuario.id }).estado);
});

/* ---------------- Fim da batalha ---------------- */

/** Grava (mestre) e, se a batalha acabou de terminar, manda o resumo para o chat. */
async function gravarComFim(id, anterior, novo) {
	await gravarBatalha(id, novo);
	if (!anterior.fim && novo.fim) {
		const dados = formatarFim(resumoFim(novo, { nds: await ndsDaTabela(novo) }));
		await enviarResumoFim(dados);
	}
}

const fmtNumero = (n) => (Number.isInteger(n) ? String(n) : String(n).replace(".", ","));

/** Textos da tela de resultado e do cartão de chat. */
function formatarFim(r) {
	if (!r) return null;
	return {
		...r,
		titulo: L("Fim.VenceBatalha", { exercito: r.vencedorNome }),
		tipoTxt: L(`Fim.Tipo.${r.tipo}`),
		lado: r.vencedor === 0 ? "aliado" : "inimigo",
		placarTxt: `${r.placar[0]} × ${r.placar[1]}`,
		turnosTxt: L(r.turnos === 1 ? "Fim.UmTurno" : "Fim.Turnos", { n: r.turnos }),
		baixas: r.baixas.map((b) => ({ ...b, texto: L("Fim.BaixasTexto", { percentual: fmtNumero(b.percentual), feridos: fmtNumero(b.feridos), mortos: fmtNumero(b.mortos) }) })),
		recompensa: r.ndMedio !== null ? L("Fim.Recompensa", { nd: fmtNumero(r.ndMedio) }) : r.semND ? L("Fim.SemND") : null,
		derrotaHerois: !r.heroisVenceram ? L("Fim.DerrotaHerois") : null,
		historico: r.historico.map((h) => ({ ...h, totaisTxt: h.totais.length ? `${h.totais[0]} × ${h.totais[1]}` : "—", placarTxt: h.placar.length ? `${h.placar[0]} × ${h.placar[1]}` : "" }))
	};
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
