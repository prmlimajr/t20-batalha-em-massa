/**
 * Regras do Apêndice B como funções puras (sem Foundry, sem rolagens): testáveis em Node.
 * As rolagens (Roll do Foundry) ficam em rolagens.js; aqui só entram os resultados.
 *
 * Regras da mesa onde o livro não diz:
 * - Empate em teste oposto (generais, Sobrevivência): vence quem tem o maior bônus; se empatar de novo, rola-se outra vez.
 * - SUPOSIÇÃO: os dois exércitos passando do limiar na mesma rodada: vence o de mais pontos; empate continua a batalha.
 */
import {
	TAMANHOS, LIMIAR_PADRAO, VANTAGEM_FUGA, POSICOES, ETAPAS, ETAPA_PRE, EVENTOS,
	BONUS_TESTE_PERICIA, BONUS_ESTANDARTE, CD_MOTIVACAO
} from "./constantes.js";

const tamanho = (chave) => TAMANHOS[chave] ?? TAMANHOS.media;

/* ---------------- Batalha ---------------- */

export const cdDaBatalha = (chaveTamanho) => tamanho(chaveTamanho).cd;

export function limiarVitoria(chaveTamanho, variado = false) {
	return variado ? tamanho(chaveTamanho).limiarVariado : LIMIAR_PADRAO;
}

/** Soma dos modificadores de Guerra de um exército ([{valor}]). */
export const somaModificadores = (modificadores = []) =>
	modificadores.reduce((soma, m) => soma + (Number(m?.valor) || 0), 0);

/* ---------------- Pré-batalha ---------------- */

/** Maior de dois valores: 0, 1 ou null se iguais. */
function maior(a, b) {
	if (a === b) return null;
	return a > b ? 0 : 1;
}

/**
 * Teste oposto (generais, Sobrevivência do terreno). Empate no total: vence o maior bônus.
 * Devolve 0/1, ou null quando total e bônus empatam: nesse caso, rola-se de novo.
 */
export function vencedorOposto(totalA, totalB, bonusA = 0, bonusB = 0) {
	return maior(totalA, totalB) ?? maior(bonusA, bonusB);
}

/**
 * Motivação: Atuação contra CD 20. Passou: +1, e +1 a cada 5 acima da CD.
 * Falhou por 5 ou mais: tropas desmotivadas, −2. Falhou por menos: 0.
 */
export function motivacao(total) {
	if (total >= CD_MOTIVACAO) return 1 + Math.floor((total - CD_MOTIVACAO) / 5);
	return CD_MOTIVACAO - total >= 5 ? -2 : 0;
}

/* ---------------- Posicionamento ---------------- */

export const modPosicao = (area) => POSICOES[area]?.mod ?? 0;

/** Movimento de uma rodada: no máximo uma área para a frente ou para trás, dentro do campo. */
export function movimentoValido(de, para) {
	return Number.isInteger(para) && para >= 0 && para < POSICOES.length && Math.abs(para - de) <= 1;
}

/* ---------------- Evento ---------------- */

/** d20 + modificador da posição (+/−2 do Posicionamento avançado). */
export const totalEvento = (d20, area, ajuste = 0) => d20 + modPosicao(area) + ajuste;

/** Evento da Tabela B-5 para um total da rolagem de evento. */
export function eventoPorTotal(total) {
	return EVENTOS.find((e) => (e.min === null || total >= e.min) && (e.max === null || total <= e.max));
}

/** Bônus de Guerra pelo dano: +1 para cada múltiplo do dano da Tabela B-1, arredondado para baixo. */
export function bonusPorDano(dano, chaveTamanho) {
	return Math.floor(Math.max(0, Number(dano) || 0) / tamanho(chaveTamanho).dano);
}

/**
 * Bônus de Guerra que o evento dá ao general dos heróis.
 * @param {object} p
 * @param {string} p.tamanho        chave da Tabela B-1
 * @param {number} [p.dano]         dano total causado pelo grupo (ou causado pelos inimigos, em defender)
 * @param {number} [p.danoLider]    Ataque livre: dano causado no líder (conta dobrado)
 * @param {number} [p.danoOficial]  Enfrentar capitão: dano que o oficial causou (é subtraído)
 * @param {boolean} [p.capitao]     Enfrentar capitão: bônus ≥ +2 por dano ganha mais +2
 * @param {boolean} [p.testePericia] teste de perícia do evento bem-sucedido (+2)
 */
export function bonusEvento({ tamanho: t, dano = 0, danoLider = 0, danoOficial = 0, capitao = false, testePericia = false }) {
	const danoEfetivo = Math.max(0, dano + 2 * danoLider - danoOficial);
	let bonus = bonusPorDano(danoEfetivo, t);
	if (capitao && bonus >= 2) bonus += 2;
	if (testePericia) bonus += BONUS_TESTE_PERICIA;
	return bonus;
}

/* ---------------- Teste dos generais ---------------- */

/**
 * Bônus total do teste de Guerra de um exército nesta rodada (somado à rolagem de Guerra do general).
 * bonusEvento só conta para o exército dos heróis; estandartes = quantos heróis do exército seguram um.
 */
export function bonusGuerra({ modificadores = [], bonusEvento: evento = 0, estandartes = 0 }) {
	return somaModificadores(modificadores) + evento + estandartes * BONUS_ESTANDARTE;
}

/**
 * Vencedor ganha 1 ponto de vitória, mais 1 para cada 5 pontos de diferença.
 * Empate no total: vence o maior bônus (diferença 0 → 1 ponto). Empate também no bônus: `rolarDeNovo`.
 */
export function resultadoGenerais(totalA, totalB, bonusA = 0, bonusB = 0) {
	const vencedor = vencedorOposto(totalA, totalB, bonusA, bonusB);
	if (vencedor === null) return { vencedor: null, pontos: 0, diferenca: 0, rolarDeNovo: true };
	const diferenca = Math.abs(totalA - totalB);
	return { vencedor, pontos: 1 + Math.floor(diferenca / 5), diferenca, rolarDeNovo: false };
}

/** Novo general após o anterior ser derrotado: Guerra do anterior − (1d6+1). */
export const guerraNovoGeneral = (guerraAnterior, rolagemPenalidade) => guerraAnterior - rolagemPenalidade;

/* ---------------- Fim de rodada / fim da batalha ---------------- */

/**
 * Verifica o fim da batalha ao final de uma rodada.
 * @param {object} p
 * @param {[number, number]} p.pontos   pontos de vitória dos dois exércitos
 * @param {number} p.limiar             pontos para vencer
 * @param {0|1|null} [p.fugindo]        exército que começou a fugir no fim da rodada anterior
 * @returns {{ fim: null|"destruicao"|"fuga", vencedor: 0|1|null, fugindo: 0|1|null, fugaInterrompida: boolean }}
 */
export function verificarFimRodada({ pontos, limiar, fugindo = null }) {
	const [a, b] = pontos;
	// Destruição: alcançou o limiar.
	if (a >= limiar || b >= limiar) {
		const vencedor = maior(a, b); // SUPOSIÇÃO: os dois no limiar → o de mais pontos
		if (vencedor !== null) return { fim: "destruicao", vencedor, fugindo: null, fugaInterrompida: false };
	}
	const diferenca = Math.abs(a - b);
	const emDesvantagem = a === b ? null : (a < b ? 0 : 1);
	// Fuga em andamento: se não reduziu a diferença para menos de 5, termina de fugir e a batalha acaba.
	if (fugindo !== null) {
		if (diferenca >= VANTAGEM_FUGA && emDesvantagem === fugindo) {
			return { fim: "fuga", vencedor: 1 - fugindo, fugindo: null, fugaInterrompida: false };
		}
		return { fim: null, vencedor: null, fugindo: null, fugaInterrompida: true };
	}
	// Vantagem de 5 ou mais: o exército com menos pontos começa a fugir (a batalha continua na próxima rodada).
	if (diferenca >= VANTAGEM_FUGA) return { fim: null, vencedor: null, fugindo: emDesvantagem, fugaInterrompida: false };
	return { fim: null, vencedor: null, fugindo: null, fugaInterrompida: false };
}

/** Baixas de um exército: 5% × pontos de vitória do exército inimigo; metade feridos, metade mortos. */
export function baixas(pontosDoInimigo) {
	const percentual = 5 * Math.max(0, pontosDoInimigo);
	return { percentual, feridos: percentual / 2, mortos: percentual / 2 };
}

/** ND como número ("1/2" → 0.5, "S" → 20). Desconhecido → null. */
export function ndNumero(nd) {
	if (typeof nd === "number") return Number.isFinite(nd) ? nd : null;
	const texto = String(nd ?? "").trim().toUpperCase();
	if (!texto) return null;
	if (texto === "S" || texto === "S+") return 20;
	const fracao = texto.match(/^(\d+)\s*\/\s*(\d+)$/);
	if (fracao) return Number(fracao[1]) / Number(fracao[2]);
	const n = Number(texto.replace(",", "."));
	return Number.isFinite(n) ? n : null;
}

/** ND médio do exército inimigo (espólios e XP), a partir dos NDs da tabela de inimigos. */
export function ndMedio(nds) {
	const validos = nds.map(ndNumero).filter((n) => n !== null);
	if (!validos.length) return null;
	return validos.reduce((s, n) => s + n, 0) / validos.length;
}

/* ---------------- Etapas ---------------- */

/** Próxima etapa: "pre" → Preparação do Turno 1; Teste dos Generais → Preparação do turno seguinte. */
export function proximaEtapa(etapa, turno) {
	if (etapa === ETAPA_PRE) return { etapa: ETAPAS[0].chave, turno: Math.max(1, turno + 1), novaRodada: true };
	const i = ETAPAS.findIndex((e) => e.chave === etapa);
	if (i < 0) return { etapa: ETAPAS[0].chave, turno, novaRodada: false };
	if (i === ETAPAS.length - 1) return { etapa: ETAPAS[0].chave, turno: turno + 1, novaRodada: true };
	return { etapa: ETAPAS[i + 1].chave, turno, novaRodada: false };
}

/** Etapa anterior (o mestre pode voltar dentro do turno; não volta para antes da Preparação). */
export function etapaAnterior(etapa, turno) {
	const i = ETAPAS.findIndex((e) => e.chave === etapa);
	if (i <= 0) return { etapa, turno };
	return { etapa: ETAPAS[i - 1].chave, turno };
}

/* ---------------- Tabela de inimigos ---------------- */

/** 1 inimigo = 1 face: N inimigos → 1dN. Tabela vazia → null. */
export const formulaInimigos = (tabela) => (tabela?.length ? `1d${tabela.length}` : null);

export const inimigoDaFace = (tabela, face) => tabela?.[face - 1] ?? null;

/* ---------------- Dano médio (regra opcional) ---------------- */

/**
 * Lê uma fórmula simples de dano ("2d10+25", "1d6 + 1", "1d8+1d6+3", "4").
 * Devolve { dados: [{qtd, faces, sinal}], fixo } ou null se tiver algo que não seja dado/número.
 */
export function lerFormulaDano(formula) {
	const texto = String(formula ?? "").replace(/\s+/g, "").toLowerCase();
	if (!texto) return null;
	const termos = texto.match(/[+-]?[^+-]+/g);
	if (!termos || termos.join("") !== texto) return null;
	const dados = [];
	let fixo = 0;
	for (const termo of termos) {
		const sinal = termo.startsWith("-") ? -1 : 1;
		const corpo = termo.replace(/^[+-]/, "");
		const dado = corpo.match(/^(\d*)d(\d+)$/);
		if (dado) dados.push({ qtd: Number(dado[1] || 1), faces: Number(dado[2]), sinal });
		else if (/^\d+$/.test(corpo)) fixo += sinal * Number(corpo);
		else return null;
	}
	return { dados, fixo };
}

/** Dano médio: média baixa de cada dado (metade das faces: 2 para d4, 3 para d6, 4 para d8). */
export function danoMedio(formula) {
	const f = lerFormulaDano(formula);
	if (!f) return null;
	return f.dados.reduce((s, d) => s + d.sinal * d.qtd * Math.floor(d.faces / 2), f.fixo);
}

/** Dano médio no crítico: máximo de cada dado (x2), 1,5 × o máximo (x3); em geral máximo × multiplicador / 2. */
export function danoMedioCritico(formula, multiplicador = 2) {
	const f = lerFormulaDano(formula);
	if (!f) return null;
	const dados = f.dados.reduce((s, d) => s + d.sinal * d.qtd * d.faces, 0);
	return Math.floor(dados * multiplicador / 2) + f.fixo;
}
