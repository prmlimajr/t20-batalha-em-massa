// Teste em Node das partes puras do estado e da coleção de batalhas. Rodar: node testes/estado.test.mjs
import assert from "node:assert/strict";
import {
	estadoPadrao, completarEstado, reiniciarBatalha, VERSAO_ESTADO,
	criarNaColecao, duplicarNaColecao, removerDaColecao, listarColecao
} from "../scripts/estado.js";
import { TAMANHOS } from "../scripts/constantes.js";

/* Estado padrão */
const p = estadoPadrao("Batalha de Svalas");
assert.equal(p.v, VERSAO_ESTADO);
assert.equal(p.nome, "Batalha de Svalas");
assert.equal(p.exercitos.length, 2);
assert.equal(p.areas.length, 4);
assert.deepEqual(p.areas.map((a) => a.posicao), ["acampamento", "retaguarda", "front", "atras"]);
assert.equal(p.grupoArea, 1, "heróis começam na Retaguarda");
assert.equal(p.etapa, "pre");
assert.ok(p.tamanho in TAMANHOS);
assert.ok(p.imagens.fundo.endsWith("assets/fundo.png"));
assert.deepEqual(p.tabelaInimigos, []);
assert.ok(Object.values(p.opcionais).every((x) => x === false));
assert.equal(estadoPadrao().nome, "");

/* completarEstado */
assert.deepEqual(completarEstado(undefined), estadoPadrao());
assert.deepEqual(completarEstado(null), estadoPadrao());
const salvo = {
	v: 0, nome: "Batalha de Svalas", turno: 4,
	opcionais: { lobosSolitarios: true },
	exercitos: [{ nome: "Guarda do Norte", pontos: 12 }],
	areas: [{ nome: "Topo da colina", posicao: "front" }],
	tabelaInimigos: ["Actor.a", "Actor.b"],
	campoDesconhecido: 1
};
const e = completarEstado(salvo);
assert.equal(e.v, VERSAO_ESTADO);
assert.equal(e.turno, 4);
assert.equal(e.opcionais.lobosSolitarios, true);
assert.equal(e.opcionais.danoMedio, false);
assert.equal(e.exercitos[0].nome, "Guarda do Norte");
assert.equal(e.exercitos[0].pontos, 12);
assert.equal(e.exercitos[0].pontosIniciais, 0);
assert.deepEqual(e.exercitos[0].personalidades, []);
assert.equal(e.exercitos[1].nome, "Exército inimigo");
assert.equal(e.areas[0].nome, "Topo da colina");
assert.equal(e.areas[0].posicao, "acampamento", "posição da área é fixa");
assert.equal(e.areas[3].nome, "Atrás das linhas inimigas");
assert.deepEqual(e.tabelaInimigos, ["Actor.a", "Actor.b"]);
assert.equal(e.campoDesconhecido, 1);
assert.equal(salvo.exercitos.length, 1, "não altera o objeto salvo");

/* reiniciarBatalha: mantém configuração, volta ao início */
const andamento = completarEstado({
	nome: "X", local: "Oiteiro", iniciada: true, turno: 5, etapa: "evento", grupoArea: 3,
	opcionais: { lobosSolitarios: true },
	exercitos: [
		{ nome: "A", pontosIniciais: 2, pontos: 9, estandartes: [{ nome: "Leão", carregadoPor: "Actor.h" }] },
		{ nome: "B", pontosIniciais: 3, pontos: 4 }
	],
	herois: [{ uuid: "Actor.h", area: 3 }],
	rodada: { danoTotal: 70 },
	historico: [{ turno: 1 }],
	tabelaInimigos: ["Actor.i"]
});
const r = reiniciarBatalha(andamento);
assert.equal(r.iniciada, false);
assert.equal(r.turno, 0);
assert.equal(r.etapa, "pre");
assert.equal(r.grupoArea, 1);
assert.equal(r.herois[0].area, 1);
assert.deepEqual([r.exercitos[0].pontos, r.exercitos[1].pontos], [2, 3], "volta à pontuação inicial");
assert.equal(r.exercitos[0].estandartes[0].carregadoPor, null);
assert.equal(r.exercitos[0].estandartes[0].nome, "Leão");
assert.equal(r.rodada.danoTotal, 0);
assert.deepEqual(r.historico, []);
assert.equal(r.opcionais.lobosSolitarios, true, "regras opcionais ficam");
assert.equal(r.local, "Oiteiro");
assert.deepEqual(r.tabelaInimigos, ["Actor.i"]);
assert.equal(andamento.turno, 5, "não altera o original");

/* Coleção */
let c = {};
c = criarNaColecao(c, "a", "Batalha de Svalas");
c = criarNaColecao(c, "b", "Ataque a Valkaria");
assert.deepEqual(Object.keys(c), ["a", "b"]);
c.a.turno = 3; c.a.iniciada = true;
const c2 = duplicarNaColecao(c, "a", "c", " (cópia)");
assert.equal(c2.c.nome, "Batalha de Svalas (cópia)");
assert.equal(c2.c.turno, 0, "cópia começa do início");
assert.equal(c.c, undefined, "não altera a coleção original");
assert.equal(duplicarNaColecao(c, "inexistente", "d"), c);
const c3 = removerDaColecao(c2, "b");
assert.deepEqual(Object.keys(c3).sort(), ["a", "c"]);
assert.ok(c2.b, "não altera a coleção original");
assert.deepEqual(listarColecao(c2).map((b) => b.id), ["b", "a", "c"], "ordenado por nome");
assert.deepEqual(listarColecao(undefined), []);

console.log("estado: ok");
