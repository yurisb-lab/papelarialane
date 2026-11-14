# Central de Criação Elane

Ateliê de papelaria da Elane, no PC ou no tablet: **bottons**, **marcadores**, cartões e **capas A5**, **temas e kits** para os pedidos, **miolo de caderno A5** com margem para wire-o e **kit de corte para a Silhouette Cameo**.

Feito a partir do motor do [Aplicativo da Lavínia](https://github.com/yurisb-lab/lavinia) (editor, folha A4, PDF, fichário, adesivos, tirar fundo), mas é um app separado: outro nome, outras cores e outro armazenamento no aparelho (nada se mistura com o da Lavínia).

## Formatos

| Formato | Tamanho | Observação |
| --- | --- | --- |
| **Botton 32 mm** | arte (corte) de 42 mm | máquina Mecolour |
| **Botton 44 mm** | arte (corte) de 54 mm | máquina Mecolour |
| **Botton 58 mm** | arte (corte) de 68 mm | máquina Mecolour |
| **Marcador** | 5 × 15 cm e 5 × 20 cm | furo para fitinha opcional (5 mm, a 8 mm do alto) |
| **Photo card**, **mini polaroid**, **cartão dobrável** | como no app da Lavínia | |
| **Capa A5** | 14,8 × 21 cm | capa flexível |
| **Capa dura A5** | 18,2 × 24,6 cm | 1,5 cm de sobra em volta para dobrar no papelão (linha verde no editor) |
| **Pôster A4** | 21 × 29,7 cm | |

**Bottons:** o papel é cortado maior que o botton, porque a sobra dobra por trás. No editor:

- a linha tracejada mostra o corte do papel;
- a linha verde, a borda do botton;
- o pontilhado verde, a área segura (textos e o mais importante ficam dentro dela).

A parte de fora da linha verde aparece mais clarinha, porque vai para trás do botton. As medidas da Mecolour ficam em `js/card.js` (`FORMATS`); se a máquina mudar, é só trocar ali.

## Folha A4

- Tudo vai para a mesma folha, misturado, para gastar menos papel.
- Bottons do mesmo tamanho ficam **encaixados como colmeia** quando isso cabe mais. Numa folha cabem 25 bottons de 32 mm, 13 de 44 mm ou 8 de 58 mm.
- Os bottons saem sempre com o círculo pontilhado do corte; o marcador com furo sai com o círculo do furo.
- **Fazer série** (embaixo do editor) tem duas opções:
  - **Com nomes:** cola a lista (um nome por linha) e sai uma peça igual para cada nome. Dá para escolher qual texto troca.
  - **Com fotos:** como no app da Lavínia.

### Silhouette Cameo (imprimir e cortar)

Na folha, marque **“Vou cortar na Silhouette”**. A folha deixa 2 cm livres em volta para as marcas de registro do Silhouette Studio, e o botão vira **Fazer kit para a Silhouette**. Para cada folha saem:

- `.svg`: a arte e as linhas de corte juntas, em A4. Abra no Silhouette Studio **Designer** (ou superior).
- `-arte.png` + `-corte.dxf`: para o Studio **Basic**. Ponha a arte em X 0, Y 0, com 210 × 297 mm, use **Mesclar** com o DXF e ponha as linhas na posição X/Y que o app mostra.

No Studio, escolha **A4**, ligue as **marcas de registro** no padrão, imprima pelo próprio Studio e corte. Antes da primeira tiragem, confira se o círculo do botton de 44 mm mede 54 mm.

Adesivos ainda não têm linha de corte no kit: no Studio, use **Traçar** neles.

## Temas e kits

- **Tema:** 5 cores (principal, destaque, fundo, texto, extra), letra dos títulos, letra dos textos, estampa do fundo e artes (escolhidas entre **Meus adesivos**).
  - Vêm 4 prontos (Terracota, Jardim, Céu, Festa). Ao editar um pronto, ele vira uma cópia sua.
- **Fazer kit:**
  - Escreva o nome da cliente, um texto menor (idade, data…), uma foto e/ou uma arte, e quantos de cada produto.
  - A prévia aparece na hora.
  - **Gerar kit e pôr na folha** cria tudo de uma vez, já na folha e numa **pasta do fichário** (ex.: “Kit Ana Clara”).
  - Cada peça abre no editor para ajustar.
- No editor, a aba **Modelos** também tem **Aplicar as cores de um tema** em qualquer design.

## Cadernos A5 (wire-o)

- O miolo é montado em **seções**: pautado, pontilhado, quadriculado, liso, lista de tarefas ou semana sem data. Cada seção tem o seu número de folhas.
- Ajustes:
  - margem do wire-o (12 mm no começo);
  - distância das linhas do pautado;
  - cor das linhas (ou as cores de um tema);
  - linha de data;
  - número das páginas.
- **Gerar PDF do miolo:** A4 em pé, **frente e verso virando pela borda longa**. Cada A4 leva 2 folhas A5.
  - Corte ao meio na altura das marquinhas.
  - O lado com a margem maior é o do wire-o (Mimo Binding).
  - As linhas são vetor, então o PDF fica leve.
- A capa é feita no editor (formato **Capa A5** ou **Capa dura A5**).

## PDF

Ferramentas de PDF trazidas do [Conversor de Tudo](https://github.com/yurisb-lab/conversordetudo) (as mais usadas). Tudo roda no aparelho: nenhum arquivo vai para a internet, e funciona sem internet depois da primeira visita.

- **Extrair páginas:** toque nas miniaturas (ou escreva `1-3, 5, 8-`) e saia só com elas, num PDF ou uma por arquivo. No computador, Shift escolhe várias de uma vez.
- **PDF em imagem:** PNG ou JPG em tela, boa ou impressão (300 dpi). Cada imagem pode ir direto para **Meus adesivos** e virar arte no editor.
- **Imagem em PDF:** A4, A5, Carta ou igual à imagem; em pé, deitada ou automática; com ou sem margem.
- **Juntar PDFs:** PDFs e imagens na ordem escolhida, com opção de página em branco para frente e verso.
- **Dividir PDF:** cada página, a cada N páginas, ao meio ou por intervalos.
- **Apagar páginas** e **Girar páginas** (todas ou só as escolhidas).
- **Comprimir:** leve, recomendada, forte (as páginas viram imagem) ou sem perder nada; se não ficar menor, devolve o original.

Vários arquivos de uma vez saem num `.zip`. O botão **Usar em outra ferramenta** abre o resultado direto na próxima ferramenta (ex.: juntar e depois comprimir).

Bibliotecas em `vendor/` (carregadas só quando a tela de PDF é usada): pdf-lib 2.11.1 (@cantoo), pdf.js 3.11.174 e JSZip 3.10.1.

## Como usar

É um site estático: não precisa instalar nada nem compilar.

**GitHub Pages:** no repositório, vá em *Settings → Pages*, em *Build and deployment* escolha *Deploy from a branch*, selecione `main` e a pasta `/ (root)` e salve. Em alguns minutos o endereço aparece nessa mesma página.

No tablet, abra o endereço e use “Adicionar à tela de início”: a Central ganha ícone próprio e funciona sem internet.

Para testar no computador: nesta pasta, rode `python3 -m http.server` e abra `http://localhost:8000`.

## Nuvem (sem prazo)

A Central usa o **mesmo banco do app da Lavínia** (Supabase, projeto `lavinia`; endereço e chave pública em `js/cloud-config.js`).
Cada peça posta na folha (ou salva) ganha uma cópia na nuvem, e a seção **Guardados na nuvem** traz de volta.

- **Sem prazo:** as peças da Central ficam marcadas com `app = 'elane'` e a limpeza diária de 30 dias não mexe nelas. Só saem da nuvem quando a Elane **apaga de vez no fichário** (o "Desfazer" logo depois devolve). Tirar da folha não apaga da nuvem.
- Sem internet, o envio e a exclusão ficam numa fila e acontecem quando a internet voltar.
- Os dados **não se misturam** com os da Lavínia: cada app guarda a conta anônima no próprio armazenamento do aparelho, e as regras do banco só deixam cada conta ver os próprios cards.
- A **Minha turma** continua só no app da Lavínia (o banco dela não aceita bottons, capas nem marcadores de 20 cm nos posts).
- Para desligar a nuvem, deixe `url` vazio em `js/cloud-config.js`.

## Código (o que é novo em relação ao app da Lavínia)

```
js/card.js            formatos novos (bottons Mecolour, marcadores, capas A5) e furo do marcador
js/editor.js          linhas de ajuda: borda do botton, área segura, borda do papelão, furo
js/pdf.js             folha com bottons em colmeia, linhas de corte e modo Silhouette
js/silhouette.js      kit da Silhouette: SVG (arte + corte), PNG e DXF
js/themes.js          temas (guardar, aplicar) e montagem dos kits
js/notebook.js        páginas do miolo A5 e PDF frente e verso para wire-o
js/views/themes.js    tela Temas e kits
js/views/notebooks.js tela Cadernos A5
js/views/home.js      início da Central
js/templates.js       modelos de botton e de capa
js/pdftools.js        ferramentas de PDF (extrair, dividir, juntar, girar, comprimir, PDF ↔ imagem)
js/views/pdf.js       tela PDF
```

**Ao publicar mudanças:** aumente `VERSION` em `sw.js` para os aparelhos baixarem a versão nova.

## Próximos passos (fase 4 e 5)

- **Agenda A5 com datas:** escolher o ano e as datas saírem sozinhas, com feriados.
- **Pedidos:** cliente, prazo, etapa e prévia para aprovação.
- **Calculadora de preço.**
- **Prévia realista do botton.**
- **Linha de corte dos adesivos** no kit da Silhouette.
