# T20 — Batalha em Massa

Módulo do Foundry VTT (v14) para o sistema Tormenta20 (≥ 1.6.7): batalhas em massa da *Guerra Artoniana* (Apêndice B), independentes de cena: o mestre gerencia as batalhas e exibe uma para toda a mesa.

Uso pessoal: Tormenta20 e os textos dos livros são da Jambô Editora. Não compartilhe.

Spec e plano de tasks: `SDD/t20-batalha-em-massa/feature/spec.md`.

## Estado

- [x] T1 — Esqueleto do módulo
- [x] T2 — Gerenciador de batalhas (falta testar no Foundry)
- [x] T3 — Modelo de dados e regras puras
- [x] T4 — Configurador do mestre (falta testar no Foundry)
- [x] T5 — Tabela de inimigos (falta testar no Foundry)
- [x] T6 — Regras opcionais (falta testar no Foundry)
- [x] T7 — Modal da batalha (falta testar no Foundry)
- [x] T8 — Condução das etapas (falta testar no Foundry)
- [x] T9 — Posicionamento (falta testar no Foundry)
- [x] T10 — Evento (falta testar no Foundry)
- [x] T11 — Teste dos generais (falta testar no Foundry)
- [x] T12 — Fim da batalha (falta testar no Foundry)
- [ ] T13 — Robustez e entrega

## Instalação

Copie (ou crie um link simbólico de) esta pasta em `Data/modules/t20-batalha-em-massa` e ative o módulo num mundo Tormenta20.

## Testes

Regras e estado são funções puras, testadas em Node (sem Foundry):

```sh
node testes/regras.test.mjs
node testes/estado.test.mjs
node testes/configuracao.test.mjs
node testes/inimigos.test.mjs
node testes/visao.test.mjs
node testes/conducao.test.mjs
node testes/posicionamento.test.mjs
node testes/evento.test.mjs
node testes/generais.test.mjs
node testes/fim.test.mjs
node testes/areas.test.mjs
```
