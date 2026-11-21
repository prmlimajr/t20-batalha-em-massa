// Teste em Node do posicionamento (T9). Rodar: node testes/posicionamento.test.mjs
import assert from "node:assert/strict";
import { validarMovimento, moverHeroi, opcoesDeMovimento, areaAtual, jaMoveu, MARCA_GRUPO } from "../scripts/posicionamento.js";
import { completarEstado } from "../scripts/estado.js";
import { avancarEtapa } from "../scripts/conducao.js";

const base = (extra = {}) => completarEstado({
	iniciada: true, turno: 1, etapa: "posicionamento", grupoArea: 1,
	herois: [{ uuid: "h1", nome: "Amir", area: 1 }, { uuid: "h2", nome: "Liliana", area: 1 }],
	...extra
});
const jogador = { ehGM: false, dono: true };
const motivo = (r) => r.motivo ?? "ok";

/* Grupo junto */
let e = base();
assert.equal(motivo(validarMovimento(e, "h1", 2, jogador)), "ok");
assert.equal(motivo(validarMovimento(e, "h1", 0, jogador)), "ok", "recuar");
assert.equal(motivo(validarMovimento(e, "h1", 3, jogador)), "UmaArea");
assert.equal(motivo(validarMovimento(e, "h1", 1, jogador)), "MesmaArea");
assert.equal(motivo(validarMovimento(e, "h1", 4, jogador)), "AreaInvalida");
assert.equal(motivo(validarMovimento(e, "hx", 2, jogador)), "NaoEsta");
assert.equal(motivo(validarMovimento(e, "h1", 2, { ehGM: false, dono: false })), "NaoDono");
assert.equal(motivo(validarMovimento(base({ etapa: "evento" }), "h1", 2, jogador)), "ForaDaEtapa");

e = moverHeroi(e, "h1", 2, { ehGM: false });
assert.equal(e.grupoArea, 2);
assert.deepEqual(e.herois.map((h) => h.area), [2, 2], "o grupo inteiro vai junto");
assert.deepEqual(e.rodada.movidos, [MARCA_GRUPO]);
assert.equal(jaMoveu(e, "h2"), true, "o movimento do grupo acabou para todos");
assert.equal(motivo(validarMovimento(e, "h2", 3, jogador)), "JaMoveu");

// Mestre: qualquer área, a qualquer momento, sem gastar o movimento da rodada
const gm = { ehGM: true };
assert.equal(motivo(validarMovimento(base({ etapa: "evento" }), "h1", 3, gm)), "ok");
const peloMestre = moverHeroi(base(), "h2", 3, gm);
assert.equal(peloMestre.grupoArea, 3);
assert.deepEqual(peloMestre.rodada.movidos, []);

// Nova rodada libera o movimento
let r = completarEstado({ ...e, etapa: "generais" });
r = avancarEtapa(r).estado; // turno 2, preparação, rodada nova
r = avancarEtapa(r).estado; // posicionamento
assert.equal(r.etapa, "posicionamento");
assert.equal(jaMoveu(r, "h1"), false);

/* Lobos solitários */
let l = base({ opcionais: { lobosSolitarios: true } });
l = moverHeroi(l, "h1", 2, { ehGM: false });
assert.deepEqual(l.herois.map((h) => h.area), [2, 1], "só o herói que moveu");
assert.equal(l.grupoArea, 1);
assert.equal(jaMoveu(l, "h1"), true);
assert.equal(jaMoveu(l, "h2"), false);
assert.equal(motivo(validarMovimento(l, "h2", 0, jogador)), "ok");
assert.equal(motivo(validarMovimento(l, "h1", 3, jogador)), "JaMoveu");
assert.equal(areaAtual(l, "h1"), 2);
assert.equal(areaAtual(completarEstado({ ...l, opcionais: { lobosSolitarios: false } }), "h1"), 1, "sem lobos: área do grupo");

/* Opções para a interface */
const donoDe = (uuids) => (u) => uuids.includes(u);
let o = opcoesDeMovimento(base(), { ehGM: false, ehDono: donoDe(["h2"]) });
assert.deepEqual(o.map((x) => [x.uuid, x.de, x.destinos, x.recuar, x.avancar]), [["h2", 1, [0, 2], true, true]]);
o = opcoesDeMovimento(base(), { ehGM: false, ehDono: donoDe([]) });
assert.deepEqual(o, [], "sem herói próprio, sem opções");
o = opcoesDeMovimento(base({ etapa: "evento" }), { ehGM: false, ehDono: donoDe(["h1"]) });
assert.deepEqual(o, [], "fora da etapa");
o = opcoesDeMovimento(base(), { ehGM: true, ehDono: donoDe([]) });
assert.deepEqual(o.map((x) => [x.uuid, x.destinos]), [["h1", [0, 2, 3]]], "mestre, grupo junto: um representante, qualquer área");
o = opcoesDeMovimento(base({ opcionais: { lobosSolitarios: true } }), { ehGM: true, ehDono: donoDe([]) });
assert.equal(o.length, 2, "mestre, lobos: cada herói");
o = opcoesDeMovimento(base({ grupoArea: 3, herois: [{ uuid: "h1", area: 3 }] }), { ehGM: false, ehDono: donoDe(["h1"]) });
assert.deepEqual([o[0].recuar, o[0].avancar], [true, false], "na última área não avança");

console.log("posicionamento: ok");
