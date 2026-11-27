// Teste em Node do Teste dos Generais (T11). Rodar: node testes/generais.test.mjs
import assert from "node:assert/strict";
import { composicaoBonus, sortearJogador, definirQuemRola, podeRolar, registrarRolagem } from "../scripts/generais.js";
import { completarEstado, reiniciarBatalha } from "../scripts/estado.js";
import { bonusDaRodada, bonusEstandartes } from "../scripts/evento.js";
import { somaModificadores } from "../scripts/regras.js";

const batalha = (extra = {}) => completarEstado({
	tamanho: "media", iniciada: true, turno: 3, etapa: "generais",
	exercitos: [
		{ nome: "Guarda do Norte", pontos: 4, general: { nome: "Ayleth", guerra: 9 }, modificadores: [{ nome: "Terreno favorável", detalhe: "", valor: 2 }] },
		{ nome: "Legião Carmesim", pontos: 2, general: { nome: "Zallia", guerra: 11 }, modificadores: [{ nome: "Tropas de melhor qualidade", detalhe: "como o exército Purista contra plebeus", valor: 5 }] }
	],
	herois: [{ uuid: "h1", nome: "Amir", estandarte: true }, { uuid: "h2", nome: "Liliana" }],
	areas: [{ nome: "Topo" }, { nome: "Linhas" }, { nome: "Parede de escudos" }, { nome: "Vale" }],
	rodada: { eventos: { 2: { chave: "interceptarOrdens", nome: "Interceptar ordens", dano: 200, teste: true } }, rolaGeneral: "u1" },
	...extra
});

/* Composição discriminada */
let c = composicaoBonus(batalha(), 0);
assert.deepEqual(c.itens.map((i) => i.valor), [9, 2, 4, 2, 2]);
assert.equal(c.itens[0].texto, "Guerra do general (Ayleth)");
assert.equal(c.itens[2].texto, "por ter causado 200 de dano no exército inimigo (Interceptar ordens, Parede de escudos)");
assert.equal(c.itens[3].texto, "por sucesso em teste de perícia no evento (Interceptar ordens, Parede de escudos)");
assert.equal(c.itens[4].texto, "por Amir segurar o estandarte do exército");
assert.equal(c.total, 19);
// Mesmo total que as regras separadas (guerra + modificadores + evento + estandartes)
const b = batalha();
assert.equal(c.total, 9 + somaModificadores(b.exercitos[0].modificadores) + bonusDaRodada(b).total + bonusEstandartes(b));
// Inimigo: só Guerra + modificadores
c = composicaoBonus(batalha(), 1);
assert.deepEqual(c.itens.map((i) => i.valor), [11, 5]);
assert.equal(c.total, 16);

// Defender, ataque livre, capitão e ações abertas
const comEvento = (ev, extra) => composicaoBonus(batalha({ rodada: { eventos: { 1: ev } }, herois: [], ...extra }), 0).itens.slice(2);
assert.match(comEvento({ chave: "manterPosicao", nome: "Manter posição", dano: 100 })[0].texto, /^por defender 100 de dano/);
assert.deepEqual(comEvento({ chave: "ataqueLivre", nome: "Ataque livre", dano: 40, danoLider: 30 }).map((i) => [i.valor, i.texto]),
	[[2, "por ter causado 100 de dano no exército inimigo (Ataque livre, Linhas; 30 no líder, em dobro)"]]);
assert.deepEqual(comEvento({ chave: "enfrentarCapitao", nome: "Enfrentar capitão", dano: 130, danoOficial: 20 }).map((i) => i.valor), [2, 2]);
assert.deepEqual(comEvento({ chave: "manterPosicao", nome: "Manter posição", bonusManual: 3 }, { opcionais: { acoesAbertas: true } }).map((i) => i.valor), [3]);
assert.deepEqual(comEvento({ chave: "quebrarFormacao", nome: "Quebrar formação", dano: 10 }), [], "sem bônus, sem item");
// Guerra vazia conta 0
assert.equal(composicaoBonus(completarEstado({}), 1).itens[0].valor, 0);

/* Quem rola */
assert.equal(sortearJogador(["a", "b", "c"], 0), "a");
assert.equal(sortearJogador(["a", "b", "c"], 0.99), "c");
assert.equal(sortearJogador([], 0.5), null);
const q = batalha();
assert.equal(podeRolar(q, 0, { ehGM: false, userId: "u1" }), true, "sorteado rola o aliado");
assert.equal(podeRolar(q, 1, { ehGM: false, userId: "u1" }), false, "sorteado não rola o inimigo");
assert.equal(podeRolar(q, 0, { ehGM: false, userId: "u2" }), false, "outro jogador não rola");
assert.equal(podeRolar(q, 1, { ehGM: true }), true);
assert.equal(podeRolar(batalha({ etapa: "evento" }), 0, { ehGM: true }), false, "fora da etapa");
assert.equal(definirQuemRola(q, "u9").rodada.rolaGeneral, "u9");

/* Rolagens e resultado */
let r = registrarRolagem(batalha(), 0, { d20: 8, por: "u1" }); // 8 + 19 = 27
assert.equal(r.resolvido, false);
assert.deepEqual(r.estado.rodada.generais[0], { d20: 8, bonus: 19, total: 27, por: "u1" });
assert.equal(podeRolar(r.estado, 0, { ehGM: true }), false, "cada lado rola uma vez");
r = registrarRolagem(r.estado, 1, { d20: 4 }); // 4 + 16 = 20 → diferença 7 → 2 pontos
assert.equal(r.resolvido, true);
assert.deepEqual([r.resultado.vencedor, r.resultado.pontos, r.resultado.diferenca], [0, 2, 7]);
assert.deepEqual([r.estado.exercitos[0].pontos, r.estado.exercitos[1].pontos], [6, 2]);
assert.equal(r.estado.historico.length, 1);
assert.deepEqual(r.estado.historico[0].placar, [6, 2]);
assert.equal(r.estado.fugindo, null, "diferença 4: ninguém foge");

// Empate no total: maior bônus vence (1 ponto)
r = registrarRolagem(registrarRolagem(batalha(), 0, { d20: 1 }).estado, 1, { d20: 4 }); // 20 × 20, bônus 19 × 16
assert.deepEqual([r.resultado.vencedor, r.resultado.pontos, r.resultado.desempateBonus], [0, 1, true]);

// Empate também no bônus: rola de novo
const iguais = batalha({ herois: [], rodada: { eventos: {} }, exercitos: [{ general: { guerra: 5 } }, { general: { guerra: 5 } }] });
r = registrarRolagem(registrarRolagem(iguais, 0, { d20: 10 }).estado, 1, { d20: 10 });
assert.equal(r.resolvido, false);
assert.equal(r.resultado.empate, true);
assert.deepEqual(r.estado.rodada.generais, {}, "as rolagens são apagadas");
assert.equal(podeRolar(r.estado, 0, { ehGM: true }), true);

// Fuga e destruição
r = registrarRolagem(registrarRolagem(batalha({ exercitos: [{ pontos: 1, general: { guerra: 9 } }, { pontos: 0, general: { guerra: 0 } }] }), 0, { d20: 10 }).estado, 1, { d20: 1 }); // 10+17 = 27 × 1 → diferença 26 → 6 pontos → 7 × 0
assert.equal(r.resultado.fugindo, 1, "vantagem de 5 ou mais: o inimigo começa a fugir");
assert.equal(r.estado.fugindo, 1);
r = registrarRolagem(registrarRolagem(batalha({ exercitos: [{ pontos: 9, general: { guerra: 9 } }, { pontos: 2, general: { guerra: 0 } }] }), 0, { d20: 10 }).estado, 1, { d20: 1 });
assert.deepEqual(r.estado.fim, { tipo: "destruicao", vencedor: 0, turno: 3 });
assert.equal(podeRolar(r.estado, 0, { ehGM: true }), false, "batalha encerrada");
assert.equal(reiniciarBatalha(r.estado).fim, null);

console.log("generais: ok");

/* Refazer o Teste dos Generais */
import { resetarGenerais } from "../scripts/generais.js";
let rr = registrarRolagem(registrarRolagem(batalha(), 0, { d20: 8 }).estado, 1, { d20: 4 }); // aliado +2
assert.deepEqual([rr.estado.exercitos[0].pontos, rr.estado.historico.length], [6, 1]);
let z = resetarGenerais(rr.estado);
assert.deepEqual([z.exercitos[0].pontos, z.exercitos[1].pontos, z.historico.length], [4, 2, 0], "pontos e histórico desfeitos");
assert.deepEqual([z.rodada.generais, z.rodada.resultadoGenerais, z.rodada.rolaGeneral], [{}, null, "u1"]);
assert.equal(podeRolar(z, 0, { ehGM: true }), true);
// Desfaz também a fuga e o fim causados pelo teste
rr = registrarRolagem(registrarRolagem(batalha({ exercitos: [{ pontos: 9, general: { guerra: 9 } }, { pontos: 2, general: { guerra: 0 } }] }), 0, { d20: 10 }).estado, 1, { d20: 1 });
assert.ok(rr.estado.fim);
z = resetarGenerais(rr.estado);
assert.deepEqual([z.fim, z.exercitos[0].pontos, z.fugindo], [null, 9, null]);
assert.deepEqual(resetarGenerais(batalha()).rodada.generais, {}, "sem resultado: só limpa");
console.log("refazer generais: ok");

/* Bônus base oculto (configuração "ocultar o bônus base do general inimigo") */
{
	const { mostraGuerra } = await import("../scripts/generais.js");
	assert.equal(composicaoBonus(batalha(), 1).itens[0].base, true);
	assert.equal(composicaoBonus(batalha(), 1).itens.filter((i) => i.base).length, 1);
	assert.equal(mostraGuerra(1, { ocultar: true, ehGM: false }), false);
	assert.equal(mostraGuerra(1, { ocultar: true, ehGM: true }), true);
	assert.equal(mostraGuerra(0, { ocultar: true, ehGM: false }), true);
	assert.equal(mostraGuerra(1, { ocultar: false, ehGM: false }), true);
}
