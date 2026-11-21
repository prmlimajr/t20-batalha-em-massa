// Teste em Node das tabelas e regras do Apêndice B (T3). Rodar: node testes/regras.test.mjs
import assert from "node:assert/strict";
import {
	TAMANHOS, MODIFICADORES_GUERRA, POSICOES, ETAPAS, EVENTOS, MECANICAS, OPCIONAIS
} from "../scripts/constantes.js";
import {
	cdDaBatalha, limiarVitoria, somaModificadores, vencedorOposto, motivacao, modPosicao, movimentoValido,
	totalEvento, eventoPorTotal, bonusPorDano, bonusEvento, bonusGuerra, resultadoGenerais, guerraNovoGeneral,
	verificarFimRodada, baixas, ndNumero, ndMedio, proximaEtapa, etapaAnterior, formulaInimigos, inimigoDaFace,
	lerFormulaDano, danoMedio, danoMedioCritico
} from "../scripts/regras.js";
import { estadoPadrao } from "../scripts/estado.js";

/* ---------------- Tabelas ---------------- */

// B-1
assert.deepEqual(Object.values(TAMANHOS).map((t) => [t.cd, t.dano]), [[20, 20], [25, 50], [30, 50], [35, 50], [40, 100]]);
assert.deepEqual(Object.values(TAMANHOS).map((t) => t.limiarVariado), [5, 8, 10, 15, 20]);

// B-2
assert.equal(MODIFICADORES_GUERRA.length, 11);
assert.equal(new Set(MODIFICADORES_GUERRA.map((m) => m.chave)).size, 11, "chaves únicas");
assert.deepEqual(MODIFICADORES_GUERRA.map((m) => m.valor), [2, 5, 10, 2, 5, 10, 2, 1, -2, 2, 2]);

// Posições e áreas do estado na mesma ordem
assert.deepEqual(POSICOES.map((p) => p.mod), [-10, 0, 5, 10]);
assert.deepEqual(POSICOES.map((p) => p.chave), estadoPadrao().areas.map((a) => a.posicao));
assert.equal(ETAPAS.length, 4);
assert.deepEqual(Object.keys(OPCIONAIS).sort(), Object.keys(estadoPadrao().opcionais).sort());

// B-5: faixas contínuas, sem buraco nem sobreposição, cobrindo de −∞ a +∞
assert.equal(EVENTOS.length, 12);
assert.equal(EVENTOS[0].min, null);
assert.equal(EVENTOS.at(-1).max, null);
for (let i = 1; i < EVENTOS.length; i++) assert.equal(EVENTOS[i].min, EVENTOS[i - 1].max + 1, EVENTOS[i].chave);
for (const e of EVENTOS) {
	assert.ok(MECANICAS[e.mecanica], `mecânica de ${e.chave}`);
	assert.ok(e.texto.length > 20, `texto de ${e.chave}`);
	if (e.mecanica === "testePericia" || e.mecanica === "atacarETeste") assert.ok(e.pericias?.length, `perícias de ${e.chave}`);
}

/* ---------------- Batalha ---------------- */

assert.equal(cdDaBatalha("escaramuca"), 20);
assert.equal(cdDaBatalha("epica"), 40);
assert.equal(cdDaBatalha("inexistente"), 30, "padrão = média");
assert.equal(limiarVitoria("epica"), 10);
assert.equal(limiarVitoria("epica", true), 20);
assert.equal(limiarVitoria("escaramuca", true), 5);
assert.equal(somaModificadores([{ valor: 2 }, { valor: -2 }, { valor: 5 }, { valor: "3" }, {}]), 8);
assert.equal(somaModificadores(), 0);

/* ---------------- Pré-batalha ---------------- */

assert.equal(vencedorOposto(15, 12), 0);
assert.equal(vencedorOposto(9, 12), 1);
assert.equal(vencedorOposto(12, 12), null, "empate sem bônus informado: rolar de novo");
assert.equal(vencedorOposto(12, 12, 7, 4), 0, "empate: maior bônus vence");
assert.equal(vencedorOposto(12, 12, 3, 4), 1);
assert.equal(vencedorOposto(12, 12, 4, 4), null, "empate no bônus: rolar de novo");
assert.equal(vencedorOposto(13, 12, 0, 9), 0, "bônus só desempata");
assert.equal(motivacao(20), 1);
assert.equal(motivacao(24), 1);
assert.equal(motivacao(25), 2);
assert.equal(motivacao(31), 3);
assert.equal(motivacao(19), 0, "falhou por 1");
assert.equal(motivacao(16), 0, "falhou por 4");
assert.equal(motivacao(15), -2, "falhou por 5");
assert.equal(motivacao(3), -2);

/* ---------------- Posicionamento ---------------- */

assert.deepEqual([0, 1, 2, 3].map(modPosicao), [-10, 0, 5, 10]);
assert.equal(movimentoValido(1, 2), true);
assert.equal(movimentoValido(1, 0), true);
assert.equal(movimentoValido(1, 1), true, "ficar");
assert.equal(movimentoValido(1, 3), false, "duas casas");
assert.equal(movimentoValido(3, 4), false, "fora do campo");
assert.equal(movimentoValido(0, -1), false);

/* ---------------- Evento ---------------- */

assert.equal(totalEvento(12, 1), 12);
assert.equal(totalEvento(12, 0), 2);
assert.equal(totalEvento(12, 3, -2), 20);
const evento = (t) => eventoPorTotal(t).chave;
assert.equal(evento(-9), "curandeiro");
assert.equal(evento(2), "curandeiro");
assert.equal(evento(3), "levarOrdens");
assert.equal(evento(6), "erguerEstandarte");
assert.equal(evento(7), "manterPosicao");
assert.equal(evento(10), "manterPosicao");
assert.equal(evento(14), "quebrarFormacao");
assert.equal(evento(15), "aliadoFerido");
assert.equal(evento(18), "interceptarOrdens");
assert.equal(evento(20), "servirDeIsca");
assert.equal(evento(21), "ataqueLivre");
assert.equal(evento(24), "capturarEstandarte");
assert.equal(evento(28), "enfrentarCapitao");
assert.equal(evento(29), "enfrentarGeneral");
assert.equal(evento(30), "enfrentarGeneral", "d20 20 no Atrás das linhas");

// Exemplo do livro: 70 de dano numa escaramuça → +3
assert.equal(bonusPorDano(70, "escaramuca"), 3);
assert.equal(bonusPorDano(49, "media"), 0);
assert.equal(bonusPorDano(100, "media"), 2);
assert.equal(bonusPorDano(199, "epica"), 1);
assert.equal(bonusPorDano(-5, "media"), 0);

assert.equal(bonusEvento({ tamanho: "escaramuca", dano: 70 }), 3);
assert.equal(bonusEvento({ tamanho: "escaramuca", dano: 70, testePericia: true }), 5, "cumulativo com o teste");
assert.equal(bonusEvento({ tamanho: "media", testePericia: true }), 2, "só o teste");
assert.equal(bonusEvento({ tamanho: "media", dano: 40, danoLider: 30 }), 2, "ataque livre: 40 + 2×30 = 100");
assert.equal(bonusEvento({ tamanho: "media", dano: 120, danoOficial: 30, capitao: true }), 1, "capitão: 90 → +1, sem extra");
assert.equal(bonusEvento({ tamanho: "media", dano: 130, danoOficial: 20, capitao: true }), 4, "capitão: 110 → +2, +2 extra");
assert.equal(bonusEvento({ tamanho: "media", dano: 10, danoOficial: 50 }), 0, "não fica negativo");

/* ---------------- Teste dos generais ---------------- */

assert.equal(bonusGuerra({ modificadores: [{ valor: 2 }, { valor: 5 }], bonusEvento: 3, estandartes: 1 }), 12);
assert.equal(bonusGuerra({}), 0);
// Exemplo do livro: 26 contra 19 → 2 pontos de vitória
assert.deepEqual(resultadoGenerais(26, 19), { vencedor: 0, pontos: 2, diferenca: 7, rolarDeNovo: false });
assert.deepEqual(resultadoGenerais(19, 26), { vencedor: 1, pontos: 2, diferenca: 7, rolarDeNovo: false });
assert.equal(resultadoGenerais(20, 16).pontos, 1);
assert.equal(resultadoGenerais(30, 20).pontos, 3);
assert.deepEqual(resultadoGenerais(15, 15, 8, 5), { vencedor: 0, pontos: 1, diferenca: 0, rolarDeNovo: false }, "empate: maior bônus, 1 ponto");
assert.deepEqual(resultadoGenerais(15, 15, 5, 8), { vencedor: 1, pontos: 1, diferenca: 0, rolarDeNovo: false });
assert.deepEqual(resultadoGenerais(15, 15, 5, 5), { vencedor: null, pontos: 0, diferenca: 0, rolarDeNovo: true });
assert.equal(guerraNovoGeneral(12, 5), 7);

/* ---------------- Fim de rodada ---------------- */

// Exemplo do livro: fim da 5ª rodada, Reinado 7 × Purista 2 → Purista começa a fugir.
let r = verificarFimRodada({ pontos: [7, 2], limiar: 10 });
assert.deepEqual(r, { fim: null, vencedor: null, fugindo: 1, fugaInterrompida: false });
// 6ª rodada: Purista ganha 2 → 7 × 4, diferença 3 → fuga interrompida.
r = verificarFimRodada({ pontos: [7, 4], limiar: 10, fugindo: 1 });
assert.deepEqual(r, { fim: null, vencedor: null, fugindo: null, fugaInterrompida: true });
// Se não tivesse reduzido: termina por fuga.
r = verificarFimRodada({ pontos: [8, 2], limiar: 10, fugindo: 1 });
assert.deepEqual(r, { fim: "fuga", vencedor: 0, fugindo: null, fugaInterrompida: false });
// Destruição
assert.deepEqual(verificarFimRodada({ pontos: [10, 6], limiar: 10 }).fim, "destruicao");
assert.equal(verificarFimRodada({ pontos: [3, 10], limiar: 10 }).vencedor, 1);
assert.equal(verificarFimRodada({ pontos: [3, 9], limiar: 8 }).fim, "destruicao", "limiar variado");
// Destruição tem prioridade sobre a fuga
assert.equal(verificarFimRodada({ pontos: [11, 2], limiar: 10, fugindo: 1 }).fim, "destruicao");
// Nada acontece
assert.deepEqual(verificarFimRodada({ pontos: [4, 2], limiar: 10 }), { fim: null, vencedor: null, fugindo: null, fugaInterrompida: false });

/* ---------------- Depois da batalha ---------------- */

assert.deepEqual(baixas(10), { percentual: 50, feridos: 25, mortos: 25 });
assert.deepEqual(baixas(3), { percentual: 15, feridos: 7.5, mortos: 7.5 });
assert.equal(ndNumero("1/2"), 0.5);
assert.equal(ndNumero("1/4"), 0.25);
assert.equal(ndNumero("5"), 5);
assert.equal(ndNumero(3), 3);
assert.equal(ndNumero("S"), 20);
assert.equal(ndNumero(""), null);
assert.equal(ndNumero("abc"), null);
assert.equal(ndMedio(["1", "3", "1/2", "x"]), 1.5);
assert.equal(ndMedio([]), null);

/* ---------------- Etapas ---------------- */

assert.deepEqual(proximaEtapa("pre", 0), { etapa: "preparacao", turno: 1, novaRodada: true });
assert.deepEqual(proximaEtapa("preparacao", 1), { etapa: "posicionamento", turno: 1, novaRodada: false });
assert.deepEqual(proximaEtapa("evento", 2), { etapa: "generais", turno: 2, novaRodada: false });
assert.deepEqual(proximaEtapa("generais", 2), { etapa: "preparacao", turno: 3, novaRodada: true });
assert.deepEqual(etapaAnterior("evento", 2), { etapa: "posicionamento", turno: 2 });
assert.deepEqual(etapaAnterior("preparacao", 2), { etapa: "preparacao", turno: 2 });

/* ---------------- Tabela de inimigos ---------------- */

assert.equal(formulaInimigos(["a", "b", "c", "d", "e", "f", "g", "h"]), "1d8");
assert.equal(formulaInimigos(["a", "b", "c", "d", "e", "f"]), "1d6");
assert.equal(formulaInimigos([]), null);
assert.equal(inimigoDaFace(["a", "b", "c"], 1), "a");
assert.equal(inimigoDaFace(["a", "b", "c"], 3), "c");
assert.equal(inimigoDaFace(["a", "b", "c"], 4), null);

/* ---------------- Dano médio ---------------- */

// Exemplos do livro: 1d6+1 → 4 (crítico x2: 7); 2d10+25 → 35 (crítico x3: 55)
assert.equal(danoMedio("1d6+1"), 4);
assert.equal(danoMedioCritico("1d6+1", 2), 7);
assert.equal(danoMedio("2d10+25"), 35);
assert.equal(danoMedioCritico("2d10+25", 3), 55);
assert.equal(danoMedio("1d4"), 2);
assert.equal(danoMedio("1d8"), 4);
assert.equal(danoMedio("1d8 + 1d6 + 3"), 10);
assert.equal(danoMedio("d12-1"), 5);
assert.equal(danoMedio("7"), 7);
assert.equal(danoMedio("1d6+@for"), null, "fórmula com variável não é lida");
assert.equal(danoMedio(""), null);
assert.deepEqual(lerFormulaDano("2d6+3"), { dados: [{ qtd: 2, faces: 6, sinal: 1 }], fixo: 3 });

console.log("regras: ok");
