// Teste em Node das partes puras do estado (T2). Rodar: node testes/estado.test.mjs
import assert from "node:assert/strict";
import { estadoPadrao, completarEstado, estadoAoMarcar, VERSAO_ESTADO } from "../scripts/estado.js";

const p = estadoPadrao();
assert.equal(p.v, VERSAO_ESTADO);
assert.equal(p.exercitos.length, 2);
assert.equal(p.areas.length, 4);
assert.deepEqual(p.areas.map((a) => a.posicao), ["acampamento", "retaguarda", "front", "atras"]);
assert.equal(p.grupoArea, 1, "heróis começam na Retaguarda");
assert.equal(p.etapa, "pre");
assert.ok(p.imagens.fundo.endsWith("assets/fundo.png"));
assert.deepEqual(p.tabelaInimigos, []);
assert.equal(Object.values(p.opcionais).every((x) => x === false), true);

// estadoAoMarcar: só cria estado quando marca e ainda não há estado
assert.ok(estadoAoMarcar(true, false));
assert.equal(estadoAoMarcar(true, true), null);
assert.equal(estadoAoMarcar(false, false), null);
assert.equal(estadoAoMarcar(undefined, false), null);

// completarEstado: vazio → padrão
assert.deepEqual(completarEstado(undefined), estadoPadrao());
assert.deepEqual(completarEstado(null), estadoPadrao());

// completarEstado: mantém o salvo e preenche o que falta
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
assert.equal(e.nome, "Batalha de Svalas");
assert.equal(e.turno, 4);
assert.equal(e.opcionais.lobosSolitarios, true);
assert.equal(e.opcionais.danoMedio, false);
assert.equal(e.exercitos[0].nome, "Guarda do Norte");
assert.equal(e.exercitos[0].pontos, 12);
assert.deepEqual(e.exercitos[0].personalidades, []);
assert.equal(e.exercitos[1].nome, "Exército inimigo");
assert.equal(e.areas[0].nome, "Topo da colina");
assert.equal(e.areas[0].posicao, "acampamento", "posição da área é fixa");
assert.equal(e.areas[3].nome, "Atrás das linhas inimigas");
assert.deepEqual(e.tabelaInimigos, ["Actor.a", "Actor.b"]);
assert.equal(e.campoDesconhecido, 1);
assert.equal(salvo.exercitos.length, 1, "não altera o objeto salvo");

console.log("estado: ok");
