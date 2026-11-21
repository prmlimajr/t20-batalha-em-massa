/**
 * T7 — Modelo do tabuleiro (puro, testável em Node): transforma o estado da batalha no que o modal desenha,
 * seguindo o layout (SDD/t20-batalha-em-massa/fontes/layout.png).
 *
 * `resolver(retrato)` devolve o retrato com nome/imagem atuais do ator (no Foundry: retratos.js);
 * nos testes, a identidade.
 */
import { TAMANHOS, POSICOES, ETAPAS, ETAPA_PRE } from "./constantes.js";
import { completarEstado } from "./estado.js";
import { limiarVitoria } from "./regras.js";
import { camposDoEvento, bonusDaRodada, eventoPorChave } from "./evento.js";
import { MECANICAS } from "./constantes.js";

const ROMANOS = ["I", "II", "III", "IV"];
const comSinal = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "+0");
const doisDigitos = (n) => String(Math.max(0, Math.trunc(Number(n) || 0))).padStart(2, "0");
const temConteudo = (r) => !!(r && (r.uuid || r.nome || r.img));

/** Estado das 4 etapas no indicador "Progresso do turno": feita, atual ou futura. */
export function etapasDoTurno(etapa) {
	const atual = ETAPAS.findIndex((e) => e.chave === etapa);
	return ETAPAS.map((e, i) => ({
		chave: e.chave,
		nome: e.nome,
		numero: i + 1,
		feita: atual >= 0 && i < atual,
		atual: i === atual,
		futura: atual < 0 || i > atual
	}));
}

/** Área de cada herói: com Lobos solitários, a própria; senão, a do grupo. */
export function areaDoHeroi(estado, heroi) {
	// Morto: fica onde caiu.
	return estado.opcionais.lobosSolitarios || heroi.morto ? (heroi.area ?? estado.grupoArea) : estado.grupoArea;
}

/** Modificadores para o carrossel: "Superioridade numérica +2". */
function textoModificador(m) {
	const v = Number(m.valor) || 0;
	return { nome: m.nome, valor: v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : "0" };
}

/**
 * @param {object} salvo                 estado salvo da batalha
 * @param {object} [opcoes]
 * @param {(r: object) => object} [opcoes.resolver]  completa nome/imagem do ator
 */
export function visaoBatalha(salvo, { resolver = (r) => r } = {}) {
	const e = completarEstado(salvo);
	const tamanho = TAMANHOS[e.tamanho] ?? TAMANHOS.media;
	const pre = e.etapa === ETAPA_PRE;
	const resolverLista = (lista) => lista.filter(temConteudo).map(resolver);

	const exercitos = e.exercitos.map((ex, i) => {
		const portador = new Set(ex.estandartes.map((s) => s.carregadoPor).filter(Boolean));
		return {
			lado: i === 0 ? "aliado" : "inimigo",
			nome: ex.nome,
			pontos: doisDigitos(ex.pontos),
			general: temConteudo(ex.general) ? resolver(ex.general) : null,
			substituto: temConteudo(ex.substituto) ? resolver(ex.substituto) : null,
			personalidades: resolverLista(ex.personalidades),
			estandartes: resolverLista(ex.estandartes).map((s) => ({ ...s, carregado: !!s.carregadoPor })),
			temPortador: portador.size > 0,
			modificadores: ex.modificadores.map(textoModificador),
			carrossel: ex.modificadores.length > 1
		};
	});

	const herois = e.herois.filter(temConteudo).map((h) => ({ ...resolver(h), area: areaDoHeroi(e, h) }));
	const areasOcupadas = new Set(herois.map((h) => h.area));
	if (!herois.length) areasOcupadas.add(e.grupoArea);

	const areas = e.areas.map((a, i) => ({
		indice: i,
		evento: e.rodada.eventos?.[i] ?? null,
		inimigo: e.rodada.inimigos?.[i] ? resolver(e.rodada.inimigos[i]) : null,
		romano: ROMANOS[i],
		nome: a.nome,
		subtitulo: POSICOES[i].nome,
		mod: POSICOES[i].mod,
		destaque: areasOcupadas.has(i),
		herois: herois.filter((h) => h.area === i)
	}));
	for (const a of areas) a.ocupada = a.herois.length > 0;

	// Resolução dos eventos: uma linha por área com evento sorteado.
	const bonus = bonusDaRodada(e);
	const resolucoes = areas.filter((a) => a.evento).map((a) => {
		const def = eventoPorChave(a.evento.chave);
		return {
			indice: a.indice,
			area: a.nome,
			evento: a.evento,
			mecanica: MECANICAS[def?.mecanica]?.nome ?? "",
			campos: camposDoEvento(a.evento.chave, { acoesAbertas: e.opcionais.acoesAbertas }),
			bonus: bonus.porArea[a.indice] ?? 0,
			bonusTxt: comSinal(bonus.porArea[a.indice] ?? 0),
			herois: a.herois
		};
	});
	for (const a of areas) {
		a.bonus = bonus.porArea[a.indice];
		a.bonusTxt = a.bonus === undefined ? "" : comSinal(a.bonus);
		a.ajuste = e.rodada.ajustes?.[a.indice] ?? 0;
	}

	const areaGrupo = areas[e.grupoArea] ?? areas[1];
	return {
		nome: e.nome,
		local: e.local,
		tamanho: tamanho.nome,
		pre,
		turno: doisDigitos(e.turno),
		limiar: limiarVitoria(e.tamanho, e.opcionais.limiarVariado),
		exercitos,
		etapas: etapasDoTurno(e.etapa),
		etapa: e.etapa,
		areas,
		// Rodapé: chave da mensagem da etapa + área citada ("O Front aguarda sua ordem.")
		mensagem: { etapa: pre ? ETAPA_PRE : e.etapa, area: areaGrupo.subtitulo },
		imagens: e.imagens,
		lobosSolitarios: e.opcionais.lobosSolitarios,
		preBatalha: e.opcionais.preBatalha,
		acoesAbertas: e.opcionais.acoesAbertas,
		posicionamentoAvancado: e.opcionais.posicionamentoAvancado,
		resolucoes,
		bonusEvento: bonus.total
	};
}
