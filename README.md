# Sítio São Jorge - Gestão de Aluguel

Base inicial do aplicativo web para gestão de aluguel do Sítio São Jorge.

## Estrutura

- `index.html`: ponto de entrada da aplicação.
- `src/styles/main.css`: estilos globais, layout e responsividade.
- `src/js/app.js`: inicialização da interface.
- `src/js/layout`: componentes principais do layout.
- `src/js/pages`: paginas/telas do sistema.
- `src/js/data/navigation.js`: configuração central das abas do menu.

## Como abrir

Por ser uma base sem dependencias, pode ser aberta diretamente pelo `index.html`.
Para testar com um servidor local:

```powershell
python -m http.server 5173
```

Depois acesse `http://localhost:5173`.

## Como adicionar uma nova aba

1. Crie o componente da pagina em `src/js/pages`.
2. Registre a pagina em `src/js/pages/pageRegistry.js`.
3. Adicione o item no menu em `src/js/data/navigation.js`.

Essa separação permite evoluir o sistema aba por aba sem misturar layout,
navegação e regras de negócio.
