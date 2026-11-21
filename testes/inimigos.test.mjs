// Teste em Node da leitura de estatísticas dos inimigos (T5). Rodar: node testes/inimigos.test.mjs
import assert from "node:assert/strict";
import { resumoInimigo, armasDoAtor, comSinal } from "../scripts/inimigos.js";
import { moverIndice, duplicarIndice } from "../scripts/configuracao.js";
import { formulaInimigos, inimigoDaFace } from "../scripts/regras.js";

// Ator no formato do sistema (como o bestiário gera a Abelha-Grifo), já com valores calculados.
const abelha = {
	name: "Abelha-Grifo", img: "abelha.png", type: "npc",
	system: {
		attributes: { nd: "4", pv: { value: 38, max: 38 }, defesa: { value: 22 } },
		pericias: { fort: { value: 10 }, refl: { value: 15 }, vont: { value: 5 }, luta: { value: 17 }, pont: { value: 6 } },
		detalhes: { ataquescac: "Mordida +17 (4d6+18).", ataquesad: "" }
	},
	items: new Map([
		["a", {
			name: "Mordida", type: "arma",
			system: {
				criticoM: 20, criticoX: 2,
				rolls: [
					{ type: "ataque", parts: [["1d20", "", ""], ["luta", "", ""], ["0", "", ""]] },
					{ type: "dano", parts: [["4d6+18", "perfuracao", ""]] }
				]
			}
		}],
		["b", {
			name: "Ferrão", type: "arma",
			system: {
				criticoM: 19, criticoX: 3,
				rolls: [
					{ type: "ataque", parts: [["1d20"], ["pont"], ["2"]] },
					{ type: "dano", parts: [["1d8+9", "perfuracao"], ["2d12", "perda"]] }
				]
			}
		}],
		["c", { name: "Agarrar Aprimorado", type: "poder", system: {} }]
	])
};

const r = resumoInimigo(abelha);
assert.equal(r.nome, "Abelha-Grifo");
assert.equal(r.nd, "4");
assert.equal(r.defesa, 22);
assert.equal(r.pv, 38);
assert.deepEqual([r.fort, r.refl, r.vont], [10, 15, 5]);
assert.deepEqual(r.ataquesTexto, ["Mordida +17 (4d6+18)."]);
assert.equal(r.armas.length, 2, "só itens do tipo arma");
assert.deepEqual(r.armas[0], { nome: "Mordida", bonusAtaque: 17, dano: "4d6+18", critico: "x2", danoMedio: 30, danoMedioCritico: 42 });
assert.equal(r.armas[1].bonusAtaque, 8, "perícia de pontaria + bônus do item");
assert.equal(r.armas[1].dano, "1d8+9+2d12");
assert.equal(r.armas[1].critico, "19/x3");
assert.equal(r.armas[1].danoMedio, 4 + 9 + 12);

// Itens como array (toObject) e ator sem dados
assert.equal(armasDoAtor({ items: [...abelha.items.values()], system: abelha.system }).length, 2);
const vazio = resumoInimigo({ name: "Sem ficha" });
assert.deepEqual([vazio.nd, vazio.defesa, vazio.fort, vazio.pv], [null, null, null, null]);
assert.deepEqual(vazio.armas, []);
assert.deepEqual(vazio.ataquesTexto, []);

// Arma sem rolagem de ataque reconhecível
const semPericia = armasDoAtor({ system: { pericias: {} }, items: [{ type: "arma", name: "X", system: { rolls: [{ type: "ataque", parts: [["1d20"], ["luta"], ["2"]] }] } }] });
assert.equal(semPericia[0].bonusAtaque, null);
assert.equal(semPericia[0].dano, null);

assert.equal(comSinal(5), "+5");
assert.equal(comSinal(-2), "−2");
assert.equal(comSinal(0), "0");
assert.equal(comSinal(null), "—");

// Tabela: ordem = face; repetir pesa o sorteio
let tabela = ["lobo", "orc", "ogro"];
assert.deepEqual(moverIndice(tabela, 2, 1), ["lobo", "ogro", "orc"]);
assert.equal(moverIndice(tabela, 0, -1), tabela);
assert.equal(moverIndice(tabela, 2, 3), tabela);
tabela = duplicarIndice(tabela, 1);
assert.deepEqual(tabela, ["lobo", "orc", "orc", "ogro"]);
assert.equal(formulaInimigos(tabela), "1d4");
assert.equal(inimigoDaFace(tabela, 3), "orc");
const objs = [{ uuid: "a" }];
const dup = duplicarIndice(objs, 0);
dup[1].uuid = "b";
assert.equal(objs[0].uuid, "a", "cópia independente");
assert.equal(duplicarIndice(objs, 5), objs);

console.log("inimigos: ok");
