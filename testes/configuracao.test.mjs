// Teste em Node das operações puras do configurador (T4). Rodar: node testes/configuracao.test.mjs
import assert from "node:assert/strict";
import {
	retratoDeAtor, adicionarModificador, removerIndice, adicionarRetrato, adicionarHerois,
	aplicarConfiguracao, pendencias
} from "../scripts/configuracao.js";
import { completarEstado, estadoPadrao } from "../scripts/estado.js";

/* Retratos */
assert.deepEqual(retratoDeAtor({ uuid: "Actor.a", name: "Ayleth", img: "a.png" }), { uuid: "Actor.a", nome: "Ayleth", img: "a.png" });
assert.deepEqual(retratoDeAtor({}), { uuid: null, nome: "", img: null });

/* Modificadores */
let mods = adicionarModificador([], "numerica50");
assert.deepEqual(mods, [{ chave: "numerica50", nome: "Superioridade numérica", detalhe: "50% a mais de soldados", valor: 2 }]);
mods = adicionarModificador(mods, "desmotivadas");
assert.equal(mods[1].valor, -2);
assert.equal(adicionarModificador(mods, "inexistente"), mods);
mods = adicionarModificador(mods, { nome: "Fortificação", valor: "3" });
assert.deepEqual(mods[2], { chave: "personalizado", nome: "Fortificação", detalhe: "", valor: 3 });
assert.equal(adicionarModificador([], {}).at(0).nome, "Modificador");

/* Listas */
assert.deepEqual(removerIndice(["a", "b", "c"], 1), ["a", "c"]);
const lista = [{ uuid: "Actor.a" }];
assert.equal(adicionarRetrato(lista, { uuid: "Actor.a" }), lista, "não repete ator");
assert.equal(adicionarRetrato(lista, { uuid: "Actor.b" }).length, 2);
assert.equal(adicionarRetrato(lista, { uuid: null, nome: "x" }).length, 2, "sem uuid sempre entra");
let herois = adicionarHerois([], [{ uuid: "Actor.h1", nome: "H1" }, { uuid: "Actor.h2", nome: "H2" }]);
assert.deepEqual(herois.map((h) => h.area), [1, 1]);
herois = adicionarHerois(herois, [{ uuid: "Actor.h1" }, { uuid: "Actor.h3" }], 2);
assert.deepEqual(herois.map((h) => [h.uuid, h.area]), [["Actor.h1", 1], ["Actor.h2", 1], ["Actor.h3", 2]]);

/* aplicarConfiguracao — batalha não iniciada */
const atual = estadoPadrao("Antiga");
const rascunho = completarEstado(atual);
rascunho.nome = "  Batalha de Svalas ";
rascunho.local = "Outeiro dos Coroados";
rascunho.tamanho = "grande";
rascunho.exercitos[0].nome = "Guarda do Norte";
rascunho.exercitos[0].pontosIniciais = 0;
rascunho.exercitos[1].nome = "Legião Carmesim";
rascunho.exercitos[1].pontosIniciais = "3";
rascunho.exercitos[1].general = { uuid: "Actor.z", nome: "Zallia", img: "z.png", guerra: null };
rascunho.herois = [{ uuid: "Actor.h1", nome: "H1", area: 3 }];
rascunho.areas[2].nome = "Parede de escudos";
let salvo = aplicarConfiguracao(atual, rascunho);
assert.equal(salvo.nome, "Batalha de Svalas");
assert.equal(salvo.tamanho, "grande");
assert.equal(salvo.exercitos[1].pontosIniciais, 3);
assert.equal(salvo.exercitos[1].pontos, 3, "antes de começar, placar = inicial");
assert.equal(salvo.exercitos[1].general.nome, "Zallia");
assert.equal(salvo.herois[0].area, 1, "herói novo começa na Retaguarda");
assert.equal(salvo.areas[2].nome, "Parede de escudos");
assert.equal(salvo.areas[2].posicao, "front");
assert.equal(atual.nome, "Antiga", "não altera o original");

/* aplicarConfiguracao — batalha em andamento: andamento preservado */
const andamento = completarEstado({
	...salvo,
	iniciada: true, turno: 4, etapa: "evento", grupoArea: 2,
	opcionais: { ...salvo.opcionais, lobosSolitarios: false },
	exercitos: [{ ...salvo.exercitos[0], pontos: 12 }, { ...salvo.exercitos[1], pontos: 9 }],
	herois: [{ uuid: "Actor.h1", nome: "H1", area: 2 }],
	rodada: { danoTotal: 70, bonusEvento: 3 },
	historico: [{ turno: 1 }, { turno: 2 }, { turno: 3 }]
});
const rascunhoVelho = completarEstado(salvo); // aberto antes da batalha avançar
rascunhoVelho.local = "Novo local";
rascunhoVelho.opcionais.lobosSolitarios = true;
rascunhoVelho.exercitos[0].pontos = 0;
rascunhoVelho.exercitos[1].pontosIniciais = 5;
rascunhoVelho.herois = [{ uuid: "Actor.h1", nome: "H1" }, { uuid: "Actor.h2", nome: "H2" }];
salvo = aplicarConfiguracao(andamento, rascunhoVelho);
assert.equal(salvo.local, "Novo local");
assert.equal(salvo.turno, 4);
assert.equal(salvo.etapa, "evento");
assert.equal(salvo.rodada.danoTotal, 70);
assert.equal(salvo.historico.length, 3);
assert.deepEqual([salvo.exercitos[0].pontos, salvo.exercitos[1].pontos], [12, 9], "placar não volta ao do rascunho");
assert.equal(salvo.exercitos[1].pontosIniciais, 5);
assert.equal(salvo.opcionais.lobosSolitarios, false, "Lobos solitários travado com a batalha em andamento");
assert.deepEqual(salvo.herois.map((h) => [h.uuid, h.area]), [["Actor.h1", 2], ["Actor.h2", 2]], "posição preservada; novo entra na área do grupo");

// Placar editado explicitamente
rascunhoVelho.exercitos[0].pontos = 11;
salvo = aplicarConfiguracao(andamento, rascunhoVelho, { pontosEditados: [true, false] });
assert.deepEqual([salvo.exercitos[0].pontos, salvo.exercitos[1].pontos], [11, 9]);

/* Pendências */
assert.deepEqual(pendencias(estadoPadrao()), ["SemNome", "SemGeneralAliado", "SemGeneralInimigo", "SemHerois", "SemInimigos"]);
assert.deepEqual(pendencias(completarEstado({ nome: "X", exercitos: [{ general: { nome: "A" } }, { general: { nome: "B", guerra: 0 } }], herois: [{ uuid: "h" }], tabelaInimigos: [{}] })), ["SemGuerraAliado"], "Guerra 0 é válido; vazio avisa");
const completo = completarEstado({
	nome: "X",
	exercitos: [{ general: { uuid: "Actor.a", guerra: 7 } }, { general: { nome: "Zallia", guerra: 5 } }],
	herois: [{ uuid: "Actor.h" }],
	tabelaInimigos: ["Actor.i"]
});
assert.deepEqual(pendencias(completo), []);

console.log("configuracao: ok");

/* Regras opcionais (T6) */
import { listaOpcionais, OPCIONAIS_TRAVADOS } from "../scripts/configuracao.js";
const lista6 = listaOpcionais(estadoPadrao());
assert.equal(lista6.length, 6, "6 opcionais: pré-batalha + 5 do livro");
assert.ok(lista6.every((o) => !o.ativa && !o.travada && o.nome && o.texto));
const emCurso = completarEstado({ iniciada: true, opcionais: { lobosSolitarios: true, danoMedio: true } });
const lista6b = listaOpcionais(emCurso);
assert.deepEqual(lista6b.filter((o) => o.travada).map((o) => o.chave), OPCIONAIS_TRAVADOS);
assert.equal(lista6b.find((o) => o.chave === "danoMedio").ativa, true);
// Com a batalha em andamento, as outras regras opcionais mudam; Lobos solitários não
const rascOp = completarEstado(emCurso);
rascOp.opcionais.lobosSolitarios = false;
rascOp.opcionais.danoMedio = false;
rascOp.opcionais.limiarVariado = true;
const salvoOp = aplicarConfiguracao(emCurso, rascOp);
assert.deepEqual([salvoOp.opcionais.lobosSolitarios, salvoOp.opcionais.danoMedio, salvoOp.opcionais.limiarVariado], [true, false, true]);
// Antes de começar, Lobos solitários muda normalmente
const antes = estadoPadrao();
const rascAntes = completarEstado(antes);
rascAntes.opcionais.lobosSolitarios = true;
assert.equal(aplicarConfiguracao(antes, rascAntes).opcionais.lobosSolitarios, true);
// limiar antigo some do estado
assert.equal("limiar" in completarEstado({ limiar: 7 }), false);

console.log("opcionais: ok");

/* Imagem do token ao arrastar atores */
import { imagemDoAtor } from "../scripts/configuracao.js";
assert.equal(imagemDoAtor({ img: "retrato.png", prototypeToken: { texture: { src: "token.webp" } } }), "token.webp");
assert.equal(imagemDoAtor({ img: "retrato.png", prototypeToken: { texture: { src: "tokens/orc-*.webp" } } }), "retrato.png", "curinga usa o retrato");
assert.equal(imagemDoAtor({ img: "retrato.png" }), "retrato.png", "sem protótipo (índice de compêndio)");
assert.equal(imagemDoAtor(null), null);
assert.equal(retratoDeAtor({ uuid: "Actor.a", name: "A", img: "r.png", prototypeToken: { texture: { src: "t.png" } } }).img, "t.png");

/* Subtítulos das áreas são fixos */
const comSub = completarEstado({ areas: [{ nome: "Topo da colina", subtitulo: "Outro" }, { nome: "" }] });
assert.deepEqual(comSub.areas[0], { nome: "Topo da colina", posicao: "acampamento" });
assert.equal(comSub.areas[1].nome, "Retaguarda", "nome vazio volta ao padrão");

console.log("token e áreas: ok");

assert.equal(estadoPadrao().opcionais.preBatalha, false, "pré-batalha desligada por padrão");
assert.equal("rolandoPelosGenerais" in completarEstado({ opcionais: { rolandoPelosGenerais: true } }).opcionais, false);
console.log("pré-batalha opcional: ok");

/* Batalha em andamento: configurador não ressuscita general/substituto trocados em jogo */
const emJogo = completarEstado({
	iniciada: true, exercitos: [
		{ general: { uuid: "Actor.nm", nome: "Nobre Menor", guerra: 12 }, substituto: { uuid: null, nome: "", img: null } }, {}
	]
});
const rascunhoAntigo = completarEstado({
	iniciada: true, exercitos: [
		{ general: { uuid: "Actor.ay", nome: "Ayleth", guerra: 17 }, substituto: { uuid: "Actor.nm", nome: "Nobre Menor" } }, {}
	]
});
let cfg = aplicarConfiguracao(emJogo, rascunhoAntigo, { comandoEditado: [false, false] });
assert.equal(cfg.exercitos[0].general.nome, "Nobre Menor", "sem edição: mantém o substituto que assumiu");
assert.equal(cfg.exercitos[0].substituto.nome, "");
cfg = aplicarConfiguracao(emJogo, rascunhoAntigo, { comandoEditado: [true, false] });
assert.equal(cfg.exercitos[0].general.nome, "Ayleth", "editado pelo mestre: vale o configurador");
console.log("comando em jogo: ok");
