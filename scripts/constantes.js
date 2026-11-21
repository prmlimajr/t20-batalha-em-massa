/**
 * Tabelas do Apêndice B (Guerra Artoniana, pp. 370–375).
 * T3 completa este arquivo (B-2, B-5, posições, limiares variados).
 */

/** Tabela B-1: tamanho da batalha → CD dos testes de perícia dos eventos e dano para cada +1 de bônus. */
export const TAMANHOS = {
	escaramuca: { nome: "Escaramuça", combatentes: "Até 250", cd: 20, dano: 20 },
	pequena: { nome: "Batalha pequena", combatentes: "De 251 a 1.000", cd: 25, dano: 50 },
	media: { nome: "Batalha média", combatentes: "De 1.001 a 5.000", cd: 30, dano: 50 },
	grande: { nome: "Batalha grande", combatentes: "De 5.001 a 20.000", cd: 35, dano: 50 },
	epica: { nome: "Batalha épica", combatentes: "Mais de 20.000", cd: 40, dano: 100 }
};
