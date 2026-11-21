/**
 * Tabelas do Apêndice B (Guerra Artoniana, pp. 370–375). Sem Foundry: testável em Node.
 * Chaves de perícia = chaves do sistema Tormenta20 (T20.pericias, module/config/T20.js).
 */

/** Tabela B-1: tamanho da batalha → CD dos testes de perícia dos eventos e dano para cada +1 de bônus. */
export const TAMANHOS = {
	escaramuca: { nome: "Escaramuça", combatentes: "Até 250", cd: 20, dano: 20, limiarVariado: 5 },
	pequena: { nome: "Batalha pequena", combatentes: "De 251 a 1.000", cd: 25, dano: 50, limiarVariado: 8 },
	media: { nome: "Batalha média", combatentes: "De 1.001 a 5.000", cd: 30, dano: 50, limiarVariado: 10 },
	grande: { nome: "Batalha grande", combatentes: "De 5.001 a 20.000", cd: 35, dano: 50, limiarVariado: 15 },
	epica: { nome: "Batalha épica", combatentes: "Mais de 20.000", cd: 40, dano: 100, limiarVariado: 20 }
};

/** Pontos de vitória para vencer sem a regra opcional "Limiar de vitória variado". */
export const LIMIAR_PADRAO = 10;

/** Vantagem (em pontos de vitória) no fim de uma rodada que faz o exército em desvantagem começar a fugir. */
export const VANTAGEM_FUGA = 5;

/**
 * Tabela B-2: modificadores de Guerra. `variavel`: o mestre ajusta o valor (Tropas motivadas: "+1 ou mais").
 * O configurador também aceita modificadores personalizados (chave "personalizado").
 */
export const MODIFICADORES_GUERRA = [
	{ chave: "numerica50", nome: "Superioridade numérica", detalhe: "50% a mais de soldados", valor: 2 },
	{ chave: "numerica2x", nome: "Superioridade numérica", detalhe: "o dobro de soldados", valor: 5 },
	{ chave: "numerica3x", nome: "Superioridade numérica", detalhe: "o triplo de soldados ou mais", valor: 10 },
	{ chave: "qualidade2", nome: "Tropas de melhor qualidade", detalhe: "como soldados treinados contra plebeus", valor: 2 },
	{ chave: "qualidade5", nome: "Tropas de melhor qualidade", detalhe: "como o exército Purista contra plebeus", valor: 5 },
	{ chave: "qualidade10", nome: "Tropas de melhor qualidade", detalhe: "como gigantes contra plebeus", valor: 10 },
	{ chave: "terreno", nome: "Terreno favorável", detalhe: "venceu o teste oposto de Sobrevivência", valor: 2 },
	{ chave: "motivadas", nome: "Tropas motivadas", detalhe: "teste de Atuação contra CD 20", valor: 1, variavel: true },
	{ chave: "desmotivadas", nome: "Tropas desmotivadas", detalhe: "falhou por 5 ou mais no teste de Atuação", valor: -2 },
	{ chave: "terraNatal", nome: "Defendendo a terra natal", detalhe: "apenas em batalhas realmente importantes", valor: 2 },
	{ chave: "personalidade", nome: "Personalidade presente", detalhe: "regente, herói lendário, sumo-sacerdote etc.", valor: 2 }
];

/** Posições no campo de batalha (Tab. B-5), na ordem das 4 áreas do tabuleiro. Heróis começam na Retaguarda. */
export const POSICOES = [
	{ chave: "acampamento", nome: "Acampamento", mod: -10 },
	{ chave: "retaguarda", nome: "Retaguarda", mod: 0 },
	{ chave: "front", nome: "Front", mod: 5 },
	{ chave: "atras", nome: "Atrás das linhas inimigas", mod: 10 }
];
export const AREA_INICIAL = 1;

/** Etapas de cada rodada, na ordem do layout. Antes do Turno 1 a batalha está na etapa "pre" (terreno, motivação). */
export const ETAPA_PRE = "pre";
export const ETAPAS = [
	{ chave: "preparacao", nome: "Preparação" },
	{ chave: "posicionamento", nome: "Posicionamento" },
	{ chave: "evento", nome: "Evento" },
	{ chave: "generais", nome: "Teste dos Generais" }
];

/** Bônus no teste de Guerra por um teste de perícia bem-sucedido num evento, e por herói segurando estandarte. */
export const BONUS_TESTE_PERICIA = 2;
export const BONUS_ESTANDARTE = 2;

/** Mecânicas usadas para resolver os eventos ("Resolvendo os Eventos", pp. 373–374). */
export const MECANICAS = {
	semTeste: {
		nome: "Sem teste",
		texto: "Os heróis não precisam realizar nenhum tipo de teste nesse evento, apenas fazer escolhas determinadas pelo evento."
	},
	testePericia: {
		nome: "Teste de perícia",
		texto: "Um personagem à escolha do grupo faz um teste de perícia (indicada na descrição do evento). Se passar, fornece +2 para o teste de Guerra de seu general neste turno de batalha. Os personagens que não fizerem o teste podem usar perícias para ajudar ou qualquer habilidade que possam ativar para auxiliar o personagem que está agindo."
	},
	atacar: {
		nome: "Atacar",
		combate: true,
		texto: "Cada herói tem uma rodada de combate para atacar. Se acertar, causa dano — todo o dano causado pelo grupo deve ser somado; quanto maior o dano, maior o bônus que o grupo irá fornecer para o teste de Guerra de seu general neste turno de batalha. Para cada ataque que errar, entretanto, o herói sofre dano do inimigo, como se tivesse sido atingido por um ataque ou habilidade daquela criatura."
	},
	atacarContraDois: {
		nome: "Atacar contra dois",
		combate: true,
		multiplicadorDanoRecebido: 2,
		texto: "Como atacar, mas cada herói que sofrer dano de um inimigo sofre dano dobrado."
	},
	defender: {
		nome: "Defender",
		combate: true,
		texto: "Como atacar, mas os papéis são invertidos. Aqui, são os inimigos que fazem ataques e usam suas habilidades (e heróis que se defendem). Se um ataque contra um herói errar, ou se o herói passar no teste de resistência contra o efeito que o inimigo está usando, ele causa todo o dano que causaria em uma rodada de combate. Como em atacar, esse dano é somado para determinar o bônus que o general do exército dos heróis recebe nesta rodada de batalha."
	},
	defenderContraDois: {
		nome: "Defender contra dois",
		combate: true,
		multiplicadorDanoRecebido: 2,
		texto: "Como defender, mas cada inimigo causa o dobro de dano."
	},
	atacarETeste: {
		nome: "Atacar e teste de perícia",
		combate: true,
		testePericia: true,
		texto: "Como atacar, mas um dos personagens, à escolha do grupo, pode fazer um teste de perícia (indicada na descrição do evento). Se passar, fornece +2 para o teste de Guerra de seu general neste turno de batalha. Este bônus é cumulativo com quaisquer bônus por dano que os personagens consigam."
	},
	combateNormal: {
		nome: "Combate normal",
		combate: true,
		texto: "Resolvido com as regras normais de combate."
	}
};

/**
 * Tabela B-5: eventos de batalha (d20 + modificador da posição). Textos de "Descrição dos Eventos" (pp. 372–373).
 * `min`/`max` inclusivos; null = sem limite. `pericias`: chaves do sistema para o teste de perícia do evento.
 */
export const EVENTOS = [
	{
		chave: "curandeiro", nome: "Curandeiro", min: null, max: 2, mecanica: "semTeste",
		texto: "O grupo encontra um destacamento de curandeiros aliados e recebe cuidados. Cada personagem recupera 1d8+1 PV e 1 PM por patamar (por exemplo, um personagem veterano recupera 2d8+2 PV e 2 PM)."
	},
	{
		chave: "levarOrdens", nome: "Levar ordens", min: 3, max: 4, mecanica: "testePericia",
		pericias: ["atle", "cava", "pilo"],
		texto: "O grupo precisa levar ordens para uma unidade. Teste de Atletismo (ou Cavalgar, se o herói estiver montado, ou Pilotagem, se estiver em um veículo)."
	},
	{
		chave: "erguerEstandarte", nome: "Erguer estandarte", min: 5, max: 6, mecanica: "semTeste", estandarte: "erguer",
		texto: "Um estandarte aliado está caído! Um herói pode erguê-lo e segurá-lo. Um herói segurando um estandarte fornece um bônus de +2 nos testes do general, mas torna-se um alvo — em eventos subsequentes, ataques contra ele recebem um bônus de +5 e a CD de efeitos de inimigos contra ele aumenta em +5."
	},
	{
		chave: "manterPosicao", nome: "Manter posição", min: 7, max: 10, mecanica: "defender",
		texto: "Os heróis precisam defender um ponto estratégico."
	},
	{
		chave: "quebrarFormacao", nome: "Quebrar formação", min: 11, max: 14, mecanica: "atacarContraDois",
		texto: "Os heróis precisam atacar uma formação inimiga."
	},
	{
		chave: "aliadoFerido", nome: "Resgatar aliado ferido", min: 15, max: 16, mecanica: "atacarETeste",
		pericias: ["cura"],
		texto: "O grupo encontra um aliado importante, como um oficial, caído, ferido e cercado por inimigos. Um dos heróis pode, em vez de atacar, tentar curar o aliado. Atacar e teste de Cura."
	},
	{
		chave: "interceptarOrdens", nome: "Interceptar ordens", min: 17, max: 18, mecanica: "atacarETeste",
		pericias: ["acro", "atle", "cava", "pilo"],
		texto: "O grupo encontra um mensageiro inimigo levando ordens para tropas. Um dos heróis pode, em vez de atacar, tentar alcançar o mensageiro e impedir que ele entregue as ordens. Atacar e teste de Acrobacia, Atletismo, Cavalgar ou Pilotagem."
	},
	{
		chave: "servirDeIsca", nome: "Servir de isca", min: 19, max: 20, mecanica: "defenderContraDois",
		texto: "O grupo precisa atrair inimigos para uma posição específica."
	},
	{
		chave: "ataqueLivre", nome: "Ataque livre", min: 21, max: 22, mecanica: "atacar", ataqueLivre: true,
		texto: "O grupo se aproxima de um oficial inimigo, dando a um dos personagens, à escolha do grupo, uma oportunidade de atacá-lo. O personagem escolhido ataca o \"líder\" do grupo (Defesa +5, causa dano dobrado). Todo dano causado no líder é dobrado para calcular o bônus de Guerra desta rodada."
	},
	{
		chave: "capturarEstandarte", nome: "Capturar estandarte", min: 23, max: 24, mecanica: "atacarContraDois", estandarte: "capturar",
		texto: "O grupo se aproxima de um estandarte inimigo. Atacar contra dois. Após os ataques, um dos heróis pode capturar o estandarte. Um herói segurando um estandarte fornece um bônus de +2 nos testes do general, mas torna-se um alvo — em eventos subsequentes, ataques contra ele recebem um bônus de +5 e a CD de efeitos de inimigos contra ele aumenta em +5."
	},
	{
		chave: "enfrentarCapitao", nome: "Enfrentar capitão", min: 25, max: 28, mecanica: "atacarContraDois", capitao: true,
		texto: "O grupo se aproxima de um oficial inimigo e seus guarda-costas. Atacar contra dois. Um dos personagens, escolhido pelo mestre, também é atacado pelo oficial (o dano que o oficial causar é subtraído do dano dos heróis para calcular o bônus de Guerra fornecido). Caso os personagens causem dano suficiente para fornecer um bônus de pelo menos +2 ao teste de Guerra de seu general, o bônus aumenta em +2."
	},
	{
		chave: "enfrentarGeneral", nome: "Enfrentar general", min: 29, max: null, mecanica: "combateNormal", general: true,
		texto: "Os heróis se aproximam do general inimigo. Este evento deve ser resolvido com as regras normais de combate. O mestre posiciona o grupo em alcance curto do general, que estará acompanhado por guarda-costas — dois inimigos da tabela do exército inimigo para cada personagem. Se o grupo derrotar o general, seu exército ganha 1d4+1 pontos de vitória. Um oficial assume como general do exército inimigo. Seu bônus de Guerra é por padrão igual ao do general anterior −1d6−1 (de −2 a −7), a menos que indicado outro valor no texto de uma aventura."
	}
];

/** Recompensas e penalidades fixas do texto. */
export const PONTOS_DERROTAR_GENERAL = "1d4+1";
export const PENALIDADE_NOVO_GENERAL = "1d6+1"; // subtraída do bônus de Guerra do general anterior

/** Motivação: teste de Atuação do general contra esta CD. */
export const CD_MOTIVACAO = 20;

/** Regras opcionais (p. 375). */
export const OPCIONAIS = {
	acoesAbertas: {
		nome: "Ações abertas",
		texto: "Em vez de rolar eventos, o mestre pode permitir que os jogadores descrevam as ações de seus personagens, usando mecânicas similares aos eventos para resolvê-las — ou alternar entre rodadas com eventos e rodadas com ações livres, ou, ainda, permitir ações abertas caso o grupo passe num teste de Posicionamento Avançado. Ações mais relevantes devem exigir que o herói esteja numa posição mais avançada — e posições avançadas devem acarretar maiores riscos!"
	},
	posicionamentoAvancado: {
		nome: "Posicionamento avançado",
		texto: "No início da etapa dos eventos, um personagem do grupo pode fazer um teste de Guerra contra a CD da batalha. Se passar, pode somar +/–2 à rolagem de evento, a sua escolha — ou destravar a possibilidade de uma ação aberta. A critério do mestre, outras perícias podem ser usadas, desde que o jogador consiga justificar seu uso. Porém, perícias que não sejam Guerra só podem ser usadas uma vez durante a batalha."
	},
	lobosSolitarios: {
		nome: "Lobos solitários",
		texto: "Por padrão, os personagens agem juntos — a cada rodada, devem estar na mesma posição da batalha e enfrentam o mesmo evento. Com esta variante, cada herói pode ficar numa posição diferente, e heróis em posições diferentes enfrentam eventos variados."
	},
	limiarVariado: {
		nome: "Limiar de vitória variado",
		texto: "A quantidade de pontos de vitória para vencer a batalha pode variar conforme o tamanho dela: 5 pontos para uma escaramuça, 8 para uma batalha pequena, 10 para uma média, 15 para uma grande e 20 para uma batalha épica."
	},
	danoMedio: {
		nome: "Dano médio",
		texto: "Para diminuir a quantidade de rolagens e acelerar a batalha, você pode substituir todas as rolagens de dano pelo dano médio dos ataques e efeitos: a média baixa de cada dado (2 para 1d4, 3 para 1d6, 4 para 1d8…). No crítico, o valor máximo de cada dado multiplicado (críticos x2) ou 1,5 vezes o valor máximo (críticos x3)."
	},
	rolandoPelosGenerais: {
		nome: "Rolando pelos generais",
		texto: "Mesmo que o general aliado seja um NPC, deixe os jogadores rolarem o teste de Guerra por ele, revezando-se para que todos participem."
	}
};

/** Lembrete da etapa Preparação (caixa "Duração de Efeitos", p. 375). */
export const TEXTO_PREPARACAO = "Cada personagem tem o equivalente a 1 rodada de combate para usar habilidades e ativar itens. Cada rodada de batalha equivale a 30 minutos, ou uma cena: efeitos com duração de cena se aplicam apenas a uma rodada; efeitos com duração menor não afetam a rodada. Usar um efeito que afete um único teste de perícia de evento ou de Guerra custa +1 PM (aplicado após todas as reduções de custo).";
