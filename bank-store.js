/* Shared, dependency-free schema and browser-local question bank. */
(function(root){
  'use strict';
  const KEY='nis-lab-bank-v1', VERSION=1;
  const SUBJECT_IDS=['math','quant','science','kazakh','russian','english'];
  const RIGHTS=['original','permitted','link-only'];
  function fail(message){throw new Error(message)}
  function string(value,label,max,optional=false){
    if(optional&&value===undefined)return '';
    if(typeof value!=='string'||(!optional&&!value.trim())||value.length>max)fail(`${label}: требуется текст до ${max} символов`);
    return value.trim();
  }
  function safeUrl(value){
    const url=string(value,'Ссылка',2048,true);if(!url)return '';
    try{const parsed=new URL(url);if(!['https:','http:'].includes(parsed.protocol)||parsed.username||parsed.password)fail('Ссылка: разрешены только HTTP/HTTPS без пароля')}catch{fail('Некорректная HTTP/HTTPS ссылка')}
    return url;
  }
  function validateQuestion(raw){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))fail('Задание должно быть объектом');
    const id=string(raw.id,'ID',80);if(!/^custom-[a-zA-Z0-9_-]+$/.test(id))fail('ID должен начинаться с custom- и содержать латиницу, цифры, дефис или подчёркивание');
    if(!SUBJECT_IDS.includes(raw.subject))fail('Неизвестный предмет');
    if(!Array.isArray(raw.options)||raw.options.length!==4)fail('Нужны ровно четыре варианта ответа');
    const options=raw.options.map(x=>string(x,'Вариант ответа',2000));
    if(new Set(options.map(x=>x.toLocaleLowerCase())).size!==4)fail('Варианты ответа не должны повторяться');
    if(!Number.isInteger(raw.answer)||raw.answer<0||raw.answer>3)fail('Ответ должен быть целым индексом от 0 до 3');
    if(typeof raw.reviewed!=='boolean')fail('reviewed должен быть true или false');
    const source=raw.source;
    if(!source||typeof source!=='object'||!RIGHTS.includes(source.rights))fail('Укажите происхождение и права использования');
    if(source.rights==='link-only')fail('Материалы без разрешения добавляйте ссылкой в каталог, не копируйте в банк');
    const provenance={title:string(source.title,'Автор / источник',300),url:safeUrl(source.url),rights:source.rights,note:string(source.note,'Условия использования',2000,true)};
    if(source.rights==='permitted'&&(!provenance.url||!provenance.note))fail('Для внешнего материала нужны ссылка и условия разрешения / лицензия');
    const translations={};
    if(raw.translations!==undefined){if(!raw.translations||typeof raw.translations!=='object'||Array.isArray(raw.translations))fail('translations должен быть объектом');for(const [lang,t] of Object.entries(raw.translations)){if(!['kk','en'].includes(lang)||!t||typeof t!=='object')fail('Поддерживаются переводы kk/en');if(!Array.isArray(t.options)||t.options.length!==4)fail('Перевод: нужны четыре ответа');const options=t.options.map(x=>string(x,'Перевод ответа',2000));if(new Set(options.map(x=>x.toLocaleLowerCase())).size!==4)fail('Перевод: повтор вариантов ответа');translations[lang]={topic:string(t.topic,'Перевод темы',120),prompt:string(t.prompt,'Перевод условия',10000),passage:string(t.passage,'Перевод текста',20000,true),options,explanation:string(t.explanation,'Перевод объяснения',10000)};}}
    return {translations,id,subject:raw.subject,topic:string(raw.topic,'Тема',120),prompt:string(raw.prompt,'Условие',10000),passage:string(raw.passage,'Текст',20000,true),options,answer:raw.answer,explanation:string(raw.explanation,'Объяснение',10000),reviewed:raw.reviewed,source:provenance};
  }
  function validateDocument(raw){
    if(!raw||raw.schemaVersion!==VERSION||!Array.isArray(raw.questions))fail('Ожидается {schemaVersion: 1, questions: [...]}');
    if(raw.questions.length>2000)fail('Максимум 2000 заданий');
    const ids=new Set();return raw.questions.map((q,i)=>{try{const v=validateQuestion(q);if(ids.has(v.id))fail(`Повтор ID: ${v.id}`);ids.add(v.id);return v}catch(e){fail(`Задание ${i+1}: ${e.message}`)}});
  }
  function parse(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>5*1024*1024)fail('Максимальный размер JSON: 5 МБ');let raw;try{raw=JSON.parse(text)}catch{fail('Некорректный JSON: файл не изменён')}return validateDocument(raw)}
  function merge(current,incoming){const ids=new Set(current.map(q=>q.id));for(const q of incoming)if(ids.has(q.id))fail(`ID ${q.id} уже существует. Импорт отменён; измените ID или отредактируйте задание.`);if(current.length+incoming.length>2000)fail('Максимум 2000 заданий');return [...current,...incoming]}
  function read(storage){const raw=storage.getItem(KEY);return raw?parse(raw):[]}
  function write(storage,questions){const validated=validateDocument({schemaVersion:VERSION,questions});const serialized=JSON.stringify({schemaVersion:VERSION,questions:validated});parse(serialized);storage.setItem(KEY,serialized);return validated}
  function exported(questions){const text=JSON.stringify({schemaVersion:VERSION,questions:validateDocument({schemaVersion:VERSION,questions})});parse(text);return text}
  function localize(question,language){return question?.translations?.[language]?{...question,...question.translations[language]}:question}
  const api={localize,KEY,VERSION,SUBJECT_IDS,validateQuestion,validateDocument,parse,merge,read,write,exported,safeUrl};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;root.NISBank=api;
})(typeof window==='undefined'?globalThis:window);
