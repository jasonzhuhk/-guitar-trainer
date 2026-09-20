(function(){
"use strict";
var STRINGS=[6,5,4,3,2,1], OPEN_MIDI={6:40,5:45,4:50,3:55,2:59,1:64}, STORAGE_KEY="shiguang-guitar-v2";
var CHORDS={
  Em:{keys:["5-2","4-2"],pattern:["O","2","2","O","O","O"]},
  Am:{keys:["4-2","3-2","2-1"],pattern:["X","O","2","2","1","O"]},
  C:{keys:["5-3","4-2","2-1"],pattern:["X","3","2","O","1","O"]},
  G:{keys:["6-3","5-2","1-3"],pattern:["3","2","O","O","O","3"]},
  D:{keys:["3-2","2-3","1-2"],pattern:["X","X","O","2","3","2"]},
  Dm:{keys:["3-2","2-3","1-1"],pattern:["X","X","O","2","3","1"]}
};
var state=loadState(),practiceSelected={},quizSelected={},audioCtx=null,quizTarget="Em",quizStarted=Date.now(),timerId=null,animationTimers=[];

function defaultState(){return{currentDay:13,completed:{},practiceDates:{},quiz:{correct:0,total:0,bestStreak:0},dailyQuiz:{date:dateKey(),correct:0},quizStreak:0};}
function loadState(){try{var saved=JSON.parse(localStorage.getItem(STORAGE_KEY));return Object.assign(defaultState(),saved||{});}catch(e){return defaultState();}}
function saveState(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch(e){}}
function dateKey(date){var d=date||new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function markPractice(){state.practiceDates[dateKey()]=true;saveState();renderProgress();}
function getStreak(){var count=0,d=new Date();if(!state.practiceDates[dateKey(d)])d.setDate(d.getDate()-1);while(state.practiceDates[dateKey(d)]){count++;d.setDate(d.getDate()-1);}return count;}
function el(id){return document.getElementById(id);}
function sortedKeys(obj){return Object.keys(obj).filter(function(k){return obj[k];}).sort();}
function sameKeys(a,b){if(a.length!==b.length)return false;for(var i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true;}
function detectChord(selected){var current=sortedKeys(selected),names=Object.keys(CHORDS);for(var i=0;i<names.length;i++){if(sameKeys(current,CHORDS[names[i]].keys.slice().sort()))return names[i];}return null;}

function showView(name){
  document.querySelectorAll(".view").forEach(function(v){v.classList.toggle("active",v.dataset.view===name);});
  document.querySelectorAll("[data-tab]").forEach(function(b){b.classList.toggle("active",b.dataset.tab===name);});
  window.scrollTo(0,0);if(name==="quiz")startQuizTimer();if(name==="progress")renderProgress();
}
document.querySelectorAll("[data-tab]").forEach(function(b){b.addEventListener("click",function(){showView(b.dataset.tab);});});
document.querySelectorAll("[data-go]").forEach(function(b){b.addEventListener("click",function(){showView(b.dataset.go);});});

function renderToday(){
  var lesson=window.COURSE[state.currentDay-1],done=state.completed[state.currentDay]||{},count=lesson.steps.filter(function(_,i){return done[i];}).length,percent=Math.round(count/lesson.steps.length*100);
  el("todayPhase").textContent=lesson.phase;el("todayDay").textContent="第 "+lesson.day+" 天";el("todayTitle").textContent=lesson.title;el("todayIntro").textContent=lesson.intro;el("todayDuration").textContent="约 "+lesson.duration+" 分钟";el("todayBpm").textContent=lesson.bpm+" BPM";el("todayMistake").textContent=lesson.mistake;el("lessonPercent").textContent=percent+"%";el("lessonProgressText").textContent=count+" / "+lesson.steps.length+" 项完成";el("lessonRing").style.setProperty("--p",percent*3.6+"deg");
  el("lessonList").innerHTML="";lesson.steps.forEach(function(step,index){var button=document.createElement("button");button.className="lesson-item"+(done[index]?" done":"");button.innerHTML='<span class="lesson-icon">'+(done[index]?"✓":step.icon)+'</span><span><small>'+step.label+'</small><strong>'+step.title+'</strong><p>'+step.detail+'</p></span><span class="lesson-check">✓</span>';button.addEventListener("click",function(){done[index]=!done[index];state.completed[state.currentDay]=done;if(done[index])markPractice();saveState();renderToday();renderProgress();});el("lessonList").appendChild(button);});
  renderCourseMap();
}
function renderCourseMap(){el("courseMap").innerHTML="";window.COURSE.forEach(function(lesson){var count=Object.values(state.completed[lesson.day]||{}).filter(Boolean).length,b=document.createElement("button");b.className="course-day"+(count===5?" done":"")+(lesson.day===state.currentDay?" current":"");b.innerHTML="<b>"+lesson.day+"</b><small>"+(count===5?"完成":lesson.bpm+"拍")+"</small>";b.title=lesson.title;b.addEventListener("click",function(){state.currentDay=lesson.day;saveState();renderToday();renderProgress();window.scrollTo({top:0,behavior:"smooth"});});el("courseMap").appendChild(b);});}
el("resetLesson").addEventListener("click",function(){state.completed[state.currentDay]={};saveState();renderToday();renderProgress();});

function renderShortcuts(){el("chordShortcuts").innerHTML="";Object.keys(CHORDS).forEach(function(name){var b=document.createElement("button");b.className="chord-chip";b.textContent=name;b.addEventListener("click",function(){practiceSelected={};CHORDS[name].keys.forEach(function(k){practiceSelected[k]=true;});renderBoard("fretboard",practiceSelected,false);updateRecognition();});el("chordShortcuts").appendChild(b);});}
function renderOpenStates(containerId,chordName,hide){var box=el(containerId);box.innerHTML="";var pattern=chordName?CHORDS[chordName].pattern:null;STRINGS.forEach(function(_,i){var s=document.createElement("span");s.textContent=hide?"•":pattern?pattern[i]:"O";if(pattern&&pattern[i]==="X")s.className="muted";box.appendChild(s);});}
function renderBoard(containerId,selected,isQuiz){
  var board=el(containerId);board.innerHTML="";for(var fret=1;fret<=5;fret++){var wire=document.createElement("div");wire.className="fret-wire";wire.style.top=(fret/5*100)+"%";board.appendChild(wire);var number=document.createElement("span");number.className="fret-number";number.style.top=((fret-.5)/5*100)+"%";number.textContent=fret;board.appendChild(number);}
  STRINGS.forEach(function(s,index){var line=document.createElement("div");line.className="g-string string-"+s;line.id=(isQuiz?"q":"p")+"-string-"+s;line.style.left=(index/5*100)+"%";board.appendChild(line);});
  if(!isQuiz){var pick=document.createElement("div");pick.className="pick";pick.id="pick";pick.textContent="拨";board.appendChild(pick);}
  for(var f=1;f<=5;f++){STRINGS.forEach(function(s,index){var k=s+"-"+f,hit=document.createElement("button");hit.className="fret-hit";hit.style.left=(index/5*100)+"%";hit.style.top=((f-.5)/5*100)+"%";hit.setAttribute("aria-label",s+"弦 "+f+"品");if(selected[k]){var dot=document.createElement("span");dot.className="finger-dot";dot.textContent="●";hit.appendChild(dot);}hit.addEventListener("click",function(){if(selected[k])delete selected[k];else selected[k]=true;if(!isQuiz)preview(OPEN_MIDI[s]+f);renderBoard(containerId,selected,isQuiz);if(isQuiz){el("quizFeedback").textContent="继续摆放，完成后提交";}else updateRecognition();});board.appendChild(hit);});}
}
function updateRecognition(){var name=detectChord(practiceSelected),has=sortedKeys(practiceSelected).length;el("chordName").textContent=name|| (has?"…":"—");el("chordPattern").textContent=name?CHORDS[name].pattern.join(" "):has?"继续调整按弦位置":"等待摆放";el("recognitionBadge").textContent=name?"已识别":"练习中";el("recognitionBadge").classList.toggle("known",!!name);el("strumDown").disabled=!name;el("strumUp").disabled=!name;el("practiceHint").textContent=name?name+" · "+CHORDS[name].pattern.join(" "):"摆出或选择一个和弦后开始";document.querySelectorAll(".chord-chip").forEach(function(b){b.classList.toggle("active",b.textContent===name);});renderOpenStates("openState",name,false);}
el("clearFretboard").addEventListener("click",function(){practiceSelected={};renderBoard("fretboard",practiceSelected,false);updateRecognition();});

function ensureAudio(){var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;if(!audioCtx)audioCtx=new AC();if(audioCtx.state==="suspended")audioCtx.resume();return audioCtx;}
function pluck(midi,start,volume){if(!audioCtx)return;var frequency=440*Math.pow(2,(midi-69)/12),out=audioCtx.createGain(),filter=audioCtx.createBiquadFilter();filter.type="lowpass";filter.frequency.value=3600;out.gain.setValueAtTime(.0001,start);out.gain.exponentialRampToValueAtTime(.16*(volume||1),start+.008);out.gain.exponentialRampToValueAtTime(.0001,start+1.3);filter.connect(out);out.connect(audioCtx.destination);[1,2,3].forEach(function(h,i){var osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.type=i===0?"triangle":"sine";osc.frequency.value=frequency*h;gain.gain.value=[1,.25,.08][i];osc.connect(gain);gain.connect(filter);osc.start(start);osc.stop(start+1.35);});}
function preview(midi){try{if(ensureAudio())pluck(midi,audioCtx.currentTime,.65);}catch(e){}}
function clearAnimation(){animationTimers.forEach(clearTimeout);animationTimers=[];document.querySelectorAll(".g-string").forEach(function(s){s.classList.remove("vibrate");});}
function strum(direction){var name=detectChord(practiceSelected);if(!name||!ensureAudio())return;clearAnimation();markPractice();var pattern=CHORDS[name].pattern,indexMap={6:0,5:1,4:2,3:3,2:4,1:5},sequence=direction==="down"?STRINGS.slice():STRINGS.slice().reverse(),audible=sequence.filter(function(s){return pattern[indexMap[s]]!=="X";}),pick=el("pick");pick.classList.add("run");audible.forEach(function(s,step){animationTimers.push(setTimeout(function(){pick.style.left=(STRINGS.indexOf(s)/5*100)+"%";var line=el("p-string-"+s);line.classList.remove("vibrate");void line.offsetWidth;line.classList.add("vibrate");var value=pattern[indexMap[s]],fret=value==="O"?0:parseInt(value,10);pluck(OPEN_MIDI[s]+fret,audioCtx.currentTime,1);},step*70));});animationTimers.push(setTimeout(function(){pick.classList.remove("run");},audible.length*70+400));}
el("strumDown").addEventListener("click",function(){strum("down");});el("strumUp").addEventListener("click",function(){strum("up");});

function newQuiz(avoid){var names=Object.keys(CHORDS).filter(function(n){return n!==avoid;});quizTarget=names[Math.floor(Math.random()*names.length)];quizSelected={};quizStarted=Date.now();el("quizTarget").textContent=quizTarget;el("quizFeedback").textContent="准备好就开始摆放";el("quizFeedback").style.color="";el("submitQuiz").disabled=false;el("submitQuiz").textContent="提交答案";document.querySelector(".quiz-target").className="quiz-target card";renderBoard("quizFretboard",quizSelected,true);renderOpenStates("quizOpenState",quizTarget,true);}
function startQuizTimer(){if(timerId)return;timerId=setInterval(function(){var sec=Math.floor((Date.now()-quizStarted)/1000);el("quizTimer").textContent=Math.floor(sec/60)+":"+String(sec%60).padStart(2,"0");},1000);}
el("quizClear").addEventListener("click",function(){quizSelected={};renderBoard("quizFretboard",quizSelected,true);el("quizFeedback").textContent="已清空，再试一次";});
el("submitQuiz").addEventListener("click",function(){if(el("submitQuiz").textContent==="下一题"){newQuiz(quizTarget);return;}var correct=sameKeys(sortedKeys(quizSelected),CHORDS[quizTarget].keys.slice().sort());state.quiz.total++;if(state.dailyQuiz.date!==dateKey())state.dailyQuiz={date:dateKey(),correct:0};if(correct){state.quiz.correct++;state.dailyQuiz.correct++;state.quizStreak++;state.quiz.bestStreak=Math.max(state.quiz.bestStreak,state.quizStreak);el("quizFeedback").textContent="正确！手指已经记住 "+quizTarget;el("quizFeedback").style.color="var(--green)";document.querySelector(".quiz-target").classList.add("correct");markPractice();}else{state.quizStreak=0;el("quizFeedback").textContent="还差一点：答案是 "+CHORDS[quizTarget].pattern.join(" ");el("quizFeedback").style.color="var(--red)";document.querySelector(".quiz-target").classList.add("wrong");}saveState();el("submitQuiz").textContent="下一题";el("quizCorrect").textContent=state.dailyQuiz.correct;el("quizStreak").textContent=state.quizStreak;renderProgress();});

function renderProgress(){var streak=getStreak(),completed=window.COURSE.filter(function(l){return Object.values(state.completed[l.day]||{}).filter(Boolean).length===5;}).length,totalSteps=window.COURSE.reduce(function(n,l){return n+Object.values(state.completed[l.day]||{}).filter(Boolean).length;},0),percent=Math.round(totalSteps/(window.COURSE.length*5)*100);el("headerStreak").textContent=streak;el("progressStreak").textContent=streak;el("completedDays").textContent=completed;el("quizAccuracy").textContent=state.quiz.total?Math.round(state.quiz.correct/state.quiz.total*100)+"%":"—";el("stagePercent").textContent=percent+"%";el("stageBar").style.width=percent+"%";
  var milestones=[{day:7,title:"基础和弦",sub:"Em / Am / C / G"},{day:14,title:"稳定转换",sub:"四和弦 60 BPM"},{day:21,title:"完整歌曲",sub:"从头到尾不停奏"},{day:30,title:"舞台演出",sub:"表演与失误恢复"}];el("milestones").innerHTML="";milestones.forEach(function(m){var row=document.createElement("div");row.className="milestone"+(completed>=m.day?" done":"");row.innerHTML="<i>"+(completed>=m.day?"✓":"")+"</i><strong>第 "+m.day+" 天 · "+m.title+"</strong><small>"+m.sub+"</small>";el("milestones").appendChild(row);});
  el("activityGrid").innerHTML="";for(var i=13;i>=0;i--){var d=new Date();d.setDate(d.getDate()-i);var active=!!state.practiceDates[dateKey(d)],item=document.createElement("div");item.className="activity-day"+(active?" active":"");item.innerHTML='<i style="height:'+(active?(32+(d.getDate()%5)*9):7)+'%"></i><small>'+(i===0?"今":d.getDate())+'</small>';el("activityGrid").appendChild(item);}
  el("dayPicker").value=state.currentDay;
}
function initDayPicker(){window.COURSE.forEach(function(l){var o=document.createElement("option");o.value=l.day;o.textContent="第 "+l.day+" 天";el("dayPicker").appendChild(o);});el("dayPicker").addEventListener("change",function(){state.currentDay=parseInt(this.value,10);saveState();renderToday();renderProgress();});}
el("clearProgress").addEventListener("click",function(){if(window.confirm("确定清除这台设备上的课程与考试记录吗？")){state=defaultState();saveState();renderToday();renderProgress();el("quizCorrect").textContent="0";el("quizStreak").textContent="0";}});

renderToday();renderShortcuts();renderBoard("fretboard",practiceSelected,false);updateRecognition();renderBoard("quizFretboard",quizSelected,true);renderOpenStates("quizOpenState",quizTarget,true);initDayPicker();renderProgress();newQuiz();if(state.dailyQuiz.date!==dateKey())state.dailyQuiz={date:dateKey(),correct:0};el("quizCorrect").textContent=state.dailyQuiz.correct;el("quizStreak").textContent=state.quizStreak;
})();
