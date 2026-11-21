/**
 * T5 — Leitura das estatísticas de um inimigo a partir do ator do sistema Tormenta20 (puro: testável em Node).
 *
 * Fontes no ator (dataModel/actor/menace.mjs; formato gerado pelo bestiário):
 *   system.attributes.nd / defesa.value / pv.max
 *   system.pericias.{fort,refl,vont}.value
 *   system.detalhes.ataquescac / ataquesad   → linha de ataques pronta ("Mordida +17 (4d6+18).")
 *   itens "arma": rolls[type=ataque].parts = [["1d20"], [perícia], [bônus]]; rolls[type=dano].parts = [[fórmula, tipo]]
 */
import { danoMedio, danoMedioCritico } from "./regras.js";

const numero = (x) => (x === undefined || x === null || x === "" || !Number.isFinite(Number(x)) ? null : Number(x));
const texto = (x) => String(x ?? "").trim().replace(/\s+/g, " ");

/** Converte a coleção de itens do Foundry (Collection/Map/array) em array. */
const comoLista = (itens) => (Array.isArray(itens) ? itens : Array.from(itens?.contents ?? itens?.values?.() ?? []));

/** Ataques das armas do ator: nome, bônus de ataque, fórmulas de dano, crítico e dano médio. */
export function armasDoAtor(ator) {
	const pericias = ator?.system?.pericias ?? {};
	return comoLista(ator?.items)
		.filter((i) => i.type === "arma")
		.map((arma) => {
			const rolls = arma.system?.rolls ?? [];
			const ataque = rolls.find((r) => r.type === "ataque");
			let bonusAtaque = null;
			if (ataque?.parts) {
				const pericia = ataque.parts[1]?.[0];
				const extra = numero(ataque.parts[2]?.[0]) ?? 0;
				const base = numero(pericias[pericia]?.value);
				if (base !== null) bonusAtaque = base + extra;
			}
			const danos = rolls
				.filter((r) => r.type === "dano")
				.flatMap((r) => (r.parts ?? []).map((p) => texto(p?.[0])).filter(Boolean));
			const formula = danos.join("+") || null;
			const margem = numero(arma.system?.criticoM) ?? 20;
			const multiplicador = numero(arma.system?.criticoX) ?? 2;
			return {
				nome: arma.name,
				bonusAtaque,
				dano: formula,
				critico: `${margem < 20 ? `${margem}/` : ""}x${multiplicador}`,
				danoMedio: formula ? danoMedio(formula) : null,
				danoMedioCritico: formula ? danoMedioCritico(formula, multiplicador) : null
			};
		});
}

/** Resumo do inimigo para a tabela do configurador e o cartão de chat. */
export function resumoInimigo(ator) {
	const s = ator?.system ?? {};
	const at = s.attributes ?? {};
	const linhas = [texto(s.detalhes?.ataquescac), texto(s.detalhes?.ataquesad)].filter(Boolean);
	return {
		nome: ator?.name ?? "",
		img: ator?.img ?? null,
		tipo: ator?.type ?? null,
		nd: at.nd ?? null,
		pv: numero(at.pv?.max ?? at.pv?.value),
		defesa: numero(at.defesa?.value),
		fort: numero(s.pericias?.fort?.value),
		refl: numero(s.pericias?.refl?.value),
		vont: numero(s.pericias?.vont?.value),
		ataquesTexto: linhas,
		armas: armasDoAtor(ator)
	};
}

/** "+5", "−2", "0" para exibir bônus. */
export const comSinal = (n) => (n === null || n === undefined ? "—" : n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");
