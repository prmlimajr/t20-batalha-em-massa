/**
 * Rolagens com o Roll do Foundry + mensagens de chat. (T5: sorteio de inimigo; T8/T10/T11 acrescentam o resto.)
 */
import { MODULE_ID, L, caminho } from "./modulo.js";
import { formulaInimigos, inimigoDaFace } from "./regras.js";
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
 * @param {boolean} [opcoes.danoMedio]        regra opcional Dano médio: mostra médias no cartão
 */
export async function rolarInimigo(tabela, { sussurrarMestre = false, heroi = null, danoMedio = false } = {}) {
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
	const content = await renderizar("inimigo.hbs", { ...dados, link, formula, heroi, danoMedio });
	const mensagem = {
		speaker: ChatMessage.getSpeaker({ alias: L("Titulo") }),
		content,
		rolls: [roll],
		flags: { [MODULE_ID]: { tipo: "inimigo", face, uuid: dados.uuid } }
	};
	if (sussurrarMestre) mensagem.whisper = ChatMessage.getWhisperRecipients("GM").map((u) => u.id);
	await ChatMessage.create(mensagem);
	return { face, entrada, roll };
}
