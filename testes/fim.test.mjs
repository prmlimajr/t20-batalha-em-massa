// Teste em Node do fim da batalha (T12). Rodar: node testes/fim.test.mjs
import assert from "node:assert/strict";
import { declararVencedor, encerrada, resumoFim } from "../scripts/fim.js";
import { completarEstado, reiniciarBatalha } from "../scripts/estado.js";
import { avancarEtapa, voltarEtapa, podeVoltar } from "../scripts/conducao.js";
import { validarMovimento } from "../scripts/posicionamento.js";

const base = (extra = {}) => completarEstado({
	tamanho: "media", iniciada: true, turno: 6, etapa: "generais",
	exercitos: [{ nome: "Guarda do Norte", pontos: 10 }, { nome: "Legião Carmesim", pontos: 4 }],
	herois: [{ uuid: "h1", area: 1 }],
	historico: [{ turno: 1, totais: [27, 20], vencedor: 0, pontos: 2, placar: [2, 0] }],
	...extra
});

/* Resumo: vitória dos heróis por destruição */
let e = base({ fim: { tipo: "destruicao", vencedor: 0, turno: 6 } });
assert.equal(encerrada(e), true);
let r = resumoFim(e, { nds: ["2", "1/2", "4"] });
assert.deepEqual([r.tipo, r.vencedorNome, r.perdedorNome, r.heroisVenceram, r.turnos], ["destruicao", "Guarda do Norte", "Legião Carmesim", true, 6]);
assert.deepEqual(r.placar, [10, 4]);
assert.deepEqual(r.baixas, [
	{ exercito: "Guarda do Norte", percentual: 20, feridos: 10, mortos: 10 },
	{ exercito: "Legião Carmesim", percentual: 50, feridos: 25, mortos: 25 }
]);
assert.equal(r.ndMedio, 2.17);
assert.equal(r.semND, false);
assert.deepEqual(r.historico[0], { turno: 1, totais: [27, 20], vencedorNome: "Guarda do Norte", pontos: 2, placar: [2, 0] });
assert.equal(resumoFim(e).semND, true, "heróis venceram mas a tabela não tem ND");

/* Derrota dos heróis: sem espólios */
r = resumoFim(base({ fim: { tipo: "fuga", vencedor: 1, turno: 6 } }), { nds: ["3"] });
assert.deepEqual([r.heroisVenceram, r.ndMedio, r.semND], [false, null, false]);
assert.equal(resumoFim(base()), null, "sem fim, sem resumo");

/* Desistência declarada pelo mestre */
e = declararVencedor(base({ fugindo: 1 }), 1);
assert.deepEqual(e.fim, { tipo: "desistencia", vencedor: 1, turno: 6 });
assert.equal(e.fugindo, null);
assert.deepEqual(declararVencedor(e, 0).fim.vencedor, 1, "não troca um fim já decidido");
assert.equal(declararVencedor(base(), 2).fim, null, "lado inválido");

/* Batalha encerrada trava etapas e movimento */
assert.deepEqual(avancarEtapa(e).estado.etapa, "generais");
assert.equal(voltarEtapa(e).mudou, false);
assert.equal(podeVoltar(e), false);
assert.equal(validarMovimento(e, "h1", 2, { ehGM: true }).motivo, "Encerrada");

/* Reiniciar volta tudo */
const re = reiniciarBatalha(e);
assert.deepEqual([re.fim, re.etapa, re.turno, re.historico.length], [null, "pre", 0, 0]);

console.log("fim: ok");
