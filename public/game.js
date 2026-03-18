// ═══════════════════════════════════════════════
//  FOOT INSOLITE — game.js
// ═══════════════════════════════════════════════
let game;

function initGame(pseudo, team, socket) {
    const cfg = {
        type: Phaser.AUTO,
        width: 800, height: 480,
        parent: 'game-container',
        backgroundColor: '#1a5c1a',
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        physics: { default:'arcade', arcade:{ debug:false } },
        scene: {
            preload: preload,
            create:  function(){ create.call(this, pseudo, team, socket); },
            update:  update
        }
    };
    game = new Phaser.Game(cfg);
}

// ── VARIABLES ──────────────────────────────────
const MAP_W=800, MAP_H=480;
const PLAYER_SIZE=56, BALL_SIZE=32, BALL_OFFSET=38;
const SHOOT_MIN=160, SHOOT_MAX=720;
const LOB_VZ=260, LOB_GRAVITY=500;
const NET_RATE=16;

const BUT_R = {x:0,    y:164, w:38, h:152};
const BUT_B = {x:762,  y:160, w:38, h:160};
const SPAWN  = {rouge:{x:112,y:240}, bleu:{x:688,y:240}, ball:{x:400,y:240}};

let player, ball, cursors, spaceKey, keyE, keyF, shiftKey;
let hasBall=false, angle=0;
let charging=false, charge=0;
let effectCharging=false, effect=0;
let curveDir=0;
let shootCD=false, shootCDt=0;
let lobOn=false, lobZ=0, lobVZ=0;
let dribbleOn=false, dribblePhase=0, dribbleT=0, dribbleCD=false, dribleCDt=0;
let stamina=100, sprinting=false, moving=false;
let celebrating=false, celebObjs=[];
let goalCD=false, scoreR=0, scoreB=0;
let scoreTxt, pseudoTxt, curveTxt;
let gfxPow, gfxEff, gfxSta, gfxDrib;
let socketG, myTeam, myPseudo;
var remotes={};    // id -> {sprite, label, x, y, tx, ty}
var netT=0;
var pending=null;  // full_state en attente

const DRIB={
    virgule:     {phases:4,dur:160,label:'〽️ VIRGULE'},
    roulette:    {phases:6,dur:120,label:'🌀 ROULETTE'},
    crochet:     {phases:3,dur:130,label:'🦶 CROCHET'},
    passement:   {phases:4,dur:140,label:'👟 PASSEMENT'},
    sombrero:    {phases:3,dur:180,label:'🎩 SOMBRERO'},
    petitpont:   {phases:3,dur:150,label:'🚪 PETIT PONT'},
    doublecontact:{phases:4,dur:110,label:'⚡ DBL'},
    feinte:      {phases:2,dur:200,label:'🎭 FEINTE'},
    rainbow:     {phases:5,dur:130,label:'🌈 RAINBOW'},
    spin:        {phases:6,dur:100,label:'🔄 SPIN'},
};
let myDrib='virgule';

// ── PRELOAD ─────────────────────────────────────
function preload(){
    this.load.image('ballon','assets/Ballon.png');
    for(let i=0;i<=5;i++) this.load.image('J'+i,'assets/J'+i+'.png');
}

// ── CREATE ──────────────────────────────────────
function create(pseudo, team, socket){
    socketG=socket; myTeam=team; myPseudo=pseudo;

    drawField(this);
    this.physics.world.setBounds(0,0,MAP_W,MAP_H);

    // Murs
    const W=this.physics.add.staticGroup();
    addWall(this,W,0,0,MAP_W,4);
    addWall(this,W,0,MAP_H-4,MAP_W,4);
    addWall(this,W,0,0,4,BUT_R.y);
    addWall(this,W,0,BUT_R.y+BUT_R.h,4,MAP_H-BUT_R.y-BUT_R.h);
    addWall(this,W,MAP_W-4,0,4,BUT_B.y);
    addWall(this,W,MAP_W-4,BUT_B.y+BUT_B.h,4,MAP_H-BUT_B.y-BUT_B.h);

    // Anims (une seule fois)
    if(!this.anims.exists('wr')){
        this.anims.create({key:'wr',frames:[{key:'J0'},{key:'J1'},{key:'J2'}],frameRate:8,repeat:-1});
        this.anims.create({key:'ir',frames:[{key:'J0'}],frameRate:1,repeat:-1});
        this.anims.create({key:'wb',frames:[{key:'J3'},{key:'J4'},{key:'J5'}],frameRate:8,repeat:-1});
        this.anims.create({key:'ib',frames:[{key:'J3'}],frameRate:1,repeat:-1});
    }

    // Joueur local
    const sp=SPAWN[team];
    player=this.physics.add.sprite(sp.x,sp.y,team==='rouge'?'J0':'J3');
    player.setDisplaySize(PLAYER_SIZE,PLAYER_SIZE).setCollideWorldBounds(true).setDepth(5);

    // Ballon
    ball=this.physics.add.image(SPAWN.ball.x,SPAWN.ball.y,'ballon');
    ball.setDisplaySize(BALL_SIZE,BALL_SIZE).setCollideWorldBounds(false).setBounce(0.7).setDrag(180).setDepth(5);

    // Collisions
    this.physics.add.collider(player,W);
    this.physics.add.collider(ball,W);
    this.physics.add.overlap(player,ball,()=>{ if(!hasBall&&!shootCD&&!lobOn) hasBall=true; });

    // Clavier
    cursors=this.input.keyboard.addKeys({up:'Z',down:'S',left:'Q',right:'D'});
    spaceKey=this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    keyE    =this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    keyF    =this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    shiftKey=this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

    spaceKey.on('up',()=>{ if(hasBall&&charging&&!dribbleOn){ shoot(); } charging=false; });
    keyE.on('up',    ()=>{ if(hasBall&&!dribbleOn) lob(); });
    keyF.on('down',  ()=>{ if(hasBall&&!dribbleOn&&!dribbleCD&&stamina>=20) startDrib(this); });

    this.input.on('pointerdown',ptr=>{ if(ptr.leftButtonDown()&&hasBall&&!dribbleOn) effectCharging=true; });
    this.input.on('pointerup',  ptr=>{ if(effectCharging&&hasBall&&!dribbleOn) shootCursor(this.input.activePointer); effectCharging=false; });
    window._kc=on=>{this.input.keyboard.enabled=on;};

    // UI
    this.add.text(MAP_W/2-90,14,'ROUGE',{fontFamily:'Bebas Neue',fontSize:'14px',color:'#e83030',stroke:'#000',strokeThickness:3}).setOrigin(0.5,0).setDepth(20);
    scoreTxt=this.add.text(MAP_W/2,10,'0  -  0',{fontFamily:'Bebas Neue',fontSize:'30px',color:'#fff',stroke:'#000',strokeThickness:5}).setOrigin(0.5,0).setDepth(20);
    this.add.text(MAP_W/2+90,14,'BLEU',{fontFamily:'Bebas Neue',fontSize:'14px',color:'#2e7fff',stroke:'#000',strokeThickness:3}).setOrigin(0.5,0).setDepth(20);
    pseudoTxt=this.add.text(0,0,pseudo,{fontFamily:'Bebas Neue',fontSize:'11px',color:'#fff',stroke:'#000',strokeThickness:3}).setOrigin(0.5,1).setDepth(9);
    curveTxt =this.add.text(MAP_W-14,MAP_H-14,'',{fontFamily:'Bebas Neue',fontSize:'13px',color:'#fff',stroke:'#000',strokeThickness:3}).setOrigin(1,1).setDepth(22);
    buildUI(this);

    // Socket events
    socket.on('full_state', data => {
        pending = data;
        // Essaie d'appliquer immédiatement
        if (ball && scoreTxt) {
            applyState(scene, socket, data);
            pending = null;
        }
    });

    // Retry toutes les 300ms si pending non appliqué
    const retryInterval = setInterval(() => {
        if (pending && ball && scoreTxt) {
            applyState(scene, socket, pending);
            pending = null;
        }
    }, 300);
    setTimeout(() => clearInterval(retryInterval), 10000);

    socket.on('player_joined',p=>{
        if(p.id!==socket.id) addRemote(this,p);
    });

    socket.on('player_move',data=>{
        if(remotes[data.id]){
            remotes[data.id].tx=data.x;
            remotes[data.id].ty=data.y;
        }
    });

    socket.on('ball_move',data=>{
        if(hasBall) return;
        const dx=data.x-ball.x, dy=data.y-ball.y;
        const dist=Math.sqrt(dx*dx+dy*dy);
        if(dist>100) {
            // Vraiment loin : téléporte
            ball.setPosition(data.x,data.y);
        } else if(dist>3) {
            // Correction douce
            ball.setPosition(ball.x+dx*0.6, ball.y+dy*0.6);
        }
        // Laisse la physique locale prendre le relais avec la vélocité
        ball.setVelocity(data.vx||0, data.vy||0);
    });

    socket.on('goal_scored',({team,scores,scorerPseudo})=>{
        scoreR=scores.rouge; scoreB=scores.bleu;
        scoreTxt.setText(scoreR+'  -  '+scoreB);
        goalEvent(this,team,scorerPseudo);
    });

    socket.on('ball_reset',data=>{
        ball.setPosition(data.x,data.y).setVelocity(0,0);
        hasBall=false;
    });

    socket.on('player_left',({id})=>{
        if(remotes[id]){ try{remotes[id].s.destroy();}catch(e){} try{remotes[id].l.destroy();}catch(e){} delete remotes[id]; }
    });

    socket.on('send_pos',()=>{
        socket.emit('player_update',{x:Math.round(player.x),y:Math.round(player.y),angle,hasBall});
    });
}

// ── AJOUTER UN JOUEUR DISTANT ───────────────────
function addRemote(scene,p){
    if(remotes[p.id]){ try{remotes[p.id].s.destroy();}catch(e){} try{remotes[p.id].l.destroy();}catch(e){} }
    const sx=p.x||(p.team==='rouge'?SPAWN.rouge.x:SPAWN.bleu.x);
    const sy=p.y||SPAWN.ball.y;
    const s=scene.add.sprite(sx,sy,p.team==='rouge'?'J0':'J3');
    s.setDisplaySize(PLAYER_SIZE,PLAYER_SIZE).setDepth(4);
    const col=p.team==='rouge'?'#ff8888':'#88aaff';
    const l=scene.add.text(sx,sy-PLAYER_SIZE/2-4,p.pseudo||'?',{fontFamily:'Bebas Neue',fontSize:'11px',color:col,stroke:'#000',strokeThickness:3}).setOrigin(0.5,1).setDepth(9);
    remotes[p.id]={s,l,x:sx,y:sy,tx:sx,ty:sy,team:p.team};
    console.log('[remote] créé:',p.pseudo,p.team);
}

// ── APPLIQUER FULL_STATE ─────────────────────────
function applyState(scene,socket,data){
    const {players,ball:bd,scores}=data;
    scoreR=scores.rouge; scoreB=scores.bleu;
    if(scoreTxt) scoreTxt.setText(scoreR+'  -  '+scoreB);
    if(bd&&!hasBall) ball.setPosition(bd.x,bd.y).setVelocity(bd.vx||0,bd.vy||0);

    // Crée les joueurs distants manquants (tous sauf soi-même)
    Object.values(players).forEach(p=>{
        if(p.id===socket.id) return;
        if(!remotes[p.id]) {
            addRemote(scene,p);
        } else {
            // Ne met à jour la cible que si le joueur a vraiment bougé
            // (évite les micro-TP causés par les full_state périodiques)
            const r=remotes[p.id];
            const dx=p.x-r.tx, dy=p.y-r.ty;
            if(Math.sqrt(dx*dx+dy*dy)>2) {
                r.tx=p.x; r.ty=p.y;
            }
        }
    });

    // Supprime ceux partis
    const ids=new Set(Object.values(players).map(p=>p.id));
    Object.keys(remotes).forEach(id=>{
        if(!ids.has(id)){ try{remotes[id].s.destroy();}catch(e){} try{remotes[id].l.destroy();}catch(e){} delete remotes[id]; }
    });
}

// ── UPDATE ──────────────────────────────────────
function update(time,delta){
    if(!player||celebrating) return;
    const dt=delta/1000;
    const scene=this;

    // Applique pending dès que prêt
    if(pending&&ball&&scoreTxt){
        applyState(scene,socketG,pending);
        pending=null;
    }

    // Cooldowns
    if(shootCD){shootCDt-=delta;if(shootCDt<=0)shootCD=false;}
    if(dribbleCD){dribleCDt-=delta;if(dribleCDt<=0)dribbleCD=false;}

    // Mouvement
    let vx=0,vy=0;
    if(cursors.left.isDown)  vx=-1;
    if(cursors.right.isDown) vx= 1;
    if(cursors.up.isDown)    vy=-1;
    if(cursors.down.isDown)  vy= 1;
    if(vx&&vy){vx*=0.707;vy*=0.707;}
    moving=(vx||vy)?true:false;
    sprinting=shiftKey.isDown&&moving&&stamina>0;
    const spd=sprinting?210:165;
    player.setVelocity(vx*spd,vy*spd);
    if(moving){angle=Math.atan2(vy,vx);player.anims.play(myTeam==='rouge'?'wr':'wb',true);}
    else player.anims.play(myTeam==='rouge'?'ir':'ib',true);

    // Stamina
    if(sprinting) stamina=Math.max(0,stamina-35*dt);
    else if(!moving) stamina=Math.min(100,stamina+18*dt);
    else stamina=Math.min(100,stamina+5*dt);

    // Dribble
    if(dribbleOn){
        dribbleT-=delta;
        if(dribbleT<=0){
            dribblePhase++;
            const c=DRIB[myDrib]||DRIB.virgule;
            if(dribblePhase>=c.phases) endDrib();
            else dribbleT=c.dur;
        }
        if(dribbleOn) animDrib();
    }

    // Balle collée
    if(hasBall&&!dribbleOn){
        ball.setVelocity(0,0);
        ball.setPosition(player.x+Math.cos(angle)*BALL_OFFSET, player.y+Math.sin(angle)*BALL_OFFSET);
        if(spaceKey.isDown){charging=true;charge=Math.min(1,charge+1.1*dt);}
        if(effectCharging) effect=Math.min(1,effect+1.0*dt);
        if(effectCharging) curveTxt.setText('↺ '+Math.round(effect*100)+'%').setColor('#44aaff');
        else if(keyE.isDown) curveTxt.setText('⬆ LOB').setColor('#ffffaa');
        else if(keyF.isDown&&!dribbleCD) curveTxt.setText((DRIB[myDrib]||DRIB.virgule).label).setColor('#f0c040');
        else curveTxt.setText('');
    }

    // Lob
    if(lobOn){
        lobVZ-=LOB_GRAVITY*dt; lobZ+=lobVZ*dt;
        if(lobZ<=0){lobZ=0;lobVZ=0;lobOn=false;ball.setScale(BALL_SIZE/ball.width).setDepth(5).setDrag(180);shootCD=false;}
        else{ball.setScale((BALL_SIZE/ball.width)*(1+(lobZ/100)*0.5));ball.setDepth(10+lobZ*0.05);}
    }

    // Courbe
    if(!hasBall&&!lobOn&&curveDir&&ball.body.speed>50){
        const bvx=ball.body.velocity.x,bvy=ball.body.velocity.y,len=Math.sqrt(bvx*bvx+bvy*bvy);
        if(len>10){const accel=180+effect*(530-180);ball.body.velocity.x+=(-bvy/len*curveDir)*accel*dt*Math.min(1,ball.body.speed/200);ball.body.velocity.y+=(bvx/len*curveDir)*accel*dt*Math.min(1,ball.body.speed/200);}
        curveTxt.setText(curveDir===-1?'↺':'↻').setColor(curveDir===-1?'#44aaff':'#ff8844');
    }
    if(!hasBall&&!lobOn){ball.setRotation(ball.rotation+ball.body.velocity.x*0.002);if(ball.body.speed<25){curveDir=0;effect=0;effectCharging=false;curveTxt.setText('');}}

    // Interpole joueurs distants - fluide sans TP
    Object.values(remotes).forEach(r=>{
        const dx=r.tx-r.x, dy=r.ty-r.y;
        const dist=Math.sqrt(dx*dx+dy*dy);
        // TP seulement si très loin (>300px = vraiment décalé)
        if(dist>300){
            r.x=r.tx; r.y=r.ty;
        } else {
            // Lerp adaptatif : plus rapide si loin, plus doux si proche
            const lerpF = dist>60 ? 0.55 : 0.3;
            r.x+=dx*lerpF; r.y+=dy*lerpF;
        }
        r.s.setPosition(r.x,r.y);
        r.l.setPosition(r.x,r.y-PLAYER_SIZE/2-4);
        r.s.anims.play(dist>3?(r.team==='rouge'?'wr':'wb'):(r.team==='rouge'?'ir':'ib'),true);
    });

    if(pseudoTxt) pseudoTxt.setPosition(player.x,player.y-PLAYER_SIZE/2-4);

    // Réseau
    netT+=delta;
    if(netT>=NET_RATE){
        netT=0;
        socketG?.emit('player_update',{x:Math.round(player.x),y:Math.round(player.y),angle,hasBall});
        if(hasBall||ball.body.speed>3) socketG?.emit('ball_update',{x:Math.round(ball.x),y:Math.round(ball.y),vx:Math.round(ball.body.velocity.x),vy:Math.round(ball.body.velocity.y)});
    }

    updPow(); updEff(); updSta(); updDrib();
    if(!goalCD) checkGoals(scene);
}

// ── DRIBBLES ────────────────────────────────────
function startDrib(scene){
    dribbleOn=true;dribblePhase=0;
    const c=DRIB[myDrib]||DRIB.virgule;dribbleT=c.dur;
    stamina=Math.max(0,stamina-20);
    const t=scene.add.text(player.x,player.y-60,c.label,{fontFamily:'Bebas Neue',fontSize:'22px',color:'#f0c040',stroke:'#000',strokeThickness:4}).setOrigin(0.5).setDepth(30);
    scene.tweens.add({targets:t,y:t.y-36,alpha:0,duration:700,onComplete:()=>t.destroy()});
}
function animDrib(){
    const pL=angle-Math.PI/2,pR=angle+Math.PI/2;
    const c=DRIB[myDrib]||DRIB.virgule;
    const t=1-(dribbleT/c.dur);
    let tx=player.x,ty=player.y;
    const d=myDrib;
    if(d==='virgule'||d==='passement'||d==='crochet'){
        if(dribblePhase===0){tx=player.x+Math.cos(pL)*38*t;ty=player.y+Math.sin(pL)*38*t;}
        else if(dribblePhase===1){const a=pL+(pR-pL)*t;tx=player.x+Math.cos(a)*38;ty=player.y+Math.sin(a)*38+Math.cos(angle)*t*20;}
        else if(dribblePhase===2){tx=player.x+Math.cos(pL)*38*(1-t)*0.4+Math.cos(angle)*(34+t*14);ty=player.y+Math.sin(pL)*38*(1-t)*0.4+Math.sin(angle)*(34+t*14);}
        else{tx=player.x+Math.cos(angle)*BALL_OFFSET;ty=player.y+Math.sin(angle)*BALL_OFFSET;}
    }else if(d==='roulette'||d==='spin'){const ao=((dribblePhase+t)/c.phases)*Math.PI*2+angle;tx=player.x+Math.cos(ao)*40;ty=player.y+Math.sin(ao)*40;}
    else if(d==='sombrero'){tx=player.x+Math.cos(angle)*BALL_OFFSET;ty=player.y+Math.sin(angle)*BALL_OFFSET;ball.setScale((BALL_SIZE/ball.width)*(1+(dribblePhase===0?t:1-t)*0.6));}
    else if(d==='petitpont'){if(dribblePhase===0){ball.setAlpha(1-t*0.9);tx=player.x;ty=player.y;}else if(dribblePhase===1){ball.setAlpha(t);tx=player.x+Math.cos(angle)*40;ty=player.y+Math.sin(angle)*40;}else{ball.setAlpha(1);tx=player.x+Math.cos(angle)*BALL_OFFSET;ty=player.y+Math.sin(angle)*BALL_OFFSET;}}
    else if(d==='rainbow'){const arc=Math.sin(((dribblePhase+t)/c.phases)*Math.PI);tx=player.x+Math.cos(angle+Math.PI)*30*(1-(dribblePhase+t)/c.phases)+Math.cos(angle)*arc*20;ty=player.y+Math.sin(angle+Math.PI)*30*(1-(dribblePhase+t)/c.phases)+Math.sin(angle)*arc*20;ball.setScale((BALL_SIZE/ball.width)*(1+arc*0.4));}
    else if(d==='doublecontact'){const side=dribblePhase%2===0?pL:pR;tx=player.x+Math.cos(side)*30*Math.sin(t*Math.PI)+Math.cos(angle)*dribblePhase*8;ty=player.y+Math.sin(side)*30*Math.sin(t*Math.PI)+Math.sin(angle)*dribblePhase*8;}
    else if(d==='feinte'){if(dribblePhase===0){tx=player.x+Math.cos(angle+Math.PI)*20*t;ty=player.y+Math.sin(angle+Math.PI)*20*t;}else{tx=player.x+Math.cos(angle)*50*t;ty=player.y+Math.sin(angle)*50*t;}}
    else{tx=player.x+Math.cos(angle)*BALL_OFFSET;ty=player.y+Math.sin(angle)*BALL_OFFSET;}
    ball.setPosition(tx,ty);ball.setVelocity(0,0);
}
function endDrib(){dribbleOn=false;dribbleCD=true;dribleCDt=2800;ball.setAlpha(1).setScale(BALL_SIZE/ball.width);ball.setPosition(player.x+Math.cos(angle)*BALL_OFFSET,player.y+Math.sin(angle)*BALL_OFFSET);hasBall=true;}

// ── TIRS ────────────────────────────────────────
function shoot(){curveDir=0;fire(SHOOT_MIN+charge*(SHOOT_MAX-SHOOT_MIN));charge=0;charging=false;}
function shootCursor(ptr){
    const a=Phaser.Math.Angle.Between(player.x,player.y,ptr.x,ptr.y);
    const power=320+effect*220;
    const diff=Phaser.Math.Angle.Wrap(a-angle);
    curveDir=diff>0.15?1:diff<-0.15?-1:0;
    if(Math.abs(diff)<0.15)curveDir=Math.abs(Math.sin(a))<0.15?(Math.random()<0.5?-1:1):0;
    hasBall=false;charging=false;effectCharging=false;shootCD=true;shootCDt=650;lobOn=false;
    ball.setScale(BALL_SIZE/ball.width);ball.setVelocity(Math.cos(a)*power,Math.sin(a)*power);player.setVelocity(-Math.cos(a)*60,-Math.sin(a)*60);
}
function fire(p){hasBall=false;charging=false;effectCharging=false;shootCD=true;shootCDt=650;lobOn=false;ball.setScale(BALL_SIZE/ball.width);ball.setVelocity(Math.cos(angle)*p,Math.sin(angle)*p);player.setVelocity(-Math.cos(angle)*70,-Math.sin(angle)*70);}
function lob(){hasBall=false;charging=false;effectCharging=false;shootCD=true;shootCDt=2200;lobOn=true;lobZ=1;lobVZ=LOB_VZ;charge=0;effect=0;curveDir=0;ball.setVelocity(Math.cos(angle)*200,Math.sin(angle)*200);ball.setDrag(15);player.setVelocity(-Math.cos(angle)*40,-Math.sin(angle)*40);}

// ── BUTS ────────────────────────────────────────
function checkGoals(scene){
    const bx=ball.x,by=ball.y;if(lobOn)return;
    if(bx<BUT_R.x+BUT_R.w&&by>BUT_R.y&&by<BUT_R.y+BUT_R.h) socketG?.emit('goal',{team:'bleu',scorerPseudo:myPseudo});
    else if(bx>BUT_B.x&&by>BUT_B.y&&by<BUT_B.y+BUT_B.h)    socketG?.emit('goal',{team:'rouge',scorerPseudo:myPseudo});
    else if(bx<-20||bx>MAP_W+20||by<-20||by>MAP_H+20) resetAll();
}
function goalEvent(scene,team,name){
    goalCD=true;hasBall=false;charging=false;charge=0;curveDir=0;effect=0;effectCharging=false;lobOn=false;dribbleOn=false;
    ball.setVelocity(0,0);player.setVelocity(0,0);
    celebrate(scene,team,name||myPseudo);
}
function resetAll(){
    ball.setPosition(SPAWN.ball.x,SPAWN.ball.y).setVelocity(0,0).setDrag(180).setScale(BALL_SIZE/ball.width).setDepth(5).setAlpha(1);
    player.setPosition(SPAWN[myTeam].x,SPAWN[myTeam].y).setVelocity(0,0).setDisplaySize(PLAYER_SIZE,PLAYER_SIZE);
    hasBall=false;curveDir=0;charge=0;effect=0;charging=false;effectCharging=false;lobOn=false;lobZ=0;dribbleOn=false;shootCD=false;celebrating=false;
    curveTxt.setText('');
    game.scene.scenes[0].time.delayedCall(100,()=>{goalCD=false;});
}

// ── CÉLÉBRATION ─────────────────────────────────
function celebrate(scene,team,name){
    celebrating=true;celebObjs=[];
    const col=team==='rouge'?'#e83030':'#2e7fff';
    const t1=scene.add.text(MAP_W/2,MAP_H/2-40,'BUT !',{fontFamily:'Bebas Neue',fontSize:'88px',color:col,stroke:'#000',strokeThickness:10}).setOrigin(0.5).setDepth(30).setScale(0);
    scene.tweens.add({targets:t1,scaleX:1,scaleY:1,duration:280,ease:'Back.Out'});
    const t2=scene.add.text(MAP_W/2,MAP_H/2+54,name.toUpperCase()+' MARQUE !',{fontFamily:'Bebas Neue',fontSize:'22px',color:'#fff',stroke:'#000',strokeThickness:4}).setOrigin(0.5).setDepth(30).setAlpha(0);
    scene.tweens.add({targets:t2,alpha:1,duration:350,delay:180});
    celebObjs.push(t1,t2);
    const cols=[0xffdd00,0xff4444,0x44aaff,0xffffff,0xff8800,0x44dd44];
    for(let i=0;i<24;i++){const cx=Phaser.Math.Between(40,MAP_W-40);const c=scene.add.graphics().setDepth(29);c.fillStyle(Phaser.Utils.Array.GetRandom(cols),1);c.fillRect(0,0,Phaser.Math.Between(6,12),Phaser.Math.Between(6,12));c.setPosition(cx,-10);scene.tweens.add({targets:c,y:MAP_H+20,x:cx+Phaser.Math.Between(-80,80),angle:Phaser.Math.Between(0,360),duration:Phaser.Math.Between(900,1800),delay:Phaser.Math.Between(0,500)});celebObjs.push(c);}
    scene.tweens.add({targets:player,scaleX:(PLAYER_SIZE/player.width)*1.3,scaleY:(PLAYER_SIZE/player.height)*1.3,yoyo:true,repeat:3,duration:160});
    scene.time.delayedCall(2600,()=>{celebObjs.forEach(o=>o.destroy());celebObjs=[];celebrating=false;resetAll();});
}

// ── UI JAUGES ───────────────────────────────────
function buildUI(scene){
    const mk=(x,y,lbl)=>{scene.add.graphics().setDepth(20).fillStyle(0,0.5).fillRoundedRect(x,y,140,14,4);scene.add.graphics().setDepth(22).lineStyle(2,0xffffff,0.4).strokeRoundedRect(x,y,140,14,4);scene.add.text(x,y-14,lbl,{fontFamily:'Rajdhani',fontSize:'9px',color:'#fff',stroke:'#000',strokeThickness:2}).setDepth(20);return scene.add.graphics().setDepth(21);};
    gfxPow=mk(16,MAP_H-32,'PUISSANCE [ESPACE]');
    gfxEff=mk(16,MAP_H-58,'EFFET [CLIC]');
    gfxSta=mk(16,MAP_H-84,'ÉNERGIE [SHIFT]');
    gfxDrib=mk(16,MAP_H-110,'DRIBBLE [F]');
}
function bar(g,y,pct,col){g.clear();const fw=Math.max(0,136*pct);if(!fw)return;g.fillStyle(col,1);g.fillRoundedRect(18,y+2,fw,10,2);}
function updPow(){if(!gfxPow||!hasBall){gfxPow&&gfxPow.clear();return;}bar(gfxPow,MAP_H-32,charge,charge<0.4?0x44dd44:charge<0.75?0xffcc00:0xff3333);}
function updEff(){if(!gfxEff||!hasBall){gfxEff&&gfxEff.clear();return;}bar(gfxEff,MAP_H-58,effect,effect<0.5?0x44aaff:effect<0.85?0x2266ff:0xaa44ff);}
function updSta(){if(!gfxSta)return;bar(gfxSta,MAP_H-84,stamina/100,stamina>60?0x44dd44:stamina>30?0xffcc00:0xff3333);}
function updDrib(){if(!gfxDrib)return;bar(gfxDrib,MAP_H-110,dribbleCD?1-(dribleCDt/2800):1,dribbleCD?0xff8800:0xf0c040);}

// ── TERRAIN ─────────────────────────────────────
function drawField(scene){
    const g=scene.add.graphics();
    g.fillStyle(0x2d7a2d,1);g.fillRect(0,0,MAP_W,MAP_H);
    for(let i=0;i<10;i++){if(i%2===0){g.fillStyle(0x287028,1);g.fillRect(i*80,0,80,MAP_H);}}
    g.lineStyle(2,0xffffff,0.8);
    g.strokeRect(10,10,MAP_W-20,MAP_H-20);
    g.beginPath();g.moveTo(MAP_W/2,10);g.lineTo(MAP_W/2,MAP_H-10);g.strokePath();
    g.strokeCircle(MAP_W/2,MAP_H/2,72);
    g.fillStyle(0xffffff,0.8);g.fillCircle(MAP_W/2,MAP_H/2,3);
    g.strokeRect(10,MAP_H/2-80,105,160);g.strokeRect(MAP_W-115,MAP_H/2-80,105,160);
    g.fillStyle(0xffffff,0.15);g.fillRect(BUT_R.x,BUT_R.y,BUT_R.w,BUT_R.h);g.fillRect(BUT_B.x,BUT_B.y,BUT_B.w,BUT_B.h);
    g.lineStyle(3,0xffffff,1);g.strokeRect(BUT_R.x,BUT_R.y,BUT_R.w,BUT_R.h);g.strokeRect(BUT_B.x,BUT_B.y,BUT_B.w,BUT_B.h);
    g.setDepth(0);
}
function addWall(scene,group,x,y,w,h){const wall=group.create(x+w/2,y+h/2,'__DEFAULT');wall.setDisplaySize(w,h).setAlpha(0).refreshBody();}
