// Nuvem: usa o mesmo projeto do Supabase do app da Lavínia (projeto "lavinia").
// Os dados não se misturam: cada app guarda a conta anônima no próprio armazenamento do aparelho
// (central-elane × app-da-lavinia), então cada um tem a sua conta e as regras do banco
// só deixam cada conta ver os próprios cards. Para desligar a nuvem, deixe url vazio.
// A chave "publishable" pode ficar no código: quem protege os dados são as regras do banco.

export const CLOUD = {
  url: 'https://ktbkvewvufcwouvefhzs.supabase.co',
  key: 'sb_publishable_bV2E8NyPZB4QEhjEys3q0w_nwozfZBF',
};
