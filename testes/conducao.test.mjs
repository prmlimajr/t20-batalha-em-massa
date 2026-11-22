// Teste em Node da condução das etapas (T8). Rodar: node testes/conducao.test.mjs
import assert from "node:assert/strict";
import { aplicarTerreno, aplicarMotivacao, avancarEtapa, voltarEtapa, podeVoltar } from "../scripts/conducao.js";
import { estadoPadrao, completarEstado } from "../scripts/estado.js";
import { somaModificadores } from "../scripts/regras.js";

/* Terreno */
let e = estadoPadrao("X");
e.exercitos[0].modificadores = [{ chave: "numerica50", nome: "Sup", valor: 2 }];
e = aplicarTerreno(e, 1);
assert.deepEqual(e.exercitos[1].modificadores.map((m) => [m.chave, m.valor]), [["terreno", 2]]);
assert.deepEqual(e.exercitos[0].modificadores.map((m) => m.chave), ["numerica50"]);
e = aplicarTerreno(e, 0); // refazer: troca de lado, sem duplicar
assert.deepEqual(e.exercitos[0].modificadores.map((m) => m.chave), ["numerica50", "terreno"]);
assert.deepEqual(e.exercitos[1].modificadores, []);
e = aplicarTerreno(e, null); // empate persistente / anular
assert.equal(e.exercitos.flatMap((x) => x.modificadores).filter((m) => m.chave === "terreno").length, 0);
assert.equal(aplicarTerreno(e, 0).exercitos[0].modificadores.at(-1).automatico, true);

/* Motivação */
let r = aplicarMotivacao(estadoPadrao(), 0, 26); // 20 → +1, 25 → +2
assert.equal(r.valor, 2);
assert.deepEqual(r.estado.exercitos[0].modificadores.map((m) => [m.chave, m.valor]), [["motivadas", 2]]);
r = aplicarMotivacao(r.estado, 0, 12); // falhou por 8 → desmotivadas, substitui
assert.equal(r.valor, -2);
assert.deepEqual(r.estado.exercitos[0].modificadores.map((m) => [m.chave, m.valor]), [["desmotivadas", -2]]);
r = aplicarMotivacao(r.estado, 0, 18); // falhou por 2 → nada
assert.equal(r.valor, 0);
assert.deepEqual(r.estado.exercitos[0].modificadores, []);
r = aplicarMotivacao(estadoPadrao(), 1, 20);
assert.equal(somaModificadores(r.estado.exercitos[1].modificadores), 1);

/* Etapas */
let s = completarEstado({ opcionais: { lobosSolitarios: true }, rodada: { danoTotal: 5 } });
let a = avancarEtapa(s);
assert.deepEqual([a.estado.iniciada, a.estado.turno, a.estado.etapa, a.entrou, a.novoTurno], [true, 1, "preparacao", "preparacao", true]);
assert.equal(a.estado.rodada.danoTotal, 0, "rodada nova");
assert.equal(s.iniciada, false, "não altera o original");
a = avancarEtapa(a.estado); assert.equal(a.entrou, "posicionamento"); assert.equal(a.novoTurno, false);
a = avancarEtapa(a.estado); assert.equal(a.entrou, "evento");
a.estado.rodada.danoTotal = 70;
a = avancarEtapa(a.estado); assert.equal(a.entrou, "generais"); assert.equal(a.estado.rodada.danoTotal, 70, "mesma rodada");
a = avancarEtapa(a.estado);
assert.deepEqual([a.estado.turno, a.entrou, a.novoTurno, a.estado.rodada.danoTotal], [2, "preparacao", true, 0]);

assert.equal(podeVoltar(a.estado), false, "não volta da Preparação");
assert.equal(voltarEtapa(a.estado).mudou, false);
a = avancarEtapa(avancarEtapa(a.estado).estado);
assert.equal(podeVoltar(a.estado), true);
const v = voltarEtapa(a.estado);
assert.deepEqual([v.mudou, v.estado.etapa, v.estado.turno], [true, "posicionamento", 2]);
assert.equal(podeVoltar(estadoPadrao()), false, "pré-batalha não volta");

console.log("conducao: ok");

/* Preparação: prontos */
import { marcarPronto, todosProntos, registrarEvento, registrarInimigo, prontosDa } from "../scripts/conducao.js";
let p = completarEstado({ etapa: "preparacao" });
p = marcarPronto(p, "u1");
p = marcarPronto(p, "u1");
assert.deepEqual(prontosDa(p), ["u1"], "sem repetir");
assert.equal(todosProntos(p, ["u1", "u2"]), false);
p = marcarPronto(p, "u2");
assert.equal(todosProntos(p, ["u1", "u2"]), true);
assert.equal(todosProntos(p, []), false, "sem obrigatórios não avança sozinho");
p = marcarPronto(p, "u1", false);
assert.deepEqual(prontosDa(p), ["u2"]);
assert.deepEqual(prontosDa(p, "posicionamento"), [], "cada etapa tem os seus");
assert.equal(todosProntos(marcarPronto(completarEstado({ etapa: "posicionamento" }), "u1"), ["u1"]), true);
assert.deepEqual(completarEstado({ rodada: { prontos: ["u7"] } }).rodada.prontos, { preparacao: ["u7"] }, "formato antigo");
assert.deepEqual(avancarEtapa(completarEstado({ ...p, etapa: "generais" })).estado.rodada.prontos, {}, "zera no turno seguinte");

/* Evento: sorteios por área */
let ev = registrarEvento(completarEstado({}), 2, { total: 17, chave: "interceptarOrdens", nome: "Interceptar ordens" });
ev = registrarInimigo(ev, 2, { face: 3, uuid: "Actor.o", nome: "Orc", img: "o.png" });
ev = registrarEvento(ev, 1, { total: 9, chave: "manterPosicao", nome: "Manter posição" });
assert.deepEqual(Object.keys(ev.rodada.eventos).sort(), ["1", "2"]);
assert.equal(ev.rodada.inimigos[2].nome, "Orc");
assert.equal("evento" in completarEstado({ rodada: { evento: { x: 1 } } }).rodada, false, "campo antigo removido");
console.log("prontos e sorteios: ok");

/* Iniciar a batalha zera o estado dos heróis (estandarte, morto); o voo fica */
import { reiniciarBatalha } from "../scripts/estado.js";
const herdado = completarEstado({ herois: [{ uuid: "h1", estandarte: true, voa: true }, { uuid: "h2", morto: true, area: 3 }] });
const iniciada = avancarEtapa(herdado).estado;
assert.deepEqual(iniciada.herois.map((h) => [h.estandarte, h.morto, !!h.voa]), [[false, false, true], [false, false, false]]);
const dup = reiniciarBatalha(completarEstado({ ...herdado, iniciada: true, turno: 3 }));
assert.deepEqual(dup.herois.map((h) => [h.estandarte, h.morto, h.area]), [[false, false, 1], [false, false, 1]], "reiniciar/duplicar também zeram");
console.log("estado dos heróis ao iniciar: ok");
