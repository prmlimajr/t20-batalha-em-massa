/**
 * Animação de abertura do modal ("A batalha começa"), no estilo da animação de subir de nível do
 * t20-construtor-ficha: imagem de abertura com camada preta a 60%, faixa e faíscas douradas e o título
 * na fonte Tormenta 20. Dura 3000 ms e some sozinha. Com "reduzir movimento", só aparece e some.
 */
import { caminho } from "./modulo.js";

export const DURACAO_ABERTURA = 3000;
const FAISCAS = 32;

function el(tag, classe, texto) {
	const e = document.createElement(tag);
	if (classe) e.className = classe;
	if (texto !== undefined) e.textContent = texto;
	return e;
}

/**
 * Mostra a animação por cima de `alvo` (o tabuleiro). A camada vai para `container` (o elemento do modal),
 * para não sumir se o tabuleiro for redesenhado durante a animação.
 * @param {object} p
 * @param {HTMLElement} p.container   elemento do modal
 * @param {HTMLElement} p.alvo        tabuleiro (a animação cobre a área dele)
 * @param {string} p.texto            título ("A batalha começa")
 * @param {string} [p.subtitulo]      linha menor abaixo do título
 * @param {string|null} [p.imagem]    imagem de fundo (padrão: a de abertura; null = sem imagem)
 * @param {string} [p.classe]         classe extra (ex.: "aliado"/"inimigo" para a cor do anúncio)
 * @param {number} [p.duracao]        em ms (padrão 3000)
 * @returns {Promise<void>} resolvida quando a animação some
 */
export function animarAbertura({ container, alvo, texto, subtitulo = "", imagem = caminho("assets/abertura.jpg"), classe = "", duracao = DURACAO_ABERTURA }) {
	if (!container || !alvo) return Promise.resolve();
	container.querySelector(":scope > .t20bm-abertura")?.remove();

	const caixa = alvo.getBoundingClientRect();
	const base = container.getBoundingClientRect();
	const raiz = el("div", `t20bm-abertura ${classe}`.trim());
	raiz.setAttribute("role", "status");
	raiz.setAttribute("aria-live", "polite");
	Object.assign(raiz.style, {
		left: `${caixa.left - base.left}px`,
		top: `${caixa.top - base.top}px`,
		width: `${caixa.width}px`,
		height: `${caixa.height}px`,
		...(imagem ? { backgroundImage: `url("${imagem}")` } : {})
	});

	raiz.style.setProperty("--t20bm-duracao", `${duracao}ms`);
	raiz.append(el("div", "t20bm-ab-escuro"), el("div", "t20bm-ab-faixa"), el("div", "t20bm-ab-onda"));

	const faiscas = el("div", "t20bm-ab-faiscas");
	for (let i = 0; i < FAISCAS; i++) {
		const f = el("span");
		f.style.setProperty("--x", `${Math.round((Math.random() * 2 - 1) * 320)}px`);
		f.style.setProperty("--sobe", `${-Math.round(90 + Math.random() * 200)}px`);
		f.style.setProperty("--atraso", `${Math.round(Math.random() * 1300)}ms`);
		f.style.setProperty("--tam", `${4 + Math.round(Math.random() * 4)}px`);
		faiscas.append(f);
	}
	const textos = el("div", "t20bm-ab-textos");
	textos.append(el("div", "t20bm-ab-titulo", texto));
	if (subtitulo) textos.append(el("div", "t20bm-ab-subtitulo", subtitulo));
	raiz.append(faiscas, textos);

	container.append(raiz);
	return new Promise((resolve) => setTimeout(() => {
		raiz.remove();
		resolve();
	}, duracao));
}
