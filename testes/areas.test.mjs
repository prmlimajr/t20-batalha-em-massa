// Teste em Node das áreas e do combate aéreo opcional (decisão 27). Rodar: node testes/areas.test.mjs
import assert from "node:assert/strict";
import { areasDisponiveis, vizinhas, umPasso, modDaArea, nomeDaArea, subtituloDaArea, AREA_CEU, ceuAtivo } from "../scripts/areas.js";
import { completarEstado, estadoPadrao } from "../scripts/estado.js";
import { validarMovimento, moverHeroi, opcoesDeMovimento, registrarInicio } from "../scripts/posicionamento.js";
import { visaoBatalha } from "../scripts/visao.js";
import { aplicarConfiguracao } from "../scripts/configuracao.js";
import { composicaoBonus } from "../scripts/generais.js";

const semCeu = completarEstado({});
const comCeu = completarEstado({ ceu: { ativo: true, nome: "Céus de Svalas", imagem: "ceu.png", mod: 7 } });

/* Padrões */
assert.deepEqual(estadoPadrao().ceu, { ativo: false, nome: "Combate aéreo", imagem: "modules/t20-batalha-em-massa/assets/sobosceus.jpeg", mod: 5 });
assert.equal(completarEstado({ ceu: { ativo: true, imagem: "" } }).ceu.imagem, "modules/t20-batalha-em-massa/assets/sobosceus.jpeg", "vazia: usa a padrão");
assert.equal(completarEstado({ ceu: { imagem: "minha.png" } }).ceu.imagem, "minha.png");
assert.equal(ceuAtivo(semCeu), false);

/* Áreas e vizinhança */
assert.deepEqual(areasDisponiveis(semCeu), [0, 1, 2, 3]);
assert.deepEqual(areasDisponiveis(comCeu), [0, 1, 2, 3, 4]);
assert.deepEqual(vizinhas(semCeu, 2), [1, 3]);
assert.deepEqual(vizinhas(comCeu, 0), [1], "do Acampamento não se chega ao céu");
assert.deepEqual(vizinhas(comCeu, 1), [0, 2, 4]);
assert.deepEqual(vizinhas(comCeu, 3), [2, 4]);
assert.deepEqual(vizinhas(comCeu, AREA_CEU), [0, 1, 2, 3], "do céu desce para qualquer área terrestre, inclusive o Acampamento");
assert.deepEqual(vizinhas(semCeu, AREA_CEU), []);
assert.equal(umPasso(comCeu, 4, 4), true);
assert.equal(umPasso(comCeu, 4, 0), true);
assert.equal(umPasso(comCeu, 0, 4), false, "do Acampamento não sobe");

/* Nome, subtítulo e modificador */
assert.equal(nomeDaArea(comCeu, 4), "Céus de Svalas");
assert.equal(subtituloDaArea(4), "Sob os céus");
assert.equal(modDaArea(comCeu, 4), 7);
assert.equal(modDaArea(completarEstado({ ceu: { ativo: true, mod: "" } }), 4), 0);
assert.equal(modDaArea(comCeu, 2), 5);

/* Movimento */
const base = (extra = {}) => registrarInicio(completarEstado({
	iniciada: true, etapa: "posicionamento", grupoArea: 2, ceu: { ativo: true },
	herois: [{ uuid: "h1", area: 2, voa: true }], ...extra
}));
const j = { ehGM: false, dono: true };
assert.equal(validarMovimento(base(), "h1", 4, j).ok, true, "do Front sobe aos céus");
assert.equal(validarMovimento(base({ grupoArea: 0 }), "h1", 4, j).motivo, "UmaArea", "do Acampamento, não");
assert.equal(validarMovimento(base({ ceu: { ativo: false } }), "h1", 4, j).motivo, "AreaInvalida", "céu desligado");
let e = moverHeroi(base(), "h1", 4);
assert.equal(e.grupoArea, 4);
assert.equal(validarMovimento(e, "h1", 3, j).ok, true, "medido do início (Front): Atrás das linhas é vizinha");
let doCeu = base({ grupoArea: 4 });
assert.deepEqual(opcoesDeMovimento(doCeu, { ehGM: false, ehDono: () => true })[0].destinos, [0, 1, 2, 3]);
assert.equal(validarMovimento(doCeu, "h1", 0, j).ok, true, "desce para o Acampamento");

/* Tabuleiro */
const v = visaoBatalha({ ...comCeu, grupoArea: 4, herois: [{ uuid: "h1", nome: "Amir" }], rodada: { eventos: { 4: { chave: "manterPosicao", nome: "Manter posição", dano: 50 } } } });
assert.equal(v.areasTerrestres.length, 4);
assert.deepEqual([v.ceu.indice, v.ceu.nome, v.ceu.subtitulo, v.ceu.mod, v.ceu.destaque], [4, "Céus de Svalas", "Sob os céus", 7, true]);
assert.deepEqual(v.ceu.herois.map((h) => h.uuid), ["h1"]);
assert.equal(v.imagemCeu, "ceu.png");
assert.equal(v.resolucoes[0].area, "Céus de Svalas");
assert.equal(v.mensagem.ceu, true);
assert.equal(visaoBatalha(semCeu).ceu, null);
// Bônus de evento no céu entra no Teste dos Generais com o nome da área
assert.match(composicaoBonus({ ...comCeu, tamanho: "escaramuca", rodada: { eventos: { 4: { chave: "quebrarFormacao", nome: "Quebrar formação", dano: 40 } } } }, 0).itens.at(-1).texto, /Céus de Svalas/);

/* Configurador: desligar o céu traz quem estava lá para a Retaguarda */
const noCeu = completarEstado({ ceu: { ativo: true }, grupoArea: 4, herois: [{ uuid: "h1", area: 4 }, { uuid: "h2", area: 2, morto: true }] });
const rasc = completarEstado(noCeu);
rasc.ceu.ativo = false;
const salvo = aplicarConfiguracao(noCeu, rasc);
assert.deepEqual([salvo.grupoArea, salvo.herois.map((h) => h.area)], [1, [1, 2]]);
const ligado = completarEstado(noCeu);
ligado.ceu.mod = "3";
assert.equal(aplicarConfiguracao(noCeu, ligado).ceu.mod, 3);

/* Só quem voa sobe aos céus (marca do mestre); desce para qualquer área terrestre */
import { bonusDaArea } from "../scripts/evento.js";
import { podeSubir, alternarVoo, alternarMorto } from "../scripts/posicionamento.js";
import { atorVoa } from "../scripts/configuracao.js";
for (const de of [1, 2, 3]) assert.equal(validarMovimento(base({ grupoArea: de, herois: [{ uuid: "h1", voa: true }, { uuid: "h2", voa: true }] }), "h1", 4, j).ok, true, `sobe de ${de}`);
const grupoMisto = base({ herois: [{ uuid: "h1", area: 2, voa: true }, { uuid: "h2", area: 2 }] });
assert.equal(validarMovimento(grupoMisto, "h1", 4, j).motivo, "GrupoNaoVoa", "grupo junto: todos precisam voar");
assert.equal(podeSubir(alternarMorto(grupoMisto, "h2"), "h1"), true, "heróis mortos não contam");
assert.equal(validarMovimento(alternarVoo(grupoMisto, "h2"), "h1", 4, j).ok, true, "o mestre marca quem voa");
const lobos = base({ opcionais: { lobosSolitarios: true }, herois: [{ uuid: "h1", area: 1, voa: true }, { uuid: "h2", area: 1 }, { uuid: "h3", area: 0, voa: true }] });
assert.equal(validarMovimento(lobos, "h1", 4, j).ok, true);
assert.equal(validarMovimento(lobos, "h2", 4, j).motivo, "NaoVoa");
assert.equal(validarMovimento(lobos, "h3", 4, j).motivo, "UmaArea", "do Acampamento não sobe, mesmo voando");
assert.equal(validarMovimento(grupoMisto, "h1", 4, { ehGM: true }).ok, true, "o mestre move qualquer um");
let volta = moverHeroi(doCeu, "h1", 0);
assert.equal(validarMovimento(volta, "h1", 4, j).ok, true, "começou no céu: desce e pode voltar");
assert.equal(atorVoa({ system: { attributes: { movement: { fly: { value: 12 } } } } }), true);
assert.equal(atorVoa({ system: { attributes: { movement: { fly: { value: 0 } } } } }), false);
assert.equal(atorVoa({}), false);

/* +2 por resolver um evento sob os céus (o mesmo evento em terra não ganha) */
const ev = (area, extra) => completarEstado({ tamanho: "escaramuca", ceu: { ativo: true }, rodada: { eventos: { [area]: { chave: "quebrarFormacao", nome: "Quebrar formação", ...extra } } } });
assert.equal(bonusDaArea(ev(4, { dano: 40 }), 4), 4, "40/20 = +2, +2 sob os céus");
assert.equal(bonusDaArea(ev(2, { dano: 40 }), 2), 2);
assert.equal(bonusDaArea(ev(4, { dano: 10 }), 4), 0, "sem bônus, sem extra");
const comp = composicaoBonus(ev(4, { dano: 40 }), 0).itens.map((i) => i.texto);
assert.ok(comp.some((t) => t.startsWith("por resolver o evento sob os céus")));

console.log("areas: ok");
