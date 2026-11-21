/**
 * Pedidos dos jogadores ao mestre (jogadores não gravam as batalhas).
 * Só o mestre ativo (game.users.activeGM) executa; o mestre chama os tratadores direto, sem socket.
 * Uso pessoal: o remetente é informado na própria mensagem (userId).
 */
import { SOCKET, L, log } from "./modulo.js";

const tratadores = {};

/** Registra o que o mestre faz ao receber um pedido do tipo `tipo`: fn(dados, usuario). */
export function registrarTratador(tipo, fn) {
	tratadores[tipo] = fn;
}

export const souMestreAtivo = () => (game.users.activeGM ? game.users.activeGM.isSelf : game.user.isGM);

export function registrarSocket() {
	game.socket.on(SOCKET, async (mensagem) => {
		if (!souMestreAtivo()) return;
		const { tipo, dados, userId } = mensagem ?? {};
		const usuario = game.users.get(userId);
		const fn = tratadores[tipo];
		if (!fn || !usuario) return log("pedido desconhecido", mensagem);
		try {
			await fn(dados, usuario);
		} catch (erro) {
			console.error("t20-batalha-em-massa | falha ao atender pedido", mensagem, erro);
		}
	});
}

/**
 * Envia um pedido ao mestre. Se este cliente é o mestre ativo, executa na hora.
 * @returns {boolean} false se não há mestre conectado
 */
export async function pedirAoMestre(tipo, dados) {
	if (!game.users.activeGM) {
		ui.notifications.warn(L("Socket.SemMestre"));
		return false;
	}
	if (souMestreAtivo()) {
		await tratadores[tipo]?.(dados, game.user);
		return true;
	}
	game.socket.emit(SOCKET, { tipo, dados, userId: game.user.id });
	return true;
}
