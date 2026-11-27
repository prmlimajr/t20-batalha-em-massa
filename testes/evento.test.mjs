// Teste em Node da resolução dos eventos (T10). Rodar: node testes/evento.test.mjs
import assert from "node:assert/strict";
import {
	camposDoEvento, atualizarResolucao, bonusDaArea, bonusDaRodada, alternarEstandarte, bonusEstandartes,
	derrotarGeneralInimigo
} from "../scripts/evento.js";
import { completarEstado } from "../scripts/estado.js";

/* Campos por evento */
assert.deepEqual(camposDoEvento("curandeiro"), { dano: false, danoLider: false, danoOficial: false, teste: false, estandarte: null, general: false, bonusManual: false });
assert.equal(camposDoEvento("levarOrdens").teste, true);
assert.equal(camposDoEvento("levarOrdens").dano, false);
assert.deepEqual([camposDoEvento("aliadoFerido").dano, camposDoEvento("aliadoFerido").teste], [true, true]);
assert.equal(camposDoEvento("ataqueLivre").danoLider, true);
assert.equal(camposDoEvento("enfrentarCapitao").danoOficial, true);
assert.equal(camposDoEvento("capturarEstandarte").estandarte, "capturar");
assert.equal(camposDoEvento("erguerEstandarte").estandarte, "erguer");
assert.deepEqual([camposDoEvento("enfrentarGeneral").general, camposDoEvento("enfrentarGeneral").dano], [true, false]);
assert.equal(camposDoEvento("manterPosicao", { acoesAbertas: true }).bonusManual, true);

/* Bônus por área */
const base = (eventos, extra = {}) => completarEstado({ tamanho: "escaramuca", rodada: { eventos }, ...extra });
let e = base({ 2: { chave: "quebrarFormacao", nome: "Quebrar formação" } });
assert.equal(bonusDaArea(e, 2), 0);
e = atualizarResolucao(e, 2, { dano: "70" });
assert.equal(e.rodada.eventos[2].dano, 70);
assert.equal(e.rodada.eventos[2].nome, "Quebrar formação", "mantém o sorteio");
assert.equal(bonusDaArea(e, 2), 3, "70 de dano em escaramuça → +3");
e = atualizarResolucao(e, 2, { dano: -5 });
assert.equal(e.rodada.eventos[2].dano, 0, "dano não fica negativo");
assert.equal(atualizarResolucao(e, 3, { dano: 10 }).rodada.eventos[3], undefined, "área sem evento: nada");

// Teste de perícia (+2), cumulativo com o dano
e = base({ 1: { chave: "interceptarOrdens" } });
e = atualizarResolucao(e, 1, { dano: 40, teste: true });
assert.equal(bonusDaArea(e, 1), 4);
// Ataque livre: dano no líder conta dobrado
e = base({ 2: { chave: "ataqueLivre" } }, { tamanho: "media" });
e = atualizarResolucao(e, 2, { dano: 40, danoLider: 30 });
assert.equal(bonusDaArea(e, 2), 2);
// Capitão: dano do oficial é subtraído; bônus ≥ 2 ganha +2
e = base({ 3: { chave: "enfrentarCapitao" } }, { tamanho: "media" });
e = atualizarResolucao(e, 3, { dano: 130, danoOficial: 20 });
assert.equal(bonusDaArea(e, 3), 4);

// Ações abertas: bônus manual substitui o cálculo
e = base({ 1: { chave: "manterPosicao" } }, { opcionais: { acoesAbertas: true } });
e = atualizarResolucao(e, 1, { dano: 100, bonusManual: "-1" });
assert.equal(bonusDaArea(e, 1), -1);
e = base({ 1: { chave: "manterPosicao", dano: 40 } }, { opcionais: { acoesAbertas: true } });
assert.equal(bonusDaArea(e, 1), 2, "sem bônus manual, calcula pelo dano");

// Total da rodada (Lobos solitários: várias áreas)
e = base({ 1: { chave: "quebrarFormacao", dano: 40 }, 3: { chave: "levarOrdens", teste: true } });
assert.deepEqual(bonusDaRodada(e), { porArea: { 1: 2, 3: 2 }, total: 4 });
assert.deepEqual(bonusDaRodada(completarEstado({})), { porArea: {}, total: 0 });

/* Estandartes */
let s = completarEstado({ herois: [{ uuid: "h1" }, { uuid: "h2" }] });
assert.equal(bonusEstandartes(s), 0);
s = alternarEstandarte(s, "h2");
assert.equal(bonusEstandartes(s), 2);
s = alternarEstandarte(alternarEstandarte(s, "h1"), "h2");
assert.deepEqual(s.herois.map((h) => !!h.estandarte), [true, false]);

/* Enfrentar general */
let g = completarEstado({
	exercitos: [
		{ pontos: 4 },
		{ general: { uuid: "Actor.z", nome: "Zallia", guerra: 12 }, substituto: { uuid: "Actor.h", nome: "Henrik", img: "h.png" } }
	],
	rodada: { eventos: { 3: { chave: "enfrentarGeneral" } } }
});
g = derrotarGeneralInimigo(g, 3, { pontos: 4, penalidade: 5 });
assert.equal(g.exercitos[0].pontos, 8);
assert.deepEqual([g.exercitos[1].general.nome, g.exercitos[1].general.guerra], ["Henrik", 7]);
assert.equal(g.exercitos[1].substituto.nome, "");
assert.deepEqual(g.rodada.eventos[3].generalDerrotado, { pontos: 4, penalidade: 5, anterior: 12 });
const semSub = derrotarGeneralInimigo(completarEstado({ exercitos: [{}, { general: { nome: "X", guerra: 3 } }] }), 0, { pontos: 2, penalidade: 2 });
assert.deepEqual([semSub.exercitos[1].general.nome, semSub.exercitos[1].general.guerra], ["", 1]);

/* Mestre remove o general: o substituto assume */
import { substituirGeneral, temSubstituto } from "../scripts/evento.js";
let sg = completarEstado({ exercitos: [{ general: { uuid: "Actor.ay", nome: "Ayleth", guerra: 17 }, substituto: { uuid: "Actor.nm", nome: "Nobre Menor", img: "n.png" } }, {}] });
assert.equal(temSubstituto(sg.exercitos[0]), true);
sg = substituirGeneral(sg, 0, "12");
assert.deepEqual(sg.exercitos[0].general, { uuid: "Actor.nm", nome: "Nobre Menor", img: "n.png", guerra: 12 });
assert.equal(temSubstituto(sg.exercitos[0]), false);
assert.equal(sg.exercitos[0].substituto.suboficial, true, "o lugar do substituto que assumiu vira um suboficial");
sg = substituirGeneral(sg, 0, 8); // sem substituto: um oficial sem nome
assert.deepEqual(sg.exercitos[0].general, { uuid: null, nome: "", img: null, guerra: 8 });
assert.equal(sg.exercitos[0].substituto.suboficial, true, "o suboficial continua no lugar");
{
	const { visaoBatalha } = await import("../scripts/visao.js");
	assert.equal(visaoBatalha(sg).exercitos[0].suboficial, true);
	assert.equal(visaoBatalha(sg).exercitos[0].substituto, null);
	// Nunca houve substituto: oficial assume, sem suboficial
	const ns = substituirGeneral(completarEstado({ exercitos: [{ general: { nome: "A", guerra: 5 } }, {}] }), 0, 3);
	assert.equal(ns.exercitos[0].substituto.suboficial, false);
	assert.equal(visaoBatalha(ns).exercitos[0].suboficial, false);
}
console.log("evento: ok");

/* Substituto com Guerra cadastrada (configurador) */
import { guerraDoSubstituto } from "../scripts/evento.js";
const comSub = (guerra) => completarEstado({
	exercitos: [{ pontos: 0 }, { general: { nome: "Herman", guerra: 23 }, substituto: { uuid: "Actor.l", nome: "Leona", guerra } }],
	rodada: { eventos: { 2: { chave: "enfrentarGeneral" } } }
});
assert.equal(guerraDoSubstituto(comSub(15).exercitos[1]), 15);
assert.equal(guerraDoSubstituto(comSub("").exercitos[1]), null);
let dg = derrotarGeneralInimigo(comSub(15), 2, { pontos: 3, penalidade: 6 });
assert.deepEqual([dg.exercitos[1].general.nome, dg.exercitos[1].general.guerra], ["Leona", 15], "vale a Guerra cadastrada");
assert.equal(dg.exercitos[1].substituto.guerra, null);
dg = derrotarGeneralInimigo(comSub(null), 2, { pontos: 3, penalidade: 6 });
assert.equal(dg.exercitos[1].general.guerra, 17, "sem cadastro: anterior −(1d6+1)");
console.log("substituto com Guerra: ok");
