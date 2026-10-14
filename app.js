/* NIS Lab: локальное адаптивное обучение без сервера и внешнего AI API. */
(()=>{
  'use strict';
  const STORAGE_KEY='nis-lab-v1';
  const ACTIVE_KEY='nis-lab-active-v1';
  let bankLoadError=false;
  let customQuestions=[];
  try{customQuestions=NISBank.read(localStorage)}catch{bankLoadError=true}
  const allQuestions=[...QUESTION_BANK,...customQuestions];
  const app=document.getElementById('app');
  const modal=document.getElementById('modal-layer');
  const now=()=>Date.now();
  const uid=()=>`p-${Math.random().toString(36).slice(2,10)}`;
  const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate=t=>new Date(t).toLocaleDateString('ru-RU',{day:'numeric',month:'long'});
  const fmtToday=()=>new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long',weekday:'long'});
  function load(key,fallback){try{const v=JSON.parse(localStorage.getItem(key));return v??fallback}catch{return fallback}}
  function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}catch{setTimeout(()=>toast('Не удалось сохранить прогресс. Экспортируйте данные: хранилище недоступно или заполнено.'),0)}}
  function saveSession(){try{if(session)localStorage.setItem(ACTIVE_KEY,JSON.stringify(session));else localStorage.removeItem(ACTIVE_KEY)}catch{setTimeout(()=>toast('Сессия не сохранена: после закрытия страницы продолжить её не получится.'),0)}}
  let state=load(STORAGE_KEY,null);
  if(!state||!Array.isArray(state.profiles)||!state.profiles.length){const id=uid();state={profiles:[{id,name:'Ученик',createdAt:now(),attempts:[]}],current:id};save()}
  let route='home';
  let subjectFilter='all';
  let session=load(ACTIVE_KEY,null);
  let tick=null;
  if(session&&(!Array.isArray(session.ids)||!state.profiles.some(p=>p.id===session.profileId)))session=null;
  const profile=()=>state.profiles.find(p=>p.id===state.current)||state.profiles[0];
  let questionLanguage='ru';
  try{const stored=localStorage.getItem('nis-lab-question-language');if(['ru','kk','en'].includes(stored))questionLanguage=stored}catch{}
  const question=id=>NISBank.localize(allQuestions.find(q=>q.id===id),questionLanguage);
  document.getElementById('question-language').value=questionLanguage;
  document.getElementById('question-language').addEventListener('change',e=>{questionLanguage=e.target.value;try{localStorage.setItem('nis-lab-question-language',questionLanguage)}catch{}render();toast('Перевод показан, где доступен. Остальные задания — на исходном языке.');});
  const eligible=id=>{const q=question(id);return q&&(!q.id.startsWith('custom-')||q.reviewed)};
  if(session&&session.ids.some(id=>!question(id)||(!session.result&&!eligible(id)))){session=null;saveSession()}

  const subject=id=>SUBJECTS.find(s=>s.id===id);
  const lastAttemptFor=id=>{const a=profile().attempts.filter(x=>x.id===id);return a[a.length-1]};
  function stats(){
    const all=profile().attempts,by={};
    for(const s of SUBJECTS){const xs=all.filter(a=>a.subject===s.id);by[s.id]={count:xs.length,correct:xs.filter(a=>a.correct).length,percent:xs.length?Math.round(xs.filter(a=>a.correct).length/xs.length*100):0}}
    const sessions=all.filter(a=>a.lastInSession).length;
    return {all,by,sessions,correct:all.filter(a=>a.correct).length,percent:all.length?Math.round(all.filter(a=>a.correct).length/all.length*100):0};
  }
  function uniqueDays(){return new Set(profile().attempts.map(a=>new Date(a.time).toDateString())).size}
  function weakTopics(){
    const map={};
    for(const a of profile().attempts){const k=`${a.subject}::${a.topic}`;if(!map[k])map[k]={subject:a.subject,topic:a.topic,total:0,correct:0};map[k].total++;map[k].correct+=a.correct?1:0}
    return Object.values(map).filter(x=>x.total>=1).sort((a,b)=>(a.correct/a.total)-(b.correct/b.total)||b.total-a.total);
  }
  function getPriority(){
    const st=stats();return [...SUBJECTS].sort((a,b)=>{
      const as=st.by[a.id],bs=st.by[b.id];
      const av=as.count?as.percent:0,bv=bs.count?bs.percent:0;
      return av-bv||as.count-bs.count;
    });
  }
  function chooseQuestions(sub,count,mode='practice'){
    if(sub==='all'){
      const base=Math.floor(count/SUBJECTS.length),extra=count%SUBJECTS.length;
      const lists=SUBJECTS.map((s,i)=>chooseQuestions(s.id,base+(i<extra?1:0),mode));
      const mixed=[];
      for(let i=0;i<Math.ceil(count/SUBJECTS.length);i++)for(const list of lists)if(list[i])mixed.push(list[i]);
      return mixed;
    }
    const pool=allQuestions.filter(q=>(!q.id.startsWith('custom-')||q.reviewed)&&(sub==='all'||q.subject===sub));
    const weak=new Set(weakTopics().filter(x=>x.correct<x.total).map(x=>`${x.subject}::${x.topic}`));
    const ordered=[...pool].sort((a,b)=>{
      const aa=profile().attempts.filter(x=>x.id===a.id),bb=profile().attempts.filter(x=>x.id===b.id);
      const score=q=>{
        const attempts=q===a?aa:bb;
        const last=attempts[attempts.length-1];
        if(!last)return -5;
        if(!last.correct)return -2+(last.time/1e14);
        return attempts.length+last.time/1e14;
      };
      if(mode==='practice'&&weak.has(`${a.subject}::${a.topic}`)!==weak.has(`${b.subject}::${b.topic}`))return weak.has(`${a.subject}::${a.topic}`)?-1:1;
      return score(a)-score(b);
    });
    return ordered.slice(0,count).map(q=>q.id);
  }
  function diagnosticIds(){return SUBJECTS.flatMap(s=>chooseQuestions(s.id,3,'diagnostic'))}
  function mockIds(){return SUBJECTS.flatMap(s=>chooseQuestions(s.id,4,'mock'))}
  function startSession(mode,sub='all'){
    const ids=mode==='diagnostic'?diagnosticIds():mode==='mock'?mockIds():mode==='review'?profile().attempts.filter(a=>!a.correct&&eligible(a.id)).map(a=>a.id).filter((v,i,x)=>x.indexOf(v)===i).slice(0,12):chooseQuestions(sub,sub==='all'?12:8);
    if(!ids.length){toast('Пока нет ошибок для повторения');return}
    session={mode,subject:sub,ids,index:0,answers:[],profileId:profile().id,startedAt:now(),deadline:mode==='mock'?now()+25*60*1000:null,reveal:false,selected:null};
    saveSession();route='session';render();window.scrollTo(0,0)
  }
  function finishSession(){
    if(!session)return;
    const p=profile(),stamp=now();
    session.answers.forEach((selected,i)=>{
      const q=question(session.ids[i]);if(!q)return;
      p.attempts.push({id:q.id,subject:q.subject,topic:allQuestions.find(item=>item.id===q.id).topic,selected,correct:selected===q.answer,mode:session.mode,time:stamp,lastInSession:i===session.answers.length-1});
    });
    if(p.attempts.length>5000)p.attempts=p.attempts.slice(-5000);
    save();session.result=true;session.index=session.ids.length;saveSession();render();window.scrollTo(0,0)
  }
  function answer(index){
    if(!session||session.result||session.reveal||session.selected!==null)return;
    session.selected=index;
    if(session.mode==='practice'||session.mode==='review')session.reveal=true;
    saveSession();render()
  }
  function nextQuestion(){
    if(!session||session.selected===null)return toast('Выберите ответ');
    session.answers.push(session.selected);session.index++;
    if(session.index>=session.ids.length){finishSession();return}
    session.selected=null;session.reveal=false;saveSession();render();window.scrollTo(0,0)
  }
  function quitSession(){session=null;saveSession();route='home';render()}
  function navigate(to){if(route==='session'&&session&&!session.result&&to!=='session'){if(!confirm('Прервать тренировку? Текущие ответы не сохранятся.'))return;session=null;saveSession()}route=to;render();window.scrollTo(0,0)}
  function updateHeader(){const p=profile();document.getElementById('topbar-date').textContent=fmtToday();document.getElementById('profile-name').textContent=p.name;document.getElementById('profile-avatar').textContent=p.name.trim().slice(0,1).toUpperCase()||'У';document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.route===route))}
  function pageHead(kicker,title,sub='',action=''){return `<div class="page-head"><div><p class="page-kicker">${kicker}</p><h1>${title}</h1>${sub?`<p class="subhead">${sub}</p>`:''}</div>${action}</div>`}
  function subjectCard(s){const x=stats().by[s.id];return `<button class="subject-card" data-start="practice" data-subject="${s.id}" style="text-align:left;color:inherit"><div class="subject-top"><span class="subject-icon ${s.color}">${s.icon}</span><span class="subject-arrow">↗</span></div><h3>${s.name}</h3><span class="mini">${x.count?`${x.count} ответов`:'Начните с тренировки'}</span><div class="progress-line"><span style="width:${x.percent}%"></span></div><div class="subject-bottom"><span>Точность</span><strong>${x.count?`${x.percent}%`:'—'}</strong></div></button>`}
  function home(){const p=profile(),st=stats(),recent=[...st.all].reverse().slice(0,3);const focus=weakTopics().filter(x=>x.correct<x.total).slice(0,3);return `${pageHead('ВАША УЧЕБНАЯ СТУДИЯ',`Привет, ${safe(p.name)}! 👋`,'Сегодня можно стать на шаг ближе к цели.')}
    <div class="dashboard-grid"><section class="hero-card"><div class="hero-content"><span class="hero-label"><span>✦</span> ПЕРСОНАЛЬНЫЙ МАРШРУТ</span><h2>${st.all.length?'Продолжим с того, что стоит повторить.':'Начнём с короткой диагностики?'}</h2><p>${st.all.length?'Подберём задания по вашим ответам и покажем, какие темы уже стали сильнее.':'18 вопросов помогут увидеть отправную точку по всем шести направлениям.'}</p><button class="primary-btn hero-btn" data-start="${st.all.length?'practice':'diagnostic'}" data-subject="all">${st.all.length?'Продолжить тренировку':'Пройти диагностику'} <span>→</span></button></div><div class="hero-art" aria-hidden="true"><div class="planet"></div><div class="orbit"></div><span class="star-a">✦</span><span class="star-b">✦</span></div></section>
    <section class="stats-card"><div class="card-top"><h3>Ваш прогресс</h3><span class="soft-icon">↗</span></div><div class="progress-main"><div class="ring" style="--value:${st.percent}"><strong>${st.all.length?`${st.percent}%`:'—'}</strong></div><div class="progress-copy"><strong>${st.all.length?'Хорошее начало!':'Всё впереди'}</strong><span>${st.all.length?'Точность ответов во всех тренировках.':'После первой тренировки здесь появится ваша статистика.'}</span></div></div><div class="tiny-rule"></div><div class="stat-row"><div><strong>${st.all.length}</strong><span>заданий решено</span></div><div><strong>${uniqueDays()}</strong><span>дней практики</span></div></div></section></div>
    <div class="section-row"><div><h2 class="section-title">Направления подготовки</h2><p>Выберите предмет и начните короткую тренировку</p></div><button class="text-action" data-route="plan">Посмотреть план →</button></div><div class="subject-grid">${SUBJECTS.map(subjectCard).join('')}</div>
    <div class="bottom-grid"><section class="panel"><div class="card-top"><h3>Последние занятия</h3><button class="text-action" data-route="parents">Вся статистика →</button></div>${recent.length?`<div class="activity-list">${recent.map(a=>`<div class="activity-row"><span class="activity-dot">${subject(a.subject).icon}</span><div><strong>${safe(a.topic)}</strong><small>${subject(a.subject).short} · ${fmtDate(a.time)}</small></div><span class="score" style="color:${a.correct?'var(--mint)':'var(--coral)'}">${a.correct?'Верно':'Повторить'}</span></div>`).join('')}</div>`:'<div class="empty-note">Пока занятий нет. Первые результаты появятся здесь после диагностики.</div>'}</section>
    <section class="panel"><div class="card-top"><h3>${focus.length?'Что повторить':'Ваш следующий шаг'}</h3><span class="soft-icon">✧</span></div>${focus.length?`<div class="focus-list">${focus.map((x,i)=>`<div class="focus-row"><span class="focus-num">0${i+1}</span><div><strong>${safe(x.topic)}</strong><small>${subject(x.subject).short}</small></div><button data-start="practice" data-subject="${x.subject}">Учить</button></div>`).join('')}</div>`:'<div class="empty-note">Диагностика покажет, на каких темах сосредоточиться в первую очередь.</div>'}</section></div>`}
  function plan(){const st=stats(),priority=getPriority().slice(0,3),weak=weakTopics().slice(0,7);return `${pageHead('ПЕРСОНАЛЬНЫЙ МАРШРУТ','Мой план','План обновляется по результатам ваших ответов.',`<span class="pill">${st.all.length?'Основан на вашей практике':'Начните с диагностики'}</span>`)}<div class="plan-grid"><section class="panel"><div class="card-top"><h3>План на сегодня · около 20 минут</h3><span class="soft-icon">✦</span></div><div class="plan-steps"><div class="plan-step"><span class="step-number">01</span><div><strong>${st.all.length?'Повторите ошибки':'Пройдите диагностику'}</strong><p>${st.all.length?'Вернитесь к вопросам, на которых возникли сложности.':'18 вопросов по шести направлениям помогут составить первый маршрут.'}</p></div></div><div class="plan-step"><span class="step-number">02</span><div><strong>Потренируйте ${priority[0].short.toLowerCase()}</strong><p>Короткая практика из 8 вопросов с объяснением после каждого ответа.</p></div></div><div class="plan-step"><span class="step-number">03</span><div><strong>Закрепите результат</strong><p>Повторите темы, где точность пока ниже. Пройдите мини-пробник, когда будете готовы.</p></div></div></div><div class="shortcut"><button class="secondary-btn" data-start="${st.all.length?'practice':'diagnostic'}" data-subject="${st.all.length?priority[0].id:'all'}">Начать занятие →</button><button class="ghost-btn" data-route="mistakes">Мои ошибки</button></div></section><section class="panel"><h3 class="section-title">На что обратить внимание</h3>${weak.length?`<div class="topic-list">${weak.map(x=>`<div class="topic-row"><div><strong>${safe(x.topic)}</strong><small>${subject(x.subject).short} · ${x.total} попыток</small></div><span class="topic-score">${Math.round(x.correct/x.total*100)}%</span></div>`).join('')}</div>`:`<div class="empty-note">Когда вы решите первые задания, здесь появятся темы, требующие внимания.</div>`}</section></div><div class="section-row"><h2 class="section-title">Все направления</h2></div><div class="subject-grid">${SUBJECTS.map(subjectCard).join('')}</div>`}
  function practice(){const selected=subjectFilter==='all'?'Все предметы':subject(subjectFilter).name;return `${pageHead('ПРАКТИКА','Тренировка','Короткие занятия с разбором каждого ответа.')}
    <div class="filter-strip"><button class="filter-chip ${subjectFilter==='all'?'active':''}" data-filter="all">Все предметы</button>${SUBJECTS.map(s=>`<button class="filter-chip ${subjectFilter===s.id?'active':''}" data-filter="${s.id}">${s.short}</button>`).join('')}</div>
    <div class="mode-grid"><div class="mode-card"><span class="mode-symbol">✦</span><h3>Умная подборка</h3><p>12 вопросов из разных предметов с учётом ваших прежних ответов.</p><button class="secondary-btn" data-start="practice" data-subject="all">Начать →</button></div><div class="mode-card"><span class="mode-symbol" style="background:var(--coral-light);color:var(--coral)">◎</span><h3>Диагностика</h3><p>18 вопросов, по три на каждый предмет. Подходит для первого знакомства с платформой.</p><button class="ghost-btn" data-start="diagnostic">Пройти →</button></div><div class="mode-card"><span class="mode-symbol" style="background:var(--mint-light);color:var(--mint)">↻</span><h3>Работа над ошибками</h3><p>Снова решите задания, в которых ранее допустили ошибку.</p><button class="ghost-btn" data-start="review">Повторить →</button></div></div>
    <div class="section-row"><div><h2 class="section-title">${selected}</h2><p>Занятие по одному предмету — 8 вопросов</p></div></div><div class="subject-picker">${(subjectFilter==='all'?SUBJECTS:SUBJECTS.filter(s=>s.id===subjectFilter)).map(s=>`<button class="pick-card" data-start="practice" data-subject="${s.id}"><span class="subject-icon ${s.color}">${s.icon}</span>${s.name}<span style="margin-left:auto;color:var(--blue)">→</span></button>`).join('')}</div>`}
  function mock(){return `${pageHead('ПРОВЕРКА СЕБЯ','Тренировочный пробник','Потренируйте время и концентрацию перед официальным пробником.')}
    <div class="notice"><strong>Это авторский мини-пробник:</strong> 24 вопроса, по четыре на предмет, 25 минут. Он не повторяет полный объём и систему баллов конкурсного теста НИШ.</div>
    <div class="plan-grid"><section class="panel"><div class="card-top"><h3>Мини-пробник · 24 вопроса</h3><span class="soft-icon">◷</span></div><div class="plan-steps"><div class="plan-step"><span class="step-number">01</span><div><strong>Естественно-математический блок</strong><p>Математика, количественные характеристики и естествознание — 12 вопросов.</p></div></div><div class="plan-step"><span class="step-number">02</span><div><strong>Языковой блок</strong><p>Казахский, русский и английский языки — 12 вопросов.</p></div></div><div class="plan-step"><span class="step-number">03</span><div><strong>Разбор результатов</strong><p>После завершения увидите правильные ответы и темы для повторения.</p></div></div></div><div class="shortcut"><button class="secondary-btn" data-start="mock">Начать мини-пробник →</button></div></section><section class="panel"><h3 class="section-title">Нужна настоящая проверка?</h3><p class="subhead">Официальное пробное тестирование НИШ проходит отдельно и даёт индивидуальный отчёт. Используйте его, чтобы независимо оценить готовность.</p><div class="shortcut"><a class="secondary-btn" href="https://onlinetest.nis.edu.kz/" target="_blank" rel="noopener noreferrer">Официальный онлайн-пробник ↗</a><a class="ghost-btn" href="https://trialtest.nis.edu.kz/" target="_blank" rel="noopener noreferrer">Очный пробник ↗</a></div></section></div>`}
  function mistakes(){const failures=profile().attempts.filter(a=>!a.correct&&eligible(a.id)),unique=[...new Map([...failures].reverse().map(a=>[a.id,a])).values()];return `${pageHead('ЗАКРЕПЛЕНИЕ','Работа над ошибками','Вернитесь к сложным заданиям и посмотрите объяснение.',unique.length?`<button class="secondary-btn" data-start="review">Повторить ${Math.min(unique.length,12)} →</button>`:'')}${unique.length?unique.map(a=>{const q=question(a.id);const latest=lastAttemptFor(a.id);return `<div class="mistake-card"><div class="card-top"><strong>${subject(q.subject).short} · ${safe(q.topic)}</strong><span class="pill">${latest.correct?'Исправлено':'Повторить'}</span></div><p>${safe(q.prompt)}</p><p><strong>Разбор:</strong> ${safe(q.explanation)}</p></div>`}).join(''):'<div class="empty-state"><strong>Ошибок пока нет</strong>После занятий здесь появятся вопросы, которые стоит повторить.</div>'}`}
  function resources(){return `${pageHead('БИБЛИОТЕКА','Материалы','Проверенные отправные точки для самостоятельной подготовки.')}
    <p class="resource-note">Внешние сайты открываются в новой вкладке. Некоторые требуют регистрации или оплаты; их материалы не входят в NIS Lab.</p><div class="resource-grid">${RESOURCES.map(r=>`<a class="resource-card" href="${r.url}" target="_blank" rel="noopener noreferrer"><span class="resource-type">${safe(r.type)}</span><strong>${safe(r.title)}</strong><p>${safe(r.description)}</p><span class="resource-link">Открыть ресурс ↗</span></a>`).join('')}</div>`}
  function parents(){const st=stats();return `${pageHead('СЕМЕЙНЫЙ ОБЗОР','Прогресс ученика','Статистика хранится локально в этом браузере.',`<div class="page-actions"><button class="ghost-btn" data-export="csv">Скачать CSV</button><button class="ghost-btn" data-export="json">Копия данных</button></div>`)}<div class="parent-grid"><div class="stat-tile"><span>Решено заданий</span><strong>${st.all.length}</strong></div><div class="stat-tile"><span>Верных ответов</span><strong>${st.correct}</strong></div><div class="stat-tile"><span>Точность</span><strong>${st.all.length?`${st.percent}%`:'—'}</strong></div><div class="stat-tile"><span>Дней практики</span><strong>${uniqueDays()}</strong></div></div><div class="plan-grid"><section class="panel"><h3 class="section-title">Результаты по направлениям</h3><div class="bar-chart">${SUBJECTS.map(s=>`<div class="bar-line"><span>${s.short}</span><div class="track"><span style="width:${st.by[s.id].percent}%"></span></div><b>${st.by[s.id].count?`${st.by[s.id].percent}%`:'—'}</b></div>`).join('')}</div></section><section class="panel"><h3 class="section-title">Как помочь сейчас</h3><div class="plan-steps"><div class="plan-step"><span class="step-number">1</span><div><strong>Заниматься регулярно</strong><p>Короткие занятия помогают замечать прогресс и сохранять интерес.</p></div></div><div class="plan-step"><span class="step-number">2</span><div><strong>Обсуждать ход решения</strong><p>Попросите ребёнка объяснить, как он пришёл к ответу.</p></div></div><div class="plan-step"><span class="step-number">3</span><div><strong>Использовать официальный пробник</strong><p>Он даст независимую оценку подготовки.</p></div></div></div></section></div><p class="resource-note" style="margin-top:19px">Данные хранятся только на этом устройстве. Очистка данных браузера удалит прогресс — сохраните копию при необходимости.</p>`}
  function sessionView(){if(!session)return home();if(session.result)return resultView();const q=question(session.ids[session.index]);if(!q)return '<div class="empty-state">Вопрос не найден. Вернитесь на главную.</div>';const immediate=session.mode==='practice'||session.mode==='review';const selected=session.selected;const title=session.mode==='diagnostic'?'Диагностика':session.mode==='mock'?'Мини-пробник':session.mode==='review'?'Повторение':'Тренировка';const block=session.mode==='mock'?(session.index<12?'Блок 1 · естественные науки':'Блок 2 · языки'):subject(q.subject).name;return `<div class="session-wrap"><div class="session-top"><div><span class="page-kicker">${title.toUpperCase()}</span><div class="session-meta">${block} · вопрос ${session.index+1} из ${session.ids.length}</div></div><div class="page-actions">${session.deadline?`<span class="pill" id="timer">25:00</span>`:''}<button class="text-action" data-quit="1">Выйти ✕</button></div></div><div class="session-track"><span style="width:${Math.round(session.index/session.ids.length*100)}%"></span></div><section class="question-card"><span class="qtag">${subject(q.subject).short} · ${safe(q.topic)}</span>${q.passage?`<div class="passage">${safe(q.passage)}</div>`:''}<h2>${safe(q.prompt)}</h2><div class="answer-list">${q.options.map((o,i)=>{let cls=selected===i?'selected':'';if(immediate&&session.reveal){if(i===q.answer)cls='correct';else if(i===selected)cls='wrong'}return `<button class="answer ${cls}" data-answer="${i}" ${selected!==null?'disabled':''}><span class="letter">${'ABCD'[i]}</span><span>${safe(o)}</span></button>`}).join('')}</div>${immediate&&session.reveal?`<div class="explain"><strong>${selected===q.answer?'Верно!':'Разберём вместе'}</strong>${safe(q.explanation)}</div>`:''}</section><div class="session-actions"><span class="session-meta">${immediate?'После ответа вы увидите объяснение.':'Разбор появится после завершения.'}</span><button class="secondary-btn" data-next="1" ${selected===null?'disabled':''}>${session.index===session.ids.length-1?'Завершить':'Следующий вопрос'} →</button></div></div>`}
  function resultView(){const correct=session.answers.filter((x,i)=>x===question(session.ids[i])?.answer).length,total=session.answers.length,pct=total?Math.round(correct/total*100):0;const by=SUBJECTS.map(s=>{const ids=session.ids.filter(id=>question(id)?.subject===s.id);const c=ids.filter(id=>session.answers[session.ids.indexOf(id)]===question(id)?.answer).length;return {s,c,total:ids.length}}).filter(x=>x.total);return `<div class="session-wrap">${pageHead('РЕЗУЛЬТАТ ЗАНЯТИЯ','Отличная работа!','Каждый вопрос — подсказка, что изучать дальше.')}<div class="result-hero"><div class="result-score">${pct}%</div><strong>${correct} из ${total} ответов верны</strong><p>${pct>=80?'Сильный результат. Сохраняйте темп!':pct>=50?'Хорошая база. Ошибки покажут, что повторить.':'Теперь видно, с каких тем лучше начать повторение.'}</p></div><div class="result-breakdown">${by.map(x=>`<div class="panel"><strong>${x.s.short}</strong><span>${x.c} из ${x.total} верно</span></div>`).join('')}</div><div class="shortcut"><button class="secondary-btn" data-done="1">На главную →</button><button class="ghost-btn" data-done-route="mistakes">Посмотреть ошибки</button></div><div class="section-row"><h2 class="section-title">Разбор вопросов</h2></div>${session.ids.map((id,i)=>{const q=question(id),ok=session.answers[i]===q.answer;return `<div class="mistake-card"><div class="card-top"><strong>${i+1}. ${subject(q.subject).short} · ${safe(q.topic)}</strong><span class="pill" style="${ok?'background:var(--mint-light);color:var(--mint)':'background:var(--coral-light);color:#d36b56'}">${ok?'Верно':'Повторить'}</span></div><p>${safe(q.prompt)}</p><p><strong>Правильный ответ:</strong> ${safe(q.options[q.answer])}</p><p>${safe(q.explanation)}</p></div>`}).join('')}</div>`}
  function render(){updateHeader();app.innerHTML=route==='home'?home():route==='plan'?plan():route==='practice'?practice():route==='mock'?mock():route==='mistakes'?mistakes():route==='resources'?resources():route==='parents'?parents():sessionView();if(route==='session'&&session?.deadline)startTimer();else stopTimer()}
  function startTimer(){stopTimer();const update=()=>{if(!session||session.result)return;const remaining=Math.max(0,session.deadline-now()),el=document.getElementById('timer');if(el)el.textContent=`${String(Math.floor(remaining/60000)).padStart(2,'0')}:${String(Math.floor(remaining%60000/1000)).padStart(2,'0')}`;if(remaining===0){if(session.selected!==null){session.answers.push(session.selected)}finishSession();toast('Время вышло — пробник завершён')}};update();tick=setInterval(update,1000)}
  function stopTimer(){if(tick)clearInterval(tick);tick=null}
  let toastTimer;function toast(message){const el=document.getElementById('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3100)}
  function closeModal(){modal.hidden=true;modal.innerHTML=''}
  function openProfiles(){const p=profile();modal.hidden=false;modal.innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-label="Профили"><div class="card-top"><h2>Профили учеников</h2><button class="text-action" data-close-modal="1">✕</button></div><p>У каждого ребёнка свой прогресс на этом устройстве.</p><div class="profile-list">${state.profiles.map(x=>`<button class="profile-choice ${x.id===p.id?'active':''}" data-switch-profile="${x.id}"><span class="avatar">${safe(x.name.slice(0,1).toUpperCase())}</span><span>${safe(x.name)}</span>${x.id===p.id?'✓':''}</button>`).join('')}</div><div class="modal-actions"><button class="secondary-btn" data-new-profile="1">Добавить ученика +</button></div></div>`}
  function openNewProfile(){modal.hidden=false;modal.innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-label="Новый профиль"><h2>Новый профиль</h2><p>Можно добавить вторую сестрёнку — результаты не смешаются.</p><form id="profile-form"><label for="child-name">Имя ученика</label><input id="child-name" name="child-name" maxlength="32" autocomplete="off" placeholder="Например, Алия" required><div class="modal-actions"><button type="button" class="ghost-btn" data-close-modal="1">Отмена</button><button class="secondary-btn" type="submit">Создать профиль</button></div></form></div>`;document.getElementById('child-name').focus()}
  function download(name,type,data){const blob=new Blob([data],{type}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
  function exportData(type){const p=profile(),base=(p.name.trim().replace(/[^\p{L}\p{N}-]+/gu,'-')||'uchenik');if(type==='json'){download(`nis-lab-${base}.json`,'application/json;charset=utf-8',JSON.stringify({app:'NIS Lab',exportedAt:new Date().toISOString(),profile:p},null,2));return}const rows=[['date','subject','topic','question_id','correct','mode'],...p.attempts.map(a=>[new Date(a.time).toISOString(),a.subject,a.topic,a.id,a.correct?'1':'0',a.mode])];download(`nis-lab-${base}.csv`,'text/csv;charset=utf-8','\ufeff'+rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n'))}
  document.addEventListener('click',e=>{const target=e.target.closest('button');if(!target)return;if(target.dataset.route){navigate(target.dataset.route);document.querySelector('.sidebar').classList.remove('open');document.getElementById('scrim').hidden=true}else if(target.dataset.filter){subjectFilter=target.dataset.filter;render()}else if(target.dataset.start){startSession(target.dataset.start,target.dataset.subject||'all')}else if(target.dataset.answer!==undefined){answer(Number(target.dataset.answer))}else if(target.dataset.next){nextQuestion()}else if(target.dataset.quit){if(confirm('Прервать тренировку? Текущие ответы не сохранятся.'))quitSession()}else if(target.dataset.done){quitSession()}else if(target.dataset.doneRoute){session=null;saveSession();navigate(target.dataset.doneRoute)}else if(target.dataset.closeModal){closeModal()}else if(target.dataset.newProfile){openNewProfile()}else if(target.dataset.switchProfile){state.current=target.dataset.switchProfile;save();session=null;saveSession();closeModal();route='home';render()}else if(target.dataset.export){exportData(target.dataset.export)}});
  document.getElementById('profile-button').addEventListener('click',openProfiles);
  document.getElementById('mobile-menu').addEventListener('click',()=>{document.querySelector('.sidebar').classList.add('open');document.getElementById('scrim').hidden=false});
  document.getElementById('scrim').addEventListener('click',()=>{document.querySelector('.sidebar').classList.remove('open');document.getElementById('scrim').hidden=true});
  modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});
  modal.addEventListener('submit',e=>{if(e.target.id!=='profile-form')return;e.preventDefault();const name=document.getElementById('child-name').value.trim();if(!name)return;const id=uid();state.profiles.push({id,name,createdAt:now(),attempts:[]});state.current=id;save();session=null;saveSession();closeModal();route='home';render();toast(`Профиль «${name}» создан`)});
  window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY){state=load(STORAGE_KEY,state);render()}});
  if(session){route='session'}render();
  if(bankLoadError)toast('Локальный банк не прочитан. Встроенные задания доступны; проверьте мастерскую.');
})();
