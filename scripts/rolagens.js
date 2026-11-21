/**
 * Rolagens com o Roll do Foundry + mensagens de chat.
 * T5: sorteio de inimigo. T8: testes de pré-batalha e lembretes. (T10/T11 acrescentam evento e generais.)
 */
import { MODULE_ID, L, caminho } from "./modulo.js";
import { formulaInimigos, inimigoDaFace, vencedorOposto, motivacao } from "./regras.js";
import { CD_MOTIVACAO, TEXTO_PREPARACAO } from "./constantes.js";
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

async function enviarCartao(dados, rolls) {
	const content = await renderizar("teste.hbs", dados);
	await ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ alias: L("Titulo") }),
		content,
		rolls,
		flags: { [MODULE_ID]: { tipo: dados.tipo } }
	});
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
