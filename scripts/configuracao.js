/**
 * T4 — Operações puras do configurador (sem Foundry): editar o rascunho e aplicá-lo à batalha salva.
 *
 * O configurador edita um rascunho em memória. Ao salvar, só os campos de configuração vão para a
 * batalha salva mais recente; o andamento (turno, etapa, rodada, histórico, posições) nunca é sobrescrito,
 * para o mestre poder ajustar a configuração no meio de uma batalha sem desfazer o que o modal gravou.
 */
import { MODIFICADORES_GUERRA, AREA_INICIAL, OPCIONAIS } from "./constantes.js";
import { completarEstado } from "./estado.js";

/**
 * Imagem do token do ator (protótipo). Sem token, ou com token "curinga" (caminho com * para imagens
 * aleatórias, que não é um arquivo), usa a imagem do ator.
 */
export function imagemDoAtor(ator) {
	const token = ator?.prototypeToken?.texture?.src;
	if (token && !token.includes("*")) return token;
	return ator?.img ?? null;
}

/** Retrato guardado na batalha: referência ao ator + nome e imagem do token de quando foi escolhido (fallback). */
export function retratoDeAtor(ator) {
	return { uuid: ator.uuid ?? null, nome: ator.name ?? ator.nome ?? "", img: imagemDoAtor(ator) };
}

/* ---------------- Modificadores de Guerra ---------------- */

/** Acrescenta um modificador da Tabela B-2 (por chave) ou personalizado ({ nome, valor }). */
export function adicionarModificador(lista, chaveOuPersonalizado) {
	if (typeof chaveOuPersonalizado === "string") {
		const m = MODIFICADORES_GUERRA.find((x) => x.chave === chaveOuPersonalizado);
		if (!m) return lista;
		return [...lista, { chave: m.chave, nome: m.nome, detalhe: m.detalhe, valor: m.valor }];
	}
	const { nome = "", valor = 0 } = chaveOuPersonalizado ?? {};
	return [...lista, { chave: "personalizado", nome: nome || "Modificador", detalhe: "", valor: Number(valor) || 0 }];
}

/* ---------------- Listas ---------------- */

export const removerIndice = (lista, i) => lista.filter((_, j) => j !== i);

/** Acrescenta um retrato a uma lista sem repetir o mesmo ator. */
export function adicionarRetrato(lista, retrato) {
	if (retrato.uuid && lista.some((r) => r.uuid === retrato.uuid)) return lista;
	return [...lista, retrato];
}

/** Move um item da lista para outra posição (na tabela de inimigos, muda a face do dado). */
export function moverIndice(lista, de, para) {
	if (de === para || de < 0 || para < 0 || de >= lista.length || para >= lista.length) return lista;
	const copia = [...lista];
	const [item] = copia.splice(de, 1);
	copia.splice(para, 0, item);
	return copia;
}

/** Repete a entrada logo abaixo dela (o mesmo inimigo em mais faces pesa o sorteio). */
export function duplicarIndice(lista, i) {
	if (i < 0 || i >= lista.length) return lista;
	return [...lista.slice(0, i + 1), structuredClone(lista[i]), ...lista.slice(i + 1)];
}

/** Heróis: acrescenta atores (sem repetir), cada um começando na área do grupo. */
export function adicionarHerois(herois, retratos, area = AREA_INICIAL) {
	let saida = herois;
	for (const r of retratos) {
		if (!saida.some((h) => h.uuid === r.uuid)) saida = [...saida, { ...r, area }];
	}
	return saida;
}

/* ---------------- Salvar ---------------- */

/** Campos de configuração de cada exército (o resto é andamento). */
const CAMPOS_EXERCITO = ["nome", "pontosIniciais", "general", "substituto", "personalidades", "estandartes", "modificadores"];
const CAMPOS_BATALHA = ["nome", "local", "tamanho", "imagens", "areas", "tabelaInimigos", "opcionais"];

/**
 * Aplica o rascunho do configurador sobre a batalha salva mais recente.
 * @param {object} atual       batalha salva (pode ter mudado desde que o configurador abriu)
 * @param {object} rascunho    o que o mestre editou
 * @param {object} [opcoes]
 * @param {boolean[]} [opcoes.pontosEditados]   o mestre ajustou o placar atual de cada exército
 * @param {boolean[]} [opcoes.comandoEditado]   o mestre mexeu no general/substituto de cada exército
 *   (com a batalha em andamento, sem edição eles ficam como estão: o substituto pode já ter assumido)
 */
export function aplicarConfiguracao(atual, rascunho, { pontosEditados = [false, false], comandoEditado = [true, true] } = {}) {
	const base = completarEstado(atual);
	const novo = completarEstado(rascunho);
	const saida = structuredClone(base);

	for (const campo of CAMPOS_BATALHA) saida[campo] = structuredClone(novo[campo]);
	// Lobos solitários não muda com a batalha em andamento (decisão 4).
	if (base.iniciada) for (const chave of OPCIONAIS_TRAVADOS) saida.opcionais[chave] = base.opcionais[chave];

	saida.exercitos = [0, 1].map((i) => {
		const ex = { ...base.exercitos[i] };
		for (const campo of CAMPOS_EXERCITO) {
			if (base.iniciada && !comandoEditado[i] && (campo === "general" || campo === "substituto")) continue;
			ex[campo] = structuredClone(novo.exercitos[i][campo]);
		}
		ex.pontosIniciais = inteiro(ex.pontosIniciais);
		if (!base.iniciada) ex.pontos = ex.pontosIniciais; // antes de começar, o placar é o inicial
		else if (pontosEditados[i]) ex.pontos = inteiro(novo.exercitos[i].pontos);
		return ex;
	});

	// Heróis: a lista vem do rascunho; a posição de quem já estava na batalha é preservada.
	const areaDe = new Map(base.herois.map((h) => [h.uuid, h.area]));
	const areaNovos = base.iniciada ? base.grupoArea : AREA_INICIAL;
	saida.herois = novo.herois.map((h) => ({ ...h, area: areaDe.get(h.uuid) ?? areaNovos }));

	saida.nome = String(saida.nome ?? "").trim();
	saida.local = String(saida.local ?? "").trim();
	return saida;
}

const inteiro = (x) => Math.trunc(Number(x) || 0);

/* ---------------- Regras opcionais ---------------- */

/** Regras que não podem mudar com a batalha em andamento (decisão 4). */
export const OPCIONAIS_TRAVADOS = ["lobosSolitarios"];

/** Lista das regras opcionais para a aba do configurador, com o que está travado. */
export function listaOpcionais(estado) {
	const e = completarEstado(estado);
	return Object.entries(OPCIONAIS).map(([chave, o]) => ({
		chave,
		nome: o.nome,
		texto: o.texto,
		ativa: !!e.opcionais[chave],
		travada: e.iniciada && OPCIONAIS_TRAVADOS.includes(chave)
	}));
}

/* ---------------- Avisos ---------------- */

/** Pendências que o configurador mostra (não impedem salvar). Devolve chaves de i18n em Configurador.Avisos. */
export function pendencias(estado) {
	const e = completarEstado(estado);
	const avisos = [];
	if (!e.nome) avisos.push("SemNome");
	e.exercitos.forEach((ex, i) => {
		if (!ex.general?.uuid && !ex.general?.nome) avisos.push(i === 0 ? "SemGeneralAliado" : "SemGeneralInimigo");
		else if (ex.general.guerra === null || ex.general.guerra === undefined || ex.general.guerra === "") {
			avisos.push(i === 0 ? "SemGuerraAliado" : "SemGuerraInimigo");
		}
	});
	if (!e.herois.length) avisos.push("SemHerois");
	if (!e.tabelaInimigos.length) avisos.push("SemInimigos");
	return avisos;
}
