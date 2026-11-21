// Teste em Node do posicionamento (T9). Rodar: node testes/posicionamento.test.mjs
import assert from "node:assert/strict";
import {
	validarMovimento, moverHeroi, opcoesDeMovimento, areaAtual, areaInicial, registrarInicio, removerHeroi, alternarMorto
} from "../scripts/posicionamento.js";
import { completarEstado } from "../scripts/estado.js";
import { avancarEtapa } from "../scripts/conducao.js";
import { visaoBatalha } from "../scripts/visao.js";
import { bonusEstandartes } from "../scripts/evento.js";

const base = (extra = {}) => registrarInicio(completarEstado({
	iniciada: true, turno: 1, etapa: "posicionamento", grupoArea: 2,
	herois: [{ uuid: "h1", nome: "Amir", area: 2 }, { uuid: "h2", nome: "Liliana", area: 2 }],
	...extra
}));
const jogador = { ehGM: false, dono: true };
const motivo = (r) => r.motivo ?? "ok";

/* Início registrado e movimento livre dentro de ±1 do início */
let e = base();
assert.deepEqual(e.rodada.inicio, { grupo: 2, herois: { h1: 2, h2: 2 } });
assert.equal(motivo(validarMovimento(e, "h1", 3, jogador)), "ok", "avança para Atrás das linhas");
assert.equal(motivo(validarMovimento(e, "h1", 1, jogador)), "ok", "recua para a Retaguarda");
assert.equal(motivo(validarMovimento(e, "h1", 0, jogador)), "UmaArea", "Front → Acampamento: duas áreas");
e = moverHeroi(e, "h1", 1);
assert.deepEqual([e.grupoArea, e.herois.map((h) => h.area)], [1, [1, 1]], "o grupo vai junto");
assert.equal(motivo(validarMovimento(e, "h2", 0, jogador)), "UmaArea", "medido do início (Front), não da posição atual");
assert.equal(motivo(validarMovimento(e, "h2", 2, jogador)), "ok", "pode voltar à área inicial");
assert.equal(motivo(validarMovimento(e, "h2", 3, jogador)), "ok", "e mudar de ideia para o outro lado");
assert.equal(areaInicial(e, "h1"), 2);
assert.equal(motivo(validarMovimento(base({ etapa: "evento" }), "h1", 3, jogador)), "ForaDaEtapa");
assert.equal(motivo(validarMovimento(e, "h1", 2, { ehGM: false, dono: false })), "NaoDono");
assert.equal(motivo(validarMovimento(e, "hx", 2, jogador)), "NaoEsta");

/* Mestre: qualquer área, a qualquer momento */
const gm = { ehGM: true };
assert.equal(motivo(validarMovimento(base({ etapa: "evento" }), "h1", 0, gm)), "ok");

/* Avançar para o Posicionamento registra o início */
let r = completarEstado({ iniciada: true, turno: 1, etapa: "preparacao", grupoArea: 3, herois: [{ uuid: "h1", area: 3 }] });
r = avancarEtapa(r).estado;
assert.deepEqual([r.etapa, r.rodada.inicio.grupo], ["posicionamento", 3]);

/* Lobos solitários: início por herói */
let l = base({ opcionais: { lobosSolitarios: true }, herois: [{ uuid: "h1", area: 2 }, { uuid: "h2", area: 0 }] });
l = moverHeroi(l, "h1", 3);
assert.deepEqual(l.herois.map((h) => h.area), [3, 0]);
assert.equal(motivo(validarMovimento(l, "h2", 1, jogador)), "ok");
assert.equal(motivo(validarMovimento(l, "h2", 2, jogador)), "UmaArea");

/* Opções para a interface */
const donoDe = (uuids) => (u) => uuids.includes(u);
let o = opcoesDeMovimento(moverHeroi(base(), "h1", 3), { ehGM: false, ehDono: donoDe(["h2"]) });
assert.deepEqual(o.map((x) => [x.de, x.inicio, x.destinos, x.recuar, x.avancar]), [[3, 2, [1, 2], true, false]]);
assert.deepEqual(opcoesDeMovimento(base({ etapa: "evento" }), { ehGM: false, ehDono: donoDe(["h1"]) }), []);
o = opcoesDeMovimento(base(), { ehGM: true, ehDono: donoDe([]) });
assert.deepEqual(o.map((x) => [x.uuid, x.destinos]), [["h1", [0, 1, 3]]], "mestre: um representante, qualquer área");

/* Morto e removido */
let m = alternarMorto(base({ herois: [{ uuid: "h1", area: 2, estandarte: true }, { uuid: "h2", area: 2 }] }), "h1");
assert.deepEqual([m.herois[0].morto, m.herois[0].estandarte, m.herois[0].area], [true, false, 2], "morto solta o estandarte");
assert.equal(bonusEstandartes(m), 0);
assert.equal(motivo(validarMovimento(m, "h1", 3, jogador)), "Morto");
m = moverHeroi(m, "h2", 3);
assert.deepEqual(m.herois.map((h) => h.area), [2, 3], "o morto fica onde caiu");
assert.equal(areaAtual(m, "h1"), 2);
assert.deepEqual(visaoBatalha(m).areas.map((a) => a.herois.map((h) => h.uuid)), [[], [], ["h1"], ["h2"]]);
assert.deepEqual(opcoesDeMovimento(m, { ehGM: false, ehDono: donoDe(["h1"]) }), [], "jogador não move herói morto");
assert.equal(opcoesDeMovimento(m, { ehGM: true, ehDono: donoDe([]) }).length, 2, "mestre: o vivo e o morto");
m = alternarMorto(m, "h1");
assert.deepEqual([m.herois[0].morto, m.herois[0].area], [false, 3], "revivido volta ao grupo");
assert.deepEqual(removerHeroi(m, "h1").herois.map((h) => h.uuid), ["h2"]);

console.log("posicionamento: ok");
