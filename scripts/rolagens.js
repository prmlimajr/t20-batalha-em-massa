/**
 * Rolagens com o Roll do Foundry + mensagens de chat.
 * T5: sorteio de inimigo. T8: testes de pré-batalha e lembretes. (T10/T11 acrescentam evento e generais.)
 */
import { MODULE_ID, L, caminho, guerraInimigaOculta } from "./modulo.js";
import { mostraGuerra, OCULTO } from "./generais.js";
import { formulaInimigos, inimigoDaFace, vencedorOposto, motivacao, eventoPorTotal, cdDaBatalha } from "./regras.js";
import { modDaArea, nomeDaArea, subtituloDaArea, AREA_CEU, CD_EXTRA_CEU, BONUS_RESOLVER_CEU } from "./areas.js";
import { CD_MOTIVACAO, TEXTO_PREPARACAO, MECANICAS, TAMANHOS, PONTOS_DERROTAR_GENERAL, PENALIDADE_NOVO_GENERAL } from "./constantes.js";
import { retratoVivo } from "./retratos.js";
import { resumoInimigo, comSinal } from "./inimigos.js";

const renderizar = (arquivo, dados) => {
	const fn = foundry.applications.handlebars?.renderTemplate ?? globalThis.renderTemplate;
	return fn(caminho(`templates/chat/${arquivo}`), dados);
};

/** Carrega o ator de uma entrada da tabela (funciona para atores do mundo e de compêndios). */
export async function carregarInimigo(entrada) {
	if (!entrada?.uuid) return null;
	try {
		return await fromUuid(entrada.uuid);
	} catch {
		return null;
	}
}

/** Dados do cartão de um inimigo (também usados pela aba Inimigos do configurador). */
export async function dadosInimigo(entrada, face) {
	const ator = await carregarInimigo(entrada);
	const r = ator ? resumoInimigo(ator) : { nome: entrada?.nome ?? "", img: entrada?.img ?? null, armas: [], ataquesTexto: [] };
	return {
		...r,
		face,
		uuid: entrada?.uuid ?? null,
		nome: r.nome || entrada?.nome || "?",
		img: r.img ?? entrada?.img ?? null,
		atorSumiu: !!entrada?.uuid && !ator,
		naoAmeaca: !!ator && ator.type !== "npc",
		fortTxt: comSinal(r.fort),
		reflTxt: comSinal(r.refl),
		vontTxt: comSinal(r.vont),
		armas: r.armas.map((a) => ({ ...a, bonusTxt: comSinal(a.bonusAtaque) }))
	};
}

/**
 * Sorteia um inimigo da tabela (1dN, N = quantidade de inimigos) e manda o cartão para o chat.
 * @param {object[]} tabela         estado.tabelaInimigos
 * @param {object} [opcoes]
 * @param {boolean} [opcoes.sussurrarMestre]  só o mestre vê (teste no configurador)
 * @param {string} [opcoes.heroi]             nome do herói que enfrenta o inimigo (T10)
 * @param {string} [opcoes.area]              nome da área do campo de batalha
 * @param {boolean} [opcoes.danoMedio]        regra opcional Dano médio: mostra médias no cartão
 */
export async function rolarInimigo(tabela, { sussurrarMestre = false, heroi = null, area = null, danoMedio = false } = {}) {
	const formula = formulaInimigos(tabela);
	if (!formula) {
		ui.notifications.warn(L("Inimigos.TabelaVazia"));
		return null;
	}
	const roll = await new Roll(formula).evaluate();
	const face = roll.total;
	const entrada = inimigoDaFace(tabela, face);
	const dados = await dadosInimigo(entrada, face);
	// Link enriquecido pelo chat do Foundry; colchetes/chaves no nome quebrariam a sintaxe.
	const nomeLimpo = dados.nome.replace(/[[\]{}]/g, "");
	const link = dados.uuid && !dados.atorSumiu ? `@UUID[${dados.uuid}]{${nomeLimpo}}` : dados.nome;
	const content = await renderizar("inimigo.hbs", { ...dados, link, formula, heroi, area, danoMedio });
	const mensagem = {
		speaker: ChatMessage.getSpeaker({ alias: L("Titulo") }),
		content,
		rolls: [roll],
		flags: { [MODULE_ID]: { tipo: "inimigo", face, uuid: dados.uuid } }
	};
	if (sussurrarMestre) mensagem.whisper = ChatMessage.getWhisperRecipients("GM").map((u) => u.id);
	await ChatMessage.create(mensagem);
	return { face, entrada, dados, roll };
}

/* =====================================================================
   T8 — Testes dos generais na pré-batalha (Sobrevivência, Atuação) e lembretes
   ===================================================================== */

const MAX_DESEMPATES = 10;

/**
 * Bônus do general numa perícia.
 * Guerra: sempre o bônus cadastrado no configurador (1d20 + bônus); vazio = 0.
 * Sobrevivência/Atuação (testes opcionais de pré-batalha): valor da ficha do ator, senão 0.
 * @returns {{ bonus: number, fonte: "configurador"|"ficha"|"nenhum" }}
 */
export async function bonusDoGeneral(general, pericia) {
	if (pericia === "guer") {
		const definido = general?.guerra !== null && general?.guerra !== undefined && general.guerra !== "";
		return { bonus: definido ? Number(general.guerra) || 0 : 0, fonte: definido ? "configurador" : "nenhum" };
	}
	const ator = await carregarInimigo(general);
	const valor = Number(ator?.system?.pericias?.[pericia]?.value);
	if (ator && Number.isFinite(valor)) return { bonus: valor, fonte: "ficha" };
	return { bonus: 0, fonte: "nenhum" };
}

/** Dados de um lado para o cartão (nome do exército, general e imagem). */
function ladoDoCartao(estado, i) {
	const ex = estado.exercitos[i];
	const g = retratoVivo(ex.general);
	return { lado: i === 0 ? "aliado" : "inimigo", exercito: ex.nome, general: g.nome || "—", img: g.img };
}

async function rolarD20(bonus) {
	return new Roll("1d20 + @bonus", { bonus }).evaluate();
}

async function enviarCartao(dados, rolls, { som = false } = {}) {
	const content = await renderizar("teste.hbs", dados);
	const mensagem = {
		speaker: ChatMessage.getSpeaker({ alias: L("Titulo") }),
		content,
		rolls,
		flags: { [MODULE_ID]: { tipo: dados.tipo } }
	};
	if (som) mensagem.sound = CONFIG.sounds.dice;
	await ChatMessage.create(mensagem);
}

/**
 * Rolagem secreta: anima os dados no Dice So Nice só para os mestres; os outros jogadores veem dados
 * fantasmas (se tiverem essa opção ligada no Dice So Nice) ou nada. O cartão vai para o chat sem o Roll
 * anexado, para que nem a animação pública nem os dados da mensagem revelem o d20 e o bônus.
 * @returns {Promise<boolean>} true se o Dice So Nice animou (senão, o cartão toca o som de dados)
 */
async function animarSecreta(roll) {
	if (!game.dice3d?.showForRoll) return false;
	const mestres = game.users.filter((u) => u.isGM && u.active).map((u) => u.id);
	try {
		await game.dice3d.showForRoll(roll, game.user, true, mestres, false);
		return true;
	} catch (erro) {
		console.warn(`${MODULE_ID} | Dice So Nice falhou na rolagem secreta`, erro);
		return false;
	}
}

const nomePericia = (chave) => game.i18n.localize(CONFIG.T20?.pericias?.[chave]?.label ?? chave);

/**
 * Teste oposto dos dois generais (Terreno: Sobrevivência). Empate: maior bônus; persistindo, rola de novo.
 * @returns {Promise<{ vencedor: 0|1|null }>}  null só se empatar MAX_DESEMPATES vezes seguidas
 */
export async function rolarTesteOposto(estado, pericia, { titulo, tipo }) {
	const bonus = await Promise.all([0, 1].map((i) => bonusDoGeneral(estado.exercitos[i].general, pericia)));
	const rodadas = [];
	const rolls = [];
	let vencedor = null;
	for (let n = 0; n < MAX_DESEMPATES && vencedor === null; n++) {
		const r = await Promise.all(bonus.map((b) => rolarD20(b.bonus)));
		rolls.push(...r);
		vencedor = vencedorOposto(r[0].total, r[1].total, bonus[0].bonus, bonus[1].bonus);
		rodadas.push(r.map((roll, i) => ({ d20: roll.dice[0]?.total ?? roll.total - bonus[i].bonus, bonus: bonus[i].bonus, total: roll.total })));
	}
	const ultima = rodadas.at(-1);
	const empatouTotal = ultima[0].total === ultima[1].total;
	const linhas = [0, 1].map((i) => ({
		...ladoDoCartao(estado, i),
		...ultima[i],
		bonusTxt: comSinal(bonus[i].bonus),
		semFicha: bonus[i].fonte === "nenhum",
		venceu: vencedor === i
	}));
	await enviarCartao({
		tipo,
		titulo,
		subtitulo: L("Teste.Oposto", { pericia: nomePericia(pericia) }),
		linhas,
		resultado: vencedor === null ? L("Teste.EmpatePersistente") : L("Teste.Vence", { exercito: linhas[vencedor].exercito }),
		notas: [
			...(rodadas.length > 1 ? [L("Teste.Desempates", { n: rodadas.length - 1 })] : []),
			...(vencedor !== null && empatouTotal ? [L("Teste.DesempateBonus")] : [])
		]
	}, rolls);
	return { vencedor };
}

/** Motivação dos dois exércitos: Atuação do general contra CD 20. Devolve o total de cada um. */
export async function rolarMotivacao(estado) {
	const bonus = await Promise.all([0, 1].map((i) => bonusDoGeneral(estado.exercitos[i].general, "atua")));
	const rolls = await Promise.all(bonus.map((b) => rolarD20(b.bonus)));
	const linhas = [0, 1].map((i) => {
		const total = rolls[i].total;
		const valor = motivacao(total);
		return {
			...ladoDoCartao(estado, i),
			d20: rolls[i].dice[0]?.total ?? total - bonus[i].bonus,
			bonusTxt: comSinal(bonus[i].bonus),
			total,
			semFicha: bonus[i].fonte === "nenhum",
			venceu: valor > 0,
			efeito: valor > 0 ? L("Teste.Motivadas", { valor: comSinal(valor) }) : valor < 0 ? L("Teste.Desmotivadas") : L("Teste.SemEfeito")
		};
	});
	await enviarCartao({
		tipo: "motivacao",
		titulo: L("Teste.Motivacao"),
		subtitulo: L("Teste.ContraCD", { pericia: nomePericia("atua"), cd: CD_MOTIVACAO }),
		linhas
	}, rolls);
	return rolls.map((r) => r.total);
}

/** Lembrete da etapa Preparação (caixa "Duração de Efeitos"). */
export async function lembretePreparacao(turno) {
	await enviarCartao({
		tipo: "preparacao",
		titulo: L("Teste.PreparacaoTitulo", { n: turno }),
		texto: TEXTO_PREPARACAO
	}, []);
}

/* =====================================================================
   T10 — Evento de uma área (Tabela B-5): 1d20 + modificador da posição
   ===================================================================== */

/**
 * Sorteia o evento de uma área do campo de batalha e manda o cartão para o chat.
 * @param {object} estado   batalha
 * @param {number} area     índice da área (0–3)
 * @returns {Promise<{ total: number, d20: number, chave: string, nome: string }>}
 */
export async function rolarEvento(estado, area, { ajuste = 0 } = {}) {
	const mod = modDaArea(estado, area) + ajuste;
	const roll = await new Roll("1d20 + @mod", { mod }).evaluate();
	const d20 = roll.dice[0]?.total ?? roll.total - mod;
	const evento = eventoPorTotal(roll.total);
	const mecanica = MECANICAS[evento.mecanica];
	const tamanho = TAMANHOS[estado.tamanho] ?? TAMANHOS.media;
	const pericias = (evento.pericias ?? []).map(nomePericia);
	const content = await renderizar("evento.hbs", {
		area: nomeDaArea(estado, area),
		posicao: subtituloDaArea(area),
		mod: comSinal(mod),
		d20,
		total: roll.total,
		nome: evento.nome,
		texto: evento.texto,
		mecanica: mecanica?.nome,
		mecanicaTexto: mecanica?.texto,
		pericias: pericias.join(", "),
		cd: pericias.length ? cdDaBatalha(estado.tamanho) + (area === AREA_CEU ? CD_EXTRA_CEU : 0) : null,
		notaCeu: area === AREA_CEU ? L("Ceu.NotaEvento", { cd: CD_EXTRA_CEU, bonus: BONUS_RESOLVER_CEU }) : null,
		combate: !!mecanica?.combate,
		danoPorBonus: tamanho.dano
	});
	await ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ alias: L("Titulo") }),
		content,
		rolls: [roll],
		flags: { [MODULE_ID]: { tipo: "evento", area, chave: evento.chave } }
	});
	return { total: roll.total, d20, chave: evento.chave, nome: evento.nome };
}

/** Enfrentar general: o grupo derrotou o general inimigo → 1d4+1 pontos de vitória e −(1d6+1) na Guerra do novo. */
export async function rolarDerrotaGeneral(estado) {
	const [pontos, penalidade] = await Promise.all([
		new Roll(PONTOS_DERROTAR_GENERAL).evaluate(),
		new Roll(PENALIDADE_NOVO_GENERAL).evaluate()
	]);
	const inimigo = estado.exercitos[1];
	const anterior = Number(inimigo.general?.guerra) || 0;
	const novo = inimigo.substituto?.nome || retratoVivo(inimigo.substituto).nome || L("Evento.Oficial");
	await enviarCartao({
		tipo: "generalDerrotado",
		titulo: L("Evento.GeneralDerrotado"),
		subtitulo: inimigo.general?.nome || retratoVivo(inimigo.general).nome,
		resultado: L("Evento.GanhaPontos", { exercito: estado.exercitos[0].nome, pontos: pontos.total }),
		notas: [guerraInimigaOculta()
			? L("Evento.NovoGeneralOculto", { nome: novo, penalidade: penalidade.total })
			: L("Evento.NovoGeneral", { nome: novo, guerra: comSinal(anterior - penalidade.total), penalidade: penalidade.total })]
	}, [pontos, penalidade]);
	return { pontos: pontos.total, penalidade: penalidade.total };
}

/**
 * General removido sem substituto (ou com o substituto já usado): um oficial assume com a Guerra do
 * anterior −(1d6+1), a regra de general derrotado. Manda o cartão para o chat e devolve a nova Guerra.
 */
export async function rolarNovoOficial(estado, lado) {
	const penalidade = await new Roll(PENALIDADE_NOVO_GENERAL).evaluate();
	const ex = estado.exercitos[lado];
	const anterior = Number(ex.general?.guerra) || 0;
	const guerra = anterior - penalidade.total;
	await enviarCartao({
		tipo: "novoOficial",
		titulo: L("Generais.Remover"),
		subtitulo: `${ex.nome} · ${ex.general?.nome || retratoVivo(ex.general).nome || ""}`,
		resultado: mostraGuerra(lado, { ocultar: guerraInimigaOculta(), ehGM: false })
			? L("Evento.NovoGeneral", { nome: L("Evento.Oficial"), guerra: comSinal(guerra), penalidade: penalidade.total })
			: L("Evento.NovoGeneralOculto", { nome: L("Evento.Oficial"), penalidade: penalidade.total })
	}, [penalidade]);
	return guerra;
}

/* =====================================================================
   T11 — Teste dos Generais: 1d20 + bônus discriminado
   ===================================================================== */

/**
 * Rola pelo general de um exército e manda o cartão para o chat (com os itens do bônus).
 * @param {object} estado
 * @param {0|1} lado
 * @param {{ itens: {valor:number, texto:string}[], total: number }} composicao  (generais.composicaoBonus)
 * @returns {Promise<number>} o resultado do d20
 */
export async function rolarGeneral(estado, lado, composicao) {
	const roll = await new Roll("1d20 + @bonus", { bonus: composicao.total }).evaluate();
	const d20 = roll.dice[0]?.total ?? roll.total - composicao.total;
	// O cartão é público: com o bônus base do general inimigo oculto, só o total aparece (sem d20 nem bônus).
	const mostra = mostraGuerra(lado, { ocultar: guerraInimigaOculta(), ehGM: false });
	const animou = !mostra && (await animarSecreta(roll));
	await enviarCartao({
		tipo: "general",
		titulo: L("Generais.Cartao"),
		subtitulo: game.user.isGM ? "" : L("Generais.RoladoPor", { nome: game.user.name }),
		linhas: [{
			...ladoDoCartao(estado, lado),
			d20: mostra ? d20 : "",
			bonusTxt: mostra ? comSinal(composicao.total) : "",
			total: roll.total
		}],
		notas: composicao.itens.map((i) => `${i.base && !mostra ? OCULTO : comSinal(i.valor)} ${i.texto}`)
	}, mostra ? [roll] : [], { som: !mostra && !animou });
	return d20;
}

/* =====================================================================
   T12 — Fim da batalha
   ===================================================================== */

/** NDs dos inimigos da tabela (para espólios e XP). Atores de compêndio são carregados. */
export async function ndsDaTabela(estado) {
	const atores = await Promise.all((estado.tabelaInimigos ?? []).map(carregarInimigo));
	return atores.map((a) => a?.system?.attributes?.nd ?? a?.system?.detalhes?.nd).filter((nd) => nd !== undefined && nd !== null && nd !== "");
}

/** Resumo do fim da batalha no chat (dados de fim.resumoFim, já formatados pelo modal). */
export async function enviarResumoFim(dados) {
	const content = await renderizar("fim.hbs", dados);
	await ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ alias: L("Titulo") }),
		content,
		flags: { [MODULE_ID]: { tipo: "fim" } }
	});
}
