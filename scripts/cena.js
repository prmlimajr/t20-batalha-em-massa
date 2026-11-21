/**
 * T2 — Marcar uma cena como cena de batalha.
 *
 * - Checkbox "Cena de batalha em massa" + botão "Configurar batalha" na aba Básico da configuração da cena.
 * - O checkbox grava `flags.<id>.ativa` na hora em que é clicado (não espera o "Salvar" da cena).
 * - Ao marcar pela primeira vez, preUpdateScene/preCreateScene acrescentam o estado padrão na mesma gravação.
 * - Cenas de batalha ganham um ícone no diretório de cenas.
 */
import { MODULE_ID, L, log } from "./modulo.js";
import { ehCenaBatalha, estadoAoMarcar } from "./estado.js";

const CAMPO = `flags.${MODULE_ID}.ativa`;

/* ---------------- Formulário da cena ---------------- */

function injetarNaConfigCena(app, html) {
	const raiz = html instanceof HTMLElement ? html : html?.[0];
	const scene = app.document ?? app.object;
	log("renderSceneConfig", { app: app.constructor?.name, raiz: !!raiz, scene: scene?.uuid, gm: game.user.isGM });
	if (!raiz || !scene || !game.user.isGM) return;
	if (raiz.querySelector(".t20bm-config-cena")) return; // re-render de partes: não duplicar

	const ativa = ehCenaBatalha(scene);
	const bloco = document.createElement("fieldset");
	bloco.className = "t20bm-config-cena";
	bloco.innerHTML = `
		<legend>${L("Titulo")}</legend>
		<div class="form-group">
			<label for="${app.id}-t20bm-ativa">${L("Cena.Marcar")}</label>
			<div class="form-fields">
				<input type="checkbox" id="${app.id}-t20bm-ativa" ${ativa ? "checked" : ""}>
			</div>
			<p class="hint">${L("Cena.MarcarDica")}</p>
		</div>
		<div class="form-group">
			<button type="button" class="t20bm-configurar" ${ativa ? "" : "disabled"}>
				<i class="fa-solid fa-chess-rook"></i> ${L("Cena.Configurar")}
			</button>
		</div>`;

	const checkbox = bloco.querySelector("input");
	const botao = bloco.querySelector(".t20bm-configurar");
	// Grava na hora (não depende do "Salvar" da cena, cujo processamento do formulário muda entre versões).
	checkbox.addEventListener("change", async () => {
		checkbox.disabled = true;
		try {
			await scene.update({ [CAMPO]: checkbox.checked }, { render: false });
			log("cena de batalha", checkbox.checked, scene.flags[MODULE_ID]);
		} catch (erro) {
			console.error(`${MODULE_ID} | falha ao marcar a cena`, erro);
			ui.notifications.error(L("Cena.FalhaGravar"));
			checkbox.checked = ehCenaBatalha(scene);
		} finally {
			checkbox.disabled = false;
			botao.disabled = !checkbox.checked;
		}
	});
	botao.addEventListener("click", () => abrirConfigurador(scene));

	// Aba Básico (v13+: .tab[data-tab="basics"]); se a estrutura mudar, cai no fim do formulário.
	const destino = raiz.querySelector('.tab[data-tab="basics"]')
		?? raiz.querySelector("form")
		?? raiz;
	const rodape = destino.querySelector(":scope > footer, :scope > .form-footer");
	destino.insertBefore(bloco, rodape?.parentElement === destino ? rodape : null);
	log("bloco inserido em", destino.tagName, destino.className || destino.dataset?.tab);
	app.setPosition?.({ height: "auto" });
}

/** Configurador do mestre: chega na T4. */
export function abrirConfigurador(scene) {
	ui.notifications.info(L("Cena.ConfiguradorEmBreve"));
}

/* ---------------- Estado padrão ao marcar ---------------- */

function aoCriarCena(scene, dados) {
	const ativa = foundry.utils.getProperty(dados, CAMPO);
	const temEstado = !!foundry.utils.getProperty(dados, `flags.${MODULE_ID}.estado`);
	const estado = estadoAoMarcar(ativa, temEstado);
	if (estado) scene.updateSource({ [`flags.${MODULE_ID}.estado`]: estado });
}

function aoAtualizarCena(scene, alteracoes) {
	const ativa = foundry.utils.getProperty(alteracoes, CAMPO);
	const estado = estadoAoMarcar(ativa, !!scene.getFlag(MODULE_ID, "estado"));
	if (estado) foundry.utils.setProperty(alteracoes, `flags.${MODULE_ID}.estado`, estado);
}

/* ---------------- Diretório de cenas ---------------- */

function marcarNoDiretorio(app, html) {
	const raiz = html instanceof HTMLElement ? html : html?.[0];
	if (!raiz) return;
	for (const li of raiz.querySelectorAll("[data-entry-id]")) {
		const scene = game.scenes.get(li.dataset.entryId);
		const nome = li.querySelector(".entry-name, .document-name") ?? li;
		nome.querySelector(".t20bm-icone-batalha")?.remove();
		if (!ehCenaBatalha(scene)) continue;
		const icone = document.createElement("i");
		icone.className = "fa-solid fa-chess-rook t20bm-icone-batalha";
		icone.title = L("Cena.Marcar");
		nome.prepend(icone);
	}
}

export function registrarCena() {
	Hooks.on("renderSceneConfig", injetarNaConfigCena);
	Hooks.on("preCreateScene", aoCriarCena);
	Hooks.on("preUpdateScene", aoAtualizarCena);
	Hooks.on("renderSceneDirectory", marcarNoDiretorio);
	// O diretório não re-renderiza ao mudar só um flag: atualizar o ícone quando `ativa` muda.
	Hooks.on("updateScene", (scene, alteracoes) => {
		if (foundry.utils.hasProperty(alteracoes, CAMPO)) ui.scenes?.render();
	});
}
