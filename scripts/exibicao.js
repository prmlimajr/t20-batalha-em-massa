/**
 * T7 — Sincroniza o modal com a batalha em exibição (configuração do mundo "exibida").
 * Roda em todos os clientes: ao carregar o mundo e sempre que o mestre exibe/encerra.
 */
import { idExibida, HOOK_BATALHAS, HOOK_EXIBIDA } from "./armazenamento.js";
import { ModalBatalha } from "./apps/modal-batalha.js";

export function sincronizarExibicao() {
	const id = idExibida();
	if (id) return ModalBatalha.abrir(id);
	return ModalBatalha.fecharExibicao();
}

export function registrarExibicao() {
	Hooks.on(HOOK_EXIBIDA, () => sincronizarExibicao());
	Hooks.on(HOOK_BATALHAS, () => ModalBatalha.atualizar());
}
