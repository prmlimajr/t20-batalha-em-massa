/**
 * Retratos guardados na batalha ({uuid, nome, img}) completados com os dados atuais do ator no Foundry.
 * Usado pelo configurador e pelo modal.
 */
import { imagemDoAtor } from "./configuracao.js";

/** Nome e imagem do token atuais do ator (se existir no mundo), senão os guardados. */
export function retratoVivo(retrato, { comGuerra = false } = {}) {
	const r = retrato ?? {};
	let ator = null;
	try {
		ator = r.uuid ? fromUuidSync(r.uuid, { strict: false }) : null;
	} catch {
		ator = null;
	}
	const vivo = {
		...r,
		nome: ator?.name ?? r.nome ?? "",
		img: (ator && imagemDoAtor(ator)) ?? r.img ?? null,
		temAtor: !!r.uuid,
		atorSumiu: !!r.uuid && !ator,
		// Atores de compêndio vêm como índice (sem permissões): o mestre sempre pode abrir.
		podeVer: ator?.testUserPermission ? ator.testUserPermission(game.user, "OBSERVER") : !!(ator && game.user.isGM),
		vazio: !r.uuid && !r.nome && !r.img
	};
	if (comGuerra) {
		const guerraFicha = ator?.system?.pericias?.guer?.value;
		vivo.guerraFicha = guerraFicha === undefined || !Number.isFinite(Number(guerraFicha)) ? null : Number(guerraFicha);
	}
	return vivo;
}
