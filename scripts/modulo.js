/** Identificadores compartilhados por todo o módulo. */

export const MODULE_ID = "t20-batalha-em-massa";

/** Canal de socket do módulo (exige "socket": true no module.json). */
export const SOCKET = `module.${MODULE_ID}`;

/** Caminho de um arquivo dentro do módulo, ex.: caminho("assets/fundo.png"). */
export const caminho = (relativo) => `modules/${MODULE_ID}/${relativo}`;

/** Atalho de i18n com o prefixo do módulo. */
export const L = (chave, dados) => dados
	? game.i18n.format(`T20BM.${chave}`, dados)
	: game.i18n.localize(`T20BM.${chave}`);

export const log = (...args) => console.log(`${MODULE_ID} |`, ...args);
