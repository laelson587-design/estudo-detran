/* Service worker do estudo dirigido.
 *
 * Tem duas razões de existir, nessa ordem:
 *
 * 1. O plano é para estudar no celular, e boa parte disso acontece longe do
 *    wi-fi. Uma vez aberto, o dia inteiro fica guardado e abre sem internet.
 * 2. Sem service worker o Chrome do Android não instala de verdade: o
 *    "Adicionar à tela de início" vira um atalho que reabre o navegador, com
 *    barra de endereço e tudo. Com ele, abre como app.
 *
 * Serve do cache e busca a versão nova por trás, guardando para a próxima
 * abertura ("stale-while-revalidate"). Cache puro obrigaria a lembrar de subir
 * a VERSAO a cada mudança, e esquecer disso deixa a tela velha e imune até ao
 * Ctrl+F5.
 *
 * Suba a VERSAO quando quiser forçar a limpeza imediata de todo mundo.
 */

const VERSAO = "detran-v1";

const CASCA = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icone-192.png",
  "./icone-512.png",
];

/* As fontes moram no Google. Não entram no install — se estiver offline na
   primeira abertura, o install inteiro falharia por causa delas. Entram pelo
   fetch, na primeira vez que a página as pedir. */
const FONTES = ["https://fonts.googleapis.com", "https://fonts.gstatic.com"];

self.addEventListener("install", (ev) => {
  ev.waitUntil(
    caches.open(VERSAO)
      .then((c) => c.addAll(CASCA))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(
        nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (ev) => {
  const pedido = ev.request;
  if (pedido.method !== "GET") return;

  const url = new URL(pedido.url);
  const nosso = url.origin === self.location.origin || FONTES.includes(url.origin);
  if (!nosso) return;

  ev.respondWith(
    caches.open(VERSAO).then(async (cache) => {
      const guardado = await cache.match(pedido, { ignoreSearch: true });

      const rede = fetch(pedido)
        .then((resposta) => {
          if (resposta && resposta.ok) cache.put(pedido, resposta.clone());
          return resposta;
        })
        .catch(() => null);

      // Tem no cache? Entrega já e atualiza por trás.
      if (guardado) { ev.waitUntil(rede); return guardado; }

      const daRede = await rede;
      if (daRede) return daRede;

      // Sem cache e sem rede: se for navegação, devolve a página inteira.
      if (pedido.mode === "navigate") {
        const inicial = await cache.match("./index.html");
        if (inicial) return inicial;
      }
      return new Response("Sem conexão.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    })
  );
});
