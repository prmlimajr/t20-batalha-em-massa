// Teste em Node do modelo do tabuleiro (T7). Rodar: node testes/visao.test.mjs
import assert from "node:assert/strict";
import { visaoBatalha, etapasDoTurno, areaDoHeroi } from "../scripts/visao.js";
import { completarEstado } from "../scripts/estado.js";

const svalas = {
	nome: "Batalha de Svalas", local: "Oiteiro dos Coroados", tamanho: "media",
	iniciada: true, turno: 4, etapa: "evento", grupoArea: 2,
	exercitos: [
		{
			nome: "Guarda do Norte", pontos: 12,
			general: { uuid: "Actor.ay", nome: "Rainha Ayleth de Svalas", img: "ay.png" },
			substituto: { uuid: "Actor.hy", nome: "Príncipe Hybald Roggandin", img: "hy.png" },
			personalidades: [{ uuid: "Actor.p1", nome: "P1", img: "p1.png" }, { uuid: "Actor.p2", nome: "P2", img: "p2.png" }],
			estandartes: [{ nome: "Balança", img: "b.png", carregadoPor: "Actor.h1" }, { nome: "Águia", img: "a.png" }],
			modificadores: [{ nome: "Superioridade numérica", valor: 2 }]
		},
		{
			nome: "Legião Carmesim", pontos: 9,
			general: { nome: "General Zallia Silloherom", img: "z.png" },
			modificadores: [{ nome: "Tropas de melhor qualidade", valor: 5 }, { nome: "Desmotivadas", valor: -2 }]
		}
	],
	herois: [{ uuid: "Actor.h1", nome: "H1", img: "h1.png", area: 1 }, { uuid: "Actor.h2", nome: "H2", img: "h2.png", area: 3 }],
	areas: [{ nome: "Topo da colina" }, { nome: "Linhas traseiras" }, { nome: "Parede de escudos" }, { nome: "Vale" }]
};

const v = visaoBatalha(svalas);
assert.equal(v.nome, "Batalha de Svalas");
assert.equal(v.tamanho, "Batalha média");
assert.equal(v.turno, "04");
assert.equal(v.pre, false);
assert.deepEqual(v.exercitos.map((x) => x.pontos), ["12", "09"]);
assert.deepEqual(v.exercitos.map((x) => x.lado), ["aliado", "inimigo"]);
assert.equal(v.exercitos[0].general.nome, "Rainha Ayleth de Svalas");
assert.equal(v.exercitos[0].substituto.nome, "Príncipe Hybald Roggandin");
assert.equal(v.exercitos[1].substituto, null, "sem substituto");
assert.equal(v.exercitos[0].personalidades.length, 2);
assert.deepEqual(v.exercitos[0].estandartes.map((s) => s.carregado), [true, false]);
assert.deepEqual(v.exercitos[0].modificadores, [{ nome: "Superioridade numérica", valor: "+2" }]);
assert.equal(v.exercitos[0].carrossel, false, "um modificador: sem girar");
assert.equal(v.exercitos[1].carrossel, true);
assert.equal(v.exercitos[1].modificadores[1].valor, "−2");

// Etapas: Evento atual, as anteriores feitas
assert.deepEqual(v.etapas.map((e) => [e.chave, e.feita, e.atual]), [
	["preparacao", true, false], ["posicionamento", true, false], ["evento", false, true], ["generais", false, false]
]);

// Áreas: romanos, subtítulo fixo, grupo junto no Front (as áreas próprias dos heróis são ignoradas)
assert.deepEqual(v.areas.map((a) => a.romano), ["I", "II", "III", "IV"]);
assert.deepEqual(v.areas.map((a) => a.subtitulo), ["Acampamento", "Retaguarda", "Front", "Atrás das linhas inimigas"]);
assert.deepEqual(v.areas.map((a) => a.destaque), [false, false, true, false]);
assert.deepEqual(v.areas[2].herois.map((h) => h.nome), ["H1", "H2"]);
assert.deepEqual(v.mensagem, { etapa: "evento", area: "Front" });

// Lobos solitários: cada herói na sua área, todas destacadas
const lobos = visaoBatalha({ ...svalas, opcionais: { lobosSolitarios: true } });
assert.deepEqual(lobos.areas.map((a) => a.herois.map((h) => h.nome)), [[], ["H1"], [], ["H2"]]);
assert.deepEqual(lobos.areas.map((a) => a.destaque), [false, true, false, true]);

// Pré-batalha e batalha vazia
const vazia = visaoBatalha({});
assert.equal(vazia.pre, true);
assert.equal(vazia.turno, "00");
assert.ok(vazia.etapas.every((e) => e.futura && !e.atual && !e.feita));
assert.equal(vazia.exercitos[0].general, null);
assert.deepEqual(vazia.exercitos[0].personalidades, []);
assert.deepEqual(vazia.areas.map((a) => a.destaque), [false, true, false, false], "sem heróis: destaca a Retaguarda");
assert.deepEqual(vazia.mensagem, { etapa: "pre", area: "Retaguarda" });
assert.equal(vazia.limiar, 10);
assert.equal(visaoBatalha({ tamanho: "epica", opcionais: { limiarVariado: true } }).limiar, 20);

// Retratos vazios são ignorados; resolver é aplicado
const comVazios = visaoBatalha({ exercitos: [{ personalidades: [{}, { nome: "X" }] }] }, { resolver: (r) => ({ ...r, img: "vivo.png" }) });
assert.deepEqual(comVazios.exercitos[0].personalidades, [{ nome: "X", img: "vivo.png" }]);

assert.deepEqual(etapasDoTurno("generais").map((e) => e.feita), [true, true, true, false]);
assert.equal(areaDoHeroi(completarEstado({ grupoArea: 2 }), { area: 0 }), 2);

console.log("visao: ok");
